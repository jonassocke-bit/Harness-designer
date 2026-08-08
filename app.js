
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const canvas = document.getElementById('scene');
const viewport = document.getElementById('viewport');
const hint = document.getElementById('hint');
const strapPanel = document.getElementById('strapPanel');
const widthSlider = document.getElementById('widthSlider');
const widthValue = document.getElementById('widthValue');
const slackSlider = document.getElementById('slackSlider');
const resetBtn = document.getElementById('resetBtn');
const deleteStrapBtn = document.getElementById('deleteStrapBtn');

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x0b0b0d, 5.2, 8.2);

const camera = new THREE.PerspectiveCamera(33, 1, 0.01, 50);
camera.position.set(0, 0.25, 5.1);

const renderer = new THREE.WebGLRenderer({canvas, antialias:true, alpha:true, powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 3.4;
controls.maxDistance = 6.7;
controls.target.set(0, 0.05, 0);
controls.rotateSpeed = 0.55;
controls.zoomSpeed = 0.75;

scene.add(new THREE.HemisphereLight(0xffffff, 0x3c3c45, 2.0));
const key = new THREE.DirectionalLight(0xffffff, 2.8);
key.position.set(2.5, 4, 3);
key.castShadow = true;
scene.add(key);

const rim = new THREE.DirectionalLight(0xa9b7ff, 1.1);
rim.position.set(-3, 1.5, -2);
scene.add(rim);

const floor = new THREE.Mesh(
  new THREE.CircleGeometry(2.2, 80),
  new THREE.MeshStandardMaterial({color:0x151519, roughness:1})
);
floor.rotation.x = -Math.PI/2;
floor.position.y = -1.73;
floor.receiveShadow = true;
scene.add(floor);

const mannequin = new THREE.Group();
scene.add(mannequin);

const bodyMat = new THREE.MeshStandardMaterial({
  color:0xdedfe2,
  roughness:.72,
  metalness:0.0
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

addBody(new THREE.Mesh(new THREE.SphereGeometry(.31,48,32))).position.set(0,1.48,0);

const neck = addBody(new THREE.Mesh(new THREE.CylinderGeometry(.13,.15,.25,32)));
neck.position.set(0,1.17,0);

const torso = addBody(new THREE.Mesh(new THREE.CapsuleGeometry(.49,1.08,16,42)));
torso.scale.set(1.0,1.0,.63);
torso.position.set(0,.45,0);

const hip = addBody(new THREE.Mesh(new THREE.SphereGeometry(.48,48,28)));
hip.scale.set(1.0,.68,.72);
hip.position.set(0,-.34,0);

function limb(radius, length, x, y, rotZ){
  const m = addBody(new THREE.Mesh(new THREE.CapsuleGeometry(radius,length,10,28)));
  m.position.set(x,y,0);
  m.rotation.z = rotZ;
  return m;
}
limb(.14,.78,-.63,.55,-.18);
limb(.14,.78,.63,.55,.18);
limb(.145,.68,-.79,-.15,-.05);
limb(.145,.68,.79,-.15,.05);
limb(.18,.78,-.23,-1.02,.03);
limb(.18,.78,.23,-1.02,-.03);

const anchorMat = new THREE.MeshStandardMaterial({color:0xfff8d9, emissive:0x4a3f12, emissiveIntensity:.8, roughness:.35, metalness:.15});
const anchors = [];
let strap = null;
let selectedControl = null;
let draggingStrap = false;
let dragPointerId = null;

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

function setPointer(evt){
  const r = canvas.getBoundingClientRect();
  pointer.x = ((evt.clientX-r.left)/r.width)*2-1;
  pointer.y = -((evt.clientY-r.top)/r.height)*2+1;
  raycaster.setFromCamera(pointer,camera);
}

function makeAnchor(pos, normal){
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.065,.018,16,48), anchorMat);
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(.045,24),
    new THREE.MeshBasicMaterial({color:0xffffff, transparent:true, opacity:.16, side:THREE.DoubleSide})
  );
  disc.position.z = -.002;
  g.add(ring,disc);
  g.position.copy(pos).addScaledVector(normal,.035);
  g.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),normal.clone().normalize());
  g.userData.kind = 'anchor';
  g.userData.normal = normal.clone();
  scene.add(g);
  anchors.push(g);
  return g;
}

function clearAnchors(){
  anchors.forEach(a=>scene.remove(a));
  anchors.length=0;
}

function bodyHit(){
  const hits = raycaster.intersectObjects(bodyMeshes,false);
  return hits[0] || null;
}

function createOrUpdateStrap(){
  if(anchors.length<2) return;
  const a = anchors[0].position.clone();
  const b = anchors[1].position.clone();

  if(!strap){
    strap = new THREE.Group();
    strap.userData.kind='strap';
    strap.userData.midOffset = new THREE.Vector3();
    strap.userData.widthMM = Number(widthSlider.value);
    strap.userData.slack = Number(slackSlider.value);
    scene.add(strap);
  }

  const midBase = a.clone().lerp(b,.5);
  const mid = midBase.clone().add(strap.userData.midOffset || new THREE.Vector3());

  const slack = (strap.userData.slack || 0)/100;
  mid.y -= slack * .55;

  const curve = new THREE.CatmullRomCurve3([a, mid, b], false, 'centripetal', .5);

  while(strap.children.length) strap.remove(strap.children[0]);

  const widthScene = 0.16 * ((strap.userData.widthMM || 30)/30);
  const tube = new THREE.Mesh(
    new THREE.TubeGeometry(curve,72,widthScene*.16,10,false),
    new THREE.MeshStandardMaterial({color:0x191919, roughness:.56, metalness:.0})
  );
  tube.castShadow = true;
  tube.userData.kind='strapMesh';
  strap.add(tube);

  const handle = new THREE.Mesh(
    new THREE.SphereGeometry(.085,24,16),
    new THREE.MeshStandardMaterial({color:0xffffff, transparent:true, opacity:.24, roughness:.25})
  );
  handle.position.copy(mid);
  handle.userData.kind='strapHandle';
  handle.renderOrder=2;
  strap.add(handle);

  strap.userData.curve = curve;
  strap.userData.handle = handle;
  strapPanel.classList.remove('hidden');
  hint.classList.add('minimized');
}

function selectBodyPoint(hit){
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld);
  const worldNormal = hit.face.normal.clone().applyMatrix3(normalMatrix).normalize();
  makeAnchor(hit.point, worldNormal);
  if(anchors.length===2) createOrUpdateStrap();
}

function hitInteractive(){
  if(strap){
    const hits = raycaster.intersectObjects(strap.children,true);
    if(hits.length) return hits[0];
  }
  const ah = raycaster.intersectObjects(anchors,true);
  return ah[0] || null;
}

function dragPlanePoint(evt){
  setPointer(evt);
  const plane = new THREE.Plane(new THREE.Vector3(0,0,1).applyQuaternion(camera.quaternion), 0);
  const base = strap.userData.handle.getWorldPosition(new THREE.Vector3());
  plane.setFromNormalAndCoplanarPoint(plane.normal, base);
  const out = new THREE.Vector3();
  raycaster.ray.intersectPlane(plane,out);
  return out;
}

canvas.addEventListener('pointerdown', (evt)=>{
  setPointer(evt);
  const interactive = hitInteractive();
  if(interactive && interactive.object.userData.kind==='strapHandle'){
    draggingStrap=true;
    dragPointerId=evt.pointerId;
    canvas.setPointerCapture(evt.pointerId);
    controls.enabled=false;
    selectedControl = dragPlanePoint(evt);
    return;
  }

  if(anchors.length < 2){
    const hit = bodyHit();
    if(hit){
      controls.enabled=false;
      selectBodyPoint(hit);
      setTimeout(()=>controls.enabled=true,120);
    }
  }
});

canvas.addEventListener('pointermove',(evt)=>{
  if(!draggingStrap || evt.pointerId!==dragPointerId || !strap) return;
  const p = dragPlanePoint(evt);
  const midBase = anchors[0].position.clone().lerp(anchors[1].position,.5);
  const off = p.clone().sub(midBase);
  off.clampLength(0,.85);
  strap.userData.midOffset.copy(off);
  createOrUpdateStrap();
});

function endDrag(evt){
  if(evt.pointerId!==dragPointerId) return;
  draggingStrap=false;
  dragPointerId=null;
  controls.enabled=true;
  try{canvas.releasePointerCapture(evt.pointerId)}catch{}
}
canvas.addEventListener('pointerup',endDrag);
canvas.addEventListener('pointercancel',endDrag);

widthSlider.addEventListener('input',()=>{
  widthValue.textContent=widthSlider.value;
  if(strap){strap.userData.widthMM=Number(widthSlider.value);createOrUpdateStrap();}
});
slackSlider.addEventListener('input',()=>{
  if(strap){strap.userData.slack=Number(slackSlider.value);createOrUpdateStrap();}
});

function resetAll(){
  if(strap){scene.remove(strap);strap=null}
  clearAnchors();
  strapPanel.classList.add('hidden');
  hint.classList.remove('minimized');
  widthSlider.value=30;
  widthValue.textContent='30';
  slackSlider.value=8;
}
resetBtn.addEventListener('click',resetAll);
deleteStrapBtn.addEventListener('click',resetAll);

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
