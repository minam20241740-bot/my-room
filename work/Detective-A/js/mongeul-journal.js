(function () {
  const art = 'img/몽글진화/';
  const stages = [
    ['mongeul', '몽글번개', '몸에 모인 전기가 귀와 꼬리 끝에서 반짝인다.'],
    ['mongeul_s2', '뇌운몽글', '몸집이 자라며 머리 위에 번개를 머금은 구름이 솟는다.'],
    ['mongeul_s3', '천둥수호', '두 발로 서서 구름에 모인 전기를 전신으로 흘려보낸다.']
  ];
  const profiles = [['lumi', '루미'], ['mori', '모리'], ['noel', '노엘'], ['sera', '세라']];
  const make = (parent, tag, cls, label) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (label) node.textContent = label;
    parent.append(node);
    return node;
  };
  function button(parent, name, action) {
    const control = make(parent, 'button', 'journal-button', name);
    control.type = 'button';
    control.addEventListener('click', action);
    return control;
  }
  function openEvolution(variant, back) {
    window.GB.openPop({title:'몽글번개의 진화 기록', w:1140, body(body) {
      const outer = make(body, 'section', 'journal journal-' + variant);
      make(outer, 'p', 'journal-intro', '시계탑에서 만나는 뇌운몽글과 그 전후 형태를 살펴본다.');
      const view = make(outer, 'div', 'journal-stage');
      make(view, 'i', 'journal-ring').setAttribute('aria-hidden', 'true');
      const pictures = stages.map(([id]) => {
        const img = make(view, 'img', 'journal-model');
        img.src = art + id + '.webp';
        img.alt = '';
        return img;
      });
      const legend = make(outer, 'p', 'journal-legend');
      const title = make(legend, 'strong');
      const description = make(legend, 'span');
      const controls = make(outer, 'div', 'journal-buttons');
      const play = button(controls, '진화 연출 보기', async () => {
        play.disabled = true;
        tabs.forEach(tab => tab.disabled = true);
        show(0);
        await Promise.all(pictures.map(picture => picture.decode().catch(() => {})));
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const delay = ms => new Promise(resolve => window.setTimeout(resolve, ms));
        if (view.isConnected) await delay(reduced ? 120 : 520);
        for (let stage = 1; stage < stages.length && view.isConnected; stage += 1) {
          show(stage, !reduced);
          await delay(reduced ? 160 : 875);
        }
        play.disabled = false;
        tabs.forEach(tab => tab.disabled = false);
      });
      const tabs = stages.map(([, label], i) => button(controls, label, () => show(i)));
      function show(index, reveal = false) {
        pictures.forEach((image, i) => {
          image.hidden = i !== index;
          image.classList.remove('unfold');
        });
        if (reveal) pictures[index].classList.add('unfold');
        title.textContent = (index + 1) + '단계 · ' + stages[index][1];
        description.textContent = stages[index][2];
        tabs.forEach((tab, i) => tab.setAttribute('aria-pressed', String(i === index)));
      }
      legend.setAttribute('aria-live', 'polite');
      show(0);
    }, buttons:[['도감으로', back], ['닫기', null, 1]]});
  }
  function openProfiles(variant, back) {
    window.GB.openPop({title:'서브 캐릭터 설정', w:1160, body(body) {
      const outer = make(body, 'section', 'journal journal-' + variant);
      make(outer, 'p', 'journal-intro', '멈춘 안내 시계 사건을 해결하면 천문 광장 동쪽에서 노엘을 만날 수 있다. 노엘에게 별빛 역과 시계탑으로 가는 길을 물어보자.');
      const list = make(outer, 'div', 'journal-profiles');
      profiles.forEach(([id, label]) => {
        const figure = make(list, 'figure');
        const img = make(figure, 'img');
        img.src = art + 'ally_' + id + '.webp';
        img.alt = '';
        make(figure, 'figcaption', '', label);
      });
    }, buttons:[['도감으로', back], ['닫기', null, 1]]});
  }
  window.MongeulJournal = {mount(body, variant, back) {
    const links = make(body, 'div', 'journal-links');
    button(links, '몽글번개 진화 기록', () => openEvolution(variant, back));
    button(links, '서브 캐릭터 설정', () => openProfiles(variant, back));
  }};
})();
