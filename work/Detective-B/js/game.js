'use strict';
/* 화면 흐름: 시작 → 로딩 → 로비(솔 탐정 사무소) → 의뢰서 → 사건 이야기
   화면은 1920×1080 기준으로 만들고 창 크기에 맞춰 줄인다. */
(function () {
  const G = window.GAME, $ = id => document.getElementById(id);
  const stage = $('stage');
  function el(tag, cls, parent, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; if (parent) parent.appendChild(e); return e; }

  // ── 저장 ──
  const KEY = 'archiveB.save.v1';
  const DEF = { lead: 'arthur', speed: 1, cleared: [], seen: {}, notes: {}, tut: 0, party: [], sfx: 2, bgm: 2 };
  let save = Object.assign({}, DEF);
  try { Object.assign(save, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) {}
  function store() { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) {} }

  // ── 소리 (js/sound.js). 파일이 없어도 게임은 그대로 돈다 ──
  const snd = n => { if (window.Snd) window.Snd.play(n); }, music = n => { if (window.Snd) window.Snd.music(n); };
  if (window.Snd) window.Snd.init(save.sfx, save.bgm);

  // ── 창 크기에 맞추기 ──
  function fit() { stage.style.transform = 'scale(' + Math.min(innerWidth / 1920, innerHeight / 1080) + ')'; }
  addEventListener('resize', fit); fit();

  // ── 배경 그리기 ──
  const sky = $('bgSky'), office = $('bgOffice'), skyPlain = document.createElement('canvas');
  skyPlain.width = 1920; skyPlain.height = 1080;
  sceneB(sky.getContext('2d', { willReadFrequently: true }));
  sceneB(skyPlain.getContext('2d', { willReadFrequently: true }), true);
  sceneOffice(office.getContext('2d', { willReadFrequently: true }), skyPlain);
  function bg(which) { sky.style.display = which === 'sky' ? 'block' : 'none'; office.style.display = which === 'office' ? 'block' : 'none'; }

  // ── 화면 바꾸기 ──
  let cur = null;
  function show(id) {
    if (cur === 'field' && id !== 'field' && window.Field) window.Field.leave();
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === id));
    cur = id; bg(id === 'lobby' ? 'office' : 'sky');
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
      window.MongeulJournal.mount(b, 'b', () => openPop(o));
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
  [['arthur', 330, 1240, 1420], ['eri', 1590, 1230, 1420]].forEach(s => { const im = el('img', 'sil', title); im.src = 'img/' + s[0] + '.png'; im.alt = ''; im.style.cssText = 'left:' + s[1] + 'px;height:' + s[2] + 'px;top:' + (s[3] - s[2]) + 'px'; });
  const lg = el('img', 'logo', title); lg.src = 'img/logo.svg'; lg.alt = G.title; lg.style.cssText = 'width:780px;left:560px;top:226px';
  const tBtns = [['게임 시작', 962, 676, startGame], ['설정', 956, 834, openSettings], ['게임 종료', 950, 980, askQuit]].map((b, i) => {
    const d = el('button', 'btn', title, '<span>' + b[0] + '</span>'); d.style.cssText = 'width:392px;height:100px;left:' + b[1] + 'px;top:' + b[2] + 'px';
    d.onclick = b[3];
    d.onfocus = () => pick(i);
    d.onmouseenter = () => {
      if (!tBtns.includes(document.activeElement) || !document.activeElement.matches(':focus-visible')) pick(i);
    };
    return d;
  });
  let tSel = 0;
  function pick(i) { tSel = (i + 3) % 3; tBtns.forEach((b, k) => b.classList.toggle('sel', k === tSel)); }
  pick(0);
  [['아서', 323, 713], ['에리', 1583, 722]].forEach(n => { const d = el('div', 'nm', title, n[0]); d.style.cssText = 'left:' + n[1] + 'px;top:' + n[2] + 'px'; });
  const hr = el('div', 'hr', title, '<span class="slots">' + [1, 2, 3, 4].map(k => '<i style="background-image:url(img/sub' + k + '.png)"></i>').join('') + '</span><span>서브 주연 캐릭터들</span>');
  hr.style.cssText = 'left:1484px;top:596px';

  function askQuit() {
    openPop({ title: '게임 종료', body: '<p>게임을 종료할까요?</p>', w: 760, buttons: [['취소', null], ['종료', () => show('end'), 1]] });
  }

  // ── 로딩 ──
  const loading = $('loading');
  const ll = el('img', 'logo', loading); ll.src = 'img/logo.svg'; ll.alt = '';
  const tip = el('div', 'tip', loading, '<div><b>후루의 안내</b><p></p></div>');
  const bar = el('div', 'bar', loading, '<i></i>').firstChild, go = el('div', 'go', loading);
  let loadDone = null;
  function startGame() {
    show('loading'); tip.querySelector('p').textContent = G.tips[(Math.random() * G.tips.length) | 0];
    go.textContent = '사무소로 가는 중'; go.classList.remove('blink'); bar.style.width = '0'; loadDone = null;
    let p = 0; const t = setInterval(() => {
      p = Math.min(100, p + 9 + Math.random() * 14); bar.style.width = p + '%';
      if (p >= 100) { clearInterval(t); go.textContent = '화면을 눌러 시작'; go.classList.add('blink'); loadDone = afterLoad; }
    }, 140);
  }
  function loadFor(label, work) {   // 현장 자료를 읽는 동안 같은 로딩 화면을 쓴다
    show('loading'); tip.querySelector('p').textContent = G.tips[0]; go.textContent = label; go.classList.remove('blink'); bar.style.width = '0'; loadDone = null;
    return work(p => { bar.style.width = Math.round(p * 100) + '%'; });
  }
  // 처음이면 소개(솔 탐정의 말 → 인물 → 사건을 푸는 순서)를 보여 주고, 로비에서 후루가 누를 곳을 알려 준다
  function afterLoad() { enterLobby(); if (!save.seen.opening) playOpening(() => { save.seen.opening = 1; store(); lobbyGuide(); }); else lobbyGuide(); }
  function lobbyGuide() { if (save.seen.g_lobby || !nextCase()) return; save.seen.g_lobby = 1; store(); guide(lobby, G.guide.lobby); }
  function playOpening(done) {
    const O = G.opening, next2 = () => playStory(O.last, done);
    const steps = () => openPop({ title: O.stepsTitle, w: 1680, body: b => { const r = el('div', 'steps', b); O.steps.forEach((x, i) => el('div', 'stp', r, '<i>' + (i + 1) + '</i><b>' + x[0] + '</b><span>' + x[1] + '</span>')); }, buttons: [['시작', next2, 1]], esc: next2 });
    const who = () => openPop({ title: O.whoTitle, w: 1500, body: b => {
      const r = el('div', 'whos', b);
      O.who.forEach(p => { const h = p.id === 'huru'; el('div', 'who' + (h ? ' sm' : ''), r, '<div class="wpic" style="background-image:url(' + (h ? 'img/huru.png' : G.leads[p.id].img) + ')"></div><div class="wtx"><small>' + p.role + '</small><b>' + (h ? G.names.huru : G.leads[p.id].name) + '</b><p>' + p.text + '</p><em>“' + p.line + '”</em></div>'); });
    }, buttons: [['다음', steps, 1]], esc: steps });
    // 서막: 어두운 밤하늘 위에 달빛 마을 이야기를 먼저 들려 준다
    card('<div class="moon"></div><h1>달빛 마을 이야기</h1>', 'night');
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
  function chapter(c, done) {   // 사건을 시작하기 전에 기·승·전·결 한 장
    const ch = c.chapter; snd('found');
    card('<div class="chap"><div class="mark">' + ch.mark + '</div><div class="ctx"><small>' + ch.name + ' · 의뢰 ' + String(c.no).padStart(2, '0') + '</small><b>' + c.title + '</b><p>' + ch.line + '</p>' + moons(save.cleared.length) + '<em>눌러서 시작</em></div></div>', 'chapter', done || (() => {}), 6000);
  }
  function epilogue(done) {   // 마지막 사건을 풀고 난 뒤
    const E = G.epilogue; snd('bell');
    const fr = ['arthur', 'eri'].map(k => 'img/face_' + k + '.png').concat(E.friends.map(k => G.friends[k].img));
    card('<div class="epi"><div class="moon full"></div><h1>' + E.title + '</h1><p>' + E.line + '</p>' + moons(4) + '<div class="fr">' + fr.map(u => '<i style="background-image:url(' + u + ')"></i>').join('') + '</div>'
      + '<div style="position:absolute;left:0;right:0;top:938px;display:flex;gap:28px;justify-content:center">'
      + '<button type="button" style="' + EPI_BTN + 'background:#ffe9a8;color:#101d42;border:3px solid #ffe9a8">사무소로 돌아가기</button>'
      + '<button type="button" data-restart style="' + EPI_BTN + 'background:rgba(255,255,255,.08);color:#ffffff;border:3px solid rgba(255,255,255,.55)">처음부터 다시</button></div>'
      + '<em style="top:1026px;font-size:24px">아무 곳이나 눌러도 사무소로 돌아갑니다</em></div>', 'night', done || (() => {}), 0);
    cardEl.querySelector('[data-restart]').onclick = e => { e.stopPropagation(); restartAll(); };
  }
  const EPI_BTN = 'font-family:inherit;font-size:30px;font-weight:800;line-height:1;padding:20px 46px;border-radius:14px;cursor:pointer;';
  /* 처음부터 다시: 사건 기록을 지우고 처음 화면으로 돌아간다(소리·글자 설정은 남긴다) */
  function resetAndReload() {
    const keep = {};
    ['speed', 'sfx', 'bgm'].forEach(k => { if (k in DEF) keep[k] = save[k]; });
    save = Object.assign({}, DEF, { cleared: [], seen: {}, notes: {}, party: [] }, keep);
    store();
    location.reload();
  }
  /* 실수로 지우지 않게 한 번 묻는다. back은 취소했을 때 돌아갈 화면 */
  function restartAll(back) {
    const cancel = () => { const a = document.activeElement; if (a && a.blur) a.blur(); if (typeof back === 'function') back(); };
    openPop({ title: '처음부터 다시', w: 860, focusFirst: true, body: '<p>사건 기록을 모두 지우고 처음 화면으로 돌아갑니다.</p><p>지우면 되돌릴 수 없습니다.</p>',
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

  // ── 로비 ──
  const lobby = $('lobby');
  const lead = el('img', 'lead', lobby); lead.alt = '';
  const plate = el('div', 'plate', lobby, '<div class="face"></div><div><small>견습 탐정</small><b></b></div>');
  const swap = el('button', 'swap', lobby);
  const prog = el('div', 'prog', lobby, '<b></b><span class="pips"></span>');
  const top = el('div', 'top', lobby);
  el('button', '', top, '<span>메뉴</span>').onclick = openMenu;
  el('button', '', top, '<span>설정</span>').onclick = openSettings;
  const say = el('div', 'say', lobby);
  const ICON = {
    waiting: '<rect x="8" y="14" width="48" height="34" rx="6" fill="#1a9df5"/><rect x="14" y="20" width="36" height="22" rx="3" fill="#fff"/><rect x="24" y="50" width="16" height="6" fill="#2d4663"/>',
    friends: '<circle cx="23" cy="24" r="11" fill="#1a9df5"/><circle cx="43" cy="26" r="9" fill="#7fd0ff"/><path d="M6 54c0-12 8-18 17-18s17 6 17 18z" fill="#1a9df5"/><path d="M34 54c1-9 5-14 11-14s12 5 12 14z" fill="#7fd0ff"/>',
    team: '<rect x="6" y="12" width="15" height="40" rx="4" fill="#1a9df5"/><rect x="24" y="12" width="15" height="40" rx="4" fill="#7fd0ff"/><rect x="42" y="12" width="15" height="40" rx="4" fill="#d6ecff" stroke="#1a9df5" stroke-width="2" stroke-dasharray="4 3"/>',
    book: '<path d="M8 12h20c3 0 4 2 4 4v38c0-3-2-4-4-4H8z" fill="#1a9df5"/><path d="M56 12H36c-3 0-4 2-4 4v38c0-3 2-4 4-4h20z" fill="#7fd0ff"/>',
    note: '<rect x="12" y="8" width="40" height="50" rx="5" fill="#2d4663"/><rect x="18" y="16" width="28" height="36" rx="2" fill="#fff"/><path d="M22 26h20M22 34h20M22 42h12" stroke="#1a9df5" stroke-width="3"/>'
  };
  const dock = el('div', 'dock', lobby);
  G.menus.forEach(m => {
    const button = el('button', '', dock, '<div><svg viewBox="0 0 64 64">' + ICON[m[0]] + '</svg>' + m[1] + '</div>');
    button.onclick = () => {
      if (m[0] === 'team' || m[0] === 'waiting') window.Field.openTeam(null);
      else if (m[0] === 'note') window.Field.openNote();
      else if (m[0] === 'book') openFriendBook(false);
      else if (m[0] === 'friends') openFriendBook(true);
      else toast(m[1] + '은(는) 준비 중입니다');
    };
  });
  const req = el('button', 'req', lobby); req.onclick = openRequest;
  let lineNo = 0;
  function speak() { const L = G.lobbyLines[save.lead]; say.textContent = L[lineNo++ % L.length]; say.style.animation = 'none'; void say.offsetWidth; say.style.animation = ''; }
  lead.onclick = speak;
  swap.onclick = () => { save.lead = save.lead === 'arthur' ? 'eri' : 'arthur'; store(); lineNo = 0; drawLobby(); };
  function nextCase() { return G.cases.find(c => save.cleared.indexOf(c.id) < 0) || null; }
  function drawLobby() {
    const L = G.leads[save.lead], other = G.leads[save.lead === 'arthur' ? 'eri' : 'arthur'];
    lead.src = L.img; lead.classList.remove('in'); void lead.offsetWidth; lead.classList.add('in');
    plate.querySelector('b').textContent = L.name;
    const f = plate.querySelector('.face'); f.style.backgroundImage = 'url(img/face_' + save.lead + '.png)'; f.style.backgroundSize = 'cover'; f.style.backgroundPosition = 'center';
    swap.textContent = other.name + '와 교대';
    const n = save.cleared.length, tot = G.caseTitles.length;
    prog.querySelector('b').textContent = '달빛 ' + n + ' / ' + tot;
    office.style.filter = 'brightness(' + (.52 + .48 * n / tot).toFixed(2) + ') saturate(' + (.7 + .3 * n / tot).toFixed(2) + ')';   // 달빛이 돌아올수록 사무소가 밝아진다
    prog.querySelector('.pips').innerHTML = G.caseTitles.map((t, i) => '<i class="' + (i < n ? 'done' : i === n ? 'now' : '') + '" title="' + t + '"></i>').join('');
    const c = nextCase();
    req.classList.toggle('new', !!c && !save.seen[c && c.id]);
    req.innerHTML = c ? '<div><small>의뢰 ' + String(c.no).padStart(2, '0') + '</small><b>' + c.title + '</b><em>눌러서 의뢰서 보기</em></div>'
      : '<div><small>의뢰</small><b>1부 끝</b><em>눌러서 다시 하기</em></div>';
    speak();
    window.MoriPost?.sync();
  }
  function enterLobby() { show('lobby'); lineNo = 0; drawLobby(); }

  function openRequest() {
    const c = nextCase();
    /* 1부를 끝낸 뒤에는 사무소에 남을지, 처음부터 다시 할지 고른다(이 창이 지우기 전 확인을 겸한다) */
    if (!c) {
      openPop({ title: '1부 끝', w: 900, focusFirst: true, body: '<p>달빛이 돌아왔습니다. 네 사건을 모두 해결했습니다.</p><p>처음부터 다시 하면 사건 기록이 지워지고 되돌릴 수 없습니다.</p>',
        buttons: [['사무소에 남기', null], ['처음부터 다시', resetAndReload, 1]] });
      return;
    }
    save.seen[c.id] = 1; store(); req.classList.remove('new');
    openPop({
      title: c.title, sub: '의뢰 ' + String(c.no).padStart(2, '0'), w: 1040,
      body: '<p class="quote">' + c.request + '</p><div class="rows"><b>목표</b><div>' + c.goal + '</div>' + (c.find ? '<b>찾을 것</b><div class="chips"><span>' + c.find + '</span></div>' : '<b>조사할 곳</b><div class="chips">' + (c.places || c.clues.map(x => x.label)).map(x => '<span>' + x + '</span>').join('') + '</div>') + '</div>',
      buttons: [['돌아가기', null], ['편성', () => toTeam(c), 1]]
    });
  }

  // 떠나기 전에 들을 말이 있는 사건은 처음 한 번 그 말을 듣고 편성으로 간다
  function toTeam(c) {
    const next = () => {
      if (!c.brief || save.seen['brief_' + c.id]) { window.Field.openTeam(c); return; }
      save.seen['brief_' + c.id] = 1; store(); playStory(c.brief, () => window.Field.openTeam(c));
    };
    if (c.chapter && !save.seen['chap_' + c.id]) { save.seen['chap_' + c.id] = 1; store(); chapter(c, next); } else next();
  }

  // ── 이야기 (한 줄씩, 글자가 차례로 나온다) ──
  const story = $('story');
  const sbox = el('div', 'sbox', story, '<div class="sname"><span></span></div><div class="stext"></div><i class="snext"></i>');
  const sskip = el('button', 'sskip', story, '건너뛰기');
  let sLines = [], sIdx = 0, sT = 0, sFull = '', sDone = null, sTyping = false;
  function playStory(lines, done) { sLines = lines; sIdx = 0; sDone = done; story.classList.add('on'); stage.classList.add('telling'); line(); }
  function line() {
    const l = sLines[sIdx], nm = l.who === 'lead' ? G.leads[save.lead].name : (G.names[l.who] || '');
    const n = sbox.querySelector('.sname'); n.style.display = nm ? '' : 'none'; n.firstChild.textContent = nm;
    stage.classList.toggle('profspeak', l.who === 'prof');   // 솔 탐정이 말할 때는 앞장선 탐정(아서) 그림을 그림자로 바꿔, 아서가 솔 탐정인 것처럼 보이지 않게 한다
    sFull = l.text; const tx = sbox.querySelector('.stext'); tx.textContent = ''; sbox.querySelector('.snext').style.display = 'none';
    let i = 0; sTyping = true; clearInterval(sT);
    sT = setInterval(() => { i++; tx.textContent = sFull.slice(0, i); if (i % 3 === 1) snd('blip'); if (i >= sFull.length) endType(); }, [70, 38, 14][save.speed]);
    if (document.documentElement.classList.contains('noanim')) endType();   // 화면 확인용 주소에서는 글을 한 번에 보인다
  }
  function endType() { clearInterval(sT); sTyping = false; sbox.querySelector('.stext').textContent = sFull; sbox.querySelector('.snext').style.display = ''; }
  function endStory() { clearInterval(sT); story.classList.remove('on'); stage.classList.remove('telling'); stage.classList.remove('profspeak'); const f = sDone; sDone = null; if (f) f(); }
  function advance() { if (sTyping) { endType(); return; } snd('next'); sIdx++; if (sIdx >= sLines.length) endStory(); else line(); }
  story.onclick = e => { if (e.target === sskip) return; advance(); };
  sskip.onclick = endStory;

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
        el('button', '', s3, '처음부터 다시').onclick = () => openPop({ title: '저장 기록 초기화', w: 820, focusFirst: true, body: '<p>사건 기록과 설정을 모두 지웁니다.</p><p>지우면 되돌릴 수 없습니다.</p>',
          buttons: [['취소', openSettings], ['초기화', () => {
            show('title');
            save = Object.assign({}, DEF, { cleared: [], seen: {}, notes: {}, party: [] });
            store();
            if (window.Snd) window.Snd.init(save.sfx, save.bgm);
            tBtns[0].focus();
            toast('저장 기록을 지웠습니다');
          }, 1]] });
      },
      buttons: [['닫기', null, 1]]
    });
  }
  function openMenu() {
    openPop({
      title: '메뉴', w: 860,
      body: b => { const g = el('div', 'grid2', b);
        [['설정', openSettings], ['저장 기록', () => toast('사건 기록 ' + save.cleared.length + ' / ' + G.caseTitles.length)], ['도감', () => openFriendBook(false)], ['친구', () => openFriendBook(true)], ['소개 다시 보기', () => playOpening(null)], ['처음 화면으로', () => show('title')]]
          .forEach(m => { el('button', '', g, m[0]).onclick = () => { closePop(); m[1](); }; }); },
      buttons: [['닫기', null]]
    });
  }

  // 사건 보상과 편성이 쓰는 같은 기록에서 친구·도감을 표시한다.
  function openFriendBook(onlyMet) {
    const all = Object.entries(G.friends).map(([key, friend]) => {
      const source = G.cases.find(c => c.helper === key);
      return { friend, source, met: source && save.cleared.includes(source.id) };
    });
    const met = all.filter(entry => entry.met);
    const entries = onlyMet ? met : all;
    openPop({
      title: onlyMet ? '친구' : '친구 도감', sub: '만난 친구 ' + met.length + ' / ' + all.length, w: 1500,
      body: body => {
        if (!entries.length) {
          el('p', '', body, '아직 만난 친구가 없습니다. 사건을 해결하면 친구가 대기실에 옵니다.');
          return;
        }
        const list = el('div', 'dexg', body);
        entries.forEach(({ friend, source, met }) => {
          const card = el('div', 'dexc' + (met ? '' : ' no'), list);
          el('i', '', card).style.backgroundImage = 'url(' + friend.img + ')';
          el('b', '', card, met ? friend.name : '???');
          el('em', '', card, met ? friend.tag : '미확인');
          el('p', '', card, met ? friend.desc : source ? source.title + ' 사건을 해결하면 만납니다.' : '아직 만나지 못했습니다.');
        });
      },
      buttons: [['닫기', null, 1]],
    });
  }

  // ── 끝 화면 ──
  const end = $('end'); end.innerHTML = '게임을 종료했습니다.<br>이 창을 닫아 주세요.<br>'; el('button', '', end, '처음 화면으로').onclick = () => show('title');

  // ── 자판 ──
  addEventListener('keydown', e => {
    if (pop.classList.contains('on')) {
      if (e.key === 'Escape') { const f = popEsc; closePop(); if (f) f(); }
      if (e.key === 'Tab') {
        const controls = [...pop.querySelectorAll('button:not(:disabled)')];
        const first = controls[0], last = controls.at(-1);
        if (first && (e.shiftKey ? document.activeElement === first : document.activeElement === last)) {
          e.preventDefault();
          (e.shiftKey ? last : first).focus({ preventScroll: true });
        }
      }
      return;
    }
    if (story.classList.contains('on')) { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); advance(); } return; }
    /* 장 카드·결말 카드는 Enter·Space로도 닫는다(카드 안 단추에 초점이 있으면 그 단추가 눌린다) */
    if (cardEl.classList.contains('on')) {
      const onButton = document.activeElement && document.activeElement.closest && document.activeElement.closest('#card button');
      if ((e.key === 'Enter' || e.key === ' ') && !onButton) { e.preventDefault(); cardEl.click(); }
      return;
    }
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
    else if (cur === 'lobby') {
      if (e.key === 'Escape') openMenu();
      else if (e.key === 'Enter' && !document.activeElement?.closest('#lobby button')) openRequest();
    }
  });

  // 주소 끝에 ?case=2 를 붙이면 앞 사건을 해결한 것으로 보고 그 사건부터 시작한다
  const fromCase = Number(new URLSearchParams(location.search).get('case') || 0);
  if (fromCase > 1) G.cases.slice(0, fromCase - 1).forEach(c => { if (save.cleared.indexOf(c.id) < 0) save.cleared.push(c.id); });

  if (fromCase > 1) save.seen.opening = 1;

  window.GB = { snd: snd, music: music, guide: guide, chapter: chapter, epilogue: epilogue, restartAll: restartAll, G: G, el: el, stage: stage, show: show, toast: toast, openPop: openPop, closePop: closePop, playStory: playStory, enterLobby: enterLobby, loadFor: loadFor, store: store, nextCase: nextCase, get save() { return save; }, get cur() { return cur; } };
  show('title');
  // 화면 확인용: 주소 끝에 ?go=lobby 처럼 붙이면 그 화면에서 시작한다 (lobby, eri, request, story, settings, menu, loading)
  const goTo = new URLSearchParams(location.search).get('go');
  if (goTo) {
    document.documentElement.classList.add('noanim');   // 확인용 주소에서는 움직임과 자동 닫힘을 끈다
    if (goTo === 'eri') save.lead = 'eri';
    if (goTo === 'loading') startGame(); else enterLobby();
    if (goTo === 'request') openRequest();
    if (goTo === 'story') playStory(G.cases[0].intro, null);
    if (goTo === 'settings') openSettings();
    if (goTo === 'menu') openMenu();
    if (goTo === 'who' || goTo === 'steps') { playOpening(null); sskip.click(); if (goTo === 'steps') pop.querySelector('.foot button').click(); }   // 처음 소개의 두 화면
    if (goTo === 'guide') guide(lobby, G.guide.lobby);
    if (goTo === 'prologue') playOpening(null);
    if (goTo === 'chapter') chapter(G.cases[(Number(new URLSearchParams(location.search).get('case')) || 1) - 1], null);
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
