'use strict';
const exhibit = new URLSearchParams(location.search).get('work') || 'ddp';
const designs = {bluky:{
  title:'BLUKY 브랜드 포스터',
  description:'BLUE와 SKY DAY를 담은 BLUKY의 대표 포스터와 하늘 배경, 가로형 적용을 살펴봅니다.',
  posters:[['대표 포스터','bluky-poster.jpg'],['밝은 하늘','bluky-sky.jpg'],['가로형 적용','bluky-landscape.jpg']]
},ddp:{
  title:'DDP 그리드 포스터',
  description:'행사 제목에서 일정과 장소로 이어지는 정보 순서, 반복하는 열과 여백을 살펴봅니다.',
  posters:[['포스터','ddp.jpg']]
},cherry:{
  title:'2024 서울 벚꽃 축제',description:'벚꽃 가지 사이에 세로로 놓인 제목과 하단의 날짜·장소를 따라 포스터를 살펴봅니다.',
  posters:[['축제 포스터','cherry.webp']]
},dinosaur:{
  title:'AKMU DINOSAUR · 앨범 디자인',description:'객석에서 무대로 시선을 올리면 조명 아래 기타를 든 공룡과 입체 글자가 보입니다.',
  posters:[['앨범 표지','dinosaur.webp']]
},spotify:{
  title:'스포티파이 리뉴얼 · UI/UX 디자인',description:'40대 사용자가 쉽게 쓰도록 메인, 검색, 보관함 화면을 앱 · 웹 · 태블릿으로 다시 설계한 화면입니다. 화면을 넘겨 보며 확대할 수 있습니다.',
  posters:[['메인 화면','spotify-main.jpg'],['앱 · 홈','spotify-app-home.jpg'],['앱 · 검색','spotify-app-search.jpg'],['앱 · 곡 상세','spotify-app-detail.jpg'],['웹 · 메인','spotify-web-main.jpg'],['웹 · 서브','spotify-web-sub.jpg'],['태블릿 · 홈','spotify-tablet-home.jpg'],['태블릿 · 검색','spotify-tablet-search.jpg']]
},carrot:{
  title:'Gloopy Mood Light Carrot',description:'초기 손그림과 완성 렌더를 번갈아 보세요. 당근 몸통과 아이스크림 머리, 양손의 전구가 어떻게 바뀌었는지 비교할 수 있습니다.',
  posters:[['완성 렌더','carrot.webp'],['초기 손그림','carrot-sketch.webp']]
}};
const model = designs[exhibit] || designs.ddp;
const title = document.querySelector('#title');
const poster = document.querySelector('#poster');
const wall = document.querySelector('#wall');
const surface = document.querySelector('#surface');
const zoom = document.querySelector('#zoom');
const status = document.querySelector('#status');
let active = 0;
let fittedHeight = 1;
title.textContent = model.title;
document.title = model.title + ' · 나의 방';
document.querySelector('#description').textContent = model.description;
document.querySelector('#schedule-focus').hidden = !['ddp','cherry'].includes(exhibit);
document.querySelector('#title-focus').hidden = ['carrot','dinosaur','spotify'].includes(exhibit);
document.querySelector('#variants').setAttribute('aria-label','감상할 이미지 선택');
wall.setAttribute('aria-label',model.title+' 감상 화면');
function sizePoster() {
  if (!poster.naturalWidth) return;
  const fit = Math.min((wall.clientWidth - 60) / poster.naturalWidth, (wall.clientHeight - 60) / poster.naturalHeight);
  fittedHeight = poster.naturalHeight * Math.max(.05, fit);
  const scale = Number(zoom.value) / 100;
  poster.style.width = poster.naturalWidth * Math.max(.05, fit) * scale + 'px';
  poster.style.height = fittedHeight * scale + 'px';
  surface.style.width = Math.max(wall.clientWidth - 56, poster.naturalWidth * fit * scale) + 'px';
  document.querySelector('#scale').value = zoom.value + '%';
}
function selectPoster(index) {
  active = index;
  zoom.value = '100';
  poster.alt = model.title + ' · ' + model.posters[index][0];
  poster.src = 'assets/' + model.posters[index][1];
  poster.onload = () => {sizePoster();wall.scrollTo(0,0);};
  for (const [i,button] of [...document.querySelector('#variants').children].entries()) button.setAttribute('aria-pressed', String(i === index));
  status.textContent = model.posters[index][0] + ' · ' + (index + 1) + ' / ' + model.posters.length;
}
model.posters.forEach(([name],index) => {
  const button = document.createElement('button');
  button.type = 'button';button.textContent = name;
  button.addEventListener('click',() => selectPoster(index));
  document.querySelector('#variants').append(button);
});
zoom.addEventListener('input',sizePoster);
document.querySelector('#fit').addEventListener('click',() => {zoom.value='100';sizePoster();wall.scrollTo(0,0);});
document.querySelector('#title-focus').addEventListener('click',() => {zoom.value='200';sizePoster();wall.scrollTo(0,0);status.textContent='제목의 크기와 위치를 살펴보세요.';});
document.querySelector('#schedule-focus').addEventListener('click',() => {zoom.value='220';sizePoster();wall.scrollTo({left:0,top:fittedHeight * 2.2 * .40,behavior:'smooth'});status.textContent='일정에서 장소와 관람 정보로 이어지는 순서입니다.';});
function setPresentation(expanded) {
  document.body.classList.toggle('presentation',expanded);
  document.querySelector('#presentation').textContent=expanded?'정보 함께 보기':'화면 채우기';
  sizePoster();
}
document.querySelector('#presentation').addEventListener('click',() => setPresentation(!document.body.classList.contains('presentation')));
document.querySelector('#exit-presentation').addEventListener('click',() => setPresentation(false));
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&document.body.classList.contains('presentation')){event.preventDefault();setPresentation(false);}});
document.querySelector('#return').addEventListener('click',() => {
  if (window.parent !== window) window.parent.postMessage({type:'room:close-work'},location.protocol === 'file:' ? '*' : location.origin);
  else location.href='../../index.html';
});
wall.addEventListener('keydown',event => {
  if (model.posters.length<2 || !['ArrowLeft','ArrowRight'].includes(event.key)) return;
  event.preventDefault();selectPoster((active + (event.key==='ArrowRight'?1:-1) + model.posters.length) % model.posters.length);
});
new ResizeObserver(sizePoster).observe(wall);
selectPoster(0);
