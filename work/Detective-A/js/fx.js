'use strict';
/* 2D 효과 그림(A안 훈련 연출). 캔버스에 직접 그린다: 칼자국 곡선, 글자 조각, 쪽지, 불꽃, 잉크 번짐, 번개, 속도선, 충격 프레임, 필살기 컷인.
   시간은 게임 시간(dt)으로만 흐른다. 그래서 일시정지·2배속·시간 흘려보내기(Stage3D.warp)에서도 같은 모양이 나온다.
   좌표는 모두 1920×1080 화면 기준 {x, y}. 한 번에 화면을 가리는 하얀 번쩍임은 쓰지 않는다. 충격 프레임은 어두운 바탕에 흰 선이다. */
window.FX = (function () {
  const TAU = Math.PI * 2, W = 1920, H = 1080;
  const clamp = (v, a, b) => Math.max(a == null ? 0 : a, Math.min(b == null ? 1 : b, v)), ease = k => 1 - Math.pow(1 - clamp(k), 3), lerp = (a, b, k) => a + (b - a) * k;
  const FONT = "'Pretendard','Noto Sans KR','Malgun Gothic',sans-serif";
  let cv = null, ctx = null, list = [], impactN = 0, dimA = 0, dimTo = 0, vigA = 0, vigTo = 0, reduced = false;
  const imgs = {};
  function load(src) { if (!imgs[src]) { const i = new Image(); i.src = window.ArchiveImage(src); imgs[src] = i; } return imgs[src]; }

  function init(canvas) { cv = canvas; ctx = cv.getContext('2d'); }
  function clear() { list = []; impactN = 0; dimA = dimTo = 0; vigA = vigTo = 0; if (ctx) ctx.clearRect(0, 0, W, H); }
  function setReduced(v) { reduced = !!v; }
  function add(dur, fn, o) { const e = { t: 0, dur: dur, fn: fn, o: o || {} }; list.push(e); return e; }
  function busy() { return list.length > 0 || impactN > 0; }

  // 게임 시간이 d만큼 흐름
  function update(d) {
    if (!ctx) return;
    dimA += (dimTo - dimA) * Math.min(1, d * 9); vigA += (vigTo - vigA) * Math.min(1, d * 7);
    list.forEach(e => { e.t += d; });
    list = list.filter(e => e.t < e.dur + (e.o.hold || 0));
    draw();
  }
  // 장면이 멈춘 동안(큰 타격의 멈춤): 충격 프레임만 센다
  function hold() { if (!ctx) return; draw(); if (impactN > 0) impactN--; }
  function dim(a) { dimTo = reduced ? 0 : a; }
  function vignette(a) { vigTo = a; }
  function impact(n) { if (!reduced) impactN = n == null ? 2 : n; }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    if (dimA > .01) { ctx.fillStyle = 'rgba(4,8,30,' + dimA.toFixed(3) + ')'; ctx.fillRect(0, 0, W, H); }
    if (vigA > .01) { const g = ctx.createRadialGradient(W / 2, H / 2, 420, W / 2, H / 2, 1100); g.addColorStop(0, 'rgba(120,0,20,0)'); g.addColorStop(1, 'rgba(150,10,30,' + (vigA * .7).toFixed(3) + ')'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
    list.forEach(e => { ctx.save(); e.fn(ctx, clamp(e.t / e.dur), e.t, e.o); ctx.restore(); });
    if (impactN > 0) drawImpact();
  }
  // 충격 프레임: 어두운 바탕에 흰 방사선과 대각선 두 줄(두 프레임만 보인다)
  function drawImpact() {
    ctx.fillStyle = 'rgba(6,8,22,.88)'; ctx.fillRect(0, 0, W, H);
    const cx = impactAt.x, cy = impactAt.y, r = rngf(7); ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 46; i++) { const a = i / 46 * TAU + r() * .1, r0 = 70 + r() * 90, r1 = 700 + r() * 600, w = .018 + r() * .03; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a - w) * r1, cy + Math.sin(a - w) * r1); ctx.lineTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); ctx.lineTo(cx + Math.cos(a + w) * r1, cy + Math.sin(a + w) * r1); ctx.fill(); }
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 16; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx - 520, cy + 300); ctx.lineTo(cx + 520, cy - 300); ctx.stroke();
    ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(cx - 460, cy - 280); ctx.lineTo(cx + 460, cy + 280); ctx.stroke();
  }
  let impactAt = { x: W / 2, y: H / 2 };
  function impactPos(p) { impactAt = p; }

  function rngf(seed) { let s = (seed | 0) || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) | 0; return ((s >>> 0) % 100000) / 100000; }; }
  const bez = (p0, c, p1, u) => { const a = (1 - u) * (1 - u), b = 2 * (1 - u) * u, d = u * u; return { x: a * p0.x + b * c.x + d * p1.x, y: a * p0.y + b * c.y + d * p1.y }; };
  const ctrl = (p0, p1, bend) => { const dx = p1.x - p0.x, dy = p1.y - p0.y, l = Math.hypot(dx, dy) || 1; return { x: (p0.x + p1.x) / 2 - dy / l * bend * l, y: (p0.y + p1.y) / 2 + dx / l * bend * l }; };
  // 양끝이 뾰족한 붓 자국(점 목록을 따라 굵기가 바뀐다)
  function brush(c, pts, w, fill, glowC) {
    const n = pts.length; if (n < 3) return; const L = [], R = [];
    for (let i = 0; i < n; i++) {
      const q = pts[Math.min(n - 1, i + 1)], o = pts[Math.max(0, i - 1)], dx = q.x - o.x, dy = q.y - o.y, d = Math.hypot(dx, dy) || 1, u = i / (n - 1), ww = Math.max(.4, w * Math.pow(Math.sin(Math.PI * u), .7) / 2);
      L.push({ x: pts[i].x - dy / d * ww, y: pts[i].y + dx / d * ww }); R.push({ x: pts[i].x + dy / d * ww, y: pts[i].y - dx / d * ww });
    }
    c.beginPath(); c.moveTo(L[0].x, L[0].y); for (let i = 1; i < n; i++) c.lineTo(L[i].x, L[i].y); for (let i = n - 1; i >= 0; i--) c.lineTo(R[i].x, R[i].y); c.closePath();
    if (glowC) { c.shadowColor = glowC; c.shadowBlur = 22; } c.fillStyle = fill; c.fill();
  }
  // p0에서 p1로 휘어 가며 그어지는 한 획. k는 0~1
  function sweep(c, p0, p1, bend, w, fill, k, glowC, trail) {
    trail = trail == null ? .6 : trail; const head = ease(k) * (1 + trail), u0 = clamp(head - trail), u1 = clamp(head); if (u1 - u0 < .03) return;
    const cp = ctrl(p0, p1, bend), pts = []; for (let i = 0; i <= 16; i++) pts.push(bez(p0, cp, p1, lerp(u0, u1, i / 16)));
    c.globalAlpha = k > .72 ? 1 - (k - .72) / .28 : 1; brush(c, pts, w, fill, glowC); c.globalAlpha = 1;
  }
  const dirOf = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
  const polar = (p, a, r) => ({ x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r });

  // ── 인물별 일반 기술 ──
  // 아서: 금빛 칼자국 곡선 두 줄이 엇갈린다
  function slash(at, o) {
    o = o || {}; const big = o.size || 1, col = o.color || '#ffd95a', n = reduced ? 1 : (o.n || 2);
    for (let i = 0; i < n; i++) {
      const ang = (o.ang == null ? -.6 : o.ang) + i * 1.25, len = 330 * big, d = (o.delay || 0) + i * .07;
      add(.34 + d, (c, k, t) => { const kk = clamp((t - d) / .34); if (t < d) return; sweep(c, polar(at, ang + Math.PI, len / 2), polar(at, ang, len / 2), i ? -.22 : .22, 40 * big, col, kk, col); });
    }
    spark(at, col, o.size || 1, o.delay || 0);
  }
  // 칼자국 끝에서 튀는 가는 선
  function spark(at, col, s, delay) {
    const r = rngf(Math.floor(at.x + at.y)); const n = reduced ? 5 : 10;
    for (let i = 0; i < n; i++) { const a = r() * TAU, l = (80 + r() * 90) * s; add(.3 + delay, (c, k, t) => { const kk = clamp((t - delay) / .3); if (t < delay) return; c.strokeStyle = col; c.lineWidth = 5 * (1 - kk); c.lineCap = 'round'; c.beginPath(); c.moveTo(at.x + Math.cos(a) * l * .35 * kk, at.y + Math.sin(a) * l * .35 * kk); c.lineTo(at.x + Math.cos(a) * l * ease(kk), at.y + Math.sin(a) * l * ease(kk)); c.stroke(); }); }
  }
  // 에리: 수첩에서 글자 조각과 쪽지가 날아가 박힌다
  function chars(from, to, o) {
    o = o || {}; const words = (o.words || '단서증거').split(''), n = reduced ? Math.min(3, words.length) : words.length + 2;
    for (let i = 0; i < n; i++) {
      const d = i * .05, ch = words[i % words.length], paper = i >= words.length, bend = (i % 2 ? .35 : -.3), a0 = (i - n / 2) * .4;
      add(.5 + d, (c, k, t) => {
        const kk = clamp((t - d) / .5); if (t < d) return; const f = ease(Math.min(1, kk / .72)), cp = ctrl(from, to, bend), p = bez(from, cp, to, f), rot = a0 + kk * 6;
        c.translate(p.x, p.y); c.rotate(rot);
        if (paper) { c.fillStyle = '#fff4d6'; c.strokeStyle = '#6b5a3a'; c.lineWidth = 3; c.fillRect(-34, -44, 68, 88); c.strokeRect(-34, -44, 68, 88); c.fillStyle = '#6b5a3a'; for (let j = 0; j < 4; j++) c.fillRect(-24, -30 + j * 18, 48, 4); }
        else { c.font = '900 ' + (kk > .72 ? 64 + (kk - .72) * 200 : 64) + 'px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = 10; c.strokeStyle = '#14213f'; c.strokeText(ch, 0, 0); c.fillStyle = '#ffffff'; c.fillText(ch, 0, 0); }
        if (kk > .72) { c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1 - (kk - .72) / .28; c.strokeStyle = '#9fe3d8'; c.lineWidth = 4; for (let j = 0; j < 6; j++) { const a = j / 6 * TAU, l = 30 + (kk - .72) * 220; c.beginPath(); c.moveTo(to.x + Math.cos(a) * 18, to.y + Math.sin(a) * 18); c.lineTo(to.x + Math.cos(a) * l, to.y + Math.sin(a) * l); c.stroke(); } }
      });
    }
  }
  // 말랑불: 불꽃 혀가 휘감겨 날아가 번진다
  function flame(from, to, o) {
    o = o || {}; const n = reduced ? 3 : 6, s = o.size || 1;
    for (let i = 0; i < n; i++) {
      const d = i * .045, bend = (i % 2 ? .3 : -.25) * (1 + i * .08);
      add(.46 + d, (c, k, t) => {
        const kk = clamp((t - d) / .46); if (t < d) return; const f = ease(Math.min(1, kk / .75)), cp = ctrl(from, to, bend), p = bez(from, cp, to, f), p2 = bez(from, cp, to, Math.max(0, f - .06)), a = dirOf(p2, p), life = kk > .75 ? 1 - (kk - .75) / .25 : 1;
        c.globalAlpha = life; c.translate(p.x, p.y); c.rotate(a); const L = (70 + (i % 3) * 22) * s, Wd = 30 * s, g = c.createLinearGradient(-L, 0, L * .3, 0); g.addColorStop(0, 'rgba(255,90,20,0)'); g.addColorStop(.5, '#ff9d3c'); g.addColorStop(1, '#fff3a0');
        c.shadowColor = '#ff8a1e'; c.shadowBlur = 20; c.fillStyle = g; c.beginPath(); c.moveTo(L * .3, 0); c.bezierCurveTo(0, -Wd, -L * .6, -Wd * .5, -L, 0); c.bezierCurveTo(-L * .6, Wd * .5, 0, Wd, L * .3, 0); c.fill();
        if (kk > .75) { c.setTransform(1, 0, 0, 1, 0, 0); for (let j = 0; j < 5; j++) { const bx = to.x + (j - 2) * 34, h = (50 + (j % 2) * 30) * (1 + (kk - .75) * 2) * s; c.fillStyle = '#ffb347'; c.beginPath(); c.moveTo(bx - 14, to.y + 20); c.quadraticCurveTo(bx - 10, to.y - h * .5, bx + (j % 2 ? 10 : -10), to.y - h); c.quadraticCurveTo(bx + 16, to.y - h * .4, bx + 14, to.y + 20); c.fill(); } }
      });
    }
  }
  // 방울이: 잉크 같은 물줄기가 그어지고 번진다
  function ink(from, to, o) {
    o = o || {}; const col = o.color || '#58b4ff', s = o.size || 1, r = rngf(Math.floor(to.x));
    add(.26, (c, k) => sweep(c, from, to, .22, 46 * s, col, k, '#9ad2ff', .3));
    const blob = []; for (let i = 0; i < 16; i++) blob.push(.6 + r() * .7);
    add(.55, (c, k, t) => {
      const kk = clamp((t - .2) / .35); if (t < .2) return; const sc = ease(kk), rad = 70 * s * sc; c.globalAlpha = kk > .6 ? 1 - (kk - .6) / .4 : 1; c.fillStyle = col; c.shadowColor = '#9ad2ff'; c.shadowBlur = 14;
      c.beginPath(); for (let i = 0; i <= 16; i++) { const a = i / 16 * TAU, rr = rad * blob[i % 16]; c[i ? 'lineTo' : 'moveTo'](to.x + Math.cos(a) * rr, to.y + Math.sin(a) * rr); } c.closePath(); c.fill();
      const dr = reduced ? 5 : 11; for (let i = 0; i < dr; i++) { const a = i / dr * TAU + .3, l = (90 + (i % 3) * 40) * s * sc; c.save(); c.translate(to.x + Math.cos(a) * l, to.y + Math.sin(a) * l); c.rotate(a); c.beginPath(); c.ellipse(0, 0, 18 * s * (1 - kk * .4), 7 * s, 0, 0, TAU); c.fill(); c.restore(); }
      c.fillRect(to.x - 6, to.y + rad * .6, 12, 90 * sc * s);
    });
  }
  // 몽글번개: 꺾인 굵은 번개가 흔들리며 내리친다
  function zig(from, to, o) {
    o = o || {}; const col = o.color || '#ffe94d', n = reduced ? 1 : (o.n || 2);
    for (let b = 0; b < n; b++) {
      const d = b * .06;
      add(.32 + d, (c, k, t) => {
        if (t < d) return; const kk = clamp((t - d) / .32), seed = Math.floor(t * 22) + b * 5, r = rngf(seed), pts = [from], N = 9, dx = to.x - from.x, dy = to.y - from.y, l = Math.hypot(dx, dy) || 1, shown = Math.max(1, Math.floor(N * Math.min(1, kk / .5)));
        for (let i = 1; i <= shown; i++) { const u = i / N, off = (r() - .5) * 120 * (1 - u * .4); pts.push({ x: from.x + dx * u - dy / l * off, y: from.y + dy * u + dx / l * off }); }
        c.globalAlpha = kk > .6 ? 1 - (kk - .6) / .4 : 1; c.lineJoin = 'miter'; c.lineCap = 'round';
        [[26, col, .35], [11, col, 1], [4, '#ffffff', 1]].forEach(s => { c.strokeStyle = s[1]; c.globalAlpha *= 1; c.lineWidth = s[0]; c.beginPath(); pts.forEach((p, i) => c[i ? 'lineTo' : 'moveTo'](p.x, p.y)); c.stroke(); });
        if (kk > .45) { c.globalAlpha = 1 - (kk - .45) / .55; c.strokeStyle = col; c.lineWidth = 5; for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, l2 = 40 + r() * 70; c.beginPath(); c.moveTo(to.x + Math.cos(a) * 14, to.y + Math.sin(a) * 14); c.lineTo(to.x + Math.cos(a) * l2 * .5, to.y + Math.sin(a) * l2 * .5 + (r() - .5) * 30); c.lineTo(to.x + Math.cos(a) * l2, to.y + Math.sin(a) * l2); c.stroke(); } }
      });
    }
  }
  // 상대의 공격: 할퀸 자국 셋, 수정 조각, 번개, 먹 번짐 가운데 상대마다 하나
  function foeMark(kind, from, to, o) {
    o = o || {}; const big = o.big ? 1.5 : 1;
    if (kind === 'zig') { zig(from, to, { color: '#ffe94d', n: 1 }); return; }
    if (kind === 'ink') { ink(from, to, { color: '#2b5fae', size: .9 * big }); return; }
    if (kind === 'shard') {
      const r = rngf(Math.floor(to.x)), n = reduced ? 3 : 6;
      for (let i = 0; i < n; i++) { const d = i * .04, a0 = (r() - .5) * 1.2, sz = 20 + r() * 20; add(.36 + d, (c, k, t) => { if (t < d) return; const kk = clamp((t - d) / .36), f = ease(kk), p = { x: lerp(from.x, to.x, f) + Math.sin(f * 6 + i) * 30, y: lerp(from.y, to.y, f) + Math.cos(f * 5 + i) * 24 }; c.globalAlpha = kk > .8 ? 1 - (kk - .8) / .2 : 1; c.translate(p.x, p.y); c.rotate(a0 + kk * 7); c.fillStyle = i % 2 ? '#d8d2ff' : '#ffffff'; c.strokeStyle = '#4a3d8f'; c.lineWidth = 3; c.beginPath(); c.moveTo(0, -sz); c.lineTo(sz * .55, 0); c.lineTo(0, sz * 1.1); c.lineTo(-sz * .5, 0); c.closePath(); c.fill(); c.stroke(); }); }
      return;
    }
    // 할퀸 자국: 날아간 붓 자국이 닿으면 평행한 선 셋이 그어진다
    add(.22, (c, k) => sweep(c, from, to, .18, 22, '#e0526a', k, '#e0526a', .35));
    for (let i = 0; i < 3; i++) { const d = .18 + i * .05, off = (i - 1) * 34; add(.3 + d, (c, k, t) => { if (t < d) return; const kk = clamp((t - d) / .3); sweep(c, { x: to.x - 70 + off * .5, y: to.y - 80 + off }, { x: to.x + 70 + off * .5, y: to.y + 80 + off }, .08, 18 * big, '#fff1f3', kk, '#e0526a', .5); }); }
  }
  // 방어: 금빛 괄호 모양 두 줄이 팀 앞에 펼쳐진다
  function guard(at) {
    add(.6, (c, k) => {
      const e = ease(k), a = k > .6 ? 1 - (k - .6) / .4 : 1; c.globalAlpha = a; c.strokeStyle = '#f2c14e'; c.lineCap = 'round'; c.shadowColor = '#f2c14e'; c.shadowBlur = 16;
      [0, 1].forEach(j => { const r = 120 + j * 55 + e * 40; c.lineWidth = 14 - j * 5; c.beginPath(); c.arc(at.x + 40, at.y, r, -.9, .9); c.stroke(); c.beginPath(); c.arc(at.x - 40, at.y, r, Math.PI - .9, Math.PI + .9); c.stroke(); });
      c.fillStyle = 'rgba(242,193,78,.85)'; for (let i = 0; i < 3; i++) { const y = at.y - 60 + i * 60; c.beginPath(); c.moveTo(at.x + 150 + e * 30, y - 24); c.lineTo(at.x + 178 + e * 30, y); c.lineTo(at.x + 150 + e * 30, y + 24); c.lineTo(at.x + 160 + e * 30, y); c.closePath(); c.fill(); }
    });
  }
  // 관찰: 돋보기 눈금과 약점 표시
  function scan(at, label, color) {
    add(.9, (c, k, t) => {
      const a = k > .75 ? 1 - (k - .75) / .25 : 1, e = ease(Math.min(1, k * 2)); c.globalAlpha = a; c.strokeStyle = color || '#9db0f0'; c.lineWidth = 6; c.lineCap = 'round'; c.shadowColor = c.strokeStyle; c.shadowBlur = 12;
      const w = 170 * e, h = 190 * e; [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(s => { c.beginPath(); c.moveTo(at.x + s[0] * w, at.y + s[1] * (h - 52)); c.lineTo(at.x + s[0] * w, at.y + s[1] * h); c.lineTo(at.x + s[0] * (w - 52), at.y + s[1] * h); c.stroke(); });
      const sy = at.y - h + (h * 2) * ((k * 2.2) % 1); c.lineWidth = 3; c.beginPath(); c.moveTo(at.x - w, sy); c.lineTo(at.x + w, sy); c.stroke();
      if (label) { c.shadowBlur = 0; c.font = '900 40px ' + FONT; c.textAlign = 'center'; c.lineWidth = 9; c.strokeStyle = '#14213f'; c.strokeText(label, at.x, at.y - h - 18); c.fillStyle = '#ffd95a'; c.fillText(label, at.x, at.y - h - 18); }
    });
  }
  // 두 인물을 잇는 금빛 한 줄(동료 협력)
  function link(a, b) { add(.4, (c, k) => sweep(c, a, b, .12, 16, '#f2c14e', k, '#f2c14e', .5)); }
  // 방사선(큰 타격, 큰 반응, 무너짐)
  function radial(at, o) {
    o = o || {}; const col = o.color || '#ffffff', n = reduced ? 14 : (o.n || 30), r = rngf(Math.floor(at.x + at.y) + 3), dur = o.dur || .34, rr = (o.r || 520);
    const ang = [], len = []; for (let i = 0; i < n; i++) { ang.push(i / n * TAU + r() * .12); len.push(.55 + r() * .45); }
    add(dur, (c, k) => { const e = ease(k), a = k > .5 ? 1 - (k - .5) / .5 : 1; c.globalAlpha = a * .8; c.fillStyle = col; for (let i = 0; i < n; i++) { const r0 = 60 + e * 90, r1 = r0 + rr * len[i] * e, w = .011 + .013 * len[i]; c.beginPath(); c.moveTo(at.x + Math.cos(ang[i] - w) * r1, at.y + Math.sin(ang[i] - w) * r1); c.lineTo(at.x + Math.cos(ang[i]) * r0, at.y + Math.sin(ang[i]) * r0); c.lineTo(at.x + Math.cos(ang[i] + w) * r1, at.y + Math.sin(ang[i] + w) * r1); c.fill(); } });
  }
  // 화면에 한 번 크게 박히는 글자(무너짐 등)
  function stamp(at, text, color, dur) {
    dur = dur || .9; add(dur, (c, k) => { const s = 1 + (1 - ease(Math.min(1, k * 4))) * .8, a = k > .7 ? 1 - (k - .7) / .3 : 1; c.globalAlpha = a; c.translate(at.x, at.y); c.rotate(-.06); c.scale(s, s); c.font = '900 120px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = 22; c.lineJoin = 'round'; c.strokeStyle = '#14213f'; c.strokeText(text, 0, 0); c.fillStyle = color || '#ffd95a'; c.fillText(text, 0, 0); });
  }

  // ── 스프라이트 효과: Kenney Particle Pack(CC0, assets/fx/kenney_particle_pack)의 흰 그림에 색을 입혀 겹쳐 그린다 ──
  // 탐정 소재(돋보기 빛, 단서 카드, 붉은 실, 렌즈 파편)의 효과 위에 얹는 반짝임이다. 그림이 아직 안 읽혔으면 아무것도 그리지 않는다.
  const SPR = 'assets/fx/kenney_particle_pack/', tints = {};
  function tinted(name, color) {
    const key = name + color; if (tints[key]) return tints[key];
    const im = load(SPR + name + '.png'); if (!im.complete || !im.naturalWidth) return null;
    const cv2 = document.createElement('canvas'); cv2.width = cv2.height = 256; const x = cv2.getContext('2d'); x.drawImage(im, 0, 0, 256, 256);
    const d = x.getImageData(0, 0, 256, 256), p = d.data, rgb = [color.slice(1, 3), color.slice(3, 5), color.slice(5, 7)].map(h => parseInt(h, 16));
    for (let i = 0; i < p.length; i += 4) { const lum = Math.max(p[i], p[i + 1], p[i + 2]) / 255; p[i + 3] = p[i + 3] * lum; p[i] = rgb[0]; p[i + 1] = rgb[1]; p[i + 2] = rgb[2]; }   // 알파 × 밝기: 흰 그림이든 검은 바탕의 흰 그림이든 같은 모양이 나온다
    x.putImageData(d, 0, 0); tints[key] = cv2; return cv2;
  }
  function preload(names) { names.forEach(n => load(SPR + n + '.png')); }
  // o: {color, size(px), delay, dur, spin(바퀴 수), add(참이면 겹쳐 밝게, 기본), alpha, grow(처음 크기 배율)}
  function sprFx(names, at, o) {
    o = o || {}; const list = [].concat(names), dl = o.delay || 0, dur = o.dur || .4, size = o.size || 240, col = o.color || '#ffffff', add_ = o.add !== false;
    if (reduced && o.minor) return;
    add(dur + dl, (c, k0, t) => {
      if (t < dl) return; const k = clamp((t - dl) / dur), im = tinted(list[Math.floor(k * list.length * .999) % list.length], col); if (!im) return;
      const s = size * ((o.grow == null ? .5 : o.grow) + (1 - (o.grow == null ? .5 : o.grow)) * ease(Math.min(1, k * 3))), a = (o.alpha == null ? 1 : o.alpha) * (k > .6 ? 1 - (k - .6) / .4 : 1);
      c.globalAlpha = a; if (add_) c.globalCompositeOperation = 'lighter'; c.translate(at.x, at.y); c.rotate((o.rot || 0) + (o.spin || 0) * TAU * k); c.drawImage(im, -s / 2, -s / 2, s, s);
    });
  }

  // ── 필살기 컷인: 인물 그림이 사선으로 들어오고 기술 이름이 글자별로 박힌다 ──
  // o: {img, name, sub, color}. 길이 1.15초(끝나면 스스로 사라진다)
  function cut(o) {
    const img = load(o.img), name = o.name.split(''), col = o.color || '#f2c14e', DUR = reduced ? .7 : 1.15;
    add(DUR, (c, k, t) => {
      const inK = ease(t / .26), outK = t > DUR - .17 ? ease((t - (DUR - .17)) / .17) : 0, band = inK * (1 - outK);
      // 천문 고리: 인물 뒤에서 돌며 커진다(표지의 천문 원)
      c.save(); const rs = 1 + (1 - inK) * .5 + t * .06; c.translate(1020, 540); c.globalAlpha = .75 * band; c.lineCap = 'round';
      [[330, 3], [430, 2], [540, 2]].forEach((q, j) => { c.save(); c.rotate((j % 2 ? -1 : 1) * t * .5 + j); c.strokeStyle = col; c.lineWidth = q[1] + 1; c.beginPath(); c.arc(0, 0, q[0] * rs, 0, TAU); c.stroke(); c.lineWidth = 2; for (let i = 0; i < 48; i++) { const a = i / 48 * TAU, l = i % 4 ? 12 : 26, rr = q[0] * rs; c.beginPath(); c.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); c.lineTo(Math.cos(a) * (rr + l), Math.sin(a) * (rr + l)); c.stroke(); } c.restore(); });
      c.restore();
      // 사선 이름판: 가운데에서 오른쪽 끝까지, 왼쪽 끝에 금빛 세로선
      c.save(); c.translate(W / 2, 560); c.rotate(-.2); const px = -260 + (1 - inK) * 1800 + outK * 1800; c.fillStyle = 'rgba(4,10,40,.94)'; c.fillRect(px, -190, 2400, 380);
      const g = c.createLinearGradient(-260, 0, 1000, 0); g.addColorStop(0, 'rgba(26,46,120,.9)'); g.addColorStop(1, 'rgba(232,207,147,.88)'); c.fillStyle = g; c.fillRect(px, -170, 2400, 340);
      c.fillStyle = col; c.fillRect(px, -196, 2400, 10); c.fillRect(px, 186, 2400, 10); c.fillRect(px - 26, -196, 12, 392); c.restore();
      // 반짝이는 별
      const rs2 = rngf(23); c.save(); c.fillStyle = '#f3e7c4'; for (let i = 0; i < 18; i++) { const x0 = 300 + rs2() * 1400, y0 = 200 + rs2() * 700, ph = rs2() * TAU, sz = 8 + rs2() * 16; c.globalAlpha = .8 * band * Math.max(0, Math.sin(t * 8 + ph)); c.beginPath(); c.moveTo(x0, y0 - sz); c.lineTo(x0 + sz * .25, y0 - sz * .25); c.lineTo(x0 + sz, y0); c.lineTo(x0 + sz * .25, y0 + sz * .25); c.lineTo(x0, y0 + sz); c.lineTo(x0 - sz * .25, y0 + sz * .25); c.lineTo(x0 - sz, y0); c.lineTo(x0 - sz * .25, y0 - sz * .25); c.closePath(); c.fill(); } c.restore();
      // 속도선
      const r = rngf(11); c.save(); c.globalAlpha = .5 * band; c.strokeStyle = '#ffffff'; for (let i = 0; i < 26; i++) { const y = 300 + r() * 520, x0 = 400 + r() * 1200, l = 160 + r() * 340, sh = ((t * 2400 + i * 97) % 600); c.lineWidth = 2 + r() * 3; c.beginPath(); c.moveTo(x0 + l - sh, y - (y - 560) * .1); c.lineTo(x0 - sh, y); c.stroke(); } c.restore();
      // 인물 그림: 왼쪽 아래에서 사선으로 들어와 조금 떠오르다가 오른쪽 위로 빠진다
      if (img.complete && img.naturalWidth) {
        const ih = 1180, iw = ih * img.naturalWidth / img.naturalHeight, drift = t * 36, x = 60 - (1 - inK) * 900 + outK * 700 + drift, y = 1080 - ih + 150 + (1 - inK) * 500 - outK * 260 - drift * .4;
        c.save(); c.globalAlpha = 1 - outK * .6; c.shadowColor = 'rgba(0,0,0,.6)'; c.shadowBlur = 40; c.drawImage(img, x, y, iw, ih); c.restore();
      }
      // 기술 이름
      c.save(); c.font = '900 168px ' + FONT; c.textBaseline = 'alphabetic'; c.textAlign = 'left'; c.lineJoin = 'round';
      let x = 880; const baseY = 620, sk = -.18;
      name.forEach((ch, i) => { const d = .12 + i * .05, kk = ease((t - d) / .16), w = c.measureText(ch).width + 6; if (kk > 0) { c.save(); c.globalAlpha = kk * (1 - outK); c.translate(x + (1 - kk) * 320 + outK * 500, baseY - (1 - kk) * 24); c.transform(1, 0, sk, 1, 0, 0); c.lineWidth = 30; c.strokeStyle = '#0a1240'; c.strokeText(ch, 0, 0); c.lineWidth = 12; c.strokeStyle = col; c.strokeText(ch, 0, 0); c.fillStyle = '#ffffff'; c.fillText(ch, 0, 0); c.restore(); } x += w; });
      c.font = '800 46px ' + FONT; c.globalAlpha = ease((t - .08) / .15) * (1 - outK); c.fillStyle = col; c.lineWidth = 10; c.strokeStyle = '#0a1240'; c.strokeText(o.sub || '', 890, 440); c.fillText(o.sub || '', 890, 440); c.restore();
    });
  }
  // 깨지는 수정 조각: 화면 위쪽에서 비스듬히 날아 내려오며 흩어진다(도구가 깨져 흩어지는 느낌)
  function crystals(at, power) {
    const n = reduced ? 6 : 9 * power, r = rngf(Math.floor(at.x) + 21);
    for (let i = 0; i < n; i++) {
      const d = r() * .45, x0 = -120 + r() * 1500, y0 = -140 - r() * 200, dx = 380 + r() * 380, dy = 900 + r() * 260, sz = 28 + r() * 56, a0 = r() * TAU, spin = (r() - .5) * 9, col = ['#dfeeff', '#ffffff', '#a9c4ff'][i % 3];
      add(.85 + d, (c, k, t) => {
        if (t < d) return; const kk = clamp((t - d) / .85), x = x0 + dx * kk, y = y0 + dy * kk;
        c.globalAlpha = kk > .75 ? 1 - (kk - .75) / .25 : .92; c.translate(x, y); c.rotate(a0 + spin * kk); c.fillStyle = col; c.strokeStyle = '#4a5fc1'; c.lineWidth = 4; c.shadowColor = '#bcd4ff'; c.shadowBlur = 14;
        c.beginPath(); c.moveTo(0, -sz); c.lineTo(sz * .5, -sz * .1); c.lineTo(sz * .3, sz * .9); c.lineTo(-sz * .45, sz * .5); c.lineTo(-sz * .5, -sz * .35); c.closePath(); c.fill(); c.stroke();
        c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 2; c.beginPath(); c.moveTo(-sz * .2, -sz * .4); c.lineTo(sz * .15, sz * .3); c.stroke();
      });
    }
  }
  // 쏟아지는 줄: 위에서 비스듬히 내리꽂힌다. 닿으면 작은 엑스 자국. 종류 line은 금빛 줄, paper는 쪽지
  function rain(at, power, kind) {
    const n = reduced ? 8 : 12 * power, r = rngf(Math.floor(at.y) + 5), span = .5;
    for (let i = 0; i < n; i++) {
      const d = i / n * span, tx = at.x + (r() - .5) * 560, ty = at.y + (r() - .5) * 240, ang = 1.2 + (r() - .5) * .2, len = 300 + r() * 160, fall = .2;
      add(fall + d + .3, (c, k, t) => {
        if (t < d) return; const kk = clamp((t - d) / fall), hit = t - d - fall, f = ease(kk), hx = tx - Math.cos(ang) * 900 * (1 - f), hy = ty - Math.sin(ang) * 900 * (1 - f);
        if (hit < 0) {
          if (kind === 'paper') { c.translate(hx, hy); c.rotate(i + kk * 5); c.fillStyle = '#fff4d6'; c.strokeStyle = '#6b5a3a'; c.lineWidth = 3; c.fillRect(-30, -40, 60, 80); c.strokeRect(-30, -40, 60, 80); c.fillStyle = '#6b5a3a'; for (let j = 0; j < 3; j++) c.fillRect(-20, -26 + j * 18, 40, 4); }
          else if (kind === 'cards') { const tail = { x: hx - Math.cos(ang) * len * 1.6, y: hy - Math.sin(ang) * len * 1.6 }; c.strokeStyle = '#e0526a'; c.lineWidth = 4; c.beginPath(); c.moveTo(tail.x, tail.y); c.lineTo(hx, hy); c.stroke(); c.translate(hx, hy); c.rotate(.3 + i * .4 + kk * 2); c.fillStyle = '#fff4d6'; c.strokeStyle = '#6b5a3a'; c.lineWidth = 3; c.fillRect(-34, -46, 68, 92); c.strokeRect(-34, -46, 68, 92); c.fillStyle = ['#e0526a', '#4a5fc1', '#ffd95a'][i % 3]; c.fillRect(-34, -46, 68, 20); c.fillStyle = '#6b5a3a'; c.fillRect(-22, -14, 44, 4); c.fillRect(-22, 0, 44, 4); c.fillRect(-22, 14, 30, 4); }
          else { const tail = { x: hx - Math.cos(ang) * len, y: hy - Math.sin(ang) * len }; c.strokeStyle = i % 3 ? '#ffd95a' : '#ffffff'; c.lineWidth = 9; c.lineCap = 'round'; c.shadowColor = '#ffd95a'; c.shadowBlur = 14; c.beginPath(); c.moveTo(tail.x, tail.y); c.lineTo(hx, hy); c.stroke(); }
        } else {
          const a = 1 - clamp(hit / .3); c.globalAlpha = a; c.strokeStyle = kind === 'line' ? '#fff3b0' : '#e0526a'; c.lineWidth = 7; c.lineCap = 'round'; const s = 26 + hit * 90;
          c.beginPath(); c.moveTo(tx - s, ty - s); c.lineTo(tx + s, ty + s); c.moveTo(tx + s, ty - s); c.lineTo(tx - s, ty + s); c.stroke();
        }
      });
    }
  }
  // 만화식 터짐: 뾰족한 별 모양 위에 의성어 한 글자 묶음
  function comic(at, text, color) {
    add(.7, (c, k) => {
      const s = .6 + ease(Math.min(1, k * 4)) * .6, a = k > .65 ? 1 - (k - .65) / .35 : 1, N = 18; c.globalAlpha = a; c.translate(at.x, at.y - 150); c.rotate(-.1 + k * .06); c.scale(s, s);
      c.beginPath(); for (let i = 0; i < N * 2; i++) { const an = i / (N * 2) * TAU, rr = i % 2 ? 150 : 230; c[i ? 'lineTo' : 'moveTo'](Math.cos(an) * rr, Math.sin(an) * rr * .8); } c.closePath();
      c.fillStyle = color || '#ffd95a'; c.strokeStyle = '#14213f'; c.lineWidth = 12; c.lineJoin = 'round'; c.fill(); c.stroke();
      c.font = '900 120px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = 16; c.strokeStyle = '#ffffff'; c.strokeText(text, 0, 6); c.fillStyle = '#14213f'; c.fillText(text, 0, 6);
    });
  }
  // 아서의 기술: 돋보기 렌즈에서 빛줄기가 뻗어 상대 위에 빛 점이 맺히고 반짝인다
  function lens(from, to, o) {
    o = o || {}; const s = o.size || 1, col = o.color || '#ffd95a', dur = .55, dl = o.delay || 0;
    add(dur + dl, (c, k0, t) => {
      if (t < dl) return; const k = clamp((t - dl) / dur), e = ease(Math.min(1, k / .45)), a = k > .7 ? 1 - (k - .7) / .3 : 1, ang = dirOf(from, to), L = Math.hypot(to.x - from.x, to.y - from.y) * e; c.globalAlpha = a * .85; c.translate(from.x, from.y); c.rotate(ang);
      const g = c.createLinearGradient(0, 0, L, 0); g.addColorStop(0, 'rgba(255,240,170,.9)'); g.addColorStop(1, 'rgba(255,217,90,.25)'); c.fillStyle = g; c.beginPath(); c.moveTo(0, -10); c.lineTo(L, -70 * s * e); c.lineTo(L, 70 * s * e); c.lineTo(0, 10); c.closePath(); c.fill();
      c.setTransform(1, 0, 0, 1, 0, 0); if (k > .35) { const kk = clamp((k - .35) / .65), r = 80 * s * (kk < .4 ? ease(kk / .4) : 1 - (kk - .4) * .4); c.globalAlpha = a; const sp = c.createRadialGradient(to.x, to.y, 0, to.x, to.y, r); sp.addColorStop(0, '#ffffff'); sp.addColorStop(.35, col); sp.addColorStop(1, 'rgba(255,217,90,0)'); c.fillStyle = sp; c.beginPath(); c.arc(to.x, to.y, r, 0, TAU); c.fill();
        c.strokeStyle = '#ffffff'; c.lineWidth = 6; c.lineCap = 'round'; [0, Math.PI / 2].forEach(a0 => { c.beginPath(); c.moveTo(to.x + Math.cos(a0 + .3) * r * 1.5, to.y + Math.sin(a0 + .3) * r * 1.5); c.lineTo(to.x - Math.cos(a0 + .3) * r * 1.5, to.y - Math.sin(a0 + .3) * r * 1.5); c.stroke(); }); }
    });
  }
  // 단서를 잇는 선: 압정 여러 개가 박히고 붉은 실이 이어진다. 다 이어지면 금빛으로 빛난다
  function web(at, power) {
    const n = 3 + power, r = rngf(Math.floor(at.x) + 77), pts = []; for (let i = 0; i < n; i++) { const a = i / n * TAU + r() * .5 + .4, rr = 150 + r() * 130; pts.push({ x: at.x + Math.cos(a) * rr * 1.3, y: at.y + Math.sin(a) * rr * .8 }); }
    add(.95, (c, k, t) => {
      const seg = clamp(k / .55) * n, a = k > .8 ? 1 - (k - .8) / .2 : 1; c.globalAlpha = a; c.lineCap = 'round'; c.lineJoin = 'round';
      const glow = k > .5 ? clamp((k - .5) / .15) : 0; c.strokeStyle = glow ? '#ffd95a' : '#e0526a'; c.lineWidth = 7 + glow * 5; if (glow) { c.shadowColor = '#ffd95a'; c.shadowBlur = 20; }
      c.beginPath(); c.moveTo(pts[0].x, pts[0].y); for (let i = 1; i <= n; i++) { const A = pts[i - 1], B = pts[i % n], f = clamp(seg - (i - 1)); if (f <= 0) break; c.lineTo(A.x + (B.x - A.x) * f, A.y + (B.y - A.y) * f); } c.stroke();
      c.shadowBlur = 0; pts.forEach((p, i) => { const pk = ease((seg - i + .5) / .6); if (pk <= 0) return; c.fillStyle = '#e0526a'; c.strokeStyle = '#ffffff'; c.lineWidth = 4; c.beginPath(); c.arc(p.x, p.y, 17 * pk, 0, TAU); c.fill(); c.stroke(); });
    });
  }
  // 마지막 타격 뒤 진정됨: 불안한 기운이 풀리며 작은 반짝임이 올라가고 "진정"이 박힌다
  function calm(at) {
    const r = rngf(Math.floor(at.x) + 31), n = reduced ? 8 : 22;
    for (let i = 0; i < n; i++) { const d = r() * .5, x = at.x + (r() - .5) * 360, y = at.y + 40 + r() * 80, rise = 140 + r() * 180, sz = 12 + r() * 16; add(.9 + d, (c, k, t) => { if (t < d) return; const kk = clamp((t - d) / .9), yy = y - rise * ease(kk); c.globalAlpha = Math.sin(Math.PI * kk); c.fillStyle = i % 2 ? '#fff6c8' : '#bfe6ff'; c.translate(x, yy); c.rotate(.785); c.fillRect(-sz / 2, -sz / 2, sz, sz); c.rotate(-.785); c.fillRect(-sz * .15, -sz * .9, sz * .3, sz * 1.8); c.fillRect(-sz * .9, -sz * .15, sz * 1.8, sz * .3); }); }
    stamp({ x: at.x, y: at.y - 170 }, '진정', '#bfe6ff', 1.3);
  }
  // 필살기 큰 효과: 추리 점수가 쌓일수록(power 1~3) 커진다. 아서는 칼자국과 금빛 줄, 에리는 글자와 쪽지 비. 둘 다 깨지는 수정 조각이 날린다
  function ultHit(who, at, power) {
    power = power || 1; crystals(at, power);
    if (who === 'eri') {
      const from = { x: at.x - 640, y: at.y + 360 }; chars(from, at, { words: '증거기록' }); if (power > 1) chars({ x: from.x + 120, y: from.y - 120 }, at, { words: '단서확인' });
      rain(at, power, 'paper');
      add(.9, (c, k) => { c.globalAlpha = k > .6 ? 1 - (k - .6) / .4 : 1; const s = 1 + (1 - ease(Math.min(1, k * 3))) * 1.2; c.translate(at.x, at.y - 40); c.rotate(-.12); c.scale(s, s); c.strokeStyle = '#e0526a'; c.lineWidth = 16; c.fillStyle = 'rgba(224,82,106,.12)'; c.strokeRect(-130, -80, 260, 160); c.font = '900 120px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#e0526a'; c.fillText('증거', 0, 6); });
    } else {
      web(at, power); const spots = [[-200, -80], [210, -40], [0, 120], [-60, -170], [150, 150]].slice(0, 2 + power);
      spots.forEach((s, i) => lens({ x: at.x - 700 + i * 60, y: at.y + 420 - i * 40 }, { x: at.x + s[0], y: at.y + s[1] }, { size: 1 + power * .2, delay: i * .07 }));
      rain(at, power, 'cards');
    }
  }
  return { init: init, clear: clear, update: update, hold: hold, dim: dim, vignette: vignette, impact: impact, impactPos: impactPos, setReduced: setReduced, busy: busy, slash: slash, chars: chars, flame: flame, ink: ink, zig: zig, foeMark: foeMark, guard: guard, scan: scan, link: link, radial: radial, stamp: stamp, cut: cut, ultHit: ultHit, sprFx: sprFx, preload: preload, lens: lens, web: web, calm: calm, crystals: crystals, rain: rain, comic: comic, load: load, isReduced: () => reduced };
})();
