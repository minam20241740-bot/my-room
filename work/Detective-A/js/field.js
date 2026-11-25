'use strict';
/* 사건 하나의 흐름: 편성 → 현장 조사 → 진정 훈련(안정화) → 결과 → 추리 또는 마무리 → 사건 해결
   현장은 3D(stage3d.js)이고, 이 파일은 그 위의 화면과 규칙을 맡는다.
   사건마다 다른 것(현장, 필요한 친구, 상대, 마무리 방식)은 js/data.js의 사건 자료에서 읽는다. */
window.Field = (function () {
  const S = window.Stage3D, GB = window.GB, G = GB.G, el = GB.el, $ = id => document.getElementById(id);
  const hud = $('hud'), teamEl = $('team'), ded = $('deduce'), PI = Math.PI, snd = GB.snd, music = GB.music;
  const fxc = el('canvas', 'fxc', $('field')); fxc.width = 1920; fxc.height = 1080; window.FX.init(fxc); window.FX.preload(['light_01', 'light_02', 'flare_01', 'spark_03', 'spark_04', 'spark_05', 'star_03', 'star_04', 'star_06', 'star_08', 'magic_03', 'magic_05', 'slash_02', 'slash_03', 'flame_03', 'twirl_02', 'muzzle_02', 'muzzle_03', 'scorch_02', 'scratch_01']);   // 2D 효과 그림을 그리는 캔버스(js/fx.js)와 스프라이트 미리 읽기
  const SIZE = {}; Object.keys(G.models).forEach(k => { SIZE[k] = G.models[k].height; });   // 인물 키(m). 0은 모델 그대로
  // 야생 친구(도시에서 달래 도감에 오른 친구)도 팀에 넣을 수 있게, 같은 모양의 친구 자료를 만든다. as: 싸울 때 닮는 친구(빛 말랑불, 물 방울이, 전기 몽글번개, 글 에리)
  const AS = { '빛': 'malangbul', '물': 'bangului', '전기': 'mongeul', '글': 'eri' };
  ((G.world && G.world.wild) || []).forEach(d => { if (!d.join) return; const t = d.join.tag, ar0 = AS[t]; G.friends[d.id] = { name: d.name, tag: t, img: 'img/' + d.join.img + '.png', desc: d.join.desc, wild: 1, tint: d.tint, as: ar0, light: t === '빛' ? 1 : 0, water: t === '물' ? 1 : 0 }; G.models[d.id] = G.models[d.model]; SIZE[d.id] = (G.models[d.model] ? G.models[d.model].height : .8) * 1.15; if (S.alias) S.alias(d.id, d.model); });
  function tintActor(a, color) { a.root.traverse(m => { if (m.isMesh && m.material) { m.material = m.material.clone(); if (m.material.color) m.material.color.multiply(new window.THREE.Color(color)); } }); }
  function ar(k) { return (G.friends[k] && G.friends[k].as) || k; }   // 싸울 때 어떤 친구처럼 움직이는가
  let C = null, sc = null, mode = '', paused = false, speed = 1, auto = false, busy = false, skipTut = false;
  let freeze = 0;   // 큰 타격에서 잠깐 멈추는 남은 시간(초)
  let lead = null, mate = null, huru = null, pals = [], lightPal = null, foe = null, notes = [], marks = [], B = null, fin = null, waterPal = null, tl = null, pops = [];
  const mateKey = () => GB.save.lead === 'arthur' ? 'eri' : 'arthur';
  const pad = n => String(n).padStart(2, '0'), clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const iga = s => ((s.charCodeAt(s.length - 1) - 0xAC00) % 28 ? '이' : '가');   // 받침에 따라 '이' 또는 '가'
  const CAMX = -1.8, CAMZ = 3.2;
  // 인물마다 다른 공격 모양과 색(훈련탄이 모두 같은 파란 공으로 보이지 않게)
  const STYLE = { arthur: { shape: 'beam', color: '#ffd92e', size: .13 }, eri: { shape: 'card', color: '#fff1cf', size: .14 }, malangbul: { shape: 'spark', color: '#ffae42', size: .12 }, bangului: { shape: 'drop', color: '#7fd0ff', size: .12 }, mongeul: { shape: 'spark', color: '#ffe66b', size: .12 } };   // 훈련 카메라가 바라보는 곳을 팀과 상대의 가운데에서 얼마나 옮기는가(CAMZ는 화면 아래의 팀 표시와 카드를 피해 인물을 위로 올린다)
  const SLOTS = 2;   // 편성에 데려갈 수 있는 친구 수(탐정 둘과 합쳐 네 칸)
  // 해결한 사건에서 온 친구, 그 가운데 편성에 넣은 친구
  const friendsHave = () => G.cases.filter(c => c.helper && GB.save.cleared.indexOf(c.id) >= 0).map(c => c.helper).concat(Object.keys((GB.save.world || {}).friends || {}).filter(k => G.friends[k] && G.friends[k].wild && (GB.save.world.friends[k])));
  const party = () => { const have = friendsHave(); return (GB.save.party || []).filter((k, i, a) => have.indexOf(k) >= 0 && a.indexOf(k) === i).slice(0, SLOTS); };
  const lacks = c => [].concat((c && c.need) || []).some(k => !party().some(p => ar(p) === k));   // 이 사건에 필요한 친구가 빠져 있는가
  function btn(parent, label, fn, yellow) { const b = el('button', 'bt' + (yellow ? ' y' : ''), parent, '<span>' + label + '</span>'); b.onclick = fn; return b; }
  function face(k) { return k ? '<i class="fc" style="background-image:url(' + GB.faceUrl(k) + ')"></i>' : '<i class="fc none"></i>'; }   // 얼굴만 따로 자른 그림(img/face_이름.png)
  const nameOf = k => k === 'huru' ? G.names.huru : (G.friends[k] || G.leads[k]).name;

  // ── 편성(A안): 무대 위에 팀이 서고, 오른쪽에 대기 명단이 있다 ──
  function openTeam(c) {
    GB.show('team'); mode = 'team'; teamEl.innerHTML = '';
    const sv = GB.save, pt = party(), have = friendsHave(), waiting = have.filter(k => pt.indexOf(k) < 0), lk = mateKey();
    el('div', 'tm-head', teamEl, '<h1>편성</h1>' + (c ? '<div class="tag"><span>의뢰 ' + pad(c.no) + ' · ' + c.title + '</span></div>' : '') + (c ? '<p>현장 <b>' + c.task + '</b> · 진정 훈련 <b>' + c.duel.title + '</b> · 상대 약점 <b>' + (c.duel.weak || '빛') + '</b></p>' : ''));
    // 네 칸 카드(스타레일 편성 화면처럼): 앞장 탐정, 함께 가는 탐정, 친구 둘. 카드를 누르면 바뀌거나 대기로 돌아간다
    const cards = el('div', 'pcards', teamEl), slotsArr = [sv.lead, lk, pt[0] || null, pt[1] || null];
    slotsArr.forEach((k, i) => {
      if (!k) { el('div', 'pcard empty', cards, '<i class="pno">' + (i + 1) + '</i><span class="plus">+</span><b>빈 자리</b><small>오른쪽 대기 명단에서 고른다</small>'); return; }
      const isLead = i < 2, img = isLead ? G.leads[k].img : G.friends[k].img, tag = isLead ? (i === 0 ? '앞장서는 탐정' : '짝 탐정 · 누르면 앞장') : G.friends[k].tag + ' 친구 · 누르면 대기';
      const b = el('button', 'pcard' + (i === 0 ? ' plead' : '') + (isLead ? '' : ' pfr'), cards, '<i class="pno">' + (i + 1) + '</i><em class="pel">' + (ELEM[k] || '') + '</em><div class="part" style="background-image:url(' + img + ')"></div><div class="pplate"><small>' + tag + '</small><b' + (nameOf(k).length > 4 ? ' class="long"' : '') + '>' + nameOf(k) + '</b></div>');
      b.onclick = () => { if (i === 0) GB.toast('앞장서는 탐정입니다. 옆의 탐정 카드를 누르면 바뀝니다'); else if (i === 1) { sv.lead = lk; GB.store(); openTeam(c); } else { sv.party = pt.filter(y => y !== k); GB.store(); openTeam(c); } };
    });
    // 오른쪽: 대기 명단
    const r = el('div', 'tm-roster', teamEl, '<h3>대기 명단</h3>');
    if (!have.length) el('p', 'none', r, '함께 갈 친구가 아직 없습니다. 사건을 해결하면 친구가 늘어납니다.'); else if (!waiting.length) el('p', 'none', r, '친구가 모두 편성에 들어가 있습니다.');
    waiting.forEach(k => {
      const F = G.friends[k];
      el('button', 'wf', r, face(k) + '<strong>' + F.name + '<u>' + F.tag + '</u></strong><span>' + F.desc + '</span>').onclick = () => { if (pt.length >= SLOTS) { GB.toast('빈 자리가 없습니다. 무대의 친구를 눌러 자리를 비웁니다'); return; } sv.party = pt.concat(k); GB.store(); openTeam(c); };
    });
    const lack = lacks(c);
    el('p', 'tm-hint' + (lack ? ' hint' : ''), r, lack ? '후루 · ' + c.needHint : '무대의 친구를 누르면 대기 명단으로 돌아갑니다.');
    const f = el('div', 'tm-foot', teamEl);
    const bk = el('button', 'tback', f, '<span>← 돌아가기</span>'); bk.onclick = () => GB.enterLobby();
    if (c) { const go = el('button', 'tgo', f, '<b>출동</b><small>현장으로</small>'); go.onclick = () => depart(c); go.focus(); }
    if (c) firstGuide('team', teamEl);
  }
  function depart(c) {
    C = c;
    if (!S.ok()) { GB.openPop({ title: '현장', w: 940, body: '<p>압축을 모두 푼 뒤 <b>A안_게임열기.html</b>을 여세요.</p><p>3D 현장은 브라우저의 WebGL이 켜져 있어야 열립니다.</p>', buttons: [['확인', null, 1]] }); return; }
    snd('go');
    if (loaded && c.scene === 'star') { startProbe(); return; }   // 같은 도시 안에서 하는 사건은 다시 읽지 않는다
    GB.loadFor('현장으로 가는 중', prog => { S.init($('gl')); return S.load(prog); })
      .then(() => { loaded = true; startProbe(); }, e => { console.error(e); GB.enterLobby(); GB.toast('현장 자료를 읽지 못했습니다'); });
  }
  // ── 별빛도시(걸어 다니는 도시) ──
  let loaded = false, wpos = null, lastCase = null;   // 3D 자료를 읽었는가, 사건에 들어서기 전 서 있던 자리
  function preload(prog) { if (loaded || !S.ok()) return Promise.resolve(); S.init($('gl')); return S.load(prog).then(() => { loaded = true; }); }   // 처음 로딩 화면에서 도시 자료를 미리 읽는다
  function goWorld(opt) {
    if (!S.ok()) { GB.show('title'); GB.openPop({ title: '별빛도시', w: 940, body: '<p>압축을 모두 푼 뒤 <b>A안_게임열기.html</b>을 여세요.</p><p>3D 현장은 브라우저의 WebGL이 켜져 있어야 열립니다.</p>', buttons: [['확인', null, 1]] }); return; }
    if (loaded) { enterWorld(opt); return; }
    GB.loadFor('별빛도시로 가는 중', prog => { S.init($('gl')); return S.load(prog); }).then(() => { loaded = true; enterWorld(opt); }, e => { console.error(e); GB.show('title'); GB.toast('도시 자료를 읽지 못했습니다'); });
  }
  function enterWorld(opt) {
    opt = opt || {}; const lc = lastCase; lastCase = null; C = null; mode = 'world'; paused = false; busy = false; speed = 1; auto = false; notes = []; marks = []; B = null; fin = null; pops = []; wpos = null;
    GB.show('field'); hud.innerHTML = ''; hud.classList.remove('ult'); FX.clear(); spawn();
    const st = sc.spots, s = (lc && lc.site) || null, home = opt.at ? { x: opt.at[0], z: opt.at[1] } : s && s.npc ? { x: -6.2, z: -2.6 } : s && s.x != null ? { x: s.x, z: s.z + 3.4 } : { x: sc.start[0][0], z: sc.start[0][1] };
    lead.place(home.x, home.z, opt.ry || 0); mate.place(home.x - 1.3, home.z + 1, 0); huru.place(home.x + 1, home.z + .8, 0); pals.forEach((a, i) => a.place(home.x - 2.4 - i * 1.1, home.z + 1.6, 0));
    if (sc.things) sc.things.clock.run = GB.save.cleared.indexOf('tower') >= 0;
    S.look(lead.x, lead.z, true); S.start(tick);
    window.World.start({ S: S, hud: hud, sc: sc, size: SIZE, yaw: opt.yaw, keepYaw: lc != null, get lead() { return lead; }, get mate() { return mate; }, get huru() { return huru; }, get pals() { return pals; }, party: party, friendsHave: friendsHave,
      swapLead: () => { const t = lead; lead = mate; mate = t; GB.save.lead = lead.key; GB.store(); }, busy: v => { if (v !== undefined) busy = v; return busy; }, beginCase: beginCase, openTeam: () => { openTeam(null); }, openNote: openNote });
    if (!skipTut && !GB.save.seen.g_world) { GB.save.seen.g_world = 1; GB.store(); busy = true; GB.guide(hud, G.guide.world, () => { busy = false; }); }
  }
  // 사건 장소에 들어선다. 필요한 친구가 없으면 편성을 거친다
  function beginCase(c) {
    wpos = { x: lead.x, z: lead.z, ry: lead.ry }; lastCase = c; window.World.stop();
    GB.toTeam(c);
  }
  function enterCase(c) { C = c; lastCase = c; if (lacks(c)) openTeam(c); else depart(c); }

  // ── 현장 공통 ──
  let recording = null;
  function spawn() {
    recording = null;
    const sn = C ? C.scene : 'star'; S.clear(); sc = S.setScene(sn); S.camMode(mode === 'battle' ? (C.duel.mode === 'turn' ? 'turn' : 'battle') : sc.world ? 'world' : 'field'); if (sc.world && mode !== 'battle') S.cam.yaw = window.World.yaw(); const k = GB.save.lead, m = mateKey();
    music(mode === 'battle' ? 'battle' : sn === 'star' ? 'street' : sn);   // 현장마다 다른 곡, 훈련은 훈련 곡
    lead = S.makeActor(k, SIZE[k]); mate = S.makeActor(m, SIZE[m]); huru = S.makeActor('huru', SIZE.huru);
    huru.float = 1.2; huru.speed = 5.5; mate.speed = 3.9; foe = null;
    pals = party().map(p => { const a = window.Evolve ? window.Evolve.pal(p, (k, h) => S.makeActor(k, h), SIZE[p]) : S.makeActor(p, SIZE[p]); a.speed = 4.6; if (G.friends[p] && G.friends[p].tint) tintActor(a, G.friends[p].tint); return a; });
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
    if (freeze > 0) { freeze -= dt; if (B && B.turn) FX.hold(); return 0; }   // 큰 타격에서 장면이 잠깐 멈춘다(충격 프레임은 이 동안 그린다)
    if (mode === 'world') return window.World.tick(dt);
    if (mode === 'probe') {
      if (recording) {
        recording.elapsed += dt;
        if (recording.elapsed >= recording.duration) {
          const finish = recording.finish;
          recording = null;
          finish();
        }
      }
      if (sc.world && !busy && !paused && !lead.target) window.World.drive(lead, dt, sc);   // 별빛도시에서 하는 사건은 걸어 다니며 조사한다
      if (!recording || recording.writer !== mate) follow(mate, lead.x - 1.3, lead.z + .9);
      follow(huru, lead.x - .6, lead.z - 1.1);
      if (tl) { tl.t += dt; while (tl && tl.i < tl.list.length && tl.list[tl.i][0] <= tl.t) tl.list[tl.i++][1](); if (tl && tl.i >= tl.list.length) tl = null; }   // 시간에 맞춰 차례로 일어나는 일
      pals.forEach((a, i) => { if (!a.hold) follow(a, lead.x + [1, -2.4, .1][i], lead.z + [.8, .1, 1.7][i]); });
      [mate, huru].concat(pals).forEach(a => { if (!a.target && !a.hold) a.wantRy = lead.ry; });
      const L = sc.look(lead.x, lead.z); S.look(L[0], L[1]);
      marks.forEach(m => {
        if (!m.seen) { if (lightPal && dist(lightPal, m.x, m.z) < 4.6) { m.seen = true; m.ring.show(true); m.el.style.display = ''; snd('reveal'); } else return; }
        const p = S.project(m.x, m.done ? .4 : 1.5, m.z); m.el.style.left = p.x + 'px'; m.el.style.top = p.y + 'px';
        m.px = p.x; m.py = p.y;
      });
      const shown = [];   // 표시가 서로 가리면 가까이 간 것만 이름을 보인다
      marks.forEach(m => { if (m.px === undefined || m.done || m.el.style.display === "none") return; const near = dist(lead, m.x, m.z) < 6, cover = shown.some(q => Math.abs(q.px - m.px) < 280 && Math.abs(q.py - m.py) < 140); const sp = m.el.querySelector("span"); if (sp) sp.style.display = (cover && !near) ? "none" : ""; if (!cover || near) shown.push(m); });
      return 1;
    }
    if (mode === 'battle') { const k = B && B.slow > 0 ? .18 : 1; if (k < 1) B.slow -= dt; if (B && B.turn) { const sp = B.ultBusy ? 1 : speed; turnTick(dt * sp * k); return sp * k; } battleTick(dt * speed * k); return speed * k; }   // 기술을 쓰는 순간에는 잠깐 느려진다
    if (fin) { fin.t += dt; if (!fin.open && fin.t > fin.at) { fin.open = true; fin.fn(); if (fin.snd) snd(fin.snd); } }   // 마무리 장면에서 상자나 문이 열리는 때
    return 1;
  }
  function leave() { window.World.stop(); S.stop(); S.clear(); FX.clear(); hud.classList.remove('ult'); hud.innerHTML = ''; marks = []; pops = []; B = null; fin = null; paused = false; mode = ''; }
  function pause() {
    if (mode !== 'probe' && mode !== 'battle' && mode !== 'lock') return;
    if (mode === 'battle' && B && B.over) return;
    paused = true; const resume = () => { paused = false; };
    const b = [['도시로', GB.enterLobby], ['계속', resume, 1]]; if (mode === 'battle') b.splice(1, 0, ['다시 시작', startBattle]); if (mode === 'probe') b.splice(1, 0, ['편성으로', () => openTeam(C)]);
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
    if (sc.world) {   // 별빛도시: 서 있던 자리에서 그대로 이어서 조사한다
      const w = wpos || { x: sc.start[0][0], z: sc.start[0][1], ry: 0 };
      lead.place(w.x, w.z, w.ry); mate.place(w.x - 1.3, w.z + 1, w.ry); huru.place(w.x + 1, w.z + .8, w.ry); pals.forEach((a, i) => a.place(w.x - 2.4 - i * 1.1, w.z + 1.6, w.ry));
      S.look(w.x, w.z, true); S.start(tick);
    } else {
      [lead, mate, huru].concat(pals).forEach((a, i) => { const p = sc.start[i] || [sc.start[0][0] - 1.1 * i, sc.start[0][1] + 1.6]; a.place(p[0], p[1], sc.ry); });
      S.look(sc.look0[0], sc.look0[1], true); S.start(tick); lead.goto(sc.enter[0], sc.enter[1], 3.6);
    }
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
    const b = sc.bounds, x = clamp(p.x, b[0], b[1]), z = clamp(p.z, b[2], b[3]);
    lead.goto(x, z, 4.2); S.burst(x, .1, z, '#ffd92e', 4, .05); snd('walk');
  });
  function inspect(m) {
    if (busy || paused || m.done || !m.seen || mode !== 'probe') return; busy = true;
    lead.goto(m.sx != null ? m.sx : m.x - 1, m.sz != null ? m.sz : m.z + .75, 4.2).then(() => {
      if (mode !== 'probe') return;
      lead.face(m.x, m.z); if (!lead.act('inspect')) lead.play('use');   // 몸을 숙여 살펴보는 동작이 있으면 그것을
      if (C.kind === 'lock' && !waterPal) { GB.playStory(C.noHelper, () => { if (mode === 'probe') openTeam(C); }); return; }   // 물 친구가 없으면 편성으로 돌아간다
      if (C.kind === 'fix') {   // 장치: 맞는 친구가 있어야 고친다
        const a = pals.find(p => ar(p.key) === m.c.by);
        if (a) fixAct(m, a, () => tell(m)); else if (m.c.alt) { S.fix(m.c.id); snd('gear'); tell(m, m.c.alt); } else GB.playStory([{ who: 'narr', text: m.c.fail }], () => { lead.play('idle'); busy = false; });
      } else if (C.kind === 'lock') spray(m, () => tell(m)); else tell(m);
    });
  }
  function tell(m, text) {
    if (mode !== 'probe') return;
    GB.playStory([{ who: 'narr', text: text || m.c.text }], () => {
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
    GB.openPop({ title: C.duel.title, sub: '진정 훈련', w: 1000, body: '<p class="quote">' + C.duel.reason + '</p>' + (C.duel.mode === 'turn' ? '<p>차례가 오면 행동을 하나 고릅니다.<br>상대의 안정도를 100까지 채우면 끝납니다.</p>' : '<p>팀이 스스로 움직이며 훈련탄을 쏩니다.<br>아래 카드를 눌러 기술을 씁니다.</p>') + (C.duel.tip ? '<p>' + C.duel.tip + '</p>' : ''), buttons: [['시작', startBattle, 1]], esc: startBattle });
  }

  // ── 진정 훈련 ──
  // 사건 자료의 duel.mode가 'turn'이면 턴제(A안), 아니면 팀이 알아서 쏘는 실시간 훈련(B안)
  function startBattle() { if (C.duel.mode === 'turn') startTurn(); else startRealtime(); }
  function startRealtime() {
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
    el('div', 'bgauge', hud, '<small>진정 훈련 · ' + C.duel.title + '</small><b>' + C.duel.name + '</b><u>' + (C.duel.tag || '') + '</u><div class="gbar"><i></i></div><em></em>');
    const ctl = el('div', 'top', hud);
    const bA = el('button', auto ? 'on' : '', ctl, '<span>자동</span>'); bA.onclick = () => { auto = !auto; bA.classList.toggle('on', auto); };
    const bS = el('button', speed > 1 ? 'on' : '', ctl, '<span>2배</span>'); bS.onclick = () => { speed = speed > 1 ? 1 : 2; bS.classList.toggle('on', speed > 1); };
    el('button', '', ctl, '<span>멈춤</span>').onclick = pause;
    const tm = el('div', 'bteam', hud);
    B.team.forEach(m => { m.el = el('div', 'mem', tm, '<div class="ring">' + face(m.key) + '</div><div><b>' + nameOf(m.key) + '</b><div class="hbar"><i></i></div></div>'); });
    const cost = el('div', 'bcost', hud, '<span>' + '<i></i>'.repeat(10) + '</span><b></b>');
    const cards = el('div', 'bcards', hud);
    // 후루의 카드는 늘 있고, 나머지는 함께 온 인물의 카드만 나온다
    B.cards = G.cards.filter(c => (c.who === 'huru' || B.team.some(m => m.key === c.who)) && (!c.gate || c.gate === C.duel.gate)).map((c, i) => {
      const b = el('button', 'card', cards, '<em>' + c.cost + '</em>' + face(c.who) + '<small>' + nameOf(c.who) + '</small><b>' + c.name + '</b><span>' + c.text + '</span><kbd>' + (i + 1) + '</kbd>');
      b.onclick = () => useCard(c); return { c: c, el: b };
    });
    B.ui = { box: hud.querySelector('.bgauge'), bar: hud.querySelector('.gbar i'), pct: hud.querySelector('.bgauge em'), pips: cost.querySelectorAll('i'), num: cost.querySelector('b') };
    drawBattle();
  }
  function drawBattle() {
    if (B.turn) { drawTurn(); return; }
    const u = B.ui, n = Math.floor(B.cost);
    u.rnd.textContent = B.round; u.bar.style.width = B.stab + '%'; u.pct.textContent = '안정화 ' + Math.floor(B.stab) + '%'; u.box.classList.toggle('dim', !B.lit);
    u.pips.forEach((p, i) => { p.className = i < n ? 'on' : ''; p.style.setProperty('--f', i === n ? (B.cost - n) : 0); }); u.num.textContent = n;
    B.cards.forEach(x => x.el.classList.toggle('off', B.cost < x.c.cost));
    B.team.forEach(m => { m.el.querySelector('.hbar i').style.width = m.hp + '%'; m.el.classList.toggle('out', m.hp <= 0); });
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
    // 연못이 있는 현장: 상대가 가끔 연못에 들어간다. 물속에 있는 동안은 훈련탄이 닿지 않는다
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
        if (m.cd <= 0) { m.cd = .85; snd('shot'); const st = STYLE[m.key] || {}, hy = a === lead || a === mate ? 1 : .5; S.shot({ x: a.x + dx / dd * .5, y: hy, z: a.z + dz / dd * .5 }, { x: foe.x, y: .5, z: foe.z }, Object.assign({ color: '#7fd0ff', time: .26, trail: 1, onHit: () => hit(1, st.color) }, st)); S.burst(a.x + dx / dd * .6, hy, a.z + dz / dd * .6, st.color || '#ffffff', 2, .05); }
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
    S.burst(foe.x, .6, foe.z, col || '#bfe6ff', v >= 10 ? 16 : 5, v >= 10 ? .12 : .07); S.punch(foe);
    if (v >= 10) { const sum = gain + (B.acc || 0); B.acc = 0; B.accT = .75; pop(foe.x, 1.5, foe.z, '+' + Math.max(1, Math.round(sum)), 'big'); S.shake(.5); S.ripple(foe.x, foe.z, col || '#ffd92e', 2.6); freeze = .08; } else B.acc = (B.acc || 0) + gain;   // 작은 것은 battleTick에서 모아서 보인다
    B.ui.box.classList.remove('hitp'); void B.ui.box.offsetWidth; B.ui.box.classList.add('hitp');
    if (B.stab >= 100) win();
  }
  function hurt(m, v) {
    if (!B || B.over) return; snd('hurt');
    if (B.turn) {   // 턴제: 방어 중이면 피해가 절반, 맞으면 그 인물의 에너지가 찬다. 그림 효과는 부른 쪽에서 낸다
      if (B.guard) v = Math.max(1, Math.round(v / 2)); m.en = Math.min(100, m.en + 8); m.hp = Math.max(0, m.hp - v); S.punch(m.a); m.a.act('hit'); pop(m.a.x, 1.7, m.a.z, '-' + v, 'bad'); drawTurn();
      m.el.classList.remove('hitp'); void m.el.offsetWidth; m.el.classList.add('hitp'); if (B.team.every(x => x.hp <= 0)) lose(); return;
    }
    m.hp =Math.max(0, m.hp - v); S.burst(m.a.x, 1, m.a.z, C.duel.shot || '#f4d77a', 5, .07); S.punch(m.a); S.ripple(m.a.x, m.a.z, '#ff7a8a', 1.1); m.a.act('hit'); pop(m.a.x, 1.7, m.a.z, '-' + v, 'bad');
    m.el.classList.remove('hitp'); void m.el.offsetWidth; m.el.classList.add('hitp');
    if (B.team.every(x => x.hp <= 0)) lose();
  }
  // 기술을 쓰는 순간: 그림과 기술 이름이 화면을 가로지르고, 쓴 인물이 뛰어오른다
  function cutin(c, a) {
    const L = G.leads[c.who], e = el('div', 'cutin' + (L ? '' : ' fr'), hud, '<div class="cpic" style="background-image:url(' + (L ? L.cutin : 'img/face_' + c.who + '.png') + ')"></div><div class="ctx"><small>' + nameOf(c.who) + '</small><b>' + c.name + '</b></div>');
    pops.push({ e: e, t: 1 }); B.slow = .5;   // 띠는 1초 보이고, 그 가운데 0.5초 동안 훈련이 느려진다
    if (a) { if (!a.act('skill')) { a.hopH = a.hopH || .55; a.hop = 1; } S.ripple(a.x, a.z); }   // 기술 동작이 있는 모델은 그 동작을, 없으면 뛰어오름
  }
  function useCard(c) {
    if (!B || B.over || paused || B.cost < c.cost) return false;
    B.cost -= c.cost; snd(c.id); const who = B.team.find(m => m.key === c.who); cutin(c, c.who === 'huru' ? huru : who && who.a);   // 카드마다 제 소리(js/sound.js에 카드 id와 같은 이름)
    if (c.id === 'big') { const a = (who || B.team[0]).a; a.face(foe.x, foe.z); S.shot({ x: a.x, y: 1.1, z: a.z }, { x: foe.x, y: .6, z: foe.z }, { color: '#ffd92e', size: .3, shape: 'beam', time: .4, trail: 1, onHit: () => { S.burst(foe.x, .8, foe.z, '#ffd92e', 16, .12); foe.hop = 1; snd('boom'); hit(10, '#ffd92e'); } }); S.ripple(a.x, a.z, '#ffd92e', 2); }
    if (c.id === 'fast') { B.buff = 6; const a = (who || B.team[1]).a; S.burst(a.x, 1.2, a.z, '#1a9df5', 10, .1); S.ripple(a.x, a.z, '#1a9df5', 2.4); for (let i = 0; i < 8; i++) S.shot({ x: a.x, y: 1.1, z: a.z }, { x: a.x + (Math.random() - .5) * 4, y: 1.8 + Math.random(), z: a.z + (Math.random() - .5) * 3 }, { color: '#fff1cf', size: .13, shape: 'card', time: .5 + Math.random() * .3, arc: 1.2 }); }
    if (c.id === 'heal') { B.team.forEach(m => { m.hp = Math.min(100, m.hp + 35); S.burst(m.a.x, 1.3, m.a.z, '#8ee6a8', 10, .09); S.ripple(m.a.x, m.a.z, '#8ee6a8', 1.8); }); S.burst(huru.x, 1.6, huru.z, '#ffd92e', 8, .08); }
    if (c.id === 'light') { B.wide = 8; S.burst(who.a.x, 1, who.a.z, '#ffd08a', 16, .1); S.ripple(who.a.x, who.a.z, '#ffd08a', 5); }
    if (c.id === 'water') {   // 물줄기: 물속의 상대를 불러내고 8초 동안 들어가지 못하게 한다
      const a = who.a; a.face(foe.x, foe.z); B.hold = 8; S.burst(a.x, 1, a.z, '#7fd0ff', 14, .09);
      for (let i = 0; i < 5; i++) S.shot({ x: a.x, y: .5, z: a.z }, { x: foe.x, y: .4, z: foe.z }, { color: '#7fd0ff', size: .13, shape: 'drop', time: .3 + i * .07, arc: 1.2, onHit: i === 4 ? () => S.ripple(foe.x, foe.z, '#7fd0ff', 2.6) : null });
      if (B.dive > 0) surface();
    }
    if (c.id === 'zap') {   // 번쩍: 충전을 끊고 8초 동안 충전하지 못하게 한다
      const a = who.a; a.face(foe.x, foe.z); B.hold = 8; S.burst(a.x, 1, a.z, '#ffe66b', 14, .09);
      S.bolt({ x: a.x, y: 1, z: a.z }, { x: foe.x, y: .9, z: foe.z }, '#ffe66b'); setTimeout(() => { if (B && !B.over) S.bolt({ x: a.x, y: 1.2, z: a.z }, { x: foe.x, y: 1.1, z: foe.z }, '#ffffff'); }, 120); S.ripple(foe.x, foe.z, '#ffe66b', 2.4);
      if (B.dive > 0) { B.dive = 0; B.lit = true; B.gt = 6 + Math.random() * 2.5; foe.play('idle'); S.burst(foe.x, 1.1, foe.z, '#ffffff', 12, .08); }
    }
    const x = B.cards.find(k => k.c === c); x.el.classList.remove('used'); void x.el.offsetWidth; x.el.classList.add('used');
    return true;
  }
  function win() {
    B.over = true; B.lit = true; foe.sink = 0; foe.target = null; foe.play('idle'); B.team.forEach(m => { m.a.target = null; m.a.play('idle'); });
    if (B.turn) { FX.calm(S.project(foe.x, .9, foe.z)); freeze = .06; B.ultBusy = false; hud.classList.remove('ult'); FX.dim(0); drawBattle(); }
    else { S.burst(foe.x, 1, foe.z, '#ffd92e', 26, .12); S.ripple(foe.x, foe.z, '#ffd92e', 3.4); S.shake(.7); freeze = .15; B.slow = .5; drawBattle(); }
    snd('win'); if (B.turn) snd('calm'); if (!B.turn) el('div', 'banner', hud, '<span>안정화 완료</span>'); setTimeout(() => { if (mode === 'battle' && B && B.over && !new URLSearchParams(location.search).get('noresult')) showResult(); }, 1700);   // &noresult=1: 결과 화면으로 넘어가지 않는다(확인용)
  }
  function lose() { B.over = true; paused = true; snd('lose'); GB.openPop({ title: '진정 훈련', w: 900, body: '<p>' + G.added.lose + '</p><p>찾은 단서는 수첩에 그대로 남아 있습니다.</p>', buttons: [['도시로', GB.enterLobby], ['다시', startBattle, 1]], esc: startBattle }); }
  function tutorial() {   // 첫 훈련에서 후루가 화면을 하나씩 알려 준다
    paused = true; const nm = C.duel.name + iga(C.duel.name);
    GB.guide(hud, G.guide.battle.map(x => [x[0], x[1].replace('%s', nm), x[2]]), () => { paused = false; GB.save.tut = 1; GB.store(); });
  }

  // ── 턴제 진정 훈련(A안): 차례가 오면 행동을 하나 고른다 ──
  // 숫자(안정도, 피해, SP, 에너지, 강인도)는 모두 새로 정한 것이라 검토가 필요하다.
  // 연출은 js/fx.js의 그린 효과(칼자국, 글자 조각, 불꽃, 잉크, 번개)로 한다. 공이나 고리 도형을 되풀이하지 않는다.
  const ACTS = [
    { id: 'clue', cls: 't-clue', name: '단서 제시', sub: 'SP +1' },
    { id: 'team', cls: 't-team', name: '동료 협력', sub: 'SP 1 사용' },
    { id: 'guard', cls: 't-guard', name: '방어', sub: '피해 절반' },
    { id: 'look', cls: 't-look', name: '관찰', sub: 'SP +1' }
  ];
  const GATE = { light: ['malangbul', '빛 밖'], pond: ['bangului', '물속'], charge: ['mongeul', '충전 중'] };   // 사건 규칙: [그 규칙을 푸는 친구, 숨은 모습]
  const ELEM = { arthur: '빛', eri: '글', malangbul: '빛', bangului: '물', mongeul: '전기' };   // 인물과 친구의 속성
  Object.keys(G.friends).forEach(k => { const F = G.friends[k]; if (F.wild) { ELEM[k] = F.tag; STYLE[k] = STYLE[F.as] || STYLE.eri; } });   // 야생 친구의 속성과 공격 모양
  const ECOL = { '빛': '#f3e7c4', '글': '#6fe0d0', '물': '#6aa8ff', '전기': '#f2c14e' };
  const WEAK = { bori: '글', banjjak: '빛', garam: '물', mongeul2: '전기' };   // 상대의 약점: 같은 속성으로 단서를 보이면 마음이 풀린다
  const FOEFX = { bori: 'claw', banjjak: 'shard', garam: 'ink', mongeul2: 'zig' };
  const ULTS = { arthur: { name: '결정적 추리', sub: '아서 · 필살기', color: '#e8cf93' }, eri: { name: '증거 기록', sub: '에리 · 필살기', color: '#6fe0d0' } };
  const PTS_MAX = 5, TQ = 8;
  const FORM = [[-3.6, -.6], [-4.0, 2.1], [-1.4, -2.7], [-1.4, 2.4], [-2.8, -4.7]];   // 팀이 서는 자리(상대 쪽이 +x). 앞장선 탐정, 함께 가는 탐정, 친구 셋
  // 상대의 차례 종류: 세 번째마다 큰 반응, 규칙이 있는 사건은 두 번째에 숨는다(빛 밖, 물속, 충전)
  const foeKind = n => n % 3 === 0 ? 'big' : (C.duel.gate && n % 3 === 2 ? 'hide' : 'throw');
  const later = (sec, fn) => { if (B) B.sched.push({ t: B.clock + sec, fn: fn }); };
  const aliveTeam = () => B.team.filter(m => m.hp > 0);
  const foeFace = () => 'img/' + ({ mongeul2: 'mongeul', garam: 'bangului' }[C.duel.monster] || C.duel.monster) + '.png';
  const scr = (a, y) => S.project(a.x, y, a.z);   // 3D 자리를 화면 자리로

  function startTurn() {
    snd('go');   // 훈련이 시작되는 소리
    if (GB.cur !== 'field') GB.show('field');
    mode = 'battle'; paused = false; busy = false; marks.forEach(m => m.ring.remove()); marks = [];
    spawn(); const D = C.duel, bt = sc.battle, cx = bt.cx, cz = bt.cz;
    foe = S.makeActor(D.monster, SIZE[D.monster] * 2.1); foe.speed = 6; foe.hopH = .7; foe.place(cx + 2.6, cz, -PI / 2);
    const list = [lead, mate].concat(pals);
    lead.place(cx + FORM[0][0], cz + FORM[0][1], PI / 2);
    mate.place(cx + FORM[1][0], cz + FORM[1][1], PI / 2);
    pals.forEach((a, i) => a.place(cx + FORM[2 + i][0], cz + FORM[2 + i][1], PI / 2));
    huru.place(cx - 6.6, cz - 3.4, PI / 2); huru.float = 1.6;
    list.forEach(a => a.play('idle'));
    S.look(cx - 1.2, cz, true); S.zoom(1, true); S.start(tick);
    FX.clear(); FX.setReduced(!!GB.save.fx); hud.classList.remove('ult');
    const tmax = D.gate === 'charge' ? 4 : 3;
    B = { turn: true, cx: cx, cz: cz, stab: 0, pts: 3, round: 1, idx: 0, foeN: 0, hide: false, read: 0, guard: false, over: false, t: 0, clock: 0, sched: [], phase: 'wait', cur: 0, sp: 0, slow: 0, acc: 0, accT: 0, hintKey: '',
      score: 0, weak: WEAK[D.monster] || '빛', tough: tmax, toughMax: tmax, broken: false, ultBusy: false,
      team: list.map((a, i) => ({ a: a, key: a.key, hp: 100, en: 0, home: [a.x, a.z], spin: 0 })), order: [] };
    B.order = B.team.map((m, i) => i).concat(-1);
    turnHud();
    const nm = D.name + iga(D.name), begin = () => { drawTurn(); later(.4, turnBegin); };
    if (!skipTut && !GB.save.seen.g_turn) { GB.save.seen.g_turn = 1; GB.store(); paused = true; drawTurn(); GB.guide(hud, G.guide.turn.map(x => [x[0], x[1].replace('%s', nm).replace('%w', B.weak), x[2]]), () => { paused = false; begin(); }); } else begin();
  }
  function turnHud() {
    hud.innerHTML = ''; const D = C.duel;
    const ctl = el('div', 'top', hud);
    const bA = el('button', auto ? 'on' : '', ctl, '<span>자동</span>'); bA.onclick = () => { auto = !auto; bA.classList.toggle('on', auto); if (auto && B && B.phase === 'pick') later(.3, autoPick); };
    const bS = el('button', speed > 1 ? 'on' : '', ctl, '<span>2배</span>'); bS.onclick = () => { speed = speed > 1 ? 1 : 2; bS.classList.toggle('on', speed > 1); };
    const bF = el('button', GB.save.fx ? 'on' : '', ctl, '<span>효과</span>'); bF.onclick = () => { GB.save.fx = GB.save.fx ? 0 : 1; GB.store(); FX.setReduced(!!GB.save.fx); bF.classList.toggle('on', !!GB.save.fx); };
    el('button', '', ctl, '<span>멈춤</span>').onclick = pause;
    el('div', 'tord', hud); el('div', 'trnd', hud, '<small>라운드</small><b>1</b>');
    el('div', 'fpan', hud, '<div class="fn"><b>' + D.name + '</b><span class="fw">약점 <i></i><strong></strong></span><u>' + (D.tag || '') + '</u></div><div class="ftg"><small>강인도</small><span></span></div><div class="gbar"><i></i></div><em></em>');
    el('div', 'thint', hud);
    const tm = el('div', 'bteam row', hud);
    B.team.forEach(m => { m.el = el('div', 'mem', tm, face(m.key) + '<div><b>' + nameOf(m.key) + '</b><div class="hbar"><i></i></div><div class="ebar"><i></i></div></div><span class="hp"></span>'); });
    const act = el('div', 'tact', hud);
    el('div', 'tpts', act, '<small>SP</small><span>' + '<i></i>'.repeat(PTS_MAX) + '</span>');
    ACTS.forEach((a, i) => { const b = el('button', 'tbtn ' + a.cls, act, '<b>' + a.name + '</b><small>' + a.sub + '</small><kbd>' + (i + 1) + '</kbd>'); b.onclick = () => turnAct(a.id); a.el = b; });
    const u = el('button', 'tult', act, '<b></b><small></small><kbd>5</kbd>'); u.onclick = () => turnAct('ult'); el('div', 'tsc', act, '<span>추리 점수</span><b>0</b><em></em>');
    const fp = hud.querySelector('.fpan'), tg = fp.querySelector('.ftg span'); tg.innerHTML = '<i></i>'.repeat(B.toughMax);
    const wi = fp.querySelector('.fw i'); wi.style.background = ECOL[B.weak]; fp.querySelector('.fw strong').textContent = B.weak;
    B.ui = { rnd: hud.querySelector('.trnd b'), box: fp, bar: fp.querySelector('.gbar i'), pct: fp.querySelector('em'), tg: tg.querySelectorAll('i'), ord: hud.querySelector('.tord'), hint: hud.querySelector('.thint'), pips: act.querySelectorAll('.tpts i'), ult: u, sc: act.querySelector('.tsc') };
  }
  // 행동 순서 막대: 지금 차례부터 다음 칸들. 상대의 세 번째 차례(큰 반응)는 붉게 보인다
  function queueList() {
    const out = []; let i = B.idx, f = B.foeN;
    for (let k = 0; out.length < TQ && k < 80; k++) {
      const s = B.order[i];
      if (s < 0) { f++; out.push({ foe: true, kind: foeKind(f) }); } else if (B.team[s].hp > 0) out.push({ s: s });
      i = (i + 1) % B.order.length;
    }
    return out;
  }
  function untilBig() { return (3 - (B.foeN + 1) % 3) % 3; }   // 상대의 큰 반응까지 남은 라운드. 0이면 이번 라운드 끝에 온다
  function drawTurn() {
    const u = B.ui; if (!u) return;
    u.bar.style.width = B.stab + '%'; u.pct.textContent = '안정화 ' + Math.floor(B.stab) + '%'; u.box.classList.toggle('dim', B.hide); u.box.classList.toggle('brk', B.broken);
    u.tg.forEach((t, i) => { t.className = i < B.tough ? 'on' : ''; });
    u.pips.forEach((p, i) => { p.className = i < B.pts ? 'on' : ''; }); u.sc.querySelector('b').textContent = B.score; u.sc.querySelector('em').textContent = B.score >= 6 ? '필살기 최대' : B.score >= 3 ? '필살기 커짐' : ''; u.sc.classList.toggle('hot', B.score >= 3);
    B.team.forEach((m, i) => {
      m.el.querySelector('.hbar i').style.width = m.hp + '%'; m.el.querySelector('.hp').textContent = m.hp; m.el.querySelector('.ebar i').style.width = (ULTS[m.key] ? m.en : 0) + '%'; m.el.style.setProperty('--e', (ULTS[m.key] ? Math.min(100, m.en) : 0) + '%');
      m.el.classList.toggle('out', m.hp <= 0); m.el.classList.toggle('cur', B.phase === 'pick' && B.cur === i); m.el.classList.toggle('rdy', !!ULTS[m.key] && m.en >= 100);
    });
    const pick = B.phase === 'pick' && !B.over, cm = B.team[B.cur], U = cm && ULTS[cm.key];
    ACTS.forEach(a => a.el.classList.toggle('off', !pick || (a.id === 'team' && B.pts < 1)));
    const ready = !!U && cm.en >= 100;
    u.ult.classList.toggle('off', !pick || !ready); u.ult.classList.toggle('full', ready); u.ult.style.setProperty('--f', (U ? Math.min(100, cm.en) : 0) + '%');
    u.ult.querySelector('b').textContent = U ? U.name : '필살기'; u.ult.querySelector('small').textContent = !U ? '친구는 쓰지 않아' : ready ? '눌러서 사용' : '에너지 ' + Math.floor(cm.en) + ' / 100';
    const q = queueList(), ln = u.ord; ln.innerHTML = '';
    q.forEach((x, k) => {
      const key = x.foe ? null : B.team[x.s].key, pic = x.foe ? '<i class="fc foe" style="background-image:url(' + foeFace() + ')"></i>' : face(key);
      el('div', 'tq' + (k === 0 ? ' now' : '') + (x.foe ? ' foe' : '') + (x.foe && x.kind === 'big' ? ' big' : ''), ln, pic + (k === 0 ? '<span>' + (x.foe ? C.duel.name : nameOf(key)) + '</span>' : ''));
    });
    const big = untilBig(); el('div', 'tbig', ln, big === 0 ? '이번 라운드 끝에 큰 반응' : '큰 반응까지 ' + big + '라운드');
  }
  function say(text) { if (B && B.ui) B.ui.hint.textContent = text || ''; }
  // 지금 차례에 보여 줄 짧은 안내. 처음 한 번만 나오는 것은 저장해 둔다
  function turnHint() {
    const sv = GB.save, H = G.turnHints, cm = B.team[B.cur], nm = nameOf(cm.key), g = C.duel.gate, once = k => { if (sv.seen['th_' + k]) return false; sv.seen['th_' + k] = 1; GB.store(); return true; };
    if (B.hide && g) say(H[g]);
    else if (ULTS[cm.key] && cm.en >= 100 && once('ult')) say(H.ult);
    else if (untilBig() === 0 && once('big')) say(H.big);
    else if (once('first')) say(H.first.replace('%s', nm));
    else if (once('weak')) say(H.weak.replace('%w', B.weak));
    else if (B.pts >= 2 && cm.hp > 0 && once('pts')) say(H.pts);
    else say(nm + ' 차례. 행동을 하나 골라.');
  }
  function stepIdx() { B.idx++; if (B.idx >= B.order.length) { B.idx = 0; B.round++; } }
  function turnBegin() {   // 지금 차례를 시작한다
    if (!B || B.over) return;
    let s = B.order[B.idx], n = 0; while (s >= 0 && B.team[s].hp <= 0 && n++ < 9) { stepIdx(); s = B.order[B.idx]; }
    if (s < 0) { B.phase = 'foe'; drawTurn(); later(.5, foeTurn); return; }
    B.cur = s; B.phase = 'pick'; turnHint(); drawTurn();
    if (auto) later(.8, autoPick);
  }
  function turnEnd(wait) { B.phase = 'wait'; drawTurn(); later(wait, () => { if (B && !B.over) { stepIdx(); turnBegin(); } }); }
  function autoPick() {
    if (!B || B.over || B.phase !== 'pick' || !auto) return;
    const cm = B.team[B.cur], g = C.duel.gate, fixer = g && (B.team.some((m, i) => i !== B.cur && m.hp > 0 && ar(m.key) === GATE[g][0]) || ar(cm.key) === GATE[g][0]);
    const need = B.team.some(m => m.hp > 0 && m.hp < 55);
    let id = 'clue';
    if (ULTS[cm.key] && cm.en >= 100) id = 'ult'; else if (B.hide && fixer && B.pts >= 1) id = 'team'; else if (B.hide) id = 'look';
    else if (untilBig() === 0 && need) id = 'guard'; else if (B.pts >= 2) id = 'team'; else if (B.pts < 1) id = 'clue';
    turnAct(id);
  }
  // 안정도를 올린다. 숨어 있으면 닿지 않는다(reach가 참이면 닿는다). elems: 이 공격의 속성(약점이면 더 크게, 강인도가 깎인다)
  function tApply(v, reach, big, elems) {
    if (!B || B.over) return;
    if (B.hide && !reach) { pop(foe.x, 1.7, foe.z, '닿지 않아', 'bad'); snd('gate'); return; }
    const weak = [].concat(elems || []).indexOf(B.weak) >= 0; if (weak && !big) B.score++;
    let g = v * (big ? 1 : .55) / (C.duel.tough || 1); if (B.read > 0) { g *= 1.5; B.read = 0; } if (weak) g *= 1.5; if (B.broken) g *= 1.3;
    B.stab = Math.min(100, B.stab + g); S.punch(foe); if (!big) freeze = Math.max(freeze, FX.isReduced() ? .02 : .05);   // 가벼운 타격: 짧은 멈춤
    pop(foe.x, 1.5, foe.z, (weak && !big ? '약점 ' : '') + '+' + Math.max(1, Math.round(g)), big ? 'big' : weak ? 'weak' : '');
    if (weak && !B.broken && (B.tough -= big ? 2 : 1) <= 0) doBreak();
    B.ui.box.classList.remove('hitp'); void B.ui.box.offsetWidth; B.ui.box.classList.add('hitp'); drawTurn();
    if (B.stab >= 100) win();
  }
  function doBreak() {   // 강인도가 0: 상대가 흔들려 다음 행동을 못 한다
    B.tough = 0; B.broken = true; const at = scr(foe, .9); snd('boom'); foe.hop = 1;
    FX.radial(at, { color: '#ffd95a', n: 34, r: 600, dur: .4 }); FX.stamp({ x: at.x, y: at.y - 150 }, '흔들림', '#ffd95a', 1);
    S.shake(.35); freeze = Math.max(freeze, FX.isReduced() ? .03 : .1); say(C.duel.name + iga(C.duel.name) + ' 마음이 흔들려 다음 행동을 못 한다.');
  }
  function unhide() {   // 숨은 상대가 다시 보이고 닿는다
    if (!B.hide) return; B.hide = false; foe.sink = 0; foe.target = null; foe.hop = 1; snd('ungate'); S.lampPower(1);
    foe.goto(B.cx + 2.6, B.cz, 6).then(() => { if (B && !B.over) foe.face(lead.x, lead.z); });
  }
  // 인물과 친구의 일반 기술 그림
  function fxBasic(m, strong) {
    const fp = scr(m.a, 1.0), tp = scr(foe, .75), k = ar(m.key), big = strong ? 1.3 : 1;
    if (k === 'arthur') { FX.lens(fp, tp, { size: strong ? 1.25 : 1 }); FX.sprFx(['light_02', 'flare_01'], tp, { color: '#fff1a8', size: 300 * big, delay: .2, dur: .4, minor: true }); snd('lens'); }
    else if (k === 'eri') { FX.chars(fp, tp, { words: strong ? '단서증거' : '단서' }); FX.sprFx('star_06', tp, { color: '#bff5e8', size: 220 * big, delay: .36, dur: .35, spin: .3, minor: true }); }
    else if (k === 'malangbul') { FX.flame(fp, tp, { size: big }); FX.sprFx(['flame_03', 'flame_03'], tp, { color: '#ffb347', size: 260 * big, delay: .3, dur: .4, minor: true }); }
    else if (k === 'bangului') { FX.ink(fp, tp, { size: big }); FX.sprFx('twirl_02', tp, { color: '#8fd0ff', size: 260 * big, delay: .26, dur: .45, spin: -.4, minor: true }); }
    else if (k === 'mongeul') { FX.zig(fp, tp, { n: strong ? 3 : 2 }); FX.sprFx('spark_05', tp, { color: '#fff27a', size: 280 * big, delay: .14, dur: .35, minor: true }); }
  }
  // 상대의 몸짓: 날아가는 붓 자국에 스프라이트를 얹는다. 시작에는 놀란 듯한 별빛, 닿는 곳에는 그을린 자국과 상대마다 다른 모양
  function foeFlash(fk, fp, mp, big) {
    const col = { claw: '#ffb0b8', shard: '#d8d2ff', ink: '#7fa8e8', zig: '#fff27a' }[fk] || '#ffffff', sp = { claw: 'scratch_01', shard: 'star_03', ink: 'twirl_02', zig: 'spark_04' }[fk] || 'spark_04', s = big ? 1.4 : 1;
    FX.sprFx('muzzle_02', fp, { color: col, size: 240 * s, dur: .22, minor: true });
    FX.sprFx('scorch_02', mp, { color: '#241a2a', add: false, size: 220 * s, delay: .34, dur: .9, alpha: .55, grow: .7 });
    FX.sprFx(sp, mp, { color: col, size: 260 * s, delay: .34, dur: .4, spin: fk === 'ink' ? .3 : 0, minor: true });
  }
  // 친구 몸짓: 말랑불은 높이 뛰며 돌고, 방울이는 납작해졌다 튀고, 몽글번개는 몸을 떨다가 부딪힌다
  function monMove(m) {
    const a = m.a, k = ar(m.key); if (!ELEM[k] || k === 'arthur' || k === 'eri') return;
    if (k === 'malangbul') { a.hopH = 1.3; a.hop = 1; m.spin = .55; }
    else if (k === 'bangului') { a.hopH = .5; a.hop = 1; S.punch(a); later(.18, () => { a.hop = 1; S.punch(a); }); later(.36, () => { a.hop = 1; S.punch(a); }); }
    else { m.shake = .5; const hx = a.x, hz = a.z; later(.4, () => { a.x += (foe.x - a.x) * .5; a.z += (foe.z - a.z) * .5; a.hop = 1; }); later(.8, () => { a.x = hx; a.z = hz; }); }
  }
  function turnAct(id) {
    if (!B || !B.turn || B.over || paused || B.phase !== 'pick') return false;
    if (id === 'team' && B.pts < 1) { say('SP가 모자라. 단서 제시나 관찰로 쌓자.'); return false; }
    const m = B.team[B.cur], a = m.a, g = C.duel.gate, fr = g ? GATE[g][0] : null;
    if (id === 'ult' && !(ULTS[m.key] && m.en >= 100)) return false;
    B.phase = 'act'; say(''); drawTurn(); a.face(foe.x, foe.z);
    const volley = (who, v, last, delay, reach, strong) => later(delay, () => {   // 한 명의 기술. last가 참이면 이 기술이 맞을 때 안정도를 올린다
      if (!B || B.over) return; const w = who.a; w.face(foe.x, foe.z); if (!w.act('use')) w.play('use'); snd('shot'); fxBasic(who, strong); monMove(who);
      later(.3, () => { if (last) tApply(v, reach, false, strong ? [ELEM[m.key], ELEM[who.key]] : ELEM[who.key]); });
    });
    if (id === 'clue') {
      B.pts = Math.min(PTS_MAX, B.pts + 1); B.score += 1; m.en = Math.min(100, m.en + 20); snd('found'); volley(m, 9, true, .2, false, false); later(1, () => { a.play('idle'); }); turnEnd(1.7);
    } else if (id === 'team') {
      B.pts -= 1; B.score += 2; m.en = Math.min(100, m.en + 25);
      const ps = B.team.filter((x, i) => i !== B.cur && x.hp > 0), pm = ps.find(x => g && ar(x.key) === fr) || ps.find(x => G.friends[x.key]) || ps[0], fixer = (g && (ar(m.key) === fr || (pm && ar(pm.key) === fr)));
      snd(fixer && g === 'light' ? 'light' : fixer && g === 'pond' ? 'water' : fixer && g === 'charge' ? 'zap' : 'fast');
      if (pm) { pm.en = Math.min(100, pm.en + 15); volley(m, 0, false, .2, !!fixer, true); volley(pm, 18, true, .55, !!fixer, true); later(.4, () => FX.link(scr(a, 1.0), scr(pm.a, 1.0))); } else volley(m, 18, true, .2, !!fixer, true);
      if (fixer && g === 'light') later(.7, () => S.lampPower(2.4));
      if (fixer) later(.65, unhide);
      later(1.1, () => { B.team.forEach(x => x.a.play('idle')); }); turnEnd(2.2);
    } else if (id === 'guard') {
      B.guard = true; m.en = Math.min(100, m.en + 12); snd('heal'); if (!a.act('dodge', .72, .08)) a.play('use'); FX.guard(scr(a, 1.0));
      B.team.forEach(x => { if (x.hp > 0) { x.hp = Math.min(100, x.hp + 10); } }); pop(a.x, 1.9, a.z, '방어'); drawTurn(); later(1, () => { a.play('idle'); }); turnEnd(1.6);
    } else if (id === 'look') {
      B.pts = Math.min(PTS_MAX, B.pts + 1); B.score += 1; m.en = Math.min(100, m.en + 25); B.read = 1; snd('fast'); if (!a.act('inspect')) a.play('use');
      FX.scan(scr(foe, .9), '약점 ' + B.weak, ECOL[B.weak]); pop(foe.x, 2.1, foe.z, '읽었다');
      if (B.hide) later(.4, unhide); later(1, () => { a.play('idle'); }); turnEnd(1.7);
    } else if (id === 'ult') {
      const U = ULTS[m.key], red = FX.isReduced(), sc = B.score, pw = Math.min(3, 1 + Math.floor(sc / 3)); m.en = 0; B.score = 0; B.ultBusy = true; hud.classList.add('ult'); snd('ultcharge');   // 추리 점수가 쌓일수록 효과(pw 1~3)와 피해가 커진다
      FX.cut({ img: G.leads[m.key].cutin, name: U.name, sub: U.sub, color: U.color }); FX.dim(.66);
      if (!a.act('skill')) { a.hopH = a.hopH || .55; a.hop = 1; }
      if (!red) { S.look(a.x + 1.5, a.z, false); S.zoom(.6); }   // 카메라가 인물에게 붙는다
      const at = () => scr(foe, .8);
      later(red ? .5 : 1.0, () => { S.look(B.cx - .2, B.cz); S.zoom(.85); FX.ultHit(m.key, at(), pw); });   // 상대 쪽으로 빠지며 깨진 조각과 쏟아지는 줄
      later(red ? .7 : 1.28, () => {
        FX.impactPos(at()); FX.impact(2); freeze = red ? .04 : .15; S.shake(red ? 0 : .5); snd('ultburst'); foe.hop = 1;
        unhide(); tApply((m.key === 'arthur' ? 40 : 36) + sc * 2, true, true, ELEM[m.key]);
        const K = B.over ? .5 : 1, col = m.key === 'arthur' ? '#ffe08a' : '#bff5e8';   // 터지는 별빛(스프라이트): 단계가 높을수록 겹이 늘어난다
        FX.sprFx('star_04', at(), { color: col, size: (520 + pw * 120) * K, dur: .5, spin: .15 }); FX.sprFx('magic_03', at(), { color: col, size: (420 + pw * 110) * K, dur: .6, spin: -.25, minor: true });
        if (!red && !B.over) {
          const target = at();
          FX.sprFx('magic_03', { x: target.x, y: target.y + 45 }, { color: U.color, size: 365, delay: .08, dur: .55, spin: .28, alpha: .78, minor: true });
        }
        if (pw > 1) { FX.sprFx('slash_02', at(), { color: '#ffffff', size: 700 * K, dur: .35, rot: -.5, minor: true }); FX.sprFx('star_08', at(), { color: col, size: 680 * K, delay: .06, dur: .5, spin: .3, minor: true }); }
        if (pw > 2) FX.sprFx('slash_03', at(), { color: col, size: 760 * K, delay: .08, dur: .35, rot: .6, minor: true });
        if (!B.over) { FX.radial(at(), { n: 30, r: 560, dur: .4 }); if (pw > 1) FX.comic(at(), pw > 2 ? '번뜩!' : '딱!', U.color); }   // 마지막 타격이면 방사선과 터짐 글자 없이 진정 연출만(위쪽 순서 막대와 아래 단추를 가리지 않게)
      });
      later(1.75 + .15 * (pw - 1), () => { FX.dim(0); hud.classList.remove('ult'); S.zoom(1); S.look(B.cx - 1.2, B.cz); B.ultBusy = false; });
      turnEnd(2.6 + .15 * (pw - 1));
    }
    return true;
  }
  function foeTurn() {
    if (!B || B.over) return; B.phase = 'foe'; const D = C.duel, n = B.foeN + 1, kind = foeKind(n), g = D.gate; foe.face(lead.x, lead.z); drawTurn(); say(D.name + ' 차례');
    const done = w => later(w, () => { if (!B || B.over) return; B.foeN++; B.guard = false; stepIdx(); say(''); turnBegin(); });
    const fk = FOEFX[D.monster] || 'claw';
    if (B.broken) {   // 균형을 잃은 상대는 이번 행동을 건너뛴다
      B.broken = false; B.tough = B.toughMax; pop(foe.x, 1.8, foe.z, '움직이지 못한다', 'bad'); say(D.name + iga(D.name) + ' 흔들려서 움직이지 못한다'); drawTurn(); done(1.5); return;
    }
    if (kind === 'throw') {
      const al = aliveTeam(), m = al[(Math.random() * al.length) | 0]; snd('foe'); foe.hop = 1;
      FX.foeMark(fk, scr(foe, .9), scr(m.a, .9)); foeFlash(fk, scr(foe, .9), scr(m.a, .9), false); later(.4, () => hurt(m, Math.round((D.hit || 9) * 1.6))); done(1.7);
    } else if (kind === 'hide') {
      B.hide = true; snd('gate'); foe.hop = 1;
      if (g === 'light') { foe.goto(B.cx + 9, B.cz + 2, 6); say('반짝돌이 빛 밖으로 나갔다'); }
      else if (g === 'pond') { foe.goto(sc.battle.pond[0], sc.battle.pond[1], 6); say('가람이가 연못에 들어갔다'); }
      else { foe.play('use'); say('뇌운몽글이 번개를 모으고 있다'); }
      done(1.8);
    } else {
      say('큰 반응!'); el('div', 'bigwarn', hud, '<span>큰 반응</span>'); pops.push({ e: hud.lastChild, t: .9 }); snd('foe'); foe.hop = 1; FX.vignette(.55);
      const cut = g === 'charge' && !B.hide, burst = Math.round((D.burst || 8) * 2.2);
      later(.9, () => {
        FX.vignette(0); if (!B || B.over) return;
        if (cut) { pop(foe.x, 1.8, foe.z, '충전이 끊겼다', 'bad'); return; }
        if (B.hide) { B.hide = false; foe.sink = 0; foe.target = null; S.lampPower(1); foe.goto(B.cx + 2.6, B.cz, 6); }
        snd(g === 'charge' ? 'thunder' : 'boom'); S.shake(FX.isReduced() ? 0 : .4); const fp = scr(foe, .9); FX.radial(fp, { color: '#ffe0e6', n: 30, r: 640, dur: .4 });
        B.team.forEach(m => { if (m.hp > 0) { FX.foeMark(fk, fp, scr(m.a, .9), { big: true }); foeFlash(fk, fp, scr(m.a, .9), true); later(.4, () => hurt(m, burst)); } });
      });
      done(2.7);
    }
  }
  function turnTick(d) {
    if (B && B.ui && foe) { const p = S.project(foe.x, (foe.float || 0) + 2.55, foe.z); B.ui.box.style.left = p.x + 'px'; B.ui.box.style.top = p.y + 'px'; }   // 상대 정보 판은 상대 머리 위를 따라간다
    if (!B || B.over) { FX.update(speed > 1 ? d * .7 : d); return; }
    B.clock += d; B.t += d; FX.update(speed > 1 && !B.ultBusy ? d * .7 : d);
    for (let n = 0; n < 20; n++) {
      const k = B.sched.findIndex(x => x.t <= B.clock); if (k < 0) break;
      const x = B.sched.splice(k, 1)[0]; x.fn();
    }
    B.team.forEach(m => {   // 친구의 몸짓(빙글 돌기, 몸 떨기)
      if (m.spin > 0) { m.spin -= d; m.a.ry += d * 22; if (m.spin <= 0) m.a.ry = m.a.wantRy = PI / 2; }
      if (m.shake > 0) { m.shake -= d; m.a.x += (Math.random() - .5) * .08; m.a.z += (Math.random() - .5) * .08; }
    });
    if (B.hide && C.duel.gate) {
      B.sp -= d;
      if (C.duel.gate === 'pond' && !foe.target) foe.sink = .5;
      if (B.sp <= 0) { B.sp = .6; if (C.duel.gate === 'light') S.burst(foe.x, .95, foe.z, '#ece7ff', 2, .05); }
    }
    if (!foe.target && !B.hide) foe.face(lead.x, lead.z);
    B.team.forEach(m => { if (m.hp <= 0 && !m.a.target) m.a.play('idle'); });
  }

  // ── 결과 ──
  function showResult() {
    mode = 'result'; music(C.scene); const sec = Math.round(B.t), stars = B.turn ? (B.round <= 3 ? 3 : B.round <= 5 ? 2 : 1) : 3;
    hud.innerHTML = ''; FX.clear(); hud.classList.remove('ult');
    const r = el('div', 'rs', hud);
    el('div', 'rs-title', r, '<small>' + C.duel.title + '</small><h1>안정화</h1><p>' + C.duel.name + iga(C.duel.name) + ' 마음을 풀었다</p><div class="stars">' + [1, 2, 3].map(i => '<i class="' + (i <= stars ? 'on' : '') + '"></i>').join('') + '</div>');
    const team = el('div', 'rs-team', r);
    (B.team || []).forEach(m => el('div', 'rc' + (m.hp <= 0 ? ' out' : ''), team, '<div class="rcp" style="background-image:url(' + (G.leads[m.key] ? G.leads[m.key].img : G.friends[m.key].img) + ')"></div><b>' + nameOf(m.key) + '</b><div class="hbar"><i style="width:' + m.hp + '%"></i></div><small>집중 ' + m.hp + '</small>'));
    el('div', 'rs-info', r, '<b>걸린 ' + (B.turn ? '차례' : '시간') + '</b><div>' + (B.turn ? B.round + '라운드' : Math.floor(sec / 60) + '분 ' + pad(sec % 60) + '초') + '</div><b>' + (C.kind === 'find' ? '찾은 조각' : '찾은 단서') + '</b><div class="chips">' + (notes.length ? notes : C.clues).map(n => '<span>' + n.label + '</span>').join('') + '</div>');
    const go = el('button', 'rs-go', r, '<b>다음</b><small>' + (C.kind === 'lock' ? '문 앞으로' : C.kind === 'find' ? '상자 앞으로' : C.kind === 'fix' ? '시계탑으로' : '추리하러') + '</small>'); go.onclick = C.kind === 'find' ? startFinale : C.kind === 'lock' ? startLock : C.kind === 'fix' ? startEnding : startDeduce; go.focus();
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
    GB.openPop({ title: '사건 해결', sub: '의뢰 ' + pad(C.no), w: 900, body: '<div class="stamp"><span>해결</span></div><p class="big">' + C.title + '</p><p>별빛이 한 칸 돌아왔습니다 (' + sv.cleared.length + ' / ' + total + ')</p>' + (F ? '<p>새 친구 <b>' + F.name + '</b>' + iga(F.name) + ' 함께합니다.</p>' : ''), buttons: [[all ? '다음' : '도시로', left, 1]], esc: left });
  }

  function key(e) {
    if (mode === 'world') { window.World.key(e); return; }
    if (e.key === 'Escape') { if (mode === 'team') GB.enterLobby(); else pause(); }
    else if (mode === 'battle' && B && B.turn) { const i = '12345'.indexOf(e.key); if (i >= 0 && i < 4) turnAct(ACTS[i].id); else if (i === 4) turnAct('ult'); }
    else if (mode === 'battle' && B && B.cards && e.key >= '1' && e.key <= String(B.cards.length)) useCard(B.cards[Number(e.key) - 1].c);
  }

  // 화면 확인용: ?go=team, probe, battle, result, deduce, finale, lock, ending  (&case=2 둘째 사건, &party=malangbul 함께 갈 친구, &auto=1 자동, &tut=0 안내 없이)
  const q = new URLSearchParams(location.search), go = q.get('go'), dbgCase = G.cases[(Number(q.get('case')) || 1) - 1];
  if (q.get('auto')) auto = true; skipTut = q.get('tut') === '0' || (!!go && q.get('tut') !== '1');   // 확인용 주소에서는 &tut=1을 붙여야 안내가 나온다
  if (q.get('wild')) { const sw = GB.save.world = GB.save.world || {}; sw.friends = sw.friends || {}; q.get('wild').split(',').filter(Boolean).forEach(k => { sw.friends[k] = 1; }); }   // 확인용: &wild=w_puddle,w_pebble 도감에 오른 야생 친구
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
  if (go === 'world') {   // &at=x,z 서 있을 자리, &yaw=각도(도), &warp=초, &talk=1 가까운 주민에게 말 걸기, &menu=map|quest|bag|menu
    S.init($('gl'));
    S.load().then(() => {
      loaded = true; const at = q.get('at'); GB.save.lead = q.get('lead') || GB.save.lead;
      (q.get('cleared') || '').split(',').filter(Boolean).forEach(id => { if (GB.save.cleared.indexOf(id) < 0) GB.save.cleared.push(id); });   // &cleared=clock,depot: 그 사건을 해결한 것으로 보고 시작
      enterWorld({ at: at ? at.split(',').map(Number) : null, yaw: Number(q.get('yaw') || 0) * PI / 180, ry: Number(q.get('ry') || 0) * PI / 180 });
      const dn = q.get('door'); if (dn) { const dd = window.World.doors().find(x => x.id === dn); if (dd) { if (dd.z > 200) window.World.tele(dd.x, dd.z - 1.2); else window.World.tele(dd.x * .93, dd.z * .93); } }   // 확인용: &door=office|sweets|office_out|sweets_out 그 문 앞에 선다(&talk=1이면 눌러 본다)
      if (warp) S.warp(warp);
      const m = q.get('menu'); if (m) setTimeout(() => ({ map: window.World.openMap, quest: window.World.openMissions, bag: window.World.openBag, menu: window.World.openMenu, friends: window.World.openFriends })[m](), 50);
      if (q.get('talk')) { window.World.interact(); }
    });
  }
  if (go === 'probe' || go === 'battle' || go === 'result' || go === 'finale' || go === 'lock' || go === 'ending') {
    C = dbgCase; S.init($('gl'));
    S.load().then(() => {
      if (go === 'probe') {
        if (q.get('from')) { const f = q.get('from').split(',').map(Number); wpos = { x: f[0], z: f[1], ry: 0 }; }   // &from=x,z: 별빛도시에서 서 있던 자리
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
      else { startBattle(); if (warp) S.warp(warp); if (q.get('card')) { B.cost = 10; useCard(G.cards.find(c => c.id === q.get('card'))); S.warp(Number(q.get('aft') || .45)); } if (go === 'result') { B.t = 34; B.stab = 100; B.over = true; showResult(); }
        if (q.get('gstep') && B && B.turn) { for (let i = 0; i < Number(q.get('gstep')); i++) { const d = document.querySelector('.tdim'); if (d) d.click(); } }   // &gstep=N: 안내를 N번 넘긴 화면(확인용, &tut=1과 함께)
        if (q.get('stab') && B && B.turn) { B.stab = Number(q.get('stab')); drawTurn(); }   // &stab=N: 안정도(확인용)
        if (q.get('score') && B && B.turn) { B.score = Number(q.get('score')); drawTurn(); }   // &score=N: 추리 점수(확인용)
        if (q.get('en') && B && B.turn) { B.team.forEach(m => { m.en = Number(q.get('en')); }); drawTurn(); }
        if (q.get('hp') && B && B.turn) { B.team.forEach(m => { m.hp = Number(q.get('hp')); }); drawTurn(); }
        if (q.get('acts') && B && B.turn) {   // &acts=clue,team,ult: 턴제 훈련에서 그 행동을 차례로 하고 &aft=초 만큼 더 흘려보낸다(확인용)
          q.get('acts').split(',').forEach(id => { for (let i = 0; i < 80 && B.phase !== 'pick' && !B.over; i++) S.warp(.3); if (id === 'ult') B.team[B.cur].en = 100; turnAct(id); });
          S.warp(Number(q.get('aft') || .6));
        } }
    });
  }
  return { preload: preload, goWorld: goWorld, enterCase: enterCase, friendsHave: friendsHave, walk: (x, z) => { if (lead) lead.goto(x, z, 4.2); }, inspect: i => inspect(marks[i]), openTeam: openTeam, openNote: openNote, leave: leave, key: key, state: () => ({ mode: mode, paused: paused, notes: notes.length, lead: lead && [lead.x, lead.z], seen: marks.map(m => m.seen), B: B && foe && { turn: !!B.turn, pts: B.pts, ult: B.ult, round: B.round, phase: B.phase, hide: B.hide, foeN: B.foeN, cur: B.cur, stab: B.stab, cost: B.cost, t: B.t, over: B.over, lit: B.lit, hp: B.team.map(m => m.hp), pos: B.team.map(m => [m.a.x, m.a.z]).concat([[foe.x, foe.z]]) } }), marks: () => marks };
})();
