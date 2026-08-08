
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const $=id=>document.getElementById(id);
const canvas=$('scene'),viewport=$('viewport'),chrome=$('chrome'),restoreUI=$('restoreUI');
const buildTools=$('buildTools'),selectionPanel=$('selectionPanel'),ringControls=$('ringControls'),strapControls=$('strapControls'),strapAnchorControls=$('strapAnchorControls');
const selectionLabel=$('selectionLabel'),selectionTitle=$('selectionTitle'),deleteSelectedBtn=$('deleteSelectedBtn');
const widthSlider=$('widthSlider'),widthValue=$('widthValue'),slackSlider=$('slackSlider');
const ringDiameterSlider=$('ringDiameterSlider'),ringDiameterValue=$('ringDiameterValue');
const ringThicknessSlider=$('ringThicknessSlider'),ringThicknessValue=$('ringThicknessValue');
const addStrapAnchorBtn=$('addStrapAnchorBtn'),strapAnchorSlider=$('strapAnchorSlider'),strapAnchorValue=$('strapAnchorValue');
const strapAnchorSizeSlider=$('strapAnchorSizeSlider'),strapAnchorSizeValue=$('strapAnchorSizeValue');
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

let mode='build',buildTool='ring',mirrorMode=false;
let surfaceOffsetMM=2;
let envelopeSmoothPct=35;
let envelopeInflateMM=4;
let envelopeVisible=false;
let envelopeRoot=null;
let envelopeMeshes=[];
let collisionMeshes=[];

function kindOf(obj){
  if(!obj)return null;
  return obj.kind || obj.userData?.kind || null;
}

const scene=new THREE.Scene();
scene.fog=new THREE.Fog(0x09090b,6.2,
envelopeRoot=new THREE.Group();
scene.add(envelopeRoot);10);
const camera=new THREE.PerspectiveCamera(31,1,.01,50);
let camAz=0,camEl=.02,camDist=5.25;const target=new THREE.Vector3(0,.08,0);

const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;

scene.add(new THREE.HemisphereLight(0xffffff,0x303038,2.0));
const key=new THREE.DirectionalLight(0xffffff,3.15);key.position.set(2.7,4.4,3.4);key.castShadow=true;scene.add(key);
const fill=new THREE.DirectionalLight(0xd8ddff,1);fill.position.set(-3,2,2);scene.add(fill);
const rim=new THREE.DirectionalLight(0xa7b4ff,1.25);rim.position.set(-3,2.8,-3.2);scene.add(rim);
const floor=new THREE.Mesh(new THREE.CircleGeometry(2.35,96),new THREE.MeshStandardMaterial({color:0x141418,roughness:1}));
floor.rotation.x=-Math.PI/2;floor.position.y=-1.81;floor.receiveShadow=true;scene.add(floor);

// Visual guide for the mirror plane x = 0 on the base floor.
// The line runs front-to-back through the mannequin centre.
const axisGeom=new THREE.BufferGeometry().setFromPoints([
  new THREE.Vector3(0,-1.795,-2.05),
  new THREE.Vector3(0,-1.795, 2.05)
]);
const axisLine=new THREE.Line(
  axisGeom,
  new THREE.LineBasicMaterial({color:0xffffff,transparent:true,opacity:.55})
);
scene.add(axisLine);

const axisMarkerMat=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.62});
for(const z of [-1.5,-1.0,-.5,0,.5,1.0,1.5]){
  const mark=new THREE.Mesh(new THREE.PlaneGeometry(.12,.012),axisMarkerMat);
  mark.rotation.x=-Math.PI/2;
  mark.position.set(0,-1.79,z);
  scene.add(mark);
}

function updateCamera(){
  const ce=Math.cos(camEl);
  camera.position.set(target.x+Math.sin(camAz)*ce*camDist,target.y+Math.sin(camEl)*camDist,target.z+Math.cos(camAz)*ce*camDist);
  camera.lookAt(target);
}
updateCamera();

let mannequin=new THREE.Group();scene.add(mannequin);
let importedModel=null;
let bodyMeshes=[];
const bodyMat=new THREE.MeshStandardMaterial({color:0xd7d5d0,roughness:.78,metalness:0});
function registerMesh(m,override=true){if(override)m.material=bodyMat;m.castShadow=true;m.receiveShadow=true;bodyMeshes.push(m)}
function addMesh(m){registerMesh(m,true);mannequin.add(m);return m}
function ellipsoid(rx,ry,rz,x,y,z=0){const m=addMesh(new THREE.Mesh(new THREE.SphereGeometry(1,64,44)));m.scale.set(rx,ry,rz);m.position.set(x,y,z);return m}
function limb(rt,rb,len,x,y,rz,z=0){const m=addMesh(new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,len,48,12,false)));m.position.set(x,y,z);m.rotation.z=rz;return m}
function buildFallback(){
  bodyMeshes=[];mannequin.clear();
  ellipsoid(.245,.325,.235,0,1.50,.012);ellipsoid(.225,.115,.215,0,1.30,.025);
  const neck=addMesh(new THREE.Mesh(new THREE.CylinderGeometry(.115,.145,.25,48,6)));neck.position.set(0,1.16,0);
  ellipsoid(.48,.57,.27,0,.71,.012);ellipsoid(.41,.38,.235,0,.30,.012);ellipsoid(.445,.30,.28,0,-.12,.015);
  ellipsoid(.19,.155,.205,-.37,.84,.012);ellipsoid(.19,.155,.205,.37,.84,.012);
  limb(.135,.112,.60,-.55,.54,-.12);ellipsoid(.125,.145,.125,-.59,.20,0);limb(.112,.09,.59,-.63,-.10,-.025);ellipsoid(.095,.155,.065,-.65,-.47,.02);
  limb(.135,.112,.60,.55,.54,.12);ellipsoid(.125,.145,.125,.59,.20,0);limb(.112,.09,.59,.63,-.10,.025);ellipsoid(.095,.155,.065,.65,-.47,.02);
  ellipsoid(.215,.235,.215,-.205,-.40,.01);ellipsoid(.215,.235,.215,.205,-.40,.01);
  limb(.185,.145,.70,-.20,-.83,.018);limb(.185,.145,.70,.20,-.83,-.018);
  ellipsoid(.15,.15,.145,-.20,-1.20,.01);ellipsoid(.15,.15,.145,.20,-1.20,.01);
  limb(.14,.098,.66,-.20,-1.53,-.005);limb(.14,.098,.66,.20,-1.53,.005);
}
buildFallback();
collisionMeshes=bodyMeshes;

function showToast(msg){toast.textContent=msg;toast.classList.remove('hidden');clearTimeout(showToast.t);showToast.t=setTimeout(()=>toast.classList.add('hidden'),1800)}


function clearEnvelope(){
  if(!envelopeRoot)return;
  envelopeMeshes.forEach(m=>{
    envelopeRoot.remove(m);
    m.geometry?.dispose?.();
    m.material?.dispose?.();
  });
  envelopeMeshes=[];
}

function smoothGeometryClone(sourceGeom, smoothPct, inflateMM){
  const geom=sourceGeom.clone();
  const pos=geom.getAttribute('position');
  if(!pos)return geom;

  // Keep iPhone performance predictable: use a lightweight neighbourhood-free
  // shrink/smooth pass toward the local bounding-volume centre, then inflate
  // along recomputed normals. It produces a collision envelope rather than
  // altering the visible model.
  geom.computeVertexNormals();
  const normal=geom.getAttribute('normal');
  const box=new THREE.Box3().setFromBufferAttribute(pos);
  const center=box.getCenter(new THREE.Vector3());
  const smooth=THREE.MathUtils.clamp(smoothPct/100,0,1);
  const inflate=inflateMM*MM_TO_SCENE;

  const v=new THREE.Vector3();
  const n=new THREE.Vector3();
  for(let i=0;i<pos.count;i++){
    v.fromBufferAttribute(pos,i);
    n.fromBufferAttribute(normal,i).normalize();

    // Gentle radial averaging effect. Max movement is intentionally small;
    // the envelope should ignore fine detail, not change body proportions.
    const toward=center.clone().sub(v);
    const radial=Math.min(toward.length(),.08)*smooth*.16;
    if(toward.lengthSq()>1e-8)v.addScaledVector(toward.normalize(),radial);

    v.addScaledVector(n,inflate);
    pos.setXYZ(i,v.x,v.y,v.z);
  }
  pos.needsUpdate=true;
  geom.computeVertexNormals();
  geom.computeBoundingBox();
  geom.computeBoundingSphere();
  return geom;
}

function rebuildEnvelope(){
  if(!envelopeRoot || !mannequin)return;
  clearEnvelope();

  const sourceMeshes=[];
  mannequin.traverse(n=>{
    if(n.isMesh && !n.userData?.isEnvelope)sourceMeshes.push(n);
  });

  sourceMeshes.forEach(src=>{
    const geom=smoothGeometryClone(src.geometry,envelopeSmoothPct,envelopeInflateMM);
    const mat=new THREE.MeshStandardMaterial({
      color:0xffffff,
      transparent:true,
      opacity:.16,
      roughness:.25,
      metalness:0,
      wireframe:false,
      depthWrite:false,
      side:THREE.DoubleSide
    });
    const m=new THREE.Mesh(geom,mat);
    m.userData.isEnvelope=true;

    // Match source world transform inside a world-space helper group.
    src.updateMatrixWorld(true);
    m.matrixAutoUpdate=false;
    m.matrix.copy(src.matrixWorld);
    m.visible=envelopeVisible;
    envelopeRoot.add(m);
    envelopeMeshes.push(m);
  });

  // If smoothing/inflate are both zero, original mesh remains the collision source.
  const useEnvelope=envelopeMeshes.length>0 && (envelopeSmoothPct>0 || envelopeInflateMM>0);
  collisionMeshes=useEnvelope?envelopeMeshes:bodyMeshes;

  refreshSurfaceOffset();
}

function setEnvelopeVisible(v){
  envelopeVisible=v;
  envelopeMeshes.forEach(m=>m.visible=v);
  envelopeVisibleToggle.classList.toggle('active',v);
  envelopeVisibleToggle.setAttribute('aria-pressed',v?'true':'false');
  envelopeVisibleToggle.textContent=v?'An':'Aus';
}

modelBtn.addEventListener('click',()=>modelInput.click());
modelInput.addEventListener('change',async()=>{
  const file=modelInput.files?.[0];if(!file)return;const url=URL.createObjectURL(file);
  try{
    const gltf=await new GLTFLoader().loadAsync(url),obj=gltf.scene;

    // V0.5d: no automatic orientation. The user controls model rotation manually.
    obj.updateMatrixWorld(true);
    let box=new THREE.Box3().setFromObject(obj);
    let size=box.getSize(new THREE.Vector3());
    const scale=3.25/Math.max(size.y,.001);
    obj.scale.setScalar(scale);
    obj.updateMatrixWorld(true);

    const b2=new THREE.Box3().setFromObject(obj),c=b2.getCenter(new THREE.Vector3());
    obj.position.x-=c.x;
    obj.position.z-=c.z;
    obj.position.y+=(-1.75-b2.min.y);
    obj.updateMatrixWorld(true);
    scene.remove(mannequin);mannequin=new THREE.Group();mannequin.add(obj);scene.add(mannequin);importedModel=obj;
    bodyMeshes=[];obj.traverse(n=>{if(n.isMesh)registerMesh(n,false)});
    collisionMeshes=bodyMeshes;
    rebuildEnvelope();
    resetHarness();rotationPanel.classList.add('hidden');rotateModelBtn.classList.remove('active');showToast('3D-Modell geladen');
  }catch(e){console.error(e);showToast('Modell konnte nicht geladen werden')}
  finally{URL.revokeObjectURL(url);modelInput.value=''}
});

const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
function setPointerXY(x,y){const r=canvas.getBoundingClientRect();pointer.x=((x-r.left)/r.width)*2-1;pointer.y=-((y-r.top)/r.height)*2+1;raycaster.setFromCamera(pointer,camera)}
function bodyHitXY(x,y){setPointerXY(x,y);return raycaster.intersectObjects(collisionMeshes.length?collisionMeshes:bodyMeshes,true)[0]||null}
function worldNormal(hit){const nm=new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld);return hit.face.normal.clone().applyMatrix3(nm).normalize()}

function ringMajorRadius(anchor){
  return Math.max(.001,(anchor.userData.diameterMM*MM_TO_SCENE)/2);
}
function ringTubeRadius(anchor){
  return Math.max(.001,(anchor.userData.thicknessMM*MM_TO_SCENE)/2);
}
function rebuildRingGeometry(anchor){
  const ring=anchor.children.find(ch=>ch.userData?.kind==='anchorRing');
  if(!ring)return;
  ring.geometry?.dispose?.();
  ring.geometry=new THREE.TorusGeometry(ringMajorRadius(anchor),ringTubeRadius(anchor),16,64);
  const disc=anchor.children.find(ch=>ch.userData?.kind==='anchorHit');
  if(disc){
    disc.geometry?.dispose?.();
    disc.geometry=new THREE.CircleGeometry(Math.max(ringMajorRadius(anchor)*1.28,.055),32);
  }
  if(anchor.userData.surfacePoint && anchor.userData.normal){
    anchor.position.copy(anchor.userData.surfacePoint)
      .addScaledVector(anchor.userData.normal,surfaceOffsetScene()+ringTubeRadius(anchor));
  }
  rebuildRingWraps(anchor);
}
function mirrorWorldPoint(worldPoint){
  return new THREE.Vector3(-worldPoint.x,worldPoint.y,worldPoint.z);
}
function findMirroredBodyHitFromPoint(worldPoint){
  const mirrored=mirrorWorldPoint(worldPoint);
  const camDir=camera.getWorldDirection(new THREE.Vector3());
  const origin=mirrored.clone().addScaledVector(camDir,-3);
  raycaster.set(origin,camDir);
  const hits=raycaster.intersectObjects(collisionMeshes.length?collisionMeshes:bodyMeshes,true);
  if(hits.length)return hits.reduce((best,h)=>h.point.distanceTo(mirrored)<best.point.distanceTo(mirrored)?h:best,hits[0]);
  return null;
}

const anchorMat=new THREE.MeshStandardMaterial({color:0xfff2bb,emissive:0x44380c,emissiveIntensity:.8,roughness:.34,metalness:.18});
const anchorSelectedMat=anchorMat.clone();anchorSelectedMat.color.set(0xffffff);anchorSelectedMat.emissive.set(0x555555);
anchorSelectedMat.emissiveIntensity=1.15;
const DEFAULT_RING_DIAMETER_MM=40;
const DEFAULT_RING_THICKNESS_MM=6;
const MM_TO_SCENE=.0037;

function surfaceOffsetScene(){return surfaceOffsetMM*MM_TO_SCENE;}

const MIRROR_AXIS_SNAP=.045;

function snapSurfacePointToMirrorAxis(hit){
  if(!hit)return hit;
  if(Math.abs(hit.point.x)<=MIRROR_AXIS_SNAP)hit.point.x=0;
  return hit;
}

function isOnMirrorAxis(obj){
  const k=kindOf(obj);
  const p=k==='anchor'?obj.position:(k==='strapAnchor'?obj.group.position:null);
  return !!p && Math.abs(p.x)<=.012;
}
const anchors=[],connections=[],strapAnchors=[];
let selected=null,connectStart=null;

function connectionCurve(c){
  if(c.renderCurve)return c.renderCurve;
  const points=surfaceSampledPath(c);
  c.renderPoints=points.map(p=>p.clone());
  c.renderCurve=new THREE.CatmullRomCurve3(c.renderPoints,false,'centripetal',.5);
  return c.renderCurve;
}
function strapAnchorWorld(sa){
  const curve=connectionCurve(sa.connection);
  return curve.getPoint(THREE.MathUtils.clamp(sa.t,0,1));
}
function updateStrapAnchor(sa){
  const curve=connectionCurve(sa.connection);
  const t=THREE.MathUtils.clamp(sa.t,0,1);
  const p=curve.getPoint(t);
  sa.group.position.copy(p);
  sa.group.quaternion.identity();
}
function makeStrapAnchor(connection,t=.5,mirrorPartner=null){
  const g=new THREE.Group();

  const sphere=new THREE.Mesh(
    new THREE.SphereGeometry(.020,24,18),
    new THREE.MeshStandardMaterial({
      color:0xffffff,
      emissive:0x222222,
      emissiveIntensity:.35,
      roughness:.3,
      metalness:0
    })
  );
  sphere.userData.kind='strapAnchorSphere';
  g.add(sphere);

  const hitSphere=new THREE.Mesh(
    new THREE.SphereGeometry(.030,18,14),
    new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.001})
  );
  hitSphere.userData.kind='strapAnchorHit';
  g.add(hitSphere);

  const sa={
    kind:'strapAnchor',
    id:`RA${strapAnchors.length+1}`,
    connection,
    t,
    group:g,
    mirrorPartner,
    sizeMM:10
  };

  g.userData.owner=sa;
  scene.add(g);
  strapAnchors.push(sa);
  updateStrapAnchorGeometry(sa);
  updateStrapAnchor(sa);
  return sa;
}

function updateStrapAnchorGeometry(sa){
  const visual=sa.group.children.find(ch=>ch.userData?.kind==='strapAnchorSphere');
  const hit=sa.group.children.find(ch=>ch.userData?.kind==='strapAnchorHit');
  const r=Math.max(.006,(sa.sizeMM*MM_TO_SCENE)/2);
  if(visual){
    visual.geometry?.dispose?.();
    visual.geometry=new THREE.SphereGeometry(r,24,18);
  }
  if(hit){
    hit.geometry?.dispose?.();
    hit.geometry=new THREE.SphereGeometry(Math.max(r*2.0,.032),18,14);
  }
}
function removeStrapAnchor(sa){
  connections.filter(c=>c.a===sa||c.b===sa).slice().forEach(removeConnection);
  if(sa.mirrorPartner)sa.mirrorPartner.mirrorPartner=null;
  scene.remove(sa.group);
  const i=strapAnchors.indexOf(sa);if(i>=0)strapAnchors.splice(i,1);
}

function isConnectable(obj){
  const k=kindOf(obj);
  return k==='anchor' || k==='strapAnchor';
}

function endpointWorld(obj){
  const k=kindOf(obj);
  if(k==='anchor')return obj.position.clone();
  if(k==='strapAnchor')return obj.group.position.clone();
  return new THREE.Vector3();
}

function endpointLabel(obj){
  const k=kindOf(obj);
  if(k==='anchor')return obj.userData.id;
  if(k==='strapAnchor')return obj.id;
  return '?';
}

function endpointMirror(obj){
  const k=kindOf(obj);
  if(k==='anchor')return obj.userData.mirrorPartner || null;
  if(k==='strapAnchor')return obj.mirrorPartner || null;
  return null;
}


function getMirrorPartner(obj){
  const k=kindOf(obj);
  if(k==='anchor')return obj.userData.mirrorPartner||null;
  if(k==='connection')return obj.mirrorPartner||null;
  if(k==='strapAnchor')return obj.mirrorPartner||null;
  return null;
}

function setMirrorPartners(a,b){
  const ka=kindOf(a),kb=kindOf(b);
  if(ka!==kb)return;
  if(ka==='anchor'){
    a.userData.mirrorPartner=b;
    b.userData.mirrorPartner=a;
  }else{
    a.mirrorPartner=b;
    b.mirrorPartner=a;
  }
}

function refreshMirrorSelectedBubble(){
  if(!mirrorSelectedBtn)return;
  mirrorSelectedBtn.classList.toggle('paired',!!getMirrorPartner(selected));
}

function findExistingMirroredAnchor(source){
  const target=mirrorWorldPoint(source.position);
  let best=null,bestD=.08;
  for(const a of anchors){
    if(a===source)continue;
    const d=a.position.distanceTo(target);
    if(d<bestD){best=a;bestD=d;}
  }
  return best;
}

function createOrGetMirroredAnchor(source){
  if(isOnMirrorAxis(source))return source;
  if(source.userData.mirrorPartner)return source.userData.mirrorPartner;

  const existing=findExistingMirroredAnchor(source);
  if(existing){
    existing.userData.diameterMM=source.userData.diameterMM;
    existing.userData.thicknessMM=source.userData.thicknessMM;
    rebuildRingGeometry(existing);
    setMirrorPartners(source,existing);
    return existing;
  }

  const mh=findMirroredBodyHitFromPoint(source.position);
  if(!mh)return null;
  const partner=makeAnchor(mh,source);
  partner.userData.diameterMM=source.userData.diameterMM;
  partner.userData.thicknessMM=source.userData.thicknessMM;
  rebuildRingGeometry(partner);
  setMirrorPartners(source,partner);
  return partner;
}

function findConnectionBetween(a,b){
  return connections.find(c=>
    (c.a===a&&c.b===b)||(c.a===b&&c.b===a)
  )||null;
}

function ensureMirroredConnection(c){
  if(c.mirrorPartner)return c.mirrorPartner;

  const ma=ensureMirroredEndpoint(c.a);
  const mb=ensureMirroredEndpoint(c.b);
  if(!ma||!mb)return null;

  if(ma===c.a && mb===c.b){
    c.mirrorPartner=c;
    return c;
  }

  const existing=findConnectionBetween(ma,mb);
  if(existing){
    existing.widthMM=c.widthMM;
    existing.slack=c.slack;
    existing.controlPoint=c.controlPoint?mirrorWorldPoint(c.controlPoint):null;
    updateConnection(existing);
    setMirrorPartners(c,existing);
    return existing;
  }

  const mc=makeConnection(ma,mb,c);
  mc.widthMM=c.widthMM;
  mc.slack=c.slack;
  mc.controlPoint=c.controlPoint?mirrorWorldPoint(c.controlPoint):null;
  updateConnection(mc);
  setMirrorPartners(c,mc);
  return mc;
}

function createOrGetMirroredStrapAnchor(sa){
  if(sa.mirrorPartner)return sa.mirrorPartner;
  const mc=ensureMirroredConnection(sa.connection);
  if(!mc)return null;

  const existing=strapAnchors.find(x=>x.connection===mc && Math.abs(x.t-sa.t)<.015);
  if(existing){
    existing.sizeMM=sa.sizeMM;
    updateStrapAnchorGeometry(existing);
    setMirrorPartners(sa,existing);
    return existing;
  }

  const partner=makeStrapAnchor(mc,sa.t,sa);
  partner.sizeMM=sa.sizeMM;
  updateStrapAnchorGeometry(partner);
  setMirrorPartners(sa,partner);
  return partner;
}

function ensureMirroredEndpoint(ep){
  const k=kindOf(ep);
  if(k==='anchor')return createOrGetMirroredAnchor(ep);
  if(k==='strapAnchor')return createOrGetMirroredStrapAnchor(ep);
  return null;
}

function mirrorSelectedObject(){
  const k=kindOf(selected);
  if(k==='anchor')createOrGetMirroredAnchor(selected);
  else if(k==='connection')ensureMirroredConnection(selected);
  else if(k==='strapAnchor')createOrGetMirroredStrapAnchor(selected);

  refreshSelectionVisuals();
  refreshMirrorSelectedBubble();
}

function findMirrorConnection(c){
  if(!c?.a?.userData?.mirrorPartner||!c?.b?.userData?.mirrorPartner)return null;
  return connections.find(x=>
    (x.a===c.a.userData.mirrorPartner&&x.b===c.b.userData.mirrorPartner)||
    (x.b===c.a.userData.mirrorPartner&&x.a===c.b.userData.mirrorPartner)
  )||null;
}

function makeAnchor(hit,mirrorPartner=null){
  const g=new THREE.Group();
  g.userData={
    kind:'anchor',
    id:`A${anchors.length+1}`,
    normal:new THREE.Vector3(),
    diameterMM:DEFAULT_RING_DIAMETER_MM,
    thicknessMM:DEFAULT_RING_THICKNESS_MM,
    mirrorPartner
  };

  const ring=new THREE.Mesh(
    new THREE.TorusGeometry(ringMajorRadius(g),ringTubeRadius(g),16,64),
    anchorMat
  );
  ring.userData.kind='anchorRing';
  g.add(ring);

  const hitDisc=new THREE.Mesh(
    new THREE.CircleGeometry(Math.max(ringMajorRadius(g)*1.28,.055),32),
    new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.02,side:THREE.DoubleSide})
  );
  hitDisc.position.z=-.004;
  hitDisc.userData.kind='anchorHit';
  g.add(hitDisc);

  positionAnchor(g,hit);
  scene.add(g);
  anchors.push(g);

  if(mirrorMode && !mirrorPartner && Math.abs(g.position.x)>.035){
    const mirroredHit=findMirroredBodyHitFromPoint(g.position);
    if(mirroredHit){
      const partner=makeAnchor(mirroredHit,g);
      g.userData.mirrorPartner=partner;
      partner.userData.mirrorPartner=g;
      partner.userData.diameterMM=g.userData.diameterMM;
      partner.userData.thicknessMM=g.userData.thicknessMM;
      rebuildRingGeometry(partner);
    }
  }
  return g;
}
function positionAnchor(g,hit){
  hit=snapSurfacePointToMirrorAxis(hit);
  const n=worldNormal(hit);

  g.userData.surfacePoint=hit.point.clone();
  if(Math.abs(g.userData.surfacePoint.x)<=MIRROR_AXIS_SNAP)g.userData.surfacePoint.x=0;

  g.userData.normal.copy(n);
  g.position.copy(g.userData.surfacePoint)
    .addScaledVector(n,surfaceOffsetScene()+ringTubeRadius(g));

  if(Math.abs(g.userData.surfacePoint.x)<=MIRROR_AXIS_SNAP)g.position.x=0;

  g.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),n);

  connections.filter(c=>c.a===g||c.b===g).forEach(updateConnection);

  const mp=g.userData.mirrorPartner;
  if(mp && !g.userData._syncingMirror && !isOnMirrorAxis(g)){
    const mh=findMirroredBodyHitFromPoint(g.position);
    if(mh){
      g.userData._syncingMirror=true;
      mp.userData._syncingMirror=true;
      positionAnchor(mp,mh);
      mp.userData._syncingMirror=false;
      g.userData._syncingMirror=false;
    }
  }
}
function ringPlaneDirection(anchor,worldDirection){
  // Convert the incoming world-space direction into the local XY plane of the ring.
  const qInv=anchor.quaternion.clone().invert();
  const local=worldDirection.clone().applyQuaternion(qInv);
  local.z=0;
  if(local.lengthSq()<1e-8)local.set(1,0,0);
  local.normalize();
  return local;
}

function ringEdgePoint(anchor,otherAnchor){
  // Every strap aims at the ring centre; the visible leather ends at the near
  // outside edge of the torus rather than entering the hole.
  const worldDir=endpointWorld(otherAnchor).sub(anchor.position).normalize();
  const localDir=ringPlaneDirection(anchor,worldDir);
  const localPoint=localDir.multiplyScalar(ringMajorRadius(anchor)+ringTubeRadius(anchor)*.45);
  return anchor.localToWorld(localPoint.clone());
}

function wrapArcGeometry(anchor,otherAnchor,widthMM,color=0x171718){
  // Short leather-coloured arc on the metal ring to visually represent
  // the strap wrapping around the ring.
  const worldDir=endpointWorld(otherAnchor).sub(anchor.position).normalize();
  const localDir=ringPlaneDirection(anchor,worldDir);
  const centerAngle=Math.atan2(localDir.y,localDir.x);

  // Wider straps cover a slightly larger ring segment.
  const strapFactor=THREE.MathUtils.clamp(widthMM/30,.5,2);
  const arcHalf=THREE.MathUtils.clamp(.32*strapFactor,.24,.62);

  const curve=new THREE.Curve();
  curve.getPoint=function(t){
    const a=centerAngle-arcHalf+t*(arcHalf*2);
    return new THREE.Vector3(
      Math.cos(a)*ringMajorRadius(anchor),
      Math.sin(a)*ringMajorRadius(anchor),
      .004
    );
  };

  const tubeRadius=Math.min(ringTubeRadius(anchor)*1.18,.024);
  const geom=new THREE.TubeGeometry(curve,24,tubeRadius,10,false);
  const mat=new THREE.MeshStandardMaterial({
    color,
    roughness:.48,
    metalness:0,
    polygonOffset:true,
    polygonOffsetFactor:-1,
    polygonOffsetUnits:-1
  });
  const mesh=new THREE.Mesh(geom,mat);
  mesh.userData.kind='wrapArc';
  return mesh;
}

function rebuildRingWraps(anchor){
  // Remove previous leather wrap overlays.
  const old=anchor.children.filter(ch=>ch.userData?.kind==='wrapArc');
  old.forEach(ch=>{
    anchor.remove(ch);
    ch.geometry?.dispose?.();
    ch.material?.dispose?.();
  });

  // One wrap segment per connected strap.
  connections.filter(c=>c.a===anchor||c.b===anchor).forEach(c=>{
    const other=c.a===anchor?c.b:c.a;
    const wrap=wrapArcGeometry(anchor,other,c.widthMM,0x171718);
    anchor.add(wrap);
  });
}

function makeConnection(a,b,mirrorPartner=null){
  if(a===b)return;
  if(!isConnectable(a)||!isConnectable(b))return;

  const c={
    kind:'connection',
    id:`S${connections.length+1}`,
    a,b,
    widthMM:30,
    slack:8,
    controlPoint:null,
    group:new THREE.Group(),
    mirrorPartner
  };
  scene.add(c.group);
  connections.push(c);
  updateConnection(c);

  if(mirrorMode && !mirrorPartner){
    const ma=endpointMirror(a), mb=endpointMirror(b);
    if(ma && mb){
      const mc=makeConnection(ma,mb,c);
      c.mirrorPartner=mc;
    }
  }

  selectObject(c);
  showToast(`${endpointLabel(a)} → ${endpointLabel(b)}`);
  return c;
}
function surfaceMidpoint(c){
  const p1=kindOf(c.a)==='anchor'?ringEdgePoint(c.a,c.b):endpointWorld(c.a);
  const p2=kindOf(c.b)==='anchor'?ringEdgePoint(c.b,c.a):endpointWorld(c.b);
  const mid=p1.clone().lerp(p2,.5);
  const ndc=mid.clone().project(camera);raycaster.setFromCamera(new THREE.Vector2(ndc.x,ndc.y),camera);
  const h=raycaster.intersectObjects(collisionMeshes.length?collisionMeshes:bodyMeshes,true)[0];
  return h?h.point.clone().addScaledVector(worldNormal(h),surfaceOffsetScene()+.008):mid;
}

function projectPointToBodyFromCamera(point, offset=.045){
  const ndc=point.clone().project(camera);
  raycaster.setFromCamera(new THREE.Vector2(ndc.x,ndc.y),camera);
  const hits=raycaster.intersectObjects(collisionMeshes.length?collisionMeshes:bodyMeshes,true);
  if(!hits.length) return point.clone();
  const h=hits[0];
  return h.point.clone().addScaledVector(worldNormal(h),Math.max(.001,surfaceOffsetScene()+offset*.25));
}

function surfaceSampledPath(c){
  const p1=kindOf(c.a)==='anchor'?ringEdgePoint(c.a,c.b):endpointWorld(c.a);
  const p2=kindOf(c.b)==='anchor'?ringEdgePoint(c.b,c.a):endpointWorld(c.b);

  if(!c.controlPoint)c.controlPoint=surfaceMidpoint(c);

  const cp=c.controlPoint.clone();
  cp.y-=(c.slack/100)*.20;

  const guide=new THREE.CatmullRomCurve3([p1,cp,p2],false,'centripetal',.55);

  // Important: use only a few surface support points. V0.4b used many
  // individual projections, which reproduced every tiny mesh/raycast wobble.
  const supports=[];
  const SUPPORTS=7;
  const hug=1-THREE.MathUtils.clamp(c.slack/100,0,1);

  for(let i=0;i<SUPPORTS;i++){
    const t=i/(SUPPORTS-1);
    let p=guide.getPoint(t);

    if(i!==0 && i!==SUPPORTS-1 && hug>.08){
      const snapped=projectPointToBodyFromCamera(p,.010);

      // Ignore implausible jumps to another body part/occluding limb.
      if(snapped.distanceTo(p)<.34){
        p=p.clone().lerp(snapped,hug*.72);
      }
    }
    supports.push(p);
  }

  // Mild moving-average pass on internal support points.
  const relaxed=supports.map(p=>p.clone());
  for(let i=1;i<supports.length-1;i++){
    relaxed[i]
      .multiplyScalar(.62)
      .addScaledVector(supports[i-1],.19)
      .addScaledVector(supports[i+1],.19);
  }
  relaxed[0].copy(p1);
  relaxed[relaxed.length-1].copy(p2);

  // Then fit one genuinely smooth curve through those few supports.
  const smoothCurve=new THREE.CatmullRomCurve3(relaxed,false,'centripetal',.5);
  return smoothCurve.getPoints(40);
}

function buildRibbonGeometry(points,widthMM,thicknessMM=2.5){
  const halfW=.15*(widthMM/30)*.5;
  const halfT=.018*(thicknessMM/2.5)*.5;

  const verts=[];
  const indices=[];
  const uvs=[];

  const upFallback=new THREE.Vector3(0,1,0);

  const frames=[];
  for(let i=0;i<points.length;i++){
    const prev=points[Math.max(0,i-1)];
    const next=points[Math.min(points.length-1,i+1)];
    const tangent=next.clone().sub(prev).normalize();

    // Approximate surface normal by raycasting the current point from camera.
    const ndc=points[i].clone().project(camera);
    raycaster.setFromCamera(new THREE.Vector2(ndc.x,ndc.y),camera);
    const h=raycaster.intersectObjects(collisionMeshes.length?collisionMeshes:bodyMeshes,true)[0];

    let normal=h?worldNormal(h):camera.getWorldDirection(new THREE.Vector3()).negate();
    normal.normalize();

    // Width axis lies tangent to the body surface and perpendicular to strap direction.
    let side=new THREE.Vector3().crossVectors(normal,tangent);
    if(side.lengthSq()<1e-6) side=new THREE.Vector3().crossVectors(upFallback,tangent);
    side.normalize();

    // Recompute normal for a stable orthogonal frame.
    normal=new THREE.Vector3().crossVectors(tangent,side).normalize();

    if(i>0 && side.dot(frames[i-1].side)<0){
      side.negate();
      normal.negate();
    }
    frames.push({tangent,side,normal});
  }

  // 4 vertices per path point: top-left, top-right, bottom-left, bottom-right
  for(let i=0;i<points.length;i++){
    const p=points[i], {side,normal}=frames[i];
    const l=p.clone().addScaledVector(side,-halfW);
    const r=p.clone().addScaledVector(side, halfW);

    const tl=l.clone().addScaledVector(normal, halfT);
    const tr=r.clone().addScaledVector(normal, halfT);
    const bl=l.clone().addScaledVector(normal,-halfT);
    const br=r.clone().addScaledVector(normal,-halfT);

    [tl,tr,bl,br].forEach(v=>verts.push(v.x,v.y,v.z));
    const u=i/(points.length-1);
    uvs.push(0,u, 1,u, 0,u, 1,u);
  }

  for(let i=0;i<points.length-1;i++){
    const a=i*4,b=(i+1)*4;

    // top
    indices.push(a,a+1,b, a+1,b+1,b);
    // bottom
    indices.push(a+2,b+2,a+3, a+3,b+2,b+3);
    // left side
    indices.push(a+2,a,b+2, a,b,b+2);
    // right side
    indices.push(a+1,a+3,b+1, a+3,b+3,b+1);
  }

  // end caps
  const s=0,e=(points.length-1)*4;
  indices.push(s+2,s+1,s, s+2,s+3,s+1);
  indices.push(e,e+1,e+2, e+1,e+3,e+2);

  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

function updateConnection(c){
  if(!c||!c.group)return;

  const points=surfaceSampledPath(c);

  while(c.group.children.length){
    const q=c.group.children.pop();
    q.geometry?.dispose?.();
    q.material?.dispose?.();
  }

  const geom=buildRibbonGeometry(points,c.widthMM,2.5);
  const mesh=new THREE.Mesh(
    geom,
    new THREE.MeshStandardMaterial({
      color:0x171718,
      roughness:.50,
      metalness:0,
      side:THREE.DoubleSide,
      emissive: selected===c ? 0x26221a : 0x000000,
      emissiveIntensity: selected===c ? .65 : 0
    })
  );
  mesh.castShadow=true;
  mesh.userData={kind:'connectionMesh',owner:c};
  c.group.add(mesh);

  const h=new THREE.Mesh(
    new THREE.SphereGeometry(.062,24,16),
    new THREE.MeshStandardMaterial({color:0xffffff,transparent:true,opacity:.24})
  );
  h.position.copy(c.controlPoint);
  h.userData={kind:'strapHandle',owner:c};
  c.group.add(h);

  const hh=new THREE.Mesh(
    new THREE.SphereGeometry(.115,18,12),
    new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.001})
  );
  hh.position.copy(c.controlPoint);
  hh.userData={kind:'strapHandleHit',owner:c};
  c.group.add(hh);

  c.handle=h;
  c.handleHit=hh;
  if(kindOf(c.a)==='anchor')rebuildRingWraps(c.a);
  if(kindOf(c.b)==='anchor')rebuildRingWraps(c.b);
  strapAnchors.filter(sa=>sa.connection===c).forEach(updateStrapAnchor);
  refreshSelectionVisuals();
}

function removeConnection(c){
  const a=c.a,b=c.b;
  strapAnchors.filter(sa=>sa.connection===c).slice().forEach(removeStrapAnchor);
  if(c.mirrorPartner)c.mirrorPartner.mirrorPartner=null;
  scene.remove(c.group);
  const i=connections.indexOf(c);
  if(i>=0)connections.splice(i,1);
  if(kindOf(a)==='anchor')rebuildRingWraps(a);
  if(kindOf(b)==='anchor')rebuildRingWraps(b);
}
function removeAnchor(a){
  connections.filter(c=>c.a===a||c.b===a).slice().forEach(removeConnection);
  if(a.userData.mirrorPartner)a.userData.mirrorPartner.userData.mirrorPartner=null;
  scene.remove(a);const i=anchors.indexOf(a);if(i>=0)anchors.splice(i,1);
}
function resetHarness(){strapAnchors.slice().forEach(removeStrapAnchor);connections.slice().forEach(removeConnection);anchors.slice().forEach(a=>scene.remove(a));anchors.length=0;selected=null;connectStart=null;hideSelection();refreshMirrorSelectedBubble();}
function setHelpers(v){
  anchors.forEach(a=>a.visible=v);
  strapAnchors.forEach(sa=>sa.group.visible=v);
  connections.forEach(c=>{
    if(c.handle)c.handle.visible=v;if(c.handleHit)c.handleHit.visible=v;
  });
}
function showSelection(){
  if(mode!=='build'){hideSelection();return;}

  const k=kindOf(selected);
  const showRing=(buildTool==='ring' && k==='anchor');
  const showStrap=(buildTool==='connect' && k==='connection');
  const showStrapAnchor=(buildTool==='connect' && k==='strapAnchor');

  ringControls.classList.toggle('hidden',!showRing);
  strapControls.classList.toggle('hidden',!showStrap);
  strapAnchorControls.classList.toggle('hidden',!showStrapAnchor);

  if(showRing){
    selectionPanel.classList.remove('hidden');
    selectionLabel.textContent='RING';
    selectionTitle.textContent=selected.userData.id;
    ringDiameterSlider.value=selected.userData.diameterMM;
    ringDiameterValue.textContent=selected.userData.diameterMM;
    ringThicknessSlider.value=selected.userData.thicknessMM;
    ringThicknessValue.textContent=selected.userData.thicknessMM;
  }else if(showStrap){
    selectionPanel.classList.remove('hidden');
    selectionLabel.textContent='RIEMEN';
    selectionTitle.textContent=selected.id;
    widthSlider.value=selected.widthMM;
    widthValue.textContent=selected.widthMM;
    slackSlider.value=selected.slack;
  }else if(showStrapAnchor){
    selectionPanel.classList.remove('hidden');
    selectionLabel.textContent='RIEMEN-ANKER';
    selectionTitle.textContent=selected.id;
    strapAnchorSlider.value=Math.round(selected.t*100);
    strapAnchorValue.textContent=Math.round(selected.t*100);
    strapAnchorSizeSlider.value=selected.sizeMM;
    strapAnchorSizeValue.textContent=selected.sizeMM;
  }else{
    selectionPanel.classList.add('hidden');
  }
}
function hideSelection(){selectionPanel.classList.add('hidden');ringControls.classList.add('hidden');strapControls.classList.add('hidden');strapAnchorControls.classList.add('hidden');}
function refreshSelectionVisuals(){
  anchors.forEach(a=>{
    a.children[0].material=(selected===a)?anchorSelectedMat:anchorMat;
  });

  strapAnchors.forEach(sa=>{
    sa.group.children[0].material=(selected===sa)?anchorSelectedMat:anchorMat;
  });

  connections.forEach(c=>{
    const mesh=c.group.children.find(ch=>ch.userData?.kind==='connectionMesh');
    if(mesh?.material){
      const active=selected===c;
      mesh.material.emissive.setHex(active?0x2c271d:0x000000);
      mesh.material.emissiveIntensity=active ? .75 : 0;
      mesh.material.needsUpdate=true;
    }
  });
}

function selectObject(obj){
  selected=obj;
  refreshSelectionVisuals();
  refreshMirrorSelectedBubble();
  showSelection();
}
function interactiveHit(x,y){
  setPointerXY(x,y);

  const ringObjs=[];
  anchors.forEach(a=>ringObjs.push(...a.children.filter(ch=>ch.userData?.kind==='anchorRing'||ch.userData?.kind==='anchorHit')));

  const strapAnchorObjs=[];
  strapAnchors.forEach(sa=>strapAnchorObjs.push(...sa.group.children));

  const strapObjs=[];
  connections.forEach(c=>{
    c.group.children.forEach(ch=>{
      strapObjs.push(ch);
    });
  });

  let groups=buildTool==='ring'
    ? [ringObjs,strapAnchorObjs,strapObjs]
    : [strapAnchorObjs,strapObjs,ringObjs];

  for(const objs of groups){
    if(!objs.length)continue;
    const h=raycaster.intersectObjects(objs,true)[0];
    if(!h)continue;
    const a=anchors.find(a=>a.children.includes(h.object));
    if(a)return{kind:'anchor',owner:a};
    const sa=strapAnchors.find(sa=>sa.group.children.includes(h.object));
    if(sa)return{kind:'strapAnchor',owner:sa};
    if(h.object.userData.kind==='strapHandle' || h.object.userData.kind==='strapHandleHit')
      return{kind:'strapHandle',owner:h.object.userData.owner};
    if(h.object.userData.kind==='connectionMesh')return{kind:'connection',owner:h.object.userData.owner};
  }
  return null;
}

function refreshBuildToolVisibility(){
  connections.forEach(c=>{
    if(c.handle)c.handle.visible=(mode==='build');if(c.handleHit)c.handleHit.visible=(mode==='build');
  });
  strapAnchors.forEach(sa=>{
    sa.group.visible=(mode==='build');
  });
}

function setBuildTool(t){
  buildTool=t;
  toolButtons.forEach(b=>b.classList.toggle('active',b.dataset.tool===t));
  connectStart=null;
  refreshBuildToolVisibility();

  // Keep selection only if it belongs to the editor of the chosen tool.
  const k=kindOf(selected);
  if(t==='ring' && k!=='anchor')selected=null;
  if(t==='connect' && k!=='connection' && k!=='strapAnchor')selected=null;

  refreshSelectionVisuals();
  refreshMirrorSelectedBubble();
  showSelection();

  if(t==='connect')showToast('Ringe verbinden oder Riemen bearbeiten');
}
toolButtons.forEach(b=>b.addEventListener('click',()=>setBuildTool(b.dataset.tool)));

widthSlider.addEventListener('input',()=>{
  if(kindOf(selected)==='connection'){
    selected.widthMM=+widthSlider.value;widthValue.textContent=widthSlider.value;updateConnection(selected);
    if(selected.mirrorPartner){selected.mirrorPartner.widthMM=selected.widthMM;updateConnection(selected.mirrorPartner)}
  }
});
slackSlider.addEventListener('input',()=>{
  if(kindOf(selected)==='connection'){
    selected.slack=+slackSlider.value;updateConnection(selected);
    if(selected.mirrorPartner){selected.mirrorPartner.slack=selected.slack;updateConnection(selected.mirrorPartner)}
  }
});
ringDiameterSlider.addEventListener('input',()=>{
  if(kindOf(selected)==='anchor'){
    selected.userData.diameterMM=+ringDiameterSlider.value;ringDiameterValue.textContent=ringDiameterSlider.value;rebuildRingGeometry(selected);
    connections.filter(c=>c.a===selected||c.b===selected).forEach(updateConnection);
    const mp=selected.userData.mirrorPartner;
    if(mp){mp.userData.diameterMM=selected.userData.diameterMM;rebuildRingGeometry(mp);connections.filter(c=>c.a===mp||c.b===mp).forEach(updateConnection)}
  }
});
ringThicknessSlider.addEventListener('input',()=>{
  if(kindOf(selected)==='anchor'){
    selected.userData.thicknessMM=+ringThicknessSlider.value;ringThicknessValue.textContent=ringThicknessSlider.value;rebuildRingGeometry(selected);
    connections.filter(c=>c.a===selected||c.b===selected).forEach(updateConnection);
    const mp=selected.userData.mirrorPartner;
    if(mp){mp.userData.thicknessMM=selected.userData.thicknessMM;rebuildRingGeometry(mp);connections.filter(c=>c.a===mp||c.b===mp).forEach(updateConnection)}
  }
});
addStrapAnchorBtn.addEventListener('click',()=>{
  if(kindOf(selected)!=='connection')return;
  const sa=makeStrapAnchor(selected,.5);
  if(mirrorMode){
    const mc=selected.mirrorPartner||findMirrorConnection(selected);
    if(mc){
      const msa=makeStrapAnchor(mc,.5,sa);
      sa.mirrorPartner=msa;
    }
  }
  selectObject(sa);
});
strapAnchorSlider.addEventListener('input',()=>{
  if(kindOf(selected)==='strapAnchor'){
    selected.t=+strapAnchorSlider.value/100;
    strapAnchorValue.textContent=strapAnchorSlider.value;
    updateStrapAnchor(selected);
    connections.filter(c=>c.a===selected||c.b===selected).forEach(updateConnection);
    if(selected.mirrorPartner){
      selected.mirrorPartner.t=selected.t;
      updateStrapAnchor(selected.mirrorPartner);
      connections.filter(c=>c.a===selected.mirrorPartner||c.b===selected.mirrorPartner).forEach(updateConnection);
    }
  }
});
strapAnchorSizeSlider.addEventListener('input',()=>{
  if(kindOf(selected)==='strapAnchor'){
    selected.sizeMM=+strapAnchorSizeSlider.value;
    strapAnchorSizeValue.textContent=strapAnchorSizeSlider.value;
    updateStrapAnchorGeometry(selected);
    if(selected.mirrorPartner){
      selected.mirrorPartner.sizeMM=selected.sizeMM;
      updateStrapAnchorGeometry(selected.mirrorPartner);
    }
  }
});

mirrorSelectedBtn.addEventListener('click',e=>{
  e.preventDefault();
  e.stopPropagation();
  if(!selected){
    showToast('Erst ein Objekt auswählen');
    return;
  }
  mirrorSelectedObject();
  if(getMirrorPartner(selected))showToast('Auswahl gespiegelt und gekoppelt');
});

mirrorToggle.addEventListener('click',e=>{
  e.preventDefault();
  e.stopPropagation();
  mirrorMode=!mirrorMode;
  mirrorToggle.classList.toggle('active',mirrorMode);
  mirrorToggle.setAttribute('aria-pressed',mirrorMode?'true':'false');
  showToast(mirrorMode?'Spiegelmodus an':'Spiegelmodus aus');
});
deleteSelectedBtn.addEventListener('click',()=>{
  if(!selected)return;
  const k=kindOf(selected);
  if(k==='anchor')removeAnchor(selected);
  else if(k==='connection')removeConnection(selected);
  else if(k==='strapAnchor')removeStrapAnchor(selected);
  selected=null;
  hideSelection();
  refreshSelectionVisuals();
  refreshMirrorSelectedBubble();
});
resetBtn.addEventListener('click',resetHarness);



function refreshSurfaceOffset(){
  anchors.forEach(a=>{
    if(a.userData.surfacePoint && a.userData.normal){
      a.position.copy(a.userData.surfacePoint)
        .addScaledVector(a.userData.normal,surfaceOffsetScene()+ringTubeRadius(a));
    }
  });
  connections.forEach(c=>{
    c.controlPoint=null;
    updateConnection(c);
  });
  strapAnchors.forEach(updateStrapAnchor);
}


envelopeSmoothSlider.addEventListener('input',()=>{
  envelopeSmoothPct=+envelopeSmoothSlider.value;
  envelopeSmoothValue.textContent=envelopeSmoothSlider.value;
  rebuildEnvelope();
});

envelopeInflateSlider.addEventListener('input',()=>{
  envelopeInflateMM=+envelopeInflateSlider.value;
  envelopeInflateValue.textContent=envelopeInflateSlider.value;
  rebuildEnvelope();
});

envelopeVisibleToggle.addEventListener('click',e=>{
  e.preventDefault();
  e.stopPropagation();
  setEnvelopeVisible(!envelopeVisible);
});

surfaceOffsetSlider.addEventListener('input',()=>{
  surfaceOffsetMM=+surfaceOffsetSlider.value;
  surfaceOffsetValue.textContent=surfaceOffsetSlider.value;
  refreshSurfaceOffset();
});

function syncRotationUI(){
  const d=180/Math.PI;
  rotXSlider.value=Math.round(mannequin.rotation.x*d);
  rotYSlider.value=Math.round(mannequin.rotation.y*d);
  rotZSlider.value=Math.round(mannequin.rotation.z*d);
  rotXValue.textContent=rotXSlider.value;
  rotYValue.textContent=rotYSlider.value;
  rotZValue.textContent=rotZSlider.value;
  surfaceOffsetSlider.value=surfaceOffsetMM;
  surfaceOffsetValue.textContent=surfaceOffsetMM;
  envelopeSmoothSlider.value=envelopeSmoothPct;
  envelopeSmoothValue.textContent=envelopeSmoothPct;
  envelopeInflateSlider.value=envelopeInflateMM;
  envelopeInflateValue.textContent=envelopeInflateMM;
  setEnvelopeVisible(envelopeVisible);
}
function applyManualRotation(){
  const r=Math.PI/180;
  mannequin.rotation.set(+rotXSlider.value*r,+rotYSlider.value*r,+rotZSlider.value*r);
  rotXValue.textContent=rotXSlider.value;
  rotYValue.textContent=rotYSlider.value;
  rotZValue.textContent=rotZSlider.value;
  mannequin.updateMatrixWorld(true);
  rebuildEnvelope();
  resetHarness();
}
rotateModelBtn.addEventListener('click',e=>{
  e.preventDefault();e.stopPropagation();
  rotationPanel.classList.toggle('hidden');
  rotateModelBtn.classList.toggle('active',!rotationPanel.classList.contains('hidden'));
  syncRotationUI();
});
closeRotationBtn.addEventListener('click',()=>{
  rotationPanel.classList.add('hidden');
  rotateModelBtn.classList.remove('active');
});
[rotXSlider,rotYSlider,rotZSlider].forEach(s=>s.addEventListener('input',applyManualRotation));
rotationResetBtn.addEventListener('click',()=>{
  mannequin.rotation.set(0,0,0);
  mannequin.updateMatrixWorld(true);
  rebuildEnvelope();
  syncRotationUI();
  resetHarness();
});

// gestures
const pointers=new Map();let single=null,twoStart=null;const TAP=9;
function pinfo(e){return{x:e.clientX,y:e.clientY,px:e.clientX,py:e.clientY}}
canvas.addEventListener('pointerdown',e=>{
  canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,pinfo(e));
  if(pointers.size===1){
    const hit=mode==='build'?interactiveHit(e.clientX,e.clientY):null;
    // Immediate subtle feedback when touching a selectable object.
    if(buildTool==='ring' && hit?.kind==='anchor')selectObject(hit.owner);
    if(buildTool==='connect' && hit?.kind==='connection')selectObject(hit.owner);
    if(buildTool==='connect' && hit?.kind==='strapAnchor')selectObject(hit.owner);
    if(buildTool==='connect' && hit?.kind==='strapHandle')selectObject(hit.owner);
    single={id:e.pointerId,sx:e.clientX,sy:e.clientY,lx:e.clientX,ly:e.clientY,hit};
  }else if(pointers.size===2){
    single=null;const[a,b]=[...pointers.values()];
    twoStart={dist:Math.hypot(b.x-a.x,b.y-a.y),cx:(a.x+b.x)/2,cy:(a.y+b.y)/2,az:camAz,d:camDist,ty:target.y}
  }
});
canvas.addEventListener('pointermove',e=>{
  const p=pointers.get(e.pointerId);if(!p)return;p.px=p.x;p.py=p.y;p.x=e.clientX;p.y=e.clientY;
  if(pointers.size===2){
    const[a,b]=[...pointers.values()],dist=Math.max(20,Math.hypot(b.x-a.x,b.y-a.y)),cx=(a.x+b.x)/2,cy=(a.y+b.y)/2;
    camDist=THREE.MathUtils.clamp(twoStart.d*(twoStart.dist/dist),3.1,7.2);camAz=twoStart.az-(cx-twoStart.cx)*.006;target.y=THREE.MathUtils.clamp(twoStart.ty+(cy-twoStart.cy)*.004,-.75,.85);updateCamera();return;
  }
  if(!single||single.id!==e.pointerId)return;
  if(buildTool==='ring' && single.hit?.kind==='anchor'){
    const moveDist=Math.hypot(e.clientX-single.sx,e.clientY-single.sy);
    if(moveDist>6){
      const h=bodyHitXY(e.clientX,e.clientY);
      if(h)positionAnchor(single.hit.owner,h);
    }
    single.lx=e.clientX;single.ly=e.clientY;return;
  }
  if(buildTool==='connect' && single.hit?.kind==='strapHandle'){
    const h=bodyHitXY(e.clientX,e.clientY);
    if(h){
      const c=single.hit.owner;
      c.controlPoint=h.point.clone().addScaledVector(worldNormal(h),surfaceOffsetScene()+.008);
      updateConnection(c);

      const mc=c.mirrorPartner;
      if(mc && mc!==c){
        mc.controlPoint=mirrorWorldPoint(c.controlPoint);
        updateConnection(mc);
      }
    }
    single.lx=e.clientX;single.ly=e.clientY;return;
  }
  const ddx=e.clientX-single.lx,ddy=e.clientY-single.ly;camAz-=ddx*.009;camEl=THREE.MathUtils.clamp(camEl+ddy*.006,-.72,.72);updateCamera();single.lx=e.clientX;single.ly=e.clientY;
});
canvas.addEventListener('pointerup',e=>{
  pointers.delete(e.pointerId);if(pointers.size<2)twoStart=null;
  if(single&&single.id===e.pointerId){
    const dist=Math.hypot(e.clientX-single.sx,e.clientY-single.sy);
    if(dist<=TAP&&mode==='build'){
      const ih=single.hit;
      if(ih?.kind==='anchor' || ih?.kind==='strapAnchor'){
        if(buildTool==='connect'){
          if(!connectStart){
            connectStart=ih.owner;
            selectObject(ih.owner);
            showToast('Zweites Ziel antippen');
          }else{
            makeConnection(connectStart,ih.owner);
            connectStart=null;
          }
        }else if(ih.kind==='anchor'){
          selectObject(ih.owner);
        }
      }else if(ih?.kind==='connection'){
        if(buildTool==='connect')selectObject(ih.owner);
      }else if(!ih&&buildTool==='ring'){
        const h=bodyHitXY(e.clientX,e.clientY);
        if(h)selectObject(makeAnchor(h));
      }
    }
  }
  single=null;try{canvas.releasePointerCapture(e.pointerId)}catch{}
});
canvas.addEventListener('pointercancel',e=>{pointers.delete(e.pointerId);single=null;twoStart=null});

// modes
function switchMode(next){
  mode=next;modeButtons.forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));
  modeTitle.textContent=mode==='build'?'Build':mode==='accessories'?'Accessories':'Photo';
  selectionPanel.classList.add('hidden');accessoryPanel.classList.add('hidden');photoPanel.classList.add('hidden');
  buildTools.style.display=mode==='build'?'flex':'none';
  if(mode==='build'){setHelpers(true);refreshBuildToolVisibility();if(selected)showSelection()}
  if(mode==='accessories'){setHelpers(false);accessoryPanel.classList.remove('hidden')}
  if(mode==='photo'){setHelpers(false);photoPanel.classList.remove('hidden')}
}
modeButtons.forEach(b=>b.addEventListener('click',()=>switchMode(b.dataset.mode)));

// swipe down
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

rebuildEnvelope();

function resize(){const w=viewport.clientWidth,h=viewport.clientHeight;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false)}
addEventListener('resize',resize);resize();
function animate(){requestAnimationFrame(animate);renderer.render(scene,camera)}animate();
