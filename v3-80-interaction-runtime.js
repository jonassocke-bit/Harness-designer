function bodyOccludesWorldPoint(worldPoint,tolerance=.065){
  const origin=camera.position.clone();
  const delta=worldPoint.clone().sub(origin);
  const targetDist=delta.length();
  if(targetDist<1e-6)return false;

  raycaster.set(origin,delta.normalize());
  const body=raycaster.intersectObjects(bodyMeshes,true)[0];
  if(!body)return false;

  return body.distance < targetDist-tolerance;
}

function screenRayBodyDistance(x,y){
  setPointer(x,y);
  const body=raycaster.intersectObjects(bodyMeshes,true)[0];
  return body?body.distance:Infinity;
}

function visibleNodeFromCamera(n){
  if(!n)return false;
  return !bodyOccludesWorldPoint(n.group.position,.075);
}

function screenSpaceNodeHit(x,y){
  const rect=canvas.getBoundingClientRect();
  const px=x-rect.left,py=y-rect.top;
  let best=null,bestD=Infinity;
  for(const n of nodes.values()){
    if(!visibleNodeFromCamera(n))continue;
    const wp=n.group.position.clone();
    const q=wp.project(camera);
    if(q.z<-1||q.z>1)continue;
    const sx=(q.x*.5+.5)*rect.width;
    const sy=(-q.y*.5+.5)*rect.height;
    const d=Math.hypot(px-sx,py-sy);
    // Deliberately forgiving touch target. Visual ring itself can be thin.
    const radius=n.ringVisible?46:30;
    if(d<radius&&d<bestD){best={kind:'node',id:n.id};bestD=d}
  }
  return best;
}

function pointSegmentDistance2D(px,py,ax,ay,bx,by){
  const abx=bx-ax,aby=by-ay;
  const len2=abx*abx+aby*aby;
  if(len2<1e-8)return Math.hypot(px-ax,py-ay);
  const t=THREE.MathUtils.clamp(((px-ax)*abx+(py-ay)*aby)/len2,0,1);
  return Math.hypot(px-(ax+t*abx),py-(ay+t*aby));
}

function screenSpaceStrapHit(x,y){
  const rect=canvas.getBoundingClientRect();
  const px=x-rect.left,py=y-rect.top;
  let best=null,bestD=Infinity;

  for(const s of straps.values()){
    const curve=effectiveStrapCurve(s);
    const samples=18;
    let prevWorld=curve.getPoint(0);
    let prevProj=prevWorld.clone().project(camera);

    for(let i=1;i<=samples;i++){
      const t=i/samples;
      const world=curve.getPoint(t);
      const proj=world.clone().project(camera);

      // Ignore segments outside the camera clip volume.
      if(prevProj.z>=-1&&prevProj.z<=1&&proj.z>=-1&&proj.z<=1){
        const ax=(prevProj.x*.5+.5)*rect.width;
        const ay=(-prevProj.y*.5+.5)*rect.height;
        const bx=(proj.x*.5+.5)*rect.width;
        const by=(-proj.y*.5+.5)*rect.height;
        const d=pointSegmentDistance2D(px,py,ax,ay,bx,by);

        // Touch target is intentionally much wider than the visual strap.
        // A wider strap gets a slightly wider target, but even a thin strap
        // remains easy to select on iPhone.
        const hitRadius=THREE.MathUtils.clamp(18+(s.widthMM||20)*.18,20,34);

        if(d<hitRadius&&d<bestD){
          // Check a representative point on this segment against the mannequin.
          // Rear-side straps therefore still cannot be selected through the body.
          const midWorld=prevWorld.clone().lerp(world,.5);
          if(!bodyOccludesWorldPoint(midWorld,.06)){
            best={kind:'strap',id:s.id};
            bestD=d;
          }
        }
      }

      prevWorld=world;
      prevProj=proj;
    }
  }

  return best;
}

function interactiveHit(x,y){
  // Selected strap's unified guide handle wins over the strap mesh.
  const handles=[...straps.values()].map(s=>s.guideHandle).filter(Boolean);
  if(handles.length){
    setPointer(x,y);
    const hh=raycaster.intersectObjects(handles,false)[0];
    if(hh)return {kind:'strapGuideHandle',id:hh.object.userData.id};
  }

  // Existing visible objects always win over placing a new ring.
  const softNode=screenSpaceNodeHit(x,y);
  if(softNode)return softNode;

  const softStrap=screenSpaceStrapHit(x,y);
  if(softStrap)return softStrap;

  // IMPORTANT:
  // Visibility helpers intentionally use the global raycaster too.
  // Therefore every real picking pass MUST restore the touch ray immediately
  // before intersectObjects(). Otherwise the ray can still point at the last
  // node checked for occlusion and that node gets selected from anywhere.
  setPointer(x,y);
  const bodyDistance=raycaster.intersectObjects(bodyMeshes,true)[0]?.distance??Infinity;

  // Node ray hits: first collect visible nodes. visibleNodeFromCamera() changes
  // the raycaster, so restore the actual touch ray afterwards.
  const nodeHits=[];
  for(const n of nodes.values()){
    if(n.hit&&visibleNodeFromCamera(n))nodeHits.push(n.hit);
  }
  setPointer(x,y);
  const nhits=raycaster.intersectObjects(nodeHits,false);
  for(const nh of nhits){
    if(nh.distance<=bodyDistance+.075)return {kind:'node',id:nh.object.userData.id};
  }

  // Strap ray hits use the same restored touch ray. No visibility helper is
  // called between this point and the strap intersection.
  setPointer(x,y);
  const meshes=[...straps.values()].map(s=>s.mesh);
  const shits=raycaster.intersectObjects(meshes,false);
  for(const sh of shits){
    if(sh.distance<=bodyDistance+.055)return {kind:'strap',id:sh.object.userData.id};
  }

  const ph=panelHit(x,y);
  if(ph)return ph;

  return null;
}
function snapAxis(p){if(Math.abs(p.x)<AXIS_SNAP_IN)p.x=0;return p}

let pointers=new Map(),gesture=null,single=null,dragRaf=0,pendingDrag=null;
let connectGuideVisual=null;
let strapGuidePreview=null;
function activeDebugStrap(){return [...straps.values()].find(s=>s.debugRoute)||null}
function clearConnectGuideVisual(){
  if(!connectGuideVisual)return;
  helperRoot.remove(connectGuideVisual);
  connectGuideVisual.geometry?.dispose?.();connectGuideVisual.material?.dispose?.();
  connectGuideVisual=null;
}
function showConnectGuideVisual(p){
  clearConnectGuideVisual();
  connectGuideVisual=new THREE.Mesh(
    new THREE.SphereGeometry(.04,14,10),
    new THREE.MeshBasicMaterial({color:0xffd54a,depthTest:false,depthWrite:false})
  );
  connectGuideVisual.position.copy(p);connectGuideVisual.renderOrder=60;helperRoot.add(connectGuideVisual);
}
function clearStrapGuidePreview(){
  if(!strapGuidePreview)return;
  helperRoot.remove(strapGuidePreview);
  strapGuidePreview.traverse(o=>{o.geometry?.dispose?.();o.material?.dispose?.()});
  strapGuidePreview=null;
}
function previewLine(points,color,opacity=1){
  const geo=new THREE.BufferGeometry().setFromPoints(points);
  const mat=new THREE.LineBasicMaterial({color,transparent:opacity<1,opacity,depthTest:false,depthWrite:false});
  const line=new THREE.Line(geo,mat);line.renderOrder=70;return line;
}
function showStrapGuidePreview(s,guidePoint){
  clearStrapGuidePreview();
  const a=nodes.get(s.a),b=nodes.get(s.b);if(!a||!b)return;
  const A=visibleEndpoint(a,guidePoint),B=visibleEndpoint(b,guidePoint),G=guidePoint.clone();
  let chord=B.clone().sub(A);if(chord.lengthSq()<1e-10)return;chord.normalize();
  let plane=G.clone().sub(A.clone().lerp(B,.5));plane.addScaledVector(chord,-plane.dot(chord));
  if(plane.lengthSq()<1e-10)plane=nodeWorldNormal(a).clone();
  plane.normalize();
  let side=new THREE.Vector3().crossVectors(plane,chord);if(side.lengthSq()<1e-10)side=strapFrame(s).side.clone();side.normalize();
  const hw=Math.max(.0003,s.widthMM*.0037*.5);
  const center=[A,G,B];
  const left=center.map(p=>p.clone().addScaledVector(side,-hw));
  const right=center.map(p=>p.clone().addScaledVector(side,hw));
  strapGuidePreview=new THREE.Group();
  // White center = approximate requested route; rails = approximate strap width.
  strapGuidePreview.add(previewLine(center,0xffffff,.95));
  strapGuidePreview.add(previewLine(left,0xffd54a,.9));
  strapGuidePreview.add(previewLine(right,0xffd54a,.9));
  const marker=new THREE.Mesh(new THREE.SphereGeometry(.038,12,8),new THREE.MeshBasicMaterial({color:0xffd54a,depthTest:false,depthWrite:false}));
  marker.position.copy(G);marker.renderOrder=71;strapGuidePreview.add(marker);
  helperRoot.add(strapGuidePreview);
}


let genericMergeHoverVisible=false;
function setGenericMergeHoverWarning(active){
  if(active){
    clearTimeout(toastTimer);
    toast.textContent='Bereits gemerged · erst trennen oder endgültig verschmelzen';
    toast.classList.remove('hidden');
    genericMergeHoverVisible=true;
  }else if(genericMergeHoverVisible){
    genericMergeHoverVisible=false;
    if(toast.textContent.startsWith('Bereits gemerged'))toast.classList.add('hidden');
  }
}

function requestNodeDrag(n,x,y){
  pendingDrag={n,x,y};
  if(dragRaf)return;
  dragRaf=requestAnimationFrame(()=>{
    dragRaf=0;const q=pendingDrag;pendingDrag=null;if(!q)return;

    // Generic ring-on-ring merge: host stays fixed; drag far enough to restore guest.
    if(q.n.snapMergeState&&single?.genericMergeThisGesture===q.n.id){
      const current=nodeWorldPosition(q.n),hit=bodyHit(q.x,q.y);
      if(hit&&hit.point.distanceTo(current)>genericRingSnapOut(q.n)){
        const guest=genericUnmergeRing(q.n,hit.point);if(single)single.activeNodeId=guest.id;
        selected=guest;refreshMaterials();showSelection();setNodeWorldPosition(guest,hit.point);guest.normal=worldNormal(hit).toArray();syncNodeTransform(guest);updateAttachedStraps(guest.id);
      }
      return;
    }

    // Merged center ring:
    // X stays locked to the symmetry axis while Y/Z follow the mannequin.
    // A deliberate lateral pull entmerges in the same drag gesture.
    if(q.n.mergedState){
      const current=nodeWorldPosition(q.n);
      const planeP=screenPlanePoint(q.x,q.y,current);
      if(!planeP)return;

      if(Math.abs(planeP.x)>AXIS_SNAP_OUT){
        const release=current.clone();
        release.x=planeP.x;
        setNodeWorldPosition(q.n,release);

        const active=maybeAxisMergeOrEntmerge(q.n);
        if(active!==q.n){
          if(single)single.activeNodeId=active.id;
          selected=active;
          refreshMaterials();
          showSelection();
          updateAttachedStraps(active.id);
          rebuildAllWraps();
        }
        return;
      }

      const hit=bodyHit(q.x,q.y);
      if(hit){
        const p=hit.point.clone();
        p.x=0;

        const normal=symmetryAxisNormal(worldNormal(hit));

        setNodeWorldPosition(q.n,p);
        q.n.normal=normal.toArray();
        syncNodeTransform(q.n);
        updateAttachedStraps(q.n.id);
      }
      return;
    }

    const hit=bodyHit(q.x,q.y);if(!hit)return;
    let p=snapAxis(hit.point.clone());
    let normal=Math.abs(p.x)<AXIS_SNAP_IN?symmetryAxisNormal(worldNormal(hit)):worldNormal(hit);

    const partner=pairOfNode(q.n);
    if(partner){
      const master=pairMasterNode(q.n),slave=master===q.n?partner:q.n;

      // Input on the visual/right side is translated into master/left space.
      if(q.n!==master){
        p=mirrorWorldPointX(p);
        normal=mirrorWorldNormalX(normal);
      }

      setNodeWorldPosition(master,p);master.normal=normal.toArray();syncNodeTransform(master);
      forceMirrorNodeFromMaster(master,slave);
      updateAttachedStraps(master.id);

      // Do not independently solve the slave-side attached straps.
      for(const s of straps.values()){
        const ps=pairOfStrap(s);
        if(!ps)continue;
        const sm=pairMasterStrap(s),ss=sm===s?ps:s;
        if(s.a===master.id||s.b===master.id||s.a===slave.id||s.b===slave.id){
          updateStrapGeometry(sm,{skipPairMirror:true});
          mirrorStrapMeshFromMaster(sm,ss);
        }
      }

      // Generic ring merge is also allowed for a physical member of a mirror pair.
      // If it merges, only that member is consumed; its old counterpart becomes independent.
      const draggedPhysical=q.n===master?master:slave;
      if(draggedPhysical?.ringVisible && nodes.has(draggedPhysical.id)){
        const targetRing=nearestGenericRingSnapTarget(draggedPhysical);
        if(targetRing){
          const usePair=!!mirrorMateForNode(draggedPhysical)&&!!mirrorMateForNode(targetRing);
          const host=usePair?mergeMirrorPairTransaction(draggedPhysical,targetRing):genericMergeRingIntoHost(draggedPhysical,targetRing);
          if(single){single.activeNodeId=host.id;single.genericMergeThisGesture=host.id}
          selected=host;refreshMaterials();showSelection();setGenericMergeHoverWarning(false);return;
        }
        setGenericMergeHoverWarning(!!blockedGenericRingSnapTarget(draggedPhysical));
      }else{
        setGenericMergeHoverWarning(false);
      }

      const active=nodes.has(master.id)?maybeAxisMergeOrEntmerge(master):master;
      if(active!==master){
        if(single)single.activeNodeId=active.id;
        selected=active;
        showSelection();rebuildAllWraps();
      }
    }else{
      setNodeWorldPosition(q.n,p);q.n.normal=normal.toArray();syncNodeTransform(q.n);
      updateAttachedStraps(q.n.id);
      if(q.n.ringVisible){
        const target=nearestGenericRingSnapTarget(q.n);
        if(target){
          const usePair=!!mirrorMateForNode(q.n)&&!!mirrorMateForNode(target);
          const host=usePair?mergeMirrorPairTransaction(q.n,target):genericMergeRingIntoHost(q.n,target);
          if(single){single.activeNodeId=host.id;single.genericMergeThisGesture=host.id}
          selected=host;refreshMaterials();showSelection();return;
        }
        const blocked=blockedGenericRingSnapTarget(q.n);
        setGenericMergeHoverWarning(!!blocked);
      }else{
        setGenericMergeHoverWarning(false);
      }
    }

    // Preserve the user's manual route while the endpoint moves.
    // This is only weighted translation + the existing cheap geometry update.
    if(single?.waypointDragState)updateEndpointWaypointDragState(single.waypointDragState);
    updatePanelsForNode(q.n.id);
    const qp=pairOfNode(q.n);if(qp)updatePanelsForNode(qp.id);
  });
}
function screenPlanePoint(x,y,point){
  setPointer(x,y);
  const normal=camera.getWorldDirection(new THREE.Vector3());
  const plane=new THREE.Plane().setFromNormalAndCoplanarPoint(normal,point);
  const out=new THREE.Vector3();return raycaster.ray.intersectPlane(plane,out)?out:null;
}
function updateManualControlFromWorld(s,index,world){
  const c=s.controls[index],f=strapFrame(s),base=f.A.clone().lerp(f.B,c.t),d=world.clone().sub(base);
  c.side=d.dot(f.side);c.normal=d.dot(f.normal);c.drop=d.dot(WORLD_UP);
  updateStrapGeometry(s);
}

canvas.addEventListener('pointerdown',e=>{
  canvas.setPointerCapture?.(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});

  // Two-finger camera gesture always wins — including while waiting for
  // a manual waypoint tap.
  if(pointers.size===2){
    const a=[...pointers.values()];
    gesture={
      dist:Math.hypot(a[1].x-a[0].x,a[1].y-a[0].y),
      mx:(a[0].x+a[1].x)/2,my:(a[0].y+a[1].y)/2,
      camDist,target:target.clone(),camAz,camEl
    };
    setGenericMergeHoverWarning(false);
    single=null;
    return;
  }

  // Debug is read-only: camera navigation + selecting another strap only.
  // No node drag, ring creation, strap creation or geometry editing.
  const dbg=activeDebugStrap();
  if(dbg){
    const dh=interactiveHit(e.clientX,e.clientY);
    single={
      sx:e.clientX,sy:e.clientY,lx:e.clientX,ly:e.clientY,moved:false,
      hit:null,debugReadOnly:true,debugSelectId:dh?.kind==='strap'?dh.id:null
    };
    return;
  }

  // One-finger tap/drag remains in waypoint-placement mode.
  if(waypointPlacementStrapId){
    single={sx:e.clientX,sy:e.clientY,lx:e.clientX,ly:e.clientY,moved:false,hit:null,waypointPlacement:true};
    return;
  }
  const hit=interactiveHit(e.clientX,e.clientY);
  single={
    sx:e.clientX,sy:e.clientY,lx:e.clientX,ly:e.clientY,
    moved:false,hit,activeNodeId:hit?.kind==='node'?hit.id:null,
    guideStrapId:hit?.kind==='strapGuideHandle'?hit.id:null,
    guidePreviewPoint:null,
    guideOriginal:hit?.kind==='strapGuideHandle'&&straps.get(hit.id)?.routingGuide?historyClone(straps.get(hit.id).routingGuide):null,
    waypointDragState:hit?.kind==='node'?captureEndpointWaypointDragState(hit.id):null
  };
  if(hit?.kind==='node'){
    const n=nodes.get(hit.id);selectObject(n);
  }else if(hit?.kind==='strap'){
    selectObject(straps.get(hit.id));
  }
});
canvas.addEventListener('pointermove',e=>{
  if(!pointers.has(e.pointerId))return;
  pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pointers.size===2&&gesture){
    const a=[...pointers.values()],dist=Math.hypot(a[1].x-a[0].x,a[1].y-a[0].y),mx=(a[0].x+a[1].x)/2,my=(a[0].y+a[1].y)/2;
    camDist=THREE.MathUtils.clamp(gesture.camDist*(gesture.dist/Math.max(dist,1)),.025,20);
    const panDx=(mx-gesture.mx)*.003,panDy=(my-gesture.my)*.003;
    const right=new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion).normalize();
    const up=new THREE.Vector3(0,1,0).applyQuaternion(camera.quaternion).normalize();
    target.copy(gesture.target).addScaledVector(right,-panDx).addScaledVector(up,panDy);
    updateCamera();return;
  }
  if(!single)return;
  const dx=e.clientX-single.sx,dy=e.clientY-single.sy;if(Math.hypot(dx,dy)>5)single.moved=true;
  if(single.debugReadOnly){
    if(single.moved){
      camAz-=(e.clientX-single.lx)*.007;
      camEl=THREE.MathUtils.clamp(camEl+(e.clientY-single.ly)*.006,-1.2,1.2);
      updateCamera();
    }
    single.lx=e.clientX;single.ly=e.clientY;
    return;
  }
  if(single.guideStrapId){
    const s=straps.get(single.guideStrapId);
    const bh=bodyHit(e.clientX,e.clientY);
    if(s&&bh){
      // Drag is deliberately cheap/stable: preview only. Full surface solve happens once on release.
      single.guidePreviewPoint=bh.point.clone();
      showStrapGuidePreview(s,bh.point);
    }
    single.lx=e.clientX;single.ly=e.clientY;
    return;
  }
  if(single.waypointPlacement){
    // Point mode does not freeze navigation: drag rotates, tap places.
    if(single.moved){
      camAz-=(e.clientX-single.lx)*.007;
      camEl=THREE.MathUtils.clamp(camEl+(e.clientY-single.ly)*.006,-1.2,1.2);
      updateCamera();
    }
    single.lx=e.clientX;single.ly=e.clientY;
    return;
  }
  if(single.hit?.kind==='node'){
    const activeId=single.activeNodeId||single.hit.id;
    const n=nodes.get(activeId);
    if(n&&!n.locked&&n.source!=='strap')requestNodeDrag(n,e.clientX,e.clientY);
    single.lx=e.clientX;single.ly=e.clientY;return;
  }
  if(!single.hit){
    camAz-=(e.clientX-single.lx)*.007;camEl=THREE.MathUtils.clamp(camEl+(e.clientY-single.ly)*.006,-1.2,1.2);updateCamera();
    single.lx=e.clientX;single.ly=e.clientY;
  }
});
canvas.addEventListener('pointerup',e=>{
  pointers.delete(e.pointerId);
  if(pointers.size<2)gesture=null;
  if(!single){return}
  const was=single;single=null;setGenericMergeHoverWarning(false);

  if(was.debugReadOnly){
    if(!was.moved&&was.debugSelectId){
      const old=activeDebugStrap();
      const next=straps.get(was.debugSelectId);
      if(next&&old?.id!==next.id){
        closeStrapDebugMode(old);selectObject(next);openStrapDebugMode(next);
      }
    }
    return;
  }

  if(was.guideStrapId){
    const s=straps.get(was.guideStrapId);
    const gp=was.guidePreviewPoint;
    clearStrapGuidePreview();
    if(s&&gp){
      s.routingGuide=gp.toArray();s.routingMode='guided';
      rebuildAutoProjection(s);
      const ps=pairOfStrap(s);
      if(ps){
        ps.routingGuide=[-gp.x,gp.y,gp.z];ps.routingMode='guided';rebuildAutoProjection(ps);
      }
      selectObject(s);commitHistory();showToast('Riemenrichtung berechnet');
    }else if(s){selectObject(s);updateControlHandles(s)}
    return;
  }

  if(was.waypointPlacement){
    const s=waypointPlacementStrapId?straps.get(waypointPlacementStrapId):null;
    // A drag was camera navigation. Stay in placement mode and wait for a tap.
    if(was.moved)return;
    const gh=waypointGuideHit(e.clientX,e.clientY);
    if(!gh){showToast('Bitte direkt auf die cyanfarbene Linie tippen');return}

    if(s&&addWaypointFromGuideHit(s,gh)){
      waypointPlacementStrapId=null;
      clearWaypointGuide();
      curvePlusBtn.classList.remove('active');
      canvas.classList.remove('placing-waypoint');
      selectObject(s);
      strapSlackSlider.value=0;
      syncParamUI('strapSlack',0);
      showSelection();refreshAutomaticCrossings();
      dynReconcileSymmetry({syncProps:true});
      refreshMaterials();commitHistory();
      showToast('Auflagepunkt gesetzt');
    }else cancelWaypointPlacement({quiet:true});
    return;
  }



  if(was.moved){
    const movedNode=was.activeNodeId?nodes.get(was.activeNodeId):null;
    if(movedNode){
      dynTouchEntity(movedNode);

      // The route already followed the endpoint during the drag.
      // Now project that moved route once back to the mannequin.
      finalizeEndpointWaypointDragState(was.waypointDragState);
      // Auto is deliberately deferred until pointer-up: drag stays cheap.
      const touched=new Set();
      for(const s of straps.values()){
        if(!s.autoProject)continue;
        if(s.a===movedNode.id||s.b===movedNode.id){
          const master=pairOfStrap(s)?pairMasterStrap(s):s;
          if(touched.has(master.id))continue;
          touched.add(master.id);
          rebuildAutoProjection(master);
          const ps=pairOfStrap(master);
          if(ps){ps.autoProject=true;mirrorStrapMeshFromMaster(master,ps)}
        }
      }
    }
    finalizeDirtyPanels();
    rebuildAllWraps();refreshAutomaticCrossings();
    dynReconcileSymmetry({syncProps:true});
    refreshMaterials();commitHistory();return
  }
  if(stripDeleteMode&&selected?.kind==='strap'){
    const g=nearestStripPointScreen(selected,e.clientX,e.clientY);
    if(g){selected.deletedStripTs=selected.deletedStripTs||[];selected.deletedStripTs.push(g.t);rebuildAutoProjection(selected);stripDeleteMode=false;curveMinusBtn.classList.remove('active');commitHistory();return}
  }
  const hit=was.hit||interactiveHit(e.clientX,e.clientY);
  if(hit?.kind==='node'){
    const n=nodes.get(hit.id);

    if(tool==='panel'){
      if(!panelBuildNodes.includes(n.id))panelBuildNodes.push(n.id);
      else panelBuildNodes=panelBuildNodes.filter(id=>id!==n.id);
      panelConfirmBtn.classList.toggle('hidden',panelBuildNodes.length<3);
      selected=n;refreshMaterials();
      panelConfirmBtn.classList.toggle('hidden',panelBuildNodes.length<3);
      showToast(`${panelBuildNodes.length} Punkte gewählt`);
      return;
    }

    selectObject(n);
    if(tool==='connect'){
      if(!connectStart){
        connectStart=n.id;connectGuidePoint=null;
        refreshMaterials();refreshConnectHints();
        showToast(`${n.id} gewählt · Zielring antippen oder zuerst Körperpunkt wählen`);
      }
      else if(connectStart!==n.id){
        const a=nodes.get(connectStart);
        const guide=connectGuidePoint?connectGuidePoint.toArray():null;
        let s=makeStrap({a:a.id,b:n.id,routingGuide:guide});
        if(mirrorMode){
          const ma=mirrorNode(a),mb=mirrorNode(n);
          if(ma.id!==a.id||mb.id!==n.id){
            const mirroredGuide=guide?[-guide[0],guide[1],guide[2]]:null;
            const ms=makeStrap({a:ma.id,b:mb.id,widthMM:s.widthMM,slack:s.slack,routingGuide:mirroredGuide});
            s.mirrorId=ms.id;ms.mirrorId=s.id;rememberFormerPartners(s,ms)
          }
        }
        connectStart=null;connectGuidePoint=null;clearConnectGuideVisual();tool='ring';connectToggle.classList.remove('active');connectToggle.setAttribute('aria-pressed','false');
        dynReconcileSymmetry({syncProps:true});
        selectObject(s);rebuildAllWraps();refreshAutomaticCrossings();commitHistory();
      }
    }
    return;
  }
  if(hit?.kind==='strap'){selectObject(straps.get(hit.id));return}
  if(hit?.kind==='panel'){selectObject(panels.get(hit.id));return}

  // Optional 3rd construction tap: body point between start ring and target ring.
  if(tool==='connect'&&connectStart){
    const bh=bodyHit(e.clientX,e.clientY);
    if(bh){
      connectGuidePoint=bh.point.clone();
      showConnectGuideVisual(connectGuidePoint);
      showToast('Führungspunkt gesetzt · jetzt Zielring antippen');
      return;
    }
  }

  if(tool!=='connect'&&tool!=='panel'&&mode==='build'){
    const bh=bodyHit(e.clientX,e.clientY);if(!bh)return;
    const p=snapAxis(bh.point.clone());
    const normal=Math.abs(p.x)<AXIS_SNAP_IN?symmetryAxisNormal(worldNormal(bh)):worldNormal(bh);
    const n=makeNode({position:p.toArray(),normal:normal.toArray()});
    if(mirrorMode&&Math.abs(p.x)>.02){const m=mirrorNode(n);syncNodeTransform(m)}
    dynReconcileSymmetry({syncProps:true});
    selectObject(n);commitHistory();
  }
});
canvas.addEventListener('pointercancel',e=>{pointers.delete(e.pointerId);single=null;gesture=null;setGenericMergeHoverWarning(false)});

function installSheetResize(sheet){
  const grab=sheet.querySelector('.grabber');if(!grab)return;
  const key=`sheetHeight:${sheet.id}`,saved=Number(localStorage.getItem(key));if(saved>110)sheet.style.height=Math.min(saved,innerHeight*.72)+'px';
  let active=false,startY=0,startH=0,pid=null;
  grab.addEventListener('pointerdown',e=>{active=true;pid=e.pointerId;startY=e.clientY;startH=sheet.getBoundingClientRect().height;grab.setPointerCapture?.(pid);e.preventDefault()});
  grab.addEventListener('pointermove',e=>{if(!active||e.pointerId!==pid)return;sheet.style.height=THREE.MathUtils.clamp(startH+(startY-e.clientY),112,innerHeight*.72)+'px';e.preventDefault()});
  const end=e=>{if(!active||e.pointerId!==pid)return;active=false;localStorage.setItem(key,String(sheet.getBoundingClientRect().height))};
  grab.addEventListener('pointerup',end);grab.addEventListener('pointercancel',end);
}
installSheetResize(selectionPanel);installSheetResize(modelPanel);

function animate(){requestAnimationFrame(animate);renderer.render(scene,camera)}
resize();animate();

// First frame is already running before any async model or panel-related work.
setTimeout(()=>{
  loadIntegratedBody(bodySystem.gender,{reproject:false});
},0);

try{
  commitHistory();
}catch(err){
  console.error('Initial history snapshot failed',err);
}


function safeInitV344Tools(){
  try{
    initV344Tools();
    if(typeof initV344DesignUI==='function')initV344DesignUI();
  }catch(e){
    console.error('[V3.4.4a] optional tools init failed',e);
    showToast?.('Debug-Tools konnten nicht initialisiert werden');
  }
}
function initV344Tools(){
  if(document.getElementById('v344Tools'))return;
  const el=document.createElement('div');el.id='v344Tools';
  el.innerHTML=`<div class="v344Title">V3.4.4 Tools</div><button id="v344Zones">Zonen</button><button id="v344Hitboxes">Hitboxen</button><button id="v344Save">Save</button><button id="v344Load">Load</button><button id="v344Code">Design-Code</button><div class="v344Legend"><span style="color:#32c7ff">Torso</span> · <span style="color:#ff5fc8">Kopf</span> · <span style="color:#ff9638">L-Arm</span> · <span style="color:#ffd84a">R-Arm</span> · <span style="color:#75e06e">L-Bein</span> · <span style="color:#31b85a">R-Bein</span></div>`;
  document.body.appendChild(el);
  const z=el.querySelector('#v344Zones'),h=el.querySelector('#v344Hitboxes');
  z.onclick=()=>{setBodyZoneDebug(!bodyZoneDebug);z.classList.toggle('active',bodyZoneDebug)};
  h.onclick=()=>{setHitboxDebug(!hitboxDebug);h.classList.toggle('active',hitboxDebug)};
}
setTimeout(safeInitV344Tools,0);
