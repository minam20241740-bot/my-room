'use strict';
/* C안 해솔항: 걸어 다니는 도시. 의뢰·단서·불안한 친구·반짝 조각·부두와 옥상.
   화면 가장자리에 작은 표시만 둔다(위치, 지금 할 일, 지도, 파티). 길에서 불안한 친구와 마주치면 field.js의 액션 훈련으로 이어지고, 끝나면 이 자리로 돌아온다. */
window.World = (function () {
  const S = window.Stage3D, GB = window.GB, G = GB.G, W3 = window.World3D, el = GB.el, $ = id => document.getElementById(id), snd = GB.snd;
  const hud = $('hud'), fieldEl = $('field'), storyEl = $('story'), popEl = $('pop'), cardEl = $('card'), PI = Math.PI;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), hyp = Math.hypot;
  const SZ = k => (G.models[k] || {}).height || 1;
  const ga = s => ((s.charCodeAt(s.length - 1) - 0xAC00) % 28 ? '이' : '가');
  const nameOf = k => k === 'huru' ? G.names.huru : ((G.npcs[k] || G.friends[k] || G.leads[k] || { name: G.names[k] || k }).name);
  const mateKey = () => GB.save.lead === 'arthur' ? 'eri' : 'arthur';
  let lastSave = 0, on = false, t = 0, fading = false, fighting = false, rewardPending = false, pend = null, MB = null;
  const P = { safe: 0, x: -13, z: -4.6, gy: 0, ry: 0, yaw: -PI / 2 + .35, spd: 0, camAt: -9, pingT: 0, cd: 0, zoom: 1 };
  const keys = {}, H = {}, drag = { on: false, x: 0 };
  let lead = null, mate = null, huru = null, pal = null, npcs = {}, wilds = [], pickups = [], clueFx = [], boss = null, chase = null, tags = [], walkers = [];

  // ── 저장과 규칙 ──
  function ws() { const sv = GB.save; sv.world = sv.world || {}; const w = sv.world; w.q = w.q || {}; w.calm = w.calm || {}; w.got = w.got || []; w.notes = w.notes || []; w.done = w.done || {}; w.bonus = w.bonus || 0; sv.friends = sv.friends || []; return w; }
  const qstep = id => ws().q[id] || 0;
  const unlocked = q => !q.need || qstep(q.need) === 3;
  const quest = id => G.quests.find(q => q.id === id);
  function party() { const sv = GB.save, have = sv.friends || []; return (sv.party || []).filter((k, i, a) => have.indexOf(k) >= 0 && a.indexOf(k) === i).slice(0, 3); }
  const hasF = k => party().indexOf(k) >= 0;
  function giveFriend(k) { const sv = GB.save; sv.friends = sv.friends || []; if (sv.friends.indexOf(k) >= 0) return false; sv.friends.push(k); sv.party = sv.party || []; if (party().length < 3) sv.party.push(k); return true; }
  function claimWildReward(d) {
    const w = ws();
    if (w.calm[d.id]) return null;
    const joined = giveFriend(d.monster);
    w.calm[d.id] = 1;
    if (!joined) w.bonus++;
    GB.store();
    return joined;
  }
  function restoreWildFriends() {
    const w = ws();
    let changed = false;
    for (const d of G.wild) {
      if (w.calm[d.id] && giveFriend(d.monster)) changed = true;
    }
    if (changed) GB.store();
  }
  const saveNow = () => { const w = ws(); w.at = [+P.x.toFixed(1), +P.z.toFixed(1), P.gy]; GB.store(); };
  const modal = () => storyEl.classList.contains('on') || popEl.classList.contains('on') || cardEl.classList.contains('on') || !!hud.querySelector('.tdim') || fading;
  const lit = () => hasF('malangbul');
  const sparks = () => Math.min(sparkMax(), ws().got.length + ws().bonus);   // 이미 있는 친구를 또 진정시켜 얻는 덤이 있어도 표시는 전체 수를 넘지 않는다
  const sparkMax = () => G.sparks.length + G.quests.filter(q => q.reward && q.reward.spark).reduce((a, q) => a + q.reward.spark, 0);

  // ── 들어오기 ──
  // 로딩 화면에서 도시 자료를 미리 읽는다(game.js의 시작). 읽고 나면 begin()으로 들어간다.
  function prepare(onProg) { S.init($('gl')); return S.load(onProg).then(() => { W3.build(); }); }
  function enter() {
    GB.loadFor('해솔항으로 가는 중', prog => { S.init($('gl')); return S.load(prog).then(() => { W3.build(); }); }).then(() => begin(), e => { console.error(e); GB.show('title'); GB.toast('도시 자료를 읽지 못했습니다'); });
  }
  function begin(dbg) {
    on = false; if (window.Field) window.Field.leave(); fighting = false; fading = false; rewardPending = false;
    GB.show('field'); fieldEl.classList.remove('sm', 'gold', 'calm'); if (window.FX) { window.FX.clear(); window.FX.block = false; }
    const w = ws(), sv = GB.save;
    restoreWildFriends();
    if (!w.started) { w.started = 1; w.at = [-13, -4.6, 0]; }
    P.x = w.at[0]; P.z = w.at[1]; P.gy = w.at[2] || 0; P.spd = 0;
    S.clear(); S.setScene('harbor'); S.camMode('world'); W3.attach(); W3.traffic(true); S.focusRate(7); S.zoom(P.zoom, true);
    P.ry = P.yaw; makeParty(); makeWorldThings(); applyState(true);
    autoAccept();
    buildHud(); S.baseY(P.gy); S.heading(P.yaw); S.look(P.x, P.z, true, P.gy);
    GB.music('harbor'); on = true; S.shadows(sv.fx !== 1); S.start(tick);
    if (!sv.seen.g_world && !(dbg && dbg.noGuide)) { sv.seen.g_world = 1; GB.store(); setTimeout(() => { if (on) GB.guide(hud, G.guideWorld); }, 500); }
  }
  // 훈련·메뉴를 마치고 돌아온다(훈련을 그만둔 경우 포함)
  function resume() {   // 훈련을 그만두고 도시로 돌아온다: 잠깐은 다시 마주치지 않는다
    pend = null; begin(); P.safe = 6;
  }
  function suspend() { on = false; }
  function finish(wspec, ok, stat) {
    const p = pend; pend = null;
    const joined = ok && p && p.wild ? claimWildReward(p.wild.d) : null;
    begin(); P.safe = ok ? 8 : 6;
    if (!ok || !p || (p.wild && joined === null)) return;
    rewardPending = true;
    setTimeout(() => { rewardPending = false; if (p.wild) afterWild(p.wild, joined); else if (p.q) afterBoss(p.q); }, 400);
  }

  // ── 인물과 도시의 것들 ──
  function makeActor(k, h, gy) { const a = S.makeActor(k, h || SZ(k)); a.gy = gy == null ? P.gy : gy; return a; }   // gy를 안 주면 앞장선 탐정과 같은 높이
  function makeParty() {
    const sv = GB.save, m = mateKey();
    lead = makeActor(sv.lead); mate = makeActor(m); huru = makeActor('huru'); huru.float = 1.2; huru.speed = 6;
    lead.place(P.x, P.z, P.ry);
    const [mateX, mateZ] = formationSlot(1.7, -1.1);
    const arrival = W3.resolve(mateX, mateZ, .35, P.gy);
    mate.place(arrival[0], arrival[1], P.ry);
    huru.place(P.x + 1, P.z - 1.4, P.ry);
    pal = null; attachCompanion();
    P.ry = lead.ry;
  }
  function attachCompanion(previous) {
    const key = party()[0];
    if (pal || !key) return;
    const evolve = window.Evolve;
    pal = evolve ? evolve.pal(key, (k, h) => makeActor(k, h), SZ(key)) : makeActor(key);
    const [x,z] = previous ? [previous.x, previous.z] : W3.resolve(P.x + 1.8, P.z - .6, .35, P.gy);
    pal.gy = previous ? previous.gy : P.gy;
    pal.place(x, z, previous ? previous.ry : P.ry);
  }
  function refreshCompanion() {
    clearKeys();
    if (!on || !pal) return;
    const key = party()[0];
    const next = window.Evolve?.info(key)?.id || key;
    if ((pal.evo || pal.key) !== next) {
      const previous = pal;
      S.removeActor(previous);
      pal = null;
      attachCompanion(previous);
    }
    drawParty();
  }
  function makeWorldThings() {
    const w = ws(); npcs = {}; wilds = []; pickups = []; clueFx = []; boss = null; chase = null; makeWalkers();
    ensureNpcs();
    ensureWilds();
    G.sparks.forEach((p, i) => { if (w.got.indexOf(i) >= 0) return; const f = S.sparkle(p[0], p[1], p[2] || 0); f.show(true); pickups.push({ i: i, x: p[0], z: p[1], gy: p[2] || 0, f: f }); });
    G.quests.forEach(q => { if (q.clues && qstep(q.id) === 1) q.clues.forEach((c, i) => addClueFx(q, c, i)); if (q.boss && qstep(q.id) === 2) spawnBoss(q); });
  }
  function ensureWilds() {
    const w = ws();
    G.wild.forEach(d => {
      if (w.calm[d.id] || wilds.some(wild => wild.d.id === d.id)) return;
      if (d.need && qstep(d.need) !== 3) return;
      if (d.rare && w.rareLead !== d.id) return;
      const a = makeActor(d.monster, SZ(d.monster) * 1.05, 0);
      a.place(d.at[0], d.at[1], Math.random() * 6);
      a.speed = 1.3;
      wilds.push({ d, a, ar: W3.ARENAS[d.arena], next: Math.random() * 3, cool: 0, tg: null });
    });
  }
  function ensureNpcs() {
    Object.keys(G.npcs).forEach(id => { const n = G.npcs[id]; if (npcs[id] || (n.need && qstep(n.need) !== 3)) return; const a = makeActor(n.model, 0, 0); a.place(n.at[0], n.at[1], 0); npcs[id] = { id: id, def: n, a: a, home: n.at.slice() }; });
  }
  // ── 거리의 주민: 몬스터 친구들이 인도를 오간다(도시가 비어 보이지 않게). 말은 걸 수 없고 이름표도 없다. 길을 막으면 멈춰서 쳐다본다 ──
  const WALKS = [[[-58, -5.1], [58, -5.1]], [[58, 5.1], [-58, 5.1]], [[-50, -5.5], [-6, -5.5]], [[50, 5.5], [8, 5.5]], [[-5.2, -32], [-5.2, 24]], [[5.2, 24], [5.2, -32]], [[-5.7, 7], [-5.7, -24]], [[-50, 25.3], [50, 25.3]], [[-46, 25.9], [-6, 25.9]], [[10, -5.8], [58, -5.8]], [[66, -5.1], [130, -5.1]], [[130, 5.1], [66, 5.1]], [[72, -5.6], [112, -5.6]]];
  function makeWalkers() {
    walkers = []; const kinds = ['malangbul', 'bangului', 'banjjak', 'bori', 'mongeul', 'malangbul']; let n = 0;
    WALKS.forEach(wp => {
      const len = hyp(wp[1][0] - wp[0][0], wp[1][1] - wp[0][1]), cnt = len > 90 ? 3 : len > 40 ? 2 : 1;
      for (let k = 0; k < cnt; k++) {
        const kk = kinds[n++ % kinds.length], a = makeActor(kk, SZ(kk) * (.9 + Math.random() * .2), 0), w = { a: a, wp: wp, len: len, s: (k + .15 + Math.random() * .7) / cnt * len, dir: Math.random() < .5 ? 1 : -1, v: 1.1 + Math.random() * .7, wait: 0, mode: '' };
        const x = wp[0][0] + (wp[1][0] - wp[0][0]) * w.s / len, z = wp[0][1] + (wp[1][1] - wp[0][1]) * w.s / len, r = W3.resolve(x, z, .35, 0);
        if (hyp(r[0] - x, r[1] - z) > .1) { S.removeActor(a); continue; }
        a.place(x, z, Math.atan2(wp[1][0] - wp[0][0], wp[1][1] - wp[0][1]) + (w.dir < 0 ? PI : 0)); walkers.push(w);
      }
    });
  }
  let carCd = 0, wasRun = false, stepDistance = 0;
  function carSnd(dt) {   // 차가 가까이 지나가면 바람 소리
    carCd = Math.max(0, carCd - dt); if (carCd > 0 || P.gy > 3) return;
    for (const c of W3.carPos()) if (c[3] && c[2] > 2.5 && hyp(c[0] - P.x, c[1] - P.z) < 6.5) { snd('dash'); carCd = 3.5; return; }
  }
  function walkTick(dt) {
    walkers.forEach(w => {
      const a = w.a, d = hyp(a.x - P.x, a.z - P.z); a.root.visible = d < 60;
      if (d >= 60) return;
      const ux = (w.wp[1][0] - w.wp[0][0]) / w.len, uz = (w.wp[1][1] - w.wp[0][1]) / w.len;
      if (w.wait > 0 || (d < 2.3 && Math.abs(P.gy) < 3)) {
        w.wait = Math.max(0, w.wait - dt); if (w.mode !== 'idle') { w.mode = 'idle'; a.play('idle'); } if (d < 5) a.wantRy = Math.atan2(P.x - a.x, P.z - a.z); return;
      }
      if (w.mode !== 'walk') { w.mode = 'walk'; a.play('walk'); }
      let s = w.s + w.dir * w.v * dt;
      if (s < 0 || s > w.len) { w.dir = -w.dir; w.wait = 1.5 + Math.random() * 3.5; return; }
      const x = w.wp[0][0] + ux * s, z = w.wp[0][1] + uz * s, r = W3.resolve(x, z, .35, 0);
      if (hyp(r[0] - x, r[1] - z) > .25) { w.dir = -w.dir; w.wait = .6; return; }
      w.s = s; a.x = x; a.z = z; a.wantRy = Math.atan2(ux * w.dir, uz * w.dir);
    });
  }
  function addClueFx(q, c, i) {
    if (ws().notes.some(n => n.q === q.id && n.label === c.label)) return;
    const f = S.ring(c.x, c.z, '#dfff1a', c.h || 0); if (q.hidden) f.show(false); clueFx.push({ q: q, c: c, f: f, hid: !!q.hidden });
  }
  function spawnBoss(q) {
    if (boss) return; const b = q.boss, a = makeActor(b.monster, SZ(b.monster) * 1.35); a.gy = b.arena === 'roof' ? W3.spec.roofTop : 0; a.place(b.at[0], b.at[1], 0);
    const f = S.ring(b.at[0], b.at[1], '#ff4057', a.gy); boss = { q: q, a: a, f: f, intro: false, cool: 0 };
  }
  function applyState(instant) {
    const sg = W3.signs; const done = id => qstep(id) === 3;
    sg.forEach(s => { s.want = done('sign') ? 1 : 0; if (instant) s.k = s.want; });
    W3.lamps.forEach(l => { if (l.alley) l.on = done('alley'); });
    W3.buoys.forEach(b => { b.on = done('harbor'); });
    const lh = W3.spec.lighthouse, rs = W3.spec.roofSignal; if (lh) lh.on = done('roof'); if (rs) rs.on = done('roof');
  }
  function autoAccept() { G.quests.forEach(q => { if (q.auto && unlocked(q) && qstep(q.id) === 0) { ws().q[q.id] = 1; q.clues.forEach((c, i) => addClueFx(q, c, i)); } }); }

  // ── 화면 ──
  function buildHud() {
    hud.innerHTML = '';
    H.loc = el('div', 'w-loc', hud, '<small>해솔항 · 밤</small><b></b>');
    H.obj = el('div', 'w-obj', hud, '<i class="arr"><svg viewBox="0 0 40 40"><path d="M20 3 L35 33 L20 25 L5 33 Z"/></svg></i><div><small></small><b></b><em></em></div>');
    H.mini = el('div', 'w-mini', hud, '<canvas width="520" height="520"></canvas><u>N</u><span></span>'); H.cv = H.mini.querySelector('canvas'); H.zone = H.mini.querySelector('span'); H.north = H.mini.querySelector('u');
    H.q = el('div', 'w-q', hud); H.sp = el('div', 'w-sp', hud);
    H.party = el('div', 'w-party', hud);
    H.keys = el('div', 'w-keys kb-only', hud, '<span><kbd>WASD · ↑ ↓</kbd>걷기</span><span><kbd>← →</kbd>시점</span><span><kbd>Shift</kbd>달리기</span><span><kbd>F</kbd>살피기</span><span><kbd>Tab</kbd>메뉴</span>');
    H.prompt = el('div', 'w-prompt', hud); H.tags = el('div', 'w-tags', hud);
    H.prompt.addEventListener('click', () => { if (cand && !fighting) cand.fn(); });   // 폰에서는 이 안내를 눌러도 '행동'과 같다
    el('div', 'w-haz a', hud); el('div', 'w-haz b', hud); el('div', 'w-base', hud);   // 표지처럼 모서리 사선 띠와 아래 줄
    drawParty(); drawQuests();
  }
  function drawParty() {
    const sv = GB.save, ks = [sv.lead, mateKey(), party()[0] || null];
    H.party.innerHTML = '';
    ks.forEach((k, i) => {
      const c = el('button', 'wp' + (i === 0 ? ' on' : '') + (k ? '' : ' empty'), H.party, '<b>' + (i + 1) + '</b>' + (k ? faceHtml(k) : '<i class="fc none"></i>') + '<div><strong>' + (k ? nameOf(k) : '빈 자리') + '</strong><small>' + (i === 0 ? '앞장' : i === 1 ? '교대' : k ? '친구 신호' : '친구를 만나면') + '</small></div>');
      c.addEventListener('mousedown', e => e.preventDefault()); c.onclick = () => { c.blur(); if (i === 1) swapLead(); else if (i === 2 && k) pulse(); };
    });
  }
  function faceHtml(k) { const F = G.friends[k]; if (F && (F.stage > 1 || ['malangbul', 'bangului', 'mongeul'].indexOf(k) < 0)) return F.img ? '<i class="fc" style="background-image:url(' + F.img + ');background-size:cover;background-position:center 20%"></i>' : '<i class="fc" style="display:inline-flex;align-items:center;justify-content:center;background:#2b3a7a;color:#dfff1a;font:900 30px/1 sans-serif">' + F.name.charAt(0) + '</i>'; return '<i class="fc" style="background-image:url(img/face_' + k + '.png)"></i>'; }
  function drawQuests() {
    const list = objectives(); H.q.innerHTML = '';
    list.slice(0, 4).forEach((o, i) => el('div', 'wq' + (i === 0 ? ' on' : '') + (o.side ? ' side' : ''), H.q, '<i></i><span>' + o.title + '</span><small>' + o.sub + '</small>'));
    H.sp.innerHTML = '<i>✦</i> 반짝 조각 <b>' + sparks() + '</b> / ' + sparkMax();
  }
  // 지금 할 일 목록(앞이 추적 중인 것)
  function objectives() {
    const out = [], w = ws();
    G.quests.forEach(q => {
      if (!unlocked(q)) return; const s = qstep(q.id); if (s === 3) return;
      const o = { q: q, title: q.title, side: !!q.side, step: s };
      if (s === 0) { if (q.auto) return; const n = npcs[q.giver]; o.sub = nameOf(q.giver) + '에게 말 걸기'; o.at = n ? [n.a.x, n.a.z] : G.npcs[q.giver].at; }
      else if (q.deliver && s === 1) { const n = npcs[q.deliver]; o.sub = '상자를 ' + nameOf(q.deliver) + '에게 전하기'; o.at = n ? [n.a.x, n.a.z] : G.npcs[q.deliver].at; }
      else if (q.path && s === 1) { o.sub = chase ? '반짝이를 잡아라 · ' + Math.ceil(Math.max(0, chase.t)) + '초' : '반짝이를 쫓는다'; o.at = chase ? [chase.a.x, chase.a.z] : null; }
      else if (s === 1) {
        const rest = q.clues.filter(c => !w.notes.some(n => n.q === q.id && n.label === c.label)), done = q.clues.length - rest.length;
        if (q.id === 'roof' && P.gy < 8) { o.sub = '해솔 종합상가 옥상으로 올라간다'; o.at = W3.spec.roofDoor; }
        else { let best = null, bd = 1e9; rest.forEach(c => { const d = hyp(c.x - P.x, c.z - P.z); if (d < bd) { bd = d; best = c; } }); o.sub = '단서 ' + done + '/' + q.clues.length + (best ? ' · ' + best.label : ''); o.at = best ? [best.x, best.z] : null; }
      } else if (s === 2) { o.sub = q.boss.hint; o.at = boss && boss.q === q ? [boss.a.x, boss.a.z] : q.boss.at; }
      out.push(o);
    });
    out.sort((a, b) => (a.side ? 1 : 0) - (b.side ? 1 : 0) || (b.step > 0 ? 1 : 0) - (a.step > 0 ? 1 : 0));
    return out;
  }

  // ── 매 프레임 ──
  function tick(dt) {
    if (!on) return 0; t += dt; P.safe = Math.max(0, P.safe - dt); if (t - lastSave > 8 && !fighting) { lastSave = t; saveNow(); } W3.tick(dt, P.x, P.z, P.gy, P.x - Math.sin(P.yaw) * 8.8 * P.zoom, P.z - Math.cos(P.yaw) * 8.8 * P.zoom);
    const md = modal();
    if (!md && !fighting) { move(dt); scan(dt); }
    followers(dt); walkTick(dt); carSnd(dt);
    S.baseY(P.gy); S.heading(P.yaw); S.look(P.x + Math.sin(P.yaw) * .4, P.z + Math.cos(P.yaw) * .4, false, P.gy);
    hudTick(dt);
    return 1;
  }
  function move(dt) {
    const k = keys, ix = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0), iz = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0), run = !!(k.ShiftLeft || k.ShiftRight);
    const cam = (k.ArrowLeft ? 1 : 0) - (k.ArrowRight ? 1 : 0); if (cam) { P.yaw += cam * 2.4 * dt; P.camAt = t; }
    const f = { x: Math.sin(P.yaw), z: Math.cos(P.yaw) }, r = { x: -f.z, z: f.x };
    let dx = f.x * iz + r.x * ix, dz = f.z * iz + r.z * ix; const n = hyp(dx, dz);
    const target = n > 0 ? (run ? 5.65 : 2.55) : 0; P.spd += (target - P.spd) * Math.min(1, dt * (n > 0 ? 9 : 14));
    if (ix !== 0 && t - P.camAt > 1) P.yaw -= ix * .8 * dt;   // 옆으로 걸으면 시점이 따라 돈다
    if (n > 0) { dx /= n; dz /= n; }
    else { dx = Math.sin(lead.wantRy); dz = Math.cos(lead.wantRy); }
    const previousX = P.x, previousZ = P.z;
    if (P.spd > .15) [P.x, P.z] = W3.sweep(P.x, P.z, dx * P.spd * dt, dz * P.spd * dt, .45, P.gy);
    const moved = hyp(P.x - previousX, P.z - previousZ);
    const moving = moved > .001;
    if (moving) { lead.wantRy = Math.atan2(P.x - previousX, P.z - previousZ); P.ry = lead.wantRy; }
    lead.x = P.x; lead.z = P.z; lead.gy = P.gy; lead.target = null;
    // 이동 키를 모두 놓았을 때, 감속해 걷는 속도가 된 다음 자세를 전환한다.
    const clip = (run || (n === 0 && P.spd > 2.55)) && lead.clips?.run ? 'run' : 'walk';
    lead.play(moving ? clip : 'idle');
    if (moving) {
      stepDistance += moved;
      const step = clip === 'run' ? 1.18 : .69;
      if (stepDistance >= step) { stepDistance %= step; snd('step'); }
    } else { stepDistance = 0; P.spd = 0; }
    if (moving && run && !wasRun) snd('dash'); wasRun = moving && run;
    P.pingT = Math.max(0, P.pingT - dt); P.cd = Math.max(0, P.cd - dt);
  }
  function formationSlot(behind, side) {
    const sx = Math.sin(lead.ry), cz = Math.cos(lead.ry);
    return [P.x - sx * behind - cz * side, P.z - cz * behind + sx * side];
  }
  function followers(dt) {
    const fol = (a, ox, oz, sp) => {
      if (!a) return; a.gy = P.gy; const [tx, tz] = formationSlot(ox, oz), d = hyp(tx - a.x, tz - a.z);
      if (a === mate && d > .12) {
        a.speed = Math.min(11, d * 5);
        a.target = { x: tx, z: tz };
        a.play(a.speed > 5.2 && a.clips?.run ? 'run' : 'walk');
      } else if (a === mate) {
        a.target = null; a.play('idle'); a.wantRy = lead.ry;
      } else if (d > 1.1) { a.speed = clamp(d * 2.6 + 2.5, 3, 11); if (!a.target || true) a.target = { x: tx, z: tz }; a.play(a.speed > 6.5 && a.clips && a.clips.run ? 'run' : 'walk'); }
      else if (!a.target) { a.play('idle'); a.wantRy = lead.ry; }
      a.groundPath = (x, z, dx, dz) => W3.sweep(x, z, dx, dz, .35, P.gy);
    };
    fol(mate, 1.7, -1.1); fol(huru, .9, 1.5); fol(pal, 2.6, .5);
  }
  // 가까운 것(말 걸기·살피기·문)을 찾아 안내를 띄우고, 불안한 친구와 닿으면 훈련으로 간다
  let cand = null;
  function scan(dt) {
    cand = null; let bd = 1e9;
    const add = (x, z, r, text, fn, gy) => { if (gy != null && Math.abs(gy - P.gy) > 3) return; const d = hyp(x - P.x, z - P.z); if (d < r && d < bd) { bd = d; cand = { text: text, fn: fn }; } };
    Object.keys(npcs).forEach(id => { const n = npcs[id]; if (chase && chase.id === id) return; add(n.a.x, n.a.z, 2.7, nameOf(id) + '에게 말 걸기', () => talk(id), 0); });
    const sp = W3.spec; add(sp.office[0], sp.office[1], 2.6, '솔 탐정 사무소에 들어가기', openOffice, 0);
    add(sp.roofDoor[0], sp.roofDoor[1], 2.4, '해솔 종합상가 옥상으로 올라가기', roofUp, 0);
    add(sp.roofLand[0], sp.roofLand[1], 2.2, '아래층으로 내려가기', roofDown, sp.roofTop);
    clueFx.forEach(c => { if (c.hid && !c.f.on) { return; } add(c.c.x, c.c.z, c.hid ? 2.4 : 2.4, '살펴보기 · ' + c.c.label, () => inspect(c), c.c.h || 0); });
    clueFx.forEach(c => {   // 어두운 곳의 숨은 단서는 빛 친구가 곁에 있을 때만 보인다
      if (!c.hid) return; const d = hyp(c.c.x - P.x, c.c.z - P.z), show = lit() && d < 10 || P.pingT > 0 && lit() && d < 18;
      if (show && !c.f.on) { c.f.show(true); c.f.on = true; snd('reveal'); } else if (!show && c.f.on) { c.f.show(false); c.f.on = false; }
      if (!lit() && d < 5 && !c.warned) { c.warned = 1; GB.toast('너무 어두워서 안 보입니다. 불빛 친구가 필요합니다'); }
    });
    pickups.forEach(p => { if (hyp(p.x - P.x, p.z - P.z) < 1.5 && Math.abs(p.gy - P.gy) < 3) takeSpark(p); });
    wilds.forEach(w => {
      wildTick(w, dt);
      if (w.d.rare && !fighting) add(w.a.x, w.a.z, 2.7, w.d.name + ' 살펴보기', () => wildEncounter(w), 0);
    });
    bossTick(dt); chaseTick(dt);
    npcsTick(dt);
    H.prompt.innerHTML = cand ? '<kbd class="kb-only">F</kbd><kbd class="tc-only">행동</kbd>' + cand.text : ''; H.prompt.classList.toggle('on', !!cand);
  }
  function npcsTick(dt) {
    Object.keys(npcs).forEach(id => { const n = npcs[id]; if (chase && chase.id === id) return; const d = hyp(n.a.x - P.x, n.a.z - P.z); if (d < 9) n.a.wantRy = Math.atan2(P.x - n.a.x, P.z - n.a.z); });
  }
  function takeSpark(p) { const w = ws(); w.got.push(p.i); p.f.remove(); pickups.splice(pickups.indexOf(p), 1); snd('found'); S.burst(p.x, p.gy + .5, p.z, '#eaffa0', 10, .08); const n = sparks(); GB.toast('반짝 조각 ' + n + ' / ' + sparkMax()); drawQuests(); GB.store(); const ml = G.milestones && G.milestones[n]; if (ml) setTimeout(() => { if (on && !fighting) { snd('stamp'); GB.playStory(ml, null); } }, 1500); }

  // ── 불안한 친구, 마주침 ──
  function wildTick(w, dt) {
    w.cool = Math.max(0, w.cool - dt); const a = w.a, d = hyp(a.x - P.x, a.z - P.z), ar = w.ar;
    if (d < 11) { a.wantRy = Math.atan2(P.x - a.x, P.z - a.z); w.seen = true; } else w.seen = false;
    if (!w.tg || hyp(w.tg.x - a.x, w.tg.z - a.z) < .3) { w.next -= dt; if (w.next <= 0) { w.next = 2 + Math.random() * 3; w.tg = { x: clamp(w.d.at[0] + (Math.random() - .5) * 5, ar[0] + 1.5, ar[1] - 1.5), z: clamp(w.d.at[1] + (Math.random() - .5) * 4, ar[2] + 1.5, ar[3] - 1.5) }; } else { if (a.cur !== 'idle' && !a.target) a.play('idle'); } }
    if (w.tg && d >= 4.5 && w.cool <= 0) { a.speed = 1.3; a.target = { x: w.tg.x, z: w.tg.z }; a.play('walk'); } else if (d < 4.5) { a.target = null; a.play('idle'); }
    if (!w.d.rare && d < 2.9 && w.cool <= 0 && P.safe <= 0 && !fighting && Math.abs(P.gy - (a.gy || 0)) < 3) wildEncounter(w);
  }
  function wildEncounter(w) {
    const d = w.d;
    encounter({ wild: w, banner: (d.rare ? '희귀 친구 · ' : '불안한 ') + d.name, title: d.name, id: d.id, monster: d.monster, arena: d.arena, duel: wildDuel(d) });
  }
  function wildDuel(d) {
    return { monster: d.monster, name: d.name, title: d.title || '불안한 ' + d.name, reason: d.name + ' 진정시키기', mode: 'action', tip: '붉은 범위를 피하고 빈틈에 타격합니다.', tough: d.tough, hit: 9, every: 2.2, shot: '#e6ff7a',
      act: { speed: 2.6 + d.tough * .35, range: d.range, tele: 1.8, tmin: 1.2, r: 2.1, pats: d.patterns, gap: 2.0 - d.tough * .15, hit: 12, rec: 1.1, strike: 4 } };
  }
  function bossTick(dt) {
    if (!boss || fighting) return; boss.cool = Math.max(0, boss.cool - dt); const a = boss.a, d = hyp(a.x - P.x, a.z - P.z);
    if (d < 12) a.wantRy = Math.atan2(P.x - a.x, P.z - a.z);
    if (d < 7 && boss.cool <= 0 && P.safe <= 0 && Math.abs(P.gy - (a.gy || 0)) < 3 && !boss.busy) {
      const q = boss.q; boss.busy = true; clearKeys();
      const go = () => { boss.busy = false; encounter({ q: q, banner: '불안한 ' + q.boss.name + '와 마주쳤다!', title: q.boss.title, id: q.id, monster: q.boss.monster, arena: q.boss.arena, duel: q.boss.duel }); };
      if (!boss.intro) { boss.intro = true; GB.playStory(q.boss.intro, go); } else go();
    }
  }
  function encounter(sp) {
    if (fighting) return; fighting = true; clearKeys(); S.focusRate(3.2); W3.traffic(false);
    const f = el('div', 'w-flash', hud, '<span>' + sp.banner + '</span>'); snd('tele'); snd('just');
    setTimeout(() => {
      if (!on) return; saveNow(); on = false; pend = sp.wild ? { wild: sp.wild } : { q: sp.q };
      const ar = W3.ARENAS[sp.arena]; W3.spec.battle = { cx: (ar[0] + ar[1]) / 2, cz: (ar[2] + ar[3]) / 2, arena: ar, cam: null };
      const arenaSpec = { arena: ar, cam: null };
      window.Field.startWorld({ id: sp.id, title: sp.title, monster: sp.monster, duel: sp.duel, arenaSpec: arenaSpec, gy: P.gy });
    }, 950);
  }
  function afterWild(w, nw) {
    const d = w.d;
    const lines = [{ who: 'huru', text: d.name + ga(d.name) + ' 진정됐어. ' + (d.calm || '이제 눈빛이 부드러워졌네.') }];
    if (nw) lines.push({ who: 'huru', text: d.name + '도 함께 다니고 싶대. 편성에서 데려갈 수 있어!' }); else lines.push({ who: 'huru', text: d.name + '은(는) 이미 함께하고 있어서, 고맙다며 반짝 조각을 하나 줬어.' });
    GB.playStory(lines, () => { drawQuests(); drawParty(); });
    w.a.target = null; S.burst(w.a.x, 1, w.a.z, '#eaffb0', 16, .1); { const i = wilds.indexOf(w); if (i >= 0) wilds.splice(i, 1); } S.removeActor(w.a);
  }
  function afterBoss(q) {
    GB.playStory(q.outro, () => {
      const nw = q.reward && q.reward.friend && giveFriend(q.reward.friend);
      if (nw) attachCompanion();
      ws().q[q.id] = 3; if (boss) { boss.f.remove(); S.removeActor(boss.a); boss = null; }
      if (q.reward && q.reward.friend && !nw) ws().bonus += 2;
      applyState(false); ensureNpcs(); snd('stamp'); GB.toast('의뢰 완료: ' + q.title); GB.store(); drawQuests(); drawParty();
      /* 결말 카드는 틈 없이 바로 띄운다(진화 장면이 먼저 끼어들어 카드를 덮지 않게). 카드를 닫으면 후루가 남은 할 일을 알려 준다 */
      if (q.end) {
        ws().ended = 1; GB.store();
        GB.epilogue(() => GB.playStory([{ who: 'huru', text: '사건을 모두 풀었어! 부두에 있는 세라가 남은 항구 기록을 알려 준대.' }, { who: 'huru', text: '처음부터 다시 하고 싶으면 ' + ((window.DeviceHint && window.DeviceHint.touch) ? '메뉴 단추' : 'Tab 메뉴') + '에서 고를 수 있어.' }], () => { drawQuests(); }));
        return;
      }
      const nx = G.quests.find(x => x.id === q.next);
      if (nx && nx.auto) { ws().q[nx.id] = 1; nx.clues.forEach((c, i) => addClueFx(nx, c, i)); GB.playStory(nx.talk, () => { drawQuests(); }); }
    });
  }

  // ── 말 걸기·살피기 ──
  function talk(id) {
    const n = npcs[id]; clearKeys(); snd('open');
    if (n.def.rareLead) {
      const d = G.wild.find(wild => wild.id === n.def.rareLead);
      if (qstep(d.need) !== 3) {
        GB.playStory(n.def.before.map(text => ({ who: id, text })));
      } else if (!ws().calm[d.id]) {
        GB.playStory(n.def.clue.map(text => ({ who: id, text })), () => {
          ws().rareLead = d.id; GB.store(); ensureWilds();
        });
      } else {
        GB.playStory([{ who: id, text: '바위수호가 걸을 수 있게 화물 통로를 비워 달라고 부탁했어요. 덕분에 항구 기록도 잘 마쳤어요.' }]);
      }
      return;
    }
    const box = G.quests.find(q => q.deliver === id && qstep(q.id) === 1);
    if (box) { GB.playStory(box.done, () => { ws().q[box.id] = 3; ws().bonus += box.reward.spark; snd('stamp'); GB.toast('의뢰 완료: ' + box.title); GB.store(); drawQuests(); }); return; }
    const offer = G.quests.filter(q => q.giver === id && unlocked(q) && qstep(q.id) === 0 && !q.auto).sort((a, b) => (a.side ? 1 : 0) - (b.side ? 1 : 0))[0];
    if (offer) {
      GB.playStory(offer.talk, () => {
        ws().q[offer.id] = 1; snd('found'); GB.toast('의뢰를 받았습니다: ' + offer.title);
        if (offer.clues) offer.clues.forEach((c, i) => addClueFx(offer, c, i));
        if (offer.path) startChase(offer, id);
        GB.store(); drawQuests();
      }); return;
    }
    const run = G.quests.find(q => q.giver === id && q.path && qstep(q.id) === 1 && !chase);
    if (run) { startChase(run, id); return; }
    const ch = n.def.chat; GB.playStory([{ who: id, text: ch[(Math.random() * ch.length) | 0] }]);
  }
  function inspect(c) {
    const q = c.q; if (qstep(q.id) !== 1) return; clearKeys();
    lead.face(c.c.x, c.c.z); lead.act('inspect') || lead.act('use');
    GB.playStory([{ who: 'narr', text: c.c.text }], () => {
      const w = ws(); w.notes.push({ q: q.id, label: c.c.label, note: c.c.note }); c.f.remove(); clueFx.splice(clueFx.indexOf(c), 1);
      snd('found'); GB.toast('수첩에 적었습니다'); GB.store();
      if (!clueFx.some(x => x.q === q)) {
        w.q[q.id] = 2; GB.store();
        GB.playStory(q.after, () => { spawnBoss(q); drawQuests(); });
      } else drawQuests();
    });
  }
  function startChase(q, id) {
    const n = npcs[id]; chase = { q: q, id: id, a: n.a, i: 0, t: q.time, grace: 1.6 }; n.a.speed = 6.4; snd('dash'); drawQuests();
  }
  function chaseTick(dt) {
    if (!chase) return; const c = chase, a = c.a, p = c.q.path[c.i];
    c.t -= dt; c.grace -= dt; const d = hyp(a.x - P.x, a.z - P.z);
    if (d < 2.0 && c.grace <= 0) { chase = null; GB.playStory(c.q.done, () => { ws().q[c.q.id] = 3; ws().bonus += c.q.reward.spark; snd('stamp'); GB.toast('의뢰 완료: ' + c.q.title); a.target = null; a.place(G.npcs[c.id].at[0], G.npcs[c.id].at[1], 0); GB.store(); drawQuests(); }); return; }
    if (c.t <= 0 || d > 40) { const q = c.q, id = c.id; chase = null; a.target = null; a.place(G.npcs[id].at[0], G.npcs[id].at[1], 0); GB.playStory(q.fail, () => drawQuests()); return; }
    if (d < 9 || c.i === 0) { const dx = p[0] - a.x, dz = p[1] - a.z, dd = hyp(dx, dz); if (dd < .6) c.i = Math.min(c.q.path.length - 1, c.i + 1); else { a.target = { x: p[0], z: p[1] }; a.speed = 6.4; a.play(a.clips && a.clips.run ? 'run' : 'walk'); } }
    else { a.target = null; a.play('idle'); }
  }

  // ── 문과 옥상 ──
  function openOffice() {
    clearKeys(); const o = objectives()[0];
    GB.playStory([{ who: 'prof', text: o ? '지금은 ' + o.q.title + ' 의뢰를 따라가면 된단다. ' + o.sub + '.' : '의뢰가 모두 정리됐구나. 수고했다. 도시에서 반짝 조각이나 불안한 친구를 더 찾아보렴.' }], menu);
  }
  function fade(fn) { fading = true; const d = el('div', 'w-fade', hud); requestAnimationFrame(() => d.classList.add('on')); setTimeout(() => { fn(); d.classList.remove('on'); setTimeout(() => { d.remove(); fading = false; }, 380); }, 420); }
  function roofUp() {
    const w = ws();
    if (!w.roofOpen) {
      if (!hasF('mongeul')) { GB.playStory([{ who: 'narr', text: '옥상으로 가는 문이 전자 자물쇠로 잠겨 있다.' }, { who: 'huru', text: '전기 친구가 곁에 있으면 열 수 있어. 편성을 확인하자.' }]); return; }
      const name = nameOf('mongeul');
      snd('zap'); setTimeout(() => snd('unlock'), 500); GB.playStory([{ who: 'narr', text: name + ga(name) + ' 문에 몸을 대자 자물쇠가 찌릿 소리를 냈다.' }, { who: 'narr', text: '찰칵. 문이 열렸다.' }], () => { w.roofOpen = 1; GB.store(); roofUp(); }); return;
    }
    snd('go'); const sp = W3.spec; fade(() => { P.x = sp.roofLand[0]; P.z = sp.roofLand[1] - .6; P.gy = sp.roofTop; P.yaw = 0; S.look(P.x, P.z, true, P.gy); [mate, huru, pal].forEach(a => { if (a) a.place(P.x - 1, P.z - 1.4, 0); }); drawQuests(); });
  }
  function roofDown() { snd('go'); const sp = W3.spec; fade(() => { P.x = sp.roofDoor[0]; P.z = sp.roofDoor[1] + .4; P.gy = 0; P.yaw = PI; S.look(P.x, P.z, true, P.gy); [mate, huru, pal].forEach(a => { if (a) a.place(P.x - 1, P.z + 1, 0); }); drawQuests(); }); }

  // ── 조작: 앞장 바꾸기, 친구 신호 ──
  function swapLead() {
    const sv = GB.save, old = sv.lead; sv.lead = mateKey(); GB.store(); snd('swap');
    const lx = lead.x, lz = lead.z, mx = mate.x, mz = mate.z; S.removeActor(lead); S.removeActor(mate);
    lead = makeActor(sv.lead); mate = makeActor(old); lead.place(lx, lz, P.ry); mate.place(mx, mz, P.ry); S.burst(lx, 1, lz, '#dfff1a', 10, .08); drawParty();
  }
  function pulse() {
    if (P.cd > 0 || !party()[0]) return; P.cd = 4; P.pingT = 7; snd('light'); S.ripple(P.x, P.z, lit() ? '#dfff1a' : '#7fd0ff', 9); GB.toast(lit() ? '말랑불이 주변을 비춘다' : '친구가 주변의 기척을 알려 준다');
  }

  // ── 메뉴, 의뢰, 지도 ──
  function menu() {
    clearKeys();
    GB.openPop({ title: '메뉴', w: 900, body: b => {
      const g = el('div', 'grid2', b);
      [['편성', () => { suspend(); saveNow(); window.Field.openTeam(null); }], ['수첩', () => window.Field.openNote()], ['도감', dex], ['의뢰', questLog], ['지도', bigMap], ['설정', () => GB.openSettings()], ['처음부터 다시', () => GB.restartAll(menu)], ['시작 화면으로', () => { saveNow(); suspend(); GB.show('title'); }]]
        .forEach(m => { el('button', '', g, m[0]).onclick = () => { GB.closePop(); setTimeout(m[1], 0); }; });
    }, buttons: [['계속', null, 1]] });
  }
  // 도감: 만난 친구는 그림과 설명이, 아직 못 만난 친구는 힌트만 보인다
  function dex() {
    const have = GB.save.friends || [];
    const rows = G.dex.map(d => { const F = G.friends[d.k], ok = have.indexOf(d.k) >= 0;
      return ok ? '<div class="ql"><b>' + F.name + '</b><small>' + F.tag + ' · ' + d.where + '에서 만남</small><p>' + F.desc + '. ' + d.note + '</p></div>'
        : '<div class="ql side"><b>???</b><small>아직 만나지 못한 친구</small><p>' + d.hint + '</p></div>'; }).join('');
    GB.openPop({ title: '친구 도감', w: 1640, body: '<p class="ql-sp">만난 친구 ' + G.dex.filter(d => have.indexOf(d.k) >= 0).length + ' / ' + G.dex.length + '</p><div class="dexg">' + rows + '</div>', buttons: [['닫기', null, 1]] });
  }
  function questLog() {
    const w = ws(), act = [], fin = [];
    G.quests.forEach(q => { if (!unlocked(q)) return; const s = qstep(q.id); (s === 3 ? fin : act).push(q); });
    const row = q => '<div class="ql' + (q.side ? ' side' : '') + '"><b>' + q.title + '</b><small>' + (q.main ? '사건 ' + q.main : '곁가지') + ' · ' + q.zone + '</small><p>' + q.brief + '</p></div>';
    const rare = G.wild.find(d => d.id === w.rareLead);
    const note = rare ? '<h4>세라의 항구 기록</h4><div class="ql side"><b>' + rare.name + '</b><small>희귀 친구 · 동쪽 화물 마당</small><p>'
      + (w.calm[rare.id] ? '통로가 안전해져 진정했다.' : '지도에서 보라색 표식을 찾고, 가까이 가 F로 살펴본다.') + '</p></div>' : '';
    GB.openPop({ title: '의뢰', w: 1300, body: '<h4>진행 중</h4>' + (act.length ? act.map(row).join('') : '<p>지금 받은 의뢰가 없습니다.</p>') + note + '<h4>끝낸 의뢰</h4>' + (fin.length ? fin.map(row).join('') : '<p>아직 없습니다.</p>') + '<p class="ql-sp">반짝 조각 ' + sparks() + ' / ' + sparkMax() + ' · 진정시킨 친구 ' + Object.keys(w.calm).length + ' / ' + G.wild.length + '</p>', buttons: [['닫기', null, 1]] });
  }
  function bigMap() {
    GB.openPop({ title: '해솔항 지도', w: 1440, body: b => { const cv = el('canvas', 'w-bigmap', b); cv.width = 1360; cv.height = 700; drawMap(cv, true); }, buttons: [['닫기', null, 1]] });
  }

  // ── 지도 ──
  function baseMap() {
    if (MB) return MB; const m = W3.map, SC = 4, b = m.bounds, w = Math.round((b[1] - b[0]) * SC), h = Math.round((b[3] - b[2]) * SC), c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'), X = x => (x - b[0]) * SC, Z = z => (z - b[2]) * SC, R = (r, col) => { g.fillStyle = col; g.fillRect(X(r[0]), Z(r[2]), (r[1] - r[0]) * SC, (r[3] - r[2]) * SC); };
    g.fillStyle = '#05070d'; g.fillRect(0, 0, w, h);
    m.roads.forEach(r => R(r, '#3a4254')); m.blocks.forEach(r => { R(r, '#141824'); g.strokeStyle = '#2c3446'; g.lineWidth = 1; g.strokeRect(X(r[0]), Z(r[2]), (r[1] - r[0]) * SC, (r[3] - r[2]) * SC); });
    m.water.forEach(r => R(r, '#0a1830')); m.pier.forEach(r => R(r, '#7a7f66'));
    g.fillStyle = '#dfff1a'; g.globalAlpha = .55; g.fillRect(X(-3), Z(24), 6 * SC, 2 * SC); g.globalAlpha = 1;
    return (MB = { c: c, SC: SC, b: b });
  }
  function markers() {
    const out = [], w = ws(), tr = objectives(), ping = P.pingT > 0;
    tr.forEach((o, i) => { if (o.at) out.push({ x: o.at[0], z: o.at[1], k: i === 0 ? 'main' : o.side ? 'side' : 'main2' }); });
    Object.keys(npcs).forEach(id => out.push({ x: npcs[id].a.x, z: npcs[id].a.z, k: 'npc' }));
    wilds.forEach(wd => {
      if (wd.d.rare || ping || hyp(wd.a.x - P.x, wd.a.z - P.z) < 24) {
        out.push({ x: wd.a.x, z: wd.a.z, k: wd.d.rare ? 'rare' : 'wild' });
      }
    });
    pickups.forEach(p => { if (ping || hyp(p.x - P.x, p.z - P.z) < 16) out.push({ x: p.x, z: p.z, k: 'spark' }); });
    out.push({ x: W3.spec.office[0], z: W3.spec.office[1], k: 'office' }); out.push({ x: W3.spec.roofDoor[0], z: W3.spec.roofDoor[1], k: 'door' });
    return out;
  }
  const MK = { main: ['#dfff1a', 8], main2: ['#dfff1a', 6], side: ['#ffffff', 6], npc: ['#a3acbf', 4], wild: ['#ff3b4e', 6], rare: ['#c8a4ff', 7], spark: ['#eaffa0', 3.5], office: ['#ffffff', 5], door: ['#ffffff', 5] };
  function paintMarker(g, kind, [x, z], full) {
    const [color, size] = MK[kind];
    g.fillStyle = color; g.beginPath();
    if (kind === 'main' || kind === 'main2' || kind === 'rare') {
      const wide = full ? size : size * 1.1, tall = full ? size * 1.6 : size * 1.7;
      g.moveTo(x, z - tall); g.lineTo(x + wide, z); g.lineTo(x, z + tall); g.lineTo(x - wide, z); g.closePath();
    } else g.arc(x, z, full ? size * 1.3 : size * 1.2, 0, 7);
    g.fill();
  }
  function drawMap(cv, full) {
    const g = cv.getContext('2d'), M = baseMap(), W = cv.width, Hh = cv.height, mk = markers();
    g.clearRect(0, 0, W, Hh);
    if (full) {
      const sc = Math.min(W / M.c.width, Hh / M.c.height); g.fillStyle = '#05070d'; g.fillRect(0, 0, W, Hh); const ox = (W - M.c.width * sc) / 2, oy = (Hh - M.c.height * sc) / 2;
      g.drawImage(M.c, ox, oy, M.c.width * sc, M.c.height * sc); const to = (x, z) => [ox + (x - M.b[0]) * M.SC * sc, oy + (z - M.b[2]) * M.SC * sc];
      mk.forEach(m => paintMarker(g, m.k, to(m.x, m.z), true));
      const pp = to(P.x, P.z); g.save(); g.translate(pp[0], pp[1]); g.rotate(Math.atan2(Math.sin(P.yaw), -Math.cos(P.yaw)) + 0); g.fillStyle = '#fff'; g.strokeStyle = '#05070d'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, -12); g.lineTo(9, 10); g.lineTo(0, 5); g.lineTo(-9, 10); g.closePath(); g.fill(); g.stroke(); g.restore();
      g.fillStyle = '#c8d4ff'; g.font = '800 26px Pretendard, "Malgun Gothic", sans-serif'; [['해솔로 큰길', -2, -2], ['골목', -37, -26], ['부두', -2, 32], ['화물 마당', 50, 20], ['옥상 상가', 31, -16], ['해솔 언덕', 100, -2]].forEach(a => { const p = to(a[1], a[2]); g.textAlign = 'center'; g.fillText(a[0], p[0], p[1]); });
      return;
    }
    const ms = 5, cx = W / 2, cy = Hh / 2, R = W / 2 - 6, a = PI + P.yaw, ca = Math.cos(a), sa = Math.sin(a);
    g.save(); g.beginPath(); g.arc(cx, cy, R, 0, 7); g.clip(); g.fillStyle = '#05070d'; g.fillRect(0, 0, W, Hh);
    g.setTransform(ca, sa, -sa, ca, cx, cy); g.scale(ms / M.SC, ms / M.SC); g.translate(-(P.x - M.b[0]) * M.SC, -(P.z - M.b[2]) * M.SC); g.drawImage(M.c, 0, 0); g.restore();
    const to = (x, z) => { const dx = (x - P.x) * ms, dz = (z - P.z) * ms; return [cx + dx * ca - dz * sa, cy + dx * sa + dz * ca]; };
    g.save(); g.beginPath(); g.arc(cx, cy, R, 0, 7); g.clip();
    mk.forEach(m => { const p = to(m.x, m.z), d = hyp(p[0] - cx, p[1] - cy), s = MK[m.k]; if (d > R - s[1]) { if (m.k !== 'main') return; const an = Math.atan2(p[1] - cy, p[0] - cx), qx = cx + Math.cos(an) * (R - 10), qy = cy + Math.sin(an) * (R - 10); g.save(); g.translate(qx, qy); g.rotate(an + PI / 2); g.fillStyle = '#dfff1a'; g.beginPath(); g.moveTo(0, -10); g.lineTo(9, 8); g.lineTo(-9, 8); g.closePath(); g.fill(); g.restore(); return; }
      paintMarker(g, m.k, p, false); });
    g.restore();
    g.fillStyle = '#ffffff'; g.strokeStyle = '#05070d'; g.lineWidth = 3; g.beginPath(); g.moveTo(cx, cy - 15); g.lineTo(cx + 11, cy + 12); g.lineTo(cx, cy + 6); g.lineTo(cx - 11, cy + 12); g.closePath(); g.fill(); g.stroke();
    g.strokeStyle = 'rgba(223,255,26,.95)'; g.lineWidth = 5; g.beginPath(); g.arc(cx, cy, R, 0, 7); g.stroke();
  }
  let hudT = 0, lastZone = '', lastObj = '';
  function hudTick(dt) {
    hudT += dt; if (!H.cv) return;
    drawMap(H.cv, false);
    { const a = PI + P.yaw; H.north.style.left = (135 + 128 * Math.sin(a)).toFixed(1) + 'px'; H.north.style.top = (135 - 128 * Math.cos(a)).toFixed(1) + 'px'; }
    const z = W3.zoneAt(P.x, P.z, P.gy).name; if (z !== lastZone) { if (lastZone) snd('next'); lastZone = z; H.loc.querySelector('b').textContent = z; H.zone.textContent = z; }
    const o = objectives()[0]; const key = o ? o.q.id + o.sub : 'none'; if (key !== lastObj || chase) { lastObj = key; H.obj.style.display = o ? '' : 'none'; if (o) { H.obj.querySelector('small').textContent = (o.q.main ? '사건 ' + o.q.main : '곁가지') + ' · ' + o.q.title; H.obj.querySelector('b').textContent = o.sub; } drawQuests(); }
    if (o && o.at) { const dx = o.at[0] - P.x, dz = o.at[1] - P.z, fx = Math.sin(P.yaw), fz = Math.cos(P.yaw), ff = dx * fx + dz * fz, rr = -dx * fz + dz * fx; H.obj.querySelector('.arr').style.transform = 'rotate(' + (Math.atan2(rr, ff) * 180 / PI).toFixed(1) + 'deg)'; H.obj.querySelector('em').textContent = Math.round(hyp(dx, dz)) + ' m'; } else if (o) H.obj.querySelector('em').textContent = '';
    updateTags();
  }
  function updateTags() {
    const list = [];
    Object.keys(npcs).forEach(id => { const n = npcs[id], q = G.quests.find(x => x.giver === id && unlocked(x) && qstep(x.id) === 0 && !x.auto); list.push({ x: n.a.x, z: n.a.z, h: SZ(n.def.model) + .45, gy: 0, name: nameOf(id), mark: q ? '!' : '', cls: '' }); });
    wilds.forEach(w => list.push({ x: w.a.x, z: w.a.z, h: SZ(w.d.monster) + .5, gy: 0,
      name: w.d.rare ? '희귀 · ' + w.d.name : '불안한 ' + w.d.name,
      mark: w.d.rare ? '◇' : '', cls: 'wild', need: w.seen }));
    if (boss) list.push({ x: boss.a.x, z: boss.a.z, h: SZ(boss.q.boss.monster) * 1.35 + .6, gy: boss.a.gy || 0, name: '불안한 ' + boss.q.boss.name, mark: '!', cls: 'wild boss' });
    const fx = Math.sin(P.yaw), fz = Math.cos(P.yaw);
    while (tags.length < list.length) tags.push(el('div', 'w-tag', H.tags, '<i></i><span></span>'));
    tags.forEach((e, i) => {
      const L = list[i]; if (!L) { e.style.display = 'none'; return; }
      const d = hyp(L.x - P.x, L.z - P.z), ff = (L.x - P.x) * fx + (L.z - P.z) * fz;
      if (d > (L.cls ? 14 : 16) || ff < 0 || Math.abs((L.gy || 0) - P.gy) > 3 || (L.cls && L.need === false && d > 9)) { e.style.display = 'none'; return; }
      const p = S.project(L.x, L.h, L.z); e.style.display = ''; e.style.left = p.x + 'px'; e.style.top = p.y + 'px'; e.className = 'w-tag ' + L.cls;
      e.firstChild.textContent = L.mark; e.firstChild.style.display = L.mark ? '' : 'none'; e.lastChild.textContent = L.name;
    });
  }

  // ── 자판과 마우스 ──
  function clearKeys() { Object.keys(keys).forEach(k => { keys[k] = false; }); }
  function key(e) {
    if (!on) return; const c = e.code;
    if (c === 'Tab') { e.preventDefault(); if (!fighting) menu(); return; }
    if (c === 'Escape') { if (!fighting) menu(); return; }
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight'].indexOf(c) >= 0) { keys[c] = true; e.preventDefault(); return; }
    if (fighting) return;
    if (c === 'KeyF' || c === 'Enter') { e.preventDefault(); if (cand) cand.fn(); }
    else if (c === 'Digit1') { if (GB.save.lead !== 'arthur') swapLead(); }
    else if (c === 'Digit2') { if (GB.save.lead !== 'eri') swapLead(); }
    else if (c === 'Digit3') pulse();
    else if (c === 'KeyM') bigMap(); else if (c === 'KeyJ') questLog();
  }
  addEventListener('keyup', e => { if (e.code in keys) keys[e.code] = false; });
  addEventListener('blur', clearKeys);
  addEventListener('beforeunload', () => { if (on && !fighting) saveNow(); });
  hud.addEventListener('mousedown', e => { if (!on || e.target !== hud) return; drag.on = true; drag.x = e.clientX; });
  addEventListener('mousemove', e => { if (!drag.on) return; P.yaw -= (e.clientX - drag.x) * .006; drag.x = e.clientX; P.camAt = t; });
  addEventListener('mouseup', () => { drag.on = false; });
  hud.addEventListener('wheel', e => { if (!on) return; P.zoom = clamp(P.zoom + (e.deltaY > 0 ? .08 : -.08), .6, 1.5); S.zoom(P.zoom, false); e.preventDefault(); }, { passive: false });

  // ── 확인용: 주소 끝에 ?go=world&at=x,z&yaw=도&set=sign:1,alley:3&party=malangbul&friends=… ──
  const U = new URLSearchParams(location.search);
  function debugStart() {
    const sv = GB.save, w = ws(); sv.seen.opening = 1; sv.seen.g_world = U.get('guide') ? 0 : 1;
    (U.get('set') || '').split(',').filter(Boolean).forEach(s => { const a = s.split(':'); w.q[a[0]] = Number(a[1]); });
    (U.get('friends') || '').split(',').filter(Boolean).forEach(k => giveFriend(k)); if (U.get('party') != null) sv.party = U.get('party').split(',').filter(Boolean);
    if (U.get('lead')) sv.lead = U.get('lead'); if (U.get('calm')) U.get('calm').split(',').forEach(k => { w.calm[k] = 1; });
    const at = (U.get('at') || '-13,-4.6').split(',').map(Number); w.started = 1; w.at = [at[0], at[1], at[2] || 0];
    if (U.get('yaw')) P.yaw = Number(U.get('yaw')) * PI / 180; if (U.get('cam')) P.zoom = Number(U.get('cam'));
    sv.fx = sv.fx || 0;
    enter(); const after = U.get('open');   // &open=map|quest|menu: 그 창을 연 화면
    if (after) { const iv = setInterval(() => { if (on) { clearInterval(iv); setTimeout(() => { if (after === 'map') bigMap(); else if (after === 'quest') questLog(); else if (after === 'menu') menu(); else if (after === 'dex') dex(); else if (after === 'flash') encounter({ banner: '불안한 보리와 마주쳤다!', id: 'x', title: 'x', monster: 'bori', arena: 'plaza', duel: wildDuel(G.wild[0]), wild: wilds[0] }); }, 400); } }, 200); }
  }
  if (U.get('go') === 'world') setTimeout(debugStart, 60);

  return { prepare: prepare, begin: begin, enter: enter, resume: resume, suspend: suspend, finish: finish, key: key, active: () => on, openMenu: menu, questLog: questLog, bigMap: bigMap,
    refreshCompanion, canShowEvolution: () => on && !fighting && !rewardPending && !modal(),
    state: () => ({ on: on, P: P, q: ws().q, calm: ws().calm, got: ws().got.length, notes: ws().notes.length, cand: cand && cand.text, fighting: fighting, wilds: wilds.map(w => [w.d.id, +w.a.x.toFixed(1), +w.a.z.toFixed(1)]), boss: boss && [boss.a.x, boss.a.z], chase: chase && { t: chase.t, i: chase.i }, friends: GB.save.friends, party: party(), zone: W3.zoneAt(P.x, P.z, P.gy).id }),
    tp: (x, z, gy) => { P.x = x; P.z = z; P.gy = gy || 0; S.look(x, z, true, P.gy); }, talk: talk, interact: () => { if (cand) cand.fn(); return cand && cand.text; }, objectives: objectives, set: (id, s) => { ws().q[id] = s; GB.store(); }, hold: keys, camera: () => P, fightNow: id => { const q = quest(id); if (q && q.boss) { if (!boss) spawnBoss(q); P.x = boss.a.x - 5; P.z = boss.a.z; } } };
})();
