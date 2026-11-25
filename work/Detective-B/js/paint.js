'use strict';
// 시작 화면 배경 3종을 캔버스에 그린다. 그림 파일을 불러오지 않고 도형과 색으로만 그린다.
const W = 1920, H = 1080;

function RNG(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function lin(ctx, x0, y0, x1, y1, stops) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  stops.forEach(s => g.addColorStop(s[0], s[1])); return g;
}
function rad(ctx, x, y, r0, r1, stops) {
  const g = ctx.createRadialGradient(x, y, r0, x, y, r1);
  stops.forEach(s => g.addColorStop(s[0], s[1])); return g;
}
function glow(ctx, x, y, r, rgb, a, mode) {
  ctx.save(); ctx.globalCompositeOperation = mode || 'lighter';
  ctx.fillStyle = rad(ctx, x, y, 0, r, [[0, `rgba(${rgb},${a})`], [.45, `rgba(${rgb},${a * .38})`], [1, `rgba(${rgb},0)`]]);
  ctx.fillRect(x - r, y - r, 2 * r, 2 * r); ctx.restore();
}
function star4(ctx, x, y, r, col, a) {
  ctx.save(); ctx.translate(x, y); ctx.globalAlpha = a == null ? 1 : a; ctx.fillStyle = col;
  const k = r * .1; ctx.beginPath(); ctx.moveTo(0, -r);
  ctx.quadraticCurveTo(k, -k, r, 0); ctx.quadraticCurveTo(k, k, 0, r);
  ctx.quadraticCurveTo(-k, k, -r, 0); ctx.quadraticCurveTo(-k, -k, 0, -r); ctx.fill(); ctx.restore();
}
function grain(ctx, R, amt) {
  const id = ctx.getImageData(0, 0, W, H), d = id.data;
  for (let i = 0; i < d.length; i += 4) { const n = (R() - .5) * amt; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  ctx.putImageData(id, 0, 0);
}
function vignette(ctx, a, rgb) {
  ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(1, H / W);
  ctx.fillStyle = rad(ctx, 0, 0, W * .32, W * .78, [[0, `rgba(${rgb || '0,0,0'},0)`], [1, `rgba(${rgb || '0,0,0'},${a})`]]);
  ctx.fillRect(-W, -W, 2 * W, 2 * W); ctx.restore();
}
function poly(ctx, pts) { ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); }

// 정면에서 본 건물 줄
function skyline(ctx, R, o) {
  let x = o.x0;
  while (x < o.x1) {
    const w = o.w[0] + R() * (o.w[1] - o.w[0]);
    const hr = o.h(x + w / 2);
    if (hr[1] < 30) { x += w; continue; }
    const h = hr[0] + R() * (hr[1] - hr[0]), top = o.base - h, t = R();
    ctx.fillStyle = typeof o.fill === 'function' ? o.fill(top) : o.fill;
    ctx.beginPath();
    if (t < .2) { ctx.rect(x, top + h * .1, w, h); ctx.rect(x + w * .2, top, w * .6, h * .1 + 1); }
    else if (t < .32) { ctx.rect(x, top + h * .08, w, h); ctx.moveTo(x + w * .5 - 4, top + h * .08); ctx.lineTo(x + w * .5, top - h * .16); ctx.lineTo(x + w * .5 + 4, top + h * .08); }
    else if (t < .44) { ctx.moveTo(x, o.base); ctx.lineTo(x, top + h * .07); ctx.lineTo(x + w, top); ctx.lineTo(x + w, o.base); }
    else if (t < .52) { ctx.rect(x, top + w * .5, w, h); ctx.arc(x + w / 2, top + w * .5, w / 2, Math.PI, 0); }
    else ctx.rect(x, top, w, h);
    ctx.fill();
    if (o.rim) { ctx.fillStyle = o.rim; ctx.fillRect(o.rimSide(x + w / 2) > 0 ? x + w - 2 : x, top + h * .1, 2, h); }
    if (o.win) {
      const cw = o.cw || 7, ch = o.ch || 10, gx = o.gx || 6, gy = o.gy || 9;
      for (let wy = top + h * .12 + 8; wy < o.base - ch - 4; wy += ch + gy)
        for (let wx = x + 6; wx < x + w - cw - 4; wx += cw + gx)
          if (R() < o.winP) { ctx.fillStyle = o.win[(R() * o.win.length) | 0]; ctx.globalAlpha = .3 + R() * .7; ctx.fillRect(wx, wy, cw, ch); ctx.globalAlpha = 1; }
    }
    x += w + (o.gap ? R() * o.gap : 0);
  }
}

// 붓 자국: 지금 그림에서 색을 집어 짧은 붓질로 다시 찍는다. 매끈한 그러데이션과 반듯한 가장자리를 손으로 칠한 것처럼 흐트러뜨린다.
// o: {x0,y0,x1,y1 범위, n 붓질 수, len [최소,최대], w [최소,최대] 굵기, a 불투명도, ang 방향, spread 방향 흔들림, jit 밝기 흔들림, mask(x,y) 칠할 곳}
function brush(ctx, R, o) {
  const x0 = o.x0 || 0, y0 = o.y0 || 0, x1 = o.x1 || W, y1 = o.y1 || H, w = x1 - x0, h = y1 - y0;
  const d = ctx.getImageData(x0, y0, w, h).data;
  ctx.save(); ctx.lineCap = 'round';
  for (let i = 0; i < o.n; i++) {
    const x = R() * w, y = R() * h; if (o.mask && !o.mask(x0 + x, y0 + y)) continue;
    const p = (((y | 0) * w) + (x | 0)) * 4, j = (R() - .5) * (o.jit == null ? 10 : o.jit);
    const ang = (o.ang || 0) + (R() - .5) * (o.spread == null ? .5 : o.spread), len = o.len[0] + R() * (o.len[1] - o.len[0]);
    ctx.strokeStyle = `rgba(${Math.round(d[p] + j)},${Math.round(d[p + 1] + j)},${Math.round(d[p + 2] + j)},${o.a})`;
    ctx.lineWidth = o.w[0] + R() * (o.w[1] - o.w[0]);
    const dx = Math.cos(ang) * len / 2, dy = Math.sin(ang) * len / 2;
    ctx.beginPath(); ctx.moveTo(x0 + x - dx, y0 + y - dy); ctx.lineTo(x0 + x + dx, y0 + y + dy); ctx.stroke();
  }
  ctx.restore();
}
