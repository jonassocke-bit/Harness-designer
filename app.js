
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const $=id=>document.getElementById(id);
const canvas=$('scene'), viewport=$('viewport'), chrome=$('chrome'), restoreUI=$('restoreUI');
const hint=$('hint'), strapPanel=$('strapPanel'), accessoryPanel=$('accessoryPanel'), photoPanel=$('photoPanel');
const widthSlider=$('widthSlider'), widthValue=$('widthValue'), slackSlider=$('slackSlider');
const resetBtn=$('resetBtn'), deleteStrapBtn=$('deleteStrapBtn'), modelBtn=$('modelBtn'), modelInput=$('modelInput');
const toast=$('toast'), modeTitle=$('modeTitle');
const modeButtons=[...document.querySelectorAll('.mode')];

let mode='build';
const scene=new THREE.Scene();
scene.fog=new THREE.Fog(0x09090b,6.2,10);

const camera=new THREE.PerspectiveCamera(31,1,.01,50);
let camAz=0, camEl=.02, camDist=5.25;
const target=new THREE.Vector3(0,.08,0);

const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;

scene.add(new THREE.HemisphereLight(0xffffff,0x303038,2.0));
const key=new THREE.DirectionalLight(0xffffff,3.15);key.position.set(2.7,4.4,3.4);key.castShadow=true;scene.add(key);
const fill=new THREE.DirectionalLight(0xd8ddff,1.0);fill.position.set(-3,2,2);scene.add(fill);
const rim=new THREE.DirectionalLight(0xa7b4ff,1.25);rim.position.set(-3,2.8,-3.2);scene.add(rim);

const floor=new THREE.Mesh(new THREE.CircleGeometry(2.35,96),new THREE.MeshStandardMaterial({color:0x141418,roughness:1}));
floor.rotation.x=-Math.PI/2;floor.position.y=-1.81;floor.receiveShadow=true;scene.add(floor);

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

// -------- mannequin / collision root --------
let mannequin=new THREE.Group(); scene.add(mannequin);
let bodyMeshes=[];
const bodyMat=new THREE.MeshStandardMaterial({color:0xd7d5d0,roughness:.78,metalness:0});

function registerMesh(mesh, overrideMaterial=true){
  if(overrideMaterial) mesh.material=bodyMat;
  mesh.castShadow=true;mesh.receiveShadow=true;
  bodyMeshes.push(mesh);
}

function addMesh(mesh){ registerMesh(mesh,true); mannequin.add(mesh); return mesh; }
function ellipsoid(rx,ry,rz,x,y,z=0){
  const m=addMesh(new THREE.Mesh(new THREE.SphereGeometry(1,64,44)));
  m.scale.set(rx,ry,rz);m.position.set(x,y,z);return m;
}
function limb(rt,rb,len,x,y,rz,z=0){
  const m=addMesh(new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,len,48,12,false)));
  m.position.set(x,y,z);m.rotation.z=rz;return m;
}

// Improved neutral tailoring mannequin: still a fallback, but smoother and more human-like.
function buildFallback(){
  bodyMeshes=[];
  mannequin.clear();
  ellipsoid(.245,.325,.235,0,1.50,.012);
  ellipsoid(.225,.115,.215,0,1.30,.025);
  const neck=addMesh(new THREE.Mesh(new THREE.CylinderGeometry(.115,.145,.25,48,6)));neck.position.set(0,1.16,0);
  ellipsoid(.48,.57,.27,0,.71,.012);
  ellipsoid(.41,.38,.235,0,.30,.012);
  ellipsoid(.445,.30,.28,0,-.12,.015);
  ellipsoid(.19,.155,.205,-.37,.84,.012);ellipsoid(.19,.155,.205,.37,.84,.012);
  // slight chest / scapular shaping
  ellipsoid(.22,.19,.105,-.20,.73,.245);ellipsoid(.22,.19,.105,.20,.73,.245);
  limb(.135,.112,.60,-.55,.54,-.12);ellipsoid(.125,.145,.125,-.59,.20,0);limb(.112,.09,.59,-.63,-.10,-.025);ellipsoid(.095,.155,.065,-.65,-.47,.02);
  limb(.135,.112,.60,.55,.54,.12);ellipsoid(.125,.145,.125,.59,.20,0);limb(.112,.09,.59,.63,-.10,.025);ellipsoid(.095,.155,.065,.65,-.47,.02);
  ellipsoid(.215,.235,.215,-.205,-.40,.01);ellipsoid(.215,.235,.215,.205,-.40,.01);
  limb(.185,.145,.70,-.20,-.83,.018);limb(.185,.145,.70,.20,-.83,-.018);
  ellipsoid(.15,.15,.145,-.20,-1.20,.01);ellipsoid(.15,.15,.145,.20,-1.20,.01);
  limb(.14,.098,.66,-.20,-1.53,-.005);limb(.14,.098,.66,.20,-1.53,.005);
}
buildFallback();

function showToast(msg){
  toast.textContent=msg;toast.classList.remove('hidden');
  clearTimeout(showToast.t);showToast.t=setTimeout(()=>toast.classList.add('hidden'),2200);
}

modelBtn.addEventListener('click',()=>modelInput.click());
modelInput.addEventListener('change',async()=>{
  const file=modelInput.files?.[0]; if(!file)return;
  const url=URL.createObjectURL(file);
  try{
    const gltf=await new GLTFLoader().loadAsync(url);
    const obj=gltf.scene;
    const box=new THREE.Box3().setFromObject(obj);
    const size=box.getSize(new THREE.Vector3());
    if(!isFinite(size.y)||size.y<=0) throw new Error('Ungültiges Modell');
    const scale=3.25/size.y;
    obj.scale.setScalar(scale);
    obj.updateMatrixWorld(true);
    const box2=new THREE.Box3().setFromObject(obj);
    const center=box2.getCenter(new THREE.Vector3());
    obj.position.x-=center.x;
    obj.position.z-=center.z;
    obj.position.y+=(-1.75-box2.min.y);
    obj.updateMatrixWorld(true);

    scene.remove(mannequin);
    mannequin=new THREE.Group();
    mannequin.add(obj);
    scene.add(mannequin);
    bodyMeshes=[];
    obj.traverse(n=>{if(n.isMesh){registerMesh(n,false);}});
    resetHarnessOnly();
    showToast('3D-Modell geladen');
  }catch(e){
    console.error(e);showToast('Modell konnte nicht geladen werden');
  }finally{
    URL.revokeObjectURL(url);modelInput.value='';
  }
});

// -------- anchors / strap --------
const anchorMat=new THREE.MeshStandardMaterial({color:0xfff4c4,emissive:0x4c4010,emissiveIntensity:.85,roughness:.34,metalness:.18});
const anchors=[];let strap=null;
const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();

function setPointerXY(x,y){
  const r=canvas.getBoundingClientRect();
  pointer.x=((x-r.left)/r.width)*2-1;pointer.y=-((y-r.top)/r.height)*2+1;
  raycaster.setFromCamera(pointer,camera);
}
function bodyHitXY(x,y){
  setPointerXY(x,y);return raycaster.intersectObjects(bodyMeshes,true)[0]||null;
}
function worldNormal(hit){
  const nm=new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld);
  return hit.face.normal.clone().applyMatrix3(nm).normalize();
}
function positionAnchor(g,hit){
  const n=worldNormal(hit);
  g.position.copy(hit.point).addScaledVector(n,.038);
  g.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),n);
  g.userData.normal.copy(n);
}
function makeAnchor(hit){
  const g=new THREE.Group();
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.066,.017,16,48),anchorMat);ring.userData.kind='anchorPart';
  const dot=new THREE.Mesh(new THREE.CircleGeometry(.046,28),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.13,side:THREE.DoubleSide}));dot.position.z=-.003;dot.userData.kind='anchorPart';
  g.add(ring,dot);g.userData.kind='anchor';g.userData.normal=new THREE.Vector3(0,0,1);positionAnchor(g,hit);
  scene.add(g);anchors.push(g);return g;
}
function clearAnchors(){anchors.forEach(a=>scene.remove(a));anchors.length=0}
function closestSurfaceToScreenMid(p){
  const ndc=p.clone().project(camera);raycaster.setFromCamera(new THREE.Vector2(ndc.x,ndc.y),camera);
  const h=raycaster.intersectObjects(bodyMeshes,true)[0];if(!h)return p;
  return h.point.clone().addScaledVector(worldNormal(h),.055);
}
function makeStrap(){
  if(anchors.length<2)return;
  strap=new THREE.Group();strap.userData.widthMM=+widthSlider.value;strap.userData.slack=+slackSlider.value;
  strap.userData.controlPoint=closestSurfaceToScreenMid(anchors[0].position.clone().lerp(anchors[1].position,.5));
  scene.add(strap);updateStrap();strapPanel.classList.remove('hidden');hint.classList.add('minimized');
}
function updateStrap(){
  if(!strap||anchors.length<2)return;
  const a=anchors[0].position.clone(),b=anchors[1].position.clone();
  const c=strap.userData.controlPoint.clone();const cs=c.clone();cs.y-=(strap.userData.slack/100)*.27;
  const curve=new THREE.CatmullRomCurve3([a,cs,b],false,'centripetal',.5);
  while(strap.children.length){const q=strap.children.pop();q.geometry?.dispose?.();q.material?.dispose?.();}
  const r=.15*(strap.userData.widthMM/30)*.17;
  const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,96,r,12,false),new THREE.MeshStandardMaterial({color:0x171718,roughness:.57}));
  mesh.userData.kind='strapMesh';mesh.castShadow=true;strap.add(mesh);
  const h=new THREE.Mesh(new THREE.SphereGeometry(.082,28,18),new THREE.MeshStandardMaterial({color:0xffffff,transparent:true,opacity:.27,roughness:.25}));
  h.position.copy(c);h.userData.kind='strapHandle';strap.add(h);strap.userData.handle=h;
}
function interactiveHit(x,y){
  setPointerXY(x,y);const list=[];anchors.forEach(a=>list.push(...a.children));if(strap)list.push(...strap.children);
  const h=raycaster.intersectObjects(list,true)[0];if(!h)return null;
  const a=anchors.find(a=>a.children.includes(h.object));if(a)return{kind:'anchor',object:a};
  if(h.object.userData.kind==='strapHandle')return{kind:'strapHandle',object:h.object};
  return null;
}
function setHelpers(v){anchors.forEach(a=>a.visible=v);if(strap?.userData.handle)strap.userData.handle.visible=v}
function resetHarnessOnly(){
  if(strap){scene.remove(strap);strap=null}clearAnchors();strapPanel.classList.add('hidden');hint.classList.remove('minimized');
}
function resetAll(){
  resetHarnessOnly();widthSlider.value=30;widthValue.textContent='30';slackSlider.value=8;
}
resetBtn.addEventListener('click',resetAll);deleteStrapBtn.addEventListener('click',resetAll);
widthSlider.addEventListener('input',()=>{widthValue.textContent=widthSlider.value;if(strap){strap.userData.widthMM=+widthSlider.value;updateStrap()}});
slackSlider.addEventListener('input',()=>{if(strap){strap.userData.slack=+slackSlider.value;updateStrap()}});

// -------- custom iPhone gesture model --------
const pointers=new Map();
let single=null;
let twoStart=null;
const TAP=9;

function pointerInfo(e){return{x:e.clientX,y:e.clientY,px:e.clientX,py:e.clientY}}

canvas.addEventListener('pointerdown',e=>{
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId,pointerInfo(e));

  if(pointers.size===1){
    const ih=mode==='build'?interactiveHit(e.clientX,e.clientY):null;
    single={
      id:e.pointerId,
      sx:e.clientX, sy:e.clientY,
      lx:e.clientX, ly:e.clientY,
      target:ih,                // anchor / strapHandle / null
      moved:false
    };
  }else if(pointers.size===2){
    single=null;
    const [a,b]=[...pointers.values()];
    twoStart={
      dist:Math.hypot(b.x-a.x,b.y-a.y),
      cx:(a.x+b.x)/2,
      cy:(a.y+b.y)/2,
      az:camAz,
      el:camEl,
      d:camDist,
      ty:target.y
    };
  }
});

canvas.addEventListener('pointermove',e=>{
  const p=pointers.get(e.pointerId);
  if(!p)return;

  p.px=p.x; p.py=p.y;
  p.x=e.clientX; p.y=e.clientY;

  // Two-finger gesture: zoom + rotate + vertical pan.
  if(pointers.size===2){
    const [a,b]=[...pointers.values()];
    const dist=Math.max(20,Math.hypot(b.x-a.x,b.y-a.y));
    const cx=(a.x+b.x)/2, cy=(a.y+b.y)/2;

    if(twoStart){
      camDist=THREE.MathUtils.clamp(twoStart.d*(twoStart.dist/dist),3.1,7.2);
      camAz=twoStart.az-(cx-twoStart.cx)*.006;
      target.y=THREE.MathUtils.clamp(twoStart.ty+(cy-twoStart.cy)*.004,-.75,.85);
      updateCamera();
    }
    return;
  }

  if(pointers.size!==1 || !single || single.id!==e.pointerId)return;

  const totalDist=Math.hypot(e.clientX-single.sx,e.clientY-single.sy);
  if(totalDist>2)single.moved=true;

  // If touch started on an object, that object owns the gesture.
  if(single.target?.kind==='anchor'){
    const h=bodyHitXY(e.clientX,e.clientY);
    if(h){
      positionAnchor(single.target.object,h);
      if(strap)updateStrap();
    }
    single.lx=e.clientX; single.ly=e.clientY;
    return;
  }

  if(single.target?.kind==='strapHandle' && strap){
    const h=bodyHitXY(e.clientX,e.clientY);
    if(h){
      strap.userData.controlPoint=h.point.clone().addScaledVector(worldNormal(h),.06);
      updateStrap();
    }
    single.lx=e.clientX; single.ly=e.clientY;
    return;
  }

  // Otherwise one finger is always camera control.
  const ddx=e.clientX-single.lx;
  const ddy=e.clientY-single.ly;
  camAz-=ddx*.009;

  // Vertical direction inverted compared with V0.3a.
  camEl=THREE.MathUtils.clamp(camEl+ddy*.006,-.72,.72);

  updateCamera();

  single.lx=e.clientX;
  single.ly=e.clientY;
});

canvas.addEventListener('pointerup',e=>{
  pointers.delete(e.pointerId);
  if(pointers.size<2)twoStart=null;

  if(single && single.id===e.pointerId){
    const dist=Math.hypot(e.clientX-single.sx,e.clientY-single.sy);

    // Only an intentional, nearly stationary tap on empty mannequin surface
    // creates a new anchor. Camera gestures never create anchors.
    if(
      !single.target &&
      dist<=TAP &&
      mode==='build' &&
      anchors.length<2
    ){
      const h=bodyHitXY(e.clientX,e.clientY);
      if(h){
        makeAnchor(h);
        if(anchors.length===2)makeStrap();
      }
    }
  }

  single=null;
  try{canvas.releasePointerCapture(e.pointerId)}catch{}
});

canvas.addEventListener('pointercancel',e=>{
  pointers.delete(e.pointerId);
  single=null;
  twoStart=null;
});
// -------- modes --------
function switchMode(next){
  mode=next;modeButtons.forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));
  modeTitle.textContent=mode==='build'?'Build':mode==='accessories'?'Accessories':'Photo';
  strapPanel.classList.add('hidden');accessoryPanel.classList.add('hidden');photoPanel.classList.add('hidden');
  if(mode==='build'){setHelpers(true);if(strap)strapPanel.classList.remove('hidden')}
  if(mode==='accessories'){setHelpers(false);accessoryPanel.classList.remove('hidden')}
  if(mode==='photo'){setHelpers(false);photoPanel.classList.remove('hidden')}
}
modeButtons.forEach(b=>b.addEventListener('click',()=>switchMode(b.dataset.mode)));

// -------- true draggable bottom sheets --------
function hideAllUI(){
  chrome.classList.add('ui-hidden');restoreUI.classList.remove('hidden');
}
function installSheetPhysics(el){
  let startY=0,dy=0,tracking=false;
  el.addEventListener('pointerdown',e=>{
    if(e.target.matches('input,button'))return;
    tracking=true;startY=e.clientY;dy=0;el.classList.add('dragging');el.setPointerCapture?.(e.pointerId);
  });
  el.addEventListener('pointermove',e=>{
    if(!tracking)return;dy=Math.max(0,e.clientY-startY);
    el.style.transform=`translateY(${dy}px)`;el.style.opacity=String(Math.max(.35,1-dy/260));
  });
  const end=e=>{
    if(!tracking)return;tracking=false;el.classList.remove('dragging');
    el.style.transform='';el.style.opacity='';
    if(dy>58)hideAllUI();
    try{el.releasePointerCapture?.(e.pointerId)}catch{}
  };
  el.addEventListener('pointerup',end);el.addEventListener('pointercancel',end);
}
[strapPanel,accessoryPanel,photoPanel,$('modePill')].forEach(installSheetPhysics);
restoreUI.addEventListener('click',()=>{chrome.classList.remove('ui-hidden');restoreUI.classList.add('hidden')});

// resize/render
function resize(){const w=viewport.clientWidth,h=viewport.clientHeight;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false)}
addEventListener('resize',resize);resize();
function animate(){requestAnimationFrame(animate);renderer.render(scene,camera)}animate();
