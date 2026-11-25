'use strict';
/* ───────── 로비: 솔 탐정 사무소 ─────────
   넓은 창으로 시작 화면의 도시가 보이는 밝은 사무소. 그림 파일 없이 도형과 색으로 그린다.
   sky: 미리 그려 둔 하늘과 도시 캔버스(1920×1080). */
function sceneOffice(ctx, sky) {
  const R = RNG(4107), FL = 742;                    // FL: 벽과 바닥이 만나는 높이
  const NV = '#2d4663', BL = '#1a9df5', YL = '#ffd92e', RD = '#e9506a';

  // 벽
  ctx.fillStyle = lin(ctx, 0, 0, 0, FL, [[0, '#f7fbff'], [1, '#dfecfa']]); ctx.fillRect(0, 0, W, FL);
  ctx.fillStyle = 'rgba(26,157,245,.07)'; for (let x = 0; x < W; x += 96) ctx.fillRect(x, 0, 2, FL);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, FL - 54, W, 54);
  ctx.fillStyle = '#c9def5'; ctx.fillRect(0, FL - 56, W, 3);

  // 바닥: 밝은 나무, 가운데로 모이는 널 사이 선
  ctx.fillStyle = lin(ctx, 0, FL, 0, H, [[0, '#e9d9c0'], [1, '#d2b892']]); ctx.fillRect(0, FL, W, H - FL);
  ctx.strokeStyle = 'rgba(140,104,62,.28)'; ctx.lineWidth = 2;
  for (let i = -14; i <= 14; i++) { ctx.beginPath(); ctx.moveTo(960 + i * 92, FL); ctx.lineTo(960 + i * 300, H); ctx.stroke(); }
  for (let k = 0; k < 5; k++) { const y = FL + Math.pow((k + 1) / 5.4, 1.7) * (H - FL); ctx.strokeStyle = 'rgba(140,104,62,.12)'; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  ctx.fillStyle = lin(ctx, 0, FL, 0, FL + 60, [[0, 'rgba(80,60,40,.2)'], [1, 'rgba(80,60,40,0)']]); ctx.fillRect(0, FL, W, 60);

  // 손으로 칠한 느낌의 붓 자국 (가구를 그리기 전에 벽과 바닥에만)
  brush(ctx, R, { y0: 0, y1: FL - 60, n: 900, len: [50, 160], w: [8, 22], a: .2, ang: 0, spread: .3, jit: 5 });
  brush(ctx, R, { y0: FL, n: 1400, len: [60, 220], w: [5, 16], a: .22, ang: 0, spread: .08, jit: 8 });

  // 넓은 창: 시작 화면의 하늘과 도시가 보인다
  const wx = 330, wy = 96, ww = 1260, wh = 520;
  ctx.fillStyle = '#c3d8ef'; ctx.fillRect(wx - 26, wy - 26, ww + 52, wh + 62);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(wx - 20, wy - 20, ww + 40, wh + 40);
  ctx.drawImage(sky, 0, 150, 1920, 792, wx, wy, ww, wh);
  ctx.fillStyle = lin(ctx, wx, wy, wx + ww, wy + wh, [[0, 'rgba(255,255,255,.26)'], [.3, 'rgba(255,255,255,0)'], [1, 'rgba(255,255,255,0)']]); ctx.fillRect(wx, wy, ww, wh);
  ctx.fillStyle = '#ffffff';
  [1, 2, 3].forEach(i => ctx.fillRect(wx + ww * i / 4 - 7, wy, 14, wh));
  ctx.fillRect(wx, wy + 132, ww, 10);
  ctx.fillStyle = 'rgba(160,196,232,.7)';
  [1, 2, 3].forEach(i => ctx.fillRect(wx + ww * i / 4 + 7, wy, 3, wh));
  ctx.fillRect(wx, wy + 142, ww, 3);
  // 창턱
  ctx.fillStyle = '#ffffff'; ctx.fillRect(wx - 40, wy + wh + 20, ww + 80, 24);
  ctx.fillStyle = '#b9d2ee'; ctx.fillRect(wx - 40, wy + wh + 44, ww + 80, 8);
  // 창턱의 화분 둘, 탁상 지구본
  function pot(x, s, leaf) {
    const y = wy + wh + 20;
    ctx.fillStyle = '#ffffff'; poly(ctx, [[x - 26 * s, y - 44 * s], [x + 26 * s, y - 44 * s], [x + 20 * s, y], [x - 20 * s, y]]); ctx.fill();
    ctx.fillStyle = BL; ctx.fillRect(x - 26 * s, y - 44 * s, 52 * s, 9 * s);
    for (let i = 0; i < 7; i++) { const a = -2.5 + i * .32, l = (60 + R() * 46) * s; ctx.fillStyle = i % 2 ? leaf[0] : leaf[1];
      ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * l * .5, y - 44 * s + Math.sin(a) * l * .5, l * .5, 11 * s, a, 0, 7); ctx.fill(); }
  }
  pot(wx + 120, 1, ['#58b7a6', '#8fdcc6']); pot(wx + ww - 150, 1.15, ['#4aa896', '#8fdcc6']);

  // 왼쪽 책장
  (function () {
    const x = 34, y = 150, w = 250, h = FL - 150;
    ctx.fillStyle = 'rgba(45,70,99,.12)'; ctx.fillRect(x + 12, y + 14, w, h);
    ctx.fillStyle = NV; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#3d5d82'; ctx.fillRect(x, y, w, 10);
    const cols = [BL, '#ffffff', YL, RD, '#7fd0ff', '#d6ecff', '#f4a13a'];
    for (let r = 0; r < 5; r++) {
      const sy = y + 18 + r * (h - 26) / 5, sh = (h - 26) / 5 - 12;
      ctx.fillStyle = '#eaf3fd'; ctx.fillRect(x + 12, sy, w - 24, sh);
      ctx.fillStyle = 'rgba(45,70,99,.14)'; ctx.fillRect(x + 12, sy, w - 24, 12);
      let bx = x + 18;
      while (bx < x + w - 44) {
        const bw = 12 + R() * 16, bh = sh * (.62 + R() * .32);
        if (R() < .13) { bx += 20 + R() * 20; continue; }
        ctx.fillStyle = cols[(R() * cols.length) | 0]; ctx.fillRect(bx, sy + sh - bh, bw, bh);
        ctx.fillStyle = 'rgba(45,70,99,.22)'; ctx.fillRect(bx + bw - 3, sy + sh - bh, 3, bh);
        ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.fillRect(bx + 3, sy + sh - bh + 8, bw - 8, 3);
        bx += bw + 2;
      }
    }
  })();

  // 오른쪽 벽: 사건 게시판 (사진, 쪽지, 붉은 실)
  (function () {
    const x = 1650, y = 150, w = 236, h = 300;
    ctx.fillStyle = 'rgba(45,70,99,.12)'; ctx.fillRect(x + 10, y + 12, w, h);
    ctx.fillStyle = NV; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#e8d3ac'; ctx.fillRect(x + 12, y + 12, w - 24, h - 24);
    const pins = [];
    [[36, 34, 72, 56, -.06, '#ffffff'], [128, 28, 66, 80, .05, '#fff7c9'], [40, 122, 62, 74, .04, '#d6ecff'], [126, 138, 78, 58, -.05, '#ffffff'], [70, 216, 96, 50, .02, '#ffe1e6']].forEach(p => {
      ctx.save(); ctx.translate(x + p[0] + p[2] / 2, y + p[1] + p[3] / 2); ctx.rotate(p[4]);
      ctx.fillStyle = 'rgba(80,60,30,.2)'; ctx.fillRect(-p[2] / 2 + 3, -p[3] / 2 + 4, p[2], p[3]);
      ctx.fillStyle = p[5]; ctx.fillRect(-p[2] / 2, -p[3] / 2, p[2], p[3]);
      ctx.fillStyle = 'rgba(45,70,99,.35)'; for (let i = 0; i < 3; i++) ctx.fillRect(-p[2] / 2 + 8, -p[3] / 2 + 16 + i * 11, (p[2] - 16) * (i === 2 ? .6 : 1), 3);
      ctx.restore(); pins.push([x + p[0] + p[2] / 2, y + p[1] + 6]);
    });
    ctx.strokeStyle = RD; ctx.lineWidth = 2.5; ctx.beginPath(); pins.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke();
    pins.forEach(p => { ctx.fillStyle = RD; ctx.beginPath(); ctx.arc(p[0], p[1], 6, 0, 7); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.arc(p[0] - 2, p[1] - 2, 2, 0, 7); ctx.fill(); });
  })();
  // 오른쪽 서류장
  (function () {
    const x = 1668, y = 500, w = 208, h = FL - 500;
    ctx.fillStyle = 'rgba(45,70,99,.12)'; ctx.fillRect(x + 10, y + 10, w, h);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#c4dcf5'; ctx.fillRect(x + w - 26, y, 26, h);
    for (let i = 0; i < 3; i++) { const dy = y + 10 + i * (h - 14) / 3, dh = (h - 14) / 3 - 8;
      ctx.fillStyle = '#eaf3fd'; ctx.fillRect(x + 10, dy, w - 46, dh);
      ctx.fillStyle = BL; ctx.fillRect(x + 62, dy + dh / 2 - 5, 58, 10);
      ctx.fillStyle = YL; ctx.fillRect(x + 20, dy + 12, 30, 20); }
    // 위의 탁상 등과 서류 더미
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 20, y - 16, 92, 16); ctx.fillStyle = '#d6ecff'; ctx.fillRect(x + 26, y - 30, 84, 14); ctx.fillStyle = YL; ctx.fillRect(x + 22, y - 40, 88, 10);
    ctx.fillStyle = NV; ctx.fillRect(x + 150, y - 12, 44, 12); ctx.fillRect(x + 169, y - 70, 6, 60);
    ctx.fillStyle = YL; poly(ctx, [[x + 140, y - 70], [x + 204, y - 70], [x + 190, y - 108], [x + 154, y - 108]]); ctx.fill();
  })();

  // 책상 (오른쪽 안쪽): 윗면과 앞면, 그 위의 사건 파일·돋보기·찻잔
  (function () {
    const x0 = 1170, x1 = 1620, yt = 640, yb = 700;
    ctx.fillStyle = 'rgba(60,45,30,.2)'; ctx.beginPath(); ctx.ellipse((x0 + x1) / 2, FL + 132, 270, 26, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#ffffff'; poly(ctx, [[x0 + 30, yt], [x1 - 30, yt], [x1, yb], [x0, yb]]); ctx.fill();
    ctx.fillStyle = NV; ctx.fillRect(x0, yb, x1 - x0, 16);
    ctx.fillStyle = '#3d5d82'; ctx.fillRect(x0 + 14, yb + 16, x1 - x0 - 28, 150);
    ctx.fillStyle = '#35516f'; ctx.fillRect(x0 + 14, yb + 16, x1 - x0 - 28, 14);
    ctx.fillStyle = BL; ctx.fillRect(x0 + 14, yb + 150, x1 - x0 - 28, 6);
    ctx.fillStyle = NV; ctx.fillRect(x0 + 26, yb + 166, 22, 34); ctx.fillRect(x1 - 48, yb + 166, 22, 34);
    // 파일 더미
    [[x0 + 70, '#d6ecff'], [x0 + 78, YL], [x0 + 66, '#ffffff']].forEach((f, i) => { ctx.fillStyle = f[1]; poly(ctx, [[f[0] + 6, yt + 14 - i * 9], [f[0] + 126, yt + 14 - i * 9], [f[0] + 134, yt + 40 - i * 9], [f[0], yt + 40 - i * 9]]); ctx.fill();
      ctx.fillStyle = 'rgba(45,70,99,.25)'; ctx.fillRect(f[0], yt + 40 - i * 9, 134, 5); });
    // 돋보기
    ctx.strokeStyle = '#c9962c'; ctx.lineWidth = 7; ctx.beginPath(); ctx.ellipse(x0 + 268, yt + 24, 30, 13, 0, 0, 7); ctx.stroke();
    ctx.fillStyle = 'rgba(127,208,255,.5)'; ctx.beginPath(); ctx.ellipse(x0 + 268, yt + 24, 26, 10, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = '#7a4a22'; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x0 + 298, yt + 30); ctx.lineTo(x0 + 344, yt + 44); ctx.stroke();
    // 찻잔
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x1 - 120, yt - 12, 40, 34); ctx.fillStyle = RD; ctx.fillRect(x1 - 120, yt - 2, 40, 7);
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(x1 - 78, yt + 4, 10, -1.3, 1.3); ctx.stroke();
    ctx.fillStyle = '#e4eef9'; ctx.beginPath(); ctx.ellipse(x1 - 100, yt + 24, 34, 7, 0, 0, 7); ctx.fill();
  })();

  // 소파 (왼쪽 안쪽)
  (function () {
    const x = 330, y = 600;
    ctx.fillStyle = 'rgba(60,45,30,.2)'; ctx.beginPath(); ctx.ellipse(x + 190, FL + 104, 230, 22, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#1486dc'; ctx.beginPath(); ctx.roundRect(x, y, 380, 150, 26); ctx.fill();
    ctx.fillStyle = BL; ctx.beginPath(); ctx.roundRect(x + 10, y + 10, 360, 96, 20); ctx.fill();
    ctx.fillStyle = '#3db0ff'; ctx.beginPath(); ctx.roundRect(x + 24, y + 96, 332, 70, 18); ctx.fill();
    ctx.fillStyle = '#1486dc'; ctx.beginPath(); ctx.roundRect(x - 26, y + 60, 60, 140, 22); ctx.fill(); ctx.beginPath(); ctx.roundRect(x + 346, y + 60, 60, 140, 22); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fillRect(x + 188, y + 16, 3, 84);
    ctx.fillStyle = YL; ctx.beginPath(); ctx.roundRect(x + 60, y + 54, 92, 70, 16); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.roundRect(x + 232, y + 62, 84, 62, 14); ctx.fill();
    ctx.fillStyle = NV; ctx.fillRect(x + 8, y + 196, 16, 22); ctx.fillRect(x + 356, y + 196, 16, 22);
  })();

  // 가운데 깔개
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(960, 962, 560, 96, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = BL; ctx.lineWidth = 6; ctx.beginPath(); ctx.ellipse(960, 962, 520, 82, 0, 0, 7); ctx.stroke();
  ctx.strokeStyle = 'rgba(26,157,245,.35)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(960, 962, 470, 66, 0, 0, 7); ctx.stroke();

  // 창으로 들어온 볕: 바닥에 비친 창 모양
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 4; i++) { const a = wx + ww * i / 4 + 12, b = wx + ww * (i + 1) / 4 - 12, k = 1.42, sh = -150;
    ctx.fillStyle = lin(ctx, 0, FL, 0, H, [[0, 'rgba(255,250,225,.26)'], [1, 'rgba(255,250,225,.05)']]);
    poly(ctx, [[960 + (a - 960) * 1.02 + sh * .2, FL + 14], [960 + (b - 960) * 1.02 + sh * .2, FL + 14], [960 + (b - 960) * k + sh, H], [960 + (a - 960) * k + sh, H]]); ctx.fill(); }
  ctx.restore();

}
window.sceneOffice = sceneOffice;
