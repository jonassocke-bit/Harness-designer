
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const $=id=>document.getElementById(id);
const canvas=$('scene'),viewport=$('viewport'),chrome=$('chrome'),restoreUI=$('restoreUI'),hint=$('hint');
const buildTools=$('buildTools'),selectionPanel=$('selectionPanel'),ringControls=$('ringControls'),strapControls=$('strapControls'),strapAnchorControls=$('strapAnchorControls');
const selectionLabel=$('selectionLabel'),selectionTitle=$('selectionTitle'),deleteSelectedBtn=$('deleteSelectedBtn');
const widthSlider=$('widthSlider'),widthValue=$('widthValue'),slackSlider=$('slackSlider');
const ringDiameterSlider=$('ringDiameterSlider'),ringDiameterValue=$('ringDiameterValue');
const ringThicknessSlider=$('ringThicknessSlider'),ringThicknessValue=$('ringThicknessValue');
const addStrapAnchorBtn=$('addStrapAnchorBtn'),strapAnchorSlider=$('strapAnchorSlider'),strapAnchorValue=$('strapAnchorValue');
const mirrorToggle=$('mirrorToggle');
const accessoryPanel=$('accessoryPanel'),photoPanel=$('photoPanel');
const resetBtn=$('resetBtn'),modelBtn=$('modelBtn'),modelInput=$('modelInput'),toast=$('toast'),modeTitle=$('modeTitle');
const modeButtons=[...document.querySelectorAll('.mode')],toolButtons=[...document.querySelectorAll('.tool')];

let mode='build',buildTool='ring',mirrorMode=false;

const scene=new THREE.Scene();
scene.fog=new THREE.Fog(0x09090b,6.2,10);
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

function updateCamera(){
  const ce=Math.cos(camEl);
  camera.position.set(target.x+Math.sin(camAz)*ce*camDist,target.y+Math.sin(camEl)*camDist,target.z+Math.cos(camAz)*ce*camDist);
  camera.lookAt(target);
}
updateCamera();

let mannequin=new THREE.Group();scene.add(mannequin);
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

function showToast(msg){toast.textContent=msg;toast.classList.remove('hidden');clearTimeout(showToast.t);showToast.t=setTimeout(()=>toast.classList.add('hidden'),1800)}

modelBtn.addEventListener('click',()=>modelInput.click());
modelInput.addEventListener('change',async()=>{
  const file=modelInput.files?.[0];if(!file)return;const url=URL.createObjectURL(file);
  try{
    const gltf=await new GLTFLoader().loadAsync(url),obj=gltf.scene;
    const box=new THREE.Box3().setFromObject(obj),size=box.getSize(new THREE.Vector3());
    const scale=3.25/size.y;obj.scale.setScalar(scale);obj.updateMatrixWorld(true);
    const b2=new THREE.Box3().setFromObject(obj),c=b2.getCenter(new THREE.Vector3());
    obj.position.x-=c.x;obj.position.z-=c.z;obj.position.y+=(-1.75-b2.min.y);obj.updateMatrixWorld(true);
    scene.remove(mannequin);mannequin=new THREE.Group();mannequin.add(obj);scene.add(mannequin);
    bodyMeshes=[];obj.traverse(n=>{if(n.isMesh)registerMesh(n,false)});
    resetHarness();showToast('3D-Modell geladen');
  }catch(e){console.error(e);showToast('Modell konnte nicht geladen werden')}
  finally{URL.revokeObjectURL(url);modelInput.value=''}
});

const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
function setPointerXY(x,y){const r=canvas.getBoundingClientRect();pointer.x=((x-r.left)/r.width)*2-1;pointer.y=-((y-r.top)/r.height)*2+1;raycaster.setFromCamera(pointer,camera)}
function bodyHitXY(x,y){setPointerXY(x,y);return raycaster.intersectObjects(bodyMeshes,true)[0]||null}
function worldNormal(hit){const nm=new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld);return hit.face.normal.clone().applyMatrix3(nm).normalize()}

function ringMajorRadius(anchor){
  return Math.max(.02,(anchor.userData.diameterMM*MM_TO_SCENE)/2);
}
function ringTubeRadius(anchor){
  return Math.max(.004,(anchor.userData.thicknessMM*MM_TO_SCENE)/2);
}
function rebuildRingGeometry(anchor){
  const ring=anchor.children.find(ch=>ch.userData?.kind==='anchorRing');
  if(!ring)return;
  ring.geometry?.dispose?.();
  ring.geometry=new THREE.TorusGeometry(ringMajorRadius(anchor),ringTubeRadius(anchor),16,64);
  const disc=anchor.children.find(ch=>ch.userData?.kind==='anchorHit');
  if(disc){
    disc.geometry?.dispose?.();
    disc.geometry=new THREE.CircleGeometry(ringMajorRadius(anchor)*.88,32);
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
  const hits=raycaster.intersectObjects(bodyMeshes,true);
  if(hits.length)return hits.reduce((best,h)=>h.point.distanceTo(mirrored)<best.point.distanceTo(mirrored)?h:best,hits[0]);
  return null;
}

const anchorMat=new THREE.MeshStandardMaterial({color:0xfff2bb,emissive:0x44380c,emissiveIntensity:.8,roughness:.34,metalness:.18});
const anchorSelectedMat=anchorMat.clone();anchorSelectedMat.color.set(0xffffff);anchorSelectedMat.emissive.set(0x555555);
anchorSelectedMat.emissiveIntensity=1.15;
const DEFAULT_RING_DIAMETER_MM=40;
const DEFAULT_RING_THICKNESS_MM=6;
const MM_TO_SCENE=.0037;
const anchors=[],connections=[],strapAnchors=[];
let selected=null,connectStart=null;

function connectionCurve(c){
  const points=surfaceSampledPath(c);
  return new THREE.CatmullRomCurve3(points,false,'centripetal',.5);
}
function strapAnchorWorld(sa){
  const curve=connectionCurve(sa.connection);
  return curve.getPoint(THREE.MathUtils.clamp(sa.t,0,1));
}
function updateStrapAnchor(sa){
  const p=strapAnchorWorld(sa);
  sa.group.position.copy(p);
  const eps=.005;
  const curve=connectionCurve(sa.connection);
  const t0=Math.max(0,sa.t-eps),t1=Math.min(1,sa.t+eps);
  const tangent=curve.getPoint(t1).sub(curve.getPoint(t0)).normalize();
  const viewNormal=camera.getWorldDirection(new THREE.Vector3()).negate();
  let side=new THREE.Vector3().crossVectors(viewNormal,tangent);
  if(side.lengthSq()<1e-6)side.set(1,0,0);
  side.normalize();
  const normal=new THREE.Vector3().crossVectors(tangent,side).normalize();
  sa.group.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),normal);
}
function makeStrapAnchor(connection,t=.5,mirrorPartner=null){
  const g=new THREE.Group();
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.038,.010,14,48),anchorMat);
  ring.userData.kind='strapAnchorRing';
  g.add(ring);
  const hitDisc=new THREE.Mesh(new THREE.CircleGeometry(.034,28),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.02,side:THREE.DoubleSide}));
  hitDisc.userData.kind='strapAnchorHit';g.add(hitDisc);
  const sa={kind:'strapAnchor',id:`RA${strapAnchors.length+1}`,connection,t,group:g,mirrorPartner};
  g.userData.owner=sa;
  scene.add(g);strapAnchors.push(sa);updateStrapAnchor(sa);
  return sa;
}
function removeStrapAnchor(sa){
  scene.remove(sa.group);
  const i=strapAnchors.indexOf(sa);if(i>=0)strapAnchors.splice(i,1);
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
    new THREE.CircleGeometry(ringMajorRadius(g)*.88,32),
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
  const n=worldNormal(hit);g.position.copy(hit.point).addScaledVector(n,.040);
  g.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),n);g.userData.normal.copy(n);
  connections.filter(c=>c.a===g||c.b===g).forEach(updateConnection);
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
  const worldDir=otherAnchor.position.clone().sub(anchor.position).normalize();
  const localDir=ringPlaneDirection(anchor,worldDir);
  const localPoint=localDir.multiplyScalar(ringMajorRadius(anchor)+ringTubeRadius(anchor)*.45);
  return anchor.localToWorld(localPoint.clone());
}

function wrapArcGeometry(anchor,otherAnchor,widthMM,color=0x171718){
  // Short leather-coloured arc on the metal ring to visually represent
  // the strap wrapping around the ring.
  const worldDir=otherAnchor.position.clone().sub(anchor.position).normalize();
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
  const c={kind:'connection',id:`S${connections.length+1}`,a,b,widthMM:30,slack:8,controlPoint:null,group:new THREE.Group(),mirrorPartner};
  scene.add(c.group);connections.push(c);updateConnection(c);

  if(mirrorMode && !mirrorPartner && a.userData?.mirrorPartner && b.userData?.mirrorPartner){
    const mc=makeConnection(a.userData.mirrorPartner,b.userData.mirrorPartner,c);
    c.mirrorPartner=mc;
  }

  selectObject(c);showToast(`${a.userData.id} → ${b.userData.id}`);
  return c;
}
function surfaceMidpoint(c){
  const p1=ringEdgePoint(c.a,c.b),p2=ringEdgePoint(c.b,c.a),mid=p1.clone().lerp(p2,.5);
  const ndc=mid.clone().project(camera);raycaster.setFromCamera(new THREE.Vector2(ndc.x,ndc.y),camera);
  const h=raycaster.intersectObjects(bodyMeshes,true)[0];
  return h?h.point.clone().addScaledVector(worldNormal(h),.055):mid;
}

function projectPointToBodyFromCamera(point, offset=.045){
  const ndc=point.clone().project(camera);
  raycaster.setFromCamera(new THREE.Vector2(ndc.x,ndc.y),camera);
  const hits=raycaster.intersectObjects(bodyMeshes,true);
  if(!hits.length) return point.clone();
  const h=hits[0];
  return h.point.clone().addScaledVector(worldNormal(h),offset);
}

function surfaceSampledPath(c){
  const p1=ringEdgePoint(c.a,c.b);
  const p2=ringEdgePoint(c.b,c.a);

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
      const snapped=projectPointToBodyFromCamera(p,.047);

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
    const h=raycaster.intersectObjects(bodyMeshes,true)[0];

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
    new THREE.SphereGeometry(.077,24,16),
    new THREE.MeshStandardMaterial({color:0xffffff,transparent:true,opacity:.25})
  );
  h.position.copy(c.controlPoint);
  h.userData={kind:'strapHandle',owner:c};
  c.group.add(h);
  c.handle=h;
  rebuildRingWraps(c.a);
  rebuildRingWraps(c.b);
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
  rebuildRingWraps(a);
  rebuildRingWraps(b);
}
function removeAnchor(a){
  connections.filter(c=>c.a===a||c.b===a).slice().forEach(removeConnection);
  if(a.userData.mirrorPartner)a.userData.mirrorPartner.userData.mirrorPartner=null;
  scene.remove(a);const i=anchors.indexOf(a);if(i>=0)anchors.splice(i,1);
}
function resetHarness(){strapAnchors.slice().forEach(removeStrapAnchor);connections.slice().forEach(removeConnection);anchors.slice().forEach(a=>scene.remove(a));anchors.length=0;selected=null;connectStart=null;hideSelection();}
function setHelpers(v){anchors.forEach(a=>a.visible=v);strapAnchors.forEach(sa=>sa.group.visible=v);connections.forEach(c=>{if(c.handle)c.handle.visible=v});}
function showSelection(){
  selectionPanel.classList.remove('hidden');
  ringControls.classList.toggle('hidden',selected?.kind!=='anchor');
  strapControls.classList.toggle('hidden',selected?.kind!=='connection');
  strapAnchorControls.classList.toggle('hidden',selected?.kind!=='strapAnchor');

  if(selected?.kind==='anchor'){
    selectionLabel.textContent='RING';
    selectionTitle.textContent=selected.userData.id;
    ringDiameterSlider.value=selected.userData.diameterMM;
    ringDiameterValue.textContent=selected.userData.diameterMM;
    ringThicknessSlider.value=selected.userData.thicknessMM;
    ringThicknessValue.textContent=selected.userData.thicknessMM;
  }else if(selected?.kind==='connection'){
    selectionLabel.textContent='RIEMEN';
    selectionTitle.textContent=selected.id;
    widthSlider.value=selected.widthMM;
    widthValue.textContent=selected.widthMM;
    slackSlider.value=selected.slack;
  }else if(selected?.kind==='strapAnchor'){
    selectionLabel.textContent='RIEMEN-ANKER';
    selectionTitle.textContent=selected.id;
    strapAnchorSlider.value=Math.round(selected.t*100);
    strapAnchorValue.textContent=Math.round(selected.t*100);
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
  showSelection();
}
function interactiveHit(x,y){
  setPointerXY(x,y);
  const objs=[];
  anchors.forEach(a=>objs.push(...a.children.filter(ch=>ch.userData?.kind==='anchorRing'||ch.userData?.kind==='anchorHit')));
  strapAnchors.forEach(sa=>objs.push(...sa.group.children));
  connections.forEach(c=>objs.push(...c.group.children));
  const h=raycaster.intersectObjects(objs,true)[0];if(!h)return null;

  const a=anchors.find(a=>a.children.includes(h.object));if(a)return{kind:'anchor',owner:a};
  const sa=strapAnchors.find(sa=>sa.group.children.includes(h.object));if(sa)return{kind:'strapAnchor',owner:sa};
  if(h.object.userData.kind==='strapHandle')return{kind:'strapHandle',owner:h.object.userData.owner};
  if(h.object.userData.kind==='connectionMesh')return{kind:'connection',owner:h.object.userData.owner};
  return null;
}

function setBuildTool(t){
  buildTool=t;toolButtons.forEach(b=>b.classList.toggle('active',b.dataset.tool===t));
  connectStart=null;
  if(t==='connect')showToast('Ersten Ring antippen');
}
toolButtons.forEach(b=>b.addEventListener('click',()=>setBuildTool(b.dataset.tool)));

widthSlider.addEventListener('input',()=>{
  if(selected?.kind==='connection'){
    selected.widthMM=+widthSlider.value;widthValue.textContent=widthSlider.value;updateConnection(selected);
    if(selected.mirrorPartner){selected.mirrorPartner.widthMM=selected.widthMM;updateConnection(selected.mirrorPartner)}
  }
});
slackSlider.addEventListener('input',()=>{
  if(selected?.kind==='connection'){
    selected.slack=+slackSlider.value;updateConnection(selected);
    if(selected.mirrorPartner){selected.mirrorPartner.slack=selected.slack;updateConnection(selected.mirrorPartner)}
  }
});
ringDiameterSlider.addEventListener('input',()=>{
  if(selected?.kind==='anchor'){
    selected.userData.diameterMM=+ringDiameterSlider.value;ringDiameterValue.textContent=ringDiameterSlider.value;rebuildRingGeometry(selected);
    connections.filter(c=>c.a===selected||c.b===selected).forEach(updateConnection);
    const mp=selected.userData.mirrorPartner;
    if(mp){mp.userData.diameterMM=selected.userData.diameterMM;rebuildRingGeometry(mp);connections.filter(c=>c.a===mp||c.b===mp).forEach(updateConnection)}
  }
});
ringThicknessSlider.addEventListener('input',()=>{
  if(selected?.kind==='anchor'){
    selected.userData.thicknessMM=+ringThicknessSlider.value;ringThicknessValue.textContent=ringThicknessSlider.value;rebuildRingGeometry(selected);
    connections.filter(c=>c.a===selected||c.b===selected).forEach(updateConnection);
    const mp=selected.userData.mirrorPartner;
    if(mp){mp.userData.thicknessMM=selected.userData.thicknessMM;rebuildRingGeometry(mp);connections.filter(c=>c.a===mp||c.b===mp).forEach(updateConnection)}
  }
});
addStrapAnchorBtn.addEventListener('click',()=>{
  if(selected?.kind!=='connection')return;
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
  if(selected?.kind==='strapAnchor'){
    selected.t=+strapAnchorSlider.value/100;strapAnchorValue.textContent=strapAnchorSlider.value;updateStrapAnchor(selected);
    if(selected.mirrorPartner){selected.mirrorPartner.t=selected.t;updateStrapAnchor(selected.mirrorPartner)}
  }
});
mirrorToggle.addEventListener('click',()=>{
  mirrorMode=!mirrorMode;
  mirrorToggle.classList.toggle('active',mirrorMode);
  mirrorToggle.setAttribute('aria-pressed',mirrorMode?'true':'false');
  showToast(mirrorMode?'Spiegelmodus an':'Spiegelmodus aus');
});
deleteSelectedBtn.addEventListener('click',()=>{
  if(!selected)return;
  if(selected.kind==='anchor')removeAnchor(selected);
  else if(selected.kind==='connection')removeConnection(selected);
  else if(selected.kind==='strapAnchor')removeStrapAnchor(selected);
  selected=null;hideSelection();
});
resetBtn.addEventListener('click',resetHarness);

// gestures
const pointers=new Map();let single=null,twoStart=null;const TAP=9;
function pinfo(e){return{x:e.clientX,y:e.clientY,px:e.clientX,py:e.clientY}}
canvas.addEventListener('pointerdown',e=>{
  canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,pinfo(e));
  if(pointers.size===1){
    const hit=mode==='build'?interactiveHit(e.clientX,e.clientY):null;
    // Immediate subtle feedback when touching a selectable object.
    if(hit?.kind==='connection') selectObject(hit.owner);
    if(hit?.kind==='strapAnchor') selectObject(hit.owner);
    if(hit?.kind==='anchor' && buildTool!=='connect') selectObject(hit.owner);
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
  if(single.hit?.kind==='anchor'){
    const h=bodyHitXY(e.clientX,e.clientY);
    if(h){
      positionAnchor(single.hit.owner,h);
      const mp=single.hit.owner.userData.mirrorPartner;
      if(mp){
        const mh=findMirroredBodyHitFromPoint(single.hit.owner.position);
        if(mh)positionAnchor(mp,mh);
      }
    }
    single.lx=e.clientX;single.ly=e.clientY;return;
  }
  if(single.hit?.kind==='strapHandle'){
    const h=bodyHitXY(e.clientX,e.clientY);if(h){single.hit.owner.controlPoint=h.point.clone().addScaledVector(worldNormal(h),.06);updateConnection(single.hit.owner)}single.lx=e.clientX;single.ly=e.clientY;return;
  }
  const ddx=e.clientX-single.lx,ddy=e.clientY-single.ly;camAz-=ddx*.009;camEl=THREE.MathUtils.clamp(camEl+ddy*.006,-.72,.72);updateCamera();single.lx=e.clientX;single.ly=e.clientY;
});
canvas.addEventListener('pointerup',e=>{
  pointers.delete(e.pointerId);if(pointers.size<2)twoStart=null;
  if(single&&single.id===e.pointerId){
    const dist=Math.hypot(e.clientX-single.sx,e.clientY-single.sy);
    if(dist<=TAP&&mode==='build'){
      const ih=single.hit;
      if(ih?.kind==='anchor'){
        if(buildTool==='connect'){
          if(!connectStart){connectStart=ih.owner;selectObject(ih.owner);showToast('Zweiten Ring antippen')}
          else{makeConnection(connectStart,ih.owner);connectStart=null}
        }else selectObject(ih.owner);
      }else if(ih?.kind==='connection'){selectObject(ih.owner)}
      else if(ih?.kind==='strapAnchor'){selectObject(ih.owner)}
      else if(!ih&&buildTool==='ring'){
        const h=bodyHitXY(e.clientX,e.clientY);if(h)selectObject(makeAnchor(h));
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
  if(mode==='build'){setHelpers(true);if(selected)showSelection()}
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
[selectionPanel,accessoryPanel,photoPanel,$('modePill')].forEach(installSheetPhysics);
restoreUI.addEventListener('click',()=>{chrome.classList.remove('ui-hidden');restoreUI.classList.add('hidden')});

function resize(){const w=viewport.clientWidth,h=viewport.clientHeight;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false)}
addEventListener('resize',resize);resize();
function animate(){requestAnimationFrame(animate);renderer.render(scene,camera)}animate();
