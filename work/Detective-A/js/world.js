'use strict';
/* 별빛도시 걷기: 아서와 에리가 도시를 직접 걸어 다닌다(WASD, 마우스로 시점, 바닥을 눌러도 걷는다).
   구역 이름표, 작은 지도, 임무 표시, 파티, 말 걸 수 있는 주민, 별가루, 사건 장소 들어가기, 열차 지도·임무·소지품 화면을 맡는다.
   3D 도시는 js/star3d.js, 사건 현장 조사와 턴제 훈련은 js/field.js, 주민·구역·임무 자료는 js/data.js의 world. */
window.World = (function () {
  const PI = Math.PI, GB = window.GB, G = window.GAME, Wd = G.world, el = GB.el, $ = id => document.getElementById(id), snd = GB.snd;
  let wilds = [], X = null, S = null, hud = null, sc = null, on = false, yaw = 0, zoom = 1, keys = {}, trail = [], npcs = [], dusts = [], gates = [], doors = [], tags = [], near = null, goal = null, zone = '', mt = 0, miniT = 0, ui = {}, drag = null, bannerT = 0, helpT = 0;
  let camPull = 1;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), pad = n => String(n).padStart(2, '0');
  const sv = () => { const s = GB.save; if (!s.world) s.world = {}; const w = s.world; w.dust = w.dust || 0; w.got = w.got || {}; w.talked = w.talked || {}; w.quests = w.quests || {}; w.seen = w.seen || {}; w.visited = w.visited || {}; w.friends = w.friends || {}; w.track = w.track || ''; return w; };
  const nameOf = n => (G.friends[n] || G.leads[n] || {}).name || (n === 'huru' ? G.names.huru : n);
  const iga = s => ((s.charCodeAt(s.length - 1) - 0xAC00) % 28 ? '이' : '가');
  const dist = (a, x, z) => Math.hypot(a.x - x, a.z - z);
  const modal = () => $('pop').classList.contains('on') || $('story').classList.contains('on') || $('card').classList.contains('on');
  const caseOf = id => G.cases.find(c => c.id === id);
  const cleared = c => GB.save.cleared.indexOf(c.id) >= 0;
  const zoneOpen = id => { const Z = Wd.zones[id]; return !!Z && (!!Z.open || (!!Z.after && cleared(caseOf(Z.after)))); };
  const applyOpen = () => { if (sc && sc.setOpen) sc.setOpen({ E: zoneOpen('station'), W: zoneOpen('market'), N: zoneOpen('tower') }); };
  const open = c => !cleared(c) && GB.nextCase() === c;   // 지금 풀 수 있는 사건(앞 사건을 해결한 다음 것)

  // ── 키 입력: 이동은 눌린 키를 읽고, 한 번 누르는 동작(말 걸기·메뉴)은 field.js가 key()로 넘겨 준다 ──
  addEventListener('keydown', e => { keys[e.code] = 1; });
  addEventListener('keyup', e => { delete keys[e.code]; });
  addEventListener('blur', () => { keys = {}; });
  const k = (...c) => c.some(x => keys[x]);

  function start(ctx) {
    X = ctx; S = ctx.S; hud = ctx.hud; sc = ctx.sc; on = true; keys = {}; trail = []; near = null; goal = null; zone = ''; helpT = 0;
    const w = sv(); if (!ctx.keepYaw) yaw = ctx.yaw != null ? ctx.yaw : 0;
    S.cam.yaw = yaw; zoom = 1; S.zoom(1, true); camPull = 1; S.cam.pull = 1;
    applyOpen(); buildNpcs(); buildWild(); buildDust(); buildGates(); buildHud(); S.look(X.lead.x, X.lead.z, true);
    drawParty(); drawTrack(); w.visited.plaza = 1; GB.store();
  }
  function stop() { on = false; if (S && S.cam) S.cam.pull = 1; keys = {}; wilds = []; npcs = []; dusts = []; gates = []; doors = []; tags = []; near = null; goal = null; }
  const here = () => ({ x: X.lead.x, z: X.lead.z });

  // ── 주민, 별가루, 사건 장소 ──
  function tint(a, color) { a.root.traverse(m => { if (m.isMesh && m.material) { m.material = m.material.clone(); if (m.material.color) m.material.color.multiply(new window.THREE.Color(color)); } }); }
  function buildNpcs() {
    npcs = []; (Wd.npcs || []).forEach(d => {
      if (d.when && !d.when(GB.save)) return;
      const a = S.makeActor(d.model, (X.size[d.model] || 1) * (d.size || 1.3)); a.place(d.x, d.z, d.ry || 0); a.play('idle'); a.speed = 1.6; if (d.tint) tint(a, d.tint);
      G.names[d.id] = d.name; npcs.push({ def: d, a: a, x: d.x, z: d.z, r: 2.5, home: [d.x, d.z], t: Math.random() * 6, kind: 'npc' });
    });
  }
  function buildWild() {
    const w = sv(); wilds = [];
    (Wd.wild || []).forEach(d => {
      const a = S.makeActor(d.model, (X.size[d.model] || 1) * (d.size || .7)); a.place(d.x, d.z, Math.random() * 6); a.play('idle'); a.speed = 1.1; if (d.tint) tint(a, d.tint);
      G.names[d.id] = d.name; wilds.push({ def: d, a: a, x: d.x, z: d.z, r: 2.3, home: [d.x, d.z], t: Math.random() * 4, kind: 'wild', got: !!w.friends[d.id] });
    });
  }
  function buildDust() {
    const w = sv(); dusts = []; (Wd.dust || []).forEach((d, i) => { if (w.got[d.id]) return; const f = S.sparkle(d.x, d.z); f.show(true); dusts.push({ d: d, f: f, x: d.x, z: d.z }); });
  }
  function buildGates() {
    gates = []; G.cases.forEach(c => { const s = c.site; if (!s || s.npc) return; if (!sc.zonesHere || sc.zonesHere.indexOf(s.zone) >= 0) gates.push({ c: c, x: s.x, z: s.z, r: s.r || 2.8, kind: 'gate', ring: null }); });
    syncRings();
    doors = (sc.doors || []).map(d => Object.assign({ kind: 'door' }, d));
  }
  function syncRings() { gates.forEach(g => { if (g.ring) { g.ring.remove(); g.ring = null; } if (open(g.c)) g.ring = S.ring(g.x, g.z, '#ffd92e'); }); }

  // ── 화면 ──
  function buildHud() {
    hud.innerHTML = ''; ui = {}; tags = [];
    ui.mini = el('div', 'wmini', hud, '<canvas width="240" height="240"></canvas><i class="wn">N</i>'); ui.cv = ui.mini.querySelector('canvas'); ui.cx = ui.cv.getContext('2d');
    ui.zone = el('div', 'wzone', hud, '<small></small><b></b>');
    ui.track = el('div', 'wtrack', hud);
    ui.menu = el('button', 'wmenu', hud, '<i></i><span>메뉴</span><em class="kb-only">Esc</em>'); ui.menu.onclick = openMenu;
    ui.dust = el('div', 'wdust', hud, '<i></i><b></b>');
    ui.party = el('div', 'wparty', hud);
    ui.help = el('div', 'whelp kb-only', hud, Wd.help);
    ui.prompt = el('div', 'wprompt', hud, '<i class="kb-only">Space</i><span></span>'); ui.prompt.style.display = 'none'; ui.prompt.addEventListener('click', () => interact());   // 폰에서는 이 안내를 눌러도 '행동'과 같다
    ui.banner = el('div', 'wban', hud, '<small></small><b></b>');
    el('button', 'wmapb', hud, '<span>열차 지도</span><em class="kb-only">M</em>').onclick = openMap;
    npcs.forEach(n => { const t = el('div', 'wtag', hud, '<b>' + n.def.name + '</b><small>' + (n.def.role || '') + '</small><i class="q">!</i>'); tags.push({ e: t, o: n, h: (n.def.size || 1.3) * (X.size[n.def.model] || 1) + .5 }); });
    wilds.forEach(n => { const t = el('div', 'wtag wild', hud, '<b>' + n.def.name + '</b><small>야생 친구</small><i class="q">?</i>'); tags.push({ e: t, o: n, h: (n.def.size || .7) * (X.size[n.def.model] || 1) + .5 }); });
    gates.forEach(g => { const t = el('div', 'wtag gate', hud, '<b>' + (g.c.site.label || g.c.title) + '</b><small>' + g.c.chapter.name + ' · 의뢰 ' + pad(g.c.no) + '</small><i class="q">◆</i>'); tags.push({ e: t, o: g, h: 2.2 }); });
    doors.forEach(d => { const t = el('div', 'wtag gate door', hud, '<b>' + d.label + '</b><small>' + (d.sub || (d.out ? '나간다' : '살펴본다')) + '</small><i class="q">' + (d.out ? '↩' : d.act ? '·' : '⌂') + '</i>'); tags.push({ e: t, o: d, h: d.act || d.out ? 1.6 : 1.5 }); });
    ui.fade = el('div', 'wfade', hud);
    ui.hud = hud; hud.onmousedown = e => { if (e.target === hud) drag = { x: e.clientX, y: e.clientY, moved: 0, btn: e.button }; };
    hud.onmousemove = e => { if (!drag) return; const dx = e.clientX - drag.x; drag.x = e.clientX; drag.moved += Math.abs(dx); if (drag.moved > 6) yaw -= dx * .006; };
    hud.onmouseup = e => { const d = drag; drag = null; if (!d || d.moved > 6 || e.target !== hud || d.btn !== 0) return; const p = S.pick(e.clientX, e.clientY); if (p) { goal = { x: p.x, z: p.z }; S.burst(p.x, .1, p.z, '#ffd92e', 4, .05); } };
    hud.onwheel = e => { zoom = clamp(zoom + e.deltaY * .001, .65, 1.45); S.zoom(zoom); };
    drawDust();
  }
  function drawDust() { if (ui.dust) ui.dust.querySelector('b').textContent = Wd.dustName + ' ' + sv().dust; }
  function drawParty() {
    const sv0 = GB.save, lk = sv0.lead, mk = lk === 'arthur' ? 'eri' : 'arthur', fr = X.party(), list = [lk, mk].concat(fr);
    ui.party.innerHTML = ''; list.forEach((k, i) => {
      const b = el('button', 'wp' + (i === 0 ? ' wlead' : ''), ui.party, '<i style="background-image:url(' + GB.faceUrl(k) + ')"></i><span>' + nameOf(k) + '</span><em class="kb-only">' + (i < 2 ? i + 1 : '') + '</em>');
      if (i === 1) b.onclick = swap;
    });
  }
  function swap() { X.swapLead(); drawParty(); snd('next'); }
  function drawTrack() {
    const c = GB.nextCase(), w = sv(), q = (Wd.quests || []).find(x => { const s = w.quests[x.id] || 0; return s >= 1 && s < x.steps.length; });
    let h = '<h4>임무</h4>';
    if (c) h += '<div class="wtm"><small>' + c.chapter.name + ' · 의뢰 ' + pad(c.no) + '</small><b>' + c.title + '</b><p>' + trackLine(c) + '</p></div>'; else h += '<div class="wtm"><b>모든 의뢰를 마쳤다</b><p>도시를 더 둘러보거나, ' + (window.DeviceHint && window.DeviceHint.touch ? '메뉴 단추' : '메뉴(Esc)') + '에서 처음부터 다시 할 수 있다</p></div>';
    if (q) h += '<div class="wtm sub"><small>의뢰</small><b>' + q.title + '</b><p>' + q.steps[w.quests[q.id]].hint + '</p></div>';
    ui.track.innerHTML = h;
  }
  function trackLine(c) { const s = c.site, z = Wd.zones[s.zone]; return z && !zoneOpen(s.zone) ? '아직 길이 열리지 않았다' : (z ? z.name + ' · ' : '') + c.goal; }
  function zoneMusic(z) { const Z = Wd.zones[z]; GB.music(Z && Z.interior ? 'office' : 'street'); }   // 건물 안은 사무소 곡, 밖은 거리 곡
  function banner(z) { const Z = Wd.zones[z]; if (!Z) return; ui.banner.querySelector('small').textContent = Z.sub; ui.banner.querySelector('b').textContent = Z.name; ui.banner.classList.remove('go'); void ui.banner.offsetWidth; ui.banner.classList.add('go'); bannerT = 3.2; ui.zone.querySelector('small').textContent = '현재 위치'; ui.zone.querySelector('b').textContent = Z.name; }

  // ── 움직임 ──
  function sweep(x, z, dx, dz, avoidPeople) {
    const clears = (px, pz) => !sc.blocks.some(b => Math.hypot(px - b.x, pz - b.z) < b.r + .42)
      && (!avoidPeople || !npcs.some(n => Math.hypot(px - n.a.x, pz - n.a.z) < .75));
    const allowed = (px, pz) => sc.walk(px, pz) && clears(px, pz);
    // 이전 저장 위치나 입장 위치가 이미 겹친 경우에는 바깥쪽으로 빠져나올 수 있다.
    if (!clears(x, z)) {
      const overlaps = (px, pz) => sc.blocks.reduce((sum, b) => sum + Math.max(0, b.r + .42 - Math.hypot(px - b.x, pz - b.z)), 0)
        + (avoidPeople ? npcs.reduce((sum, n) => sum + Math.max(0, .75 - Math.hypot(px - n.a.x, pz - n.a.z)), 0) : 0);
      if (sc.walk(x + dx, z + dz) && overlaps(x + dx, z + dz) < overlaps(x, z)) return [x + dx, z + dz];
    }
    const increments = Math.max(1, Math.ceil(Math.hypot(dx, dz) / .09));
    const stepX = dx / increments, stepZ = dz / increments;
    for (let i = 0; i < increments; i++) {
      if (allowed(x + stepX, z + stepZ)) { x += stepX; z += stepZ; continue; }
      const xFirst = Math.abs(stepX) >= Math.abs(stepZ);
      if (xFirst) {
        if (stepX && allowed(x + stepX, z)) x += stepX;
        if (stepZ && allowed(x, z + stepZ)) z += stepZ;
      } else {
        if (stepZ && allowed(x, z + stepZ)) z += stepZ;
        if (stepX && allowed(x + stepX, z)) x += stepX;
      }
    }
    return [x, z];
  }
  // 걷는다. 이동 중이면 참. 사건 조사 때(field.js)도 같은 함수로 걷는다.
  function drive(a, dt, scene) {
    if (scene) sc = scene;
    const ix = (k('KeyD', 'ArrowRight') ? 1 : 0) - (k('KeyA', 'ArrowLeft') ? 1 : 0);
    const iz = (k('KeyS', 'ArrowDown') ? 1 : 0) - (k('KeyW', 'ArrowUp') ? 1 : 0);
    const cs = Math.cos(yaw), sn = Math.sin(yaw);
    let dx = 0, dz = 0;
    if (ix || iz) { goal = null; dx = ix * cs + iz * sn; dz = -ix * sn + iz * cs; }
    else if (goal) {
      dx = goal.x - a.x; dz = goal.z - a.z;
      if (Math.hypot(dx, dz) < .22) { goal = null; dx = dz = 0; }
    }
    const length = Math.hypot(dx, dz), run = k('ShiftLeft', 'ShiftRight') && !!a.clips?.run;
    if (!length) { a.play('idle'); stepDistance = 0; return false; }
    const stride = goal ? Math.min(length, 2.55 * dt) : (run ? 5.65 : 2.55) * dt;
    const [nx, nz] = sweep(a.x, a.z, dx / length * stride, dz / length * stride, true);
    const mx = nx - a.x, mz = nz - a.z, moved = Math.hypot(mx, mz);
    if (goal && moved < stride * .25) goal = null;
    a.x = nx; a.z = nz; a.target = null;
    if (moved <= .001) { a.play('idle'); stepDistance = 0; return false; }
    a.wantRy = Math.atan2(mx, mz); a.play(run ? 'run' : 'walk');
    stepDistance += moved;
    const step = run ? 1.18 : .69;
    if (stepDistance >= step) { stepDistance %= step; snd('step'); }
    return true;
  }
  let stepDistance = 0;
  function followParty(dt) {
    const L = X.lead, last = trail[trail.length - 1];
    if (!last || Math.hypot(L.x - last.x, L.z - last.z) > .45) { trail.push({ x: L.x, z: L.z }); if (trail.length > 80) trail.shift(); }
    [X.mate, X.huru].concat(X.pals).forEach((a, i) => {
      if (!a || a.hold) return; const far = dist(a, L.x, L.z);
      if (far > 22) { const ang = yaw + PI + (i - 1) * .6; a.place(L.x + Math.sin(ang) * 1.6, L.z + Math.cos(ang) * 1.6, L.ry); trail.length = 0; return; }
      a.groundPath = (x, z, dx, dz) => sweep(x, z, dx, dz, false);
      const p = trail[trail.length - 1 - (i + 1) * 3] || { x: L.x + Math.sin(yaw + PI + i) * 1.4, z: L.z + Math.cos(yaw + PI + i) * 1.4 }, d = dist(a, p.x, p.z);
      if (d > .55) { a.speed = 3.4 + d * 1.1; a.target = { x: p.x, z: p.z }; a.play('walk'); } else if (!a.target) { a.play('idle'); a.wantRy = L.ry; }
    });
  }

  // ── 매 프레임(field.js의 tick이 부른다) ──
  function tick(dt) {
    if (!on) return 1; mt += dt;
    const L = X.lead, still = modal() || X.busy();
    if (still) { goal = null; L.play('idle'); }
    else {
      if (k('KeyQ')) yaw += dt * 1.9; if (k('KeyE')) yaw -= dt * 1.9;
      drive(L, dt);
    }
    {   // 카메라가 높은 건물 안으로 들어가 화면이 벽에 가려지지 않게, 뒤가 막히면 카메라를 당긴다
      const cb = (S.cam.back || 0) * zoom, sd = (S.cam.side || 0) * zoom, sn = Math.sin(yaw), cs = Math.cos(yaw); let pull = 1;
      const inside = t => { const cx = L.x + (sd * cs + cb * sn) * t, cz = L.z + (-sd * sn + cb * cs) * t; return sc.blocks.some(b => b.tall && Math.hypot(cx - b.x, cz - b.z) < b.r); };
      for (let t = .12; t <= 1.001; t += .04) if (inside(t)) { pull = Math.max(.22, t - .1); break; }
      camPull += (pull - camPull) * Math.min(1, dt * (pull < camPull ? 12 : 4)); S.cam.pull = camPull;
    }
    S.cam.yaw = yaw; S.look(L.x, L.z); followParty(dt);
    npcs.forEach(n => { const d = dist(n.a, L.x, L.z); if (d < 6) n.a.face(L.x, L.z); else if (!n.a.target) n.a.wantRy = n.def.ry || 0; });
    wilds.forEach(n => { n.t -= dt; if (n.t <= 0) { n.t = 3 + Math.random() * 4; if (!n.got || Math.random() < .5) { const a = Math.random() * 6.28, r = Math.random() * 2.2; n.a.target = { x: n.home[0] + Math.cos(a) * r, z: n.home[1] + Math.sin(a) * r }; n.a.play('walk'); } } n.x = n.a.x; n.z = n.a.z; if (dist(n.a, L.x, L.z) < 3.4 && !n.a.target) n.a.face(L.x, L.z); });
    const z = sc.zoneAt(L.x, L.z); if (z && z !== zone) { zone = z; banner(z); sv().visited[z] = 1; zoneMusic(z); }
    if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) ui.banner.classList.remove('go'); }
    // 별가루 줍기
    for (let i = dusts.length - 1; i >= 0; i--) { const d = dusts[i]; if (dist(L, d.x, d.z) < 1.25) { d.f.remove(); dusts.splice(i, 1); const w = sv(); w.got[d.d.id] = 1; w.dust++; GB.store(); drawDust(); GB.toast(Wd.dustName + ' +1'); snd('found'); } }
    // 눌러서 할 수 있는 것: 가장 가까운 주민이나 사건 장소
    near = null; let best = 99; npcs.concat(wilds, gates, doors).forEach(o => { const d = dist(L, o.x, o.z); if (d < o.r && d < best) { best = d; near = o; } });
    if (still || !near) ui.prompt.style.display = 'none'; else {
      const p = S.project(near.x, (near.def ? (near.def.size || 1.3) * (X.size[near.def.model] || 1) : 1.6) + .9, near.z); ui.prompt.style.display = ''; ui.prompt.style.left = p.x + 'px'; ui.prompt.style.top = p.y + 'px';
      ui.prompt.querySelector('span').textContent = promptText(near);
    }
    if (near && near.kind === "door" && !near.out && !near.act && near.z < 200 && !still) { const ty = Math.atan2(-near.x, -near.z); let dy = ty - yaw; while (dy > PI) dy -= 2 * PI; while (dy < -PI) dy += 2 * PI; yaw += dy * Math.min(1, dt * 1.6); }   // 건물 문 앞에서는 카메라가 광장 쪽으로 돌아 문이 건물에 가리지 않게 한다
    tags.forEach(t => { const o = t.o, d = dist(L, o.x, o.z), p = S.project(o.x, t.h, o.z), show = d < 24 && p.x > 60 && p.x < 1880 && p.y > 150 && p.y < 1000 && !(p.x < 520 && p.y < 520) && !(p.x > 1600 && p.y < 520) && !still && o !== near; t.e.style.display = show ? '' : 'none'; if (show) { t.e.style.left = p.x + 'px'; t.e.style.top = p.y + 'px'; t.e.style.opacity = clamp(1.3 - d / 24, .25, 1); t.e.classList.toggle('lock', o.kind === 'gate' && !open(o.c)); t.e.classList.toggle('inner', o.kind === 'door'); t.e.querySelector('.q').style.display = hasMark(o) ? '' : 'none'; } });
    miniT -= dt; if (miniT <= 0) { miniT = .08; drawMini(); }
    helpT += dt; ui.help.style.opacity = helpT > 14 ? 0 : 1;
    return 1;
  }
  function hasMark(o) { if (o.kind === 'door') return !o.out && !o.act && !sv().seen['door_' + o.id]; if (o.kind === 'gate') return open(o.c) || false; if (o.kind === 'wild') return !sv().friends[o.def.id]; const d = o.def; if (d.case) return open(caseOf(d.case)); return !!questStep(o) || !!(d.quest && (sv().quests[d.quest] || 0) === 0); }
  function promptText(o) { if (o.kind === 'door') return (o.out ? '나간다 · ' : o.act ? '살펴본다 · ' : '들어간다 · ') + o.label; if (o.kind === 'gate') return '들어간다 · ' + (o.c.site.label || o.c.title); const d = o.def; if (o.kind === 'wild') return (sv().friends[d.id] ? '쓰다듬기' : '살펴보기') + ' · ' + d.name; return (d.verb || '말 걸기') + ' · ' + d.name; }

  // ── 작은 지도 ──
  function drawMini() {
    const q = ui.cx, W = 240, L = X.lead, cs = Math.cos(yaw), sn = Math.sin(yaw), s = 2.1;
    q.clearRect(0, 0, W, W); q.save(); q.beginPath(); q.arc(W / 2, W / 2, W / 2 - 3, 0, PI * 2); q.clip(); q.fillStyle = '#0c1233'; q.fillRect(0, 0, W, W);
    q.transform(s * cs, s * sn, -s * sn, s * cs, W / 2, W / 2); q.translate(-L.x, -L.z);
    q.fillStyle = '#1b2660'; const H = sc.ROAD_HALF, lim = id => zoneOpen(id) ? sc.ROAD_END - 3 : 36; q.fillRect(-lim('market'), -H, lim('market') + lim('station'), H * 2); q.fillRect(-H, -lim('tower'), H * 2, lim('tower') + sc.ROAD_END - 3);
    q.fillStyle = '#26337f'; q.beginPath(); q.arc(0, 0, sc.R_PLAZA, 0, PI * 2); q.fill(); q.strokeStyle = '#7f9cff'; q.lineWidth = .8; q.stroke();
    ['station', 'market', 'tower'].forEach(id => { if (!zoneOpen(id)) return; const c = sc.zoneCenters[id]; q.fillStyle = '#1f2a70'; q.beginPath(); q.arc(c[0], c[1], 24, 0, PI * 2); q.fill(); });
    q.fillStyle = '#4a5598'; sc.blocks.forEach(b => { if (b.r > 1.2) { q.beginPath(); q.arc(b.x, b.z, b.r, 0, PI * 2); q.fill(); } });
    q.fillStyle = '#ffd95a'; dusts.forEach(d => { q.fillRect(d.x - .7, d.z - .7, 1.4, 1.4); });
    npcs.forEach(n => { q.fillStyle = n.def.case && open(caseOf(n.def.case)) ? '#ffd95a' : '#9fe3d8'; q.beginPath(); q.arc(n.a.x, n.a.z, 1.1, 0, PI * 2); q.fill(); });
    wilds.forEach(n => { q.fillStyle = n.got ? '#6a76ad' : '#ff9fc4'; q.beginPath(); q.arc(n.a.x, n.a.z, .9, 0, PI * 2); q.fill(); });
    gates.forEach(g => { q.fillStyle = open(g.c) ? '#ffd95a' : '#7080b8'; q.save(); q.translate(g.x, g.z); q.rotate(PI / 4); q.fillRect(-1.6, -1.6, 3.2, 3.2); q.restore(); });
    q.restore();
    q.save(); q.translate(W / 2, W / 2); q.rotate(-L.ry + yaw + PI); q.fillStyle = '#ffffff'; q.strokeStyle = '#14213f'; q.lineWidth = 2; q.beginPath(); q.moveTo(0, -11); q.lineTo(8, 9); q.lineTo(0, 4); q.lineTo(-8, 9); q.closePath(); q.fill(); q.stroke(); q.restore();
    const nn = ui.mini.querySelector('.wn'), a = yaw; nn.style.transform = 'translate(' + (Math.sin(a) * 100).toFixed(0) + 'px,' + (-Math.cos(a) * 100).toFixed(0) + 'px)';
  }

  // ── 말 걸기 ──
  function questStep(o) { const w = sv(); return (Wd.quests || []).find(q => { const st = w.quests[q.id] || 0; return st >= 1 && st < q.steps.length && q.steps[st].npc === o.def.id; }); }
  function interact() {
    if (!near || modal() || X.busy()) return; const o = near;
    if (o.kind === 'gate') return enter(o.c);
    if (o.kind === 'door') return useDoor(o);
    if (o.kind === 'wild') return meetWild(o);
    const d = o.def, w = sv(); o.a.face(X.lead.x, X.lead.z);
    if (d.case) { const c = caseOf(d.case); if (cleared(c)) return say(d.after || d.lines); if (!open(c)) return say(d.lines); return enter(c); }
    const q1 = questStep(o);
    if (q1) {
      const st = w.quests[q1.id], P = q1.steps[st];
      if (P.dust && w.dust < P.dust) return say(P.wait);
      if (P.dust) w.dust -= P.dust;
      w.quests[q1.id] = st + 1; const fin = st + 1 >= q1.steps.length; if (fin) w.dust += q1.reward; GB.store();
      return say(P.lines, () => { if (fin) { GB.toast(Wd.dustName + ' +' + q1.reward + ' · ' + q1.title + ' 완료'); snd('stamp'); } else { GB.toast('의뢰가 이어진다 · ' + q1.title); snd('found'); } drawDust(); drawTrack(); });
    }
    const q0 = d.quest && (Wd.quests || []).find(x => x.id === d.quest);
    if (q0 && !(w.quests[q0.id] || 0)) { w.quests[q0.id] = 1; GB.store(); return say(q0.steps[0].lines, () => { GB.toast('의뢰를 받았다 · ' + q0.title); snd('found'); drawTrack(); }); }
    const n = (w.talked[d.id] = (w.talked[d.id] || 0) + 1); GB.store(); say(d.lines.length && Array.isArray(d.lines[0]) ? d.lines[(n - 1) % d.lines.length] : d.lines);
  }
  // 건물 문: 화면이 잠깐 어두워지는 사이에 안(또는 밖)으로 옮겨 선다. 안쪽 물건은 눌러서 수첩이나 열차 지도를 연다
  function useDoor(o) {
    if (o.act) { snd('open'); if (o.act === 'note') X.openNote(); else openMap(); return; }
    const to = o.to, L = X.lead; X.busy(true); snd(o.out ? 'close' : 'open');
    ui.fade.classList.remove('go'); void ui.fade.offsetWidth; ui.fade.classList.add('go');
    setTimeout(() => {
      L.place(to[0], to[1], to[2]); X.mate.place(to[0] + 1.1, to[1] + (o.out ? 1.2 : -.8), to[2]); X.huru.place(to[0] - 1, to[1] + (o.out ? 1.2 : -.8), to[2]);
      X.pals.forEach((a, i) => a.place(to[0] + 1.6 + i, to[1] + (o.out ? 1.8 : -1.2), to[2])); trail.length = 0; goal = null; S.look(L.x, L.z, true); const z = sc.zoneAt(L.x, L.z); if (z) { zone = z; banner(z); sv().visited[z] = 1; zoneMusic(z); }
      X.busy(false);
      const w = sv(); if (!o.out && !w.seen['door_' + o.id]) { w.seen['door_' + o.id] = 1; GB.store(); const f = (Wd.doorTalk || {})[o.id]; if (f) say(f.lines, () => { if (f.dust) { w.dust += f.dust; GB.store(); drawDust(); GB.toast(Wd.dustName + ' +' + f.dust); snd('found'); } }); }
    }, 320);
  }
  // 야생 친구: 몸짓에서 성격을 읽어 어떻게 대할지 고른다
  function meetWild(o) {
    const d = o.def, w = sv(); o.a.face(X.lead.x, X.lead.z);
    if (w.friends[d.id]) { o.a.hop = 1; o.a.hopH = .35; return say([{ who: d.id, text: d.after }]); }
    X.busy(true); const back = () => X.busy(false);
    GB.openPop({ title: d.name, sub: '야생 친구', w: 1180, body: '<p>' + d.cue + '</p><p class="quote">어떻게 할까?</p>',
      buttons: d.choices.map(ch => [ch.label, () => {
        if (ch.ok) { if (ch.label.indexOf('별가루') >= 0) { if (w.dust < 1) { say([{ who: 'huru', text: '별가루가 한 개도 없어. 도시에서 먼저 주워 오자.' }]); return; } w.dust--; }
          w.friends[d.id] = 1; o.got = true; w.dust += 2; GB.store(); o.a.hop = 1; o.a.hopH = .8; snd('stamp'); drawDust(); say([{ who: 'narr', text: d.win }], () => { GB.toast('도감에 올랐다 · ' + d.name + ' · 편성에서 함께 갈 수 있다'); });
        } else { if (ch.label.indexOf('별가루') >= 0 && w.dust >= 1) { /* 틀린 방법에는 별가루를 쓰지 않는다 */ } snd('wrong'); say([{ who: 'narr', text: d.lose }]); }
      }, ch.ok ? 0 : 0]), esc: back });
  }
  function say(lines, done) { if (!lines || !lines.length) { if (done) done(); return; } X.busy(true); GB.playStory(lines, () => { X.busy(false); if (done) done(); }); }
  // 사건 장소에 들어선다: 사건 앞 이야기 → (필요한 친구가 없으면 편성) → 현장
  function enter(c) {
    if (cleared(c)) { say([{ who: 'huru', text: '이 사건은 이미 해결했어.' }]); return; }
    if (!open(c)) { say([{ who: 'huru', text: c.lockedHint || '아직 이 일을 할 때가 아니야. 앞의 의뢰부터 풀자.' }]); return; }
    const go = () => X.beginCase(c);
    const t = c.talk; if (t && !sv().seen['talk_' + c.id]) { sv().seen['talk_' + c.id] = 1; GB.store(); say(t, go); } else go();
  }
  function key(e) {
    if (e.code === 'Escape' || e.code === 'Tab') { e.preventDefault(); openMenu(); }
    else if (e.code === 'KeyM') openMap(); else if (e.code === 'KeyJ') openMissions(); else if (e.code === 'KeyI') openBag();
    else if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyF') { e.preventDefault(); interact(); }
    else if (e.code === 'Digit2' && GB.save.lead === 'arthur') swap(); else if (e.code === 'Digit1' && GB.save.lead === 'eri') swap();
  }

  // ── 메뉴(열차 지도·임무·소지품·편성·설정) ──
  const ICON = {
    map: '<path d="M8 16l16-6 16 6 16-6v38l-16 6-16-6-16 6z" fill="#8fa4f5"/><path d="M24 10v38M40 16v38" stroke="#14213f" stroke-width="2.5"/><circle cx="32" cy="30" r="6" fill="#f2c14e"/>',
    quest: '<rect x="12" y="8" width="40" height="50" rx="5" fill="#f2c14e"/><rect x="18" y="16" width="28" height="36" rx="2" fill="#fff"/><path d="M22 26h20M22 34h20M22 42h12" stroke="#8fa4f5" stroke-width="3"/>',
    bag: '<path d="M14 22h36l4 34H10z" fill="#8fa4f5"/><path d="M22 22c0-10 20-10 20 0" fill="none" stroke="#c4d0ff" stroke-width="5"/><rect x="26" y="34" width="12" height="8" rx="2" fill="#f2c14e"/>',
    team: '<rect x="6" y="12" width="15" height="40" rx="4" fill="#8fa4f5"/><rect x="24" y="12" width="15" height="40" rx="4" fill="#c4d0ff"/><rect x="42" y="12" width="15" height="40" rx="4" fill="#4a5fc1" stroke="#8fa4f5" stroke-width="2" stroke-dasharray="4 3"/>',
    friend: '<circle cx="23" cy="24" r="11" fill="#8fa4f5"/><circle cx="43" cy="26" r="9" fill="#c4d0ff"/><path d="M6 54c0-12 8-18 17-18s17 6 17 18z" fill="#8fa4f5"/><path d="M34 54c1-9 5-14 11-14s12 5 12 14z" fill="#c4d0ff"/>',
    set: '<circle cx="32" cy="32" r="12" fill="none" stroke="#8fa4f5" stroke-width="8"/><path d="M32 6v10M32 48v10M6 32h10M48 32h10M14 14l7 7M43 43l7 7M14 50l7-7M43 21l7-7" stroke="#c4d0ff" stroke-width="6"/>'
  };
  function openMenu() {
    GB.openPop({ title: '메뉴', sub: Wd.name, w: 1180, body: b => {
      const g = el('div', 'wgrid', b);
      [['map', '열차 지도', openMap, 'M'], ['quest', '임무', openMissions, 'J'], ['bag', '소지품', openBag, 'I'], ['team', '파티 편성', () => X.openTeam(), ''], ['friend', '친구 도감', openFriends, ''], ['set', '설정', GB.openSettings, '']].forEach(m => {
        el('button', '', g, '<i><svg viewBox="0 0 64 64">' + ICON[m[0]] + '</svg></i><b>' + m[1] + '</b><em>' + m[3] + '</em>').onclick = () => { GB.closePop(); m[2](); };
      });
    }, buttons: [['소개 다시 보기', () => GB.opening(null)], ['처음부터 다시', () => GB.restartAll(openMenu)], ['처음 화면으로', () => GB.show('title')], ['닫기', null, 1]] });
  }
  function zoneRows() { return Object.keys(Wd.zones).map(id => Object.assign({ id: id }, Wd.zones[id])); }
  function openMap() {
    const w = sv(), zs = zoneRows().filter(z => !z.interior), cur = zone || 'plaza';
    GB.openPop({ title: '열차 지도', sub: Wd.name + ' 순환선', w: 1680, body: b => {
      const box = el('div', 'wmap', b), W = 1560, H = 520;
      // 순환선: 광장을 가운데 두고 네 정거장이 길로 이어진다
      let svg = '<svg viewBox="0 0 ' + W + ' ' + H + '"><defs><radialGradient id="mg"><stop offset="0" stop-color="#26337f"/><stop offset="1" stop-color="#0f1640"/></radialGradient></defs><rect width="' + W + '" height="' + H + '" rx="18" fill="url(#mg)"/>';
      for (let i = 0; i < 70; i++) svg += '<circle cx="' + ((i * 197) % W) + '" cy="' + ((i * 89) % H) + '" r="' + (1 + (i % 3)) + '" fill="#dfe8ff" opacity=".45"/>';
      const P = { plaza: [780, 260], station: [1260, 260], market: [300, 260], tower: [780, 80], south: [780, 440] };
      [['plaza', 'station'], ['plaza', 'market'], ['plaza', 'tower'], ['plaza', 'south']].forEach(l => { const a = P[l[0]], c = P[l[1]]; svg += '<line x1="' + a[0] + '" y1="' + a[1] + '" x2="' + c[0] + '" y2="' + c[1] + '" stroke="#7f9cff" stroke-width="10" stroke-linecap="round" opacity=".6"/><line x1="' + a[0] + '" y1="' + a[1] + '" x2="' + c[0] + '" y2="' + c[1] + '" stroke="#14213f" stroke-width="3" stroke-dasharray="10 12"/>'; });
      b.innerHTML = ''; b.appendChild(box); box.innerHTML = svg + '</svg>';
      zs.forEach(z => { const p = P[z.id] || P.south; const zo = zoneOpen(z.id), e = el('button', 'node' + (zo ? '' : ' lock') + (z.id === cur ? ' cur' : ''), box, '<i></i><b>' + z.name + '</b><small>' + (zo ? (z.id === cur ? '현재 위치' : '이동') : '길이 막혀 있음') + '</small>'); e.style.left = p[0] + 'px'; e.style.top = p[1] + 'px'; e.disabled = !zo;
        e.onclick = () => { GB.closePop(); travel(z.id); }; });
      G.cases.forEach(c => { const z = Wd.zones[c.site.zone], p = z && P[c.site.zone]; if (!p) return; const d = el('i', 'dia' + (cleared(c) ? ' done' : open(c) ? ' now' : ''), box, cleared(c) ? '✓' : c.no); d.style.left = (p[0] + 62 + (c.no % 2) * 0) + 'px'; d.style.top = (p[1] - 46 - (c.no > 2 ? 40 : 0)) + 'px'; d.title = c.title; });
      el('p', 'mapnote', b, '◆ 의뢰가 있는 곳 · 정거장을 누르면 그 구역으로 이동합니다. 새 구역은 앞의 의뢰를 풀면 열립니다.');
    }, buttons: [['닫기', null, 1]] });
  }
  function travel(id) {
    const Z = Wd.zones[id]; if (!Z || !zoneOpen(id)) { GB.toast('아직 갈 수 없습니다'); return; }
    const L = X.lead; L.place(Z.spawn[0], Z.spawn[1], Z.spawn[2] || 0); X.mate.place(Z.spawn[0] + 1, Z.spawn[1] + 1, 0); X.huru.place(Z.spawn[0] - 1, Z.spawn[1] + 1, 0); X.pals.forEach((a, i) => a.place(Z.spawn[0] + 2 + i, Z.spawn[1] + 1, 0)); trail.length = 0; S.look(L.x, L.z, true); snd('go');
  }
  function openMissions() {
    const w = sv(), main = G.cases, side = Wd.quests || [];
    GB.openPop({ title: '임무', w: 1500, body: b => {
      const box = el('div', 'wqs', b);
      el('h3', '', box, '주 의뢰');
      main.forEach(c => { const st = cleared(c) ? '해결' : open(c) ? '진행 가능' : '잠김'; el('div', 'wq ' + (cleared(c) ? 'done' : open(c) ? 'now' : 'lock'), box, '<b class="mk2">' + c.chapter.mark + '</b><div><strong>' + c.title + '</strong><small>' + (Wd.zones[c.site.zone] || {}).name + ' · ' + c.task + '</small></div><em>' + st + '</em>'); });
      el('h3', '', box, '도시 의뢰');
      side.forEach(q => { const st = w.quests[q.id] || 0, dn = st >= q.steps.length, go = st >= 1 && !dn; el('div', 'wq ' + (dn ? 'done' : go ? 'now' : 'lock'), box, '<b class="mk2">●</b><div><strong>' + q.title + '</strong><small>' + (go ? q.steps[st].hint : dn ? '끝낸 의뢰' : q.desc) + '</small></div><em>' + (dn ? '완료' : go ? '진행 중' : '미수주') + '</em>'); });
    }, buttons: [['닫기', null, 1]] });
  }
  function openBag() {
    const w = sv(), cs = G.cases.filter(c => (GB.save.notes || {})[c.id]);
    GB.openPop({ title: '소지품', w: 1300, body: b => {
      const box = el('div', 'wbag', b);
      el('div', 'item', box, '<i class="dust"></i><div><strong>' + Wd.dustName + '</strong><small>도시 곳곳에 떨어진 별의 조각</small></div><em>' + w.dust + '</em>');
      el('div', 'item', box, '<i class="note"></i><div><strong>사건 수첩</strong><small>' + (cs.length ? cs.length + '건의 단서가 적혀 있다' : '아직 적힌 사건이 없다') + '</small></div><em></em>').onclick = () => { GB.closePop(); X.openNote(); };
    }, buttons: [['닫기', null, 1]] });
  }
  function openFriends() {
    const have = X.friendsHave();
    GB.openPop({ title: '친구 도감', w: 1300, body: b => {
      const box = el('div', 'wfr', b);
      Object.keys(G.friends).filter(k => !G.friends[k].wild).forEach(k => { const F = G.friends[k], ok = have.indexOf(k) >= 0; el('div', 'fr' + (ok ? '' : ' lock'), box, '<i style="background-image:url(' + F.img + ')"></i><div><strong>' + (ok ? F.name : '???') + '</strong><small>' + (ok ? F.tag + ' · ' + F.desc : '사건을 풀면 함께한다') + '</small></div>'); });
      const w = sv(); (Wd.wild || []).forEach(d => { const ok = !!w.friends[d.id]; el('div', 'fr wl' + (ok ? '' : ' lock'), box, '<i class="wi"></i><div><strong>' + (ok ? d.name : '???') + '</strong><small>' + (ok ? (Wd.zones[d.zone] || {}).name + '에서 만난 친구' : (Wd.zones[d.zone] || {}).name + '에 있다') + '</small></div>'); });
    }, buttons: [['닫기', null, 1]] });
  }

  function refresh() { if (!on) return; applyOpen(); syncRings(); drawParty(); drawTrack(); drawDust(); }
  function banish() { yaw = yaw; }
  // 확인용: 사건 장소 앞으로 곧장 가 선다(자동 진행 도구가 쓴다)
  function siteOf(c) { const s = c.site, d = s.npc && (Wd.npcs || []).find(n => n.id === s.npc); return d ? { x: d.x + 1.3, z: d.z + 1.3 } : { x: s.x, z: s.z + 1.4 }; }
  function tele(x, z) { const L = X.lead; L.place(x, z, L.ry); X.mate.place(x - 1, z + 1, 0); X.huru.place(x + 1, z + 1, 0); X.pals.forEach((a, i) => a.place(x - 2 - i, z + 1.4, 0)); trail.length = 0; S.look(x, z, true); }
  return { siteOf: siteOf, tele: tele, start: start, stop: stop, tick: tick, key: key, drive: drive, here: here, yaw: () => yaw, setYaw: v => { yaw = v; }, refresh: refresh, openMap: openMap, openMenu: openMenu, interact: interact, doors: () => doors, near: () => near, state: () => ({ zone: zone, yaw: yaw, near: near && (near.def ? near.def.id : near.c ? near.c.id : near.id), dust: sv().dust, npcs: npcs.length, dusts: dusts.length, gates: gates.length }), travel: travel, openMissions: openMissions, openBag: openBag, openFriends: openFriends };
})();
