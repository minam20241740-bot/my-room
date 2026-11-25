'use strict';
/* ───────── B안: 맑은 하늘과 흰 도시 ─────────
   파란 하늘, 또렷한 흰 구름, 흰 건물, 하늘의 고리. 흐림과 반짝이는 쓰지 않는다. */
function sceneB(ctx, plain) {   // plain: 창밖 풍경으로 쓸 때 유리판과 무늬를 빼고 그린다
  const R = RNG(771), HZ = 800, CX = 960;
  ctx.fillStyle = lin(ctx, 0, 0, 0, HZ, [[0, '#1672ee'], [.26, '#3497fa'], [.56, '#74c4ff'], [.8, '#bfe8ff'], [1, '#f4fcff']]); ctx.fillRect(0, 0, W, HZ);
  // 높은 하늘의 엷은 새털구름과 붓 자국 (고리·구름·건물은 그 위에 또렷하게 올린다)
  [[420, 120, 700, 30], [1420, 90, 620, 26], [980, 470, 900, 34], [200, 420, 420, 22], [1740, 440, 380, 22]].forEach(c => {
    for (let i = 0; i < 22; i++) { const x = c[0] + (R() - .5) * c[2], y = c[1] + (R() - .5) * c[3] * 2, w = 70 + R() * 220, h = 4 + R() * c[3] * .4; ctx.fillStyle = `rgba(255,255,255,${.05 + R() * .1})`; ctx.beginPath(); ctx.ellipse(x, y, w, h, -.06, 0, 7); ctx.fill(); }
  });
  brush(ctx, R, { y1: HZ, n: 3000, len: [60, 200], w: [8, 26], a: .32, ang: -.06, spread: .4, jit: 6 });

  // 하늘의 고리
  ctx.save(); ctx.translate(CX, 318); ctx.rotate(-.13); ctx.strokeStyle = '#ffffff';
  [[668, 214, 6, .95], [712, 236, 1.6, .6], [588, 176, 2.2, .55], [820, 300, 1.2, .35]].forEach(e => { ctx.globalAlpha = e[3]; ctx.lineWidth = e[2]; ctx.beginPath(); ctx.ellipse(0, 0, e[0], e[1], 0, 0, 7); ctx.stroke(); });
  ctx.globalAlpha = .8; ctx.lineWidth = 2;
  for (let i = 0; i < 48; i++) { const a = i / 48 * 6.2832; if (i % 4) continue; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 712, Math.sin(a) * 236); ctx.lineTo(Math.cos(a) * 736, Math.sin(a) * 244); ctx.stroke(); }
  ctx.restore();

  // 구름: 원을 겹친 한 덩어리, 밝은 면과 그늘 면 두 색
  function cloud(cx, base, s, seed, shade, lit) {
    const r = RNG(seed), cs = [], n = 9;
    for (let i = 0; i < n; i++) { const u = i / (n - 1) - .5, rr = (64 + r() * 54) * s * (1.05 - Math.abs(u) * 1.15); cs.push([cx + u * 560 * s + (r() - .5) * 30 * s, base - rr * .5 - (1 - Math.abs(u) * 2) * (70 + r() * 80) * s, rr]); }
    for (let i = 0; i < 5; i++) cs.push([cx + (r() - .5) * 300 * s, base - (130 + r() * 170) * s, (48 + r() * 50) * s]);
    const path = (dx, dy) => { ctx.beginPath(); cs.forEach(c => { ctx.moveTo(c[0] + dx + c[2], c[1] + dy); ctx.arc(c[0] + dx, c[1] + dy, c[2], 0, 6.2832); }); ctx.rect(cx - 290 * s + dx, base - 70 * s + dy, 580 * s, 90 * s); };
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, base); ctx.clip();
    path(0, 0); ctx.fillStyle = shade; ctx.fill();
    path(0, 0); ctx.clip(); path(-16 * s, -30 * s); ctx.fillStyle = lit; ctx.fill();
    ctx.restore();
  }
  cloud(1730, 640, 1.25, 5, '#a4d2fa', '#ffffff');
  cloud(170, 610, 1.15, 9, '#a4d2fa', '#ffffff');
  cloud(1260, 706, .6, 14, '#b4dafb', '#ffffff');
  cloud(640, 716, .55, 23, '#b4dafb', '#ffffff');
  cloud(1500, 262, .5, 31, '#9dcdf9', '#f2faff');
  cloud(396, 214, .42, 37, '#9dcdf9', '#f2faff');

  // 도시 (물에 비치도록 따로 그린 뒤 뒤집어 한 번 더 그린다)
  const c2 = document.createElement('canvas'); c2.width = W; c2.height = H; const g = c2.getContext('2d'), R2 = RNG(99);
  skyline(g, R2, { x0: -10, x1: W + 10, base: HZ, w: [22, 56], h: () => [30, 104], fill: '#b6dbf9' });
  skyline(g, R2, { x0: -10, x1: W + 10, base: HZ, w: [30, 74], gap: 30, h: x => { const k = Math.abs(Math.sin(x / 410 + 1)); return [80 + k * 60, 150 + k * 190]; }, fill: '#cfe6fb' });
  // 건물마다 창 무늬(가로 띠·세로 살·낱창·유리 면), 간격, 그늘 면 너비, 옥상이 다르다. 띠가 군데군데 끊긴다.
  function bldg(x, w, h, kind) {
    const top = HZ - h, sh = .62 + R2() * .2;
    g.fillStyle = lin(g, 0, top, 0, HZ, [[0, '#ffffff'], [1, '#dcefff']]); g.fillRect(x, top, w, h);
    g.fillStyle = '#a9d3f7'; g.fillRect(x + w * sh, top, w * (1 - sh), h);                // 그늘 면
    const fw = w * sh - 8, sp = 8 + R2() * 8, th = 2.5 + R2() * 3, m = 8 + R2() * 14;
    g.fillStyle = `rgba(52,146,236,${.45 + R2() * .3})`;
    if (kind === 0) { for (let wy = top + m; wy < HZ - 8; wy += sp) { if (R2() < .12) { wy += sp * (1 + ((R2() * 3) | 0)); continue; } g.fillRect(x + 4, wy, fw * (R2() < .15 ? .5 + R2() * .4 : 1), th); } }
    else if (kind === 1) { for (let wx = x + 5; wx < x + 1 + fw; wx += sp * .8) { if (R2() < .1) continue; const t0 = top + m + (R2() < .2 ? R2() * h * .3 : 0); g.fillRect(wx, t0, th, HZ - 10 - t0); } }
    else if (kind === 2) { const cw = 4 + R2() * 4, chh = 5 + R2() * 6; for (let wy = top + m; wy < HZ - chh - 6; wy += chh + 4 + sp * .3) for (let wx = x + 5; wx < x + 4 + fw - cw; wx += cw + 3 + sp * .2) { if (R2() < .25) continue; g.globalAlpha = .5 + R2() * .5; g.fillRect(wx, wy, cw, chh); } g.globalAlpha = 1; }
    else {
      g.fillStyle = lin(g, 0, top, 0, HZ, [[0, '#6dbcf9'], [1, '#bfe2fd']]); g.fillRect(x + 4, top + 6, fw, h - 6);
      g.fillStyle = 'rgba(255,255,255,.75)'; for (let wy = top + 6 + sp; wy < HZ; wy += sp * 1.6) g.fillRect(x + 4, wy, fw, 1.5); for (let wx = x + 4 + sp; wx < x + 4 + fw; wx += sp * 1.3) g.fillRect(wx, top + 6, 1.5, h);
      g.fillStyle = 'rgba(255,255,255,.35)'; poly(g, [[x + 4, top + 6], [x + 4 + fw * .6, top + 6], [x + 4, top + h * .5]]); g.fill();
    }
    g.fillStyle = '#ffffff'; g.fillRect(x - 2, top - 3, w + 4, 4);
    const roof = R2();
    if (roof < .22) { g.fillRect(x + w * .2, top - 16, w * .5, 14); g.fillStyle = '#c4e1fa'; g.fillRect(x + w * .56, top - 16, w * .14, 14); g.fillStyle = '#ffffff'; g.fillRect(x + w * .44, top - 46, 2.5, 32); }
    else if (roof < .36) { g.fillRect(x + w * .12, top - 9, w * .2, 8); g.fillRect(x + w * .5, top - 6, w * .3, 5); }
    else if (roof < .46) { g.beginPath(); g.ellipse(x + w * .4, top - 2, w * .3, 9, 0, Math.PI, 0); g.fill(); }
    else if (roof < .54) { poly(g, [[x, top], [x + w * sh, top - 22], [x + w * sh, top]]); g.fill(); }
  }
  let bx = -20; while (bx < W + 20) { const w = 30 + R2() * 72, k = Math.abs(Math.sin(bx / 300)), h = 46 + k * 60 + Math.pow(R2(), 2.2) * (130 + k * 230); bldg(bx, w, h, (R2() * 4) | 0); bx += w + 2 + R2() * 26; }
  // 물가의 나무: 무리 지어 있다가 끊긴다
  for (let tx = -10; tx < W + 10; tx += 9 + R2() * 16) { if (Math.sin(tx / 97) + Math.sin(tx / 41 + 2) < -.5 || Math.abs(tx - CX) < 60) continue; const r = 7 + R2() * 10;
    g.fillStyle = '#58b7a6'; g.beginPath(); g.arc(tx + 2, HZ - r * .55, r, 0, 7); g.fill(); g.fillStyle = '#8fdcc6'; g.beginPath(); g.arc(tx - r * .2, HZ - r * .75, r * .72, 0, 7); g.fill(); }
  g.fillStyle = '#f4fbff'; g.fillRect(0, HZ - 5, W, 5);
  // 가운데의 높은 탑
  (function () {
    const top = 336;
    g.fillStyle = lin(g, 0, top, 0, HZ, [[0, '#ffffff'], [1, '#e6f3ff']]);
    poly(g, [[CX - 46, HZ], [CX - 30, 560], [CX - 17, 430], [CX - 8, top + 30], [CX + 8, top + 30], [CX + 17, 430], [CX + 30, 560], [CX + 46, HZ]]); g.fill();
    g.fillStyle = '#c4e1fa'; poly(g, [[CX + 10, HZ], [CX + 7, 560], [CX + 4, 430], [CX + 2, top + 30], [CX + 8, top + 30], [CX + 17, 430], [CX + 30, 560], [CX + 46, HZ]]); g.fill();
    g.fillStyle = '#ffffff'; [[560, 46], [430, 30]].forEach(b => { g.beginPath(); g.ellipse(CX, b[0], b[1], b[1] * .2, 0, 0, 7); g.fill(); });
    g.fillStyle = 'rgba(88,170,240,.6)'; for (let y = 580; y < HZ - 10; y += 14) g.fillRect(CX - 16, y, 22, 4);
    g.fillStyle = '#ffffff'; g.fillRect(CX - 1.5, top - 40, 3, 72);
    g.strokeStyle = '#ffffff'; g.lineWidth = 4; g.beginPath(); g.ellipse(CX, top - 18, 46, 12, -.12, 0, 7); g.stroke();
    g.strokeStyle = '#1a9df5'; g.lineWidth = 1.6; g.beginPath(); g.ellipse(CX, top - 18, 46, 12, -.12, 0, 7); g.stroke();
  })();
  ctx.drawImage(c2, 0, 0);

  // 물
  ctx.fillStyle = lin(ctx, 0, HZ, 0, H, [[0, '#e2f4ff'], [.16, '#a3d6fb'], [.55, '#58a8f4'], [1, '#2f83e6']]); ctx.fillRect(0, HZ, W, H - HZ);
  ctx.save(); ctx.translate(0, HZ * 2); ctx.scale(1, -1); ctx.globalAlpha = .36; ctx.drawImage(c2, 0, 0); ctx.restore();
  brush(ctx, R, { y0: HZ + 4, n: 2200, len: [40, 220], w: [3, 11], a: .34, ang: 0, spread: .05, jit: 8 });   // 물결: 가로 붓 자국
  ctx.fillStyle = lin(ctx, 0, HZ, 0, H, [[0, 'rgba(255,255,255,.4)'], [.3, 'rgba(255,255,255,0)']]); ctx.fillRect(0, HZ, W, H - HZ);
  for (let i = 0; i < 150; i++) { const y = HZ + 8 + Math.pow(R(), 1.5) * (H - HZ - 10), k = (y - HZ) / (H - HZ), w = (20 + R() * 170) * (.4 + k); ctx.fillStyle = `rgba(255,255,255,${.14 + R() * .34})`; ctx.fillRect(R() * W - w / 2, y, w, 1.5 + k * 2.5); }
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, HZ - 1, W, 2.5);

  if (plain) return;
  // 세 칸: 양옆은 밝은 유리판, 가운데는 그대로
  ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.fillRect(0, 0, 720, H); ctx.fillRect(1200, 0, 720, H);
  // 모서리에 모인 세모 무늬
  for (let side = 0; side < 2; side++) for (let ty = 0; ty < 14; ty++) for (let tx = 0; tx < 9; tx++) {
    const s = 80, x = (side ? 1200 : 0) + tx * s, y = ty * s;
    const d = side ? Math.hypot(8 - tx, 13 - ty) : Math.hypot(tx, ty), f = Math.max(0, 1 - d / 7.5);
    for (let h = 0; h < 2; h++) { if (R() > f * 1.25) continue; ctx.fillStyle = `rgba(255,255,255,${.1 + R() * .3 * f})`; poly(ctx, h ? [[x, y], [x + s, y], [x, y + s]] : [[x + s, y], [x + s, y + s], [x, y + s]]); ctx.fill(); }
  }
  [720, 1200].forEach((x, i) => {
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 2, 0, 4, H);
    ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(x + (i ? 12 : -13), 0, 1.5, H);
  });
  // 가장자리의 선과 점
  ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 2;
  [[0, 262, 262, 0], [0, 296, 296, 0], [W, H - 262, W - 262, H], [W, H - 296, W - 296, H]].forEach(l => { ctx.beginPath(); ctx.moveTo(l[0], l[1]); ctx.lineTo(l[2], l[3]); ctx.stroke(); });
  ctx.fillStyle = 'rgba(255,255,255,.8)';
  for (let j = 0; j < 4; j++) for (let i = 0; i < 8; i++) { ctx.beginPath(); ctx.arc(W - 60 - i * 18, 52 + j * 18, 2.4, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(60 + i * 18, H - 52 - j * 18, 2.4, 0, 7); ctx.fill(); }
}
window.sceneB = sceneB;
