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
        detail.insertBefore(player, picture);
        button.setAttribute('aria-expanded','true');
        player.focus();
        player.scrollIntoView({block:'nearest'});
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
    if (!detail.open) detail.showModal();
    else detail.querySelector('.portfolio-back, .portfolio-close').focus();
    detail.scrollTop = 0;
  }
  detail.addEventListener('cancel', releasePlayer);
  detail.addEventListener('close', () => {
    if (!detail.open) releasePlayer();
  });
  window.addEventListener('message', event => {
    const frame = detail.querySelector('iframe.portfolio-live');
    const sameOrigin = event.origin === location.origin || (location.protocol === 'file:' && event.origin === 'null');
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
    button.addEventListener('click', () => openWork(work, parentWork));
    return button;
  }

  function openIndex() {
    index.replaceChildren(closeButton(index), make('h2', '', '작품의 세계'));
    index.append(make('p', 'portfolio-description', '물건을 정리하면 작품의 입구가 열립니다. 준희의 방에서 이어지는 ' + works.length + '개 작업을 둘러보세요.'));
    const nav = make('nav', 'portfolio-filters'); nav.setAttribute('aria-label', '작품 자리별 보기');
    const list = make('div', 'portfolio-grid');
    const render = station => {
      list.replaceChildren(...works.filter(work => !station || work.station === station).map(work => card(work)));
      for (const button of nav.children) button.setAttribute('aria-pressed', String(button.dataset.station === station));
    };
    for (const station of ['', ...new Set(works.map(work => work.station))]) {
      const button = make('button', '', station ? titleForStation(station) : '전체 ' + works.length);
      button.type = 'button'; button.dataset.station = station;
      button.addEventListener('click', () => render(station)); nav.append(button);
    }
    index.querySelector('h2').id = 'portfolio-index-title';
    index.setAttribute('aria-labelledby', 'portfolio-index-title');
    index.append(nav, list); render(''); index.showModal();
  }

  document.addEventListener('click', event => {
    if (!event.target.closest('#worlds, [data-cover-action="worlds"]')) return;
    event.preventDefault(); event.stopImmediatePropagation(); openIndex();
  }, true);

  const all = make('button', '', '전체 작품 ' + works.length);
  all.id = 'portfolio-open'; all.type = 'button';
  all.addEventListener('click', openIndex);
  document.querySelector('.stage-tools').prepend(all);

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
