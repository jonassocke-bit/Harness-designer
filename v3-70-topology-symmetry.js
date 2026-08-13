const AXIS_SNAP_IN=.032;
const AXIS_SNAP_OUT=.050;

const DYN_SYM_POS_TOL=.035;
let dynSymEditClock=1;
function dynTouchEntity(e){if(e)e.dynEditStamp=++dynSymEditClock}
function dynMirrorPoint(p){const q=p.clone();q.x*=-1;return q}
function dynNodeOnAxis(n){return Math.abs(nodeWorldPosition(n).x)<=DYN_SYM_POS_TOL}
function dynNodeClassMatches(a,b){
  if(!a||!b||a.id===b.id)return false;
  if(a.ringVisible!==b.ringVisible)return false;
  if(a.ringVisible)return true;
  return a.source===b.source;
}
function dynNodesAreMirrors(a,b){
  if(!dynNodeClassMatches(a,b))return false;
  return dynMirrorPoint(nodeWorldPosition(a)).distanceTo(nodeWorldPosition(b))<=DYN_SYM_POS_TOL;
}
function dynEndpointMirrors(aId,bId){
  const a=nodes.get(aId),b=nodes.get(bId);if(!a||!b)return false;
  if(a.id===b.id)return dynNodeOnAxis(a);
  return dynNodesAreMirrors(a,b);
}
function dynStrapsAreMirrors(a,b){
  if(!a||!b||a.id===b.id)return false;
  return (dynEndpointMirrors(a.a,b.a)&&dynEndpointMirrors(a.b,b.b))||
         (dynEndpointMirrors(a.a,b.b)&&dynEndpointMirrors(a.b,b.a));
}
function dynChooseMaster(a,b){
  if(selected?.id===a.id)return a;
  if(selected?.id===b.id)return b;
  return (a.dynEditStamp||0)>=(b.dynEditStamp||0)?a:b;
}

function rememberFormerPartners(a,b){
  if(!a||!b||a.id===b.id)return;
  a.previousPartnerId=b.id;
  b.previousPartnerId=a.id;
}
function clearCurrentPair(a,b){
  if(a?.mirrorId===b?.id)a.mirrorId=null;
  if(b?.mirrorId===a?.id)b.mirrorId=null;
}
function manuallyUnlinkSelected(){
  if(!selected)return false;
  const partner=selected.kind==='node'?pairOfNode(selected):selected.kind==='strap'?pairOfStrap(selected):pairOfPanel(selected);
  if(!partner)return false;

  rememberFormerPartners(selected,partner);
  selected.manualUnlinked=true;
  partner.manualUnlinked=true;
  clearCurrentPair(selected,partner);

  refreshMaterials();
  showSelection();
  return true;
}
function reconnectNodeToFormerPartner(n){
  const p=n?.previousPartnerId?nodes.get(n.previousPartnerId):null;
  if(!n||!p)return false;

  // Selected node is the explicit master.
  // Reconstruct exact mirror position, orientation and parameters.
  const masterPos=nodeWorldPosition(n);
  const slavePos=masterPos.clone();slavePos.x*=-1;

  const masterNormal=nodeWorldNormal(n);
  const slaveNormal=masterNormal.clone();slaveNormal.x*=-1;

  setNodeWorldPosition(p,slavePos);
  p.normal=slaveNormal.toArray();
  copyNodeVisualProps(n,p);

  n.manualUnlinked=false;
  p.manualUnlinked=false;
  n.mirrorId=p.id;
  p.mirrorId=n.id;
  rememberFormerPartners(n,p);

  syncNodeTransform(n);
  syncNodeTransform(p);
  updateAttachedStraps(n.id);
  updateAttachedStraps(p.id);
  rebuildWrapsForNode(n);
  rebuildWrapsForNode(p);

  // Their movement may restore/destroy strap symmetry around them.
  dynReconcileSymmetry({syncProps:true});
  refreshMaterials();
  showSelection();
  return true;
}
function reconnectStrapToFormerPartner(s){
  const p=s?.previousPartnerId?straps.get(s.previousPartnerId):null;
  if(!s||!p)return false;

  // Strap coupling is PROPERTY ONLY. Endpoints/length/position stay untouched.
  s.manualUnlinked=false;
  p.manualUnlinked=false;
  s.mirrorId=p.id;
  p.mirrorId=s.id;
  rememberFormerPartners(s,p);

  copyStrapProps(s,p);
  refreshMaterials();
  showSelection();
  return true;
}
function reconnectSelected(){
  if(!selected)return false;
  if(selected.kind==='node')return reconnectNodeToFormerPartner(selected);
  return reconnectStrapToFormerPartner(selected);
}
function updateLinkButton(){
  if(!selected||selected.kind==='panel'){
    linkSelectedBtn.disabled=true;
    linkSelectedBtn.classList.remove('active','unlinked');
    linkSelectedBtn.setAttribute('aria-pressed','false');
    return;
  }

  const partner=selected.kind==='node'?pairOfNode(selected):selected.kind==='strap'?pairOfStrap(selected):pairOfPanel(selected);
  const formerId=selected.previousPartnerId;
  const formerExists=selected.kind==='node'?nodes.has(formerId):straps.has(formerId);
  const linked=!!partner;
  const snapMerged=selected.kind==='node'&&!!selected.snapMergeState;

  linkSelectedBtn.disabled=!linked&&!formerExists&&!snapMerged;
  linkSelectedBtn.classList.toggle('active',linked||snapMerged);
  linkSelectedBtn.classList.toggle('unlinked',!linked&&formerExists);
  linkSelectedBtn.setAttribute('aria-pressed',String(linked));
  linkSelectedBtn.title=snapMerged?'Gemergten Ring trennen':linked?'Entkoppeln':formerExists?'Wieder koppeln':'Kein Partner';
}

function dynPairNodes(a,b,syncProps=true){
  if(!a||!b||a.id===b.id)return;
  if(a.mirrorId&&a.mirrorId!==b.id){const o=nodes.get(a.mirrorId);if(o?.mirrorId===a.id)o.mirrorId=null}
  if(b.mirrorId&&b.mirrorId!==a.id){const o=nodes.get(b.mirrorId);if(o?.mirrorId===b.id)o.mirrorId=null}
  a.mirrorId=b.id;b.mirrorId=a.id;
  a.manualUnlinked=false;b.manualUnlinked=false;
  rememberFormerPartners(a,b);
  const m=pairMasterNode(a),slave=m===a?b:a;
  if(syncProps)copyNodeVisualProps(m,slave);
  forceMirrorNodeFromMaster(m,slave,{visualProps:syncProps});
}
function dynPairStraps(a,b,syncProps=true){
  if(!a||!b||a.id===b.id)return;
  if(a.mirrorId&&a.mirrorId!==b.id){const o=straps.get(a.mirrorId);if(o?.mirrorId===a.id)o.mirrorId=null}
  if(b.mirrorId&&b.mirrorId!==a.id){const o=straps.get(b.mirrorId);if(o?.mirrorId===b.id)o.mirrorId=null}
  a.mirrorId=b.id;b.mirrorId=a.id;
  a.manualUnlinked=false;b.manualUnlinked=false;
  rememberFormerPartners(a,b);
  const m=pairMasterStrap(a),slave=m===a?b:a;
  if(syncProps){
    slave.widthMM=m.widthMM;slave.slack=m.slack;
    updateStrapGeometry(m,{skipPairMirror:true});
    mirrorStrapMeshFromMaster(m,slave);
  }
}
function dynReconcileSymmetry({syncProps=true}={}){
  for(const n of nodes.values()){
    if(!n.mirrorId)continue;
    const p=nodes.get(n.mirrorId);
    if(!p||!dynNodesAreMirrors(n,p)){
      if(p){
        rememberFormerPartners(n,p);
        if(p.mirrorId===n.id)p.mirrorId=null;
      }
      n.mirrorId=null;
    }
  }
  const nl=[...nodes.values()].filter(n=>!n.mergedState&&!dynNodeOnAxis(n)&&!n.manualUnlinked),usedN=new Set();
  for(const a of nl){
    if(a.mirrorId||usedN.has(a.id))continue;
    let best=null,bestD=Infinity,target=dynMirrorPoint(nodeWorldPosition(a));
    for(const b of nl){
      if(a.id===b.id||b.mirrorId||b.manualUnlinked||usedN.has(b.id)||!dynNodeClassMatches(a,b))continue;
      const d=target.distanceTo(nodeWorldPosition(b));
      if(d<=DYN_SYM_POS_TOL&&d<bestD){best=b;bestD=d}
    }
    if(best){dynPairNodes(a,best,syncProps);usedN.add(a.id);usedN.add(best.id)}
  }
  for(const s of straps.values()){
    if(!s.mirrorId)continue;
    const p=straps.get(s.mirrorId);
    if(!p||!dynStrapsAreMirrors(s,p)){
      if(p){
        rememberFormerPartners(s,p);
        if(p.mirrorId===s.id)p.mirrorId=null;
      }
      s.mirrorId=null;
    }
  }
  const sl=[...straps.values()].filter(s=>!s.manualUnlinked),usedS=new Set();
  for(const a of sl){
    if(a.mirrorId||usedS.has(a.id))continue;
    let best=null;
    for(const b of sl){
      if(a.id===b.id||b.mirrorId||b.manualUnlinked||usedS.has(b.id))continue;
      if(dynStrapsAreMirrors(a,b)){best=b;break}
    }
    if(best){dynPairStraps(a,best,syncProps);usedS.add(a.id);usedS.add(best.id)}
  }
  mergeCollapsedMirrorStraps();
  enforcePairMasterVisuals();
}

function pairOfNode(n){return n?.mirrorId&&nodes.has(n.mirrorId)?nodes.get(n.mirrorId):null}
function pairOfStrap(s){return s?.mirrorId&&straps.has(s.mirrorId)?straps.get(s.mirrorId):null}

function copyNodeVisualProps(src,dst){
  if(!src||!dst)return;
  dst.ringVisible=src.ringVisible;
  dst.diameterMM=src.diameterMM;
  dst.thicknessMM=src.thicknessMM;
  dst.sizeMM=src.sizeMM;
  rebuildNodeVisual(dst);syncNodeTransform(dst);
}
function copyStrapProps(src,dst){
  if(!src||!dst)return;
  dst.widthMM=src.widthMM;
  dst.slack=src.slack;

  const master=pairMasterStrap(src);
  const slave=master===src?dst:src;
  if(master!==src){
    master.widthMM=src.widthMM;
    master.slack=src.slack;
  }

  // Linked pairs use the canonical master's route. If the edit originated on
  // the visual side, mirror its materialized waypoint data back to the master.
  if(src.controls.some(c=>c.waypoint)){
    if(master!==src){
      master.controls=src.controls.map(c=>{
        const d={...c};
        if(c.surfacePos)d.surfacePos=[-c.surfacePos[0],c.surfacePos[1],c.surfacePos[2]];
        if(c.surfaceNormal)d.surfaceNormal=[-c.surfaceNormal[0],c.surfaceNormal[1],c.surfaceNormal[2]];
        d.offsetSide=-(c.offsetSide||0);
        return d;
      });
      master.surfaceLevel=0;
    }
  }else{
    master.surfaceLevel=src.surfaceLevel||0;
    master.controls=src.controls.map(c=>({...c}));
  }

  updateStrapGeometry(master,{skipPairMirror:true});
  mirrorStrapMeshFromMaster(master,slave);
}

function serializeNodeForMerge(n){
  return {
    id:n.id,position:[...n.position],normal:[...n.normal],ringVisible:n.ringVisible,
    diameterMM:n.diameterMM,thicknessMM:n.thicknessMM,sizeMM:n.sizeMM,
    locked:n.locked,source:n.source,parentStrapId:n.parentStrapId,t:n.t,crossing:n.crossing,autoCrossing:n.autoCrossing,previousPartnerId:n.previousPartnerId||null,manualUnlinked:!!n.manualUnlinked
  };
}
function captureMergeTopology(a,b){
  return [...straps.values()]
    .filter(s=>s.a===a.id||s.b===a.id||s.a===b.id||s.b===b.id)
    .map(s=>({id:s.id,a:s.a,b:s.b,widthMM:s.widthMM,slack:s.slack,locked:s.locked,mirrorId:s.mirrorId||null,controls:s.controls.map(c=>({...c})),surfaceLevel:s.surfaceLevel||0}));
}


function sameUnorderedEndpoints(a,b){
  return !!a&&!!b&&(
    (a.a===b.a&&a.b===b.b)||
    (a.a===b.b&&a.b===b.a)
  );
}
function migrateDuplicateStrapDependents(from,to){
  if(!from||!to)return;

  for(const n of nodes.values()){
    if(n.source==='strap'&&n.parentStrapId===from.id){
      n.parentStrapId=to.id;
      syncNodeTransform(n);
    }else if(n.source==='crossing'&&n.crossing){
      if(n.crossing.strapAId===from.id)n.crossing.strapAId=to.id;
      if(n.crossing.strapBId===from.id)n.crossing.strapBId=to.id;
    }
  }
}
function mergeCollapsedMirrorStraps(){
  const done=new Set();

  for(const s of [...straps.values()]){
    if(done.has(s.id))continue;
    const p=pairOfStrap(s);
    if(!p||done.has(p.id)||!sameUnorderedEndpoints(s,p))continue;

    const master=pairMasterStrap(s);
    const slave=master===s?p:s;

    // A mirrored pair whose endpoints have collapsed into the same two rings
    // is now one physical strap, exactly analogous to a merged ring pair.
    master.mirrorId=null;
    master.previousPartnerId=slave.id;
    master.manualUnlinked=false;

    migrateDuplicateStrapDependents(slave,master);

    if(selected?.kind==='strap'&&selected.id===slave.id)selected=master;

    removeStrapBare(slave.id);
    done.add(master.id);
    done.add(slave.id);

    updateStrapGeometry(master,{skipPairMirror:true});
  }
}

function mergeRingPair(a,b){
  if(!a||!b||a.id===b.id)return a;
  const pa=nodeWorldPosition(a),pb=nodeWorldPosition(b);
  const p=pa.clone().lerp(pb,.5);p.x=0;
  const n=nodeWorldNormal(a).add(nodeWorldNormal(b));if(n.lengthSq()<1e-8)n.set(0,0,1);n.x=0;n.normalize();
  const state={left:serializeNodeForMerge(a),right:serializeNodeForMerge(b),topology:captureMergeTopology(a,b)};
  const merged=makeNode({position:p.toArray(),normal:n.toArray(),ringVisible:true,diameterMM:a.diameterMM,thicknessMM:a.thicknessMM,sizeMM:a.sizeMM});
  merged.mergedState=state;

  // Panels keep their logical boundary slots even while visible nodes collapse.
  panelHandleNodeMerge(a,b,merged);

  for(const s of straps.values()){
    if(s.a===a.id||s.a===b.id)s.a=merged.id;
    if(s.b===a.id||s.b===b.id)s.b=merged.id;
    updateStrapGeometry(s);
  }
  for(const s of [...straps.values()])if(s.a===merged.id&&s.b===merged.id)removeStrap(s.id);

  nodeRoot.remove(a.group);nodes.delete(a.id);
  nodeRoot.remove(b.group);nodes.delete(b.id);

  // If both ends of a mirrored strap pair have now collapsed to the same
  // center rings, the two straps become one physical strap too.
  mergeCollapsedMirrorStraps();

  selected=merged;rebuildWrapsForNode(merged);return merged;
}

function restoreTopologyAfterEntmerge(merged,left,right,state){
  for(const s of [...straps.values()])if(s.a===merged.id||s.b===merged.id)removeStrap(s.id);
  for(const d of state.topology||[]){
    const a=d.a===state.left.id?left.id:d.a===state.right.id?right.id:d.a;
    const b=d.b===state.left.id?left.id:d.b===state.right.id?right.id:d.b;
    if(!nodes.has(a)||!nodes.has(b)||a===b)continue;
    const s=makeStrap({id:d.id,a,b,widthMM:d.widthMM,slack:d.slack,locked:d.locked,controls:d.controls,surfaceLevel:d.surfaceLevel||0});
    s.mirrorId=d.mirrorId||null;
  }
  for(const s of straps.values())if(s.mirrorId&&!straps.has(s.mirrorId))s.mirrorId=null;
}

function entmergeRing(merged,p){
  const state=merged?.mergedState;if(!state)return merged;
  const dist=Math.max(Math.abs(p.x),AXIS_SNAP_OUT);
  const normal=nodeWorldNormal(merged);
  const lp=new THREE.Vector3(-dist,p.y,p.z),rp=new THREE.Vector3(dist,p.y,p.z);
  const ln=normal.clone();ln.x=-Math.abs(ln.x);const rn=normal.clone();rn.x=Math.abs(rn.x);
  const left=makeNode({...state.left,id:state.left.id,position:lp.toArray(),normal:ln.toArray()});
  const right=makeNode({...state.right,id:state.right.id,position:rp.toArray(),normal:rn.toArray()});
  left.mirrorId=right.id;right.mirrorId=left.id;
  copyNodeVisualProps(merged,left);copyNodeVisualProps(merged,right);
  restoreTopologyAfterEntmerge(merged,left,right,state);
  panelHandleNodeEntmerge(merged,left,right);
  nodeRoot.remove(merged.group);nodes.delete(merged.id);
  selected=p.x<0?left:right;rebuildAllWraps();return selected;
}


function genericRingSnapIn(a,b){
  // Still requires near-overlap, but no longer becomes impractically tiny on small rings.
  const r=Math.min(ringMajor(a),ringMajor(b));
  return Math.max(.0105,Math.min(.020,r*.28));
}
function genericRingSnapOut(a){return Math.max(.018,ringMajor(a)*.55)}
function nearestGenericRingSnapTarget(n){
  if(!n?.ringVisible||n.mergedState||n.snapMergeState)return null;
  const p=nodeWorldPosition(n);let best=null,bd=Infinity;
  for(const o of nodes.values()){
    if(o===n||!o.ringVisible||o.mergedState||o.snapMergeState)continue;
    if(pairOfNode(n)?.id===o.id)continue;
    const d=p.distanceTo(nodeWorldPosition(o));
    if(d<genericRingSnapIn(n,o)&&d<bd){best=o;bd=d}
  }
  return best;
}
function blockedGenericRingSnapTarget(n){
  if(!n?.ringVisible)return null;
  const p=nodeWorldPosition(n);let best=null,bd=Infinity;
  for(const o of nodes.values()){
    if(o===n||!o.ringVisible)continue;
    if(pairOfNode(n)?.id===o.id)continue;
    const blocked=!!n.snapMergeState||!!o.snapMergeState;
    if(!blocked)continue;
    const d=p.distanceTo(nodeWorldPosition(o));
    if(d<genericRingSnapIn(n,o)&&d<bd){best=o;bd=d}
  }
  return best;
}
function genericMergeRingIntoHost(guest,host){
  if(!guest||!host||guest===host)return host;
  host.snapMergeState={guest:serializeNodeForMerge(guest),topology:captureMergeTopology(guest,host)};
  panelHandleNodeMerge(guest,host,host);
  for(const s of [...straps.values()]){
    if(s.a===guest.id)s.a=host.id;if(s.b===guest.id)s.b=host.id;
    if(s.a===s.b)removeStrap(s.id);else if(s.a===host.id||s.b===host.id)rebuildAutoProjection(s);
  }
  nodeRoot.remove(guest.group);nodes.delete(guest.id);selected=host;rebuildAllWraps();return host;
}
function genericUnmergeRing(host,worldPoint=null){
  const state=host?.snapMergeState;if(!state)return host;
  const hp=nodeWorldPosition(host),hn=nodeWorldNormal(host);
  let p=worldPoint?.clone?.()||hp.clone().add(new THREE.Vector3(genericRingSnapOut(host)*1.4,0,0));
  if(p.distanceTo(hp)<genericRingSnapOut(host))p=hp.clone().add(new THREE.Vector3(genericRingSnapOut(host)*1.4,0,0));
  const guest=makeNode({...state.guest,id:state.guest.id,position:p.toArray(),normal:hn.toArray(),snapMergeState:null});
  for(const s of [...straps.values()])if(s.a===host.id||s.b===host.id)removeStrap(s.id);
  for(const d of state.topology||[]){
    const a=d.a===state.guest.id?guest.id:d.a,b=d.b===state.guest.id?guest.id:d.b;
    if(!nodes.has(a)||!nodes.has(b)||a===b)continue;
    const s=makeStrap({id:d.id,a,b,widthMM:d.widthMM,slack:d.slack,locked:d.locked,controls:d.controls,surfaceLevel:d.surfaceLevel||0});
    s.mirrorId=d.mirrorId||null;rebuildAutoProjection(s);
  }
  panelHandleNodeEntmerge(host,guest,host);host.snapMergeState=null;selected=guest;rebuildAllWraps();return guest;
}

function finalizeGenericRingMerge(host){
  const state=host?.snapMergeState;
  if(!state)return false;
  const guestId=state.guest?.id;

  // Straps are already remapped during the soft merge. Finalization removes
  // only the reversible bookkeeping, not the resulting topology.
  for(const panel of panels.values()){
    for(const slot of panel.boundarySlots||[]){
      const stack=slot.mergeStack||[];
      const rec=stack[stack.length-1];
      if(rec?.mergedId===host.id)stack.pop();
    }
  }

  // Remove stale partner references to the node that is now permanently gone.
  for(const n of nodes.values()){
    if(n===host)continue;
    if(n.mirrorId===guestId)n.mirrorId=null;
    if(n.previousPartnerId===guestId)n.previousPartnerId=null;
  }
  for(const s of straps.values()){
    if(s.previousPartnerId===guestId)s.previousPartnerId=null;
  }
  if(host.previousPartnerId===guestId)host.previousPartnerId=null;

  host.snapMergeState=null;
  host.manualUnlinked=false;
  rebuildAllWraps();
  refreshAutomaticCrossings();
  refreshMaterials();
  return true;
}

function maybeAxisMergeOrEntmerge(n){
  const p=nodeWorldPosition(n);
  if(n.mergedState){
    if(Math.abs(p.x)>AXIS_SNAP_OUT)return entmergeRing(n,p);
    p.x=0;setNodeWorldPosition(n,p);syncNodeTransform(n);return n;
  }
  const partner=pairOfNode(n);if(!partner)return n;
  if(Math.abs(p.x)<=AXIS_SNAP_IN)return mergeRingPair(n,partner);
  return n;
}

function syncPairedNodeProps(n){
  const p=pairOfNode(n);if(!p)return;
  copyNodeVisualProps(n,p);updateAttachedStraps(p.id);rebuildWrapsForNode(p);
}
function syncPairedStrapProps(s){
  const p=pairOfStrap(s);if(!p)return;
  copyStrapProps(s,p);
}
function mirrorNode(n){
  if(n.mirrorId&&nodes.has(n.mirrorId))return nodes.get(n.mirrorId);
  const p=nodeWorldPosition(n);p.x*=-1;
  const normal=nodeWorldNormal(n);normal.x*=-1;
  if(Math.abs(p.x)<.015)return n;
  const m=makeNode({position:p.toArray(),normal:normal.toArray(),ringVisible:n.ringVisible,diameterMM:n.diameterMM,thicknessMM:n.thicknessMM,sizeMM:n.sizeMM});
  n.mirrorId=m.id;m.mirrorId=n.id;rememberFormerPartners(n,m);copyNodeVisualProps(n,m);return m;
}
mirrorToggle.addEventListener('click',()=>{mirrorMode=!mirrorMode;mirrorToggle.classList.toggle('active',mirrorMode);mirrorToggle.setAttribute('aria-pressed',String(mirrorMode))});
mirrorSelectedBtn.addEventListener('click',()=>{
  if(!selected)return;

  if(selected.kind==='node'){
    const m=mirrorNode(selected);
    syncNodeTransform(m);
    dynReconcileSymmetry({syncProps:true});
    commitHistory();
    showToast('Gespiegelt');
    return;
  }

  if(selected.kind==='strap'){
    const a=mirrorNode(nodes.get(selected.a)),b=mirrorNode(nodes.get(selected.b));
    let existing=[...straps.values()].find(s=>
      (s.a===a.id&&s.b===b.id)||(s.a===b.id&&s.b===a.id)
    );

    if(!existing){
      const hasWp=selected.controls.some(c=>c.waypoint);
      const m=makeStrap({
        a:a.id,b:b.id,
        widthMM:selected.widthMM,
        slack:selected.slack,
        controls:hasWp?[]:selected.controls.map(c=>({...c,side:-c.side})),
        surfaceLevel:hasWp?0:(selected.surfaceLevel||0)
      });

      if(hasWp){
        for(const c of selected.controls.filter(c=>c.waypoint).sort((x,y)=>x.t-y.t)){
          m.controls.push(waypointControlAt(m,c.t));
        }
        updateStrapGeometry(m);
      }

      selected.mirrorId=m.id;
      m.mirrorId=selected.id;
      rememberFormerPartners(selected,m);
      existing=m;
    }

    dynReconcileSymmetry({syncProps:true});
    rebuildAllWraps();
    commitHistory();
    showToast('Riemen gespiegelt');
    return;
  }

  if(selected.kind==='panel'){
    const m=mirrorPanelFrom(selected);
    if(m){
      selectObject(selected);
      commitHistory();
      showToast('Fläche gespiegelt');
    }else{
      showToast('Fläche kann nicht gespiegelt werden');
    }
  }
});

rotateModelBtn.addEventListener('click',()=>{modelPanel.classList.remove('hidden');selectionPanel.classList.add('hidden')});
closeModelPanelBtn.addEventListener('click',()=>modelPanel.classList.add('hidden'));
uploadModelBtn.addEventListener('click',()=>modelInput.click());
reloadModelBtn.addEventListener('click',()=>loadIntegratedBody(bodySystem.gender,{reproject:false,clearExistingHarness:true}));
rotationResetBtn.addEventListener('click',()=>{
  modelRoot.rotation.set(0,0,0);for(const [name] of [['rotX'],['rotY'],['rotZ']])syncParamUI(name,0);
});
modelInput.addEventListener('change',async()=>{
  const file=modelInput.files?.[0];if(!file)return;
  const url=URL.createObjectURL(file);
  try{
    const gltf=await new GLTFLoader().loadAsync(url),obj=gltf.scene;
    modelRoot.clear();bodyMeshes=[];importedModel=obj;
    obj.updateMatrixWorld(true);
    let box=new THREE.Box3().setFromObject(obj),size=box.getSize(new THREE.Vector3());
    obj.scale.setScalar(3.3/Math.max(size.y,.001));obj.updateMatrixWorld(true);
    box=new THREE.Box3().setFromObject(obj);const c=box.getCenter(new THREE.Vector3());
    obj.position.x-=c.x;obj.position.z-=c.z;obj.position.y+=(-1.75-box.min.y);obj.updateMatrixWorld(true);
    modelRoot.add(obj);obj.traverse(x=>{if(x.isMesh){x.material=BODY_MAT.clone();bodyMeshes.push(x)}});
    integratedBodyRoot=null;integratedBodyMesh=null;integratedBodyDict=null;usingIntegratedBody=false;
    setBodyUIEnabled(false);
    clearHarness();commitHistory();showToast('Eigenes 3D-Modell geladen');
  }catch(err){console.error(err);showToast('Modell konnte nicht geladen werden')}
  finally{URL.revokeObjectURL(url);modelInput.value=''}
});


updateBodyUI();

function liveBodySliderUpdate(){
  bodySystem.shape=Number(bodyShapeSlider.value);
  bodySystem.muscle=Number(bodyMuscleSlider.value);
  bodySystem.height=Number(bodyHeightSlider.value);
  bodySystem.arms=Number(bodyArmsSlider.value);
  bodySystem.legs=Number(bodyLegsSlider.value);
  updateBodyUI();
  applyIntegratedBodyMorphs();
}
for(const s of [bodyShapeSlider,bodyMuscleSlider,bodyHeightSlider,bodyArmsSlider,bodyLegsSlider]){
  s.addEventListener('input',liveBodySliderUpdate);
  s.addEventListener('change',commitBodyChange);
}
bodyFemaleBtn.addEventListener('click',()=>{
  if(bodySystem.gender==='female'&&usingIntegratedBody)return;
  loadIntegratedBody('female',{reproject:nodes.size>0});
});
bodyMaleBtn.addEventListener('click',()=>{
  if(bodySystem.gender==='male'&&usingIntegratedBody)return;
  loadIntegratedBody('male',{reproject:nodes.size>0});
});

for(const b of modePill.querySelectorAll('.mode'))b.addEventListener('click',()=>{
  mode=b.dataset.mode;for(const x of modePill.querySelectorAll('.mode'))x.classList.toggle('active',x===b);
  if(mode!=='build')hideSelection();else showSelection();
  if(mode!=='build')showToast(mode==='accessories'?'Accessoires folgen später':'Fotomodus folgt später');
});


