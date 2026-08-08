import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const $=id=>document.getElementById(id);
const canvas=$('scene'),viewport=$('viewport');
const selectionPanel=$('selectionPanel'),modelPanel=$('modelPanel');
const nodeControls=$('nodeControls'),strapControls=$('strapControls');
const selectionLabel=$('selectionLabel'),selectionTitle=$('selectionTitle');
const lockSelectedBtn=$('lockSelectedBtn'),deleteSelectedBtn=$('deleteSelectedBtn');
const undoBtn=$('undoBtn'),redoBtn=$('redoBtn');
const mirrorToggle=$('mirrorToggle'),mirrorSelectedBtn=$('mirrorSelectedBtn'),rotateModelBtn=$('rotateModelBtn');
const buildTools=$('buildTools'),restoreUI=$('restoreUI'),modePill=$('modePill'),toast=$('toast');
const modelInput=$('modelInput'),uploadModelBtn=$('uploadModelBtn'),reloadModelBtn=$('reloadModelBtn');
const closeModelPanelBtn=$('closeModelPanelBtn'),rotationResetBtn=$('rotationResetBtn');

const nodeRingToggle=$('nodeRingToggle');
const pointSizeControl=$('pointSizeControl'),ringDiameterControl=$('ringDiameterControl'),ringThicknessControl=$('ringThicknessControl');
const pointSizeSlider=$('pointSizeSlider'),ringDiameterSlider=$('ringDiameterSlider'),ringThicknessSlider=$('ringThicknessSlider');
const strapWidthSlider=$('strapWidthSlider'),strapSlackSlider=$('strapSlackSlider');
const curvePointCount=$('curvePointCount'),curveMinusBtn=$('curveMinusBtn'),curvePlusBtn=$('curvePlusBtn'),curveAutoBtn=$('curveAutoBtn');
const addAnchorBtn=$('addAnchorBtn');

const rotXSlider=$('rotXSlider'),rotYSlider=$('rotYSlider'),rotZSlider=$('rotZSlider'),surfaceOffsetSlider=$('surfaceOffsetSlider');

const scene=new THREE.Scene();
scene.background=new THREE.Color(0x0b0b0e);
scene.fog=new THREE.Fog(0x0b0b0e,6.5,10);

const camera=new THREE.PerspectiveCamera(31,1,.01,50);
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.shadowMap.enabled=false;

const hemi=new THREE.HemisphereLight(0xffffff,0x303038,2.3);scene.add(hemi);
const key=new THREE.DirectionalLight(0xffffff,2.8);key.position.set(2.5,4,3);scene.add(key);
const floor=new THREE.Mesh(new THREE.CircleGeometry(4.5,64),new THREE.MeshStandardMaterial({color:0x27272e,roughness:1}));
floor.rotation.x=-Math.PI/2;floor.position.y=-1.76;scene.add(floor);

const modelRoot=new THREE.Group();scene.add(modelRoot);
const nodeRoot=new THREE.Group();scene.add(nodeRoot);
const strapRoot=new THREE.Group();scene.add(strapRoot);
const helperRoot=new THREE.Group();scene.add(helperRoot);

const BODY_MAT=new THREE.MeshStandardMaterial({color:0xe9e9e9,roughness:.72,metalness:0});
const METAL_MAT=new THREE.MeshStandardMaterial({color:0xc7c8cc,roughness:.25,metalness:.85});
const METAL_SEL=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.18,metalness:.9,emissive:0x6a6038,emissiveIntensity:.25});
const POINT_MAT=new THREE.MeshBasicMaterial({color:0xffffff});
const POINT_SEL=new THREE.MeshBasicMaterial({color:0xffffff});
const STRAP_MAT=new THREE.MeshStandardMaterial({color:0x171718,roughness:.58,metalness:0,side:THREE.DoubleSide});
const STRAP_SEL=new THREE.MeshStandardMaterial({color:0x1c1b18,roughness:.55,metalness:0,side:THREE.DoubleSide,emissive:0x302916,emissiveIntensity:.55});
const WRAP_MAT=new THREE.MeshStandardMaterial({color:0x171718,roughness:.58,metalness:0,side:THREE.DoubleSide});
const CONTROL_MAT=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.78});

let bodyMeshes=[];
let importedModel=null;
let camAz=0,camEl=.02,camDist=5.25;
const target=new THREE.Vector3(0,.08,0);
let tool='ring',mode='build',mirrorMode=false,surfaceOffsetMM=2;
let selected=null,connectStart=null;
let nextNodeId=1,nextStrapId=1;
let nodes=new Map(),straps=new Map();
let undoStack=[],redoStack=[],restoring=false;
let toastTimer=null;

const raycaster=new THREE.Raycaster();
const pointer=new THREE.Vector2();
const UNIT_Z=new THREE.Vector3(0,0,1);
const WORLD_UP=new THREE.Vector3(0,1,0);

function showToast(msg){
  toast.textContent=msg;toast.classList.remove('hidden');
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.add('hidden'),1300);
}
function resize(){
  const r=viewport.getBoundingClientRect();
  camera.aspect=r.width/r.height;camera.updateProjectionMatrix();
  renderer.setSize(r.width,r.height,false);updateCamera();
}
function updateCamera(){
  const ce=Math.cos(camEl);
  camera.position.set(
    target.x+camDist*Math.sin(camAz)*ce,
    target.y+camDist*Math.sin(camEl),
    target.z+camDist*Math.cos(camAz)*ce
  );
  camera.lookAt(target);
}
addEventListener('resize',resize);

function addBodyMesh(mesh){
  mesh.material=BODY_MAT.clone();
  mesh.receiveShadow=false;mesh.castShadow=false;
  modelRoot.add(mesh);bodyMeshes.push(mesh);return mesh;
}
function ellipsoid(rx,ry,rz,x,y,z){
  const m=new THREE.Mesh(new THREE.SphereGeometry(1,30,20));
  m.scale.set(rx,ry,rz);m.position.set(x,y,z);return addBodyMesh(m);
}
function cylinder(r1,r2,h,x,y,z){
  const m=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,24,3));
  m.position.set(x,y,z);return addBodyMesh(m);
}
function buildFallback(){
  modelRoot.clear();bodyMeshes=[];importedModel=null;
  ellipsoid(.25,.32,.23,0,1.51,.01);
  ellipsoid(.22,.105,.21,0,1.28,.02);
  cylinder(.115,.14,.23,0,1.13,0);
  ellipsoid(.49,.56,.27,0,.55,0);
  ellipsoid(.37,.30,.24,0,-.13,0);
  ellipsoid(.34,.23,.22,0,-.54,0);
  for(const s of [-1,1]){
    ellipsoid(.17,.18,.17,.52*s,.75,0);
    cylinder(.13,.12,.68,.61*s,.34,0);
    ellipsoid(.135,.14,.13,.61*s,-.02,0);
    cylinder(.12,.105,.64,.61*s,-.38,0);
    ellipsoid(.12,.15,.11,.61*s,-.74,.015);
    cylinder(.175,.15,.72,.22*s,-.95,0);
    ellipsoid(.16,.15,.15,.22*s,-1.31,.015);
    cylinder(.145,.115,.68,.22*s,-1.45,0);
  }
  modelRoot.rotation.set(0,0,0);
}
buildFallback();

function setPointer(x,y){
  const r=canvas.getBoundingClientRect();
  pointer.x=((x-r.left)/r.width)*2-1;
  pointer.y=-((y-r.top)/r.height)*2+1;
  raycaster.setFromCamera(pointer,camera);
}
function bodyHit(x,y){
  setPointer(x,y);
  return raycaster.intersectObjects(bodyMeshes,true)[0]||null;
}
function worldNormal(hit){
  if(!hit?.face)return new THREE.Vector3(0,0,1);
  const nm=new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld);
  return hit.face.normal.clone().applyMatrix3(nm).normalize();
}
function nodeWorldNormal(n){return new THREE.Vector3().fromArray(n.normal).normalize()}
function nodeWorldPosition(n){return new THREE.Vector3().fromArray(n.position)}
function setNodeWorldPosition(n,p){n.position=p.toArray()}
function surfaceOffsetScene(){return Number(surfaceOffsetMM)*.0037}
function ringMajor(n){return Math.max(.003,(n.diameterMM*.0037)*.5)}
function ringTube(n){return Math.max(.001,(n.thicknessMM*.0037)*.5)}

function makeNode(data={}){
  const id=data.id||`N${nextNodeId++}`;
  const num=Number(id.replace(/\D/g,''));if(Number.isFinite(num))nextNodeId=Math.max(nextNodeId,num+1);
  const n={
    id,kind:'node',
    position:data.position||[0,0,0],normal:data.normal||[0,0,1],
    ringVisible:data.ringVisible!==false,
    diameterMM:data.diameterMM??40,thicknessMM:data.thicknessMM??6,sizeMM:data.sizeMM??8,
    locked:!!data.locked,mirrorId:data.mirrorId||null,
    source:data.source||'surface',parentStrapId:data.parentStrapId||null,t:data.t??.5,
    splitMeta:data.splitMeta||null,
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
function rebuildNodeVisual(n){
  clearNodeVisual(n);
  let visual,hit;
  if(n.ringVisible){
    visual=new THREE.Mesh(new THREE.TorusGeometry(ringMajor(n),ringTube(n),12,40),selected?.id===n.id?METAL_SEL:METAL_MAT);
    hit=new THREE.Mesh(new THREE.TorusGeometry(ringMajor(n),Math.max(ringTube(n)*2.8,.025),8,28),new THREE.MeshBasicMaterial({transparent:true,opacity:.001}));
  }else{
    const r=Math.max(.008,n.sizeMM*.0037*.5);
    visual=new THREE.Mesh(new THREE.SphereGeometry(r,16,12),selected?.id===n.id?POINT_SEL:POINT_MAT);
    hit=new THREE.Mesh(new THREE.SphereGeometry(Math.max(r,.055),12,8),new THREE.MeshBasicMaterial({transparent:true,opacity:.001}));
  }
  visual.userData={kind:'nodeVisual',id:n.id};hit.userData={kind:'nodeHit',id:n.id};
  n.visual=visual;n.hit=hit;n.group.add(visual,hit);
}
function syncNodeTransform(n){
  if(n.source==='strap'&&n.parentStrapId){
    const s=straps.get(n.parentStrapId);
    if(s){
      const p=strapPointAt(s,n.t);setNodeWorldPosition(n,p);
      const normal=strapNormalAt(s,n.t);n.normal=normal.toArray();
    }
  }
  const p=nodeWorldPosition(n),normal=nodeWorldNormal(n);
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
  return f.A.clone().lerp(f.B,.5).addScaledVector(f.normal,.025+slack*.22).addScaledVector(WORLD_UP,-slack*.18);
}
function manualControlWorld(s,c){
  const f=strapFrame(s);
  return f.A.clone().lerp(f.B,c.t)
    .addScaledVector(f.side,c.side)
    .addScaledVector(f.normal,c.normal)
    .addScaledVector(WORLD_UP,c.drop);
}
function strapCurve(s){
  const A=nodeWorldPosition(nodes.get(s.a)),B=nodeWorldPosition(nodes.get(s.b));
  if(!s.controls.length){
    return new THREE.QuadraticBezierCurve3(A,autoControlWorld(s),B);
  }
  const pts=[A,...s.controls.slice().sort((a,b)=>a.t-b.t).map(c=>manualControlWorld(s,c)),B];
  return new THREE.CatmullRomCurve3(pts,false,'centripetal',.45);
}
function strapPointAt(s,t){return strapCurve(s).getPoint(THREE.MathUtils.clamp(t,0,1))}
function strapNormalAt(s,t){
  const f=strapFrame(s),tan=strapCurve(s).getTangent(THREE.MathUtils.clamp(t,0,1)).normalize();
  let n=f.normal.clone().addScaledVector(tan,-f.normal.dot(tan));
  if(n.lengthSq()<1e-8)n=f.normal.clone();return n.normalize();
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

const STRAP_SAMPLES=18;
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
    id,kind:'strap',a:data.a,b:data.b,widthMM:data.widthMM??30,slack:data.slack??8,
    locked:!!data.locked,mirrorId:data.mirrorId||null,
    controls:(data.controls||[]).map(c=>({...c})),
    group:new THREE.Group(),mesh:null,geometry:initStrapGeometry(),
    controlGroup:new THREE.Group()
  };
  s.mesh=new THREE.Mesh(s.geometry,selected?.id===id?STRAP_SEL:STRAP_MAT);
  s.mesh.userData={kind:'strapMesh',id};s.group.add(s.mesh,s.controlGroup);
  straps.set(id,s);strapRoot.add(s.group);
  updateStrapGeometry(s);updateControlHandles(s);
  return s;
}
function updateStrapGeometry(s){
  const aNode=nodes.get(s.a),bNode=nodes.get(s.b);if(!aNode||!bNode)return;
  const curve=strapCurve(s);
  const firstGuide=curve.getPoint(1/STRAP_SAMPLES),lastGuide=curve.getPoint(1-1/STRAP_SAMPLES);
  const a=visibleEndpoint(aNode,firstGuide),b=visibleEndpoint(bNode,lastGuide);
  let renderCurve;
  if(!s.controls.length){
    const ctrl=autoControlWorld(s);
    renderCurve=new THREE.QuadraticBezierCurve3(a,ctrl,b);
  }else{
    const pts=[a,...s.controls.slice().sort((x,y)=>x.t-y.t).map(c=>manualControlWorld(s,c)),b];
    renderCurve=new THREE.CatmullRomCurve3(pts,false,'centripetal',.45);
  }

  const pos=s.geometry.getAttribute('position');
  const halfW=Math.max(.0003,s.widthMM*.0037*.5);
  const halfT=.0045;
  let prevSide=null,prevNormal=null;
  for(let i=0;i<=STRAP_SAMPLES;i++){
    const t=i/STRAP_SAMPLES,p=renderCurve.getPoint(t);
    const tan=renderCurve.getTangent(t).normalize();
    let normal=prevNormal?prevNormal.clone():strapFrame(s).normal.clone();
    normal.addScaledVector(tan,-normal.dot(tan));
    if(normal.lengthSq()<1e-8)normal=strapFrame(s).normal.clone();
    normal.normalize();
    let side=new THREE.Vector3().crossVectors(normal,tan);
    if(side.lengthSq()<1e-8)side=prevSide?prevSide.clone():new THREE.Vector3(1,0,0);
    side.normalize();
    if(prevSide&&side.dot(prevSide)<0){side.negate();normal.negate()}
    normal=new THREE.Vector3().crossVectors(tan,side).normalize();
    prevSide=side.clone();prevNormal=normal.clone();

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

  // Dynamic strap nodes move with exactly this strap, not with the whole scene.
  for(const n of nodes.values()){
    if(n.source==='strap'&&n.parentStrapId===s.id)syncNodeTransform(n);
  }
  updateControlHandles(s);
}
function updateAttachedStraps(nodeId){
  for(const s of straps.values())if(s.a===nodeId||s.b===nodeId)updateStrapGeometry(s);
}
function updateControlHandles(s){
  s.controlGroup.clear();
  if(selected?.kind!=='strap'||selected.id!==s.id||!s.controls.length)return;
  s.controls.forEach((c,i)=>{
    const m=new THREE.Mesh(new THREE.SphereGeometry(.04,12,8),CONTROL_MAT);
    m.position.copy(manualControlWorld(s,c));m.userData={kind:'control',strapId:s.id,index:i};s.controlGroup.add(m);
  });
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

function removeStrap(id){
  const s=straps.get(id);if(!s)return;
  s.geometry.dispose();strapRoot.remove(s.group);straps.delete(id);
  for(const n of [...nodes.values()])if(n.source==='strap'&&n.parentStrapId===id)removeNode(n.id,false);
}
function removeNode(id,removeConnected=true){
  const n=nodes.get(id);if(!n)return;
  if(removeConnected)for(const s of [...straps.values()])if(s.a===id||s.b===id)removeStrap(s.id);
  nodeRoot.remove(n.group);nodes.delete(id);
}
function clearHarness(){
  for(const s of [...straps.values()])removeStrap(s.id);
  for(const n of [...nodes.values()])removeNode(n.id,false);
  nodes.clear();straps.clear();selected=null;connectStart=null;helperRoot.clear();hideSelection();
}

function selectObject(o){
  selected=o;
  refreshMaterials();showSelection();updateAllControlHandles();
}
function refreshMaterials(){
  for(const n of nodes.values())if(n.visual)n.visual.material=(selected?.kind==='node'&&selected.id===n.id)?(n.ringVisible?METAL_SEL:POINT_SEL):(n.ringVisible?METAL_MAT:POINT_MAT);
  for(const s of straps.values())s.mesh.material=(selected?.kind==='strap'&&selected.id===s.id)?STRAP_SEL:STRAP_MAT;
}
function updateAllControlHandles(){for(const s of straps.values())updateControlHandles(s)}
function showSelection(){
  if(!selected||mode!=='build'){hideSelection();return}
  selectionPanel.classList.remove('hidden');modelPanel.classList.add('hidden');
  nodeControls.classList.toggle('hidden',selected.kind!=='node');
  strapControls.classList.toggle('hidden',selected.kind!=='strap');
  selectionLabel.textContent=selected.kind==='node'?(selected.ringVisible?'RING':'PUNKT'):'RIEMEN';
  selectionTitle.textContent=selected.id;
  lockSelectedBtn.classList.toggle('active',!!selected.locked);
  if(selected.kind==='node'){
    nodeRingToggle.classList.toggle('active',selected.ringVisible);
    nodeRingToggle.textContent=selected.ringVisible?'An':'Aus';
    nodeRingToggle.setAttribute('aria-pressed',String(selected.ringVisible));
    pointSizeControl.classList.toggle('hidden',selected.ringVisible);
    ringDiameterControl.classList.toggle('hidden',!selected.ringVisible);
    ringThicknessControl.classList.toggle('hidden',!selected.ringVisible);
    pointSizeSlider.value=selected.sizeMM;ringDiameterSlider.value=selected.diameterMM;ringThicknessSlider.value=selected.thicknessMM;
    syncParamUI('pointSize',selected.sizeMM);syncParamUI('ringDiameter',selected.diameterMM);syncParamUI('ringThickness',selected.thicknessMM);
  }else{
    strapWidthSlider.value=selected.widthMM;strapSlackSlider.value=selected.slack;
    syncParamUI('strapWidth',selected.widthMM);syncParamUI('strapSlack',selected.slack);
    curvePointCount.textContent=selected.controls.length?`Manuell · ${selected.controls.length}`:'Auto · 1';
  }
}
function hideSelection(){selectionPanel.classList.add('hidden')}

function commitHistory(){
  if(restoring)return;
  const snap=serialize();
  const sig=JSON.stringify(snap);
  if(undoStack.length&&undoStack[undoStack.length-1].sig===sig)return;
  undoStack.push({sig,snap});if(undoStack.length>50)undoStack.shift();
  redoStack=[];updateHistoryButtons();
  try{localStorage.setItem('harnessDesignerV1',sig)}catch{}
}
function serialize(){
  return {
    nextNodeId,nextStrapId,surfaceOffsetMM,
    nodes:[...nodes.values()].map(n=>({
      id:n.id,position:n.position,normal:n.normal,ringVisible:n.ringVisible,diameterMM:n.diameterMM,thicknessMM:n.thicknessMM,sizeMM:n.sizeMM,
      locked:n.locked,mirrorId:n.mirrorId,source:n.source,parentStrapId:n.parentStrapId,t:n.t,splitMeta:n.splitMeta
    })),
    straps:[...straps.values()].map(s=>({id:s.id,a:s.a,b:s.b,widthMM:s.widthMM,slack:s.slack,locked:s.locked,mirrorId:s.mirrorId,controls:s.controls}))
  };
}
function restore(snap){
  restoring=true;
  clearHarness();nextNodeId=snap.nextNodeId||1;nextStrapId=snap.nextStrapId||1;surfaceOffsetMM=snap.surfaceOffsetMM??2;surfaceOffsetSlider.value=surfaceOffsetMM;syncParamUI('surfaceOffset',surfaceOffsetMM);
  for(const d of snap.nodes||[])makeNode(d);
  for(const d of snap.straps||[])if(nodes.has(d.a)&&nodes.has(d.b))makeStrap(d);
  rebuildAllWraps();restoring=false;updateHistoryButtons();
}
function undo(){
  if(undoStack.length<2)return;
  redoStack.push(undoStack.pop());restore(undoStack[undoStack.length-1].snap);
}
function redo(){
  if(!redoStack.length)return;
  const x=redoStack.pop();undoStack.push(x);restore(x.snap);
}
function updateHistoryButtons(){undoBtn.disabled=undoStack.length<2;redoBtn.disabled=!redoStack.length}

const PRESETS={
  pointSize:{defaults:[4,6,8,10],min:0,max:30,step:1},
  ringDiameter:{defaults:[20,30,40,50],min:0,max:100,step:1},
  ringThickness:{defaults:[3,4,6,8],min:0,max:20,step:.5},
  strapWidth:{defaults:[10,20,30,40],min:0,max:100,step:1},
  strapSlack:{defaults:[0,10,30,60],min:0,max:100,step:1},
  rotX:{defaults:[-90,0,90,180],min:-180,max:180,step:1},
  rotY:{defaults:[-90,0,90,180],min:-180,max:180,step:1},
  rotZ:{defaults:[-90,0,90,180],min:-180,max:180,step:1},
  surfaceOffset:{defaults:[0,2,5,10],min:0,max:30,step:.5}
};
const PARAMS=new Map();
function setupParam(name,slider,tools,onInput){
  const cfg=PRESETS[name],num=document.createElement('input');num.type='number';num.inputMode='decimal';num.className='number-input';
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

setupParam('pointSize',pointSizeSlider,$('pointSizeTools'),v=>{if(selected?.kind==='node'){selected.sizeMM=v;rebuildNodeVisual(selected);syncNodeTransform(selected)}});
setupParam('ringDiameter',ringDiameterSlider,$('ringDiameterTools'),v=>{if(selected?.kind==='node'){selected.diameterMM=v;rebuildNodeVisual(selected);syncNodeTransform(selected);updateAttachedStraps(selected.id);rebuildWrapsForNode(selected)}});
setupParam('ringThickness',ringThicknessSlider,$('ringThicknessTools'),v=>{if(selected?.kind==='node'){selected.thicknessMM=v;rebuildNodeVisual(selected);syncNodeTransform(selected);updateAttachedStraps(selected.id);rebuildWrapsForNode(selected)}});
setupParam('strapWidth',strapWidthSlider,$('strapWidthTools'),v=>{if(selected?.kind==='strap'){selected.widthMM=v;updateStrapGeometry(selected)}});
setupParam('strapSlack',strapSlackSlider,$('strapSlackTools'),v=>{if(selected?.kind==='strap'){selected.slack=v;updateStrapGeometry(selected)}});
setupParam('rotX',rotXSlider,$('rotXTools'),v=>{modelRoot.rotation.x=THREE.MathUtils.degToRad(v)});
setupParam('rotY',rotYSlider,$('rotYTools'),v=>{modelRoot.rotation.y=THREE.MathUtils.degToRad(v)});
setupParam('rotZ',rotZSlider,$('rotZTools'),v=>{modelRoot.rotation.z=THREE.MathUtils.degToRad(v)});
setupParam('surfaceOffset',surfaceOffsetSlider,$('surfaceOffsetTools'),v=>{surfaceOffsetMM=v;for(const n of nodes.values())syncNodeTransform(n);for(const s of straps.values())updateStrapGeometry(s)});

function setTool(t){
  tool=t;connectStart=null;
  [...buildTools.querySelectorAll('.tool')].forEach(b=>b.classList.toggle('active',b.dataset.tool===t));
}
buildTools.addEventListener('click',e=>{const b=e.target.closest('.tool');if(b)setTool(b.dataset.tool)});

nodeRingToggle.addEventListener('click',()=>{
  if(selected?.kind!=='node')return;
  selected.ringVisible=!selected.ringVisible;
  rebuildNodeVisual(selected);syncNodeTransform(selected);updateAttachedStraps(selected.id);rebuildWrapsForNode(selected);showSelection();commitHistory();
});
lockSelectedBtn.addEventListener('click',()=>{if(!selected)return;selected.locked=!selected.locked;showSelection();commitHistory()});
deleteSelectedBtn.addEventListener('click',()=>{
  if(!selected)return;const was=selected;
  if(was.kind==='node')removeNode(was.id);else removeStrap(was.id);
  selected=null;hideSelection();rebuildAllWraps();commitHistory();
});
undoBtn.addEventListener('click',undo);redoBtn.addEventListener('click',redo);

curveAutoBtn.addEventListener('click',()=>{if(selected?.kind!=='strap')return;selected.controls=[];updateStrapGeometry(selected);showSelection();commitHistory()});
curvePlusBtn.addEventListener('click',()=>{
  if(selected?.kind!=='strap')return;
  const s=selected;
  if(!s.controls.length){
    const f=strapFrame(s),auto=autoControlWorld(s),base=f.A.clone().lerp(f.B,.5),d=auto.clone().sub(base);
    s.controls=[
      {t:.33,side:d.dot(f.side),normal:d.dot(f.normal),drop:d.dot(WORLD_UP)*.65},
      {t:.67,side:d.dot(f.side),normal:d.dot(f.normal),drop:d.dot(WORLD_UP)*.65}
    ];
  }else{
    const sorted=s.controls.slice().sort((a,b)=>a.t-b.t);
    let bestT=.5,bestGap=-1,prev=0;
    for(const c of [...sorted,{t:1}]){const gap=c.t-prev;if(gap>bestGap){bestGap=gap;bestT=(prev+c.t)/2}prev=c.t}
    s.controls.push({t:bestT,side:0,normal:.02,drop:0});s.controls.sort((a,b)=>a.t-b.t);
  }
  updateStrapGeometry(s);showSelection();commitHistory();
});
curveMinusBtn.addEventListener('click',()=>{
  if(selected?.kind!=='strap')return;
  if(selected.controls.length<=2)selected.controls=[];
  else selected.controls.splice(Math.floor(selected.controls.length/2),1);
  updateStrapGeometry(selected);showSelection();commitHistory();
});

addAnchorBtn.addEventListener('click',()=>{
  if(selected?.kind!=='strap')return;
  const s=selected,t=.5,p=strapPointAt(s,t),normal=strapNormalAt(s,t);
  const n=makeNode({position:p.toArray(),normal:normal.toArray(),ringVisible:false,source:'strap',parentStrapId:s.id,t,sizeMM:8});
  selectObject(n);commitHistory();
});

function mirrorNode(n){
  if(n.mirrorId&&nodes.has(n.mirrorId))return nodes.get(n.mirrorId);
  const p=nodeWorldPosition(n);p.x*=-1;
  const normal=nodeWorldNormal(n);normal.x*=-1;
  if(Math.abs(p.x)<.015)return n;
  const m=makeNode({position:p.toArray(),normal:normal.toArray(),ringVisible:n.ringVisible,diameterMM:n.diameterMM,thicknessMM:n.thicknessMM,sizeMM:n.sizeMM});
  n.mirrorId=m.id;m.mirrorId=n.id;return m;
}
mirrorToggle.addEventListener('click',()=>{mirrorMode=!mirrorMode;mirrorToggle.classList.toggle('active',mirrorMode);mirrorToggle.setAttribute('aria-pressed',String(mirrorMode))});
mirrorSelectedBtn.addEventListener('click',()=>{
  if(!selected)return;
  if(selected.kind==='node'){
    const m=mirrorNode(selected);syncNodeTransform(m);commitHistory();showToast('Gespiegelt');
  }else{
    const a=mirrorNode(nodes.get(selected.a)),b=mirrorNode(nodes.get(selected.b));
    let existing=[...straps.values()].find(s=>(s.a===a.id&&s.b===b.id)||(s.a===b.id&&s.b===a.id));
    if(!existing){
      const m=makeStrap({a:a.id,b:b.id,widthMM:selected.widthMM,slack:selected.slack,controls:selected.controls.map(c=>({...c,side:-c.side}))});
      selected.mirrorId=m.id;m.mirrorId=selected.id;
    }
    rebuildAllWraps();commitHistory();showToast('Riemen gespiegelt');
  }
});

rotateModelBtn.addEventListener('click',()=>{modelPanel.classList.remove('hidden');selectionPanel.classList.add('hidden')});
closeModelPanelBtn.addEventListener('click',()=>modelPanel.classList.add('hidden'));
uploadModelBtn.addEventListener('click',()=>modelInput.click());
reloadModelBtn.addEventListener('click',()=>{buildFallback();clearHarness();commitHistory();showToast('Standardmodell geladen')});
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
    clearHarness();commitHistory();showToast('3D-Modell geladen');
  }catch(err){console.error(err);showToast('Modell konnte nicht geladen werden')}
  finally{URL.revokeObjectURL(url);modelInput.value=''}
});

for(const b of modePill.querySelectorAll('.mode'))b.addEventListener('click',()=>{
  mode=b.dataset.mode;for(const x of modePill.querySelectorAll('.mode'))x.classList.toggle('active',x===b);
  if(mode!=='build')hideSelection();else showSelection();
  if(mode!=='build')showToast(mode==='accessories'?'Accessoires folgen später':'Fotomodus folgt später');
});

function interactiveHit(x,y){
  setPointer(x,y);
  const nodeHits=[];for(const n of nodes.values())if(n.hit)nodeHits.push(n.hit);
  const nh=raycaster.intersectObjects(nodeHits,false)[0];if(nh)return {kind:'node',id:nh.object.userData.id};
  const controls=[];for(const s of straps.values())for(const ch of s.controlGroup.children)controls.push(ch);
  const ch=raycaster.intersectObjects(controls,false)[0];if(ch)return {kind:'control',strapId:ch.object.userData.strapId,index:ch.object.userData.index};
  const meshes=[...straps.values()].map(s=>s.mesh);
  const sh=raycaster.intersectObjects(meshes,false)[0];if(sh)return {kind:'strap',id:sh.object.userData.id};
  return null;
}
function snapAxis(p){if(Math.abs(p.x)<.035)p.x=0;return p}

let pointers=new Map(),gesture=null,single=null,dragRaf=0,pendingDrag=null;
function requestNodeDrag(n,x,y){
  pendingDrag={n,x,y};
  if(dragRaf)return;
  dragRaf=requestAnimationFrame(()=>{
    dragRaf=0;const q=pendingDrag;pendingDrag=null;if(!q)return;
    const hit=bodyHit(q.x,q.y);if(!hit)return;
    const p=snapAxis(hit.point.clone()),normal=worldNormal(hit);
    setNodeWorldPosition(q.n,p);q.n.normal=normal.toArray();syncNodeTransform(q.n);
    updateAttachedStraps(q.n.id);
    if(q.n.mirrorId&&nodes.has(q.n.mirrorId)){
      const m=nodes.get(q.n.mirrorId),mp=p.clone();mp.x*=-1;const mn=normal.clone();mn.x*=-1;
      setNodeWorldPosition(m,mp);m.normal=mn.toArray();syncNodeTransform(m);updateAttachedStraps(m.id);
    }
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
  if(pointers.size===2){
    const a=[...pointers.values()];gesture={dist:Math.hypot(a[1].x-a[0].x,a[1].y-a[0].y),mx:(a[0].x+a[1].x)/2,my:(a[0].y+a[1].y)/2,camDist,target:target.clone(),camAz,camEl};single=null;return;
  }
  const hit=interactiveHit(e.clientX,e.clientY);
  single={sx:e.clientX,sy:e.clientY,lx:e.clientX,ly:e.clientY,moved:false,hit};
  if(hit?.kind==='node'){
    const n=nodes.get(hit.id);selectObject(n);
  }else if(hit?.kind==='strap'){
    selectObject(straps.get(hit.id));
  }else if(hit?.kind==='control'){
    selectObject(straps.get(hit.strapId));
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
  if(single.hit?.kind==='node'){
    const n=nodes.get(single.hit.id);if(!n.locked&&n.source!=='strap')requestNodeDrag(n,e.clientX,e.clientY);
    single.lx=e.clientX;single.ly=e.clientY;return;
  }
  if(single.hit?.kind==='control'){
    const s=straps.get(single.hit.strapId),world=screenPlanePoint(e.clientX,e.clientY,manualControlWorld(s,s.controls[single.hit.index]));
    if(world)updateManualControlFromWorld(s,single.hit.index,world);
    return;
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
  const was=single;single=null;
  if(was.moved){rebuildAllWraps();commitHistory();return}
  const hit=was.hit||interactiveHit(e.clientX,e.clientY);
  if(hit?.kind==='node'){
    const n=nodes.get(hit.id);selectObject(n);
    if(tool==='connect'){
      if(!connectStart){connectStart=n.id;showToast(`${n.id} gewählt`)}
      else if(connectStart!==n.id){
        const a=nodes.get(connectStart);let s=makeStrap({a:a.id,b:n.id});
        if(mirrorMode){
          const ma=mirrorNode(a),mb=mirrorNode(n);
          if(ma.id!==a.id||mb.id!==n.id){const ms=makeStrap({a:ma.id,b:mb.id,widthMM:s.widthMM,slack:s.slack});s.mirrorId=ms.id;ms.mirrorId=s.id}
        }
        connectStart=null;selectObject(s);rebuildAllWraps();commitHistory();
      }
    }
    return;
  }
  if(hit?.kind==='strap'){selectObject(straps.get(hit.id));return}
  if(tool==='ring'&&mode==='build'){
    const bh=bodyHit(e.clientX,e.clientY);if(!bh)return;
    const p=snapAxis(bh.point.clone()),normal=worldNormal(bh);
    const n=makeNode({position:p.toArray(),normal:normal.toArray()});
    if(mirrorMode&&Math.abs(p.x)>.02){const m=mirrorNode(n);syncNodeTransform(m)}
    selectObject(n);commitHistory();
  }
});
canvas.addEventListener('pointercancel',e=>{pointers.delete(e.pointerId);single=null;gesture=null});

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

commitHistory();
