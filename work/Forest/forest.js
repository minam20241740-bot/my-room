'use strict';
const $=id=>document.getElementById(id);
const storeKey='MyRoom.Forest.V1';
const catalog=[
  {name:'주택',wood:50,stone:30}, {name:'작업장',wood:80,stone:60},
  {name:'벌목장',wood:40,stone:20}, {name:'농장',wood:60,stone:40},
  {name:'성벽',wood:100,stone:120}
];
const fresh=()=>({wood:50,stone:30,plots:[null,null,null],journey:ForestJourney.create()});
const valid=s=>s&&['wood','stone'].every(k=>Number.isSafeInteger(s[k])&&s[k]>=0)&&Array.isArray(s.plots)&&s.plots.length===3&&s.plots.every(id=>id===null||(Number.isInteger(id)&&id>=0&&id<catalog.length));
function readSave(){
  try{
    const value=JSON.parse(localStorage.getItem(storeKey));
    if(!valid(value))return null;
    return {wood:value.wood,stone:value.stone,plots:value.plots,journey:ForestJourney.restore(value.journey)};
  }catch{return null}
}
let state=fresh(),selected=0;
function message(text){$('status').textContent=text}
function render(){
  $('wallet').textContent='나무 '+state.wood+' · 돌 '+state.stone;
  $('count').textContent='건설 '+state.plots.filter(p=>p!==null).length+' / 3';
  for(const b of $('buildings').children)b.setAttribute('aria-pressed',String(+b.dataset.type===selected));
  for(const b of $('plots').children){
    const i=+b.dataset.plot, id=state.plots[i];
    b.replaceChildren();
    if(id!==null){const icon=document.createElement('img');icon.src='building-'+id+'.webp';icon.alt='';b.append(icon)}
    b.append(['서쪽','가운데','동쪽'][i]+' · '+(id===null?'빈터':catalog[id].name));
    const hint=document.createElement('small');hint.textContent=id===null?'건물을 고른 뒤 누르세요':'건설 완료';b.append(hint);
    b.dataset.built=String(id!==null);
  }
}
function enter(data){
  state=data;selected=0;$('menu').hidden=true;$('world').hidden=false;
  ForestJourney.enter();
  render();message(state.journey.phase==='fight'?'악몽의 숲에서 저장한 전투를 이어갈 수 있습니다.':'건물을 고른 뒤 숲의 빈터를 선택하세요.');$('buildings').firstElementChild.focus();
}
function title(){
  $('world').hidden=true;$('menu').hidden=false;$('load').disabled=!readSave();
  $('menu-note').textContent=$('load').disabled?'':'저장한 마을이 있습니다.';$('start').focus();
}
for(const [i,building] of catalog.entries()){
  const b=document.createElement('button');b.dataset.type=i;b.textContent=building.name+' · '+building.wood+' / '+building.stone;
  b.setAttribute('aria-label',building.name+' 나무 '+building.wood+' 돌 '+building.stone);
  b.onclick=()=>{selected=i;render();message(building.name+'을 지을 빈터를 선택하세요.')};$('buildings').append(b);
}
for(let i=0;i<3;i++){
  const b=document.createElement('button');b.className='plot';b.dataset.plot=i;
  b.onclick=()=>{
    if(state.plots[i]!==null){message('이 터에는 '+catalog[state.plots[i]].name+'이 있습니다.');return}
    const building=catalog[selected];
    if(state.wood<building.wood||state.stone<building.stone){message('자원이 부족합니다. 숲에서 나무와 돌을 더 모으세요.');return}
    state.wood-=building.wood;state.stone-=building.stone;state.plots[i]=selected;render();
    message(building.name+' 건설 완료.'+(state.plots.every(p=>p!==null)?' 세 자리에 마을이 완성되었습니다.':''));
  };$('plots').append(b);
}
document.querySelectorAll('[data-gather]').forEach(b=>b.onclick=()=>{const wood=b.dataset.gather==='wood';state[b.dataset.gather]=Math.min(Number.MAX_SAFE_INTEGER,state[b.dataset.gather]+(wood?25:20));render();message(wood?'나무 25개를 모았습니다.':'돌 20개를 모았습니다.')});
$('start').onclick=()=>enter(fresh());$('load').onclick=()=>{const save=readSave();if(save)enter(save);else title()};
$('save').onclick=()=>{try{localStorage.setItem(storeKey,JSON.stringify(state));message('이 기기에 마을을 저장했습니다.')}catch{message('브라우저에서 저장 공간을 사용할 수 없습니다.')}};
$('home').onclick=title;
$('leave').onclick=()=>{if(parent===window)location.href='../../index.html';else parent.postMessage({type:'room:return-detail'},location.origin==='null'?'*':location.origin)};
ForestJourney.bind(()=>state,message);
title();
