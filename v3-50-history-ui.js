function historyClone(value){
  if(typeof structuredClone==='function'){
    try{return structuredClone(value)}catch{}
  }
  return JSON.parse(JSON.stringify(value));
}

function commitHistory(){
  if(restoring)return;
  const snap=historyClone(serialize());
  const sig=JSON.stringify(snap);
  if(undoStack.length&&undoStack[undoStack.length-1].sig===sig)return;
  undoStack.push({sig,snap});
  if(undoStack.length>50)undoStack.shift();
  redoStack=[];
  updateHistoryButtons();
  try{localStorage.setItem('harnessDesignerV1',sig)}catch{}
  if(typeof hitboxDebug!=='undefined'&&hitboxDebug)rebuildHitboxDebug();
}

function serialize(){
  return {
    nextNodeId,
    nextStrapId,
    nextPanelId,
    surfaceOffsetMM,
    selection:selected?{kind:selected.kind,id:selected.id}:null,
    nodes:[...nodes.values()].map(n=>({
      id:n.id,
      position:[...n.position],
      normal:[...n.normal],
      ringVisible:n.ringVisible,
      diameterMM:n.diameterMM,
      thicknessMM:n.thicknessMM,
      sizeMM:n.sizeMM,
      locked:n.locked,
      mirrorId:n.mirrorId||null,
      source:n.source,
      parentStrapId:n.parentStrapId||null,
      t:n.t,
      crossing:n.crossing?historyClone(n.crossing):null,
      autoCrossing:!!n.autoCrossing,
      splitMeta:n.splitMeta?historyClone(n.splitMeta):null,
      mergedState:n.mergedState?historyClone(n.mergedState):null,
      snapMergeState:n.snapMergeState?historyClone(n.snapMergeState):null,
      dynEditStamp:n.dynEditStamp||0,
      previousPartnerId:n.previousPartnerId||null,
      manualUnlinked:!!n.manualUnlinked
    })),
    straps:[...straps.values()].map(s=>({
      id:s.id,
      a:s.a,
      b:s.b,
      widthMM:s.widthMM,
      slack:s.slack,
      locked:s.locked,
      mirrorId:s.mirrorId||null,
      controls:historyClone(s.controls||[]),
      surfaceLevel:s.surfaceLevel||0,
      dynEditStamp:s.dynEditStamp||0,
      previousPartnerId:s.previousPartnerId||null,
      manualUnlinked:!!s.manualUnlinked,
      autoProject:!!s.autoProject,
      routingGuide:s.routingGuide?historyClone(s.routingGuide):null,
      routingMode:s.routingMode||'direct'
    })),
    panels:[...panels.values()].map(p=>({
      id:p.id,
      nodeIds:[...p.nodeIds],
      boundarySlots:historyClone(p.boundarySlots||[]),
      offsetMM:p.offsetMM??panelDefaults.offsetMM,
      mirrorId:p.mirrorId||null,
      locked:!!p.locked,
      previousPartnerId:p.previousPartnerId||null,
      manualUnlinked:!!p.manualUnlinked
    }))
  };
}

function restore(snap){
  if(!snap)return;
  restoring=true;

  try{
    waypointPlacementStrapId=null;
    clearWaypointGuide();
    connectStart=null;connectGuidePoint=null;
    single=null;
    gesture=null;
    pendingDrag=null;
    pointers.clear();

    clearHarness();

    nextNodeId=snap.nextNodeId||1;
    nextStrapId=snap.nextStrapId||1;
    nextPanelId=snap.nextPanelId||1;
    surfaceOffsetMM=snap.surfaceOffsetMM??2;
    surfaceOffsetSlider.value=surfaceOffsetMM;
    syncParamUI('surfaceOffset',surfaceOffsetMM);

    for(const d0 of snap.nodes||[]){
      makeNode(historyClone(d0));
    }

    for(const d0 of snap.straps||[]){
      const d=historyClone(d0);
      if(!nodes.has(d.a)||!nodes.has(d.b)||d.a===d.b)continue;
      makeStrap(d);
    }
    for(const d0 of snap.panels||[]){
      const d=historyClone(d0);
      const ids=(d.boundarySlots||[]).length
        ? d.boundarySlots.map(s=>s.currentId)
        : (d.nodeIds||[]);
      if(ids.length<3||ids.some(id=>!nodes.has(id)))continue;
      makePanel(d);
    }

    for(const d of snap.nodes||[]){
      const n=nodes.get(d.id);
      if(!n)continue;
      n.mirrorId=d.mirrorId&&nodes.has(d.mirrorId)?d.mirrorId:null;
      n.previousPartnerId=d.previousPartnerId||null;
      n.manualUnlinked=!!d.manualUnlinked;
      n.dynEditStamp=d.dynEditStamp||0;
    }

    for(const d of snap.straps||[]){
      const s=straps.get(d.id);
      if(!s)continue;
      s.mirrorId=d.mirrorId&&straps.has(d.mirrorId)?d.mirrorId:null;
      s.previousPartnerId=d.previousPartnerId||null;
      s.manualUnlinked=!!d.manualUnlinked;
      s.dynEditStamp=d.dynEditStamp||0;
    }

    for(const d of snap.panels||[]){
      const p=panels.get(d.id);if(!p)continue;
      p.mirrorId=d.mirrorId&&panels.has(d.mirrorId)?d.mirrorId:null;
      p.previousPartnerId=d.previousPartnerId||null;
      p.manualUnlinked=!!d.manualUnlinked;
    }

    // Exact restore only: do not run topology discovery/merge logic here.
    enforcePairMasterVisuals();
    updateAllPanels();

    for(const s of straps.values()){
      if(!pairOfStrap(s))updateStrapGeometry(s,{skipPairMirror:true});
    }

    for(const n of nodes.values()){
      rebuildNodeVisual(n);
      syncNodeTransform(n);
    }

    rebuildAllWraps();

    selected=null;
    const sel=snap.selection;
    if(sel?.kind==='node'&&nodes.has(sel.id))selected=nodes.get(sel.id);
    else if(sel?.kind==='strap'&&straps.has(sel.id))selected=straps.get(sel.id);
    else if(sel?.kind==='panel'&&panels.has(sel.id))selected=panels.get(sel.id);

    refreshMaterials();
    if(selected)showSelection();
    else hideSelection();

  }catch(err){
    console.error('History restore failed',err);
    selected=null;
    hideSelection();
    showToast('Undo konnte nicht vollständig wiederhergestellt werden');
  }finally{
    restoring=false;
    updateHistoryButtons();
  }
}

function undo(){
  if(undoStack.length<2)return;
  const current=undoStack.pop();
  redoStack.push({sig:current.sig,snap:historyClone(current.snap)});
  const previous=undoStack[undoStack.length-1];
  restore(historyClone(previous.snap));
}

function redo(){
  if(!redoStack.length)return;
  const x=redoStack.pop();
  const cloned={sig:x.sig,snap:historyClone(x.snap)};
  undoStack.push(cloned);
  restore(historyClone(cloned.snap));
}

function updateHistoryButtons(){
  undoBtn.disabled=undoStack.length<2;
  redoBtn.disabled=!redoStack.length;
}

const PRESETS={
  pointSize:{defaults:[4,6,8,10],min:0,max:30,step:1},
  ringDiameter:{defaults:[20,30,40,50],min:0,max:100,step:1},
  ringThickness:{defaults:[3,4,6,8],min:0,max:20,step:.5},
  strapWidth:{defaults:[10,20,30,40],min:0,max:100,step:1},
  strapSlack:{defaults:[0,10,30,60],min:0,max:100,step:1},
  anchorPosition:{defaults:[25,50,75,90],min:0,max:100,step:1},
  rotX:{defaults:[-90,0,90,180],min:-180,max:180,step:1},
  rotY:{defaults:[-90,0,90,180],min:-180,max:180,step:1},
  rotZ:{defaults:[-90,0,90,180],min:-180,max:180,step:1},
  surfaceOffset:{defaults:[0,2,5,10],min:0,max:30,step:.5},
  globalAnchorSize:{defaults:[8,12,16,20],min:4,max:30,step:1},
  panelOffset:{defaults:[0,1,2,5],min:0,max:12,step:.5}
};
const PARAMS=new Map();
function setupParam(name,slider,tools,onInput){
  // V1.4d: derive a safe config from the slider if a PRESETS entry is ever missing.
  // A forgotten preset definition must never be able to stop the whole app at startup.
  const fallback={
    defaults:[Number(slider.value),Number(slider.value),Number(slider.value),Number(slider.value)],
    min:Number(slider.min||0),
    max:Number(slider.max||100),
    step:Number(slider.step||1)
  };
  const cfg=PRESETS[name]||fallback;
  const num=document.createElement('input');num.type='number';num.inputMode='decimal';num.className='number-input';
  num.min=cfg.min;num.max=cfg.max;num.step=cfg.step;num.value=slider.value;tools.appendChild(num);
  const row=document.createElement('div');row.className='presets';tools.appendChild(row);
  let vals;try{vals=JSON.parse(localStorage.getItem(`v1preset:${name}`))}catch{}
  if(!Array.isArray(vals)||vals.length!==4)vals=[...cfg.defaults];
  const render=()=>{
    row.innerHTML='';
    vals.forEach((v,i)=>{
      const b=document.createElement('button');b.className='preset';b.textContent=v;
      b.addEventListener('click',()=>{slider.value=v;num.value=v;onInput(Number(v));commitHistory()});
      let timer;
      b.addEventListener('pointerdown',()=>timer=setTimeout(()=>{vals[i]=Number(slider.value);localStorage.setItem(`v1preset:${name}`,JSON.stringify(vals));render();showToast('Preset gespeichert')},550));
      ['pointerup','pointercancel','pointerleave'].forEach(ev=>b.addEventListener(ev,()=>clearTimeout(timer)));
      row.appendChild(b);
    });
  };render();
  slider.addEventListener('input',()=>{num.value=slider.value;onInput(Number(slider.value))});
  slider.addEventListener('change',()=>commitHistory());
  num.addEventListener('change',()=>{let v=Number(num.value);if(!Number.isFinite(v))v=Number(slider.value);v=Math.max(cfg.min,Math.min(cfg.max,v));slider.value=v;num.value=v;onInput(v);commitHistory()});
  PARAMS.set(name,{slider,num});
}
function syncParamUI(name,val){const p=PARAMS.get(name);if(p){p.slider.value=val;p.num.value=val}}

setupParam('pointSize',pointSizeSlider,$('pointSizeTools'),v=>{if(selected?.kind==='node'){selected.sizeMM=v;dynTouchEntity(selected);rebuildNodeVisual(selected);syncNodeTransform(selected);syncPairedNodeProps(selected);refreshMaterials()}});
setupParam('ringDiameter',ringDiameterSlider,$('ringDiameterTools'),v=>{if(selected?.kind==='node'){ringDefaults.diameterMM=v;localStorage.setItem('hd:ringDefaults',JSON.stringify(ringDefaults));selected.diameterMM=v;dynTouchEntity(selected);rebuildNodeVisual(selected);syncNodeTransform(selected);updateAttachedStraps(selected.id);rebuildWrapsForNode(selected);syncPairedNodeProps(selected);refreshMaterials()}});
setupParam('ringThickness',ringThicknessSlider,$('ringThicknessTools'),v=>{if(selected?.kind==='node'){ringDefaults.thicknessMM=v;localStorage.setItem('hd:ringDefaults',JSON.stringify(ringDefaults));selected.thicknessMM=v;dynTouchEntity(selected);rebuildNodeVisual(selected);syncNodeTransform(selected);updateAttachedStraps(selected.id);rebuildWrapsForNode(selected);syncPairedNodeProps(selected);refreshMaterials()}});
setupParam('strapWidth',strapWidthSlider,$('strapWidthTools'),v=>{if(selected?.kind==='strap'){strapDefaults.widthMM=v;localStorage.setItem('hd:strapDefaults',JSON.stringify(strapDefaults));const s=selected,p=pairOfStrap(s);if(!s._widthPreviewBase&&s.methodRoute?.length)s._widthPreviewBase={width:s.widthMM,route:s.methodRoute.map(g=>({L:g.stripLeft.clone(),R:g.stripRight.clone()}))};s.widthMM=v;if(p)p.widthMM=v;if(s._widthPreviewBase){const ratio=v/Math.max(.001,s._widthPreviewBase.width);s.methodRoute.forEach((g,i)=>{const b=s._widthPreviewBase.route[i];if(!b)return;const m=b.L.clone().lerp(b.R,.5);g.stripLeft=m.clone().lerp(b.L,ratio);g.stripRight=m.clone().lerp(b.R,ratio)});updateStrapGeometry(s);if(p)reconcileMirrorStrapPair(s)}else updateStrapGeometry(s);dynTouchEntity(s);syncPairedStrapProps(s);refreshMaterials()}});
setupParam('strapSlack',strapSlackSlider,$('strapSlackTools'),v=>{if(selected?.kind==='strap'){strapDefaults.slack=v;localStorage.setItem('hd:strapDefaults',JSON.stringify(strapDefaults));selected.slack=v;dynTouchEntity(selected);updateStrapGeometry(selected);syncPairedStrapProps(selected);refreshMaterials()}});
setupParam('anchorPosition',anchorPositionSlider,$('anchorPositionTools'),v=>{
  if(selected?.kind==='node'&&selected.source==='strap'&&!selected.ringVisible){
    selected.t=THREE.MathUtils.clamp(v/100,0,1);syncNodeTransform(selected);
  }
});
hitboxDebugBtn.addEventListener('click',()=>{hitboxDebug=!hitboxDebug;refreshHitboxDebug()});
strapWidthSlider.addEventListener('change',refreshAutomaticCrossings);

setupParam('rotX',rotXSlider,$('rotXTools'),v=>{modelRoot.rotation.x=THREE.MathUtils.degToRad(v)});
setupParam('rotY',rotYSlider,$('rotYTools'),v=>{modelRoot.rotation.y=THREE.MathUtils.degToRad(v)});
setupParam('rotZ',rotZSlider,$('rotZTools'),v=>{modelRoot.rotation.z=THREE.MathUtils.degToRad(v)});
setupParam('panelOffset',panelOffsetSlider,panelOffsetTools,v=>{
  if(selected?.kind!=='panel')return;
  selected.offsetMM=v;
  panelDefaults.offsetMM=v;
  try{localStorage.setItem('hd:panelDefaults',JSON.stringify(panelDefaults))}catch{}
  updatePanelGeometry(selected);
  const pp=pairOfPanel(selected);
  if(pp){pp.offsetMM=v;updatePanelGeometry(pp)}
});
setupParam('surfaceOffset',surfaceOffsetSlider,$('surfaceOffsetTools'),v=>{surfaceOffsetMM=v;for(const n of nodes.values())syncNodeTransform(n);for(const s of straps.values())updateStrapGeometry(s);updateAllPanels()});
globalAnchorSizeSlider.value=globalAnchorSizeMM;

selectionColorPicker.value=selectionColorHex;
applySelectionColor();
selectionColorPicker.addEventListener('input',()=>{
  selectionColorHex=selectionColorPicker.value;
  localStorage.setItem('hd:selectionColor',selectionColorHex);
  applySelectionColor();
  refreshMaterials();
});

setupParam('globalAnchorSize',globalAnchorSizeSlider,$('globalAnchorSizeTools'),v=>{
  globalAnchorSizeMM=v;localStorage.setItem('hd:anchorSize',String(v));
  for(const n of nodes.values())if(!n.ringVisible){n.sizeMM=v;rebuildNodeVisual(n);syncNodeTransform(n)}
  refreshMaterials();
});

function setTool(t){
  if(t==='connect'){
    tool=tool==='connect'?'ring':'connect';
    connectStart=null;connectGuidePoint=null;
    panelBuildNodes=[];
  }else if(t==='panel'){
    tool=tool==='panel'?'ring':'panel';
    connectStart=null;connectGuidePoint=null;
    panelBuildNodes=[];
  }else{
    tool='ring';connectStart=null;connectGuidePoint=null;panelBuildNodes=[];
  }
  connectToggle.classList.toggle('active',tool==='connect');
  connectToggle.setAttribute('aria-pressed',String(tool==='connect'));
  panelToggle.classList.toggle('active',tool==='panel');
  panelToggle.setAttribute('aria-pressed',String(tool==='panel'));
  panelConfirmBtn.classList.toggle('hidden',tool!=='panel'||panelBuildNodes.length<3);
  refreshMaterials();refreshConnectHints();
}
buildTools.addEventListener('click',e=>{
  const b=e.target.closest('.tool');
  if(b?.dataset.tool==='connect')setTool('connect');
  else if(b?.dataset.tool==='panel')setTool('panel');
});
panelConfirmBtn.addEventListener('click',()=>{
  if(tool!=='panel'||panelBuildNodes.length<3)return;
  const ids=[...panelBuildNodes];
  const panel=makePanel({nodeIds:ids});
  if(mirrorMode)mirrorPanelFrom(panel);
  panelBuildNodes=[];tool='ring';
  panelToggle.classList.remove('active');panelToggle.setAttribute('aria-pressed','false');
  panelConfirmBtn.classList.add('hidden');
  selectObject(panel);commitHistory();showToast('Fläche erstellt');
});

nodeRingToggle.addEventListener('click',()=>{
  if(selected?.kind!=='node')return;
  const n=selected;
  dynReconcileSymmetry({syncProps:false});
  const partner=pairOfNode(n);
  dynTouchEntity(n);

  if(!n.ringVisible&&(n.source==='strap'||n.source==='crossing'))convertDynamicPointToRing(n);
  else if(n.ringVisible&&n.splitMeta)convertRingBackToPoint(n);
  else{
    n.ringVisible=!n.ringVisible;rebuildNodeVisual(n);syncNodeTransform(n);updateAttachedStraps(n.id);rebuildWrapsForNode(n);
  }

  if(partner&&nodes.has(partner.id)){
    if(!partner.ringVisible&&(partner.source==='strap'||partner.source==='crossing'))convertDynamicPointToRing(partner);
    else if(partner.ringVisible&&partner.splitMeta)convertRingBackToPoint(partner);
    else{partner.ringVisible=n.ringVisible;copyNodeVisualProps(n,partner)}

    if(n.ringVisible&&partner.ringVisible)repairSplitPairingForNodes(n,partner);
  }
  updateAttachedStraps(n.id);rebuildAllWraps();refreshMaterials();showSelection();
  refreshAutomaticCrossings();
  dynReconcileSymmetry({syncProps:true});
  commitHistory();
});
finalizeMergeBtn.addEventListener('click',()=>{
  if(selected?.kind!=='node')return;
  if(selected.snapMergeState){
    if(finalizeGenericRingMerge(selected)){
      showToast('Ringe endgültig verschmolzen');
      showSelection();commitHistory();
    }
    return;
  }
  if(selected.mergedState){
    selected.mergedState=null;
    selected.mirrorId=null;
    selected.previousPartnerId=null;
    selected.manualUnlinked=true;
    showToast('Mittelachsen-Ring endgültig verschmolzen');
    showSelection();commitHistory();
  }
});
linkSelectedBtn.addEventListener('click',()=>{
  if(!selected)return;
  if(selected.kind==='node'&&selected.snapMergeState){
    const guest=genericUnmergeRing(selected);selectObject(guest);refreshAutomaticCrossings();commitHistory();showToast('Gemergten Ring getrennt');updateLinkButton();return;
  }
  const linked=selected.kind==='node'?!!pairOfNode(selected):selected.kind==='strap'?!!pairOfStrap(selected):!!pairOfPanel(selected);

  if(linked){
    if(manuallyUnlinkSelected()){
      showToast(selected.kind==='node'?'Ring/Punkt entkoppelt':'Riemen entkoppelt');
      commitHistory();
    }
  }else{
    if(reconnectSelected()){
      showToast(selected.kind==='node'?'Ring/Punkt wieder gekoppelt':'Riemen wieder gekoppelt');
      rebuildAllWraps();
      refreshAutomaticCrossings();
      commitHistory();
    }else{
      showToast('Kein früherer Partner verfügbar');
    }
  }
  updateLinkButton();
});
lockSelectedBtn.addEventListener('click',()=>{if(!selected)return;selected.locked=!selected.locked;showSelection();commitHistory()});

function clearFormerPartnerReference(e){
  if(!e?.previousPartnerId)return;
  const p=e.kind==='node'?nodes.get(e.previousPartnerId):straps.get(e.previousPartnerId);
  if(p?.previousPartnerId===e.id)p.previousPartnerId=null;
  if(p)p.manualUnlinked=false;
}
deleteSelectedBtn.addEventListener('click',()=>{
  if(!selected)return;
  const was=selected;
  if(was.manualUnlinked)clearFormerPartnerReference(was);

  if(was.kind==='node'){
    const partner=pairOfNode(was);
    if(nodes.has(was.id))removeNode(was.id);
    if(partner&&nodes.has(partner.id))removeNode(partner.id);
  }else if(was.kind==='strap'){
    const partner=pairOfStrap(was);
    if(straps.has(was.id))removeStrap(was.id);
    if(partner&&straps.has(partner.id))removeStrap(partner.id);
  }else if(was.kind==='panel'){
    const partner=pairOfPanel(was);
    if(panels.has(was.id))removePanel(was.id);
    if(partner&&panels.has(partner.id))removePanel(partner.id);
  }

  selected=null;
  hideSelection();
  rebuildAllWraps();
  refreshAutomaticCrossings();
  commitHistory();
});


let stripDeleteMode=false;
function nearestStripPointScreen(s,x,y){
  if(!s?.methodRoute?.length)return null;const r=canvas.getBoundingClientRect();let best=null,bd=36*36;
  for(let i=1;i<s.methodRoute.length-1;i++){const g=s.methodRoute[i],p=g.finalPoint.clone().project(camera),sx=r.left+(p.x+1)*.5*r.width,sy=r.top+(1-p.y)*.5*r.height,d=(sx-x)**2+(sy-y)**2;if(d<bd){bd=d;best=g}}
  return best;
}
curveMinusBtn.addEventListener('click',()=>{if(selected?.kind!=='strap')return;stripDeleteMode=!stripDeleteMode;selected.debugRoute=true;curveMinusBtn.classList.toggle('active',stripDeleteMode);updateStrapMethodDebug(selected,selected.methodRoute||[]);showToast(stripDeleteMode?'Cyanen Zwischenpunkt antippen':'Punkt löschen beendet')});
strapDebugBtn.addEventListener('click',()=>{
  if(selected?.kind!=='strap')return;
  if(selected.debugRoute)closeStrapDebugMode(selected);
  else openStrapDebugMode(selected);
});
document.getElementById('strapDebugCloseBtn')?.addEventListener('click',()=>closeStrapDebugMode(selected));
document.getElementById('strapDebugPrevBtn')?.addEventListener('click',()=>{
  if(selected?.kind!=='strap')return;
  selected.debugAll=false;
  selected.debugStep=(selected.debugStep-1+STRAP_DEBUG_STEPS.length)%STRAP_DEBUG_STEPS.length;
  updateStrapMethodDebug(selected,selected.methodRoute||[]);refreshStrapDebugPanel(selected);
});
document.getElementById('strapDebugNextBtn')?.addEventListener('click',()=>{
  if(selected?.kind!=='strap')return;
  selected.debugAll=false;
  selected.debugStep=(selected.debugStep+1)%STRAP_DEBUG_STEPS.length;
  updateStrapMethodDebug(selected,selected.methodRoute||[]);refreshStrapDebugPanel(selected);
});
document.getElementById('strapDebugAllBtn')?.addEventListener('click',()=>{
  if(selected?.kind!=='strap')return;
  selected.debugAll=!selected.debugAll;
  updateStrapMethodDebug(selected,selected.methodRoute||[]);refreshStrapDebugPanel(selected);
});
strapWidthSlider.addEventListener('change',()=>{if(selected?.kind==='strap'){const s=selected,p=pairOfStrap(s);s._widthPreviewBase=null;if(p){p.widthMM=s.widthMM;p._widthPreviewBase=null}const master=p?pairMasterStrap(s):s;rebuildAutoProjection(master);if(p)reconcileMirrorStrapPair(master)}});
undoBtn.addEventListener('click',undo);redoBtn.addEventListener('click',redo);




// ===== V3.4.4 DESIGN SAVE / LOAD =====
const DESIGN_STORAGE_KEY='HD_DESIGN_SAVES_V1';
function serializeDesignState(){return {schemaVersion:1,createdAt:new Date().toISOString(),snapshot:historyClone(serialize())}}
function encodeDesignCode(state){const raw=JSON.stringify(state);return 'HD1-'+btoa(unescape(encodeURIComponent(raw))).replace(/=+$/,'')}
function decodeDesignCode(code){const raw=String(code||'').trim().replace(/^HD1-/,'');const pad=raw+'='.repeat((4-raw.length%4)%4);return JSON.parse(decodeURIComponent(escape(atob(pad))))}
function readDesignSaves(){try{return JSON.parse(localStorage.getItem(DESIGN_STORAGE_KEY)||'[]')}catch{return []}}
function writeDesignSaves(v){localStorage.setItem(DESIGN_STORAGE_KEY,JSON.stringify(v))}
function saveDesignNamed(name){const list=readDesignSaves();list.unshift({name:name||'Design',savedAt:new Date().toISOString(),state:serializeDesignState()});writeDesignSaves(list.slice(0,20))}
function loadDesignState(state){if(!state?.snapshot)throw new Error('invalid design state');restore(historyClone(state.snapshot));commitHistory()}
function initV344DesignUI(){
  const save=document.getElementById('v344Save'),load=document.getElementById('v344Load'),code=document.getElementById('v344Code');
  save?.addEventListener('click',()=>{const name=prompt('Name für den Designstand:','Mein Design');if(name===null)return;saveDesignNamed(name);showToast('Design lokal gespeichert')});
  load?.addEventListener('click',()=>{const list=readDesignSaves();if(!list.length){showToast('Noch keine lokalen Designs');return}const pick=prompt(list.map((x,i)=>`${i+1}: ${x.name}`).join('\n'),'1'),idx=Number(pick)-1;if(Number.isInteger(idx)&&list[idx]){loadDesignState(list[idx].state);showToast(`Geladen: ${list[idx].name}`)}});
  code?.addEventListener('click',async()=>{const x=prompt('„kopieren“ oder einen HD1-Code einfügen:','kopieren');if(x===null)return;if(x.trim().toLowerCase()==='kopieren'){const c=encodeDesignCode(serializeDesignState());try{await navigator.clipboard.writeText(c);showToast('Design-Code kopiert')}catch{prompt('Design-Code:',c)}}else{try{loadDesignState(decodeDesignCode(x));showToast('Design-Code geladen')}catch{showToast('Ungültiger Design-Code')}}});
}
setTimeout(initV344DesignUI,0);
