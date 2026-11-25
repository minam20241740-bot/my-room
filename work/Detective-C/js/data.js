'use strict';
// 게임에 나오는 글과 사건 자료. 사건 내용은 기존 게임의 사건 기록에서 그대로 옮겼다.
window.GAME = {
  title: '도시의 몬스터와 탐정 사무소 ARCHIVE',
  office: '솔 탐정 사무소',
  leads: {
    arthur: { name: '아서', img: 'img/arthur.png', cutin: 'img/arthur-cutin.png' },
    eri: { name: '에리', img: 'img/eri.png', cutin: 'img/eri-cutin.png' }
  },
  names: { huru: '후루', prof: '솔 탐정', narr: '' },
  tips: [
    '현장에서는 단서 세 곳을 먼저 조사합니다.',
    '단서를 모으면 수첩에 적힙니다.',
    '사건을 해결하면 새 친구가 사무소에 찾아옵니다.'
  ],
  lobbyLines: {
    arthur: ['오늘 들어온 의뢰부터 볼까?', '단서는 발로 찾는 거야.', '창밖이 맑네. 조사하기 좋은 날이야.'],
    eri: ['의뢰서는 내가 정리해 뒀어.', '수첩에 적어 두면 잊지 않아.', '준비되면 말해 줘. 같이 가자.']
  },
  menus: [['waiting', '대기실'], ['friends', '친구'], ['team', '편성'], ['book', '도감'], ['note', '수첩']],
  caseTitles: ['달빛 베이커리', '어두운 창고', '연못가 오두막', '달빛 시계탑'],   // 일주일 안에 만드는 사건 4개(기승전결)
  // 기술 카드(제안). 이름과 수치는 새로 정한 것이라 검토가 필요하다.
  cards: [
    { id: 'big', who: 'arthur', name: '돋보기 조준', cost: 3, text: '큰 훈련탄 한 발' },
    { id: 'fast', who: 'eri', name: '수첩 분석', cost: 2, text: '팀 발사 간격 절반 · 6초' },
    { id: 'heal', who: 'huru', name: '후루의 응원', cost: 4, text: '팀원 집중 35 회복' },
    { id: 'light', who: 'malangbul', name: '환한 불빛', cost: 2, text: '8초 동안 더 넓게 비춘다', gate: 'light' },   // gate: 그 규칙이 있는 훈련에서만 나온다
    { id: 'water', who: 'bangului', name: '물줄기', cost: 2, text: '물속의 상대를 부른다', gate: 'pond' },
    { id: 'zap', who: 'mongeul', name: '번쩍', cost: 2, text: '상대의 충전을 끊는다', gate: 'charge' }
  ],
  // 사건을 해결하면 대기실에 오는 친구. 이름·속성·설명은 기존 게임의 도우미 기록에서 옮겼다.
  friends: {
    malangbul: { name: '말랑불', tag: '빛', img: 'img/malangbul.png', desc: '어두운 곳을 환하게 밝힌다', light: 1 },
    bangului: { name: '방울이', tag: '물', img: 'img/bangului.png', desc: '물을 뿌려 지워진 흔적을 드러낸다', water: 1 },
    mongeul: { name: '몽글번개', tag: '전기', img: 'img/mongeul.png', desc: '찌릿한 전기로 장치를 작동시킨다' }
  },
  // 자물쇠의 기호. 이름은 기존 게임 그대로, 그림(d)은 새로 그렸다. 64×64 칸 기준.
  symbols: [
    { id: 'moon', name: '달', color: '#ffc928', d: 'M40 8a24 24 0 1 0 16 38A20 20 0 0 1 40 8z' },
    { id: 'star', name: '별', color: '#ffc928', d: 'M32 6l7.6 16.6 18 2-13.4 12.2 3.8 17.8L32 45.6 16 54.6l3.8-17.8L6.4 24.6l18-2z' },
    { id: 'fire', name: '불꽃', color: '#f2683c', d: 'M32 4c4 10 16 16 16 32a16 16 0 0 1-32 0c0-8 4-12 8-18 2 6 6 6 6 2 0-6 0-10 2-16z' },
    { id: 'drop', name: '물방울', color: '#1a9df5', d: 'M32 6c8 12 18 22 18 34a18 18 0 0 1-36 0c0-12 10-22 18-34z' }
  ],
  // 처음 시작할 때의 소개. 솔 탐정의 말은 기존 게임의 대사에서 가져왔고(앞뒤를 줄였다), 후루의 뒷말과 인물 소개, '사건을 푸는 순서'는 새로 썼다(검토 필요).
  // 인물의 한마디(line)는 로비에서 쓰는 말 그대로다. 기억을 잃었다는 기존 설정은 넣지 않았다(쓸지 정해지지 않음).
  opening: {
    // 서막(새로 쓴 문장, 검토 필요). 시계탑 표지판의 "시계가 멈춘 뒤로 마을의 달빛이 사라졌습니다"와 기존 사건들을 이은 것이다.
    prologue: [
      { who: 'narr', text: '이곳은 몬스터 친구들이 사는 달빛 마을.' },
      { who: 'narr', text: '마을 한가운데 시계탑이 달빛을 나눠 준다. 그런데 시계탑이 멈추자, 달빛이 사라졌다.' },
      { who: 'narr', text: '달빛이 약해지자 몬스터 친구들은 몸이 불안해져 엉뚱한 일을 벌이기 시작했다.' },
      { who: 'narr', text: '솔 탐정 사무소의 견습 탐정, 아서와 에리가 단서를 모아 친구들을 진정시키고 달빛을 되찾는다.' }
    ],
    lines: [
      { who: 'prof', text: '나는 이 마을의 탐정, 솔이란다.' },
      { who: 'prof', text: '내 밑에서 견습 탐정으로 마을의 사건을 하나씩 풀어 보렴.' },
      { who: 'huru', text: '나는 후루야. 사건이 들어오면 내가 옆에서 알려 줄게.' }
    ],
    whoTitle: '솔 탐정 사무소의 탐정들',
    who: [
      { id: 'arthur', role: '견습 탐정', text: '돋보기로 현장의 흔적을 살핀다.', line: '단서는 발로 찾는 거야.' },
      { id: 'eri', role: '견습 탐정', text: '수첩에 단서를 적고 정리한다.', line: '수첩에 적어 두면 잊지 않아.' },
      { id: 'huru', role: '안내', text: '사건이 들어오면 옆에서 알려 준다.', line: '준비되면 말해 줘!' }
    ],
    stepsTitle: '사건은 이렇게 풉니다',
    steps: [['의뢰', '사무소에 사건이 들어온다'], ['편성', '함께 갈 팀을 고른다'], ['현장 조사', '반짝이는 곳을 살펴 단서를 모은다'], ['진정 훈련', '붉은 범위를 피하고 빈틈에 타격해 몬스터 친구를 안정시킨다'], ['추리', '모은 단서로 사건을 푼다'], ['새 친구', '해결하면 친구가 사무소에 온다']],
    last: [{ who: 'prof', text: '마침 달빛 베이커리에서 쿠키가 사라지는 사건이 났다더구나. 첫 의뢰다.' }]
  },
  // 처음 한 번만 나오는 후루의 안내(새로 쓴 문장, 검토 필요). [밝힐 곳, 말, 말풍선 자리]. %s에는 훈련 상대의 이름이 들어간다.
  guide: {
    lobby: [
      ['.plate', '여기는 솔 탐정 사무소야. 지금 앞장선 탐정이 보여. 아래 단추로 아서와 에리를 바꿀 수 있어.', 'left:60px;top:260px'],
      ['.prog', '사건을 하나 해결할 때마다 사건 기록이 한 칸씩 채워져.', 'left:530px;top:150px'],
      ['.req', '새 의뢰가 들어왔어. 의뢰서를 눌러서 첫 사건을 시작하자!', 'right:60px;bottom:330px']
    ],
    team: [
      ['.tm-lead', '왼쪽이 앞장서는 탐정이야. 눌러서 아서와 에리를 바꿔.', 'left:960px;top:200px'],
      ['.tm-rows', '함께 나갈 친구 세 자리야. 친구를 누르면 대기실로 돌아가.', 'left:60px;bottom:40px'],
      ['.wait', '사건을 해결하면 친구가 대기실에 와. 눌러서 넣어.', 'left:60px;bottom:40px'],
      ['.tfoot', '준비됐으면 출동을 눌러.', 'right:640px;bottom:140px']
    ],
    probe: [
      ['.mk', '반짝이는 표시를 누르면 탐정이 걸어가서 살펴봐.', 'left:530px;bottom:60px'],
      ['.fclues', '살펴본 곳은 여기에 표시되고 수첩에 적혀. 모두 조사하자.', 'left:60px;top:250px']
    ],
    battle: [
      ['.bgauge', '위쪽 막대가 끝까지 차면 %s 안정돼. 훈련탄은 팀이 알아서 쏴.', 'left:530px;top:190px'],
      ['.bteam', '팀의 집중이야. 상대가 던진 걸 맞으면 줄어. 모두 바닥나면 훈련이 끝나.', 'left:480px;bottom:60px'],
      ['.bcost', '시간이 지나면 칸이 하나씩 차.', 'right:60px;bottom:330px'],
      ['.bcards', '칸이 차면 카드를 눌러 기술을 써 봐. 카드의 숫자만큼 칸을 써.', 'right:60px;bottom:330px'],
      ['.top', '자동을 켜면 카드를 알아서 써. 2배는 빠르게, 멈춤은 잠깐 쉬는 단추야.', 'right:60px;top:130px']
    ],
    action: [
      ['.bgauge', '위쪽 막대가 끝까지 차면 %s 안정돼. 쓰러뜨리는 게 아니야.', 'left:530px;top:190px'],
      ['.bteam', '탐정 둘의 집중이야. 공격을 맞으면 줄어. 둘 다 0이 되면 다시 도전해야 해.', 'left:480px;bottom:60px'],
      ['.akeys', '움직이기는 WASD나 방향키. 피하기, 타격, 교대, 결정적 추리는 이 단추나 적힌 키로 해.', 'right:60px;bottom:330px']
    ],
    // 첫 훈련에서 직접 해 보는 순서의 한 줄들(field.js의 actTut)
    actStep: {
      move: '방향키나 WASD로 움직여 봐.',
      dodge: '붉은 범위가 뜨면 그 밖으로 피해.',
      dodge2: '맞아도 괜찮아. 한 번 더 피해 보자.',
      strike: '빈틈이야. 타격을 눌러 봐.',
      swap: '교대를 눌러 동료로 바꿔 봐.',
      dash: '피하기를 누르면 짧게 달려서 빠져나가.',
      chain: '빈틈 게이지가 찼어. 결정적 추리를 눌러 봐.',
      done: '공격이 터지는 순간에 맞춰 피하면 아슬한 회피. 반격이 두 배로 들어가.'
    },
    deduce: [
      ['.dnote', '현장에서 적은 단서야.', 'left:640px;top:330px'],
      ['.dsus', '친구마다 특징이 달라. 단서와 모두 맞는 친구를 고르고 "범인 맞히기"를 눌러.', 'left:40px;top:330px;width:560px']
    ]
  },
  // 마지막 사건을 풀고 나서 보여 주는 결말 화면(새로 쓴 문장, 검토 필요)
  epilogue: { title: '1부 끝', line: '달빛 마을에 달빛이 돌아왔다.', friends: ['malangbul', 'bangului', 'mongeul'] },
  // 화면을 잇기 위해 새로 쓴 문장(검토 필요). 사건 내용은 바꾸지 않았다.
  added: {
    cluesDone: [{ who: 'huru', text: '단서 세 개를 다 모았어. 수첩에 잘 적혔지?' }, { who: 'huru', text: '어, 저기 보리가 왔어. 추리하기 전에 몸부터 풀자고 하네!' }],
    wrong: [{ who: 'huru', text: '음, 단서와 맞지 않는 것 같아. 수첩을 다시 볼까?' }],
    probeHint: '반짝이는 곳을 눌러 조사합니다',
    lose: '탐정 둘의 집중이 다 떨어졌습니다. 다시 도전해 볼까요?'
  },
  // 현장에 세우는 3D 모델. 새 모델을 받으면 file만 바꾸면 된다(.vrm, .glb 모두 됨). height는 키(m), 0이면 모델 그대로. front: '+z'는 앞이 +z인 glb(VRM은 늘 +z).
  models: {
    arthur: { file: 'assets/chr/arthur2d.glb', height: 1.35, grounded: true},
    eri: { file: 'assets/chr/eri2d.glb', height: 1.35, grounded: true},
    huru: { file: 'assets/chr/huru.glb', height: .5 },
    bori: { file: 'assets/chr/bori.glb', height: .9 },
    malangbul: { file: 'assets/chr/malangbul.glb', height: .62 },
    banjjak: { file: 'assets/chr/banjjak.glb', height: .85 },
    bangului: { file: 'assets/chr/bangului.glb', height: .6 },
    garam: { file: 'assets/chr/garam.glb', height: .8 },
    mongeul: { file: 'assets/chr/mongeul.glb', height: .62 },
    mongeul2: { file: 'assets/chr/mongeul_s2.glb', height: 1 }
  },
  suspects: { kongkong: 'img/kongkong.png', byeolddong: 'img/byeolddong.png', pudding: 'img/pudding.png' },
  cases: [
    {
      id: 'bakery', no: 1, chapter: { mark: '기', name: '첫 번째 사건', line: '달빛이 약해진 첫 신호. 마을에서 달빛 쿠키가 사라졌다.' }, title: '달빛 베이커리', scene: 'street', task: '단서 3곳 조사', helper: 'malangbul',
      request: '달빛 베이커리의 소중한 달빛 쿠키가 사라졌대!',
      goal: '단서 3곳을 조사해서 범인을 맞히자',
      intro: [
        { who: 'huru', text: '달빛 베이커리의 소중한 달빛 쿠키가 사라졌대!' },
        { who: 'lead', text: '기억은 없어도 머리는 그대로야. 단서를 찾아볼게!' },
        { who: 'huru', text: '반짝이는 곳에 가까이 가서 조사해 봐. 단서를 모으면 수첩에 적힐 거야.' }
      ],
      clues: [
        { id: 'floor', label: '바닥의 자국', text: '길바닥에 끈적한 자국이 길게 이어져 있다. 발자국은 하나도 없다!', note: '발자국이 없고 끈적한 자국이 남아 있었다.' },
        { id: 'window', label: '가게 창문', text: '창문턱을 살폈다. 반짝이는 가루는 하나도 묻어 있지 않다.', note: '창문에 반짝이는 가루가 없었다.' },
        { id: 'plate', label: '쿠키 접시', text: '빈 접시에 달콤한 캐러멜 냄새가 진하게 남아 있다.', note: '빈 접시에서 달콤한 캐러멜 냄새가 났다.' }
      ],
      choices: [
        { id: 'kongkong', name: '콩콩이', traits: ['발이 있어서 발자국을 남김', '반짝이는 가루 없음', '끈적임 없음'] },
        { id: 'byeolddong', name: '별똥이', traits: ['둥둥 떠다녀서 발자국 없음', '지나가면 반짝이는 가루가 떨어짐', '끈적임 없음'] },
        { id: 'pudding', name: '푸딩이', traits: ['발이 없고 미끄러져 다님', '반짝이는 가루 없음', '몸이 끈적하고 캐러멜 향이 남'] }
      ],
      duel: { monster: 'bori', name: '보리', title: '첫 호흡 맞추기', reason: '보리가 힘을 낮춘 첫 진정 훈련입니다.',
        mode: 'action', tip: '보리가 붉은 범위를 띄웁니다. 그 밖으로 피하면 빈틈이 생깁니다.', tough: 1, act: { speed: 2.6, range: 3.9, tele: 1.8, tmin: 1.3, r: 2.1, pats: ['circle'], gap: 2.0, hit: 12, rec: 1.1, strike: 4 } },
      question: '달빛 쿠키를 가져간 친구는 누구일까?',
      answer: 'pudding',
      explanation: '정답! 푸딩이가 쿠키를 가져갔구나. 배가 너무 고파서 그랬대. 쿠키는 무사히 돌려받았어!',
      reward: '푸딩이가 고마워하며 말랑불을 소개해 줬어. 말랑불은 어두운 곳을 밝혀 주는 친구야.'
    },
    {
      // 범인을 맞히는 사건이 아니라, 빛을 내는 친구와 숨은 조각을 찾는 사건이다(kind: 'find').
      // 기존 글의 '박스'는 이 게임의 '대기실'로, '몹'은 '친구'로만 바꿨다.
      id: 'warehouse', no: 2, chapter: { mark: '승', name: '두 번째 사건', line: '어둠이 짙어졌다. 빛 없이는 창고 안이 보이지 않는다.' }, title: '어두운 창고', kind: 'find', scene: 'warehouse', task: '반짝 조각 3개 찾기', find: '반짝 조각 3개', helper: 'bangului',
      need: 'malangbul', needHint: '어둠에는 "빛" 속성이 필요해.',
      request: '푸딩이가 그러는데, 마을 창고에서 이상한 반짝임을 봤대.',
      goal: '대기실에서 알맞은 친구를 데려가 숨은 반짝 조각 3개를 찾자',
      brief: [
        { who: 'huru', text: '근데 창고 안은 엄청 어두워. 어둠 속에서는 아무것도 안 보여!' },
        { who: 'huru', text: '대기실에서 알맞은 친구를 한 마리 데려가자. 어떤 친구가 필요할까?' }
      ],
      noLight: [{ who: 'huru', text: '너무 어두워서 잘 안 보여… 불빛을 내는 친구가 필요해. 대기실에서 다시 골라 보자.' }],
      intro: [{ who: 'lead', text: '말랑불 덕분에 주변이 환해졌어! 이제 숨어 있는 걸 찾을 수 있겠어.' }],
      hint: '바닥을 눌러 걸어 다니며 반짝이는 곳을 찾습니다',
      clues: [
        { id: 'p1', label: '선반 아래', text: '선반 아래에서 반짝이는 조각을 하나 주웠다!', note: '반짝 조각 ① 선반 아래' },
        { id: 'p2', label: '통 뒤쪽', text: '통 뒤에 숨겨진 반짝 조각을 찾았다!', note: '반짝 조각 ② 통 뒤쪽' },
        { id: 'p3', label: '상자 옆', text: '상자 옆 바닥에서 마지막 조각을 발견했다!', note: '반짝 조각 ③ 상자 옆' }
      ],
      // 조사와 훈련을 잇기 위해 새로 쓴 문장(검토 필요)
      afterClues: [{ who: 'huru', text: '반짝 조각 세 개를 다 찾았어!' }, { who: 'huru', text: '어, 통 사이에서 반짝돌이 나왔어. 어두운 데서 같이 움직여 보자고 하네!' }],
      // 훈련 이름과 까닭은 기존 기록 그대로. tip과 숫자는 새로 정한 것(검토 필요)
      duel: { monster: 'banjjak', name: '반짝돌', title: '어둠 속 움직임', reason: '반짝돌과 훈련하며 어두운 곳에서도 동료의 움직임을 읽는다.',
        tip: '반짝돌이 빛줄기를 쏩니다. 띠 모양 범위는 옆으로 피합니다.', gate: 'light', tag: '', hit: 9, every: 2.1, tough: 2.1, shot: '#d8d2ff', mode: 'action',
        act: { speed: 3.2, range: 4.6, tele: 1.6, tmin: 1.05, r: 2.2, pats: ['circle', 'line', 'circle', 'line'], gap: 1.8, hit: 14, rec: .9, strike: 4 } },
      allFound: '조각이 저절로 맞춰져서 열쇠가 됐어! 구석의 큰 상자가 스르륵 열린다…',
      reward: '상자 안에서 물방울처럼 맑은 방울이가 폴짝 튀어나왔어. 방울이는 물로 지워진 흔적을 되살려.'
    },
    {
      // 벽의 지워진 그림을 물로 드러내고, 그 순서로 문의 자물쇠를 푸는 사건이다(kind: 'lock').
      // 기존 글의 '박스'는 '대기실'로만 바꿨다. request는 앞 사건을 풀고 돌아왔을 때 후루가 하던 말의 앞부분이다.
      id: 'cabin', no: 3, chapter: { mark: '전', name: '세 번째 사건', line: '문 안쪽에 마지막 친구가 있다. 이 친구가 있어야 시계탑이 움직인다.' }, title: '연못가 오두막', kind: 'lock', scene: 'cabin', task: '벽 그림과 문의 자물쇠', helper: 'mongeul',
      need: 'bangului', needHint: '마른 흔적을 되살리려면 "물" 속성이 필요해.',
      request: '방울이도 함께하게 됐네! 다음은 연못가 오두막이야.',
      goal: '벽에 숨은 그림을 드러내고 문의 비밀번호를 풀자',
      places: ['벽의 흔적', '잠긴 문'],
      // 방울이와 함께 왔을 때(끝 줄은 기존 문장의 앞부분만), 방울이 없이 왔을 때(기존 세 줄 그대로)
      intro: [
        { who: 'huru', text: '연못가 오두막에 도착! 문이 굳게 잠겨 있어.' },
        { who: 'lead', text: '옆 벽에 뭔가 지워진 흔적이 있어. 잉크가 말라서 안 보이는 것 같아.' },
        { who: 'huru', text: '물기가 있으면 보일지도 몰라.' }
      ],
      introNo: [
        { who: 'huru', text: '연못가 오두막에 도착! 문이 굳게 잠겨 있어.' },
        { who: 'lead', text: '옆 벽에 뭔가 지워진 흔적이 있어. 잉크가 말라서 안 보이는 것 같아.' },
        { who: 'huru', text: '물기가 있으면 보일지도 몰라. 이번에도 대기실에서 알맞은 친구를 데려가자!' }
      ],
      noHelper: [{ who: 'huru', text: '벽에 뭔가 지워진 흔적이 있어. 물기가 있으면 보일 것 같아. 대기실에서 알맞은 친구를 데려오자.' }],
      clues: [
        { id: 'wall', label: '벽의 흔적', text: '방울이가 물을 뿌리자 벽에 그림이 나타났다! 순서대로 달 → 별 → 불꽃이야.', note: '벽 그림 순서: 달 → 별 → 불꽃' }
      ],
      door: { label: '잠긴 문', locked: '문이 잠겨 있다. 벽의 비밀부터 풀어야 해.', wrong: '자물쇠가 덜컥! 순서가 맞지 않아. 수첩의 그림 순서를 다시 확인해 보자.', right: '찰칵! 자물쇠가 풀리고 문이 열렸다.' },
      lock: { title: '문의 자물쇠', sub: '벽 그림의 순서대로 입력', short: '3개를 모두 골라 주세요.' },
      answer: ['moon', 'star', 'fire'],
      // 조사와 훈련을 잇기 위해 새로 쓴 문장(검토 필요)
      afterClues: [{ who: 'huru', text: '벽 그림 순서를 수첩에 적었어!' }, { who: 'huru', text: '어, 연못에서 가람이가 올라왔어. 문을 열기 전에 물 친구와 호흡을 맞춰 보자고 하네!' }],
      // 훈련 이름과 까닭은 기존 기록 그대로. tip과 숫자는 새로 정한 것(검토 필요)
      duel: { monster: 'garam', name: '가람이', title: '연못의 약속', reason: '가람이와 훈련하며 물 친구와 함께 움직이는 법을 익힌다.',
        tip: '가람이의 물결은 안쪽 원이 안전합니다. 가까이 붙어서 피할 수도 있습니다.', gate: 'pond', tag: '', hit: 9, every: 2, tough: 2.6, shot: '#9fd8f2', mode: 'action',
        act: { speed: 3, range: 4.1, tele: 1.6, tmin: 1.05, r: 2.2, pats: ['circle', 'donut', 'line', 'donut'], gap: 1.7, hit: 14, rec: .9, strike: 4 } },
      reward: '문 안쪽의 구름 속에서 몽글번개가 찌릿찌릿 튀어나왔어. 장치를 작동시키는 건 이 친구 몫이야.'
    },
    {
      // 세 친구의 힘으로 멈춘 장치 세 개를 고치는 사건이다(kind: 'fix'). 기존 글의 '박스'는 '대기실'로만 바꿨다.
      // clues의 by: 그 장치를 고치는 친구, fail: 그 친구 없이 살폈을 때의 글
      id: 'tower', no: 4, chapter: { mark: '결', name: '마지막 사건', line: '시계탑이 멈춘 곳. 이제 세 친구의 힘이 필요하다.' }, title: '달빛 시계탑', kind: 'fix', scene: 'tower', task: '멈춘 장치 3개 고치기',
      need: ['malangbul', 'bangului', 'mongeul'], needHint: '이번엔 세 칸이야. 빛·물·전기 친구를 모두 골라 보자!',
      request: '마지막 장소야. 달빛 시계탑이 멈춰서 마을의 달빛이 사라졌어.',
      goal: '세 친구를 데려가 멈춘 시계탑 장치 3개를 고치자',
      brief: [
        { who: 'huru', text: '세 가지 장치가 고장 났어. 어두운 톱니, 녹슨 톱니, 꺼진 전원!' },
        { who: 'lead', text: '세 친구의 능력을 모두 합치면 고칠 수 있을 거야. 대기실에서 셋 다 데려가자!' }
      ],
      intro: [],
      clues: [
        { id: 'dark', label: '어두운 톱니', by: 'malangbul', fail: '톱니가 어둠 속에 숨어 있어서 맞물리는 곳이 안 보여. 빛이 필요해!', text: '말랑불이 비추자 톱니가 딱 맞물렸다!', note: '어두운 톱니 — 빛으로 해결' },
        { id: 'rust', label: '녹슨 톱니', by: 'bangului', fail: '톱니에 먼지와 녹이 잔뜩 끼었어. 물로 씻어 내야 해!', text: '방울이가 씻어 주자 톱니가 반짝반짝 빛난다!', note: '녹슨 톱니 — 물로 해결' },
        { id: 'power', label: '꺼진 전원', by: 'mongeul', fail: '전원 장치가 완전히 꺼져 있어. 찌릿한 전기가 필요해!', text: '몽글번개가 찌릿! 전원이 켜졌다!', note: '꺼진 전원 — 전기로 해결' }
      ],
      // 조사와 훈련을 잇기 위해 새로 쓴 문장(검토 필요)
      afterClues: [{ who: 'huru', text: '세 장치를 모두 고쳤어!' }, { who: 'huru', text: '어, 전원 뒤에서 뇌운몽글이 나왔어. 시계를 돌리기 전에 전원이 안전한지 같이 점검하자고 하네!' }],
      // 훈련 이름과 까닭은 기존 기록 그대로. tip과 숫자는 새로 정한 것(검토 필요)
      duel: { monster: 'mongeul2', name: '뇌운몽글', title: '시계탑 안전 점검', reason: '뇌운몽글과 힘을 맞춰 시계탑 전원을 안정시킨다.',
        tip: '뇌운몽글의 큰 번개는 범위가 가로로 셋 늘어섭니다. 앞이나 뒤로 빠져나갑니다.', gate: 'charge', tag: '', hit: 9, every: 2, burst: 8, tough: 3.6, shot: '#e6ff7a', mode: 'action',
        act: { speed: 3.4, range: 4.5, tele: 1.5, tmin: 1, r: 2.1, pats: ['line', 'circle', 'triple', 'donut'], gap: 1.6, hit: 16, rec: .8, strike: 4 } },
      // 끝 이야기. %s 자리에는 앞장선 탐정의 이름이 들어간다(기존 글의 "{name}"{이가})
      ending: [
        { who: 'narr', text: '세 톱니가 맞물리자 시계탑이 웅장하게 종을 울렸다. 마을에 달빛이 돌아왔다!' },
        { who: 'prof', text: '허허, 해냈구나! 마을 사람들이 모두 고마워하고 있단다. 이제 견습은 끝이다.' },
        { who: 'lead', text: '…어? 방금 뭔가 떠올랐어. 내 이름이 정말 %s 맞을까?' },
        { who: 'huru', text: '그건 다음 모험에서 알게 될 거야. 이제 네 탐정 사무소를 마을 명부에 올릴 수 있어!' }
      ]
    }
  ]
};
