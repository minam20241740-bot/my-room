'use strict';

(function () {
  const {GB} = window;
  const {el, openPop} = GB;
  const lobby = document.getElementById('lobby');
  const visitor = el('button', 'mori-visitor', lobby);
  visitor.type = 'button';
  const portrait = el('img', '', visitor);
  portrait.src = 'img/mori-face.png';
  portrait.alt = '';
  const label = el('span', '', visitor);
  const status = el('small', '', label);
  el('b', '', label, '모리에게 말 걸기');

  const topics = {
    warehouse: {
      prompt: '창고에서 뭘 봤어?',
      title: '창고의 반짝임',
      line: '베이커리에 편지를 배달하고 돌아오다가 창고 문틈에서 반짝이는 걸 봤어. 안쪽은 너무 어두워서 더 보이지 않았어.',
      record: '창고에는 앞길을 밝혀 줄 친구와 함께 간다.'
    },
    satchel: {
      prompt: '편지 가방은?',
      title: '새벽마을의 편지',
      line: '내 가방에는 새벽마을에서 온 편지가 들어 있어. 낯선 마을에 갈 땐 편지에 적힌 주소랑 길에 남은 냄새를 같이 살펴.',
      record: '모리는 새벽마을의 편지를 배달하러 달빛 마을에 왔다.'
    }
  };
  const progress = () => GB.save.moriPost || {};
  const available = () => GB.save.cleared.includes('bakery');

  function sync() {
    visitor.hidden = !available();
    status.textContent = Object.values(progress()).includes(true) ? '우편 기록 다시 보기' : '새벽마을 우편 배달';
  }
  function remember(id) {
    GB.save.moriPost = {...progress(), [id]: true};
    GB.store();
    GB.snd('found');
    sync();
  }
  function open(id) {
    if (!available()) return;
    const topic = topics[id];
    const read = progress();
    const buttons = topic
      ? [['다른 이야기', () => open()],
         [read[id] ? '닫기' : '기록하고 닫기', read[id] ? null : () => remember(id), 1]]
      : [['닫기', null],
         [topics.satchel.prompt, () => open('satchel')],
         [topics.warehouse.prompt, () => open('warehouse'), 1]];
    openPop({
      title: '우편 배달부 모리', w: 1160, buttons,
      body: body => {
        const content = el('div', 'mori-dialogue', body);
        const image = el('img', '', content);
        image.src = 'img/mori-post.png';
        image.alt = '';
        const copy = el('div', '', content);
        el('h3', '', copy, topic ? topic.title : '새벽마을에서 온 모리');
        el('p', '', copy, topic ? topic.line
          : '멍! 새벽마을 우편 배달 모리야. 달빛 베이커리에 편지를 전하고 돌아오는 길이었어.');
        if (topic) el('p', 'mori-record', copy, topic.record);
        else {
          const recorded = Object.keys(topics).filter(name => read[name]);
          if (recorded.length) {
            const notes = el('ul', 'mori-notes', copy);
            recorded.forEach(name => el('li', '', notes, topics[name].title + ' · 기록됨'));
          }
        }
      }
    });
  }
  visitor.onclick = () => open();
  window.MoriPost = {sync};
  sync();
})();
