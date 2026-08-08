
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const canvas = document.getElementById('scene');
const viewport = document.getElementById('viewport');
const chrome = document.getElementById('chrome');
const restoreUI = document.getElementById('restoreUI');
const hint = document.getElementById('hint');
const strapPanel = document.getElementById('strapPanel');
const accessoryPanel = document.getElementById('accessoryPanel');
const photoPanel = document.getElementById('photoPanel');
const modePill = document.getElementById('modePill');
const modeButtons = [...document.querySelectorAll('.mode')];
const widthSlider = document.getElementById('widthSlider');
const widthValue = document.getElementById('widthValue');
const slackSlider = document.getElementById('slackSlider');
const resetBtn = document.getElementById('resetBtn');
const deleteStrapBtn = document.getElementById('deleteStrapBtn');

let mode = 'build';

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x0b0b0d, 5.8, 9.2);

const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 50);
camera.position.set(0, 0.12, 5.25);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
  powerPreference: 'high-performance'
});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 3.4;
controls.maxDistance = 7.0;
controls.target.set(0, 0.06, 0);
controls.rotateSpeed = 0.52;
controls.zoomSpeed = 0.72;
// One finger is reserved for object interaction.
// Two fingers rotate + zoom the camera.
controls.touches.ONE = THREE.TOUCH.PAN;
controls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE;

scene.add(new THREE.HemisphereLight(0xffffff, 0x31313a, 2.1));
const key = new THREE.DirectionalLight(0xffffff, 3.0);
key.position.set(2.7, 4.2, 3.3);
key.castShadow = true;
scene.add(key);

const fill = new THREE.DirectionalLight(0xd8ddff, 1.0);
fill.position.set(-3, 1.7, 2);
scene.add(fill);

const rim = new THREE.DirectionalLight(0xa7b4ff, 1.15);
rim.position.set(-2.8, 2.5, -3.3);
scene.add(rim);

const floor = new THREE.Mesh(
  new THREE.CircleGeometry(2.35, 96),
  new THREE.MeshStandardMaterial({ color:0x151519, roughness:1 })
);
floor.rotation.x = -Math.PI/2;
floor.position.y = -1.80;
floor.receiveShadow = true;
scene.add(floor);

// ---------- Mannequin ----------
const mannequin = new THREE.Group();
mannequin.rotation.y = 0.03;
scene.add(mannequin);

const bodyMat = new THREE.MeshStandardMaterial({
  color: 0xd8d7d3,
  roughness: .78,
  metalness: 0
});
const bodyMeshes = [];

function addBody(mesh){
  mesh.material = bodyMat;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mannequin.add(mesh);
  bodyMeshes.push(mesh);
  return mesh;
}

function ellipsoid(rx, ry, rz, x, y, z=0){
  const m = addBody(new THREE.Mesh(new THREE.SphereGeometry(1,48,34)));
  m.scale.set(rx,ry,rz);
  m.position.set(x,y,z);
  return m;
}

function taperedLimb(rTop, rBottom, length, x, y, rotZ, z=0){
  const geom = new THREE.CylinderGeometry(rTop,rBottom,length,36,8,false);
  const m = addBody(new THREE.Mesh(geom));
  m.position.set(x,y,z);
  m.rotation.z = rotZ;
  return m;
}

// Head / neck
ellipsoid(.255,.335,.245,0,1.49,.01);
ellipsoid(.245,.11,.23,0,1.31,.02); // jaw transition
const neck = addBody(new THREE.Mesh(new THREE.CylinderGeometry(.12,.145,.27,36,4)));
neck.position.set(0,1.16,0);

// Upper torso as overlapping anatomical masses
ellipsoid(.50,.60,.285,0,.70,.01);     // ribcage
ellipsoid(.43,.42,.25,0,.23,.005);     // abdomen
ellipsoid(.47,.32,.29,0,-.22,.01);     // pelvis
ellipsoid(.18,.18,.20,-.33,.83,.005);  // shoulders
ellipsoid(.18,.18,.20,.33,.83,.005);

// Arms
taperedLimb(.145,.12,.62,-.55,.53,-.11);
ellipsoid(.13,.15,.13,-.60,.20,0);
taperedLimb(.12,.095,.61,-.64,-.10,-.02);
ellipsoid(.10,.16,.075,-.66,-.48,.015);

taperedLimb(.145,.12,.62,.55,.53,.11);
ellipsoid(.13,.15,.13,.60,.20,0);
taperedLimb(.12,.095,.61,.64,-.10,.02);
ellipsoid(.10,.16,.075,.66,-.48,.015);

// Legs
ellipsoid(.22,.25,.22,-.21,-.50,.005);
ellipsoid(.22,.25,.22,.21,-.50,.005);
taperedLimb(.20,.155,.72,-.20,-.90,.015);
taperedLimb(.20,.155,.72,.20,-.90,-.015);
ellipsoid(.16,.16,.15,-.20,-1.28,.01);
ellipsoid(.16,.16,.15,.20,-1.28,.01);
taperedLimb(.145,.105,.67,-.20,-1.57,-.005);
taperedLimb(.145,.105,.67,.20,-1.57,.005);

const anchorMat = new THREE.MeshStandardMaterial({
  color:0xfff4c4, emissive:0x4c4010, emissiveIntensity:.85,
  roughness:.34, metalness:.18
});

const anchors = [];
let strap = null;
let selectedAnchor = null;

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

function setPointer(evt){
  const r = canvas.getBoundingClientRect();
  pointer.x = ((evt.clientX-r.left)/r.width)*2 - 1;
  pointer.y = -((evt.clientY-r.top)/r.height)*2 + 1;
  raycaster.setFromCamera(pointer,camera);
}

function bodyHit(evt){
  setPointer(evt);
  const hits = raycaster.intersectObjects(bodyMeshes,false);
  return hits[0] || null;
}

function worldNormalFromHit(hit){
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld);
  return hit.face.normal.clone().applyMatrix3(normalMatrix).normalize();
}

function positionAnchorGroup(group, hit){
  const n = worldNormalFromHit(hit);
  group.position.copy(hit.point).addScaledVector(n,.040);
  group.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),n);
  group.userData.normal.copy(n);
}

function makeAnchor(hit){
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.066,.017,16,48), anchorMat);
  ring.userData.kind = 'anchorPart';
  const dot = new THREE.Mesh(
    new THREE.CircleGeometry(.047,28),
    new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.14,side:THREE.DoubleSide})
  );
  dot.position.z = -.003;
  dot.userData.kind = 'anchorPart';
  g.add(ring,dot);
  g.userData.kind='anchor';
  g.userData.normal=new THREE.Vector3(0,0,1);
  positionAnchorGroup(g,hit);
  scene.add(g);
  anchors.push(g);
  return g;
}

function clearAnchors(){
  anchors.forEach(a=>scene.remove(a));
  anchors.length=0;
  selectedAnchor=null;
}

function makeStrap(){
  if(anchors.length<2) return;
  strap = new THREE.Group();
  strap.userData.kind='strap';
  strap.userData.widthMM=Number(widthSlider.value);
  strap.userData.slack=Number(slackSlider.value);
  strap.userData.controlPoint = null;
  scene.add(strap);
  updateStrap();
  strapPanel.classList.remove('hidden');
  hint.classList.add('minimized');
}

function defaultControlPoint(){
  const a=anchors[0].position.clone();
  const b=anchors[1].position.clone();
  const mid=a.clone().lerp(b,.5);

  // Find a point on the mannequin near the visual midpoint by raycasting
  // from the camera through the midpoint's screen projection.
  const ndc = mid.clone().project(camera);
  raycaster.setFromCamera(new THREE.Vector2(ndc.x,ndc.y),camera);
  const hit = raycaster.intersectObjects(bodyMeshes,false)[0];
  if(hit){
    const n=worldNormalFromHit(hit);
    return hit.point.clone().addScaledVector(n,.055);
  }
  return mid;
}

function updateStrap(){
  if(!strap || anchors.length<2) return;
  const a=anchors[0].position.clone();
  const b=anchors[1].position.clone();

  if(!strap.userData.controlPoint){
    strap.userData.controlPoint=defaultControlPoint();
  }

  const c=strap.userData.controlPoint.clone();
  const slack=(strap.userData.slack||0)/100;

  // Slack is intentionally subtle in V0.2. True gravity/catenary comes later.
  const cSlack=c.clone();
  cSlack.y -= slack*.28;

  const curve=new THREE.CatmullRomCurve3([a,cSlack,b],false,'centripetal',.5);

  while(strap.children.length){
    const child=strap.children.pop();
    child.geometry?.dispose?.();
    child.material?.dispose?.();
  }

  const widthScene=.15*((strap.userData.widthMM||30)/30);
  const tube=new THREE.Mesh(
    new THREE.TubeGeometry(curve,88,widthScene*.17,12,false),
    new THREE.MeshStandardMaterial({color:0x181819,roughness:.58,metalness:0})
  );
  tube.castShadow=true;
  tube.userData.kind='strapMesh';
  strap.add(tube);

  const handle=new THREE.Mesh(
    new THREE.SphereGeometry(.085,28,18),
    new THREE.MeshStandardMaterial({color:0xffffff,transparent:true,opacity:.26,roughness:.25})
  );
  handle.position.copy(c);
  handle.userData.kind='strapHandle';
  strap.add(handle);
  strap.userData.handle=handle;
  strap.userData.curve=curve;
}

function interactiveHit(evt){
  setPointer(evt);
  const objects=[];
  anchors.forEach(a=>objects.push(...a.children));
  if(strap) objects.push(...strap.children);
  const hit=raycaster.intersectObjects(objects,true)[0];
  if(!hit) return null;

  const parentAnchor=anchors.find(a=>a.children.includes(hit.object));
  if(parentAnchor) return {kind:'anchor',object:parentAnchor,hit};
  if(hit.object.userData.kind==='strapHandle') return {kind:'strapHandle',object:hit.object,hit};
  if(hit.object.userData.kind==='strapMesh') return {kind:'strapMesh',object:hit.object,hit};
  return null;
}

function setHelpersVisible(v){
  anchors.forEach(a=>a.visible=v);
  if(strap?.userData?.handle) strap.userData.handle.visible=v;
}

// ---------- Touch interaction ----------
const activePointers=new Map();
let candidate=null;
let dragKind=null;
let dragObject=null;
let gestureHadMultiTouch=false;
const TAP_MOVE=10;
const DRAG_START=8;

canvas.addEventListener('pointerdown',evt=>{
  activePointers.set(evt.pointerId,{x:evt.clientX,y:evt.clientY});
  if(activePointers.size>=2){
    gestureHadMultiTouch=true;
    candidate=null;
    dragKind=null;
    dragObject=null;
    return;
  }

  if(mode!=='build') return;

  const interactive=interactiveHit(evt);
  candidate={
    id:evt.pointerId,
    startX:evt.clientX,startY:evt.clientY,
    interactive,
    startedAt:performance.now()
  };
});

canvas.addEventListener('pointermove',evt=>{
  if(activePointers.has(evt.pointerId)){
    activePointers.set(evt.pointerId,{x:evt.clientX,y:evt.clientY});
  }

  if(activePointers.size>=2 || gestureHadMultiTouch) return;
  if(!candidate || candidate.id!==evt.pointerId || mode!=='build') return;

  const dx=evt.clientX-candidate.startX;
  const dy=evt.clientY-candidate.startY;
  const dist=Math.hypot(dx,dy);

  if(!dragKind && dist>DRAG_START && candidate.interactive){
    if(candidate.interactive.kind==='anchor'){
      dragKind='anchor';
      dragObject=candidate.interactive.object;
      selectedAnchor=dragObject;
      controls.enabled=false;
      canvas.setPointerCapture(evt.pointerId);
    }else if(candidate.interactive.kind==='strapHandle'){
      dragKind='strapHandle';
      dragObject=strap;
      controls.enabled=false;
      canvas.setPointerCapture(evt.pointerId);
    }
  }

  if(dragKind==='anchor'){
    const hit=bodyHit(evt);
    if(hit){
      positionAnchorGroup(dragObject,hit);
      if(strap) updateStrap();
    }
  }else if(dragKind==='strapHandle' && strap){
    const hit=bodyHit(evt);
    if(hit){
      const n=worldNormalFromHit(hit);
      strap.userData.controlPoint=hit.point.clone().addScaledVector(n,.060);
      updateStrap();
    }
  }
});

canvas.addEventListener('pointerup',evt=>{
  const wasMulti=gestureHadMultiTouch;
  activePointers.delete(evt.pointerId);

  if(activePointers.size===0){
    gestureHadMultiTouch=false;
  }

  if(dragKind){
    dragKind=null;
    dragObject=null;
    controls.enabled=true;
    try{canvas.releasePointerCapture(evt.pointerId)}catch{}
    candidate=null;
    return;
  }

  if(!candidate || candidate.id!==evt.pointerId || wasMulti || mode!=='build'){
    candidate=null;
    return;
  }

  const dx=evt.clientX-candidate.startX;
  const dy=evt.clientY-candidate.startY;
  const dist=Math.hypot(dx,dy);

  if(dist<=TAP_MOVE && !candidate.interactive && anchors.length<2){
    const hit=bodyHit(evt);
    if(hit){
      makeAnchor(hit);
      if(anchors.length===2) makeStrap();
    }
  }

  candidate=null;
});

canvas.addEventListener('pointercancel',evt=>{
  activePointers.delete(evt.pointerId);
  candidate=null;
  dragKind=null;
  dragObject=null;
  controls.enabled=true;
  if(activePointers.size===0) gestureHadMultiTouch=false;
});

// ---------- Controls ----------
widthSlider.addEventListener('input',()=>{
  widthValue.textContent=widthSlider.value;
  if(strap){strap.userData.widthMM=Number(widthSlider.value);updateStrap();}
});
slackSlider.addEventListener('input',()=>{
  if(strap){strap.userData.slack=Number(slackSlider.value);updateStrap();}
});

function resetAll(){
  if(strap){scene.remove(strap);strap=null}
  clearAnchors();
  strapPanel.classList.add('hidden');
  hint.classList.remove('minimized');
  widthSlider.value=30;
  widthValue.textContent='30';
  slackSlider.value=8;
  if(mode==='photo') setHelpersVisible(false);
}
resetBtn.addEventListener('click',resetAll);
deleteStrapBtn.addEventListener('click',resetAll);

// ---------- Modes ----------
function switchMode(next){
  mode=next;
  modeButtons.forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));
  document.querySelector('.topbar .title').textContent =
    mode==='build'?'Build':mode==='accessories'?'Accessories':'Photo';

  strapPanel.classList.add('hidden');
  accessoryPanel.classList.add('hidden');
  photoPanel.classList.add('hidden');

  if(mode==='build'){
    setHelpersVisible(true);
    if(strap) strapPanel.classList.remove('hidden');
  }else if(mode==='accessories'){
    setHelpersVisible(false);
    accessoryPanel.classList.remove('hidden');
  }else{
    setHelpersVisible(false);
    photoPanel.classList.remove('hidden');
  }
}
modeButtons.forEach(b=>b.addEventListener('click',()=>switchMode(b.dataset.mode)));

// ---------- Swipe-down UI ----------
function installSwipeDown(el){
  let sy=0, sx=0, tracking=false;
  el.addEventListener('pointerdown',e=>{
    if(e.pointerType==='mouse' && e.button!==0) return;
    sy=e.clientY; sx=e.clientX; tracking=true;
  });
  el.addEventListener('pointerup',e=>{
    if(!tracking)return;
    const dy=e.clientY-sy, dx=e.clientX-sx;
    tracking=false;
    if(dy>55 && Math.abs(dy)>Math.abs(dx)*1.2){
      chrome.classList.add('ui-hidden');
      restoreUI.classList.remove('hidden');
    }
  });
  el.addEventListener('pointercancel',()=>tracking=false);
}
[strapPanel,accessoryPanel,photoPanel,modePill].forEach(installSwipeDown);

restoreUI.addEventListener('click',()=>{
  chrome.classList.remove('ui-hidden');
  restoreUI.classList.add('hidden');
});

// ---------- Resize / render ----------
function resize(){
  const w=viewport.clientWidth,h=viewport.clientHeight;
  camera.aspect=w/h;
  camera.updateProjectionMatrix();
  renderer.setSize(w,h,false);
}
addEventListener('resize',resize);
resize();

function animate(){
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene,camera);
}
animate();
