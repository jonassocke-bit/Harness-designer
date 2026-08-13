function makeNode(data={}){
  const id=data.id||`N${nextNodeId++}`;
  const num=Number(id.replace(/\D/g,''));if(Number.isFinite(num))nextNodeId=Math.max(nextNodeId,num+1);
  const n={
    id,kind:'node',
    position:data.position?[...data.position]:[0,0,0],normal:data.normal?[...data.normal]:[0,0,1],
    ringVisible:data.ringVisible!==false,
    diameterMM:data.diameterMM??ringDefaults.diameterMM,thicknessMM:data.thicknessMM??ringDefaults.thicknessMM,sizeMM:data.sizeMM??globalAnchorSizeMM,
    locked:!!data.locked,mirrorId:data.mirrorId||null,
    source:data.source||'surface',parentStrapId:data.parentStrapId||null,t:data.t??.5,
    crossing:data.crossing?historyClone(data.crossing):null,autoCrossing:!!data.autoCrossing,
    splitMeta:data.splitMeta?historyClone(data.splitMeta):null,
    mergedState:data.mergedState?historyClone(data.mergedState):null,
    snapMergeState:data.snapMergeState?historyClone(data.snapMergeState):null,
    dynEditStamp:data.dynEditStamp||0,
    previousPartnerId:data.previousPartnerId||null,
    manualUnlinked:!!data.manualUnlinked,
    group:new THREE.Group(),visual:null,hit:null,wrapGroup:new THREE.Group()
  };
  n.group.userData={kind:'nodeGroup',id};
  n.group.add(n.wrapGroup);
  nodes.set(id,n);nodeRoot.add(n.group);
  rebuildNodeVisual(n);syncNodeTransform(n);
  return n;
}
function clearNodeVisual(n){
  for(const ch of [...n.group.children]){
    if(ch===n.wrapGroup)continue;
    ch.geometry?.dispose?.();n.group.remove(ch);
  }
  n.visual=null;n.hit=null;
}
let hitboxDebug=false;
const hitboxDebugRoot=new THREE.Group();helperRoot.add(hitboxDebugRoot);
function refreshHitboxDebug(){
  while(hitboxDebugRoot.children.length){const o=hitboxDebugRoot.children.pop();o.geometry?.dispose?.();o.material?.dispose?.()}
  hitboxDebugBtn.classList.toggle('active',hitboxDebug);if(!hitboxDebug)return;
  for(const n of nodes.values()){if(!n.ringVisible)continue;
    const tg=new THREE.TorusGeometry(ringMajor(n),Math.max(ringTube(n)*1.15,.004),8,30),eg=new THREE.EdgesGeometry(tg);tg.dispose();
    const l=new THREE.LineSegments(eg,new THREE.LineBasicMaterial({color:0x00d8ff,depthTest:false}));l.position.copy(n.group.position);l.quaternion.copy(n.group.quaternion);l.renderOrder=99;hitboxDebugRoot.add(l);
    const s=new THREE.Mesh(new THREE.SphereGeometry(genericRingSnapOut(n),12,8),new THREE.MeshBasicMaterial({color:0xffcc55,wireframe:true,transparent:true,opacity:.2,depthTest:false}));s.position.copy(nodeWorldPosition(n));s.renderOrder=98;hitboxDebugRoot.add(s);
  }
}
function rebuildNodeVisual(n){
  clearNodeVisual(n);
  let visual,hit;
  if(n.ringVisible){
    visual=new THREE.Mesh(new THREE.TorusGeometry(ringMajor(n),ringTube(n),12,40),selected?.id===n.id?METAL_SEL:METAL_MAT);
    hit=new THREE.Mesh(new THREE.TorusGeometry(ringMajor(n),Math.max(ringTube(n)*1.15,.004),10,36),new THREE.MeshBasicMaterial({transparent:true,opacity:.001}));
  }else{
    const r=Math.max(.008,n.sizeMM*.0037*.5);
    visual=new THREE.Mesh(new THREE.SphereGeometry(r,16,12),selected?.id===n.id?POINT_SEL:POINT_MAT);
    hit=new THREE.Mesh(new THREE.SphereGeometry(Math.max(r,.055),12,8),new THREE.MeshBasicMaterial({transparent:true,opacity:.001}));
  }
  visual.userData={kind:'nodeVisual',id:n.id};hit.userData={kind:'nodeHit',id:n.id};
  n.visual=visual;n.hit=hit;n.group.add(visual,hit);
}

function symmetryAxisNormal(normal){
  // A node snapped to x=0 must have an orientation that is itself mirror-symmetric.
  // Remove only the lateral X component. Y/Z still define front/back tilt along
  // the mannequin, so rings can follow chest/abdomen curvature without twisting
  // left/right due to tiny mesh asymmetries.
  const n=normal.clone();
  n.x=0;
  if(n.lengthSq()<1e-8)n.set(0,0,1);
  return n.normalize();
}
function nodeNormalForDisplay(n){
  const normal=nodeWorldNormal(n);
  const p=nodeWorldPosition(n);
  return Math.abs(p.x)<AXIS_SNAP_IN ? symmetryAxisNormal(normal) : normal;
}


// V1.6a paired objects use one canonical LEFT-side master.
// The right-side partner remains a real record for compatibility/undo/unlink,
// but its spatial state and rendered strap mesh are derived from the master.
function pairMasterNode(n){
  const p=pairOfNode(n);if(!p)return n;
  const nx=nodeWorldPosition(n).x,px=nodeWorldPosition(p).x;
  if(Math.abs(nx-px)<1e-7)return n.id<p.id?n:p;
  return nx<px?n:p;
}
function pairMasterStrap(s){
  const p=pairOfStrap(s);if(!p)return s;
  const avg=q=>{
    const a=nodes.get(q.a),b=nodes.get(q.b);
    return a&&b?(nodeWorldPosition(a).x+nodeWorldPosition(b).x)*.5:0;
  };
  const sx=avg(s),px=avg(p);
  if(Math.abs(sx-px)<1e-7)return s.id<p.id?s:p;
  return sx<px?s:p;
}
function forceMirrorNodeFromMaster(master,slave,{visualProps=false}={}){
  if(!master||!slave||master===slave)return;
  const p=mirrorWorldPointX(nodeWorldPosition(master));
  const n=mirrorWorldNormalX(nodeWorldNormal(master));
  setNodeWorldPosition(slave,p);
  slave.normal=n.toArray();
  if(visualProps){
    slave.ringVisible=master.ringVisible;
    slave.diameterMM=master.diameterMM;
    slave.thicknessMM=master.thicknessMM;
    slave.sizeMM=master.sizeMM;
    rebuildNodeVisual(slave);
  }
  syncNodeTransform(slave);
}
function mirrorStrapMeshFromMaster(master,slave){
  if(!master||!slave||master===slave)return;
  slave.widthMM=master.widthMM;
  slave.slack=master.slack;
  slave.surfaceLevel=master.surfaceLevel||0;

  // Keep materialized waypoint state ready for a future unlink, but do not
  // independently project it while the pair is linked.
  slave.controls=master.controls.map(c=>{
    const d={...c};
    if(c.surfacePos)d.surfacePos=[-c.surfacePos[0],c.surfacePos[1],c.surfacePos[2]];
    if(c.surfaceNormal)d.surfaceNormal=[-c.surfaceNormal[0],c.surfaceNormal[1],c.surfaceNormal[2]];
    d.offsetSide=-(c.offsetSide||0);
    return d;
  });

  const src=master.geometry.getAttribute('position');
  const dst=slave.geometry.getAttribute('position');
  if(src&&dst&&src.count===dst.count){
    for(let i=0;i<src.count;i++)dst.setXYZ(i,-src.getX(i),src.getY(i),src.getZ(i));
    dst.needsUpdate=true;
    slave.geometry.computeVertexNormals();
    slave.geometry.computeBoundingSphere();
  }

  for(const n of nodes.values()){
    if(n.source==='strap'&&n.parentStrapId===slave.id)syncNodeTransform(n);
    else if(n.source==='crossing'&&n.crossing&&(n.crossing.strapAId===slave.id||n.crossing.strapBId===slave.id))syncNodeTransform(n);
  }
  updateControlHandles(slave);
}
function enforcePairMasterVisuals(){
  const doneN=new Set();
  for(const n of nodes.values()){
    const p=pairOfNode(n);
    if(!p||doneN.has(n.id)||doneN.has(p.id))continue;
    const m=pairMasterNode(n),slave=m===n?p:n;
    forceMirrorNodeFromMaster(m,slave,{visualProps:true});
    doneN.add(m.id);doneN.add(slave.id);
  }
  const doneS=new Set();
  for(const s of straps.values()){
    const p=pairOfStrap(s);
    if(!p||doneS.has(s.id)||doneS.has(p.id))continue;
    const m=pairMasterStrap(s),slave=m===s?p:s;
    // Calculate only canonical side, mirror the rendered mesh to the other.
    updateStrapGeometry(m,{skipPairMirror:true});
    mirrorStrapMeshFromMaster(m,slave);
    doneS.add(m.id);doneS.add(slave.id);
  }
}

function syncNodeTransform(n){
  if(n.source==='strap'&&n.parentStrapId){
    const s=straps.get(n.parentStrapId);
    if(s){
      const p=strapPointAt(s,n.t);setNodeWorldPosition(n,p);
      const normal=strapNormalAt(s,n.t);n.normal=normal.toArray();
    }
  }else if(n.source==='crossing'&&n.crossing){
    const sa=straps.get(n.crossing.strapAId),sb=straps.get(n.crossing.strapBId);
    if(sa&&sb){
      const pa=strapPointAt(sa,n.crossing.tA),pb=strapPointAt(sb,n.crossing.tB);
      const p=pa.clone().lerp(pb,.5);setNodeWorldPosition(n,p);
      const normal=strapNormalAt(sa,n.crossing.tA).add(strapNormalAt(sb,n.crossing.tB));
      if(normal.lengthSq()<1e-8)normal.set(0,0,1);normal.normalize();n.normal=normal.toArray();
    }
  }
  const p=nodeWorldPosition(n),normal=nodeNormalForDisplay(n);

  // Persist the symmetry-safe normal while snapped to the center axis.
  // This also prevents pairing checks / connected strap frames from seeing a
  // slightly asymmetric normal caused by the underlying body mesh.
  if(Math.abs(p.x)<AXIS_SNAP_IN)n.normal=normal.toArray();

  const offset=n.ringVisible?ringTube(n):0;
  n.group.position.copy(p).addScaledVector(normal,surfaceOffsetScene()+offset);
  n.group.quaternion.setFromUnitVectors(UNIT_Z,normal);
}

function strapFrame(s){
  const A=nodeWorldPosition(nodes.get(s.a)),B=nodeWorldPosition(nodes.get(s.b));
  const tangent=B.clone().sub(A).normalize();
  let normal=nodeWorldNormal(nodes.get(s.a)).add(nodeWorldNormal(nodes.get(s.b)));
  if(normal.lengthSq()<1e-8)normal.set(0,0,1);normal.normalize();
  normal.addScaledVector(tangent,-normal.dot(tangent));
  if(normal.lengthSq()<1e-8)normal.set(0,0,1);
  normal.normalize();
  let side=new THREE.Vector3().crossVectors(normal,tangent);
  if(side.lengthSq()<1e-8)side.set(1,0,0);side.normalize();
  normal=new THREE.Vector3().crossVectors(tangent,side).normalize();
  return {A,B,tangent,normal,side,length:A.distanceTo(B)};
}
function autoControlWorld(s){
  const f=strapFrame(s),slack=THREE.MathUtils.clamp(s.slack/100,0,1);

  // V1.3: slack is relative to strap length.
  // Same slider value gives a similar curvature ratio on short and long straps.
  const relativeBulge=THREE.MathUtils.clamp(f.length*.28,.018,.24);
  const baseClearance=THREE.MathUtils.clamp(f.length*.018,.006,.022);

  return f.A.clone()
    .lerp(f.B,.5)
    .addScaledVector(f.normal,baseClearance + slack*relativeBulge);
}

function waypointFramePosition(s,c){
  const f=strapFrame(s);
  const base=f.A.clone().lerp(f.B,THREE.MathUtils.clamp(c.t??.5,0,1));
  return base
    .addScaledVector(f.tangent,c.offsetTangent||0)
    .addScaledVector(f.side,c.offsetSide||0)
    .addScaledVector(f.normal,c.offsetNormal||0);
}
function bindWaypointToFrame(s,c,worldPos,worldNormal){
  const f=strapFrame(s);
  const base=f.A.clone().lerp(f.B,THREE.MathUtils.clamp(c.t??.5,0,1));
  const d=worldPos.clone().sub(base);
  c.waypoint=true;
  c.surfacePos=worldPos.toArray();
  c.surfaceNormal=worldNormal.clone().normalize().toArray();
  c.offsetTangent=d.dot(f.tangent);
  c.offsetSide=d.dot(f.side);
  c.offsetNormal=d.dot(f.normal);
}
function waypointControlAt(s,t){
  t=THREE.MathUtils.clamp(t,.03,.97);

  // Use the current visible curve as the candidate. This means every new
  // waypoint refines the path that already exists instead of restarting from
  // the straight A->B chord.
  const candidate=effectiveStrapCurve(s).getPoint(t);
  let preferred=strapNormalAt(s,t);
  if(preferred.lengthSq()<1e-8)preferred=strapFrame(s).normal.clone();

  const hit=nearestBodySurfacePreferred(candidate,preferred)||
            nearestBodySurface(candidate);

  const point=hit?.point?.clone?.()||candidate.clone();
  const normal=hit?.normal?.clone?.()||preferred.clone().normalize();

  const c={t,waypoint:true};
  bindWaypointToFrame(s,c,point,normal);
  return c;
}
function nextWaypointT(s){
  const ts=[0,...s.controls.filter(c=>c.waypoint).map(c=>THREE.MathUtils.clamp(c.t,0,1)),1].sort((a,b)=>a-b);
  let bestT=.5,bestGap=-1;
  for(let i=0;i<ts.length-1;i++){
    const gap=ts[i+1]-ts[i];
    if(gap>bestGap){bestGap=gap;bestT=(ts[i]+ts[i+1])*.5}
  }
  return bestT;
}
function addSurfaceWaypoint(s,t=nextWaypointT(s)){
  if(!s)return null;
  // New UI uses waypoints, never recursive SurfaceLevel subdivision.
  s.surfaceLevel=0;
  const c=waypointControlAt(s,t);
  s.controls.push(c);
  updateStrapGeometry(s);
  return c;
}
function reprojectWaypoint(s,c){
  if(!c?.waypoint)return;
  const candidate=waypointFramePosition(s,c);
  const preferred=c.surfaceNormal
    ?new THREE.Vector3().fromArray(c.surfaceNormal).normalize()
    :strapFrame(s).normal.clone();

  const hit=nearestBodySurfacePreferred(candidate,preferred)||
            nearestBodySurface(candidate);
  if(!hit)return;

  bindWaypointToFrame(s,c,hit.point,hit.normal);
}
function reprojectStrapWaypoints(s){
  if(!s?.controls?.some(c=>c.waypoint))return;
  for(const c of s.controls)if(c.waypoint)reprojectWaypoint(s,c);
  updateStrapGeometry(s);
}
function mirrorWaypointsToPartner(src,dst){
  if(!src||!dst)return;
  const sw=src.controls.filter(c=>c.waypoint).slice().sort((a,b)=>a.t-b.t);
  const dw=dst.controls.filter(c=>c.waypoint).slice().sort((a,b)=>a.t-b.t);
  if(sw.length!==dw.length)return;

  for(let i=0;i<sw.length;i++){
    if(!sw[i].surfacePos||!sw[i].surfaceNormal)continue;
    const p=mirrorWorldPointX(new THREE.Vector3().fromArray(sw[i].surfacePos));
    const n=mirrorWorldNormalX(new THREE.Vector3().fromArray(sw[i].surfaceNormal));
    dw[i].t=sw[i].t;
    bindWaypointToFrame(dst,dw[i],p,n);
  }
  updateStrapGeometry(dst);
}

function captureEndpointWaypointDragState(nodeId){
  const state=[];
  for(const s of straps.values()){
    if(s.a!==nodeId&&s.b!==nodeId)continue;
    const wp=s.controls.filter(c=>c.waypoint);
    if(!wp.length)continue;

    const a=nodes.get(s.a),b=nodes.get(s.b);
    if(!a||!b)continue;

    state.push({
      strapId:s.id,
      startA:nodeWorldPosition(a).toArray(),
      startB:nodeWorldPosition(b).toArray(),
      points:wp.map(c=>({
        ref:c,
        t:THREE.MathUtils.clamp(c.t??.5,0,1),
        surfacePos:c.surfacePos?[...c.surfacePos]:waypointFramePosition(s,c).toArray(),
        surfaceNormal:c.surfaceNormal?[...c.surfaceNormal]:strapFrame(s).normal.toArray()
      }))
    });
  }
  return state;
}

function updateEndpointWaypointDragState(state){
  if(!state?.length)return;

  for(const d of state){
    const s=straps.get(d.strapId);
    if(!s)continue;
    const a=nodes.get(s.a),b=nodes.get(s.b);
    if(!a||!b)continue;

    const oldA=new THREE.Vector3().fromArray(d.startA);
    const oldB=new THREE.Vector3().fromArray(d.startB);
    const newA=nodeWorldPosition(a),newB=nodeWorldPosition(b);
    const deltaA=newA.clone().sub(oldA);
    const deltaB=newB.clone().sub(oldB);

    for(const p of d.points){
      if(!s.controls.includes(p.ref))continue;

      // Deform the old user-defined route with the moved endpoints:
      // a waypoint near A follows mostly A; near B mostly B.
      // No raycast is performed while dragging.
      const translated=new THREE.Vector3().fromArray(p.surfacePos)
        .addScaledVector(deltaA,1-p.t)
        .addScaledVector(deltaB,p.t);

      const normal=new THREE.Vector3().fromArray(p.surfaceNormal).normalize();
      bindWaypointToFrame(s,p.ref,translated,normal);
    }

    updateStrapGeometry(s);
  }
}

function finalizeEndpointWaypointDragState(state){
  if(!state?.length)return;
  const handled=new Set();

  for(const d of state){
    const s=straps.get(d.strapId);
    if(!s||handled.has(s.id))continue;

    const ps=pairOfStrap(s);
    const master=ps?pairMasterStrap(s):s;
    const mate=ps?(master===s?ps:s):null;

    // V1.6a's original reprojection is intentionally retained:
    // project the translated route itself, NOT a straight A-B chord.
    reprojectStrapWaypoints(master);
    if(mate)mirrorWaypointsToPartner(master,mate);

    handled.add(master.id);
    if(mate)handled.add(mate.id);
  }
}

function reprojectAttachedWaypoints(nodeId){
  const touched=new Set();
  for(const s of straps.values()){
    if(touched.has(s.id))continue;
    if((s.a===nodeId||s.b===nodeId)&&s.controls.some(c=>c.waypoint)){
      const ps=pairOfStrap(s);
      const master=ps && s.id>ps.id ? ps : s;
      const mate=ps ? (master===s?ps:s) : null;
      if(!touched.has(master.id)){
        reprojectStrapWaypoints(master);
        if(mate)mirrorWaypointsToPartner(master,mate);
        touched.add(master.id);
        if(mate)touched.add(mate.id);
      }
    }
  }
  return touched;
}
function reprojectAllWaypoints(){
  const handled=new Set();
  for(const s of straps.values()){
    if(handled.has(s.id)||!s.controls.some(c=>c.waypoint))continue;
    const ps=pairOfStrap(s);
    const master=ps && s.id>ps.id ? ps : s;
    const mate=ps ? (master===s?ps:s) : null;
    reprojectStrapWaypoints(master);
    if(mate)mirrorWaypointsToPartner(master,mate);
    handled.add(master.id);
    if(mate)handled.add(mate.id);
  }
}
function waypointPatternMatches(a,b){
  const ac=a.controls.filter(c=>c.waypoint),bc=b.controls.filter(c=>c.waypoint);
  if(ac.length!==bc.length)return false;
  for(let i=0;i<ac.length;i++){
    if(Math.abs((ac[i].t??0)-(bc[i].t??0))>.002)return false;
  }
  return true;
}
function syncWaypointPattern(src,dst){
  const srcWp=src.controls.filter(c=>c.waypoint).slice().sort((a,b)=>a.t-b.t);
  if(!srcWp.length)return false;
  if(waypointPatternMatches(src,dst))return true;

  dst.surfaceLevel=0;
  dst.controls=[];
  for(const c of srcWp)dst.controls.push(waypointControlAt(dst,c.t));
  return true;
}

function manualControlWorld(s,c){
  const f=strapFrame(s);
  const slack=THREE.MathUtils.clamp(s.slack/100,0,1);
  const relativeBulge=THREE.MathUtils.clamp(f.length*.28,.018,.24);
  const baseClearance=THREE.MathUtils.clamp(f.length*.018,.006,.022);
  const clearance=baseClearance+slack*relativeBulge;

  // V1.5c: real surface waypoint.
  // During endpoint drag this is pure vector math: no raycast, no recursive
  // subdivision, no body-surface search. The expensive projection happens once
  // on pointer-up.
  if(c.waypoint){
    const p=waypointFramePosition(s,c);
    const n=c.surfaceNormal?new THREE.Vector3().fromArray(c.surfaceNormal).normalize():f.normal;

    // V1.6d: waypoint straps still obey Lockerheit.
    // At 0 they hug the chosen surface route. Increasing Lockerheit lifts
    // the middle of the route progressively, while endpoint-near controls
    // move less so the ring connections remain natural.
    const t=THREE.MathUtils.clamp(c.t??.5,0,1);
    const centerWeight=Math.sin(Math.PI*t);
    const waypointBulge=slack*THREE.MathUtils.clamp(f.length*.34,.025,.32)*centerWeight;
    return p.addScaledVector(n,surfaceOffsetScene()+baseClearance+waypointBulge);
  }

  // Legacy explicit surface controls from old saved projects.
  if(c.surfacePos){
    const p=new THREE.Vector3().fromArray(c.surfacePos);
    const n=c.surfaceNormal?new THREE.Vector3().fromArray(c.surfaceNormal).normalize():f.normal;
    return p.addScaledVector(n,surfaceOffsetScene()+clearance);
  }

  // Legacy control compatibility for older saved projects.
  const sideScale=THREE.MathUtils.clamp(f.length,.12,1.2);
  return f.A.clone().lerp(f.B,c.t)
    .addScaledVector(f.side,(c.sideFactor??0)*sideScale)
    .addScaledVector(f.normal,clearance+(c.normalFactor??0)*relativeBulge);
}

function waypointRouteNormalAt(s,t){
  const guides=[
    {t:0,normal:nodeWorldNormal(nodes.get(s.a))},
    ...s.controls
      .filter(c=>c.waypoint&&c.surfaceNormal)
      .map(c=>({t:THREE.MathUtils.clamp(c.t??.5,0,1),normal:new THREE.Vector3().fromArray(c.surfaceNormal).normalize()}))
      .sort((a,b)=>a.t-b.t),
    {t:1,normal:nodeWorldNormal(nodes.get(s.b))}
  ];

  if(guides.length<2)return strapFrame(s).normal.clone();

  let hi=1;
  while(hi<guides.length&&guides[hi].t<t)hi++;
  hi=Math.min(hi,guides.length-1);
  const lo=Math.max(0,hi-1);
  const a=guides[lo],b=guides[hi];
  const u=b.t>a.t?THREE.MathUtils.clamp((t-a.t)/(b.t-a.t),0,1):0;

  let n=a.normal.clone().lerp(b.normal,u);
  if(n.lengthSq()<1e-8)n=a.normal.clone();
  return n.normalize();
}
function strapCurve(s){
  const A=nodeWorldPosition(nodes.get(s.a)),B=nodeWorldPosition(nodes.get(s.b));
  if(!s.controls.length){
    return new THREE.QuadraticBezierCurve3(A,autoControlWorld(s),B);
  }
  const pts=[A,...s.controls.slice().sort((a,b)=>a.t-b.t).map(c=>manualControlWorld(s,c)),B];
  return new THREE.CatmullRomCurve3(pts,false,'centripetal',.45);
}
function effectiveStrapCurve(s){
  if((s.surfaceLevel||0)>0){
    const data=surfaceCurveData(s);
    if(data)return data.curve;
  }
  return strapCurve(s);
}
function strapPointAt(s,t){return effectiveStrapCurve(s).getPoint(THREE.MathUtils.clamp(t,0,1))}
function strapNormalAt(s,t){
  const tt=THREE.MathUtils.clamp(t,0,1);

  if((s.surfaceLevel||0)>0){
    const data=surfaceCurveData(s);
    if(data){
      const tan=data.curve.getTangent(tt).normalize();
      let n=surfaceNormalAtData(data,tt);
      n.addScaledVector(tan,-n.dot(tan));
      if(n.lengthSq()>1e-8)return n.normalize();
    }
  }

  const f=strapFrame(s),tan=strapCurve(s).getTangent(tt).normalize();
  let n=f.normal.clone().addScaledVector(tan,-f.normal.dot(tan));
  if(n.lengthSq()<1e-8)n=f.normal.clone();
  return n.normalize();
}
function visibleEndpoint(node,targetPoint){
  const center=nodeWorldPosition(node);
  if(!node.ringVisible)return center;
  const n=nodeWorldNormal(node);
  let d=targetPoint.clone().sub(center);
  d.addScaledVector(n,-d.dot(n));
  if(d.lengthSq()<1e-8)return center;
  return center.add(d.normalize().multiplyScalar(ringMajor(node)));
}



