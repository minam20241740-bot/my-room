
'use strict';
(() => {
  const $ = (s) => document.getElementById(s);
  const asset = (name) => window.RoomPack?.asset(name) ?? ('assets/'+name);
  const ui = Object.fromEntries([
    'cover','play','viewport','room-canvas','scene-fallback','wake','concept','worlds','back',
    'sound','skip','loading','title-motion','wake-cue','paper','tray','dialogue','speech','speaker',
    'task-main','task-extra','quest','quest-title','quest-detail','counter','wrong-place',
    'film','projector','theater-video','theater-file',
    'info','info-heading','info-content',
    'gallery','gallery-cards','gallery-count','gallery-dawn','gallery-return','exhibit-target',
    'work-view','work-title','work-body','route-description','route-next',
  ].map((id) => [id,$(id)]));
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const key = 'MyRoom.FirstSort.1';
  const soundKey = 'MyRoom.Sound.1';
  let phase = 'cover';
  let stage = null;
  let stageLoading;
  let run = 0;
  let completed = false;
  let filmMounted = false;
  let exhibitProgress = {};
  let dawn = false;
  let activeExhibit = null;
  const gallery = window.RoomGallery;
  const shortRoute = ['Type','Signal','Illusio','Aqua'];
  let routeStop = -1;
  let saved = false;
  let muted = false;
  let noticeTimer;
  let resetFocus = false;
  let movieURL = null;
  const video = ui['theater-video'];
  video.volume=.65;
  video.poster=asset('Illusio_Poster.jpg');
  const movieFile = ui['theater-file'];
  const bundledMovie='assets/Illusio_Film.mp4';
  const localScreening=/^https?:$/.test(location.protocol) && location.hostname==='127.0.0.1';
  const defaultMovie=() => bundledMovie;

  function loadPreferences() {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const progress = JSON.parse(raw);
        completed = progress?.version === 1 && progress?.firstNoteSorted === true;
        filmMounted = completed && progress?.theaterFilmMounted === true;
        if(completed) {
          for(const [id,entry] of Object.entries(gallery.objects)) {
            if (!entry.steps) continue;
            const count=progress.exhibits?.[id];
            if(Number.isInteger(count)&&count>0) exhibitProgress[id]=Math.min(count,entry.steps.length);
          }
          const savedStop=progress.routeStop;
          if(Number.isInteger(savedStop) && savedStop>=0 && savedStop<=shortRoute.length &&
            shortRoute.slice(0,savedStop).every(isSorted)) routeStop=savedStop;
          dawn = progress.dawn === true && gallery.main.every(isSorted);
        }
        saved = completed;
      }
      muted = localStorage.getItem(soundKey) === 'muted';
    } catch { saved = false; }
  }
  loadPreferences();

  function save() {
    try {
      const raw = JSON.stringify({version:1,firstNoteSorted:completed,theaterFilmMounted:filmMounted,
        exhibits:exhibitProgress,dawn,routeStop});
      localStorage.setItem(key,raw);
      saved = localStorage.getItem(key) === raw;
    } catch { saved = false; }
    document.body.dataset.persist = saved ? 'ok' : 'unavailable';
  }

  const clips = new Map();
  function playSound(name) {
    if (muted) return;
    if (!clips.has(name)) {
      const clip = new Audio(asset('Audio_' + name + '.wav'));
      clip.preload = 'auto';
      clip.volume = .42;
      clips.set(name,clip);
    }
    const audio = clips.get(name);
    audio.currentTime = 0;
    audio.play().catch(() => {});
  }

  function soundControls() {
    video.muted=muted;
    for (const workVideo of ui['work-body'].querySelectorAll('video')) workVideo.muted=muted;
    ui.sound.textContent = muted ? '소리 켜기' : '소리 끄기';
    ui.sound.setAttribute('aria-pressed',String(muted));
  }
  soundControls();
  ui.sound.addEventListener('click',() => {
    muted = !muted;
    try { localStorage.setItem(soundKey,muted?'muted':'on'); } catch {}
    if (muted) clips.forEach((a) => a.pause());
    soundControls();
  });

  const animate = async (duration, step, serial=run) => {
    if (serial !== run) return false;
    if (!duration) { step(1); return serial === run; }
    const started = performance.now();
    return new Promise((resolve) => {
      function loop(now) {
        if (serial !== run) return resolve(false);
        const t = Math.min(1,Math.max(0,(now-started)/duration));
        step(t);
        if (t < 1) requestAnimationFrame(loop);
        else resolve(true);
      }
      requestAnimationFrame(loop);
    });
  };

  function makeStillStage() {
    const backdrop = ui['scene-fallback'];
    let current;
    const show = (name) => {
      if (name === current) return;
      current = name;
      backdrop.style.backgroundImage = 'url("' + asset('Stage_' + name + '.jpg') + '")';
    };
    const point = (object) => ({ x: ui.viewport.clientWidth*({film:.39,projector:.56,paper:.38,tray:.63,head:.54}[object]),
      y: ui.viewport.clientHeight*(object==='head' ? .39 : .56) });
    document.body.dataset.render = 'stills';
    ui['room-canvas'].hidden = true;
    backdrop.hidden = false;
    show('Sleep');
    return {
      ready:Promise.resolve(),reset(){show('Sleep');},
      intro(p){show(p<.19?'Sleep':p<.67?'Rise':'FirstTask');},lift(){show('FirstTask');},
      place(p){if(p>.65)show('Organized');},done(){show('Organized');},
      point,hit(){return null;},size(){},onUpdate(){},theaterView(){show('Organized');},
      seatView(){show('Organized');},filmPick(){},filmLoad(){},screening(){},screeningPoster(){},redraw(){},
      galleryReset(){},visit(){show('Organized');},place(){show('Organized');return false;},exhibitMotion(){},
      exhibitPoint(){return {x:ui.viewport.clientWidth*.53,y:ui.viewport.clientHeight*.49};},
      exhibitProgress(progress,day){backdrop.style.filter=day?'brightness(1.36) saturate(.91)':'none';},
      dawnJourney(t){backdrop.style.filter='brightness('+(1+.36*t)+')';}, dawnOverview(){},
    };
  }

  async function loadStage() {
    try {
      stage = window.RoomStage.create(ui['room-canvas'],ui.viewport);
      stage.onUpdate(updateTargets);
      await stage.ready;
    } catch (error) {
      console.warn('Room switched to saved scene views.', error.message);
      stage = makeStillStage();
    }
    document.body.dataset.sceneReady = 'true';
    return stage;
  }

  async function prepare() {
    stageLoading ??= loadStage();
    await stageLoading;
    stage.size();
    return stage;
  }

  function updateTargets() {
    if (!stage || ui.play.hidden) return;
    for (const id of ['paper','tray','film','projector','exhibit-target']) {
      const btn = ui[id];
      if (btn.hidden) continue;
      const point = id==='exhibit-target'
        ? stage.exhibitPoint(markerStep()?.[2],phase!=='exhibit-ready')
        : stage.point(id);
      if (!point) continue;
      const x = Math.min(ui.viewport.clientWidth-75,Math.max(75,point.x));
      let ceiling=ui.viewport.clientHeight-(innerWidth<=640?175:140);
      if(id==='exhibit-target' && !ui.dialogue.hidden) {
        const frame=ui.viewport.getBoundingClientRect();
        const bubble=ui.dialogue.getBoundingClientRect();
        if(x+frame.left>bubble.left-75 && x+frame.left<bubble.right+75) {
          ceiling=Math.min(ceiling,bubble.top-frame.top-14);
        }
      }
      const y = Math.min(ceiling,Math.max(120,point.y));
      btn.style.left = x + 'px';
      btn.style.top = y + 'px';
    }
  }
  window.addEventListener('resize',updateTargets,{passive:true});

  function showPhase(value) {
    phase = value;
    document.body.dataset.phase = value;
    ui['title-motion'].hidden = value !== 'title';
    ui.skip.hidden = !['waking','title'].includes(value);
    ui.loading.hidden = value !== 'loading';
    const inTheater = value === 'theater' || value.startsWith('theater-');
    const inExhibit = value.startsWith('exhibit-');
    const atWindow = value === 'dawn';
    const active = inTheater || inExhibit || atWindow || ['find','lifting','holding','placing','lighting','result'].includes(value);
    ui.quest.hidden = !active;
    ui.dialogue.hidden = !active;
    ui.paper.hidden = value !== 'find';
    ui.tray.hidden = value !== 'holding';
    ui.film.hidden = value !== 'theater';
    ui.projector.hidden = value !== 'theater-load';
    ui.gallery.hidden = value!=='result';
    ui['gallery-return'].hidden = !inExhibit || !['exhibit-ready','exhibit-holding','exhibit-sorted'].includes(value);
    ui['exhibit-target'].hidden = !['exhibit-ready','exhibit-holding','exhibit-sorted'].includes(value) || !markerStep();
    video.hidden = value !== 'theater-viewing';
    ui.quest.dataset.complete = String(inTheater ? filmMounted : completed);
    ui.counter.textContent = ui.quest.dataset.complete === 'true' ? '1 / 1' : '0 / 1';
    ui['quest-title'].textContent = inTheater ? '마술 극장' : '첫 정리';
    ui['quest-detail'].textContent = inTheater ?
      (filmMounted ? '필름 장착 완료' : '영사기에 필름 장착하기') :
      (completed ? '기획 메모 정리 완료' : value === 'holding' ? '자료함에 넣기' : '흩어진 기획 메모');
    if(atWindow) {
      ui['quest-title'].textContent='아침 창가';
      ui['quest-detail'].textContent='창 열기';
      ui.counter.textContent='6 / 6';
    }
    if(inExhibit && activeExhibit) {
      const entry=gallery.objects[activeExhibit], current=currentStep();
      ui['quest-title'].textContent=entry.zone;
      const placed=exhibitProgress[activeExhibit]||0;
      ui.counter.textContent=placed+' / '+entry.steps.length;
      ui.quest.dataset.complete=String(isSorted(activeExhibit));
      ui['quest-detail'].textContent=isSorted(activeExhibit)?'정리 완료':entry.work;
      ui['exhibit-target'].lastElementChild.textContent=current
        ? current[phase==='exhibit-holding'?1:0] : '작품 열기';
    }
    document.body.dataset.filmMounted=String(filmMounted);
    updateTargets();
  }

  function say(message, primary=null, extra=null) {
    ui.speech.textContent = message;
    for (const [id, act] of [['task-main',primary],['task-extra',extra]]) {
      const button = ui[id];
      button.hidden = !act;
      button.textContent = act?.[0] ?? '';
      button.onclick = act?.[1] ?? null;
    }
  }

  function showResult(restored=false) {
    showPhase('result');
    activeExhibit=null;
    refreshGallery();
    if(dawn) stage?.dawnOverview();
    document.body.dataset.roomChanged = 'true';
    const hint = dawn ? '아침이네요. 정리한 자리에서 작품을 다시 볼 수 있어요.' :
      gallery.main.every(isSorted) ? '여섯 자리에 불이 켜졌어요. 같이 창을 열어요.' :
      restored ? '왼쪽에서 가 보고 싶은 자리를 골라요.' :
      '메모가 제자리에 있어요. 짧은 관람은 활자 작업실에서 시작해요.';
    say(hint + (saved ? '' : ' 이 브라우저에서는 진행을 저장하지 못했어요.'),
      ['극장 가까이 보기',openTheater],['다시 체험',replay]);
    (routeStop>=0 ? ui['route-next'] : ui['task-main']).focus({preventScroll:true});
  }

  function isSorted(id) {
    if(id==='Illusio') return filmMounted;
    return (exhibitProgress[id]||0)>=gallery.objects[id].steps.length;
  }
  function currentStep() {
    return activeExhibit ? gallery.objects[activeExhibit].steps[exhibitProgress[activeExhibit]||0] : null;
  }
  function markerStep() {
    return currentStep() || (activeExhibit ? gallery.objects[activeExhibit].steps.at(-1) : null);
  }
  function refreshGallery() {
    const count=gallery.main.filter(isSorted).length;
    ui['gallery-count'].textContent=count+' / '+gallery.main.length;
    ui['gallery-dawn'].hidden=dawn || count!==gallery.main.length;
    ui['gallery-cards'].replaceChildren();
    gallery.showCards(ui['gallery-cards'],isSorted,selectExhibit);
    refreshRoute();
    document.body.dataset.day=dawn?'morning':'night';
    document.body.dataset.exhibits=String(count);
    stage?.exhibitProgress(exhibitProgress,dawn);
  }
  function refreshRoute() {
    const first = routeStop<0;
    const finished = routeStop===shortRoute.length;
    const next = gallery.objects[shortRoute[routeStop]];
    ui['route-description'].textContent = first ? '네 곳을 약 5분 동안 둘러봐요.' :
      finished ? '네 곳을 모두 둘러봤어요.' : (routeStop+1)+' / '+shortRoute.length+' · '+next.work;
    ui['route-next'].textContent = first ? '짧은 관람 시작' :
      finished ? '다시 둘러보기' : '다음 · '+next.zone;
  }
  function openRouteStop() {
    if(phase!=='result') return;
    if(routeStop<0 || routeStop===shortRoute.length) {
      routeStop=0;
      save();
    }
    void selectExhibit(shortRoute[routeStop]);
  }
  function completeRouteStop(id) {
    if(shortRoute[routeStop]!==id || !isSorted(id)) return;
    routeStop+=1;
    save();
  }
  // 작품의 세계 목록에서 자리나 작품을 고르면 준희가 그 자리 앞으로 옮겨 선다(첫 정리를 마치고 방이 열린 뒤에만)
  window.RoomJunhee = {go(id) {
    if(phase!=='result' || !stage?.place || !gallery.objects[id] || id==='Illusio') return false;
    return stage.place(id);
  }};
  async function selectExhibit(id) {
    if(phase!=='result') return;
    if(id==='Illusio') return openTheater();
    activeExhibit=id;
    stage.place(id);   // 걷는 동작 없이 선택한 자리 앞으로 바로 옮긴다
    showExhibit();
  }
  function showExhibit() {
    const entry=gallery.objects[activeExhibit], step=currentStep();
    showPhase(step?'exhibit-ready':'exhibit-sorted');
    if(step) {
      say(entry.guide,[step[0],exhibitAction],['바로 관람',openActiveWork]);
    } else {
      say(entry.finished,['작품 열기',openActiveWork],['방 전체 보기',returnFromExhibit]);
    }
  }
  function openActiveWork() {
    const id=activeExhibit;
    if(!id || !['exhibit-ready','exhibit-sorted'].includes(phase)) return;
    ui['work-title'].textContent=gallery.objects[id].work;
    gallery.renderWork(ui['work-body'],id,()=>completeRouteStop(id));
    soundControls();
    ui['work-view'].showModal();
  }
  async function exhibitAction() {
    if(phase==='exhibit-sorted') return openActiveWork();
    const step=currentStep();
    if(!step) return;
    if(phase==='exhibit-ready' && step[1]) {
      showPhase('exhibit-moving');
      say(step[0].replace(/집기$/,'들어요.'));
      playSound('Paper');
      if(!await animate(reduced.matches?0:460,t=>stage.exhibitMotion(step[2],t,'hold'))) return;
      showPhase('exhibit-holding');
      say(step[1]+' 버튼을 눌러 주세요.',[step[1],exhibitAction],['내려놓기',cancelExhibitHold]);
    } else if(['exhibit-ready','exhibit-holding'].includes(phase)) {
      showPhase('exhibit-moving');
      say('제자리에 맞추고 있어요.');
      if(!await animate(reduced.matches?0:740,t=>stage.exhibitMotion(step[2],t))) return;
      exhibitProgress[activeExhibit]=(exhibitProgress[activeExhibit]||0)+1;
      stage.exhibitProgress(exhibitProgress,dawn);
      playSound('Ready');
      save();
      showExhibit();
    }
  }
  async function cancelExhibitHold() {
    if(phase!=='exhibit-holding') return;
    const part=currentStep()[2];
    showPhase('exhibit-moving');
    if(await animate(reduced.matches?0:330,t=>stage.exhibitMotion(part,1-t,'hold'))) showExhibit();
  }
  async function returnFromExhibit() {
    if(phase==='exhibit-holding') {
      stage.exhibitProgress(exhibitProgress,dawn);
    }
    if(!['exhibit-ready','exhibit-sorted','exhibit-holding'].includes(phase)) return;
    stage.galleryReset();   // 준희는 시작 자리로 바로 돌아온다
    stage.done(1);
    showResult(true);
  }
  async function openDawn() {
    if(phase!=='result' || dawn || !gallery.main.every(isSorted)) return;
    showPhase('dawn');
    say('창가로 가 볼게요.');
    let opened=false;
    if(!await animate(reduced.matches?0:8150,t=>{
      stage.dawnJourney(t);
      if(!opened&&t>=.56) {
        opened=true;
        playSound('Lamp');
        say('창을 열었어요. 아침빛이 정리한 방까지 들어와요.');
      }
    })) return;
    dawn=true;
    save();
    showResult(true);
  }

  async function wake(repeat=false) {
    if (phase !== 'cover' && !repeat) return;
    ui['title-motion'].style.removeProperty('opacity');
    ui['wake-cue'].hidden=true;
    const serial = ++run;
    ui.cover.hidden = true;
    ui.play.hidden = false;
    showPhase('loading');
    const view = await prepare();
    if (serial !== run) return;
    view.reset();
    document.body.dataset.roomChanged = 'false';
    if (completed && !repeat) {
      view.intro(1);
      view.place(1);
      view.done(1);
      if (filmMounted) view.filmLoad(1);
      showResult(true);
      return;
    }
    showPhase('waking');
    let sounded = false, reacted = false;
    await animate(reduced.matches ? 1150 : 5500,(p) => {
      view.intro(reduced.matches ? (p<.4?0:1) : p);
      if (p >= (reduced.matches ? .24 : .135) && !sounded) {
        sounded = true;
        playSound('Lamp');
      }
      if (p >= (reduced.matches ? .40 : .154) && !reacted) {
        reacted = true;
        const location=view.point('head');
        const cue=ui['wake-cue'];
        cue.style.left=(location?.x ?? ui.viewport.clientWidth*.54)+'px';
        cue.style.top=(location?.y ?? ui.viewport.clientHeight*.39)+'px';
        ui.viewport.style.setProperty('--hx',cue.style.left);   // 깨어나는 장면의 '앗!' 그림이 준희 머리 위치를 따라가게
        ui.viewport.style.setProperty('--hy',cue.style.top);
        cue.hidden=false;
        playSound('Wake');
      }
      if (phase === 'waking' && p >= (reduced.matches ? .40 : .555)) showPhase('title');
      if (phase === 'title' && p >= .9) {
        ui['title-motion'].style.opacity = String(Math.max(0,(1-p)*10));
      }
    },serial);
    if (serial === run) firstTask();
  }

  function firstTask() {
    if (!stage) return;
    ++run;
    ui['title-motion'].style.removeProperty('opacity');
    ui['wake-cue'].hidden=true;
    stage.intro(1);
    stage.lift(0);
    showPhase('find');
    say('앗, 깜빡 잠들었네요. 책상 위에 흩어진 첫 기획 메모부터 집어 볼까요?',
        ['기획 메모 집기',pickup]);
    ui['task-main'].focus({preventScroll:true});
  }

  function message(text) {
    clearTimeout(noticeTimer);
    ui['wrong-place'].textContent = text;
    noticeTimer = setTimeout(() => { ui['wrong-place'].textContent = ''; },2400);
  }
  async function pickup() {
    if (phase !== 'find') return;
    showPhase('lifting');
    say('메모를 집는 중이에요.');
    // At frame 142 the fingers meet the paper. The lift spans frames 132–149.
    let rustled = false;
    if (!await animate(reduced.matches?0:710,(t) => {
      stage.lift(t);
      if (!rustled && t >= 10/17) {
        rustled = true;
        playSound('Paper');
      }
    })) return;
    showPhase('holding');
    say('책상 오른쪽 보라색 자료함을 눌러요. 나중에 다시 펼칠 수 있게요.',
        ['자료함에 넣기',placeNote],['집기 취소',cancelPickup]);
    ui['task-main'].focus({preventScroll:true});
  }

  async function cancelPickup() {
    if (phase !== 'holding') return;
    showPhase('lifting');
    say('메모를 책상 위에 다시 둘게요.');
    if (!await animate(reduced.matches?0:270,(t) => stage.lift(1-t))) return;
    firstTask();
  }

  async function placeNote() {
    if (phase !== 'holding') return;
    showPhase('placing');
    say('메모를 자료함에 놓고 있어요.');
    if (!await animate(reduced.matches?0:1050,(t) => stage.place(t))) return;
    playSound('Ready');
    completed = true;
    save();
    showPhase('lighting');
    say('자료함이 켜졌어요. 길을 따라 불이 들어옵니다.');
    if (!await animate(reduced.matches?0:1550,(t) => stage.done(t))) return;
    showResult();
  }

  async function openTheater() {
    if (phase !== 'result') return;
    showPhase('theater-entering');
    say('영사대로 가 볼까요?');
    if (!await animate(reduced.matches?0:900,(t) => stage.theaterView(t))) return;
    showTheater();
  }

  function showTheater() {
    showPhase(filmMounted?'theater-ready':'theater');
    if (filmMounted) {
      stage.filmLoad(1);
      say('필름이 잘 맞물렸어요. 객석으로 가면 일루지오를 볼 수 있어요.',
        ['객석에 앉기',takeSeat],['방 전체 보기',returnFromTheater]);
    } else {
      stage.filmPick(0);
      say('영사대 왼쪽에 일루지오 필름이 있어요. 릴을 들어 영사기의 빈 축에 끼워 주세요.',
        ['필름 릴 집기',pickFilm],['방 전체 보기',returnFromTheater]);
    }
    ui['task-main'].focus({preventScroll:true});
  }

  async function returnFromTheater() {
    if (!['theater','theater-ready'].includes(phase)) return;
    showPhase('lighting');
    if (!await animate(reduced.matches?0:650,(t) => stage.theaterView(1-t))) return;
    showResult(true);
  }

  async function pickFilm() {
    if (phase !== 'theater') return;
    showPhase('theater-pickup');
    say('필름 릴을 들어요.');
    playSound('Paper');
    if (!await animate(reduced.matches?0:610,(t) => stage.filmPick(t))) return;
    showPhase('theater-load');
    say('릴의 가운데 구멍을 빈 축에 맞추면 돼요.',
      ['영사기에 장착',mountFilm],['릴 내려놓기',putFilmBack]);
    ui['task-main'].focus({preventScroll:true});
  }

  async function putFilmBack() {
    if (phase !== 'theater-load') return;
    showPhase('theater-pickup');
    say('필름 릴을 받침에 다시 놓아요.');
    if (await animate(reduced.matches?0:390,(t) => stage.filmPick(1-t))) showTheater();
  }

  async function mountFilm() {
    if (phase !== 'theater-load') return;
    showPhase('theater-loading-film');
    say('릴을 돌려 축에 맞춰요.');
    if (!await animate(reduced.matches?0:960,(t) => stage.filmLoad(t))) return;
    playSound('Ready');
    filmMounted = true;
    save();
    showTheater();
  }

  async function takeSeat() {
    if (phase !== 'theater-ready') return;
    showPhase('theater-seating');
    say('객석으로 이동해요.');
    if (!await animate(reduced.matches?0:830,(t) => stage.seatView(t))) return;
    if (!video.getAttribute('src')) video.src=defaultMovie();
    showPhase('theater-viewing');
    if (video.readyState>=2 && video.currentTime>.1) stage.screening(video);
    else if (video.poster) stage.screeningPoster(video.poster);
    showScreening();
    ui['task-main'].focus({preventScroll:true});
  }

  function showScreening(detail='') {
    if (phase !== 'theater-viewing') return;
    let label = '일시정지';
    if (video.paused) {
      if (video.ended) label = '다시 상영';
      else label = video.currentTime > .1 ? '이어서 재생' : '일루지오 재생';
    }
    say(detail || (movieURL ? '선택한 영상' : '일루지오 · 2D 본편 90초'),
      video.getAttribute('src') ? [label,toggleFilm] : ['영상 파일 선택',() => movieFile.click()],
      ['영사대로 돌아가기',leaveSeat]);
  }

  let filmStarting = false;   // 영상을 불러오는 동안 한 번 더 눌러도 재생이 끊기지 않게 막는다
  async function toggleFilm() {
    if (phase !== 'theater-viewing' || filmStarting) return;
    if (!video.paused) {
      video.pause();
      showScreening();
      return;
    }
    filmStarting = true;
    try {
      await video.play();
      filmStarting = false;
      if (phase !== 'theater-viewing') { video.pause(); return; }
      stage.screening(video);
      showScreening();
    } catch (error) {
      filmStarting = false;
      if (phase !== 'theater-viewing') return;
      if (error && error.name === 'AbortError') { showScreening(); return; }   // 불러오다 멈춘 것뿐이면 파일 선택으로 넘기지 않는다
      if (video.getAttribute('src') === '/_myroom_illusio.mp4') {
        video.src=bundledMovie;
        await toggleFilm();
        return;
      }
      video.removeAttribute('src');
      video.load();
      showScreening('일루지오 MP4를 선택하면 상영할 수 있어요.');
    }
  }

  async function leaveSeat() {
    if (phase !== 'theater-viewing') return;
    video.pause();
    stage.screening(null);
    showPhase('theater-seating');
    say('영사대로 돌아가요.');
    if (await animate(reduced.matches?0:650,(t) => stage.seatView(1-t))) showTheater();
  }

  movieFile.addEventListener('change',() => {
    const selected = movieFile.files[0];
    if (!selected) return;
    if (movieURL) URL.revokeObjectURL(movieURL);
    movieURL = URL.createObjectURL(selected);
    video.src=movieURL;
    video.removeAttribute('poster');
    stage?.screening(null);
    showScreening();
  });
  video.addEventListener('ended',() => {
    if(phase==='theater-viewing') completeRouteStop('Illusio');
    stage?.redraw();
    showScreening('상영이 끝났어요.');
  });
  video.addEventListener('seeked',() => stage?.redraw());

  function replay() {
    if (phase !== 'result') return;
    completed = false;
    filmMounted = false;
    exhibitProgress={};
    dawn=false;
    routeStop=-1;
    if (video.readyState) video.currentTime=0;
    save();
    void wake(true);
  }
  function goCover() {
    ++run;
    video.pause();
    stage?.screening(null);
    activeExhibit=null;
    clearTimeout(noticeTimer);
    ui['wrong-place'].textContent = '';
    ui['title-motion'].style.removeProperty('opacity');
    showPhase('cover');
    ui.play.hidden = true;
    ui.cover.hidden = false;
    const start = coverNarrow.matches ? document.querySelector('.cover-touch-wake') : ui.wake;
    start.focus({preventScroll:true});
  }

  function tryScene(event) {
    if(phase==='result') {
      const id=stage.exhibitAt?.(event.clientX,event.clientY);
      if(id) void selectExhibit(id);
      return;
    }
    if(['exhibit-ready','exhibit-holding','exhibit-sorted'].includes(phase)) {
      const here=stage.exhibitPoint(markerStep()?.[2],phase!=='exhibit-ready');
      const rect=ui.viewport.getBoundingClientRect();
      if(here && Math.hypot(here.x-event.clientX+rect.left,here.y-event.clientY+rect.top)<62) void exhibitAction();
      return;
    }
    if (!['find','holding','theater','theater-load'].includes(phase)) return;
    const hit = stage.hit(event.clientX,event.clientY);
    if (phase === 'find' && hit === 'paper') return void pickup();
    if (phase === 'holding' && hit === 'tray') return void placeNote();
    if (phase === 'find' && hit === 'tray') return message('기획 메모를 먼저 집어 주세요.');
    if (phase === 'holding') return message('들고 있는 메모를 보라색 자료함에 놓아 주세요.');
    if (phase === 'theater' && hit === 'film') return void pickFilm();
    if (phase === 'theater' && hit === 'projector') return message('영사대 왼쪽에서 필름을 먼저 집어 주세요.');
    if (phase === 'theater-load' && hit === 'projector') return void mountFilm();
    if (phase === 'theater-load') message('영사기의 빈 축에 필름 릴을 끼워 주세요.');
  }

  const overview = {
    concept:{
      title:'방을 정리하면, 미래가 보입니다.',
      text:'준희와 함께 흩어진 작업을 제자리에 두며 지난 작품을 발견합니다. 정리한 물건이 다시 꺼내 볼 세계로 연결됩니다.',
    },
    worlds:{
      title:'작품의 세계',
      text:'준희와 첫 메모를 정리한 뒤 여섯 작품 자리와 네 감상 자리를 둘러봅니다.',
      names:Object.values(gallery.objects).map(entry=>entry.zone),
    },
  };
  function openInfo(type) {
    const content = overview[type];
    ui['info-heading'].textContent = content.title;
    const body = ui['info-content'];
    const paragraph = document.createElement('p');
    paragraph.textContent = content.text;
    body.replaceChildren(paragraph);
    if (content.names) {
      const list = document.createElement('ul');
      for (const name of content.names) {
        const item=document.createElement('li');
        item.textContent = name;
        list.append(item);
      }
      body.append(list);
    } else {
      const link = document.createElement('a');
      link.href = window.RoomHosted?.planHref ?? window.RoomPack?.planHref ?? '../../01_Plan/나의방_기획서_30쪽.pdf';
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = '30쪽 기획서 보기';
      body.append(link);
    }
    ui.info.showModal();
  }

  const coverNarrow=window.matchMedia('(max-width:640px) and (orientation:portrait)');
  for (const [name,action] of [
    ['wake',() => void wake()],
    ['concept',() => openInfo('concept')],
    ['worlds',() => openInfo('worlds')]
  ]) {
    const button=ui[name];
    const touch=document.querySelector('[data-cover-action="'+name+'"]');
    for(const control of [button,touch]) {
      control.disabled=false;
      control.addEventListener('click',action);
    }
    const posterFocus=() => {
      button.tabIndex=coverNarrow.matches ? -1 : 0;
      if(coverNarrow.matches) button.setAttribute('aria-hidden','true');
      else button.removeAttribute('aria-hidden');
    };
    coverNarrow.addEventListener('change',posterFocus);
    posterFocus();
  }
  // 표지에는 시작 동작이 하나뿐이라 그림 어디를 눌러도 시작된다(작은 '깨우기' 칸을 못 찾는 사람 대비)
  ui.cover.addEventListener('click',(event) => {
    if (phase!=='cover' || event.target.closest('button,a') || ui.wake.disabled) return;
    void wake();
  });
  const warmStage = () => {
    if(phase==='cover'&&!document.hidden) void prepare();
  };
  if(window.requestIdleCallback) window.requestIdleCallback(warmStage,{timeout:300});
  else window.setTimeout(warmStage,110);
  ui.skip.addEventListener('click',() => {
    if (!['waking','title'].includes(phase)) return;
    if (!muted) playSound('Lamp');
    firstTask();
  });
  ui.paper.addEventListener('click',pickup);
  ui.tray.addEventListener('click',placeNote);
  ui.film.addEventListener('click',pickFilm);
  ui.projector.addEventListener('click',mountFilm);
  ui['gallery-return'].addEventListener('click',returnFromExhibit);
  ui['exhibit-target'].addEventListener('click',exhibitAction);
  ui['gallery-dawn'].addEventListener('click',openDawn);
  ui['route-next'].addEventListener('click',openRouteStop);
  ui['work-view'].addEventListener('close',()=>ui['work-body'].replaceChildren());
  ui.back.addEventListener('click',goCover);
  ui['room-canvas'].addEventListener('click',tryScene);
  document.addEventListener('keydown',(event) => {
    if (ui.info.open || ui['work-view'].open || event.repeat) return;
    if (phase === 'cover' && event.key === 'Enter' && !event.target.closest('button,a')) {
      event.preventDefault();
      void wake();
    }
    if (event.key === 'Escape' && phase === 'holding') {
      event.preventDefault();
      void cancelPickup();
    } else if (event.key === 'Escape' && ['theater','theater-ready'].includes(phase)) {
      event.preventDefault();
      void returnFromTheater();
    } else if (event.key === 'Escape' && phase === 'theater-load') {
      event.preventDefault();
      void putFilmBack();
    } else if (event.key === 'Escape' && phase === 'theater-viewing') {
      event.preventDefault();
      void leaveSeat();
    } else if(event.key==='Escape' && ['exhibit-ready','exhibit-holding','exhibit-sorted'].includes(phase)) {
      event.preventDefault();
      void returnFromExhibit();
    }
  });
})();

