'use strict';

(() => {
  const works = window.RoomPortfolioData;
  const gallery = window.RoomGallery;
  const titleForStation = id => id === 'Start' ? '준희의 책상' : gallery.objects[id].zone;
  const make = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text) element.textContent = text;
    return element;
  };
  const index = make('dialog', 'portfolio-index');
  index.id = 'portfolio-index';
  const detail = make('dialog', 'portfolio-detail');
  detail.id = 'portfolio-detail';
  document.body.append(index, detail);
  // 휴대폰에서는 게임·체험을 작은 창이 아니라 화면 전체에 연다(위에 작품 정보·닫기가 늘 붙어 있다)
  const stage = make('dialog', 'portfolio-stage'); stage.id = 'portfolio-stage'; document.body.append(stage);
  const touchLike = () => matchMedia('(pointer:coarse)').matches || innerWidth < 760;
  function closeStage() { const f = stage.querySelector('iframe'); if (f) f.src = 'about:blank'; if (stage.open) stage.close(); stage.replaceChildren(); }
  function openStage(work, experience) {
    const bar = make('div', 'stage-bar');
    const back = make('button', 'stage-back', '← 작품 정보'); back.type = 'button'; back.addEventListener('click', closeStage);
    const name = make('strong', 'stage-title', work.title);
    const quit = make('button', 'stage-close', '닫기'); quit.type = 'button'; quit.addEventListener('click', () => { closeStage(); detail.close(); document.querySelector('#work-view[open]')?.close(); });
    bar.append(back, name, quit);
    const frame = make('iframe', 'stage-frame'); frame.src = experience.url; frame.title = work.title + ' 체험'; frame.allow = 'fullscreen; autoplay';
    const loader = make('div', 'stage-loader', experience.mb >= 10 ? '불러오는 중이에요 · 처음에는 약 ' + experience.mb + 'MB를 받아 오래 걸릴 수 있어요' : '불러오는 중이에요…'); loader.setAttribute('role', 'status');
    frame.addEventListener('load', () => loader.remove()); setTimeout(() => loader.remove(), 90000);
    stage.replaceChildren(bar, frame, loader);
    if (work.orient === 'landscape' && innerHeight > innerWidth) { const hint = make('p', 'stage-hint', '휴대폰을 가로로 돌리면 더 크게 볼 수 있어요.'); stage.append(hint); setTimeout(() => hint.remove(), 7000); }
    stage.showModal(); pushLayer(); back.focus({preventScroll: true});
  }
  stage.addEventListener('cancel', event => { event.preventDefault(); closeStage(); });
  // 휴대폰 뒤로 가기: 목록 → 상세 → 전체 화면 순으로 쌓아 두고 뒤로 가면 맨 위 창부터 닫는다
  let pushed = 0, skipPop = 0, popping = false;
  const layers = () => [stage, detail, index];
  const pushLayer = () => { try { history.pushState({roomLayer: ++pushed}, ''); } catch (e) { pushed++; } };
  const afterClose = () => { if (popping || pushed <= 0) return; pushed--; skipPop++; try { history.back(); } catch (e) { skipPop--; } };
  for (const dialog of layers()) dialog.addEventListener('close', afterClose);
  window.addEventListener('popstate', () => {
    if (skipPop > 0) { skipPop--; return; }
    const top = layers().find(dialog => dialog.open); if (!top) return;
    popping = true; pushed = Math.max(0, pushed - 1);
    if (top === stage) closeStage(); else top.close();
    setTimeout(() => { popping = false; }, 50);
  });
  window.RoomPlayView = {touchLike, open: (title, url, orient) => openStage({title, orient}, {url})};   // 방 안 진열대(gallery.js)에서도 같은 전체 화면 보기를 쓴다
  const badgeFor = work => work.status === 'wip' ? '진행 중' : work.device === 'pad' ? '휴대폰 조작 패드 지원' : work.device === 'pc' ? '컴퓨터에서 더 편해요' : '';
  const noteFor = work => [work.experience?.mb >= 10 ? '처음 열 때 약 ' + work.experience.mb + 'MB를 내려받습니다. 와이파이에서 여는 것을 권합니다.' : '',
    work.status === 'wip' ? '진행 중인 작업입니다. 전시 기간에도 계속 다듬어 이 주소에서 갱신합니다.' : '',
    work.device === 'pad' ? '휴대폰에서는 화면의 조작 패드로 움직일 수 있습니다. 컴퓨터에서는 키보드가 더 편합니다.' : work.device === 'pc' ? '컴퓨터의 키보드·마우스에 맞춘 작품입니다.' : ''].filter(Boolean);

  function releasePlayer() {
    const player = detail.querySelector('.portfolio-live');
    if (!player) return;
    if (player.tagName === 'VIDEO') {
      player.pause();
      player.removeAttribute('src');
      player.load();
    } else {
      player.src = 'about:blank';
    }
    player.remove();
  }

  function closeButton(dialog) {
    const button = make('button', 'portfolio-close', '닫기');
    button.type = 'button';
    button.addEventListener('click', () => {
      if (dialog === detail) releasePlayer();
      dialog.close();
    });
    return button;
  }

  function openWork(work, parentWork) {
    if (work.station && work.station !== 'Start') window.RoomJunhee?.go(work.station);   // 작품을 열면 준희가 그 작품의 자리 앞에 서 있다
    releasePlayer();
    detail.replaceChildren(closeButton(detail));
    detail.setAttribute('aria-labelledby', 'portfolio-work-title');
    if (parentWork) {
      const back = make('button', 'portfolio-back', '세 가지 플레이로 돌아가기');
      back.type = 'button';
      back.addEventListener('click', () => {
        openWork(parentWork);
        detail.querySelector('[data-work="' + work.id + '"]')?.focus();
      });
      detail.append(back);
    }
    detail.append(make('p', 'portfolio-kind', titleForStation(work.station)),
      make('h2', '', work.title), make('p', 'portfolio-description', work.description));
    detail.querySelector('h2').id = 'portfolio-work-title';
    for (const note of noteFor(work)) detail.append(make('p', 'portfolio-note', note));
    if (work.credit) detail.append(make('p', 'portfolio-kind', work.credit));
    const picture = make(work.image ? 'img' : 'div', 'portfolio-art');
    if (work.image) {
      picture.src = work.image;
      picture.alt = work.title;
    }
    detail.append(picture);
    const actions = make('div', 'portfolio-actions');
    if (work.experience) {
      const experience = work.experience;
      const button = make('button', '', experience.label);
      button.type = 'button';
      button.addEventListener('click', () => {
        if (experience.type === 'page') {
          detail.close(); index.close();
          if (document.body.dataset.phase === 'cover') document.querySelector('#wake').click();
          return;
        }
        if (experience.type === 'game' && touchLike()) { openStage(work, experience); return; }
        const previous = detail.querySelector('.portfolio-live');
        if (previous) {
          previous.focus();
          return;
        }
        const player = make(experience.type === 'video' ? 'video' : 'iframe', 'portfolio-live');
        player.src = experience.url;
        if (experience.type === 'video') {
          player.controls = true; player.playsInline = true;
          if (work.id === 'W002') player.style.aspectRatio='12 / 7';
        } else {
          player.title = work.title + ' 체험';
          player.allow = 'fullscreen';
        }
        player.tabIndex = 0;
        if (experience.type === 'video' && work.image) player.poster = work.image;   // 재생 전 검은 상자 대신 작품 그림
        detail.insertBefore(player, picture);
        if (experience.type === 'video') { if (experience.loop) player.loop = true; const started = player.play?.(); if (started) started.catch(() => {}); }   // 누르면 바로 재생, 짧은 클립은 반복
        button.setAttribute('aria-expanded','true');
        player.focus({preventScroll:true});
        // 위에 붙어 있는 닫기 단추 바로 아래에 체험 화면이 오게 창을 내린다(닫기가 화면 밖으로 밀려나지 않게)
        const top = player.getBoundingClientRect().top - detail.getBoundingClientRect().top + detail.scrollTop;
        detail.scrollTo({top: Math.max(0, top - 64)});
      });
      if (experience.type !== 'page') button.setAttribute('aria-expanded', 'false');
      actions.append(button);
      if (experience.type === 'game') {
        const expand = make('a', '', '새 창에서 열기');
        expand.href = experience.url;
        expand.target = '_blank';
        expand.rel = 'noopener';
        actions.append(expand);
      }
    }
    if (work.plan) {
      const plan = make('a', '', work.id === 'W001' ? '30쪽 기획서 부록' : '기획서 PDF');
      plan.href = work.plan; plan.target = '_blank'; plan.rel = 'noopener';
      actions.append(plan);
    }
    detail.insertBefore(actions, picture);
    if (work.related?.length) {
      const related = make('section', 'portfolio-station');
      related.append(make('h3', '', work.id === 'W003' ? '세 가지 플레이' : '함께 보는 작업'));
      const list = make('div', 'portfolio-grid');
      list.append(...work.related.map(child => card(child, work)));
      related.append(list); detail.append(related);
    }
    if (!detail.open) { detail.showModal(); pushLayer(); }
    else detail.querySelector('.portfolio-back, .portfolio-close').focus();
    detail.scrollTop = 0;
  }
  detail.addEventListener('cancel', releasePlayer);
  detail.addEventListener('close', () => {
    if (!detail.open) releasePlayer();
  });
  window.addEventListener('message', event => {
    const sameOrigin = event.origin === location.origin || (location.protocol === 'file:' && event.origin === 'null');
    const sframe = stage.querySelector('iframe');
    if (sframe && sameOrigin && event.source === sframe.contentWindow) {
      if (event.data?.type === 'room:close-work') { closeStage(); detail.close(); }
      if (event.data?.type === 'room:return-detail') closeStage();
      return;
    }
    const frame = detail.querySelector('iframe.portfolio-live');
    if (!frame || !sameOrigin || event.source !== frame.contentWindow) return;
    if (event.data?.type === 'room:close-work') detail.close();
    if (event.data?.type === 'room:return-detail') {
      releasePlayer();
      const play = detail.querySelector('.portfolio-actions button');
      play?.setAttribute('aria-expanded','false');
      play?.focus();
    }
  });


  function card(work, parentWork) {
    const button = make('button', 'portfolio-card');
    button.type = 'button'; button.dataset.work = work.id;
    if (work.image) {
      const image = make('img'); image.src = work.image; image.alt = ''; image.loading = 'lazy';
      button.append(image);
    }
    button.append(make('span', 'portfolio-kind', work.kind), make('strong', '', work.title));
    const badge = badgeFor(work); if (badge) button.append(make('span', 'portfolio-badge', badge));
    button.addEventListener('click', () => openWork(work, parentWork));
    return button;
  }

  // 전시가 시작된 뒤의 수정 기록(QR과 주소는 그대로 두고 이 목록만 늘어난다)
  const PATCHES = [
    ['11.26', '휴대폰에서 게임·체험을 화면 전체로 열고, 위에 작품 정보·닫기를 늘 붙였습니다.'],
    ['11.26', '우회선·멜루·탐정 사무소 A·C안에 휴대폰용 조작 패드를 달았습니다.'],
    ['11.26', '작품 카드에 기기 안내와 진행 중 표시를 넣고, 종류로 보기를 더했습니다.'],
    ['11.26', '새 작품 「마중」(실사 뮤직비디오, 가편집)을 넣었습니다. 영상은 누르면 바로 재생되고 짧은 클립은 반복됩니다.'],
    ['11.26', '나의 그림자 영상을 새 버전(손이 튀어나와 바닥을 내려치며 전시실이 무너지는 마무리)으로 바꿨습니다.'],
    ['11.26', '탐정 사무소 A·B·C와 우회선: 휴대폰 가로 화면에서 작았던 단추를 손가락 크기로 키우고, 우회선 글자를 읽을 수 있게 했습니다.'],
    ['11.26', '방 안 탐정 책상에서 고른 게임도 휴대폰에서는 화면 전체로 열립니다.'],
    ['11.26', '휴대폰 뒤로 가기 단추가 사이트를 나가지 않고 열린 창을 하나씩 닫습니다.'],
    ['11.26', '용량이 큰 게임은 열기 전에 크기를 알리고 불러오는 동안 안내를 띄웁니다. 영상은 재생 전에 작품 그림이 보입니다.'],
    ['11.26', '링크를 공유하면 제목과 표지 그림이 미리보기로 보입니다.'],
    ['11.26', '준희가 걷는 동작 없이, 방의 자리 메뉴와 작품 목록에서 고른 자리 앞으로 바로 옮겨 섭니다. 준희는 지금 어느 자리에서 작품을 보는지 알려 주는 말입니다.'],
    ['11.26', '3D 방이 정지 그림으로 바뀌던 문제를 고쳤습니다.'],
    ['11.26', '표지를 화면에 꽉 차게 키우고 아래 단추 줄을 없앴습니다. 작품의 세계와 기획 의도는 방 안쪽 위 단추에서 언제든 열립니다.'],
    ['11.26', '단추·안내창·작품 자리 판을 번지는 색 없이 단색의 각진 모양으로 바꾸고, 탐정 사무소 A·B·C의 단추·카드·막대도 단색으로 맞췄습니다.'],
    ['11.26', '휴대폰을 가로로 눕히면 표지가 화면 높이에 맞게 커지고, 작품 자리 판이 대화창에 가려지지 않습니다.'],
    ['11.26', '표지는 그림 어디를 눌러도 시작됩니다. 단추 글자를 굵게, 작품 자리 판의 작은 글자를 키웠습니다.'],
    ['11.26', '준희가 깨어나는 장면에 비스듬한 색 판이 걷히는 전환, 놀람 표시 「앗!」, 표지와 같은 제목 글자 판을 더했습니다. 준희와 3D 장면은 그대로입니다.'],
    ['11.26', '탐정 사무소 A안의 화면 단추·창(지도·임무·메뉴 등)을 반투명·둥근 모서리·번지는 그림자 없이 단색의 각진 모양으로 정리했습니다.']
  ];
  function openIndex() {
    index.replaceChildren(closeButton(index), make('h2', '', '작품의 세계'));
    index.append(make('p', 'portfolio-description', '준희의 방에서 이어지는 ' + works.length + '개 작업입니다. 종류나 방의 자리로 골라 볼 수 있어요.'));
    const log = make('details', 'portfolio-notes'); log.append(make('summary', '', '업데이트 기록 · 전시 중에도 이 주소에서 계속 고칩니다'));
    const items = make('ul'); for (const [day, text] of PATCHES) items.append(make('li', '', day + ' · ' + text)); log.append(items); index.append(log);
    // 종류로 보기(처음 오는 사람이 '야간 신호실' 같은 방 이름을 몰라도 고를 수 있게)와 방 자리별 보기를 함께 쓴다
    const GROUPS = {W002: '영상·MV', W004: '영상·MV', W017: '영상·MV', W020: '영상·MV', W023: '영상·MV', W032: '영상·MV', W034: '영상·MV', W037: '영상·MV', W041: '영상·MV',
      W001: '게임·체험', W003: '게임·체험', W005: '게임·체험', W019: '게임·체험', W025: '게임·체험', W029: '게임·체험', W036: '게임·체험',
      W006: '3D·캐릭터', W007: '3D·캐릭터', W008: '3D·캐릭터', W009: '3D·캐릭터', W010: '3D·캐릭터', W011: '3D·캐릭터', W012: '3D·캐릭터', W013: '3D·캐릭터', W030: '3D·캐릭터',
      W014: '디자인·UIUX', W018: '디자인·UIUX', W021: '디자인·UIUX', W031: '디자인·UIUX', W038: '디자인·UIUX', W039: '디자인·UIUX', W040: '디자인·UIUX'};
    const groupOf = work => GROUPS[work.id] || '기타';
    const groupNav = make('nav', 'portfolio-filters portfolio-groups'); groupNav.setAttribute('aria-label', '작품 종류별 보기');
    const nav = make('nav', 'portfolio-filters'); nav.setAttribute('aria-label', '작품 자리별 보기');
    const list = make('div', 'portfolio-grid'); let curStation = '', curGroup = '';
    const render = () => {
      const shown = works.filter(work => (!curStation || work.station === curStation) && (!curGroup || groupOf(work) === curGroup));
      list.replaceChildren(...shown.map(work => card(work)));
      if (!shown.length) list.replaceChildren(make('p', 'portfolio-description', '이 조합에는 작품이 없어요. 다른 종류나 자리를 눌러 보세요.'));
      for (const button of nav.children) button.setAttribute('aria-pressed', String(button.dataset.station === curStation));
      for (const button of groupNav.children) button.setAttribute('aria-pressed', String(button.dataset.group === curGroup));
    };
    for (const group of ['', '영상·MV', '게임·체험', '3D·캐릭터', '디자인·UIUX']) {
      const button = make('button', '', group ? group + ' ' + works.filter(work => groupOf(work) === group).length : '종류 전체');
      button.type = 'button'; button.dataset.group = group;
      button.addEventListener('click', () => { curGroup = group; render(); }); groupNav.append(button);
    }
    for (const station of ['', ...new Set(works.map(work => work.station))]) {
      const button = make('button', '', station ? titleForStation(station) : '자리 전체');
      button.type = 'button'; button.dataset.station = station;
      button.addEventListener('click', () => { curStation = station; render(); if (station) window.RoomJunhee?.go(station); }); nav.append(button);   // 자리를 고르면 준희도 그 자리 앞으로
    }
    index.querySelector('h2').id = 'portfolio-index-title';
    index.setAttribute('aria-labelledby', 'portfolio-index-title');
    index.append(make('p', 'portfolio-filter-label', '종류로 보기'), groupNav, make('p', 'portfolio-filter-label', '방의 자리별로 보기'), nav, list); render(); index.showModal(); pushLayer();
  }
  document.addEventListener('click', event => {
    if (!event.target.closest('#worlds, [data-cover-action="worlds"]')) return;
    event.preventDefault(); event.stopImmediatePropagation(); openIndex();
  }, true);

  // 표지: 불러오는 동안은 안내 문구를 바꿔서 눌러도 안 되는 단추가 고장난 것처럼 보이지 않게 한다
  const coverNote = document.querySelector('.cover-note'), coverBox = document.querySelector('.cover-touch');
  if (coverNote && coverBox) {
    const covers = [...document.querySelectorAll('[data-cover-action]')];
    const sync = () => { const ready = covers.every(button => !button.disabled); coverNote.textContent = '준희의 방을 불러오는 중이에요…'; coverNote.hidden = ready; };   // 다 불러오면 안내는 사라지고 표지 그림만 남는다
    new MutationObserver(sync).observe(coverBox, {attributes: true, subtree: true, attributeFilter: ['disabled']}); sync();
  }
  // 방 안 머리말: 작품의 세계(전체 작품)와 기획 의도를 표지가 아니라 안쪽에서 바로 연다
  const all = make('button', '', '작품의 세계');
  all.id = 'portfolio-open'; all.type = 'button'; all.title = '전체 작품 ' + works.length + '개 보기';
  all.addEventListener('click', openIndex);
  const intent = make('button', '', '기획 의도');
  intent.id = 'concept-open'; intent.type = 'button';
  intent.addEventListener('click', () => document.getElementById('concept')?.click());
  document.querySelector('.stage-tools').prepend(all, intent);

  const original = gallery.renderWork;
  gallery.renderWork = (body, id, onExperience) => {
    original(body, id, onExperience);
    const stationWorks = works.filter(work => work.station === id);
    const section = make('section', 'portfolio-station');
    section.append(make('h3', '', titleForStation(id) + '에서 이어지는 작품'));
    const list = make('div', 'portfolio-grid'); list.append(...stationWorks.map(work => card(work))); section.append(list);
    body.append(section);
  };
})();
