'use strict';

window.RoomGalleryStage = ({room, actor, scene, marks, camera, viewport, request, applyCamera, overview, standing}) => {
  const T=window.THREE;
  const xyz=([x,y,z])=>new T.Vector3(x,z,-y);
  const clamped=(t)=>Math.min(1,Math.max(0,t));
  const eased=(t)=>{t=clamped(t);return t*t*(3-2*t);};
  const steps=new Map();
  const stations=new Map();
  const find=(name)=>room.getObjectByName('Exhibit_'+name);
  const center=(object)=>new T.Box3().setFromObject(object).getCenter(new T.Vector3());
  const dawnWindow=find('Dawn_Sash');
  const dawnLatch=room.getObjectByName('Dawn_Window_Latch');
  const sky=find('Dawn_Sky');
  const skyCanvas=document.createElement('canvas');
  skyCanvas.width=skyCanvas.height=160;
  const skyContext=skyCanvas.getContext('2d');
  const skyTexture=new T.CanvasTexture(skyCanvas);
  skyTexture.colorSpace=T.SRGBColorSpace;
  if(sky) {
    sky.material=new T.MeshBasicMaterial({map:skyTexture,toneMapped:false});
    sky.castShadow=false;
  }
  const dawn=new T.DirectionalLight('#ffdba5',0);
  dawn.name='Window_Morning_Light';
  dawn.position.copy(xyz([-5.91,6.10,2.84]));
  dawn.target.position.copy(xyz([-3.46,.91,.15]));
  dawn.castShadow=true;
  dawn.shadow.mapSize.set(1024,1024);
  Object.assign(dawn.shadow.camera,{left:-3.2,right:3.2,top:3.2,bottom:-3.2,near:.1,far:13});
  dawn.shadow.normalBias=.012;
  dawn.shadow.bias=-.00015;
  room.traverse(obj=>{if(obj.userData.casts_dawn_shadow) obj.castShadow=true;});
  scene.add(dawn,dawn.target);
  const night=new T.Color('#1e2033'),morning=new T.Color('#ad9b88');
  const armJoints=['UpperLeg_L','UpperLeg_R','LowerLeg_L','LowerLeg_R','UpperArm_L','UpperArm_R'];
  const bones=armJoints.map(name=>actor.getObjectByName('Junhee_'+name));
  const basePose=[];
  const hips=actor.getObjectByName('Junhee_Torso_01');
  const hipOffset=new T.Vector3();
  const gaitLegs=['L','R'].map(side=>({
    side, upper:actor.getObjectByName('Junhee_UpperLeg_'+side),
    lower:actor.getObjectByName('Junhee_LowerLeg_'+side),
    foot:actor.getObjectByName('Junhee_Foot_'+side),
    sole:actor.getObjectByName('Derby_'+side+'_Sole')
  }));
  const raisedFloor=['Detour_SignalRoom_Element','Shadow_Window_Element014']
    .map(name=>room.getObjectByName(name)).filter(Boolean);
  const floorRay=new T.Raycaster();
  const down=new T.Vector3(0,-1,0);
  const arm=['UpperArm_R','LowerArm_R','Hand_R'].map(name=>actor.getObjectByName('Junhee_'+name));
  const gripSpec=marks.dawn_grip;
  const digits=['Thumb','Index','Middle','Ring','Little'].map(digit=>
    [1,2,3].map(joint=>actor.getObjectByName('Junhee_'+digit+joint+'_R')));
  let armRest=[];
  let fingerRest=[];
  // One local-bone pose for the turn. Index order follows digits above,
  // and each row contains proximal, middle and distal joint quaternions.
  const knobFingerPose=[
    [[0.6820666,-0.0166233,-0.130925,0.7192826],[-0.0372747,0.0912101,-0.0416152,0.9942633],[0.0002045,0.0071366,-0.0390988,0.9992098]],
    [[-0.0540972,-0.1243195,0.0185975,0.9905919],[-0.0694282,-0.1002497,0.0753513,0.9896726],[-0.03323,-0.0239785,0.1357248,0.9898988]],
    [[-0.0291686,-0.0616363,0.0502589,0.9964056],[-0.0375963,-0.0493093,0.0883723,0.9941556],[-0.0199066,-0.0148253,0.1431497,0.9893897]],
    [[-0.0780629,-0.1649657,-0.0127948,0.983122],[-0.1007257,-0.1321086,0.0307447,0.9856249],[-0.052432,-0.0508816,0.1271633,0.9891873]],
    [[-0.1027535,-0.2171438,-0.0452254,0.9696623],[-0.1327106,-0.17406,0.0008649,0.9757511],[-0.0714723,-0.0437935,0.100206,0.9914296]],
  ].map(row=>row.map(values=>new T.Quaternion(...values).normalize()));
  const modifications=new T.Quaternion();
  const localAxis=new T.Vector3(1,0,0);
  const approach=[[0,0,0],[-2.1,-1.0,0],[-4.25,-.85,0],[-5.88,.54,0],
    [-5.94,2.78,0],[-5.91,4.30,0]].map(xyz);
  const windowWatch=xyz([-5.83,3.83,0]);
  const dawnShot={position:[-2.3,1.14,2.78],target:[-5.60,4.18,1.44],lens:36,portraitFov:80};
  const frontToWindow=new T.Vector3(0,0,-1);
  let morningAmount=0;
  let skyLevel=-1;

  for(const [key, entry] of Object.entries(window.RoomGallery.objects)) {
    if(!entry.steps || !marks.exhibits?.[key]) continue;
    const data=marks.exhibits[key];
    const light=new T.PointLight(entry.color,0,2.7,2);
    light.position.copy(xyz(data.position)); light.position.y+=.48;
    scene.add(light);
    const indicator=find(key+'_Status');
    indicator.material=indicator.material.clone();
    stations.set(key,{...data,light,indicator});
    for(const [, ,part] of entry.steps) {
      const object=find(part+'_Object');
      const target=find(part+'_Target');
      if(!object) throw new Error('Missing exhibit object: '+part);
      steps.set(part,{object,target,pos:object.position.clone(),rot:object.quaternion.clone(),size:object.scale.clone()});
    }
  }
  function armReset() {
    arm.forEach((bone,i)=>{if(bone&&armRest[i]) bone.quaternion.copy(armRest[i]);});
    digits.forEach((chain,i)=>chain.forEach((bone,j)=>{
      if (bone && fingerRest[i]?.[j]) bone.quaternion.copy(fingerRest[i][j]);
    }));
  }
  function reach(target,influence,passes=1) {
    if(armRest.length!==3||!arm.every(Boolean)) return;
    armReset();
    const hand=arm[2];
    for(const joint of Array.from({length:passes},()=>[arm[1],arm[0],arm[1]]).flat()) {
      const pivot=joint.getWorldPosition(new T.Vector3());
      const from=hand.getWorldPosition(new T.Vector3()).sub(pivot).normalize();
      const to=target.clone().sub(pivot).normalize();
      const rotation=new T.Quaternion().setFromUnitVectors(from,to);
      const rest=new T.Quaternion().slerp(rotation,Math.min(.56,influence*.56));
      const parent=joint.parent.getWorldQuaternion(new T.Quaternion());
      joint.quaternion.premultiply(parent.clone().invert().multiply(rest).multiply(parent));
    }
  }
  function motion(part,u,mode='place',perform=true) {
    const item=steps.get(part);
    if(!item) return;
    const {object,target,pos,rot,size}=item;
    const p=eased(u);
    object.position.copy(pos);
    object.quaternion.copy(rot);
    object.scale.copy(size);
    if(part==='Shadow') {
      object.scale.y=size.y*(1-.93*p);
    } else if(part==='Dream' && target) {
      object.quaternion.slerp(target.quaternion,p);
    } else if(target) {
      const mid=pos.clone().lerp(target.position,.38);
      mid.y=Math.max(pos.y,target.position.y)+.27;
      const held=mode==='hold';
      if(held) object.position.lerp(mid,p);
      else {
        object.position.copy(mid).lerp(target.position,p);
        object.quaternion.slerp(target.quaternion,p);
      }
    }
    if(perform) {
      const handle=part==='Shadow' ? room.getObjectByName('Window_Pull_Toggle') :
        part==='Dream' ? room.getObjectByName('Corridor_Door_Handle') : null;
      const contact=handle ? center(handle) : center(object);
      reach(contact,mode==='hold'?p:eased(Math.min(1,(1-u)*7)));
    }
    request();
  }
  function progress(progress,day) {
    for(const [key,station] of stations) {
      const count=progress[key]||0;
      const entry=window.RoomGallery.objects[key];
      const complete=count>=entry.steps.length;
      entry.steps.forEach(([, ,part],index)=>{
        if(index<count) motion(part,1,'place',false);
        else {
          const ref=steps.get(part);
          ref.object.position.copy(ref.pos);ref.object.quaternion.copy(ref.rot);ref.object.scale.copy(ref.size);
        }
      });
      station.indicator.material.emissive=new T.Color(complete ? entry.color : '#424359');
      station.indicator.material.emissiveIntensity=complete ? 1.9 : .08;
      station.light.intensity=complete ? (key==='Shadow'?4:15) : 0;
    }
    armReset();
    sunrise(day?1:0);
  }
  function sunrise(amount,opening=amount,unlocked=opening) {
    morningAmount=amount;
    dawn.intensity=amount*5;
    scene.background.copy(night).lerp(morning,amount);
    if(dawnWindow) dawnWindow.rotation.y=opening*1.23;
    if(dawnLatch) dawnLatch.rotation.z=T.MathUtils.degToRad(22)*unlocked;
    if(sky && Math.abs(skyLevel-amount)>.017) {
      const blend=(from,to)=>new T.Color(from).lerp(new T.Color(to),amount).getStyle();
      const horizon=skyContext.createLinearGradient(0,0,0,160);
      horizon.addColorStop(0,blend('#4a587d','#8baad4'));
      horizon.addColorStop(.59,blend('#72758a','#f4ad90'));
      horizon.addColorStop(1,blend('#ac8289','#ffe4bd'));
      skyContext.fillStyle=horizon;
      skyContext.fillRect(0,0,160,160);
      const glow=skyContext.createRadialGradient(82,84,2,82,84,34);
      glow.addColorStop(0,'rgba(255,240,193,'+(amount*.93)+')');
      glow.addColorStop(.45,'rgba(255,204,152,'+(amount*.35)+')');
      glow.addColorStop(1,'rgba(255,204,152,0)');
      skyContext.fillStyle=glow;
      skyContext.fillRect(0,0,160,160);
      skyTexture.needsUpdate=true;
      skyLevel=amount;
    }
    request();
  }
  function capturePose() {
    standing();
    actor.updateMatrixWorld(true);
    armRest=arm.map(bone=>bone?.quaternion.clone());
    fingerRest=digits.map(chain=>chain.map(bone=>bone?.quaternion.clone()));
    if(hips) {
      hips.getWorldPosition(hipOffset);
      hipOffset.y=0;
    }
    for(const [i,bone] of bones.entries()) if(bone) basePose[i]=bone.quaternion.clone();
    for(const leg of gaitLegs) {
      if(!leg.upper||!leg.lower||!leg.foot||!leg.sole) continue;
      leg.footRest=leg.foot.quaternion.clone();
      leg.restFacing=actor.getWorldQuaternion(new T.Quaternion()).invert()
        .multiply(leg.foot.getWorldQuaternion(new T.Quaternion()));
      const ankle=leg.foot.getWorldPosition(new T.Vector3());
      leg.standingOffset=ankle.clone().sub(hipOffset);
      leg.standingOffset.y=0;
      const solePoints=[];
      for(let i=0;i<leg.sole.geometry.attributes.position.count;i++) {
        const v=new T.Vector3();
        leg.sole.getVertexPosition(i,v);
        solePoints.push(leg.sole.localToWorld(v));
      }
      const low=Math.min(...solePoints.map(v=>v.y));
      leg.ankleHeight=ankle.y-low+.001;
      const rim=solePoints.filter(v=>v.y<low+.009);
      const offsets=[rim.reduce((sum,v)=>sum.add(v),new T.Vector3()).multiplyScalar(1/rim.length)];
      for(const axis of ['x','z']) {
        rim.sort((a,b)=>a[axis]-b[axis]);
        offsets.push(rim[0],rim.at(-1));
      }
      leg.soleOffsets=offsets.map(v=>{
        const offset=v.clone().sub(ankle);
        offset.y=0;
        return offset;
      });
    }
  }
  function walk(route,t) {
    const total=route.slice(1).reduce((sum,node,i)=>sum+node.distanceTo(route[i]),0);
    let left=total*t;
    for(let i=1;i<route.length;i++) {
      const from=route[i-1],to=route[i],length=from.distanceTo(to);
      if(left<=length || i===route.length-1) {
        return {position:from.clone().lerp(to,length?clamped(left/length):1),
          direction:to.clone().sub(from),total};
      }
      left-=length;
    }
  }
  function placeActor(position,heading,front=0) {
    actor.rotation.y=Math.atan2(heading.x,heading.z)+front;
    actor.position.copy(position).sub(hipOffset.clone().applyAxisAngle(T.Object3D.DEFAULT_UP,actor.rotation.y));
  }
  function stride(wind,footsteps=false) {
    [.28,-.28,.22,.22,-.14,.14].forEach((power,index)=>{
      const bone=bones[index];
      if(bone&&basePose[index]) bone.quaternion.copy(basePose[index]).multiply(
        modifications.setFromAxisAngle(localAxis,footsteps&&index<4 ? 0 : power*wind*(index===3?-1:1)));
    });
    actor.position.y=footsteps ? 0 : .018*Math.abs(wind);
  }
  function transitionCamera(shot,blend) {
    applyCamera({position:overview.position.map((value,i)=>T.MathUtils.lerp(value,shot.position[i],blend)),
      target:overview.target.map((value,i)=>T.MathUtils.lerp(value,shot.target[i],blend)),
      lens:T.MathUtils.lerp(overview.lens,shot.lens,blend),portraitFov:shot.portraitFov??83});
  }
  function floorHeight(leg,ankle,orientation) {
    let highest=0;
    for(const offset of leg.soleOffsets) {
      const probe=offset.clone().applyQuaternion(orientation).add(ankle);
      probe.y=.18;
      floorRay.set(probe,down);
      const hit=floorRay.intersectObjects(raisedFloor,false)[0];
      if(hit) highest=Math.max(highest,hit.point.y);
    }
    return highest;
  }
  function footfall(route,total,distance,leg) {
    const cycle=2*Math.PI/8.2;
    const side=leg.side==='L'?-1:1;
    const phase=side<0?0:cycle/2;
    const center=Math.floor((distance-phase+cycle*.25)/cycle)*cycle+phase;
    const swing=clamped((distance-center-cycle*.25)/(cycle*.5));
    function anchor(at) {
      const fraction=clamped(at/total);
      const position=walk(route,fraction).position;
      const span=.12/total;
      const tangent=walk(route,clamped(fraction+span)).position.sub(walk(route,clamped(fraction-span)).position);
      const orientation=new T.Quaternion().setFromAxisAngle(T.Object3D.DEFAULT_UP,Math.atan2(tangent.x,tangent.z)+Math.PI);
      position.add(new T.Vector3(side*.105,leg.ankleHeight,0).applyQuaternion(orientation));
      position.y+=floorHeight(leg,position,orientation);
      return {position,orientation};
    }
    const first=anchor(center),next=anchor(center+cycle);
    const mix=eased(swing);
    const stepHeight=Math.abs(next.position.y-first.position.y);
    first.position.lerp(next.position,mix);
    first.position.y+=(.063+stepHeight*.65)*Math.sin(Math.PI*swing)**2;
    first.orientation.slerp(next.orientation,mix);
    first.position.y=Math.max(first.position.y,leg.ankleHeight+floorHeight(leg,first.position,first.orientation));
    first.orientation.multiply(leg.restFacing);
    return first;
  }
  function alignBone(joint,currentTip,wantedTip) {
    const pivot=joint.getWorldPosition(new T.Vector3());
    const from=currentTip.clone().sub(pivot).normalize();
    const to=wantedTip.clone().sub(pivot).normalize();
    const delta=new T.Quaternion().setFromUnitVectors(from,to);
    const parent=joint.parent.getWorldQuaternion(new T.Quaternion());
    joint.quaternion.premultiply(parent.clone().invert().multiply(delta).multiply(parent));
  }
  function pivotFoot(turn,leg) {
    const delta=Math.atan2(Math.sin(turn.to-turn.from),Math.cos(turn.to-turn.from));
    const pairs=Math.max(1,Math.ceil(Math.abs(delta)/(Math.PI*.55)));
    const advance=clamped(turn.phase)*pairs;
    const pair=Math.min(pairs-1,Math.floor(advance));
    const leading=leg.side===(delta>=0?'L':'R');
    const swing=clamped(2*(advance-pair)-(leading?0:1));
    const angle=turn.from+delta*(pair+eased(swing))/pairs+Math.PI;
    const orientation=new T.Quaternion().setFromAxisAngle(T.Object3D.DEFAULT_UP,angle);
    const position=leg.standingOffset.clone().applyQuaternion(orientation).add(turn.position);
    const clearance=.05*Math.min(1,Math.abs(delta)/.7)*Math.sin(Math.PI*swing)**2;
    position.y=leg.ankleHeight+floorHeight(leg,position,orientation)+clearance;
    return {position,orientation:orientation.multiply(leg.restFacing)};
  }
  function plantFeet(route,total,distance,turn) {
    const amount=turn?1:eased(Math.min(distance,total-distance)/.34);
    const kneeBlend=turn?Math.sin(Math.PI*turn.phase):amount;
    for(const leg of gaitLegs) if(leg.footRest) leg.foot.quaternion.copy(leg.footRest);
    if(gaitLegs.some(leg=>!leg.footRest)) return;
    const standingHeights=gaitLegs.map(leg=>floorHeight(leg,leg.foot.getWorldPosition(new T.Vector3()),actor.quaternion));
    // A small shared pelvis drop leaves both knees room to bend at full stride.
    const steps=gaitLegs.map(leg=>turn?pivotFoot(turn,leg):footfall(route,total,distance,leg));
    const sharedRise=Math.min(...steps.map((step,i)=>Math.max(0,step.position.y-gaitLegs[i].ankleHeight)));
    actor.position.y=T.MathUtils.lerp(Math.min(...standingHeights),sharedRise-.026*(turn?kneeBlend:1),amount);
    for(const [i,leg] of gaitLegs.entries()) {
      const step=steps[i];
      const hip=leg.upper.getWorldPosition(new T.Vector3());
      const knee=leg.lower.getWorldPosition(new T.Vector3());
      const ankle=leg.foot.getWorldPosition(new T.Vector3());
      const facing=leg.foot.getWorldQuaternion(new T.Quaternion()).slerp(step.orientation,amount);
      const target=ankle.clone();
      target.y=leg.ankleHeight+standingHeights[i];
      target.lerp(step.position,amount);
      const footHeading=facing.clone().multiply(leg.restFacing.clone().invert());
      target.y=Math.max(target.y,leg.ankleHeight+floorHeight(leg,target,footHeading));
      const axis=target.clone().sub(hip);
      const thigh=hip.distanceTo(knee),shin=knee.distanceTo(ankle);
      const reach=T.MathUtils.clamp(axis.length(),Math.abs(thigh-shin)+.001,thigh+shin-.001);
      axis.normalize();
      const along=(thigh*thigh-shin*shin+reach*reach)/(2*reach);
      // The knee points slightly outward and toward the same facing as the torso.
      const pole=new T.Vector3(leg.side==='L'?-.07:.07,0,-1).applyQuaternion(actor.quaternion);
      pole.addScaledVector(axis,-pole.dot(axis)).normalize();
      // Blend the bend direction too when leaving the standing pose.
      const initialPole=knee.clone().sub(hip);
      initialPole.addScaledVector(axis,-initialPole.dot(axis));
      if(kneeBlend<1 && initialPole.lengthSq()>1e-8) {
        pole.lerp(initialPole.normalize(),1-kneeBlend).normalize();
      }
      const bend=hip.clone().addScaledVector(axis,along)
        .addScaledVector(pole,Math.sqrt(Math.max(0,thigh*thigh-along*along)));
      alignBone(leg.upper,knee,bend);
      alignBone(leg.lower,leg.foot.getWorldPosition(new T.Vector3()),hip.clone().addScaledVector(axis,reach));
      leg.foot.quaternion.copy(leg.foot.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(facing));
    }
  }
  function dawnOverview() {
    reset();
    capturePose();
    placeActor(windowWatch,frontToWindow,Math.PI);
    request();
  }
  function poseDawnGrip(time) {
    armReset();
    if(!dawnLatch || !arm[2]) return;
    const envelope=([start,contact,release,end])=>
      eased((time-start)/(contact-start))*(1-eased((time-release)/(end-release)));
    const reachAmount=envelope([gripSpec.reach[0],gripSpec.reach[1],.538,.605]);
    if (reachAmount<=.001) return;
    const curlAmount=envelope([gripSpec.curl[0],gripSpec.curl[1],.536,.588]);
    const {frames}=gripSpec;
    const upper=frames.findIndex(key=>key.time>time);
    const later=upper<0 ? frames.at(-1) : frames[upper];
    const earlier=upper<0 ? later : frames[Math.max(0,upper-1)];
    const mix=earlier===later ? 0 : (time-earlier.time)/(later.time-earlier.time);
    const values=(field)=>earlier[field].map((a,i)=>T.MathUtils.lerp(a,later[field][i],mix));
    const latchFrame=dawnLatch.getWorldQuaternion(new T.Quaternion());
    const target=dawnLatch.localToWorld(new T.Vector3(...values('position')));
    const hand=arm[2];
    target.lerp(hand.getWorldPosition(new T.Vector3()),1-reachAmount);
    target.add(new T.Vector3(0,0,gripSpec.clearance*Math.sin(Math.PI*reachAmount)).applyQuaternion(latchFrame));
    reach(target,1,5);
    function turn(bone, axis, degrees) {
      if(!bone || !degrees) return;
      const parent=bone.parent.getWorldQuaternion(new T.Quaternion());
      const inParent=new T.Vector3(...axis).applyQuaternion(latchFrame).applyQuaternion(parent.invert());
      bone.quaternion.premultiply(new T.Quaternion().setFromAxisAngle(inParent,T.MathUtils.degToRad(degrees)*curlAmount));
    }
    const [roll,pitch]=values('wrist');
    const acrossPalm=[-1,0,0];
    turn(hand,[0,1,0],roll);
    turn(hand,acrossPalm,pitch);
    digits.forEach((chain,i)=>chain.forEach((bone,j)=>{
      if(bone&&fingerRest[i]?.[j]) bone.quaternion.copy(fingerRest[i][j]).slerp(knobFingerPose[i][j],curlAmount);
    }));
    fitWindowGrip(reachAmount);
    relaxOuterFingers(curlAmount);
  }
  function relaxOuterFingers(influence) {
    if(influence<=0||!digits.every(chain=>chain.every(Boolean))) return;
    const point=bone=>bone.getWorldPosition(new T.Vector3());
    const wrist=point(arm[2]);
    const across=point(digits[1][0]).sub(point(digits[4][0])).normalize();
    const palmNormal=across.clone().cross(point(digits[2][0]).sub(wrist)).normalize();
    if(palmNormal.dot(point(digits[0][2]).sub(wrist))<0) palmNormal.negate();
    const curls=[[10,22,14],[19,34,20],[24,40,26]];
    for(const [i,degrees] of curls.entries()) {
      const chain=digits[2+i];
      const direction=point(chain[2]).sub(point(chain[0])).normalize();
      const sign=across.clone().cross(direction).dot(palmNormal)<0?-1:1;
      chain.forEach((joint,j)=>{
        const parent=joint.parent.getWorldQuaternion(new T.Quaternion());
        const axis=across.clone().applyQuaternion(parent.invert());
        joint.quaternion.premultiply(new T.Quaternion().setFromAxisAngle(axis,sign*T.MathUtils.degToRad(degrees[j])*influence));
      });
    }
  }
  function fitWindowGrip(influence) {
    const [upper,lower,hand]=arm;
    if(!upper||!lower||!hand||!digits[0][2]||!digits[1][2]) return;
    const world=bone=>bone.getWorldPosition(new T.Vector3());
    const wrist=world(hand),shoulder=world(upper),elbow=world(lower);
    function palmFrame(origin,index,thumb) {
      const x=index.clone().sub(origin).normalize();
      const y=thumb.clone().sub(origin);
      y.addScaledVector(x,-y.dot(x)).normalize();
      return new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(x,y,x.clone().cross(y)));
    }
    const skinFrame=palmFrame(wrist,world(digits[1][2]),world(digits[0][2]));
    const inKnob=coords=>dawnLatch.localToWorld(new T.Vector3(...coords));
    // Calibrated in the actual knob's local metres using the right thumb pad,
    // index and palm against its opposite bevels and lower edge.
    const gripWrist=inKnob([-0.0529953,-0.0941658,-0.0005945]);
    const gripIndex=inKnob([0.0654795,-0.0503904,0.0345186]);
    const gripThumb=inKnob([0.0364052,-0.070097,-0.0068748]);
    const handFrame=hand.getWorldQuaternion(new T.Quaternion());
    const correction=palmFrame(gripWrist,gripIndex,gripThumb).multiply(skinFrame.invert());
    const wantedFrame=handFrame.clone().slerp(correction.multiply(handFrame),influence);
    const target=wrist.clone().lerp(gripWrist,influence);
    const axis=target.clone().sub(shoulder);
    const a=elbow.distanceTo(shoulder),b=wrist.distanceTo(elbow);
    const length=T.MathUtils.clamp(axis.length(),Math.abs(a-b)+.001,a+b-.001);
    axis.normalize();
    const along=(a*a-b*b+length*length)/(2*length);
    const pole=elbow.clone().sub(shoulder);
    pole.addScaledVector(axis,-pole.dot(axis)).normalize();
    const elbowTarget=shoulder.clone().addScaledVector(axis,along)
      .addScaledVector(pole,Math.sqrt(Math.max(0,a*a-along*along)));
    alignBone(upper,elbow,elbowTarget);
    alignBone(lower,world(hand),shoulder.clone().addScaledVector(axis,length));
    hand.quaternion.copy(hand.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(wantedFrame));
  }
  function dawnJourney(t) {
    if(t===0 || !basePose.length) {
      reset();
      capturePose();
    }
    const walking=clamped(t/.42);
    const progress=eased(walking);
    const path=walk(approach,progress);
    const unlocked=eased((t-.474)/.037);
    const opening=eased((t-.511)/.225);
    const sun=eased((opening-.12)/.88);
    const arrive=approach.at(-1);
    const heading=path.direction.normalize().lerp(frontToWindow,eased((walking-.83)/.17));
    placeActor(t<.42 ? path.position : arrive.clone().lerp(windowWatch,opening),heading,Math.PI);
    stride(Math.sin(path.total*progress*8.2)*Math.sin(Math.PI*walking));
    sunrise(sun,opening,unlocked);
    if(gripSpec) poseDawnGrip(t);
    else {
      const grip=eased((t-.420)/.060)*(1-eased((t-.519)/.062));
      armReset();
      if (dawnLatch && arm[2] && grip>.001) {
        const palm=dawnLatch.getWorldPosition(new T.Vector3()).add(new T.Vector3(.012,-.062,.040));
        const target=arm[2].getWorldPosition(new T.Vector3()).lerp(palm,grip);
        target.z+=.13*Math.sin(Math.PI*grip);
        reach(target,1,5);
      }
    }
    transitionCamera(dawnShot,eased((t-.095)/.305)*(1-eased((t-.74)/.26)));
    request();
  }
  function visit(key,t,returning=false) {
    const station=stations.get(key);
    if(!station) return;
    if ((!returning && t===0) || !basePose.length) {
      reset();
      capturePose();
    }
    const [x,y]=station.walk;
    const first= xyz([Math.sign(x)*1.31,-1.18,0]);
    const bend= xyz([y>0?(x<0?-2.68:2.68):x,-1.3,0]);
    const end=xyz([x,y,0]);
    const route=morningAmount>.999 ? [windowWatch,...approach.slice(1,-1).reverse(),first,bend,end]
      : [new T.Vector3(),first,bend,end];
    const stationFront=xyz(station.position).sub(end);
    stationFront.y=0;
    if(returning) route.reverse();
    const travel=clamped((t-.14)/.72);
    const distanceFraction=eased(travel);
    const {position,direction,total}=walk(route,distanceFraction);
    const radius=.12/Math.max(total,.001);
    const ahead=walk(route,clamped(distanceFraction+radius)).position;
    const behind=walk(route,clamped(distanceFraction-radius)).position;
    const heading=ahead.sub(behind);
    if(heading.lengthSq()<1e-10) heading.copy(direction);
    const angle=vector=>Math.atan2(vector.x,vector.z);
    const shortest=(from,to,u)=>from+Math.atan2(Math.sin(to-from),Math.cos(to-from))*u;
    const initial=returning?stationFront:frontToWindow;
    const final=returning?frontToWindow:stationFront;
    const pathAngle=angle(heading);
    const yaw=t<.14 ? shortest(angle(initial),angle(heading),eased(t/.14)) :
      shortest(angle(heading),angle(final),eased((t-.86)/.14));
    heading.set(Math.sin(yaw),0,Math.cos(yaw));
    // Turn in place before walking; the character's local forward axis is -Z.
    placeActor(position,heading,Math.PI);
    stride(Math.sin(total*distanceFraction*8.2)*Math.sin(Math.PI*travel),gaitLegs.every(leg=>leg.footRest));
    let turn;
    if(t<.14) turn={position,from:angle(initial),to:pathAngle,phase:clamped(t/.14)};
    if(t>.86) turn={position,from:pathAngle,to:angle(final),phase:clamped((t-.86)/.14)};
    plantFeet(route,total,total*distanceFraction,turn);
    transitionCamera(station.shot,eased(((returning?1-t:t)-.30)/.70));
    request();
  }
  function reset() {
    armReset();
    for(const leg of gaitLegs) if(leg.footRest) leg.foot.quaternion.copy(leg.footRest);
    actor.position.set(0,0,0);
    actor.rotation.set(0,0,0);
    bones.forEach((bone,i)=>{if(bone&&basePose[i]) bone.quaternion.copy(basePose[i]);});
    basePose.length=0;
    armRest=[];
    fingerRest=[];
  }
  function point(part,destination=false) {
    const item=steps.get(part);
    if(!item) return null;
    const position=destination&&item.target ? item.target.getWorldPosition(new T.Vector3()) : center(item.object);
    position.y+=.09;
    position.project(camera);
    if(position.z>1 || !Number.isFinite(position.x)) return null;
    return {x:(position.x+1)*viewport.clientWidth/2,y:(1-position.y)*viewport.clientHeight/2};
  }
  function stationAt(clientX,clientY) {
    const rect=viewport.getBoundingClientRect();
    const cursor=new T.Vector2(clientX-rect.left,clientY-rect.top);
    let nearest=80, found=null;
    for(const [key,position] of [...Array.from(stations,([id,station])=>[id,station.position]),
      ['Illusio',[.04,2.75,1.32]]]) {
      const p=xyz(position).project(camera);
      if(p.z>1 || Math.abs(p.x)>1 || Math.abs(p.y)>1) continue;
      const pixels=new T.Vector2((p.x+1)*rect.width/2,(1-p.y)*rect.height/2);
      const distance=pixels.distanceTo(cursor);
      if(distance<nearest) {nearest=distance;found=key;}
    }
    return found;
  }

  return {visit,reset,motion,progress,dawnJourney,dawnOverview,point,stationAt};
};
