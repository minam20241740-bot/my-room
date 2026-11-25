'use strict';
/* 화면 흐름(C안): 시작 → 로딩 → (처음이면 소개) → 해솔항 월드(걸어 다니며 의뢰·단서·훈련). 옛 사무소 화면(lobby, cases)은 쓰지 않는다
   화면은 1920×1080 기준으로 만들고 창 크기에 맞춰 줄인다. */
(function () {
  const G = window.GAME, $ = id => document.getElementById(id);
  const stage = $('stage');
  function el(tag, cls, parent, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; if (parent) parent.appendChild(e); return e; }

  // ── 저장 ──
  const KEY = 'archiveC.save.v1';
  const DEF = { lead: 'arthur', speed: 1, cleared: [], seen: {}, notes: {}, tut: 0, party: [], friends: [], world: null, sfx: 2, bgm: 2, fx: 0 };
  let save = Object.assign({}, DEF);
  try { Object.assign(save, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) {}
  function store() { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) {} }

  // ── 소리 (js/sound.js). 파일이 없어도 게임은 그대로 돈다 ──
  const snd = n => { if (window.Snd) window.Snd.play(n); }, music = n => { if (window.Snd) window.Snd.music(n); };
  if (window.Snd) window.Snd.init(save.sfx, save.bgm);

  // ── 창 크기에 맞추기 ──
  function fit() { stage.style.transform = 'scale(' + Math.min(innerWidth / 1920, innerHeight / 1080) + ')'; }
  addEventListener('resize', fit); fit();

  // 남색 밤 막: 사무소에서는 달빛(해결한 사건 수)이 늘수록 옅어지고, 그 밖의 화면에서는 일정하다
  const tintEl = $('tint');
  function tintFor(id) { tintEl.style.opacity = id === 'title' ? '0' : '.6'; }

  // ── 화면 바꾸기 ──
  let cur = null;
  function show(id) {
    if (cur === 'field' && id !== 'field' && window.Field) window.Field.leave();
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === id));
    cur = id; tintFor(id);
    if (id !== 'field') music(id === 'end' ? null : 'office');   // 현장의 음악은 field.js가 고른다
  }
  let toastT = 0;
  function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 1600); }

  // ── 팝업 ──
  const pop = $('pop');
  let popEsc = null, popTrigger = null;
  function openPop(o) {   // o: {title, sub, body(html 또는 함수), w, buttons:[[글자, 함수, 노랑?]], esc}
    if (!pop.classList.contains('on')) popTrigger = document.activeElement;
    pop.innerHTML = ''; pop.classList.add('on'); snd('open');
    const w = el('div', 'win', pop); w.style.width = (o.w || 900) + 'px';
    w.setAttribute('role', 'dialog');
    w.setAttribute('aria-modal', 'true');
    w.setAttribute('aria-labelledby', 'popup-title');
    el('h2', '', w, (o.sub ? '<small>' + o.sub + '</small>' : '') + o.title).id = 'popup-title';
    const b = el('div', 'body', w); if (typeof o.body === 'function') o.body(b); else b.innerHTML = o.body || '';
    if (o.title === '친구 도감' || o.title === '도감') {
      window.MongeulJournal.mount(b, 'c', () => openPop(o));
    }
    const f = el('div', 'foot', w);
    (o.buttons || [['닫기', null]]).forEach(x => { const bt = el('button', x[2] ? 'y' : '', f, '<span>' + x[0] + '</span>'); bt.onclick = () => { closePop(); if (x[1]) x[1](); }; });
    popEsc = o.esc || null;
    const initial = o.focusFirst ? f.firstElementChild : f.lastElementChild;
    if (initial) initial.focus({ preventScroll: true });
  }
  function closePop() {
    pop.classList.remove('on');
    pop.innerHTML = '';
    if (popTrigger?.isConnected) popTrigger.focus({ preventScroll: true });
    popTrigger = null;
  }
  pop.addEventListener('click', e => { if (e.target === pop) { const f = popEsc; closePop(); if (f) f(); } });

  // ── 시작 화면 ──
  const title = $('title');
  // 시작 화면(C안 표지): 배경 그림 위에 로고, 비스듬한 단추, 인물 둘, 기울어진 만화 칸 둘. 자리는 표지 검토본(20261112_ABC_시작화면_로고와배경_Claude검토본)의 배치를 따른다
  el('img', 'cbg', title).src = 'img/c_bg.jpg'; el('div', 'cshade', title);
  [['arthur', 706, 650, 1052], ['eri', 1216, 632, 1052]].forEach(s => { const im = el('img', 'csil', title); im.src = 'img/c_' + s[0] + '.png'; im.alt = ''; im.style.cssText = 'left:' + s[1] + 'px;height:' + s[2] + 'px;top:' + (s[3] - s[2]) + 'px'; });
  const lg = el('img', 'clogo', title); lg.src = 'img/c_logo.png'; lg.alt = G.title; lg.style.cssText = 'width:660px;left:626px;top:74px';
  [['아서', 606, 520], ['에리', 1318, 512]].forEach(n => { const d = el('div', 'cnm', title, '<span>' + n[0] + '</span>'); d.style.cssText = 'left:' + n[1] + 'px;top:' + n[2] + 'px'; });
  [[418, 664, [1, 2]], [1500, 673, [3, 4]]].forEach(h => { const d = el('div', 'chr2', title, '<span class="slots">' + h[2].map(k => '<i style="background-image:url(img/c_h' + k + '.png)"></i>').join('') + '</span><span class="t">히로인 캐릭터들</span>'); d.style.cssText = 'left:' + h[0] + 'px;top:' + h[1] + 'px'; });
  const tBtns = [[save.world && save.world.started ? '이어하기' : '게임 시작', startGame], ['설정', openSettings], ['게임 종료', askQuit]].map((b, i) => {
    const d = el('button', 'cbtn', title, '<span>' + b[0] + '</span>'); d.style.cssText = 'left:' + [972, 960, 948][i] + 'px;top:' + [640, 770, 900][i] + 'px';
    d.onclick = b[1];
    d.onfocus = () => pick(i);
    d.onmouseenter = () => {
      if (!tBtns.includes(document.activeElement) || !document.activeElement.matches(':focus-visible')) pick(i);
    };
    return d;
  });
  let tSel = 0;
  function pick(i) { tSel = (i + 3) % 3; tBtns.forEach((b, k) => b.classList.toggle('sel', k === tSel)); }
  pick(0);

  function askQuit() {
    openPop({ title: '게임 종료', body: '<p>게임을 종료할까요?</p>', w: 760, buttons: [['취소', null], ['종료', () => show('end'), 1]] });
  }

  // ── 로딩 ──
  const loading = $('loading');
  const ll = el('img', 'logo', loading); ll.src = 'img/c_logo.png'; ll.alt = '';
  const tip = el('div', 'tip', loading, '<div><b>후루의 안내</b><p></p></div>');
  const bar = el('div', 'bar', loading, '<i></i>').firstChild, go = el('div', 'go', loading);
  let loadDone = null;
  function startGame() {
    show('loading'); tip.querySelector('p').textContent = G.tips[(Math.random() * G.tips.length) | 0];
    go.textContent = '해솔항으로 가는 중'; go.classList.remove('blink'); bar.style.width = '0'; loadDone = null; loading.classList.remove('hold');
    // 도시 자료는 이 로딩 화면에서 한 번에 읽는다(누른 뒤에 로딩이 또 뜨지 않게)
    window.World.prepare(p => { bar.style.width = Math.round(p * 100) + '%'; }).then(() => {
      bar.style.width = '100%'; go.textContent = '화면을 눌러 시작'; go.classList.add('blink'); loadDone = afterLoad;
    }, e => { console.error(e); show('title'); toast('도시 자료를 읽지 못했습니다'); });
  }
  function loadFor(label, work) {   // 현장 자료를 읽는 동안 같은 로딩 화면을 쓴다
    show('loading'); tip.querySelector('p').textContent = G.tips[0]; go.textContent = label; go.classList.remove('blink'); bar.style.width = '0'; loadDone = null;
    return work(p => { bar.style.width = Math.round(p * 100) + '%'; });
  }
  // 처음이면 소개(솔 탐정의 말 → 인물 → 사건을 푸는 순서)를 보여 주고, 로비에서 후루가 누를 곳을 알려 준다
  function afterLoad() {
    loading.classList.add('hold');   // 이야기 상자 뒤로 로딩 안내가 비치지 않게 숨긴다
    if (!save.seen.opening) playOpening(() => { save.seen.opening = 1; store(); window.World.begin(); }); else window.World.begin();
  }
  function playOpening(done) {
    const O = G.opening, end = () => { skipAll = null; if (done) done(); }, next2 = () => playStory(O.last, end);
    const steps = () => openPop({ title: O.stepsTitle, w: 1680, body: b => { const r = el('div', 'steps', b); O.steps.forEach((x, i) => el('div', 'stp', r, '<i>' + (i + 1) + '</i><b>' + x[0] + '</b><span>' + x[1] + '</span>')); }, buttons: [['시작', next2, 1]], esc: next2 });
    const who = () => openPop({ title: O.whoTitle, w: 1500, body: b => {
      const r = el('div', 'whos', b);
      O.who.forEach(p => { const h = p.id === 'huru'; el('div', 'who' + (h ? ' sm' : ''), r, '<div class="wpic" style="background-image:url(' + (h ? 'img/huru.png' : G.leads[p.id].img) + ')"></div><div class="wtx"><small>' + p.role + '</small><b>' + (h ? G.names.huru : G.leads[p.id].name) + '</b><p>' + p.text + '</p><em>“' + p.line + '”</em></div>'); });
    }, buttons: [['다음', steps, 1]], esc: steps });
    // 서막: 어두운 밤하늘 위에 달빛 마을 이야기를 먼저 들려 준다
    card('<div class="moon"></div><h1>해솔항 이야기</h1>', 'night');
    skipAll = () => { closeCard(); closePop(); end(); };   // 건너뛰기 한 번으로 월드까지 간다(안내는 월드에서 후루가 다시 해 준다)
    playStory(O.prologue, () => { closeCard(); playStory(O.lines, who); });
  }

  // ── 서막·장 카드·결말 화면 (#card) ──
  const cardEl = $('card'); let cardDone = null, cardAt = 0;
  function card(html, cls, done, auto) {
    cardEl.className = 'layer on ' + (cls || ''); cardEl.innerHTML = html; cardDone = done || null; cardAt = Date.now();
    if (auto && !document.documentElement.classList.contains('noanim')) setTimeout(() => { if (cardDone && cardDone === done && cardEl.classList.contains('on')) closeCard(); }, auto);
  }
  function closeCard() { cardEl.classList.remove('on'); cardEl.innerHTML = ''; const f = cardDone; cardDone = null; if (f) f(); }
  cardEl.onclick = () => { if (Date.now() - cardAt > 700 && cardEl.querySelector('em')) closeCard(); };
  const moons = n => '<span class="moons">' + [0, 1, 2, 3].map(i => '<i class="' + (i < n ? 'on' : '') + '"></i>').join('') + '</span>';
  function epilogue(done) {   // 마지막 사건을 풀고 난 뒤
    const E = G.epilogue; snd('bell');
    const fr = ['arthur', 'eri'].map(k => 'img/face_' + k + '.png').concat(E.friends.map(k => G.friends[k].img));
    card('<div class="epi"><div class="moon full"></div><h1>' + E.title + '</h1><p>' + E.line + '</p>' + moons(4) + '<div class="fr">' + fr.map(u => '<i style="background-image:url(' + u + ')"></i>').join('') + '</div>'
      + '<div style="position:absolute;left:0;right:0;top:938px;display:flex;gap:28px;justify-content:center">'
      + '<button type="button" style="' + EPI_BTN + 'background:#dfff1a;color:#05070d;border:3px solid #dfff1a">도시로 돌아가기</button>'
      + '<button type="button" data-restart style="' + EPI_BTN + 'background:rgba(255,255,255,.08);color:#ffffff;border:3px solid rgba(255,255,255,.55)">처음부터 다시</button></div>'
      + '<em style="top:1026px;font-size:24px">아무 곳이나 눌러도 도시로 돌아갑니다</em></div>', 'night', done || (() => {}), 0);
    cardEl.querySelector('[data-restart]').onclick = e => { e.stopPropagation(); restartAll(); };
  }
  const EPI_BTN = 'font-family:inherit;font-size:30px;font-weight:800;line-height:1;padding:20px 46px;border-radius:14px;cursor:pointer;';
  /* 처음부터 다시: 의뢰 기록을 지우고 처음 화면으로 돌아간다(소리·글자 설정은 남긴다). 도시를 먼저 멈춰, 창이 닫힐 때 옛 위치가 다시 저장되지 않게 한다 */
  function resetAndReload() {
    const keep = {};
    ['speed', 'sfx', 'bgm', 'fx'].forEach(k => { if (k in DEF) keep[k] = save[k]; });
    if (window.World && window.World.suspend) window.World.suspend();
    save = Object.assign({}, DEF, { cleared: [], seen: {}, notes: {}, party: [], friends: [], world: null }, keep);
    store();
    location.reload();
  }
  /* 실수로 지우지 않게 한 번 묻는다. back은 취소했을 때 돌아갈 화면 */
  function restartAll(back) {
    const cancel = () => { const a = document.activeElement; if (a && a.blur) a.blur(); if (typeof back === 'function') back(); };
    openPop({ title: '처음부터 다시', w: 860, focusFirst: true, body: '<p>의뢰 기록과 친구, 반짝 조각을 모두 지우고 처음 화면으로 돌아갑니다.</p><p>지우면 되돌릴 수 없습니다.</p>',
      buttons: [['취소', cancel], ['처음부터 다시', resetAndReload, 1]], esc: cancel });
  }
  // 후루의 안내: 화면을 어둡게 하고 한 곳씩 밝혀 알려 준다. steps: [밝힐 곳, 말, 말풍선 자리]
  function guide(box, steps, done) {
    let i = 0; const dim = el('div', 'tdim', box), say = el('div', 'tsay', box, '<i class="fc" style="background-image:url(img/face_huru.png)"></i><div><b>' + G.names.huru + '</b><p></p><em>눌러서 넘기기</em></div>');
    const step = () => {
      box.querySelectorAll('.spot').forEach(e => e.classList.remove('spot'));
      if (i >= steps.length) { dim.remove(); say.remove(); if (done) done(); return; }
      const st = steps[i++], t = st[0] && box.querySelector(st[0]); if (t) t.classList.add('spot');
      say.querySelector('p').textContent = st[1]; say.style.cssText = st[2] || 'left:530px;top:420px'; say.querySelector('em').textContent = i < steps.length ? '눌러서 넘기기 (' + i + '/' + steps.length + ')' : '눌러서 닫기';
    };
    dim.onclick = say.onclick = step; step();
  }

  loading.onclick = () => { if (loadDone) { const f = loadDone; loadDone = null; f(); } };

  function enterLobby() { if (window.World) window.World.resume(); }   // 옛 사무소 화면 대신 도시로 돌아간다

  // ── 이야기 (한 줄씩, 글자가 차례로 나온다) ──
  const story = $('story');
  const sbox = el('div', 'sbox', story, '<div class="sname"><span></span></div><div class="stext"></div><i class="snext"></i>');
  const sskip = el('button', 'sskip', story, '건너뛰기');
  let sLines = [], sIdx = 0, sT = 0, sFull = '', sDone = null, sTyping = false;
  function playStory(lines, done) { sLines = lines; sIdx = 0; sDone = done; story.classList.add('on'); stage.classList.add('telling'); line(); }
  function line() {
    const l = sLines[sIdx], nm = l.who === 'lead' ? G.leads[save.lead].name : (G.names[l.who] || '');
    const n = sbox.querySelector('.sname'); n.style.display = nm ? '' : 'none'; n.firstChild.textContent = nm;
    sFull = l.text; const tx = sbox.querySelector('.stext'); tx.textContent = ''; sbox.querySelector('.snext').style.display = 'none';
    let i = 0; sTyping = true; clearInterval(sT);
    sT = setInterval(() => { i++; tx.textContent = sFull.slice(0, i); if (i % 3 === 1) snd('blip'); if (i >= sFull.length) endType(); }, [70, 38, 14][save.speed]);
    if (document.documentElement.classList.contains('noanim')) endType();   // 화면 확인용 주소에서는 글을 한 번에 보인다
  }
  function endType() { clearInterval(sT); sTyping = false; sbox.querySelector('.stext').textContent = sFull; sbox.querySelector('.snext').style.display = ''; }
  function endStory() { clearInterval(sT); story.classList.remove('on'); stage.classList.remove('telling'); const f = sDone; sDone = null; if (f) f(); }
  function advance() { if (sTyping) { endType(); return; } snd('next'); sIdx++; if (sIdx >= sLines.length) endStory(); else line(); }
  story.onclick = e => { if (e.target === sskip) return; advance(); };
  let skipAll = null;
  sskip.onclick = () => { if (skipAll) { const f = skipAll; skipAll = null; clearInterval(sT); story.classList.remove('on'); stage.classList.remove('telling'); sDone = null; f(); } else endStory(); };

  // ── 설정, 메뉴 ──
  function settingsGroup(parent, title) {
    const section = el('section', 'settings-section', parent);
    el('h3', '', section, title);
    return el('div', 'rows', section);
  }

  function selectSetting(options, value) {
    options.forEach(([button, option]) => {
      const selected = option === value;
      button.classList.toggle('on', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
  }

  function settingChoices(parent, label, items, read, write) {
    el('b', '', parent, label);
    const row = el('div', 'seg', parent);
    row.setAttribute('role', 'group');
    row.setAttribute('aria-label', label);
    const options = items.map(([text, value]) => {
      const button = el('button', '', row, text);
      button.onclick = async () => {
        await write(value);
        selectSetting(options, read());
      };
      return [button, value];
    });
    selectSetting(options, read());
    return options;
  }

  // 브라우저에서 Esc로 전체 화면을 나와도 열린 설정에 실제 상태를 표시한다.
  document.addEventListener('fullscreenchange', () => {
    const options = [...pop.querySelectorAll('[data-display-mode]')].map(button =>
      [button, button.dataset.displayMode === 'fullscreen']);
    selectSetting(options, !!document.fullscreenElement);
  });

  function openSettings() {
    openPop({
      title: '설정', w: 1000,
      body: b => {
        b.classList.add('settings');
        b.parentElement.classList.add('settings-dialog');
        const display = settingsGroup(b, '화면과 글자');
        settingChoices(display, '글자 속도', [['느리게', 0], ['보통', 1], ['빠르게', 2]],
          () => save.speed, value => { save.speed = value; store(); });
        const displayModes = settingChoices(display, '화면 모드', [['창', false], ['전체 화면', true]],
          () => !!document.fullscreenElement, async value => {
            try {
              if (value && !document.fullscreenElement) await document.documentElement.requestFullscreen();
              if (!value && document.fullscreenElement) await document.exitFullscreen();
            } catch (_) {
              toast('전체 화면으로 바꾸지 못했습니다');
            }
          });
        displayModes.forEach(([button, full]) => { button.dataset.displayMode = full ? 'fullscreen' : 'window'; });
        settingChoices(display, '효과', [['보통', 0], ['줄이기', 1]], () => save.fx | 0, value => {
          save.fx = value;
          store();
          if (window.FX) window.FX.low = value === 1;
          if (window.Stage3D && window.Stage3D.shadows) window.Stage3D.shadows(value !== 1);
        });
        const audio = settingsGroup(b, '소리');
        const levels = [['끔', 0], ['작게', 1], ['보통', 2], ['크게', 3]];
        [['효과음', 'sfx'], ['음악', 'bgm']].forEach(([label, key]) =>
          settingChoices(audio, label, levels, () => save[key], value => {
            save[key] = value;
            store();
            if (window.Snd) window.Snd.set(key, value);
            snd('found');
          }));
        const record = settingsGroup(b, '저장 기록');
        record.classList.add('reset-row');
        const s3 = el('div', 'seg', record);
        el('button', '', s3, '처음부터 다시').onclick = () => openPop({ title: '저장 기록 초기화', w: 820, focusFirst: true, body: '<p>의뢰 기록, 친구, 반짝 조각과 설정을 모두 지웁니다.</p><p>지우면 되돌릴 수 없습니다.</p>',
          buttons: [['취소', openSettings], ['초기화', () => {
            window.World?.suspend();
            show('title');
            save = Object.assign({}, DEF, { cleared: [], seen: {}, notes: {}, party: [], friends: [], world: null });
            store();
            if (window.Snd) window.Snd.init(save.sfx, save.bgm);
            tBtns[0].querySelector('span').textContent = '게임 시작';
            tBtns[0].focus();
            toast('저장 기록을 지웠습니다');
          }, 1]] });
      },
      buttons: [['닫기', null, 1]]
    });
  }
  // ── 끝 화면 ──
  const end = $('end'); end.innerHTML = '게임을 종료했습니다.<br>이 창을 닫아 주세요.<br>'; el('button', '', end, '처음 화면으로').onclick = () => show('title');

  // ── 자판 ──
  addEventListener('keydown', e => {
    if (pop.classList.contains('on')) {
      if (e.key === 'Escape') { const f = popEsc; closePop(); if (f) f(); }
      if (e.key === 'Tab') {
        const controls = pop.querySelectorAll('button:not(:disabled)');
        const first = controls[0], last = controls[controls.length - 1];
        if (first && (e.shiftKey ? document.activeElement === first : document.activeElement === last)) {
          e.preventDefault();
          (e.shiftKey ? last : first).focus({ preventScroll: true });
        }
      }
      return;
    }
    if (story.classList.contains('on')) { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); advance(); } return; }
    /* 결말 카드는 Enter·Space로도 닫는다(카드 안 단추에 초점이 있으면 그 단추가 눌린다) */
    if (cardEl.classList.contains('on')) {
      const onButton = document.activeElement && document.activeElement.closest && document.activeElement.closest('#card button');
      if ((e.key === 'Enter' || e.key === ' ') && !onButton) { e.preventDefault(); cardEl.click(); }
      return;
    }
    if (cur === 'field' && window.World && window.World.active()) { window.World.key(e); return; }
    if (cur === 'field' || cur === 'team' || cur === 'deduce') { if (window.Field) window.Field.key(e); return; }
    if (cur === 'title') {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        pick(tSel + (e.key === 'ArrowDown' ? 1 : -1));
        tBtns[tSel].focus({ preventScroll: true });
      } else if ((e.key === 'Enter' || e.key === ' ') && !tBtns.includes(document.activeElement)) {
        e.preventDefault();
        tBtns[tSel].focus({ preventScroll: true });
        tBtns[tSel].click();
      }
    } else if (cur === 'loading') { if (e.key === 'Enter' || e.key === ' ') loading.click(); }

  });

  const fromCase = Number(new URLSearchParams(location.search).get('case') || 0);
  if (fromCase > 1) save.seen.opening = 1;

  window.GB = { snd: snd, music: music, guide: guide, epilogue: epilogue, restartAll: restartAll, G: G, el: el, stage: stage, show: show, toast: toast, openPop: openPop, closePop: closePop, playStory: playStory, enterLobby: enterLobby, openSettings: openSettings, loadFor: loadFor, store: store, get save() { return save; }, get cur() { return cur; } };
  show('title');
  // 화면 확인용: 주소 끝에 ?go=loading, prologue, epilogue, settings (월드는 world.js의 ?go=world)
  const goTo = new URLSearchParams(location.search).get('go');
  if (goTo) {
    document.documentElement.classList.add('noanim');   // 확인용 주소에서는 움직임과 자동 닫힘을 끈다
    if (goTo === 'loading') startGame();
    if (goTo === 'settings') openSettings();
    if (goTo === 'prologue') playOpening(null);
    if (goTo === 'epilogue') epilogue(null);
  }
})();

// stage-scroll-lock: 팝업 버튼에 초점을 줄 때 무대가 밀리지 않게 한다
;(function () {
  var stage = document.getElementById('stage'); if (!stage) return;
  var reset = function () { if (stage.scrollTop || stage.scrollLeft) { stage.scrollTop = 0; stage.scrollLeft = 0; } };
  stage.addEventListener('scroll', reset); reset();
  var focus = HTMLElement.prototype.focus;
  HTMLElement.prototype.focus = function (o) { return focus.call(this, Object.assign({ preventScroll: true }, o || {})); };
})();
