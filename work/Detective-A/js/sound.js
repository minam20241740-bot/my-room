'use strict';
/* 소리. 소리 파일 없이 브라우저가 그 자리에서 만들어 낸다(WebAudio). 그래서 내려받은 음원이 없다.
   효과음과 음악의 크기는 설정에서 따로 정한다(0 끔, 1 작게, 2 보통, 3 크게).
   브라우저 규칙 때문에 화면을 처음 누르거나 자판을 처음 누른 뒤부터 소리가 난다. */
window.Snd = (function () {
  const AC = window.AudioContext || window.webkitAudioContext, LV = [0, .35, .7, 1];
  const hz = m => 440 * Math.pow(2, (m - 69) / 12);   // 건반 번호(60 = 가온 도)를 높이(Hz)로
  let ctx = null, sfxG = null, bgmG = null, lv = { sfx: 2, bgm: 2 };
  let song = null, want = null, songG = null, nextT = 0, barI = 0, timer = 0;

  function ensure() {
    if (ctx || !AC) return ctx;
    try { ctx = new AC(); } catch (e) { ctx = null; return null; }
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 6; comp.connect(ctx.destination);   // 여러 소리가 겹쳐도 찢어지지 않게
    sfxG = ctx.createGain(); bgmG = ctx.createGain(); sfxG.connect(comp); bgmG.connect(comp); apply();
    return ctx;
  }
  function apply() { if (!ctx) return; sfxG.gain.value = LV[lv.sfx] * .9; bgmG.gain.value = LV[lv.bgm] * .5; }
  function unlock() {
    if (!ensure()) return;
    if (ctx.state === 'suspended') ctx.resume().then(() => { if (want && song !== want) music(want); });
    else if (want && song !== want) music(want);
  }

  // ── 소리의 재료 ──
  // 음 하나: 높이, 시작, 길이, 파형, 크기, 끝 높이(미끄러지는 소리), 올라오는 시간
  function tone(c, out, f, t, dur, type, vol, f2, att) {
    const o = c.createOscillator(), g = c.createGain(); o.type = type || 'sine';
    o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + (att || .008)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + .03);
  }
  // 바람·물·부딪힘처럼 거친 소리: 시작, 길이, 크기, 걸러 내는 높이, 날카로움, 거르는 방식, 끝 높이
  const nbufs = new WeakMap();
  function nbuf(c) { let b = nbufs.get(c); if (!b) { b = c.createBuffer(1, c.sampleRate, c.sampleRate); const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; nbufs.set(c, b); } return b; }
  function noise(c, out, t, dur, vol, freq, q, kind, f2) {
    const src = c.createBufferSource(); src.buffer = nbuf(c); src.loop = true;
    const fl = c.createBiquadFilter(); fl.type = kind || 'bandpass'; fl.frequency.setValueAtTime(freq, t); if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur); fl.Q.value = q || 1;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(fl); fl.connect(g); g.connect(out); src.start(t, Math.random() * .5); src.stop(t + dur + .03);
  }
  const seq = (c, o, t, notes, type, vol, gap, len) => notes.forEach((m, i) => tone(c, o, hz(m), t + i * gap, len, type, vol));

  // ── 효과음 ── 이름: (소리판, 나갈 곳, 시작 시각)
  const SFX = {
    tap: (c, o, t) => tone(c, o, 880, t, .06, 'triangle', .12, 660),                       // 단추
    close: (c, o, t) => tone(c, o, 560, t, .11, 'sine', .12, 330),                         // 문이 닫힘
    open: (c, o, t) => tone(c, o, 520, t, .09, 'sine', .14, 780),                          // 창이 뜸
    next: (c, o, t) => tone(c, o, 700, t, .05, 'sine', .08),                               // 대화 넘김
    blip: (c, o, t) => tone(c, o, 560 + Math.random() * 60, t, .03, 'square', .025),       // 글자가 찍힘
    go: (c, o, t) => noise(c, o, t, .5, .45, 400, .8, 'bandpass', 2400),                   // 출동
    walk: (c, o, t) => noise(c, o, t, .06, .4, 500, 1),                                   // 바닥을 눌러 걸음
    step: (c, o, t) => { noise(c, o, t, .07, .13, 420 + Math.random() * 160, 1.2, 'lowpass'); tone(c, o, 95 + Math.random() * 25, t, .08, 'sine', .05, 60); },   // 도시를 걸을 때 발소리
    reveal: (c, o, t) => seq(c, o, t, [88, 91, 96], 'sine', .1, .06, .3),                  // 숨은 것이 드러남
    found: (c, o, t) => seq(c, o, t, [72, 76, 79, 84], 'triangle', .15, .07, .22),         // 단서를 수첩에 적음
    key: (c, o, t) => { tone(c, o, 1300, t, .04, 'square', .1); noise(c, o, t, .05, .25, 3000, 2); },   // 자물쇠 단추, 잠긴 문
    wrong: (c, o, t) => { tone(c, o, 196, t, .18, 'square', .08); tone(c, o, 185, t + .16, .28, 'square', .08); },
    right: (c, o, t) => seq(c, o, t, [76, 79, 84, 88], 'sine', .14, .08, .4),
    unlock: (c, o, t) => { noise(c, o, t, .05, .2, 2500, 3); tone(c, o, 1100, t + .02, .08, 'triangle', .12); noise(c, o, t + .18, .06, .16, 1500, 3); },   // 찰칵
    creak: (c, o, t) => { tone(c, o, 140, t, .8, 'sawtooth', .13, 260); noise(c, o, t, .8, .14, 700, 4, 'bandpass', 1200); },   // 뚜껑·문이 열림
    pop: (c, o, t) => tone(c, o, 300, t, .22, 'sine', .16, 900),                           // 새 친구가 튀어나옴
    gear: (c, o, t) => { noise(c, o, t, .08, .4, 800, 2); tone(c, o, 180, t, .15, 'triangle', .14, 120); [.25, .5, .75].forEach(d => noise(c, o, t + d, .04, .25, 2200, 4)); },   // 톱니가 맞물려 돎
    bell: (c, o, t) => [0, 1.1].forEach(d => [[1, .22], [2, .12], [2.76, .09], [5.4, .05]].forEach(p => tone(c, o, 330 * p[0], t + d, 2.4 / Math.sqrt(p[0]), 'sine', p[1]))),   // 시계탑 종 두 번
    stamp: (c, o, t) => { tone(c, o, 150, t, .16, 'sine', .28, 60); noise(c, o, t, .1, .14, 600, 1, 'lowpass'); seq(c, o, t + .2, [79, 84], 'triangle', .12, .1, .4); },   // 해결 도장
    // 훈련
    shot: (c, o, t) => tone(c, o, 900 + Math.random() * 200, t, .09, 'triangle', .08, 420),   // 훈련탄
    foe: (c, o, t) => tone(c, o, 300, t, .25, 'sine', .08, 520),                              // 상대가 던짐
    hurt: (c, o, t) => tone(c, o, 220, t, .14, 'square', .1, 110),                           // 팀이 맞음
    gate: (c, o, t) => tone(c, o, 500, t, .4, 'sine', .1, 180),                               // 상대에게 닿지 않게 됨
    ungate: (c, o, t) => tone(c, o, 260, t, .3, 'sine', .1, 700),                             // 다시 닿음
    thunder: (c, o, t) => { noise(c, o, t, .6, .3, 1800, .6, 'lowpass', 150); tone(c, o, 90, t, .5, 'sine', .25, 40); },   // 큰 번개
    win: (c, o, t) => { seq(c, o, t, [72, 76, 79, 84], 'triangle', .16, .11, .3); [72, 79, 84, 88].forEach(m => tone(c, o, hz(m), t + .5, 1, 'triangle', .1)); },
    lose: (c, o, t) => seq(c, o, t, [67, 64, 60, 55], 'triangle', .14, .16, .4),
    // 기술 카드(카드의 id와 이름이 같다)
    big: (c, o, t) => tone(c, o, 300, t, .35, 'sawtooth', .12, 1200),
    ultcharge: (c, o, t) => { tone(c, o, 180, t, 1.0, 'sawtooth', .07, 900, .4); tone(c, o, 360, t + .12, .9, 'sine', .07, 1500, .3); noise(c, o, t, 1.0, .12, 400, .9, 'highpass', 3200); },   // 필살기 충전: 올라가는 소리와 바람
    ultburst: (c, o, t) => { tone(c, o, 150, t, .55, 'sine', .3, 40); noise(c, o, t, .32, .22, 1400, .7, 'lowpass', 220); seq(c, o, t + .06, [84, 88, 91, 96], 'triangle', .2, .06, .22); },   // 필살기 터짐: 낮은 울림과 맑은 네 음
    calm: (c, o, t) => seq(c, o, t, [76, 79, 84, 88], 'sine', .17, .1, .4),   // 진정됨: 풀리는 네 음
    lens: (c, o, t) => { tone(c, o, 1200, t, .14, 'sine', .08, 2200); tone(c, o, 1800, t + .05, .1, 'triangle', .05); },   // 돋보기 빛
    boom: (c, o, t) => { tone(c, o, 160, t, .4, 'sine', .3, 50); noise(c, o, t, .3, .2, 900, .7, 'lowpass', 200); },   // 큰 훈련탄이 맞음
    fast: (c, o, t) => seq(c, o, t, [69, 73, 76, 81, 85], 'square', .09, .05, .12),
    heal: (c, o, t) => { seq(c, o, t, [72, 76, 79], 'sine', .14, .1, .5); tone(c, o, hz(84), t + .3, .7, 'sine', .1); },
    light: (c, o, t) => seq(c, o, t, [84, 88, 91, 96], 'sine', .09, .05, .5),
    water: (c, o, t) => { noise(c, o, t, .5, .45, 2600, 1.2, 'bandpass', 900); tone(c, o, 700, t + .05, .25, 'sine', .1, 300); },
    zap: (c, o, t) => { [0, .06, .12].forEach(d => tone(c, o, 1400 + Math.random() * 600, t + d, .05, 'sawtooth', .12, 300)); noise(c, o, t, .2, .25, 4000, 2); }
  };
  // 자주 나는 소리는 너무 촘촘히 겹치지 않게 사이를 둔다(초)
  const GAP = { shot: .2, blip: .04, hurt: .12, walk: .1, step: .14, tap: .06 }, lastAt = {};
  function play(name) {
    if (!ctx || ctx.state !== 'running' || !lv.sfx || !SFX[name]) return;
    const n = ctx.currentTime; if (GAP[name] && n - (lastAt[name] || -9) < GAP[name]) return; lastAt[name] = n;
    SFX[name](ctx, sfxG, n + .005);
  }

  // ── 음악 ── 곡마다 빠르기(bpm)와 마디들. 마디 하나: [깔리는 화음, 낮은 음, 가락([박, 건반, 길이(박)])]
  const SONGS = {
    office: { bpm: 92, pad: .03, bass: .08, mel: .08, bars: [   // 사무소: 밝고 느긋하게 (도 → 라단조 → 파 → 솔)
      [[60, 64, 67], 48, [[0, 76, 1], [1, 79, 1], [2, 84, 1.5], [3.5, 79, .5]]], [[57, 60, 64], 45, [[0, 81, 1], [1, 76, 1], [2, 72, 2]]],
      [[53, 57, 60], 41, [[0, 77, 1], [1, 81, 1], [2, 84, 1], [3, 81, 1]]], [[55, 59, 62], 43, [[0, 79, 1.5], [1.5, 74, .5], [2, 71, 1], [3, 74, 1]]],
      [[60, 64, 67], 48, [[0, 76, 1], [1, 79, 1], [2, 84, 1.5], [3.5, 86, .5]]], [[57, 60, 64], 45, [[0, 88, 1], [1, 84, 1], [2, 81, 2]]],
      [[53, 57, 60], 41, [[0, 77, 1], [1, 81, 1], [2, 79, 1], [3, 77, 1]]], [[55, 59, 62], 43, [[0, 74, 1], [1, 79, 1], [2, 84, 2]]]] },
    street: { bpm: 108, pad: .025, bass: .08, mel: .075, stac: .6, bars: [   // 도시 거리: 가볍게 톡톡
      [[60, 64, 67], 48, [[0, 72, .5], [.5, 76, .5], [1, 79, .5], [2, 76, .5], [2.5, 79, .5], [3, 84, 1]]], [[55, 59, 62], 43, [[0, 74, .5], [.5, 79, .5], [1, 83, .5], [2, 79, .5], [2.5, 74, .5], [3, 71, 1]]],
      [[57, 60, 64], 45, [[0, 72, .5], [.5, 76, .5], [1, 81, .5], [2, 76, .5], [2.5, 81, .5], [3, 84, 1]]], [[53, 57, 60], 41, [[0, 72, .5], [.5, 77, .5], [1, 81, .5], [2, 79, 1], [3, 77, 1]]]] },
    warehouse: { bpm: 70, pad: .04, bass: .07, mel: .07, wave: 'sine', bassAt: [0], bassLen: 3, bars: [   // 어두운 창고: 낮고 드문드문
      [[57, 60, 64], 45, [[0, 76, 2], [2.5, 72, 1.5]]], [[53, 57, 60], 41, [[0, 77, 2], [3, 76, 1]]],
      [[50, 53, 57], 50, [[0, 74, 2], [2, 77, 2]]], [[52, 56, 59], 52, [[0, 76, 3]]]] },
    cabin: { bpm: 96, pad: .03, bass: .08, mel: .08, bars: [   // 연못가 오두막: 포근하게
      [[53, 57, 60], 41, [[0, 77, 1], [1, 81, .5], [1.5, 84, 1.5], [3, 81, 1]]], [[52, 55, 60], 48, [[0, 79, 1], [1, 76, 1], [2, 72, 2]]],
      [[53, 57, 62], 50, [[0, 77, 1], [1, 81, .5], [1.5, 86, 1.5], [3, 84, 1]]], [[53, 58, 62], 46, [[0, 82, 1], [1, 81, 1], [2, 77, 2]]]] },
    tower: { bpm: 84, pad: .035, bass: .07, mel: .075, tick: .02, bars: [   // 시계탑: 째깍 소리 위에 단조 가락
      [[50, 53, 57], 50, [[0, 74, 1], [1, 77, 1], [2, 81, 2]]], [[50, 53, 58], 46, [[0, 82, 1.5], [1.5, 81, .5], [2, 77, 2]]],
      [[50, 55, 58], 43, [[0, 79, 1], [1, 82, 1], [2, 86, 2]]], [[49, 52, 57], 45, [[0, 85, 1.5], [1.5, 81, .5], [2, 76, 2]]]] },
    battle: { bpm: 136, pad: .02, bass: .08, mel: .04, wave: 'square', stac: .7, drum: .03, bassAt: [0, .5, 1, 1.5, 2, 2.5, 3, 3.5], bassLen: .45, bars: [   // 진정 훈련: 빠르고 힘차게
      [[57, 60, 64], 45, [[0, 81, .5], [.5, 84, .5], [1, 88, 1], [2, 84, .5], [2.5, 81, .5], [3, 84, 1]]], [[53, 57, 60], 41, [[0, 81, .5], [.5, 84, .5], [1, 89, 1], [2, 84, .5], [2.5, 81, .5], [3, 77, 1]]],
      [[55, 60, 64], 48, [[0, 79, .5], [.5, 84, .5], [1, 88, 1], [2, 84, .5], [2.5, 79, .5], [3, 84, 1]]], [[55, 59, 62], 43, [[0, 79, .5], [.5, 83, .5], [1, 86, 1], [2, 83, .5], [2.5, 79, .5], [3, 74, 1]]]] }
  };
  // 마디 하나를 예약하고 그 길이(초)를 돌려준다
  function bar(c, out, S, i, t) {
    const b = S.bars[i % S.bars.length], beat = 60 / S.bpm, len = beat * 4;
    b[0].forEach(m => {
      const o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.value = hz(m);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(S.pad, t + len * .25); g.gain.setValueAtTime(S.pad, t + len * .8); g.gain.linearRampToValueAtTime(0.0001, t + len + .15);
      o.connect(g); g.connect(out); o.start(t); o.stop(t + len + .2);
    });
    (S.bassAt || [0, 2]).forEach(p => tone(c, out, hz(b[1]), t + p * beat, beat * (S.bassLen || 1.6), 'triangle', S.bass));
    b[2].forEach(n => tone(c, out, hz(n[1]), t + n[0] * beat, Math.max(.12, n[2] * beat * (S.stac || .95)), S.wave || 'triangle', S.mel, 0, .012));
    if (S.tick) for (let k = 0; k < 4; k++) tone(c, out, k % 2 ? 1500 : 1900, t + k * beat, .03, 'square', S.tick);
    if (S.drum) for (let k = 0; k < 8; k++) { noise(c, out, t + k * beat / 2, .04, S.drum * (k % 2 ? .6 : 1), 7000, 1, 'highpass'); if (k % 4 === 0) tone(c, out, 120, t + k * beat / 2, .14, 'sine', S.drum * 4, 45); }
    return len;
  }
  function pump() {
    if (!songG || !ctx) return;
    if (nextT < ctx.currentTime) nextT = ctx.currentTime + .1;   // 창이 가려져 밀렸으면 지금부터 다시
    if (!lv.bgm) { nextT = ctx.currentTime + .1; return; }
    while (nextT < ctx.currentTime + 1.4) nextT += bar(ctx, songG, SONGS[song], barI++, nextT);
  }
  // 곡을 바꾼다. 앞 곡은 서서히 줄이고 새 곡은 서서히 키운다. 이름이 없으면 음악을 멈춘다.
  function music(name) {
    want = name || null; if (!ctx || ctx.state !== 'running' || song === want) return;
    if (songG) { const g = songG, n = ctx.currentTime; g.gain.cancelScheduledValues(n); g.gain.setValueAtTime(g.gain.value, n); g.gain.linearRampToValueAtTime(0, n + .5); setTimeout(() => g.disconnect(), 2500); }
    song = want; songG = null; clearInterval(timer); if (!song || !SONGS[song]) return;
    songG = ctx.createGain(); songG.gain.setValueAtTime(0, ctx.currentTime); songG.gain.linearRampToValueAtTime(1, ctx.currentTime + .7); songG.connect(bgmG);
    nextT = ctx.currentTime + .15; barI = 0; pump(); timer = setInterval(pump, 200);
  }
  function set(kind, level) { lv[kind] = Math.max(0, Math.min(3, level | 0)); apply(); }
  function init(sfx, bgm) { if (sfx != null) lv.sfx = sfx; if (bgm != null) lv.bgm = bgm; apply(); }

  // 처음 누를 때 소리를 켜고, 단추를 누를 때마다 톡 소리를 낸다
  addEventListener('pointerdown', unlock, true); addEventListener('keydown', unlock, true);
  addEventListener('click', e => { unlock(); if (e.target.closest && e.target.closest('button')) play('tap'); }, true);

  // 확인용: 소리를 들리지 않게 따로 만들어 길이와 크기를 잰다(가장 큰 값 peak, 평균 rms, 소리가 끝나는 때 sec)
  function stats(buf) { const d = buf.getChannelData(0); let pk = 0, sq = 0, last = 0; for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > pk) pk = a; sq += a * a; if (a > .002) last = i; } return { peak: +pk.toFixed(3), rms: +Math.sqrt(sq / d.length).toFixed(4), sec: +(last / buf.sampleRate).toFixed(2) }; }
  function test() {
    const OC = window.OfflineAudioContext || window.webkitOfflineAudioContext, out = {}, jobs = [];
    Object.keys(SFX).forEach(k => { const c = new OC(1, 44100 * 4, 44100); SFX[k](c, c.destination, .01); jobs.push(c.startRendering().then(b => { out[k] = stats(b); })); });
    Object.keys(SONGS).forEach(k => { const S = SONGS[k], c = new OC(1, Math.ceil(44100 * (240 / S.bpm) * S.bars.length + 22050), 44100); let t = 0; S.bars.forEach((b, i) => { t += bar(c, c.destination, S, i, t); }); jobs.push(c.startRendering().then(b => { out['song:' + k] = stats(b); })); });
    return Promise.all(jobs).then(() => out);
  }
  return { play: play, music: music, set: set, init: init, unlock: unlock, test: test, state: () => ({ ctx: ctx ? ctx.state : 'none', song: song, want: want, lv: lv, bar: barI }) };
})();
