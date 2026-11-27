'use strict';
// 게임에 나오는 글과 사건 자료. A안의 무대는 별빛도시이고, 이야기·구역·주민·의뢰는 모두 이 안에서 새로 정했다(검토 필요).
// B안·C안과 같은 것은 제목, 주인공 이름(아서·에리), 직업(탐정) 셋뿐이다.
window.GAME = {
  title: '도시의 몬스터와 탐정 사무소 ARCHIVE',
  office: 'ARCHIVE 탐정 사무소',
  leads: {
    arthur: { name: '아서', img: 'img/arthur.png', cutin: 'img/arthur-cutin.png' },
    eri: { name: '에리', img: 'img/eri.png', cutin: 'img/eri-cutin.png' }
  },
  names: { huru: '후루', narr: '' },
  tips: [
    '도시를 걸어 다니며 주민에게 말을 걸어 보세요.',
    '별가루는 도시 곳곳에 떨어져 있습니다.',
    '사건을 해결하면 새 친구가 함께합니다.'
  ],
  caseTitles: ['멈춘 안내 시계', '분실물 보관소', '온실 정원', '시계탑'],
  // 기술 카드(실시간 훈련용, A안 턴제에서는 쓰지 않는다)
  cards: [
    { id: 'big', who: 'arthur', name: '돋보기 조준', cost: 3, text: '큰 훈련탄 한 발' },
    { id: 'fast', who: 'eri', name: '수첩 분석', cost: 2, text: '팀 발사 간격 절반 · 6초' },
    { id: 'heal', who: 'huru', name: '후루의 응원', cost: 4, text: '팀원 집중 35 회복' },
    { id: 'light', who: 'malangbul', name: '환한 불빛', cost: 2, text: '8초 동안 더 넓게 비춘다', gate: 'light' },
    { id: 'water', who: 'bangului', name: '물줄기', cost: 2, text: '물속의 상대를 부른다', gate: 'pond' },
    { id: 'zap', who: 'mongeul', name: '번쩍', cost: 2, text: '상대의 충전을 끊는다', gate: 'charge' }
  ],
  // 사건을 해결하면 함께하는 친구
  friends: {
    malangbul: { name: '말랑불', tag: '빛', img: 'img/malangbul.png', desc: '어두운 곳을 환하게 밝힌다', light: 1 },
    bangului: { name: '방울이', tag: '물', img: 'img/bangului.png', desc: '물을 뿌려 지워진 흔적을 드러낸다', water: 1 },
    mongeul: { name: '몽글번개', tag: '전기', img: 'img/mongeul.png', desc: '찌릿한 전기로 장치를 작동시킨다' }
  },
  // 자물쇠의 기호. 64×64 칸 기준.
  symbols: [
    { id: 'moon', name: '달', color: '#ffc928', d: 'M40 8a24 24 0 1 0 16 38A20 20 0 0 1 40 8z' },
    { id: 'star', name: '별', color: '#ffc928', d: 'M32 6l7.6 16.6 18 2-13.4 12.2 3.8 17.8L32 45.6 16 54.6l3.8-17.8L6.4 24.6l18-2z' },
    { id: 'fire', name: '불꽃', color: '#f2683c', d: 'M32 4c4 10 16 16 16 32a16 16 0 0 1-32 0c0-8 4-12 8-18 2 6 6 6 6 2 0-6 0-10 2-16z' },
    { id: 'drop', name: '물방울', color: '#1a9df5', d: 'M32 6c8 12 18 22 18 34a18 18 0 0 1-36 0c0-12 10-22 18-34z' }
  ],

  // ── 별빛도시(걸어 다니는 도시) ──
  // zones: 구역. open이 거짓이면 아직 길이 열리지 않은 곳이다. spawn: 열차 지도로 이동할 때 서는 자리 [x, z, 보는 각도]
  // npcs: 말 걸 수 있는 주민. model은 3D 모델 이름(없는 사람 모델 대신 몬스터 주민을 쓴다). case가 있으면 그 사건의 의뢰인이다.
  // dust: 별가루. quests: 사건 밖의 도시 의뢰(두 단계: 주는 사람 → 받는 사람)
  world: {
    name: '별빛도시', dustName: '별가루',
    help: 'WASD 걷기 · Shift 달리기 · 마우스 끌어서 시점 · Space 말 걸기 · M 열차 지도 · Esc 메뉴',
    zones: {
      plaza: { name: '천문 광장', sub: '별을 읽는 도시의 한가운데', open: true, spawn: [0, 9, 0] },
      station: { name: '별빛 역', sub: '밤하늘로 떠나는 열차가 서는 곳', open: false, after: 'clock', spawn: [84, -1, 0] },
      market: { name: '별무리 시장', sub: '별사탕과 등불을 파는 골목', open: false, after: 'depot', spawn: [-84, 0, 0] },
      tower: { name: '시계탑 거리', sub: '도시의 시간을 맞추는 탑 아래', open: false, after: 'garden', spawn: [0, -84, 0] },
      office: { name: 'ARCHIVE 탐정 사무소', sub: '아서와 에리의 일터', open: true, interior: true, spawn: [0, 244, Math.PI] },
      sweets: { name: '별사탕 가게', sub: '밤에만 문을 여는 가게', open: true, interior: true, spawn: [44, 243, Math.PI] }
    },
    // 건물 안 첫 방문 때 나오는 말(lines)과 선물(dust)
    doorTalk: {
      office: { lines: [{ who: 'huru', text: '여기가 우리 사무소야. 오른쪽 게시판에는 지금까지 모은 단서가 붙어 있어.' }, { who: 'huru', text: '가운데 탁자의 열차 지도로 다른 구역에 가 볼 수도 있고.' }] },
      sweets: { lines: [{ who: 'sweetshop', text: '어서 와요. 별사탕은 밤에만 만들어서 지금이 제일 맛있어요.' }, { who: 'sweetshop', text: '처음 오셨으니 선물이에요. 별가루를 조금 드릴게요.' }], dust: 2 }
    },
    npcs: [
      { id: 'keeper', model: 'bori', size: 1.5, name: '시계지기 보리', role: '안내 시계 관리인', x: -8.3, z: -4.6, ry: 1.0, case: 'clock',
        lines: [{ who: 'keeper', text: '시계가 멈춘 뒤로 아무것도 손에 안 잡혀요…' }],
        after: [{ who: 'keeper', text: '탐정님 덕분에 마음이 가라앉았어요. 시계 열쇠도 돌아왔고요.' }, { who: 'keeper', text: '아직 시계는 돌지 않지만, 열차가 오는 길은 열어 놓을게요.' }] },
      { id: 'sweet', model: 'mongeul2', size: 1.3, name: '별사탕 장수', role: '구름 모양 행상', x: -12.6, z: 4.6, ry: 1.4, quest: 'umbrella',
        lines: [[{ who: 'sweet', text: '별사탕은 밤에 먹어야 제맛이에요. 달이 뜨면 맛이 변하거든요.' }], [{ who: 'sweet', text: '요즘 시계가 멈춰서 손님이 통 없어요. 사탕이 눅눅해질 텐데…' }]] },
      { id: 'sweetshop', model: 'bori', size: 1.45, tint: '#ffd0a0', name: '별사탕 가게 주인', role: '가게 주인', x: 44, z: 235.4, ry: 0,
        lines: [[{ who: 'sweetshop', text: '별사탕은 하늘이 맑은 날에 더 반짝여요. 오늘은 그럭저럭이네요.' }], [{ who: 'sweetshop', text: '푸딩이가 여기서 하나만 달라고 졸랐는데, 결국 항아리를 통째로 안고 갔어요.' }], [{ who: 'sweetshop', text: '시계가 돌기 시작하면 가게 앞이 줄로 가득 찰 거예요. 그날을 기다려요.' }]] },
      { id: 'lens', model: 'banjjak',
 size: 1.3, name: '렌즈 가게 주인', role: '반짝돌', x: 10.6, z: -5.2, ry: -1.3,
        lines: [[{ who: 'lens', text: '별을 보려면 렌즈가 깨끗해야죠. 입김으로 닦으면 안 돼요.' }], [{ who: 'lens', text: '광장 바닥의 별자리는 밤에만 빛나요. 낮에는 그냥 돌바닥이죠.' }]] },
      { id: 'walker', model: 'garam', size: 1.3, name: '산책하는 주민', role: '가람이', x: 5.2, z: 12.4, ry: 3.1,
        lines: [[{ who: 'walker', text: '큰길 끝에서 열차 소리가 들리다 말다 해요. 시계 때문이겠죠.' }], [{ who: 'walker', text: '밤하늘이 가까운 도시라서 별똥별도 자주 떨어져요. 줍는 건 마음이지만요.' }]] },
      { id: 'crew', model: 'bori', size: 1.45, tint: '#b8c6ff', name: '열차 승무원', role: '별빛 역 승무원', x: 14.2, z: -10.4, ry: -.8,
        lines: [[{ who: 'crew', text: '열차는 시계에 맞춰 출발해요. 시계가 멈추면 열차도 못 가죠.' }], [{ who: 'crew', text: '시계열쇠가 돌아왔으니 동쪽 길이 곧 열릴 거예요. 별빛 역에 가 보세요.' }]] },
      // 별빛 역
      { id: 'master', model: 'banjjak', size: 1.35, tint: '#c8d4ff', name: '역장 반짝돌', role: '별빛 역장', x: 102, z: -6.4, ry: 3.1,
        lines: [[{ who: 'master', text: '열차가 서 있는 채로 하루째예요. 승객들도 지쳤어요.' }], [{ who: 'master', text: '분실물 보관소의 등이 밤마다 나가요. 말랑불 같은 친구가 있으면 좋을 텐데.' }]] },
      { id: 'conductor', model: 'bori', size: 1.4, tint: '#b8c6ff', name: '승무원 별이', role: '별빛 열차 승무원', x: 84, z: 5, ry: 0, quest: 'lantern',
        lines: [[{ who: 'conductor', text: '시간표를 못 지키면 승무원은 마음이 편치 않아요.' }], [{ who: 'conductor', text: '시장 쪽은 열차 소리가 안 들려서 조용하다던데요.' }]] },
      { id: 'traveler', model: 'garam', size: 1.3, tint: '#bcd4ff', name: '여행자 가람', role: '밤 열차 손님', x: 99, z: 6.4, ry: -2.2,
        lines: [[{ who: 'traveler', text: '북쪽 별자리를 보러 가는 길이었어요. 시계탑이 멈췄다니, 조금 걸릴 것 같네요.' }], [{ who: 'traveler', text: '이 역은 밤에 보면 열차 창이 별처럼 반짝여서 좋아요.' }]] },
      // 별무리 시장
      { id: 'lantern', model: 'mongeul2', size: 1.3, tint: '#ffb060', name: '등불 장수', role: '등불 가게', x: -96, z: -1.4, ry: 3, quest: null,
        lines: [[{ who: 'lantern', text: '등불은 심지보다 마음이 중요해요. 켜는 사람이 편안해야 오래 가죠.' }], [{ who: 'lantern', text: '시계가 멈춘 뒤로 밤이 길게 느껴져서, 등이 평소보다 많이 팔려요.' }]] },
      { id: 'florist', model: 'garam', size: 1.3, tint: '#b0f0e0', name: '온실지기 이슬', role: '온실 관리인', x: -90, z: -8.4, ry: 3.1,
        lines: [[{ who: 'florist', text: '온실 안쪽 문은 옛 시계 장인이 만든 거라 오래 잠겨 있어요.' }], [{ who: 'florist', text: '벽의 그림은 물이 닿아야 보인다는 말이 있어요. 믿기지는 않지만요.' }]] },
      { id: 'candy', model: 'bori', size: 1.4, tint: '#ffd0a0', name: '솜사탕 장수', role: '시장 간식 가게', x: -78, z: -1.5, ry: -1.4,
        lines: [[{ who: 'candy', text: '솜사탕은 달이 뜰 때 만들어야 폭신해요. 오늘은 구름이 낮네요.' }], [{ who: 'candy', text: '푸딩이가 단골인데, 요즘은 사탕을 너무 먹는다고 걱정이에요.' }]] },
      // 시계탑 거리
      { id: 'sweeper', model: 'mongeul2', size: 1.3, tint: '#9fb0ff', name: '탑지기 번개', role: '시계탑 관리인', x: 5, z: -85.4, ry: 0, quest: 'dustq',
        lines: [[{ who: 'sweeper', text: '탑 안의 톱니는 별가루를 먹고 돌아요. 도시 곳곳에 떨어진 걸 모아 오면 고맙겠어요.' }], [{ who: 'sweeper', text: '정문은 열쇠가 필요했는데, 시계지기가 열쇠를 찾았다니 다행이에요.' }]] },
      { id: 'guide', model: 'bori', size: 1.4, tint: '#ffe0a0', name: '시계탑 안내원', role: '탑 안내', x: -5, z: -88, ry: 0,
        lines: [[{ who: 'guide', text: '꼭대기의 큰 시계는 도시 어디서든 보여야 해요. 그래서 이렇게 높아요.' }], [{ who: 'guide', text: '안에 들어가려면 어두운 톱니, 녹슨 톱니, 꺼진 전원을 모두 살펴야 해요.' }]] }
    ],
    // 별가루: 도시 곳곳에 떨어져 있다
    dust: [
      { id: 'd1', x: -3.4, z: 4.2 }, { id: 'd2', x: 6.8, z: -7.4 }, { id: 'd3', x: -14.2, z: -1.2 }, { id: 'd4', x: 13.4, z: 3.8 },
      { id: 'd5', x: 1.0, z: -14.0 }, { id: 'd6', x: 9.8, z: 11.4 }, { id: 'd7', x: -9.2, z: 12.8 }, { id: 'd8', x: 0, z: 26 },
      { id: 'd9', x: 76, z: 2 }, { id: 'd10', x: 104, z: 1 }, { id: 'd11', x: 88, z: -5 }, { id: 'd12', x: 70, z: 0 }, { id: 'd13', x: 108, z: 5 },
      { id: 'd14', x: -76, z: 1 }, { id: 'd15', x: -104, z: 0 }, { id: 'd16', x: -90, z: 0 }, { id: 'd17', x: -70, z: -1 }, { id: 'd18', x: -92, z: 10 },
      { id: 'd19', x: 2, z: -78 }, { id: 'd20', x: -3, z: -94 }, { id: 'd21', x: 8, z: -92 }, { id: 'd22', x: 0, z: -60 }
    ],
    // 야생 친구: 가까이 가 말을 걸면 어떻게 대할지 고른다. 몸짓(cue)에서 성격을 읽어 맞는 방법을 고르면 도감에 오른다
    wild: [
      { id: 'w_pup', join: { tag: '글', img: 'bori', desc: '작은 몸으로 글자를 읽어 낸다' }, model: 'bori', size: .7, tint: '#ffe0a0', name: '아기 보리', zone: 'plaza', x: 2.6, z: -12.4, cue: '아기 보리가 벤치 뒤에 숨어 몸을 둥글게 말고 있다. 눈을 마주치면 움찔한다.', choices: [{ label: '다가간다' }, { label: '조용히 기다린다', ok: 1 }, { label: '별가루를 내민다' }], win: '조용히 기다렸더니 아기 보리가 먼저 코를 내밀었다. 도감에 올랐다!', lose: '아기 보리가 더 깊이 숨어 버렸다. 성격을 다시 생각해 보자.', after: '아기 보리는 이제 눈을 마주쳐도 숨지 않는다.' },
      { id: 'w_pebble', join: { tag: '빛', img: 'banjjak', desc: '반짝이는 것을 따라 단서를 비춘다' }, model: 'banjjak', size: .6, tint: '#cfe0ff', name: '꼬마 반짝돌', zone: 'plaza', x: -11.4, z: 11.6, cue: '꼬마 반짝돌이 바닥에 떨어진 반짝이는 것만 보고 있다. 사람은 쳐다보지도 않는다.', choices: [{ label: '다가간다' }, { label: '조용히 기다린다' }, { label: '별가루를 내민다', ok: 1 }], win: '별가루를 내밀자 꼬마 반짝돌이 눈을 반짝이며 다가왔다. 도감에 올랐다!', lose: '꼬마 반짝돌은 힐끗 보더니 다시 바닥만 본다.', after: '꼬마 반짝돌은 별가루만 보면 신이 난다.' },
      { id: 'w_puddle', join: { tag: '물', img: 'bangului', desc: '신나게 물을 튀겨 흔적을 드러낸다' }, model: 'garam', size: .6, tint: '#b4ffdf', name: '물웅덩이 가람', zone: 'station', x: 79, z: 6, cue: '물웅덩이 가람이 이쪽을 빙글빙글 돌며 쳐다본다. 꼬리가 신나게 흔들린다.', choices: [{ label: '다가간다', ok: 1 }, { label: '조용히 기다린다' }, { label: '별가루를 내민다' }], win: '다가가자 가람이가 팔짝 뛰어올랐다. 도감에 올랐다!', lose: '가람이는 기다리는 걸 지루해하며 다른 곳으로 헤엄쳐 갔다.', after: '물웅덩이 가람은 사람을 보면 먼저 다가온다.' },
      { id: 'w_spark', join: { tag: '전기', img: 'mongeul', desc: '조용히 찌릿한 불꽃을 모은다' }, model: 'mongeul2', size: .55, tint: '#fff2a0', name: '번개 새싹', zone: 'station', x: 103, z: 6.5, cue: '번개 새싹이 몸을 파르르 떨며 구석에 붙어 있다. 가까이 가면 찌릿 소리가 커진다.', choices: [{ label: '다가간다' }, { label: '조용히 기다린다', ok: 1 }, { label: '별가루를 내민다' }], win: '조용히 기다리자 찌릿 소리가 잦아들고 새싹이 다가왔다. 도감에 올랐다!', lose: '새싹이 놀라 찌릿하고 튀었다. 조금 떨어져서 다시 보자.', after: '번개 새싹은 조용한 사람 옆을 좋아한다.' },
      { id: 'w_cotton', join: { tag: '글', img: 'bori', desc: '냄새로 단서를 글처럼 읽는다' }, model: 'bori', size: .7, tint: '#ffdcb0', name: '솜사탕 보리', zone: 'market', x: -80, z: 1, cue: '솜사탕 보리가 가게 앞을 서성인다. 달콤한 냄새가 날 때마다 코를 킁킁거린다.', choices: [{ label: '다가간다' }, { label: '조용히 기다린다' }, { label: '별가루를 내민다', ok: 1 }], win: '별가루를 내밀자 솜사탕 보리가 킁킁거리며 다가왔다. 도감에 올랐다!', lose: '솜사탕 보리는 냄새가 다르다는 듯 고개를 저었다.', after: '솜사탕 보리는 달콤한 냄새를 따라다닌다.' },
      { id: 'w_gear', join: { tag: '빛', img: 'banjjak', desc: '톱니처럼 구르며 어두운 곳을 비춘다' }, model: 'banjjak', size: .6, tint: '#ffdca0', name: '톱니 반짝돌', zone: 'tower', x: -3.6, z: -80, cue: '톱니 반짝돌이 이쪽으로 데굴데굴 굴러왔다가 멈춰 쳐다본다. 호기심이 많아 보인다.', choices: [{ label: '다가간다', ok: 1 }, { label: '조용히 기다린다' }, { label: '별가루를 내민다' }], win: '다가가 쓰다듬자 톱니 반짝돌이 기분 좋게 굴렀다. 도감에 올랐다!', lose: '톱니 반짝돌이 심심한 듯 멀리 굴러갔다.', after: '톱니 반짝돌은 이제 졸졸 따라온다.' }
    ],
    // 도시 의뢰(사건 밖). steps[0]을 받으면 시작하고, 차례대로 다음 단계의 주민에게 간다. 끝나면 reward만큼 별가루. dust가 있는 단계는 별가루를 낸다
    quests: [
      { id: 'umbrella', title: '주인 잃은 우산', desc: '별사탕 장수가 우산 주인을 찾고 있다', zone: 'plaza', reward: 3,
        steps: [
          { npc: 'sweet', lines: [{ who: 'sweet', text: '이 우산, 벤치에 놓여 있던 건데… 주인이 안 나타나네요.' }, { who: 'sweet', text: '낮에 렌즈 가게 주인이 우산을 들고 있었던 것 같아요. 좀 전해 줄래요?' }, { who: 'lead', text: '맡겨 주세요. 전해 줄게요.' }] },
          { npc: 'lens', hint: '렌즈 가게 주인에게 우산을 전해 주자', lines: [{ who: 'lens', text: '어, 내 우산! 안개 낀 날에는 이걸로 별빛을 가리거든요.' }, { who: 'lens', text: '고마워요. 사례로 별가루를 드릴게요.' }] }
        ] },
      { id: 'lantern', title: '승강장의 등불', desc: '별빛 역 승무원이 시장의 등불 장수에게 확인을 부탁한다', zone: 'station', reward: 4,
        steps: [
          { npc: 'conductor', lines: [{ who: 'conductor', text: '승강장 등불을 시장에 주문했는데 소식이 없어요. 밤 열차가 오면 어두우면 안 되는데…' }, { who: 'conductor', text: '별무리 시장의 등불 장수에게 어떻게 됐는지 물어봐 주실래요?' }] },
          { npc: 'lantern', hint: '별무리 시장의 등불 장수에게 등불 소식을 묻자', lines: [{ who: 'lantern', text: '아, 그 주문! 등은 다 만들었는데 시장 길이 막혀서 못 갔어요.' }, { who: 'lantern', text: '이 등불 하나를 먼저 전해 주세요. 나머지는 길이 열리면 갈게요.' }] },
          { npc: 'conductor', hint: '승무원 별이에게 등불을 전해 주자', lines: [{ who: 'conductor', text: '와, 등불이에요! 이거면 승강장이 훨씬 환해지겠어요. 고마워요, 탐정님.' }] }
        ] },
      { id: 'dustq', title: '톱니의 간식', desc: '탑지기가 별가루를 모아 달라고 한다', zone: 'tower', reward: 5,
        steps: [
          { npc: 'sweeper', lines: [{ who: 'sweeper', text: '시계탑 톱니는 별가루를 먹고 돌아요. 도시에 떨어진 별가루를 여덟 개만 모아 주실래요?' }] },
          { npc: 'sweeper', hint: '별가루 8개를 모아 탑지기 번개에게 가져가자', dust: 8, wait: [{ who: 'sweeper', text: '별가루가 아직 모자라요. 여덟 개가 필요해요. 광장과 역, 시장 곳곳에 떨어져 있어요.' }], lines: [{ who: 'sweeper', text: '여덟 개 다 모아 오셨네요! 톱니들이 좋아하겠어요. 사례로 조금 돌려 드릴게요.' }] }
        ] }
    ]
  },

  // 처음 시작할 때의 소개(새로 쓴 문장, 검토 필요)
  opening: {
    prologue: [
      { who: 'narr', text: '밤하늘이 가까운 도시, 별빛도시.' },
      { who: 'narr', text: '천문 광장에 있는 안내 시계가 열차와 가로등의 시간을 맞춰 준다. 그런데 그 시계가 7시 47분에 멈췄다.' },
      { who: 'narr', text: '시간이 어긋나자 몬스터 주민들이 불안해져서 엉뚱한 행동을 하기 시작했다.' },
      { who: 'narr', text: '견습 탐정 아서와 에리는 단서를 모아 주민들을 달래고, 시계를 다시 돌리려 한다.' }
    ],
    lines: [
      { who: 'huru', text: '안녕! 나는 안내를 맡은 후루야.' },
      { who: 'huru', text: '같이 걸으면서 하나씩 알려 줄게. 사무소 문을 나서면 바로 천문 광장이야.' },
      { who: 'huru', text: '시계 아래에서 시계지기 보리가 기다리고 있어.' }
    ],
    whoTitle: 'ARCHIVE 탐정 사무소의 탐정들',
    who: [
      { id: 'arthur', role: '견습 탐정', text: '돋보기로 현장의 흔적을 살핀다.', line: '단서는 발로 찾는 거야.' },
      { id: 'eri', role: '견습 탐정', text: '수첩에 단서를 적고 정리한다.', line: '수첩에 적어 두면 잊지 않아.' },
      { id: 'huru', role: '안내', text: '도시를 함께 걸으며 알려 준다.', line: '준비되면 말해 줘!' }
    ],
    stepsTitle: '도시에서는 이렇게 지냅니다',
    steps: [['걷기', '도시를 직접 걸어 다닌다'], ['의뢰', '주민에게 말을 걸어 사건을 받는다'], ['현장 조사', '반짝이는 곳을 살펴 단서를 모은다'], ['진정 훈련', '차례대로 행동을 골라 주민을 진정시킨다'], ['추리', '모은 단서로 사건을 푼다'], ['새 친구', '해결하면 친구가 함께한다']],
    last: [{ who: 'huru', text: '광장의 안내 시계가 멈춘 지 하루째래. 먼저 시계지기 보리에게 가 보자.' }]
  },
  // 처음 한 번만 나오는 후루의 안내(새로 쓴 문장, 검토 필요). [밝힐 곳, 말, 말풍선 자리]. %s에는 훈련 상대의 이름이 들어간다.
  guide: {
    world: [
      ['.wmini', '작은 지도야. 노란 점이 의뢰가 있는 곳이고, 초록 점은 주민이야.', 'left:300px;top:150px'],
      ['.wtrack', '지금 할 일은 여기에 적혀 있어. 처음에는 시계지기 보리에게 가서 말을 걸면 돼.', 'left:300px;top:380px'],
      ['.wparty', (window.DeviceHint && window.DeviceHint.touch) ? '함께 걷는 팀이야. 앞장서는 탐정은 아서와 에리 중에 고를 수 있어. 둘째 칸이나 오른쪽 아래 "아서"·"에리" 단추를 눌러 봐.' : '함께 걷는 팀이야. 앞장서는 탐정은 아서와 에리 중에 고를 수 있어. 1번 키는 아서, 2번 키는 에리야.', 'right:200px;top:300px'],
      ['.wmenu', (window.DeviceHint && window.DeviceHint.touch) ? '메뉴에서 열차 지도, 임무, 소지품, 파티 편성을 열 수 있어. 왼쪽 단추로 걷고, 오른쪽 "행동"으로 말을 걸어.' : '메뉴에서 열차 지도, 임무, 소지품, 파티 편성을 열 수 있어. 걷기는 WASD, 시점은 마우스를 끌어.', 'right:300px;top:150px']
    ],
    team: [
      ['.pcards', '이번 팀 네 자리야. 앞장서는 탐정, 함께 가는 탐정, 친구 둘이야.', 'left:60px;top:170px'],
      ['.tm-roster', '사건을 해결하면 친구가 대기 명단에 와. 친구를 누르면 무대에 올라가.', 'left:560px;top:520px'],
      ['.tgo', '준비됐으면 출동을 눌러.', 'right:340px;bottom:100px']
    ],
    probe: [
      ['.mk', '반짝이는 표시에 다가가서 누르면 탐정이 살펴봐. 걸어 다니면서 찾아도 돼.', 'left:530px;bottom:60px'],
      ['.fclues', '살펴본 곳은 여기에 표시되고 수첩에 적혀. 모두 조사하자.', 'left:60px;top:250px']
    ],
    // A안 턴제 훈련 안내. 한 번에 한 가지씩, 화면 위쪽에서 아래쪽 순서로 알려 준다
    turn: [
      ['.fpan', '위쪽은 상대 정보야. 안정도가 100까지 차면 %s 안정돼. 쓰러뜨리는 게 아니야.', 'left:620px;top:200px'],
      ['.fpan .fw', '약점은 \'%w\'. 같은 속성의 기술이 강하고, 강인도 칸이 깎여. 다 깎이면 상대가 한 번 못 움직여.', 'left:620px;top:200px'],
      ['.tord', '왼쪽 위는 행동 순서야. 맨 앞이 지금 차례. 붉은 칸은 상대의 큰 반응이 오는 차례야.', 'left:120px;top:250px'],
      ['.tact .t-clue', '내 차례에는 이 단추 중에 하나를 골라. 단서 제시는 기본 행동이고 SP가 1 쌓여.', 'right:700px;bottom:360px'],
      ['.tact .t-team', '동료 협력은 SP 1을 써서 더 크게 안정시켜. SP는 팀이 같이 써.', 'right:700px;bottom:360px'],
      ['.tact .t-guard', '방어는 이번 라운드 피해를 줄이고, 관찰은 SP를 쌓고 다음 행동을 강하게 해.', 'right:700px;bottom:360px'],
      ['.tult', '인물마다 에너지가 차. 가득 차면 필살기를 쓸 수 있어. 아서와 에리만 써. 추리 점수가 쌓일수록 필살기가 커져.', 'right:700px;bottom:360px'],
      ['.bteam', '아래는 팀의 집중과 에너지야. 집중이 모두 0이 되면 다시 도전해. 찾은 단서는 그대로야.', 'left:380px;bottom:240px']
    ],
    deduce: [
      ['.dnote', '현장에서 적은 단서야.', 'left:640px;top:330px'],
      ['.dsus', '친구마다 특징이 달라. 단서와 모두 맞는 친구를 고르고 "범인 맞히기"를 눌러.', 'left:40px;top:330px;width:560px']
    ]
  },
  // 턴제 훈련에서 내 차례에 나오는 짧은 안내(새로 쓴 문장, 검토 필요). 처음 한 번만 나오는 것도 있다.
  turnHints: {
    first: '%s 차례야. 단서 제시를 눌러 봐.',
    pts: 'SP가 쌓였어. 동료 협력은 SP 1을 써서 더 크게 안정시켜.',
    weak: "상대 약점은 '%w'야. 같은 속성의 인물 기술이 강해.",
    big: '곧 상대의 큰 반응이 와. 방어를 누르면 피해가 절반이야.',
    ult: '에너지가 가득 찼어. 필살기를 써 봐.',
    light: '반짝돌이 빛 밖에 있어서 단서가 닿지 않아. 말랑불과 협력하거나 관찰해 봐.',
    pond: '가람이가 물속에 있어서 단서가 닿지 않아. 방울이와 협력하거나 관찰해 봐.',
    charge: '뇌운몽글이 충전 중이야. 관찰하면 끊을 수 있어. 전기 친구가 있으면 협력도 돼.'
  },
  // 마지막 사건을 풀고 나서 보여 주는 결말 화면(새로 쓴 문장, 검토 필요)
  epilogue: { title: '1부 끝', line: '별빛도시의 안내 시계가 다시 돌기 시작했다.', friends: ['malangbul', 'bangului', 'mongeul'] },
  added: {
    cluesDone: [{ who: 'huru', text: '단서 세 개를 다 모았어. 수첩에 잘 적혔지?' }],
    wrong: [{ who: 'huru', text: '음, 단서와 맞지 않는 것 같아. 수첩을 다시 볼까?' }],
    probeHint: '반짝이는 곳에 다가가 눌러서 조사합니다',
    lose: '팀의 집중이 다 떨어졌습니다. 다시 해 볼까요?'
  },
  // 현장에 세우는 3D 모델. 새 모델을 받으면 file만 바꾸면 된다(.vrm, .glb 모두 됨). height는 키(m), 0이면 모델 그대로.
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
  // 사건 네 개. site: 사건이 시작되는 곳(npc가 있으면 그 주민에게 말을 걸어 시작, 없으면 x·z의 문 앞). lockedHint: 아직 못 들어갈 때 후루의 말
  cases: [
    {
      id: 'clock', no: 1, chapter: { mark: '1', name: '제1장', line: '7시 47분. 천문 광장의 안내 시계가 멈췄다.' }, title: '멈춘 안내 시계', scene: 'star', task: '단서 3곳 조사', helper: 'malangbul',
      site: { zone: 'plaza', npc: 'keeper', label: '멈춘 안내 시계' },
      request: '안내 시계가 멈췄고, 시계 열쇠도 보이지 않는대!',
      goal: '단서 3곳을 조사해서 열쇠를 가져간 친구를 맞히자',
      talk: [
        { who: 'keeper', text: '탐정님! 안내 시계가 7시 47분에 딱 멈췄어요.' },
        { who: 'keeper', text: '시계를 감는 열쇠도 없어졌어요. 어제까지는 분명 관리실의 사탕 항아리 안에 넣어 뒀는데…' },
        { who: 'lead', text: '단서부터 찾아볼게요. 시계 둘레를 살펴볼게.' },
        { who: 'huru', text: '열쇠가 없으면 열차도 늦어진대. 서두르자!' }
      ],
      intro: [{ who: 'huru', text: '시계 둘레에서 반짝이는 곳을 찾아봐. 걸어 다니다가 가까이 가서 누르면 돼.' }],
      clues: [
        { id: 'trail', label: '시계 아래 바닥', text: '시계 아래에서 끈적한 자국이 길게 이어져 있다. 발자국은 하나도 없다!', note: '발자국이 없고 끈적한 자국이 남아 있었다.' },
        { id: 'keeper', label: '관리실 창문', text: '관리실 창문턱을 살폈다. 반짝이는 가루는 하나도 묻어 있지 않다.', note: '관리실 창문에 반짝이는 가루가 없었다.' },
        { id: 'jar', label: '빈 사탕 항아리', text: '열쇠를 넣어 둔 항아리가 비어 있다. 달콤한 캐러멜 냄새가 진하게 남아 있다.', note: '빈 항아리에서 캐러멜 냄새가 났다.' }
      ],
      choices: [
        { id: 'kongkong', name: '콩콩이', traits: ['발이 있어서 발자국을 남김', '반짝이는 가루 없음', '끈적임 없음'] },
        { id: 'byeolddong', name: '별똥이', traits: ['둥둥 떠다녀서 발자국 없음', '지나가면 반짝이는 가루가 떨어짐', '끈적임 없음'] },
        { id: 'pudding', name: '푸딩이', traits: ['발이 없고 미끄러져 다님', '반짝이는 가루 없음', '몸이 끈적하고 캐러멜 향이 남'] }
      ],
      duel: { mode: 'turn', monster: 'bori', weak: '글', name: '보리', title: '시계지기 달래기', reason: '시계가 멈춘 뒤로 보리가 잔뜩 예민해졌습니다. 마음을 가라앉히는 진정 훈련입니다.', tip: '차례가 오면 행동을 하나 고릅니다.' },
      question: '시계 열쇠를 가져간 친구는 누구일까?',
      answer: 'pudding',
      explanation: '정답! 푸딩이가 사탕 항아리째 들고 갔구나. 열쇠가 그 안에 있는 줄은 몰랐대. 열쇠는 무사히 돌려받았어!',
      reward: '푸딩이가 미안해하며 말랑불을 소개해 줬어. 말랑불은 어두운 곳을 밝혀 주는 친구야.'
    },
    {
      // 범인을 맞히는 사건이 아니라, 빛을 내는 친구와 숨은 조각을 찾는 사건이다(kind: 'find').
      id: 'depot', no: 2, chapter: { mark: '2', name: '제2장', line: '역의 불이 나갔다. 빛 없이는 보관소 안이 보이지 않는다.' }, title: '분실물 보관소', kind: 'find', scene: 'warehouse', task: '시계 톱니 조각 3개 찾기', find: '시계 톱니 조각 3개', helper: 'bangului',
      site: { zone: 'station', x: 96, z: -9, label: '분실물 보관소', r: 3 },
      lockedHint: '별빛 역으로 가는 길은 시계가 돌아야 열릴 것 같아.',
      need: 'malangbul', needHint: '어둠에는 "빛" 속성이 필요해.',
      request: '푸딩이가 그러는데, 별빛 역 분실물 보관소에서 이상한 반짝임을 봤대.',
      goal: '알맞은 친구를 데려가 숨은 시계 톱니 조각 3개를 찾자',
      talk: [
        { who: 'master', text: '탐정님, 분실물 보관소의 불이 밤마다 나가요. 안에 들어갔다가 놀라서 나온 손님도 있고요.' },
        { who: 'master', text: '멈춘 시계에서 떨어진 톱니 조각이 분실물로 흘러 들어왔다는 소문도 있어요.' }
      ],
      brief: [
        { who: 'huru', text: '안은 엄청 어두워. 어둠 속에서는 아무것도 안 보여!' },
        { who: 'huru', text: '빛을 내는 친구를 한 명 데려가자. 누가 필요할까?' }
      ],
      noLight: [{ who: 'huru', text: '너무 어두워서 잘 안 보여… 불빛을 내는 친구가 필요해. 다시 골라 보자.' }],
      intro: [{ who: 'lead', text: '말랑불 덕분에 주변이 환해졌어! 이제 숨어 있는 걸 찾을 수 있겠어.' }],
      hint: '바닥을 눌러 걸어 다니며 반짝이는 곳을 찾습니다',
      clues: [
        { id: 'p1', label: '선반 아래', text: '선반 아래에서 반짝이는 톱니 조각을 하나 주웠다!', note: '톱니 조각 ① 선반 아래' },
        { id: 'p2', label: '통 뒤쪽', text: '통 뒤에 숨겨진 톱니 조각을 찾았다!', note: '톱니 조각 ② 통 뒤쪽' },
        { id: 'p3', label: '상자 옆', text: '상자 옆 바닥에서 마지막 조각을 발견했다!', note: '톱니 조각 ③ 상자 옆' }
      ],
      afterClues: [{ who: 'huru', text: '톱니 조각 세 개를 다 찾았어!' }, { who: 'huru', text: '어, 통 사이에서 반짝돌이 나왔어. 어두운 데서 같이 움직여 보자고 하네!' }],
      duel: { mode: 'turn', monster: 'banjjak', weak: '빛', name: '반짝돌', title: '어둠 속 움직임', reason: '보관소를 지키는 반짝돌과 훈련하며 어두운 곳에서도 동료의 움직임을 읽는다.',
        tip: '반짝돌이 빛 밖으로 나가면 단서가 닿지 않습니다. 말랑불과 협력하거나 관찰로 찾아내세요.', gate: 'light', tag: '빛 밖', hit: 9, every: 2.1, tough: 1.1, shot: '#d8d2ff' },
      allFound: '조각이 저절로 맞춰져서 열쇠가 됐어! 구석의 큰 상자가 스르륵 열린다…',
      reward: '상자 안에서 물방울처럼 맑은 방울이가 폴짝 튀어나왔어. 방울이는 물로 지워진 흔적을 되살려.'
    },
    {
      // 벽의 지워진 그림을 물로 드러내고, 그 순서로 문의 자물쇠를 푸는 사건이다(kind: 'lock').
      id: 'garden', no: 3, chapter: { mark: '3', name: '제3장', line: '시장 뒤 온실 안쪽에 시계탑 문을 여는 단서가 있다.' }, title: '온실 정원', kind: 'lock', scene: 'cabin', task: '벽 그림과 문의 자물쇠', helper: 'mongeul',
      site: { zone: 'market', x: -96, z: -9, label: '온실 정원', r: 3 },
      lockedHint: '별무리 시장은 아직 가 볼 수 없어. 앞의 의뢰부터 풀자.',
      need: 'bangului', needHint: '마른 흔적을 되살리려면 "물" 속성이 필요해.',
      request: '방울이도 함께하게 됐네! 다음은 시장 뒤 온실 정원이야.',
      goal: '벽에 숨은 그림을 드러내고 문의 비밀번호를 풀자',
      places: ['벽의 흔적', '잠긴 문'],
      talk: [
        { who: 'florist', text: '시장 뒤 온실 정원에는 옛 시계 설계도가 있다고들 해요. 물이 닿아야 보인다는데…' },
        { who: 'huru', text: '설계도에 시계탑 문을 여는 순서가 적혀 있을지도 몰라!' }
      ],
      intro: [
        { who: 'huru', text: '온실 정원에 도착! 안쪽 문이 굳게 잠겨 있어.' },
        { who: 'lead', text: '옆 벽에 뭔가 지워진 흔적이 있어. 잉크가 말라서 안 보이는 것 같아.' },
        { who: 'huru', text: '물기가 있으면 보일지도 몰라.' }
      ],
      introNo: [
        { who: 'huru', text: '온실 정원에 도착! 안쪽 문이 굳게 잠겨 있어.' },
        { who: 'lead', text: '옆 벽에 뭔가 지워진 흔적이 있어. 잉크가 말라서 안 보이는 것 같아.' },
        { who: 'huru', text: '물기가 있으면 보일지도 몰라. 알맞은 친구를 데려오자!' }
      ],
      noHelper: [{ who: 'huru', text: '벽에 뭔가 지워진 흔적이 있어. 물기가 있으면 보일 것 같아. 알맞은 친구를 데려오자.' }],
      clues: [
        { id: 'wall', label: '벽의 흔적', text: '방울이가 물을 뿌리자 벽에 그림이 나타났다! 순서대로 달 → 별 → 불꽃이야.', note: '벽 그림 순서: 달 → 별 → 불꽃' }
      ],
      door: { label: '잠긴 문', locked: '문이 잠겨 있다. 벽의 비밀부터 풀어야 해.', wrong: '자물쇠가 덜컥! 순서가 맞지 않아. 수첩의 그림 순서를 다시 확인해 보자.', right: '찰칵! 자물쇠가 풀리고 문이 열렸다.' },
      lock: { title: '문의 자물쇠', sub: '벽 그림의 순서대로 입력', short: '3개를 모두 골라 주세요.' },
      answer: ['moon', 'star', 'fire'],
      afterClues: [{ who: 'huru', text: '벽 그림 순서를 수첩에 적었어!' }, { who: 'huru', text: '어, 연못에서 가람이가 올라왔어. 문을 열기 전에 물 친구와 호흡을 맞춰 보자고 하네!' }],
      duel: { mode: 'turn', monster: 'garam', weak: '물', name: '가람이', title: '연못의 약속', reason: '가람이와 훈련하며 물 친구와 함께 움직이는 법을 익힌다.',
        tip: '가람이가 물속에 들어가면 단서가 닿지 않습니다. 방울이와 협력하거나 관찰로 불러내세요.', gate: 'pond', tag: '물속', hit: 9, every: 2, tough: 1.35, shot: '#9fd8f2' },
      reward: '문 안쪽의 구름 속에서 몽글번개가 찌릿찌릿 튀어나왔어. 장치를 작동시키는 건 이 친구 몫이야.'
    },
    {
      // 세 친구의 힘으로 멈춘 장치 세 개를 고치는 사건이다(kind: 'fix'). clues의 by: 그 장치를 고치는 친구, fail: 그 친구 없이 살폈을 때의 글
      id: 'tower', no: 4, chapter: { mark: '4', name: '제4장', line: '시계의 심장이 있는 탑. 이제 세 친구의 힘이 필요하다.' }, title: '시계탑', kind: 'fix', scene: 'tower', task: '멈춘 장치 3개 고치기',
      site: { zone: 'tower', x: 0, z: -96, label: '시계탑 정문', r: 3 },
      lockedHint: '시계탑 거리는 아직 길이 열리지 않았어. 앞의 의뢰부터 풀자.',
      need: ['malangbul', 'bangului'], needHint: '이번엔 빛 친구와 물 친구가 필요해. 전기 장치는 아서와 에리가 직접 고칠 수 있어.',
      request: '마지막 장소야. 시계탑 안의 장치가 멈춰서 안내 시계가 서 버렸어.',
      goal: '빛·물 친구와 함께 멈춘 시계탑 장치 3개를 고치자',
      talk: [
        { who: 'keeper', text: '시계탑 정문 열쇠는 이제 있어요. 하지만 안의 장치가 셋이나 멈췄어요.' },
        { who: 'huru', text: '어두운 톱니, 녹슨 톱니, 꺼진 전원이래. 빛 친구와 물 친구는 꼭 데려가야 해!' }
      ],
      brief: [
        { who: 'huru', text: '세 가지 장치가 고장 났어. 어두운 톱니, 녹슨 톱니, 꺼진 전원!' },
        { who: 'lead', text: '빛과 물은 꼭 필요하고, 전기는 몽글번개가 있으면 더 빨라. 팀을 잘 골라 보자!' }
      ],
      intro: [],
      clues: [   // alt: 그 친구가 팀에 없을 때 탐정이 직접 하는 방법(느리지만 된다)
        { id: 'dark', label: '어두운 톱니', by: 'malangbul', fail: '톱니가 어둠 속에 숨어 있어서 맞물리는 곳이 안 보여. 빛이 필요해!', text: '말랑불이 비추자 톱니가 딱 맞물렸다!', note: '어두운 톱니 — 빛으로 해결' },
        { id: 'rust', label: '녹슨 톱니', by: 'bangului', fail: '톱니에 먼지와 녹이 잔뜩 끼었어. 물로 씻어 내야 해!', text: '방울이가 씻어 주자 톱니가 반짝반짝 빛난다!', note: '녹슨 톱니 — 물로 해결' },
        { id: 'power', label: '꺼진 전원', by: 'mongeul', alt: '몽글번개가 없어서 아서와 에리가 예비 퓨즈를 직접 갈아 끼웠다. 시간이 걸렸지만 전원이 켜졌다!', fail: '전원 장치가 완전히 꺼져 있어. 찌릿한 전기가 필요해!', text: '몽글번개가 찌릿! 전원이 켜졌다!', note: '꺼진 전원 — 전기로 해결' }
      ],
      afterClues: [{ who: 'huru', text: '세 장치를 모두 고쳤어!' }, { who: 'huru', text: '어, 전원 뒤에서 뇌운몽글이 나왔어. 시계를 돌리기 전에 전원이 안전한지 같이 점검하자고 하네!' }],
      duel: { mode: 'turn', monster: 'mongeul2', weak: '전기', name: '뇌운몽글', title: '시계탑 안전 점검', reason: '뇌운몽글과 힘을 맞춰 시계탑 전원을 안정시킨다.',
        tip: '뇌운몽글이 충전하는 동안은 단서가 닿지 않고, 끝나면 큰 번개가 팀 모두에게 떨어집니다. 관찰로 충전을 끊어 보세요(전기 친구가 있으면 협력으로도 끊깁니다).', gate: 'charge', tag: '충전 중', hit: 9, every: 2, burst: 8, tough: 2, shot: '#ffe66b' },
      // 끝 이야기. %s 자리에는 앞장선 탐정의 이름이 들어간다
      ending: [
        { who: 'narr', text: '세 톱니가 맞물리자 시계탑이 웅장하게 종을 울렸다. 천문 광장의 안내 시계도 다시 움직이기 시작했다.' },
        { who: 'keeper', text: '고마워요, 탐정님들! 열차도 가로등도 제때 켜졌어요.' },
        { who: 'lead', text: '시간이 맞으니까 도시가 한결 편안해 보이네.' },
        { who: 'huru', text: '아직 도시에는 우리가 모르는 이야기가 많아. 사무소로 돌아가서 다음 의뢰를 기다리자!' }
      ]
    }
  ]
};
