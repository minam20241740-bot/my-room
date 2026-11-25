'use strict';
/* 별빛도시: 걸어 다니는 밤의 도시(3D). 천문 광장이 한가운데이고, 길이 동서남북으로 뻗는다.
   북(-z)은 시계탑 거리, 동(+x)은 별빛 역, 서(-x)는 별무리 시장, 남(+z)은 큰길(처음 서는 자리).
   건물은 Kenney City Kit(CC0)이고, 광장 바닥·천문 기념물·안내 시계·간판·가로등·하늘은 여기서 직접 만든다.
   걷는 곳(walk)과 막힌 곳(blocks)은 world.js가 읽어서 움직임을 막는다. 단위는 m. */
(function () {
  const S = window.Stage3D, PI = Math.PI, TAU = PI * 2;
  const R_PLAZA = 17, R_RING = 21.5, ROAD_END = 122, ROAD_HALF = 4.4;   // 광장 반지름, 건물 줄 반지름, 길 끝, 길 폭의 절반
  const DIRS = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };
  let data = null;   // build가 돌려준 현장 자료(tick에서 쓴다)

  S.addScene('star', {
    light: ['#040b26', '#6a86d0', '#0f1840', 1.05, '#9db6ff', 1.25], fog: [70, 210], dim: false,
    build: function (c) {
      const T = c.T, g = c.group, K = c.K, RS = c.RS;
      const rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
      const M = (color, o) => new T.MeshStandardMaterial(Object.assign({ color: color, roughness: .85 }, o || {}));
      const E = (color, k) => new T.MeshStandardMaterial({ color: '#10142e', emissive: color, emissiveIntensity: k == null ? 1 : k, roughness: .6 });   // 스스로 빛나는 재질
      const add = (m, x, y, z, parent) => { m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; (parent || g).add(m); return m; };
      const lights = [], blocks = [], npcs = [], things = {}, doors = {};
      const block = (x, z, r, tall) => blocks.push({ x: x, z: z, r: r, tall: !!tall });   // tall: 카메라를 가리는 높은 건물
      let glowTex = null;
      const glow = (x, y, z, color, size) => {   // 가로등·간판 둘레의 번짐(항상 카메라를 보는 둥근 빛)
        if (!glowTex) { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const q = cv.getContext('2d'), gr = q.createRadialGradient(32, 32, 0, 32, 32, 32);
          gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.35, 'rgba(255,255,255,.4)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); q.fillStyle = gr; q.fillRect(0, 0, 64, 64); glowTex = new T.CanvasTexture(cv); }
        const sp = new T.Sprite(new T.SpriteMaterial({ map: glowTex, color: color, transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: .85 }));
        sp.scale.setScalar(size); sp.position.set(x, y, z); g.add(sp); return sp;
      };
      const plight = (color, k, x, y, z) => { const l = new T.PointLight(color, k, 0, 2); l.position.set(x, y, z); g.add(l); lights.push(l); return l; };

      // ── 표지 분위기 도구: 경사 지붕 집(창에 불이 켜진), 둥근 나무, 금빛 레일 길 ──
      const winPool = [0, 1, 2, 3].map(seed => {
        const mk = lit => { const cv = document.createElement('canvas'); cv.width = cv.height = 256; const q = cv.getContext('2d'); let s = 11 + seed * 7; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
          q.fillStyle = lit ? '#000000' : ['#16255c', '#142156', '#18285f', '#13204f'][seed]; q.fillRect(0, 0, 256, 256);
          for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { const on = r() < .3; q.fillStyle = lit ? (on ? '#ffd98a' : '#000000') : (on ? '#f2c874' : '#0b1538'); q.fillRect(i * 64 + 18, j * 64 + 14, 28, 36); if (!lit) { q.fillStyle = 'rgba(232,207,147,.25)'; q.fillRect(i * 64 + 18, j * 64 + 50, 28, 3); } }
          const t = new T.CanvasTexture(cv); t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 4; return t; };
        return { map: mk(false), emi: mk(true) };
      });
      const townhouse = (x, z, ry, w, d, h, n) => {
        const hs = new T.Group(); hs.position.set(x, 0, z); hs.rotation.y = ry; g.add(hs); const P = winPool[n % 4];
        const tm = P.map.clone(), te = P.emi.clone(); [tm, te].forEach(t => { t.needsUpdate = true; t.repeat.set(Math.max(1, w / 4.2), Math.max(1, h / 4.2)); });
        add(new T.Mesh(new T.BoxGeometry(w, h, d), new T.MeshStandardMaterial({ map: tm, emissiveMap: te, emissive: '#ffffff', emissiveIntensity: .95, roughness: .9 })), 0, h / 2, 0, hs);
        const rh = w * .42, sh = new T.Shape(); sh.moveTo(-w / 2 - .3, 0); sh.lineTo(w / 2 + .3, 0); sh.lineTo(0, rh); sh.closePath();
        const rg = new T.ExtrudeGeometry(sh, { depth: d + .6, bevelEnabled: false }); rg.translate(0, 0, -(d + .6) / 2);
        add(new T.Mesh(rg, M('#0a1438')), 0, h, 0, hs); add(new T.Mesh(new T.BoxGeometry(.9, rh * .9, .9), M('#0a1438')), w * .26, h + rh * .55, -d * .15, hs);
        add(new T.Mesh(new T.BoxGeometry(w + .2, .25, d + .2), E('#c9a45a', .35)), 0, h + .02, 0, hs);   // 처마를 따라 가는 금빛 선
        return hs;
      };
      const tree = (x, z, s) => { s = s || 1; add(new T.Mesh(new T.CylinderGeometry(.1 * s, .14 * s, 2.2 * s, 6), M('#0b1840')), x, 1.1 * s, z); [[0, 3, 0, 1.5], [-.7, 2.5, .3, 1.1], [.8, 2.6, -.2, 1.2]].forEach(b => add(new T.Mesh(new T.SphereGeometry(b[3] * s, 12, 10), M('#10265a')), x + b[0] * s, b[1] * s, z + b[2] * s)); block(x, z, .5); };
      const railRoad = k => {
        const d = DIRS[k], len = ROAD_END - R_PLAZA + .5, mid = R_PLAZA - .5 + len / 2, rg = new T.Group(); rg.position.set(d[0] * mid, 0, d[1] * mid); rg.rotation.y = d[0] ? 0 : PI / 2; g.add(rg);
        const bed = add(new T.Mesh(new T.PlaneGeometry(len, ROAD_HALF * 2), M('#0f1b46', { roughness: 1 })), 0, .015, 0, rg); bed.rotation.x = -PI / 2; c.support.push(bed);
        [-1.1, 1.1].forEach(o => add(new T.Mesh(new T.BoxGeometry(len, .1, .18), E('#e8cf93', .75)), 0, .08, o, rg));
        [-ROAD_HALF + .15, ROAD_HALF - .15].forEach(o => add(new T.Mesh(new T.BoxGeometry(len, .03, .1), E('#e8cf93', .35)), 0, .04, o, rg));
        const n = Math.floor(len / .95), im = new T.InstancedMesh(new T.BoxGeometry(.3, .06, 3.0), M('#7d6f4a'), n), m4 = new T.Matrix4();
        for (let i = 0; i < n; i++) { m4.setPosition(-len / 2 + .5 + i * .95, .05, 0); im.setMatrixAt(i, m4); } rg.add(im);
      };

      // ── 땅 ──
      const gt = c.canvasTex(256, 256, q => {
        q.fillStyle = '#0b1538'; q.fillRect(0, 0, 256, 256); q.strokeStyle = '#142156'; q.lineWidth = 3; q.strokeRect(0, 0, 256, 256);
        for (let i = 0; i < 26; i++) { q.fillStyle = 'rgba(232,207,147,' + (.1 + rnd() * .25).toFixed(2) + ')'; q.fillRect(rnd() * 250, rnd() * 250, 3, 3); }
      }, 120, 120);
      const ground = add(new T.Mesh(new T.PlaneGeometry(600, 600), M('#ffffff', { map: gt, roughness: 1 })), 0, -.03, 0); ground.rotation.x = -PI / 2; c.support.push(ground);

      // ── 광장 바닥: 별자리와 별 모양 상감 ──
      const pt = c.canvasTex(1024, 1024, q => {
        const C0 = 512, u = 512 / R_PLAZA;
        const gr = q.createRadialGradient(C0, C0, 40, C0, C0, 512); gr.addColorStop(0, '#16275f'); gr.addColorStop(1, '#0c1741'); q.fillStyle = gr; q.fillRect(0, 0, 1024, 1024);
        q.strokeStyle = 'rgba(232,207,147,.7)'; q.lineWidth = 4;
        [.97, .9, .56].forEach(k => { q.beginPath(); q.arc(C0, C0, k * 512, 0, TAU); q.stroke(); });
        for (let i = 0; i < 48; i++) { const a = i / 48 * TAU, r0 = .9 * 512, r1 = (i % 4 === 0 ? .8 : .85) * 512; q.beginPath(); q.moveTo(C0 + Math.cos(a) * r0, C0 + Math.sin(a) * r0); q.lineTo(C0 + Math.cos(a) * r1, C0 + Math.sin(a) * r1); q.stroke(); }
        q.fillStyle = 'rgba(242,193,78,.16)'; q.strokeStyle = 'rgba(242,193,78,.9)'; q.lineWidth = 6; q.beginPath();
        for (let i = 0; i < 16; i++) { const a = i / 16 * TAU - PI / 2, r = (i % 2 ? .27 : .56) * 512; q[i ? 'lineTo' : 'moveTo'](C0 + Math.cos(a) * r, C0 + Math.sin(a) * r); } q.closePath(); q.fill(); q.stroke();
        // 네 길로 이어지는 화살촉
        [[0, -1], [1, 0], [0, 1], [-1, 0]].forEach(d => { q.save(); q.translate(C0 + d[0] * .74 * 512, C0 + d[1] * .74 * 512); q.rotate(Math.atan2(d[1], d[0]) + PI / 2); q.fillStyle = 'rgba(232,207,147,.45)'; q.beginPath(); q.moveTo(0, -34); q.lineTo(26, 20); q.lineTo(0, 8); q.lineTo(-26, 20); q.closePath(); q.fill(); q.restore(); });
        // 별자리(점과 선)
        q.strokeStyle = 'rgba(240,226,190,.5)'; q.fillStyle = '#f3e7c4'; q.lineWidth = 3;
        for (let k = 0; k < 5; k++) { const a0 = rnd() * TAU, pts = []; for (let i = 0; i < 5; i++) { const a = a0 + i * .22 + rnd() * .1, r = (.62 + rnd() * .2) * 512; pts.push([C0 + Math.cos(a) * r, C0 + Math.sin(a) * r]); } q.beginPath(); pts.forEach((p, i) => q[i ? 'lineTo' : 'moveTo'](p[0], p[1])); q.stroke(); pts.forEach(p => { q.beginPath(); q.arc(p[0], p[1], 6, 0, TAU); q.fill(); }); }
      });
      pt.repeat.set(1, 1); pt.wrapS = pt.wrapT = T.ClampToEdgeWrapping;
      const plaza = add(new T.Mesh(new T.CircleGeometry(R_PLAZA, 96), M('#ffffff', { map: pt, emissiveMap: pt, emissive: '#ffffff', emissiveIntensity: .5, roughness: .9 })), 0, .02, 0); plaza.rotation.x = -PI / 2; plaza.rotation.z = PI / 2; c.support.push(plaza);
      const rim = add(new T.Mesh(new T.TorusGeometry(R_PLAZA + .15, .12, 8, 120), E('#e8cf93', 1.1)), 0, .12, 0); rim.rotation.x = PI / 2;

      // ── 천문 기념물: 돌아가는 고리와 빛나는 별 ──
      const mon = new T.Group(); g.add(mon);
      add(new T.Mesh(new T.CylinderGeometry(3.6, 3.9, .35, 40), M('#13205a')), 0, .17, 0, mon); add(new T.Mesh(new T.CylinderGeometry(2.7, 3, .35, 40), M('#1c2f72')), 0, .5, 0, mon);
      const rb = add(new T.Mesh(new T.TorusGeometry(3.3, .07, 8, 80), E('#ffd95a', 1.6)), 0, .37, 0, mon); rb.rotation.x = PI / 2;
      add(new T.Mesh(new T.CylinderGeometry(.14, .2, 2.8, 12), M('#2a3f8a')), 0, 1.9, 0, mon);
      const arm = new T.Group(); arm.position.y = 3.5; mon.add(arm);
      const rings = [[1.7, 0, 0, '#e8cf93'], [1.35, PI / 2, 0, '#6fe0d0'], [1.0, PI / 3, PI / 3, '#f3e7c4']].map(d => { const t = new T.Mesh(new T.TorusGeometry(d[0], .06, 8, 64), E(d[3], 1.5)); t.rotation.set(d[1], d[2], 0); t.castShadow = true; arm.add(t); return t; });
      const core = new T.Mesh(new T.SphereGeometry(.5, 24, 16), E('#ffe58a', 2.2)); arm.add(core);
      glow(0, 3.5, 0, '#ffe58a', 6); plight('#ffe2a8', 60, 0, 4.4, 0); plight('#ffd9a0', 22, 0, 1.2, 0);
      block(0, 0, 3.7);
      things.mon = { arm: arm, rings: rings };

      // ── 안내 시계(멈춘 시계) ──
      const clk = new T.Group(); clk.position.set(-10, 0, -7); clk.rotation.y = Math.atan2(4, 10); g.add(clk);
      add(new T.Mesh(new T.BoxGeometry(2.4, .9, 2.4), M('#101c4a')), 0, .45, 0, clk); add(new T.Mesh(new T.BoxGeometry(1.5, 5.8, 1.5), M('#14245a')), 0, 3.8, 0, clk);
      [[-.78, -.78], [.78, -.78], [-.78, .78], [.78, .78]].forEach(p => add(new T.Mesh(new T.BoxGeometry(.06, 5.8, .06), E('#4fd8c8', 1.3)), p[0], 3.8, p[1], clk)); for (let i = 0; i < 5; i++) add(new T.Mesh(new T.BoxGeometry(1.2, .05, .04), E('#4fd8c8', 1.0)), 0, 1.4 + i * .8, .79, clk);
      const faceTex = c.canvasTex(512, 512, q => {
        q.fillStyle = '#f3e7c4'; q.beginPath(); q.arc(256, 256, 250, 0, TAU); q.fill(); q.strokeStyle = '#c9a45a'; q.lineWidth = 22; q.stroke();
        q.fillStyle = '#14245a'; q.font = '900 54px Pretendard, "Malgun Gothic", sans-serif'; q.textAlign = 'center'; q.textBaseline = 'middle';
        for (let i = 1; i <= 12; i++) { const a = i / 12 * TAU - PI / 2; q.fillText(String(i), 256 + Math.cos(a) * 196, 262 + Math.sin(a) * 196); }
        q.strokeStyle = '#8d97c9'; q.lineWidth = 3; q.beginPath(); q.moveTo(120, 120); q.lineTo(330, 380); q.moveTo(380, 150); q.lineTo(300, 260); q.stroke();   // 금 간 유리
      });
      const face = add(new T.Mesh(new T.CylinderGeometry(1.45, 1.45, .5, 40), [M('#14245a'), new T.MeshStandardMaterial({ map: faceTex, emissiveMap: faceTex, emissive: '#ffffff', emissiveIntensity: .35, roughness: .6 }), M('#2a3570')]), 0, 6.2, .1, clk); face.rotation.x = PI / 2;
      const hands = new T.Group(); hands.position.set(0, 6.2, .42); clk.add(hands);
      const hH = new T.Mesh(new T.BoxGeometry(.16, .85, .06), M('#1d2559')), hM = new T.Mesh(new T.BoxGeometry(.11, 1.2, .06), M('#1d2559'));
      hH.position.y = .38; hM.position.y = .55; const gH = new T.Group(), gM = new T.Group(); gH.add(hH); gM.add(hM); hands.add(gH, gM);
      const setTime = (h, m) => { gM.rotation.z = -m / 60 * TAU; gH.rotation.z = -((h % 12) + m / 60) / 12 * TAU; }; setTime(7, 47);   // 7시 47분에 멈춘 시계
      const spire = add(new T.Mesh(new T.OctahedronGeometry(.45), E('#f3e7c4', 1.3)), 0, 8.1, 0, clk);
      const lampTop = glow(-10, 6.2, -7, '#ff9a6a', 4.2);   // 멈춘 동안 붉은 불
      const clkLight = plight('#ff9a7a', 26, -9.2, 5.6, -6.2);
      add(new T.Mesh(new T.BoxGeometry(.9, .6, .06), M('#fff4d6')), 0, 1.5, .78, clk);   // 붙어 있는 안내문
      block(-10, -7, 1.9);
      things.clock = { run: false, t: 0, lamp: lampTop, light: clkLight, spire: spire, hh: gH, mm: gM, setTime: setTime };

      // ── 가로등(별 모양 머리) ──
      const lamp = (x, z, h) => {
        h = h || 4.4;
        add(new T.Mesh(new T.CylinderGeometry(.07, .11, h, 8), M('#1d2c68')), x, h / 2, z);
        const s = add(new T.Mesh(new T.SphereGeometry(.22, 14, 10), E('#fff0c4', 1.5)), x, h + .3, z);
        glow(x, h + .3, z, '#ffd98a', 3.4).material.opacity = .45;
        block(x, z, .3);
        return s;
      };
      for (let i = 0; i < 12; i++) { const a = i / 12 * TAU + .13; lamp(Math.cos(a) * (R_PLAZA - 1.3), Math.sin(a) * (R_PLAZA - 1.3)); }
      for (let k = 0; k < 6; k++) { const d = 26 + k * 10; [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(v => { const sx = v[0] ? 0 : 1, sz = v[1] ? 0 : 1; lamp(v[0] * d + sx * ROAD_HALF * .92, v[1] * d + sz * ROAD_HALF * .92); lamp(v[0] * d - sx * ROAD_HALF * .92, v[1] * d - sz * ROAD_HALF * .92); }); }

      for (let k = 0; k < 5; k++) { const d = 31 + k * 10; [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(v => { const sx = v[0] ? 0 : 1, sz = v[1] ? 0 : 1; if (k > 1 && (v[0] || v[1] < 0)) return; tree(v[0] * d + sx * ROAD_HALF * 1.5 * (k % 2 ? 1 : -1), v[1] * d + sz * ROAD_HALF * 1.5 * (k % 2 ? 1 : -1), 1 + (k % 3) * .15); }); }
      // ── 벤치 ──
      for (let i = 0; i < 8; i++) {
        if (i === 1 || i === 2) continue;   // 남쪽 두 자리는 비워 둔다(처음 서는 곳, 사건 1 훈련 자리)
        const a = i / 8 * TAU + PI / 8, r = 8.6, b = new T.Group(); b.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); b.rotation.y = -a - PI / 2; g.add(b);
        add(new T.Mesh(new T.BoxGeometry(2, .12, .6), M('#3a2e2a')), 0, .5, 0, b); add(new T.Mesh(new T.BoxGeometry(2, .5, .1), M('#3a2e2a')), 0, .85, -.3, b);
        add(new T.Mesh(new T.BoxGeometry(2.1, .05, .06), E('#e8cf93', 1.0)), 0, .3, .26, b); [-.8, .8].forEach(x => add(new T.Mesh(new T.BoxGeometry(.1, .5, .5), M('#16245a')), x, .25, 0, b));
        block(Math.cos(a) * r, Math.sin(a) * r, .9);
      }

      // ── 길: 동서남북 ──
      Object.keys(DIRS).forEach(k => {
        const d = DIRS[k];
        railRoad(k);
      });
      // 길 끝(다음 구역이 열리기 전)의 막이: 공사 가림막과 안내판
      const endSign = (x, z, ry, text, parent) => { const t = c.canvasTex(512, 160, q => { q.fillStyle = '#14214f'; q.fillRect(0, 0, 512, 160); q.strokeStyle = '#f2c14e'; q.lineWidth = 8; q.strokeRect(8, 8, 496, 144); q.fillStyle = '#ffffff'; q.font = '900 52px Pretendard, "Malgun Gothic", sans-serif'; q.textAlign = 'center'; q.textBaseline = 'middle'; q.fillText(text, 256, 82); }); const m = add(new T.Mesh(new T.BoxGeometry(3.2, 1, .15), [M('#14214f'), M('#14214f'), M('#14214f'), M('#14214f'), new T.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: '#ffffff', emissiveIntensity: .5 }), M('#14214f')]), x, 2.2, z, parent); m.rotation.y = ry; add(new T.Mesh(new T.CylinderGeometry(.07, .07, 2, 6), M('#4a5598')), x, 1, z, parent); };
      const closed = {};   // 방향별 막이. 앞의 사건을 풀어 구역이 열리면 치운다
      Object.keys(DIRS).forEach(k => {
        const d = DIRS[k], ry = d[0] ? PI / 2 : 0;
        const mk = (dist, text, closable) => {
          const g2 = new T.Group(), ex = d[0] * dist, ez = d[1] * dist; g.add(g2);
          for (let i = -1; i <= 1; i++) g2.add(c.piece('roads/construction-barrier', ex + (d[0] ? 0 : i * 2.6), ez + (d[1] ? 0 : i * 2.6), ry, K * .9));
          const sx = ex - d[0] * 1.2, sz = ez - d[1] * 1.2; endSign(sx, sz, d[0] ? -d[0] * PI / 2 : d[1] > 0 ? PI : 0, text, g2);
          const b = { x: ex, z: ez, r: 4.4 }; blocks.push(b); if (closable) closed[k] = { group: g2, block: b, x: ex, z: ez };
        };
        mk(ROAD_END - 4, '길이 끝났습니다', false); if (k !== 'S') mk(38, '공사 중 · 지나갈 수 없음', true);
      });

      // ── 건물 줄: 광장을 둥글게 둘러싼다. 길이 나가는 네 곳은 비운다 ──
      const WIDTHS = [6, 7, 5.5, 8, 6.5, 7, 5.5, 7.5], LABELS = ['별빛 카페', '', '천체 서점', '', '시계 수리', '', '별사탕 가게', '', '열차 안내소', '', '렌즈 가게', '', '', ''];
      const signAt = (text, x, y, z, ry, w, color) => {
        const h = .8, t = c.canvasTex(512, Math.round(512 * h / w), q => { q.fillStyle = '#101a46'; q.fillRect(0, 0, 512, 512); q.fillStyle = color; q.fillRect(0, q.canvas.height - 10, 512, 10); q.fillStyle = '#ffffff'; q.font = '900 ' + Math.round(q.canvas.height * .5) + 'px Pretendard, "Malgun Gothic", sans-serif'; q.textAlign = 'center'; q.textBaseline = 'middle'; q.fillText(text, 256, q.canvas.height / 2 - 4); });
        const mats = [0, 1, 2, 3, 4, 5].map(f => f === 4 ? new T.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: '#ffffff', emissiveIntensity: .8 }) : M('#101a46'));
        const m = add(new T.Mesh(new T.BoxGeometry(w, h, .14), mats), x, y, z); m.rotation.y = ry; glow(x, y, z, color, w * 1.4); return m;
      };
      const gap = a => { let x = ((a % TAU) + TAU) % TAU; return [0, PI / 2, PI, PI * 1.5].some(d => Math.min(Math.abs(x - d), TAU - Math.abs(x - d)) < .34); };
      const oa = -PI * .27;   // 사무소 자리의 각도
      let ang = -PI * .42, n = 0;
      while (ang < -PI * .42 + TAU - .1 && n < 60) {
        const w = WIDTHS[n % WIDTHS.length], step = (w * .5 + .3) / R_RING;
        if (gap(ang + step)) { ang += .16; continue; }
        const a = ang + step; if (Math.abs(Math.atan2(Math.sin(a - oa), Math.cos(a - oa))) < .3) { ang += .1; continue; }
        const x = Math.cos(a) * R_RING, z = Math.sin(a) * R_RING, ry = Math.atan2(-Math.cos(a), -Math.sin(a)), h = 10 + ((n * 7) % 5) * 3.2;
        townhouse(x, z, ry, w, 7, h, n); block(x, z, w * .5 + .5, 1);
        if (LABELS[n % LABELS.length]) { const fx = Math.cos(a) * (R_RING - 3.7), fz = Math.sin(a) * (R_RING - 3.7); signAt(LABELS[n % LABELS.length], fx, 3.4, fz, ry, 3.6, ['#e8cf93', '#6fe0d0', '#f2c14e'][n % 3]); if (LABELS[n % LABELS.length] === '별사탕 가게') { const dx = Math.cos(a) * (R_RING - 3.9), dz = Math.sin(a) * (R_RING - 3.9); doors.sweets = { x: dx, z: dz }; const dm = add(new T.Mesh(new T.BoxGeometry(1.4, 2.2, .12), E('#ffe29a', 1.2)), dx, 1.1, dz); dm.rotation.y = ry; } }
        ang += step * 2 + .03; n++;
      }
      // 뒷줄: 멀리 보이는 높은 집(바깥)
      for (let i = 0; i < 18; i++) { const a = i / 18 * TAU + .1, x = Math.cos(a) * (R_RING + 15), z = Math.sin(a) * (R_RING + 15); if (gap(a)) continue; townhouse(x, z, Math.atan2(-Math.cos(a), -Math.sin(a)), 9 + (i % 3) * 2, 9, 20 + (i * 5) % 14, i + 2); block(x, z, 6, 1); }

      // ── ARCHIVE 탐정 사무소: 광장 북동쪽 ──
      const ox = Math.cos(oa) * (R_RING - 1.2), oz = Math.sin(oa) * (R_RING - 1.2), ory = Math.atan2(-Math.cos(oa), -Math.sin(oa));
      townhouse(ox, oz, ory, 9, 8, 15, 1); block(ox, oz, 5.2, 1);
      const fr = [Math.cos(oa) * (R_RING - 1.2 - 4.2), Math.sin(oa) * (R_RING - 1.2 - 4.2)];
      signAt('ARCHIVE 탐정 사무소', fr[0], 4.6, fr[1], ory, 5.8, '#e8cf93');
      const door = add(new T.Mesh(new T.BoxGeometry(1.5, 2.3, .12), E('#ffe29a', 1.3)), Math.cos(oa) * (R_RING - 1.2 - 4.05), 1.2, Math.sin(oa) * (R_RING - 1.2 - 4.05)); door.rotation.y = ory;
      plight('#ffe0a0', 30, fr[0] * .93, 2.4, fr[1] * .93); doors.office = { x: Math.cos(oa) * (R_RING - 1.2 - 4.4), z: Math.sin(oa) * (R_RING - 1.2 - 4.4) };
      things.office = { x: Math.cos(oa) * (R_RING - 1.2 - 6.5), z: Math.sin(oa) * (R_RING - 1.2 - 6.5) };

      // ── 사건 1 현장: 시계 관리실, 사탕 항아리 탁자, 바닥의 끈적한 자국 ──
      const booth = new T.Group(); booth.position.set(-6.4, 0, -11.4); g.add(booth);
      add(new T.Mesh(new T.BoxGeometry(3.2, 2.6, 2.2), M('#16245a')), 0, 1.3, 0, booth); add(new T.Mesh(new T.BoxGeometry(3.7, .28, 2.7), M('#f2c14e')), 0, 2.74, 0, booth);
      add(new T.Mesh(new T.BoxGeometry(1.5, .95, .08), E('#ffe29a', 1.1)), 0, 1.55, 1.12, booth); add(new T.Mesh(new T.BoxGeometry(1.7, .1, .3), M('#26326e')), 0, 1.0, 1.2, booth);
      add(new T.Mesh(new T.BoxGeometry(.7, 1.9, .08), M('#1d2559')), -1.1, .95, 1.12, booth);
      signAt('시계 관리실', -6.4, 3.35, -10.2, 0, 2.6, '#e8cf93');
      block(-6.4, -11.4, 2.1);
      const tbl = new T.Group(); tbl.position.set(-3.0, 0, -10.2); g.add(tbl);
      add(new T.Mesh(new T.CylinderGeometry(.85, .85, .08, 24), M('#6a4f3a')), 0, .78, 0, tbl); add(new T.Mesh(new T.CylinderGeometry(.08, .12, .78, 8), M('#4a5598')), 0, .39, 0, tbl);
      const jar = add(new T.Mesh(new T.CylinderGeometry(.24, .24, .55, 20, 1, true), new T.MeshStandardMaterial({ color: '#cfe6ff', transparent: true, opacity: .4, roughness: .1, side: T.DoubleSide })), .2, 1.1, 0, tbl);
      add(new T.Mesh(new T.CylinderGeometry(.27, .27, .06, 20), M('#f2c14e')), .2, 1.4, .5, tbl); add(new T.Mesh(new T.CylinderGeometry(.3, .3, .03, 20), M('#fff4d6')), -.35, .83, .1, tbl);
      block(-3.0, -10.2, 1.0);
      const goo = new T.MeshStandardMaterial({ color: '#f0b45a', emissive: '#a86a1c', emissiveIntensity: .35, roughness: .25, transparent: true, opacity: .9 });
      [[-3.4, -8.4], [-4.0, -7.4], [-4.7, -6.4], [-5.3, -5.4], [-5.8, -4.4], [-6.1, -3.3], [-5.9, -2.2], [-5.3, -1.2], [-4.6, -.2], [-3.9, .9], [-3.1, 2.0], [-2.2, 3.1], [-1.2, 4.2]].forEach((p, i) => { const d = new T.Mesh(new T.CircleGeometry(.4 - i * .012, 18), goo); d.rotation.x = -PI / 2; d.scale.set(1, 1.6, 1); d.rotation.z = .6; d.position.set(p[0], .06, p[1]); g.add(d); });

      // ── 시계 만들기(큰 시계탑에도 쓴다) ──
      const clocks = [];
      const makeClock = (parent, x, y, z, rad) => {
        const ft = c.canvasTex(512, 512, q => {
          q.fillStyle = '#f4efe0'; q.beginPath(); q.arc(256, 256, 250, 0, TAU); q.fill(); q.strokeStyle = '#2a3570'; q.lineWidth = 14; q.stroke();
          q.fillStyle = '#2a3570'; q.font = '900 54px Pretendard, "Malgun Gothic", sans-serif'; q.textAlign = 'center'; q.textBaseline = 'middle';
          for (let i = 1; i <= 12; i++) { const a = i / 12 * TAU - PI / 2; q.fillText(String(i), 256 + Math.cos(a) * 196, 262 + Math.sin(a) * 196); }
        });
        const f = add(new T.Mesh(new T.CylinderGeometry(rad, rad, .5, 40), [M('#2a3570'), new T.MeshStandardMaterial({ map: ft, emissiveMap: ft, emissive: '#ffffff', emissiveIntensity: .4, roughness: .6 }), M('#2a3570')]), x, y, z, parent); f.rotation.x = PI / 2;
        const hs = new T.Group(); hs.position.set(x, y, z + .32); parent.add(hs);
        const a = new T.Mesh(new T.BoxGeometry(rad * .11, rad * .6, .06), M('#1d2559')), b = new T.Mesh(new T.BoxGeometry(rad * .08, rad * .85, .06), M('#1d2559'));
        a.position.y = rad * .26; b.position.y = rad * .38; const gh = new T.Group(), gm = new T.Group(); gh.add(a); gm.add(b); hs.add(gh, gm);
        const o = { setTime: (h, m) => { gm.rotation.z = -m / 60 * TAU; gh.rotation.z = -((h % 12) + m / 60) / 12 * TAU; } }; o.setTime(7, 47); clocks.push(o); return o;
      };
      const box = (w, h, d, color) => new T.Mesh(new T.BoxGeometry(w, h, d), M(color));
      const stringLights = (x0, z0, x1, z1, y, n, colors) => { for (let i = 0; i <= n; i++) { const t = i / n, sag = Math.sin(t * PI) * .7; add(new T.Mesh(new T.SphereGeometry(.14, 8, 6), E(colors[i % colors.length], 2.2)), x0 + (x1 - x0) * t, y - sag, z0 + (z1 - z0) * t); } };

      // ── 별빛 역(동쪽, 중심 x=90): 역사, 분실물 보관소, 승강장, 선로와 서 있는 열차 ──
      { const cx = 90;
        const hall = new T.Group(); hall.position.set(cx, 0, -19); g.add(hall);
        add(box(32, 8, 8, '#13214f'), 0, 4, 0, hall); add(box(33, .7, 9, '#f2c14e'), 0, 8.2, 0, hall);
        for (let i = 0; i < 6; i++) add(new T.Mesh(new T.BoxGeometry(2.4, 3.2, .12), E('#ffe29a', .9)), -12.5 + i * 5, 4.2, 4.06, hall);
        signAt('별빛 역', cx - 8, 7, -14.9, 0, 6.4, '#e8cf93');
        const bd = c.canvasTex(512, 200, q => { q.fillStyle = '#10142e'; q.fillRect(0, 0, 512, 200); q.fillStyle = '#ff8f6a'; q.font = '900 52px Pretendard, "Malgun Gothic", sans-serif'; q.textAlign = 'center'; q.fillText('열차 지연', 256, 80); q.fillStyle = '#ffe29a'; q.font = '800 40px Pretendard, "Malgun Gothic", sans-serif'; q.fillText('안내 시계가 멈췄습니다', 256, 150); });
        add(new T.Mesh(new T.BoxGeometry(5.2, 2, .16), [M('#10142e'), M('#10142e'), M('#10142e'), M('#10142e'), new T.MeshStandardMaterial({ map: bd, emissiveMap: bd, emissive: '#ffffff', emissiveIntensity: .9 }), M('#10142e')]), cx + 9, 5.4, -14.9);
        glow(cx + 9, 5.4, -14.9, '#ff9a7a', 8);
        for (let x = cx - 15; x <= cx + 15; x += 3) block(x, -15.5, 2.0);
        // 분실물 보관소: 역사 앞에 붙은 작은 건물
        const lf = new T.Group(); lf.position.set(cx + 6, 0, -12.5); g.add(lf);
        add(box(6, 4.2, 4, '#16245a'), 0, 2.1, 0, lf); add(box(6.6, .3, 4.6, '#f2c14e'), 0, 4.35, 0, lf);
        add(new T.Mesh(new T.BoxGeometry(1.6, 2.5, .12), E('#ffe29a', 1.2)), 0, 1.3, 2.03, lf);
        signAt('분실물 보관소', cx + 6, 5.4, -10.2, 0, 4.8, '#6fe0d0'); block(cx + 4, -12.5, 2.2); block(cx + 8, -12.5, 2.2);
        // 승강장·선로
        add(box(42, .5, 7, '#39459a'), cx, .25, 7.5); add(new T.Mesh(new T.BoxGeometry(42, .06, .35), E('#ffd95a', 1.4)), cx, .55, 10.8);
        for (let i = -15; i <= 15; i++) add(box(.42, .12, 2.3, '#4a3a2a'), cx + i * 1.4, .08, 13.4);
        add(box(44, .16, .2, '#8a96d8'), cx, .22, 12.6); add(box(44, .16, .2, '#8a96d8'), cx, .22, 14.2);
        const cars = [];
        for (let i = 0; i < 5; i++) {
          const car = new T.Group(); car.position.set(cx - 19 + i * 9.6, 0, 13.4); g.add(car); cars.push(car);
          add(box(9, 3.2, 2.8, '#14245a'), 0, 2.3, 0, car); add(box(9.05, .4, 2.85, '#e8cf93'), 0, 1.7, 0, car); add(box(8.6, .3, 2.5, '#33418a'), 0, 4.0, 0, car);
          for (let j = 0; j < 4; j++) add(new T.Mesh(new T.BoxGeometry(1.5, 1.1, .08), E('#ffe29a', 1.0)), -3.2 + j * 2.1, 2.7, -1.42, car);
          [-3, 3].forEach(x => add(new T.Mesh(new T.CylinderGeometry(.45, .45, .25, 14), M('#2b356f')), x, .5, 1.2, car));
        }
        for (let x = cx - 22; x <= cx + 22; x += 2.2) block(x, 11.6, 1.2);   // 선로 쪽은 걸어 들어갈 수 없다
        // 승강장 지붕과 기둥, 벤치
        add(new T.Mesh(new T.BoxGeometry(38, .2, 7.6), new T.MeshStandardMaterial({ color: '#5a6fd8', transparent: true, opacity: .2, depthWrite: false })), cx, 5.3, 7.4); [-16, -5, 6, 17].forEach(x => { add(new T.Mesh(new T.CylinderGeometry(.18, .22, 5.2, 8), M('#4a5598')), cx + x, 2.6, 4.2); block(cx + x, 4.2, .5); });
        stringLights(cx - 18, 4.4, cx + 18, 4.4, 5.0, 24, ['#ffe9a8', '#6fe0d0', '#f3e7c4']);
        lamp(cx - 20, 2); lamp(cx + 20, 2); lamp(cx, 3); lamp(cx - 10, 3); lamp(cx + 10, 3);
        [-10, -2, 8].forEach(x => { add(box(2, .12, .6, '#6a4f3a'), cx + x, .6, 7.2); add(box(2, .5, .1, '#6a4f3a'), cx + x, .95, 6.9); block(cx + x, 7.2, 1); });
        plight('#ffe0a0', 30, cx, 4.2, 6); plight('#9bb4ff', 22, cx + 4, 4.5, -9);
        things.train = cars;
      }

      // ── 별무리 시장(서쪽, 중심 x=-90): 노점, 매단 등, 온실 정원 ──
      { const cx = -90, cols = ['#e8cf93', '#2f4a8f', '#c9a45a', '#3a8f9a', '#f3e7c4'];
        const stall = (x, z, front, i) => {
          const s = new T.Group(); s.position.set(x, 0, z); s.rotation.y = front > 0 ? 0 : PI; g.add(s);
          add(box(3.8, 1, 1.5, '#6a4f3a'), 0, .5, 0, s); [-1.8, 1.8].forEach(px => add(new T.Mesh(new T.CylinderGeometry(.08, .08, 3, 6), M('#4a5598')), px, 1.5, -.6, s));
          const aw = c.canvasTex(64, 8, q => { q.fillStyle = '#ffffff'; q.fillRect(0, 0, 64, 8); q.fillStyle = cols[i % cols.length]; q.fillRect(0, 0, 32, 8); }, 5, 1);
          aw.magFilter = T.NearestFilter; const a = add(new T.Mesh(new T.BoxGeometry(4.2, .1, 2.2), new T.MeshStandardMaterial({ map: aw, roughness: .9, transparent: true, opacity: .58, depthWrite: false })), 0, 3.05, .1, s); a.rotation.x = .28;
          for (let j = 0; j < 4; j++) add(new T.Mesh(new T.SphereGeometry(.2, 10, 8), E(cols[(i + j) % cols.length], 1.4)), -1.3 + j * .85, 1.2, .1, s);
          block(x - 1.2, z, 1.1); block(x + 1.2, z, 1.1);
        };
        [-12, -1, 5, 11].forEach((dx, i) => stall(cx + dx, -5.5, 1, i)); [-12, -6, 0, 6, 12].forEach((dx, i) => stall(cx + dx + 3, 5.5, -1, i + 2));
        [-15, 15].forEach(dx => [-7, 7].forEach(dz => add(new T.Mesh(new T.CylinderGeometry(.1, .12, 5.4, 8), M('#4a5598')), cx + dx, 2.7, dz)));
        [-7, 0, 7].forEach(z => stringLights(cx - 15, z, cx + 15, z, 5.3, 28, cols));
        // 온실 정원: 유리 온실, 문 앞이 사건 3의 입구
        const gh = new T.Group(); gh.position.set(cx - 6, 0, -14); g.add(gh);
        add(box(13, .5, 7.5, '#39459a'), 0, .25, 0, gh);
        const glass = new T.MeshStandardMaterial({ color: '#9fe3d8', transparent: true, opacity: .32, roughness: .15, side: T.DoubleSide, depthWrite: false });
        add(new T.Mesh(new T.BoxGeometry(12.6, 4.6, 7), glass), 0, 2.8, 0, gh); const roof = add(new T.Mesh(new T.CylinderGeometry(0, 6.9, 2.4, 4, 1), glass), 0, 6.2, 0, gh); roof.rotation.y = PI / 4;
        [-6.3, -2.1, 2.1, 6.3].forEach(x => { add(box(.12, 4.6, .12, '#e9edff'), x, 2.8, 3.5, gh); add(box(.12, 4.6, .12, '#e9edff'), x, 2.8, -3.5, gh); });
        for (let i = 0; i < 14; i++) add(new T.Mesh(new T.SphereGeometry(.35 + rnd() * .3, 10, 8), E(['#4fd8c8', '#9fe3d8', '#ffe2a8'][i % 3], .9)), -5 + i * .78, 1.1 + rnd() * .8, -1.5 + (i % 4) * 1.1, gh);
        add(new T.Mesh(new T.BoxGeometry(1.8, 2.7, .1), E('#b8ffe0', 1.2)), 0, 1.6, 3.58, gh);
        signAt('온실 정원', cx - 6, 5.2, -10.2, 0, 4.2, '#4fd8c8'); [-4.5, 4.5].forEach(x => block(cx - 6 + x, -14, 3)); block(cx - 6, -16.5, 3.2);
        plight('#ffd9a0', 28, cx, 5.4, 0); plight('#a0ffd9', 18, cx - 6, 3, -12);
        lamp(cx - 20, -3); lamp(cx + 20, 3); lamp(cx, -9); lamp(cx, 9);
      }

      // ── 시계탑 거리(북쪽, 중심 z=-90): 큰길 양옆의 건물, 끝에 선 시계탑 ──
      { const tz = -103, KEYS = ['building-a', 'building-g', 'building-c', 'building-f', 'building-i'];
        for (let i = 0; i < 5; i++) { const z = -72 - i * 6; [[-12.5, PI / 2], [12.5, -PI / 2]].forEach((s, j) => { townhouse(s[0], z, s[1], 6, 6, 12 + ((i * 3 + j * 2) % 5) * 3, i + j * 2); block(s[0], z, 3.2); }); }
        const tw = new T.Group(); tw.position.set(0, 0, tz); g.add(tw);
        add(box(13, 6.5, 12, '#16276a'), 0, 3.25, 0, tw); add(box(8.6, 22, 8.6, '#1b2f78'), 0, 17.5, 0, tw); add(box(10, 1.2, 10, '#c9a45a'), 0, 28.9, 0, tw); add(box(9.2, .5, 9.2, '#c9a45a'), 0, 6.7, 0, tw);
        [[-4.35, -4.35], [4.35, -4.35], [-4.35, 4.35], [4.35, 4.35]].forEach(p => add(new T.Mesh(new T.BoxGeometry(.18, 22, .18), E('#4fd8c8', 1.4)), p[0], 17.5, p[1], tw)); for (let i = 0; i < 9; i++) add(new T.Mesh(new T.BoxGeometry(2.4, .09, .06), E('#4fd8c8', 1.2)), 0, 9 + i * 1.5, 4.36, tw);
        const roofT = add(new T.Mesh(new T.ConeGeometry(5.4, 6.5, 4), M('#0a1438')), 0, 32.6, 0, tw); roofT.rotation.y = PI / 4;
                plight('#ffe9b0', 34, 0, 14, tz + 9);
        things.bigClock = makeClock(tw, 0, 23.5, 4.5, 3.3);
        things.towerSpire = add(new T.Mesh(new T.OctahedronGeometry(.9), E('#4fd8c8', 1.6)), 0, 36.4, 0, tw); glow(0, 36.4, tz, '#4fd8c8', 10);
        add(new T.Mesh(new T.BoxGeometry(2.2, 3.2, .14), E('#ffe29a', .8)), 0, 1.7, 6.04, tw);
        signAt('시계탑', 0, 5.6, tz + 6.2, 0, 5.2, '#e8cf93');
        block(-5, tz, 4); block(5, tz, 4); block(0, tz - 2, 4.6);
        [-9, 9].forEach(x => lamp(x, -88)); lamp(-6, -96); lamp(6, -96);
        plight('#ffe0a0', 40, 0, 6.5, -94); plight('#a9bcff', 30, 0, 18, tz + 6);
      }

      // ── 하늘(표지): 짙은 남색 밤, 지평선의 청록과 금빛 구름, 천문 원, 하늘을 가로지르는 금빛 레일 ──
      const skyTex = (() => { const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 512; const q = cv.getContext('2d'), gr = q.createLinearGradient(0, 0, 0, 512);
        [[0, '#020820'], [.28, '#051644'], [.42, '#0b3774'], [.48, '#21688a'], [.505, '#b49a66'], [.53, '#1a3e70'], [.6, '#0a1a45'], [1, '#050d2a']].forEach(s => gr.addColorStop(s[0], s[1])); q.fillStyle = gr; q.fillRect(0, 0, 1024, 512);
        for (let i = 0; i < 22; i++) { const cx = rnd() * 1024, cy = 190 + rnd() * 60, rx = 60 + rnd() * 110, ry = 6 + rnd() * 9, g2 = q.createRadialGradient(cx, cy, 0, cx, cy, rx); g2.addColorStop(0, i % 3 ? 'rgba(214,180,120,.30)' : 'rgba(70,150,175,.26)'); g2.addColorStop(1, 'rgba(0,0,0,0)'); q.save(); q.translate(cx, cy); q.scale(1, ry / rx); q.translate(-cx, -cy); q.fillStyle = g2; q.fillRect(cx - rx, cy - rx, rx * 2, rx * 2); q.restore(); }
        const t = new T.CanvasTexture(cv); t.colorSpace = T.SRGBColorSpace; return t; })();
      const dome = new T.Mesh(new T.SphereGeometry(320, 32, 16), new T.MeshBasicMaterial({ map: skyTex, side: T.BackSide, fog: false, depthWrite: false })); dome.renderOrder = -10; g.add(dome);
      const N = 1100, pos = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) { const u = rnd() * TAU, v = .1 + rnd() * .9, r = 300; pos[i * 3] = Math.cos(u) * Math.sqrt(1 - v * v) * r; pos[i * 3 + 1] = v * r; pos[i * 3 + 2] = Math.sin(u) * Math.sqrt(1 - v * v) * r; }
      const sg = new T.BufferGeometry(); sg.setAttribute('position', new T.BufferAttribute(pos, 3));
      g.add(new T.Points(sg, new T.PointsMaterial({ color: '#f3e7c4', size: 2.0, sizeAttenuation: false, fog: false })));
      const spark = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const q = cv.getContext('2d'); q.fillStyle = '#fff'; q.beginPath(); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU - PI / 2, r = i % 2 ? 6 : 30; q[i ? 'lineTo' : 'moveTo'](32 + Math.cos(a) * r, 32 + Math.sin(a) * r); } q.closePath(); q.fill(); const t = new T.CanvasTexture(cv); return t; })();
      [[-170, 150, -200, 14], [150, 190, -180, 10], [60, 130, -260, 18], [-90, 210, -120, 9], [210, 120, -90, 12], [-230, 100, 20, 11], [250, 170, 60, 9], [-40, 240, 140, 8]].forEach(s => { const sp = new T.Sprite(new T.SpriteMaterial({ map: spark, color: '#fff3d0', transparent: true, depthWrite: false, fog: false })); sp.position.set(s[0], s[1], s[2]); sp.scale.setScalar(s[3]); g.add(sp); });
      const sk = new T.Group(); sk.position.set(0, 145, -255); g.add(sk);
      const skyM = (col, op) => new T.MeshBasicMaterial({ color: col, transparent: true, opacity: op, side: T.DoubleSide, depthWrite: false, fog: false });
      [[118, .5, .55], [93, .3, .25], [128, .35, .12]].forEach(r => { const m = new T.Mesh(new T.RingGeometry(r[0] - r[1], r[0], 120), skyM('#e8cf93', r[2])); sk.add(m); });
      for (let i = 0; i < 90; i++) { const a = i / 90 * TAU, len = i % 5 ? 2.4 : 5; const tk = new T.Mesh(new T.PlaneGeometry(.5, len), skyM('#e8cf93', .45)); tk.position.set(Math.cos(a) * 123, Math.sin(a) * 123, 0); tk.rotation.z = a - PI / 2; sk.add(tk); }
      [[.2, 118], [1.2, 118], [2.5, 118], [4.0, 118], [5.2, 118]].forEach(l => { const ln = new T.Mesh(new T.PlaneGeometry(.35, 170), skyM('#e8cf93', .3)); ln.position.set(Math.cos(l[0]) * 40, Math.sin(l[0]) * 40, 0); ln.rotation.z = l[0] + PI / 2; sk.add(ln); const dm = new T.Mesh(new T.PlaneGeometry(2.8, 2.8), skyM('#f3e7c4', .9)); dm.position.set(Math.cos(l[0]) * l[1], Math.sin(l[0]) * l[1], 0); dm.rotation.z = PI / 4; sk.add(dm); });
      const railC = new T.CatmullRomCurve3([[-330, 55, -140], [-230, 105, -205], [-80, 155, -275], [90, 160, -285], [240, 130, -235], [330, 95, -150]].map(p => new T.Vector3(p[0], p[1], p[2])));
      [-2.4, 2.4].forEach(o => { const cv2 = new T.CatmullRomCurve3(railC.getPoints(40).map(p => new T.Vector3(p.x, p.y + o, p.z))); const tb = new T.Mesh(new T.TubeGeometry(cv2, 160, .55, 4), new T.MeshBasicMaterial({ color: '#e8cf93', fog: false })); g.add(tb); });
      for (let i = 0; i <= 80; i++) { const p = railC.getPoint(i / 80), sl = new T.Mesh(new T.BoxGeometry(.45, 5.2, .45), new T.MeshBasicMaterial({ color: '#d8bd80', fog: false })); sl.position.copy(p); g.add(sl); }

      // ── 건물 안: 사무소와 별사탕 가게. 도시 바깥(남쪽 먼 곳)에 방을 따로 지어 두고, 문에서 그리로 옮겨 선다 ──
      const ROOMS = { office: { cx: 0, cz: 240, hw: 8.5, hd: 6.5 }, sweets: { cx: 44, cz: 240, hw: 7, hd: 5.5 } };
      const room = (R, floorA, floorB) => {
        const tex = c.canvasTex(256, 256, q => { q.fillStyle = floorA; q.fillRect(0, 0, 256, 256); q.strokeStyle = floorB; q.lineWidth = 4; for (let i = 0; i < 8; i++) { q.beginPath(); q.moveTo(0, i * 32); q.lineTo(256, i * 32); q.stroke(); } }, R.hw * 2 / 4, R.hd * 2 / 4);
        const fl = add(new T.Mesh(new T.PlaneGeometry(R.hw * 2, R.hd * 2), new T.MeshStandardMaterial({ map: tex, roughness: .9 })), R.cx, .01, R.cz); fl.rotation.x = -PI / 2; fl.castShadow = false;
        const wm = new T.MeshStandardMaterial({ color: '#1b2a66', roughness: .9, transparent: true, opacity: .72 }), gm = E('#e8cf93', .5), H = 3.4;
        [[0, -R.hd, R.hw * 2, .3], [-R.hw, 0, .3, R.hd * 2], [R.hw, 0, .3, R.hd * 2]].forEach(w => { add(new T.Mesh(new T.BoxGeometry(w[2], H, w[3]), wm), R.cx + w[0], H / 2, R.cz + w[1]); add(new T.Mesh(new T.BoxGeometry(w[2] + .1, .14, w[3] + .1), gm), R.cx + w[0], H, R.cz + w[1]); add(new T.Mesh(new T.BoxGeometry(w[2] + .1, .12, w[3] + .1), gm), R.cx + w[0], .08, R.cz + w[1]); });
        add(new T.Mesh(new T.BoxGeometry(R.hw * 2 + .3, .14, .3), gm), R.cx, .07, R.cz + R.hd);
        // 남쪽(앞)에 나가는 문: 금빛 문과 빛
        { const dm = add(new T.Mesh(new T.PlaneGeometry(2.2, 2.6), new T.MeshBasicMaterial({ color: '#ffe29a', transparent: true, opacity: .26, depthWrite: false, side: T.DoubleSide })), R.cx, 1.3, R.cz + R.hd - .3); dm.castShadow = false; add(new T.Mesh(new T.BoxGeometry(2.4, .1, .2), E('#e8cf93', .9)), R.cx, 2.65, R.cz + R.hd - .3); glow(R.cx, .9, R.cz + R.hd - .6, '#ffe29a', 3.2); }
      };
      const box3 = (w, h, d, color, x, y, z, em) => add(new T.Mesh(new T.BoxGeometry(w, h, d), em ? E(color, em) : M(color)), x, y, z);
      const rugAt = (x, z, w, d) => { const t = c.canvasTex(256, 128, q => { q.fillStyle = '#e8cf93'; q.fillRect(0, 0, 256, 128); q.fillStyle = '#26337f'; q.fillRect(10, 10, 236, 108); q.strokeStyle = '#e8cf93'; q.lineWidth = 4; q.strokeRect(26, 26, 204, 76); q.beginPath(); q.arc(128, 64, 26, 0, 6.3); q.stroke(); }); const r = add(new T.Mesh(new T.PlaneGeometry(w, d), new T.MeshStandardMaterial({ map: t, roughness: 1 })), x, .03, z); r.rotation.x = -PI / 2; r.castShadow = false; };
      const boardTex = (title, lines) => c.canvasTex(512, 320, q => { q.fillStyle = '#16245a'; q.fillRect(0, 0, 512, 320); q.strokeStyle = '#e8cf93'; q.lineWidth = 10; q.strokeRect(5, 5, 502, 310); q.fillStyle = '#e8cf93'; q.font = '900 40px Pretendard, "Malgun Gothic", sans-serif'; q.textAlign = 'center'; q.fillText(title, 256, 56); const cols = ['#f3e7c4', '#bff5e8', '#f2c14e']; for (let i = 0; i < lines; i++) { q.save(); q.translate(80 + (i % 3) * 140, 130 + Math.floor(i / 3) * 90); q.rotate(i % 2 ? .05 : -.05); q.fillStyle = cols[i % 3]; q.fillRect(0, 0, 110, 70); q.fillStyle = '#14213f'; for (let j = 0; j < 3; j++) q.fillRect(10, 14 + j * 16, 90 - j * 18, 5); q.restore(); } });
      // 사무소
      { const R = ROOMS.office, X0 = R.cx, Z0 = R.cz; room(R, '#2a3a7c', '#3f518f'); rugAt(X0 + .5, Z0 + 1.2, 8, 4.4);
        const win = c.canvasTex(256, 128, q => { const gr = q.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, '#040b30'); gr.addColorStop(1, '#16367a'); q.fillStyle = gr; q.fillRect(0, 0, 256, 128); q.fillStyle = '#f3e7c4'; for (let i = 0; i < 40; i++) q.fillRect((i * 83) % 256, (i * 37) % 120, 2, 2); q.strokeStyle = '#e8cf93'; q.lineWidth = 3; q.beginPath(); q.arc(180, 60, 40, 0, 6.3); q.stroke(); });
        add(new T.Mesh(new T.PlaneGeometry(4.4, 2.2), new T.MeshStandardMaterial({ map: win, emissiveMap: win, emissive: '#ffffff', emissiveIntensity: .9 })), X0 - 3.2, 1.9, Z0 - R.hd + .2);
        box3(4.6, .14, .14, '#e8cf93', X0 - 3.2, 3.02, Z0 - R.hd + .24, .6); box3(4.6, .14, .14, '#e8cf93', X0 - 3.2, .78, Z0 - R.hd + .24, .6);
        // 책상과 램프, 의자
        box3(3.4, .16, 1.5, '#e8cf93', X0 - 3.2, .95, Z0 - 3.2); box3(3.2, .8, 1.3, '#1d2a66', X0 - 3.2, .5, Z0 - 3.2); box3(.9, .08, .6, '#f3e7c4', X0 - 3.8, 1.07, Z0 - 3.2); box3(.5, .5, .5, '#10142e', X0 - 1.8, .3, Z0 - 2.0);
        box3(.12, .5, .12, '#e8cf93', X0 - 2.0, 1.25, Z0 - 3.4); box3(.5, .26, .5, '#ffe29a', X0 - 2.0, 1.6, Z0 - 3.4, 1.4); plight('#ffe0a0', 14, X0 - 2.0, 2.2, Z0 - 3.0); block(X0 - 3.2, Z0 - 3.2, 1.9);
        // 책장 줄(왼쪽 벽)
        for (let i = 0; i < 3; i++) { box3(.7, 2.8, 2.2, '#1b2a66', X0 - R.hw + .6, 1.4, Z0 - 3.2 + i * 2.8); for (let s = 0; s < 4; s++) box3(.5, .12, 2.0, '#e8cf93', X0 - R.hw + .72, .5 + s * .7, Z0 - 3.2 + i * 2.8, .3); for (let b = 0; b < 8; b++) box3(.42, .55, .18, ['#e8cf93', '#6fe0d0', '#f3e7c4', '#a8283c'][(b + i) % 4], X0 - R.hw + .74, .85 + (b % 3) * .7, Z0 - 3.9 + i * 2.8 + (b % 3) * .6 + .1); block(X0 - R.hw + .6, Z0 - 3.2 + i * 2.8, 1.25); }
        // 오른쪽 벽: 사건 게시판, 앞에서 눌러 수첩을 연다
        const bt = boardTex('사건 게시판', 6), bd = add(new T.Mesh(new T.PlaneGeometry(4.2, 2.6), new T.MeshStandardMaterial({ map: bt, emissiveMap: bt, emissive: '#ffffff', emissiveIntensity: .55 })), X0 + R.hw - .2, 1.9, Z0 - 1.2); bd.rotation.y = -PI / 2;
        // 가운데 열차 지도 탁자
        add(new T.Mesh(new T.CylinderGeometry(1.5, 1.5, .12, 28), M('#e8cf93')), X0 + 3.6, 1.0, Z0 + 2.2); add(new T.Mesh(new T.CylinderGeometry(.25, .35, 1.0, 12), M('#1d2a66')), X0 + 3.6, .5, Z0 + 2.2);
        const mp = c.canvasTex(256, 256, q => { q.fillStyle = '#16245a'; q.fillRect(0, 0, 256, 256); q.strokeStyle = '#e8cf93'; q.lineWidth = 6; q.beginPath(); q.moveTo(20, 128); q.lineTo(236, 128); q.moveTo(128, 20); q.lineTo(128, 236); q.stroke(); q.fillStyle = '#6fe0d0'; [[128, 128], [30, 128], [226, 128], [128, 30]].forEach(p => { q.beginPath(); q.arc(p[0], p[1], 14, 0, 6.3); q.fill(); }); });
        const tm = add(new T.Mesh(new T.CircleGeometry(1.35, 28), new T.MeshStandardMaterial({ map: mp, emissiveMap: mp, emissive: '#ffffff', emissiveIntensity: .6 })), X0 + 3.6, 1.07, Z0 + 2.2); tm.rotation.x = -PI / 2; block(X0 + 3.6, Z0 + 2.2, 1.6);
        // 소파
        box3(3.0, .6, 1.1, '#2a3a8c', X0 - 4.6, .3, Z0 + 3.4); box3(3.0, .9, .3, '#2a3a8c', X0 - 4.6, .8, Z0 + 3.95); block(X0 - 4.6, Z0 + 3.4, 1.5);
        plight('#cfe0ff', 8, X0 + 2, 3.0, Z0 + 1);
      }
      // 별사탕 가게
      { const R = ROOMS.sweets, X0 = R.cx, Z0 = R.cz; room(R, '#33427f', '#4a5a9a'); rugAt(X0, Z0 + 1.8, 5.5, 3.2);
        box3(5.6, .16, 1.5, '#e8cf93', X0, 1.0, Z0 - 2.6); box3(5.4, .9, 1.3, '#1d2a66', X0, .55, Z0 - 2.6); block(X0, Z0 - 2.6, 2.9);
        for (let i = 0; i < 6; i++) box3(.5, .75, .5, ['#f3e7c4', '#e8cf93', '#bff5e8', '#f2a6b4', '#f2c14e', '#a9c4ff'][i], X0 - 2.1 + i * .85, 1.45, Z0 - 2.6, .9);
        for (let s = 0; s < 3; s++) { box3(5.2, .12, .5, '#e8cf93', X0, 1.5 + s * .85, Z0 - R.hd + .5, .3); for (let b = 0; b < 7; b++) box3(.38, .5, .38, ['#f3e7c4', '#bff5e8', '#f2a6b4', '#f2c14e'][(b + s) % 4], X0 - 2.4 + b * .8, 1.82 + s * .85, Z0 - R.hd + .5, .8); }
        for (let i = 0; i < 6; i++) add(new T.Mesh(new T.OctahedronGeometry(.28), E('#f3e7c4', 1.2)), X0 - 4 + i * 1.6, 2.7 - (i % 2) * .4, Z0 - 1);
        plight('#ffe0a0', 14, X0, 2.6, Z0 - 1.2); plight('#cfe0ff', 6, X0 + 1, 3, Z0 + 2);
      }
      // ── 길 위의 볼거리: 갈림길 이정표와 쉼터 의자(길이 휑하지 않게) ──
      { const post = (x, z, text, ry, color) => { add(new T.Mesh(new T.BoxGeometry(.2, 3.4, .2), M('#101a46')), x, 1.7, z); signAt(text, x, 3.0, z, ry, 4.4, color); };
        post(30, 6.4, '→ 별빛 역', -PI / 2, '#e8cf93'); post(-30, 6.4, '별무리 시장 ←', PI / 2, '#6fe0d0'); post(6.4, -30, '↑ 시계탑 거리', 0, '#f2c14e');
        post(98, -6.4, '별빛 역 · 분실물 보관소', -PI / 2, '#e8cf93'); post(-98, 6.4, '별무리 시장 · 온실 정원', PI / 2, '#6fe0d0');
        const bench = (x, z, ry) => { const g2 = new T.Group(); g2.position.set(x, 0, z); g2.rotation.y = ry; g.add(g2); [[0, .5, 0, 2.3, .14, .62, '#1d2a66'], [0, .95, -.3, 2.3, .55, .1, '#1d2a66'], [-1, .25, 0, .14, .5, .5, '#e8cf93'], [1, .25, 0, .14, .5, .5, '#e8cf93']].forEach(p => { const m = new T.Mesh(new T.BoxGeometry(p[3], p[4], p[5]), M(p[6])); m.position.set(p[0], p[1], p[2]); m.castShadow = true; g2.add(m); }); block(x, z, 1.2); };
        [[56, 6.0, PI], [-56, -6.0, 0], [6.0, -58, PI / 2], [-6.0, 58, -PI / 2], [76, -6, 0], [-76, 6, PI]].forEach(b => bench(b[0], b[1], b[2]));
        [[56, 7.4], [-56, -7.4], [6.0 + 1.4, -58], [76, -7.4], [-76, 7.4]].forEach(p => glow(p[0], 2.2, p[1], '#ffe0a0', 2.4)); }
      const inRoom = (x, z) => Object.keys(ROOMS).some(k => { const R = ROOMS[k]; return Math.abs(x - R.cx) <= R.hw - .6 && Math.abs(z - R.cz) <= R.hd - .5; });
      const roomOf = (x, z) => Object.keys(ROOMS).find(k => { const R = ROOMS[k]; return Math.abs(x - R.cx) <= R.hw + 1 && Math.abs(z - R.cz) <= R.hd + 1; });
      // 문과 안쪽 손잡이: world.js가 읽는다. to: 건너가서 서는 자리 [x, z, 보는 각도]
      const OC = ROOMS.office, SW = ROOMS.sweets, officeOut = doors.office ? [doors.office.x, doors.office.z + 0] : [0, 0], sweetsOut = doors.sweets ? [doors.sweets.x, doors.sweets.z] : [0, 0];
      const doorList = [
        { id: 'office', label: 'ARCHIVE 탐정 사무소', sub: '들어가 본다', x: doors.office.x, z: doors.office.z, r: 3.0, to: [OC.cx, OC.cz + OC.hd - 2.2, PI] },
        { id: 'office_out', label: '문 밖으로', out: true, x: OC.cx, z: OC.cz + OC.hd - 1.1, r: 2.2, to: [doors.office.x * .93, doors.office.z * .93, Math.atan2(doors.office.x, doors.office.z) + PI] },
        { id: 'office_note', label: '사건 게시판', act: 'note', x: OC.cx + OC.hw - 1.6, z: OC.cz - 1.2, r: 2.6 },
        { id: 'office_map', label: '열차 지도 탁자', act: 'map', x: OC.cx + 2.2, z: OC.cz + 2.2, r: 2.6 },
        { id: 'sweets', label: '별사탕 가게', sub: '들어가 본다', x: doors.sweets.x, z: doors.sweets.z, r: 3.0, to: [SW.cx, SW.cz + SW.hd - 2.2, PI] },
        { id: 'sweets_out', label: '문 밖으로', out: true, x: SW.cx, z: SW.cz + SW.hd - 1.1, r: 2.2, to: [doors.sweets.x * .93, doors.sweets.z * .93, Math.atan2(doors.sweets.x, doors.sweets.z) + PI] }
      ];
      // ── 걸을 수 있는 곳, 구역 ──
      const open = { N: false, E: false, W: false, S: true }, ZC = { E: [90, 0], W: [-90, 0], N: [0, -90] };
      const lim = k => open[k] ? ROAD_END - 3 : 36;
      const inRoad = (x, z, m) => (Math.abs(z) <= ROAD_HALF + m && x <= lim('E') && x >= -lim('W')) || (Math.abs(x) <= ROAD_HALF + m && z <= lim('S') && z >= -lim('N'));
      const inZone = (x, z) => Object.keys(ZC).some(k => open[k] && Math.hypot(x - ZC[k][0], z - ZC[k][1]) <= 25);
      const walk = (x, z) => Math.hypot(x, z) <= R_RING - 2.4 || inRoad(x, z, 0) || inZone(x, z) || inRoom(x, z);
      const setOpen = o => { Object.keys(o).forEach(k => { if (!(k in open)) return; open[k] = !!o[k]; const cl = closed[k]; if (cl) { cl.group.visible = !open[k]; cl.block.x = open[k] ? 99999 : cl.x; } }); };
      const zoneAt = (x, z) => z > 200 ? (roomOf(x, z) || null) : Math.hypot(x, z) < 30 ? 'plaza' : Math.hypot(x - 90, z) < 30 ? 'station' : Math.hypot(x + 90, z) < 30 ? 'market' : Math.hypot(x, z + 90) < 30 ? 'tower' : null;

      return data = {
        world: true, ry: 0, look: (x, z) => [x, z], look0: [0, 8], start: [[0, 9]],
        // 사건 1의 현장 조사 자리(멈춘 안내 시계 둘레)
        spots: { trail: { x: -6.1, z: -3.3, sx: -4.8, sz: -2.5 }, keeper: { x: -6.4, z: -10.2, sx: -6.4, sz: -8.9 }, jar: { x: -3.0, z: -10.2, sx: -3.0, sz: -8.9 } },
        battle: { cx: 2.5, cz: 8.5 },
        blocks: blocks, walk: walk, zoneAt: zoneAt, lights: lights, R_PLAZA: R_PLAZA, R_RING: R_RING, ROAD_END: ROAD_END, ROAD_HALF: ROAD_HALF, things: things, office: things.office,
        clock: { x: -10, z: -7, front: [-8.2, -5.7] },
        // 구역 이름표가 도시 어디쯤에 있는지(world.js)
        zonesHere: ['plaza', 'station', 'market', 'tower'], doors: doorList, setOpen: setOpen, zoneCenters: { plaza: [0, 0], station: [90, 0], market: [-90, 0], tower: [0, -90] }
      };
    },
    tick: function (dt) {
      if (!data) return; const th = data.things;
      th.mon.arm.rotation.y += dt * .35; th.mon.rings[0].rotation.x += dt * .5; th.mon.rings[1].rotation.z += dt * .7; th.mon.rings[2].rotation.y -= dt * .6;
      const k = th.clock; k.t += dt; k.spire.rotation.y += dt * 1.4; if (th.towerSpire) th.towerSpire.rotation.y -= dt * 1.1;
      if (k.run) { const m = 47 + k.t * 6; k.setTime(7, m); if (th.bigClock) th.bigClock.setTime(7, m); k.lamp.material.color.set('#ffd98a'); k.light.color.set('#ffe0a0'); }
      else { const f = .7 + Math.sin(k.t * 2.4) * .3; k.lamp.material.opacity = .85 * f; }
    }
  });
})();
