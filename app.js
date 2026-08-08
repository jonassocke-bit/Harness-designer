
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const $=id=>document.getElementById(id);
const canvas=$('scene'),viewport=$('viewport'),chrome=$('chrome'),restoreUI=$('restoreUI');
const buildTools=$('buildTools'),selectionPanel=$('selectionPanel');
const ringControls=$('ringControls'),strapControls=$('strapControls'),strapAnchorControls=$('strapAnchorControls');
const selectionLabel=$('selectionLabel'),selectionTitle=$('selectionTitle'),deleteSelectedBtn=$('deleteSelectedBtn');
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
const envelopeVisibleToggle=$('envelopeVisibleToggle');
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
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
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
let surfaceOffsetMM=2,envelopeSmoothPct=35,envelopeInflateMM=4,envelopeVisible=false;

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
    const radial=Math.min(toward.length(),.11)*smooth*.22;
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
  if(hit&&Math.abs(hit.point.x)<MIRROR_AXIS_SNAP)hit.point.x=0;
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

function rebuildNodeVisual(n){
  while(n.group.children.length){
    const q=n.group.children.pop();q.geometry?.dispose?.();if(q.material!==metalMat&&q.material!==metalSelected&&q.material!==pointMat&&q.material!==pointSelected)q.material?.dispose?.();
  }
  if(n.ringVisible){
    const ring=new THREE.Mesh(new THREE.TorusGeometry(ringMajor(n),ringTube(n),16,64),selected===n?metalSelected:metalMat);
    ring.userData={kind:'nodeVisual',owner:n};n.group.add(ring);
    const hit=new THREE.Mesh(new THREE.SphereGeometry(Math.max(ringMajor(n)+ringTube(n),.055),18,12),new THREE.MeshBasicMaterial({transparent:true,opacity:.001}));
    hit.userData={kind:'nodeHit',owner:n};n.group.add(hit);
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
  n.group.position.copy(n.surfacePoint).addScaledVector(n.normal,surfaceOffsetScene()+(n.ringVisible?ringTube(n):0));
  if(Math.abs(n.surfacePoint.x)<MIRROR_AXIS_SNAP){n.surfacePoint.x=0;n.group.position.x=0}
  n.group.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),n.normal.clone().normalize());
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
function buildBaseCurve(c){
  const A=nodePosition(c.a),B=nodePosition(c.b);
  const a=visibleEndpoint(c.a,B);
  const b=visibleEndpoint(c.b,A);
  const straight=new THREE.LineCurve3(a,b);
  const tight=1-THREE.MathUtils.clamp(c.slack/100,0,1);
  const supports=[];
  const N=11;
  for(let i=0;i<N;i++){
    const t=i/(N-1);
    let p=straight.getPoint(t);
    if(i>0&&i<N-1&&tight>.08){
      const avgN=averageNormal(c.a,c.b);
      const origin=p.clone().addScaledVector(avgN,.8);
      raycaster.set(origin,avgN.clone().negate());
      const hits=raycaster.intersectObjects(collisionMeshes.length?collisionMeshes:bodyMeshes,true);
      if(hits.length&&hits[0].point.distanceTo(p)<.42){
        const snap=hits[0].point.clone().addScaledVector(worldNormal(hits[0]),surfaceOffsetScene()+.008);
        p.lerp(snap,tight*.62);
      }
    }
    supports.push(p);
  }
  const curve=new THREE.CatmullRomCurve3(supports,false,'centripetal',.5);
  c.baseCurve=curve;c.renderCurve=curve;return curve;
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
  const halfW=Math.max(.0002,.15*(widthMM/30)*.5),halfT=.009*(thicknessMM/2.5);
  const verts=[],idx=[],uv=[];
  const frames=[];
  for(let i=0;i<points.length;i++){
    const prev=points[Math.max(0,i-1)],next=points[Math.min(points.length-1,i+1)];
    const tangent=next.clone().sub(prev).normalize();
    const normal=averageNormal({normal:new THREE.Vector3(0,0,1)},{normal:new THREE.Vector3(0,0,1)});
    let viewN=camera.getWorldDirection(new THREE.Vector3()).negate();
    let side=new THREE.Vector3().crossVectors(viewN,tangent);if(side.lengthSq()<1e-8)side.set(1,0,0);side.normalize();
    const n=new THREE.Vector3().crossVectors(tangent,side).normalize();
    if(i&&side.dot(frames[i-1].side)<0){side.negate();n.negate()}frames.push({side,normal:n});
  }
  for(let i=0;i<points.length;i++){
    const p=points[i],f=frames[i],l=p.clone().addScaledVector(f.side,-halfW),r=p.clone().addScaledVector(f.side,halfW);
    const tl=l.clone().addScaledVector(f.normal,halfT),tr=r.clone().addScaledVector(f.normal,halfT),bl=l.clone().addScaledVector(f.normal,-halfT),br=r.clone().addScaledVector(f.normal,-halfT);
    [tl,tr,bl,br].forEach(v=>verts.push(v.x,v.y,v.z));const u=i/(points.length-1);uv.push(0,u,1,u,0,u,1,u);
  }
  for(let i=0;i<points.length-1;i++){const a=i*4,b=(i+1)*4;idx.push(a,a+1,b,a+1,b+1,b,a+2,b+2,a+3,a+3,b+2,b+3,a+2,a,b+2,a,b,b+2,a+1,a+3,b+1,a+3,b+3,b+1)}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
}
function addRibbon(c,points){
  if(points.length<2)return;
  const mesh=new THREE.Mesh(ribbonGeometry(points,c.widthMM),new THREE.MeshStandardMaterial({
    color:0x171718,roughness:.5,metalness:0,side:THREE.DoubleSide,
    emissive:selected===c?0x2c271d:0x000000,emissiveIntensity:selected===c?.75:0
  }));
  mesh.castShadow=true;mesh.userData={kind:'connectionMesh',owner:c};c.group.add(mesh);
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

function updateAllGeometry(){
  for(const n of nodes)if(n.source==='surface')updateSurfaceNodeTransform(n);
  for(let pass=0;pass<5;pass++){
    for(const c of connections)buildBaseCurve(c);
    for(const n of nodes)if(n.source==='strap')updateStrapNode(n);
  }
  for(const c of connections)renderConnection(c);
  for(const n of nodes)rebuildNodeVisual(n);
  refreshSelectionVisuals();
}
function paired(o){return o?.mirrorPartner&&o.mirrorPartner!==o}

function selectObject(o){
  selected=o;refreshSelectionVisuals();showSelection();
}
function refreshSelectionVisuals(){
  for(const n of nodes)rebuildNodeVisual(n);
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
  ringControls.classList.add('hidden');strapControls.classList.add('hidden');strapAnchorControls.classList.add('hidden');

  if(selected.kind==='node'){
    if(selected.source==='surface'){
      ringControls.classList.remove('hidden');
      selectionLabel.textContent='KNOTEN';selectionTitle.textContent=selected.id;
      ringDiameterSlider.value=selected.diameterMM;ringDiameterValue.textContent=selected.diameterMM;
      ringThicknessSlider.value=selected.thicknessMM;ringThicknessValue.textContent=selected.thicknessMM;
      surfaceNodeSizeSlider.value=selected.sizeMM;surfaceNodeSizeValue.textContent=selected.sizeMM;
      setMiniToggle(surfaceNodeRingToggle,selected.ringVisible);
    }else{
      strapAnchorControls.classList.remove('hidden');
      selectionLabel.textContent='RIEMEN-KNOTEN';selectionTitle.textContent=selected.id;
      strapAnchorSlider.value=Math.round(selected.t*100);strapAnchorValue.textContent=Math.round(selected.t*100);
      strapAnchorSizeSlider.value=selected.sizeMM;strapAnchorSizeValue.textContent=selected.sizeMM;
      setMiniToggle(strapNodeRingToggle,selected.ringVisible);
    }
  }else{
    strapControls.classList.remove('hidden');
    selectionLabel.textContent='RIEMEN';selectionTitle.textContent=selected.id;
    widthSlider.value=selected.widthMM;widthValue.textContent=selected.widthMM;slackSlider.value=selected.slack;
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
  scene.remove(parent.group);
  const pi=connections.indexOf(parent);if(pi>=0)connections.splice(pi,1);
  node.source='split';node.parent=null;node.group.position.copy(splitPosition);
  const left=createConnection(originalA,node,true),right=createConnection(node,originalB,true);
  left.widthMM=right.widthMM=width;left.slack=right.slack=slack;
  node._split={left,right,originalA,originalB,originalT:splitT};
  for(const s of siblings){
    if(s.t<splitT){s.parent=left;s.t=s.t/splitT;}
    else{s.parent=right;s.t=(s.t-splitT)/(1-splitT);}
  }
  updateAllGeometry();
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
}

function removeConnection(c){
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
  selected=null;hideSelection();updateAllGeometry();
});

ringDiameterSlider.addEventListener('input',()=>{
  if(selected?.kind!=='node')return;
  selected.diameterMM=+ringDiameterSlider.value;ringDiameterValue.textContent=ringDiameterSlider.value;
  if(paired(selected)){selected.mirrorPartner.diameterMM=selected.diameterMM}
  updateAllGeometry();
});
ringThicknessSlider.addEventListener('input',()=>{
  if(selected?.kind!=='node')return;
  selected.thicknessMM=+ringThicknessSlider.value;ringThicknessValue.textContent=ringThicknessSlider.value;
  if(paired(selected))selected.mirrorPartner.thicknessMM=selected.thicknessMM;
  updateAllGeometry();
});
surfaceNodeSizeSlider.addEventListener('input',()=>{
  if(selected?.kind!=='node')return;
  selected.sizeMM=+surfaceNodeSizeSlider.value;surfaceNodeSizeValue.textContent=surfaceNodeSizeSlider.value;
  if(paired(selected))selected.mirrorPartner.sizeMM=selected.sizeMM;updateAllGeometry();
});
surfaceNodeRingToggle.addEventListener('click',()=>{
  if(selected?.kind!=='node')return;
  selected.ringVisible=!selected.ringVisible;
  if(paired(selected))selected.mirrorPartner.ringVisible=selected.ringVisible;
  setMiniToggle(surfaceNodeRingToggle,selected.ringVisible);updateAllGeometry();
});
strapNodeRingToggle.addEventListener('click',()=>{
  if(selected?.kind!=='node')return;
  if(selected.source==='strap'&&!selected.ringVisible){
    selected.ringVisible=true;splitConnectionAtNode(selected);
  }else if(selected.source==='split'&&selected.ringVisible){
    selected.ringVisible=false;mergeSplitNode(selected);
  }else{
    selected.ringVisible=!selected.ringVisible;
  }
  if(paired(selected))selected.mirrorPartner.ringVisible=selected.ringVisible;
  setMiniToggle(strapNodeRingToggle,selected.ringVisible);updateAllGeometry();
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
  selected.sizeMM=+strapAnchorSizeSlider.value;strapAnchorSizeValue.textContent=strapAnchorSizeSlider.value;
  if(paired(selected))selected.mirrorPartner.sizeMM=selected.sizeMM;updateAllGeometry();
});

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

  if(single.hit?.kind==='node'&&single.hit.owner.source==='surface'){
    const d=Math.hypot(e.clientX-single.sx,e.clientY-single.sy);
    if(d>6){
      let h=bodyHitXY(e.clientX,e.clientY);if(h){
        h=snapHitToAxis(h);
        const n=single.hit.owner;
        n.surfacePoint=h.point.clone();
        n.normal=worldNormal(h);
        updateSurfaceNodeTransform(n);

        if(n.mirrorPartner&&Math.abs(n.surfacePoint.x)>.012){
          const mh=mirroredBodyHit(n.group.position);
          if(mh){
            n.mirrorPartner.surfacePoint=mh.point.clone();
            n.mirrorPartner.normal=worldNormal(mh);
          }
        }
        updateAllGeometry();
      }
    }
    single.lx=e.clientX;single.ly=e.clientY;return;
  }


  const ddx=e.clientX-single.lx,ddy=e.clientY-single.ly;camAz-=ddx*.009;camEl=THREE.MathUtils.clamp(camEl+ddy*.006,-.72,.72);updateCamera();single.lx=e.clientX;single.ly=e.clientY;
});
canvas.addEventListener('pointerup',e=>{
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
canvas.addEventListener('pointercancel',e=>{pointers.delete(e.pointerId);single=null;twoStart=null});

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

function hideAllUI(){chrome.classList.add('ui-hidden');restoreUI.classList.remove('hidden')}
function installSheetPhysics(el){
  let sy=0,dy=0,tracking=false;
  el.addEventListener('pointerdown',e=>{if(e.target.matches('input,button'))return;tracking=true;sy=e.clientY;dy=0;el.classList.add('dragging');el.setPointerCapture?.(e.pointerId)});
  el.addEventListener('pointermove',e=>{if(!tracking)return;dy=Math.max(0,e.clientY-sy);el.style.transform=`translateY(${dy}px)`;el.style.opacity=String(Math.max(.35,1-dy/260))});
  const end=e=>{if(!tracking)return;tracking=false;el.classList.remove('dragging');el.style.transform='';el.style.opacity='';if(dy>58)hideAllUI();try{el.releasePointerCapture?.(e.pointerId)}catch{}};
  el.addEventListener('pointerup',end);el.addEventListener('pointercancel',end);
}
[selectionPanel,rotationPanel,accessoryPanel,photoPanel,$('modePill')].forEach(installSheetPhysics);
restoreUI.addEventListener('click',()=>{chrome.classList.remove('ui-hidden');restoreUI.classList.add('hidden')});

function resize(){
  const w=viewport.clientWidth,h=viewport.clientHeight;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false);
}
addEventListener('resize',resize);resize();

requestAnimationFrame(()=>{try{rebuildEnvelope();updateAllGeometry()}catch(err){console.error(err);collisionMeshes=bodyMeshes}});
function animate(){requestAnimationFrame(animate);renderer.render(scene,camera)}animate();
