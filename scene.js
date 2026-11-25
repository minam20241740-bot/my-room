
'use strict';

window.RoomStage = (() => {
  const T = window.THREE;
  const asset = (name) => window.RoomPack?.asset(name) ?? ('assets/'+name);
  const v = (triple) => new T.Vector3(triple[0], triple[2], -triple[1]);
  const ease = (u) => u * u * (3 - 2 * u);
  const clamp = (u) => Math.min(1, Math.max(0, u));
  // [초, 들어 올릴 높이(m)] — Blender 없이 브라우저에서 모든 정점을 대조해 잰 값에 여유 .004를 더함
  const DESK_SINK = [[0,.089],[.25,.078],[.5,.025],[.75,.014],[1,.013],[1.25,.009],[1.5,.005],[1.75,.007],[2,.006],[2.25,.006],[2.5,.005],[2.75,0],[8.5,0],[8.75,.089]];
  const mixed = (a, b, t) => ({
    position: a.position.map((n, i) => T.MathUtils.lerp(n, b.position[i], t)),
    target: a.target.map((n, i) => T.MathUtils.lerp(n, b.target[i], t)),
    lens: T.MathUtils.lerp(a.lens, b.lens, t),
  });

  function screenLabel() {
    const canvas = document.createElement('canvas');
    canvas.width = 768;
    canvas.height = 384;
    const context = canvas.getContext('2d');
    const texture = new T.CanvasTexture(canvas);
    texture.colorSpace = T.SRGBColorSpace;
    texture.anisotropy = 4;
    function draw(status) {
      const lamp = status !== 'sleep';
      const grad = context.createLinearGradient(0, 0, 768, 384);
      grad.addColorStop(0, status === 'sorted' ? '#113f4f' : '#171e38');
      grad.addColorStop(1, status === 'sorted' ? '#1b5061' : '#30294a');
      context.fillStyle = grad;
      context.fillRect(0, 0, 768, 384);
      context.strokeStyle = status === 'sorted' ? '#72d9c8' : '#6e81b1';
      context.lineWidth = 3;
      context.strokeRect(32, 31, 704, 322);
      context.fillStyle = '#acb7e4';
      context.font = 'bold 20px sans-serif';
      context.fillText('UNKNOWN RE:DRAW ROOM', 62, 84);
      context.fillStyle = lamp ? '#ede5f4' : '#b9bed6';
      context.font = 'bold 52px "Malgun Gothic", sans-serif';
      context.fillText(status === 'sorted' ? '메모 정리 완료' : (lamp ? '오늘의 작업' : 'JUNHEE'), 62, 180);
      context.fillStyle = status === 'sorted' ? '#9af1dc' : '#f8c579';
      context.font = '27px "Malgun Gothic", sans-serif';
      context.fillText(status === 'sorted' ? '마술 극장이 열렸어요' : (lamp ? '흩어진 첫 기획 메모' : '절전 모드'), 64, 242);
      texture.needsUpdate = true;
    }
    draw('sleep');
    const mesh = new T.Mesh(
      new T.PlaneGeometry(.861, .448),
      new T.MeshBasicMaterial({ map: texture, toneMapped: false }),
    );
    mesh.name = 'Desk_Screen_Interactive';
    mesh.position.set(-.91, 1.38, -.398);
    return {mesh, draw};
  }

  function makeLight(scene, position, color, power, target) {
    const lamp = new T.DirectionalLight(color, power);
    lamp.position.copy(v(position));
    if (target) lamp.target.position.copy(v(target));
    scene.add(lamp, lamp.target);
    return lamp;
  }

  function theaterTitle(screen) {
    const canvas = document.createElement('canvas');
    canvas.width = 768;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');
    const backdrop = ctx.createLinearGradient(0, 0, 768, 400);
    backdrop.addColorStop(0, '#231731');
    backdrop.addColorStop(.56, '#392541');
    backdrop.addColorStop(1, '#193641');
    ctx.fillStyle = backdrop;
    ctx.fillRect(0, 0, 768, 400);
    ctx.strokeStyle = '#e4ad7c';
    ctx.lineWidth = 3;
    ctx.strokeRect(28, 28, 712, 344);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffe1ad';
    ctx.font = '600 28px Georgia';
    ctx.fillText('I L L U S I O', 384, 121);
    ctx.fillStyle = '#fff2e0';
    ctx.font = 'bold 80px "Malgun Gothic", sans-serif';
    ctx.fillText('일루지오', 384, 236);
    ctx.fillStyle = '#dcad92';
    ctx.font = '29px "Malgun Gothic", sans-serif';
    ctx.fillText('마술과 마법의 도시', 384, 296);
    const texture = new T.CanvasTexture(canvas);
    texture.colorSpace = T.SRGBColorSpace;
    texture.anisotropy = 4;
    const bounds = new T.Box3().setFromObject(screen);
    const size = bounds.getSize(new T.Vector3());
    const art = new T.Mesh(
      new T.PlaneGeometry(size.x*.98, size.y*.975),
      new T.MeshBasicMaterial({map:texture, toneMapped:false, transparent:true, opacity:0}),
    );
    art.position.copy(bounds.getCenter(new T.Vector3()));
    art.position.z = bounds.max.z + .003;
    art.visible = false;
    art.name = 'Theater_Illusio_Title';
    return art;
  }

  function create(canvas, viewport) {
    const loader = new (T.GLTFLoader || window.GLTFLoader)();
    const renderer = new T.WebGLRenderer({canvas, antialias: true, powerPreference: 'high-performance'});
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFShadowMap;
    renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = true;
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.25));
    const scene = new T.Scene();
    scene.background = new T.Color('#1e2033');
    const camera = new T.PerspectiveCamera(42, 1, .035, 46);
    const ambient = new T.HemisphereLight('#c6d4ff', '#65515e', 1.70);
    scene.add(ambient);
    const main = makeLight(scene, [3.3, 1.6, 6.2], '#ffe5d1', 1.95, [0, 0, 0]);
    main.castShadow = true;
    main.shadow.mapSize.set(1024, 1024);
    Object.assign(main.shadow.camera, {left:-7.5,right:7.5,top:6.5,bottom:-6.5,near:.1,far:17});
    main.shadow.normalBias = .025;
    main.shadow.bias = -.00025;
    makeLight(scene, [-4.4,-2,3.3], '#9ab7ff', 1.26, [-.2,-.6,1.2]);
    const deskLamp = new T.PointLight('#ffbc70', 0, 2.9, 2);
    deskLamp.position.copy(v([-1.02,.33,1.45]));
    const theaterLamp = new T.SpotLight('#ffbd74',0,7,.77,.50,1.8);
    theaterLamp.position.copy(v([.0,2.69,3.6]));
    theaterLamp.target.position.copy(v([.05,4.34,1.27]));
    scene.add(deskLamp, theaterLamp, theaterLamp.target);

    let marks, mixer, clip, action, room, prop, tray, chair, paths, theater, projection, led, filmStage, exhibits;
    const walker = new T.Group();
    let frameRequest = null, currentCamera, screenIs='sleep', miniatureRequested=false;
    let currentPose = -1, modelStatus = 'loading';
    const display = screenLabel();
    scene.add(display.mesh);

    async function fetchMarks() {
      if (window.RoomPack) return window.RoomPack.marks;
      const result = await fetch(asset('Scene_Marks.json'));
      if (!result.ok) throw new Error('Scene marks could not load');
      return result.json();
    }

    function applyCamera(shot) {
      if (!shot) return;
      currentCamera = shot;
      camera.position.copy(v(shot.position));
      camera.lookAt(v(shot.target));
      const aspect = Math.max(.3, camera.aspect);
      const vertical = T.MathUtils.radToDeg(2 * Math.atan(36 / (2 * shot.lens * aspect)));
      camera.fov = aspect < 1 ? T.MathUtils.clamp(vertical, 34, shot.portraitFov ?? 65) : vertical;
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();
    }

    function size() {
      const w = viewport.clientWidth;
      const h = viewport.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      if (currentCamera) applyCamera(currentCamera);
      request();
    }
    const resize = new ResizeObserver(size);
    resize.observe(viewport);
    let shadowLive = true, shadowTick = 0, shadowStale = false, shadowForce = true, shadowTimer = 0;
    function request() {
      if (frameRequest !== null || modelStatus !== 'ready') return;
      frameRequest = requestAnimationFrame(() => {
        frameRequest = null;
        // 그림자 지도는 두 프레임에 한 번만 다시 그린다(그리기 횟수의 대부분이 그림자 패스라서). 움직임이 멈출 때는 마지막에 한 번 더 맞춘다.
        if (shadowLive) { const fresh = shadowForce || (shadowTick++ & 1) === 0; renderer.shadowMap.needsUpdate = fresh; shadowStale = !fresh; shadowForce = false; }
        renderer.render(scene, camera);
        if (onUpdate) onUpdate();
        if (filmStage?.render()) request();
        if (shadowStale) { clearTimeout(shadowTimer); shadowTimer = setTimeout(() => { if (shadowStale) { shadowForce = true; request(); } }, 90); }
      });
    }
    let onUpdate = null;

    // The Blender exporter retains UTF-8 labels in extras and original node names in this model.
    const child = (root, name) => {
      const result = root.getObjectByName(name);
      if (!result) throw new Error('Missing model object ' + name);
      return result;
    };
    function projectorPart(root,sourceName) {
      let found;
      root.traverse((item) => {
        if (item.userData.source_name===sourceName) found=item;
      });
      if (!found) throw new Error('Missing theater part ' + sourceName);
      return found;
    }
    // 움직이지 않는 건축 메쉬(00_Architecture*)를 같은 재질끼리 하나로 합쳐 그리기 호출 수를 줄인다.
    // 이름으로 찾거나 움직이는 물체는 건드리지 않는다.
    function mergeStaticArchitecture(root) {
      const inv = new T.Matrix4().copy(root.matrixWorld).invert();
      const groups = new Map();
      root.traverse(o => {
        if (!o.isMesh || o.isSkinnedMesh || Array.isArray(o.material) || o.morphTargetInfluences) return;
        if (!o.name.startsWith('00_Architecture') || !o.geometry.attributes.position) return;
        const list = groups.get(o.material.uuid) || [];
        list.push(o); groups.set(o.material.uuid, list);
      });
      let before = 0, after = 0;
      groups.forEach(list => {
        before += list.length;
        if (list.length < 2) { after += list.length; return; }
        const material = list[0].material, keep = ['position', 'normal', 'uv'];
        if (material.vertexColors) keep.push('color');
        const geos = [];
        for (const m of list) {
          const g = m.geometry.clone();
          for (const k of Object.keys(g.attributes)) if (!keep.includes(k)) g.deleteAttribute(k);
          if (!g.attributes.normal) g.computeVertexNormals();
          if (!g.attributes.uv) g.setAttribute('uv', new T.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
          if (!g.index) { const n = g.attributes.position.count, idx = new Uint32Array(n); for (let i = 0; i < n; i++) idx[i] = i; g.setIndex(new T.BufferAttribute(idx, 1)); }
          g.clearGroups();
          g.applyMatrix4(new T.Matrix4().multiplyMatrices(inv, m.matrixWorld));
          if (m.matrixWorld.determinant() < 0) {   // 좌우 반전된 물체는 면 방향을 뒤집어 그대로 보이게
            const ix = g.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; }
          }
          geos.push(g);
        }
        const merged = window.BufferGeometryUtils.mergeGeometries(geos, false);
        geos.forEach(g => g.dispose());
        if (!merged) { after += list.length; return; }
        const mesh = new T.Mesh(merged, material);
        mesh.name = '00_Architecture_Merged';
        mesh.receiveShadow = true; mesh.castShadow = false; mesh.matrixAutoUpdate = false;
        root.add(mesh);
        list.forEach(m => { m.parent && m.parent.remove(m); m.geometry.dispose(); });
        after += 1;
      });
      window.__mergeInfo = {before, after};
    }
    const ready = Promise.all([
      fetchMarks(), loader.loadAsync(asset('MyRoom.glb')), loader.loadAsync(asset('Junhee.glb')),
    ]).then(([instructions, environment, person]) => {
      marks = instructions;
      room = environment.scene;
      room.updateMatrixWorld(true);
      const shadowBox = new T.Box3(), shadowSize = new T.Vector3();
      room.traverse(o => {
        if (o.isMesh) {
          o.receiveShadow = true;
          o.castShadow = !o.name.startsWith('00_Architecture');
          if (o.castShadow && !o.name.startsWith('Quest_')) {
            // 아주 작은 소품은 그림자를 만들지 않는다(그림자 패스의 그리기 횟수를 줄여 렉을 줄임)
            shadowBox.setFromObject(o).getSize(shadowSize);
            if (Math.max(shadowSize.x, shadowSize.y, shadowSize.z) < .14) o.castShadow = false;
          }
        }
      });
      mergeStaticArchitecture(room);
      prop = child(room,'Quest_Paper');
      tray = child(room,'Quest_Tray');
      chair = child(room,'Junhee_Chair_Pivot');
      theater = child(room,'Theater_Projection');
      led = child(room,'Quest_Tray_LED');
      paths = Array.from({length:9},(_,i) => child(room,'Quest_Path_' + String(i+1).padStart(2,'0')));
      theater.material = theater.material.clone();
      led.material = led.material.clone();
      walker.add(person.scene);
      scene.add(room, walker);
      projection = theaterTitle(theater);
      scene.add(projection);
      filmStage = window.RoomTheater.add(scene,projection,projectorPart(room,'영사기'),
        projectorPart(room,'영사기 · 필름 릴'),projectorPart(room,'영사기 · 필름 릴.001'));
      const bands=new T.DataTexture(new Uint8Array([116,149,185,224,255]),5,1,T.RedFormat);
      bands.minFilter=bands.magFilter=T.LinearFilter;
      bands.needsUpdate=true;
      const illustrationMaterial=new Map();
      person.scene.traverse(o => {
        if (o.isMesh) {
          if (o.material.name === 'Junhee_Portrait_Helper_Disabled') {
            o.visible = false;
            o.castShadow = false;
            return;
          }
          const surface=o.material;
          if (/^Junhee_(Face_Painted|Skin_Lit|Hair_Black|Coat_)/.test(surface.name)) {
            if (!illustrationMaterial.has(surface)) {
              const shaded=new T.MeshToonMaterial({color:surface.color,map:surface.map,
                gradientMap:bands,side:surface.side,alphaTest:surface.alphaTest,
                transparent:surface.transparent,opacity:surface.opacity});
              shaded.name=surface.name;
              illustrationMaterial.set(surface,shaded);
            }
            o.material=illustrationMaterial.get(surface);
          }
          o.castShadow = !o.name.includes('Glasses_Lens');
          o.receiveShadow = true;
          o.frustumCulled = false;
        }
      });
      clip = person.animations.find(c => c.name.includes('Junhee')) || person.animations[0];
      if (!clip || clip.duration < 4 || !clip.tracks.length) throw new Error('Missing Junhee wake animation');
      mixer = new T.AnimationMixer(person.scene);
      action = mixer.clipAction(clip);
      action.setLoop(T.LoopOnce, 1);
      action.clampWhenFinished = true;
      action.play();
      exhibits=window.RoomGalleryStage({room,actor:walker,scene,marks,camera,viewport,request,applyCamera,
        overview:marks.shots.organized,standing:()=>pose(1)});
      modelStatus = 'ready';
      reset();
      document.body.dataset.animationTracks = String(clip.tracks.length);
      document.body.dataset.render = 'webgl';
      size();
      return {clip:clip.name, tracks:clip.tracks.length};
    });

    function loadMiniature() {
      if(miniatureRequested) return;
      miniatureRequested=true;
      const figure=room.getObjectByName('Exhibit_Aqua_Object');
      window.RoomGallery.aquaModel().then(miniature=>{
        const bounds=new T.Box3().setFromObject(miniature);
        const scale=.53/bounds.getSize(new T.Vector3()).y;
        const mid=bounds.getCenter(new T.Vector3());
        miniature.scale.multiplyScalar(scale);
        miniature.position.set(-mid.x*scale,-bounds.min.y*scale+.05,-mid.z*scale);
        const stand=figure.getObjectByName('Aquatic_Diorama_Stand');
        if(stand) stand.visible=false;
        figure.add(miniature);
        request();
      }).catch(()=>{miniatureRequested=false;});
    }

    function pose(t) {
      const time = clamp(t);
      if (Math.abs(time-currentPose) < .00001) return;
      currentPose = time;
      // Jump to a time without allowing a completed action to stop future seeks.
      action.enabled = true;
      action.paused = false;
      action.time = Math.min(clip.duration-.00001,time*clip.duration);
      mixer.update(0);
      // 책상 충돌 보정: 엎드린 머리와 손이 책상 윗면(높이 .89)에 파고드는 만큼 몸 전체를 들어 올린다
      const actorRoot = walker.children[0];
      if (actorRoot) {
        if (actorRoot.userData.baseY === undefined) actorRoot.userData.baseY = actorRoot.position.y;
        const sec = action.time, table = DESK_SINK;
        let sink = 0;
        for (let i = 0; i < table.length - 1; i++) {
          if (sec >= table[i][0] && sec <= table[i+1][0]) {
            const u = (sec - table[i][0]) / (table[i+1][0] - table[i][0] || 1);
            sink = table[i][1] + (table[i+1][1] - table[i][1]) * u; break;
          }
        }
        actorRoot.position.y = actorRoot.userData.baseY + sink;
      }
    }

    function monitor(name) {
      if (screenIs === name) return;
      screenIs = name;
      display.draw(name);
    }

    function intro(progress) {
      if (!marks) return;
      const p = clamp(progress);
      const seconds = (marks.wake_end - 1) / marks.fps;
      const frame = 1 + seconds * marks.fps * p;
      pose((frame - 1) / (marks.clip_end - 1));
      let shot;
      if (frame < 75) shot = mixed(marks.shots.sleep,marks.shots.wake,ease((frame-1)/74));
      else if (frame < 92) shot = mixed(marks.shots.wake,marks.shots.title,ease((frame-75)/17));
      else shot = mixed(marks.shots.title,marks.shots.task,ease((frame-92)/40));
      applyCamera(shot);
      const chairAmount = ease(clamp((frame-42)/31));
      chair.position.z = -T.MathUtils.lerp(marks.chair.start, marks.chair.end, chairAmount);
      deskLamp.intensity = 3.2 * ease(clamp((frame-17)/18));
      monitor(frame < 31 ? 'sleep' : 'awake');
      request();
    }

    function paperAt(frame) {
      const track = marks.paper_track;
      const time = Math.max(0, Math.min(track.length-1, frame-marks.wake_end));
      const before = track[Math.floor(time)];
      const after = track[Math.ceil(time)];
      const fraction = time - Math.floor(time);
      prop.position.copy(v(before).lerp(v(after),fraction));
      prop.rotation.y = T.MathUtils.lerp(before[3],after[3],fraction);
    }

    function lift(t) {
      const frame = T.MathUtils.lerp(marks.wake_end,marks.paper_lift_end,clamp(t));
      paperAt(frame);
      pose((frame - 1) / (marks.clip_end - 1));
      request();
    }

    function place(t) {
      const frame = T.MathUtils.lerp(marks.paper_lift_end,marks.paper_place_end,clamp(t));
      paperAt(frame);
      pose((frame - 1) / (marks.clip_end - 1));
      request();
    }

    function done(t) {
      const p = clamp(t);
      if(p>.34) loadMiniature();
      const light = ease(clamp((p-.10)/.60));
      const frame = T.MathUtils.lerp(marks.paper_place_end,marks.clip_end,p);
      pose((frame - 1) / (marks.clip_end - 1));
      paths.forEach((m,i) => { m.visible = p > .20 + i*.029; });
      ambient.intensity = T.MathUtils.lerp(1.70,2.48,light);
      theaterLamp.intensity = 44*light;
      theater.material.color.set('#738ab0').lerp(new T.Color('#fdcf88'),light);
      theater.material.emissive.set('#ffb55c');
      theater.material.emissiveIntensity = .95*light;
      projection.visible = p > .44;
      projection.material.opacity = ease(clamp((p-.44)/.47));
      led.material.emissive.set('#62efc4');
      led.material.emissiveIntensity = .22+1.94*light;
      if (p > .44) monitor('sorted');
      applyCamera(mixed(marks.shots.task,marks.shots.organized,ease(p)));
      request();
    }

    function reset() {
      exhibits?.reset();
      exhibits?.progress({},false);
      currentPose = -1;
      intro(0);
      paperAt(marks.wake_end);
      ambient.intensity=1.70;
      theaterLamp.intensity=0;
      theater.material.color.set('#54596e');
      theater.material.emissive.set('#29405a');
      theater.material.emissiveIntensity=.10;
      projection.visible = false;
      filmStage.setVideo(null);
      filmStage.pick(0);
      led.material.emissive.set('#b77145');
      led.material.emissiveIntensity=.22;
      paths.forEach(o => o.visible=false);
      request();
    }

    const ray = new T.Raycaster();
    function hit(clientX, clientY) {
      if (!room) return null;
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return null;
      ray.setFromCamera(new T.Vector2(2*(clientX-rect.left)/rect.width-1,-2*(clientY-rect.top)/rect.height+1),camera);
      const result = ray.intersectObjects([prop,tray,filmStage.feed,filmStage.hub,filmStage.projector],true);
      for (const item of result) {
        let node=item.object;
        while(node) {
          if(node===prop) return 'paper';
          if(node===tray) return 'tray';
          if(node===filmStage.feed) return 'film';
          if(node===filmStage.hub || node===filmStage.projector) return 'projector';
          node=node.parent;
        }
      }
      return null;
    }

    function point(tag) {
      if (!room) return null;
      const obj=tag==='head' ? walker.getObjectByName('Junhee_Head') :
        {paper:prop,tray,film:filmStage?.feed,projector:filmStage?.hub}[tag];
      if (!obj) return null;
      const position=obj.getWorldPosition(new T.Vector3());
      position.y+=tag==='head' ? .18 : .03;
      position.project(camera);
      if (!Number.isFinite(position.x) || position.z>1) return null;
      return {x:(position.x+1)*viewport.clientWidth/2,y:(1-position.y)*viewport.clientHeight/2};
    }

    const projectionDesk = {position:[1.26,-.01,1.78],target:[.02,1.94,1.04],lens:35};
    function theaterView(t) {
      applyCamera(mixed(marks.shots.organized,projectionDesk,ease(clamp(t))));
      request();
    }

    function seatView(t) {
      const target={position:[.074,2.06,1.23],target:[.07,4.49,1.58],lens:24};
      const amount=ease(clamp(t));
      const shot=mixed(projectionDesk,target,amount);
      shot.portraitFov=T.MathUtils.lerp(65,104,amount);
      applyCamera(shot);
      request();
    }

    function filmPick(t) {
      filmStage.pick(t);
      request();
    }
    function filmLoad(t) {
      filmStage.load(t);
      request();
    }
    function screening(video) {
      filmStage.setVideo(video);
      shadowLive=!video; shadowForce=true;
      renderer.shadowMap.needsUpdate=true;
      request();
    }

    function screeningPoster(url) {
      filmStage.setPoster(url,request);
      request();
    }

    return {ready, reset, intro, lift, place, done, point, hit, theaterView, size,
      seatView, filmPick, filmLoad, screening, screeningPoster, redraw:request, onUpdate(fn) {onUpdate=fn;},
      galleryReset(){exhibits?.reset();},
      exhibitAt(x,y){return exhibits?.stationAt(x,y);},
      exhibitMotion(part,p,mode){exhibits?.motion(part,p,mode);},
      visit(key,p,returning){exhibits?.visit(key,p,returning);},
      exhibitPoint(part,target){return exhibits?.point(part,target);},
      exhibitProgress(completed,day){exhibits?.progress(completed,day);},
      dawnJourney(p){exhibits?.dawnJourney(p);}, dawnOverview(){exhibits?.dawnOverview();}};
  }

  return { create };
})();

