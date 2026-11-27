'use strict';
// 기호 이름과 도형, 기술 이름과 순서는 아래 두 배열에서 편집합니다.
const SYMBOLS = [
 {name:'원',path:'<circle cx="32" cy="32" r="21"/>'},
 {name:'삼각',path:'<path d="M32 10 56 52H8Z"/>'},
 {name:'사각',path:'<rect x="12" y="12" width="40" height="40" rx="3"/>'},
 {name:'마름',path:'<path d="M32 7 57 32 32 57 7 32Z"/>'},
 {name:'겹선',path:'<path d="M10 22H54M10 42H54"/>'},
 {name:'점',path:'<circle cx="20" cy="20" r="3"/><circle cx="44" cy="20" r="3"/><circle cx="20" cy="44" r="3"/><circle cx="44" cy="44" r="3"/>'}
];
const TECHNIQUES = [
 {name:'첫빛',sequence:[0,2,1],ms:950},
 {name:'파동',sequence:[4,0,3,2],ms:800},
 {name:'매듭',sequence:[5,3,1,4,0],ms:680},
 {name:'연쇄',sequence:[3,1,5,0,4,2],ms:560}
];
(() => {
 const $=id=>document.getElementById(id);
 const svg=index=>'<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" focusable="false">'+SYMBOLS[index].path+'</svg>';
 let choice=0, phase='ready', entered=[], epoch=0;
 const timers=new Set();
 function later(fn,ms){const timer=setTimeout(()=>{timers.delete(timer);fn();},ms);timers.add(timer);}
 function cancel(){epoch++;for(const t of timers)clearTimeout(t);timers.clear();}
 function locked(){return phase!=='input';}
 function drawProgress(){
  $('progress').replaceChildren(...TECHNIQUES[choice].sequence.map((_,i)=>{
   const li=document.createElement('li');
   li.setAttribute('aria-label',i<entered.length?(i+1)+'번째 '+SYMBOLS[entered[i]].name:(i+1)+'번째 미입력');
   if(i<entered.length)li.innerHTML=svg(entered[i]);
   return li;
  }));
 }
 const HINTS={ready:'시작을 누르면, 이 아래 기호 버튼으로 입력합니다.',show:'기호가 모두 나온 뒤에 아래 버튼을 누르세요.',input:'지금 입력하세요. 본 순서대로 아래 기호를 누르세요. (키보드 1–6도 됩니다)',wrong:'틀렸어요. 아래 \u2018다시 도전\u2019을 누르면 순서를 다시 보여 줍니다.',success:'맞았어요.'};
 function buttons(){for(const b of $('symbols').querySelectorAll('button'))b.disabled=locked();$('symbols').classList.toggle('live',phase==='input');const h=$('inputhint');h.textContent=HINTS[phase]||'';h.classList.toggle('live',phase==='input');}
 function syncRadios(){const r=document.querySelectorAll('#techniques input');if(r[choice])r[choice].checked=true;}
 function ready(){
  cancel();phase='ready';entered=[];$('phase').textContent='준비';$('step').textContent=TECHNIQUES[choice].sequence.length+'개의 기호';$('display').innerHTML='';
  $('message').textContent=TECHNIQUES[choice].name+'을 완성해 보세요';$('detail').textContent='시작하면 기호 '+TECHNIQUES[choice].sequence.length+'개를 순서대로 보여드립니다.';$('start').textContent='시작';$('result').textContent='';drawProgress();buttons();
 }
 function start(){
  if(phase==='success'){choice=(choice+1)%TECHNIQUES.length;syncRadios();}
  cancel();const run=epoch;phase='show';entered=[];drawProgress();buttons();$('result').textContent='';$('start').textContent='처음부터 다시';
  const sequence=TECHNIQUES[choice].sequence;
  $('phase').textContent='순서를 보세요';$('display').innerHTML='';$('message').textContent='기호의 순서를 기억하세요';$('detail').textContent='재생 중에는 입력하지 않습니다.';
  let i=0;
  const show=()=>{
   if(run!==epoch)return;
   if(i>=sequence.length){phase='input';$('phase').textContent='기억한 순서 입력';$('step').textContent='0 / '+sequence.length;$('display').innerHTML='';$('message').textContent='같은 순서로 눌러 주세요';$('detail').textContent='아래 기호 버튼을 누르거나 키보드 1–6을 누르세요.';buttons();return;}
   $('step').textContent=(i+1)+' / '+sequence.length;$('display').innerHTML=svg(sequence[i]);$('message').textContent=SYMBOLS[sequence[i]].name;
   later(()=>{if(run!==epoch)return;$('display').innerHTML='';i++;later(show,350);},TECHNIQUES[choice].ms||950);
  };
  later(show,400);
 }
 function input(index){
  if(phase!=='input')return;
  const seq=TECHNIQUES[choice].sequence,position=entered.length;entered.push(index);drawProgress();$('step').textContent=entered.length+' / '+seq.length;
  if(index!==seq[position]){
   phase='wrong';$('phase').textContent='다시 도전';$('display').innerHTML=svg(index);$('message').textContent=(position+1)+'번째에서 달랐어요';$('detail').textContent='순서를 다시 보고 같은 기호를 눌러 보세요.';$('result').textContent='입력한 순서는 위에 남아 있습니다.';$('start').textContent='다시 도전';buttons();return;
  }
  if(entered.length===seq.length){phase='success';$('phase').textContent='완성';$('display').innerHTML=svg(index);$('message').textContent=TECHNIQUES[choice].name+' 완성';$('detail').textContent='기억한 순서가 모두 맞았습니다.';const last=choice===TECHNIQUES.length-1;$('result').textContent=last?'마지막 단계까지 모두 완성했습니다. 처음부터 다시 해 볼 수 있습니다.':'다음 단계는 기호 '+TECHNIQUES[choice+1].sequence.length+'개입니다. 위의 단계를 눌러 다른 단계를 고를 수도 있습니다.';$('start').textContent=last?'처음 단계부터 다시':'다음 단계 · '+TECHNIQUES[choice+1].sequence.length+'개';buttons();}
 }
 TECHNIQUES.forEach((t,i)=>{
  const label=document.createElement('label'),r=document.createElement('input'),span=document.createElement('span');
  r.type='radio';r.name='technique';r.value=String(i);r.checked=i===choice;r.addEventListener('change',()=>{choice=i;ready();});span.textContent=t.name+' · '+t.sequence.length;
  label.append(r,span);$('techniques').append(label);
 });
 SYMBOLS.forEach((s,i)=>{const b=document.createElement('button');b.type='button';b.innerHTML=svg(i)+'<span>'+s.name+' '+(i+1)+'</span>';b.setAttribute('aria-label',s.name+' ('+(i+1)+')');b.addEventListener('click',()=>input(i));$('symbols').append(b);});
 $('start').addEventListener('click',start);
 document.addEventListener('keydown',e=>{if(e.repeat||e.ctrlKey||e.metaKey||e.altKey||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;if(/^[1-6]$/.test(e.key)){e.preventDefault();input(Number(e.key)-1);}else if(e.key.toLowerCase()==='r'){e.preventDefault();start();}});
 window.addEventListener('pagehide',cancel);
 ready();
})();

