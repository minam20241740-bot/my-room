'use strict';
const $=id=>document.getElementById(id);
const ctx=$('screen').getContext('2d');
const stations=[
 {title:'테이블',text:'손을 대면 노트북, 공책, 커피잔이 나타나고 책상 앞에 학생이 앉은 모습이 보입니다.',on:'테이블에 손 대기',off:'손 떼기',result:'노트북, 공책, 커피잔, 학생 순서로 나타납니다.',done:'노트북, 공책, 커피잔, 학생이 모두 나타났습니다. 손을 떼면 사라집니다.'},
 {title:'액자',text:'액자 가까이 가면 창밖이 아침에서 저녁으로 바뀝니다.',on:'액자에 다가가기',off:'물러서기',result:'창밖이 아침에서 저녁으로 바뀌는 중입니다.',done:'저녁이 되었습니다. 물러서면 아침으로 돌아갑니다.'},
 {title:'카운터',text:'빈 잔을 올려놓으면 김이 오릅니다.',on:'빈 잔 올려놓기',off:'잔 들어 올리기',result:'잔 위로 김이 오릅니다.',done:'잔 위로 김이 오르는 중입니다. 잔을 들어 올리면 멈춥니다.'}
];
let place=0,active=false,start=0,raf=0,doneShown=false;
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
function label(text,x,y,a){
 if(a<=0)return;ctx.save();ctx.globalAlpha=Math.min(1,a);ctx.font='bold 28px sans-serif';ctx.textAlign='center';ctx.lineWidth=5;ctx.strokeStyle='#161b21';ctx.strokeText(text,x,y);ctx.fillStyle='#ffe5bf';ctx.fillText(text,x,y);ctx.restore();
}
function studio(v,t){
 const glow=ctx.createRadialGradient(440,270,15,440,270,340);glow.addColorStop(0,'rgba(255,192,95,'+(v*.36)+')');glow.addColorStop(1,'transparent');ctx.fillStyle=glow;ctx.fillRect(0,0,900,440);
 path([[80,300],[780,220],[897,320],[170,418],[80,300]],'#a59b90');path([[170,419],[170,440]],'#a59b90');path([[862,324],[862,440]],'#a59b90');
 const step=i=>Math.max(0,Math.min(1,v*4-i));
 // 손을 댄 자리: 퍼지는 동그라미와 '손' 글자
 if(active){
  const ring=reduce.matches?0:(t%1.6)/1.6;
  ctx.save();ctx.globalAlpha=.9;ellipse(430,352,16,10,'#ffda95',true);ctx.globalAlpha=(1-ring)*.8;ellipse(430,352,16+ring*50,10+ring*22,'#ffda95');ctx.restore();
  label('손',430,396,1);
 }
 // 다 나온 뒤에는 윤곽이 천천히 밝아졌다 어두워집니다
 const pulse=v>=1&&!reduce.matches?.8+.2*Math.sin(t*3):1;
 ctx.save();
 ctx.globalAlpha=step(0)*pulse;
 path([[258,284],[242,174],[442,151],[460,260],[258,284],[499,270],[460,260]],'#ffda95',4);
 ctx.globalAlpha=step(1)*pulse;
 path([[495,282],[572,269],[614,290],[535,306],[495,282]],'#ffe5bf',4);
 path([[537,287],[574,282]],'#ffe5bf',2);
 ctx.globalAlpha=step(2)*pulse;
 ellipse(676,244,27,9,'#ffe5bf');path([[649,244],[654,276],[693,274],[702,244]],'#ffe5bf');ellipse(704,256,9,8,'#ffe5bf');
 ctx.globalAlpha=step(3)*.75;ellipse(537,117,28,33,'#d1c2a7',true);path([[479,216],[489,176],[513,151],[551,148],[576,171],[592,203]],'#ccbaa6',9);ctx.restore();
 label('노트북',350,322,step(0));label('공책',555,336,step(1));label('커피잔',676,310,step(2));label('학생',537,76,step(3));
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
 const elapsed=(now-start)/1000,v=active?(reduce.matches?1:Math.min(1,elapsed/(place===1?6:place===0?3.2:1.8))):0;
 if(place===0)studio(v,reduce.matches?0:elapsed);else if(place===1)windowScene(v);else counter(v,reduce.matches?0:elapsed);
 if(active&&!reduce.matches&&(v<1||place===2||place===0))raf=requestAnimationFrame(draw);
 if(active&&v>=1&&!doneShown){doneShown=true;$('status').textContent=stations[place].done}
}
function update(){
 cancelAnimationFrame(raf);const station=stations[place];$('title').textContent=station.title;$('text').textContent=station.text;
 $('screen').setAttribute('aria-label',station.title+' 투영 장면');$('act').textContent=active?station.off:station.on;$('act').setAttribute('aria-pressed',String(active));
 document.querySelectorAll('[data-place]').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.place===place)));
 doneShown=false;start=performance.now();draw(start);
}
document.querySelectorAll('[data-place]').forEach(b=>b.onclick=()=>{place=+b.dataset.place;active=false;$('status').textContent='';update()});
$('act').onclick=()=>{active=!active;if(active&&place===2)cupSound();$('status').textContent=active?stations[place].result:'처음 상태로 돌아왔습니다.';update()};
$('leave').onclick=()=>{if(parent===window)location.href='../../index.html';else parent.postMessage({type:'room:return-detail'},location.origin==='null'?'*':location.origin)};
update();
