function initStrapGeometry(){
  const positions=new Float32Array((STRAP_SAMPLES+1)*4*3);
  const indices=[];
  for(let i=0;i<STRAP_SAMPLES;i++){
    const a=i*4,b=(i+1)*4;
    indices.push(a,a+1,b,a+1,b+1,b,a+2,b+2,a+3,a+3,b+2,b+3,a+2,a,b+2,a,b,b+2,a+1,a+3,b+1,a+3,b+3,b+1);
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.BufferAttribute(positions,3));
  g.setIndex(indices);
  return g;
}
function makeStrap(data={}){
  const id=data.id||`S${nextStrapId++}`;
  const num=Number(id.replace(/\D/g,''));if(Number.isFinite(num))nextStrapId=Math.max(nextStrapId,num+1);
  const s={
    id,kind:'strap',a:data.a,b:data.b,widthMM:data.widthMM??strapDefaults.widthMM,slack:data.slack??strapDefaults.slack,
    locked:!!data.locked,mirrorId:data.mirrorId||null,
    controls:historyClone(data.controls||[]),
    surfaceLevel:data.surfaceLevel??0,
    dynEditStamp:data.dynEditStamp||0,
    previousPartnerId:data.previousPartnerId||null,
    manualUnlinked:!!data.manualUnlinked,
    autoProject:true,
    autoMethod:'strip',
    debugRoute:!!data.debugRoute,
    debugStep:Number.isFinite(data.debugStep)?data.debugStep:0,
    debugAll:!!data.debugAll,
    debugTrace:null,
    deletedStripTs:historyClone(data.deletedStripTs||[]),
    methodRoute:null,
    previewMode:false,
    group:new THREE.Group(),mesh:null,geometry:initStrapGeometry(),
    controlGroup:new THREE.Group()
  };
  s.mesh=new THREE.Mesh(s.geometry,selected?.id===id?STRAP_SEL:STRAP_MAT);
  s.mesh.userData={kind:'strapMesh',id};s.mesh.renderOrder=5;s.group.add(s.mesh,s.controlGroup);
  straps.set(id,s);strapRoot.add(s.group);
  updateStrapGeometry(s);updateControlHandles(s);

  if(s.autoProject&&bodyMeshes.length){
    rebuildAutoProjection(s);
    updateControlHandles(s);
  }

  return s;
}
function stripRouteAt(route,t){
  if(t<=route[0].t)return route[0];if(t>=route[route.length-1].t)return route[route.length-1];
  let hi=1;while(hi<route.length&&route[hi].t<t)hi++;const a=route[hi-1],b=route[hi],u=(t-a.t)/Math.max(1e-8,b.t-a.t);
  let n=a.normal.clone().lerp(b.normal,u);if(n.lengthSq()<1e-8)n=a.normal.clone();n.normalize();
  return {stripLeft:a.stripLeft.clone().lerp(b.stripLeft,u),stripRight:a.stripRight.clone().lerp(b.stripRight,u),normal:n};
}
function stripQuadScore(a,b,c,d,diag=0){
  const triN=(p0,p1,p2)=>{
    const n=new THREE.Vector3().crossVectors(p1.clone().sub(p0),p2.clone().sub(p0));
    return n.lengthSq()<1e-12?new THREE.Vector3(0,0,1):n.normalize();
  };
  if(diag===0){
    const n1=triN(a,b,c),n2=triN(b,d,c);
    return n1.dot(n2);
  }
  const n1=triN(a,b,d),n2=triN(a,d,c);
  return n1.dot(n2);
}
function setAdaptiveStripIndices(s,sections){
  const idx=[];
  for(let i=0;i<STRAP_SAMPLES;i++){
    const a=i*4,b=(i+1)*4;
    const s0=sections[i],s1=sections[i+1];
    const useAlt=stripQuadScore(s0.lb,s0.rb,s1.lb,s1.rb,1)>stripQuadScore(s0.lb,s0.rb,s1.lb,s1.rb,0);

    // bottom
    if(useAlt)idx.push(a,a+1,b+1, a,b+1,b);
    else idx.push(a,a+1,b, a+1,b+1,b);

    // top, opposite winding
    if(useAlt)idx.push(a+2,b+3,a+3, a+2,b+2,b+3);
    else idx.push(a+2,b+2,a+3, a+3,b+2,b+3);

    // left + right thickness walls
    idx.push(a+2,a,b+2, a,b,b+2);
    idx.push(a+1,a+3,b+1, a+3,b+3,b+1);
  }
  s.geometry.setIndex(idx);
}
function updateDirectStripGeometry(s){
  if(!s.methodRoute?.length)return false;
  const pos=s.geometry.getAttribute('position'),halfT=.0045;
  const sections=[];

  for(let i=0;i<=STRAP_SAMPLES;i++){
    const t=i/STRAP_SAMPLES;
    const g=stripRouteAt(s.methodRoute,t);
    const prev=stripRouteAt(s.methodRoute,Math.max(0,t-1/STRAP_SAMPLES));
    const next=stripRouteAt(s.methodRoute,Math.min(1,t+1/STRAP_SAMPLES));

    const lb=g.stripLeft.clone(),rb=g.stripRight.clone();
    let side=rb.clone().sub(lb);
    if(side.lengthSq()<1e-10)side=strapFrame(s).side.clone();
    side.normalize();

    let tangent=next.stripLeft.clone().lerp(next.stripRight,.5).sub(
      prev.stripLeft.clone().lerp(prev.stripRight,.5)
    );
    if(tangent.lengthSq()<1e-10)tangent=strapFrame(s).tangent.clone();
    tangent.normalize();

    // Edge geometry defines the band orientation. Body normal is only a hemisphere hint.
    let normal=new THREE.Vector3().crossVectors(tangent,side);
    if(normal.lengthSq()<1e-10)normal=g.normal?.clone?.()||strapFrame(s).normal.clone();
    normal.normalize();
    if(g.normal&&normal.dot(g.normal)<0)normal.negate();

    const lt=lb.clone().addScaledVector(normal,halfT*2);
    const rt=rb.clone().addScaledVector(normal,halfT*2);
    const verts=[lb,rb,lt,rt];
    for(let k=0;k<4;k++)pos.setXYZ(i*4+k,verts[k].x,verts[k].y,verts[k].z);
    sections.push({lb,rb,lt,rt});
  }

  setAdaptiveStripIndices(s,sections);
  pos.needsUpdate=true;
  s.geometry.computeVertexNormals();
  s.geometry.computeBoundingSphere();
  return true;
}
function updateStrapGeometry(s,{skipPairMirror=false}={}){
  if(!skipPairMirror){
    const ps=pairOfStrap(s);
    if(ps){
      const master=pairMasterStrap(s);
      if(master!==s){
        // Linked mirror side never solves its own curve.
        mirrorStrapMeshFromMaster(master,s);
        return;
      }
    }
  }
  const aNode=nodes.get(s.a),bNode=nodes.get(s.b);if(!aNode||!bNode)return;

  if(!s.previewMode&&s.autoMethod==='strip'&&s.methodRoute?.length){
    if(updateDirectStripGeometry(s)){updateStrapMethodDebug(s,s.methodRoute);return}
  }

  const surfaceMode=(s.surfaceLevel||0)>0;
  let renderCurve=null;
  let surfaceData=null;

  if(!surfaceMode){
    // IMPORTANT: untouched fast V1.4h standard path.
    const curve=strapCurve(s);
    const firstGuide=curve.getPoint(1/STRAP_SAMPLES),lastGuide=curve.getPoint(1-1/STRAP_SAMPLES);
    const a=visibleEndpoint(aNode,firstGuide),b=visibleEndpoint(bNode,lastGuide);

    if(!s.controls.length){
      const ctrl=autoControlWorld(s);
      renderCurve=new THREE.QuadraticBezierCurve3(a,ctrl,b);
    }else{
      // V1.5c waypoint path: A -> P1 -> P2 -> B.
      // This remains the cheap standard geometry path; controls are evaluated
      // with vector math only while dragging.
      const pts=[a,...s.controls.slice().sort((x,y)=>x.t-y.t).map(c=>manualControlWorld(s,c)),b];
      renderCurve=new THREE.CatmullRomCurve3(pts,false,'centripetal',.45);
    }
  }else{
    surfaceData=surfaceCurveData(s);
    if(!surfaceData){
      // Fail-safe fallback to the known-good standard geometry.
      const curve=strapCurve(s);
      const a=visibleEndpoint(aNode,curve.getPoint(1/STRAP_SAMPLES));
      const b=visibleEndpoint(bNode,curve.getPoint(1-1/STRAP_SAMPLES));
      renderCurve=new THREE.QuadraticBezierCurve3(a,autoControlWorld(s),b);
      surfaceData=null;
    }else{
      renderCurve=surfaceData.curve;
    }
  }

  const pos=s.geometry.getAttribute('position');
  const halfW=Math.max(.0003,s.widthMM*.0037*.5);
  const halfT=.0045;
  let prevSide=null,prevNormal=null;

  for(let i=0;i<=STRAP_SAMPLES;i++){
    const t=i/STRAP_SAMPLES,p=renderCurve.getPoint(t);
    const tan=renderCurve.getTangent(t).normalize();

    let normal;
    if(surfaceData){
      // Body normal controls the flat face in surface mode.
      normal=surfaceNormalAtData(surfaceData,t);
      normal.addScaledVector(tan,-normal.dot(tan));

      if(normal.lengthSq()<1e-8){
        normal=prevNormal?prevNormal.clone():strapFrame(s).normal.clone();
        normal.addScaledVector(tan,-normal.dot(tan));
      }
      normal.normalize();
    }else{
      const hasWaypointNormals=s.controls?.some(c=>c.waypoint&&c.surfaceNormal);

      if(hasWaypointNormals){
        // Auto/manual surface waypoints carry the mannequin normal. Use it to
        // orient the visible ribbon, otherwise a correct path can appear 90°
        // rotated around its tangent.
        normal=waypointRouteNormalAt(s,t);
        normal.addScaledVector(tan,-normal.dot(tan));

        if(normal.lengthSq()<1e-8){
          normal=prevNormal?prevNormal.clone():strapFrame(s).normal.clone();
          normal.addScaledVector(tan,-normal.dot(tan));
        }
        normal.normalize();

        // Parallel transport / hemisphere continuity.
        if(prevNormal&&normal.dot(prevNormal)<0)normal.negate();
      }else{
        // Exact old orientation behavior for ordinary straps.
        normal=prevNormal?prevNormal.clone():strapFrame(s).normal.clone();
        normal.addScaledVector(tan,-normal.dot(tan));
        if(normal.lengthSq()<1e-8)normal=strapFrame(s).normal.clone();
        normal.normalize();
      }
    }

    let side=new THREE.Vector3().crossVectors(normal,tan);
    if(side.lengthSq()<1e-8)side=prevSide?prevSide.clone():new THREE.Vector3(1,0,0);
    side.normalize();

    // Parallel-transport style continuity: never allow a sudden 180° frame flip.
    if(prevSide&&side.dot(prevSide)<0){
      side.negate();
      normal.negate();
    }

    normal=new THREE.Vector3().crossVectors(tan,side).normalize();

    // Extra surface-mode safeguard: keep the chosen normal on the same hemisphere
    // as the mannequin normal unless that would flip the previous frame.
    if(surfaceData){
      const bodyN=surfaceNormalAtData(surfaceData,t);
      if(normal.dot(bodyN)<0){
        normal.negate();
        side.negate();
      }
      if(prevSide&&side.dot(prevSide)<0){
        side.negate();
        normal.negate();
      }
    }

    prevSide=side.clone();
    prevNormal=normal.clone();

    const l=p.clone().addScaledVector(side,-halfW),r=p.clone().addScaledVector(side,halfW);
    const verts=[
      l.clone().addScaledVector(normal,halfT),r.clone().addScaledVector(normal,halfT),
      l.clone().addScaledVector(normal,-halfT),r.clone().addScaledVector(normal,-halfT)
    ];
    for(let k=0;k<4;k++)pos.setXYZ(i*4+k,verts[k].x,verts[k].y,verts[k].z);
  }

  pos.needsUpdate=true;
  s.geometry.computeVertexNormals();
  s.geometry.computeBoundingSphere();

  // Dynamic nodes still update only for this strap.
  for(const n of nodes.values()){
    if(n.source==='strap'&&n.parentStrapId===s.id)syncNodeTransform(n);
    else if(n.source==='crossing'&&n.crossing&&(n.crossing.strapAId===s.id||n.crossing.strapBId===s.id))syncNodeTransform(n);
  }
  updateControlHandles(s);

  if(!skipPairMirror){
    const ps=pairOfStrap(s);
    if(ps&&pairMasterStrap(s)===s)mirrorStrapMeshFromMaster(s,ps);
  }
}
function updateAttachedStraps(nodeId){
  for(const s of straps.values())if(s.a===nodeId||s.b===nodeId){s.previewMode=true;updateStrapGeometry(s)}
}
function updateControlHandles(s){
  // V1.1: generated curve points are internal only.
  s.controlGroup.clear();
}
function rebuildWrapsForNode(n){
  n.wrapGroup.clear();
  if(!n.ringVisible)return;
  for(const s of straps.values()){
    if(s.a!==n.id&&s.b!==n.id)continue;
    const other=nodes.get(s.a===n.id?s.b:s.a);if(!other)continue;
    const center=nodeWorldPosition(n),normal=nodeWorldNormal(n);
    let d=nodeWorldPosition(other).sub(center);d.addScaledVector(normal,-d.dot(normal));
    if(d.lengthSq()<1e-8)continue;d.normalize();
    const q=n.group.quaternion.clone().invert();
    const local=d.applyQuaternion(q),angle=Math.atan2(local.y,local.x);
    const arc=THREE.MathUtils.clamp((s.widthMM*.0037)/Math.max(ringMajor(n),.01),.15,1.15);
    const w=new THREE.Mesh(new THREE.TorusGeometry(ringMajor(n),ringTube(n)*1.06,10,18,arc),WRAP_MAT);
    w.rotation.z=angle-arc/2;w.position.z=.0007;n.wrapGroup.add(w);
  }
}
function rebuildAllWraps(){for(const n of nodes.values())rebuildWrapsForNode(n)}


function strapSnapshot(s){
  return {id:s.id,a:s.a,b:s.b,widthMM:s.widthMM,slack:s.slack,locked:s.locked,mirrorId:s.mirrorId||null,controls:s.controls.map(c=>({...c})),surfaceLevel:s.surfaceLevel||0,previousPartnerId:s.previousPartnerId||null,manualUnlinked:!!s.manualUnlinked};
}
function removeStrapBare(id){
  const s=straps.get(id);if(!s)return;
  s.geometry.dispose();strapRoot.remove(s.group);straps.delete(id);
}
function restoreStrapSnapshot(d){
  if(!d||!nodes.has(d.a)||!nodes.has(d.b)||d.a===d.b)return null;
  const s=makeStrap({id:d.id,a:d.a,b:d.b,widthMM:d.widthMM,slack:d.slack,locked:d.locked,mirrorId:d.mirrorId,controls:d.controls,surfaceLevel:d.surfaceLevel||0,previousPartnerId:d.previousPartnerId||null,manualUnlinked:!!d.manualUnlinked});
  return s;
}

function remapTForSplit(t,splitT,leftSide){
  if(leftSide)return splitT<=1e-6?0:THREE.MathUtils.clamp(t/splitT,0,1);
  return (1-splitT)<=1e-6?1:THREE.MathUtils.clamp((t-splitT)/(1-splitT),0,1);
}

function migrateDynamicNodesAfterSplit(originalId,splitNode,splitT,left,right){
  const EPS=.018;

  for(const dn of [...nodes.values()]){
    if(dn.id===splitNode.id)continue;

    // Ordinary dynamic anchors on the old through-strap.
    if(dn.source==='strap'&&dn.parentStrapId===originalId){
      // There must never be a second anchor at the exact split position.
      if(Math.abs(dn.t-splitT)<EPS){
        removeNode(dn.id,false);
        continue;
      }

      if(dn.t<splitT){
        dn.parentStrapId=left.id;
        dn.t=remapTForSplit(dn.t,splitT,true);
      }else{
        dn.parentStrapId=right.id;
        dn.t=remapTForSplit(dn.t,splitT,false);
      }
      syncNodeTransform(dn);
      continue;
    }

    // Auto crossings on a strap that is being replaced are intentionally
    // discarded. A post-structure refresh will recreate only valid crossings.
    if(dn.source==='crossing'&&dn.crossing&&
       (dn.crossing.strapAId===originalId||dn.crossing.strapBId===originalId)){
      if(dn.autoCrossing){
        removeNode(dn.id,false);
        continue;
      }

      // A non-auto crossing point is a user-owned node: remap the affected leg.
      if(dn.crossing.strapAId===originalId){
        const oldT=dn.crossing.tA;
        if(oldT<splitT){
          dn.crossing.strapAId=left.id;
          dn.crossing.tA=remapTForSplit(oldT,splitT,true);
        }else{
          dn.crossing.strapAId=right.id;
          dn.crossing.tA=remapTForSplit(oldT,splitT,false);
        }
      }
      if(dn.crossing.strapBId===originalId){
        const oldT=dn.crossing.tB;
        if(oldT<splitT){
          dn.crossing.strapBId=left.id;
          dn.crossing.tB=remapTForSplit(oldT,splitT,true);
        }else{
          dn.crossing.strapBId=right.id;
          dn.crossing.tB=remapTForSplit(oldT,splitT,false);
        }
      }
      if(dn.crossing){
        const sa=straps.get(dn.crossing.strapAId),sb=straps.get(dn.crossing.strapBId);
        if(sa&&sb)dn.crossing.key=crossingKey(sa,sb);
      }
      syncNodeTransform(dn);
    }
  }
}

function nodeMirrorEquivalent(idA,idB){
  if(idA===idB)return true;
  const a=nodes.get(idA),b=nodes.get(idB);
  if(!a||!b)return false;
  return a.mirrorId===b.id||b.mirrorId===a.id;
}

function strapsAreMirrorEquivalent(a,b){
  if(!a||!b)return false;
  return (
    nodeMirrorEquivalent(a.a,b.a)&&nodeMirrorEquivalent(a.b,b.b)
  )||(
    nodeMirrorEquivalent(a.a,b.b)&&nodeMirrorEquivalent(a.b,b.a)
  );
}

function pairSplitChildren(partA,partB){
  if(!partA||!partB)return;
  const A=(partA.children||[]).map(id=>straps.get(id)).filter(Boolean);
  const B=(partB.children||[]).map(id=>straps.get(id)).filter(Boolean);

  const used=new Set();
  for(const sa of A){
    const sb=B.find(x=>!used.has(x.id)&&strapsAreMirrorEquivalent(sa,x));
    if(!sb)continue;

    sa.mirrorId=sb.id;
    sb.mirrorId=sa.id;

    // A freshly split mirrored pair starts with exactly matching properties.
    // sideFactor is mirrored by copyStrapProps.
    copyStrapProps(sa,sb);
    used.add(sb.id);
  }
}

function repairSplitPairingForNodes(a,b){
  if(!a||!b)return;
  if(a.splitMeta?.kind==='single'&&b.splitMeta?.kind==='single'){
    pairSplitChildren(a.splitMeta.part,b.splitMeta.part);
  }
}

function sampleRouteForSplit(s,splitT){
  const curve=effectiveStrapCurve(s);
  const out={left:[],right:[]};

  function sample(parentT,leftSide){
    const localT=remapTForSplit(parentT,splitT,leftSide);
    if(localT<=.015||localT>=.985)return;

    const point=curve.getPoint(parentT);
    let normal;
    try{normal=strapNormalAt(s,parentT)}
    catch{normal=strapFrame(s).normal.clone()}
    if(normal.lengthSq()<1e-8)normal=strapFrame(s).normal.clone();
    normal.normalize();

    const c={
      t:localT,
      waypoint:true,
      inheritedRoute:true,
      surfacePos:point.toArray(),
      surfaceNormal:normal.toArray()
    };
    (leftSide?out.left:out.right).push(c);
  }

  // Three internal samples per child are enough to preserve the visible
  // 18-segment parent route very closely without adding expensive live logic.
  if(splitT>.04){
    sample(splitT*.25,true);
    sample(splitT*.50,true);
    sample(splitT*.75,true);
  }
  if(splitT<.96){
    sample(splitT+(1-splitT)*.25,false);
    sample(splitT+(1-splitT)*.50,false);
    sample(splitT+(1-splitT)*.75,false);
  }

  return out;
}
function bindInheritedSplitControls(child,controls){
  child.controls=[];
  for(const src of controls){
    const c={...src};
    const p=new THREE.Vector3().fromArray(src.surfacePos);
    const n=new THREE.Vector3().fromArray(src.surfaceNormal).normalize();
    bindWaypointToFrame(child,c,p,n);
    c.inheritedRoute=true;
    child.controls.push(c);
  }
  child.controls.sort((a,b)=>a.t-b.t);
}

function splitOneStrapAtNode(s,n,t){
  if(!s||!n)return null;

  // Snapshot the actual visible route BEFORE deleting the parent strap.
  // Child straps inherit this route rather than starting from scratch.
  const preserved=sampleRouteForSplit(s,t);
  const original=strapSnapshot(s);
  const a=s.a,b=s.b;
  const originalId=s.id;

  removeStrapBare(originalId);

  const left=makeStrap({
    a,b:n.id,
    widthMM:original.widthMM,
    slack:original.slack,
    controls:[],
    surfaceLevel:0
  });
  const right=makeStrap({
    a:n.id,b,
    widthMM:original.widthMM,
    slack:original.slack,
    controls:[],
    surfaceLevel:0
  });

  // Reconstruct both child routes from the exact parent curve samples.
  bindInheritedSplitControls(left,preserved.left);
  bindInheritedSplitControls(right,preserved.right);
  updateStrapGeometry(left);
  updateStrapGeometry(right);

  // Move every surviving dynamic point away from the deleted parent strap.
  migrateDynamicNodesAfterSplit(originalId,n,t,left,right);

  rebuildWrapsForNode(n);
  rebuildWrapsForNode(nodes.get(a));
  rebuildWrapsForNode(nodes.get(b));

  return {original,children:[left.id,right.id],t};
}
function restoreSplitPart(part,n){
  if(!part)return;
  for(const id of part.children||[])if(straps.has(id))removeStrapBare(id);
  restoreStrapSnapshot(part.original);
}
function convertDynamicPointToRing(n){
  if(!n||n.ringVisible)return;

  // Ring geometry/state must exist BEFORE child straps are generated,
  // otherwise the first render still treats the node as a point.
  n.ringVisible=true;
  rebuildNodeVisual(n);
  syncNodeTransform(n);

  if(n.source==='strap'&&n.parentStrapId){
    const s=straps.get(n.parentStrapId);if(!s)return;
    const part=splitOneStrapAtNode(s,n,n.t);
    n.splitMeta={kind:'single',part};
    n.source='junction';n.parentStrapId=null;

  }else if(n.source==='crossing'&&n.crossing){
    const sa=straps.get(n.crossing.strapAId),sb=straps.get(n.crossing.strapBId);
    if(!sa||!sb)return;

    const crossingSnapshot={...n.crossing};
    const wereMirrorPair=sa.mirrorId===sb.id||sb.mirrorId===sa.id;

    const partA=splitOneStrapAtNode(sa,n,n.crossing.tA);
    const partB=splitOneStrapAtNode(sb,n,n.crossing.tB);

    if(wereMirrorPair)pairSplitChildren(partA,partB);

    n.splitMeta={kind:'crossing',partA,partB,crossing:crossingSnapshot};
    n.source='junction';n.crossing=null;n.autoCrossing=false;
  }

  updateAttachedStraps(n.id);
  rebuildAllWraps();
}
function convertRingBackToPoint(n){
  if(!n?.ringVisible||!n.splitMeta)return;
  const meta=n.splitMeta;
  if(meta.kind==='single'){
    restoreSplitPart(meta.part,n);
    n.source='strap';n.parentStrapId=meta.part.original.id;n.t=meta.part.t;
  }else if(meta.kind==='crossing'){
    restoreSplitPart(meta.partA,n);restoreSplitPart(meta.partB,n);
    n.source='crossing';n.crossing={...meta.crossing};n.autoCrossing=false;
  }
  n.splitMeta=null;n.ringVisible=false;
  rebuildNodeVisual(n);syncNodeTransform(n);rebuildAllWraps();
}
function removeStrap(id){
  const s=straps.get(id);if(!s)return;
  s.geometry.dispose();strapRoot.remove(s.group);straps.delete(id);
  for(const n of [...nodes.values()]){
    if(n.source==='strap'&&n.parentStrapId===id)removeNode(n.id,false);
    else if(n.source==='crossing'&&n.autoCrossing&&n.crossing&&(n.crossing.strapAId===id||n.crossing.strapBId===id))removeNode(n.id,false);
  }
}
function removeNode(id,removeConnected=true){
  const n=nodes.get(id);if(!n)return;
  if(removeConnected){
    for(const p of [...panels.values()])if(p.boundarySlots.some(s=>s.currentId===id))removePanel(p.id);
    for(const s of [...straps.values()])if(s.a===id||s.b===id)removeStrap(s.id);
  }
  nodeRoot.remove(n.group);nodes.delete(id);
}
function clearHarness(){
  for(const p of [...panels.values()])removePanel(p.id);
  for(const s of [...straps.values()])removeStrap(s.id);
  for(const n of [...nodes.values()])removeNode(n.id,false);
  nodes.clear();straps.clear();panels.clear();selected=null;connectStart=null;panelBuildNodes=[];
  helperRoot.clear();hideSelection();
}



function applySelectionColor(){
  const c=new THREE.Color(selectionColorHex);
  METAL_SEL.color.copy(c);
  METAL_SEL.emissive.copy(c);
  METAL_SEL.emissiveIntensity=.75;
  POINT_SEL.color.copy(c);
  STRAP_SEL.color.copy(c).multiplyScalar(.82);
  STRAP_SEL.emissive.copy(c);
  STRAP_SEL.emissiveIntensity=.62;
}

function refreshConnectHints(){
  // Connection hinting reuses live materials only; no geometry/material clones.
  if(tool!=='connect')return;
  for(const n of nodes.values()){
    if(!n.visual)continue;
    if(selected?.kind==='node'&&(n.id===selected.id||pairOfNode(selected)?.id===n.id))continue;
    if(n.ringVisible){
      n.visual.material=METAL_MAT;
      if(connectStart===n.id)n.visual.material=METAL_SEL;
    }else{
      n.visual.material=connectStart===n.id?POINT_SEL:POINT_MAT;
    }
  }
}

function selectObject(o){
  if(waypointPlacementStrapId&&o?.id!==waypointPlacementStrapId)cancelWaypointPlacement({quiet:true});
  selected=o;
  refreshMaterials();
  showSelection();
  updateAllControlHandles();
}

function refreshMaterials(){
  const selectedNodePair=selected?.kind==='node'?pairOfNode(selected):null;
  const selectedStrapPair=selected?.kind==='strap'?pairOfStrap(selected):null;

  for(const n of nodes.values()){
    if(!n.visual)continue;
    const on=selected?.kind==='node'&&(n.id===selected.id||n.id===selectedNodePair?.id);
    const panelPick=tool==='panel'&&panelBuildNodes.includes(n.id);
    n.visual.material=(on||panelPick)?(n.ringVisible?METAL_SEL:POINT_SEL):(n.ringVisible?METAL_MAT:POINT_MAT);
    if(panelPick)n.visual.material=PANEL_PICK_MAT;
  }

  for(const s of straps.values()){
    const on=selected?.kind==='strap'&&(s.id===selected.id||s.id===selectedStrapPair?.id);
    s.mesh.material=on?STRAP_SEL:STRAP_MAT;
  }
  const selectedPanelPair=selected?.kind==='panel'?pairOfPanel(selected):null;
  for(const p of panels.values()){
    const on=selected?.kind==='panel'&&(p.id===selected.id||p.id===selectedPanelPair?.id);
    p.mesh.material=on?PANEL_SEL:PANEL_MAT;
  }

  refreshConnectHints();
}
function updateAllControlHandles(){for(const s of straps.values())updateControlHandles(s)}
function showSelection(){
  if(!selected||mode!=='build'){hideSelection();return}
  selectionPanel.classList.remove('hidden');modelPanel.classList.add('hidden');
  nodeControls.classList.toggle('hidden',selected.kind!=='node');
  strapControls.classList.toggle('hidden',selected.kind!=='strap');
  panelControls.classList.toggle('hidden',selected.kind!=='panel');
  selectionLabel.textContent=selected.kind==='node'?(selected.ringVisible?'RING':'PUNKT'):selected.kind==='strap'?'RIEMEN':'FLÄCHE';
  selectionTitle.textContent=selected.id;
  lockSelectedBtn.classList.toggle('active',!!selected.locked);
  finalizeMergeBtn.classList.toggle('hidden',!(selected.kind==='node'&&(!!selected.snapMergeState||!!selected.mergedState)));
  updateLinkButton();
  if(selected.kind==='node'){
    nodeRingToggle.classList.toggle('active',selected.ringVisible);
    nodeRingToggle.textContent=selected.ringVisible?'An':'Aus';
    nodeRingToggle.setAttribute('aria-pressed',String(selected.ringVisible));
    pointSizeControl.classList.toggle('hidden',selected.ringVisible);
    ringDiameterControl.classList.toggle('hidden',!selected.ringVisible);
    ringThicknessControl.classList.toggle('hidden',!selected.ringVisible);
    const movableAnchor=selected.source==='strap'&&!selected.ringVisible;
    anchorPositionControl.classList.toggle('hidden',!movableAnchor);
    pointSizeSlider.value=selected.sizeMM;ringDiameterSlider.value=selected.diameterMM;ringThicknessSlider.value=selected.thicknessMM;
    if(movableAnchor){anchorPositionSlider.value=Math.round(selected.t*100);syncParamUI('anchorPosition',Math.round(selected.t*100))}
    syncParamUI('pointSize',selected.sizeMM);syncParamUI('ringDiameter',selected.diameterMM);syncParamUI('ringThickness',selected.thicknessMM);
  }else if(selected.kind==='strap'){
    strapWidthSlider.value=selected.widthMM;strapSlackSlider.value=selected.slack;
    syncParamUI('strapWidth',selected.widthMM);syncParamUI('strapSlack',selected.slack);
    const wp=selected.controls.filter(c=>c.waypoint&&!c.inheritedRoute).length;
    curveMinusBtn.classList.toggle('active',(selected.autoMethod||'classic')==='classic');
    curvePlusBtn.classList.toggle('active',selected.autoMethod==='push');
    curveAutoBtn.classList.toggle('active',selected.autoMethod==='strip');
    strapDebugBtn.classList.toggle('active',!!selected.debugRoute);
    const lvl=selected.surfaceLevel||0;
    if(wp)curvePointCount.textContent=`${wp} ${wp===1?'Punkt':'Punkte'} · ${wp+1} Teile`;
    else if(lvl){
      const internal=Math.pow(2,lvl)-1,sections=Math.pow(2,lvl);
      curvePointCount.textContent=`Legacy · ${internal} Punkte · ${sections} Teile`;
    }else curvePointCount.textContent=selected.autoProject?'Auto':'Standard';
  }else if(selected.kind==='panel'){
    panelOffsetSlider.value=selected.offsetMM??panelDefaults.offsetMM;
    syncParamUI('panelOffset',selected.offsetMM??panelDefaults.offsetMM);
  }
}
function hideSelection(){if(selected?.kind==='strap'&&selected.debugRoute)closeStrapDebugMode(selected);selectionPanel.classList.add('hidden');finalizeMergeBtn.classList.add('hidden');updateLinkButton()}


