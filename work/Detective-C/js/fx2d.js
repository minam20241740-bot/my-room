'use strict';
/* 2D 타격 연출(C안). 칼자국 곡선, 충격 프레임, 속도선, 글자, 가장자리 번쩍임을 캔버스(#fx)에 직접 그린다.
   공이나 고리 같은 기본 도형은 쓰지 않는다. 시간은 field.js의 tick이 FX.update(초)로 넘겨 준다(메뉴로 멈추면 같이 멈춘다).
   붉은 예고 범위가 떠 있는 동안에는 가장자리 줄무늬 말고는 그리지 않는다(FX.block). 효과 줄이기(FX.low)를 켜면 충격 프레임과 큰 번쩍임을 뺀다. */
window.FX = (function () {
  const cv = document.getElementById('fx'), g = cv.getContext('2d'), W = 1920, H = 1080, PI = Math.PI;
  let list = [], dirty = false;
  const api = { low: false, block: false, impactLife: 2 / 60 };
  const SPR = {}, TINT = {};
  ['flare_01', 'star_04', 'star_05', 'star_06', 'slash_01', 'slash_02', 'slash_03', 'slash_04', 'magic_03', 'magic_05', 'twirl_01', 'twirl_02', 'spark_03', 'spark_05', 'scratch_01', 'scorch_02', 'smoke_05', 'light_02'].forEach(n => { const im = new Image(); im.src = window.ArchiveImage('assets/fx/kenney_particle_pack/' + n + '.png'); SPR[n] = im; });
  function tinted(n, color, asAlpha) {   // 색을 입힌 사본을 한 번만 만든다. asAlpha가 참이면 밝기를 투명도로 바꿔 어두운 그림(그을음, 연기)에 쓴다
    const key = n + color + (asAlpha ? 'a' : 'm'); if (TINT[key]) return TINT[key]; const im = SPR[n]; if (!im || !im.complete || !im.naturalWidth) return null;
    const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); x.drawImage(im, 0, 0, 256, 256);
    const d = x.getImageData(0, 0, 256, 256), v = parseInt(color.slice(1), 16), R = v >> 16, G = (v >> 8) & 255, B = v & 255; for (let i = 0; i < d.data.length; i += 4) { const l = d.data[i]; d.data[i] = R; d.data[i + 1] = G; d.data[i + 2] = B; d.data[i + 3] = l; } x.putImageData(d, 0, 0);
    TINT[key] = c; return c;
  }
  function sprite(n, x, y, size, rot, color, a, asAlpha, sy) {
    const t = tinted(n, color, asAlpha); if (!t || a <= 0) return; g.save(); g.globalCompositeOperation = asAlpha ? 'source-over' : 'lighter'; g.globalAlpha = Math.min(1, a); g.translate(x, y); g.rotate(rot); g.scale(1, sy || 1); g.drawImage(t, -size / 2, -size / 2, size, size); g.restore();
  }
  const ease = t => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
  let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };   // 같은 장면이 같게 그려지도록 고정된 난수

  // 곡선을 따라 가운데가 두꺼운 칼자국 한 줄. head는 칼끝이 간 정도, tail은 꼬리가 사라진 정도(0~1)
  function crescent(x0, y0, x1, y1, bend, thick, head, tail, fill, glow) {
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, dx = x1 - x0, dy = y1 - y0, n = Math.hypot(dx, dy) || 1, cx = mx - dy / n * bend, cy = my + dx / n * bend, N = 28, up = [], dn = [];
    for (let i = 0; i <= N; i++) {
      const s = tail + (head - tail) * i / N; if (head <= tail) return;
      const a = (1 - s) * (1 - s), b = 2 * s * (1 - s), c = s * s, px = a * x0 + b * cx + c * x1, py = a * y0 + b * cy + c * y1;
      const tx = 2 * (1 - s) * (cx - x0) + 2 * s * (x1 - cx), ty = 2 * (1 - s) * (cy - y0) + 2 * s * (y1 - cy), tn = Math.hypot(tx, ty) || 1;
      const w = thick * Math.pow(Math.sin(PI * Math.min(1, Math.max(0, s))), .8) * (.35 + .65 * (i / N));   // 꼬리 쪽이 가늘다
      up.push([px - ty / tn * w, py + tx / tn * w]); dn.push([px + ty / tn * w, py - tx / tn * w]);
    }
    g.beginPath(); up.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); for (let i = dn.length - 1; i >= 0; i--) g.lineTo(dn[i][0], dn[i][1]); g.closePath();
    if (glow) { g.shadowColor = glow; g.shadowBlur = 30; } g.fillStyle = fill; g.fill(); g.shadowBlur = 0;
  }
  function slashShape(e, k) {
    const L = e.len, ca = Math.cos(e.ang), sa = Math.sin(e.ang), x0 = e.x - ca * L / 2, y0 = e.y - sa * L / 2, x1 = e.x + ca * L / 2, y1 = e.y + sa * L / 2;
    const head = ease(k * 2.2), tail = Math.max(0, (k - .3) * 1.5);
    crescent(x0, y0, x1, y1, e.bend * L, e.thick * 1.7, head, tail, e.color, e.color);   // 바깥 번짐
    crescent(x0, y0, x1, y1, e.bend * L, e.thick * .75, head, tail, '#ffffff');          // 흰 속
  }
  function speedLines(x, y, color, k, count) {   // 한 점으로 모이는 속도선
    g.fillStyle = color;
    for (let i = 0; i < count; i++) {
      const a = rnd() * PI * 2, r0 = 170 + rnd() * 160, r1 = r0 + 360 + rnd() * 760, w = .006 + rnd() * .014;
      g.beginPath(); g.moveTo(x + Math.cos(a - w) * r1, y + Math.sin(a - w) * r1); g.lineTo(x + Math.cos(a + w) * r1, y + Math.sin(a + w) * r1); g.lineTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0); g.closePath(); g.fill();
    }
  }
  function glint(x, y, L, color) {   // 네 갈래 반짝임
    const l = L * .16; g.shadowColor = color; g.shadowBlur = 20; g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(x, y - L); g.lineTo(x + l, y - l); g.lineTo(x + L, y); g.lineTo(x + l, y + l); g.lineTo(x, y + L); g.lineTo(x - l, y + l); g.lineTo(x - L, y); g.lineTo(x - l, y - l); g.closePath(); g.fill(); g.shadowBlur = 0;
  }
  function zigLine(x0, y0, x1, y1, n, jit, wGlow, wCore, glow) {   // 두 점 사이를 꺾어 잇는 번개
    const pts = [[x0, y0]]; for (let i = 1; i < n; i++) pts.push([x0 + (x1 - x0) * i / n + (rnd() - .5) * jit, y0 + (y1 - y0) * i / n + (rnd() - .5) * jit]); pts.push([x1, y1]);
    const path = () => { g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); };
    g.lineCap = 'round'; g.lineJoin = 'miter'; g.shadowColor = glow; g.shadowBlur = 30; g.strokeStyle = glow; g.lineWidth = wGlow; path(); g.stroke(); g.shadowBlur = 0; g.strokeStyle = '#ffffff'; g.lineWidth = wCore; path(); g.stroke(); g.lineCap = 'butt';
  }
  function blob(x, y, r, n) {   // 잉크가 번진 모양(울퉁불퉁한 덩어리)
    g.beginPath(); for (let i = 0; i < n; i++) { const a = i / n * PI * 2, rr = r * (.62 + rnd() * .55); (i ? g.lineTo : g.moveTo).call(g, x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath();
  }
  function magnifier(x, y, R, a, color, glass) {   // 돋보기: 유리, 금테, 손잡이, 반사
    g.save(); g.translate(x, y); g.rotate(a); g.lineCap = 'round';
    g.strokeStyle = '#4a2f16'; g.lineWidth = R * .2; g.beginPath(); g.moveTo(R * 1.02, 0); g.lineTo(R * 1.95, 0); g.stroke();
    g.strokeStyle = '#d99a2b'; g.lineWidth = R * .09; g.beginPath(); g.moveTo(R * 1.04, 0); g.lineTo(R * 1.93, 0); g.stroke();
    g.fillStyle = 'rgba(214,244,255,' + glass + ')'; g.beginPath(); g.arc(0, 0, R, 0, PI * 2); g.fill();
    g.shadowColor = color; g.shadowBlur = 28; g.strokeStyle = color; g.lineWidth = R * .14; g.beginPath(); g.arc(0, 0, R, 0, PI * 2); g.stroke(); g.shadowBlur = 0;
    g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = R * .07; g.beginPath(); g.arc(0, 0, R * .7, PI * 1.12, PI * 1.5); g.stroke(); g.restore();
  }
  function paper(x, y, w, h, rot, al) {   // 수첩 한 장: 빨간 여백선과 줄
    g.save(); g.globalAlpha = al; g.translate(x, y); g.rotate(rot); g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = 14; g.fillStyle = '#fff6d8'; g.fillRect(-w / 2, -h / 2, w, h); g.shadowBlur = 0;
    g.strokeStyle = '#8b6b3a'; g.lineWidth = 3; g.strokeRect(-w / 2, -h / 2, w, h); g.strokeStyle = '#ef7b8a'; g.lineWidth = 3; g.beginPath(); g.moveTo(-w / 2 + w * .16, -h / 2); g.lineTo(-w / 2 + w * .16, h / 2); g.stroke();
    g.strokeStyle = '#b9a77a'; g.lineWidth = 2; for (let i = 1; i < 6; i++) { g.beginPath(); g.moveTo(-w / 2 + w * .22, -h / 2 + h * i / 6); g.lineTo(w / 2 - w * .08, -h / 2 + h * i / 6); g.stroke(); } g.restore();
  }
  function draw(e) {
    const k = e.t / e.life;
    if (e.k === 'slash') { if (api.block) return; slashShape(e, k); }
    else if (e.k === 'shards') {   // 부딪힌 자리에서 뻗는 가는 파편(공이 아니라 뾰족한 조각)
      if (api.block) return; g.fillStyle = e.color; seed = e.seed;
      for (let i = 0; i < e.n; i++) { const a = rnd() * PI * 2, r0 = 20 + 70 * ease(k), r1 = r0 + 50 + rnd() * 110 * ease(k), w = .05 + rnd() * .06, al = 1 - k; g.globalAlpha = al; g.beginPath(); g.moveTo(e.x + Math.cos(a) * r0, e.y + Math.sin(a) * r0); g.lineTo(e.x + Math.cos(a + w) * r1, e.y + Math.sin(a + w) * r1); g.lineTo(e.x + Math.cos(a - w) * r1, e.y + Math.sin(a - w) * r1); g.closePath(); g.fill(); }
      g.globalAlpha = 1;
    } else if (e.k === 'impact') {   // 충격 프레임: 흰 바탕에 검은 속도선, 바로 이어 반전. 효과 줄이기에서는 그리지 않는다
      if (api.low || api.block) return; const inv = k >= .5 ? 1 : 0; seed = e.seed;
      g.fillStyle = inv ? '#05070f' : '#ffffff'; g.fillRect(0, 0, W, H); speedLines(e.x, e.y, inv ? '#ffffff' : '#05070f', k, 90);
      if (e.slash) { const c = inv ? '#ffffff' : '#05070f'; g.save(); g.translate(e.x, e.y); g.rotate(.5); g.strokeStyle = c; g.lineCap = 'round'; g.lineWidth = 64; g.beginPath(); g.arc(-90, -70, 330, 0, PI * 2); g.stroke(); g.lineWidth = 96; g.beginPath(); g.moveTo(130, 140); g.lineTo(520, 440); g.stroke(); g.restore(); }   // 돋보기 실루엣
    } else if (e.k === 'text') {   // 기술 이름: 크게 박히고 잠깐 머문 뒤 사라진다
      if (api.block) return; const sc = 1 + .7 * (1 - ease(k * 6)), al = k > .75 ? 1 - (k - .75) * 4 : 1;
      g.save(); g.globalAlpha = al; g.translate(e.x, e.y); g.rotate(-.06); g.transform(1, 0, -.18, 1, 0, 0); g.scale(sc, sc);
      g.font = '900 ' + e.size + 'px Pretendard, "Malgun Gothic", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
      g.lineWidth = e.size * .16; g.strokeStyle = '#05070f'; g.strokeText(e.str, 8, 10); g.strokeStyle = '#05070d'; g.strokeText(e.str, 0, 0); g.fillStyle = e.color; g.fillText(e.str, 0, 0); g.restore();
    } else if (e.k === 'edge') {   // 가장자리 금색 번쩍임과 줄무늬(아슬한 회피). 붉은 범위가 떠 있어도 가장자리만이라 그린다
      const al = (1 - k) * (api.low ? .5 : 1); g.globalAlpha = al; const grd = g.createRadialGradient(W / 2, H / 2, 380, W / 2, H / 2, 1150); grd.addColorStop(0, 'rgba(255,217,46,0)'); grd.addColorStop(1, 'rgba(255,217,46,.75)'); g.fillStyle = grd; g.fillRect(0, 0, W, H);
      g.fillStyle = e.color; seed = e.seed; for (let i = 0; i < 26; i++) { const side = i % 2 ? 1 : -1, y = rnd() * H, len = 120 + rnd() * 260 + 400 * ease(k), x0 = side < 0 ? 0 : W; g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 - side * len, y - 26 - rnd() * 12); g.lineTo(x0 - side * len, y - 22 - rnd() * 8); g.lineTo(x0, y + 8); g.closePath(); g.fill(); }
      sprite('flare_01', 0, H / 2, 1000, 0, '#dfff1a', (1 - k) * .9); sprite('flare_01', W, H / 2, 1000, 0, '#dfff1a', (1 - k) * .9);
      for (let i = 0; i < 5; i++) { const sx = i % 2 ? W - 180 - rnd() * 200 : 180 + rnd() * 200; sprite('star_04', sx, 160 + rnd() * 760, 150 + 120 * ease(k), k * 3 + i, '#eaffa0', (1 - k) * (.6 + .4 * Math.sin(k * 40 + i))); }
      g.globalAlpha = 1;
    } else if (e.k === 'rays') {   // 빛: 가운데에서 뻗는 긴 빛살과 네 갈래 반짝임
      if (api.block) return; const sc = ease(k * 1.6); g.globalAlpha = 1 - k * .8;
      for (let i = 0; i < 16; i++) { const a = i / 16 * PI * 2 + .2, r1 = 60 + (i % 2 ? 250 : 520) * sc, w = i % 2 ? .035 : .055; g.fillStyle = i % 3 ? '#fff4b8' : '#dfff1a'; g.beginPath(); g.moveTo(e.x + Math.cos(a - w) * 40, e.y + Math.sin(a - w) * 40); g.lineTo(e.x + Math.cos(a) * r1, e.y + Math.sin(a) * r1); g.lineTo(e.x + Math.cos(a + w) * 40, e.y + Math.sin(a + w) * 40); g.closePath(); g.fill(); }
      const L = 150 * (1 - k * .4), l = L * .16; g.shadowColor = '#dfff1a'; g.shadowBlur = 26; g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(e.x, e.y - L); g.lineTo(e.x + l, e.y - l); g.lineTo(e.x + L, e.y); g.lineTo(e.x + l, e.y + l); g.lineTo(e.x, e.y + L); g.lineTo(e.x - l, e.y + l); g.lineTo(e.x - L, e.y); g.lineTo(e.x - l, e.y - l); g.closePath(); g.fill(); g.shadowBlur = 0; g.globalAlpha = 1;
    } else if (e.k === 'wave') {   // 물: 곡선 물결 셋이 훑고 지나가고 물방울이 떨어진다
      if (api.block) return; for (let i = 0; i < 3; i++) slashShape({ x: e.x - 40 + i * 30, y: e.y - 60 + i * 70, ang: .12 - i * .07, len: 780 - i * 80, bend: .28, thick: 34, color: i === 1 ? '#bfe9ff' : '#4fb6ff' }, Math.max(0, k - i * .06));
      g.globalAlpha = Math.max(0, 1 - k * .9); seed = e.seed; for (let i = 0; i < 10; i++) { const x = e.x + (rnd() - .5) * 520, y = e.y - 240 - rnd() * 120 + k * k * (480 + rnd() * 160); g.fillStyle = '#9fe0ff'; g.strokeStyle = '#ffffff'; g.lineWidth = 3; g.beginPath(); g.moveTo(x, y - 30); g.bezierCurveTo(x + 6, y - 12, x + 15, y - 2, x + 15, y + 8); g.arc(x, y + 8, 15, 0, PI); g.bezierCurveTo(x - 15, y - 2, x - 6, y - 12, x, y - 30); g.closePath(); g.fill(); g.stroke(); }
      g.globalAlpha = 1;
    } else if (e.k === 'zig') {   // 전기: 위에서 꺾여 내려오는 번개와 가지, 번쩍이며 사라진다
      if (api.block || Math.floor(k * 9) % 3 === 2) return; seed = e.seed; const path = [], N = 9; for (let i = 0; i <= N; i++) path.push([e.x + (i === N ? 0 : (rnd() - .5) * 150 * (1 - i / N * .5)) + (1 - i / N) * 90, -30 + (e.y + 30) * i / N]);
      const bolt = (pts, w) => { g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.lineWidth = w; g.stroke(); };
      const br1 = [path[4], [path[4][0] - 150, path[4][1] + 90], [path[4][0] - 230, path[4][1] + 210]], br2 = [path[6], [path[6][0] + 130, path[6][1] + 70], [path[6][0] + 190, path[6][1] + 170]];
      g.lineCap = 'round'; g.lineJoin = 'miter'; g.shadowColor = '#e6ff7a'; g.shadowBlur = 34; g.strokeStyle = '#dfff1a'; bolt(path, 26); bolt(br1, 14); bolt(br2, 14); g.shadowBlur = 0; g.strokeStyle = '#ffffff'; bolt(path, 9); bolt(br1, 5); bolt(br2, 5);
      g.strokeStyle = '#e6ff7a'; g.lineWidth = 6; g.beginPath(); g.moveTo(e.x - 260, e.y + 12); g.lineTo(e.x - 60, e.y - 8); g.moveTo(e.x + 60, e.y + 8); g.lineTo(e.x + 280, e.y - 10); g.stroke(); g.lineCap = 'butt';
    } else if (e.k === 'pillar') {   // 빛 둘째 기술: 위에서 내려꽂히는 빛기둥과 바닥의 반짝임
      if (api.block) return; const w = 90 + 150 * ease(k * 3), al = k > .6 ? 1 - (k - .6) / .4 : 1; g.globalAlpha = al; seed = e.seed;
      const grd = g.createLinearGradient(0, 0, 0, e.y); grd.addColorStop(0, 'rgba(255,244,184,.1)'); grd.addColorStop(1, 'rgba(255,217,46,.95)');
      g.fillStyle = grd; g.beginPath(); g.moveTo(e.x - w * .35, -10); g.lineTo(e.x + w * .35, -10); g.lineTo(e.x + w, e.y + 30); g.lineTo(e.x - w, e.y + 30); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.moveTo(e.x - w * .12, -10); g.lineTo(e.x + w * .12, -10); g.lineTo(e.x + w * .35, e.y + 30); g.lineTo(e.x - w * .35, e.y + 30); g.closePath(); g.fill();
      for (let i = 0; i < 6; i++) glint(e.x + (rnd() - .5) * w * 2, e.y - rnd() * 160, 30 + rnd() * 40, '#dfff1a'); g.globalAlpha = 1;
    } else if (e.k === 'spiral') {   // 물 둘째 기술: 소용돌이 세 가닥과 돌아가는 물방울
      if (api.block) return; const al = 1 - Math.max(0, k - .55) / .45; g.globalAlpha = al; seed = e.seed;
      for (let arm = 0; arm < 3; arm++) {
        const a0 = arm * PI * 2 / 3, N = 26; g.beginPath();
        for (let i = 0; i <= N; i++) { const s = i / N * ease(k * 1.8), a = a0 + s * 9 + k * 4, r = 40 + 400 * s; const px = e.x + Math.cos(a) * r, py = e.y + Math.sin(a) * r * .5; (i ? g.lineTo(px, py) : g.moveTo(px, py)); }
        g.lineCap = 'round'; g.lineWidth = 26; g.strokeStyle = '#4fb6ff'; g.stroke(); g.lineWidth = 8; g.strokeStyle = '#e6f6ff'; g.stroke(); g.lineCap = 'butt';
      }
      for (let i = 0; i < 8; i++) { const a = i / 8 * PI * 2 + k * 6, r = 80 + 320 * ease(k), x = e.x + Math.cos(a) * r, y = e.y + Math.sin(a) * r * .5 - 20 * k; g.fillStyle = '#9fe0ff'; g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.moveTo(x, y - 26); g.bezierCurveTo(x + 5, y - 10, x + 13, y - 2, x + 13, y + 7); g.arc(x, y + 7, 13, 0, PI); g.bezierCurveTo(x - 13, y - 2, x - 5, y - 10, x, y - 26); g.closePath(); g.fill(); g.stroke(); }
      g.globalAlpha = 1;
    } else if (e.k === 'chainzap') {   // 전기 둘째 기술: 네 점을 옮겨 가며 튀는 번개
      if (api.block || Math.floor(k * 9) % 3 === 2) return; seed = e.seed; const N = [[e.x - 340, e.y - 50], [e.x - 110, e.y + 40], [e.x + 120, e.y - 60], [e.x + 350, e.y + 10]];
      for (let i = 0; i < 3; i++) zigLine(N[i][0], N[i][1], N[i + 1][0], N[i + 1][1], 5, 46, 18, 6, '#dfff1a');
      N.forEach(p => glint(p[0], p[1], 46, '#e6ff7a'));
    } else if (e.k === 'crack') {   // 상대 보리: 쿵! 땅이 갈라진다(꺾인 금과 흙먼지 조각)
      if (api.block) return; const sc = e.sc || 1, grow = ease(k * 2.4), al = k > .6 ? 1 - (k - .6) / .4 : 1; g.globalAlpha = al; seed = e.seed;
      for (let i = 0; i < 9; i++) { const a = i / 9 * PI * 2 + rnd() * .4, len = (130 + rnd() * 190) * sc * grow; zigLine(e.x, e.y, e.x + Math.cos(a) * len, e.y + Math.sin(a) * len * .55, 3, 36 * sc, 14, 4, '#7a3b16'); }
      g.fillStyle = '#d9b48a'; for (let i = 0; i < 16; i++) { const a = rnd() * PI * 2, r0 = 40 * sc, r1 = r0 + (60 + rnd() * 120) * sc * grow, w = .08; g.beginPath(); g.moveTo(e.x + Math.cos(a) * r0, e.y + Math.sin(a) * r0 * .55); g.lineTo(e.x + Math.cos(a + w) * r1, e.y + Math.sin(a + w) * r1 * .55 - 30 * grow); g.lineTo(e.x + Math.cos(a - w) * r1, e.y + Math.sin(a - w) * r1 * .55 - 30 * grow); g.closePath(); g.fill(); }
      g.globalAlpha = 1;
    } else if (e.k === 'crystal') {   // 상대 반짝돌: 마름모 수정 조각이 돌며 퍼지고 반짝인다
      if (api.block) return; const sc = e.sc || 1, grow = ease(k * 1.8), al = 1 - Math.max(0, k - .5) / .5; g.globalAlpha = al; seed = e.seed;
      for (let i = 0; i < 12; i++) { const a = rnd() * PI * 2, r = (60 + rnd() * 260) * sc * grow, x = e.x + Math.cos(a) * r, y = e.y + Math.sin(a) * r * .6 - 70 * grow, s = (16 + rnd() * 22) * sc, rot = rnd() * PI + k * 4; g.save(); g.translate(x, y); g.rotate(rot); g.fillStyle = i % 3 ? '#e7e0ff' : '#b8a6ff'; g.strokeStyle = '#ffffff'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, -s * 1.6); g.lineTo(s, 0); g.lineTo(0, s * 1.6); g.lineTo(-s, 0); g.closePath(); g.fill(); g.stroke(); g.restore(); }
      for (let i = 0; i < 4; i++) glint(e.x + (rnd() - .5) * 360 * sc, e.y - 40 - rnd() * 120, 26 + rnd() * 20, '#b8a6ff'); g.globalAlpha = 1;
    } else if (e.k === 'fountain') {   // 상대 가람이: 물기둥이 솟아 포물선으로 흩어지고 낮은 물결이 훑는다
      if (api.block) return; const sc = e.sc || 1; g.globalAlpha = 1 - Math.max(0, k - .55) / .45; seed = e.seed;
      for (let i = 0; i < 14; i++) { const vx = (rnd() - .5) * 560 * sc, vy = -(420 + rnd() * 380) * sc, t = k * .9, x = e.x + vx * t, y = e.y + vy * t + 900 * t * t; g.fillStyle = '#9fe0ff'; g.strokeStyle = '#ffffff'; g.lineWidth = 3; g.beginPath(); g.moveTo(x, y - 30); g.bezierCurveTo(x + 6, y - 12, x + 15, y - 2, x + 15, y + 8); g.arc(x, y + 8, 15, 0, PI); g.bezierCurveTo(x - 15, y - 2, x - 6, y - 12, x, y - 30); g.closePath(); g.fill(); g.stroke(); }
      slashShape({ x: e.x, y: e.y + 10, ang: .03, len: 760 * sc, bend: .12, thick: 30, color: '#4fb6ff' }, Math.min(1, k * 1.6)); g.globalAlpha = 1;
    } else if (e.k === 'storm') {   // 상대 뇌운몽글: 위에서 번개 셋이 따로따로 내리꽂힌다
      if (api.block || Math.floor(k * 8) % 3 === 2) return; const sc = e.sc || 1;
      [[-190, 0], [0, 1], [200, 2]].forEach(o => { seed = e.seed + o[1] * 131; const px = e.x + o[0] * sc, pts = []; for (let i = 0; i <= 8; i++) pts.push([px + (i === 8 ? 0 : (rnd() - .5) * 120) + (1 - i / 8) * 60, -20 + (e.y + 20) * i / 8]);
        g.lineCap = 'round'; g.shadowColor = '#e6ff7a'; g.shadowBlur = 30; g.strokeStyle = '#dfff1a'; g.lineWidth = 22; g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke(); g.shadowBlur = 0; g.strokeStyle = '#ffffff'; g.lineWidth = 7; g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke(); g.lineCap = 'butt'; glint(px, e.y, 40 * sc, '#e6ff7a'); });
    } else if (e.k === 'lens') {   // 아서: 돋보기가 내려오고 빛이 한 점으로 모여 단서를 비춘다
      if (api.block) return; const dirx = Math.cos(e.ang + PI), diry = Math.sin(e.ang + PI), lx = e.x + dirx * 330 * (1 - .12 * ease(k * 2)), ly = e.y + diry * 250 * (1 - .12 * ease(k * 2)), R = 120 * (1 + .45 * (1 - ease(k * 3))), al = k > .7 ? 1 - (k - .7) / .3 : 1;
      g.globalAlpha = al; const fa = Math.atan2(e.y - ly, e.x - lx); g.globalCompositeOperation = 'lighter';
      for (let i = -3; i <= 3; i++) { const a0 = fa + i * .13, bx = lx + Math.cos(a0) * R * .9, by = ly + Math.sin(a0) * R * .9, w = .5 + .5 * Math.sin(Math.min(1, k * 2.2) * PI); const gr = g.createLinearGradient(bx, by, e.x, e.y); gr.addColorStop(0, 'rgba(255,217,46,0)'); gr.addColorStop(1, 'rgba(255,244,184,' + (.85 * w) + ')'); g.fillStyle = gr; g.beginPath(); g.moveTo(bx + Math.cos(a0 + 1.57) * 16, by + Math.sin(a0 + 1.57) * 16); g.lineTo(e.x, e.y); g.lineTo(bx - Math.cos(a0 + 1.57) * 16, by - Math.sin(a0 + 1.57) * 16); g.closePath(); g.fill(); }
      g.globalCompositeOperation = 'source-over'; magnifier(lx, ly, R, fa, e.color, .22);
      const gs = 40 + 120 * Math.sin(Math.min(1, k * 1.6) * PI); if (k > .18) glint(e.x, e.y, gs, '#dfff1a');
      g.globalAlpha = 1;
    } else if (e.k === 'notes') {   // 에리: 수첩 장이 흩날리며 훑고 지나가고 빨간 연필 밑줄이 그어진다
      if (api.block) return; for (let i = 0; i < 5; i++) { const t = Math.min(1, Math.max(0, (k - i * .06) / .68)); if (t <= 0 || t >= 1) continue; const sx = e.x - 430, sy = e.y - 180 + i * 62, ex = e.x + 400, ey = e.y + 130 - i * 56; paper(sx + (ex - sx) * ease(t), sy + (ey - sy) * ease(t) - Math.sin(t * PI) * 90, 150, 124, t * 5 + i, t > .8 ? 1 - (t - .8) / .2 : 1); }
      slashShape({ x: e.x, y: e.y + 108, ang: -.04, len: 680, bend: .03, thick: 11, color: '#ef4a5d' }, Math.max(0, Math.min(1, k * 1.5 - .2)));
    } else if (e.k === 'string') {   // 단서를 잇는 붉은 실: 핀 다섯 개를 별 모양으로 이어 간다
      if (api.block) return; const P = [[-330, -130], [-40, -300], [300, -190], [-250, 190], [350, 120]], order = [0, 1, 3, 2, 4], al = k > .8 ? 1 - (k - .8) / .2 : 1, prog = Math.min(1, k * 2.4) * 4; g.globalAlpha = al; g.lineCap = 'round';
      const pt = i => [e.x + P[order[i]][0], e.y + P[order[i]][1]];
      for (let pass = 0; pass < 2; pass++) { g.strokeStyle = pass ? '#ff4057' : '#3a0d18'; g.lineWidth = pass ? 8 : 15; g.beginPath(); for (let i = 0; i < 4; i++) { const a = pt(i), b = pt(i + 1), s = Math.min(1, Math.max(0, prog - i)); if (s <= 0) break; if (i === 0) g.moveTo(a[0], a[1]); g.lineTo(a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s); } g.stroke(); }
      for (let i = 0; i < 5; i++) { if (prog < i - .05) continue; const a = pt(Math.min(i, 4)); g.shadowColor = '#dfff1a'; g.shadowBlur = 16; g.fillStyle = '#dfff1a'; g.beginPath(); g.arc(a[0], a[1], 17, 0, PI * 2); g.fill(); g.shadowBlur = 0; g.fillStyle = '#fff6c2'; g.beginPath(); g.arc(a[0] - 5, a[1] - 5, 6, 0, PI * 2); g.fill(); }
      g.lineCap = 'butt'; g.globalAlpha = 1;
    } else if (e.k === 'stamp') {   // 도장: 크게 내리찍히고 잉크가 번진다
      if (api.block) return; const sc = 1 + 1.7 * (1 - ease(k * 9)), al = k > .75 ? 1 - (k - .75) * 4 : 1; seed = e.seed;
      g.save(); g.globalAlpha = al; g.translate(e.x, e.y); g.rotate(-.2); g.scale(sc, sc);
      if (k > .1) { g.fillStyle = e.color; for (let i = 0; i < 8; i++) { const a = rnd() * PI * 2, d = 250 + rnd() * 60; blob(Math.cos(a) * d, Math.sin(a) * d * .8, 12 + rnd() * 20, 11); g.fill(); } }
      g.lineJoin = 'round'; g.strokeStyle = 'rgba(5,8,22,.55)'; g.lineWidth = 22; g.beginPath(); g.arc(8, 10, 232, 0, PI * 2); g.stroke();
      g.strokeStyle = e.color; g.lineWidth = 20; g.beginPath(); g.arc(0, 0, 232, 0, PI * 2); g.stroke(); g.lineWidth = 6; g.beginPath(); g.arc(0, 0, 200, 0, PI * 2); g.stroke();
      g.font = '900 ' + e.size + 'px Pretendard, "Malgun Gothic", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = e.size * .1; g.strokeStyle = 'rgba(5,8,22,.55)'; g.strokeText(e.str, 8, 10); g.fillStyle = e.color; g.fillText(e.str, 0, 0); g.restore();
    } else if (e.k === 'ink') {   // 잉크 번짐(맞았을 때)
      if (api.block && false) return; const grow = ease(k * 3), al = 1 - Math.max(0, k - .4) / .6; g.globalAlpha = al; g.fillStyle = e.color; seed = e.seed;
      blob(e.x, e.y, 70 * grow, 13); g.fill(); for (let i = 0; i < 7; i++) { const a = rnd() * PI * 2, d = (90 + rnd() * 110) * grow; blob(e.x + Math.cos(a) * d, e.y + Math.sin(a) * d * .7, 10 + rnd() * 18, 9); g.fill(); } g.globalAlpha = 1;
    } else if (e.k === 'calm') {   // 진정됨: 불안한 색이 풀리며 따뜻한 빛이 번지고 반짝임이 떠오른다
      const R = 220 + 760 * ease(k * 1.4), al = 1 - k; const gr = g.createRadialGradient(e.x, e.y, 0, e.x, e.y, R); gr.addColorStop(0, 'rgba(255,248,214,' + (.9 * al) + ')'); gr.addColorStop(.5, 'rgba(255,217,46,' + (.32 * al) + ')'); gr.addColorStop(1, 'rgba(255,217,46,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
      g.fillStyle = 'rgba(255,244,214,' + (.16 * al) + ')'; g.fillRect(0, 0, W, H); seed = e.seed;
      sprite('light_02', e.x, e.y, 1500 * ease(k * 1.2) + 300, 0, '#eaffb0', al * .8); g.globalAlpha = al; for (let i = 0; i < 22; i++) { const x = e.x + (rnd() - .5) * 760, y = e.y + 100 - 560 * ease(k) * (.35 + rnd() * .85), s = 10 + rnd() * 20; glint(x, y, s, '#eaffb0'); } g.globalAlpha = 1; for (let i = 0; i < 6; i++) sprite('star_05', e.x + (rnd() - .5) * 700, e.y - 40 - 420 * ease(k) * (.4 + rnd() * .7), 70 + rnd() * 70, k * 2 + i, '#fff6c8', al * .8);
    } else if (e.k === 'spr') {   // 스프라이트 한 장: 커지며(grow) 돌며(spin) 사라진다
      if (api.block && !e.always) return; const sz = e.size * (1 + e.grow * ease(k)), a = (k < .12 ? k / .12 : 1 - (k - .12) / .88) * e.a;
      sprite(e.name, e.x, e.y - e.rise * ease(k), sz, e.rot + e.spin * k, e.color, a, e.asAlpha, e.sy);
    } else if (e.k === 'cross') {   // 합동 필살기의 마지막: 곡선 칼자국 둘이 엇갈린다
      if (api.block) return; slashShape({ x: e.x, y: e.y, ang: e.ang, len: e.len, bend: .2, thick: e.thick, color: e.color }, k);
      slashShape({ x: e.x, y: e.y, ang: e.ang + 1.1, len: e.len * .9, bend: -.2, thick: e.thick, color: '#ffffff' }, Math.max(0, k - .12));
    }
  }
  api.update = function (dt) {
    if (!list.length) { if (dirty) { g.clearRect(0, 0, W, H); dirty = false; } return; }
    g.clearRect(0, 0, W, H); dirty = true;
    list = list.filter(e => {
      if (e.t < e.life) {
        if (e.scale !== 1 && e.scale != null) {
          g.save();
          g.translate(e.x, e.y);
          g.scale(e.scale, e.scale);
          g.translate(-e.x, -e.y);
          draw(e);
          g.restore();
        } else draw(e);
      }
      e.t += dt;
      return e.t < e.life;
    });
    if (!list.length) { g.clearRect(0, 0, W, H); dirty = false; }
  };
  api.clear = function () { list = []; g.clearRect(0, 0, W, H); dirty = false; };
  const add = e => { e.t = 0; e.seed = e.seed || (1 + ((list.length * 977 + (e.x | 0)) % 9973)); list.push(e); dirty = true; return e; };
  // 인물마다 다른 칼자국: 아서는 굵은 초승달 하나와 가는 꼬리, 에리는 가는 선 셋(수첩 쪽지를 가르듯)
  api.lens = (x, y, color, ang, scale) => add({ k: 'lens', x: x, y: y, ang, scale, color: color || '#dfff1a', life: .34 });
  api.notes = (x, y, scale) => add({ k: 'notes', x: x, y: y, scale, life: .45 });
  api.string = (x, y, scale) => add({ k: 'string', x: x, y: y, scale, life: .7 });
  api.stamp = (str, x, y, color, size, life, scale) => add({ k: 'stamp', str, x: x, y: y, scale, color: color || '#ff4057', size: size || 200, life: life || 1.1 });
  api.ink = (x, y, color) => add({ k: 'ink', x: x, y: y, color: color || '#ff4057', life: .5 });
  api.calm = (x, y) => add({ k: 'calm', x: x, y: y, life: 1.4 });
  api.slash = (x, y, kind, color, ang, scale = 1) => {   // 호출한 쪽은 그대로 두고 탐정 소재로 바꿔 그린다: 아서 돋보기 빛, 에리 수첩 장, 친구는 파편
    if (kind === 'arthur') { api.lens(x, y, color, ang, scale); api.spr('spark_03', x, y, { size: 460 * scale, grow: .5, spin: .6, color: color || '#dfff1a', life: .26 }); return; }
    if (kind === 'eri') { api.notes(x, y, scale); api.spr('scratch_01', x, y + 100 * scale, { size: 560 * scale, rot: -.2, color: '#ffd9e0', life: .3 }); return; } add({ k: 'shards', x: x, y: y, n: 14, color: color || '#ffffff', life: .26 }); };
  api.slashOld = (x, y, kind, color, ang) => {
    if (kind === 'arthur') { add({ k: 'slash', x: x, y: y, ang: ang, len: 760, bend: .34, thick: 56, color: color || '#dfff1a', life: .26 }); add({ k: 'slash', x: x + 30, y: y + 40, ang: ang + .12, len: 520, bend: .3, thick: 20, color: color || '#dfff1a', life: .22 }); }
    else if (kind === 'eri') { for (let i = 0; i < 3; i++) add({ k: 'slash', x: x + (i - 1) * 56, y: y + (i - 1) * 30, ang: ang + (i - 1) * .16, len: 640 - i * 60, bend: .12 + .05 * i, thick: 20, color: color || '#bfe6ff', life: .2 + i * .02 }); }
    else add({ k: 'shards', x: x, y: y, n: 14, color: color || '#ffffff', life: .26 });
  };
  api.shards = (x, y, color, n) => add({ k: 'shards', x: x, y: y, n: n || 12, color: color, life: .26 });
  api.impact = (x, y, o) => add({ k: 'impact', x: x, y: y, life: (o && o.life) || api.impactLife, slash: !!(o && o.slash), ang: (o && o.ang) || -.5 });
  api.text = (str, x, y, color, size, life) => add({ k: 'text', str: str, x: x, y: y, color: color || '#dfff1a', size: size || 150, life: life || .9 });
  api.edge = color => add({ k: 'edge', color: color || '#dfff1a', life: .55 });
  api.cross = (x, y, ang, len, color) => add({ k: 'cross', x: x, y: y, ang: ang, len: len || 1500, thick: 80, color: color || '#dfff1a', life: .4 });
  api.rays = (x, y) => add({ k: 'rays', x: x, y: y, life: .5 });
  api.wave = (x, y) => add({ k: 'wave', x: x, y: y, life: .55 });
  api.zig = (x, y) => add({ k: 'zig', x: x, y: y, life: .38 });
  api.has = k => list.some(e => e.k === k);
  api.spr = (name, x, y, o) => { o = o || {}; return add({ k: 'spr', name: name, x: x, y: y, size: o.size || 400, grow: o.grow || 0, spin: o.spin || 0, rot: o.rot || 0, color: o.color || '#ffffff', a: o.a == null ? 1 : o.a, asAlpha: !!o.asAlpha, sy: o.sy || 1, rise: o.rise || 0, always: !!o.always, life: o.life || .4 }); };
  api.pillar = (x, y) => add({ k: 'pillar', x: x, y: y, life: .6 });
  api.spiral = (x, y) => add({ k: 'spiral', x: x, y: y, life: .7 });
  api.chainzap = (x, y) => add({ k: 'chainzap', x: x, y: y, life: .42 });
  // 상대 몬스터가 공격을 터뜨릴 때: 상대마다 다른 그림(보리 쿵 금, 반짝돌 수정, 가람이 물기둥, 뇌운몽글 번개 셋)
  api.foe = (kind, x, y, sc) => { sc = sc || 1; api.spr('scorch_02', x, y + 10, { size: 520 * sc, sy: .5, color: '#120a07', a: .7, asAlpha: true, grow: .1, life: 1.3 }); api.spr('smoke_05', x - 40 * sc, y - 20, { size: 320 * sc, grow: .8, spin: .5, color: '#a9aecb', a: .55, asAlpha: true, rise: 120 * sc, life: .9 }); api.spr('smoke_05', x + 50 * sc, y - 10, { size: 260 * sc, grow: .9, spin: -.6, color: '#8e93b4', a: .5, asAlpha: true, rise: 150 * sc, life: .8 }); return add({ k: kind, x: x, y: y, sc: sc, life: kind === 'storm' ? .5 : .6 }); };
  api.busy = () => list.length > 0;
  return api;
})();
