'use strict';
const ForestJourney=(()=>{
  const el=id=>document.getElementById(id);
  const skills=[
    {id:'strike',name:'검격',cost:0,detail:'검으로 공격합니다.'},
    {id:'guard',name:'방어',cost:0,detail:'다음 일격을 막으며 마력을 8 회복합니다.'},
    {id:'spark',name:'번개',cost:20,detail:'마력 20을 사용해 강하게 공격합니다.'},
    {id:'mend',name:'회복',cost:15,detail:'마력 15를 사용해 체력을 34 회복합니다.'}
  ];
  const items=[
    {id:'sword',name:'검',slot:0,detail:'악몽의 숲에서 검격으로 몬스터를 공격합니다.'},
    {id:'pick',name:'곡괭이',slot:1,detail:'마을의 돌 모으기에 사용하는 도구입니다.'},
    {id:'hammer',name:'망치',slot:2,detail:'나무와 돌로 빈터에 건물을 짓는 도구입니다.'},
    {id:'wood',name:'나무',slot:5,detail:'숲에서 모아 건설에 사용하는 목재입니다.'},
    {id:'stone',name:'돌',slot:8,detail:'숲에서 모아 건설에 사용하는 석재입니다.'}
  ];
  const create=()=>({hp:100,mp:100,known:[true,false,false,false],phase:'quiet',foe:100,turn:0});
  const bounded=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
  function restore(saved){
    const restored=create();
    if(!saved||typeof saved!=='object')return restored;
    if(Array.isArray(saved.known))restored.known=skills.map((_,i)=>i===0||saved.known[i]===true);
    if(bounded(saved.hp,0,100))restored.hp=saved.hp;
    if(bounded(saved.mp,0,100))restored.mp=saved.mp;
    if(saved.phase==='fight'&&restored.hp>0&&bounded(saved.foe,1,100)&&bounded(saved.turn,0,Number.MAX_SAFE_INTEGER)){
      restored.phase='fight';restored.foe=saved.foe;restored.turn=saved.turn;
    }else if(restored.hp===0){restored.phase='lost'}
    else if(saved.phase==='won'){restored.phase='won';restored.foe=0}
    return restored;
  }
  let getState,announce,view='village',item=items[0],battleText='';
  const journey=()=>getState().journey;
  const quantity=id=>id==='wood'||id==='stone'?getState()[id]:1;
  const heavy=turn=>turn%3===2;
  const viewHints={
    village:'나무와 돌을 모아 건물을 지으세요. 건물 버튼의 숫자는 필요한 나무 / 돌입니다. 세 곳을 모두 지으면 마을이 완성됩니다.',
    bag:'마을에서 모은 재료와 도구입니다. 칸을 누르면 쓰임새가 나옵니다. 나무와 돌은 건설에 쓰입니다.',
    dream:'악몽의 숲에서 싸울 때 쓰는 기술을 익히는 곳입니다. 익힌 기술은 악몽의 숲에서 사용할 수 있습니다.',
    night:'몬스터와 번갈아 공격합니다. 기술로 몬스터의 HP를 0으로 만들면 이기고, 몬스터의 반격으로 내 체력이 0이 되면 집니다. 키보드 1–4로도 기술을 쓸 수 있습니다.'
  };
  function openView(name){
    view=name;el('viewhint').textContent=viewHints[name]||'';
    for(const b of el('paths').children){
      const active=b.dataset.view===view;
      b.setAttribute('aria-pressed',String(active));
      el(b.dataset.view).hidden=!active;
    }
    announce('');draw();
  }
  function drawInventory(){
    for(const it of items){
      const b=el('item-'+it.id);
      b.lastElementChild.textContent=quantity(it.id).toLocaleString('ko-KR');
      b.setAttribute('aria-label',it.name+' '+quantity(it.id)+'개');
      b.setAttribute('aria-pressed',String(it===item));
    }
    el('item-info').textContent=item.name+' · '+item.detail;
  }
  function draw(){
    const j=journey();
    for(const key of ['hp','mp']){el(key).value=j[key];el(key+'-value').textContent=j[key]+'/100'}
    el('rest').disabled=j.phase==='fight';
    if(view==='bag')drawInventory();
    if(view==='dream'){
      for(const [i,b] of [...el('study').children].entries()){
        b.disabled=j.known[i]||j.phase==='fight';b.lastElementChild.textContent=j.known[i]?'습득함':'익히기';
      }
    }
    if(view!=='night')return;
    const active=j.phase==='fight';
    el('encounter').dataset.phase=j.phase;
    el('encounter').dataset.winding=String(active&&heavy(j.turn));
    el('enemy').hidden=!active;el('foe-hp').value=j.foe;el('foe-value').textContent=j.foe+'/100';
    el('challenge').hidden=active||j.phase==='lost';
    el('challenge').textContent=j.phase==='won'?'다시 숲 탐색하기':'숲 안으로 들어가기';
    el('retreat').hidden=!active;
    el('back-village').hidden=j.phase!=='won'&&j.phase!=='lost';
    el('abilities').hidden=!active;
    el('foe-intent').textContent=active?(heavy(j.turn)?'몬스터가 몸을 낮춥니다. 큰 공격이 다가옵니다.':'나뭇가지가 흔들립니다. 다음 공격에 대비하세요.'):
      ({quiet:'나무 사이로 낯선 눈빛이 스칩니다.',won:'몬스터가 물러나고 길이 조용해집니다.',lost:'숲길에서 쓰러졌습니다. 마을로 돌아가 쉴 수 있습니다.'}[j.phase]);
    el('battle-log').textContent=battleText;
    for(const [i,b] of [...el('abilities').children].entries()){
      b.disabled=!active||!j.known[i]||j.mp<skills[i].cost||(i===3&&j.hp===100);
      b.lastElementChild.textContent=!j.known[i]?'미습득':i===3&&j.hp===100?'체력 가득':skills[i].cost?'MP '+skills[i].cost:'';
    }
  }
  function useSkill(i){
    const j=journey(),ability=skills[i];
    if(j.phase!=='fight'||!j.known[i]||j.mp<ability.cost||(i===3&&j.hp===100))return;
    j.mp-=ability.cost;
    let effect;
    if(i===0||i===2){
      const hit=i===0?22:42;
      j.foe=Math.max(0,j.foe-hit);effect=ability.name+'으로 '+hit+' 피해.';
    }else if(i===1){
      const old=j.mp;j.mp=Math.min(100,j.mp+8);effect='방어 자세를 취했습니다. 마력 +'+(j.mp-old)+'.';
    }else{
      const old=j.hp;j.hp=Math.min(100,j.hp+34);effect='체력 +'+(j.hp-old)+'.';
    }
    const scene=el('encounter');scene.dataset.action=ability.id;
    scene.classList.remove('acting');void scene.offsetWidth;scene.classList.add('acting');
    if(j.foe===0){
      j.phase='won';battleText=effect+' 몬스터를 물리쳤습니다.';
    }else{
      const hit=i===1?3:heavy(j.turn)?29:14;
      j.hp=Math.max(0,j.hp-hit);j.turn=j.turn>=Number.MAX_SAFE_INTEGER?1:j.turn+1;
      battleText=effect+' 몬스터의 반격으로 체력 −'+hit+'.';
      if(j.hp===0){j.phase='lost';battleText+=' 마을로 돌아가세요.'}
    }
    draw();
    if(j.phase!=='fight')el('back-village').focus();
  }
  function enter(){
    item=items[0];battleText='';openView('village');
  }
  function icon(id){const im=document.createElement('img');im.src='art/'+id+'.webp';im.alt='';return im}
  function skillButton(s,i,study){
    const b=document.createElement('button'),name=document.createElement('strong'),label=document.createElement('small');
    name.textContent=(study?'':(i+1)+' · ')+s.name;b.append(icon(s.id),name);
    if(study){const hint=document.createElement('span');hint.textContent=s.detail;b.append(hint)}
    b.append(label);
    b.onclick=()=>{
      if(!study){useSkill(i);return}
      const j=journey();if(j.known[i]||j.phase==='fight')return;
      j.known[i]=true;draw();announce(s.name+'을 익혔습니다. 악몽의 숲에서 사용할 수 있습니다.');
    };
    return b;
  }
  function bind(get,notify){
    getState=get;announce=notify;
    for(const b of el('paths').children)b.onclick=()=>openView(b.dataset.view);
    for(let i=0;i<20;i++){
      const it=items.find(thing=>thing.slot===i);
      if(!it){const empty=document.createElement('span');empty.className='empty-slot';empty.setAttribute('aria-hidden','true');el('slots').append(empty);continue}
      const b=document.createElement('button'),count=document.createElement('small');
      b.id='item-'+it.id;b.append(icon(it.id),count);b.onclick=()=>{item=it;drawInventory()};el('slots').append(b);
    }
    for(const [i,s] of skills.entries()){el('study').append(skillButton(s,i,true));el('abilities').append(skillButton(s,i,false))}
    el('rest').onclick=()=>{
      const j=journey();if(j.phase==='fight')return;
      const needed=j.hp<100||j.mp<100;
      j.hp=100;j.mp=100;if(j.phase==='lost')j.phase='quiet';draw();
      announce(needed?'마을에서 쉬고 체력과 마력을 모두 회복했습니다.':'체력과 마력이 가득합니다.');
    };
    el('challenge').onclick=()=>{
      const j=journey();if(j.phase==='fight'||j.hp===0)return;
      Object.assign(j,{phase:'fight',foe:100,turn:0});battleText='몬스터가 다가옵니다. 기술을 선택하세요.';
      el('encounter').classList.remove('acting');draw();el('abilities').firstElementChild.focus();
    };
    el('retreat').onclick=()=>{
      const j=journey();if(j.phase!=='fight')return;
      Object.assign(j,{phase:'quiet',foe:100,turn:0});battleText='';
      openView('village');el('paths').firstElementChild.focus();announce('전투를 떠나 마을로 돌아왔습니다.');
    };
    el('back-village').onclick=()=>{openView('village');el('rest').focus()};
    document.addEventListener('keydown',event=>{
      if(el('world').hidden||event.ctrlKey||event.altKey||event.metaKey||event.repeat)return;
      if(view==='night'&&/^[1-4]$/.test(event.key)&&journey().phase==='fight'){event.preventDefault();useSkill(Number(event.key)-1)}
      if(event.key.toLowerCase()==='b'){openView('village');el('buildings').firstElementChild.focus()}
    });
  }
  return {bind,create,restore,enter};
})();
