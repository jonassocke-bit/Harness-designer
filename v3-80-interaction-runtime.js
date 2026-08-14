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

  setPointer(x,y);
  const guideMeshes=[...straps.values()].map(s=>s.guideHandle).filter(Boolean);
  const ghits=raycaster.intersectObjects(guideMeshes,false);
  if(ghits.length)return {kind:'strapGuide',id:ghits[0].object.userData.id};

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

  // One-finger tap/drag remains in waypoint-placement mode.
  if(waypointPlacementStrapId){
    single={sx:e.clientX,sy:e.clientY,lx:e.clientX,ly:e.clientY,moved:false,hit:null,waypointPlacement:true};
    return;
  }
  const hit=interactiveHit(e.clientX,e.clientY);
  single={
    sx:e.clientX,sy:e.clientY,lx:e.clientX,ly:e.clientY,
    moved:false,hit,activeNodeId:hit?.kind==='node'?hit.id:null,
    waypointDragState:hit?.kind==='node'?captureEndpointWaypointDragState(hit.id):null
  };
  if(hit?.kind==='node'){
    const n=nodes.get(hit.id);selectObject(n);
  }else if(hit?.kind==='strap'){
    selectObject(straps.get(hit.id));
  }else if(hit?.kind==='strapGuide'){
    const s=straps.get(hit.id);selectObject(s);single.guideDrag=true;
  }
});
canvas.addEventListener('pointermove',e=>{
  if(!pointers.has(e.pointerId))return;
  pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pointers.size===2&&gesture){
    const a=[...pointers.values()],dist=Math.hypot(a[1].x-a[0].x,a[1].y-a[0].y),mx=(a[0].x+a[1].x)/2,my=(a[0].y+a[1].y)/2;
    camDist=THREE.MathUtils.clamp(gesture.camDist*(gesture.dist/Math.max(dist,1)),2.5,9);
    target.x=gesture.target.x-(mx-gesture.mx)*.003;target.y=gesture.target.y+(my-gesture.my)*.003;updateCamera();return;
  }
  if(!single)return;
  const dx=e.clientX-single.sx,dy=e.clientY-single.sy;if(Math.hypot(dx,dy)>5)single.moved=true;
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
  if(single.guideDrag&&single.hit?.kind==='strapGuide'){
    const s=straps.get(single.hit.id);
    if(s){
      const hit=bodyHit(e.clientX,e.clientY);
      const p=hit?.point||screenPlanePoint(e.clientX,e.clientY,strapGuideWorld(s));
      if(p){s.guidePoint=p.toArray();s.guideActive=true;s.routeMode='guided';rebuildAutoProjection(s);updateControlHandles(s)}
    }
    single.lx=e.clientX;single.ly=e.clientY;return;
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

  if(was.guideDrag&&was.hit?.kind==='strapGuide'){
    const s=straps.get(was.hit.id);if(s){rebuildAutoProjection(s);updateControlHandles(s);showSelection();commitHistory()}return;
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
      if(!connectStart){connectStart=n.id;refreshMaterials();refreshConnectHints();showToast(`${n.id} gewählt`)}
      else if(connectStart!==n.id){
        const a=nodes.get(connectStart);let s=makeStrap({a:a.id,b:n.id});
        if(mirrorMode){
          const ma=mirrorNode(a),mb=mirrorNode(n);
          if(ma.id!==a.id||mb.id!==n.id){const ms=makeStrap({a:ma.id,b:mb.id,widthMM:s.widthMM,slack:s.slack});s.mirrorId=ms.id;ms.mirrorId=s.id;rememberFormerPartners(s,ms)}
        }
        connectStart=null;tool='ring';connectToggle.classList.remove('active');connectToggle.setAttribute('aria-pressed','false');
        dynReconcileSymmetry({syncProps:true});
        selectObject(s);rebuildAllWraps();refreshAutomaticCrossings();commitHistory();
      }
    }
    return;
  }
  if(hit?.kind==='strap'){selectObject(straps.get(hit.id));return}
  if(hit?.kind==='panel'){selectObject(panels.get(hit.id));return}
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

