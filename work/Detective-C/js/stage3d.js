'use strict';
/* 3D 현장. 도시 거리는 Kenney City Kit(CC0) 조각을 늘어놓아 만들고, 어두운 창고 안, 연못가 오두막, 달빛 시계탑 안은 여기서 직접 만든다. 인물은 VRM·GLB 모델을 세운다.
   비스듬히 내려다보는 시점이다. 모델 파일은 주소(http)로 열었을 때만 읽힌다. */
window.Stage3D = (function () {
  const T = window.THREE, K = 4.6, RS = 8;   // K: 건물·소품 한 칸의 크기(m), RS: 차도 조각의 크기(m)
  const ROAD_Z = 0, WALK_Z = -5.3, SHOP_Z = -8.9;   // 차도 가운데, 가게 앞 보도, 건물 줄
  let renderer, scene, camera, sun, hemi, lamp, lampOf = null, lampPow = 1, city, ware, chest, cabin, doorG, cloud, paintM, tower, tw, shk = 0, cur = 'street', fxg, fxw, by = 0, raf = 0, last = 0, onTick = null, loadP = null;
  const lib = { sc: {} }, actors = [], fx = [], LAMP = 36;   // LAMP: 말랑불 불빛의 세기
  const focus = new T.Vector3(), want = new T.Vector3();
  const supportSurfaces = {}, groundRay = new T.Raycaster(), solePoint = new T.Vector3();
  groundRay.ray.direction.set(0, -1, 0);
  groundRay.far = .75;
  const CAM = { side: -3.2, up: 10, back: 12.5, fov: 30, chase: 0 };
  // 카메라 자리. field는 거리를 넓게 보여 주고, battle은 인물이 커 보이게 당긴다(훈련 중에는 field.js가 인물을 따라 움직인다)
  // chase(C안 액션 훈련): 앞장선 탐정의 등 뒤에서 상대 쪽을 본다. back은 뒤로 물러난 거리, side는 어깨 쪽으로 비킨 거리, 방향은 heading()으로 정한다
  const CAMS = { world: { side: -.7, up: 4.6, back: 8.8, fov: 52, chase: 1, aim: 1.9 }, field: { side: -3.2, up: 10, back: 12.5, fov: 30, chase: 0 }, battle: { side: -1, up: 6.6, back: 8.6, fov: 30, chase: 0 }, chase: { side: -.9, up: 3.8, back: 7.2, fov: 50, chase: 1, aim: .9 } };
  let zk = 1, zt = 1;   // 카메라 거리의 배율(지금 값, 목표 값). 훈련에서 팀과 상대가 멀어지면 field.js가 키운다
  let fk = 0;   // 화각이 튀는 정도(도). 타격 때 field.js가 fovKick으로 키우고 빠르게 줄어든다
  let hy = 0, cbox = null, solids = null, ck = 1, ckSnap = false, frate = 3.2;   // hy: 등 뒤 카메라가 바라보는 방향(0이면 +z), cbox: 카메라가 나갈 수 있는 범위 [x0, x1, z0, z1]. 벽 뒤로 나가지 않게 한다
  function camMode(n) { Object.assign(CAM, CAMS[n] || CAMS.field); zk = zt = 1; cbox = null; if (camera) { camera.fov = CAM.fov; camera.updateProjectionMatrix(); } }

  function ok() {
    if (!T || !window.GLTFLoader || !window.THREE_VRM || (location.protocol === 'file:' && !window.ArchiveModels)) return false;
    try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; }
  }

  // ── 준비 ──
  function init(canvas) {
    if (renderer) return;
    renderer = new T.WebGLRenderer({ canvas: canvas, antialias: true });
    fitDrawingBuffer();
    addEventListener('resize', fitDrawingBuffer);
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
    scene = new T.Scene(); scene.background = new T.Color('#cdeaff'); scene.fog = new T.Fog('#cdeaff', 55, 130);
    camera = new T.PerspectiveCamera(CAM.fov, 16 / 9, 0.5, 300);
    hemi = new T.HemisphereLight('#ffffff', '#c3d2e6', 1.9); scene.add(hemi);
    lamp = new T.PointLight('#ffd08a', 0, 0, 2); lamp.castShadow = true; lamp.shadow.mapSize.set(1024, 1024); lamp.shadow.bias = -0.004;
    lamp.shadow.camera.near = .2; lamp.shadow.camera.far = 20; lamp.visible = false; scene.add(lamp);   // 어두운 곳에서 친구가 내는 불빛
    sun = new T.DirectionalLight('#fff1d2', 2.4); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04;
    const sc = sun.shadow.camera; sc.left = -34; sc.right = 34; sc.top = 30; sc.bottom = -30; sc.near = 1; sc.far = 120;
    scene.add(sun, sun.target);
    fxg = new T.Group(); scene.add(fxg);
    fxw = new T.Group(); scene.add(fxw);   // 월드가 직접 높이를 정하는 표시(고리, 반짝 조각)
  }

  function fitDrawingBuffer() {
    if (!renderer) return;
    const screenScale = Math.min(innerWidth / 1920, innerHeight / 1080) * (window.devicePixelRatio || 1);
    const scale = Math.max(.4, Math.min(1, screenScale));
    if (renderer.getPixelRatio() !== scale) renderer.setDrawingBufferSize(1920, 1080, scale);
  }

  const CITY = {
    roads: ['road-straight', 'road-crossing', 'road-crossroad', 'light-square', 'light-curved', 'traffic-light', 'road-sign-street', 'construction-cone', 'construction-barrier', 'dumpster'],
    industrial: ['building-a', 'building-b', 'building-r', 'building-s', 'chimney-large', 'detail-tank-large', 'shipping-container-a', 'shipping-container-b', 'shipping-container-c', 'water-tower'],
    cars: ['sedan', 'sedan-sports', 'taxi', 'van', 'delivery', 'truck', 'suv', 'hatchback-sports'],   // 앰뷸런스·청소차·경찰차는 무늬가 번져 보여 뺐다
    suburban: ['building-type-a', 'building-type-b', 'building-type-c', 'building-type-d', 'building-type-e', 'building-type-f', 'building-type-g', 'building-type-h', 'tree-large', 'tree-small'],
    commercial: ['building-a', 'building-b', 'building-c', 'building-d', 'building-e', 'building-f', 'building-g', 'building-h', 'building-i', 'building-j', 'building-k', 'building-l', 'building-m', 'building-n', 'detail-parasol-a', 'detail-parasol-b']
  };
  const CHR = {}; Object.keys(window.GAME.models).forEach(k => { CHR[k] = window.GAME.models[k].file; });   // 모델 파일은 js/data.js의 models에서 정한다

  function load(onProg) {
    if (loadP) return loadP;
    const L = new window.GLTFLoader(); const loadAsset = (url, done, progress, fail) => window.ArchiveModels.load(L, url, done, fail); L.register(p => new window.THREE_VRM.VRMLoaderPlugin(p));
    const jobs = []; let done = 0;
    const add = (key, url) => jobs.push(new Promise((res, rej) => loadAsset(url, g => { lib[key] = g; done++; if (onProg) onProg(done / jobs.length); res(); }, undefined, rej)));
    Object.keys(CITY).forEach(kit => CITY[kit].forEach(n => add(kit + '/' + n, 'assets/city/' + kit + '/' + n + '.glb')));
    Object.keys(CHR).forEach(k => add(k, CHR[k]));
    const fonts = document.fonts?.load('900 40px Pretendard', '달빛 탐정').catch(() => []);
    loadP = Promise.all([Promise.all(jobs), fonts]).then(() => { if (window.GAME.legacyScenes) { buildCity(); buildWare(); buildCabin(); buildTower(); } else stubScenes(); scene.updateMatrixWorld(true); setScene('street'); });
    loadP.catch(() => { loadP = null; });
    return loadP;
  }

  // ── 도시 거리 ──
  function piece(key, x, z, rot, s, y) {
    const o = lib[key].scene.clone(true); o.position.set(x, y || 0, z); o.rotation.y = rot || 0; o.scale.setScalar(s || K);
    o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    city.add(o); return o;
  }
  function bright(o, k) { o.traverse(m => { if (m.isMesh) { m.material = m.material.clone(); m.material.color.setScalar(k); } }); return o; }
  function tint(o, color) { o.traverse(m => { if (m.isMesh) { m.material = new T.MeshStandardMaterial({ color: color, roughness: .8 }); } }); return o; }
  function signTex(text, bg, fg, w, h, moon) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
    g.fillStyle = bg; g.fillRect(0, 0, w, h); g.fillStyle = '#dfff1a'; g.fillRect(0, h - 14, w, 14);
    let tx = w / 2;
    if (moon) { g.fillStyle = '#dfff1a'; g.beginPath(); g.arc(70, h / 2 - 6, 38, 0, 7); g.fill(); g.fillStyle = bg; g.beginPath(); g.arc(88, h / 2 - 18, 34, 0, 7); g.fill(); tx = w / 2 + 34; }
    g.fillStyle = fg; g.font = '900 ' + Math.round(h * .5) + 'px Pretendard, "Malgun Gothic", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, tx, h / 2 - 6);
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 8; return t;
  }
  function awning(x, w, front, color) {
    const c = document.createElement('canvas'); c.width = 64; c.height = 8; const g = c.getContext('2d'); g.fillStyle = '#ffffff'; g.fillRect(0, 0, 64, 8); g.fillStyle = color; g.fillRect(0, 0, 32, 8);
    const t = new T.CanvasTexture(c); t.wrapS = T.RepeatWrapping; t.repeat.set(Math.round(w / .7), 1); t.colorSpace = T.SRGBColorSpace; t.magFilter = T.NearestFilter;
    const m = new T.Mesh(new T.BoxGeometry(w, .07, 1.3), new T.MeshStandardMaterial({ map: t, roughness: .9 })); m.position.set(x, 2.22, front + .58); m.rotation.x = .36; m.castShadow = true; city.add(m);
    const lip = new T.Mesh(new T.BoxGeometry(w, .22, .05), new T.MeshStandardMaterial({ color: color })); lip.position.set(x, 1.9, front + 1.2); city.add(lip);
  }
  function sign(text, x, y, z, w, h, bg, fg, moon) {
    const m = new T.Mesh(new T.BoxGeometry(w, h, .18), [0, 0, 0, 0, 1, 0].map(f => new T.MeshStandardMaterial(f ? { map: signTex(text, bg, fg, 640, Math.round(640 * h / w), moon), roughness: .6 } : { color: bg })));
    m.position.set(x, y, z); m.castShadow = true; city.add(m); return m;
  }
  // 옛 현장 네 곳(거리·창고·오두막·시계탑)은 C안에서 쓰지 않아 만들지 않는다. 필요하면 GAME.legacyScenes = true로 다시 만든다.
  function stubScenes() {
    city = new T.Group(); ware = new T.Group(); cabin = new T.Group(); tower = new T.Group();
    [city, ware, cabin, tower].forEach(g => { g.visible = false; scene.add(g); });
    chest = { lid: { rotation: { x: 0 } }, glow: { intensity: 0 } }; doorG = { rotation: { y: 0 } }; cloud = { scale: { setScalar() {} } }; paintM = { opacity: 0 };
    tw = { dev: {}, moon: 0, on: false, glass: {}, face: {}, spin: [], hands: [] };
  }
  function buildCity() {
    city = new T.Group(); scene.add(city);
    const ground = new T.Mesh(new T.PlaneGeometry(400, 400), new T.MeshStandardMaterial({ color: '#e3eaf3', roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.03; ground.receiveShadow = true; city.add(ground);
    // 보도 무늬(가게 앞)
    const pc = document.createElement('canvas'); pc.width = pc.height = 128; const pg = pc.getContext('2d');
    pg.fillStyle = '#f1f5fa'; pg.fillRect(0, 0, 128, 128); pg.strokeStyle = '#d3deeb'; pg.lineWidth = 4; pg.strokeRect(0, 0, 128, 128);
    const pt = new T.CanvasTexture(pc); pt.wrapS = pt.wrapT = T.RepeatWrapping; pt.repeat.set(60, 4); pt.colorSpace = T.SRGBColorSpace;
    const walk = new T.Mesh(new T.PlaneGeometry(RS * 15, 3.4), new T.MeshStandardMaterial({ map: pt, roughness: 1 }));
    walk.rotation.x = -Math.PI / 2; walk.position.set(RS, 0.02, WALK_Z - .6); walk.receiveShadow = true; city.add(walk);
    const walk2 = walk.clone(); walk2.position.z = 5.7; city.add(walk2);
    // 차도: 가운데 건널목, 오른쪽 끝 네거리
    supportSurfaces.street = [ground, walk, walk2];
    for (let i = -6; i <= 8; i++) {
      const road = piece('roads/' + (i === -1 ? 'road-crossing' : i === 6 ? 'road-crossroad' : 'road-straight'), i * RS, ROAD_Z, 0, RS);
      bright(road, 1.45);
      supportSurfaces.street.push(road);
    }
    // 가게 줄(먼 쪽). 달빛 베이커리는 가운데 넓은 건물이다.
    const row = ['building-c', 'building-g', 'building-a', 'building-j', 'building-e', 'building-f', 'building-b', 'building-k', 'building-i', 'building-d', 'building-l'];
    let x = -5.2 * K;
    row.forEach((b, i) => { const wide = /-[ejk]$/.test(b) ? 1.75 : 1; x += wide * K * .5; piece('commercial/' + b, x, SHOP_Z, 0, K); if (b === 'building-e') lib.bakeryX = x; x += wide * K * .5 + .3; });
    // 뒤쪽 한 줄 더(멀리 보이는 건물)
    ['building-m', 'building-n', 'building-h', 'building-m', 'building-n', 'building-h', 'building-m'].forEach((b, i) => piece('commercial/' + b, (-4.6 + i * 1.7) * K, SHOP_Z - K * 1.45, 0, K * 1.5));
    // 달빛 베이커리: 차양, 간판, 바깥 탁자
    const bx = lib.bakeryX;
    const front = SHOP_Z + K * .5;
    awning(bx - 1.75, 3.5, front, '#dfff1a'); awning(bx + 2.35, 2.1, front, '#1a9df5');
    sign('달빛 베이커리', bx, 3.35, front + .12, 5.4, 1.1, '#2d4663', '#ffffff', true);
    const tx = bx + 5.4, tz = WALK_Z - .5;
    piece('commercial/detail-parasol-a', tx, tz, 0, K * .95);
    const plate = new T.Mesh(new T.CylinderGeometry(.34, .26, .06, 24), new T.MeshStandardMaterial({ color: '#bfe2ff' })); plate.position.set(tx + .25, .62, tz + .55); plate.castShadow = true; city.add(plate);
    // 이 현장에서 인물이 서는 자리와 조사할 곳(field.js가 읽는다)
    lib.sc.street = {
      ry: Math.PI / 2, start: [[bx - 11, -3.5], [bx - 12.4, -2.6], [bx - 10.8, -4.6], [bx - 13.2, -3.8], [bx - 14, -2.8]], enter: [bx - 6.2, -3.6],
      look0: [bx - .4, -2.6], look: lx => [bx + .6 + (lx - bx - .6) * .3, -2.6],
      spots: { floor: { x: bx - 3.4, z: WALK_Z + 1.5 }, window: { x: bx - 1.7, z: WALK_Z - .7 }, plate: { x: tx + .3, z: tz + 1.7 } },
      battle: { cx: bx + 1.5, cz: 0, arena: [bx - 5.5, bx + 8.5, -3.6, 4], cam: [-1000, 1000, -5.4, 12] }
    };
    // 바닥의 끈적한 자국(가게 앞에서 건널목 쪽으로)
    const goo = new T.MeshStandardMaterial({ color: '#f0b45a', roughness: .25, transparent: true, opacity: .85 });
    for (let i = 0; i < 9; i++) { const d = new T.Mesh(new T.CircleGeometry(.34 - i * .018, 18), goo); d.rotation.x = -Math.PI / 2; d.scale.set(1, 1.7, 1); d.rotation.z = .5; d.position.set(bx - .4 - i * .78, .05, WALK_Z - .9 + i * .62); city.add(d); }
    // 거리 소품
    [-2.6, 3.4].forEach(i => piece('roads/light-square', i * RS, 4.9, Math.PI, K * .9));
    piece('roads/traffic-light', -RS * .5 + .4, 4.7, Math.PI, K); piece('roads/road-sign-street', -RS * 1.5 - .4, WALK_Z + 1.2, 0, K);
    piece('roads/dumpster', bx - 12, WALK_Z - 1.2, 0, K * .9); piece('commercial/detail-parasol-b', bx + 10.5, WALK_Z - .5, 0, K * .95);
    [[2.4], [1.1], [-.2]].forEach((p, i) => piece('roads/construction-cone', bx + 19 + i * .5, p[0], 0, K * .9));
    sign('솔 탐정 사무소 →', bx - 9.6, 2.9, front + .12, 3.9, .8, '#1a9df5', '#ffffff');
  }

  // ── 어두운 창고(안) ── 받아 둔 도시 조각에는 실내용이 없어서 벽·선반·통·상자를 여기서 직접 만든다.
  function canvasTex(w, h, draw, rx, ry) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'));
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rx || 1, ry || 1); t.anisotropy = 8; return t;
  }
  // 색만 있는 재질, 상자 모양 하나 놓기(창고와 오두막에서 함께 쓴다)
  const M = (c, r) => new T.MeshStandardMaterial({ color: c, roughness: r == null ? .9 : r });
  const B = (g, w, h, d, x, y, z, mat, ry) => { const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); if (ry) m.rotation.y = ry; m.castShadow = m.receiveShadow = true; g.add(m); return m; };
  function buildWare() {
    ware = new T.Group(); ware.visible = false; scene.add(ware);
    // 돌바닥
    const ft = canvasTex(256, 256, g => { g.fillStyle = '#9c9ca6'; g.fillRect(0, 0, 256, 256); g.strokeStyle = '#7d7d88'; g.lineWidth = 5; [[0, 0], [128, 0], [-64, 128], [64, 128], [192, 128]].forEach(p => g.strokeRect(p[0], p[1], 128, 128)); }, 14.4, 8);
    const floor = new T.Mesh(new T.PlaneGeometry(28.8, 16), new T.MeshStandardMaterial({ map: ft, roughness: 1 })); floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, 1); floor.receiveShadow = true; ware.add(floor); supportSurfaces.warehouse = [floor];
    // 나무판 벽(뒤, 왼쪽, 오른쪽). 앞쪽 벽은 안이 보이도록 두지 않는다.
    const wt = canvasTex(128, 128, g => { g.fillStyle = '#c9a27a'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#b08960'; for (let i = 0; i < 4; i++) g.fillRect(i * 32, 0, 3, 128); }, 14, 1);
    const wall = new T.MeshStandardMaterial({ map: wt, roughness: 1 }), trim = M('#8d6741'), plank = M('#a9814f'), dark = M('#6f4e2e');
    B(ware, 29.2, 5.4, .4, 0, 2.7, -7.2, wall); B(ware, .4, 5.4, 16, -14.4, 2.7, 1, wall); B(ware, .4, 5.4, 16, 14.4, 2.7, 1, wall);
    B(ware, 28.8, .3, .12, 0, .15, -6.95, trim); B(ware, 28.8, .36, .3, 0, 5.1, -6.9, trim);
    [-8.7, -1.5, 5.6, 9.6].forEach(x => B(ware, .36, 5.2, .36, x, 2.6, -6.85, trim));
    // 높은 창(달빛이 조금 비친다)과 들어온 문
    const glass = new T.MeshStandardMaterial({ color: '#24344f', emissive: '#86a9e6', emissiveIntensity: .55 });
    [-5, 2.1, 7.6].forEach(x => { B(ware, 1.7, 1, .08, x, 3.95, -6.97, glass); B(ware, 1.86, .1, .12, x, 3.95, -6.95, trim); B(ware, .1, 1.16, .12, x, 3.95, -6.95, trim); });
    B(ware, 1.5, 2.7, .1, -11.3, 1.35, -6.96, dark); B(ware, 1.86, .2, .16, -11.3, 2.8, -6.94, trim); [-12.14, -10.46].forEach(x => B(ware, .18, 2.9, .16, x, 1.45, -6.94, trim));
    const knob = new T.Mesh(new T.SphereGeometry(.08, 12, 8), M('#e0b040', .4)); knob.position.set(-10.75, 1.25, -6.88); ware.add(knob);
    // 상자(나무 궤짝)와 통
    const ct = canvasTex(128, 128, g => { g.fillStyle = '#c2955a'; g.fillRect(0, 0, 128, 128); g.strokeStyle = '#9c723f'; g.lineWidth = 14; g.strokeRect(7, 7, 114, 114); g.lineWidth = 11; g.beginPath(); g.moveTo(14, 14); g.lineTo(114, 114); g.moveTo(114, 14); g.lineTo(14, 114); g.stroke(); });
    const crateM = new T.MeshStandardMaterial({ map: ct, roughness: .9 });
    const crate = (x, y, z, s, ry) => B(ware, s, s, s, x, y, z, crateM, ry);
    const wood = M('#a8703a'), hoop = M('#565b70', .5);
    const barrel = (x, z, r, h) => {
      const g = new T.Group(); g.position.set(x, 0, z); ware.add(g);
      const body = new T.Mesh(new T.LatheGeometry([[0, 0], [r * .84, 0], [r, h * .5], [r * .84, h], [0, h]].map(p => new T.Vector2(p[0], p[1])), 18), wood); body.castShadow = body.receiveShadow = true; g.add(body);
      [.2, .8].forEach(k => { const hp = new T.Mesh(new T.CylinderGeometry(r * .945, r * .945, .09, 18, 1, true), hoop); hp.position.y = h * k; g.add(hp); });
    };
    // 선반(뒤쪽 벽, 왼쪽)
    [-7, -5, -3].forEach(x => [-6.88, -6.14].forEach(z => B(ware, .12, 2.75, .12, x, 1.375, z, trim)));
    [.75, 1.55, 2.35].forEach(y => B(ware, 4.3, .08, .9, -5, y, -6.5, plank));
    [[-6.5, .79, .5, .2], [-3.6, .79, .6, 0], [-5, 1.59, .55, .1], [-4.2, 1.59, .42, .4], [-6.4, 2.39, .6, 0], [-3.7, 2.39, .5, .2]].forEach(p => crate(p[0], p[1] + p[2] / 2, -6.5, p[2], p[3]));
    [[-5.6, .79], [-6.2, 1.59], [-3.3, 1.59], [-4.7, 2.39]].forEach(p => { const j = new T.Mesh(new T.CylinderGeometry(.16, .19, .42, 12), M('#7f9bb8', .5)); j.position.set(p[0], p[1] + .21, -6.5); j.castShadow = true; ware.add(j); });
    crate(-6.6, .28, -6.5, .56, .1); crate(-3.4, .24, -6.45, .48, .3);
    // 통 무더기(뒤쪽 벽, 가운데)
    [[.9, -6.3, .48, 1.15], [2, -6.35, .48, 1.15], [3, -6.2, .48, 1.15], [1.45, -5.65, .44, 1.05], [2.55, -5.6, .44, 1.05], [-13.4, .5, .46, 1.1]].forEach(p => barrel(p[0], p[1], p[2], p[3]));
    // 상자 더미(오른쪽 벽, 왼쪽 벽)
    crate(13.3, .65, -2.2, 1.3, 0); crate(13.2, .65, -.8, 1.3, .1); crate(13.3, 1.85, -1.5, 1.1, .35); crate(12.1, .45, -.2, .9, .25);
    crate(-13.5, .6, -3.2, 1.2, 0); crate(-13.5, .6, -1.9, 1.2, .05); crate(-13.4, 1.7, -2.6, 1, .3);
    // 구석의 큰 상자(뚜껑이 열린다)
    const c = new T.Group(); c.position.set(12.2, 0, -5.7); c.rotation.y = -.45; ware.add(c);
    const cw = M('#7a5230'), gold = new T.MeshStandardMaterial({ color: '#e0b040', roughness: .45, metalness: .3 });
    B(c, 2, .85, 1.2, 0, .425, 0, cw); [-.72, .72].forEach(px => B(c, .16, .89, 1.24, px, .44, 0, gold));
    const lid = new T.Group(); lid.position.set(0, .85, -.6); c.add(lid);
    B(lid, 2.04, .4, 1.24, 0, .2, .6, cw); [-.72, .72].forEach(px => B(lid, .16, .44, 1.28, px, .2, .6, gold)); B(lid, .3, .34, .08, 0, .05, 1.24, gold);
    const glow = new T.PointLight('#9fe3ff', 0, 9, 2); glow.position.set(0, 1.1, 0); c.add(glow);
    chest = { lid: lid, glow: glow };
    lib.sc.warehouse = {
      dark: true, ry: 0, start: [[-11.3, -5.4], [-12.2, -4.5], [-10.4, -5.7], [-11.6, -3.7], [-12.6, -3.4]], enter: [-8.6, -3.4],
      look0: [-6, -1.6], look: (lx, lz) => [lx * .55, Math.max(-1.6, lz - .2)], bounds: [-11, 9.9, -5, 1],
      spots: { p1: { x: -5, z: -6.02, sx: -5.5, sz: -4.9 }, p2: { x: 3.95, z: -5.9, sx: 4.6, sz: -4.8 }, p3: { x: 10.9, z: -.75, sx: 9.8, sz: -.1 } },
      battle: { cx: -1, cz: -1.6, from: [3.9, -4.8], arena: [-9, 7, -4.8, 2.2], cam: [-13.3, 13.3, -6.2, 12] }, chest: { x: 12.2, z: -5.7, sx: 10.3, sz: -4.5 }
    };
  }
  function openChest() { let t = 0; fx.push({ tick: dt => { t += dt; const k = Math.min(1, t / 1.3), e = k * k * (3 - 2 * k); chest.lid.rotation.x = -1.75 * e; chest.glow.intensity = 16 * e; return k < 1; } }); }

  // ── 연못가 오두막(바깥) ── 풀밭·연못·오두막·나무도 여기서 직접 만든다. 지붕·벽·문·테두리 색은 기존 게임의 오두막 그림을 따랐다.
  function buildCabin() {
    cabin = new T.Group(); cabin.visible = false; scene.add(cabin); const g = cabin, G = window.GAME;
    const flat = (geo, color, x, y, z, rough) => { const m = new T.Mesh(geo, M(color, rough)); m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.receiveShadow = true; g.add(m); return m; };
    const solid = (geo, color, x, y, z) => { const m = new T.Mesh(geo, M(color)); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; g.add(m); return m; };
    // 풀밭, 흙길, 들꽃
    const gt = canvasTex(128, 128, c => { c.fillStyle = '#a8d68a'; c.fillRect(0, 0, 128, 128); c.fillStyle = '#9acb7b'; for (let i = 0; i < 30; i++) c.fillRect((i * 53) % 128, (i * 37) % 128, 5, 13); }, 44, 44);
    const grass = new T.Mesh(new T.PlaneGeometry(180, 180), new T.MeshStandardMaterial({ map: gt, roughness: 1 })); grass.rotation.x = -Math.PI / 2; grass.position.y = -.02; grass.receiveShadow = true; g.add(grass);
    supportSurfaces.cabin = [grass,
      flat(new T.PlaneGeometry(17, 2.3), '#e6d3a3', -9, .01, -3.6),
      flat(new T.CircleGeometry(1.7, 24), '#e6d3a3', -1, .012, -4.6),
      flat(new T.PlaneGeometry(1.9, 1.7), '#e6d3a3', -1, .011, -5.7)
    ];
    const dot = new T.CircleGeometry(.11, 8);
    for (let i = 0; i < 34; i++) { const x = -15 + (i * 7.3) % 20, z = -1.6 + (i * 3.7) % 6.5; if (z < -2.2 && x < 0) continue; flat(dot, ['#ffffff', '#dfff1a', '#f7a8c4'][i % 3], x, .02, z); }
    // 연못
    flat(new T.CircleGeometry(1, 44), '#ecdcae', 10, .015, -1).scale.set(5.7, 4.9, 1);
    flat(new T.CircleGeometry(1, 44), '#6cc4ec', 10, .04, -1, .2).scale.set(5, 4.2, 1);
    [[9, -2.6], [11.6, .5], [12.6, -2], [8.3, 1]].forEach(p => flat(new T.CircleGeometry(.4, 12), '#5fae62', p[0], .06, p[1]));
    [[5.3, -3.1], [5.1, -2.7], [5.5, -3.5], [14.4, 1.6], [14.8, 1.1], [7, 3], [7.5, 3.2]].forEach(p => { solid(new T.CylinderGeometry(.04, .04, 1.3, 6), '#6b9a4a', p[0], .65, p[1]); solid(new T.CylinderGeometry(.07, .07, .3, 6), '#8a6a45', p[0], 1.35, p[1]); });
    [[5.7, 1.9, .5], [6.4, 2.4, .3], [15.2, -3, .6]].forEach(p => solid(new T.DodecahedronGeometry(p[2]), '#a9adb8', p[0], p[2] * .4, p[1]).scale.set(1, .6, 1));
    // 오두막: 통나무 벽, 초록 지붕, 굴뚝
    const logT = canvasTex(64, 128, c => { c.fillStyle = '#b98a5e'; c.fillRect(0, 0, 64, 128); c.fillStyle = '#a67a50'; for (let i = 0; i < 4; i++) c.fillRect(0, i * 32, 64, 4); }, 1, 1.5);
    const logM = new T.MeshStandardMaterial({ map: logT, roughness: 1 }), roofM = M('#6f9a5e'), trimM = M('#8fb98c');
    B(g, 8, 3.2, 5, -3, 1.6, -9, logM);
    B(g, 8.9, .26, 3.3, -3, 4.05, -7.64, roofM).rotation.x = .6; B(g, 8.9, .26, 3.3, -3, 4.05, -10.36, roofM).rotation.x = -.6; B(g, 8.9, .2, .44, -3, 5.02, -9, M('#5f8a50'));
    const tri = new T.Shape(); tri.moveTo(-2.5, 0); tri.lineTo(2.5, 0); tri.lineTo(0, 1.72); tri.closePath();
    [-7, .8].forEach(x => { const m = solid(new T.ExtrudeGeometry(tri, { depth: .2, bevelEnabled: false }), '#b98a5e', x, 3.2, -9); m.rotation.y = Math.PI / 2; });
    B(g, .7, 1.5, .7, -5.6, 5, -10, M('#a9adb8'));
    // 창문
    B(g, 1.2, 1, .08, -6.05, 1.9, -6.47, new T.MeshStandardMaterial({ color: '#cfeaff', emissive: '#9fd0ff', emissiveIntensity: .3 }));
    B(g, 1.44, .12, .12, -6.05, 2.44, -6.45, trimM); B(g, 1.44, .12, .12, -6.05, 1.36, -6.45, trimM); [-6.71, -6.05, -5.39].forEach(x => B(g, .12, 1.08, .12, x, 1.9, -6.45, trimM));
    // 문: 왼쪽 경첩을 축으로 안쪽으로 열린다. 문 뒤는 어둡고, 열리면 구름이 보인다.
    B(g, 1.66, .16, .14, -1, 2.42, -6.46, trimM); [-1.75, -.25].forEach(x => B(g, .16, 2.42, .14, x, 1.21, -6.46, trimM));
    const hole = new T.Mesh(new T.PlaneGeometry(1.34, 2.34), new T.MeshBasicMaterial({ color: '#1d1610' })); hole.position.set(-1, 1.17, -6.49); g.add(hole);
    doorG = new T.Group(); doorG.position.set(-1.67, 0, -6.44); g.add(doorG);
    B(doorG, 1.34, 2.34, .1, .67, 1.17, 0, M('#8a5a3a')); B(doorG, .28, .36, .07, 1.08, 1.15, .07, new T.MeshStandardMaterial({ color: '#e9b530', roughness: .45, metalness: .3 })); B(doorG, .08, .1, .08, 1.08, 1.13, .08, M('#3a2a1c'));
    cloud = new T.Group(); cloud.position.set(-1, 1.2, -6.3); cloud.scale.setScalar(0.001); g.add(cloud);
    const cm = new T.MeshStandardMaterial({ color: '#ffffff', emissive: '#dfe6f5', emissiveIntensity: .6, roughness: 1 });
    [[0, 0, 0, .5], [-.4, -.15, .05, .36], [.42, -.1, .05, .38], [-.15, .3, 0, .34], [.22, .28, .02, .3]].forEach(p => { const s = new T.Mesh(new T.IcosahedronGeometry(p[3], 1), cm); s.position.set(p[0], p[1], p[2]); cloud.add(s); });
    // 벽의 흔적: 마른 얼룩(처음), 물을 뿌리면 드러나는 그림(자물쇠의 순서)
    const order = (G.cases.find(c => c.scene === 'cabin') || { answer: [] }).answer.map(id => G.symbols.find(s => s.id === id));
    const paper = c => { c.fillStyle = '#eef3fb'; c.fillRect(0, 0, 460, 280); };
    const faded = canvasTex(460, 280, c => { paper(c); c.fillStyle = '#e0e9f6'; c.beginPath(); c.arc(100, 130, 52, 0, 7); c.fill(); c.fillRect(196, 104, 78, 60); c.beginPath(); c.arc(366, 146, 44, 0, 7); c.fill(); });
    const shown = canvasTex(460, 280, c => {
      paper(c); c.fillStyle = '#3f5fae'; c.font = '900 54px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      order.forEach((s, i) => { c.save(); c.translate(42 + i * 140, 84); c.scale(1.75, 1.75); c.fill(new Path2D(s.d)); c.restore(); if (i) c.fillText('→', 28 + i * 140, 142); });
    });
    B(g, 2.6, 1.7, .08, -4.1, 1.65, -6.47, M('#e9d2a8'));
    const p1 = new T.Mesh(new T.PlaneGeometry(2.3, 1.4), new T.MeshStandardMaterial({ map: faded, roughness: 1 })); p1.position.set(-4.1, 1.65, -6.42); g.add(p1);
    paintM = new T.MeshStandardMaterial({ map: shown, roughness: 1, transparent: true, opacity: 0 });
    const p2 = new T.Mesh(new T.PlaneGeometry(2.3, 1.4), paintM); p2.position.set(-4.1, 1.65, -6.41); g.add(p2);
    // 푯말, 나무, 덤불
    B(g, .12, 1.5, .12, -9.4, .75, -5.4, M('#8a6a45'));
    const bd = new T.Mesh(new T.BoxGeometry(2.6, .7, .1), [0, 0, 0, 0, 1, 0].map(f => new T.MeshStandardMaterial(f ? { map: signTex('연못가 오두막', '#8a6a45', '#ffffff', 640, 172), roughness: .7 } : { color: '#8a6a45' }))); bd.position.set(-9.4, 1.6, -5.4); bd.castShadow = true; g.add(bd);
    const tree = (x, z, s) => {
      const t = new T.Group(); t.position.set(x, 0, z); t.scale.setScalar(s); g.add(t);
      const tr = new T.Mesh(new T.CylinderGeometry(.22, .3, 1.4, 8), M('#8a6a45')); tr.position.y = .7; tr.castShadow = true; t.add(tr);
      [[1.5, 2.4, 2.2, '#5fa860'], [1.15, 2.1, 3.5, '#6fb86c'], [.75, 1.6, 4.6, '#7fc67a']].forEach(p => { const c = new T.Mesh(new T.ConeGeometry(p[0], p[1], 9), M(p[3])); c.position.y = p[2]; c.castShadow = true; t.add(c); });
    };
    [[-12.5, -9.5, 1.1], [-10, -12, 1.3], [3.6, -9.8, 1.15], [6.5, -12, 1.35], [9.5, -9, 1], [13.2, -7.6, 1.2], [16.5, -4, 1.1], [-15.5, -6.5, 1.2], [1.6, -13, 1.4], [-7.5, -13.5, 1.2], [-16, -11, 1.4], [12, -12.5, 1.5]].forEach(p => tree(p[0], p[1], p[2]));
    [[-7.7, -6.1], [1.7, -6.1], [-12.2, -5.7], [4.2, -6.6]].forEach(p => solid(new T.IcosahedronGeometry(.62, 1), '#7fc07a', p[0], .38, p[1]).scale.set(1, .75, 1));
    lib.sc.cabin = {
      paint: true, ry: Math.PI / 2, start: [[-12, -3.3], [-13.3, -2.5], [-11.8, -4.4], [-14, -3.6], [-14.9, -2.6]], enter: [-7.2, -3.6],
      look0: [-4.5, -2.8], look: lx => [-1.6 + (lx + 1.6) * .35, -2.8],
      spots: { wall: { x: -4.1, z: -6.4, sx: -4.9, sz: -4.9 }, door: { x: -1, z: -6.4, sx: -1.6, sz: -5 } },
      battle: { cx: -1.5, cz: -1.6, span: 3, pond: [7.6, -1.2], arena: [-8.5, 5, -4.2, 3], cam: [-30, 30, -5.6, 14] }
    };
  }
  function paint(k) { paintM.opacity = k; }
  function revealPaint() { let t = 0; fx.push({ tick: dt => { t += dt; paintM.opacity = Math.min(1, t / 1.4); return t < 1.4; } }); }
  function openDoor() {
    let t = 0; fx.push({ tick: dt => { t += dt; const k = Math.min(1, t / 1.1), e = k * k * (3 - 2 * k); doorG.rotation.y = 1.75 * e;
      const c = Math.max(0.001, Math.min(1, (t - .7) / .8)); cloud.scale.setScalar(c * (2 - c)); return t < 1.6; } });
  }
  function ripple(x, z, color, grow) {   // 땅에 퍼지는 고리(색과 퍼지는 크기를 정할 수 있다)
    const st = new T.Shape(), N = 18, rot = Math.random() * 6.28; for (let i = 0; i < N * 2; i++) { const a = rot + i / (N * 2) * Math.PI * 2, r = i % 2 ? .46 : .72 + Math.random() * .3; (i ? st.lineTo : st.moveTo).call(st, Math.cos(a) * r, Math.sin(a) * r); } st.closePath();   // 뾰족한 가장자리의 파열 자국
    const m = new T.Mesh(new T.ShapeGeometry(st), new T.MeshBasicMaterial({ color: color || '#ffffff', transparent: true, opacity: .85, side: T.DoubleSide, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.set(x, .08, z); fxg.add(m);
    let t = 0; const g = grow || 1.6; fx.push({ tick: dt => { t += dt; const k = t / .8; m.scale.setScalar(.5 + k * g); m.material.opacity = .85 * (1 - k); if (k >= 1) { fxg.remove(m); m.material.dispose(); return false; } return true; } });
  }
  function bolt(a, b, color) {   // 번개 한 줄(꺾인 가는 막대 여러 개). 0.16초 보인다
    const pts = [], n = 8, up = new T.Vector3(0, 1, 0), grp = new T.Group(), mat = new T.MeshBasicMaterial({ color: color || '#e6ff7a' });
    for (let i = 0; i <= n; i++) { const k = i / n, j = i === 0 || i === n ? 0 : .45; pts.push(new T.Vector3(a.x + (b.x - a.x) * k + (Math.random() - .5) * j, a.y + (b.y - a.y) * k + (Math.random() - .5) * j, a.z + (b.z - a.z) * k + (Math.random() - .5) * j)); }
    for (let i = 0; i < n; i++) {
      const p = pts[i], q = pts[i + 1], d = q.clone().sub(p), len = d.length(), seg = new T.Mesh(new T.CylinderGeometry(.045, .045, len, 5), mat);
      seg.position.copy(p).add(q).multiplyScalar(.5); seg.quaternion.setFromUnitVectors(up, d.normalize()); grp.add(seg);
    }
    fxg.add(grp); let t = 0; fx.push({ tick: dt => { t += dt; if (t > .16) { fxg.remove(grp); return false; } return true; } });
  }

  // ── 달빛 시계탑(안, 기계실) ── 벽·톱니·전원 장치·시계판을 여기서 직접 만든다. 벽과 테두리 색은 기존 게임의 시계탑 색을 따랐다.
  function gearMesh(parent, r, teeth, thick, color, x, y, z) {   // 앞(+z)을 보고 서 있는 톱니바퀴. rotation.z로 돈다.
    const g = new T.Group(), m = new T.MeshStandardMaterial({ color: color, roughness: .5, metalness: .3 }), hole = M('#2d2a45');
    const disc = new T.Mesh(new T.CylinderGeometry(r * .84, r * .84, thick, 28), m); disc.rotation.x = Math.PI / 2; disc.castShadow = true; g.add(disc);
    for (let i = 0; i < teeth; i++) { const a = i / teeth * Math.PI * 2, t = new T.Mesh(new T.BoxGeometry(r * .26, r * .2, thick), m); t.position.set(Math.cos(a) * r * .94, Math.sin(a) * r * .94, 0); t.rotation.z = a; t.castShadow = true; g.add(t); }
    for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + .4, h = new T.Mesh(new T.CylinderGeometry(r * .17, r * .17, thick + .02, 14), hole); h.rotation.x = Math.PI / 2; h.position.set(Math.cos(a) * r * .5, Math.sin(a) * r * .5, 0); g.add(h); }
    const hub = new T.Mesh(new T.CylinderGeometry(r * .16, r * .16, thick + .12, 14), M('#55586f', .5)); hub.rotation.x = Math.PI / 2; g.add(hub);
    g.position.set(x, y, z); parent.add(g); g.userData.mat = m; return g;
  }
  function buildTower() {
    tower = new T.Group(); tower.visible = false; scene.add(tower); const g = tower, col = c => new T.Color(c);
    // 돌바닥, 벽, 보라색 테두리와 기둥, 깔개
    const ft = canvasTex(256, 256, c => { c.fillStyle = '#bcb9cc'; c.fillRect(0, 0, 256, 256); c.strokeStyle = '#a19db6'; c.lineWidth = 5; [[0, 0], [128, 0], [-64, 128], [64, 128], [192, 128]].forEach(p => c.strokeRect(p[0], p[1], 128, 128)); }, 13, 8);
    const floor = new T.Mesh(new T.PlaneGeometry(25.6, 16), new T.MeshStandardMaterial({ map: ft, roughness: 1 })); floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, 1); floor.receiveShadow = true; g.add(floor);
    const wt = canvasTex(128, 128, c => { c.fillStyle = '#e8d6bd'; c.fillRect(0, 0, 128, 128); c.fillStyle = '#d9c5a8'; c.fillRect(0, 0, 128, 3); c.fillRect(0, 64, 128, 3); c.fillRect(0, 0, 3, 64); c.fillRect(64, 64, 3, 64); }, 12, 4);
    const wall = new T.MeshStandardMaterial({ map: wt, roughness: 1 }), trim = M('#8f7ac9');
    B(g, 26, 6.6, .4, 0, 3.3, -7.2, wall); B(g, .4, 6.6, 16, -12.8, 3.3, 1, wall); B(g, .4, 6.6, 16, 12.8, 3.3, 1, wall);
    B(g, 25.6, .34, .14, 0, .17, -6.94, trim); [-10.4, -3.6, 3.6, 10.4].forEach(x => B(g, .5, 6.4, .4, x, 3.2, -6.85, trim));
    const rug = canvasTex(256, 128, c => { c.fillStyle = '#dfff1a'; c.fillRect(0, 0, 256, 128); c.fillStyle = '#8f7ac9'; c.fillRect(10, 10, 236, 108); c.strokeStyle = '#b7a6ea'; c.lineWidth = 4; c.strokeRect(24, 24, 208, 80); });
    const rg = new T.Mesh(new T.PlaneGeometry(7, 3.5), new T.MeshStandardMaterial({ map: rug, roughness: 1 })); rg.rotation.x = -Math.PI / 2; rg.position.set(0, .012, -1.6); rg.receiveShadow = true; g.add(rg); supportSurfaces.tower = [floor, rg];
    // 창(달빛이 돌아오면 밝아진다), 장치를 잇는 축
    const glass = new T.MeshStandardMaterial({ color: '#27304f', emissive: '#bcd0ff', emissiveIntensity: .12 });
    [-5.2, 5.2].forEach(x => { B(g, 1, 2.6, .08, x, 3.4, -6.97, glass); B(g, 1.2, .12, .12, x, 4.74, -6.95, trim); B(g, 1.2, .12, .12, x, 2.06, -6.95, trim); B(g, .1, 2.6, .12, x, 3.4, -6.95, trim); });
    const shaft = new T.Mesh(new T.CylinderGeometry(.09, .09, 15.4, 10), M('#55586f', .5)); shaft.rotation.z = Math.PI / 2; shaft.position.set(0, 1.25, -6.75); g.add(shaft);
    tw = { dev: {}, moon: 0, on: false, glass: glass, spin: [] };
    // 어두운 톱니(왼쪽): 덮개 아래 깊은 곳에 있어 캄캄하다. 빛을 비추면 맞물리는 곳이 보인다.
    const backA = new T.Mesh(new T.PlaneGeometry(3.2, 3), new T.MeshStandardMaterial({ color: '#0b0c14', roughness: 1 })); backA.position.set(-7, 1.6, -6.96); g.add(backA);
    B(g, 3.6, .3, 1.2, -7, 3.2, -6.5, M('#4a4566')); [-8.7, -5.3].forEach(x => B(g, .2, 3.2, 1.2, x, 1.6, -6.5, M('#4a4566')));
    const gA = gearMesh(g, .95, 12, .22, '#0f1017', -7.25, 1.3, -6.6), gA2 = gearMesh(g, .5, 8, .2, '#0f1017', -5.95, 1.95, -6.62);
    const lA = new T.PointLight('#ffd08a', 0, 7, 2); lA.position.set(-7, 1.8, -5.6); g.add(lA);
    tw.dev.dark = { k: 0, on: false, gears: [[gA, .9], [gA2, -1.7]], mats: [[gA.userData.mat, col('#0f1017'), col('#d9b45a')], [gA2.userData.mat, col('#0f1017'), col('#c9a04a')], [backA.material, col('#0b0c14'), col('#4b4670')]], light: [lA, 9] };
    // 녹슨 톱니(가운데): 먼지와 녹이 끼어 있다. 물로 씻으면 반짝인다.
    const gB = gearMesh(g, .95, 12, .22, '#8a4e2a', -.25, 1.3, -6.6), gB2 = gearMesh(g, .5, 8, .2, '#7a4526', 1.05, 1.95, -6.62);
    gB.userData.mat.roughness = gB2.userData.mat.roughness = 1; gB.userData.mat.metalness = gB2.userData.mat.metalness = 0;
    tw.dev.rust = { k: 0, on: false, gears: [[gB, .9], [gB2, -1.7]], mats: [[gB.userData.mat, col('#8a4e2a'), col('#d9b45a')], [gB2.userData.mat, col('#7a4526'), col('#c9a04a')]] };
    // 꺼진 전원(오른쪽): 등이 꺼진 전원 상자. 전기가 통하면 등이 켜지고 옆의 톱니가 돈다.
    B(g, 1.9, 2.3, .9, 7, 1.15, -6.5, M('#6d6f8c')); B(g, 1.5, .9, .06, 7, 1.55, -6.03, M('#3a3550')); B(g, .12, .6, .12, 7.55, .75, -6, M('#e9506a'));
    const lampM = new T.MeshStandardMaterial({ color: '#4a4a55', emissive: '#e6ff7a', emissiveIntensity: 0 }), lamp2 = new T.Mesh(new T.SphereGeometry(.3, 16, 12), lampM); lamp2.position.set(7, 2.6, -6.5); g.add(lamp2);
    const gC = gearMesh(g, .5, 8, .2, '#b9975a', 5.6, 1.25, -6.62);
    const lC = new T.PointLight('#e6ff7a', 0, 8, 2); lC.position.set(7, 2.7, -5.9); g.add(lC);
    tw.dev.power = { k: 0, on: false, gears: [[gC, 1.7]], mats: [[lampM, col('#4a4a55'), col('#fff3b0')]], light: [lC, 8], glow: lampM };
    // 시계판(가운데 위): 세 장치가 모두 돌면 바늘이 움직인다
    const face = new T.MeshStandardMaterial({ color: '#f4f0df', emissive: '#cfe0ff', emissiveIntensity: .05 });
    const dial = new T.Mesh(new T.CylinderGeometry(1.05, 1.05, .1, 40), face); dial.rotation.x = Math.PI / 2; dial.position.set(0, 3.75, -6.9); g.add(dial);
    const rim = new T.Mesh(new T.TorusGeometry(1.08, .09, 10, 40), trim); rim.position.set(0, 3.75, -6.86); g.add(rim);
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, t = B(g, .06, i % 3 ? .12 : .22, .04, Math.sin(a) * .88, 3.75 + Math.cos(a) * .88, -6.83, M('#3a3550')); t.rotation.z = -a; }
    const hand = (len, w) => { const p = new T.Group(); p.position.set(0, 3.75, -6.8); g.add(p); B(p, w, len, .04, 0, len / 2 - .08, 0, M('#3a3550')); return p; };
    tw.hands = [hand(.82, .07), hand(.55, .1)]; tw.hands[0].rotation.z = -.9; tw.hands[1].rotation.z = 1.2; tw.face = face;
    tw.spin.push([gearMesh(g, .6, 9, .2, '#c9a04a', -2.1, 3.3, -6.66), 1.3], [gearMesh(g, .42, 7, .2, '#d9b45a', -1.25, 3.95, -6.68), -1.9], [gearMesh(g, .6, 9, .2, '#c9a04a', 2.1, 3.3, -6.66), -1.3]);
    lib.sc.tower = {
      devices: true, ry: Math.PI / 2, start: [[-10.5, -2.6], [-11.6, -1.8], [-10.3, -3.7], [-12, -3.1], [-12.2, -.9], [-11, -.6]], enter: [-6.4, -2.8],
      look0: [-3.4, -2.6], look: lx => [lx * .5, -2.6],
      spots: { dark: { x: -7, z: -6.2, sx: -7.7, sz: -4.7 }, rust: { x: 0, z: -6.2, sx: -.7, sz: -4.7 }, power: { x: 7, z: -6.2, sx: 6.3, sz: -4.7 } },
      battle: { cx: -1, cz: -1.4, from: [6.2, -4.4], arena: [-8, 7, -4.8, 2.5], cam: [-12, 12, -6.2, 12] }, center: [0, -3.6]
    };
  }
  function fix(id, instant) { const d = tw.dev[id]; if (!d) return; d.on = true; if (instant) d.k = 1; }   // 장치 하나가 고쳐진다
  function towerOn() { tw.on = true; }   // 시계가 다시 돌고 달빛이 돌아온다
  function towerReset() { Object.keys(tw.dev).forEach(k => { tw.dev[k].on = false; tw.dev[k].k = 0; }); tw.on = false; tw.moon = 0; towerTick(0); }
  function towerTick(dt) {
    Object.keys(tw.dev).forEach(key => {
      const d = tw.dev[key]; if (d.on && d.k < 1) d.k = Math.min(1, d.k + dt / 1.2);
      d.mats.forEach(m => m[0].color.lerpColors(m[1], m[2], d.k)); if (d.light) d.light[0].intensity = d.light[1] * d.k; if (d.glow) d.glow.emissiveIntensity = 1.6 * d.k;
      if (d.on) d.gears.forEach(x => { x[0].rotation.z += x[1] * dt * d.k; });
    });
    if (tw.on && tw.moon < 1) tw.moon = Math.min(1, tw.moon + dt / 2.2);
    const k = tw.moon; tw.glass.emissiveIntensity = .12 + .9 * k; tw.face.emissiveIntensity = .05 + .75 * k;
    if (tw.on) { tw.hands[0].rotation.z -= dt * 1.6; tw.hands[1].rotation.z -= dt * .14; tw.spin.forEach(x => { x[0].rotation.z += x[1] * dt; }); }
    if (cur === 'tower') { sun.color.lerpColors(TW_WARM, TW_MOON, k); sun.intensity = .8 + 1.5 * k; hemi.intensity = 1 + .35 * k; }
  }
  const TW_WARM = new T.Color('#ffe2b0'), TW_MOON = new T.Color('#cfe0ff');

  // ── 현장 바꾸기, 불빛 ──
  // 현장마다 하늘색, 둘레 빛(위·아래·세기), 해(색·세기)
  const extra = {};   // world3d.js 같은 곳에서 등록한 현장: {그룹, 빛, 안개}
  function register(name, group, o) { scene.add(group); extra[name] = { g: group, light: o.light, fog: o.fog || [55, 130] }; supportSurfaces[name] = o.surfaces || []; lib.sc[name] = o.spec || {}; return lib.sc[name]; }
  const LIGHT = { street: ['#1a2350', '#aebfff', '#2b3566', 1.35, '#c9d6ff', 1.7], cabin: ['#1f2d5c', '#b4c6ff', '#2f4a45', 1.4, '#d2deff', 1.7], warehouse: ['#080c16', '#8ea4d8', '#1a2030', .3, null, 0], tower: ['#23263f', '#cdd0f7', '#3a3550', 1, '#ffe2b0', .8] };
  function setScene(name) {
    cur = lib.sc[name] ? name : 'street'; const ex = extra[cur], L = LIGHT[cur] || ex.light, dim = cur === 'warehouse' || cur === 'tower';
    Object.keys(extra).forEach(k => { extra[k].g.visible = k === cur; });
    city.visible = cur === 'street'; ware.visible = cur === 'warehouse'; cabin.visible = cur === 'cabin'; tower.visible = cur === 'tower';
    scene.background.set(L[0]); scene.fog.color.set(L[0]); scene.fog.near = ex ? ex.fog[0] : dim ? 28 : 55; scene.fog.far = ex ? ex.fog[1] : dim ? 80 : 130;
    hemi.color.set(L[1]); hemi.groundColor.set(L[2]); hemi.intensity = L[3];
    sun.visible = !!L[4]; if (L[4]) { sun.color.set(L[4]); sun.intensity = L[5]; }
    lampOn(null); chest.lid.rotation.x = 0; chest.glow.intensity = 0; doorG.rotation.y = 0; cloud.scale.setScalar(0.001); paintM.opacity = 0; towerReset();
    return lib.sc[cur];
  }
  function lampOn(actor, pow) { lampOf = actor || null; lampPow = pow || 1; lamp.visible = !!actor; if (!actor) lamp.intensity = 0; }

  // ── 인물 ──
  function soleVertices(holder, height) {
    holder.updateMatrixWorld(true);
    const line = new T.Box3().setFromObject(holder, true).min.y + height * .035;
    const soles = [];
    holder.traverse(mesh => {
      if (!mesh.isSkinnedMesh) return;
      const indices = [];
      const positions = mesh.geometry.getAttribute('position');
      for (let i = 0; i < positions.count; i++) {
        mesh.getVertexPosition(i, solePoint).applyMatrix4(mesh.matrixWorld);
        if (solePoint.y <= line) indices.push(i);
      }
      if (indices.length) soles.push({mesh, indices});
    });
    return soles;
  }
  // Preserve each imported foot orientation while coordinating the planted sole with actual travel.
  function initShoeStance(a) {
    if (!a.soles || !a.soles.length) return null;
    const T = window.THREE;
    a.root.updateMatrixWorld(true);
    const legs = ['L','R'].map(side => {
      const bone = part => a.root.getObjectByName('J_Bip_' + side + '_' + part);
      return { thigh: bone('UpperLeg'), shin: bone('LowerLeg'), foot: bone('Foot'), marker: new T.Vector3(), sole:[], count: 0 };
    });
    if (legs.some(l => !l.thigh || !l.shin || !l.foot)) return null;
    const p = new T.Vector3();
    for (const {mesh,indices} of a.soles) {
      const joints=mesh.geometry.attributes.skinIndex, weights=mesh.geometry.attributes.skinWeight;
      for (const i of indices) {
        let left=0,right=0;
        for (let k=0;k<4;k++) {
          const name=mesh.skeleton.bones[joints.getComponent(i,k)]?.name||'';
          if (/J_Bip_L_(Foot|Toe)/.test(name)) left+=weights.getComponent(i,k);
          if (/J_Bip_R_(Foot|Toe)/.test(name)) right+=weights.getComponent(i,k);
        }
        if (Math.max(left,right)<=.5) continue;
        const leg=legs[left>right?0:1];
        mesh.getVertexPosition(i,p).applyMatrix4(mesh.matrixWorld);
        leg.foot.worldToLocal(p);leg.sole.push(p.clone());leg.marker.add(p);leg.count++;
      }
    }
    if (legs.some(l=>!l.count)) return null;
    for (const l of legs) l.marker.divideScalar(l.count);
    return { legs, blend:0, saved:null };
  }

  function restoreShoeStance(a) {
    const s=a.shoeStance;
    if (!s || !s.saved) return;
    s.legs.forEach((leg,i)=>[leg.thigh,leg.shin,leg.foot].forEach((bone,j)=>bone.quaternion.copy(s.saved[i][j])));
    s.saved=null;
  }

  function solveShoeStance(a, dt) {
    const s=a.shoeStance;
    if (!s) return;
    const leaving=!a.syncGait || a.cur!=='walk' || a.lock>0 || a.hop>0 || a.float || a.sink;
    const dx=a.x-a.motionX,dz=a.z-a.motionZ,travel=Math.hypot(dx,dz);
    if (leaving || dt<=0 || travel<.00001 || travel>.4) {s.blend=0;s.lastX=null;s.corner=0;for(const l of s.legs){l.anchor=null;}return;}
    s.blend=Math.min(1,s.blend+dt*7.5);
    const T=window.THREE,V=()=>new T.Vector3(),Q=()=>new T.Quaternion(),position=b=>b.getWorldPosition(V());
    const travelDir=V().set(dx/travel,0,dz/travel);
    const headingDot=travelDir.x*Math.sin(a.ry)+travelDir.z*Math.cos(a.ry);
    const ease=s.blend*Math.max(0,Math.min(1,(headingDot-.2)/.65));
    const clip=a.clips.walk,phase=(clip.time/clip.getClip().duration)%1;
    a.root.updateMatrixWorld(true);
    const lowest=s.legs.map(l=>{
      const e=l.foot.matrixWorld.elements;let y=Infinity;
      for(const v of l.sole)y=Math.min(y,e[1]*v.x+e[5]*v.y+e[9]*v.z+e[13]);
      return y;
    });
    const supportY=Math.min(...lowest);
    s.saved=s.legs.map(l=>[l.thigh,l.shin,l.foot].map(b=>b.quaternion.clone()));
    const worldRotation=(b,q)=>{b.quaternion.copy(b.parent.getWorldQuaternion(Q()).invert().multiply(q));b.updateWorldMatrix(false,true);};
    const aim=(b,from,to)=>{if(from.lengthSq()<1e-12||to.lengthSq()<1e-12)return;worldRotation(b,Q().setFromUnitVectors(from.normalize(),to.normalize()).multiply(b.getWorldQuaternion(Q())));};
    const targets=s.legs.map((leg,side)=>{
      const phaseLeg=(phase+(side===0?.5:0)+.11)%1;
      const swing=Math.min(1,Math.max(0,(phaseLeg-.5)*2));
      const reach=(s.pace||1.38)*(.25-phaseLeg+swing*swing*(3-2*swing));
      const marker=leg.foot.localToWorld(leg.marker.clone());
      const current=(marker.x-a.x)*travelDir.x+(marker.z-a.z)*travelDir.z;
      const ankle=position(leg.foot),desired=ankle.clone().addScaledVector(travelDir,(reach-current)*ease);
      const roll=Math.pow(Math.max(0,Math.sin(Math.PI*swing)),1.3);
      desired.y+=(supportY-lowest[side]+.088*roll)*s.blend;
      if(phaseLeg<.51){
        const m=leg.foot.matrixWorld.elements, next=V(); let n=0;
        for(const p of leg.sole){if(m[1]*p.x+m[5]*p.y+m[9]*p.z+m[13]<lowest[side]+.010){next.add(p);n++;}}
        next.divideScalar(n||1);
        if(leg.anchor && leg.prevMatrix){
          const old=leg.pivot.clone().applyMatrix4(leg.prevMatrix);
          leg.anchor.add(next.clone().applyMatrix4(leg.prevMatrix).sub(old));
        }
        leg.pivot=next;
        if(!leg.anchor){
          leg.anchor=marker.clone().addScaledVector(travelDir,(reach-current)*ease);
          const offset=leg.foot.localToWorld(leg.pivot.clone()).sub(marker);leg.anchor.add(offset);
        }
        const remaining=phaseLeg<.44?1:Math.max(0,1-(phaseLeg-.44)/.07);
        const planted=ankle.clone();
        const pivot=leg.foot.localToWorld(leg.pivot.clone());
        planted.x+=leg.anchor.x-pivot.x;planted.z+=leg.anchor.z-pivot.z;
        planted.y=desired.y;
        desired.lerp(planted,remaining);
      }else leg.anchor=null;
      const hip=position(leg.thigh),knee=position(leg.shin),up=hip.distanceTo(knee),low=ankle.distanceTo(knee);
      const reachXZ=Math.hypot(desired.x-hip.x,desired.z-hip.z);
      const maxDrop=Math.sqrt(Math.max(0,(.985*(up+low))**2-reachXZ**2));
      return {leg,desired,hip,knee,ankle,up,low,lift:hip.y-maxDrop-desired.y};
    });
    const lift=Math.min(.12,Math.max(.085,...targets.map(t=>t.lift)))*s.blend;
    targets.forEach(({leg,desired,hip,knee,ankle,up,low})=>{
      desired.y+=lift;
      const axis=desired.clone().sub(hip),distance=Math.min(up+low-.0001,Math.max(Math.abs(up-low)+.0001,axis.length()));axis.normalize();
      const bend=knee.clone().sub(hip);bend.addScaledVector(axis,-bend.dot(axis));
      if (bend.lengthSq()<.000001) bend.copy(travelDir).addScaledVector(axis,-axis.dot(travelDir));
      bend.normalize();
      const along=(up*up+distance*distance-low*low)/(2*distance);
      const kneeTarget=hip.clone().addScaledVector(axis,along).addScaledVector(bend,Math.sqrt(Math.max(0,up*up-along*along)));
      const orientation=leg.foot.getWorldQuaternion(Q());
      aim(leg.thigh,knee.sub(hip),kneeTarget.sub(hip));
      aim(leg.shin,position(leg.foot).sub(position(leg.shin)),desired.sub(position(leg.shin)));
      worldRotation(leg.foot,orientation);
      leg.foot.updateWorldMatrix(true,false);
      (leg.prevMatrix ||= new T.Matrix4()).copy(leg.foot.matrixWorld);
    });
  }

  function plantFeet(a) {
    if (!a.soles.length || a.sink || a.float) return;
    groundRay.ray.origin.set(a.x, .4 + (a.gy || 0), a.z);
    const surface = groundRay.intersectObjects(supportSurfaces[cur] || [], true)[0];
    if (!surface) return;
    a.root.updateMatrixWorld(true);
    let lowest = Infinity;
    for (const {mesh, indices} of a.soles) {
      for (const i of indices) {
        mesh.getVertexPosition(i, solePoint).applyMatrix4(mesh.matrixWorld);
        lowest = Math.min(lowest, solePoint.y - a.root.position.y);
      }
    }
    // 발이 실제 지면 아래로 들어간 만큼만 들어 올린다. 달리기의 체공과 점프 높이는 유지한다.
    const plantedWalk = a.cur === 'walk' && !a.hop && a.lock <= 0;
    a.root.position.y += surface.point.y - (a.gy || 0) + (plantedWalk ? -lowest : Math.max(0, -lowest)) + .001;
  }

  function makeActor(key, height) {
    const g = lib[key], a = { key: key, x: 0, z: 0, ry: 0, wantRy: 0, speed: 4, anim: 'idle', t: Math.random() * 9, wk: 0, aim: 0, hop: 0, target: null };
    const holder = new T.Group(); a.root = holder; a.act = () => false;
    a.syncGait = (key === 'arthur' || key === 'eri')
      && new URLSearchParams(location.search).get('go') !== 'pose';
    if (g.userData.vrm) {
      a.vrm = g.userData.vrm; holder.add(a.vrm.scene);
      a.vrm.scene.traverse(m => { m.frustumCulled = false; if (m.isMesh) m.castShadow = true; });
      if (height) a.vrm.scene.scale.setScalar(height);
    } else {
      const inner = g.scene; holder.add(inner); inner.rotation.y = (window.GAME.models[key] || {}).front === '+z' ? 0 : Math.PI;   // 기존 모델들은 앞이 -z라 돌려 세운다. 앞이 +z인 모델은 data.js의 models에 front: '+z'를 적는다
      if (!g.userData.h0) { inner.scale.setScalar(1); inner.updateMatrixWorld(true); const box = new T.Box3().setFromObject(inner); g.userData.h0 = box.max.y - box.min.y; }
      inner.scale.setScalar((height || g.userData.h0) / g.userData.h0);
      inner.traverse(m => { if (m.isMesh) { m.castShadow = true; m.frustumCulled = false; } });
      a.mixer = new T.AnimationMixer(inner); a.clips = {};
      g.animations.forEach(c => { a.clips[c.name] = a.mixer.clipAction(c); });
      if (a.clips.idle) a.clips.idle.play(); a.cur = 'idle';
      if (window.GAME.models[key].grounded) a.soles = soleVertices(holder, height || g.userData.h0);
      if (a.syncGait && a.soles) a.shoeStance = initShoeStance(a);
    }
    a.place = (x, z, ry) => { a.x = x; a.z = z; if (ry != null) a.ry = a.wantRy = ry; a.target = null; a.motionX = x; a.motionZ = z; };
    // 동작을 바꾼다. once가 참이면 한 번만 재생하고 멈춘다.
    const swap = (n, once, fade = .18, seconds) => {
      const c = a.clips[n] || a.clips.idle; if (!c) return;
      if (a.cur === n && !once) return;
      const p = a.clips[a.cur]; c.reset(); c.setLoop(once ? T.LoopOnce : T.LoopRepeat, once ? 1 : Infinity); c.clampWhenFinished = !!once;
      c.setEffectiveTimeScale(seconds ? c.getClip().duration / seconds : 1).play();
      if (p && p !== c) c.crossFadeFrom(p, fade, false); a.cur = n;
    };
    a.lock = 0;
    a.play = n => { a.anim = n; if (!a.mixer || a.lock > 0) return; swap(n); };   // 한 번짜리 동작 중이면 끝난 뒤 a.anim으로 돌아간다
    a.act = (n, seconds, fade) => {   // 지정 시간이 있으면 접촉 시간에 맞춰 한 번 재생한다.
      const c = a.clips && a.clips[n]; if (!c) return false;
      swap(n, true, fade, seconds); a.lock = seconds || Math.min(2, Math.max(.3, c.getClip().duration)); return true;
    };
    a.endAct = () => { a.lock = 0; swap(a.anim); };
    a.face = (x, z) => { a.wantRy = Math.atan2(x - a.x, z - a.z); };
    a.goto = (x, z, speed) => new Promise(res => { a.target = { x: x, z: z, res: res }; if (speed) a.speed = speed; a.play('walk'); });
    scene.add(holder); actors.push(a); return a;
  }
  function removeActor(a) { const i = actors.indexOf(a); if (i >= 0) actors.splice(i, 1); scene.remove(a.root); if (a.target && a.target.res) a.target.res(); }

  const FXLOW = () => !!(window.FX && window.FX.low), WHITE = new T.Color('#ffffff');
  // 맞은 몸을 잠깐 하얗게 번쩍인다. 모델끼리 재질을 같이 쓰고 있어서, 처음 번쩍일 때 이 인물만의 재질로 복제해 둔다.
  function hitFlash(a, k) {
    if (!a._fm) {
      a._fm = [];
      a.root.traverse(o => {
        if (!o.isMesh || !o.material) return; const arr = Array.isArray(o.material) ? o.material : [o.material];
        const cl = arr.map(m => { if (!m || !m.emissive) return m; const c = m.clone(); a._fm.push([c, c.emissive.clone(), c.emissiveIntensity == null ? 1 : c.emissiveIntensity]); return c; });
        o.material = Array.isArray(o.material) ? cl : cl[0];
      });
    }
    a._fm.forEach(f => { f[0].emissive.copy(f[1]).lerp(WHITE, k * .5); f[0].emissiveIntensity = f[2] + k * .45; });
  }
  function poseVRM(a, dt) {
    const h = a.vrm.humanoid, b = n => h.getNormalizedBoneNode(n);
    a.wk += ((a.anim === 'walk' ? 1 : 0) - a.wk) * Math.min(1, dt * 9);
    a.aim += ((a.anim === 'use' ? 1 : 0) - a.aim) * Math.min(1, dt * 10);
    const s = Math.sin(a.t * 9.5) * a.wk, c = Math.cos(a.t * 9.5) * a.wk, br = Math.sin(a.t * 2.1);
    const set = (n, x, y, z) => { const o = b(n); if (o) o.rotation.set(x, y, z); };
    set('leftUpperArm', -s * .55, 0, -1.2 + br * .015);
    set('rightUpperArm', s * .55 * (1 - a.aim) - 1.35 * a.aim, -.25 * a.aim, 1.2 - br * .015 - .15 * a.aim);
    set('leftLowerArm', 0, -.25 - a.wk * .35, 0); set('rightLowerArm', 0, (.25 + a.wk * .35) * (1 - a.aim), 0);
    set('leftUpperLeg', -s * .62, 0, 0); set('rightUpperLeg', s * .62, 0, 0);
    set('leftLowerLeg', Math.max(0, -c) * .9, 0, 0); set('rightLowerLeg', Math.max(0, c) * .9, 0, 0);
    set('spine', .03 * a.wk + br * .012, 0, 0); set('head', -.02 * a.wk, 0, 0);
    a.vrm.update(dt);
  }

  // ── 효과: 표시 고리, 훈련탄, 반짝임 ──
  function ring(x, z, color, y0) {
    const g = new T.Group();
    const r = new T.Mesh(new T.RingGeometry(.62, .8, 40), new T.MeshBasicMaterial({ color: color, transparent: true, opacity: .95, side: T.DoubleSide, depthWrite: false })); r.rotation.x = -Math.PI / 2; r.position.y = .07;
    const beam = new T.Mesh(new T.CylinderGeometry(.5, .68, 2.6, 28, 1, true), new T.MeshBasicMaterial({ color: color, transparent: true, opacity: .2, side: T.DoubleSide, depthWrite: false })); beam.position.y = 1.3;
    g.add(r, beam); g.position.set(x, y0 || 0, z); fxw.add(g);
    const f = { t: 0, tick: dt => { f.t += dt; const k = 1 + Math.sin(f.t * 4) * .1; r.scale.set(k, k, 1); beam.material.opacity = .16 + Math.sin(f.t * 4) * .06; return true; }, show: v => { g.visible = v; }, remove: () => { fxw.remove(g); const i = fx.indexOf(f); if (i >= 0) fx.splice(i, 1); } };
    fx.push(f); return f;
  }
  function sparkle(x, z, y0) {   // 숨은 반짝 조각. 빛이 닿기 전에는 보이지 않는다.
    const g = new T.Group(); g.position.set(x, y0 || 0, z); g.visible = false; fxw.add(g);
    const gem = new T.Mesh(new T.OctahedronGeometry(.17), new T.MeshBasicMaterial({ color: '#eaffa0' })); gem.scale.y = 1.35; g.add(gem);
    const halo = new T.Mesh(new T.RingGeometry(.3, .4, 28), new T.MeshBasicMaterial({ color: '#dfff1a', transparent: true, opacity: .8, side: T.DoubleSide, depthWrite: false })); halo.rotation.x = -Math.PI / 2; halo.position.y = .04; g.add(halo);
    const f = { t: 0, tick: dt => { f.t += dt; gem.rotation.y = f.t * 3; gem.position.y = .3 + Math.sin(f.t * 4) * .06; const k = 1 + Math.sin(f.t * 5) * .2; halo.scale.set(k, k, 1); halo.material.opacity = .75 - Math.sin(f.t * 5) * .25; return true; }, show: v => { g.visible = v; }, remove: () => { fxw.remove(g); const i = fx.indexOf(f); if (i >= 0) fx.splice(i, 1); } };
    fx.push(f); return f;
  }
  // 날아가는 것. o.shape: orb(공, 기본) | beam(길쭉한 빛줄기) | card(수첩 쪽지) | drop(물방울) | spark(번쩍이는 조각)
  const SHAPES = {
    beam: s => new T.BoxGeometry(s * .5, s * .5, s * 3.4),
    card: s => new T.BoxGeometry(s * 1.7, s * .12, s * 1.3),
    drop: s => { const g = new T.SphereGeometry(s, 12, 10); g.scale(.75, 1.35, .75); return g; },
    spark: s => new T.OctahedronGeometry(s * 1.1)
  };
  function shot(from, to, o) {   // from, to: {x,y,z}  o: {color, size, time, arc, shape, trail, onHit}
    const size = o.size || .16, geo = SHAPES[o.shape] ? SHAPES[o.shape](size) : new T.SphereGeometry(size, 14, 10);
    const m = new T.Mesh(geo, new T.MeshBasicMaterial({ color: o.color || '#7fd0ff', transparent: true, depthWrite: false }));
    fxg.add(m); const dur = o.time || .35; let t = 0;
    fx.push({ tick: dt => { t += dt; const k = Math.min(1, t / dur);
      m.position.set(from.x + (to.x - from.x) * k, from.y + (to.y - from.y) * k + Math.sin(k * Math.PI) * (o.arc || 0), from.z + (to.z - from.z) * k);
      if (o.shape === 'beam') m.lookAt(to.x, to.y, to.z); else if (o.shape === 'card' || o.shape === 'spark') { m.rotation.y += dt * 14; m.rotation.x += dt * 7; }
      if (o.trail && dt > 0) puff(m.position, o.color || '#7fd0ff', size * .8);
      if (k >= 1) { fxg.remove(m); geo.dispose(); if (o.onHit) o.onHit(); return false; } return true; } });
  }
  // 붉은 예고 범위(C안). sh: {t:'c', x, z, r} 원 | {t:'l', x, z, dx, dz, len, w} 길쭉한 띠(dx, dz는 방향) | {t:'d', x, z, r0, r1} 고리(r0 안쪽은 안전)
  // 돌려주는 것: set(k) 0~1로 차오르는 정도, remove()
  function tele(sh) {
    const g = new T.Group(); g.position.set(sh.x, 0, sh.z); fxg.add(g);
    const mk = (geo, color, op, y) => { const m = new T.Mesh(geo, new T.MeshBasicMaterial({ color: color, transparent: true, opacity: op, side: T.DoubleSide, depthWrite: false })); m.position.y = y; m.renderOrder = 900 + Math.round(y * 10); return m; };   // 붉은 범위는 효과보다 나중에 그려 효과에 가려지지 않는다
    let edge, base, grow, flat = true;
    if (sh.t === 'c') {
      edge = mk(new T.CircleGeometry(sh.r + .1, 48), '#ff6a5a', .95, .3); base = mk(new T.CircleGeometry(sh.r, 48), '#5a0f1c', .5, .31); grow = mk(new T.CircleGeometry(sh.r, 48), '#ff2a3a', .62, .32);
    } else if (sh.t === 'l') {
      const mkp = (w, l, e) => { const geo = new T.PlaneGeometry(w, l); geo.translate(0, l / 2 - (e || 0), 0); return geo; };
      edge = mk(mkp(sh.w + .2, sh.len + .2, .1), '#ff6a5a', .95, .3); base = mk(mkp(sh.w, sh.len), '#5a0f1c', .5, .31); grow = mk(mkp(sh.w, sh.len), '#ff2a3a', .62, .32); g.rotation.y = Math.atan2(sh.dx, sh.dz); flat = 'l';
    } else {
      edge = mk(new T.RingGeometry(Math.max(0, sh.r0 - .1), sh.r1 + .1, 56), '#ff6a5a', .95, .3); base = mk(new T.RingGeometry(sh.r0, sh.r1, 56), '#5a0f1c', .5, .31); grow = mk(new T.RingGeometry(sh.r0, sh.r1, 56), '#ff2a3a', .62, .32);
      const safe = mk(new T.RingGeometry(sh.r0 - .22, sh.r0 - .08, 40), '#9fe3ff', .9, .33); safe.rotation.x = -Math.PI / 2; g.add(safe);   // 안쪽 안전한 자리의 테두리
    }
    [edge, base, grow].forEach(m => { m.rotation.x = flat === 'l' ? Math.PI / 2 : -Math.PI / 2; g.add(m); });   // 띠는 앞쪽(+z)으로 뻗고, 원과 고리는 바닥에 눕는다
    const f = { set: k => { k = Math.max(0, Math.min(1, k)); if (sh.t === 'c') grow.scale.setScalar(Math.max(.001, k)); else if (sh.t === 'l') grow.scale.set(1, Math.max(.001, k), 1); else grow.material.opacity = .2 + .55 * k; if (k > .75) edge.material.opacity = .6 + .4 * Math.abs(Math.sin(k * 40)); },
      remove: () => { fxg.remove(g); g.traverse(m => { if (m.isMesh) { m.geometry.dispose(); m.material.dispose(); } }); } };
    f.set(0); return f;
  }
  // 날아가는 것 뒤에 남는 꼬리 한 점
  const puffG = new T.SphereGeometry(1, 8, 6);
  function puff(p, color, r) {
    const m = new T.Mesh(puffG, new T.MeshBasicMaterial({ color: color, transparent: true, opacity: .55, depthWrite: false })); m.position.copy(p); m.scale.setScalar(r); fxg.add(m);
    let t = 0; fx.push({ tick: dt => { t += dt; const k = t / .18; m.scale.setScalar(r * Math.max(.05, 1 - k * .7)); m.material.opacity = .55 * (1 - k); if (k >= 1) { fxg.remove(m); m.material.dispose(); return false; } return true; } });
  }
  const shardG = new T.BoxGeometry(.03, .03, .22);
  function burst(x, y, z, color, n, size) {
    const mat = new T.MeshBasicMaterial({ color: color, transparent: true, depthWrite: false }), parts = [];
    for (let i = 0; i < (n || 8); i++) { const p = new T.Mesh(shardG, mat); p.scale.setScalar((size || .09) * 9); p.position.set(x, y, z); const an = Math.random() * 6.28, up = Math.random() * 3 + 1.5, sp = Math.random() * 2.5 + 1.2; p.userData.v = [Math.cos(an) * sp, up, Math.sin(an) * sp]; p.lookAt(x + p.userData.v[0], y + up, z + p.userData.v[2]); fxg.add(p); parts.push(p); }
    let t = 0; fx.push({ tick: dt => { t += dt; parts.forEach(p => { const v = p.userData.v; v[1] -= 9 * dt; p.position.x += v[0] * dt; p.position.y += v[1] * dt; p.position.z += v[2] * dt; }); mat.opacity = Math.max(0, 1 - t / .6); if (t > .6) { parts.forEach(p => fxg.remove(p)); return false; } return true; } });
  }

  // ── 매 프레임 ──
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.max(0, Math.min(.05, (now - last) / 1000 || 0)); last = now;
    sim(dt); renderer.render(scene, camera);
  }
  function warp(sec, quiet) { for (let t = 0; t < sec; t += 1 / 30) sim(1 / 30); if (!quiet) renderer.render(scene, camera); }   // 화면 확인용: 시간을 한꺼번에 흘려보낸다
  function sim(dt) {
    actors.forEach(a => { a.motionX = a.x; a.motionZ = a.z; });
    const scale = onTick ? onTick(dt) : 1; if (scale != null) dt *= scale;
    actors.forEach(a => {
      a.t += dt;
      if (a.target) {
        const dx = a.target.x - a.x, dz = a.target.z - a.z, d = Math.hypot(dx, dz), st = a.speed * dt;
        if (a.groundPath && dt > 0 && d > 0) {
          const stride = Math.min(d, st);
          const oldX = a.x, oldZ = a.z;
          [a.x, a.z] = a.groundPath(a.x, a.z, dx / d * stride, dz / d * stride);
          const mx = a.x - oldX, mz = a.z - oldZ;
          if (Math.hypot(mx, mz) > .001) a.wantRy = Math.atan2(mx, mz);
          if (Math.hypot(mx, mz) <= .001 || Math.hypot(a.target.x - a.x, a.target.z - a.z) < .02) {
            const done = a.target.res; a.target = null; a.play('idle'); if (done) done();
          }
        } else if (d <= st || d < .02) { a.x = a.target.x; a.z = a.target.z; const r = a.target.res; a.target = null; a.play('idle'); if (r) r(); }
        else { a.x += dx / d * st; a.z += dz / d * st; a.wantRy = Math.atan2(dx, dz); }
      }
      let dr = a.wantRy - a.ry; while (dr > Math.PI) dr -= 6.2832; while (dr < -Math.PI) dr += 6.2832; a.ry += dr * Math.min(1, dt * 12);
      if (a.hop > 0) a.hop = Math.max(0, a.hop - dt * 2.4);
      a.pk = Math.max(0, (a.pk || 0) - dt * 7); a.root.scale.setScalar(1 + .25 * a.pk);   // pk: 맞았을 때 움찔하는 정도
      if (a.fk > 0 || a.fkOn) { a.fk = Math.max(0, (a.fk || 0) - dt * 5.5); hitFlash(a, a.fk); a.fkOn = a.fk > 0; }   // fk: 맞은 몸이 하얗게 번쩍이는 정도(처음 번쩍일 때 재질을 이 인물 것으로 복제한다)
      a.sy = (a.sy || 0) + ((a.sink || 0) - (a.sy || 0)) * Math.min(1, dt * 7);   // sink: 물속에 잠긴 깊이
      a.root.position.set(a.x + (a.fk > .15 ? Math.sin(a.t * 95) * .09 * a.fk : 0), (a.gy || 0) + (a.float || 0) + Math.sin(a.hop * Math.PI) * (a.hopH || 0) + (a.float ? Math.sin(a.t * 2.4) * .12 : 0) - a.sy, a.z); a.root.rotation.y = a.ry;
      if (a.lock > 0) { a.lock -= dt; if (a.lock <= 0) a.endAct(); }
      if (a.mixer) {
        const gait = a.syncGait && a.lock <= 0 && (a.cur === 'walk' || a.cur === 'run') ? a.clips[a.cur] : null;
        if (gait && dt > 0) {
          const moved = Math.hypot(a.x - a.motionX, a.z - a.motionZ);
          let pace = a.cur === 'run' ? 3.56 : 1.38;
          if (a.cur === 'walk' && a.shoeStance && moved>.00001) {
            const step=a.shoeStance, x=(a.x-a.motionX)/moved, z=(a.z-a.motionZ)/moved;
            if (step.lastX!=null && x*step.lastX+z*step.lastZ<.8) step.corner=.48;
            step.lastX=x; step.lastZ=z;
            const corner=Math.min(1,(step.corner||0)/.16);
            pace-=.50*corner;
            step.pace=pace; step.corner=Math.max(0,(step.corner||0)-moved);
          }
          // 접지 구간의 원래 발 이동 속도를 기준으로 실제 전진 거리에 동작을 맞춘다.
          gait.setEffectiveTimeScale(a.cur === 'walk' ? moved * gait.getClip().duration / (dt * pace) : Math.min(2.3, moved / (dt * pace)));
        }
        restoreShoeStance(a);
        a.mixer.update(dt);
        solveShoeStance(a,dt);
      } else if (a.vrm) poseVRM(a, dt);
      if (a.soles) plantFeet(a);
    });
    for (let i = fx.length - 1; i >= 0; i--) if (fx[i].tick(dt) === false) fx.splice(i, 1);
    if (cur === 'tower') towerTick(dt);
    focus.lerp(want, 1 - Math.exp(-dt * frate));
    shk *= Math.exp(-dt * 8); const jx = dt > 0 ? (Math.random() - .5) * shk : 0, jy = dt > 0 ? (Math.random() - .5) * shk : 0;   // 화면 흔들림
    zk += (zt - zk) * (1 - Math.exp(-dt * 2.2));
    if (CAM.chase) {   // 등 뒤에서 따라가는 카메라: 방향 (sin hy, cos hy)의 반대쪽으로 물러나 앞을 본다
      const sx = Math.sin(hy), cz = Math.cos(hy); let px = focus.x - sx * CAM.back * zk - cz * CAM.side, pz = focus.z - cz * CAM.back * zk + sx * CAM.side;
      if (cbox) { px = Math.max(cbox[0], Math.min(cbox[1], px)); pz = Math.max(cbox[2], Math.min(cbox[3], pz)); }
      let lift = 0;
      if (solids) {   // 건물과 컨테이너에 가려지지 않게: 가까이 당기고, 그래도 막히면 위로 올라가 내려다본다(몸 앞에 벽이 붙은 자리에서도 탐정이 보이게)
        const LIFT = 6.5, hh = CAM.up * zk, fy = focus.y, tp = r => r[4] == null ? 99 : r[4];
        const blocked = (x, z, y, m) => solids.some(r => x > r[0] - m && x < r[1] + m &&
          z > r[2] - m && z < r[3] + m && y < tp(r) && fy < tp(r) && (r[5] == null || y > r[5] - m));
        const okAt = k => {
          const tx = focus.x + (px - focus.x) * k, tz = focus.z + (pz - focus.z) * k, ty = fy + hh + (1 - k) * LIFT;
          if (blocked(tx, tz, ty, .5)) return false;
          for (let t = .03; t < .97; t += .025) if (blocked(tx + (focus.x - tx) * t, tz + (focus.z - tz) * t, ty + (fy + 1.1 - ty) * t, .14)) return false;
          return true;
        };
        let kt = 0;
        for (let step = 17; step >= 0; step--) {
          const k = step / 17;
          if (okAt(k)) { kt = k; break; }
        }
        if (ckSnap || kt < ck) { ck = kt; ckSnap = false; }
        else ck += (kt - ck) * (1 - Math.exp(-dt * 3));
        px = focus.x + (px - focus.x) * ck; pz = focus.z + (pz - focus.z) * ck; lift = (1 - ck) * LIFT;
      }
      camera.position.set(px + jx, focus.y + CAM.up * zk + lift + jy, pz); camera.lookAt(focus.x + sx * .2 + jx, focus.y + (CAM.aim == null ? .9 : CAM.aim) + jy, focus.z + cz * .2);
    } else { camera.position.set(focus.x + CAM.side * zk + jx, CAM.up * zk + jy, focus.z + CAM.back * zk); camera.lookAt(focus.x + .6 + jx, 1 + jy, focus.z - 1.2); }
    sun.position.set(focus.x - 20, focus.y + 34, focus.z + 16); sun.target.position.set(focus.x, focus.y, focus.z);
    if (lampOf) { lamp.position.set(lampOf.x, 2.2, lampOf.z + .1); lamp.intensity += (LAMP * lampPow - lamp.intensity) * Math.min(1, dt * 5); }
    fk *= Math.exp(-dt * 14); const fv = CAM.fov + fk; if (Math.abs(camera.fov - fv) > .01) { camera.fov = fv; camera.updateProjectionMatrix(); }
    camera.updateMatrixWorld();
  }
  // 효과 줄이기에서는 그림자를 끈다(느린 컴퓨터에서 화면 그리는 양을 크게 줄인다)
  function shadows(on) {
    if (!renderer || renderer.shadowMap.enabled === !!on) return;
    renderer.shadowMap.enabled = !!on; sun.castShadow = !!on;
    scene.traverse(o => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { m.needsUpdate = true; }); });
  }
  function start(tick) { onTick = tick || null; if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } }
  function stop() { cancelAnimationFrame(raf); raf = 0; onTick = null; }
  function look(x, z, snap, y) { want.set(x, y == null ? by : y, z); if (snap) { focus.copy(want); ckSnap = true; } }   // y를 안 주면 baseY(발 딛는 높이)를 쓴다
  function clear() { actors.slice().forEach(removeActor); fx.length = 0; if (fxg) fxg.clear(); if (fxw) fxw.clear(); if (lamp) lampOn(null); }
  const v = new T.Vector3();
  function project(x, y, z) { v.set(x, y + by, z).project(camera); return { x: (v.x + 1) * 960, y: (1 - v.y) * 540 }; }
  // 화면에서 누른 곳이 바닥의 어디인지(걸어갈 자리)
  const ray = new T.Raycaster(), ndc = new T.Vector2(), ground = new T.Plane(new T.Vector3(0, 1, 0), 0), hitP = new T.Vector3();
  function pick(cx, cy) {
    const r = renderer.domElement.getBoundingClientRect(); ndc.set((cx - r.left) / r.width * 2 - 1, 1 - (cy - r.top) / r.height * 2);
    ray.setFromCamera(ndc, camera); return ray.ray.intersectPlane(ground, hitP) ? { x: hitP.x, z: hitP.z } : null;
  }

  const kit = { T: T, K: K, get scene() { return scene; }, lib: lib, M: M, B: B, canvasTex: canvasTex, signTex: signTex, bright: bright, tint: tint };
  return { shadows: shadows, perf: () => { const i = renderer.info; return { calls: i.render.calls, tris: i.render.triangles, geos: i.memory.geometries, tex: i.memory.textures, shadow: renderer.shadowMap.enabled, dpr: renderer.getPixelRatio(), size: renderer.getSize(new T.Vector2()).toArray() }; }, camPos: () => ({ p: camera.position.toArray().map(n => Math.round(n * 100) / 100), ck: ck, f: [focus.x, focus.y, focus.z].map(n => Math.round(n * 100) / 100) }), baseY: y => { by = y || 0; if (fxg) fxg.position.y = by; }, kit: kit, register: register, camSolids: r => { solids = r; ck = 1; }, focusRate: r => { frate = r || 3.2; }, tele: tele, heading: h => { hy = h; }, camBox: b => { cbox = b; }, ok: ok, init: init, load: load, warp: warp, start: start, stop: stop, look: look, clear: clear, project: project, pick: pick, makeActor: makeActor, removeActor: removeActor, ring: ring, sparkle: sparkle, shot: shot, burst: burst, setScene: setScene, lampOn: lampOn, lampPower: p => { lampPow = p; }, openChest: openChest, paint: paint, revealPaint: revealPaint, openDoor: openDoor, ripple: ripple, bolt: bolt, fix: fix, towerOn: towerOn, camMode: camMode, fovKick: v => { fk = Math.max(fk, v); }, zoom: (k, snap) => { zt = k; if (snap) zk = k; }, punch: (a, flash) => { a.pk = 1; if (flash && !FXLOW()) a.fk = 1; }, shake: p => { shk = Math.max(shk, p); }, cam: CAM };
})();
