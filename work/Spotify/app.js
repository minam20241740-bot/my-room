'use strict';
const tracks=[
 {id:'bus',title:'마로니에 3',artist:'마로니에',album:'마로니에 3',genre:'90s',art:'bus'},
 {id:'whisper',title:'First Whisper',artist:'쿨 (COOL)',album:'First Whisper',genre:'댄스',art:'whisper'},
 {id:'cool5',title:'COOL 5',artist:'쿨 (COOL)',album:'COOL 5',genre:'댄스',art:'cool5'},
 {id:'uber',title:'UBer-1',artist:'UBer-1',album:'UBer-1',genre:'발라드',art:'uber'},
 {id:'zaza',title:'ZAZA',artist:'자자',album:'ZAZA',genre:'댄스',art:'zaza'},
 {id:'koyote',title:'KOYOTE 4',artist:'코요태',album:'KOYOTE 4',genre:'댄스',art:'koyote'},
 {id:'pop',title:'K-Are & Be',artist:'K-Pop 모음',album:'K-Are & Be',genre:'K-Pop',art:'pop'}
];
const $=q=>document.querySelector(q),main=$('#main'),audio=$('#audio'),key='Portfolio.Spotify.Renewal.1';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let state={saved:[],current:'bus',name:'사용자',time:0,volume:.55};
try{state={...state,...JSON.parse(localStorage.getItem(key)||'{}')};}catch(e){}
state.saved=Array.isArray(state.saved)?state.saved.filter(id=>tracks.some(t=>t.id===id)):[];
state.current=tracks.some(t=>t.id===state.current)?state.current:'bus';
if (!['playlist','catalog'].includes(state.collection)) {
  state.collection=state.saved.length>1&&state.saved.includes(state.current)?'playlist':'catalog';
}
let audioReady=false,audioFailed=false;
let route='home',query='',searchMode='전체',toastTimer,saveTimer,playSequence=0;
const current=()=>tracks.find(t=>t.id===state.current),time=t=>`${Math.floor(t/60)}:${String(Math.floor(t%60)).padStart(2,'0')}`;
function save(){try{localStorage.setItem(key,JSON.stringify({...state,time:audio.currentTime||0}));}catch(e){}}
function toast(s){$('#toast').textContent=s;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),2200);}
function addButton(t){const yes=state.saved.includes(t.id);return `<button class="add ${yes?'selected':''}" data-add="${t.id}" aria-label="${esc(t.title)} ${yes?'플레이리스트에서 빼기':'플레이리스트에 담기'}" aria-pressed="${yes}">${yes?'✓ 담김':'+ 담기'}</button>`;}
function cards(list){return `<div class="cards">${list.map(t=>`<article class="card"><button class="art-btn" data-play="${t.id}" aria-label="${esc(t.title)} 임시 데모 소리 재생"><img src="assets/${t.art}.jpg" alt="${esc(t.album)} 원 시안 이미지"><span class="hover-play">▶</span></button><h3>${esc(t.title)}</h3><p>${esc(t.artist)}</p>${addButton(t)}</article>`).join('')}</div>`;}
function rows(list,removable=false){return `<div class="tracklist">${list.map((t,i)=>`<div class="row"><span class="row-number">${i+1}</span><img src="assets/${t.art}.jpg" alt=""><button class="title" data-play="${t.id}">${esc(t.title)}<small>${esc(t.artist)}</small></button><span class="album-name">${esc(t.album)}</span><small class="length">임시 소리 0:16</small>${removable?`<button class="tiny" data-remove="${t.id}" aria-label="${esc(t.title)} 삭제">빼기</button>`:addButton(t)}</div>`).join('')}</div>`;}
function searchHeader(){return `<form class="search-form" id="search-form" role="search"><input id="search-input" type="search" placeholder="아티스트, 곡 또는 장르" aria-label="아티스트, 곡 또는 장르 검색" value="${esc(query)}"><button aria-label="검색 실행">⌕</button></form><div class="tabs"><a href="#home" class="${route==='home'?'active':''}">스포티파이</a><a href="#chart" class="${route==='chart'?'active':''}">음악 차트</a><a href="#search" class="${route==='search'?'active':''}">음악 검색</a><a href="#playlist" class="${route==='playlist'?'active':''}">내 플레이리스트</a><a href="#profile" class="${route==='profile'?'active':''}">내 프로필</a></div>`;}
function demoNote(){return `<p class="demo-banner"><b>시안 화면입니다.</b> 앨범 그림은 원래 시안에 쓴 예시이고, 누르면 나오는 소리는 모든 앨범이 같은 <b>임시 데모 소리</b>입니다. 실제 곡이 아닙니다.</p>`;}
function render(){
 route=(location.hash.slice(1)||'home').split('?')[0];if(!['home','search','playlist','player','profile','chart'].includes(route))route='home';
 document.querySelectorAll('[data-nav]').forEach(a=>a.classList.toggle('active',a.dataset.nav===route||(route==='chart'&&a.dataset.nav==='playlist')));
 let html=searchHeader()+demoNote();
 if(route==='home')html+=`<div class="eyebrow">DISCOVER YOUR NOSTALGIA</div><h1>1990년대 추억의 앨범</h1><p class="sub">다시 듣고 싶은 순간, 나만의 플레이리스트로.</p><p class="howto">앨범 그림을 누르면 소리가 나옵니다. ‘+ 담기’로 내 플레이리스트에 모으고, 메뉴로 화면을 옮겨 보세요.</p>${cards(tracks.slice(0,6))}<h2>취향을 따라 둘러보기</h2>${genres()}<p class="screen-only-demo">원 기획서의 음반·아티스트 이미지와 분류를 사용한 개인 리뉴얼 시연입니다.</p>`;
 if(route==='search'){
  const q=query.trim().toLowerCase();const filtered=tracks.filter(t=>!q||[t.title,t.artist,t.album,t.genre].some(x=>x.toLowerCase().includes(q)));
  html+=`<div class="eyebrow">FIND YOUR SOUND</div><h1>검색하기</h1><p class="sub">곡, 아티스트, 장르를 찾아보세요.</p>`;
  if(q){html+=`<h2>‘${esc(query)}’ 검색 결과 <small style="font-weight:400;color:#8b998f">${filtered.length}건</small></h2>${filtered.length?rows(filtered):'<div class="empty">찾는 음악이 없습니다.<br>‘쿨’, ‘댄스’, ‘COOL’로 다시 찾아보세요.</div>'}`;}
  else html+=`<h2>모두 찾아보기</h2>${genres()}<h2>추천 아티스트와 곡</h2>${cards(tracks.slice(1,5))}`;
 }
 if(route==='chart')html+=`<div class="eyebrow">CHART · ORIGINAL DESIGN CONTENTS</div><h1>다시 만나는 90s</h1><p class="sub">원 시안의 추천 순서를 따라 구성한 음악 차트입니다.</p>${rows(tracks)}`;
 if(route==='playlist'){
  const list=state.saved.map(id=>tracks.find(t=>t.id===id));
  html+=`<div class="banner"><img src="assets/bus.jpg" alt="원 시안의 앨범 이미지"><div><span class="eyebrow">MY PLAYLIST</span><h1>내 플레이리스트</h1><p>${list.length}곡 · ${esc(state.name)}의 취향</p>${list.length?'<button class="primary" id="play-saved">▶ 시연 재생</button>':''}</div></div>${list.length?rows(list,true):'<div class="empty">아직 담은 곡이 없습니다.<br>홈이나 검색에서 ‘+ 담기’를 눌러 나만의 목록을 만들어 보세요.<p><a href="#home" class="pill">앨범 둘러보기 →</a></p></div>'}`;
 }
 if(route==='player'){
  const t=current();html+=`<div class="eyebrow">NOW PLAYING</div><div class="player-view"><img src="assets/${t.art}.jpg" alt="${esc(t.album)} 원 시안 앨범 이미지"><div><span class="pill">${esc(t.genre)}</span><h1 style="margin-top:18px">${esc(t.title)}</h1><p class="sub">${esc(t.artist)} · ${esc(t.album)}</p><div class="controls"><button class="primary" id="large-toggle">${audio.paused?'▶ 시연 재생':'Ⅱ 일시정지'}</button>${addButton(t)}</div><div class="notice"><b>임시 데모 소리</b><br>재생·정지·탐색을 체험하려고 직접 합성한 16초 소리입니다. 앨범마다 다른 소리가 나지 않고, 표시된 앨범의 실제 곡은 재생하지 않습니다.</div></div></div><h2>다음으로 들을 목록</h2>${rows(queue().map(id=>tracks.find(t=>t.id===id)))}`;
 }
 if(route==='profile')html+=`<div class="eyebrow">YOUR PROFILE</div><h1>내 프로필</h1><div class="profile"><div class="avatar">○</div><div><h2 style="margin:0">${esc(state.name)}</h2><p class="sub" style="margin:10px 0 0">나의 플레이리스트 ${state.saved.length}곡</p></div></div><form class="profile-form" id="profile-form"><input id="profile-name" aria-label="프로필 이름" maxlength="24" value="${esc(state.name)}"><button class="primary">저장</button></form><div class="info-grid"><div><b>일반 회원</b><small>기획서의 프로필 표시</small></div><div><b>나의 취향</b><small>${state.saved.length}곡이 이 기기에 저장됨</small></div></div><div class="notice">개인 포트폴리오의 조작 시연입니다. 입력한 이름과 담은 목록은 이 브라우저에만 저장됩니다.</div><p class="back-profile"><a href="#playlist">내 플레이리스트 열기 →</a></p>`;
 main.innerHTML=html;updateBar();bind();
}
function genres(){return `<div class="genre-grid">${[['90s','#2879a8'],['댄스','#ea6450'],['발라드','#7357ae'],['K-Pop','#c63f87']].map(([g,c])=>`<button data-genre="${g}" style="--c:${c}">${g}<small>음악 찾아보기 →</small></button>`).join('')}</div>`;}
function bind(){
 $('#search-form').addEventListener('submit',e=>{e.preventDefault();query=e.currentTarget.querySelector('input').value;location.hash='search';render();});
 main.querySelectorAll('[data-play]').forEach(b=>b.onclick=()=>choose(b.dataset.play));
 main.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>{const id=b.dataset.add;const has=state.saved.includes(id);state.saved=has?state.saved.filter(x=>x!==id):[...state.saved,id];save();render();toast(has?'플레이리스트에서 뺐습니다':'내 플레이리스트에 담았습니다');});
 main.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{state.saved=state.saved.filter(x=>x!==b.dataset.remove);save();render();toast('플레이리스트에서 뺐습니다');});
 main.querySelectorAll('[data-genre]').forEach(b=>b.onclick=()=>{query=b.dataset.genre;location.hash='search';render();});
 $('#play-saved')?.addEventListener('click',()=>choose(state.saved[0]));
 $('#large-toggle')?.addEventListener('click',toggle);
 $('#profile-form')?.addEventListener('submit',e=>{e.preventDefault();const name=$('#profile-name').value.trim();if(!name){toast('프로필 이름을 입력해 주세요');return;}state.name=name;save();render();toast('프로필을 저장했습니다');});
}
function queue(){
 return state.collection==='playlist'&&state.saved.length ? state.saved : tracks.map(t=>t.id);
}
async function choose(id, collection=route==='playlist'?'playlist':route==='player'?state.collection:'catalog'){
 state.collection=collection;
 state.current=id;audio.currentTime=0;state.time=0;save();updateBar();if(route==='player')render();await play();
}
async function play(){const seq=++playSequence;try{await audio.play();if(seq!==playSequence)return;updateBar();}catch(e){toast('재생 버튼을 한 번 더 눌러 주세요');}}
function toggle(){if(audio.paused)play();else{++playSequence;audio.pause();save();updateBar();}}
function advance(step){
 const list=queue(), at=list.indexOf(state.current);
 const next=at<0 ? (step>0?0:list.length-1) : (at+step+list.length)%list.length;
 choose(list[next], state.collection);
}
function updateBar(){
 const t=current();$('#now-title').textContent=t.title;$('#now-artist').textContent=audioFailed?'소리 파일을 불러오지 못했습니다. 새로고침해 주세요':audioReady?t.artist+' · 임시 데모 소리':'소리 파일을 불러오는 중입니다…';$('#now-art').src=`assets/${t.art}.jpg`;$('#saved-count').textContent=state.saved.length;
 $('#toggle').textContent=audio.paused?'▶':'Ⅱ';$('#toggle').setAttribute('aria-label',audio.paused?'재생':'일시정지');
 const large=$('#large-toggle');if(large)large.textContent=audio.paused?'▶ 시연 재생':'Ⅱ 일시정지';
}
$('#toggle').onclick=toggle;$('#prev').onclick=()=>advance(-1);$('#next').onclick=()=>advance(1);$('#open-player').onclick=()=>{location.hash='player';};
$('.back').addEventListener('click',event=>{if(window.parent!==window){event.preventDefault();audio.pause();save();window.parent.postMessage({type:'room:close-work'},location.protocol==='file:'?'*':location.origin);}});
$('#seek').addEventListener('input',e=>{if(Number.isFinite(audio.duration))audio.currentTime=Math.min(audio.duration,Number(e.target.value));save();});
$('#volume').value=state.volume;audio.volume=state.volume;
$('#volume').addEventListener('input',e=>{audio.volume=state.volume=Number(e.target.value);save();});
audio.addEventListener('loadedmetadata',()=>{audioReady=true;updateBar();if(Number.isFinite(audio.duration)){audio.currentTime=Math.max(0,Math.min(audio.duration-.01,state.time||0));$('#seek').max=audio.duration;$('#duration').textContent=time(audio.duration);}});
audio.addEventListener('timeupdate',()=>{$('#seek').value=audio.currentTime;$('#elapsed').textContent=time(audio.currentTime);clearTimeout(saveTimer);saveTimer=setTimeout(save,200);});
audio.addEventListener('ended',()=>{save();updateBar();toast('시연 소리 재생이 끝났습니다');});
audio.addEventListener('play',updateBar);audio.addEventListener('pause',updateBar);
window.addEventListener('pagehide',save);window.addEventListener('hashchange',()=>{render();window.scrollTo(0,0);main.focus({preventScroll:true});});render();
// 전체 시연 소리를 읽어 Range 응답이 없는 간단한 전시 서버에서도 탐색한다.
async function loadDemoAudio(){
 if(location.protocol==='file:'){audio.src='assets/room-demo.wav';return;}
 try{const r=await fetch('assets/room-demo.wav');if(!r.ok)throw new Error('audio');audio.src=URL.createObjectURL(await r.blob());}
 catch(e){audio.src='assets/room-demo.wav';audio.addEventListener('error',()=>{audioFailed=true;updateBar();},{once:true});}
}
loadDemoAudio();
