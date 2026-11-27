'use strict';
/* C안 해솔항 월드의 글과 자료. data.js 다음에 읽어서 C안에 맞게 덮어쓴다.
   좌표는 world3d.js와 같다(x 동쪽, z 남쪽). 글은 짧게 쓰고, 사건 문장은 B안 달빛 마을과 겹치지 않게 새로 썼다(사용자 확인 전 검토본). */
(function () {
  const G = window.GAME;
  G.title = '도시의 몬스터와 탐정 사무소 ARCHIVE';
  G.city = '해솔항';
  Object.assign(G.names, { kuru: '쿠루', bori: '보리', captain: '파도 선장', dash: '반짝이', banjjak: '반짝돌', garam: '가람이', mongeul2: '뇌운몽글', someone: '누군가' });
  Object.assign(G.names, { ally_sera: '세라', heuk_s3: '바위수호' });
  Object.assign(G.models, {
    ally_sera: { file: 'assets/chr/ally_sera.glb', height: 1, grounded: true },
    heuk_s3: { file: 'assets/chr/heuk_s3.glb', height: .8, grounded: true }
  });
  G.friends.heuk_s3 = { name: '바위수호', tag: '땅', img: 'img/rock-warden.png', desc: '두 발로 걸어 다니며 부두의 통로를 지킨다' };
  G.tips = ['큰길, 골목, 부두, 옥상을 직접 걸어 다닙니다.', '불안한 친구와 마주치면 붉은 범위를 피하고 빈틈을 칩니다.', '단서는 반짝이는 곳에서 F를 눌러 살핍니다.'];
  G.menus = [['team', '편성'], ['note', '수첩'], ['quest', '의뢰'], ['map', '지도']];
  G.caseTitles = ['거꾸로 걸린 표지판', '꺼진 골목 등', '뒤바뀐 항로표', '옥상의 신호'];
  G.lobbyLines = { arthur: ['단서는 발로 찾는 거야.'], eri: ['수첩에 적어 두면 잊지 않아.'] };
  // 친구를 더 얹는다. 그림이 없는 친구는 img를 비워 둔다(이름 글자로 대신 보인다)
  Object.assign(G.friends, {
    bori: { name: '보리', tag: '힘', img: 'img/bori.png', desc: '무거운 짐도 번쩍 든다' },
    banjjak: { name: '반짝돌', tag: '수정', img: 'img/banjjak.png', desc: '빛을 모아 반짝인다' },
    garam: { name: '가람이', tag: '물', img: '', desc: '물결을 읽고 길을 안다' }
  });
  G.friends.malangbul.light = 1; G.friends.bangului.water = 1; G.friends.mongeul.elec = 1;

  // ── 처음 소개 ──
  G.opening = {
    prologue: [
      { who: 'narr', text: '밤바다가 보이는 항구 도시, 해솔항.' },
      { who: 'narr', text: '이 도시에는 사람과 몬스터 친구들이 같이 산다.' },
      { who: 'narr', text: '그런데 며칠 전부터 길을 알려 주던 항로표가 하나둘 뒤바뀌기 시작했다.' },
      { who: 'narr', text: '길을 잃은 친구들은 불안해했고, 도시 곳곳에서 작은 소동이 벌어졌다.' },
      { who: 'narr', text: '솔 탐정 사무소의 견습 탐정 아서와 에리가 도시를 걸으며 단서를 모은다.' }
    ],
    lines: [
      { who: 'prof', text: '어서 오렴. 해솔항 지부에 온 걸 환영한다.' },
      { who: 'prof', text: '여기서는 의뢰가 사무소 안에서만 오지 않는단다. 도시를 걷다 보면 부탁도, 단서도, 친구도 만나게 돼.' },
      { who: 'huru', text: '나는 후루야. 걷다가 궁금한 게 생기면 내가 옆에서 알려 줄게.' },
      { who: 'prof', text: '불안해하는 친구를 만나면 겁주지 말고 진정시켜 주렴. 쓰러뜨리는 게 아니야.' }
    ],
    whoTitle: '솔 탐정 사무소의 탐정들',
    who: [
      { id: 'arthur', role: '견습 탐정', text: '돋보기로 현장의 흔적을 살핀다.', line: '단서는 발로 찾는 거야.' },
      { id: 'eri', role: '견습 탐정', text: '수첩에 단서를 적고 정리한다.', line: '수첩에 적어 두면 잊지 않아.' },
      { id: 'huru', role: '안내', text: '도시를 걷는 동안 옆에서 알려 준다.', line: '궁금하면 말해 줘!' }
    ],
    stepsTitle: '해솔항에서 하는 일',
    steps: [['걷기', '큰길·골목·부두·옥상을 직접 걸어 다닌다'], ['의뢰', '도시 사람들의 부탁을 듣고 사건을 따라간다'], ['단서', '반짝이는 곳을 살펴 수첩에 적는다'], ['훈련', '붉은 범위를 피하고 빈틈을 쳐서 불안한 친구를 진정시킨다'], ['친구', '진정된 친구는 함께 다닌다. 세 자리까지 편성한다'], ['수집', '도시에 흩어진 반짝 조각을 모은다']],
    last: [{ who: 'prof', text: '먼저 큰길 표지판 가게의 쿠루를 만나 보렴. 표지판이 이상하다고 하더구나.' }]
  };
  G.epilogue = { title: '1부 끝', line: '등대가 다시 켜졌다. 항로표는 제자리로 돌아왔다.', friends: ['malangbul', 'bangului', 'mongeul'] };
  G.controls = [['W A S D · ↑ ↓', '걷기'], ['Shift', '달리기'], ['마우스 끌기 · ← →', '시점 돌리기'], ['F', '말 걸기 · 살펴보기'], ['1 · 2', '앞장 탐정 바꾸기'], ['3', '친구 신호'], ['Tab', '메뉴'], ['M', '지도'], ['J', '의뢰']];

  // ── 사람(몬스터 주민)들 ── model: 모델, at: 서는 자리
  G.npcs = {
    kuru: { name: '쿠루', model: 'banjjak', role: '표지판 가게', at: [9.8, -6.1], chat: ['표지판을 고치려면 도움이 필요해요.', '밤에는 표지판이 더 헷갈려요.'] },
    bori: { name: '보리', model: 'bori', role: '골목 지킴이', need: 'sign', at: [-20.2, -6.0], chat: ['골목은 어두워서 무서워요.', '말랑불이 있으면 든든하겠죠.'] },
    captain: { name: '파도 선장', model: 'mongeul', role: '부두 관리', at: [8.2, 24.6], chat: ['밤바다는 부표가 길잡이야.', '자네들도 조심해서 다니게.'] },
    dash: { name: '반짝이', model: 'malangbul', role: '심부름꾼', at: [14.5, 3.6], chat: ['나는 이 도시에서 제일 빨라!'] },
    ally_sera: {
      name: '세라', model: 'ally_sera', role: '항구 기록 감식사', need: 'harbor', at: [12.2, 27.7],
      chat: ['진술은 끝까지 듣고, 기록은 두 번 확인하는 거예요.'],
      rareLead: 'w_rock_warden',
      before: [
        '저는 항구 기록 감식사 세라예요. 항로표의 수정 날짜를 정박 일지와 대조했어요.',
        '부표는 이제 제자리예요. 등대까지 켜지면 동쪽 화물 마당에 남은 기록도 확인할 수 있어요.'
      ],
      clue: [
        '등대가 켜지고 보니 동쪽 화물 마당의 돌기둥이 제 발로 움직였어요. 항구 기록에는 바위수호라고 적혀 있어요.',
        '쌓인 짐에 익숙한 길이 막혀서 놀란 것 같아요. 동쪽 화물 마당 끝에서 조용히 다가가 보세요.'
      ]
    }
  };

  // ── 사건(의뢰) ── type: main | side. steps는 차례로 한다.
  // clues: 살펴볼 곳(x, z, h는 높이), hidden이면 말랑불 같은 빛 친구가 곁에 있어야 보인다
  G.quests = [
    { id: 'sign', main: 1, title: '거꾸로 걸린 표지판', zone: '큰길', giver: 'kuru', need: null,
      brief: '큰길 표지판 세 곳이 거꾸로 돌아가 있다. 누가, 왜 돌렸을까.',
      talk: [
        { who: 'kuru', text: '탐정님! 큰길 표지판이 밤새 전부 거꾸로 돌아갔어요.' },
        { who: 'kuru', text: '길 안내가 뒤바뀌니까 친구들이 자꾸 길을 잃어요. 저도 가게 문을 못 열고 있고요.' },
        { who: 'lead', text: '알겠어요. 먼저 표지판부터 살펴볼게요.' },
        { who: 'huru', text: '표지판은 큰길 교차로 근처 세 군데에 서 있어. 가까이 가서 F를 눌러 봐.' }
      ],
      clues: [
        { x: 6.1, z: -5.7, label: '북쪽 표지판', text: '기둥 아래 흙이 파여 있다. 누군가 표지판을 힘껏 돌린 자국이다.', note: '표지판을 힘으로 돌린 자국이 있다.' },
        { x: -6.6, z: -5.7, label: '서쪽 표지판', text: '표지판 뒤에 나사가 떨어져 있다. 풀린 게 아니라 눌려서 헐거워졌다.', note: '나사가 눌려서 헐거워졌다.' },
        { x: 5.8, z: 5.8, label: '남쪽 표지판', text: '바닥에 커다란 발자국이 이어진다. 발자국은 큰길 가운데 광장으로 향한다.', note: '큰 발자국이 광장으로 이어진다.' }
      ],
      after: [{ who: 'huru', text: '큰 발자국이 광장으로 가고 있어. 따라가 보자!' }],
      boss: { monster: 'bori', name: '보리', arena: 'plaza', at: [9, 0], title: '표지판 앞에서', hint: '광장으로 가서 보리를 진정시킨다',
        intro: [{ who: 'narr', text: '광장 한가운데, 커다란 보리가 표지판 기둥을 붙잡고 떨고 있다.' }, { who: 'bori', text: '길이… 길이 다 바뀌었어. 어디로 가야 해…!' }],
        duel: { monster: 'bori', name: '보리', title: '표지판 앞에서', reason: '길을 잃은 보리를 진정시킨다.', mode: 'action', tip: '보리가 붉은 범위를 띄웁니다. 그 밖으로 피하면 빈틈이 생깁니다.', tough: 1, act: { speed: 2.6, range: 3.9, tele: 1.8, tmin: 1.3, r: 2.1, pats: ['circle'], gap: 2.0, hit: 12, rec: 1.1, strike: 4 } } },
      outro: [
        { who: 'bori', text: '미안해… 길이 바뀌어서 어디로 가야 할지 몰랐어. 무서워서 표지판만 붙잡고 있었어.' },
        { who: 'lead', text: '이제 괜찮아. 표지판은 우리가 바로잡을게.' },
        { who: 'huru', text: '표지판이 제자리로 돌아간다! 어, 기둥 뒤에서 뭔가 반짝이는데?' },
        { who: 'huru', text: '말랑불이야. 어두운 곳을 환하게 밝혀 주는 친구야. 함께 다니자고 하네!' }
      ],
      reward: { friend: 'malangbul', effect: 'signs' }, next: 'alley' },
    { id: 'alley', main: 2, title: '꺼진 골목 등', zone: '골목', giver: 'bori', need: 'sign',
      brief: '골목의 등이 하나도 켜지지 않는다. 어두운 곳엔 빛 친구가 필요하다.',
      talk: [
        { who: 'bori', text: '탐정님, 아까는 미안했어요. 보답으로 알려 드릴게요. 골목 등이 어젯밤부터 하나도 안 켜져요.' },
        { who: 'bori', text: '골목 안쪽에서 반짝이는 소리가 나요. 저는 무서워서 못 들어가요.' },
        { who: 'huru', text: '어두운 곳엔 빛이 필요해. 말랑불이 곁에 있으면 숨은 단서도 보일 거야.' }
      ],
      hidden: true, noLight: [{ who: 'huru', text: '너무 어두워서 안 보여. 불빛을 내는 친구가 필요해. 편성에 말랑불이 있는지 확인하자.' }],
      clues: [
        { x: -20, z: -16.6, label: '꺼진 가로등', text: '가로등 안의 등불이 식어 있다. 꺼진 게 아니라 누가 빛을 빨아 간 것처럼 차갑다.', note: '등불이 빨려 나간 듯 차갑다.' },
        { x: -30, z: -21.6, label: '골목 벽', text: '벽에 반짝이는 가루가 묻어 있다. 가루는 골목 안쪽 공터까지 점점이 이어진다.', note: '반짝이는 가루가 공터로 이어진다.' },
        { x: -47, z: -21.6, label: '쓰러진 상자', text: '상자 안이 텅 비었다. 바닥에 작은 돌조각이 빛나고 있다.', note: '상자 안에 빛나는 돌조각이 있다.' }
      ],
      after: [{ who: 'huru', text: '공터에서 반짝반짝 소리가 나. 반짝돌이 있나 봐!' }],
      boss: { monster: 'banjjak', name: '반짝돌', arena: 'yard', at: [-37, -22], title: '어둠 속 움직임', hint: '골목 공터로 가서 반짝돌을 진정시킨다',
        intro: [{ who: 'narr', text: '골목 공터. 반짝돌이 모은 불빛을 끌어안고 웅크려 있다.' }, { who: 'banjjak', text: '불빛이 사라지니까 무서웠어. 아무도 가져가지 마!' }],
        duel: { monster: 'banjjak', name: '반짝돌', title: '어둠 속 움직임', reason: '불안한 반짝돌을 어두운 골목에서 진정시킨다.', tip: '반짝돌이 빛줄기를 쏩니다. 띠 모양 범위는 옆으로 피합니다.', hit: 9, every: 2.1, tough: 2.1, shot: '#d8d2ff', mode: 'action', act: { speed: 3.2, range: 4.6, tele: 1.6, tmin: 1.05, r: 2.2, pats: ['circle', 'line', 'circle', 'line'], gap: 1.8, hit: 14, rec: .9, strike: 4 } } },
      outro: [
        { who: 'banjjak', text: '미안해. 불빛을 몰래 모아 뒀어. 이제 돌려줄게.' },
        { who: 'huru', text: '골목 등이 하나씩 켜진다! 빗물통 안에서 뭔가 튀어나왔어.' },
        { who: 'huru', text: '방울이야. 물로 지워진 흔적도 되살려 주는 친구래. 같이 가자!' }
      ],
      reward: { friend: 'bangului', effect: 'alley' }, next: 'harbor' },
    { id: 'harbor', main: 3, title: '뒤바뀐 항로표', zone: '부두', giver: 'captain', need: 'alley',
      brief: '부두의 부표 세 개가 엉뚱한 곳으로 불빛을 보내고 있다.',
      talk: [
        { who: 'captain', text: '자네들이 탐정이군. 부두 부표 세 개가 밤마다 엉뚱한 곳으로 불빛을 보내고 있어.' },
        { who: 'captain', text: '배들이 항구 입구를 못 찾고 빙글빙글 돌아. 부표를 하나씩 살펴봐 주게.' },
        { who: 'huru', text: '부표는 부두 양쪽 끝과 선착장 끝에 있어.' }
      ],
      clues: [
        { x: -18, z: 30.6, label: '서쪽 부표', text: '부표 안쪽 전선이 눌려 있다. 전기가 한쪽으로만 흘렀다.', note: '부표 전선이 눌려 있다.' },
        { x: 16, z: 30.6, label: '동쪽 부표', text: '부표 불빛이 바다가 아니라 건물 쪽을 가리킨다. 도시 안쪽 옥상 방향이다.', note: '불빛이 옥상 쪽을 가리킨다.' },
        { x: 25, z: 47.2, label: '선착장 끝 부표', text: '부표 밑에서 물결이 거꾸로 돈다. 물 친구가 불안해하고 있는 것 같다.', note: '물결이 거꾸로 돈다.' }
      ],
      after: [{ who: 'huru', text: '물결이 심상치 않아. 부두 쪽에서 가람이가 올라오고 있어!' }],
      boss: { monster: 'garam', name: '가람이', arena: 'quay', at: [6, 29.5], title: '거꾸로 도는 물결', hint: '부두 광장으로 가서 가람이를 진정시킨다',
        intro: [{ who: 'narr', text: '부두 광장 바닥이 젖어 있다. 가람이가 물결 가운데에서 맴돌고 있다.' }, { who: 'garam', text: '물결이 거꾸로 돌아… 어디가 바다인지 모르겠어.' }],
        duel: { monster: 'garam', name: '가람이', title: '거꾸로 도는 물결', reason: '물결을 잃은 가람이를 부두에서 진정시킨다.', tip: '가람이의 물결은 안쪽 원이 안전합니다. 가까이 붙어서 피할 수도 있습니다.', hit: 9, every: 2, tough: 2.6, shot: '#9fd8f2', mode: 'action', act: { speed: 3, range: 4.1, tele: 1.6, tmin: 1.05, r: 2.2, pats: ['circle', 'donut', 'line', 'donut'], gap: 1.7, hit: 14, rec: .9, strike: 4 } } },
      outro: [
        { who: 'garam', text: '물결이 거꾸로 돌아서 길을 잃었어. 신호가 아주 높은 데서 오고 있어.' },
        { who: 'huru', text: '부표가 하나씩 켜진다! 부표 위에서 몽글번개가 내려왔어.' },
        { who: 'huru', text: '전기로 닫힌 문도 열 수 있는 친구야. 함께 가자!' }
      ],
      reward: { friend: 'mongeul', effect: 'buoys' }, next: 'roof' },
    { id: 'roof', main: 4, title: '옥상의 신호', zone: '옥상', giver: 'huru', need: 'harbor', auto: true,
      brief: '마지막 신호등은 해솔 종합상가 옥상에 있다. 전자 자물쇠는 전기 친구가 연다.',
      talk: [
        { who: 'huru', text: '부표 불빛이 가리킨 곳이 있었지? 해솔 종합상가 옥상이야.' },
        { who: 'huru', text: '입구는 전자 자물쇠로 잠겨 있어. 몽글번개가 곁에 있어야 열려.' }
      ],
      clues: [
        { x: 24.6, z: -21.2, h: 14.4, label: '옥상 안테나', text: '안테나 끝이 바다 반대쪽으로 꺾여 있다. 누군가 신호를 도시 안쪽으로 돌렸다.', note: '안테나가 도시 안쪽으로 꺾였다.' },
        { x: 37.6, z: -11.8, h: 14.4, label: '환풍기', text: '환풍기 안에서 낮은 번개 소리가 난다. 만져 보니 따뜻하다.', note: '환풍기 안이 번개로 따뜻하다.' },
        { x: 31, z: -20.4, h: 14.4, label: '신호등', text: '등대로 신호를 보내던 신호등이 꺼져 있다. 전선이 구름처럼 엉켜 있다.', note: '신호등 전선이 엉켜 있다.' }
      ],
      after: [{ who: 'huru', text: '하늘이 어두워졌어. 뇌운몽글이 내려온다!' }],
      boss: { monster: 'mongeul2', name: '뇌운몽글', arena: 'roof', at: [31, -16], title: '옥상의 번개', hint: '옥상 가운데에서 뇌운몽글을 진정시킨다',
        intro: [{ who: 'narr', text: '옥상 한가운데, 전선을 구름처럼 두른 뇌운몽글이 웅웅 울고 있다.' }, { who: 'mongeul2', text: '신호가 엉켜서… 머릿속이 번쩍번쩍해!' }],
        duel: { monster: 'mongeul2', name: '뇌운몽글', title: '옥상의 번개', reason: '엉킨 신호에 놀란 뇌운몽글을 옥상에서 진정시킨다.', tip: '큰 번개는 범위가 가로로 셋 늘어섭니다. 앞이나 뒤로 빠져나갑니다.', hit: 9, every: 2, burst: 8, tough: 3.6, shot: '#e6ff7a', mode: 'action', act: { speed: 3.4, range: 4.5, tele: 1.5, tmin: 1, r: 2.1, pats: ['line', 'circle', 'triple', 'donut'], gap: 1.6, hit: 16, rec: .8, strike: 4 } } },
      outro: [
        { who: 'mongeul2', text: '엉킨 전선이 풀렸어. 이제 신호를 제대로 보낼 수 있어.' },
        { who: 'huru', text: '옥상 신호등이 켜진다! 저 멀리 등대에도 불이 들어왔어.' },
        { who: 'lead', text: '항로표가 다 제자리로 돌아왔어. 해솔항이 다시 길을 찾았네.' }
      ],
      reward: { effect: 'lighthouse' }, end: true },
    // 곁가지 의뢰
    { id: 'box', side: 1, title: '잊힌 항로표 상자', zone: '큰길 → 부두', giver: 'kuru', need: 'sign', deliver: 'captain',
      brief: '쿠루의 상자를 부두의 파도 선장에게 전한다.',
      talk: [
        { who: 'kuru', text: '탐정님, 부탁 하나만 더요. 이 상자를 부두의 파도 선장님께 전해 주세요.' },
        { who: 'kuru', text: '낡은 항로표 부품이 들어 있대요. 흔들지 말고요!' }
      ],
      done: [{ who: 'captain', text: '오, 항로표 부품이군. 흔들리지 않게 잘 가져왔네. 이걸로 부표를 손볼 수 있겠어.' }, { who: 'captain', text: '수고비일세. 부두에서 주운 반짝 조각이야. 받게.' }, { who: 'huru', text: '반짝 조각 세 개를 받았어. 배달도 탐정의 일이네!' }],
      reward: { spark: 3 } },
    { id: 'run', side: 2, title: '달아나는 심부름꾼', zone: '큰길', giver: 'dash', need: null,
      brief: '반짝이가 쏜살같이 달아난다. 제한 시간 안에 따라잡는다.',
      talk: [
        { who: 'dash', text: '탐정님이다! 나를 잡을 수 있으면 잡아 봐!' },
        { who: 'huru', text: (window.DeviceHint && window.DeviceHint.touch) ? '쫓아가자! "달리기"를 누르면 달릴 수 있어.' : '쫓아가자! Shift를 누르면 달릴 수 있어.' }
      ],
      path: [[26, 5.6], [50, 5.6], [50, 22.5], [30, 26.6], [4, 28.4]], time: 42,
      done: [{ who: 'dash', text: '헉헉… 잡혔다! 너 정말 빠르구나. 내가 모은 조각 나눠 줄게!' }, { who: 'huru', text: '반짝이가 길에서 모은 조각이래. 세 개를 받았어!' }],
      fail: [{ who: 'dash', text: '못 잡았지? 다시 해 보고 싶으면 말 걸어!' }],
      reward: { spark: 3 } }
  ];
  // 곳곳에 흩어진 반짝 조각(주우면 사라진다)
  G.sparks = [[3.2, -6.2], [-30, 5.9], [-54, -5.6], [47, 5.8], [-18.4, -31], [-36.5, -26.6], [-56, -22], [12, 20.2], [-48, 29.4], [26.4, 44], [48, 19.8], [34.5, -15.2, 14.4], [76, 5.8], [100, -5.8], [128, 0.4]];
  // 불안한 친구들(처음 진정시키면 함께 다닌다). 사는 자리 zone은 훈련 자리 이름
  G.wild = [
    { id: 'w1', monster: 'banjjak', name: '반짝돌', calm: '빛을 잔뜩 끌어안고 지키느라 지쳤었대. 이제 한숨 돌렸어.', arena: 'plaza', at: [-8.5, 2.6], tough: 1.2, patterns: ['circle'], range: 3.9 },
    { id: 'w2', monster: 'bori', name: '보리', calm: '길을 잃고 한참 헤맸대. 안심이 되니 배가 고프다네.', arena: 'yard', at: [-36, -17.6], tough: 1.4, patterns: ['circle', 'line'], range: 4.2 },
    { id: 'w3', monster: 'garam', name: '가람이', calm: '물결이 잔잔해지니 바다가 어디인지 다시 알겠대.', arena: 'quay', at: [-9, 30], tough: 1.6, patterns: ['circle', 'donut'], range: 4 },
    { id: 'w4', monster: 'mongeul', name: '몽글번개', calm: '쌓인 전기를 털어 내니 몸이 가벼워졌대.', arena: 'cargo', at: [54, 28.6], tough: 1.8, patterns: ['circle', 'line', 'donut'], range: 4.2 }
  ];
  G.wild.push({
    id: 'w_rock_warden', monster: 'heuk_s3', name: '바위수호', need: 'roof', rare: true, title: '바위 파동',
    calm: '통로가 뚫려 있다는 걸 보자 돌주먹을 내려놓았어.',
    arena: 'cargo', at: [58, 30.4], tough: 2.15, patterns: ['circle', 'line', 'donut'], range: 4.6
  });
  // 옛 '사건 목록' 모양을 쓰는 확인용 주소(?go=battle&case=2)를 위한 짧은 형태
  G.cases = G.quests.filter(q => q.main).map(q => ({ id: q.id, no: q.main, title: q.title, scene: 'harbor', kind: 'world', world: true, helper: q.reward && q.reward.friend, task: q.brief, request: q.brief, goal: q.brief,
    chapter: { mark: ['기', '승', '전', '결'][q.main - 1], name: '', line: '' }, clues: q.clues.map(c => ({ id: c.label, label: c.label, text: c.text, note: c.note })), duel: q.boss.duel }));
  // 도감과 반짝 조각 이야기
  G.dex = [
    { k: 'malangbul', where: '큰길 광장', note: '표지판이 바로잡히자 기둥 뒤에서 나왔다. 숨은 단서를 비춰 준다.', hint: '첫 사건이 끝나면 만난다.' },
    { k: 'bangului', where: '골목 공터', note: '빗물통 안에서 튀어나왔다. 지워진 흔적을 되살린다.', hint: '어두운 골목의 사건을 해결하면 만난다.' },
    { k: 'mongeul', where: '부두 광장', note: '꺼진 부표 위로 내려왔다. 닫힌 전자 자물쇠를 열어 준다.', hint: '부두의 사건을 해결하면 만난다.' },
    { k: 'banjjak', where: '큰길 광장 근처', note: '불안하면 모아 둔 빛을 끌어안고 웅크린다.', hint: '큰길 광장에서 서성이는 불안한 친구를 진정시키면 만난다.' },
    { k: 'bori', where: '골목 공터', note: '힘이 세다. 길을 잃으면 표지판 기둥을 붙잡고 떤다.', hint: '골목 공터 둘레에서 불안해하는 친구가 있다.' },
    { k: 'garam', where: '해솔 부두', note: '물결이 거꾸로 돌면 어디가 바다인지 헷갈려 한다.', hint: '부두 서쪽에서 불안한 친구를 진정시키면 만난다.' },
    { k: 'heuk_s3', where: '동쪽 화물 마당', note: '등대가 켜진 뒤 세라의 기록을 따라 만난 희귀 친구다.', hint: '등대를 다시 켠 뒤 해솔 부두에서 세라에게 항구 기록을 물어보자.' }
  ];
  G.milestones = {
    7: [{ who: 'huru', text: '반짝 조각이 일곱 개나 모였어! 이거, 가로등 불빛이 모인 조각이래.' }, { who: 'huru', text: '도시 끝까지 걸어 보면 더 있을지도 몰라. 언덕 쪽도 가 봤어?' }],
    14: [{ who: 'huru', text: '열네 개째야. 길가에 떨어진 조각을 줍는 것도 탐정의 일이지!' }],
    21: [{ who: 'huru', text: '반짝 조각을 모두 모았어! 해솔항 구석구석을 다 걸어 다녔다는 뜻이야.' }, { who: 'lead', text: '사건만 풀 줄 알았는데, 도시를 걷는 것도 재밌네.' }, { who: 'huru', text: '탐정은 걷다가 만나는 사람들 이야기도 들어야 하니까. 수고했어!' }]
  };
  G.guideWorld = (window.DeviceHint && window.DeviceHint.touch) ? [
    ['.w-mini', '오른쪽 위가 지도야. 연두색 표시가 지금 갈 곳이고, 빨간 점은 불안한 친구야.', 'right:330px;top:90px'],
    ['.w-obj', '왼쪽 위에는 지금 할 일이 보여. 화살표가 가는 방향을 가리켜.', 'left:440px;top:230px'],
    [null, '왼쪽 ▲◀▶▼ 단추로 걷고, 오른쪽 "달리기"를 누르면 달려. "행동"을 누르면 말을 걸고 살펴볼 수 있어.', 'right:60px;bottom:330px'],
    [null, '"아서"·"에리" 단추로 앞장서는 탐정을 바꾸고, "친구"는 친구 신호야. "메뉴"에서 지도와 의뢰 목록을 볼 수 있어.', 'right:60px;bottom:330px']
  ] : [
    ['.w-mini', '오른쪽 위가 지도야. 연두색 표시가 지금 갈 곳이고, 빨간 점은 불안한 친구야.', 'right:330px;top:90px'],
    ['.w-obj', '왼쪽 위에는 지금 할 일이 보여. 화살표가 가는 방향을 가리켜.', 'left:440px;top:230px'],
    ['.w-party', '왼쪽 아래는 파티야. 1, 2로 앞장 탐정을 바꾸고, 3은 친구 신호야.', 'left:60px;bottom:330px'],
    ['.w-keys', 'WASD나 ↑↓로 걷고, ←→로 시점을 돌려. Shift를 누르면 달리고 F로 살펴봐.', 'right:60px;bottom:330px'],
    ['.w-keys', '마우스를 끌면 시점이 돌아가고, 휠로 멀리 볼 수 있어. M은 큰 지도, J는 의뢰 목록이야.', 'right:60px;bottom:330px']
  ];
})();
