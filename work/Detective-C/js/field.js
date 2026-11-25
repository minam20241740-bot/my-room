'use strict';
/* 사건 하나의 흐름: 편성 → 현장 조사 → 진정 훈련(안정화) → 결과 → 추리 또는 마무리 → 사건 해결
   현장은 3D(stage3d.js)이고, 이 파일은 그 위의 화면과 규칙을 맡는다.
   사건마다 다른 것(현장, 필요한 친구, 상대, 마무리 방식)은 js/data.js의 사건 자료에서 읽는다. */
window.Field = (function () {
  const S = window.Stage3D, GB = window.GB, G = GB.G, el = GB.el, $ = id => document.getElementById(id);
  const fieldEl = $('field'), hud = $('hud'), teamEl = $('team'), PI = Math.PI, snd = GB.snd, music = GB.music;
  const SIZE = {}; Object.keys(G.models).forEach(k => { SIZE[k] = G.models[k].height; });   // 인물 키(m). 0은 모델 그대로
  let C = null, sc = null, mode = '', paused = false, speed = 1, auto = false, busy = false, skipTut = false;
  let freeze = 0;   // 큰 타격에서 잠깐 멈추는 남은 시간(초)
  let lead = null, mate = null, huru = null, pals = [], lightPal = null, foe = null, notes = [], marks = [], B = null, fin = null, waterPal = null, tl = null, pops = [];
  const isAct = () => !!(C && C.duel && C.duel.mode === 'action');   // C안: 직접 움직이는 액션 훈련인가
  const mateKey = () => GB.save.lead === 'arthur' ? 'eri' : 'arthur';
  const pad = n => String(n).padStart(2, '0'), clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const iga = s => ((s.charCodeAt(s.length - 1) - 0xAC00) % 28 ? '이' : '가');   // 받침에 따라 '이' 또는 '가'
  const CAMX = -1.8, CAMZ = 3.2;
  // 인물마다 다른 공격 모양과 색(훈련탄이 모두 같은 파란 공으로 보이지 않게)
  const STYLE = { arthur: { shape: 'beam', color: '#dfff1a', size: .13 }, eri: { shape: 'card', color: '#fff1cf', size: .14 }, malangbul: { shape: 'spark', color: '#ffae42', size: .12 }, bangului: { shape: 'drop', color: '#7fd0ff', size: .12 }, mongeul: { shape: 'spark', color: '#e6ff7a', size: .12 } };   // 훈련 카메라가 바라보는 곳을 팀과 상대의 가운데에서 얼마나 옮기는가(CAMZ는 화면 아래의 팀 표시와 카드를 피해 인물을 위로 올린다)
  const SLOTS = 3;   // 편성에 데려갈 수 있는 친구 수(탐정 둘과 합쳐 다섯 칸)
  // 해결한 사건에서 온 친구, 그 가운데 편성에 넣은 친구
  const friendsHave = () => (GB.save.friends || []).filter(k => G.friends[k]);
  const party = () => { const have = friendsHave(); return (GB.save.party || []).filter((k, i, a) => have.indexOf(k) >= 0 && a.indexOf(k) === i).slice(0, SLOTS); };
  const lacks = c => [].concat((c && c.need) || []).some(k => party().indexOf(k) < 0);   // 이 사건에 필요한 친구가 빠져 있는가
  function btn(parent, label, fn, yellow) { const b = el('button', 'bt' + (yellow ? ' y' : ''), parent, '<span>' + label + '</span>'); b.onclick = fn; return b; }
  const FACES = ['arthur', 'eri', 'huru', 'malangbul', 'bangului', 'mongeul'];   // 얼굴만 따로 자른 그림이 있는 인물
  function face(k) {
    if (!k) return '<i class="fc none"></i>';
    const F = G.friends[k]; if (F && FACES.indexOf(k) < 0) return F.img ? '<i class="fc" style="background-image:url(' + F.img + ');background-size:cover;background-position:center 20%"></i>' : '<i class="fc" style="display:inline-flex;align-items:center;justify-content:center;background:#2b3a7a;color:#dfff1a;font:900 34px/1 sans-serif">' + F.name.charAt(0) + '</i>';
    return '<i class="fc" style="background-image:url(img/face_' + k + '.png)"></i>';
  }   // 얼굴만 따로 자른 그림(img/face_이름.png)
  const nameOf = k => k === 'huru' ? G.names.huru : (G.friends[k] || G.leads[k]).name;

  // ── 편성(C안): 왼쪽에 앞장선 탐정과 뒤의 동료를 크게 겹쳐 세우고, 오른쪽에 친구 세 자리를 세로 줄로 둔다 ──
  function openTeam(c) {
    GB.show('team'); mode = 'team'; teamEl.innerHTML = '';
    const sv = GB.save, pt = party(), have = friendsHave(), waiting = have.filter(k => pt.indexOf(k) < 0), L = G.leads[sv.lead], M = G.leads[mateKey()];
    el('div', 'thead', teamEl, '<h1>편성</h1>' + (c ? '<div class="tag"><span>의뢰 ' + pad(c.no) + ' · ' + c.title + '</span></div>' : ''));
    if (c) el('div', 'need', teamEl, '이번 현장 <b>' + c.task + '</b> · 진정 훈련 <b>' + c.duel.title + '</b>');
    const lead = el('button', 'tm-lead', teamEl, '<div class="pb" style="background-image:url(' + M.img + ')"></div><div class="pa" style="background-image:url(' + L.img + ')"></div><div class="nl"><small>앞장 · 직접 조작</small><b>' + L.name + '</b></div><div class="np"><small>함께 · 교대</small><b>' + M.name + '</b></div><em>눌러서 앞장 바꾸기</em>');
    lead.onclick = () => { sv.lead = mateKey(); GB.store(); openTeam(c); };
    const rows = el('div', 'tm-rows', teamEl);
    for (let i = 0; i < SLOTS; i++) {
      const k = pt[i], F = G.friends[k];
      if (k) el('button', 'trow', rows, '<span class="no">' + (i + 1) + '</span><i class="pic" style="background-image:url(' + F.img + ')"></i><div><b>' + F.name + '</b><small>' + F.tag + ' 속성</small></div><span class="ds">' + F.desc + '</span>')
        .onclick = () => { sv.party = pt.filter(x => x !== k); GB.store(); openTeam(c); };
      else el('div', 'trow empty', rows, '<span class="no">' + (i + 1) + '</span><div><b>빈 자리</b><small>' + (waiting.length ? '아래 대기실에서 골라 넣습니다' : '도시에서 친구를 만나면 늘어납니다') + '</small></div>');
    }
    const w = el('div', 'wait', teamEl, '<b>대기실</b>');
    if (!have.length) el('span', '', w, '함께 갈 친구가 아직 없습니다'); else if (!waiting.length) el('span', '', w, '친구가 모두 편성에 들어가 있습니다');
    waiting.forEach(k => {
      const F = G.friends[k];
      el('button', 'wf', w, face(k) + '<strong>' + F.name + '</strong><u>' + F.tag + '</u><span>' + F.desc + '</span>').onclick = () => { if (pt.length >= SLOTS) { GB.toast('빈 자리가 없습니다. 친구 줄을 눌러 자리를 비웁니다'); return; } sv.party = pt.concat(k); GB.store(); openTeam(c); };
    });
    const lack = lacks(c);
    el('em', lack ? 'hint' : '', w, lack ? '후루 · ' + c.needHint : (pt.length ? '친구 줄을 누르면 대기실로 돌아갑니다' : '왼쪽 그림을 누르면 앞장서는 탐정이 바뀝니다'));
    const f = el('div', 'tfoot', teamEl);
    btn(f, '돌아가기', GB.enterLobby).focus();
    if (c) firstGuide('team', teamEl);
  }

  // ── 현장 공통 ──
  function spawn() {
    S.clear(); sc = S.setScene(C.scene); S.camMode(mode === 'battle' ? (isAct() ? 'chase' : 'battle') : 'field'); const k = GB.save.lead, m = mateKey();
    music(mode === 'battle' ? 'battle' : C.scene);   // 현장마다 다른 곡, 훈련은 훈련 곡
    lead = S.makeActor(k, SIZE[k]); mate = S.makeActor(m, SIZE[m]); huru = S.makeActor('huru', SIZE.huru);
    huru.float = 1.2; huru.speed = 5.5; mate.speed = 3.9; foe = null;
    pals = party().map(p => { const a = window.Evolve ? window.Evolve.pal(p, (k, h) => S.makeActor(k, h), SIZE[p]) : S.makeActor(p, SIZE[p]); a.speed = 4.6; return a; });
    { const gy = C && C._w && C._w.gy || 0; if (gy) [lead, mate, huru].concat(pals).forEach(a => { a.gy = gy; }); }   // 옥상 같은 높은 곳에서 마주친 훈련
    lightPal = pals.find(a => G.friends[a.key].light) || null; waterPal = pals.find(a => G.friends[a.key].water) || null; tl = null;
    if (sc.paint) S.paint(notes.length ? 1 : 0);
    if (sc.devices) notes.forEach(n => S.fix(n.id, true));   // 고친 장치는 계속 돈다   // 벽 그림은 한 번 드러나면 계속 보인다
    if (sc.dark && lightPal) S.lampOn(lightPal);   // 어두운 현장에서는 빛을 내는 친구가 불을 밝힌다
  }
  // 처음 한 번만 나오는 안내(후루가 누를 곳을 하나씩 밝혀 알려 준다). 글은 js/data.js의 guide
  function firstGuide(key, box, done) {
    const sv = GB.save; if (skipTut || sv.seen['g_' + key] || !G.guide[key]) { if (done) done(); return; }
    sv.seen['g_' + key] = 1; GB.store(); paused = true; GB.guide(box, G.guide[key], () => { paused = false; if (done) done(); });
  }
  // 인물 위에 잠깐 떴다 사라지는 숫자. 현장의 시간에 맞춰 사라진다.
  function pop(x, y, z, text, cls) {
    const p = S.project(x, y, z), e = el('div', 'dmg' + (cls ? ' ' + cls : ''), hud, text);
    e.style.left = (p.x + Math.random() * 70 - 35) + 'px'; e.style.top = (p.y + Math.random() * 30 - 15) + 'px'; pops.push({ e: e, t: .7 });
  }
  const dist = (a, x, z) => Math.hypot(a.x - x, a.z - z);
  function follow(a, x, z) {
    if (sc.bounds) { x = clamp(x, sc.bounds[0] - 1.4, sc.bounds[1] + 1.2); z = clamp(z, sc.bounds[2], sc.bounds[3] + 1); }
    if (dist(a, x, z) > .45) { if (!a.target) a.play('walk'); a.target = { x: x, z: z }; }
  }
  function tick(dt) {
    if (paused) return 0;
    for (let i = pops.length - 1; i >= 0; i--) { pops[i].t -= dt; if (pops[i].t <= 0) { pops[i].e.remove(); pops.splice(i, 1); } }
    if (window.FX) FX.update(dt);   // 2D 효과는 멈춤 중에도 흘러간다(충격 프레임은 멈춘 사이에 보인다)
    if (freeze > 0) { freeze -= dt; return 0; }   // 큰 타격에서 장면이 잠깐 멈춘다
    if (mode === 'battle') { const k = B && B.slow > 0 ? .25 : 1; if (k < 1) B.slow -= dt; actionTick(dt * speed * k); return speed * k; }   // 기술을 쓰는 순간에는 잠깐 느려진다
    return 1;
  }
  function leave() { clearKeys(); FX.clear(); fieldEl.classList.remove('sm', 'gold', 'calm', 'cine'); S.stop(); S.clear(); hud.innerHTML = ''; marks = []; pops = []; B = null; fin = null; paused = false; mode = ''; }
  function pause() {
    clearKeys();
    if (mode !== 'battle' || (B && B.over)) return;
    paused = true; const resume = () => { paused = false; };
    GB.openPop({ title: '멈춤', w: 1080, body: '<p>' + (C.world ? '불안한 친구를 진정시키는 중입니다.' : C.title) + '</p><p>도시로 돌아가면 이 훈련은 처음부터 다시 합니다.</p>', buttons: [['도시로', GB.enterLobby], ['다시 시작', startBattle], ['계속', resume, 1]], esc: resume });
  }
  function noteRows(list) { return list.map(n => '<p class="nrow"><b>' + n.label + '</b>' + n.note + '</p>').join(''); }
  function openNote(here) {
    let html;
    const wn = (GB.save.world && GB.save.world.notes) || [];
    if (here) html = notes.length ? noteRows(notes) : '<p>아직 적힌 것이 없습니다.</p>';
    else { const qs = G.quests.filter(q => wn.some(n => n.q === q.id)); html = qs.length ? qs.map(q => '<h4>' + q.title + '</h4>' + noteRows(wn.filter(n => n.q === q.id))).join('') : '<p>아직 적힌 것이 없습니다. 도시를 걸으며 단서를 찾아 보세요.</p>'; }
    const back = () => { if (here) paused = false; }; if (here) paused = true;
    GB.openPop({ title: '수첩', w: 1060, body: html, buttons: [['닫기', back, 1]], esc: back });
  }

  // ── 현장 조사 ──
  // 바닥을 누르면 그 자리로 걸어간다(걸어 다니며 찾는 현장에서만)
  hud.addEventListener('click', e => {
    if (e.target !== hud || mode !== 'probe' || !sc || !sc.bounds || busy || paused) return;
    const p = S.pick(e.clientX, e.clientY); if (!p) return;
    const b = sc.bounds, x = clamp(p.x, b[0], b[1]), z = clamp(p.z, b[2], b[3]);
    lead.goto(x, z, 4.2); S.burst(x, .1, z, '#dfff1a', 4, .05); snd('walk');
  });
  // 물 친구가 벽 앞으로 가서 물을 뿌린다 → 마른 그림이 드러난다
  // 친구가 장치 앞으로 가서 제 능력을 쓴다 → 장치가 고쳐져 돌기 시작한다

  // ── 진정 훈련 ──
  function startBattle() { startAct(); }   // 훈련은 모두 직접 움직이는 액션 훈련이다
  // 기술을 쓰는 순간: 그림과 기술 이름이 화면을 가로지르고, 쓴 인물이 뛰어오른다
  function lose() { B.over = true; paused = true; snd('lose'); GB.openPop({ title: '진정 훈련', w: 900, body: '<p>' + G.added.lose + '</p>', buttons: [[C && C.world ? '도시로' : '사무소로', GB.enterLobby], ['다시', startBattle, 1]], esc: startBattle }); }

  // ── 액션 훈련(C안): 직접 움직여 붉은 범위를 피하고, 빈틈에 협력 타격 ──
  // 사건 자료의 duel.mode가 'action'이면 startBattle이 이쪽으로 넘어온다. 안내와 시계는 B안과 같은 틀(GB.guide, tick)을 쓴다.
  const mv = { u: 0, d: 0, l: 0, r: 0 }, KEYMAP = { KeyW: 'u', ArrowUp: 'u', KeyS: 'd', ArrowDown: 'd', KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r' };
  const pc = () => B.ch[B.cur], bc = () => B.ch[1 - B.cur];   // 지금 조작하는 탐정, 뒤에서 기다리는 탐정
  function clearKeys() { mv.u = mv.d = mv.l = mv.r = 0; }
  function sd(s, x, z) {   // 범위 가장자리까지의 거리. 0보다 작으면 범위 안
    if (s.t === 'c') return Math.hypot(x - s.x, z - s.z) - s.r;
    if (s.t === 'l') { const dx = x - s.x, dz = z - s.z, f = dx * s.dx + dz * s.dz, p = Math.abs(dx * s.dz - dz * s.dx); return Math.max(p - s.w / 2, -f, f - s.len); }
    const dd = Math.hypot(x - s.x, z - s.z); return Math.max(s.r0 - dd, dd - s.r1);
  }
  function startAct() {
    if (GB.cur !== 'field') GB.show('field');
    if (window.World3D && window.World3D.traffic) window.World3D.traffic(false);   // 도시의 차는 훈련 중 멈춰 서 있지 않게 감춘다
    mode = 'battle'; paused = false; busy = false; speed = 1; auto = false; marks.forEach(m => m.ring.remove()); marks = []; clearKeys();
    spawn(); const D = C.duel, bt = (C._w && C._w.arenaSpec) || sc.battle, ar = bt.arena || [bt.cx - 7, bt.cx + 7, bt.cz - 4, bt.cz + 4], px = ar[0] + 2.2, pz = (ar[2] + ar[3]) / 2;
    foe = S.makeActor(D.monster, SIZE[D.monster] * (D.act.scale || 1.5)); foe.speed = D.act.speed; foe.hopH = .5; foe.gy = C._w && C._w.gy || 0;
    S.camBox(bt.cam || null); S.zoom(1, true);
    lead.place(px, pz, PI / 2); mate.place(px - 1.6, pz + 1.3, PI / 2); huru.place(px - 2.4, pz - .9, PI / 2);
    pals.forEach((a, i) => a.place(px - 2.6 - i, pz + [1.9, -2, .2][i], PI / 2));
    foe.place(Math.min(ar[1] - 1, px + 6), pz, -PI / 2);
    const sv = GB.save, tut = !skipTut && !sv.seen.tutC;
    B = { act: 1, ar: ar, stab: 0, gauge: 0, t: 0, over: false, slow: 0, hy: PI / 2, cur: 0, ch: [{ a: lead, key: sv.lead, hp: 100 }, { a: mate, key: mateKey(), hp: 100 }],
      seq: [], counter: 0, gold: 0, lastStrike: -9, dashCd: 0, dashT: 0, dx: 1, dz: 0, inv: 0, dInv: 0, swapCd: 0, stCd: 0, swapBuf: 0, useT: 0, auto: false, st: 'near', stT: 0, atk: null, rush: null, gapT: 0, gapMax: 0, gapFx: 0, nAtk: 0, moved: 0,
      tut: tut ? { s: 'move', tries: 0 } : null, perf: 0, strikes: 0, hits: 0, chainSeen: !!sv.seen.tutC2 || skipTut };
    S.heading(B.hy); S.look(lead.x, lead.z, true); S.start(tick); FX.clear(); FX.low = sv.fx === 1;
    actHud();
    if (!skipTut && !sv.seen.g_action) {
      sv.seen.g_action = 1; GB.store(); paused = true; const nm = C.duel.name + iga(C.duel.name);
      GB.guide(hud, G.guide.action.map(x => [x[0], x[1].replace('%s', nm), x[2]]), () => { paused = false; if (B && B.tut) tutSet('move'); });
    } else if (B.tut) tutSet('move');
  }
  function actHud() {
    hud.innerHTML = '';
    el('div', 'bgauge', hud, '<small>' + (C.world ? '불안한 친구' : '진정 훈련') + ' · ' + C.duel.title + '</small><b>' + C.duel.name + '</b><div class="gbar"><i></i></div><em></em>');
    const ctl = el('div', 'top', hud);
    const bA = el('button', '', ctl, '<span>자동 타격</span>'); bA.onclick = () => { B.auto = !B.auto; bA.classList.toggle('on', B.auto); };
    el('button', '', ctl, '<span>멈춤</span>').onclick = pause;
    const tm = el('div', 'bteam', hud);
    B.ch.forEach((m, i) => { m.el = el('div', 'mem', tm, face(m.key) + '<div><b>' + nameOf(m.key) + '</b><div class="hbar"><i></i></div></div><u></u>'); m.el.onclick = () => { if (B.cur !== i) swap(); }; });
    const ak = el('div', 'akeys', hud, '<div class="agap"><span>빈틈 게이지</span><div class="gbar"><i></i></div></div>'), row = el('div', 'arow', ak); B.btn = {};
    [['strike', '타격', 'Space', strike], ['dash', '피하기', 'Shift', dash], ['swap', '교대', 'E', swap], ['chain', '결정적 추리', 'Q', chain]].forEach(k => {
      const b = el('button', 'abtn ak-' + k[0], row, '<b>' + k[1] + '</b><kbd>' + k[2] + '</kbd><i></i>'); b.onclick = () => k[3](); b.addEventListener('mousedown', e => e.preventDefault()); B.btn[k[0]] = b;
    });
    B.pr = el('div', 'aprompt', hud, '빈틈! 타격'); B.tag = el('div', 'afoe', hud, '<small>빈틈</small><div class="gbar"><i></i></div>'); B.stp = el('div', 'cstep', hud); B.fl = el('div', 'aflash', hud);
    B.ui = { box: hud.querySelector('.bgauge'), bar: hud.querySelector('.gbar i'), pct: hud.querySelector('.bgauge em'), gap: hud.querySelector('.agap .gbar i') };
    drawAct();
  }
  function drawAct() {
    const u = B.ui; u.bar.style.width = B.stab + '%'; u.pct.textContent = '안정도 ' + Math.floor(B.stab) + '%'; u.gap.style.width = B.gauge + '%';
    B.ch.forEach((m, i) => { m.el.querySelector('.hbar i').style.width = m.hp + '%'; m.el.classList.toggle('act', i === B.cur); m.el.classList.toggle('out', m.hp <= 0); m.el.querySelector('u').textContent = m.hp <= 0 ? '쉬는 중' : i === B.cur ? '조작 중' : '대기'; });
    const b = B.btn, gap = B.st === 'gap' && B.gapT > 0 && B.t >= (B.motionUntil || 0);
    b.chain.classList.toggle('rdy', B.gauge >= 100); b.strike.classList.toggle('rdy', gap); b.strike.style.setProperty('--f', B.stCd > 0 ? Math.min(1, B.stCd / .45) : 0);
    b.dash.style.setProperty('--f', Math.min(1, B.dashCd / .85)); b.swap.style.setProperty('--f', Math.min(1, B.swapCd / 1.2));
    B.pr.style.display = gap && !B.auto && !paused ? '' : 'none'; B.pr.textContent = B.counter > 0 ? '반격! 타격' : '빈틈! 타격';
    B.tag.style.display = gap ? 'block' : 'none'; if (gap) { const p = S.project(foe.x, 2.4, foe.z); B.tag.style.left = p.x + 'px'; B.tag.style.top = p.y + 'px'; B.tag.querySelector('i').style.width = (B.gapT / B.gapMax * 100) + '%'; }
  }
  function tutSet(k) { if (!B || !B.stp) return; if (k) { B.stp.textContent = G.guide.actStep[k]; B.stp.style.display = 'block'; } else B.stp.style.display = 'none'; }
  function tutGuide(sel, text, at, done) { paused = true; clearKeys(); GB.guide(hud, [[sel, text, at || 'right:60px;bottom:330px']], () => { paused = false; if (done) done(); }); }
  function actKey(e, down) {
    const c = e.code, m = KEYMAP[c]; if (m) { mv[m] = down ? 1 : 0; return true; }
    if (!down) return c === 'Space' || c === 'ShiftLeft' || c === 'ShiftRight' || c === 'KeyE' || c === 'KeyQ' || c === 'KeyJ' || c === 'KeyK';
    if (c === 'Space' || c === 'KeyJ') strike(); else if (!e.repeat && (c === 'ShiftLeft' || c === 'ShiftRight' || c === 'KeyK')) dash(); else if (!e.repeat && c === 'KeyE') swap(); else if (!e.repeat && c === 'KeyQ') chain(); else return false;
    return true;
  }
  const can = () => B && B.act && !B.over && !paused && B.t >= (B.motionUntil || 0);
  // ── 타격감 도구: 같이 멈춤, 화각 튐, 흔들림, 지연 실행(게임 시간) ──
  // 멈춤은 프레임(60분의 1초) 단위: 가벼움 2~4, 무거움 6~10. 효과 줄이기에서는 반으로 줄이고 화각·흔들림은 약하게 한다.
  const hitstop = fr => { freeze = Math.max(freeze, (FX.low ? Math.ceil(fr / 2) : fr) / 60); };
  const kick = v => { if (!FX.low) S.fovKick(v); };
  const rock = v => S.shake(FX.low ? v * .4 : v);
  const later = (sec, fn) => { B.seq.push({ t: sec, fn: fn }); };
  // 몬스터 친구의 기술: 속성마다 다른 그림과 몸짓(빛은 크게 떠올라 빛살, 물은 두 번 출렁이며 물결, 전기는 잔 떨림과 번개)
  function friendFx(p, F, i) {
    const Fr = G.friends[p.key] || {}, q = scr(F, 1.0 + i * .1), alt = (B.strikes + i) % 2;
    if (Fr.light) { p.hopH = alt ? .5 : 1; p.hop = 1; if (alt) { FX.pillar(q.x, q.y + 30); snd('boom'); } else { FX.rays(q.x, q.y - 20); snd('light'); } }
    else if (Fr.water) { p.hopH = .35; p.hop = 1; setTimeout(() => { p.hop = 1; }, 160); if (alt) { FX.spiral(q.x, q.y + 20); S.punch(p); } else FX.wave(q.x, q.y); snd('water'); }
    else { p.hopH = .2; p.hop = 1; S.punch(p); setTimeout(() => S.punch(p), 90); if (alt) FX.chainzap(q.x, q.y); else FX.zig(q.x + (i - 1) * 40, q.y); snd('zap'); }
    S.burst(F.x, .7, F.z, STYLE[p.key] ? STYLE[p.key].color : '#fff', 4, .06);
  }
  const FOEFX = { bori: 'crack', banjjak: 'crystal', garam: 'fountain', mongeul2: 'storm' };   // 상대 몬스터마다 다른 공격 그림
  const FOESHOT = { bori: 'card', banjjak: 'spark', garam: 'drop', mongeul2: 'beam' };        // 떨어지는 조각의 모양
  const scr = (a, y) => S.project(a.x, y == null ? 1 : y, a.z);   // 화면 좌표(1920×1080)
  function dash() {
    if (!can() || B.dashCd > 0) return; const f = { x: Math.sin(B.hy), z: Math.cos(B.hy) }, r = { x: -f.z, z: f.x }, ix = mv.r - mv.l, iz = mv.u - mv.d;
    let dx = f.x * iz + r.x * ix, dz = f.z * iz + r.z * ix; const n = Math.hypot(dx, dz); if (n > 0) { dx /= n; dz /= n; } else { dx = -f.x; dz = -f.z; }
    B.dx = dx; B.dz = dz; B.dashT = .2; B.dashCd = .85; B.dInv = .35; const a = pc().a;   // 피하기를 누른 뒤 0.35초 동안 닿지 않는다. 이 사이에 공격이 터지면 아슬한 회피
    a.ry = a.wantRy = Math.atan2(dx, dz);
    a.act('dodge', .34, .055);
    snd('dash'); S.burst(a.x, .5, a.z, '#bfe6ff', 8, .07);
    if (B.tut && B.tut.s === 'dash') { B.tut.s = 'free'; tutSet('done'); setTimeout(() => { if (B && B.tut) tutSet(null); }, 6500); GB.save.seen.tutC = 1; GB.store(); }
  }
  function swap() {
    if (!can() || B.swapCd > 0 || bc().hp <= 0) return;
    const inGap = B.st === 'gap' && B.gapT > 0; doSwap(); if (inGap) swapStrike();
    if (B.tut && B.tut.s === 'swap') { B.tut.s = 'dash'; tutSet('dash'); }
  }
  function doSwap() {   // 새로 조작할 탐정이 그 자리로 뛰어들고, 앞에 있던 탐정은 뒤로 빠진다
    const o = pc().a, nw = bc().a, f = { x: Math.sin(B.hy), z: Math.cos(B.hy) }; nw.x = o.x; nw.z = o.z; nw.target = null; nw.wantRy = nw.ry = o.ry; o.target = null; o.x = clamp(o.x - f.x * 1.9, B.ar[0], B.ar[1]); o.z = clamp(o.z - f.z * 1.9, B.ar[2], B.ar[3]);
    B.cur = 1 - B.cur; B.dashT = 0; B.swapCd = 1.2; B.swapBuf = 3.2; B.inv = Math.max(B.inv, .5); snd('swap');
    S.burst(o.x, 1, o.z, '#9fb4ff', 12, .08); nw.hopH = .5; nw.hop = 1; pop(nw.x, 2.7, nw.z, nameOf(pc().key), '');
  }
  // 빈틈에서 들어온 탐정의 도구가 닿는 때에 교대 타격이 적용된다.
  function swapStrike() {
    const m = pc(), a = m.a, F = foe, D = C.duel, link = B.t - B.lastStrike < 1.6, st = STYLE[m.key] || {};
    const gain = D.act.strike * (link ? 2.8 : 2) / (D.tough || 1) * (B.counter > 0 ? 1.5 : 1);
    const duration = .56;
    B.stCd = duration; B.motionUntil = B.t + duration; B.lastStrike = B.t; B.strikes++; B.useT = duration;
    const fx = Math.sin(B.hy), fz = Math.cos(B.hy); a.x = clamp(F.x - fx * 1.5 + fz * 1.2, B.ar[0], B.ar[1]); a.z = clamp(F.z - fz * 1.5 - fx * 1.2, B.ar[2], B.ar[3]);
    a.hop = 0; a.ry = a.wantRy = Math.atan2(F.x - a.x, F.z - a.z);
    if (!a.act('swap_strike', duration, .05)) a.play('use');
    later(.20, () => {
      const p = scr(F, 1.1);
      FX.slash(p.x, p.y, m.key, st.color, -.55, .68); FX.shards(p.x, p.y, st.color, link ? 22 : 14);
      FX.spr('flare_01', p.x, p.y, { size: 310, color: '#eaffa0', life: .25 });
      FX.text(link ? '교대 연계' : '교대 타격', 250, 210, '#dfff1a', 48, .8);
      hitstop(link ? 8 : 6); kick(6); rock(.5); snd(link ? 'link' : 'boom'); actHit(gain, st.color, true);
    });
  }
  function strike() {
    if (!can() || B.stCd > 0 || B.st !== 'gap') return;
    const m = pc(), a = m.a, F = foe, D = C.duel, st = STYLE[m.key] || {};
    B.stCd = .45; B.strikes++; B.lastStrike = B.t; S.burst(a.x, .5, a.z, '#dfff1a', 5, .06);
    const fx = Math.sin(B.hy), fz = Math.cos(B.hy), side = B.strikes % 2 ? 1.2 : -1.2;   // 상대의 앞쪽 옆으로 붙는다(화면에서 상대가 가려지지 않게 좌우를 번갈아)
    a.x = clamp(F.x - fx * 1.5 - fz * side, B.ar[0], B.ar[1]); a.z = clamp(F.z - fz * 1.5 + fx * side, B.ar[2], B.ar[3]);
    a.face(F.x, F.z); a.play('use'); B.useT = .3; a.hopH = .4; a.hop = 1;
    const counter = B.counter > 0, heavy = counter || B.swapBuf > 0 || B.strikes % 3 === 0, gain = D.act.strike / (D.tough || 1) * (B.swapBuf > 0 ? 1.5 : 1) * (counter ? 2 : 1);
    const ang = [-.6, .5, -1.1, .15][B.strikes % 4]; snd('shot');
    later(.07, () => {   // 칼자국은 인물마다 모양이 다르다(아서 굵은 초승달, 에리 가는 선 셋, 친구는 뾰족한 조각)
      const p = scr(F, 1.0); FX.slash(p.x, p.y, m.key, st.color, ang); hitstop(heavy ? 7 : 3); kick(heavy ? 5 : 2.5); if (heavy) { rock(.4); snd('boom'); }
      actHit(gain, st.color, heavy);
    });
    later(.12, () => { const q = bc().a, p = scr(F, .8); FX.shards(p.x + 50, p.y, (STYLE[bc().key] || {}).color || '#fff', 9); });   // 함께 나온 탐정도 한 번 거든다
    if (B.strikes % 2 === 0) pals.forEach((pl, i) => later(.2 + i * .1, () => friendFx(pl, F, i)));   // 친구는 두 번에 한 번, 속성 기술로 이어서 친다
    if (B.tut && B.tut.s === 'strike') { B.tut.s = 'swap'; tutSet('swap'); }
  }
  // 연계: 2.4초 안에 이어서 맞히면 숫자가 올라가고 오른쪽에 크게 뜬다. 맞으면 끊긴다
  function bumpCombo() {
    B.combo = (B.t - (B.comboT || -9) < 2.4 ? (B.combo || 0) : 0) + 1; B.comboT = B.t;
    if (B.combo < 2) return;
    let c = hud.querySelector('.combo'); if (!c) c = el('div', 'combo', hud, '<b></b><small>연계</small>');
    c.querySelector('b').textContent = B.combo; c.classList.remove('pulse'); void c.offsetWidth; c.classList.add('pulse');
    if (B.combo >= 3) { snd('link'); if (B.combo % 3 === 0) FX.text(B.combo + ' 연계!', 1480, 330, '#dfff1a', 84, .7); }
  }
  function endCombo() { B.combo = 0; const c = hud.querySelector('.combo'); if (c) c.remove(); }
  function actHit(gain, col, heavy) {
    if (!B || B.over) return; bumpCombo(); B.stab = Math.min(100, B.stab + gain); B.gauge = Math.min(100, B.gauge + 3);
    S.burst(foe.x, .7, foe.z, col || '#bfe6ff', heavy ? 24 : 11, heavy ? .13 : .095); S.punch(foe, 1); pop(foe.x, 1.7, foe.z, '+' + Math.max(1, Math.round(gain)), gain >= 9 ? 'big' : '');
    B.ui.box.classList.remove('hitp'); void B.ui.box.offsetWidth; B.ui.box.classList.add('hitp');
    if (B.stab >= 100) actWin();
  }
  // 두 탐정이 차례로 단서를 찾아 붉은 실을 잇고 마지막에 사건 기록에 도장을 찍는다.
  function chain() {
    if (!can() || B.gauge < 100) return;
    B.gauge = 0; const m = pc(), a = m.a, o = bc(), F = foe, D = C.duel, A = D.act, tot = 22 / (D.tough || 1), f = { x: Math.sin(B.hy), z: Math.cos(B.hy) }, r = { x: -f.z, z: f.x };
    if (B.atk) { B.atk.h.forEach(h => h.remove()); B.atk = null; }
    B.st = 'gap'; B.gapMax = B.gapT = Math.max(B.gapT, A.gap * 1.6); F.play('idle'); F.target = null; B.rush = null; B.stCd = .6; B.lastStrike = B.t;
    a.x = clamp(F.x - f.x * 1.6 + r.x * 1.3, B.ar[0], B.ar[1]); a.z = clamp(F.z - f.z * 1.6 + r.z * 1.3, B.ar[2], B.ar[3]); o.a.target = null; o.a.x = clamp(F.x - f.x * 1.6 - r.x * 1.3, B.ar[0], B.ar[1]); o.a.z = clamp(F.z - f.z * 1.6 - r.z * 1.3, B.ar[2], B.ar[3]);
    const duration = 1.40;
    B.dashT = 0; B.motionUntil = B.jointUntil = B.t + duration; B.useT = duration; B.gapMax = B.gapT = Math.max(B.gapT, duration + .05);
    [a, o.a].forEach(actor => {
      actor.target = null; actor.hop = 0;
      actor.ry = actor.wantRy = Math.atan2(F.x - actor.x, F.z - actor.z);
    });
    if (!a.act('joint_first', duration, .06)) a.play('use');
    if (!o.a.act('joint_second', duration, .06)) o.a.play('use');
    const label = el('div', 'joint-case', hud, '<b>결정적 추리</b><small></small>');
    label.querySelector('small').textContent = nameOf(m.key) + ' · ' + nameOf(o.key);
    pops.push({ e: label, t: 1.85 });
    snd('chain'); B.slow = 0; FX.edge('#dfff1a'); if (!FX.low) fieldEl.classList.add('cine'); later(1.6, () => fieldEl.classList.remove('cine')); { const q0 = scr(F, 1.0); FX.rays(q0.x, q0.y); } if (!FX.low) B.gold = .6;   // 시작할 때 가장자리가 연두로 번쩍이고 화면 색이 잠깐 진해진다
    const p = () => scr(F, 1.0), sa = STYLE[m.key] || {}, sb = STYLE[o.key] || {};
    later(.35, () => { const q = p(); FX.slash(q.x, q.y, m.key, sa.color, -.7, .65); hitstop(5); kick(4); actHit(tot * .2, sa.color, true); });
    later(.55, () => { const q = p(); FX.slash(q.x, q.y, o.key, sb.color, .6, .65); hitstop(5); kick(4); actHit(tot * .2, sb.color, true); });
    pals.forEach((pl, i) => later(.7 + i * .12, () => friendFx(pl, F, i)));
    later(.85, () => { const q = p(); FX.string(q.x, q.y, .7);
      if (!FX.low) FX.spr('spark_05', q.x, q.y + 15, { size: 260, spin: -2.2, grow: .24, color: '#ffd89d', life: .32 });
      FX.spr('twirl_01', q.x, q.y, { size: 390, spin: 3, grow: .2, color: '#ff8896', life: .38 }); hitstop(5); actHit(tot * .2, sa.color, true); });   // 단서를 붉은 실로 잇는다
    later(1.15, () => {   // 마지막: 두 사람의 동작이 닿을 때 도장이 내리찍힌다
      const q = p(); FX.shards(q.x, q.y, '#d9ff70', 34);
      FX.spr('magic_05', q.x, q.y, { size: 495, spin: 2.2, grow: .2, color: '#dfff1a', life: .65 });
      FX.stamp('확정', 245, 352, '#ff6977', 128, .75, .31);
      hitstop(10); kick(7); rock(.9); actHit(tot * .4, '#dfff1a', true);
    });
  }
  function actWin() {
    B.over = true; if (B.atk) { B.atk.h.forEach(h => h.remove()); B.atk = null; } clearKeys(); foe.target = null; foe.play('idle'); B.ch.forEach(m => { m.a.target = null; m.a.play('idle'); }); B.seq = []; endCombo();
    const q = scr(foe, 1.0); FX.calm(q.x, q.y); FX.edge('#dfff1a'); FX.rays(q.x, q.y - 20); FX.text('안정화', 960, 430, '#dfff1a', 150, 1.2); kick(9); S.ripple(foe.x, foe.z, '#dfff1a', 5); fieldEl.classList.add('calm');   // 쓰러뜨리지 않는다: 불안한 색이 풀리며 밝아진다
    S.burst(foe.x, 1, foe.z, '#eaffb0', 18, .1); hitstop(5); B.slow = .5; drawAct(); B.tag.style.display = B.pr.style.display = 'none'; tutSet(null);
    snd('calm'); snd('win'); snd('chain'); el('div', 'banner', hud, '<span>안정화 완료</span>'); setTimeout(() => { if (mode === 'battle' && B && B.over) showResult(); }, 2100);
  }
  function actHurt(dmg) {
    const m = pc(), a = m.a; if (B.tut && (B.tut.s === 'move' || B.tut.s === 'dodge')) dmg = 0;
    m.hp = Math.max(0, m.hp - dmg); B.inv = .9; B.hits++; endCombo(); snd('hurt'); S.burst(a.x, 1, a.z, C.duel.shot || '#d8f070', 8, .07); S.punch(a); a.act('hit'); rock(.5); hitstop(4); kick(3);
    const p = scr(a, 1.1); FX.ink(p.x, p.y, '#ff4057');   // 맞은 자리에 붉은 잉크가 번진다
    if (dmg) pop(a.x, 1.9, a.z, '-' + dmg, 'bad'); B.fl.classList.remove('on'); void B.fl.offsetWidth; B.fl.classList.add('on');
    const e = m.el; e.classList.remove('hitp'); void e.offsetWidth; e.classList.add('hitp');
    if (m.hp <= 0) { if (bc().hp > 0) { doSwap(); pop(a.x, 2.4, a.z, '쓰러짐', 'bad'); } else lose(); }
  }
  function startAtk() {
    const A = C.duel.act, D = C.duel, P = pc().a, F = foe; let pat = A.pats[B.nAtk % A.pats.length]; if (B.tut) pat = 'circle'; B.nAtk++;
    const dur = Math.max(A.tmin, A.tele - B.nAtk * .06) * (B.tut ? 1.2 : 1), dx = P.x - F.x, dz = P.z - F.z, n = Math.hypot(dx, dz) || 1, ux = dx / n, uz = dz / n, sh = [];
    if (pat === 'circle') sh.push({ t: 'c', x: P.x, z: P.z, r: A.r });
    else if (pat === 'line') sh.push({ t: 'l', x: F.x, z: F.z, dx: ux, dz: uz, len: Math.min(10, n + 3.5), w: 1.9 });
    else if (pat === 'donut') sh.push({ t: 'd', x: F.x, z: F.z, r0: 2.1, r1: 5.8 });
    else [-1, 0, 1].forEach(k => sh.push({ t: 'c', x: P.x - uz * 3.3 * k, z: P.z + ux * 3.3 * k, r: A.r - .3 }));
    B.atk = { pat: pat, sh: sh, h: sh.map(s => S.tele(s)), t: 0, dur: dur }; B.st = 'tele'; F.target = null; F.play('use'); F.hop = 1; snd('tele');
    if (pat === 'line') F.wantRy = Math.atan2(ux, uz);
    sh.forEach(s => { if (s.t === 'c') S.shot({ x: F.x, y: 1, z: F.z }, { x: s.x, y: .1, z: s.z }, { color: D.shot || '#d8f070', size: .13, time: dur, arc: 2, trail: 1, shape: FOESHOT[D.monster] || 'spark' }); });
  }
  function detonate() {
    const A = C.duel.act, atk = B.atk, P = pc().a, F = foe; B.atk = null; let worst = 99;
    atk.sh.forEach(s => { worst = Math.min(worst, sd(s, P.x, P.z)); }); atk.h.forEach(h => h.remove());
    atk.sh.forEach(s => {
      const fk = FOEFX[C.duel.monster] || 'crack', pj = (x, z) => S.project(x, .15, z);
      if (s.t === 'c') { S.burst(s.x, .3, s.z, '#ff6a5a', 16, .1); S.ripple(s.x, s.z, '#ff6a5a', s.r / .56); const q = pj(s.x, s.z); FX.foe(fk, q.x, q.y, s.r / 2.2); }
      else if (s.t === 'l') { for (let i = 1; i <= 4; i++) { S.burst(s.x + s.dx * s.len * i / 4, .3, s.z + s.dz * s.len * i / 4, '#ff6a5a', 6, .08); if (i % 2) { const q = pj(s.x + s.dx * s.len * i / 4, s.z + s.dz * s.len * i / 4); FX.foe(fk, q.x, q.y, .7); } } }
      else { S.ripple(s.x, s.z, '#ff6a5a', s.r1 / .56); [0, 1.6, 3.1, 4.7].forEach(a => { const q = pj(s.x + Math.cos(a) * 4, s.z + Math.sin(a) * 4); FX.foe(fk, q.x, q.y, .8); }); }
    });
    if (atk.pat === 'line') { const s = atk.sh[0]; B.rush = { x0: F.x, z0: F.z, x1: clamp(F.x + s.dx * (s.len - 1), B.ar[0] - .5, B.ar[1] + .5), z1: clamp(F.z + s.dz * (s.len - 1), B.ar[2] - .5, B.ar[3] + .5), t: 0 }; }
    snd('boom'); rock(.25);
    // 아슬한 회피: 피하기를 누른 뒤 0.35초 안에 공격이 터지고, 그때 범위 안이거나 가장자리 1.4m 안이면 성공
    let res = worst < -.1 ? (B.dInv > 0 ? 'perfect' : B.inv > 0 ? 'graze' : 'hit') : (B.dInv > 0 && worst < 1.4) ? 'perfect' : 'clean';
    if (res === 'hit' && B.tut && B.tut.s === 'dodge') { B.tut.tries++; if (B.tut.tries >= 3) res = 'clean'; }
    if (res === 'hit' || res === 'graze') {
      if (res === 'hit') { actHurt(A.hit); if (B.tut && B.tut.s === 'dodge') tutSet('dodge2'); }
      B.st = 'rec'; B.stT = A.rec; F.play('idle'); return;
    }
    openGap(res === 'perfect');
  }
  function openGap(perfect) {
    const A = C.duel.act, P = pc().a, F = foe;
    B.gapMax = B.gapT = A.gap * (perfect ? 1.7 : 1); B.st = 'gap'; B.gapFx = 0; F.target = null; F.play('idle'); B.gauge = Math.min(100, B.gauge + (perfect ? 30 : 12)); B.perf += perfect ? 1 : 0;
    if (perfect) {   // 금색 번쩍임, 0.36초 동안 속도 25%, 그 뒤 2.4초 동안 반격이 2배로 들어간다
      B.slow = .36; B.counter = 2.4; snd('just'); FX.edge('#dfff1a'); FX.text('아슬한 회피', 960, 300, '#dfff1a', 110, .9); kick(5); if (!FX.low) { B.gold = .5; }
    } else pop(P.x, 1.9, P.z, '회피', '');
    if (B.tut && B.tut.s === 'dodge') { B.tut.s = 'strike'; tutSet(null); tutGuide('.ak-strike', G.guide.actStep.strike, null, () => { if (B && B.tut && B.tut.s === 'strike') tutSet('strike'); }); }
  }
  function actionTick(d) {
    if (!B || B.over) return;
    const A = C.duel.act, m = pc(), a = m.a, F = foe, ar = B.ar; B.t += d;
    ['dashCd', 'swapCd', 'stCd', 'inv', 'dInv', 'swapBuf', 'counter', 'gold'].forEach(k => { B[k] = Math.max(0, B[k] - d); });
    if (B.combo && B.t - B.comboT > 2.4) endCombo();
    const due = []; B.seq = B.seq.filter(q => { q.t -= d; if (q.t <= 0) { due.push(q); return false; } return true; }); due.forEach(q => q.fn());   // 게임 시간에 맞춰 이어지는 연출(멈춤과 슬로모션에 같이 늘어난다)
    if (B.over) return;
    FX.block = !!B.atk; fieldEl.classList.toggle('sm', B.slow > 0); fieldEl.classList.toggle('gold', B.gold > 0);
    const o = bc(); if (o.hp > 0) o.hp = Math.min(100, o.hp + 3 * d);
    const f = { x: Math.sin(B.hy), z: Math.cos(B.hy) }, r = { x: -f.z, z: f.x }, ix = mv.r - mv.l, iz = mv.u - mv.d;
    const motionLocked = B.t < (B.motionUntil || 0);
    let dx = f.x * iz + r.x * ix, dz = f.z * iz + r.z * ix, sp = 0; const n = Math.hypot(dx, dz); if (n > 0 && !motionLocked) { dx /= n; dz /= n; sp = 5.4; }
    if (B.dashT > 0) { B.dashT -= d; sp = 14; dx = B.dx; dz = B.dz; }
    const ox = a.x, oz = a.z; a.x = clamp(a.x + dx * sp * d, ar[0], ar[1]); a.z = clamp(a.z + dz * sp * d, ar[2], ar[3]);
    const fd = Math.hypot(a.x - F.x, a.z - F.z); if (fd < 1.25) { const k = 1.25 / (fd || .001); a.x = clamp(F.x + (a.x - F.x) * k, ar[0], ar[1]); a.z = clamp(F.z + (a.z - F.z) * k, ar[2], ar[3]); }
    B.moved += Math.hypot(a.x - ox, a.z - oz);
    if (B.useT > 0) B.useT -= d;
    if (B.useT <= 0 || B.dashT > 0) {
      const moving = .001 < Math.hypot(a.x - ox, a.z - oz);
      a.play(moving ? (a.clips?.run ? 'run' : 'walk') : 'idle');
      if (moving) a.wantRy = Math.atan2(dx, dz);
      else if (a.cur !== 'dodge') a.face(F.x, F.z);
    }
    if (B.tut && B.tut.s === 'move' && B.moved >= 5) { B.tut.s = 'dodge'; tutSet('dodge'); }
    let dh = Math.atan2(F.x - a.x, F.z - a.z) - B.hy; while (dh > PI) dh -= 2 * PI; while (dh < -PI) dh += 2 * PI; B.hy += dh * (1 - Math.exp(-d * 3.2));
    const joint = B.t < (B.jointUntil || 0);
    S.heading(B.hy);
    S.zoom(joint ? 1.12 : 1, false);
    if (joint) S.look((a.x + o.a.x + F.x) / 3, (a.z + o.a.z + F.z) / 3, false);
    else S.look(a.x + Math.sin(B.hy) * 1.1, a.z + Math.cos(B.hy) * 1.1, !B.jointUntil || B.t - B.jointUntil > .3);
    if (!motionLocked) follow(o.a, a.x - f.x * 1.7 + r.x * 1.3, a.z - f.z * 1.7 + r.z * 1.3);
    follow(huru, a.x - f.x * 2.9 - r.x * 1.9, a.z - f.z * 2.9 - r.z * 1.9);
    pals.forEach((p, i) => follow(p, a.x - f.x * (2.3 + i * .5) + r.x * [-2.3, 2.7, -3.5][i], a.z - f.z * (2.3 + i * .5) + r.z * [-2.3, 2.7, -3.5][i]));
    [o.a, huru].concat(pals).forEach(x => { if (!x.target) x.face(F.x, F.z); });
    if (B.rush) { B.rush.t += d; const k = Math.min(1, B.rush.t / .16); F.x = B.rush.x0 + (B.rush.x1 - B.rush.x0) * k; F.z = B.rush.z0 + (B.rush.z1 - B.rush.z0) * k; if (k >= 1) B.rush = null; }
    else if (B.st === 'near') {
      const dd = Math.hypot(a.x - F.x, a.z - F.z), hold = B.tut && B.tut.s === 'move';
      if (hold ? dd < 6.5 : dd <= A.range) { F.play('idle'); F.face(a.x, a.z); if (!hold) startAtk(); }
      else { const ex = a.x - F.x, ez = a.z - F.z, nn = Math.hypot(ex, ez) || 1; F.play('walk'); F.x = clamp(F.x + ex / nn * A.speed * d, ar[0] - .5, ar[1] + .5); F.z = clamp(F.z + ez / nn * A.speed * d, ar[2] - .5, ar[3] + .5); F.wantRy = Math.atan2(ex, ez); }
    } else if (B.st === 'tele') {
      B.atk.t += d; B.atk.h.forEach(h => h.set(B.atk.t / B.atk.dur)); if (B.atk.pat !== 'line') F.face(a.x, a.z);
      if (B.atk.t >= B.atk.dur) detonate();
    } else if (B.st === 'rec') { B.stT -= d; F.play('idle'); F.face(a.x, a.z); if (B.stT <= 0) B.st = 'near'; }
    else if (B.st === 'gap') {
      B.gapT -= d; B.gapFx -= d; if (B.gapFx <= 0) { B.gapFx = .5; S.burst(F.x, 1.5, F.z, '#dfff1a', 3, .06); }
      F.face(a.x, a.z); if (B.auto) strike();
      if (B.gapT <= 0) { B.st = 'rec'; B.stT = .35; }
    }
    if (B.gauge >= 100 && !B.chainSeen && (!B.tut || B.tut.s === 'free')) { B.chainSeen = true; GB.save.seen.tutC2 = 1; GB.store(); tutGuide('.ak-chain', G.guide.actStep.chain); }
    drawAct();
  }

  // ── 결과(C안): 가운데 판이 아니라 화면 전체를 쓴다. 왼쪽 큰 글자와 평가, 오른쪽 줄 맞춘 기록 ──
  function showResult() {
    mode = 'result'; music(C.scene); const sec = Math.round(B.t), sv = GB.save, pt = party(), hits = B.hits || 0, perf = B.perf || 0, rank = hits === 0 && perf >= 1 ? 'S' : hits <= 2 ? 'A' : 'B';
    hud.innerHTML = ''; FX.clear();
    const r = el('div', 'res', hud);
    el('div', 'rbig', r, '<small>' + C.duel.title + '</small><b>안정화</b><em>완료</em>');
    el('div', 'rank', r, '<i>' + rank + '</i><span>평가<small>맞은 횟수가 적고 아슬한 회피가 있을수록 높다</small></span>');
    const side = el('div', 'rside', r);
    el('dl', '', side, '<div><dt>상대</dt><dd>' + C.duel.name + '</dd></div><div><dt>걸린 시간</dt><dd>' + Math.floor(sec / 60) + '분 ' + pad(sec % 60) + '초</dd></div><div><dt>아슬한 회피</dt><dd>' + perf + '회</dd></div><div><dt>타격</dt><dd>' + (B.strikes || 0) + '회</dd></div><div><dt>맞은 횟수</dt><dd>' + hits + '회</dd></div>');
    el('div', 'chips', side, (notes.length ? notes : C.clues).map(n => '<span>' + n.label + '</span>').join(''));
    el('div', 'rteam', side, [sv.lead, mateKey(), pt[0], pt[1], pt[2]].map(k => '<div>' + face(k) + '<b>' + (k ? nameOf(k) : '빈 자리') + '</b></div>').join(''));
    btn(el('div', 'rfoot', r), '도시로', worldDone, 1).focus();
  }

  // ── 도시(World)와 잇기 ──
  function worldDone() { const w = C && C._w, st = B && { hits: B.hits || 0, perf: B.perf || 0, t: B.t }; leave(); if (window.World) window.World.finish(w, true, st); }
  function startWorld(w) {   // w: {id, title, monster, duel, arenaSpec:{arena, cam}}
    C = { id: w.id, no: 0, title: w.title, scene: 'harbor', kind: 'world', world: true, duel: w.duel, clues: [], _w: w }; notes = []; S.baseY(w.gy || 0); startAct();
  }

  // ── 추리(범인을 맞히는 사건) ──

  // ── 마무리(조각을 찾는 사건): 조각이 열쇠가 되어 구석의 큰 상자가 열리고, 새 친구가 나온다 ──

  // ── 끝 이야기(장치를 고치는 사건): 시계가 다시 돌고 달빛이 돌아온다 ──

  // ── 문 열기(자물쇠를 푸는 사건): 벽 그림의 순서대로 기호를 고른다 → 문이 열리고 새 친구가 나온다 ──
  const symSvg = s => '<svg viewBox="0 0 64 64"><path d="' + s.d + '" fill="' + s.color + '"/></svg>';


  function key(e) {
    if (mode === 'battle' && B && B.act && e.key !== 'Escape') { if (actKey(e, true)) e.preventDefault(); return; }
    if (e.key === 'Escape') { if (mode === 'team') GB.enterLobby(); else pause(); }
  }

  addEventListener('keyup', e => { if (B && B.act && actKey(e, false)) e.preventDefault(); });
  hud.addEventListener('mousedown', e => { if (B && B.act && e.target.closest && e.target.closest('button')) e.preventDefault(); });   // 단추를 눌러도 초점이 남지 않게 한다(Space가 단추를 한 번 더 누르지 않게)
  addEventListener('blur', clearKeys);

  // 화면 확인용: ?go=team, battle, result  (&case=2 둘째 사건, &party=malangbul 함께 갈 친구, &auto=1 자동, &tut=0 안내 없이)
  const q = new URLSearchParams(location.search), go = q.get('go'), dbgCase = G.cases[(Number(q.get('case')) || 1) - 1];
  if (q.get('auto')) auto = true; skipTut = q.get('tut') === '0' || (!!go && q.get('tut') !== '1');   // 확인용 주소에서는 &tut=1을 붙여야 안내가 나온다
  if (q.get('lead')) GB.save.lead = q.get('lead');
  if (q.get('party') != null) GB.save.party = q.get('party').split(',').filter(Boolean);
  if (go === 'team') openTeam(dbgCase);
  if (go) document.documentElement.classList.add('noanim');
  const warp = Number(q.get('warp') || 0);   // &warp=초: 그만큼 시간을 흘려보낸 화면, &do=단서 이름: 그 단서를 조사, &at=x,z: 그 자리로 걸어감
  // 인물 동작만 가까이서 보는 화면: &clip=idle|walk|use|skill|inspect|hit  &t=동작 시작 뒤 흐른 초  &ry=보는 각도(0이면 정면, 180이면 뒷모습)  &case=현장
  if (go === 'pose') {
    C = dbgCase; S.init($('gl'));
    S.load().then(() => { if (window.World3D) window.World3D.build();
      GB.show('field'); mode = 'pose'; spawn(); const p = sc.start[0], clip = q.get('clip') || 'idle', ry = Number(q.get('ry') || 0) * PI / 180;
      lead.place(p[0], p[1], ry); mate.place(p[0] + 1.5, p[1], ry); huru.place(p[0] + 60, p[1], 0); pals.forEach(a => a.place(p[0] + 60, p[1], 0));
      Object.assign(S.cam, { side: 0, up: Number(q.get('up') || 1.7), back: Number(q.get('back') || 4.6) }); S.look(p[0] + .2, p[1] + .5, true); S.start(tick);   // &up=&back=: 카메라 높이와 거리(얼굴 가까이 보기: up=1.4 back=1.7)
      [lead, mate].forEach(a => { if (clip === 'skill' || clip === 'inspect' || clip === 'hit') a.act(clip); else a.play(clip); });
      S.warp(Number(q.get('t') || .3));
    });
  }
  // &act=tele(붉은 범위가 차오르는 순간) | pat(&pat=line|donut|triple 그 범위) | gap(아슬하게 피한 뒤 빈틈에 타격) | chain(연계)
  function demoAct(q) {
    const act = q.get('act'), pat = q.get('pat'), until = (fn, max) => { for (let i = 0; i < (max || 80) && !fn(); i++) { B.ch.forEach(m => { m.hp = 100; }); S.warp(.2, true); } };
    const fine = (fn, max) => { for (let i = 0; i < (max || 600) && !fn(); i++) { B.ch.forEach(m => { m.hp = 100; }); S.warp(1 / 30, true); } };
    const toGap = () => { until(() => B.atk && B.atk.t / B.atk.dur > .3); pc().a.x -= 5; until(() => B.st === 'gap'); };
    if (act === 'tele') until(() => B.atk && B.atk.t / B.atk.dur > .62);
    else if (act === 'pat') until(() => B.atk && B.atk.pat === pat && B.atk.t / B.atk.dur > .62, 300);
    else if (act === 'gap') { toGap(); strike(); S.warp(.6, true); strike(); S.warp(.45, true); }
    else if (act === 'perfect') {   // 터지는 순간에 맞춰 피하기: 금색 가장자리, 슬로모션
      until(() => B.atk && B.atk.t / B.atk.dur > .85); dash(); fine(() => B.st === 'gap' && B.slow > 0); S.warp(.1, true);
    } else if (act === 'counter') { until(() => B.atk && B.atk.t / B.atk.dur > .85); dash(); fine(() => B.st === 'gap' && B.slow > 0); S.warp(.45, true); strike(); fine(() => FX.has('slash')); S.warp(.05, true); }
    else if (act === 'swapstrike') { toGap(); strike(); S.warp(.5, true); FX.clear(); swap(); fine(() => FX.has('lens') || FX.has('notes')); S.warp(1 / 30, true); }
    else if (act === 'layer') { until(() => B.atk && B.atk.t / B.atk.dur > .6); const P = pc().a, q = scr(P, 1); for (let i = 0; i < 10; i++) S.burst(P.x + (i - 5) * .3, .5, P.z, '#dfff1a', 6, .12); FX.spr('flare_01', q.x, q.y, { size: 900, color: '#dfff1a', life: 2 }); FX.rays(q.x, q.y); FX.stamp('결정적 추리', 960, 430, '#ff4057', 150, 2); S.warp(.1, true); }
    else if (act === 'lens' || act === 'notes') { toGap(); strike(); fine(() => FX.has(act), 300); S.warp(act === 'lens' ? .14 : .2, true); }
    else if (act === 'calm') { toGap(); B.stab = 97; strike(); fine(() => FX.has('calm'), 600); S.warp(.25, true); mode = 'demo'; }   // 결과 화면이 뜨지 않게 멈춘다
    else if (act === 'stamp') { B.gauge = 100; chain(); fine(() => FX.has('stamp'), 900); FX.impactLife = .02; S.warp(.2, true); }
    else if (act === 'string') { B.gauge = 100; chain(); fine(() => FX.has('string'), 900); S.warp(.25, true); }
    else if (act === 'impact') { FX.impactLife = .6; S.warp(.3, true); const q = scr(foe, 1.0); FX.impact(q.x, q.y, { slash: true }); S.warp(1 / 30, true); }
    else if (act === 'ult') { B.gauge = 100; chain(); fine(() => B.seq.length < 2, 900); S.warp(.12, true); }
    else if (act === 'friend') { toGap(); const i = Number(q.get('i') || 0); B.strikes = Number(q.get('alt') || 0); FX.clear(); pals.forEach((p, k) => { if (k === i) friendFx(p, foe, 0); }); S.warp(.05, true); }
    else if (act === 'foefx') { until(() => B.atk && B.atk.t / B.atk.dur > .96, 300); fine(() => !B.atk, 60); S.warp(.22, true); }
    drawAct(); S.warp(0); paused = true;   // 찍는 동안 더 흐르지 않게 멈춘다
  }
  if (go === 'battle' || go === 'result') {
    C = dbgCase; S.init($('gl'));
    S.load().then(() => { if (window.World3D) window.World3D.build();
      startBattle(); if (warp) S.warp(warp); if (q.get('act')) demoAct(q);
      if (go === 'result') { B.t = 34; B.stab = 100; B.over = true; showResult(); }
    });
  }
  return { startWorld: startWorld, openTeam: openTeam, openNote: openNote, leave: leave, key: key, state: () => ({ mode: mode, paused: paused, notes: notes.length, lead: lead && [lead.x, lead.z], seen: marks.map(m => m.seen), B: B && !B.act && foe && { stab: B.stab, cost: B.cost, t: B.t, over: B.over, lit: B.lit, hp: B.team.map(m => m.hp), pos: B.team.map(m => [m.a.x, m.a.z]).concat([[foe.x, foe.z]]) }, A: B && B.act && foe && mode === 'battle' && { stab: B.stab, gauge: B.gauge, t: B.t, over: B.over, st: B.st, gapT: B.gapT, cur: B.cur, hp: B.ch.map(m => m.hp), keys: B.ch.map(m => m.key), me: [pc().a.x, pc().a.z], foe: [foe.x, foe.z], hy: B.hy, atk: B.atk && { pat: B.atk.pat, k: B.atk.t / B.atk.dur, dur: B.atk.dur, sh: B.atk.sh }, tut: B.tut && B.tut.s, ar: B.ar, moved: B.moved, strikes: B.strikes, hits: B.hits, perf: B.perf, dInv: B.dInv, dashCd: B.dashCd, swapCd: B.swapCd, counter: B.counter, strikes: B.strikes, slow: B.slow, nAtk: B.nAtk } }), marks: () => marks };
})();
