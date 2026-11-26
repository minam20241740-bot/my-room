'use strict';

window.RoomGallery = (() => {
  const objects = {
    Type: {
      zone:'활자 작업실', work:'나의 방 제목 모션', page:12, color:'#e4ac75',
      guide:'흩어진 낱말을 왼쪽부터 조판대에 놓아 볼까요?',
      steps:[['UNKNOWN 집기','왼쪽 칸에 놓기','Type_1'],['RE:DRAW 집기','가운데 칸에 놓기','Type_2'],['ROOM 집기','오른쪽 칸에 놓기','Type_3']],
      finished:'세 낱말이 나란히 놓였어요. 제목이 어떻게 움직이는지 볼까요?',
    },
    Illusio: {zone:'마술극장',work:'일루지오',page:14,color:'#e8a38b'},
    Signal: {
      zone:'야간 신호실',work:'우회선',page:16,color:'#71c6b8',
      guide:'관제대의 느슨한 신호선을 집어 오른쪽 단자에 연결해 주세요.',
      steps:[['신호선 집기','신호 단자에 연결','Signal']],finished:'신호등이 들어왔어요. 관제대에서 이어진 길을 확인해요.',
    },
    Shadow: {
      zone:'전광판 창가',work:'나의 그림자에게 붙잡히다',page:18,color:'#bba4e6',
      guide:'창틀 옆 손잡이를 찾아봐요. 밖의 전광판이 가려져 있어요.',
      steps:[['블라인드 열기',null,'Shadow']],finished:'창밖 화면이 보이네요. 다 보고 나면 이 자리는 낮은 불만 남겨둘게요.',
    },
    Detective: {
      zone:'탐정 책상',work:'탐정 사무소 ARCHIVE',page:20,color:'#e7c878',
      guide:'책상에 놓인 단서 봉투를 집어서 오른쪽 파일에 꽂아 주세요.',
      steps:[['단서 봉투 집기','단서 파일에 꽂기','Detective']],finished:'사건 파일이 열렸어요. 이 책상에서 수사 기록을 확인해요.',
    },
    Aqua: {
      zone:'수조 진열대',work:'아쿠아',page:22,color:'#8ce3f0',
      guide:'수조 옆에 넘어져 있는 아쿠아 모형을 받침대에 세워 주세요.',
      steps:[['아쿠아 모형 집기','받침대에 세우기','Aqua']],finished:'받침대 조명이 켜졌어요. 몸을 돌려서 옆모습도 볼 수 있어요.',
    },
    Ribbon: {
      zone:'리본 응접실',work:'헬로키티',page:24,color:'#e9a5c0',
      guide:'바닥에 떨어진 사진을 앨범에 꽂아 볼까요?',
      steps:[['사진 집기','사진 앨범에 꽂기','Ribbon']],finished:'앨범을 열어 리본 응접실을 살펴봐요.',
    },
    Dream: {
      zone:'공간 회랑',work:'드림랜드',page:25,color:'#9fd0dc',
      guide:'회랑으로 통하는 문이 반쯤 열려 있어요.',
      steps:[['회랑 문 열기',null,'Dream']],finished:'문 너머에 전망대까지 이어지는 길이 있어요.',
    },
    Shelf: {
      zone:'캐릭터 진열장',work:'캐릭터 작업 모음',page:26,color:'#e7c878',
      guide:'바닥에 쓰러진 작은 모형을 빈 선반 받침에 세워 주세요.',
      steps:[['캐릭터 모형 집기','선반에 세우기','Shelf']],finished:'진열장 조명이 켜졌어요. 만들었던 캐릭터를 다시 볼 수 있어요.',
    },
    Archive: {
      zone:'벽과 책장',work:'그래픽·게임 작업 모음',page:27,color:'#d9ad96',
      guide:'포스터는 액자에, 음반과 게임기는 아래 책장에 놓아 주세요.',
      steps:[['포스터 집기','벽 액자에 걸기','Archive_1'],['음반 집기','음반 칸에 꽂기','Archive_2'],['게임기 집기','책장에 놓기','Archive_3']],
      finished:'액자와 책장이 정리됐어요. 작품을 가까이서 크게 볼까요?',
    },
  };
  const main=['Type','Illusio','Signal','Shadow','Detective','Aqua'];
  const file=(name)=>window.RoomPack?.has?.(name) ? window.RoomPack.asset(name) : 'assets/'+name;
  const aquaSources={};
  function aquaModel(modelFile='Aqua_Female.glb') {
    if(!aquaSources[modelFile]) {
      const T=window.THREE;
      const loader=new (T.GLTFLoader||window.GLTFLoader)();
      aquaSources[modelFile]=loader.loadAsync(file(modelFile)).then(({scene,animations})=>{scene.animations=animations;return scene;}).catch(error=>{
        aquaSources[modelFile]=null;
        throw error;
      });
    }
    return aquaSources[modelFile].then(source=>{
      const clone=source.clone(true);
      const originalNodes=[], clonedNodes=[];
      source.traverse(node=>originalNodes.push(node));
      clone.traverse(node=>clonedNodes.push(node));
      const corresponding=new Map(originalNodes.map((node,index)=>[node,clonedNodes[index]]));
      clone.traverse(node=>{
        if(!node.isSkinnedMesh) return;
        const original=originalNodes[clonedNodes.indexOf(node)];
        node.skeleton=original.skeleton.clone();
        node.skeleton.bones=original.skeleton.bones.map(bone=>corresponding.get(bone));
        node.bindMatrix.copy(original.bindMatrix);
        node.bind(node.skeleton,node.bindMatrix);
      });
      if(clone.animations.length){
        const posing=new window.THREE.AnimationMixer(clone);
        clone.animations.forEach(clip=>posing.clipAction(clip).play());
        posing.setTime(2.8);
      }
      clone.updateMatrixWorld(true);
      return clone;
    });
  }
  const add=(parent,tag,message,classes)=>{
    const node=document.createElement(tag);
    if(classes) node.className=classes;
    if(message) node.textContent=message;
    parent.append(node);
    return node;
  };
  const button=(parent,label,handler)=> {
    const node=add(parent,'button',label,'gallery-action');
    node.type='button';
    node.addEventListener('click',handler);
    return node;
  };

  function showCards(parent, completed, open) {
    for (const [id, entry] of Object.entries(objects)) {
      const card=button(parent,'',()=>open(id));
      card.classList.add('zone-card');
      card.dataset.zone=id;
      card.style.setProperty('--accent',entry.color);
      add(card,'span',entry.zone);
      add(card,'small',completed(id) ? '다시 보기' : entry.work);
      card.classList.toggle('zone-done',completed(id));
    }
  }
  function typeMotion(body) {
    const line=add(body,'div',null,'letter-press');
    const descriptions=[['UNKNOWN','알 수 없는'],['RE:DRAW','다시 그리다'],['ROOM','방']];
    const play=()=>{
      line.replaceChildren();
      descriptions.forEach(([word,meaning],index)=>{
        const slug=add(line,'div');
        slug.style.setProperty('--appear',(index*.37)+'s');
        add(slug,'strong',word);
        add(slug,'span',meaning);
      });
    };
    play();
    button(body,'다시 재생',play);
  }
  function video(body,name,label) {
    const el=add(body,'video',null,'gallery-video');
    el.controls=true; el.playsInline=true; el.preload='metadata'; el.setAttribute('aria-label',label);
    el.poster=file('Shadow_Poster.jpg');
    const connectedShadow = /^https?:$/.test(location.protocol)
      && location.hostname === '127.0.0.1' && !window.RoomPack && !window.RoomHosted;
    el.src=file(name);
  }
  function link(body,label,href) {
    const a=add(body,'a',label,'gallery-action');
    a.href=href; a.target='_blank'; a.rel='noopener';
    return a;
  }
  function linkedPersonalWork(body,label,id) {
    if(location.hostname !== '127.0.0.1' || window.RoomPack || window.RoomHosted) return;
    const station=body.dataset.station;
    fetch('/_myroom_work_list')
      .then(response=>response.ok ? response.json() : [])
      .then(works=>{if(works.includes(id) && body.dataset.station===station) link(body,label,'/work/'+id+'/index.html');})
      .catch(()=>{});
  }
  function signalBoard(body,onExperience) {
    add(body,'p','중계기를 누를 때마다 신호 방향이 돌아가요. A에서 B로, B에서 위쪽 수신기로 신호를 보내세요.');
    const board=add(body,'div',null,'signal-board');
    const source=add(board,'div','발신기','signal-node signal-origin');
    const receiver=add(board,'div','수신기','signal-node signal-destination');
    source.dataset.live='true';
    const feedback=add(body,'p',null,'signal-reply');
    feedback.setAttribute('role','status');
    const directions=[['↑','위쪽'],['→','오른쪽'],['↓','아래쪽'],['←','왼쪽']];
    const relays=[{name:'A',direction:0},{name:'B',direction:1}];
    const controls=relays.map((relay)=>{
      const control=button(board,'',()=>{
        relay.direction=(relay.direction+1)%directions.length;
        update();
      });
      control.classList.add('signal-relay');
      control.dataset.relay=relay.name;
      add(control,'span','중계기 '+relay.name);
      const arrow=add(control,'strong');
      arrow.setAttribute('aria-hidden','true');
      return {control,arrow};
    });
    add(board,'span',null,'signal-line signal-line-origin').setAttribute('aria-hidden','true');
    const horizontal=add(board,'span',null,'signal-line signal-line-relays');
    const vertical=add(board,'span',null,'signal-line signal-line-destination');
    horizontal.setAttribute('aria-hidden','true');
    vertical.setAttribute('aria-hidden','true');

    function update() {
      const reachesB=relays[0].direction===1;
      const connected=reachesB && relays[1].direction===0;
      controls.forEach(({control,arrow},index)=>{
        const relay=relays[index];
        const [symbol,direction]=directions[relay.direction];
        arrow.textContent=symbol;
        control.setAttribute('aria-label','중계기 '+relay.name+' 방향 바꾸기. 현재 '+direction);
        control.dataset.direction=direction;
        control.dataset.live=String(index===0 || reachesB);
      });
      horizontal.dataset.live=String(reachesB);
      vertical.dataset.live=receiver.dataset.live=String(connected);
      feedback.dataset.ok=String(connected);
      feedback.textContent=connected ? '수신 완료. A와 B를 거쳐 길이 이어졌어요.' :
        reachesB ? 'B까지 신호가 도착했어요. 위쪽 수신기로 보내세요.' : '신호가 A에 도착했어요. 오른쪽 B를 향하게 돌리세요.';
      if(connected) onExperience();
    }
    update();
    if(window.RoomHosted) {
      link(body,'우회선 게임 열기','work/Detour/index.html');
    } else if(location.protocol==='http:' && !window.RoomPack) {
      link(body,'우회선 PC 게임 열기','/work/Detour/');
    } else if(!window.RoomHosted) {
      add(body,'p','우회선 전체 게임과 시연은 함께 제공한 우회선 항목에서 열 수 있습니다.','signal-launch-note');
    }
  }
  function detective(body) {
    const cases=[['A','A · 턴제 추리'],['B','B · 자동전투와 스킬 카드'],['C','C · 실시간 액션']];
    if(window.RoomHosted) {
      add(body,'p','탐정 책상에서 수사 방식을 골라 게임을 엽니다.');
      const list=add(body,'div',null,'work-links');
      const screen=add(body,'div',null,'embedded-detective');
      body.closest('dialog')?.addEventListener('close',()=>screen.replaceChildren(),{once:true});
      for(const [id,title] of cases) {
        const url='work/Detective-'+id+'/index.html';
        const launch=button(list,title,()=>{
          if(window.RoomStage&&window.RoomStage.touchLike()){window.RoomStage.open('도시의 몬스터와 탐정 사무소 · '+id,url,'landscape');return;}   // 휴대폰은 화면 전체로
          screen.replaceChildren();
          const frame=add(screen,'iframe');
          frame.title=title;
          frame.src=url;
          frame.allow='fullscreen';
          link(screen,'게임 새 창에서 열기',url);
        });
        launch.dataset.game=id;
      }
    } else if(location.protocol==='http:' && !window.RoomPack) {
      add(body,'p','현장의 단서를 들고 수사를 이어갈 방식을 골라 주세요.');
      const list=add(body,'div',null,'work-links');
      for(const [id,title] of cases) {
        link(list,title,'/work/Detective-'+id+'/index.html').dataset.game=id;
      }
    } else {
      add(body,'p','수사 방식');
      const list=add(body,'ul');
      for(const [,title] of cases) add(list,'li',title);
      add(body,'p','Mac과 Windows에서 탐정 ZIP을 풀고, 원하는 방식의 게임열기.html을 Chrome 또는 Edge로 여세요.');
    }
  }
  function mediaCards(body,entries) {
    const grid=add(body,'div',null,'artwork-grid');
    for(const [label,src] of entries) {
      const figure=add(grid,'figure');
      const image=add(figure,'img');
      image.src=file(src); image.alt=label;
      add(figure,'figcaption',label);
      image.addEventListener('click',()=>image.classList.toggle('image-enlarged'));
    }
  }
  function characterLinks(parent, links) {
    const list=add(parent,'div',null,'work-links character-actions');
    const station=parent.closest('#work-body');
    const hasLocalFiles=location.protocol==='http:' && location.hostname==='127.0.0.1' && !window.RoomPack && !window.RoomHosted;
    const locallyHosted=hasLocalFiles
      ? fetch('/_myroom_character_files').then(response=>response.ok?response.json():{}).catch(()=>({}))
      : Promise.resolve({});
    for(const entry of links) {
      if(!entry.url) continue;
      const anchor=link(list,entry.label,entry.url);
      if(typeof entry.download==='string') anchor.download=entry.download;
    }
    locallyHosted.then(files=>{
      if(!station || !list.isConnected) return;
      for(const entry of links) {
        if(!Object.hasOwn(files,entry.id)) continue;
        const anchor=link(list,entry.label,'/work/Characters/'+entry.id);
        if(entry.download) anchor.download=files[entry.id];
      }
    });
  }
  function characterDetails(body,label,render) {
    const details=add(body,'details',null,'character-work');
    add(details,'summary',label);
    const contents=add(details,'div',null,'character-content');
    details.addEventListener('toggle',()=>{
      if(details.open && !contents.hasChildNodes()) render(contents,details);
      if(!details.open) contents.querySelector('video')?.pause();
    });
  }
  function characterFilm(body, details, asset, still, caption) {
    const film=add(body,'video',null,'character-film');
    film.controls=true;
    film.playsInline=true;
    film.preload='metadata';
    film.src=file(asset);
    film.poster=file(still);
    film.setAttribute('aria-label',caption);
    details.closest('dialog')?.addEventListener('close',()=>film.pause(),{once:true});
  }
  function aquaWorks(body,onExperience) {
    rotateAqua(body,onExperience,'Aqua_Male.glb');
    const planURL=window.RoomPack?.planHref ?? window.RoomHosted?.planHref ?? '../../01_Plan/나의방_기획서_30쪽.pdf';
    const poseFile='Aqua_Exhibition_Pose.blend';
    characterLinks(body,[
      {label:'나의 방 기획서 22쪽',url:planURL+'#page=22'},
      {label:'검은 눈 전시 자세 Blender',
        url:window.RoomPack || window.RoomHosted ? '' : '../../02_3D/'+poseFile,download:poseFile},
    ]);
    characterDetails(body,'아쿠아 · 캐릭터 시트',entry=>{
      mediaCards(entry,[['표지','char/aqua_p01.jpg'],['턴어라운드와 디테일','char/aqua_p02.jpg'],['포즈','char/aqua_p03.jpg'],['2D 설정화와 3D','char/aqua_p04.jpg']]);
      characterLinks(entry,[{label:'기획서 PDF(캐릭터 시트 포함)',url:file('portfolio/char/aqua_plan.pdf')}]);
    });
    characterDetails(body,'아쿠아 여성형 · 책 감상',entry=>{
      mediaCards(entry,[['책을 들어 표지를 보여주는 자세','Character_Aqua_Female.jpg']]);
      characterLinks(entry,[
        {label:'여성형 기획서',url:file('Character_Aqua_Female_Plan.pdf')},
        {label:'책 감상 GLB',id:'aqua-female-view',download:true},
        {label:'여성형 Blender',id:'aqua-female',download:true},
      ]);
    });
    characterDetails(body,'아쿠아 MK2 · 중성형',entry=>{
      mediaCards(entry,[['원래 UV를 사용한 얼굴 재질','Character_Aqua_MK2.jpg']]);
      characterLinks(entry,[
        {label:'MK2 재질 작업 안내',url:file('Character_Aqua_MK2_Guide.html')},
        {label:'Dreamland 원기획서',id:'aqua-mk2-plan'},
        {label:'MK2 Blender',id:'aqua-mk2',download:true},
      ]);
    });
  }
  function shelfWorks(body) {
    characterDetails(body,'주디 홉스', (entry,details)=>{
      characterFilm(entry,details,'portfolio/W009.mp4','Shelf_Judy.jpg','주디 훈련장 타격과 반동 · 1.5초');
      characterLinks(entry,[
        {label:'주디 기획서',url:file('Shelf_Judy_Plan.pdf')},
        {label:'귀 반응 Blender',id:'judy-greeting',download:true},
        {label:'훈련장 동작 Blender',id:'judy-training',download:true},
      ]);
    });
    characterDetails(body,'모모엘', (entry,details)=>{
      characterFilm(entry,details,'portfolio/W012.mp4','Shelf_Momo.jpg','모모엘 손끝 집광과 발사 · 2초');
      characterLinks(entry,[
        {label:'모모엘 기획서',url:file('Shelf_Momoel_Plan.pdf')},
        {label:'시전 Blender',id:'momoel-cast',download:true},
        {label:'After Effects 원본',id:'momoel-ae',download:true},
      ]);
    });
    mediaCards(body,[['헬로키티','Ribbon_Room.jpg'],['Gloopy Mood Light','Shelf_Gloopy.jpg']]);
  }
  function rotateAqua(body,onExperience,modelFile) {
    const frame=add(body,'div',null,'aqua-view');
    const canvas=add(frame,'canvas');
    canvas.setAttribute('aria-label','아쿠아 모형. 정면, 옆, 뒤 버튼으로 시점 변경');
    const controls=add(body,'div',null,'work-links');
    const deps=window.THREE;
    let ready;
    let render;
    let disposed=false;
    try {
      const renderer=new deps.WebGLRenderer({canvas,antialias:true,alpha:true});
      const stage=new deps.Scene(), camera=new deps.PerspectiveCamera(34,1,.035,25);
      renderer.setSize(530,355,false);
      renderer.toneMapping=deps.ACESFilmicToneMapping;
      renderer.toneMappingExposure=1.05;
      renderer.shadowMap.enabled=true;
      renderer.shadowMap.type=deps.PCFSoftShadowMap;
      camera.aspect=530/355; camera.updateProjectionMatrix();
      camera.position.set(0,.18,4.14);
      camera.lookAt(0,-.035,0);
      stage.add(new deps.HemisphereLight('#e0f6ff','#897398',2.16));
      const key=new deps.DirectionalLight('#fff6db',2.65);
      key.castShadow=true;
      key.shadow.mapSize.set(512,512);
      Object.assign(key.shadow.camera,{left:-1.55,right:1.55,top:1.55,bottom:-1.55,near:.3,far:11});
      key.shadow.normalBias=.006;
      key.position.set(3,4,4); stage.add(key);
      const pivot=new deps.Group(); stage.add(pivot);
      const base=new deps.Mesh(new deps.CylinderGeometry(.51,.55,.08,64),
        new deps.MeshStandardMaterial({color:'#2f676f',roughness:.71,metalness:.12}));
      base.position.y=-.98;
      base.receiveShadow=true;
      stage.add(base);
      render=()=>{if(!disposed) renderer.render(stage,camera);};
      ready=aquaModel(modelFile).then(scene=>{
        const box=new deps.Box3().setFromObject(scene);
        const scale=1.88/box.getSize(new deps.Vector3()).y;
        scene.scale.multiplyScalar(scale);
        scene.position.sub(box.getCenter(new deps.Vector3()).multiplyScalar(scale));
        scene.traverse(object=>{if(object.isMesh) object.castShadow=true;});
        pivot.add(scene);
        if(scene.animations.length){
          const motion=new deps.AnimationMixer(scene);
          scene.animations.forEach(clip=>motion.clipAction(clip).play());
          motion.setTime(2.8);
          let previousTime=performance.now();
          renderer.setAnimationLoop(()=>{
            const now=performance.now();
            motion.update(Math.min((now-previousTime)/1000,.1));
            previousTime=now;
            render();
          });
        }
        render();
        canvas.dataset.model='ready';
      });
      for(const [label,angle] of [['정면',0],['옆면',Math.PI/2],['뒷면',Math.PI]]) {
        button(controls,label,()=>ready?.then(()=>{
          pivot.rotation.y=angle;canvas.dataset.view=label;render();
          if(angle) onExperience();
        }).catch(()=>{}));
      }
      let x,last;
      canvas.addEventListener('pointerdown',(event)=>{x=event.clientX;last=pivot.rotation.y;canvas.setPointerCapture(event.pointerId);});
      canvas.addEventListener('pointermove',(event)=>{
        if(!canvas.hasPointerCapture(event.pointerId)) return;
        pivot.rotation.y=last+(event.clientX-x)*.012;render();
        if(canvas.dataset.model==='ready' && Math.abs(pivot.rotation.y-last)>.5) onExperience();
      });
      const clear=()=>{disposed=true;renderer.setAnimationLoop(null);renderer.dispose();renderer.forceContextLoss();};
      body.closest('dialog').addEventListener('close',clear,{once:true});
      ready.catch(showStill);
    } catch {
      showStill();
    }
    function showStill() {
      frame.replaceChildren();
      controls.replaceChildren();
      mediaCards(frame,[['아쿠아 작업 화면','Aqua_Review.png']]);
      const image=frame.querySelector('img');
      button(controls,'작업 화면 확대',()=>{
        if(!image.naturalWidth) return;
        image.classList.toggle('image-enlarged');
        onExperience();
      });
    }
  }
  function renderWork(body,id,onExperience) {
    body.replaceChildren();
    body.dataset.station=id;
    switch(id) {
      case 'Type':
        typeMotion(body); onExperience(); break;
      case 'Signal': signalBoard(body,onExperience); break;
      case 'Shadow': video(body,'Shadow_Film.mp4',objects.Shadow.work); break;
      case 'Detective': detective(body); break;
      case 'Aqua': aquaWorks(body,onExperience); break;
      case 'Ribbon': mediaCards(body,[['리본 응접실','Ribbon_Room.jpg'],['리본 응접실 · 다른 시점','Ribbon_Room_Alt.jpg']]); break;
      case 'Dream':
        mediaCards(body,[['문 너머 전망대','Dream_Terrace.jpg'],['공간 회랑','Dream_Corridor.jpg']]);
        linkedPersonalWork(body,'드림랜드 공간 뷰어','Dream');
        break;
      case 'Shelf': shelfWorks(body); break;
      case 'Archive':
        mediaCards(body,[['서울 벚꽃 축제','Archive_Cherry.jpg'],['AKMU DINOSAUR','Archive_Dinosaur.jpg'],['선과 형태 2024','Archive_Line.jpg'],['멜루 · 출장 다녀왔습니다','Archive_Melu.jpg']]);
        linkedPersonalWork(body,'멜루 플레이','Mellu');
        break;
    }
  }
  return {objects,main,showCards,renderWork,aquaModel,rotateAqua};
})();

