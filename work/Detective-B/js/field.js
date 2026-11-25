'use strict';
/* 사건 하나의 흐름: 편성 → 현장 조사 → 진정 훈련(안정화) → 결과 → 추리 또는 마무리 → 사건 해결
   현장은 3D(stage3d.js)이고, 이 파일은 그 위의 화면과 규칙을 맡는다.
   사건마다 다른 것(현장, 필요한 친구, 상대, 마무리 방식)은 js/data.js의 사건 자료에서 읽는다. */
window.Field = (function () {
  const S = window.Stage3D, GB = window.GB, G = GB.G, el = GB.el, $ = id => document.getElementById(id);
  const hud = $('hud'), teamEl = $('team'), ded = $('deduce'), PI = Math.PI, snd = GB.snd, music = GB.music;
  const SIZE = {}; Object.keys(G.models).forEach(k => { SIZE[k] = G.models[k].height; });   // 인물 키(m). 0은 모델 그대로
  let C = null, sc = null, mode = '', paused = false, speed = 1, auto = false, busy = false, skipTut = false;
  let freeze = 0;   // 큰 타격에서 잠깐 멈추는 남은 시간(초)
  let lead = null, mate = null, huru = null, pals = [], lightPal = null, foe = null, notes = [], marks = [], B = null, fin = null, waterPal = null, tl = null, pops = [];
  const mateKey = () => GB.save.lead === 'arthur' ? 'eri' : 'arthur';
  const pad = n => String(n).padStart(2, '0'), clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const iga = s => ((s.charCodeAt(s.length - 1) - 0xAC00) % 28 ? '이' : '가');   // 받침에 따라 '이' 또는 '가'
  const CAMX = -1.8, CAMZ = 3.2;
  // 인물마다 다른 공격 모양과 색(훈련탄이 모두 같은 파란 공으로 보이지 않게)
  const STYLE = { arthur: { shape: 'beam', color: '#ffd92e', size: .13 }, eri: { shape: 'card', color: '#fff1cf', size: .14 }, malangbul: { shape: 'spark', color: '#ffae42', size: .12 }, bangului: { shape: 'drop', color: '#7fd0ff', size: .12 }, mongeul: { shape: 'spark', color: '#ffe66b', size: .12 } };   // 훈련 카메라가 바라보는 곳을 팀과 상대의 가운데에서 얼마나 옮기는가(CAMZ는 화면 아래의 팀 표시와 카드를 피해 인물을 위로 올린다)
  const SLOTS = 3;   // 편성에 데려갈 수 있는 친구 수(탐정 둘과 합쳐 다섯 칸)
  // 해결한 사건에서 온 친구, 그 가운데 편성에 넣은 친구
  const friendsHave = () => G.cases.filter(c => c.helper && GB.save.cleared.indexOf(c.id) >= 0).map(c => c.helper);
  const party = () => { const have = friendsHave(); return (GB.save.party || []).filter((k, i, a) => have.indexOf(k) >= 0 && a.indexOf(k) === i).slice(0, SLOTS); };
  const lacks = c => [].concat((c && c.need) || []).some(k => party().indexOf(k) < 0);   // 이 사건에 필요한 친구가 빠져 있는가
  function btn(parent, label, fn, yellow) { const b = el('button', 'bt' + (yellow ? ' y' : ''), parent, '<span>' + label + '</span>'); b.onclick = fn; return b; }
  function face(k) { return k ? '<i class="fc" style="background-image:url(img/face_' + k + '.png)"></i>' : '<i class="fc none"></i>'; }   // 얼굴만 따로 자른 그림(img/face_이름.png)
  const nameOf = k => k === 'huru' ? G.names.huru : (G.friends[k] || G.leads[k]).name;

  // ── 편성 ──
  function openTeam(c) {
    GB.show('team'); mode = 'team'; teamEl.innerHTML = '';
    const sv = GB.save, pt = party(), have = friendsHave(), waiting = have.filter(k => pt.indexOf(k) < 0);
    el('div', 'thead', teamEl, '<h1>편성</h1>' + (c ? '<div class="tag"><span>의뢰 ' + pad(c.no) + ' · ' + c.title + '</span></div>' : ''));
    if (c) el('div', 'need', teamEl, '이번 현장 <b>' + c.task + '</b> · 진정 훈련 <b>' + c.duel.title + '</b>');
    const row = el('div', 'slots4 five', teamEl);
    [sv.lead, mateKey()].forEach((k, i) => {
      el('button', 'slot', row, '<div class="no">' + (i + 1) + '</div><div class="pic" style="background-image:url(' + G.leads[k].img + ')"></div><div class="nmb"><small>' + (i ? '함께 가는 탐정' : '앞장서는 탐정') + '</small><b>' + G.leads[k].name + '</b></div>')
        .onclick = () => { sv.lead = mateKey(); GB.store(); openTeam(c); };
    });
    for (let i = 0; i < SLOTS; i++) {
      const k = pt[i], F = G.friends[k];
      if (k) el('button', 'slot fr', row, '<div class="no">' + (i + 3) + '</div><div class="pic" style="background-image:url(' + F.img + ')"></div><div class="nmb"><small>' + F.tag + ' · 함께 가는 친구</small><b>' + F.name + '</b></div>')
        .onclick = () => { sv.party = pt.filter(x => x !== k); GB.store(); openTeam(c); };
      else el('div', 'slot empty', row, '<div class="no">' + (i + 3) + '</div><div><b>빈 자리</b><small>' + (waiting.length ? '대기실의 친구를 누르면<br>함께 갑니다' : '사건을 해결하면<br>친구가 늘어납니다') + '</small></div>');
    }
    const w = el('div', 'wait', teamEl, '<b>대기실</b>');
    if (!have.length) el('span', '', w, '함께 갈 친구가 아직 없습니다'); else if (!waiting.length) el('span', '', w, '친구가 모두 편성에 들어가 있습니다');
    waiting.forEach(k => {
      const F = G.friends[k];
      el('button', 'wf', w, face(k) + '<strong>' + F.name + '</strong><u>' + F.tag + '</u><span>' + F.desc + '</span>').onclick = () => { if (pt.length >= SLOTS) { GB.toast('빈 자리가 없습니다. 친구 칸을 눌러 자리를 비웁니다'); return; } sv.party = pt.concat(k); GB.store(); openTeam(c); };
    });
    const lack = lacks(c);
    el('em', lack ? 'hint' : '', w, lack ? '후루 · ' + c.needHint : (pt.length ? '친구 칸을 누르면 대기실로 돌아갑니다' : '탐정 칸을 누르면 앞장서는 탐정이 바뀝니다'));
    const f = el('div', 'tfoot', teamEl);
    btn(f, '돌아가기', GB.enterLobby); if (c) btn(f, '출동', () => depart(c), 1).focus();
    if (c) firstGuide('team', teamEl);
  }
  function depart(c) {
    C = c;
    if (!S.ok()) { GB.openPop({ title: '현장', w: 940, body: '<p>압축을 모두 푼 뒤 <b>B안_게임열기.html</b>을 여세요.</p><p>3D 현장은 브라우저의 WebGL이 켜져 있어야 열립니다.</p>', buttons: [['확인', null, 1]] }); return; }
    snd('go'); GB.loadFor('현장으로 가는 중', prog => { S.init($('gl')); return S.load(prog); })
      .then(startProbe, e => { console.error(e); GB.enterLobby(); GB.toast('현장 자료를 읽지 못했습니다'); });
  }

  // ── 현장 공통 ──
  let recording = null;
  function spawn() {
    recording = null;
    S.clear(); sc = S.setScene(C.scene); S.camMode(mode === 'battle' ? 'battle' : 'field'); const k = GB.save.lead, m = mateKey();
    music(mode === 'battle' ? 'battle' : C.scene);   // 현장마다 다른 곡, 훈련은 훈련 곡
    lead = S.makeActor(k, SIZE[k]); mate = S.makeActor(m, SIZE[m]); huru = S.makeActor('huru', SIZE.huru);
    huru.float = 1.2; huru.speed = 5.5; mate.speed = 3.9; foe = null;
    pals = party().map(p => { const a = window.Evolve ? window.Evolve.pal(p, (k, h) => S.makeActor(k, h), SIZE[p]) : S.makeActor(p, SIZE[p]); a.speed = 4.6; return a; });
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
  // 그린 효과: 칼자국 곡선, 방사선, 충격 프레임. 3D 위에 화면 좌표로 얹는다(공이나 고리만 퍼지는 것을 피한다)
  function fx(kind, x, y, z, col, o) {
    o = o || {}; const p = S.project(x, y, z), e = el('div', 'fx ' + kind, hud);
    e.style.left = p.x + 'px'; e.style.top = p.y + 'px'; e.style.setProperty('--x', p.x + 'px'); e.style.setProperty('--y', p.y + 'px'); e.style.setProperty('--c', col || '#ffd92e');
    if (o.ang !== undefined) e.style.setProperty('--a', o.ang + 'deg');
    if (o.len) e.style.setProperty('--l', o.len + 'px');
    pops.push({ e: e, t: o.t || .5 }); return e;
  }
  const friendEffects = {
    light: ['#ffc578', '<path class="spread" d="M206 141 83 180 18 223 116 209 203 188 312 208 399 219 325 174 214 141Z"/><path d="M206 145 146 77 140 53M207 145 207 35M215 145 278 59M171 88l-13 9m87-11 13 8"/><path class="detail" d="M96 178l15-27 15 27-15 19Zm211-5 12-23 15 23-15 16ZM194 126l12-17 12 17-12 16Z"/>'],
    water: ['#7edaff', '<path class="spread" d="M18 200Q90 222 151 194Q178 181 205 191Q274 218 332 179Q381 154 402 171Q370 204 320 217Q243 244 188 217Q139 232 88 227Z"/><path d="M78 160Q148 216 210 192Q254 180 327 131M146 211q60 20 118-3"/><path class="detail" d="M132 163C112 151 109 137 111 118c15 12 23 30 21 45Zm125 15c-4-23 6-46 31-63 1 28-12 52-31 63Zm-90 9c-10-14-11-26-5-34 9 11 12 23 5 34Z"/>'],
    zap: ['#ffde68', '<path class="spread" d="m273 12-107 116 44-5-57 105 110-130-46 6Z"/><path d="m90 52 31 37-17 8 48 17m125 22 34-25 10 15 32-28M92 173l34-29 10 13 24-10m108 8 25 22-11 12 34 26"/><path class="detail" d="m117 187-17 9 6-15Zm192-94 15-19-2 19Zm-36 85 19 9-18 1Z"/>']
  };
  function friendEffect(kind, point) {
    const [color, path] = friendEffects[kind];
    const node = fx('friend-fx ' + kind, point.x, point.y, point.z, color, { t: .66 });
    node.setAttribute('aria-hidden', 'true');
    node.innerHTML = '<svg viewBox="0 0 420 245" focusable="false">' + path + '</svg>';
  }
  function reduceEffects() {
    return GB.save.reduceFriendFx ?? window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  // 입자 그림(Kenney Particle Pack, CC0): 흰 그림에 색을 입혀 화면 좌표에 한 번 터뜨린다
  const SPR = new URL('assets/fx/kenney_particle_pack/', location.href).href;
  function spr(name, x, y, z, col, size, o) {
    o = o || {}; const e = fx('spr', x, y, z, col, { t: o.t || .4, ang: o.ang === undefined ? Math.random() * 360 : o.ang });
    e.style.setProperty('--img', 'url(' + JSON.stringify(window.ArchiveImage(SPR + name + '.png')) + ')'); e.style.setProperty('--s', (size || 260) + 'px'); return e;
  }
  function slashes(x, y, z, col, n) {   // 탐정 소재: 돋보기 고리가 상대를 비추고 빨간 연필 밑줄이 연달아 그어진다
    fx('lens', x, y, z, col, { t: .45 }); spr('slash_02', x, y, z, '#ffffff', 520, { ang: -20 + Math.random() * 40 });
    for (let i = 0; i < n; i++) setTimeout(() => { if (mode === 'battle' && B) fx('mark', x + (Math.random() - .5) * .5, y - .25 - i * .12, z, '#ff5a6e', { ang: -6 + i * 5 + Math.random() * 4, len: 340 + Math.random() * 200, t: .4 }); }, 60 + i * 80);
  }
  const dist = (a, x, z) => Math.hypot(a.x - x, a.z - z);
  function follow(a, x, z) {
    if (sc.bounds) { x = clamp(x, sc.bounds[0] - 1.4, sc.bounds[1] + 1.2); z = clamp(z, sc.bounds[2], sc.bounds[3] + 1); }
    if (a === mate && mode === 'probe') {
      const distance = dist(a, x, z);
      if (distance > .10) {
        a.speed = Math.min(3.9, distance * 6);
        a.play('walk'); a.target = { x, z };
      } else {
        a.target = null; a.play('idle');
      }
      return;
    }
    if (a === mate) a.speed = 3.9;
    if (dist(a, x, z) > .45) { if (!a.target) a.play('walk'); a.target = { x: x, z: z }; }
  }
  function tick(dt) {
    if (paused) return 0;
    for (let i = pops.length - 1; i >= 0; i--) { pops[i].t -= dt; if (pops[i].t <= 0) { pops[i].e.remove(); pops.splice(i, 1); } }
    if (freeze > 0) { freeze -= dt; return 0; }   // 큰 타격에서 장면이 잠깐 멈춘다
    if (mode === 'probe') {
      if (recording) {
        recording.elapsed += dt;
        if (recording.elapsed >= recording.duration) {
          const finish = recording.finish;
          recording = null;
          finish();
        }
      }
      if (!recording || recording.writer !== mate) follow(mate, lead.x - 1.3, lead.z + .9);
      follow(huru, lead.x - .6, lead.z - 1.1);
      if (tl) { tl.t += dt; while (tl && tl.i < tl.list.length && tl.list[tl.i][0] <= tl.t) tl.list[tl.i++][1](); if (tl && tl.i >= tl.list.length) tl = null; }   // 시간에 맞춰 차례로 일어나는 일
      pals.forEach((a, i) => { if (!a.hold) follow(a, lead.x + [1, -2.4, .1][i], lead.z + [.8, .1, 1.7][i]); });
      [mate, huru].concat(pals).forEach(a => { if (!a.target && !a.hold) a.wantRy = lead.ry; });
      const L = sc.look(lead.x, lead.z); S.look(L[0], L[1]);
      marks.forEach(m => {
        if (!m.seen) { if (lightPal && dist(lightPal, m.x, m.z) < 4.6) { m.seen = true; m.ring.show(true); m.el.style.display = ''; snd('reveal'); } else return; }
        const p = S.project(m.x, m.done ? .4 : 1.5, m.z); m.el.style.left = p.x + 'px'; m.el.style.top = p.y + 'px'; m.px = p.x; m.py = p.y;
      });
      {   // 조사 표시끼리 화면에서 겹치면 옆으로 벌려 따로 누를 수 있게 한다
        const vis = marks.filter(m => m.px !== undefined && !m.done && m.el.style.display !== 'none').sort((a, b) => a.px - b.px);
        for (let i = 1; i < vis.length; i++) for (let j = 0; j < i; j++) { const a = vis[j], b = vis[i]; if (Math.abs(b.py - a.py) < 84 && b.px - a.px < 96) { b.px = a.px + 96; b.el.style.left = b.px + 'px'; } }
      }
      return 1;
    }
    if (mode === 'battle') { const k = B && B.slow > 0 ? .18 : 1; if (k < 1) B.slow -= dt; battleTick(dt * speed * k); return speed * k; }   // 기술을 쓰는 순간에는 잠깐 느려진다
    if (fin) { fin.t += dt; if (!fin.open && fin.t > fin.at) { fin.open = true; fin.fn(); if (fin.snd) snd(fin.snd); } }   // 마무리 장면에서 상자나 문이 열리는 때
    return 1;
  }
  function leave() { S.stop(); S.clear(); hud.innerHTML = ''; marks = []; pops = []; B = null; fin = null; paused = false; mode = ''; }
  function pause() {
    if (mode !== 'probe' && mode !== 'battle' && mode !== 'lock') return;
    if (mode === 'battle' && B && B.over) return;
    paused = true; const resume = () => { paused = false; };
    const b = [['사무소로', GB.enterLobby], ['계속', resume, 1]]; if (mode === 'battle') b.splice(1, 0, ['다시 시작', startBattle]); if (mode === 'probe') b.splice(1, 0, ['편성으로', () => openTeam(C)]);
    GB.openPop({ title: '멈춤', w: mode === 'lock' ? 820 : 1080, body: '<p>' + C.title + ' 현장입니다.</p>', buttons: b, esc: resume });
  }
  function noteRows(list) { return list.map(n => '<p class="nrow"><b>' + n.label + '</b>' + n.note + '</p>').join(''); }
  function openNote(here) {
    let html;
    if (here) html = notes.length ? noteRows(notes) : '<p>아직 적힌 것이 없습니다.</p>';
    else { const cs = G.cases.filter(c => (GB.save.notes || {})[c.id]); html = cs.length ? cs.map(c => '<h4>' + c.title + '</h4>' + noteRows(c.clues)).join('') : '<p>해결한 사건이 아직 없습니다.</p>'; }
    const back = () => { if (here) paused = false; }; if (here) paused = true;
    GB.openPop({ title: '수첩', w: 1060, body: html, buttons: [['닫기', back, 1]], esc: back });
  }

  // ── 현장 조사 ──
  function startProbe() {
    GB.show('field'); mode = 'probe'; paused = false; speed = 1; busy = true; notes = []; marks = [];
    spawn();
    [lead, mate, huru].concat(pals).forEach((a, i) => { const p = sc.start[i] || [sc.start[0][0] - 1.1 * i, sc.start[0][1] + 1.6]; a.place(p[0], p[1], sc.ry); });
    S.look(sc.look0[0], sc.look0[1], true); S.start(tick); lead.goto(sc.enter[0], sc.enter[1], 2.55);
    hud.innerHTML = '';
    el('div', 'finfo', hud, '<small>의뢰 ' + pad(C.no) + ' · 현장 조사</small><b>' + C.title + '</b>');
    const chips = el('div', 'fclues', hud); C.clues.forEach((c, i) => el('span', '', chips, C.kind === 'find' ? '조각 ' + (i + 1) : c.label)); if (C.door) el('span', '', chips, C.door.label);
    const top = el('div', 'top', hud);
    el('button', '', top, '<span>수첩</span>').onclick = () => openNote(true);
    el('button', '', top, '<span>멈춤</span>').onclick = pause;
    // 어두운 현장에 빛을 내는 친구 없이 왔다: 보이지 않으니 편성으로 돌아간다
    if (sc.dark && !lightPal) { GB.playStory(C.noLight, () => { if (mode === 'probe') openTeam(C); }); return; }
    el('div', 'fhint', hud, C.hint || G.added.probeHint);
    C.clues.forEach(c => {
      const p = sc.spots[c.id], m = { c: c, x: p.x, z: p.z, sx: p.sx, sz: p.sz, done: false, seen: !sc.dark };
      m.ring = sc.dark ? S.sparkle(p.x, p.z) : S.ring(p.x, p.z, '#ffd92e');
      m.el = el('button', 'mk', hud, '<i>!</i><span>' + c.label + '</span>'); m.el.onclick = () => inspect(m); if (!m.seen) m.el.style.display = 'none'; marks.push(m);
    });
    if (C.door) {   // 잠긴 문: 조사 때는 잠겨 있다는 것만 알 수 있다
      const p = sc.spots.door, m = { door: true, x: p.x, z: p.z, sx: p.sx, sz: p.sz, done: false, seen: true, ring: S.ring(p.x, p.z, '#7fd0ff') };
      m.el = el('button', 'mk', hud, '<i>!</i><span>' + C.door.label + '</span>'); m.el.onclick = () => inspectDoor(m); marks.push(m);
    }
    const lines = C.introNo && lacks(C) ? C.introNo : C.intro;
    const ready = () => { busy = false; firstGuide('probe', hud); };
    if (lines.length) GB.playStory(lines, ready); else ready();
  }
  // 바닥을 누르면 그 자리로 걸어간다(걸어 다니며 찾는 현장에서만)
  hud.addEventListener('click', e => {
    if (e.target !== hud || mode !== 'probe' || !sc || !sc.bounds || busy || paused) return;
    const p = S.pick(e.clientX, e.clientY); if (!p) return;
    const b = sc.bounds, radius = .22;
    const x = clamp(p.x, b[0] + radius, b[1] - radius);
    const z = clamp(p.z, b[2] + radius, b[3] - radius);
    if (dist(lead, x, z) < .04) return;
    lead.goto(x, z, 2.55); S.burst(x, .1, z, '#ffd92e', 4, .05); snd('walk');
  });
  function inspect(m) {
    if (busy || paused || m.done || !m.seen || mode !== 'probe') return; busy = true;
    lead.goto(m.sx != null ? m.sx : m.x - 1, m.sz != null ? m.sz : m.z + .75, 2.65).then(() => {
      if (mode !== 'probe') return;
      lead.face(m.x, m.z); if (!lead.act('inspect')) lead.play('use');   // 몸을 숙여 살펴보는 동작이 있으면 그것을
      if (C.kind === 'lock' && !waterPal) { GB.playStory(C.noHelper, () => { if (mode === 'probe') openTeam(C); }); return; }   // 물 친구가 없으면 편성으로 돌아간다
      if (C.kind === 'fix') {   // 장치: 맞는 친구가 있어야 고친다
        const a = pals.find(p => p.key === m.c.by);
        if (a) fixAct(m, a, () => tell(m)); else GB.playStory([{ who: 'narr', text: m.c.fail }], () => { lead.play('idle'); busy = false; });
      } else if (C.kind === 'lock') spray(m, () => tell(m)); else tell(m);
    });
  }
  function tell(m) {
    if (mode !== 'probe') return;
    GB.playStory([{ who: 'narr', text: m.c.text }], () => {
      if (mode !== 'probe') return;
      m.done = true; m.ring.remove(); m.el.classList.add('done'); m.el.querySelector('i').textContent = '✓';
      notes.push(m.c);
      lead.play('idle');
      hud.querySelectorAll('.fclues span')[C.kind === 'find' ? notes.length - 1 : C.clues.indexOf(m.c)].classList.add('done');
      const writer = lead.key === 'eri' ? lead : mate;
      const finish = () => {
        GB.toast('수첩에 적었습니다'); snd('found');
        if (notes.length < C.clues.length) { busy = false; return; }
        setTimeout(() => { if (mode === 'probe' && marks.includes(m)) GB.playStory(C.afterClues || G.added.cluesDone, askDuel); }, 900);
      };
      const clip = writer && writer.clips && writer.clips.record;
      if (clip && writer.act('record', clip.getClip().duration, .12)) {
        writer.target = null;
        writer.play('idle');
        recording = { writer, elapsed: 0, duration: clip.getClip().duration, finish };
      } else {
        finish();
      }
    });
  }
  // 물 친구가 벽 앞으로 가서 물을 뿌린다 → 마른 그림이 드러난다
  function spray(m, done) {
    const a = waterPal; a.hold = true;
    a.goto(m.x + 1.2, m.z + 1.6, 4.6).then(() => {
      if (mode !== 'probe') return;
      a.face(m.x, m.z); a.play('use'); snd('water'); const list = [];
      for (let i = 0; i < 7; i++) list.push([i * .16, () => S.shot({ x: a.x, y: .5, z: a.z }, { x: m.x - .75 + i * .25, y: 1.25 + (i % 3) * .35, z: m.z }, { color: '#7fd0ff', size: .11, time: .34, arc: .5, onHit: () => S.burst(m.x - .75 + i * .25, 1.5, m.z + .1, '#bfe6ff', 3, .05) })]);
      list.push([.9, () => { S.revealPaint(); snd('reveal'); }]); list.push([2.6, () => { a.play('idle'); a.hold = false; done(); }]);
      tl = { t: 0, i: 0, list: list };
    });
  }
  // 친구가 장치 앞으로 가서 제 능력을 쓴다 → 장치가 고쳐져 돌기 시작한다
  function fixAct(m, a, done) {
    a.hold = true;
    a.goto(m.x + 1.2, m.z + 1.7, 4.6).then(() => {
      if (mode !== 'probe') return;
      a.face(m.x, m.z); a.play('use'); const F = G.friends[a.key], list = [], tx = m.x - .2, ty = 1.3, fixed = () => { S.fix(m.c.id); snd('gear'); };
      snd(F.light ? 'light' : F.water ? 'water' : 'zap');
      if (F.light) list.push([.2, () => { S.burst(tx, ty, m.z + .3, '#ffd08a', 14, .09); fixed(); }]);
      else if (F.water) { for (let i = 0; i < 7; i++) list.push([i * .16, () => S.shot({ x: a.x, y: .5, z: a.z }, { x: tx - .6 + i * .2, y: ty - .5 + (i % 3) * .45, z: m.z - .2 }, { color: '#7fd0ff', size: .11, time: .34, arc: .5, onHit: () => S.burst(tx, ty, m.z, '#bfe6ff', 3, .05) })]); list.push([.9, () => fixed()]); }
      else { for (let i = 0; i < 4; i++) list.push([i * .14, () => S.shot({ x: a.x, y: .6, z: a.z }, { x: m.x, y: 1.4 + (i % 2) * .8, z: m.z - .1 }, { color: '#ffe66b', size: .1, time: .2, arc: i % 2 ? .6 : -.2, onHit: () => S.burst(m.x, 2, m.z, '#ffe66b', 4, .06) })]); list.push([.7, () => fixed()]); }
      list.push([2.4, () => { a.play('idle'); a.hold = false; done(); }]);
      tl = { t: 0, i: 0, list: list };
    });
  }
  function inspectDoor(m) {
    if (busy || paused || mode !== 'probe') return; busy = true;
    lead.goto(m.sx, m.sz, 4.2).then(() => {
      if (mode !== 'probe') return;
      lead.face(m.x, m.z); snd('key'); GB.playStory([{ who: 'narr', text: C.door.locked }], () => { busy = false; });
    });
  }
  function askDuel() {
    if (mode !== 'probe') return;
    GB.openPop({ title: C.duel.title, sub: '진정 훈련', w: 1000, body: '<p class="quote">' + C.duel.reason + '</p><p>팀이 스스로 움직이며 훈련탄을 쏩니다.<br>아래 카드를 눌러 기술을 씁니다.</p>' + (C.duel.tip ? '<p>' + C.duel.tip + '</p>' : ''), buttons: [['시작', startBattle, 1]], esc: startBattle });
  }

  // ── 진정 훈련 ──
  function startBattle() {
    if (GB.cur !== 'field') GB.show('field');
    mode = 'battle'; paused = false; busy = false; marks.forEach(m => m.ring.remove()); marks = [];
    spawn(); const D = C.duel, bt = sc.battle, cx = bt.cx, cz = bt.cz;
    foe = S.makeActor(D.monster, SIZE[D.monster]); foe.speed = 6; foe.hopH = .7;
    lead.place(cx - 4, cz - .9, PI / 2); mate.place(cx - 5, cz + 1.3, PI / 2); huru.place(cx - 5.6, cz + .2, PI / 2);   // 시작할 때 팀이 화면 안에서 서 있게 한다
    pals.forEach((a, i) => a.place(cx - 4.4 - i * 1.0, cz + [.3, 2.2, -2.2][i], PI / 2));
    if (bt.from) foe.place(bt.from[0], bt.from[1], -PI / 2); else foe.place(cx + 7, cz, -PI / 2);
    foe.goto(cx + 2.6 + (bt.span || 4) * .4, cz + .2);
    S.look(cx + CAMX, cz + CAMZ, false); S.start(tick);
    // near·far: 상대와 지키는 거리, to: 멀어졌을 때 다가서는 거리
    B = { cx: cx, cz: cz, stab: 0, cost: 3, t: 0, buff: 0, wide: 0, lit: true, pl: true, sp: 0, dive: 0, hold: 0, gt: 6, bt: 3, ba: 2.6, over: false,   // lit: 지금 훈련탄이 닿는가
      team: [{ a: lead, key: GB.save.lead, hp: 100, cd: .4, lane: cz - .9, near: 3.4, far: 6.6, to: 5.6 }, { a: mate, key: mateKey(), hp: 100, cd: .8, lane: cz + 1.3, near: 3.4, far: 6.6, to: 5.6 }]
        .concat(pals.map((a, i) => ({ a: a, key: a.key, hp: 100, cd: 1.1 + i * .3, lane: cz + [.2, 2, -2][i], near: 2.6, far: 5, to: 3.6 }))) };
    battleHud();
    if (!GB.save.tut && !skipTut) tutorial();
  }
  function battleHud() {
    hud.innerHTML = '';
    hud.classList.toggle('reduced-card-fx', reduceEffects());
    el('div', 'bgauge', hud, '<small>진정 훈련 · ' + C.duel.title + '</small><b>' + C.duel.name + '</b><u>' + (C.duel.tag || '') + '</u><div class="gbar"><i></i></div><em></em>');
    const ctl = el('div', 'top', hud);
    const bA = el('button', auto ? 'on' : '', ctl, '<span>자동</span>'); bA.onclick = () => { auto = !auto; bA.classList.toggle('on', auto); };
    const bS = el('button', speed > 1 ? 'on' : '', ctl, '<span>2배</span>'); bS.onclick = () => { speed = speed > 1 ? 1 : 2; bS.classList.toggle('on', speed > 1); };
    const bF = el('button', reduceEffects() ? 'on' : '', ctl, '<span>효과 줄이기</span>');
    bF.setAttribute('aria-pressed', String(reduceEffects()));
    bF.onclick = () => {
      GB.save.reduceFriendFx = !reduceEffects(); GB.store();
      hud.classList.toggle('reduced-card-fx', GB.save.reduceFriendFx);
      bF.classList.toggle('on', GB.save.reduceFriendFx);
      bF.setAttribute('aria-pressed', String(GB.save.reduceFriendFx));
    };
    el('button', '', ctl, '<span>멈춤</span>').onclick = pause;
    const tm = el('div', 'bteam', hud);
    B.team.forEach(m => {
      m.el = el('div', 'mem', tm, face(m.key) + '<div><b>' + nameOf(m.key) + '</b><div class="hbar"><i></i></div></div>');
      m.hpBar = m.el.querySelector('.hbar i');
    });
    const cost = el('div', 'bcost', hud, '<span>' + '<i></i>'.repeat(10) + '</span><b></b>');
    const cards = el('div', 'bcards', hud);
    // 후루의 카드는 늘 있고, 나머지는 함께 온 인물의 카드만 나온다
    B.cards = G.cards.filter(c => (c.who === 'huru' || B.team.some(m => m.key === c.who)) && (!c.gate || c.gate === C.duel.gate)).map((c, i) => {
      const b = el('button', 'card', cards, '<em>' + c.cost + '</em>' + face(c.who) + '<small>' + nameOf(c.who) + '</small><b>' + c.name + '</b><span>' + c.text + '</span><kbd>' + (i + 1) + '</kbd>');
      el('i', 'card-status', b, '코스트 부족');
      b.onclick = () => useCard(c);
      return { c, el: b };
    });
    B.ui = { box: hud.querySelector('.bgauge'), bar: hud.querySelector('.gbar i'), pct: hud.querySelector('.bgauge em'), pips: cost.querySelectorAll('i'), num: cost.querySelector('b') };
    drawBattle();
  }
  function drawBattle() {
    const u = B.ui, n = Math.floor(B.cost);
    u.bar.style.width = B.stab + '%';
    const stability = '안정화 ' + Math.floor(B.stab) + '%';
    if (u.pct.textContent !== stability) u.pct.textContent = stability;
    u.box.classList.toggle('dim', !B.lit);
    if (u.wholeCost !== n) {
      if (u.wholeCost < u.pips.length) u.pips[u.wholeCost].style.removeProperty('--f');
      u.pips.forEach((p, i) => p.classList.toggle('on', i < n));
      u.num.textContent = n;
      u.wholeCost = n;
    }
    if (n < u.pips.length) u.pips[n].style.setProperty('--f', B.cost - n);
    B.cards.forEach(({ c, el: card }) => {
      const unavailable = String(card.classList.toggle('off', B.cost < c.cost));
      if (card.getAttribute('aria-disabled') !== unavailable) card.setAttribute('aria-disabled', unavailable);
    });
    B.team.forEach(m => { m.hpBar.style.width = m.hp + '%'; m.el.classList.toggle('out', m.hp <= 0); });
  }
  function battleTick(d) {
    if (!B || B.over) return;
    const D = C.duel;
    // 카메라는 팀과 상대의 가운데를 따라간다(너무 빠르게 움직이면 어지러우니 stage3d가 천천히 따라붙는다)
    const xs = B.team.map(m => m.a.x), x0 = Math.min.apply(null, xs), x1 = Math.max(foe.x, Math.max.apply(null, xs));
    const first = !B.camSet; B.camSet = true;   // 훈련이 시작하는 첫 순간에는 카메라를 바로 맞춘다
    S.look((x0 + x1) / 2 + CAMX, B.cz + CAMZ, first); S.zoom(Math.max(1, Math.min(1.7, (x1 - x0 + 6) / 10.3)), first);   // 팀과 상대가 모두 들어오게 거리를 맞춘다(10.3은 기본 거리에서 보이는 가로 폭 m)
    B.accT = (B.accT || 0) - d; if (B.accT <= 0 && B.acc >= .5) { pop(foe.x, 1.5, foe.z, '+' + Math.max(1, Math.round(B.acc))); B.acc = 0; B.accT = .75; }   // 숫자가 떠 있는 시간(.7초)보다 길게 잡아 두 개가 겹쳐 보이지 않게 한다
    B.t += d; B.cost = Math.min(10, B.cost + d / 1.8); if (B.buff > 0) B.buff -= d; if (B.wide > 0) B.wide -= d;
    // 어두운 현장: 상대가 불빛 안에 있어야 훈련탄이 닿는다
    if (D.gate === 'light' && lightPal) {
      B.lit = dist(lightPal, foe.x, foe.z) < (B.wide > 0 ? 10 : 4); S.lampPower(B.wide > 0 ? 2.4 : 1);
      B.sp -= d; if (B.sp <= 0) { B.sp = .55; S.burst(foe.x, .95, foe.z, '#ece7ff', 2, .05); }   // 반짝여서 어디 있는지는 보인다
    }
    // 충전하는 상대: 가끔 제자리에서 충전한다. 그동안은 훈련탄이 닿지 않고, 끝까지 충전하면 큰 번개가 팀 모두에게 떨어진다
    if (D.gate === 'charge') {
      if (B.hold > 0) B.hold -= d;
      if (B.dive > 0) {
        B.lit = false; B.dive -= d; foe.target = null; foe.play('use'); B.sp -= d; if (B.sp <= 0) { B.sp = .3; S.burst(foe.x, 1.1, foe.z, '#ffe66b', 3, .06); }
        if (B.dive <= 0) {
          B.lit = true; B.gt = 6 + Math.random() * 2.5; foe.play('idle'); S.burst(foe.x, 1.3, foe.z, '#ffe66b', 26, .12); snd('thunder');
          B.team.forEach(m => { if (m.hp > 0) { S.bolt({ x: foe.x, y: 1.4, z: foe.z }, { x: m.a.x, y: 1, z: m.a.z }, '#ffe66b'); S.shot({ x: foe.x, y: 1.2, z: foe.z }, { x: m.a.x, y: .9, z: m.a.z }, { color: '#ffe66b', size: .17, time: .28, onHit: () => hurt(m, D.burst || 8) }); } });
        }
      } else { B.gt -= d; if (B.gt <= 0 && B.hold <= 0) { B.dive = 3; B.sp = 0; } }
    }
    // 분수가 있는 현장: 상대가 가끔 분수 안으로 들어간다. 물속에 있는 동안은 훈련탄이 닿지 않는다
    if (D.gate === 'pond') {
      if (B.hold > 0) B.hold -= d;
      if (B.dive > 0) {
        if (!foe.target) { foe.sink = .5; B.lit = false; B.dive -= d; B.sp -= d; if (B.sp <= 0) { B.sp = .6; S.ripple(foe.x, foe.z); } if (B.dive <= 0) surface(); }
      } else { B.gt -= d; if (B.gt <= 0 && B.hold <= 0) { B.dive = 3.4; foe.hop = 1; foe.goto(sc.battle.pond[0], sc.battle.pond[1]); } }
    }
    B.team.forEach(m => {
      const a = m.a, dx = foe.x - a.x, dz = foe.z - a.z, dd = Math.hypot(dx, dz) || 1;
      if (m.hp <= 0) { if (!a.target) a.play('idle'); return; }
      if (dd > m.far) follow(a, foe.x - m.to, m.lane + (foe.z - B.cz) * .35);
      else if (dd < m.near) follow(a, a.x - 1.8, m.lane);
      else if (!a.target) {
        a.face(foe.x, foe.z); if (!B.lit) { a.play('idle'); return; }
        a.play('use'); m.cd -= d * (B.buff > 0 ? 2 : 1);
        if (m.cd <= 0) { m.cd = .85; snd('shot'); const st = STYLE[m.key] || {}, hy = a === lead || a === mate ? 1 : .5; S.shot({ x: a.x + dx / dd * .5, y: hy, z: a.z + dz / dd * .5 }, { x: foe.x, y: .5, z: foe.z }, Object.assign({ color: '#7fd0ff', time: .26, trail: 1, onHit: () => hit(1, st.color) }, st)); S.burst(a.x + dx / dd * .6, hy, a.z + dz / dd * .6, st.color || '#ffffff', 2, .05); spr('muzzle_02', a.x + dx / dd * .6, hy, a.z + dz / dd * .6, st.color || '#ffffff', 120, { t: .18 }); }
      }
    });
    follow(huru, Math.min(lead.x, mate.x) - 1.5, (lead.z + mate.z) / 2); if (!huru.target) huru.wantRy = PI / 2;
    // 상대: 자리를 옮기고 훈련용 알을 던진다
    B.bt -= d; if (B.bt <= 0 && !(B.dive > 0)) { B.bt = 3.2 + Math.random(); foe.hop = 1; foe.goto(B.cx + 2.6 + Math.random() * (sc.battle.span || 4), B.cz - 2.2 + Math.random() * 4.4); }
    B.ba -= d; if (B.ba <= 0) {
      B.ba = D.every || 2.3; snd('foe'); const alive = B.team.filter(m => m.hp > 0), m = alive[(Math.random() * alive.length) | 0];
      if (m) S.shot({ x: foe.x, y: .8, z: foe.z }, { x: m.a.x, y: .9, z: m.a.z }, { color: D.shot || '#f4d77a', size: .2, time: .75, arc: 2.2, onHit: () => hurt(m, D.hit || 9) });
    }
    if (!foe.target) foe.face(lead.x, lead.z);
    if (auto) {
      const need = B.team.some(m => m.hp < 55);
      B.cards.some(x => (x.c.id === 'heal' ? need : x.c.id === 'fast' ? B.buff <= 0 : x.c.id === 'light' ? !B.lit && B.wide <= 0 : x.c.id === 'water' || x.c.id === 'zap' ? !B.lit && B.hold <= 0 : B.lit) && useCard(x.c));
    }
    if (B.lit !== B.pl) { snd(B.lit ? 'ungate' : 'gate'); B.pl = B.lit; }   // 닿지 않게 될 때와 다시 닿을 때
    drawBattle();
  }
  function surface() {   // 연못에서 올라온다
    S.ripple(foe.x, foe.z); B.dive = 0; foe.sink = 0; B.lit = true; foe.hop = 1; B.gt = 5.5 + Math.random() * 2.5; B.bt = 3.2;
    foe.goto(B.cx + 2.6 + Math.random() * (sc.battle.span || 4), B.cz - 2.2 + Math.random() * 4.4);
  }
  function hit(v, col) {   // 훈련탄이 맞았다: 숫자가 뜨고 상대가 움찔한다. 큰 것이 맞으면 잠깐 멈추고 고리가 퍼지고 화면이 흔들린다
    if (!B || B.over) return;
    const gain = v / (C.duel.tough || 1); B.stab = Math.min(100, B.stab + gain);
    S.burst(foe.x, .6, foe.z, col || '#bfe6ff', v >= 10 ? 26 : 10, v >= 10 ? .15 : .095); S.punch(foe);
    if (v >= 10) { const sum = gain + (B.acc || 0); B.acc = 0; B.accT = .75; pop(foe.x, 1.5, foe.z, '+' + Math.max(1, Math.round(sum)), 'big'); S.shake(.7); S.ripple(foe.x, foe.z, col || '#ffd92e', 3.2); freeze = .1; fx('rays', foe.x, .9, foe.z, col); slashes(foe.x, .9, foe.z, col, 2); spr('star_05', foe.x, .9, foe.z, col || '#ffd92e', 420); spr('magic_03', foe.x, .5, foe.z, col || '#ffd92e', 560, { t: .5 }); } else { B.acc = (B.acc || 0) + gain; spr('spark_03', foe.x, .8, foe.z, col || '#bfe6ff', 250); S.ripple(foe.x, foe.z, col || '#bfe6ff', 1.1); }   // 작은 것은 battleTick에서 모아서 보인다
    B.ui.box.classList.remove('hitp'); void B.ui.box.offsetWidth; B.ui.box.classList.add('hitp');
    if (B.stab >= 100) win();
  }
  function hurt(m, v) {
    if (!B || B.over) return; snd('hurt');
    m.hp = Math.max(0, m.hp - v); S.burst(m.a.x, 1, m.a.z, C.duel.shot || '#f4d77a', 5, .07); S.punch(m.a); S.ripple(m.a.x, m.a.z, '#ff7a8a', 1.1); fx('rays', m.a.x, 1, m.a.z, '#ff7a8a', { t: .3 }); spr('scratch_01', m.a.x, 1, m.a.z, '#ff7a8a', 240); freeze = Math.max(freeze, .05); m.a.act('hit'); pop(m.a.x, 1.7, m.a.z, '-' + v, 'bad');
    m.el.classList.remove('hitp'); void m.el.offsetWidth; m.el.classList.add('hitp');
    if (B.team.every(x => x.hp <= 0)) lose();
  }
  // 기술을 쓰는 순간: 그림과 기술 이름이 화면을 가로지르고, 쓴 인물이 뛰어오른다
  function cutin(c, a) {
    const L = G.leads[c.who], e = el('div', 'cutin' + (L ? '' : ' fr'), hud, '<div class="cpic" style="background-image:url(' + (L ? L.img : 'img/face_' + c.who + '.png') + ')"></div><div class="ctx"><small>' + nameOf(c.who) + '</small><b>' + c.name + '</b></div>');
    e.dataset.card = c.id;
    const friend = Object.hasOwn(friendEffects, c.id);
    e.classList.toggle('friend-cutin', friend);
    pops.push({ e: e, t: friend ? .72 : 1 });
    B.slow = .5;
    if (a) { if (!a.act('skill')) { a.hopH = a.hopH || .55; a.hop = 1; } S.ripple(a.x, a.z); }   // 기술 동작이 있는 모델은 그 동작을, 없으면 뛰어오름
  }
  function useCard(c) {
    if (!B || B.over || paused || B.cost < c.cost) return false;
    B.cost -= c.cost; snd(c.id); const who = B.team.find(m => m.key === c.who); cutin(c, c.who === 'huru' ? huru : who && who.a);   // 카드마다 제 소리(js/sound.js에 카드 id와 같은 이름)
    if (c.id === 'big') { const a = (who || B.team[0]).a; a.face(foe.x, foe.z); S.shot({ x: a.x, y: 1.1, z: a.z }, { x: foe.x, y: .6, z: foe.z }, { color: '#ffd92e', size: .3, shape: 'beam', time: .4, trail: 1, onHit: () => { S.burst(foe.x, .8, foe.z, '#ffd92e', 30, .16); S.burst(foe.x, 1.4, foe.z, '#fff6c8', 14, .1); foe.hop = 1; snd('boom'); hit(10, '#ffd92e'); fx('iframe', foe.x, .9, foe.z, '#ffffff', { t: .16 }); slashes(foe.x, .9, foe.z, '#ffd92e', 3);
        S.ripple(foe.x, foe.z, '#ffe7a0', 2.1);
        spr('star_06', foe.x, .82, foe.z, '#fff0aa', 334, { t: .34 });
        freeze = .14; } }); S.ripple(a.x, a.z, '#ffd92e', 2); }
    if (c.id === 'fast') { B.buff = 6; const a = (who || B.team[1]).a; S.burst(a.x, 1.2, a.z, '#1a9df5', 10, .1); S.ripple(a.x, a.z, '#1a9df5', 2.4); for (let i = 0; i < 8; i++) S.shot({ x: a.x, y: 1.1, z: a.z }, { x: a.x + (Math.random() - .5) * 4, y: 1.8 + Math.random(), z: a.z + (Math.random() - .5) * 3 }, { color: '#fff1cf', size: .13, shape: 'card', time: .5 + Math.random() * .3, arc: 1.2 }); }
    if (c.id === 'heal') { B.team.forEach(m => { m.hp = Math.min(100, m.hp + 35); S.burst(m.a.x, 1.3, m.a.z, '#8ee6a8', 10, .09); S.ripple(m.a.x, m.a.z, '#8ee6a8', 1.8); }); S.burst(huru.x, 1.6, huru.z, '#ffd92e', 8, .08); }
    if (c.id === 'light') {
      const a = who.a;
      B.wide = 8; S.lampPower(2.4);
      S.burst(a.x, 1, a.z, '#ffd08a', 16, .1);
      friendEffect('light', { x: a.x, y: .55, z: a.z });
      spr('light_02', a.x, .7, a.z, '#ffd08a', 720, { ang: 0, t: .6 });
    }
    if (c.id === 'water') {   // 물줄기: 물속의 상대를 불러내고 8초 동안 들어가지 못하게 한다
      const a = who.a, battle = B, target = { x: foe.x, y: .4, z: foe.z };
      a.face(target.x, target.z); B.hold = 8; S.burst(a.x, 1, a.z, '#7fd0ff', 14, .09);
      const splash = () => {
        if (B !== battle || B.over || mode !== 'battle') return;
        S.ripple(target.x, target.z, '#7fd0ff', 2.6);
        friendEffect('water', target);
        spr('twirl_02', target.x, .5, target.z, '#7fd0ff', 460, { t: .5 });
      };
      for (let i = 0; i < 5; i++) S.shot({ x: a.x, y: .5, z: a.z }, target, { color: '#7fd0ff', size: .13, shape: 'drop', time: .3 + i * .07, arc: 1.2, onHit: i === 4 ? splash : null });
      if (B.dive > 0) surface();
    }
    if (c.id === 'zap') {   // 번쩍: 충전을 끊고 8초 동안 충전하지 못하게 한다
      const a = who.a, target = { x: foe.x, y: .9, z: foe.z };
      a.face(target.x, target.z); B.hold = 8; S.burst(a.x, 1, a.z, '#ffe66b', 14, .09);
      S.bolt({ x: a.x, y: 1, z: a.z }, target, '#ffe66b');
      friendEffect('zap', target);
      spr('flare_01', target.x, target.y, target.z, '#fff7a6', 520); spr('star_06', target.x, target.y, target.z, '#ffe66b', 360);
      if (B.dive > 0) { B.dive = 0; B.lit = true; B.gt = 6 + Math.random() * 2.5; foe.play('idle'); S.burst(foe.x, 1.1, foe.z, '#ffffff', 12, .08); }
    }
    const x = B.cards.find(k => k.c === c); x.el.classList.remove('used'); void x.el.offsetWidth; x.el.classList.add('used');
    return true;
  }
  function win() {
    B.over = true; B.lit = true; foe.sink = 0; foe.target = null; foe.play('idle'); B.team.forEach(m => { m.a.target = null; m.a.play('idle'); });
    S.burst(foe.x, 1, foe.z, '#ffd92e', 26, .12); S.ripple(foe.x, foe.z, '#ffd92e', 3.4); S.shake(.7); freeze = .15; B.slow = .5; fx('iframe', foe.x, .9, foe.z, '#ffffff', { t: .16 }); fx('rays', foe.x, .9, foe.z, '#ffd92e', { t: .5 }); slashes(foe.x, .9, foe.z, '#ffd92e', 4); drawBattle();
    snd('win'); el('div', 'banner', hud, '<span>안정화 완료</span>'); setTimeout(() => { if (mode === 'battle' && B && B.over) showResult(); }, 1700);
  }
  function lose() { B.over = true; paused = true; snd('lose'); GB.openPop({ title: '진정 훈련', w: 900, body: '<p>' + G.added.lose + '</p>', buttons: [['사무소로', GB.enterLobby], ['다시', startBattle, 1]], esc: startBattle }); }
  function tutorial() {   // 첫 훈련에서 후루가 화면을 하나씩 알려 준다
    paused = true; const nm = C.duel.name + iga(C.duel.name);
    GB.guide(hud, G.guide.battle.map(x => [x[0], x[1].replace('%s', nm), x[2]]), () => { paused = false; GB.save.tut = 1; GB.store(); });
  }

  // ── 결과 ──
  function showResult() {
    mode = 'result'; music(C.scene); const sec = Math.round(B.t), sv = GB.save, pt = party();
    hud.innerHTML = '';
    const r = el('div', 'result', hud);
    el('h1', '', r, '<small>' + C.duel.title + '</small>안정화 완료');
    const body = el('div', 'rbody', r);
    el('div', 'rteam', body, [sv.lead, mateKey(), pt[0], pt[1], pt[2]].map(k => '<div>' + face(k) + '<b>' + (k ? nameOf(k) : '빈 자리') + '</b></div>').join(''));
    el('div', 'rows', body, '<b>상대</b><div>' + C.duel.name + '</div><b>걸린 시간</b><div>' + Math.floor(sec / 60) + '분 ' + pad(sec % 60) + '초</div><b>' + (C.kind === 'find' ? '찾은 조각' : '찾은 단서') + '</b><div class="chips">' + (notes.length ? notes : C.clues).map(n => '<span>' + n.label + '</span>').join('') + '</div>');
    btn(el('div', 'rfoot', r), '다음', C.kind === 'find' ? startFinale : C.kind === 'lock' ? startLock : C.kind === 'fix' ? startEnding : startDeduce, 1).focus();
  }

  // ── 추리(범인을 맞히는 사건) ──
  function startDeduce() {
    GB.show('deduce'); mode = 'deduce'; ded.innerHTML = ''; if (!notes.length) notes = C.clues.slice();
    let pick = null;
    el('div', 'thead', ded, '<h1>추리</h1><div class="tag"><span>' + C.question + '</span></div>');
    el('div', 'dnote', ded, '<h3>수첩</h3>' + noteRows(notes));
    const row = el('div', 'dsus', ded), f = el('div', 'tfoot', ded);
    const okB = btn(f, '범인 맞히기', () => {
      snd(pick === C.answer ? 'right' : 'wrong');
      if (pick === C.answer) GB.playStory([{ who: 'huru', text: C.explanation }, { who: 'huru', text: C.reward }], solved);
      else GB.playStory(G.added.wrong, null);
    }, 1); okB.disabled = true;
    C.choices.forEach(s => {
      const b = el('button', 'sus', row, '<div class="pic" style="background-image:url(' + G.suspects[s.id] + ')"></div><b>' + s.name + '</b><ul>' + s.traits.map(t => '<li>' + t + '</li>').join('') + '</ul>');
      el('span', 'sus-picked', b, '✓ 선택됨').setAttribute('aria-hidden', 'true');
      b.setAttribute('aria-pressed', 'false');
      b.onclick = () => {
        pick = s.id;
        row.querySelectorAll('.sus').forEach(card => {
          const selected = card === b;
          card.classList.toggle('sel', selected);
          card.setAttribute('aria-pressed', String(selected));
        });
        okB.disabled = false;
      };
    });
    firstGuide('deduce', ded);
  }

  // ── 마무리(조각을 찾는 사건): 조각이 열쇠가 되어 구석의 큰 상자가 열리고, 새 친구가 나온다 ──
  function startFinale() {
    if (GB.cur !== 'field') GB.show('field');
    mode = 'finale'; paused = false; busy = true; hud.innerHTML = ''; if (!notes.length) notes = C.clues.slice();
    spawn(); const ch = sc.chest;
    lead.place(ch.sx - 3.4, ch.sz + .6, PI / 2); mate.place(ch.sx - 2.4, ch.sz + 1.5, PI / 2); huru.place(ch.sx - 2.2, ch.sz - .3, PI / 2);
    pals.forEach((a, i) => a.place(ch.sx - .5 - i * 3.4, ch.sz + 1.6, PI / 2));
    [mate, huru].concat(pals).forEach(a => a.face(ch.x, ch.z));
    S.look(ch.x - 2.8, ch.z + 3.5, true); fin = { t: 0, open: false, at: 1.3, fn: S.openChest, snd: 'creak' }; S.start(tick);
    lead.goto(ch.sx, ch.sz, 3).then(() => { lead.face(ch.x, ch.z); lead.play('use'); });
    el('div', 'finfo', hud, '<small>의뢰 ' + pad(C.no) + ' · 현장</small><b>' + C.title + '</b>');
    GB.playStory([{ who: 'narr', text: C.allFound }], () => {
      if (mode !== 'finale') return;
      lead.play('idle'); S.burst(ch.x, 1.3, ch.z, '#9fe3ff', 22, .1);
      snd('pop'); const n = S.makeActor(C.helper, SIZE[C.helper]); n.place(ch.x, ch.z, -.45); n.hopH = 1.5; n.hop = 1; n.goto(ch.x - 1.5, ch.z + 1.9, 3.4).then(() => n.face(lead.x, lead.z));
      setTimeout(() => { if (mode === 'finale') GB.playStory([{ who: 'huru', text: C.reward }], solved); }, 1100);
    });
  }

  // ── 끝 이야기(장치를 고치는 사건): 시계가 다시 돌고 달빛이 돌아온다 ──
  function startEnding() {
    if (GB.cur !== 'field') GB.show('field');
    mode = 'ending'; paused = false; busy = true; hud.innerHTML = ''; if (!notes.length) notes = C.clues.slice();
    spawn(); const c = sc.center, nm = G.leads[GB.save.lead].name;
    lead.place(c[0], c[1], PI); mate.place(c[0] - 1.6, c[1] + .5, PI); huru.place(c[0] + 1.5, c[1] - .4, PI);
    pals.forEach((a, i) => a.place(c[0] + [2.6, -3, 3.9][i], c[1] + [.9, 1, .3][i], PI));
    S.look(c[0] - .2, c[1] + 3.2, true); fin = { t: 0, open: false, at: .8, fn: S.towerOn, snd: 'bell' }; S.start(tick);
    el('div', 'finfo', hud, '<small>의뢰 ' + pad(C.no) + ' · 현장</small><b>' + C.title + '</b>');
    GB.playStory(C.ending.map(l => ({ who: l.who, text: l.text.replace('%s', '"' + nm + '"' + iga(nm)) })), solved);
  }

  // ── 문 열기(자물쇠를 푸는 사건): 벽 그림의 순서대로 기호를 고른다 → 문이 열리고 새 친구가 나온다 ──
  const symSvg = s => '<svg viewBox="0 0 64 64"><path d="' + s.d + '" fill="' + s.color + '"/></svg>';
  function startLock() {
    if (GB.cur !== 'field') GB.show('field');
    mode = 'lock'; paused = false; busy = false; fin = null; hud.innerHTML = ''; if (!notes.length) notes = C.clues.slice();
    spawn(); const p = sc.spots.door, n = C.answer.length; let pickd = [];
    lead.place(p.sx, p.sz, 0); mate.place(p.sx - 1.7, p.sz + .3, 0); huru.place(p.sx + 1.5, p.sz - .3, 0);
    pals.forEach((a, i) => a.place(p.sx + 1.7 + i * 1.3, p.sz + .5, 0));
    [lead, mate, huru].concat(pals).forEach(a => a.face(p.x, p.z));
    S.look(p.x - 1.2, p.z + 5.6, true); S.start(tick);   // 아래쪽 자물쇠 판에 인물이 가리지 않게 화면을 올려 잡는다
    el('div', 'finfo', hud, '<small>의뢰 ' + pad(C.no) + ' · 현장</small><b>' + C.title + '</b>');
    const top = el('div', 'top', hud);
    el('button', '', top, '<span>수첩</span>').onclick = () => openNote(true);
    el('button', '', top, '<span>멈춤</span>').onclick = pause;
    const box = el('div', 'lockp', hud, '<h3>' + C.lock.title + '<small>' + C.lock.sub + '</small></h3><div class="lrow"><div class="lslots"></div><div class="lpad"></div></div><p class="lmsg"></p>');
    const slots = box.querySelector('.lslots'), padEl = box.querySelector('.lpad'), msg = box.querySelector('.lmsg'), f = el('div', 'lfoot', box);
    const draw = () => { slots.innerHTML = ''; for (let i = 0; i < n; i++) { const s = G.symbols.find(x => x.id === pickd[i]); el('i', s ? 'on' : '', slots, s ? symSvg(s) : ''); } };
    G.symbols.forEach(s => { el('button', '', padEl, symSvg(s) + '<span>' + s.name + '</span>').onclick = () => { if (busy || pickd.length >= n) return; snd('key'); pickd.push(s.id); msg.textContent = ''; draw(); }; });
    btn(f, '지우기', () => { if (busy) return; pickd = []; msg.textContent = ''; draw(); });
    btn(f, '열어 보기', () => {
      if (busy) return;
      if (pickd.length < n) { msg.textContent = C.lock.short; return; }
      if (pickd.join() !== C.answer.join()) { snd('wrong'); msg.textContent = C.door.wrong; pickd = []; draw(); slots.classList.remove('shake'); void slots.offsetWidth; slots.classList.add('shake'); return; }
      busy = true; box.remove(); lead.play('use'); snd('unlock'); fin = { t: 0, open: false, at: .5, fn: S.openDoor, snd: 'creak' };
      GB.playStory([{ who: 'narr', text: C.door.right }], () => {
        if (mode !== 'lock') return;
        lead.play('idle'); S.burst(p.x, 1.3, p.z + .3, '#ffe66b', 22, .1);
        snd('pop'); const a = S.makeActor(C.helper, SIZE[C.helper]); a.place(p.x, p.z + .2, 0); a.hopH = .9; a.hop = 1; a.goto(p.x + .1, p.z + 3, 3.2).then(() => a.face(lead.x, lead.z));
        setTimeout(() => { if (mode === 'lock') GB.playStory([{ who: 'huru', text: C.reward }], solved); }, 1100);
      });
    }, 1);
    draw();
  }

  function solved() {
    const sv = GB.save; if (sv.cleared.indexOf(C.id) < 0) sv.cleared.push(C.id);
    sv.notes = sv.notes || {}; sv.notes[C.id] = 1; GB.store(); snd('stamp');
    const F = G.friends[C.helper];
    const total = G.caseTitles.length, all = sv.cleared.length >= total, left = all ? () => GB.epilogue(GB.enterLobby) : GB.enterLobby;   // 마지막 사건이면 결말 화면을 먼저 보여 준다
    GB.openPop({ title: '사건 해결', sub: '의뢰 ' + pad(C.no), w: 900, body: '<div class="stamp"><span>해결</span></div><p class="big">' + C.title + '</p><p>달빛이 한 칸 돌아왔습니다 (' + sv.cleared.length + ' / ' + total + ')</p>' + (F ? '<p>새 친구 <b>' + F.name + '</b>' + iga(F.name) + ' 대기실에 왔습니다.</p>' : ''), buttons: [[all ? '다음' : '사무소로', left, 1]], esc: left });
  }

  function key(e) {
    if (e.key === 'Escape') { if (mode === 'team') GB.enterLobby(); else pause(); }
    else if (mode === 'battle' && B && B.cards && e.key >= '1' && e.key <= String(B.cards.length)) useCard(B.cards[Number(e.key) - 1].c);
  }

  // 화면 확인용: ?go=team, probe, battle, result, deduce, finale, lock, ending  (&case=2 둘째 사건, &party=malangbul 함께 갈 친구, &auto=1 자동, &tut=0 안내 없이)
  const q = new URLSearchParams(location.search), go = q.get('go'), dbgCase = G.cases[(Number(q.get('case')) || 1) - 1];
  if (q.get('auto')) auto = true; skipTut = q.get('tut') === '0' || (!!go && q.get('tut') !== '1');   // 확인용 주소에서는 &tut=1을 붙여야 안내가 나온다
  if (q.get('party') != null) GB.save.party = q.get('party').split(',').filter(Boolean);
  if (go === 'team') openTeam(dbgCase);
  if (go === 'deduce') { C = dbgCase; startDeduce(); const pk = q.get('pick'); if (pk) ded.querySelectorAll('.sus')[Number(pk)].click(); if (q.get('solved')) solved(); }
  if (go) document.documentElement.classList.add('noanim');
  const warp = Number(q.get('warp') || 0);   // &warp=초: 그만큼 시간을 흘려보낸 화면, &do=단서 이름: 그 단서를 조사, &at=x,z: 그 자리로 걸어감
  // 인물 동작만 가까이서 보는 화면: &clip=idle|walk|use|skill|inspect|hit  &t=동작 시작 뒤 흐른 초  &ry=보는 각도(0이면 정면, 180이면 뒷모습)  &case=현장
  if (go === 'pose') {
    C = dbgCase; S.init($('gl'));
    S.load().then(() => {
      GB.show('field'); mode = 'pose'; spawn(); const p = sc.start[0], clip = q.get('clip') || 'idle', ry = Number(q.get('ry') || 0) * PI / 180;
      lead.place(p[0], p[1], ry); mate.place(p[0] + 1.5, p[1], ry); huru.place(p[0] + 60, p[1], 0); pals.forEach(a => a.place(p[0] + 60, p[1], 0));
      Object.assign(S.cam, { side: 0, up: Number(q.get('up') || 1.7), back: Number(q.get('back') || 4.6) }); S.look(p[0] + .2, p[1] + .5, true); S.start(tick);   // &up=&back=: 카메라 높이와 거리(얼굴 가까이 보기: up=1.4 back=1.7)
      [lead, mate].forEach(a => { if (clip === 'skill' || clip === 'inspect' || clip === 'hit') a.act(clip); else a.play(clip); });
      S.warp(Number(q.get('t') || .3));
    });
  }
  if (go === 'probe' || go === 'battle' || go === 'result' || go === 'finale' || go === 'lock' || go === 'ending') {
    C = dbgCase; S.init($('gl'));
    S.load().then(() => {
      if (go === 'probe') {
        startProbe(); if (q.get('skip')) document.querySelector('.sskip').click();
        const at = q.get('at'); if (at) lead.goto(Number(at.split(',')[0]), Number(at.split(',')[1]), 4.2);
        if (warp) S.warp(warp);
        (q.get('fixed') || '').split(',').filter(Boolean).forEach(id => { const k = marks.find(x => x.c && x.c.id === id); notes.push(k.c); k.done = true; k.ring.remove(); k.el.classList.add('done'); S.fix(id, true); });   // &fixed=dark,rust: 이미 고친 장치
        const m = marks.find(x => x.c && x.c.id === q.get('do')); if (m) { inspect(m); const more = n => { S.warp(Number(q.get('then') || 6)); if (n > 1) Promise.resolve().then(() => more(n - 1)); }; more(Number(q.get('steps') || 1)); }   // &steps=3: 이어지는 동작을 세 번에 나눠 흘려보낸다
      } else if (go === 'lock') {   // &try=moon,star,fire: 그 순서로 눌러 본다
        startLock(); const tr = (q.get('try') || '').split(',').filter(Boolean), ks = [...hud.querySelectorAll('.lpad button')];
        tr.forEach(id => ks[G.symbols.findIndex(s => s.id === id)].click()); if (q.get('open')) hud.querySelectorAll('.lfoot .bt')[1].click();
        if (q.get('skip')) document.querySelector('.sskip').click(); if (warp) S.warp(warp); if (q.get('solved')) { GB.closePop(); solved(); }
      } else if (go === 'ending') { startEnding(); if (warp) S.warp(warp); if (q.get('solved')) { document.querySelector('.sskip').click(); }
      } else if (go === 'finale') { startFinale(); if (q.get('skip')) document.querySelector('.sskip').click(); if (warp) S.warp(warp); if (q.get('solved')) { GB.closePop(); solved(); } }
      else { startBattle(); if (warp) S.warp(warp); if (q.get('card')) { B.cost = 10; useCard(G.cards.find(c => c.id === q.get('card'))); S.warp(Number(q.get('aft') || .45)); } if (go === 'result') { B.t = 34; B.stab = 100; B.over = true; showResult(); } }
    });
  }
  return { inspect: i => inspect(marks[i]), openTeam: openTeam, openNote: openNote, leave: leave, key: key, state: () => ({ mode: mode, paused: paused, notes: notes.length, lead: lead && [lead.x, lead.z], seen: marks.map(m => m.seen), B: B && { stab: B.stab, cost: B.cost, t: B.t, over: B.over, lit: B.lit, hp: B.team.map(m => m.hp), pos: B.team.map(m => [m.a.x, m.a.z]).concat([[foe.x, foe.z]]) } }), marks: () => marks };
})();
