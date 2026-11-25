'use strict';

window.RoomTheater = (() => {
  const T = window.THREE;
  const eased = (t) => t * t * (3 - 2*t);

  function reel(name, metal, gold, dark) {
    const group = new T.Group();
    group.name = name;
    const plate = new T.Shape();
    plate.absarc(0,0,.136,0,Math.PI*2,false);
    for (let i=0; i<5; i++) {
      const angle = i*Math.PI*2/5;
      const cut = new T.Path();
      cut.absarc(Math.cos(angle)*.079,Math.sin(angle)*.079,.033,0,Math.PI*2,true);
      plate.holes.push(cut);
    }
    const face = new T.ExtrudeGeometry(plate,{depth:.011,curveSegments:18,
      bevelEnabled:true,bevelSize:.004,bevelThickness:.003,bevelSegments:2});
    const faceFront = new T.Mesh(face,metal);
    faceFront.position.z=.014;
    const faceBack = new T.Mesh(face,metal);
    faceBack.position.z=-.026;
    const rim = new T.Mesh(new T.TorusGeometry(.134,.008,8,48),gold);
    rim.position.z=.028;
    const winding = new T.Mesh(new T.CylinderGeometry(.108,.108,.037,48),dark);
    winding.rotation.x=Math.PI/2;
    const coupling = new T.Mesh(new T.CylinderGeometry(.030,.030,.068,24),gold);
    coupling.rotation.x=Math.PI/2;
    const indicator = new T.Mesh(new T.BoxGeometry(.019,.026,.004),gold);
    indicator.position.set(0,.113,.035);
    group.add(winding,faceBack,faceFront,rim,coupling,indicator);
    return group;
  }

  function add(scene, frame, projector, takeUpModel, feedModel) {
    const metal = new T.MeshStandardMaterial({color:'#476078',metalness:.55,roughness:.39});
    const gold = new T.MeshStandardMaterial({color:'#e3ad6c',metalness:.48,roughness:.34});
    const dark = new T.MeshStandardMaterial({color:'#2b1c27',metalness:.14,roughness:.58});
    const body = projector.getWorldPosition(new T.Vector3());
    const spindle = feedModel.getWorldPosition(new T.Vector3());
    const takeUpPosition = takeUpModel.getWorldPosition(new T.Vector3());
    const feed = reel('Illusio_Feed_Reel',metal,gold,dark);
    const takeUp = reel('Illusio_TakeUp_Reel',metal,gold,dark);
    takeUp.position.copy(takeUpPosition);
    takeUp.scale.setScalar(.95);
    feedModel.visible=false;
    takeUpModel.visible=false;
    const hub = new T.Mesh(new T.CylinderGeometry(.035,.035,.067,20),gold);
    hub.name='Illusio_Feed_Spindle';
    hub.rotation.x=Math.PI/2;
    hub.position.copy(spindle);
    const supportTop=body.y+.10;
    for (const location of [spindle,takeUpPosition]) {
      const pin=new T.Mesh(new T.CylinderGeometry(.022,.022,.13,16),gold);
      pin.rotation.x=Math.PI/2;
      pin.position.copy(location).add(new T.Vector3(0,0,-.047));
      const stanchion = new T.Mesh(new T.BoxGeometry(.062,location.y-supportTop+.023,.061),metal);
      stanchion.position.set(location.x,(location.y+supportTop)/2,location.z-.076);
      scene.add(pin,stanchion);
    }
    const pedestal = new T.Mesh(new T.BoxGeometry(.33,.052,.29),dark);
    pedestal.name='Illusio_Reel_Rest';
    pedestal.position.set(body.x-.48,body.y-.102,body.z+.02);
    const idle = pedestal.position.clone().add(new T.Vector3(0,.157,.012));
    const held = spindle.clone().add(new T.Vector3(-.21,.15,.33));
    const targetBefore = spindle.clone().add(new T.Vector3(0,0,.20));
    const front = new T.Mesh(new T.CylinderGeometry(.062,.062,.085,30),metal);
    front.name='Illusio_Projector_Lens';
    front.position.copy(body).add(new T.Vector3(0,.032,-.178));
    front.rotation.x=Math.PI/2;
    const lensState = new T.MeshBasicMaterial({color:'#ac7842',toneMapped:false});
    const lens = new T.Mesh(new T.CylinderGeometry(.043,.043,.009,24),lensState);
    lens.position.copy(front.position).add(new T.Vector3(0,0,-.047));
    lens.rotation.x=Math.PI/2;
    const start = lens.position.clone();
    const stop = frame.position.clone().add(new T.Vector3(0,0,.035));
    const axis = start.clone().sub(stop);
    const beam = new T.Mesh(new T.ConeGeometry(.87,axis.length(),40,1,true),
      new T.MeshBasicMaterial({color:'#e1bb91',transparent:true,opacity:.065,
        depthWrite:false,side:T.BackSide,toneMapped:false}));
    beam.name='Illusio_Projector_Beam';
    beam.position.copy(start).lerp(stop,.5);
    beam.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),axis.normalize());
    beam.visible=false;
    [feed,takeUp,hub,pedestal,front,lens,beam].forEach(item=>scene.add(item));
    const videoScreen = frame.clone();
    videoScreen.name='Illusio_Active_Projection';
    videoScreen.material = new T.MeshBasicMaterial({color:'#fdfaff',toneMapped:false});
    videoScreen.position.z+=.005;
    videoScreen.scale.x*=.92;
    videoScreen.visible=false;
    scene.add(videoScreen);
    let source = null;
    let videoTexture = null;
    let posterTexture = null;
    let mounted = false;

    function pick(t) {
      mounted=false;
      const p=eased(t);
      feed.position.copy(idle).lerp(held,p);
      feed.position.y+=Math.sin(Math.PI*p)*.105;
      feed.rotation.set(0,T.MathUtils.lerp(.24,-.18,p),T.MathUtils.lerp(-.24,.16,p));
      lensState.color.set('#ac7842');
    }

    function load(t) {
      if (t<.68) {
        feed.position.copy(held).lerp(targetBefore,eased(t/.68));
      } else {
        feed.position.copy(targetBefore).lerp(spindle,eased((t-.68)/.32));
      }
      feed.rotation.set(0,-.18*(1-t),.16*(1-t));
      mounted=t>=1;
      lensState.color.set(mounted?'#ffdcab':'#ac7842');
    }

    function setVideo(video) {
      if (video && source!==video) {
        videoTexture?.dispose();
        videoTexture = new T.VideoTexture(video);
        videoTexture.colorSpace = T.SRGBColorSpace;
        source=video;
      }
      if (video) videoScreen.material.map=videoTexture;
      videoScreen.material.needsUpdate=true;
      videoScreen.visible = Boolean(video);
      beam.visible = Boolean(video);
      if (!video) {
        feed.rotation.z=0;
        takeUp.rotation.z=0;
      }
    }

    function setPoster(url, redraw) {
      if (!posterTexture) {
        posterTexture=new T.TextureLoader().load(url,redraw,undefined,() => {
          if (videoScreen.material.map!==posterTexture) return;
          videoScreen.visible=false;
          redraw();
        });
        posterTexture.colorSpace=T.SRGBColorSpace;
      }
      videoScreen.material.map=posterTexture;
      videoScreen.material.needsUpdate=true;
      videoScreen.visible=true;
      beam.visible=false;
    }

    function render() {
      if (!source || !videoScreen.visible || videoScreen.material.map!==videoTexture) return false;
      const turns=source.currentTime*1.95;
      feed.rotation.z=mounted?-turns:0;
      takeUp.rotation.z=-turns;
      return !source.paused;
    }

    pick(0);
    return {feed,hub,projector,pick,load,setVideo,setPoster,render};
  }

  return {add};
})();
