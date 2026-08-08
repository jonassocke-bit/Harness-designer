
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const $=id=>document.getElementById(id);
const canvas=$('scene'),viewport=$('viewport'),chrome=$('chrome'),restoreUI=$('restoreUI');
const buildTools=$('buildTools'),selectionPanel=$('selectionPanel');
const ringControls=$('ringControls'),strapControls=$('strapControls'),strapAnchorControls=$('strapAnchorControls');
const selectionLabel=$('selectionLabel'),selectionTitle=$('selectionTitle'),deleteSelectedBtn=$('deleteSelectedBtn');
const undoBtn=$('undoBtn'),redoBtn=$('redoBtn'),lockSelectedBtn=$('lockSelectedBtn'),moreBtn=$('moreBtn'),moreMenu=$('moreMenu');
const widthSlider=$('widthSlider'),widthValue=$('widthValue'),slackSlider=$('slackSlider');
const ringDiameterSlider=$('ringDiameterSlider'),ringDiameterValue=$('ringDiameterValue');
const ringThicknessSlider=$('ringThicknessSlider'),ringThicknessValue=$('ringThicknessValue');
const surfaceNodeRingToggle=$('surfaceNodeRingToggle'),surfaceNodeSizeSlider=$('surfaceNodeSizeSlider'),surfaceNodeSizeValue=$('surfaceNodeSizeValue');
const addStrapAnchorBtn=$('addStrapAnchorBtn'),strapAnchorSlider=$('strapAnchorSlider'),strapAnchorValue=$('strapAnchorValue');
const strapAnchorSizeSlider=$('strapAnchorSizeSlider'),strapAnchorSizeValue=$('strapAnchorSizeValue'),strapNodeRingToggle=$('strapNodeRingToggle');
const mirrorToggle=$('mirrorToggle'),mirrorSelectedBtn=$('mirrorSelectedBtn');
const accessoryPanel=$('accessoryPanel'),photoPanel=$('photoPanel'),rotationPanel=$('rotationPanel');
const rotateModelBtn=$('rotateModelBtn'),closeRotationBtn=$('closeRotationBtn'),rotationResetBtn=$('rotationResetBtn');
const rotXSlider=$('rotXSlider'),rotYSlider=$('rotYSlider'),rotZSlider=$('rotZSlider');
const rotXValue=$('rotXValue'),rotYValue=$('rotYValue'),rotZValue=$('rotZValue');
const surfaceOffsetSlider=$('surfaceOffsetSlider'),surfaceOffsetValue=$('surfaceOffsetValue');
const envelopeSmoothSlider=$('envelopeSmoothSlider'),envelopeSmoothValue=$('envelopeSmoothValue');
const envelopeInflateSlider=$('envelopeInflateSlider'),envelopeInflateValue=$('envelopeInflateValue');
const envelopeVisibleToggle=$('envelopeVisibleToggle'),symmetricEnvelopeToggle=$('symmetricEnvelopeToggle');
const resetBtn=$('resetBtn'),modelBtn=$('modelBtn'),modelInput=$('modelInput'),toast=$('toast'),modeTitle=$('modeTitle');
const modeButtons=[...document.querySelectorAll('.mode')],toolButtons=[...document.querySelectorAll('.tool')];

const MM_TO_SCENE=.0037;
const MIRROR_AXIS_SNAP=.045;
const scene=new THREE.Scene();
scene.fog=new THREE.Fog(0x09090b,6.2,10);

const camera=new THREE.PerspectiveCamera(31,1,.01,50);
let camAz=0,camEl=.02,camDist=5.25;
const target=new THREE.Vector3(0,.08,0);

const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;

scene.add(new THREE.HemisphereLight(0xffffff,0x303038,2.0));
const key=new THREE.DirectionalLight(0xffffff,3.15); key.position.set(2.7,4.4,3.4); key.castShadow=true; scene.add(key);
const fill=new THREE.DirectionalLight(0xd8ddff,1); fill.position.set(-3,2,2); scene.add(fill);
const rim=new THREE.DirectionalLight(0xa7b4ff,1.25); rim.position.set(-3,2.8,-3.2); scene.add(rim);

const floor=new THREE.Mesh(new THREE.CircleGeometry(2.35,96),new THREE.MeshStandardMaterial({color:0x141418,roughness:1}));
floor.rotation.x=-Math.PI/2; floor.position.y=-1.81; floor.receiveShadow=true; scene.add(floor);

const axisGeom=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,-1.795,-2.05),new THREE.Vector3(0,-1.795,2.05)]);
scene.add(new THREE.Line(axisGeom,new THREE.LineBasicMaterial({color:0xffffff,transparent:true,opacity:.55})));
const axisMarkerMat=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.62});
for(const z of [-1.5,-1,-.5,0,.5,1,1.5]){
  const mark=new THREE.Mesh(new THREE.PlaneGeometry(.12,.012),axisMarkerMat);
  mark.rotation.x=-Math.PI/2; mark.position.set(0,-1.79,z); scene.add(mark);
}

function updateCamera(){
  const ce=Math.cos(camEl);
  camera.position.set(
    target.x+Math.sin(camAz)*ce*camDist,
    target.y+Math.sin(camEl)*camDist,
    target.z+Math.cos(camAz)*ce*camDist
  );
  camera.lookAt(target);
}
updateCamera();

let mode='build',buildTool='ring',mirrorMode=false;
let selected=null,connectStart=null;
let surfaceOffsetMM=2,envelopeSmoothPct=35,envelopeInflateMM=4,envelopeVisible=false,symmetricEnvelope=false;

const nodes=[];
const connections=[];

function kindOf(o){return o?.kind||null}
function showToast(msg){
  toast.textContent=msg; toast.classList.remove('hidden');
  clearTimeout(showToast.t); showToast.t=setTimeout(()=>toast.classList.add('hidden'),1600);
}
function surfaceOffsetScene(){return surfaceOffsetMM*MM_TO_SCENE}

let mannequin=new THREE.Group(); scene.add(mannequin);
let bodyMeshes=[],collisionMeshes=[],importedModel=null;
const bodyMat=new THREE.MeshStandardMaterial({color:0xd7d5d0,roughness:.78,metalness:0});

function registerMesh(m,override=true){
  if(override)m.material=bodyMat;
  m.castShadow=true;m.receiveShadow=true;bodyMeshes.push(m);
}
function addMesh(m){registerMesh(m,true);mannequin.add(m);return m}
function ellipsoid(rx,ry,rz,x,y,z=0){
  const m=addMesh(new THREE.Mesh(new THREE.SphereGeometry(1,56,38)));
  m.scale.set(rx,ry,rz);m.position.set(x,y,z);return m;
}
function limb(rt,rb,len,x,y,rz,z=0){
  const m=addMesh(new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,len,40,10,false)));
  m.position.set(x,y,z);m.rotation.z=rz;return m;
}
function buildFallback(){
  bodyMeshes=[];mannequin.clear();
  ellipsoid(.245,.325,.235,0,1.50,.012);ellipsoid(.225,.115,.215,0,1.30,.025);
  const neck=addMesh(new THREE.Mesh(new THREE.CylinderGeometry(.115,.145,.25,40,6)));neck.position.set(0,1.16,0);
  ellipsoid(.48,.57,.27,0,.71,.012);ellipsoid(.41,.38,.235,0,.30,.012);ellipsoid(.445,.30,.28,0,-.12,.015);
  ellipsoid(.19,.155,.205,-.37,.84,.012);ellipsoid(.19,.155,.205,.37,.84,.012);
  limb(.135,.112,.60,-.55,.54,-.12);ellipsoid(.125,.145,.125,-.59,.20,0);limb(.112,.09,.59,-.63,-.10,-.025);ellipsoid(.095,.155,.065,-.65,-.47,.02);
  limb(.135,.112,.60,.55,.54,.12);ellipsoid(.125,.145,.125,.59,.20,0);limb(.112,.09,.59,.63,-.10,.025);ellipsoid(.095,.155,.065,.65,-.47,.02);
  ellipsoid(.215,.235,.215,-.205,-.40,.01);ellipsoid(.215,.235,.215,.205,-.40,.01);
  limb(.185,.145,.70,-.20,-.83,.018);limb(.185,.145,.70,.20,-.83,-.018);
  ellipsoid(.15,.15,.145,-.20,-1.20,.01);ellipsoid(.15,.15,.145,.20,-1.20,.01);
  limb(.14,.098,.66,-.20,-1.53,-.005);limb(.14,.098,.66,.20,-1.53,.005);
  collisionMeshes=bodyMeshes;
}
buildFallback();

const envelopeRoot=new THREE.Group();scene.add(envelopeRoot);
let envelopeMeshes=[];
function clearEnvelope(){
  for(const m of envelopeMeshes){envelopeRoot.remove(m);m.geometry?.dispose?.();m.material?.dispose?.()}
  envelopeMeshes=[];
}
function smoothGeometryClone(sourceGeom,smoothPct,inflateMM){
  const g=sourceGeom.clone();
  const p=g.getAttribute('position'); if(!p)return g;
  g.computeVertexNormals();
  const nAttr=g.getAttribute('normal');
  const box=new THREE.Box3().setFromBufferAttribute(p);
  const center=box.getCenter(new THREE.Vector3());
  const smooth=THREE.MathUtils.clamp(smoothPct/100,0,1);
  const inflate=inflateMM*MM_TO_SCENE;
  const v=new THREE.Vector3(),n=new THREE.Vector3(),toward=new THREE.Vector3();
  for(let i=0;i<p.count;i++){
    v.fromBufferAttribute(p,i); n.fromBufferAttribute(nAttr,i).normalize();
    toward.copy(center).sub(v);
    const radial=Math.min(toward.length(),.22)*smooth*.46;
    if(toward.lengthSq()>1e-8)v.addScaledVector(toward.normalize(),radial);
    v.addScaledVector(n,inflate);
    p.setXYZ(i,v.x,v.y,v.z);
  }
  p.needsUpdate=true;g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();return g;
}
function rebuildEnvelope(){
  clearEnvelope();
  try{
    const sources=[];mannequin.traverse(n=>{if(n.isMesh)sources.push(n)});
    for(const src of sources){
      const m=new THREE.Mesh(
        smoothGeometryClone(src.geometry,envelopeSmoothPct,envelopeInflateMM),
        new THREE.MeshStandardMaterial({color:0xffffff,transparent:true,opacity:.15,roughness:.3,depthWrite:false,side:THREE.DoubleSide})
      );
      src.updateMatrixWorld(true);m.matrixAutoUpdate=false;m.matrix.copy(src.matrixWorld);m.visible=envelopeVisible;
      envelopeRoot.add(m);envelopeMeshes.push(m);
    }
    collisionMeshes=(envelopeMeshes.length&&(envelopeSmoothPct>0||envelopeInflateMM>0))?envelopeMeshes:bodyMeshes;
  }catch(err){
    console.error('Envelope disabled',err);clearEnvelope();collisionMeshes=bodyMeshes;
  }
}
function setEnvelopeVisible(v){
  envelopeVisible=v;envelopeMeshes.forEach(m=>m.visible=v);
  envelopeVisibleToggle?.classList.toggle('active',v);
  envelopeVisibleToggle?.setAttribute('aria-pressed',v?'true':'false');
  if(envelopeVisibleToggle)envelopeVisibleToggle.textContent=v?'An':'Aus';
}

modelBtn.addEventListener('click',()=>modelInput.click());
modelInput.addEventListener('change',async()=>{
  const file=modelInput.files?.[0];if(!file)return;
  const url=URL.createObjectURL(file);
  try{
    const gltf=await new GLTFLoader().loadAsync(url),obj=gltf.scene;
    obj.updateMatrixWorld(true);
    let box=new THREE.Box3().setFromObject(obj),size=box.getSize(new THREE.Vector3());
    obj.scale.setScalar(3.25/Math.max(size.y,.001));obj.updateMatrixWorld(true);
    box=new THREE.Box3().setFromObject(obj);
    const c=box.getCenter(new THREE.Vector3());
    obj.position.x-=c.x;obj.position.z-=c.z;obj.position.y+=(-1.75-box.min.y);obj.updateMatrixWorld(true);
    scene.remove(mannequin);mannequin=new THREE.Group();mannequin.add(obj);scene.add(mannequin);importedModel=obj;
    bodyMeshes=[];obj.traverse(n=>{if(n.isMesh)registerMesh(n,false)});
    collisionMeshes=bodyMeshes;rebuildEnvelope();resetHarness();showToast('3D-Modell geladen');
  }catch(err){console.error(err);showToast('Modell konnte nicht geladen werden')}
  finally{URL.revokeObjectURL(url);modelInput.value=''}
});

const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
function setPointerXY(x,y){
  const r=canvas.getBoundingClientRect();
  pointer.x=((x-r.left)/r.width)*2-1;pointer.y=-((y-r.top)/r.height)*2+1;
  raycaster.setFromCamera(pointer,camera);
}
function bodyHitXY(x,y){
  setPointerXY(x,y);
  return raycaster.intersectObjects(collisionMeshes.length?collisionMeshes:bodyMeshes,true)[0]||null;
}
function worldNormal(hit){
  const nm=new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld);
  return hit.face.normal.clone().applyMatrix3(nm).normalize();
}
function snapHitToAxis(hit){
  if(!hit)return hit;
  if(Math.abs(hit.point.x)<MIRROR_AXIS_SNAP)hit.point.x=0;
  if(symmetricEnvelope&&hit.point.x<0){
    const mirrored=mirroredBodyHit(new THREE.Vector3(-hit.point.x,hit.point.y,hit.point.z));
    if(mirrored)return mirrored;
  }
  return hit;
}

const metalMat=new THREE.MeshStandardMaterial({color:0xb8b8bc,roughness:.26,metalness:.75});
const metalSelected=metalMat.clone();metalSelected.emissive.setHex(0x454545);metalSelected.emissiveIntensity=.8;
const pointMat=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.28,emissive:0x222222,emissiveIntensity:.3});
const pointSelected=pointMat.clone();pointSelected.emissive.setHex(0x777777);pointSelected.emissiveIntensity=1;

function nodePosition(n){return n.group.position.clone()}
function nodeNormal(n){return n.normal?.clone()||new THREE.Vector3(0,0,1)}
function ringMajor(n){return Math.max(.001,n.diameterMM*MM_TO_SCENE/2)}
function ringTube(n){return Math.max(.001,n.thicknessMM*MM_TO_SCENE/2)}
function nodePointRadius(n){return Math.max(.006,n.sizeMM*MM_TO_SCENE/2)}


const leatherWrapMat=new THREE.MeshStandardMaterial({
  color:0x171718,roughness:.5,metalness:0,side:THREE.DoubleSide
});

function connectionsAtNode(n){
  return connections.filter(c=>c.a===n||c.b===n);
}

function ringLocalContactAngle(n,c){
  const center=nodePosition(n);
  const other=c.a===n?nodePosition(c.b):nodePosition(c.a);
  const qInv=n.group.quaternion.clone().invert();
  const d=other.clone().sub(center).applyQuaternion(qInv);
  d.z=0;
  if(d.lengthSq()<1e-8)return 0;
  return Math.atan2(d.y,d.x);
}

function addRingWraps(n){
  if(!n.ringVisible)return;
  const attached=connectionsAtNode(n);
  for(const c of attached){
    const angle=ringLocalContactAngle(n,c);
    const strapWidth=Math.max(.018,.15*(c.widthMM/30));
    const arcLen=THREE.MathUtils.clamp(strapWidth/(Math.max(ringMajor(n),.01)),.16,1.15);
    const tubular=16,radial=18;
    const geom=new THREE.TorusGeometry(
      ringMajor(n),
      ringTube(n)*1.10,
      tubular,
      radial,
      arcLen
    );
    const mesh=new THREE.Mesh(geom,leatherWrapMat);
    // TorusGeometry arc begins on +X. Center the leather segment on contact angle.
    mesh.rotation.z=angle-arcLen/2;
    mesh.position.z=.0008;
    mesh.userData={kind:'ringWrap',owner:n,connection:c};
    n.group.add(mesh);
  }
}

function seatRingOnSurface(n){
  if(!n.ringVisible||!n.surfacePoint||!n.normal)return;

  // Multi-point seating: sample around the ring and move it outward until
  // no sampled point is significantly behind the construction surface.
  const center=n.surfacePoint.clone().addScaledVector(n.normal,surfaceOffsetScene()+ringTube(n));
  const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),n.normal.clone().normalize());
  let push=0;
  const samples=12;

  for(let i=0;i<samples;i++){
    const a=i/samples*Math.PI*2;
    const local=new THREE.Vector3(Math.cos(a)*ringMajor(n),Math.sin(a)*ringMajor(n),0);
    const sample=center.clone().add(local.applyQuaternion(q));
    const origin=sample.clone().addScaledVector(n.normal,.32);
    raycaster.set(origin,n.normal.clone().negate());
    const hits=raycaster.intersectObjects(collisionMeshes.length?collisionMeshes:bodyMeshes,true);
    if(!hits.length)continue;
    const surface=hits[0].point;
    const signed=surface.clone().sub(sample).dot(n.normal);
    push=Math.max(push,signed+ringTube(n)*.25);
  }

  n.group.position.copy(center).addScaledVector(n.normal,Math.max(0,push));
  if(Math.abs(n.surfacePoint.x)<MIRROR_AXIS_SNAP)n.group.position.x=0;
  n.group.quaternion.copy(q);
}


function markNodeVisualDirty(n){
  if(n)n._visualDirty=true;
}

function refreshNodeVisualIfNeeded(n){
  if(n._visualDirty!==false){
    rebuildNodeVisual(n);
    n._visualDirty=false;
  }
}
function rebuildNodeVisual(n){
  while(n.group.children.length){
    const q=n.group.children.pop();q.geometry?.dispose?.();if(q.material!==metalMat&&q.material!==metalSelected&&q.material!==pointMat&&q.material!==pointSelected)q.material?.dispose?.();
  }
  if(n.ringVisible){
    const ring=new THREE.Mesh(new THREE.TorusGeometry(ringMajor(n),ringTube(n),16,64),selected===n?metalSelected:metalMat);
    ring.userData={kind:'nodeVisual',owner:n};n.group.add(ring);
    const hit=new THREE.Mesh(new THREE.SphereGeometry(Math.max(ringMajor(n)+ringTube(n),.055),18,12),new THREE.MeshBasicMaterial({transparent:true,opacity:.001}));
    hit.userData={kind:'nodeHit',owner:n};n.group.add(hit);
    addRingWraps(n);
  }else{
    const sphere=new THREE.Mesh(new THREE.SphereGeometry(nodePointRadius(n),24,16),selected===n?pointSelected:pointMat);
    sphere.userData={kind:'nodeVisual',owner:n};n.group.add(sphere);
    const hit=new THREE.Mesh(new THREE.SphereGeometry(Math.max(nodePointRadius(n)*2,.035),18,12),new THREE.MeshBasicMaterial({transparent:true,opacity:.001}));
    hit.userData={kind:'nodeHit',owner:n};n.group.add(hit);
  }
}

function createSurfaceNode(hit,ringVisible=true,skipMirror=false){
  hit=snapHitToAxis(hit);
  const n={
    kind:'node',id:`N${nodes.length+1}`,source:'surface',group:new THREE.Group(),
    ringVisible,diameterMM:40,thicknessMM:6,sizeMM:10,
    surfacePoint:hit.point.clone(),normal:worldNormal(hit),parent:null,t:0,mirrorPartner:null
  };
  updateSurfaceNodeTransform(n);scene.add(n.group);nodes.push(n);rebuildNodeVisual(n);

  if(mirrorMode&&!skipMirror&&Math.abs(n.group.position.x)>.012){
    const mate=createMirroredSurfaceNode(n);
    if(mate){n.mirrorPartner=mate;mate.mirrorPartner=n}
  }
  return n;
}
function updateSurfaceNodeTransform(n){
  if(Math.abs(n.surfacePoint.x)<MIRROR_AXIS_SNAP)n.surfacePoint.x=0;
  if(n.ringVisible){
    seatRingOnSurface(n);
  }else{
    n.group.position.copy(n.surfacePoint).addScaledVector(n.normal,surfaceOffsetScene());
    if(Math.abs(n.surfacePoint.x)<MIRROR_AXIS_SNAP)n.group.position.x=0;
    n.group.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),n.normal.clone().normalize());
  }
}
function createStrapNode(parent,t=.5,skipMirror=false){
  const n={
    kind:'node',id:`N${nodes.length+1}`,source:'strap',group:new THREE.Group(),
    ringVisible:false,diameterMM:40,thicknessMM:6,sizeMM:10,parent,t,normal:new THREE.Vector3(0,0,1),mirrorPartner:null
  };
  nodes.push(n);scene.add(n.group);rebuildNodeVisual(n);updateAllGeometry();
  if(mirrorMode&&!skipMirror&&parent.mirrorPartner){
    const mate=createStrapNode(parent.mirrorPartner,t,true);
    mate.sizeMM=n.sizeMM;n.mirrorPartner=mate;mate.mirrorPartner=n;rebuildNodeVisual(mate);
  }
  return n;
}

function mirrorPoint(p){return new THREE.Vector3(-p.x,p.y,p.z)}
function mirroredBodyHit(p){
  const targetP=mirrorPoint(p);
  const dir=new THREE.Vector3(1,0,0);
  const origins=[targetP.clone().add(new THREE.Vector3(2,0,0)),targetP.clone().add(new THREE.Vector3(-2,0,0))];
  let best=null,bestD=Infinity;
  for(let j=0;j<2;j++){
    raycaster.set(origins[j],j===0?new THREE.Vector3(-1,0,0):new THREE.Vector3(1,0,0));
    const hits=raycaster.intersectObjects(collisionMeshes.length?collisionMeshes:bodyMeshes,true);
    for(const h of hits){
      const d=h.point.distanceTo(targetP);if(d<bestD){best=h;bestD=d}
    }
  }
  return best;
}
function findNearbySurfaceNode(p,except=null){
  let best=null,bestD=.075;
  for(const n of nodes){
    if(n===except||n.source!=='surface')continue;
    const d=n.group.position.distanceTo(p);if(d<bestD){best=n;bestD=d}
  }
  return best;
}
function createMirroredSurfaceNode(src){
  if(Math.abs(src.group.position.x)<.012)return src;
  if(src.mirrorPartner)return src.mirrorPartner;
  const target=mirrorPoint(src.group.position),existing=findNearbySurfaceNode(target,src);
  if(existing){existing.ringVisible=src.ringVisible;existing.diameterMM=src.diameterMM;existing.thicknessMM=src.thicknessMM;existing.sizeMM=src.sizeMM;rebuildNodeVisual(existing);return existing}
  const h=mirroredBodyHit(src.group.position);if(!h)return null;
  const m=createSurfaceNode(h,src.ringVisible,true);
  m.diameterMM=src.diameterMM;m.thicknessMM=src.thicknessMM;m.sizeMM=src.sizeMM;rebuildNodeVisual(m);return m;
}

function connectionBetween(a,b){
  return connections.find(c=>(c.a===a&&c.b===b)||(c.a===b&&c.b===a))||null;
}
function createConnection(a,b,skipMirror=false){
  if(!a||!b||a===b)return null;
  const existing=connectionBetween(a,b);if(existing)return existing;
  const c={
    kind:'connection',id:`S${connections.length+1}`,a,b,group:new THREE.Group(),
    widthMM:30,slack:8,
    baseCurve:null,renderCurve:null,mirrorPartner:null
  };
  connections.push(c);scene.add(c.group);updateAllGeometry();

  if(mirrorMode&&!skipMirror){
    const ma=ensureMirrorNode(a),mb=ensureMirrorNode(b);
    if(ma&&mb&&!(ma===a&&mb===b)){
      const mc=createConnection(ma,mb,true);
      c.mirrorPartner=mc;mc.mirrorPartner=c;
    }
  }
  return c;
}
function ensureMirrorNode(n){
  if(n.mirrorPartner)return n.mirrorPartner;
  if(n.source==='surface'){
    const m=createMirroredSurfaceNode(n);if(m!==n){n.mirrorPartner=m;m.mirrorPartner=n}return m;
  }
  if(n.source==='strap'){
    const pc=n.parent?.mirrorPartner;if(!pc)return null;
    const existing=nodes.find(x=>x.source==='strap'&&x.parent===pc&&Math.abs(x.t-n.t)<.012);
    const m=existing||createStrapNode(pc,n.t,true);m.sizeMM=n.sizeMM;m.ringVisible=n.ringVisible;m.diameterMM=n.diameterMM;m.thicknessMM=n.thicknessMM;rebuildNodeVisual(m);
    n.mirrorPartner=m;m.mirrorPartner=n;return m;
  }
  return null;
}
function mirrorSelectedObject(){
  if(!selected)return;
  if(selected.kind==='node'){
    const m=ensureMirrorNode(selected);
    if(m&&m!==selected){selected.mirrorPartner=m;m.mirrorPartner=selected;showToast('Knoten gespiegelt & gekoppelt')}
  }else if(selected.kind==='connection'){
    const ma=ensureMirrorNode(selected.a),mb=ensureMirrorNode(selected.b);
    if(ma&&mb){
      const mc=createConnection(ma,mb,true);
      mc.widthMM=selected.widthMM;mc.slack=selected.slack;
      selected.mirrorPartner=mc;mc.mirrorPartner=selected;updateAllGeometry();showToast('Riemen gespiegelt & gekoppelt');
    }
  }
  refreshSelectionVisuals();
}

function averageNormal(a,b){
  const n=nodeNormal(a).add(nodeNormal(b));
  return n.lengthSq()>1e-8?n.normalize():new THREE.Vector3(0,0,1);
}
function castToSurfaceFrom(mid,normal){
  const origin=mid.clone().addScaledVector(normal,1.2);
  raycaster.set(origin,normal.clone().negate());
  const hits=raycaster.intersectObjects(collisionMeshes.length?collisionMeshes:bodyMeshes,true);
  if(hits.length)return {point:hits[0].point.clone(),normal:worldNormal(hits[0])};
  return {point:mid.clone(),normal:normal.clone()};
}
function controlFrame(c){
  const A=nodePosition(c.a),B=nodePosition(c.b),mid=A.clone().lerp(B,.5);
  const avgN=averageNormal(c.a,c.b),surf=castToSurfaceFrom(mid,avgN);
  const base=surf.point.clone().addScaledVector(surf.normal,surfaceOffsetScene()+.008);
  const tangent=B.clone().sub(A).normalize();
  let side=new THREE.Vector3().crossVectors(surf.normal,tangent);
  if(side.lengthSq()<1e-8)side=new THREE.Vector3(1,0,0);
  side.normalize();
  const normal=new THREE.Vector3().crossVectors(tangent,side).normalize();
  return {base,tangent,side,normal};
}
function controlPoint(c){
  const A=nodePosition(c.a),B=nodePosition(c.b);
  const mid=A.clone().lerp(B,.5);
  const avgN=averageNormal(c.a,c.b);
  const surf=castToSurfaceFrom(mid,avgN);
  return surf.point.clone().addScaledVector(surf.normal,surfaceOffsetScene()+.008);
}
function visibleEndpoint(node,toward){
  const center=nodePosition(node);
  if(!node.ringVisible)return center;
  const qInv=node.group.quaternion.clone().invert();
  const d=toward.clone().sub(center).applyQuaternion(qInv);d.z=0;
  if(d.lengthSq()<1e-8)d.set(1,0,0);d.normalize();
  return node.group.localToWorld(d.multiplyScalar(ringMajor(node)+ringTube(node)*.45));
}

function buildBaseCurveFast(c){
  const A=nodePosition(c.a),B=nodePosition(c.b);
  const a=visibleEndpoint(c.a,B);
  const b=visibleEndpoint(c.b,A);

  const straight=new THREE.LineCurve3(a,b);
  const tight=1-THREE.MathUtils.clamp(c.slack/100,0,1);
  const supports=[];
  const N=5;

  // Minimal surface-following during drag.
  for(let i=0;i<N;i++){
    let p=straight.getPoint(i/(N-1));
    if(i>0&&i<N-1&&tight>.15){
      const avgN=averageNormal(c.a,c.b);
      const origin=p.clone().addScaledVector(avgN,.55);
      raycaster.set(origin,avgN.clone().negate());
      const hits=raycaster.intersectObjects(collisionMeshes.length?collisionMeshes:bodyMeshes,true);
      if(hits.length&&hits[0].point.distanceTo(p)<.42){
        const snap=hits[0].point.clone().addScaledVector(worldNormal(hits[0]),surfaceOffsetScene()+.008);
        p.lerp(snap,tight*.55);
      }
    }
    supports.push(p);
  }

  const curve=new THREE.CatmullRomCurve3(supports,false,'centripetal',.5);
  c.baseCurve=curve;
  c.renderCurve=curve;
  return curve;
}

function buildBaseCurve(c){
  const A=nodePosition(c.a),B=nodePosition(c.b);
  const a=visibleEndpoint(c.a,B);
  const b=visibleEndpoint(c.b,A);
  const tight=1-THREE.MathUtils.clamp(c.slack/100,0,1);

  function projectSample(p){
    const avgN=averageNormal(c.a,c.b);
    const origins=[
      p.clone().addScaledVector(avgN,.75),
      p.clone().addScaledVector(avgN,-.75)
    ];
    let best=null,bestD=Infinity;
    for(let j=0;j<2;j++){
      const dir=j===0?avgN.clone().negate():avgN.clone();
      raycaster.set(origins[j],dir);
      const hits=raycaster.intersectObjects(collisionMeshes.length?collisionMeshes:bodyMeshes,true);
      if(hits.length){
        const d=hits[0].point.distanceTo(p);
        if(d<bestD){bestD=d;best=hits[0]}
      }
    }
    if(best&&bestD<.48){
      return best.point.clone().addScaledVector(worldNormal(best),surfaceOffsetScene()+.008);
    }
    return p.clone();
  }

  // Start coarse and recursively add points where the projected surface
  // deviates from a straight segment. Tight curves therefore get more support.
  let samples=[{t:0,p:a.clone()},{t:1,p:b.clone()}];
  for(let pass=0;pass<4;pass++){
    const next=[samples[0]];
    for(let i=0;i<samples.length-1;i++){
      const L=samples[i],R=samples[i+1];
      const tm=(L.t+R.t)/2;
      const linear=L.p.clone().lerp(R.p,.5);
      const projected=projectSample(linear);
      const deviation=projected.distanceTo(linear);
      const segment=L.p.distanceTo(R.p);
      if((deviation>.012 || segment>.20) && next.length<70){
        next.push({t:tm,p:linear.clone().lerp(projected,tight*.88)});
      }
      next.push(R);
    }
    samples=next.sort((x,y)=>x.t-y.t);
  }

  // Final surface projection for interior points.
  const supports=samples.map((s,i)=>{
    if(i===0||i===samples.length-1)return s.p;
    const projected=projectSample(s.p);
    return s.p.clone().lerp(projected,tight*.82);
  });

  // Guarantee enough smooth samples even on flat areas.
  if(supports.length<7){
    supports.length=0;
    const straight=new THREE.LineCurve3(a,b);
    for(let i=0;i<9;i++){
      let p=straight.getPoint(i/8);
      if(i>0&&i<8)p.lerp(projectSample(p),tight*.82);
      supports.push(p);
    }
  }

  const curve=new THREE.CatmullRomCurve3(supports,false,'centripetal',.5);
  c.baseCurve=curve;
  c.renderCurve=curve;
  return curve;
}


const AUTO_CROSS_EPS=.028;
let autoCrossingUpdate=false;
let crossingsDirty=true;
let dragPreviewActive=false;
let fastUpdateScheduled=false;
let pendingFastUpdate=false;



let geometryRevision=0;

function invalidateConnectionCache(c){
  if(c){
    c._sampleCacheRevision=-1;
    c._sampleCache=null;
  }
}

function sampledSegments(c,count=18){
  const curve=c.renderCurve||c.baseCurve;
  if(!curve)return [];

  if(c._sampleCacheRevision===geometryRevision && c._sampleCacheCount===count && c._sampleCache){
    return c._sampleCache;
  }

  const out=[];
  let a=curve.getPoint(0);
  for(let i=1;i<=count;i++){
    const t=i/count,b=curve.getPoint(t);
    out.push({a:a.clone(),b:b.clone(),t0:(i-1)/count,t1:t});
    a=b;
  }

  c._sampleCacheRevision=geometryRevision;
  c._sampleCacheCount=count;
  c._sampleCache=out;
  return out;
}

function closestSegmentPair(p1,q1,p2,q2){
  const u=q1.clone().sub(p1),v=q2.clone().sub(p2),w=p1.clone().sub(p2);
  const a=u.dot(u),b=u.dot(v),c=v.dot(v),d=u.dot(w),e=v.dot(w);
  const D=a*c-b*b;
  let sc=0,tc=0;
  if(D<1e-9){
    sc=0;tc=c>1e-9?THREE.MathUtils.clamp(e/c,0,1):0;
  }else{
    sc=THREE.MathUtils.clamp((b*e-c*d)/D,0,1);
    tc=THREE.MathUtils.clamp((a*e-b*d)/D,0,1);
  }
  const P=p1.clone().addScaledVector(u,sc),Q=p2.clone().addScaledVector(v,tc);
  return {P,Q,sc,tc,dist:P.distanceTo(Q)};
}

function crossingKey(a,b){return [a.id,b.id].sort().join('|')}

function bestCrossing(c1,c2){
  if(c1===c2||c1.a===c2.a||c1.a===c2.b||c1.b===c2.a||c1.b===c2.b)return null;
  let best=null;
  for(const s1 of sampledSegments(c1)){
    for(const s2 of sampledSegments(c2)){
      const cp=closestSegmentPair(s1.a,s1.b,s2.a,s2.b);
      if(cp.dist>AUTO_CROSS_EPS)continue;
      const t1=THREE.MathUtils.lerp(s1.t0,s1.t1,cp.sc),t2=THREE.MathUtils.lerp(s2.t0,s2.t1,cp.tc);
      if(t1<.04||t1>.96||t2<.04||t2>.96)continue;
      if(!best||cp.dist<best.dist)best={t1,t2,dist:cp.dist,pos:cp.P.clone().lerp(cp.Q,.5)};
    }
  }
  return best;
}

function updateCrossNode(n,cross=null){
  if(!n.crossing)return;
  const {c1,c2}=n.crossing;
  cross=cross||bestCrossing(c1,c2);
  if(!cross)return;
  n.crossing.t1=cross.t1;n.crossing.t2=cross.t2;
  const p1=c1.renderCurve.getPoint(cross.t1),p2=c2.renderCurve.getPoint(cross.t2);
  n.group.position.copy(p1).lerp(p2,.5);
  n.normal=averageNormal(c1.a,c1.b).add(averageNormal(c2.a,c2.b)).normalize();
  n.group.quaternion.identity();
}

function createCrossNode(c1,c2,cross){
  const n={
    kind:'node',id:`N${nodes.length+1}`,source:'crossing',group:new THREE.Group(),
    ringVisible:false,diameterMM:40,thicknessMM:6,sizeMM:8,parent:null,t:0,
    normal:new THREE.Vector3(0,0,1),mirrorPartner:null,
    crossing:{c1,c2,t1:cross.t1,t2:cross.t2,key:crossingKey(c1,c2)}
  };
  nodes.push(n);scene.add(n.group);n._visualDirty=true;refreshNodeVisualIfNeeded(n);updateCrossNode(n,cross);return n;
}

function refreshAutomaticCrossings(){
  if(autoCrossingUpdate||!crossingsDirty)return;
  autoCrossingUpdate=true;
  try{
    const wanted=new Map();
    for(let i=0;i<connections.length;i++)for(let j=i+1;j<connections.length;j++){
      const c1=connections[i],c2=connections[j],cross=bestCrossing(c1,c2);
      if(cross)wanted.set(crossingKey(c1,c2),{c1,c2,cross});
    }

    const autos=nodes.filter(n=>n.source==='crossing');
    for(const n of autos.slice()){
      if(!wanted.has(n.crossing.key)){
        if(selected===n)selected=null;
        scene.remove(n.group);const k=nodes.indexOf(n);if(k>=0)nodes.splice(k,1);
      }
    }

    for(const [key,item] of wanted){
      let n=nodes.find(x=>x.source==='crossing'&&x.crossing.key===key);
      if(!n)n=createCrossNode(item.c1,item.c2,item.cross);
      else updateCrossNode(n,item.cross);
    }
  }finally{autoCrossingUpdate=false;crossingsDirty=false}
}

function strapNodesOn(c){return nodes.filter(n=>n.source==='strap'&&n.parent===c).sort((x,y)=>x.t-y.t)}
function updateStrapNode(n){
  if(!n.parent?.baseCurve)return;
  const t=THREE.MathUtils.clamp(n.t,0,1),curve=n.parent.baseCurve;
  const p=curve.getPoint(t),tan=curve.getTangent(t).normalize();
  const avgN=averageNormal(n.parent.a,n.parent.b);
  let side=new THREE.Vector3().crossVectors(avgN,tan);if(side.lengthSq()<1e-8)side.set(1,0,0);side.normalize();
  n.normal=new THREE.Vector3().crossVectors(tan,side).normalize();
  n.group.position.copy(p);n.group.quaternion.identity();
}

function ribbonGeometry(points,widthMM,thicknessMM=2.5){
  const halfW=Math.max(.0002,.15*(widthMM/30)*.5);
  const halfT=.009*(thicknessMM/2.5);
  const verts=[],idx=[],uv=[],frames=[];

  let prevNormal=null,prevSide=null;
  for(let i=0;i<points.length;i++){
    const prev=points[Math.max(0,i-1)];
    const next=points[Math.min(points.length-1,i+1)];
    const tangent=next.clone().sub(prev).normalize();

    // Start from a stable construction-surface normal, not the camera.
    let normal=prevNormal?prevNormal.clone():new THREE.Vector3(0,0,1);
    const probeBase=prevNormal||averageNormal({normal:new THREE.Vector3(0,0,1)},{normal:new THREE.Vector3(0,0,1)});
    const origins=[
      points[i].clone().addScaledVector(probeBase,.35),
      points[i].clone().addScaledVector(probeBase,-.35)
    ];
    let best=null,bestD=Infinity;
    for(let j=0;j<2;j++){
      const dir=j===0?probeBase.clone().negate():probeBase.clone();
      raycaster.set(origins[j],dir);
      const hits=raycaster.intersectObjects(collisionMeshes.length?collisionMeshes:bodyMeshes,true);
      if(hits.length){
        const d=hits[0].point.distanceTo(points[i]);
        if(d<bestD){bestD=d;best=hits[0]}
      }
    }
    if(best&&bestD<.45)normal=worldNormal(best);

    normal.addScaledVector(tangent,-normal.dot(tangent));
    if(normal.lengthSq()<1e-8)normal=prevNormal?prevNormal.clone():new THREE.Vector3(0,1,0);
    normal.normalize();

    // Never permit a sudden normal hemisphere flip.
    if(prevNormal&&normal.dot(prevNormal)<0)normal.negate();

    let side=new THREE.Vector3().crossVectors(normal,tangent);
    if(side.lengthSq()<1e-8&&prevSide)side.copy(prevSide);
    if(side.lengthSq()<1e-8)side.set(1,0,0);
    side.normalize();

    normal=new THREE.Vector3().crossVectors(tangent,side).normalize();

    // Preserve handedness continuously from one sample to the next.
    if(prevSide&&side.dot(prevSide)<0){
      side.negate();normal.negate();
    }
    if(prevNormal&&normal.dot(prevNormal)<0){
      side.negate();normal.negate();
    }

    frames.push({side:side.clone(),normal:normal.clone()});
    prevSide=side.clone();prevNormal=normal.clone();
  }

  for(let i=0;i<points.length;i++){
    const p=points[i],f=frames[i];
    const l=p.clone().addScaledVector(f.side,-halfW);
    const r=p.clone().addScaledVector(f.side,halfW);
    const tl=l.clone().addScaledVector(f.normal,halfT);
    const tr=r.clone().addScaledVector(f.normal,halfT);
    const bl=l.clone().addScaledVector(f.normal,-halfT);
    const br=r.clone().addScaledVector(f.normal,-halfT);
    [tl,tr,bl,br].forEach(v=>verts.push(v.x,v.y,v.z));
    const u=i/(points.length-1);uv.push(0,u,1,u,0,u,1,u);
  }

  for(let i=0;i<points.length-1;i++){
    const a=i*4,b=(i+1)*4;
    idx.push(a,a+1,b,a+1,b+1,b,a+2,b+2,a+3,a+3,b+2,b+3,a+2,a,b+2,a,b,b+2,a+1,a+3,b+1,a+3,b+3,b+1);
  }

  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  g.setIndex(idx);g.computeVertexNormals();return g;
}

function ribbonGeometryFast(points,widthMM,thicknessMM=2.5){
  const halfW=Math.max(.0002,.15*(widthMM/30)*.5);
  const halfT=.009*(thicknessMM/2.5);
  const verts=[],idx=[],uv=[];
  let prevSide=null;

  for(let i=0;i<points.length;i++){
    const prev=points[Math.max(0,i-1)];
    const next=points[Math.min(points.length-1,i+1)];
    const tangent=next.clone().sub(prev).normalize();

    let normal=new THREE.Vector3(0,0,1);
    let side=new THREE.Vector3().crossVectors(normal,tangent);
    if(side.lengthSq()<1e-8){
      normal.set(0,1,0);
      side.crossVectors(normal,tangent);
    }
    side.normalize();

    if(prevSide&&side.dot(prevSide)<0)side.negate();
    prevSide=side.clone();

    normal=new THREE.Vector3().crossVectors(tangent,side).normalize();

    const p=points[i];
    const l=p.clone().addScaledVector(side,-halfW);
    const r=p.clone().addScaledVector(side,halfW);
    const tl=l.clone().addScaledVector(normal,halfT);
    const tr=r.clone().addScaledVector(normal,halfT);
    const bl=l.clone().addScaledVector(normal,-halfT);
    const br=r.clone().addScaledVector(normal,-halfT);
    [tl,tr,bl,br].forEach(v=>verts.push(v.x,v.y,v.z));
    const u=i/(points.length-1);
    uv.push(0,u,1,u,0,u,1,u);
  }

  for(let i=0;i<points.length-1;i++){
    const a=i*4,b=(i+1)*4;
    idx.push(
      a,a+1,b,a+1,b+1,b,
      a+2,b+2,a+3,a+3,b+2,b+3,
      a+2,a,b+2,a,b,b+2,
      a+1,a+3,b+1,a+3,b+3,b+1
    );
  }

  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function addRibbonFast(c,points){
  if(points.length<2)return;
  const mesh=new THREE.Mesh(
    ribbonGeometryFast(points,c.widthMM),
    new THREE.MeshStandardMaterial({
      color:0x171718,
      roughness:.5,
      metalness:0,
      side:THREE.DoubleSide,
      emissive:selected===c?0x2c271d:0x000000,
      emissiveIntensity:selected===c?.75:0
    })
  );
  mesh.castShadow=false;
  mesh.receiveShadow=false;
  mesh.userData={kind:'connectionMesh',owner:c};
  c.group.add(mesh);
}

function addRibbon(c,points){
  if(points.length<2)return;
  const mesh=new THREE.Mesh(ribbonGeometry(points,c.widthMM),new THREE.MeshStandardMaterial({
    color:0x171718,roughness:.5,metalness:0,side:THREE.DoubleSide,
    emissive:selected===c?0x2c271d:0x000000,emissiveIntensity:selected===c?.75:0
  }));
  mesh.castShadow=false;mesh.receiveShadow=false;mesh.userData={kind:'connectionMesh',owner:c};c.group.add(mesh);
}

function renderConnectionFast(c){
  while(c.group.children.length){
    const q=c.group.children.pop();
    q.geometry?.dispose?.();
    q.material?.dispose?.();
  }

  const curve=c.baseCurve;
  if(!curve)return;

  const pts=[];
  const count=12;
  for(let i=0;i<=count;i++){
    pts.push(curve.getPoint(i/count));
  }
  addRibbonFast(c,pts);
}

function renderConnection(c){
  while(c.group.children.length){const q=c.group.children.pop();q.geometry?.dispose?.();q.material?.dispose?.()}
  const curve=c.baseCurve;if(!curve)return;

  const split=strapNodesOn(c).filter(n=>n.ringVisible);
  const breaks=[{t:0,node:c.a,start:true},...split.map(n=>({t:n.t,node:n})),{t:1,node:c.b,end:true}];

  for(let s=0;s<breaks.length-1;s++){
    const L=breaks[s],R=breaks[s+1],pts=[];
    const count=Math.max(8,Math.ceil((R.t-L.t)*42));
    for(let i=0;i<=count;i++)pts.push(curve.getPoint(THREE.MathUtils.lerp(L.t,R.t,i/count)));

    if(L.t>0&&L.node?.ringVisible&&pts.length>1){
      pts[0]=visibleEndpoint(L.node,pts[1]);
    }
    if(R.t<1&&R.node?.ringVisible&&pts.length>1){
      pts[pts.length-1]=visibleEndpoint(R.node,pts[pts.length-2]);
    }
    addRibbon(c,pts);
  }

}


function updateFastGeometry(){
  geometryRevision++;

  // Fast preview intentionally skips:
  // - automatic crossings
  // - ring wrap regeneration
  // - expensive node visual rebuilds
  // - multi-pass solver
  //
  // It only rebuilds strap curves + strap mesh positions enough for smooth dragging.
  for(const c of connections){
    buildBaseCurveFast(c);
  }
  for(const n of nodes){
    if(n.source==='strap')updateStrapNode(n);
  }
  for(const c of connections){
    renderConnectionFast(c);
  }
  refreshSelectionVisuals();
}

function scheduleFastGeometryUpdate(){
  pendingFastUpdate=true;
  if(fastUpdateScheduled)return;
  fastUpdateScheduled=true;

  requestAnimationFrame(()=>{
    fastUpdateScheduled=false;
    if(!pendingFastUpdate)return;
    pendingFastUpdate=false;
    updateFastGeometry();
  });
}

function updateAllGeometry(){
  geometryRevision++;
  crossingsDirty=true;
  for(const n of nodes)if(n.source==='surface')updateSurfaceNodeTransform(n);
  for(let pass=0;pass<3;pass++){
    for(const c of connections)buildBaseCurve(c);
    for(const n of nodes)if(n.source==='strap')updateStrapNode(n);
  }
  for(const c of connections)renderConnection(c);
  refreshAutomaticCrossings();
  for(const n of nodes){
    if(n.source==='crossing')updateCrossNode(n);
    if(n._visualDirty)refreshNodeVisualIfNeeded(n);
  }
  refreshSelectionVisuals();
}
function paired(o){return o?.mirrorPartner&&o.mirrorPartner!==o}


let isolatedObject=null,history=[],future=[],historyBusy=false,historyTimer=null;

function objectVisible(o){return o?.group?.visible!==false}
function setObjectVisibility(o,on){if(o?.group)o.group.visible=on}

function captureState(){
  return {
    nodes:nodes.filter(n=>n.source!=='crossing').map(n=>({
      id:n.id,source:n.source,ringVisible:n.ringVisible,diameterMM:n.diameterMM,thicknessMM:n.thicknessMM,sizeMM:n.sizeMM,
      t:n.t,locked:!!n.locked,hidden:!objectVisible(n),
      pos:n.group.position.toArray(),normal:n.normal?.toArray?.()||[0,0,1],
      surfacePoint:n.surfacePoint?.toArray?.()||null
    })),
    connections:connections.map(c=>({id:c.id,a:c.a.id,b:c.b.id,widthMM:c.widthMM,slack:c.slack,locked:!!c.locked,hidden:!objectVisible(c)}))
  };
}
function stateSignature(s){return JSON.stringify(s)}
function rememberState(){
  if(historyBusy)return;
  clearTimeout(historyTimer);
  historyTimer=setTimeout(()=>{
    const s=captureState(),sig=stateSignature(s);
    if(history.length&&history[history.length-1].sig===sig)return;
    history.push({sig,state:s});if(history.length>40)history.shift();future.length=0;updateHistoryUI();saveProject();
  },80);
}
function updateHistoryUI(){undoBtn.disabled=history.length<2;redoBtn.disabled=!future.length}
function saveProject(){try{localStorage.setItem('harnessDesignerAutosave',JSON.stringify(captureState()))}catch{}}
function vibrate(ms=8){try{navigator.vibrate?.(ms)}catch{}}

function applyState(s){
  historyBusy=true;
  try{
    resetHarness();
    const map=new Map();
    for(const d of s.nodes){
      const n={kind:'node',id:d.id,source:'surface',group:new THREE.Group(),ringVisible:d.ringVisible,diameterMM:d.diameterMM,thicknessMM:d.thicknessMM,sizeMM:d.sizeMM,parent:null,t:d.t||0,normal:new THREE.Vector3().fromArray(d.normal||[0,0,1]),mirrorPartner:null,locked:!!d.locked};
      n.surfacePoint=d.surfacePoint?new THREE.Vector3().fromArray(d.surfacePoint):new THREE.Vector3().fromArray(d.pos);
      nodes.push(n);scene.add(n.group);updateSurfaceNodeTransform(n);setObjectVisibility(n,!d.hidden);map.set(n.id,n);
    }
    for(const d of s.connections){
      const a=map.get(d.a),b=map.get(d.b);if(!a||!b)continue;
      const c=createConnection(a,b,true);c.id=d.id;c.widthMM=d.widthMM;c.slack=d.slack;c.locked=!!d.locked;setObjectVisibility(c,!d.hidden);
    }
    selected=null;hideSelection();updateAllGeometry();
  }finally{historyBusy=false}
}
function undo(){
  if(history.length<2)return;
  future.push(history.pop());
  applyState(history[history.length-1].state);updateHistoryUI();saveProject();vibrate();
}
function redo(){
  if(!future.length)return;
  const item=future.pop();history.push(item);applyState(item.state);updateHistoryUI();saveProject();vibrate();
}
function updateQuickActions(){if(!selected)return;lockSelectedBtn.classList.toggle('active',!!selected.locked);lockSelectedBtn.textContent='';}
function clearIsolation(){
  isolatedObject=null;document.body.classList.remove('object-isolated');
  for(const n of nodes)setObjectVisibility(n,!n.hiddenByUser);
  for(const c of connections)setObjectVisibility(c,!c.hiddenByUser);
}
function selectObject(o){
  selected=o;refreshSelectionVisuals();showSelection();updateQuickActions();updateNodeParameterVisibility();vibrate(5);
}
function refreshSelectionVisuals(){
  for(const n of nodes){
    for(const child of n.group.children){
      if(child.userData?.kind==='nodeVisual'){
        if(n.ringVisible){
          child.material=(selected===n)?metalSelected:metalMat;
        }else{
          child.material=(selected===n)?pointSelected:pointMat;
        }
      }
    }
  }

  for(const c of connections){
    for(const child of c.group.children){
      if(child.userData?.kind==='connectionMesh'&&child.material){
        child.material.emissive.setHex(selected===c?0x2c271d:0x000000);
        child.material.emissiveIntensity=selected===c?.75:0;
      }
    }
  }

  mirrorSelectedBtn?.classList.toggle('paired',paired(selected));
}
function hideSelection(){
  selectionPanel.classList.add('hidden');ringControls.classList.add('hidden');strapControls.classList.add('hidden');strapAnchorControls.classList.add('hidden');
}
function setMiniToggle(btn,on){btn.classList.toggle('active',on);btn.setAttribute('aria-pressed',on?'true':'false');btn.textContent=on?'An':'Aus'}
function showSelection(){
  if(mode!=='build'||!selected){hideSelection();return}
  selectionPanel.classList.remove('hidden');
  ringControls.classList.add('hidden');
  strapControls.classList.add('hidden');
  strapAnchorControls.classList.add('hidden');

  if(selected.kind==='node'){
    // Every visible ring uses exactly the same ring editor.
    if(selected.ringVisible){
      strapAnchorSlider.disabled=false;
      ringControls.classList.remove('hidden');
      selectionLabel.textContent='RING';
      selectionTitle.textContent=selected.id;
      ringDiameterSlider.value=selected.diameterMM;
      ringDiameterValue.textContent=selected.diameterMM;
      ringThicknessSlider.value=selected.thicknessMM;
      ringThicknessValue.textContent=selected.thicknessMM;
      surfaceNodeSizeSlider.value=selected.sizeMM;
      surfaceNodeSizeValue.textContent=selected.sizeMM;
      setMiniToggle(surfaceNodeRingToggle,true);
    }else if(selected.source==='strap'||selected.source==='crossing'){
      strapAnchorControls.classList.remove('hidden');
      selectionLabel.textContent=selected.source==='crossing'?'KREUZUNGS-KNOTEN':'RIEMEN-ANKER';
      selectionTitle.textContent=selected.id;
      strapAnchorSlider.value=Math.round(selected.t*100);
      strapAnchorSlider.disabled=selected.source==='crossing';
      strapAnchorValue.textContent=selected.source==='crossing'?'Auto':Math.round(selected.t*100);
      strapAnchorSizeSlider.value=selected.sizeMM;
      strapAnchorSizeValue.textContent=selected.sizeMM;
      setMiniToggle(strapNodeRingToggle,false);
    }else{
      strapAnchorSlider.disabled=false;
      // Surface node without a visible ring.
      ringControls.classList.remove('hidden');
      selectionLabel.textContent='KNOTEN';
      selectionTitle.textContent=selected.id;
      ringDiameterSlider.value=selected.diameterMM;
      ringDiameterValue.textContent=selected.diameterMM;
      ringThicknessSlider.value=selected.thicknessMM;
      ringThicknessValue.textContent=selected.thicknessMM;
      surfaceNodeSizeSlider.value=selected.sizeMM;
      surfaceNodeSizeValue.textContent=selected.sizeMM;
      setMiniToggle(surfaceNodeRingToggle,false);
    }
  }else{
    strapControls.classList.remove('hidden');
    selectionLabel.textContent='RIEMEN';
    selectionTitle.textContent=selected.id;
    widthSlider.value=selected.widthMM;
    widthValue.textContent=selected.widthMM;
    slackSlider.value=selected.slack;
  }
}


function splitConnectionAtNode(node){
  if(node.source!=='strap'||!node.parent||node._split)return;
  const parent=node.parent;
  const originalA=parent.a,originalB=parent.b;
  const width=parent.widthMM,slack=parent.slack;
  const splitT=THREE.MathUtils.clamp(node.t,.001,.999);
  const siblings=nodes.filter(n=>n!==node&&n.source==='strap'&&n.parent===parent);
  const splitPosition=node.group.position.clone();

  // Give the new real ring a body-surface reference immediately.
  const avgN=averageNormal(parent.a,parent.b);
  const surface=castToSurfaceFrom(splitPosition,avgN);
  node.surfacePoint=surface.point.clone();
  node.normal=surface.normal.clone();

  scene.remove(parent.group);
  const pi=connections.indexOf(parent);if(pi>=0)connections.splice(pi,1);
  node.source='split';
  node.parent=null;
  seatRingOnSurface(node);
  const left=createConnection(originalA,node,true),right=createConnection(node,originalB,true);
  left.widthMM=right.widthMM=width;left.slack=right.slack=slack;
  node._split={left,right,originalA,originalB,originalT:splitT};
  for(const s of siblings){
    if(s.t<splitT){s.parent=left;s.t=s.t/splitT;}
    else{s.parent=right;s.t=(s.t-splitT)/(1-splitT);}
  }
  updateAllGeometry();
  if(selected===node)showSelection();
}

function mergeSplitNode(node){
  if(!node._split)return;
  const {left,right,originalA,originalB,originalT}=node._split;
  const leftNodes=nodes.filter(n=>n.source==='strap'&&n.parent===left);
  const rightNodes=nodes.filter(n=>n.source==='strap'&&n.parent===right);
  const width=left?.widthMM??right?.widthMM??30,slack=left?.slack??right?.slack??8;
  for(const c of [left,right]){if(!c)continue;scene.remove(c.group);const i=connections.indexOf(c);if(i>=0)connections.splice(i,1);}
  const merged=createConnection(originalA,originalB,true);merged.widthMM=width;merged.slack=slack;
  for(const s of leftNodes){s.parent=merged;s.t=s.t*originalT;}
  for(const s of rightNodes){s.parent=merged;s.t=originalT+s.t*(1-originalT);}
  node.source='strap';node.parent=merged;node.t=originalT;node._split=null;
  updateAllGeometry();
  if(selected===node)showSelection();
}

function removeConnection(c){
  const stale=nodes.filter(n=>n.source==='crossing'&&(n.crossing?.c1===c||n.crossing?.c2===c)).slice();
  for(const n of stale){scene.remove(n.group);const ni=nodes.indexOf(n);if(ni>=0)nodes.splice(ni,1)}
  const attached=nodes.filter(n=>n.source==='strap'&&n.parent===c).slice();
  attached.forEach(removeNode);
  if(c.mirrorPartner&&c.mirrorPartner!==c)c.mirrorPartner.mirrorPartner=null;
  scene.remove(c.group);const i=connections.indexOf(c);if(i>=0)connections.splice(i,1);
}
function removeNode(n){
  connections.filter(c=>c.a===n||c.b===n).slice().forEach(removeConnection);
  if(n.source==='strap'){
    // removing a strap node simply restores a continuous parent strap
  }
  if(n.mirrorPartner&&n.mirrorPartner!==n)n.mirrorPartner.mirrorPartner=null;
  scene.remove(n.group);const i=nodes.indexOf(n);if(i>=0)nodes.splice(i,1);
}
function resetHarness(){
  connections.slice().forEach(removeConnection);
  nodes.slice().forEach(n=>{scene.remove(n.group)});
  nodes.length=0;selected=null;connectStart=null;hideSelection();refreshSelectionVisuals();
}
resetBtn.addEventListener('click',resetHarness);
deleteSelectedBtn.addEventListener('click',()=>{
  if(!selected)return;
  if(selected.kind==='node')removeNode(selected);else removeConnection(selected);
  selected=null;hideSelection();updateAllGeometry();rememberState();
});
lockSelectedBtn.addEventListener('click',()=>{if(!selected)return;selected.locked=!selected.locked;updateQuickActions();rememberState();vibrate()});


undoBtn.addEventListener('click',undo);redoBtn.addEventListener('click',redo);
moreBtn?.addEventListener('click',e=>{e.stopPropagation();moreMenu?.classList.toggle('hidden')});
document.addEventListener('pointerdown',e=>{if(moreMenu&&!moreMenu.classList.contains('hidden')&&!e.target.closest('#moreMenu,#moreBtn'))moreMenu.classList.add('hidden')});



ringDiameterSlider.addEventListener('input',()=>{
  if(selected?.kind!=='node')return;
  selected.diameterMM=+ringDiameterSlider.value;ringDiameterValue.textContent=ringDiameterSlider.value;markNodeVisualDirty(selected);
  if(paired(selected)){selected.mirrorPartner.diameterMM=selected.diameterMM;markNodeVisualDirty(selected.mirrorPartner)}
  updateAllGeometry();
});
ringThicknessSlider.addEventListener('input',()=>{
  if(selected?.kind!=='node')return;
  selected.thicknessMM=+ringThicknessSlider.value;ringThicknessValue.textContent=ringThicknessSlider.value;markNodeVisualDirty(selected);
  if(paired(selected))selected.mirrorPartner.thicknessMM=selected.thicknessMM;markNodeVisualDirty(selected.mirrorPartner);
  updateAllGeometry();
});
surfaceNodeSizeSlider.addEventListener('input',()=>{
  if(selected?.kind!=='node')return;
  selected.sizeMM=+surfaceNodeSizeSlider.value;surfaceNodeSizeValue.textContent=surfaceNodeSizeSlider.value;markNodeVisualDirty(selected);
  if(paired(selected))selected.mirrorPartner.sizeMM=selected.sizeMM;markNodeVisualDirty(selected.mirrorPartner);updateAllGeometry();
});
surfaceNodeRingToggle.addEventListener('click',()=>{
  if(selected?.kind!=='node')return;

  if(selected.source==='strap'&&!selected.ringVisible){
    selected.ringVisible=true;
    splitConnectionAtNode(selected);
  }else if(selected.source==='split'&&selected.ringVisible){
    selected.ringVisible=false;
    mergeSplitNode(selected);
  }else{
    selected.ringVisible=!selected.ringVisible;markNodeVisualDirty(selected);
  }

  if(paired(selected)){
    selected.mirrorPartner.ringVisible=selected.ringVisible;
  }

  updateAllGeometry();
  showSelection();updateNodeParameterVisibility();
});

function convertCrossingToRing(node){
  if(node.source!=='crossing'||node.ringVisible)return;
  const x=node.crossing,c1=x.c1,c2=x.c2;
  if(!connections.includes(c1)||!connections.includes(c2))return;

  const surface=castToSurfaceFrom(node.group.position.clone(),node.normal.clone());
  node.surfacePoint=surface.point.clone();
  node.normal=surface.normal.clone();
  node.source='crossingRing';
  node.ringVisible=true;

  function splitConn(c){
    const A=c.a,B=c.b,w=c.widthMM,s=c.slack;
    scene.remove(c.group);const ci=connections.indexOf(c);if(ci>=0)connections.splice(ci,1);
    const l=createConnection(A,node,true),r=createConnection(node,B,true);
    l.widthMM=r.widthMM=w;l.slack=r.slack=s;
  }
  splitConn(c1);splitConn(c2);
  seatRingOnSurface(node);
  updateAllGeometry();
}

strapNodeRingToggle.addEventListener('click',()=>{
  if(selected?.kind!=='node')return;

  if(selected.source==='crossing'&&!selected.ringVisible){
    convertCrossingToRing(selected);
  }else if(selected.source==='strap'&&!selected.ringVisible){
    selected.ringVisible=true;
    splitConnectionAtNode(selected);
  }else if(selected.source==='split'&&selected.ringVisible){
    selected.ringVisible=false;
    mergeSplitNode(selected);
  }else{
    selected.ringVisible=!selected.ringVisible;markNodeVisualDirty(selected);
  }

  if(paired(selected))selected.mirrorPartner.ringVisible=selected.ringVisible;
  updateAllGeometry();
  showSelection();updateNodeParameterVisibility();
});
widthSlider.addEventListener('input',()=>{
  if(selected?.kind!=='connection')return;
  selected.widthMM=+widthSlider.value;widthValue.textContent=widthSlider.value;
  if(paired(selected))selected.mirrorPartner.widthMM=selected.widthMM;updateAllGeometry();
});
slackSlider.addEventListener('input',()=>{
  if(selected?.kind!=='connection')return;
  selected.slack=+slackSlider.value;
  if(paired(selected))selected.mirrorPartner.slack=selected.slack;updateAllGeometry();
});
addStrapAnchorBtn.addEventListener('click',()=>{
  if(selected?.kind!=='connection')return;
  const n=createStrapNode(selected,.5);
  selectObject(n);
});
strapAnchorSlider.addEventListener('input',()=>{
  if(selected?.kind!=='node'||selected.source!=='strap')return;
  selected.t=+strapAnchorSlider.value/100;strapAnchorValue.textContent=strapAnchorSlider.value;
  if(paired(selected))selected.mirrorPartner.t=selected.t;updateAllGeometry();
});
strapAnchorSizeSlider.addEventListener('input',()=>{
  if(selected?.kind!=='node'||selected.source!=='strap')return;
  selected.sizeMM=+strapAnchorSizeSlider.value;strapAnchorSizeValue.textContent=strapAnchorSizeSlider.value;markNodeVisualDirty(selected);
  if(paired(selected))selected.mirrorPartner.sizeMM=selected.sizeMM;markNodeVisualDirty(selected.mirrorPartner);updateAllGeometry();
});


function closestTOnConnectionScreen(connection,clientX,clientY){
  if(!connection?.baseCurve)return 0.5;
  const rect=canvas.getBoundingClientRect();
  let bestT=0,bestD=Infinity;

  // Dense enough for precise touch dragging, still inexpensive for one selected node.
  const N=96;
  for(let i=0;i<=N;i++){
    const t=i/N;
    const p=connection.baseCurve.getPoint(t).clone().project(camera);
    const sx=rect.left+(p.x+1)*0.5*rect.width;
    const sy=rect.top+(1-p.y)*0.5*rect.height;
    const d=(sx-clientX)*(sx-clientX)+(sy-clientY)*(sy-clientY);
    if(d<bestD){bestD=d;bestT=t}
  }
  return bestT;
}

function interactiveHit(x,y){
  setPointerXY(x,y);
  const nodeObjects=[];
  for(const n of nodes)nodeObjects.push(...n.group.children);
  const h1=raycaster.intersectObjects(nodeObjects,true)[0];
  if(h1?.object?.userData?.owner)return {kind:'node',owner:h1.object.userData.owner};
  const meshObjects=[];
  for(const c of connections){
    for(const ch of c.group.children){
      if(ch.userData?.kind==='connectionMesh')meshObjects.push(ch);
    }
  }
  const hm=raycaster.intersectObjects(meshObjects,true)[0];
  if(hm)return {kind:'connection',owner:hm.object.userData.owner};
  return null;
}

function setBuildTool(t){
  buildTool=t;toolButtons.forEach(b=>b.classList.toggle('active',b.dataset.tool===t));connectStart=null;
}
toolButtons.forEach(b=>b.addEventListener('click',()=>setBuildTool(b.dataset.tool)));

mirrorToggle.addEventListener('click',()=>{
  mirrorMode=!mirrorMode;mirrorToggle.classList.toggle('active',mirrorMode);mirrorToggle.setAttribute('aria-pressed',mirrorMode?'true':'false');showToast(mirrorMode?'Spiegelmodus an':'Spiegelmodus aus');
});
mirrorSelectedBtn.addEventListener('click',()=>{if(!selected)return showToast('Erst Objekt auswählen');mirrorSelectedObject()});

function switchMode(next){
  mode=next;modeButtons.forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));modeTitle.textContent=mode==='build'?'Build':mode==='accessories'?'Accessories':'Photo';
  selectionPanel.classList.add('hidden');accessoryPanel.classList.add('hidden');photoPanel.classList.add('hidden');
  buildTools.style.display=mode==='build'?'flex':'none';
  const helpers=mode==='build';nodes.forEach(n=>n.group.visible=helpers);
  if(mode==='build')showSelection();if(mode==='accessories')accessoryPanel.classList.remove('hidden');if(mode==='photo')photoPanel.classList.remove('hidden');
}
modeButtons.forEach(b=>b.addEventListener('click',()=>switchMode(b.dataset.mode)));

const pointers=new Map();let single=null,twoStart=null;const TAP=9;
function pinfo(e){return{x:e.clientX,y:e.clientY,px:e.clientX,py:e.clientY}}
canvas.addEventListener('pointerdown',e=>{
  canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,pinfo(e));
  if(pointers.size===1){
    const hit=mode==='build'?interactiveHit(e.clientX,e.clientY):null;
    if(hit?.kind==='node')selectObject(hit.owner);
    if(hit?.kind==='connection')selectObject(hit.owner);
    single={id:e.pointerId,sx:e.clientX,sy:e.clientY,lx:e.clientX,ly:e.clientY,hit};
  }else if(pointers.size===2){
    single=null;const[a,b]=[...pointers.values()];
    twoStart={dist:Math.hypot(b.x-a.x,b.y-a.y),cx:(a.x+b.x)/2,cy:(a.y+b.y)/2,az:camAz,d:camDist,ty:target.y};
  }
});
canvas.addEventListener('pointermove',e=>{
  const p=pointers.get(e.pointerId);if(!p)return;p.px=p.x;p.py=p.y;p.x=e.clientX;p.y=e.clientY;
  if(pointers.size===2){
    const[a,b]=[...pointers.values()],dist=Math.max(20,Math.hypot(b.x-a.x,b.y-a.y)),cx=(a.x+b.x)/2,cy=(a.y+b.y)/2;
    camDist=THREE.MathUtils.clamp(twoStart.d*(twoStart.dist/dist),3.1,7.2);camAz=twoStart.az-(cx-twoStart.cx)*.006;target.y=THREE.MathUtils.clamp(twoStart.ty+(cy-twoStart.cy)*.004,-.75,.85);updateCamera();return;
  }
  if(!single||single.id!==e.pointerId)return;

  if(single.hit?.kind==='node'){
    const node=single.hit.owner;
    if(node.locked){single.lx=e.clientX;single.ly=e.clientY;return}
    const d=Math.hypot(e.clientX-single.sx,e.clientY-single.sy);

    // Body-attached rings, including rings converted from strap anchors,
    // are fully draggable on the construction surface.
    if((node.source==='surface'||node.source==='split'||node.source==='crossingRing') && d>6){
      let h=bodyHitXY(e.clientX,e.clientY);
      if(h){
        h=snapHitToAxis(h);
        node.surfacePoint=h.point.clone();
        node.normal=worldNormal(h);

        if(node.source==='split'||node.source==='crossingRing'){
          // A split-ring is now a real spatial node: its two straps simply use
          // its current position as their shared endpoint.
          seatRingOnSurface(node);
        }

        if(node.mirrorPartner&&Math.abs(node.surfacePoint.x)>.012){
          const mh=mirroredBodyHit(node.group.position);
          if(mh){
            node.mirrorPartner.surfacePoint=mh.point.clone();
            node.mirrorPartner.normal=worldNormal(mh);
            if(node.mirrorPartner.source==='split'||node.mirrorPartner.source==='crossingRing'){
              seatRingOnSurface(node.mirrorPartner);
            }
          }
        }
        dragPreviewActive=true;
        scheduleFastGeometryUpdate();
      }
      single.lx=e.clientX;single.ly=e.clientY;return;
    }

    // A normal strap anchor is dragged ALONG its parent strap.
    if(node.source==='strap' && node.parent && d>4){
      node.t=closestTOnConnectionScreen(node.parent,e.clientX,e.clientY);
      if(paired(node))node.mirrorPartner.t=node.t;
      dragPreviewActive=true;
      scheduleFastGeometryUpdate();
      showSelection();
      single.lx=e.clientX;single.ly=e.clientY;return;
    }
  }


  const ddx=e.clientX-single.lx,ddy=e.clientY-single.ly;camAz-=ddx*.009;camEl=THREE.MathUtils.clamp(camEl+ddy*.006,-.72,.72);updateCamera();single.lx=e.clientX;single.ly=e.clientY;
});
canvas.addEventListener('pointerup',e=>{
  if(dragPreviewActive){
    dragPreviewActive=false;
    pendingFastUpdate=false;
    updateAllGeometry();
  }
  rememberState();
  pointers.delete(e.pointerId);if(pointers.size<2)twoStart=null;
  if(single&&single.id===e.pointerId&&Math.hypot(e.clientX-single.sx,e.clientY-single.sy)<=TAP&&mode==='build'){
    const ih=single.hit;
    if(ih?.kind==='node'){
      selectObject(ih.owner);
      if(buildTool==='connect'){
        if(!connectStart){connectStart=ih.owner;showToast('Zweiten Knoten antippen')}
        else{const c=createConnection(connectStart,ih.owner);connectStart=null;if(c)selectObject(c)}
      }
    }else if(ih?.kind==='connection'){
      selectObject(ih.owner);
    }else if(buildTool==='ring'){
      const h=bodyHitXY(e.clientX,e.clientY);if(h)selectObject(createSurfaceNode(h,true));
    }
  }
  single=null;try{canvas.releasePointerCapture(e.pointerId)}catch{}
});
canvas.addEventListener('pointercancel',e=>{
  pointers.delete(e.pointerId);
  if(dragPreviewActive){
    dragPreviewActive=false;
    pendingFastUpdate=false;
    updateAllGeometry();
  }
  single=null;
  twoStart=null;
});

function syncRotationUI(){
  const d=180/Math.PI;rotXSlider.value=Math.round(mannequin.rotation.x*d);rotYSlider.value=Math.round(mannequin.rotation.y*d);rotZSlider.value=Math.round(mannequin.rotation.z*d);
  rotXValue.textContent=rotXSlider.value;rotYValue.textContent=rotYSlider.value;rotZValue.textContent=rotZSlider.value;
  surfaceOffsetSlider.value=surfaceOffsetMM;surfaceOffsetValue.textContent=surfaceOffsetMM;
  envelopeSmoothSlider.value=envelopeSmoothPct;envelopeSmoothValue.textContent=envelopeSmoothPct;
  envelopeInflateSlider.value=envelopeInflateMM;envelopeInflateValue.textContent=envelopeInflateMM;setEnvelopeVisible(envelopeVisible);
}
rotateModelBtn.addEventListener('click',()=>{rotationPanel.classList.toggle('hidden');rotateModelBtn.classList.toggle('active',!rotationPanel.classList.contains('hidden'));syncRotationUI()});
closeRotationBtn.addEventListener('click',()=>{rotationPanel.classList.add('hidden');rotateModelBtn.classList.remove('active')});
function applyRotation(){
  const r=Math.PI/180;mannequin.rotation.set(+rotXSlider.value*r,+rotYSlider.value*r,+rotZSlider.value*r);mannequin.updateMatrixWorld(true);rebuildEnvelope();resetHarness();
  rotXValue.textContent=rotXSlider.value;rotYValue.textContent=rotYSlider.value;rotZValue.textContent=rotZSlider.value;
}
[rotXSlider,rotYSlider,rotZSlider].forEach(s=>s.addEventListener('input',applyRotation));
rotationResetBtn.addEventListener('click',()=>{mannequin.rotation.set(0,0,0);mannequin.updateMatrixWorld(true);rebuildEnvelope();resetHarness();syncRotationUI()});
surfaceOffsetSlider.addEventListener('input',()=>{surfaceOffsetMM=+surfaceOffsetSlider.value;surfaceOffsetValue.textContent=surfaceOffsetSlider.value;updateAllGeometry()});
envelopeSmoothSlider.addEventListener('input',()=>{envelopeSmoothPct=+envelopeSmoothSlider.value;envelopeSmoothValue.textContent=envelopeSmoothSlider.value;rebuildEnvelope();updateAllGeometry()});
envelopeInflateSlider.addEventListener('input',()=>{envelopeInflateMM=+envelopeInflateSlider.value;envelopeInflateValue.textContent=envelopeInflateSlider.value;rebuildEnvelope();updateAllGeometry()});
envelopeVisibleToggle.addEventListener('click',()=>setEnvelopeVisible(!envelopeVisible));
symmetricEnvelopeToggle?.addEventListener('click',()=>{
  symmetricEnvelope=!symmetricEnvelope;
  symmetricEnvelopeToggle.classList.toggle('active',symmetricEnvelope);
  symmetricEnvelopeToggle.setAttribute('aria-pressed',symmetricEnvelope?'true':'false');
  symmetricEnvelopeToggle.textContent=symmetricEnvelope?'An':'Aus';
  showToast(symmetricEnvelope?'Symmetrische Arbeitshülle an':'Symmetrische Arbeitshülle aus');
});

function hideAllUI(){chrome.classList.add('ui-hidden');restoreUI.classList.remove('hidden')}
function installSheetPhysics(el){
  const saved=Number(localStorage.getItem('harnessSheetHeight'));if(saved>110)el.style.height=Math.min(saved,innerHeight*.72)+'px';
  const grab=el.querySelector?.('.grabber');if(!grab)return;
  let tracking=false,sy=0,startH=0,pid=null;
  const begin=e=>{tracking=true;pid=e.pointerId;sy=e.clientY;startH=el.getBoundingClientRect().height;e.preventDefault();e.stopPropagation()};
  grab.addEventListener('pointerdown',begin);
  el.addEventListener('pointerdown',e=>{if(e.target.closest('button,input'))return;const r=el.getBoundingClientRect();if(e.clientY-r.top<=42&&!tracking)begin(e)});
  el.addEventListener('pointermove',e=>{if(!tracking||e.pointerId!==pid)return;el.style.height=THREE.MathUtils.clamp(startH+(sy-e.clientY),112,innerHeight*.72)+'px';e.preventDefault()});
  const finish=e=>{if(!tracking||e.pointerId!==pid)return;tracking=false;localStorage.setItem('harnessSheetHeight',String(el.getBoundingClientRect().height))};
  el.addEventListener('pointerup',finish);el.addEventListener('pointercancel',finish);
}
[selectionPanel,rotationPanel,accessoryPanel,photoPanel].forEach(installSheetPhysics);
restoreUI.addEventListener('click',()=>{chrome.classList.remove('ui-hidden');restoreUI.classList.add('hidden')});

function resize(){
  const w=viewport.clientWidth,h=viewport.clientHeight;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false);
}
addEventListener('resize',resize);resize();

requestAnimationFrame(()=>{try{
  rebuildEnvelope();updateAllGeometry();
  const initial=captureState();history=[{sig:stateSignature(initial),state:initial}];updateHistoryUI();saveProject();
}catch(err){console.error(err);collisionMeshes=bodyMeshes}});
function animate(){requestAnimationFrame(animate);renderer.render(scene,camera)}animate();

document.querySelectorAll('input[type="range"]').forEach(el=>el.addEventListener('change',rememberState));
document.querySelectorAll('.mini-toggle,.primary-btn').forEach(el=>el.addEventListener('click',()=>setTimeout(rememberState,0)));


function setupSafeCompactUI(){
  surfaceNodeSizeSlider?.closest('.control')?.classList.add('point-only');
  ringDiameterSlider?.closest('.control')?.classList.add('ring-only');
  ringThicknessSlider?.closest('.control')?.classList.add('ring-only');

  const specs=[
    [widthSlider,widthValue,[10,20,30,40],'width'],
    [ringDiameterSlider,ringDiameterValue,[20,30,40,50],'ringDiameter'],
    [ringThicknessSlider,ringThicknessValue,[3,4,6,8],'ringThickness'],
    [surfaceNodeSizeSlider,surfaceNodeSizeValue,[4,6,8,10],'pointSize']
  ];
  for(const [slider,valueEl,defaults,name] of specs){
    if(!slider||!valueEl)continue;
    const control=slider.closest('.control');if(!control)continue;
    control.classList.add('has-inline-tools');
    valueEl.closest('.value-badge')?.classList.add('has-inline-replacement');
    const tools=document.createElement('div');tools.className='param-inline-tools';
    const num=document.createElement('input');num.className='param-number';num.type='number';num.inputMode='decimal';num.min=slider.min;num.max=slider.max;num.step=slider.step||1;num.value=slider.value;tools.appendChild(num);
    let vals;try{vals=JSON.parse(localStorage.getItem('safePreset:'+name))}catch{}if(!Array.isArray(vals)||vals.length!==4)vals=[...defaults];
    const row=document.createElement('div');row.className='inline-presets';
    const render=()=>{row.innerHTML='';vals.forEach((v,i)=>{const b=document.createElement('button');b.className='inline-preset';b.textContent=v;b.addEventListener('click',e=>{e.preventDefault();slider.value=v;slider.dispatchEvent(new Event('input',{bubbles:true}));slider.dispatchEvent(new Event('change',{bubbles:true}))});let t;b.addEventListener('pointerdown',()=>t=setTimeout(()=>{vals[i]=Number(slider.value);localStorage.setItem('safePreset:'+name,JSON.stringify(vals));render();vibrate(12);showToast('Preset gespeichert')},550));['pointerup','pointercancel','pointerleave'].forEach(ev=>b.addEventListener(ev,()=>clearTimeout(t)));row.appendChild(b)})};render();tools.appendChild(row);
    slider.addEventListener('input',()=>num.value=slider.value);
    num.addEventListener('change',()=>{let v=Number(num.value);if(!Number.isFinite(v))v=Number(slider.value);v=Math.max(Number(slider.min),Math.min(Number(slider.max),v));slider.value=String(v);slider.dispatchEvent(new Event('input',{bubbles:true}));slider.dispatchEvent(new Event('change',{bubbles:true}))});
    control.insertBefore(tools,slider);
  }
}
function updateNodeParameterVisibility(){
  selectionPanel?.classList.remove('node-point-only','node-ring-only');
  if(selected?.kind==='node')selectionPanel?.classList.add(selected.ringVisible?'node-ring-only':'node-point-only');
}
requestAnimationFrame(()=>{setupSafeCompactUI();updateNodeParameterVisibility()});
