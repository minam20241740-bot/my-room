(()=>{
  const canvas=document.getElementById('melluPortrait');if(!canvas)return;
  const awakened=document.getElementById('awakenedCard');
  const basePortrait=new MelluPortrait(canvas);
  const stagePortrait=new MelluPortrait(awakened,window.MELLU_AWAKENED_MODEL);
  const playScreen=document.getElementById('playScreen');
  const formLabel=document.getElementById('formLabel');
  const dialogue=document.getElementById('dialogue');
  const speaker=document.getElementById('speaker');
  const onScreen=new Set();
  if ('IntersectionObserver' in window) {
    const observer=new IntersectionObserver(entries=>{
      for (const entry of entries) {
        if (entry.isIntersecting) onScreen.add(entry.target);
        else onScreen.delete(entry.target);
      }
    });
    observer.observe(canvas);
    observer.observe(awakened);
  } else {
    onScreen.add(canvas);
    onScreen.add(awakened);
  }
  let showingStage=false;
  function tick(t){
    requestAnimationFrame(tick);
    if (playScreen.hidden || document.hidden) return;
    const ts=formLabel.textContent==='개화한 검은여우';
    if(ts!==showingStage){
      canvas.hidden=ts;
      awakened.hidden=!ts;
      showingStage=ts;
    }
    if (!onScreen.has(ts ? awakened : canvas)) return;
    const portrait=ts?stagePortrait:basePortrait;
    const speaking=!dialogue.hidden&&speaker.textContent.includes('멜루');
    portrait.talk=speaking?Math.max(0,Math.sin(t/160))*.45:0;
    portrait.draw(t);
  }
  requestAnimationFrame(tick);
})();
