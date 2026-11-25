'use strict';
/* 해솔항: 걸어 다니는 도시 한 판(C안 오픈월드).
   큰길·골목·부두·옥상이 한 장면으로 이어진다. 건물과 길은 Kenney City Kit(CC0) 조각을 늘어놓고, 항구 소품(물, 부두, 배, 등대, 컨테이너, 표지판, 부표)은 여기서 직접 만든다.
   좌표: x는 동쪽, z는 남쪽(+z), 높이는 y. 큰길은 z=0을 따라 동서로, 세로 대로는 x=0을 따라 남북으로 난다. 부두는 z=26 아래, 바다는 z=34 아래. */
window.World3D = (function () {
  const S = window.Stage3D, kit = S.kit, T = kit.T, K = kit.K, RS = 8;
  let W = null, water = null, built = false, tAll = 0;
  const col = [], camSolid = [], surfaces = [], glows = [], signs = [], buoys = [], lamps = [], traffic = [], still = [];
  let trafficOn = true;
  const map = { bounds: [-66, 138, -40, 54], roads: [], blocks: [], water: [], pier: [] };
  const spec = {};   // Stage3D가 읽는 현장 자료: battle(훈련 자리) 등
  const mat = (c, r, e, ei) => new T.MeshStandardMaterial({ color: c, roughness: r == null ? .85 : r, emissive: e || '#000000', emissiveIntensity: ei == null ? 1 : ei });

  // 막는 상자. gmax: 이 높이보다 낮게 서 있을 때만 막는다(옥상 아래 건물은 옥상 위에서는 막지 않는다). gmin: 이 높이 이상에 설 때만 막는다(옥상의 난간)
  function block(x0, x1, z0, z1, gmax, gmin, cam) {
    const maxHeight = gmax == null ? 3 : gmax;
    col.push([x0, x1, z0, z1, maxHeight, gmin == null ? -9 : gmin]);
    if (!cam) return;
    if (cam === true) camSolid.push([x0, x1, z0, z1, maxHeight]);
    else camSolid.push([cam.min.x, cam.max.x, cam.min.z, cam.max.z, cam.max.y, cam.min.y]);
    map.blocks.push([x0, x1, z0, z1]);
  }
  function slab(w, h, d, x, y0, z, m, ry, shadow) { const o = new T.Mesh(new T.BoxGeometry(w, h, d), m); o.position.set(x, y0 + h / 2, z); if (ry) o.rotation.y = ry; o.castShadow = shadow !== false; o.receiveShadow = true; W.add(o); return o; }
  function cyl(rt, rb, h, x, y0, z, m, seg) { const o = new T.Mesh(new T.CylinderGeometry(rt, rb, h, seg || 14), m); o.position.set(x, y0 + h / 2, z); o.castShadow = true; W.add(o); return o; }
  function ptex(draw, w, h, rx, ry) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; if (rx) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rx, ry || rx); } t.anisotropy = 4; return t; }

  // ── 건물 한 채 ──
  const dimCache = {};
  function dims(key) { if (!dimCache[key]) { const b = new T.Box3().setFromObject(kit.lib[key].scene), s = b.getSize(new T.Vector3()); dimCache[key] = [s.x, s.y, s.z]; } return dimCache[key]; }
  // 표지처럼 어두운 남색 건물에 불 켜진 창(베이지·흰색·형광 연두)이 드문드문 박힌다
  const winCache = {}; let winSeed = 1;
  function winTex(cols, rows, seed) {
    const k = cols + 'x' + rows + ':' + (seed % 4); if (winCache[k]) return winCache[k];
    const c = document.createElement('canvas'); c.width = cols * 16; c.height = rows * 16; const g = c.getContext('2d'); let r = seed * 9301 + 49297; const rnd = () => { r = (r * 9301 + 49297) % 233280; return r / 233280; };
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) { const v = rnd(); if (v < .36) { g.fillStyle = v < .03 ? '#dfff1a' : v < .07 ? '#ffffff' : v < .24 ? '#e8d3a0' : '#bda676'; g.fillRect(x * 16 + 4, y * 16 + 5, 8, 6); } }
    const t = new T.CanvasTexture(c); t.magFilter = T.NearestFilter; t.minFilter = T.LinearFilter; t.colorSpace = T.SRGBColorSpace; return (winCache[k] = t);
  }
  function winLights(o, d, s) {
    const w = d[0] * s, h = d[1] * s, cols = Math.max(4, Math.round(w / 1.15)), rows = Math.max(3, Math.round(h / 1.35));
    const m = new T.Mesh(new T.PlaneGeometry(d[0] * .86, d[1] * .86), new T.MeshBasicMaterial({ map: winTex(cols, rows, winSeed++), transparent: true, depthWrite: false, opacity: .95 }));
    m.position.set(0, d[1] * .46, d[2] * .5 + .02); o.add(m);
  }
  function put(key, x, z, rot, s, solid) {
    const o = kit.lib[key].scene.clone(true); o.position.set(x, 0, z); o.rotation.y = rot || 0; o.scale.setScalar(s || K);
    if (/^commercial\//.test(key)) kit.bright(o, .4); else if (/^industrial\//.test(key)) kit.bright(o, .52); else if (/^cars\//.test(key)) kit.bright(o, .85); else if (/^suburban\//.test(key)) kit.bright(o, .47);
    if (/building-/.test(key) && !/^suburban\//.test(key)) winLights(o, dims(key), s || K);
    o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); W.add(o);
    if (solid) {
      const d = dims(key), sw = Math.abs(Math.cos(rot || 0)) > .7;
      const hw = (sw ? d[0] : d[2]) * (s || K) / 2, hd = (sw ? d[2] : d[0]) * (s || K) / 2;
      // 움직임과 지도는 기존 사각형을 사용하고 카메라만 실제 메시의 높이와 폭을 읽는다.
      block(x - hw, x + hw, z - hd, z + hd, 6, -9, new T.Box3().setFromObject(o));
    }
    return o;
  }
  const ROW = ['building-c', 'building-g', 'building-a', 'building-j', 'building-e', 'building-f', 'building-b', 'building-k', 'building-i', 'building-d', 'building-l', 'building-h'];
  // 동서로 늘어선 건물 줄. frontZ: 앞면의 z, face: +1이면 앞면이 남쪽(+z)을 본다(건물은 frontZ에서 북쪽으로 자란다), -1이면 북쪽을 본다
  function rowX(x0, x1, frontZ, face, seed, s) {
    let x = x0, i = seed || 0, miss = 0;
    while (miss < ROW.length) {
      const key = 'commercial/' + ROW[i % ROW.length]; i++; const d = dims(key), w = d[0] * (s || K), dp = d[2] * (s || K);
      if (x + w > x1 + .01) { miss++; continue; }
      miss = 0; put(key, x + w / 2, frontZ - face * dp / 2, face > 0 ? 0 : Math.PI, s, true); x += w + .25;
    }
  }
  // 남북으로 늘어선 건물 줄. frontX: 앞면의 x, face: +1이면 앞면이 동쪽을 본다(건물은 frontX에서 서쪽으로 자란다)
  function rowZ(z0, z1, frontX, face, seed, s) {
    let z = z0, i = seed || 0, miss = 0;
    while (miss < ROW.length) {
      const key = 'commercial/' + ROW[i % ROW.length]; i++; const d = dims(key), w = d[0] * (s || K), dp = d[2] * (s || K);
      if (z + w > z1 + .01) { miss++; continue; }
      miss = 0; put(key, frontX - face * dp / 2, z + w / 2, face > 0 ? Math.PI / 2 : -Math.PI / 2, s, true); z += w + .25;
    }
  }
  function glow(x, y, z, color, size, op) {
    if (!glow.tex) glow.tex = ptex((g, w, h) => { const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.25, 'rgba(255,255,255,.55)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, w, h); }, 64, 64);
    const sp = new T.Sprite(new T.SpriteMaterial({ map: glow.tex, color: color, transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: op == null ? .9 : op })); sp.position.set(x, y, z); sp.scale.set(size, size, 1); W.add(sp); glows.push(sp); return sp;
  }
  function lamp(x, z, rot, on) {
    const o = kit.lib['roads/light-square'].scene.clone(true); o.position.set(x, 0, z); o.rotation.y = rot || 0; o.scale.setScalar(K * .9); o.traverse(m => { if (m.isMesh) m.castShadow = true; }); W.add(o);
    const g = glow(x, 2.55, z, '#ffd98a', 2.6, on === false ? 0 : .85); lamps.push({ g: g, on: on !== false, alley: on === false, x: x, z: z });
  }
  function sign(text, x, y, z, w, h, bg, fg, ry) {
    const m = new T.Mesh(new T.BoxGeometry(w, h, .16), [0, 0, 0, 0, 1, 0].map(f => new T.MeshStandardMaterial(f ? { map: kit.signTex(text, bg, fg, 640, Math.round(640 * h / w)), roughness: .6 } : { color: bg })));
    m.position.set(x, y, z); if (ry) m.rotation.y = ry; m.castShadow = true; W.add(m); return m;
  }

  // ── 표지판(길 표지) ── 뒤바뀐 항로표: 처음엔 거꾸로 걸려 있고 사건 1이 끝나면 바로잡힌다
  function signpost(x, z, text, ry) {
    const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = ry || 0; W.add(g);
    const pole = new T.Mesh(new T.CylinderGeometry(.06, .07, 2.7, 10), mat('#4a5578', .6)); pole.position.y = 1.35; pole.castShadow = true; g.add(pole);
    const panel = new T.Mesh(new T.BoxGeometry(1.9, .62, .08), [0, 0, 0, 0, 1, 0].map(f => new T.MeshStandardMaterial(f ? { map: kit.signTex(text, '#05070d', '#ffffff', 512, 166), roughness: .6 } : { color: '#05070d' })));
    panel.castShadow = true; const pv = new T.Group(); pv.position.set(0, 2.45, 0); panel.position.set(0, 0, .09); pv.add(panel); g.add(pv);
    pv.rotation.z = Math.PI;   // 거꾸로
    const s = { x: x, z: z, g: g, pv: pv, k: 0, want: 0, bad: true }; signs.push(s); return s;
  }
  // ── 부표(항로표) ── 처음엔 꺼져 있다가 사건 3이 끝나면 불이 켜진다
  function buoy(x, z, y0) {
    const g = new T.Group(); g.position.set(x, y0 || 0, z); W.add(g);
    const body = new T.Mesh(new T.CylinderGeometry(.5, .62, 1.3, 16), mat('#6c758f', .6)); body.position.y = .65; body.castShadow = true; g.add(body);
    const band = new T.Mesh(new T.CylinderGeometry(.52, .52, .28, 16), mat('#d6dbea', .6)); band.position.y = .72; g.add(band);
    const mast = new T.Mesh(new T.CylinderGeometry(.05, .05, 1.2, 8), mat('#3a4262', .6)); mast.position.y = 1.9; g.add(mast);
    const bulb = new T.Mesh(new T.SphereGeometry(.2, 12, 10), mat('#4a5170', .4, '#000000', 0)); bulb.position.y = 2.6; g.add(bulb);
    const gl = glow(x, (y0 || 0) + 2.6, z, '#dfff1a', 3.4, 0); const b = { x: x, z: z, bulb: bulb, glow: gl, on: false }; buoys.push(b); return b;
  }

  // ── 큰 건물 하나(옥상이 있는 종합상가) ──
  function tower(cx, cz, w, d, h) {
    const wall = ptex((g, tw, th) => {
      g.fillStyle = '#3b4670'; g.fillRect(0, 0, tw, th);
      for (let y = 8; y < th - 14; y += 40) for (let x = 10; x < tw - 20; x += 48) { g.fillStyle = (x * 7 + y * 3) % 5 === 0 ? '#ffd98a' : '#1b2448'; g.fillRect(x, y, 30, 24); }
      g.fillStyle = '#1a1f2b'; g.fillRect(0, th - 10, tw, 10);
    }, 512, 512, Math.round(w / 6), Math.round(h / 6));
    const body = slab(w, h, d, cx, 0, cz, new T.MeshStandardMaterial({ map: wall, roughness: .9 }));
    block(cx - w / 2, cx + w / 2, cz - d / 2, cz + d / 2, 6, -9, new T.Box3().setFromObject(body));
    const roof = slab(w + .6, .4, d + .6, cx, h, cz, mat('#5a6483', .95)); surfaces.push(roof);
    const pm = mat('#6b7699', .9), t = .5, ph = 1.1;   // 난간
    slab(w + .6, ph, t, cx, h + .4, cz - d / 2 - .05, pm); slab(w + .6, ph, t, cx, h + .4, cz + d / 2 + .05, pm);
    slab(t, ph, d + .6, cx - w / 2 - .05, h + .4, cz, pm); slab(t, ph, d + .6, cx + w / 2 + .05, h + .4, cz, pm);
    block(cx - w / 2 - .4, cx + w / 2 + .4, cz - d / 2 - .6, cz - d / 2 + .4, 99, h - 2); block(cx - w / 2 - .4, cx + w / 2 + .4, cz + d / 2 - .4, cz + d / 2 + .6, 99, h - 2);
    block(cx - w / 2 - .6, cx - w / 2 + .4, cz - d / 2, cz + d / 2, 99, h - 2); block(cx + w / 2 - .4, cx + w / 2 + .6, cz - d / 2, cz + d / 2, 99, h - 2);
    return { top: h + .4 };
  }

  // ── 만들기 ──
  function build() {
    if (built) return spec; built = true;
    W = new T.Group(); W.visible = false;
    // 땅
    const ground = new T.Mesh(new T.PlaneGeometry(420, 360), mat('#080b13', 1)); ground.rotation.x = -Math.PI / 2; ground.position.y = -.03; ground.receiveShadow = true; W.add(ground); surfaces.push(ground);
    const paveTex = ptex((g, w, h) => { g.fillStyle = '#262c3a'; g.fillRect(0, 0, w, h); g.strokeStyle = '#151922'; g.lineWidth = 4; g.strokeRect(0, 0, w, h); g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke(); }, 128, 128, 1, 1);
    const paveM = (rx, rz) => { const t = paveTex.clone(); t.needsUpdate = true; t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rx, rz); return new T.MeshStandardMaterial({ map: t, roughness: 1 }); };
    const strip = (x0, x1, z0, z1, y) => { const m = new T.Mesh(new T.PlaneGeometry(x1 - x0, z1 - z0), paveM((x1 - x0) / 2.4, (z1 - z0) / 2.4)); m.rotation.x = -Math.PI / 2; m.position.set((x0 + x1) / 2, y || .015, (z0 + z1) / 2); m.receiveShadow = true; W.add(m); return m; };
    // 길: 큰길(동서)와 세로 대로(남북)
    const road = (key, x, z, rot) => { const o = kit.lib['roads/' + key].scene.clone(true); o.position.set(x, 0, z); o.rotation.y = rot || 0; o.scale.setScalar(RS); kit.bright(o, .4); o.traverse(m => { if (m.isMesh) m.receiveShadow = true; }); W.add(o); };
    for (let i = -8; i <= 8; i++) { const x = i * RS; if (i === 0) road('road-crossroad', 0, 0, 0); else road((i === -3 || i === 3) ? 'road-crossing' : 'road-straight', x, 0, 0); }
    [-32, -24, -16, -8].forEach(z => road('road-straight', 0, z, Math.PI / 2)); [8, 16, 24].forEach(z => road('road-straight', 0, z, Math.PI / 2));
    map.roads.push([-68, 68, -4, 4], [-4, 4, -36, 28]);
    // 보도
    strip(-66, 66, -7, -4); strip(-66, 66, 4, 7); strip(-7, -4, -36, -7); strip(4, 7, -36, -7); strip(-7, -4, 7, 28); strip(4, 7, 7, 28);
    // 골목길(옆길과 가로 골목)
    const lane = new T.Mesh(new T.PlaneGeometry(4.4, 28), mat('#141824', 1)); lane.rotation.x = -Math.PI / 2; lane.position.set(-20, .012, -22); lane.receiveShadow = true; W.add(lane);
    const lane2 = new T.Mesh(new T.PlaneGeometry(46, 4.4), mat('#141824', 1)); lane2.rotation.x = -Math.PI / 2; lane2.position.set(-40, .012, -22); lane2.receiveShadow = true; W.add(lane2);
    const yard = new T.Mesh(new T.PlaneGeometry(13, 14), paveM(5, 5.5)); yard.rotation.x = -Math.PI / 2; yard.position.set(-37.5, .014, -22); yard.receiveShadow = true; W.add(yard);
    map.roads.push([-22, -18, -36, -8], [-62, -18, -24.2, -19.8], [-44, -31, -29, -15]);

    // ── 표지 분위기 꾸밈 ──
    const LM = new T.MeshBasicMaterial({ color: '#dfff1a' });
    const hazTex = ptex((g, w, h) => { g.fillStyle = '#05070d'; g.fillRect(0, 0, w, h); g.fillStyle = '#dfff1a'; g.beginPath(); for (let i = -2; i < 6; i++) { g.moveTo(i * 32, h); g.lineTo(i * 32 + 16, h); g.lineTo(i * 32 + 16 + h, 0); g.lineTo(i * 32 + h, 0); } g.fill(); }, 64, 32, 1, 1);
    hazTex.wrapS = hazTex.wrapT = T.RepeatWrapping; hazTex.repeat.set(124 / 1.2, 1);
    const hazMat = new T.MeshBasicMaterial({ map: hazTex });
    const strip3 = (cx, cz, w, d, y) => { const m = new T.Mesh(new T.BoxGeometry(w, .08, d), LM); m.position.set(cx, y || .05, cz); W.add(m); return m; };
    [-4.05, 4.05].forEach(z => { strip3(-33.1, z, 58, .16); strip3(33.1, z, 58, .16); });
    [-4.05, 4.05].forEach(x => { strip3(x, -20.1, .16, 31.8); strip3(x, 15.1, .16, 21.8); });
    const dash = (cx, cz, len, alongX) => {
      const t = ptex((g, w, h) => { g.fillStyle = '#dfff1a'; g.fillRect(0, 0, w * .5, h); }, 64, 8, 1, 1); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(len / 4, 1);
      const m = new T.Mesh(new T.PlaneGeometry(len, .22), new T.MeshBasicMaterial({ map: t, transparent: true })); m.rotation.x = -Math.PI / 2; if (!alongX) m.rotation.z = Math.PI / 2; m.position.set(cx, .045, cz); W.add(m);
    };
    dash(-33.2, 0, 57.2, true); dash(33.2, 0, 57.2, true); dash(0, -20.2, 31.6, false); dash(0, 15.2, 21.6, false);
    const hz = (cx, cz, w, d) => { const t = hazTex.clone(); t.needsUpdate = true; t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(Math.max(w, d) / 1.2, 1); const m = new T.Mesh(new T.BoxGeometry(w, .5, d), new T.MeshBasicMaterial({ map: t })); m.position.set(cx, .25, cz); W.add(m); return m; };
    hz(-20, -7.7, 3.4, .5); hz(0, -34.6, 6, .5);
    const vtex = (txt, hot) => ptex((g, w, h) => { g.fillStyle = hot ? '#dfff1a' : '#05070d'; g.fillRect(0, 0, w, h); g.strokeStyle = hot ? '#05070d' : '#ffffff'; g.lineWidth = 6; g.strokeRect(6, 6, w - 12, h - 12); g.fillStyle = hot ? '#05070d' : '#ffffff'; g.font = '900 64px Pretendard, "Malgun Gothic", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; [...txt].forEach((ch, i) => g.fillText(ch, w / 2, 56 + i * 72)); }, 96, 112 + (txt.length - 1) * 72);
    const vsign = (txt, x, y, z, ry, hot) => { const h = .8 + txt.length * .62, m = new T.Mesh(new T.PlaneGeometry(1.0, h), new T.MeshBasicMaterial({ map: vtex(txt, hot) })); m.position.set(x, y + h / 2, z); m.rotation.y = ry; W.add(m); };
    [[-58, '탐정', 0], [-50, '꽃집', 1], [-44, '분식', 0], [-36, '사무소', 0], [-28, '서점', 1], [12, '카페', 0], [18, '탐정', 1], [44, '사진관', 0], [50, '약국', 1], [58, '빵집', 0]].forEach(a => vsign(a[1], a[0], 2.7, -8.1, 0, a[2]));
    [[-56, '우체국', 0], [-47, '카페', 1], [-40, '서점', 0], [-30, '세탁', 0], [-22, '탐정', 1], [-14, '문구', 0], [12, '약국', 0], [22, '빵집', 1], [34, '꽃집', 0], [46, '사진관', 0], [56, '분식', 1]].forEach(a => vsign(a[1], a[0], 2.7, 8.1, Math.PI, a[2]));
    glow(-6.2, 2.3, -6.2, '#ff3b4e', 1.5, .8); glow(6.2, 2.3, 6.2, '#ff3b4e', 1.5, .8);
    const rm = (c, o) => new T.MeshBasicMaterial({ color: c, transparent: true, opacity: o, side: T.DoubleSide, fog: false, depthWrite: false });
    [[0, 18, -100, 0], [0, 16, 135, Math.PI]].forEach(p => { const g = new T.Group(); g.position.set(p[0], p[1], p[2]); g.rotation.y = p[3];
      [[14, 15.2, '#ffffff', .35, 0, 6.28], [22, 23.4, '#dfff1a', .85, .3, 4.2], [30, 31, '#ff3b4e', .8, 3.6, 2.3], [40, 40.8, '#ffffff', .3, 1, 5.2], [50, 52, '#dfff1a', .45, 2.5, 2.4]].forEach(r => g.add(new T.Mesh(new T.RingGeometry(r[0], r[1], 64, 1, r[4], r[5]), rm(r[2], r[3])))); W.add(g); });

    // 표지의 전망 탑: 대로 끝(고리의 한가운데)에 솟은 탑. 어두운 하늘에 남색 그림자, 붉은 경고등이 깜박인다
    { const tb = c => new T.MeshBasicMaterial({ color: c, fog: false }), tg = new T.Group(); tg.position.set(0, -16, -100); W.add(tg);
      const part = (geo, c, y, x, z) => { const m = new T.Mesh(geo, tb(c)); m.position.set(x || 0, y, z || 0); tg.add(m); return m; };
      part(new T.CylinderGeometry(1.5, 3.6, 62, 10), '#0b1226', 31);
      part(new T.CylinderGeometry(7.4, 5.2, 2.8, 14), '#101a36', 34);
      part(new T.CylinderGeometry(4.6, 7.4, 1.6, 14), '#0b1226', 36.2);
      const dr = new T.Mesh(new T.TorusGeometry(7.5, .16, 6, 40), tb('#ffffff')); dr.rotation.x = Math.PI / 2; dr.position.y = 34; tg.add(dr);
      part(new T.CylinderGeometry(.14, .45, 28, 6), '#0b1226', 76);
      for (let i = 0; i < 7; i++) part(new T.BoxGeometry(1.1 - i * .08, .22, .12), '#dfff1a', 40 + i * 3.4, 0, 2.6 - i * .15);
      const halo = glow(0, 28, -106, "#27457f", 110, .5); halo.material.fog = false;
      spec.beacons = [[34, 7.6], [52, 1.2], [66, .6], [90, .2]].map((b, i) => { const g = glow(0, b[0] - 16, -100 + b[1] * .4, '#ff3b4e', 7 - i, .9); g.material.fog = false; return g; }); }
    // 큰길 위를 가로지르는 전선: 가는 줄이 살짝 처진다
    { const wm = new T.LineBasicMaterial({ color: '#05070d', transparent: true, opacity: .9 });
      const wire = (a, b, sag) => { const pts = []; for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(new T.Vector3(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - Math.sin(t * Math.PI) * sag, a[2] + (b[2] - a[2]) * t)); } W.add(new T.Line(new T.BufferGeometry().setFromPoints(pts), wm)); };
      [-52, -40, -26, 26, 40, 54].forEach((x, i) => { wire([x, 9.5, -8], [x + 3, 9.2, 8], .9); wire([x + 2, 10.4, -8], [x - 2, 10, 8], 1.1); });
      [-26, -14, 14, 26].forEach((z, i) => wire([-8, 9.4, z], [8, 9.8, z + 2], .9)); }

    // 건물 줄
    // 북쪽(큰길 앞): 서쪽 끝~골목 입구 앞, 사무소 칸, 동쪽(옥상 건물 칸을 비워 둔다)
    rowX(-64, -23, -8, 1, 3); rowX(9, 21.5, -8, 1, 5); rowX(40.5, 64, -8, 1, 9);
    // 사무소: 한 채를 골라 간판을 단다
    const off = put('commercial/building-e', -13, -8 - dims('commercial/building-e')[2] * K / 2, 0, K, true);
    sign('솔 탐정 사무소', -13, 3.6, -8 + .12, 5.4, 1.0, '#05070d', '#dfff1a'); spec.office = [-13, -6.6];
    // 큰길 남쪽
    rowX(-64, -9, 8, -1, 1); rowX(9, 64, 8, -1, 7);
    // 세로 대로 양옆(북쪽 구간)
    rowZ(-34, -15, -8, 1, 2); rowZ(-34, -9, 8, -1, 6);
    // 골목: 가게 줄 뒤쪽 두 줄(공터 자리 x -44~-31은 비운다)
    rowX(-62, -45, -19.7, -1, 4); rowX(-30.4, -24, -19.7, -1, 8);   // 골목 남쪽 줄: 앞면이 골목(북쪽)을 본다
    rowX(-62, -45, -24.3, 1, 10); rowX(-30.4, -24, -24.3, 1, 2);    // 골목 북쪽 줄: 앞면이 골목(남쪽)을 본다
    // 골목 줄 사이를 막는 낮은 담(공터 위쪽)과 바깥 경계
    const wallM = mat('#566086', .95);
    slab(14, 2.2, .5, -37.5, 0, -29.2, wallM); block(-44.5, -30.5, -29.6, -28.8, 99, -9);
    // 부두 쪽 창고와 컨테이너 마당(남쪽)
    // 컨테이너와 창고: Kenney City Kit(Industrial)의 shipping-container와 building. 컨테이너는 길이가 모델의 z 방향이라 동서로 놓으려면 돌린다
    const CT = ['a', 'b', 'c'], CS = 7;
    const cont = (x, z, c, ry, stack) => { for (let k = 0; k < (stack || 1); k++) { const o = put('industrial/shipping-container-' + CT[(c + k) % 3], x, z, ry ? 0 : Math.PI / 2, CS); o.position.y = k * 2.44; } if (!ry) block(x - 2.9, x + 2.9, z - 1.3, z + 1.3, 6, -9, true); else block(x - 1.3, x + 1.3, z - 2.9, z + 2.9, 6, -9, true); };
    [[-42, 18.8, 0, 0, 2], [-42, 22.2, 1, 0, 1], [-54, 23, 2, 0, 2], [-33, 23.4, 0, 0, 1], [-19, 19.5, 1, 0, 1], [-20.5, 22.8, 2, 0, 2],
      [20, 19.5, 1, 0, 1], [21.5, 22.8, 2, 0, 2], [41, 19, 0, 0, 2], [41, 22.4, 1, 0, 1], [46, 23.4, 2, 0, 1], [55, 23, 0, 0, 2]].forEach(a => cont(a[0], a[1], a[2], a[3], a[4]));
    [['industrial/building-b', -52, 18.8], ['industrial/building-r', -30, 18.4], ['industrial/building-a', 30, 18.4], ['industrial/building-s', 52, 19]].forEach(p => put(p[0], p[1], p[2], 0, 5.5, true));
    put('industrial/chimney-large', -59, 16.5, 0, 6, true); put('industrial/chimney-large', 59, 16.5, 0, 6, true);
    put('industrial/detail-tank-large', -18, 17, 0, 5, true); put('industrial/detail-tank-large', 17.5, 17, 0, 5, true);

    // ── 차: Kenney Car Kit(CC0). 길가에 세워 둔 차, 큰길과 세로 대로를 오가는 차(사람이 앞에 있으면 선다) ──
    const CAR_S = 1.65, CAR_FRONT = Math.PI;   // 차 모델의 앞은 -z쪽이라 달리는 방향에 맞춰 반 바퀴 돌려 둔다
    const parked = (k, x, z, ry) => { const o = put('cars/' + k, x, z, ry, CAR_S); const d = dims('cars/' + k), sw = Math.abs(Math.cos(ry)) > .7, hx = (sw ? d[0] : d[2]) * CAR_S / 2, hz = (sw ? d[2] : d[0]) * CAR_S / 2; block(x - hx, x + hx, z - hz, z + hz, 3); still.push({ o: o, x: x, z: z }); return o; };
    [[-50, 3.3, 'taxi'], [-41, -3.3, 'sedan'], [-33, 3.3, 'van'], [-26, -3.3, 'delivery'], [-19, 3.3, 'suv'], [19, 3.3, 'sedan-sports'], [27, -3.3, 'sedan'], [36, 3.3, 'taxi'], [44, -3.3, 'truck'], [52, 3.3, 'van']].forEach((p, i) => parked(p[2], p[0], p[1], i % 2 ? Math.PI / 2 : -Math.PI / 2));
    [[3.2, -22, 'sedan'], [-3.2, -29, 'taxi'], [3.3, 12, 'van'], [-3.3, 18.5, 'suv']].forEach((p, i) => parked(p[2], p[0], p[1], i % 2 ? 0 : Math.PI));
    const drive = (k, axis, dir, lane, p0, vmax) => { const o = put('cars/' + k, 0, 0, 0, CAR_S); const g = new T.Group(); W.remove(o); g.add(o); o.rotation.y = CAR_FRONT; W.add(g); traffic.push({ g: g, axis: axis, dir: dir, lane: lane, p: p0, v: vmax, vmax: vmax, lim: axis === 'x' ? [-60, 134] : [-33, 26] }); };
    drive('taxi', 'x', 1, 2.1, -40, 7); drive('sedan', 'x', 1, 2.1, 12, 6.2); drive('van', 'x', -1, -2.1, 30, 6.6); drive('suv', 'x', -1, -2.1, -25, 7.2); drive('delivery', 'x', 1, 2.1, 52, 6); drive('truck', 'x', -1, -2.1, 55, 5.8);
    drive('sedan-sports', 'z', 1, -2.1, -28, 7.4); drive('van', 'z', -1, 2.1, 20, 7.8); drive('hatchback-sports', 'z', 1, -2.1, 4, 6.8);
    block(-62, -61, -40, 54, 99); block(61, 62, -40, -23, 99); block(61, 62, 23, 54, 99); block(-62, 62, -40, -39, 99);
    // ── 해솔 언덕(동쪽 주택가): 큰길이 동쪽으로 이어진다. Kenney City Kit(Suburban)의 집과 나무 ──
    { for (let i = 9; i <= 16; i++) road('road-straight', i * RS, 0, 0);
      strip(66, 138, -7, -4); strip(66, 138, 4, 7); [-4.05, 4.05].forEach(z => strip3(102, z, 72, .16)); dash(102, 0, 72, true); map.roads.push([66, 138, -4, 4]);
      const SUBK = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'], house = (i, x, frontZ, face) => { const key = 'suburban/building-type-' + SUBK[i % 8], d = dims(key), s = 6.6 / d[0]; put(key, x + 3.3, frontZ - face * d[2] * s / 2, face > 0 ? 0 : Math.PI, s, true); return 6.6 + .9; };
      let hx = 66; for (let i = 0; hx + 6.6 < 134; i++) hx += house(i + 1, hx, -9.6, 1);
      hx = 66; for (let i = 0; hx + 6.6 < 134; i++) hx += house(i + 4, hx, 9.6, -1);
      const tree = (x, z, big) => { const o = kit.lib['suburban/tree-' + (big ? 'large' : 'small')].scene.clone(true); o.position.set(x, 0, z); o.scale.setScalar(K * (big ? 1.5 : 1.2)); kit.bright(o, .55); o.traverse(m => { if (m.isMesh) m.castShadow = true; }); W.add(o); block(x - .4, x + .4, z - .4, z + .4, 6); };
      for (let x = 70; x < 134; x += 9) { tree(x + (x % 2 ? 2 : 0), -7.6, x % 18 < 9); tree(x + 4, 7.6, x % 18 >= 9); }
      for (let x = 74; x <= 130; x += 14) { lamp(x, -6.2, 0); lamp(x + 7, 6.2, Math.PI); }
      block(61, 138, -23, -22, 99); block(61, 138, 22, 23, 99); block(137, 138, -23, 23, 99);
      sign('해솔 언덕', 70, 3.6, -7.6, 4.2, .9, '#05070d', '#dfff1a');
      [[0, '탐정'], [1, '꽃집'], [0, '카페'], [1, '약국']].forEach((a, i) => vsign(a[1], 78 + i * 15, 2.7, -9.7, 0, a[0]));
      [[1, '분식'], [0, '서점'], [1, '빵집']].forEach((a, i) => vsign(a[1], 86 + i * 15, 2.7, 9.7, Math.PI, a[0]));
      [[66, -22], [80, 22], [96, -22], [110, 22]].forEach(p => { });
    }
    // 북쪽 끝(세로 대로가 막히는 곳)과 멀리 보이는 건물
    ['building-m', 'building-n', 'building-l', 'building-m', 'building-n'].forEach((b, i) => put('commercial/' + b, -48 + i * 24, -46, 0, K * 1.5));
    [-56].forEach(x => { for (let k = 0; k < 5; k++) put('commercial/' + (k % 2 ? 'building-m' : 'building-n'), x * 1.28, -30 + k * 16, x < 0 ? Math.PI / 2 : -Math.PI / 2, K * 1.4); });
    put('commercial/building-n', 0, -42.4, 0, K * 1.3, true); block(-8, 8, -36.4, -35.6, 99);

    // 옥상 건물(큰길 북동쪽, 한 칸 비워 둔 자리): 폭 18, 깊이 16, 높이 14
    const tw = tower(31, -16, 18, 16, 14), R = tw.top;
    sign('해솔 종합상가', 31, 5.6, -8 + .22, 7.2, 1.2, '#05070d', '#ffffff');
    slab(2.2, 2.9, .3, 31, 0, -7.95, mat('#1b2448', .6, '#dfff1a', .35));
    spec.roofDoor = [31, -6.4]; spec.roofLand = [31, -12.4]; spec.roofTop = R;
    // 옥상: 계단집(내려가는 문), 안테나, 물탱크, 환풍기, 신호등. 가운데는 훈련 자리로 비워 둔다
    slab(4, 2.8, 2.2, 31, R, -9.8, mat('#6b7699', .9)); block(29, 33, -10.9, -8.7, R + 3, R - 2, true);
    slab(1.4, 2.0, .12, 31, R, -10.95, mat('#1b2448', .6, '#7ee0b0', .5));
    slab(.3, 6, .3, 23.6, R, -22.4, mat('#a3add0', .6)); slab(2.6, .2, .2, 23.6, R + 4.8, -22.4, mat('#a3add0', .6)); block(23.2, 24, -22.8, -22, R + 6, R - 2, true);
    { const wt = put('industrial/water-tower', 38, -22, 0, 3.4); wt.position.y = R; } block(36.5, 39.5, -23.5, -20.5, R + 8, R - 2, true);
    slab(1.6, 1.1, 1.6, 38.2, R, -10.2, mat('#6f7aa0', .8)); block(37.2, 39.2, -11.2, -9.2, R + 2.5, R - 2, true);
    const sg = new T.Group(); sg.position.set(31, R, -22); W.add(sg); const sb = new T.Mesh(new T.BoxGeometry(1.6, 1.0, 1.0), mat('#1a1f2b', .7)); sb.position.y = .5; sg.add(sb);
    const sl = new T.Mesh(new T.SphereGeometry(.42, 14, 12), mat('#4a5170', .4, '#000000', 0)); sl.position.set(0, 1.4, 0); sg.add(sl); const sgl = glow(31, R + 1.4, -22, '#dfff1a', 4, 0); spec.roofSignal = { bulb: sl, glow: sgl }; block(30.2, 31.8, -22.5, -21.5, R + 2.5, R - 2, true);

    // 옥상 바닥: 훈련 자리 테두리를 연두 점선으로 그어 어디서 싸우는지 보이게 한다
    { const lm = mat('#dfff1a', .6, '#dfff1a', .55), x0 = 24.5, x1 = 37.5, z0 = -20.5, z1 = -12.2;
      for (let i = 0; i < 9; i++) { slab(1, .05, .2, x0 + .7 + i * 1.5, R, z0, lm).castShadow = false; slab(1, .05, .2, x0 + .7 + i * 1.5, R, z1, lm).castShadow = false; }
      for (let j = 0; j < 6; j++) { slab(.2, .05, 1, x0, R, z0 + .9 + j * 1.3, lm).castShadow = false; slab(.2, .05, 1, x1, R, z0 + .9 + j * 1.3, lm).castShadow = false; } }

    // ── 부두 ──
    const qt = paveTex.clone(); qt.needsUpdate = true; qt.wrapS = qt.wrapT = T.RepeatWrapping; qt.repeat.set(52, 3.5); const quayM = new T.MeshStandardMaterial({ map: qt, roughness: 1 });
    const quay = new T.Mesh(new T.BoxGeometry(124, 1.6, 8.4), quayM); quay.position.set(0, -.8, 30); quay.receiveShadow = true; W.add(quay); surfaces.push(quay);
    const edge = slab(124, .5, .5, 0, 0, 33.9, hazMat); edge.castShadow = false;
    map.roads.push([-62, 62, 26, 34]);
    // 바다
    water = new T.Mesh(new T.PlaneGeometry(420, 150), new T.MeshStandardMaterial({ color: '#08142e', roughness: .35, metalness: .15, map: ptex((g, w, h) => { g.fillStyle = '#0b1a3c'; g.fillRect(0, 0, w, h); for (let i = 0; i < 70; i++) { g.strokeStyle = 'rgba(160,200,255,' + (.06 + Math.random() * .12) + ')'; g.lineWidth = 2 + Math.random() * 3; const x = Math.random() * w, y = Math.random() * h; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 24, y - 6, x + 52, y); g.stroke(); } }, 512, 512, 24, 6) }));
    water.rotation.x = -Math.PI / 2; water.position.set(0, -1.1, 107); water.receiveShadow = true; W.add(water); map.water.push([-66, 66, 34, 54]);
    // 부두 위 소품
    const bol = (x, z) => { cyl(.22, .28, .55, x, 0, z, mat('#1a1f2b', .6), 10); };
    for (let x = -56; x <= 56; x += 8) if (Math.abs(x) > 14) bol(x, 32.8);
    const crate = (x, z, s, c) => { slab(s, s, s, x, 0, z, mat(c || '#8a6a43', .9), Math.random() * .6); block(x - s * .7, x + s * .7, z - s * .7, z + s * .7, 6); };
    [[-22, 30], [-23.4, 30.4], [-22.6, 29.8], [-40, 31], [30, 28.4], [31.4, 28.6], [44.5, 30.4], [45.7, 29.8], [-52, 29.6]].forEach((p, i) => crate(p[0], p[1], 1.3 + (i % 3) * .25, i % 2 ? '#8a6a43' : '#6d5a3a'));
    [[-18, 28.6], [-30, 27.4], [18.4, 28.2], [26, 27.8], [44, 27.6], [-46, 28]].forEach(p => { cyl(.5, .5, 1.1, p[0], 0, p[1], mat('#2a74c9', .6), 14); block(p[0] - .55, p[0] + .55, p[1] - .55, p[1] + .55, 6); });
    // 크레인
    const crane = (x) => { const cm = mat('#4a5568', .7); [[-1.6, 0], [1.6, 0]].forEach(a => { slab(.35, 11, .35, x + a[0], 0, 27.5, cm); }); slab(.35, 11, .35, x - 1.6, 0, 31.5, cm); slab(.35, 11, .35, x + 1.6, 0, 31.5, cm); slab(4, .4, 6.2, x, 11, 29.5, cm); slab(.5, .5, 14, x, 11.4, 35, cm); block(x - 2, x + 2, 27, 32, 99); };
    crane(-44); crane(40);
    // 선착장(나무 부두): x 22~28, z 34~52 와 끝의 등대
    const pier = slab(6, .5, 18.5, 25, -.3, 43.2, mat('#7a5a36', .95)); surfaces.push(pier); map.pier.push([22, 28, 34, 52]);
    for (let z = 36; z <= 50; z += 4) { cyl(.18, .18, 1.4, 22.2, -1.4, z, mat('#3a2f22', 1), 8); cyl(.18, .18, 1.4, 27.8, -1.4, z, mat('#3a2f22', 1), 8); }
    // 물 막이(부두 가장자리 밖은 바다)
    block(-62, 21.7, 33.6, 60, 99); block(28.3, 62, 33.6, 60, 99); block(21.7, 28.3, 52.4, 60, 99);
    const lh = new T.Group(); lh.position.set(25, 0, 51); W.add(lh);
    const lhStripe = ptex((g, w, h) => { for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? '#e9edf8' : '#c93b3b'; g.fillRect(0, i * h / 6, w, h / 6); } }, 64, 192);
    const lhBody = new T.Mesh(new T.CylinderGeometry(1.3, 2.1, 12, 22), new T.MeshStandardMaterial({ map: lhStripe, roughness: .8 })); lhBody.position.y = 6; lhBody.castShadow = true; lh.add(lhBody);
    const lhTop = new T.Mesh(new T.CylinderGeometry(1.55, 1.55, .4, 22), mat('#1a1f2b', .6)); lhTop.position.y = 12.2; lh.add(lhTop);
    const lhLamp = new T.Mesh(new T.CylinderGeometry(.9, .9, 1.6, 18), mat('#4a5170', .4, '#000000', 0)); lhLamp.position.y = 13.2; lh.add(lhLamp);
    const lhRoof = new T.Mesh(new T.ConeGeometry(1.4, 1.4, 18), mat('#c93b3b', .7)); lhRoof.position.y = 14.7; lh.add(lhRoof);
    const lhGlow = glow(25, 13.2, 51, '#eaffa0', 14, 0); const lhLight = new T.PointLight('#eaffa0', 0, 46, 1.6); lhLight.position.set(25, 13.3, 50); W.add(lhLight);
    block(23.6, 26.4, 49.6, 52.4, 99);
    spec.lighthouse = { lamp: lhLamp, glow: lhGlow, light: lhLight };
    buoy(-18, 31.4); buoy(16, 31.4); buoy(25, 48.2);
    // 배(부두 서쪽에 대어 있다)
    const ship = new T.Group(); ship.position.set(-26, -1.1, 38.6); W.add(ship);
    const hullM = mat('#223571', .6); const hull = new T.Mesh(new T.BoxGeometry(24, 3.2, 7), hullM); hull.position.y = 1.2; hull.castShadow = true; ship.add(hull);
    const bow = new T.Mesh(new T.CylinderGeometry(0, 3.5, 5, 4), hullM); bow.rotation.z = -Math.PI / 2; bow.rotation.x = Math.PI / 4; bow.position.set(14.2, 1.2, 0); ship.add(bow);
    const stripe = new T.Mesh(new T.BoxGeometry(24.2, .35, 7.1), mat('#dfff1a', .6)); stripe.position.y = 2.6; ship.add(stripe);
    const cab = new T.Mesh(new T.BoxGeometry(7, 3.6, 4.6), mat('#dfe6f7', .7)); cab.position.set(-5, 4.6, 0); cab.castShadow = true; ship.add(cab);
    const fun = new T.Mesh(new T.CylinderGeometry(.8, .95, 2.6, 14), mat('#c93b3b', .7)); fun.position.set(-6, 7.4, 0); ship.add(fun);
    for (let i = 0; i < 4; i++) { const w = new T.Mesh(new T.BoxGeometry(1, .8, .05), mat('#ffd98a', .5, '#ffd98a', .7)); w.position.set(-7.5 + i * 1.6, 4.9, 2.33); ship.add(w); }
    // 가로등과 간판
    [-52, -36, -22, 22, 36, 52].forEach(x => { lamp(x, -6.2, 0); lamp(x + 8, 6.2, Math.PI); });
    [12, 20].forEach(z => { lamp(-6.2, z, Math.PI / 2); lamp(6.2, z + 3, -Math.PI / 2); });
    [-12, -22, -32].forEach(z => lamp(-6.2, z, Math.PI / 2)); [-14, -26].forEach(z => lamp(6.2, z, -Math.PI / 2));
    [-52, -45, -28].forEach(x => lamp(x, -23.4, 0, false)); lamp(-20, -14, 0, false); lamp(-20, -30, 0, false);   // 골목 등은 꺼져 있다(사건 2)
    for (let x = -50; x <= 50; x += 20) lamp(x, 33.2, 0);
    sign('해솔 부두', 0, 5.2, 33.6, 6.4, 1.1, '#05070d', '#ffffff', Math.PI); slab(.25, 5, .25, -3.4, 0, 33.6, mat('#1a1f2b', .7)); slab(.25, 5, .25, 3.4, 0, 33.6, mat('#1a1f2b', .7));
    sign('골목', -20, 3.4, -8 + .3, 3.2, .9, '#1a1f2b', '#dfff1a');
    // 길 소품(큰길 교차로)
    [[-6.2, -6.2, 0], [6.2, 6.2, Math.PI]].forEach(p => { const o = kit.lib['roads/traffic-light'].scene.clone(true); o.position.set(p[0], 0, p[1]); o.rotation.y = p[2]; o.scale.setScalar(K); W.add(o); });
    // 표지판 셋(뒤바뀐 길표)
    signpost(6.1, -5.7, '→ 부두', 0); signpost(-6.6, -5.7, '골목 ←', 0); signpost(5.8, 5.8, '↑ 북쪽 대로', Math.PI);
    // 골목 소품
    const barrel = (x, z) => { cyl(.42, .42, .95, x, 0, z, mat('#5a6f99', .8), 12); block(x - .45, x + .45, z - .45, z + .45, 6); };
    [[-21.4, -12], [-18.6, -26.5], [-46, -21.2], [-52, -23.4], [-44.2, -28], [-31.6, -28.4], [-22.6, -30]].forEach(p => barrel(p[0], p[1]));
    [[-27, -20.8], [-47, -22.8], [-30.6, -20.9]].forEach((p, i) => { crate(p[0], p[1], 1.2, '#74603f'); });
    [[-23.6, -16.6]].forEach(p => { const o = kit.lib['roads/dumpster'].scene.clone(true); o.position.set(p[0], 0, p[1]); o.scale.setScalar(K); W.add(o); block(p[0] - .8, p[0] + .8, p[1] - 1, p[1] + 1, 6); });
    // 큰길과 대로의 공사 구간, 쓰레기통: 걷는 길(차도에서 5미터 안쪽)은 비우고 건물 쪽에 둔다
    const rprop = (name, x, z, rot, half) => { const o = kit.lib['roads/' + name].scene.clone(true); o.position.set(x, 0, z); o.rotation.y = rot || 0; o.scale.setScalar(K); kit.bright(o, .8); W.add(o); if (half) block(x - half[0], x + half[0], z - half[1], z + half[1], 3); return o; };
    [[-12, -7.3, 0], [33, 7.3, 0], [-45, -7.3, 0], [47, -7.3, 0]].forEach(p => { rprop('construction-barrier', p[0], p[1], p[2], [1.1, .4]); rprop('construction-cone', p[0] - 2, p[1] + (p[1] < 0 ? .9 : -.9), 0); rprop('construction-cone', p[0] + 2, p[1] + (p[1] < 0 ? .9 : -.9), 0); });
    [[-7.4, -17, Math.PI / 2], [7.4, -34, Math.PI / 2], [-7.4, 6.5, Math.PI / 2]].forEach(p => { rprop('construction-barrier', p[0], p[1], p[2], [.4, 1.1]); rprop('construction-cone', p[0] + (p[0] < 0 ? .9 : -.9), p[1] - 2, 0); rprop('construction-cone', p[0] + (p[0] < 0 ? .9 : -.9), p[1] + 2, 0); });
    [[-30, -6.9, 0], [25, 6.9, Math.PI], [-52, 6.9, Math.PI], [14, -6.9, 0], [7.2, 16, -Math.PI / 2], [-7.2, -24, Math.PI / 2]].forEach(p => rprop('dumpster', p[0], p[1], p[2], [.9, .9]));

    // 등록: 현장 빛과 안개, 훈련 자리(기본은 큰길 광장), 걸어갈 수 있는 바닥
    Object.assign(spec, { battle: { cx: 0, cz: 0, arena: [-12, 12, -6, 6], cam: null } });
    S.register('harbor', W, { light: ['#05070f', '#8a9ee0', '#141a30', 1.25, '#aebfff', 1.55], fog: [50, 135], surfaces: surfaces, spec: spec });
    S.camSolids(camSolid);
    kit.scene.updateMatrixWorld(true);
    return spec;
  }

  // ── 매 프레임: 물결, 표지판·부표·등대 상태 ──
  // 카메라와 앞장선 탐정 사이를 가리는 차는 잠깐 감춘다
  function between(x, z, ax, az, bx, bz, r) { const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)); return Math.hypot(x - (ax + dx * t), z - (az + dz * t)) < r; }
  function trafficTick(dt, px, pz, pgy, cx, cz) {
    const hide = (x, z) => pgy < 3 && cx != null && between(x, z, cx, cz, px, pz, 3.2);
    still.forEach(s => { s.o.visible = trafficOn && !hide(s.x, s.z); });
    traffic.forEach(c => {
      c.hid = hide(c.g.position.x, c.g.position.z); c.g.visible = trafficOn && !c.hid;
      let ahead = 99; if (pgy < 3) { const along = c.axis === 'x' ? px - c.p : pz - c.p, lat = c.axis === 'x' ? pz - c.lane : px - c.lane; if (Math.abs(lat) < 2.4) ahead = along * c.dir; }
      const brake = ahead > -1 && ahead < 9 ? 0 : 1; traffic.forEach(o => { if (o !== c && o.axis === c.axis && o.dir === c.dir && Math.abs(o.lane - c.lane) < 1 && (o.p - c.p) * c.dir > 0 && (o.p - c.p) * c.dir < 6.5) c.v = Math.min(c.v, o.v); });
      c.v += (c.vmax * brake - c.v) * Math.min(1, dt * (brake ? 1.2 : 3.2)); c.p += c.dir * c.v * dt; if (c.p > c.lim[1]) c.p = c.lim[0]; else if (c.p < c.lim[0]) c.p = c.lim[1];
      if (c.axis === 'x') { c.g.position.set(c.p, 0, c.lane); c.g.rotation.y = c.dir > 0 ? PI2 : -PI2; } else { c.g.position.set(c.lane, 0, c.p); c.g.rotation.y = c.dir > 0 ? 0 : Math.PI; }
    });
  }
  const PI2 = Math.PI / 2;
  function showTraffic(on) { trafficOn = !!on; traffic.forEach(c => { c.g.visible = !!on; }); still.forEach(s => { s.o.visible = !!on; }); }
  function tick(dt, px, pz, pgy, cx, cz) {
    if (!built) return; tAll += dt; if (px != null) trafficTick(dt, px, pz, pgy || 0, cx, cz);
    if (water && water.material.map) { water.material.map.offset.x = (tAll * .012) % 1; water.material.map.offset.y = (tAll * .006) % 1; }
    signs.forEach(s => { s.k += (s.want - s.k) * Math.min(1, dt * 4); s.pv.rotation.z = Math.PI * (1 - s.k); });
    buoys.forEach(b => { const k = b.on ? .65 + Math.sin(tAll * 3 + b.x) * .2 : 0; b.glow.material.opacity += (k - b.glow.material.opacity) * Math.min(1, dt * 5); b.bulb.material.emissiveIntensity = b.on ? 1.4 : 0; b.bulb.material.emissive.set(b.on ? '#dfff1a' : '#000000'); });
    lamps.forEach(l => { const k = l.on ? .85 : 0; l.g.material.opacity += (k - l.g.material.opacity) * Math.min(1, dt * 4); });
    const lh = spec.lighthouse; if (lh) { const on = lh.on ? 1 : 0; lh.glow.material.opacity += (on * (.8 + Math.sin(tAll * 2.4) * .15) - lh.glow.material.opacity) * Math.min(1, dt * 3); lh.light.intensity += (on * 90 - lh.light.intensity) * Math.min(1, dt * 3); lh.lamp.material.emissive.set(on ? '#eaffa0' : '#000000'); lh.lamp.material.emissiveIntensity = on * 1.6; }
    if (spec.beacons) spec.beacons.forEach((g, i) => { g.material.opacity = Math.sin(tAll * 2.1 + i * 1.3) > .25 ? .95 : .15; });   // 탑의 붉은 경고등이 깜박인다
    const rs = spec.roofSignal; if (rs) { const on = rs.on ? 1 : 0; rs.glow.material.opacity += (on * (.8 + Math.sin(tAll * 3) * .15) - rs.glow.material.opacity) * Math.min(1, dt * 3); rs.bulb.material.emissive.set(on ? '#dfff1a' : '#000000'); rs.bulb.material.emissiveIntensity = on * 1.6; }
  }

  // ── 이동 ──
  // 원(반지름 r)이 상자에 겹치면 가까운 쪽으로 밀어낸다
  function resolve(x, z, r, gy) {
    for (let it = 0; it < 3; it++) {
      let moved = false;
      for (let i = 0; i < col.length; i++) {
        const c = col[i]; if (gy >= c[4] || gy < c[5]) continue;
        const x0 = c[0] - r, x1 = c[1] + r, z0 = c[2] - r, z1 = c[3] + r;
        if (x > x0 && x < x1 && z > z0 && z < z1) {
          const dl = x - x0, dr = x1 - x, du = z - z0, dd = z1 - z, m = Math.min(dl, dr, du, dd);
          if (m === dl) x = x0; else if (m === dr) x = x1; else if (m === du) z = z0; else z = z1; moved = true;
        }
      }
      if (!moved) break;
    }
    return [x, z];
  }
  // 이동 경로를 짧게 나눠 얇은 벽을 지나치지 않고, 벽을 따라서는 이동한다.
  function sweep(x, z, dx, dz, radius, gy) {
    if (inside(x, z, gy, radius)) [x, z] = resolve(x, z, radius, gy);
    const allowed = (px, pz) => !inside(px, pz, gy, radius);
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
  function inside(x, z, gy, r) { for (let i = 0; i < col.length; i++) { const c = col[i]; if (gy >= c[4] || gy < c[5]) continue; if (x > c[0] - r && x < c[1] + r && z > c[2] - r && z < c[3] + r) return true; } return false; }
  // 지금 있는 구역 이름
  const ZONES = [
    { id: 'roof', name: '옥상 전망대', f: (x, z, y) => y > 8 },
    { id: 'pier', name: '선착장', f: (x, z) => x > 21.5 && x < 28.5 && z > 34 },
    { id: 'quay', name: '해솔 부두', f: (x, z) => z >= 24.5 },
    { id: 'cargo', name: '화물 마당', f: (x, z) => z > 14.5 && z < 24.5 && (x < -12 || x > 12) },
    { id: 'yard', name: '골목 공터', f: (x, z) => x < -30.5 && x > -44.5 && z < -15 && z > -30 },
    { id: 'hill', name: '해솔 언덕', f: x => x > 63 },
    { id: 'alley', name: '골목', f: (x, z) => z < -8 && x < -16 },
    { id: 'north', name: '북쪽 대로', f: (x, z) => z < -8 && Math.abs(x) < 9 },
    { id: 'main', name: '해솔로 큰길', f: () => true }
  ];
  function zoneAt(x, z, y) { return ZONES.find(zn => zn.f(x, z, y || 0)); }
  // 훈련이 열릴 수 있는 열린 자리(건물에 걸리지 않는 곳)
  const ARENAS = { plaza: [-12, 12, -6, 6], yard: [-43, -32, -28.5, -16], quay: [-14, 14, 26.4, 33], cargo: [49, 59, 24.5, 33], roof: [24.5, 37.5, -20.5, -12.2] };
  function attach() { S.camSolids(camSolid); }
  return { carPos: () => traffic.map(t => [+t.g.position.x.toFixed(1), +t.g.position.z.toFixed(1), +t.v.toFixed(1), t.g.visible]), solids: camSolid, traffic: showTraffic, attach: attach, build: build, tick: tick, resolve: resolve, sweep: sweep, inside: inside, zoneAt: zoneAt, ARENAS: ARENAS, spec: spec, map: map, signs: signs, buoys: buoys, lamps: lamps, built: () => built };
})();
