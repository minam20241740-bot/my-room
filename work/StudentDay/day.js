'use strict';
const $=id=>document.getElementById(id);
const ctx=$('screen').getContext('2d');
const stations=[
 {title:'테이블 · 공부의 흔적',text:'손을 대면 노트북과 공책, 커피잔의 윤곽이 빛으로 그려집니다.',on:'테이블에 손 대기',off:'손 떼기',result:'빛이 책상 위를 지나 학생의 자리로 모입니다.'},
 {title:'액자 · 지나가는 하루',text:'액자 가까이 다가가면 창밖의 하늘이 아침에서 저녁으로 바뀝니다.',on:'액자에 다가가기',off:'물러서기',result:'창밖의 하루가 흐르기 시작합니다.'},
 {title:'카운터 · 쉬어 가는 시간',text:'빈 잔을 내려놓으면 잔 위로 김이 오르고 빛이 번집니다.',on:'빈 잔 올려놓기',off:'잔 들어 올리기',result:'잔을 중심으로 김과 따뜻한 빛이 피어납니다.'}
];
let place=0,active=false,start=0,raf=0;
let audio;
function cupSound(){
 try{
  audio ||= new AudioContext();
  void audio.resume().then(()=>{
   if(!active||place!==2)return;
   for(const [hz,level] of [[670,.07],[1390,.025],[2050,.01]]){
    const tone=audio.createOscillator(),gain=audio.createGain(),t=audio.currentTime;
    tone.frequency.value=hz;gain.gain.setValueAtTime(level,t);
    gain.gain.exponentialRampToValueAtTime(.0001,t+.32);
    tone.connect(gain).connect(audio.destination);tone.start(t);tone.stop(t+.33);
    tone.onended=()=>{tone.disconnect();gain.disconnect()};
   }
  }).catch(()=>{});
 }catch{}
}
const reduce=matchMedia('(prefers-reduced-motion: reduce)');
function path(points,color,width=3){
 ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();
}
function ellipse(x,y,rx,ry,color,fill=false){ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);if(fill){ctx.fillStyle=color;ctx.fill()}else{ctx.strokeStyle=color;ctx.lineWidth=3;ctx.stroke()}}
function lineBox(x,y,w,h,col){ctx.strokeStyle=col;ctx.lineWidth=3;ctx.strokeRect(x,y,w,h)}
function studio(v){
 const glow=ctx.createRadialGradient(440,270,15,440,270,340);glow.addColorStop(0,'rgba(255,192,95,'+(v*.36)+')');glow.addColorStop(1,'transparent');ctx.fillStyle=glow;ctx.fillRect(0,0,900,440);
 path([[80,300],[780,220],[897,320],[170,418],[80,300]],'#a59b90');path([[170,419],[170,440]],'#a59b90');path([[862,324],[862,440]],'#a59b90');
 ctx.save();ctx.globalAlpha=v;
 path([[258,284],[242,174],[442,151],[460,260],[258,284],[499,270],[460,260]],'#ffda95',4);
 path([[495,282],[572,269],[614,290],[535,306],[495,282]],'#ffe5bf',4);
 path([[537,287],[574,282]],'#ffe5bf',2);
 ellipse(676,244,27,9,'#ffe5bf');path([[649,244],[654,276],[693,274],[702,244]],'#ffe5bf');ellipse(704,256,9,8,'#ffe5bf');
 ctx.globalAlpha=Math.max(0,v*2-1)*.75;ellipse(537,117,28,33,'#d1c2a7',true);path([[479,216],[489,176],[513,151],[551,148],[576,171],[592,203]],'#ccbaa6',9);ctx.restore();
}
function windowScene(v){
 const sky=ctx.createLinearGradient(0,50,0,338);sky.addColorStop(0,'hsl('+(203+104*v)+' 32% '+(47-20*v)+'%)');sky.addColorStop(1,'hsl('+(48-25*v)+' 79% 73%)');
 ctx.fillStyle=sky;ctx.fillRect(162,60,576,282);ellipse(226+440*v,210-115*Math.sin(v*Math.PI),22,22,'#ffeaca',true);
 for(let i=0;i<15;i++){const h=25+((i*47)%92);ctx.fillStyle=i%2?'#364956':'#2b3e4b';ctx.fillRect(162+i*39,342-h,36,h)}
 lineBox(150,48,600,307,'#ddcbb0');path([[450,59],[450,341]],'#7a6d58',7);path([[150,356],[750,356]],'#bfae98',8);
 ctx.fillStyle='#f2debd';ctx.font='24px sans-serif';ctx.fillText(v<.35?'오전 수업':v<.75?'오후 작업':'수업을 마치고',166,400);
}
function counter(v,t){
 path([[75,327],[705,270],[858,304],[217,385],[75,327]],'#a4998a');
 const glow=ctx.createRadialGradient(479,287,5,479,287,200);glow.addColorStop(0,'rgba(255,175,74,'+(.65*v)+')');glow.addColorStop(1,'transparent');ctx.fillStyle=glow;ctx.fillRect(0,0,900,440);
 const y=active?264:164;ellipse(462,y,54,14,'#f4ddbc');path([[408,y],[422,y+53],[494,y+53],[516,y]],'#f4ddbc',4);ellipse(521,y+21,16,13,'#f4ddbc');
 if(active)for(let i=0;i<3;i++){const points=[];for(let j=0;j<26;j++)points.push([438+i*23+Math.sin(j*.23+t+i)*7,246-j*3.1]);path(points,'rgba(255,222,167,'+(.6*v)+')',3)}
}
function draw(now){
 ctx.fillStyle='#1b222a';ctx.fillRect(0,0,900,440);path([[0,280],[900,216]],'#38414a',2);
 const elapsed=(now-start)/1000,v=active?(reduce.matches?1:Math.min(1,elapsed/(place===1?6:1.8))):0;
 if(place===0)studio(v);else if(place===1)windowScene(v);else counter(v,reduce.matches?0:elapsed);
 if(active&&!reduce.matches&&(v<1||place===2))raf=requestAnimationFrame(draw);
}
function update(){
 cancelAnimationFrame(raf);const station=stations[place];$('title').textContent=station.title;$('text').textContent=station.text;
 $('screen').setAttribute('aria-label',station.title+' 투영 장면');$('act').textContent=active?station.off:station.on;$('act').setAttribute('aria-pressed',String(active));
 document.querySelectorAll('[data-place]').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.place===place)));
 start=performance.now();draw(start);
}
document.querySelectorAll('[data-place]').forEach(b=>b.onclick=()=>{place=+b.dataset.place;active=false;$('status').textContent='';update()});
$('act').onclick=()=>{active=!active;if(active&&place===2)cupSound();$('status').textContent=active?stations[place].result:'처음 장면으로 돌아왔습니다.';update()};
$('leave').onclick=()=>{if(parent===window)location.href='../../index.html';else parent.postMessage({type:'room:return-detail'},location.origin==='null'?'*':location.origin)};
update();
