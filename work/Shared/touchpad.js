/* 휴대폰·태블릿용 화면 조작 패드. 키보드로만 움직이는 작품(우회선, 도시의 몬스터와 탐정 사무소 C안 등)에서
   화면 위 단추가 키보드 이벤트를 대신 보낸다. 터치 기기에서만 나타나고, 컴퓨터에서는 아무것도 보이지 않는다.
   쓰는 법: 작품 index.html 끝에 <script>window.TouchPadConfig={...}</script><script src="../Shared/touchpad.js"></script>
   TouchPadConfig = { move: 'wasd'|'arrows'|null, buttons: [{label, code, key, hold}], hint: '문구' }
   확인용: 주소 끝에 ?pad=1 을 붙이면 컴퓨터에서도 보인다. */
(() => {
  const cfg = window.TouchPadConfig || {};
  const force = /[?&]pad=1/.test(location.search);
  const coarse = matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  if (!coarse && !force) return;
  const KEYS = {
    wasd: [['▲', 'KeyW', 'w', 'up'], ['◀', 'KeyA', 'a', 'left'], ['▼', 'KeyS', 's', 'down'], ['▶', 'KeyD', 'd', 'right']],
    arrows: [['▲', 'ArrowUp', 'ArrowUp', 'up'], ['◀', 'ArrowLeft', 'ArrowLeft', 'left'], ['▼', 'ArrowDown', 'ArrowDown', 'down'], ['▶', 'ArrowRight', 'ArrowRight', 'right']]
  };
  const style = document.createElement('style');
  style.textContent = `
  .tp{position:fixed;left:0;right:0;bottom:0;z-index:2147483000;pointer-events:none;display:flex;justify-content:space-between;align-items:flex-end;
      padding:0 max(14px,env(safe-area-inset-right)) max(14px,env(safe-area-inset-bottom)) max(14px,env(safe-area-inset-left));font-family:Pretendard,system-ui,sans-serif}
  .tp *{touch-action:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent}
  .tp{--tp-cell:58px}
  .tp-move{display:grid;grid-template-columns:repeat(3,var(--tp-cell));grid-template-rows:repeat(3,var(--tp-cell));gap:6px;pointer-events:auto}
  .tp-move button{border-radius:14px}
  .tp-up{grid-column:2;grid-row:1}.tp-left{grid-column:1;grid-row:2}.tp-down{grid-column:2;grid-row:3}.tp-right{grid-column:3;grid-row:2}
  .tp-acts{display:flex;flex-wrap:wrap-reverse;justify-content:flex-end;gap:8px;max-width:210px;pointer-events:auto}
  .tp button{min-width:58px;min-height:58px;padding:0 12px;border:2px solid #ffffff8c;background:#0f1630bf;color:#fff;font:700 15px/1.15 inherit;border-radius:50px;
      backdrop-filter:blur(4px);box-shadow:0 3px 12px #0008}
  .tp button.on{background:#ffda35;color:#0c1535;border-color:#ffda35}
  .tp-hint{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(env(safe-area-inset-bottom) + 6px);z-index:2147482999;font:600 12px/1 Pretendard,system-ui,sans-serif;color:#ffffffb0;background:#0008;padding:5px 10px;border-radius:20px;pointer-events:none;white-space:nowrap}
  .tp-toggle{position:fixed;left:max(14px,env(safe-area-inset-left));transform:none;bottom:calc(max(14px,env(safe-area-inset-bottom)) + var(--tp-cell,58px)*3 + 20px);z-index:2147483001;pointer-events:auto;min-width:0!important;min-height:36px!important;padding:0 14px!important;font-size:13px!important;border-radius:20px!important;opacity:.85}
  .tp.tp-off .tp-move,.tp.tp-off .tp-acts{display:none}
  .tp.tp-off .tp-toggle{bottom:max(10px,env(safe-area-inset-bottom))}
  @media (max-height:480px){.tp{--tp-cell:46px}.tp-move{gap:4px}.tp button{min-width:46px;min-height:46px;font-size:13px}.tp-acts{max-width:190px;gap:6px}}
  @media (orientation:portrait){.tp{--tp-cell:52px}.tp button{min-width:52px;min-height:52px}}
  @media (hover:hover) and (pointer:fine){.tp:not(.tp-force){display:none}}`;
  document.head.appendChild(style);
  const root = document.createElement('div'); root.className = 'tp' + (force ? ' tp-force' : ''); root.setAttribute('role', 'group'); root.setAttribute('aria-label', '화면 조작 패드');
  const down = new Set();
  const send = (type, code, key) => { document.body.dispatchEvent(new KeyboardEvent(type, {code, key, bubbles: true, cancelable: true})); };   // body에서 올려 보내면 body·document·window 어디서 듣든 받는다
  const timers = new Map();
  const hold = (btn, code, key, toggle) => {
    const stopRepeat = () => { const t = timers.get(code); if (t) { clearTimeout(t.a); clearInterval(t.b); timers.delete(code); } };
    const press = e => {
      e.preventDefault(); if (toggle && down.has(code)) { release(e, true); return; } if (down.has(code)) return;
      down.add(code); btn.classList.add('on'); send('keydown', code, key); if (navigator.vibrate) navigator.vibrate(8);
      if (cfg.repeat && !toggle) { const t = {}; t.a = setTimeout(() => { t.b = setInterval(() => send('keydown', code, key), 110); }, 320); timers.set(code, t); }   // 꾹 누르면 글쇠 반복(걸음마다 키를 받는 작품용)
    };
    const release = (e, force) => { e.preventDefault(); if (toggle && !force) return; if (!down.has(code)) return; stopRepeat(); down.delete(code); btn.classList.remove('on'); send('keyup', code, key); };
    btn.addEventListener('pointerdown', e => { try { btn.setPointerCapture(e.pointerId); } catch (err) {} press(e); });
    if (!toggle) for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) btn.addEventListener(t, release);
    btn.addEventListener('contextmenu', e => e.preventDefault());
  };
  const tap = (btn, code, key) => {   // 한 번 누르면 눌렀다 떼는 단추(상호작용·메뉴 등)
    btn.addEventListener('pointerdown', e => { e.preventDefault(); btn.classList.add('on'); send('keydown', code, key); if (navigator.vibrate) navigator.vibrate(8); });
    const up = e => { e.preventDefault(); btn.classList.remove('on'); send('keyup', code, key); };
    for (const t of ['pointerup', 'pointercancel', 'pointerleave']) btn.addEventListener(t, up);
    btn.addEventListener('contextmenu', e => e.preventDefault());
  };
  if (cfg.move && KEYS[cfg.move]) {
    const pad = document.createElement('div'); pad.className = 'tp-move';
    for (const [label, code, key, cls] of KEYS[cfg.move]) { const b = document.createElement('button'); b.type = 'button'; b.className = 'tp-' + cls; b.textContent = label; b.setAttribute('aria-label', '이동 ' + label); hold(b, code, key, false); pad.appendChild(b); }
    root.appendChild(pad);
  } else root.appendChild(document.createElement('span'));
  const acts = document.createElement('div'); acts.className = 'tp-acts';
  for (const a of cfg.buttons || []) { const b = document.createElement('button'); b.type = 'button'; b.textContent = a.label; b.setAttribute('aria-label', a.label); if (a.hold) hold(b, a.code, a.key || a.code, !!a.toggle); else tap(b, a.code, a.key || a.code); acts.appendChild(b); }
  root.appendChild(acts);
  const tog = document.createElement('button'); tog.type = 'button'; tog.className = 'tp-toggle';
  const setOff = off => { root.classList.toggle('tp-off', off); tog.textContent = off ? '🎮 조작 패드 펴기' : '조작 패드 접기'; tog.setAttribute('aria-pressed', String(!off)); try { sessionStorage.setItem('tp-off', off ? '1' : '0'); } catch (e) {} };
  tog.addEventListener('click', () => setOff(!root.classList.contains('tp-off')));
  root.appendChild(tog);
  let saved = null; try { saved = sessionStorage.getItem('tp-off'); } catch (e) {}
  document.body.appendChild(root); setOff(saved === null ? !!cfg.collapsed : saved === '1');
  let hinted = false;
  const showHint = () => { if (hinted || !cfg.hint) return; hinted = true; const h = document.createElement('div'); h.className = 'tp-hint'; h.textContent = cfg.hint; document.body.appendChild(h); setTimeout(() => h.remove(), 9000); };
  if (typeof cfg.when !== 'function') showHint();   // 조건이 있으면 패드가 처음 나타날 때 안내를 띄운다
  if (typeof cfg.when === 'function') {   // 작품이 '움직일 수 있는 화면'일 때만 패드를 보인다(전투·대화 화면의 단추를 가리지 않게)
    const tick = () => { let ok = true; try { ok = !!cfg.when(); } catch (e) {} root.style.display = ok ? '' : 'none'; if (ok) showHint();
      if (ok && typeof cfg.actsWhen === 'function') { let a = true; try { a = !!cfg.actsWhen(); } catch (e) {} acts.style.display = a ? '' : 'none'; }
      if (!ok) { for (const [c, t] of timers) { clearTimeout(t.a); clearInterval(t.b); } timers.clear(); for (const c of [...down]) { send('keyup', c, c); down.delete(c); } root.querySelectorAll('.on').forEach(b => b.classList.remove('on')); } };
    setInterval(tick, 250); tick();
  }
  window.addEventListener('blur', () => { for (const [c, t] of timers) { clearTimeout(t.a); clearInterval(t.b); } timers.clear(); for (const c of [...down]) { send('keyup', c, c); down.delete(c); } root.querySelectorAll('.on').forEach(b => b.classList.remove('on')); });
})();
