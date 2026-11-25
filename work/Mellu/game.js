'use strict';
(() => {
  const story = window.MELLU_STORY;
  const $ = id => document.getElementById(id);
  const canvas = $('world'), ctx = canvas.getContext('2d');
  const KEY = 'mellu-voyage-save-v1';
  const MAX_HP = 36, MAX_FOCUS = 10, TILE = 48;
  const moves = {up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]};
  const nearbyDistance = 2;
  const initial = () => ({version:1,chapter:0,x:9,y:9,hp:36,focus:10,tea:3,bond:0,form:'male',flags:{},items:[],log:[],completed:false});
  let state=initial(), mode='title', dialogue=null, battle=null, sound=false, audio=null, lastStep=-Infinity, toastTimer, cutsceneTimer;
  let worldFrame = null;
  let saveAvailable=true, stored=null;
  let markedNpc = null, routeShown = false, routeTarget = null, routePath = [];
  try {stored=JSON.parse(localStorage.getItem(KEY));} catch {saveAvailable=false;}
  function validSave(s) {
    return s && s.version===1 && Number.isInteger(s.chapter) && s.chapter>=0 && s.chapter<story.chapters.length && Number.isInteger(s.x) && Number.isInteger(s.y) && s.x>=1 && s.x<=18 && s.y>=4 && s.y<=10 && ['hp','focus','tea','bond'].every(k=>Number.isFinite(s[k])&&s[k]>=0) && s.hp<=MAX_HP && s.focus<=MAX_FOCUS && ['male','ts'].includes(s.form) && s.flags && typeof s.flags==='object' && Array.isArray(s.items) && s.items.every(x=>typeof x==='string') && Array.isArray(s.log) && s.log.every(x=>typeof x==='string');
  }
  if(!validSave(stored)) stored=null;
  $('continueGame').disabled=!stored;
  function toast(text) { $('toast').textContent=text; $('toast').hidden=false; clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('toast').hidden=true,2800); }
  function tone(hz=400,duration=.06) {if(!sound)return;try{audio ||= new(window.AudioContext||window.webkitAudioContext)();const o=audio.createOscillator(),g=audio.createGain();o.type='sine';o.frequency.value=hz;g.gain.setValueAtTime(.025,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+duration);}catch{}}
  function log(text) {if(state.log.at(-1)!==text)state.log.push(text);}
  // Save the recovery point as well as transient modes. Reloads resume unfinished scenes.
  function save(manual=false) {
    const payload={...state,resume:dialogue?{type:'dialogue',node:dialogue.node,index:dialogue.index}:battle?{type:'battle',encounter:battle.id,hp:battle.hp,turn:battle.turn}:mode==='cinematic'?{type:'cinematic',kind:$('cinematic').dataset.kind}:null};
    try{localStorage.setItem(KEY,JSON.stringify(payload));stored=payload;saveAvailable=true;$('saveStatus').textContent='자동 저장됨';$('continueGame').disabled=false;if(manual)toast('여기까지 저장했습니다.');}catch{saveAvailable=false;$('saveStatus').textContent='저장 공간 사용 불가';if(manual)toast('이 브라우저에서는 저장할 수 없습니다. 현재 플레이는 계속할 수 있습니다.');}
  }
  function updateUI(){const ch=story.chapters[state.chapter];$('chapterLabel').textContent=ch.label;$('sceneTitle').textContent=ch.title;$('locationTag').textContent=ch.location;$('mapMood').textContent=ch.mood;$('characterRole').textContent=ch.role;$('formLabel').textContent=state.form==='ts'?'개화한 검은여우':'검은여우';$('hpValue').textContent=`${state.hp} / ${MAX_HP}`;$('hpBar').value=state.hp;$('focusValue').textContent=`${state.focus} / ${MAX_FOCUS}`;$('focusBar').value=state.focus;$('teaValue').textContent=state.tea;$('bondValue').textContent=state.bond;$('questTitle').textContent=state.completed?'다녀왔습니다':ch.quest;$('questText').textContent=state.completed?'멜루는 돌아온 방에서 방송을 이어간다. 방을 자유롭게 둘러볼 수 있다.':ch.description;$('questSteps').replaceChildren(...ch.steps.map(([flag,title])=>{const e=document.createElement('div');e.className='quest-step'+(state.flags[flag]?' done':'');e.textContent=(state.flags[flag]?'✓ ':'○ ')+title;return e;}));$('inventory').replaceChildren(...(state.items.length?state.items.map(item=>{const e=document.createElement('span');e.className='item';e.textContent=item;return e;}):[Object.assign(document.createElement('span'),{className:'empty',textContent:'아직 주머니가 가볍다.'})]));$('recentLog').replaceChildren(...state.log.slice(-3).reverse().map(text=>Object.assign(document.createElement('li'),{textContent:text})));$('interactButton').disabled=mode!=='explore';updateRoute();}
  function startNew(){clearTimeout(cutsceneTimer);state=initial();state.log=['출장을 마쳤다. 귀환표를 확인하고 집으로 돌아가자.'];launch(false);showDialogue(story.chapters[0].intro);}
  function launch(resume){$('titleScreen').hidden=true;$('playScreen').hidden=false;$('battle').hidden=true;$('dialogue').hidden=true;$('cinematic').hidden=true;mode='explore';dialogue=null;battle=null;markedNpc=null;startWorldDrawing();updateUI();if(resume&&state.resume){const r=state.resume;if(r.type==='dialogue'&&story.nodes[r.node])showDialogue(r.node,Math.max(0,Number.isInteger(r.index)?r.index:0));else if(r.type==='battle'&&story.encounters[r.encounter])startBattle(r.encounter,r);else if(r.type==='cinematic'&&['awakening','neon'].includes(r.kind))cinematic(r.kind);}save();}
  function chapter(n){state.chapter=n;markedNpc=null;state.x=9;state.y=9;state.hp=Math.max(24,state.hp);state.focus=Math.max(7,state.focus);mode='explore';$('battle').hidden=true;$('cinematic').hidden=true;updateUI();showDialogue(story.chapters[n].intro);}
  function applyEffects(effects=[]){for(const e of effects){if(e.flag)state.flags[e.flag]=true;if(e.item&&!state.items.includes(e.item))state.items.push(e.item);if(e.remove)state.items=state.items.filter(x=>x!==e.remove);if(e.hp)state.hp=Math.max(1,Math.min(MAX_HP,state.hp+e.hp));if(e.focus)state.focus=Math.max(0,Math.min(MAX_FOCUS,state.focus+e.focus));if(e.tea)state.tea=Math.max(0,state.tea+e.tea);if(e.teaMin)state.tea=Math.max(state.tea,e.teaMin);if(e.bond)state.bond+=e.bond;if(e.log)log(e.log);if(e.form)state.form=e.form;if(e.end){state.completed=true;toast('항해 완료. 이제 멜루의 일상이 이어집니다.');}if(e.chapter!==undefined){chapter(e.chapter);return true;}if(e.battle){startBattle(e.battle);return true;}if(e.cinematic){cinematic(e.cinematic);return true;}}updateUI();save();return false;}
  function showDialogue(node,index=0){if(!story.nodes[node])return;mode='dialogue';battle=null;$('battle').hidden=true;dialogue={node,index:Math.min(index,story.nodes[node].lines.length-1)};$('dialogue').hidden=false;$('prompt').hidden=true;renderDialogue();updateUI();save();}
  function makeButton(text,callback){const b=document.createElement('button');b.textContent=text;b.onclick=callback;return b;}
  function renderDialogue(){const node=story.nodes[dialogue.node],line=node.lines[dialogue.index];$('speaker').textContent=line[0];$('dialogueText').textContent=line[1];$('lineNumber').textContent=`${dialogue.index+1} / ${node.lines.length}`;$('dialogueEvidence').hidden=node.evidence!=='dock-snack';$('choices').replaceChildren();if(dialogue.index<node.lines.length-1){$('choices').append(makeButton('계속  ↵',advanceDialogue));}else if(node.choices){for(const choice of node.choices)$('choices').append(makeButton(choice.text,()=>finishDialogue(choice.effects,choice.next)));}else $('choices').append(makeButton('계속  ↵',()=>finishDialogue(node.effects)));}
  function advanceDialogue(){if(!dialogue)return;const n=story.nodes[dialogue.node];if(dialogue.index<n.lines.length-1){dialogue.index++;tone(440);renderDialogue();save();}else if(!n.choices)finishDialogue(n.effects);else if(n.choices.length===1)finishDialogue(n.choices[0].effects,n.choices[0].next);}
  function finishDialogue(effects,next){dialogue=null;$('dialogue').hidden=true;mode='explore';tone(520);if(applyEffects(effects))return;if(next)showDialogue(next);else{updateUI();save();}}
  function closest(){let best=null,distance=2.1;for(const npc of story.chapters[state.chapter].npcs){const d=Math.abs(npc.x-state.x)+Math.abs(npc.y-state.y);if(d<distance){best=npc;distance=d;}}return best;}
  function interact(npc=nearbyTarget()){
    if(mode==='dialogue'){advanceDialogue();return;}
    if(mode!=='explore')return;
    if(!npc || distanceTo(npc)>nearbyDistance){toast('표시된 인물이나 물건 가까이 다가가세요.');return;}
    if (markedNpc===npc.id) markedNpc=null;
    const f=state.flags;let node;
    switch(npc.id){
      case'tea':node='rest';break;
      case'ticket':node=f.ticket?'ticketAgain':'ticket';break;
      case'registrar':node=f.manifest?'registrarAgain':f.ticket?'registrar':'noTicket';break;
      case'gate':node=f.manifest?'gate':'gateLocked';break;
      case'crate':node=f.part?'crateAgain':'crate';break;
      case'snack':node=f.snack?'snackAgain':'snack';break;
      case'mechanic':node=f.repaired?'mechanicAgain':f.part?'mechanic':'mechanicNeed';break;
      case'board':node=f.chart?'chartAgain':'chart';break;
      case'sail':node=f.repaired&&f.chart?'sail':'sailLocked';break;
      case'crew':node=f.supply?'supplyAgain':'supply';break;
      case'radio':node=f.signal?'radioAgain':'radio';break;
      case'route':node=f.signal&&f.supply?'route':'routeLocked';break;
      case'rescue':node=f.rescue?'rescueAgain':'rescue';break;
      case'treasure':node=!f.rescue?'treasureLocked':'keeper';break;
      case'desk':node=f.setup?'deskAgain':'desk';break;
      case'mirror':node=f.rehearsal?'mirrorAgain':f.setup?'mirror':'mirrorNeed';break;
      case'screen':node=f.setup&&f.rehearsal?'debut':'screenLocked';break;
      case'computer':node=f.onAir?'onAir':'computer';break;
      case'souvenir':node='souvenir';break;
    }if(node)showDialogue(node);
  }
  function blocked(x,y){return x<1||x>18||y<4||y>10||story.chapters[state.chapter].npcs.some(n=>n.x===x&&n.y===y);}
  function move(dir){if(mode!=='explore'||$('journal').open)return;const delta=moves[dir];if(!delta)return;let x=state.x+delta[0],y=state.y+delta[1];if(!blocked(x,y)){state.x=x;state.y=y;tone(190,.025);save();}updatePrompt();updateRoute();}
  function distanceTo(npc){
    return Math.abs(npc.x-state.x)+Math.abs(npc.y-state.y);
  }
  function nearbyTarget(){
    const chosen=story.chapters[state.chapter].npcs.find(npc=>npc.id===markedNpc);
    return chosen&&distanceTo(chosen)<=nearbyDistance?chosen:closest();
  }
  function waypointPath(npc){
    const queue=[{x:state.x,y:state.y,path:[]}];
    const seen=new Set([`${state.x}:${state.y}`]);
    for(const step of queue){
      if(Math.abs(npc.x-step.x)+Math.abs(npc.y-step.y)<=nearbyDistance)return step.path;
      for(const [dx,dy] of Object.values(moves)){
        const x=step.x+dx,y=step.y+dy,key=`${x}:${y}`;
        if(seen.has(key)||blocked(x,y))continue;
        seen.add(key);
        queue.push({x,y,path:[...step.path,{x,y}]});
      }
    }
    return [];
  }
  function updateRoute(){
    const chapter=story.chapters[state.chapter];
    const marked=chapter.npcs.find(npc=>npc.id===markedNpc);
    const next=state.completed?null:(chapter.steps.find(([flag])=>!state.flags[flag]) || chapter.exitRoute);
    routeTarget=mode==='explore' ? (marked || chapter.npcs.find(npc=>npc.id===next?.[2]) || null) : null;
    $('routeGuide').hidden=!routeTarget;
    $('routeButton').setAttribute('aria-pressed',String(routeShown));
    $('routeButton').textContent=routeShown?'길 표시 끄기':'지도에 길 표시';
    routePath=routeTarget && routeShown ? waypointPath(routeTarget):[];
    if(!routeTarget)return;
    $('targetAction').textContent=marked?'지도에서 고른 곳':next[1];
    $('targetName').textContent=routeTarget.label;
    $('targetDistance').textContent=distanceTo(routeTarget)<=nearbyDistance?'조사할 수 있어요':'가까이 다가가 조사하세요';
  }
  function chooseMapTarget(event){
    if(mode!=='explore'||$('journal').open)return;
    const bounds=canvas.getBoundingClientRect();
    const x=(event.clientX-bounds.left)*canvas.width/bounds.width;
    const y=(event.clientY-bounds.top)*canvas.height/bounds.height;
    const target=story.chapters[state.chapter].npcs.find(npc=>
      Math.abs(x-(npc.x*TILE+24))<=28 && y>=npc.y*TILE-13 && y<=npc.y*TILE+73);
    if(!target)return;
    if(distanceTo(target)<=nearbyDistance){interact(target);return;}
    markedNpc=target.id;
    routeShown=true;
    updateRoute();
    updatePrompt();
  }
  function updatePrompt(){
    const npc=mode==='explore'?nearbyTarget():null;
    $('prompt').hidden=!npc;
    if(npc)$('prompt').textContent=`조사 · ${npc.label}`;
    const locations=story.chapters[state.chapter].npcs.map(n=>`${n.label} ${n.x}, ${n.y}`).join('. ');
    canvas.setAttribute('aria-label',`탐색 지도. 멜루 위치 ${state.x}, ${state.y}. ${locations}`);
    $('sceneHint').textContent=mode==='explore'
      ?'방향키 / WASD로 이동 · 가까이서 E 또는 지도 표식 선택'
      :'대화와 선택이 끝나면 다시 이동할 수 있어요.';
  }
  function startBattle(id,resume){mode='battle';dialogue=null;$('dialogue').hidden=true;const e=story.encounters[id];battle={id,hp:resume&&Number.isInteger(resume.hp)&&resume.hp>0&&resume.hp<=e.hp?resume.hp:e.hp,max:e.hp,turn:resume&&Number.isInteger(resume.turn)&&resume.turn>=0?resume.turn:0};$('battle').hidden=false;$('prompt').hidden=true;$('battleLog').textContent='적의 다음 행동을 확인하세요. 큰 공격 직전에는 숨 고르기가 유리합니다.';renderBattle();updateUI();save();}
  function renderBattle(){if(!battle)return;const e=story.encounters[battle.id],intent=e.intents[battle.turn%e.intents.length];$('enemyName').textContent=e.name;$('turnNumber').textContent=`TURN ${battle.turn+1} · ${battle.hp}/${battle.max}`;$('enemyFill').style.width=`${Math.max(0,battle.hp/battle.max)*100}%`;$('enemyIntent').textContent=`다음 행동: ${intent.name} · 예상 피해 ${intent.damage}`;document.querySelector('[data-action="wit"]').disabled=state.focus<3;document.querySelector('[data-action="tea"]').disabled=state.tea<1;}
  function action(name){if(mode!=='battle'||!battle)return;const e=story.encounters[battle.id],intent=e.intents[battle.turn%e.intents.length];let text='',guard=false;
    if(name==='strike'){battle.hp-=7;text='지팡이로 진로를 열었다. 피해 7.';}
    else if(name==='wit'){if(state.focus<3){toast('집중이 부족합니다. 숨을 고르세요.');return;}state.focus-=3;const damage=12+Math.min(3,state.bond);battle.hp-=damage;text=`항로를 읽고 동료에게 신호를 보냈다. 피해 ${damage}.`;}
    else if(name==='guard'){guard=true;state.focus=Math.min(MAX_FOCUS,state.focus+4);text='자세를 낮추고 숨을 골랐다. 받는 피해 감소, 집중 +4.';}
    else if(name==='tea'){if(state.tea<1)return;state.tea--;state.hp=Math.min(MAX_HP,state.hp+12);text='따뜻한 차를 마셨다. 체력 +12.';}else return;
    tone(name==='guard'?260:600,.08);
    if(battle.hp<=0){state.flags[e.reward]=true;log(`${e.name} · 맞서 싸워 항로를 열었다.`);battle=null;$('battle').hidden=true;showDialogue(e.win);return;}
    const damage=guard?Math.max(1,Math.floor(intent.damage*.25)):intent.damage;state.hp=Math.max(0,state.hp-damage);text+=`\n${intent.name}. 체력 -${damage}.`;battle.turn++;$('battleLog').textContent=text;
    if(state.hp<=0){battle=null;state.hp=1;$('battle').hidden=true;showDialogue('defeat');return;}
    updateUI();renderBattle();save();
  }
  function cinematic(kind){
    clearTimeout(cutsceneTimer);
    mode='cinematic';dialogue=null;battle=null;
    $('dialogue').hidden=true;$('battle').hidden=true;
    const el=$('cinematic'), portrait=$('revealPortrait'), next=$('cinematicNext');
    el.hidden=false;
    el.dataset.kind=kind;
    el.classList.toggle('neon',kind==='neon');
    el.classList.remove('revealed');
    next.hidden=true;
    portrait.src='assets/mellu-awakened.png';
    portrait.alt='빛 속에 일어선 검은여우 멜루';
    $('cinematicCaption').textContent=kind==='neon'
      ?'NEON · 소개 영상 대신 챌린지가 재생된다.'
      :'에고 개화 · 함께 돌아가는 길을 잇는다.';
    if(kind==='awakening')state.form='ts';
    updateUI();save();
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    cutsceneTimer=setTimeout(()=>{
      el.classList.add('revealed');
      next.hidden=false;
      if(kind==='neon'){
        portrait.src='assets/mellu-front.png';
        portrait.alt='빛이 걷힌 뒤의 멜루';
      }
      $('cinematicCaption').textContent=kind==='neon'
        ?'익숙한 모습의 멜루가 다시 나타났다.'
        :'문이 열린다. 이제 전부 데리고 돌아가자.';
    },reduced?180:1250);
    next.onclick=()=>{
      el.hidden=true;
      if(kind==='neon'){state.form='male';showDialogue('afterNeon');}
      else showDialogue('awakened');
    };
  }
  function journal(){const content=$('journalContent');content.replaceChildren();const heading=t=>Object.assign(document.createElement('h3'),{textContent:t});content.append(heading('현재 항로'));const p=document.createElement('p');p.textContent=story.chapters[state.chapter].description;content.append(p,heading('지나온 기록'));const list=document.createElement('ol');for(const text of state.log)list.append(Object.assign(document.createElement('li'),{textContent:text}));if(!state.log.length)list.append(Object.assign(document.createElement('li'),{textContent:'아직 출발하지 않았다.'}));content.append(list,heading('조작'));content.append(Object.assign(document.createElement('p'),{textContent:'방향키 / WASD: 이동 · E / Enter: 대화 · J: 수첩 · Esc: 수첩 닫기. 큰 공격은 숨 고르기로 버티고, 잦아들었을 때 대화와 타격을 이어가세요. 휴게 의자에서는 회복할 수 있습니다.'}));$('journal').showModal();}
  const rect=(x,y,w,h,c)=>{ctx.fillStyle=c;ctx.fillRect(Math.round(x),Math.round(y),w,h);};
  function text(str,x,y,size=12,color='#abc7c6',align='center'){ctx.font=`${size}px "Malgun Gothic",sans-serif`;ctx.textAlign=align;ctx.fillStyle=color;ctx.fillText(str,x,y);}
  function shape(points,fill,edge){
    ctx.beginPath();
    points.forEach(([x,y],index)=>index ? ctx.lineTo(x,y):ctx.moveTo(x,y));
    ctx.closePath();
    ctx.fillStyle=fill;ctx.fill();
    if(edge){ctx.lineWidth=1.4;ctx.strokeStyle=edge;ctx.stroke();}
  }
  function fox(x,y,form){
    const awakened=form==='ts', hair='#15141f', edge='#0a101d';
    ctx.save();ctx.translate(x,y);
    const tail=awakened?'#427db8':'#343c53';
    shape([[10,12],[19,6],[26,-5],[32,-4],[31,6],[25,17],[12,20]],tail,edge);
    shape([[26,-5],[32,-4],[31,6],[26,11],[25,5]],awakened?'#a5d6ee':'#8f9da9');
    shape([[-10,14],[-2,16],[-3,24],[-13,24]],'#0b131e');
    shape([[3,15],[11,14],[14,24],[4,24]],'#0b131e');
    shape([[-13,-2],[-5,-6],[9,-5],[15,1],[18,19],[-17,19]],awakened?'#382c5a':'#567780',edge);
    shape([[-17,-15],[-19,-39],[-7,-26],[6,-26],[16,-40],[19,-17],[13,-7],[-13,-7]],hair,edge);
    shape([[-17,-34],[-15,-20],[-9,-25]],'#9e9aaa');
    shape([[15,-34],[12,-22],[17,-20]],'#cbd0db');
    shape([[-13,-23],[3,-25],[15,-21],[15,-7],[8,1],[-1,3],[-11,-4]],'#e1c8b8',edge);
    shape([[-16,-23],[-10,-28],[7,-29],[16,-23],[17,-14],[10,-16],[3,-14],[-2,-10],[-9,-6],[-14,-8]],hair);
    shape([[-10,-24],[0,-27],[7,-26],[1,-24],[-6,-17]],'#343147');
    rect(7,-13,4,3,awakened?'#ffcf76':'#a9c8dd');
    rect(9,-13,1,3,'#241b27');
    shape([[-13,0],[-6,2],[5,3],[14,-1],[17,4],[12,9],[-8,10],[-16,6]],awakened?'#e1e2ed':'#eff0e8','#697786');
    if(awakened)shape([[4,9],[10,8],[11,18],[7,21]],'#bda161');
    rect(-15,9,4,10,awakened?'#8778b1':'#52727e');
    rect(12,7,4,9,awakened?'#a79dc8':'#6e888d');
    ctx.restore();
  }
  function drawNPC(n){const x=n.x*TILE+24,y=n.y*TILE+25;ctx.save();ctx.translate(x,y);ctx.fillStyle='#04121b66';ctx.beginPath();ctx.ellipse(0,19,20,8,0,0,Math.PI*2);ctx.fill();const t=n.type;
    if(t==='person'){
      const roles={registrar:'#667aa1',mechanic:'#ad8552',crew:'#5d9e9a',rescue:'#6a7ead',snack:'#b97d72'};
      rect(-9,10,7,9,'#101925');rect(3,10,7,9,'#101925');
      shape([[-12,-5],[13,-5],[15,16],[-13,16]],roles[n.id]||'#7d8b96','#141b2b');
      rect(-9,-24,19,19,'#cdb59f');rect(-12,-27,25,9,'#263d48');rect(-4,-17,3,3,'#273743');rect(5,-17,3,3,'#273743');
      if(n.id==='mechanic'){rect(-3,0,6,14,'#33465b');rect(14,-1,3,12,'#acbec6');}
      if(n.id==='snack'){rect(-16,7,32,4,'#dbae89');rect(-11,2,8,5,'#98bc72');rect(2,2,8,5,'#98bc72');}
      if(n.id==='registrar'||n.id==='rescue')rect(5,2,4,6,'#e1cd93');
    }
    else if(t==='bench'){rect(-26,0,53,7,'#856a51');rect(-26,-12,53,8,'#ac8e65');rect(-21,7,5,13,'#344955');rect(16,7,5,13,'#344955');}
    else if(t==='crate'){rect(-21,-22,43,39,'#8d7754');rect(-17,-18,35,31,'#4b4d41');rect(-20,-2,41,4,'#b99863');rect(-2,-21,4,37,'#b99863');}
    else if(t==='treasure'){rect(-22,-14,44,31,'#796041');rect(-22,-18,44,8,'#e5ba71');rect(-4,-14,8,22,'#f6d58b');ctx.shadowColor='#efd48c';ctx.shadowBlur=22;rect(-3,-29,6,8,'#fbdf9f');ctx.shadowBlur=0;}
    else if(t==='gate'){rect(-22,-33,6,55,'#66877d');rect(18,-33,6,55,'#66877d');rect(-22,-33,46,6,'#9fb9a8');rect(-16,-25,32,8,'#254f51');text('→',0,8,23,'#f0c67d');}
    else if(t==='wheel'){ctx.strokeStyle='#d4af74';ctx.lineWidth=5;ctx.beginPath();ctx.arc(0,-5,19,0,Math.PI*2);ctx.stroke();rect(-2,-31,4,53,'#c9b28a');rect(-25,-7,50,4,'#c9b28a');}
    else if(t==='mirror'){rect(-18,-38,36,58,'#bc9e7b');rect(-14,-34,28,49,'#73928e');rect(-9,-27,5,34,'#c6d9d244');}
    else{rect(-20,-33,40,44,'#36515e');rect(-16,-28,32,25,'#77bfa9');rect(-13,-24,25,3,'#294c4a');rect(-13,-18,18,3,'#294c4a');rect(-11,13,22,6,'#85988d');}
    const active=nearbyTarget()?.id===n.id&&mode==='explore', destination=routeTarget?.id===n.id;
    if(destination){
      ctx.strokeStyle='#edd49c';ctx.lineWidth=2;
      ctx.beginPath();ctx.ellipse(0,17,25,10,0,0,Math.PI*2);ctx.stroke();
    }
    ctx.font='14px "Malgun Gothic",sans-serif';
    const labelWidth=Math.ceil(ctx.measureText(n.label).width)+16;
    ctx.fillStyle=destination?'#403124':active?'#0b3037':'#101d2a';
    ctx.fillRect(-labelWidth/2,27,labelWidth,25);
    text(n.label,0,44,14,destination?'#ffe4a6':active?'#a5ffed':'#e0ebe9');
    ctx.restore();}
  let paintedScenery, paintedSceneryKey;
  function sceneryFor(theme, onAir) {
    const key = theme + (theme === 'room' && onAir ? ':live' : '');
    if (paintedSceneryKey === key) return paintedScenery;

    const layer = document.createElement('canvas');
    layer.width = canvas.width;
    layer.height = canvas.height;
    const ctx = layer.getContext('2d');
    function rect(x, y, width, height, color) {
      ctx.fillStyle = color;
      ctx.fillRect(x, y, width, height);
    }
    function text(value, x, y, size, color) {
      ctx.font = size + 'px "Malgun Gothic", sans-serif';
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.fillText(value, x, y);
    }
    function building(x, y, width, height, color, seed) {
      rect(x,y,width,height,color);
      rect(x,y,width,5,'#46656a');
      for (let yy=y+17; yy<y+height-10; yy+=24) {
        for (let xx=x+13; xx<x+width-8; xx+=23) {
          rect(xx,yy,9,11,(xx+yy+seed)%5<2?'#bf9c59':'#23414b');
        }
      }
    }
    function drawDock() {
      // Distant port, repair hall, and the deck beside the crew.
      rect(0,145,960,29,'#253c49');
      rect(16,108,193,36,'#1a303d');
      rect(44,89,143,19,'#203645');
      rect(237,70,458,108,'#253d47');
      rect(222,61,488,11,'#47646a');
      rect(252,94,158,82,'#182b38');
      rect(563,94,112,82,'#1a2b36');
      for (let x=270;x<403;x+=30) rect(x,108,18,12,'#638486');
      for (let y=115;y<174;y+=10) rect(573,y,92,2,'#48606a');
      text('수리 부두',493,117,20,'#e8c079');
      text('RETURN DOCK',493,140,10,'#9fbebb');
      rect(768,63,14,117,'#374d5a');
      rect(775,64,160,8,'#4f656a');
      rect(922,71,3,61,'#77928e');
      rect(912,128,22,5,'#647b7c');

      rect(0,179,960,335,'#2a3d46');
      rect(0,179,960,8,'#536f71');
      for (let y=193;y<508;y+=32) {
        rect(0,y,960,1,'#536a6a66');
        for (let x=(y%64?18:0);x<960;x+=52) rect(x,y,1,31,'#59707544');
      }
      // Mark the storage bay and the mooring edge while leaving the walkable grid legible.
      for (let x=60;x<300;x+=25) {
        rect(x,477,12,2,'#bea77a85');
      }
      rect(58,445,2,35,'#bea77a65');
      rect(297,445,2,35,'#bea77a65');
      for (let x=48;x<940;x+=106) {
        rect(x,508,44,5,'#765f4b');
        rect(x+18,508,9,12,'#9d876a');
      }
      rect(0,515,960,10,'#0b1b28');
    }
    const g=ctx.createRadialGradient(470,294,25,470,294,570);
    g.addColorStop(0,'#cee4d608');
    g.addColorStop(1,'#0b14233e');
    if(theme==='city'){building(20,30,170,145,'#132432',1);building(210,15,140,160,'#1b303c',3);building(420,45,175,130,'#182b38',4);building(655,27,200,148,'#162734',8);rect(0,180,960,337,'#253c44');rect(0,180,960,8,'#54716c');for(let y=190;y<510;y+=48){rect(0,y,960,1,'#48616a44');for(let x=(y%96?0:24);x<960;x+=48)rect(x,y,1,48,'#48616a44');}rect(0,516,960,12,'#071b29');text('귀환항  /  RETURN PORT',515,119,17,'#e8c079');}
    else if(theme==='dock'){drawDock();}
    else if(theme==='ship'){rect(43,177,874,352,'#182731');rect(66,190,827,314,'#645c4b');for(let y=195;y<505;y+=24)rect(67,y,826,2,'#94816a55');rect(66,190,827,8,'#b3a17a');rect(66,498,827,8,'#b3a17a');rect(426,53,114,125,'#334c52');rect(445,78,75,47,'#a1b8a0');rect(476,4,8,170,'#7b8f80');text('귀환선 · 전원 승선 확인',478,155,13,'#d7ded1');}
    else if(theme==='island'){rect(35,183,895,340,'#3b514b');for(let i=0;i<90;i++)rect((i*97)%890+35,(i*43)%320+190,4,3,i%2?'#647259':'#263f3d');building(670,25,70,145,'#acb6a0',2);rect(656,27,98,15,'#d2bc85');rect(679,44,53,30,'#e9cf8b');const g=ctx.createRadialGradient(708,65,4,708,65,130);g.addColorStop(0,'#ebda9c33');g.addColorStop(1,'#ebda9c00');ctx.fillStyle=g;ctx.fillRect(570,0,280,190);text('등대섬 · 돌아오는 문',430,110,16,'#d6d3a9');}
    else{rect(40,30,880,150,'#223843');for(let y=180;y<530;y+=24){rect(40,y,880,24,y%48?'#4d5146':'#55584b');rect(40,y,880,1,'#74817433');}rect(40,30,880,7,'#7b8f7e');rect(40,30,8,500,'#6f8174');rect(912,30,8,500,'#6f8174');rect(72,56,200,105,'#101f31');rect(169,56,5,105,'#6b867d');rect(72,104,200,4,'#6b867d');for(let i=0;i<10;i++)rect(80+i*18,130-(i%4)*13,8,30,'#496558');rect(350,70,220,68,'#2e4447');const broadcastLabel=onAir?'ON AIR · MELLU':'STANDBY · MELLU';
      text(theme==='room'?broadcastLabel:'RE: DEBUT · MELLU',460,111,15,'#9dd8c2');rect(782,68,86,80,'#101f29');text('HOME',825,113,13,'#c5aa7e');}
    ctx.fillStyle=g;
    ctx.fillRect(0,179,canvas.width,336);
    paintedScenery = layer;
    paintedSceneryKey = key;
    return layer;
  }
  function startWorldDrawing() {
    if (worldFrame === null) worldFrame = requestAnimationFrame(drawWorld);
  }
  function drawWorld(time) {
    worldFrame = null;
    if (mode === 'title') return;
    startWorldDrawing();
    if (mode === 'cinematic' || document.hidden) return;
    const ch=story.chapters[state.chapter],theme=ch.theme;const interior=theme==='studio'||theme==='room';ctx.clearRect(0,0,960,576);rect(0,0,960,576,interior?'#182631':'#102e3e');
    if(!interior){for(let i=0;i<35;i++){const x=(i*79+Math.sin(time/1700+i)*9)%960,y=390+(i*29)%186;rect(x,y,15+(i%3)*12,2,i%3===0?'#54797855':'#29536666');}ctx.fillStyle='#b9d4bf';ctx.beginPath();ctx.arc(770,70,31,0,Math.PI*2);ctx.fill();}
    ctx.drawImage(sceneryFor(theme, state.flags.onAir),0,0);
    // A fixed support point keeps every actor on the same grid across dialogue and cuts.
    for(const step of routePath){
      ctx.fillStyle='#f6dca3';
      ctx.beginPath();ctx.arc(step.x*TILE+24,step.y*TILE+40,4,0,Math.PI*2);ctx.fill();
    }
    for(const n of ch.npcs)drawNPC(n);const px=state.x*TILE+24,py=state.y*TILE+25;ctx.fillStyle='#04121b88';ctx.beginPath();ctx.ellipse(px,py+24,17,6,0,0,Math.PI*2);ctx.fill();fox(px,py,state.form);text('멜루',px,py+43,10,'#e0efdc');
    if(!interior&&theme!=='island'&&theme!=='dock'){ctx.strokeStyle='#b9e0df16';ctx.lineWidth=1;ctx.beginPath();for(let i=0;i<48;i++){const x=(i*71+time*.025)%1000,y=(i*107+time*.14)%610;ctx.moveTo(x,y);ctx.lineTo(x-5,y+13);}ctx.stroke();}
  }
  $('newGame').onclick=()=>{if(stored)$('confirmNew').showModal();else startNew();};$('cancelNew').onclick=()=>$('confirmNew').close();$('confirmNewButton').onclick=()=>{$('confirmNew').close();startNew();};$('continueGame').onclick=()=>{if(stored){state=JSON.parse(JSON.stringify(stored));launch(true);}};
  $('home').onclick=e=>{e.preventDefault();if(mode!=='title'){save();clearTimeout(cutsceneTimer);$('titleScreen').hidden=false;$('playScreen').hidden=true;mode='title';dialogue=null;battle=null;}};
  $('journalButton').onclick=journal;$('closeJournal').onclick=()=>$('journal').close();$('saveButton').onclick=()=>save(true);$('interactButton').onclick=()=>interact();$('soundButton').onclick=()=>{sound=!sound;$('soundButton').textContent=sound?'효과음 켜짐':'효과음 꺼짐';$('soundButton').setAttribute('aria-pressed',String(sound));tone(660,.1);};
  $('routeButton').onclick=()=>{
    routeShown=!routeShown;
    if(!routeShown)markedNpc=null;
    updateRoute();
  };
  canvas.addEventListener('click',chooseMapTarget);
  document.querySelectorAll('[data-move]').forEach(b=>b.onclick=()=>move(b.dataset.move));document.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>action(b.dataset.action));
  document.addEventListener('keydown',e=>{if($('journal').open||$('confirmNew').open)return;if(e.key.toLowerCase()==='j'){e.preventDefault();journal();return;}if(mode==='title')return;const dir={ArrowUp:'up',w:'up',W:'up',ArrowDown:'down',s:'down',S:'down',ArrowLeft:'left',a:'left',A:'left',ArrowRight:'right',d:'right',D:'right'}[e.key];if(dir){e.preventDefault();if(performance.now()-lastStep>105){move(dir);lastStep=performance.now();}}else if((e.key==='Enter'||e.key.toLowerCase()==='e')&&!e.repeat){if(e.target.tagName==='BUTTON'&&e.key==='Enter')return;e.preventDefault();interact();}});
  function drawSnackClue(){
    const evidence=$('snackClue');
    const g=evidence.getContext('2d');
    const board=g.createLinearGradient(0,0,340,150);
    board.addColorStop(0,'#17272e');board.addColorStop(1,'#2c4340');
    g.fillStyle=board;g.fillRect(0,0,340,150);
    g.fillStyle='#162623';
    g.beginPath();g.ellipse(171,89,122,52,0,0,Math.PI*2);g.fill();
    g.fillStyle='#dac9a6';
    g.beginPath();g.ellipse(170,73,118,53,0,0,Math.PI*2);g.fill();
    g.fillStyle='#9f9278';
    g.beginPath();g.ellipse(170,74,101,44,0,0,Math.PI*2);g.fill();
    const slices=[[115,57,-.2],[152,42,.18],[187,55,-.2],[224,67,.25],[131,86,-.1],[170,81,.4],[206,93,-.18]];
    for(const [x,y,angle] of slices){
      g.save();g.translate(x,y);g.rotate(angle);
      g.fillStyle='#567b52';g.fillRect(-13,-6,26,21);
      g.fillStyle='#c0d08a';g.fillRect(-12,-10,25,18);
      g.fillStyle='#d9e3a6';g.fillRect(-10,-9,20,4);
      g.fillStyle='#b45447';g.beginPath();g.ellipse(3,-2,6,2.3,-.25,0,Math.PI*2);g.fill();
      g.fillStyle='#db8063';g.fillRect(2,-3,3,1);
      g.restore();
    }
  }
  drawSnackClue();
  setInterval(()=>{if(mode!=='title'&&!document.hidden)updatePrompt();},180);updateUI();
})();
