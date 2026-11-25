'use strict';
/* 화면 흐름: 시작 → 로딩 → 로비(솔 탐정 사무소) → 의뢰서 → 사건 이야기
   화면은 1920×1080 기준으로 만들고 창 크기에 맞춰 줄인다. */
(function () {
  const G = window.GAME, $ = id => document.getElementById(id);
  const stage = $('stage');
  function el(tag, cls, parent, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; if (parent) parent.appendChild(e); return e; }

  // ── 저장 ──
  const KEY = 'archiveA.save.v1';
  const DEF = { lead: 'arthur', speed: 1, cleared: [], seen: {}, notes: {}, tut: 0, party: [], sfx: 2, bgm: 2, fx: 0, graphics: 'auto' };
  let save = Object.assign({}, DEF);
  if (new URLSearchParams(location.search).get('fresh')) { try { localStorage.removeItem(KEY); } catch (e) {} }   // 확인용: &fresh=1이면 저장을 지우고 시작
  try { Object.assign(save, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) {}
  function store() { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) {} }

  // ── 소리 (js/sound.js). 파일이 없어도 게임은 그대로 돈다 ──
  const snd = n => { if (window.Snd) window.Snd.play(n); }, music = n => { if (window.Snd) window.Snd.music(n); };
  if (window.Snd) window.Snd.init(save.sfx, save.bgm);

  // ── 창 크기에 맞추기 ──
  function fit() { stage.style.transform = 'scale(' + Math.min(innerWidth / 1920, innerHeight / 1080) + ')'; }
  addEventListener('resize', fit); fit();

  // ── 배경 그리기 ──
  const sky = $('bgSky');
  { const im = new Image(); im.onload = () => sky.getContext('2d').drawImage(im, 0, 0, 1920, 1080); im.src = 'img/cover_bg.jpg'; }   // 모든 2D 화면의 배경은 표지 배경(남색 밤하늘·천문 원·레일·시계탑)
  function bg() { sky.style.display = 'block'; }
  const veilEl = $('veil');
  function veil(dk, moon) { if (dk < 0) { veilEl.style.display = 'none'; return; } veilEl.style.display = 'block'; veilEl.style.setProperty('--dk', dk.toFixed(2)); if (moon != null) veilEl.classList.toggle('moon', !!moon); }

  // ── 화면 바꾸기 ──
  let cur = null;
  function show(id) {
    if (cur === 'field' && id !== 'field' && window.Field) window.Field.leave();
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === id));
    cur = id; bg('sky'); veil(id === 'field' || id === 'title' || id === 'loading' ? -1 : 1);   // 표지 배경 위에 편성·추리 화면은 남색 막을 한 겹 덮는다
    if (id !== 'field') music(id === 'end' ? null : 'office');   // 현장의 음악은 field.js가 고른다
  }
  let toastT = 0;
  function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 1600); }

  // ── 팝업 ──
  const pop = $('pop');
  let popEsc = null, popTrigger = null;
  function openPop(o) {   // o: {title, sub, body(html 또는 함수), w, buttons:[[글자, 함수, 노랑?]], esc}
    if (!pop.classList.contains('on')) popTrigger = document.activeElement;
    pop.innerHTML = ''; pop.classList.add('on'); stage.classList.add('popping'); snd('open');
    const w = el('div', 'win', pop); w.style.width = (o.w || 900) + 'px';
    w.setAttribute('role', 'dialog');
    w.setAttribute('aria-modal', 'true');
    w.setAttribute('aria-labelledby', 'popup-title');
    el('h2', '', w, (o.sub ? '<small>' + o.sub + '</small>' : '') + o.title).id = 'popup-title';
    const b = el('div', 'body', w); if (typeof o.body === 'function') o.body(b); else b.innerHTML = o.body || '';
    if (o.title === '친구 도감' || o.title === '도감') {
      window.MongeulJournal.mount(b, 'a', () => openPop(o));
    }
    const f = el('div', 'foot', w);
    (o.buttons || [['닫기', null]]).forEach(x => { const bt = el('button', x[2] ? 'y' : '', f, '<span>' + x[0] + '</span>'); bt.onclick = () => { closePop(); if (x[1]) x[1](); }; });
    popEsc = o.esc || null;
    const initial = o.focusFirst ? f.firstElementChild : f.lastElementChild;
    if (initial) initial.focus({ preventScroll: true });
  }
  function closePop() {
    pop.classList.remove('on'); stage.classList.remove('popping');
    pop.innerHTML = '';
    if (popTrigger?.isConnected) popTrigger.focus({ preventScroll: true });
    popTrigger = null;
  }
  pop.addEventListener('click', e => { if (e.target === pop) { const f = popEsc; closePop(); if (f) f(); } });

  // ── 시작 화면: 표지(A안_시작화면)를 그대로 따른다. 가운데 로고와 세 단추, 양옆에 아서와 에리, 위아래에 히로인 알약 ──
  const title = $('title');
  const sil = (k, left, h) => { const im = el('img', 'cvfig ' + k, title); im.src = 'img/cover_' + k + '.png'; im.alt = ''; im.style.cssText = 'left:' + left + 'px;height:' + h + 'px'; };
  sil('arthur', 230, 840); sil('eri', 1250, 800);
  const lg = el('img', 'cvlogo', title); lg.src = 'img/cover_logo.png'; lg.alt = G.title;
  const pill = (cls, ids) => el('div', 'cvpill ' + cls, title, '<span class="slots">' + ids.map(k => '<i style="background-image:url(img/sub' + k + '.png)"></i>').join('') + '</span><span>히로인 캐릭터들</span>');
  pill('p1', [1, 2]); pill('p2', [3, 4]);
  el('div', 'cvname n1', title, '<b>아 서</b><i></i>'); el('div', 'cvname n2', title, '<b>에 리</b><i></i>');
  const tmenu = el('div', 'cvmenu', title);
  const tBtns = [['게 임 시 작', startGame], ['설 정', openSettings], ['게 임 종 료', askQuit]].map((b, i) => {
    const d = el('button', 'cvbtn', tmenu, '<i></i><span>' + b[0] + '</span>');
    d.setAttribute('aria-label', ['게임 시작', '설정', '게임 종료'][i]);
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
  const ll = el('img', 'logo', loading); ll.src = 'img/cover_logo.png'; ll.alt = '';
  const tip = el('div', 'tip', loading, '<div><b>후루의 안내</b><p></p></div>');
  const bar = el('div', 'bar', loading, '<i></i>').firstChild, go = el('div', 'go', loading);
  let loadDone = null;
  function startGame() {   // 처음 한 번 도시 자료를 실제로 읽는다. 다 읽으면 누르라고 하지 않고 바로 이어 간다(이야기 → 도시)
    show('loading'); tip.querySelector('p').textContent = G.tips[(Math.random() * G.tips.length) | 0];
    go.textContent = '별빛도시로 가는 중'; go.classList.remove('blink'); bar.style.width = '0'; loadDone = null;
    let p = 0; const t = setInterval(() => { p = Math.min(90, p + 4 + Math.random() * 8); bar.style.width = p + '%'; }, 140);
    const real = window.Field && window.Field.preload ? window.Field.preload(q => { p = Math.max(p, Math.round(q * 100)); bar.style.width = Math.min(100, p) + '%'; }) : null;
    Promise.all([Promise.resolve(real).catch(() => 0), new Promise(r => setTimeout(r, 1100))]).then(() => { clearInterval(t); bar.style.width = '100%'; go.textContent = '시작합니다'; setTimeout(afterLoad, 350); });
  }
  function loadFor(label, work) {   // 현장 자료를 읽는 동안 같은 로딩 화면을 쓴다
    show('loading'); tip.querySelector('p').textContent = G.tips[0]; go.textContent = label; go.classList.remove('blink'); bar.style.width = '0'; loadDone = null;
    return work(p => { bar.style.width = Math.round(p * 100) + '%'; });
  }
  // 처음이면 소개(솔 탐정의 말 → 인물 → 사건을 푸는 순서)를 보여 주고, 로비에서 후루가 누를 곳을 알려 준다
  function afterLoad() { if (!save.seen.opening) playOpening(() => { save.seen.opening = 1; store(); enterLobby(); }); else enterLobby(); }
  let skipAll = null;   // 이야기의 [건너뛰기]가 소개 전체를 끝내고 도시로 가게 한다
  function playOpening(done0) {
    const finish = () => { skipAll = null; done0(); };
    skipAll = () => { closeCard(); closePop(); finish(); };
    const O = G.opening, done = finish, next2 = () => playStory(O.last, finish);
    const steps = () => openPop({ title: O.stepsTitle, w: 1680, body: b => { const r = el('div', 'steps', b); O.steps.forEach((x, i) => el('div', 'stp', r, '<i>' + (i + 1) + '</i><b>' + x[0] + '</b><span>' + x[1] + '</span>')); }, buttons: [['시작', next2, 1]], esc: next2 });
    const who = () => openPop({ title: O.whoTitle, w: 1500, body: b => {
      const r = el('div', 'whos', b);
      O.who.forEach(p => { const h = p.id === 'huru'; el('div', 'who' + (h ? ' sm' : ''), r, '<div class="wpic" style="background-image:url(' + (h ? 'img/huru.png' : G.leads[p.id].img) + ')"></div><div class="wtx"><small>' + p.role + '</small><b>' + (h ? G.names.huru : G.leads[p.id].name) + '</b><p>' + p.text + '</p><em>“' + p.line + '”</em></div>'); });
    }, buttons: [['건너뛰기', finish], ['다음', steps, 1]], esc: steps });
    // 서막: 어두운 밤하늘 위에 달빛 마을 이야기를 먼저 들려 준다
    card('<div class="moon"></div><h1>별빛도시 이야기</h1>', 'night');
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
    card('<div class="epi"><div class="moon full"></div><h1>' + E.title + '</h1><p>' + E.line + '</p>' + moons(4) + '<div class="fr">' + fr.map(u => '<i style="background-image:url(' + u + ')"></i>').join('') + '</div><em>눌러서 사무소로</em></div>', 'night', done || (() => {}), 0);
  }
  // 말풍선이 밝힌 곳을 가리지 않게: 밝힌 곳의 위치를 재서 아래(자리가 모자라면 위)에 놓는다. 위치를 못 재면(화면이 숨겨짐) 자료의 자리를 그대로 쓴다
  function autoPlace(say, t) {
    if (!t) return; const stg = document.getElementById('stage'), sr = stg.getBoundingClientRect(), k = sr.width / 1920, r = t.getBoundingClientRect();
    if (!k || !r.width || !r.height) return;   // 위치를 못 재면(화면이 숨겨짐) 자료의 자리를 그대로 쓴다
    const cy = (r.top - sr.top + r.height / 2) / k, sw = say.offsetWidth || 860, sh = say.offsetHeight || 190;
    // 밝힌 곳이 위쪽이면 말풍선은 늘 아래쪽 가운데, 아래쪽이면 늘 위쪽 가운데에 둬서 단계마다 자리가 튀지 않게 한다
    const top = cy < 540 ? 1080 - sh - 70 : 150, left = Math.round((1920 - sw) / 2);
    say.style.cssText = 'left:' + left + 'px;top:' + Math.round(top) + 'px';
  }
  // 후루의 안내: 화면을 어둡게 하고 한 곳씩 밝혀 알려 준다. steps: [밝힐 곳, 말, 말풍선 자리]
  function guide(box, steps, done) {
    let i = 0; const dim = el('div', 'tdim', box), say = el('div', 'tsay', box, '<i class="fc" style="background-image:url(img/face_huru.png)"></i><div><b>' + G.names.huru + '</b><p></p><em>눌러서 넘기기</em></div>');
    const step = () => {
      box.querySelectorAll('.spot').forEach(e => e.classList.remove('spot'));
      if (i >= steps.length) { dim.remove(); say.remove(); if (done) done(); return; }
      const st = steps[i++], t = st[0] && box.querySelector(st[0]); if (t) t.classList.add('spot');
      say.querySelector('p').textContent = st[1]; say.style.cssText = st[2] || 'left:530px;top:420px'; autoPlace(say, t); say.querySelector('em').textContent = i < steps.length ? '눌러서 넘기기 (' + i + '/' + steps.length + ')' : '눌러서 닫기';
    };
    dim.onclick = say.onclick = step; step();
  }

  // 단추를 누르면 짧은 소리(스스로 소리를 내는 단추는 빼고)
  document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('button'); if (!b || b.closest('.tbtn,.tult,.tsay,.tdim,.mk') || b.classList.contains('cvbtn')) return; snd('tap'); }, true);

  loading.onclick = () => { if (loadDone) { const f = loadDone; loadDone = null; f(); } };

  function nextCase() { return G.cases.find(c => save.cleared.indexOf(c.id) < 0) || null; }
  function enterLobby() { window.Field.goWorld(); }   // 사무소 화면은 없다. 도시로 나간다

  // 떠나기 전에 들을 말이 있는 사건은 처음 한 번 그 말을 듣고 편성으로 간다
  function toTeam(c) {
    const next = () => {
      if (!c.brief || save.seen['brief_' + c.id]) { window.Field.enterCase(c); return; }
      save.seen['brief_' + c.id] = 1; store(); playStory(c.brief, () => window.Field.enterCase(c));
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
    sFull = l.text; const tx = sbox.querySelector('.stext'); tx.textContent = ''; sbox.querySelector('.snext').style.display = 'none';
    let i = 0; sTyping = true; clearInterval(sT);
    sT = setInterval(() => { i++; tx.textContent = sFull.slice(0, i); if (i % 3 === 1) snd('blip'); if (i >= sFull.length) endType(); }, [70, 38, 14][save.speed]);
    if (document.documentElement.classList.contains('noanim')) endType();   // 화면 확인용 주소에서는 글을 한 번에 보인다
  }
  function endType() { clearInterval(sT); sTyping = false; sbox.querySelector('.stext').textContent = sFull; sbox.querySelector('.snext').style.display = ''; }
  function endStory() { clearInterval(sT); story.classList.remove('on'); stage.classList.remove('telling'); const f = sDone; sDone = null; if (f) f(); }
  function advance() { if (sTyping) { endType(); return; } snd('next'); sIdx++; if (sIdx >= sLines.length) endStory(); else line(); }
  story.onclick = e => { if (e.target === sskip) return; advance(); };
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
        settingChoices(display, '연출', [['보통', 0], ['줄이기', 1]], () => save.fx ? 1 : 0,
          value => { save.fx = value; store(); if (window.FX) window.FX.setReduced(!!value); });
        settingChoices(display, '3D 해상도', [['자동', 'auto'], ['고정 1080p', 'native']],
          () => save.graphics === 'native' ? 'native' : 'auto', value => {
            save.graphics = value; store(); if (window.Stage3D) window.Stage3D.resetGraphics();
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
        el('button', '', s3, '처음부터 다시').onclick = () => openPop({ title: '저장 기록 초기화', w: 820, focusFirst: true, body: '<p>사건 기록과 설정을 모두 지웁니다.</p><p>지우면 되돌릴 수 없습니다.</p>',
          buttons: [['취소', openSettings], ['초기화', () => {
            show('title');
            save = Object.assign({}, DEF, { cleared: [], seen: {}, notes: {}, party: [] });
            store();
            if (window.Snd) window.Snd.init(save.sfx, save.bgm);
            if (window.Stage3D) window.Stage3D.resetGraphics();
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
    const gsay = document.querySelector('#hud .tsay'); if (gsay && (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight')) { e.preventDefault(); gsay.click(); return; }   // 후루 안내는 자판으로도 넘긴다
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

  // 주소 끝에 ?case=2 를 붙이면 앞 사건을 해결한 것으로 보고 그 사건부터 시작한다
  const fromCase = Number(new URLSearchParams(location.search).get('case') || 0);
  if (fromCase > 1) G.cases.slice(0, fromCase - 1).forEach(c => { if (save.cleared.indexOf(c.id) < 0) save.cleared.push(c.id); });

  if (fromCase > 1) save.seen.opening = 1;

  window.GB = { faceUrl: k => (G.friends[k] && G.friends[k].wild) ? G.friends[k].img : 'img/face_' + k + '.png', toTeam: toTeam, openSettings: openSettings, opening: playOpening, snd: snd, music: music, guide: guide, chapter: chapter, epilogue: epilogue, G: G, el: el, stage: stage, show: show, toast: toast, openPop: openPop, closePop: closePop, playStory: playStory, enterLobby: enterLobby, loadFor: loadFor, store: store, nextCase: nextCase, get save() { return save; }, get cur() { return cur; } };
  show('title');
  // 화면 확인용: 주소 끝에 ?go=settings 처럼 붙이면 그 화면에서 시작한다 (eri, story, settings, who, steps, prologue, chapter, epilogue, loading). 도시·사건 화면은 field.js(go=world, team, probe, battle …)
  const goTo = new URLSearchParams(location.search).get('go');
  if (goTo) {
    document.documentElement.classList.add('noanim');   // 확인용 주소에서는 움직임과 자동 닫힘을 끈다
    if (goTo === 'eri') save.lead = 'eri';
    if (goTo === 'loading') startGame();   // 도시·훈련 화면은 field.js가 이어서 연다(go=world, battle, probe …)
    if (goTo === 'story') playStory(G.cases[0].intro, null);
    if (goTo === 'settings') openSettings();
    if (goTo === 'who' || goTo === 'steps') { playOpening(null); sskip.click(); if (goTo === 'steps') pop.querySelector('.foot button').click(); }   // 처음 소개의 두 화면
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
