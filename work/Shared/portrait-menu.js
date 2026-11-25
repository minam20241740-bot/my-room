'use strict';
(() => {
 const stage=document.getElementById('stage'),title=document.getElementById('title'),popup=document.getElementById('pop');
 if(!stage||!title||!popup)return;
 const controls=[...title.querySelectorAll('button')];
 if(!controls.length)return;
 const original=controls.map((button)=>{const marker=document.createComment('title control');button.before(marker);return marker});
 const popOrigin=document.createComment('popup');popup.before(popOrigin);
 const menu=document.createElement('nav');menu.id='portrait-menu';menu.setAttribute('aria-label','게임 메뉴');document.body.append(menu);
 const breakpoint=matchMedia('(max-width:600px) and (orientation:portrait)');
 const update=()=>{
  if(breakpoint.matches){
   menu.append(...controls);document.body.append(popup);
  }else{
   controls.forEach((button,i)=>original[i].after(button));
   popOrigin.after(popup);
  }
 };
 breakpoint.addEventListener('change',update);
 update();
})();
