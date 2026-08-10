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
const buildTools=$('buildTools'),connectToggle=$('connectToggle'),restoreUI=$('restoreUI'),modePill=$('modePill'),toast=$('toast');
const modelInput=$('modelInput'),uploadModelBtn=$('uploadModelBtn'),reloadModelBtn=$('reloadModelBtn');
const closeModelPanelBtn=$('closeModelPanelBtn'),rotationResetBtn=$('rotationResetBtn');

const nodeRingToggle=$('nodeRingToggle');
const pointSizeControl=$('pointSizeControl'),ringDiameterControl=$('ringDiameterControl'),ringThicknessControl=$('ringThicknessControl');
const pointSizeSlider=$('pointSizeSlider'),ringDiameterSlider=$('ringDiameterSlider'),ringThicknessSlider=$('ringThicknessSlider');
const anchorPositionControl=$('anchorPositionControl'),anchorPositionSlider=$('anchorPositionSlider');
const strapWidthSlider=$('strapWidthSlider'),strapSlackSlider=$('strapSlackSlider');
const curvePointCount=$('curvePointCount'),curveMinusBtn=$('curveMinusBtn'),curvePlusBtn=$('curvePlusBtn'),curveAutoBtn=$('curveAutoBtn');
const addAnchorBtn=$('addAnchorBtn');

const rotXSlider=$('rotXSlider'),rotYSlider=$('rotYSlider'),rotZSlider=$('rotZSlider'),surfaceOffsetSlider=$('surfaceOffsetSlider');
const globalAnchorSizeSlider=$('globalAnchorSizeSlider');

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
let globalAnchorSizeMM=Number(localStorage.getItem('hd:anchorSize'))||12;
let ringDefaults=(()=>{try{return {...{diameterMM:40,thicknessMM:6},...JSON.parse(localStorage.getItem('hd:ringDefaults')||'{}')}}catch{return {diameterMM:40,thicknessMM:6}}})();
let strapDefaults=(()=>{try{return {...{widthMM:30,slack:8},...JSON.parse(localStorage.getItem('hd:strapDefaults')||'{}')}}catch{return {widthMM:30,slack:8}}})();
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
    diameterMM:data.diameterMM??ringDefaults.diameterMM,thicknessMM:data.thicknessMM??ringDefaults.thicknessMM,sizeMM:data.sizeMM??globalAnchorSizeMM,
    locked:!!data.locked,mirrorId:data.mirrorId||null,
    source:data.source||'surface',parentStrapId:data.parentStrapId||null,t:data.t??.5,
    crossing:data.crossing||null,autoCrossing:!!data.autoCrossing,
    splitMeta:data.splitMeta||null,mergedState:data.mergedState||null,
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
  }else if(n.source==='crossing'&&n.crossing){
    const sa=straps.get(n.crossing.strapAId),sb=straps.get(n.crossing.strapBId);
    if(sa&&sb){
      const pa=strapPointAt(sa,n.crossing.tA),pb=strapPointAt(sb,n.crossing.tB);
      const p=pa.clone().lerp(pb,.5);setNodeWorldPosition(n,p);
      const normal=strapNormalAt(sa,n.crossing.tA).add(strapNormalAt(sb,n.crossing.tB));
      if(normal.lengthSq()<1e-8)normal.set(0,0,1);normal.normalize();n.normal=normal.toArray();
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

  // V1.3: slack is relative to strap length.
  // Same slider value gives a similar curvature ratio on short and long straps.
  const relativeBulge=THREE.MathUtils.clamp(f.length*.28,.018,.24);
  const baseClearance=THREE.MathUtils.clamp(f.length*.018,.006,.022);

  return f.A.clone()
    .lerp(f.B,.5)
    .addScaledVector(f.normal,baseClearance + slack*relativeBulge);
}
function manualControlWorld(s,c){
  const f=strapFrame(s);
  const slack=THREE.MathUtils.clamp(s.slack/100,0,1);

  // V1.4a: manual points refine the curve, but do not replace slack.
  // Their offsets scale with current strap length, while the main body-clearance
  // still comes from the current slack value.
  const relativeBulge=THREE.MathUtils.clamp(f.length*.28,.018,.24);
  const baseClearance=THREE.MathUtils.clamp(f.length*.018,.006,.022);
  const slackOffset=baseClearance + slack*relativeBulge;

  const sideScale=THREE.MathUtils.clamp(f.length,.12,1.2);
  const manualNormal=(c.normalFactor??0)*relativeBulge;
  const manualSide=(c.sideFactor??0)*sideScale;

  return f.A.clone().lerp(f.B,c.t)
    .addScaledVector(f.side,manualSide)
    .addScaledVector(f.normal,slackOffset + manualNormal);
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
    id,kind:'strap',a:data.a,b:data.b,widthMM:data.widthMM??strapDefaults.widthMM,slack:data.slack??strapDefaults.slack,
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
    else if(n.source==='crossing'&&n.crossing&&(n.crossing.strapAId===s.id||n.crossing.strapBId===s.id))syncNodeTransform(n);
  }
  updateControlHandles(s);
}
function updateAttachedStraps(nodeId){
  for(const s of straps.values())if(s.a===nodeId||s.b===nodeId)updateStrapGeometry(s);
}
function updateControlHandles(s){
  // V1.1: generated curve points are internal only.
  s.controlGroup.clear();
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


function strapSnapshot(s){
  return {id:s.id,a:s.a,b:s.b,widthMM:s.widthMM,slack:s.slack,locked:s.locked,mirrorId:s.mirrorId||null,controls:s.controls.map(c=>({...c}))};
}
function removeStrapBare(id){
  const s=straps.get(id);if(!s)return;
  s.geometry.dispose();strapRoot.remove(s.group);straps.delete(id);
}
function restoreStrapSnapshot(d){
  if(!d||!nodes.has(d.a)||!nodes.has(d.b)||d.a===d.b)return null;
  const s=makeStrap({id:d.id,a:d.a,b:d.b,widthMM:d.widthMM,slack:d.slack,locked:d.locked,mirrorId:d.mirrorId,controls:d.controls});
  return s;
}

function remapTForSplit(t,splitT,leftSide){
  if(leftSide)return splitT<=1e-6?0:THREE.MathUtils.clamp(t/splitT,0,1);
  return (1-splitT)<=1e-6?1:THREE.MathUtils.clamp((t-splitT)/(1-splitT),0,1);
}

function migrateDynamicNodesAfterSplit(originalId,splitNode,splitT,left,right){
  const EPS=.018;

  for(const dn of [...nodes.values()]){
    if(dn.id===splitNode.id)continue;

    // Ordinary dynamic anchors on the old through-strap.
    if(dn.source==='strap'&&dn.parentStrapId===originalId){
      // There must never be a second anchor at the exact split position.
      if(Math.abs(dn.t-splitT)<EPS){
        removeNode(dn.id,false);
        continue;
      }

      if(dn.t<splitT){
        dn.parentStrapId=left.id;
        dn.t=remapTForSplit(dn.t,splitT,true);
      }else{
        dn.parentStrapId=right.id;
        dn.t=remapTForSplit(dn.t,splitT,false);
      }
      syncNodeTransform(dn);
      continue;
    }

    // Auto crossings on a strap that is being replaced are intentionally
    // discarded. A post-structure refresh will recreate only valid crossings.
    if(dn.source==='crossing'&&dn.crossing&&
       (dn.crossing.strapAId===originalId||dn.crossing.strapBId===originalId)){
      if(dn.autoCrossing){
        removeNode(dn.id,false);
        continue;
      }

      // A non-auto crossing point is a user-owned node: remap the affected leg.
      if(dn.crossing.strapAId===originalId){
        const oldT=dn.crossing.tA;
        if(oldT<splitT){
          dn.crossing.strapAId=left.id;
          dn.crossing.tA=remapTForSplit(oldT,splitT,true);
        }else{
          dn.crossing.strapAId=right.id;
          dn.crossing.tA=remapTForSplit(oldT,splitT,false);
        }
      }
      if(dn.crossing.strapBId===originalId){
        const oldT=dn.crossing.tB;
        if(oldT<splitT){
          dn.crossing.strapBId=left.id;
          dn.crossing.tB=remapTForSplit(oldT,splitT,true);
        }else{
          dn.crossing.strapBId=right.id;
          dn.crossing.tB=remapTForSplit(oldT,splitT,false);
        }
      }
      if(dn.crossing){
        const sa=straps.get(dn.crossing.strapAId),sb=straps.get(dn.crossing.strapBId);
        if(sa&&sb)dn.crossing.key=crossingKey(sa,sb);
      }
      syncNodeTransform(dn);
    }
  }
}

function nodeMirrorEquivalent(idA,idB){
  if(idA===idB)return true;
  const a=nodes.get(idA),b=nodes.get(idB);
  if(!a||!b)return false;
  return a.mirrorId===b.id||b.mirrorId===a.id;
}

function strapsAreMirrorEquivalent(a,b){
  if(!a||!b)return false;
  return (
    nodeMirrorEquivalent(a.a,b.a)&&nodeMirrorEquivalent(a.b,b.b)
  )||(
    nodeMirrorEquivalent(a.a,b.b)&&nodeMirrorEquivalent(a.b,b.a)
  );
}

function pairSplitChildren(partA,partB){
  if(!partA||!partB)return;
  const A=(partA.children||[]).map(id=>straps.get(id)).filter(Boolean);
  const B=(partB.children||[]).map(id=>straps.get(id)).filter(Boolean);

  const used=new Set();
  for(const sa of A){
    const sb=B.find(x=>!used.has(x.id)&&strapsAreMirrorEquivalent(sa,x));
    if(!sb)continue;

    sa.mirrorId=sb.id;
    sb.mirrorId=sa.id;

    // A freshly split mirrored pair starts with exactly matching properties.
    // sideFactor is mirrored by copyStrapProps.
    copyStrapProps(sa,sb);
    used.add(sb.id);
  }
}

function repairSplitPairingForNodes(a,b){
  if(!a||!b)return;
  if(a.splitMeta?.kind==='single'&&b.splitMeta?.kind==='single'){
    pairSplitChildren(a.splitMeta.part,b.splitMeta.part);
  }
}
function splitOneStrapAtNode(s,n,t){
  if(!s||!n)return null;
  const original=strapSnapshot(s);
  const a=s.a,b=s.b;
  const originalId=s.id;

  removeStrapBare(originalId);

  // Both pieces inherit the exact same strap settings from the parent.
  const left=makeStrap({
    a,b:n.id,
    widthMM:original.widthMM,
    slack:original.slack,
    controls:[]
  });
  const right=makeStrap({
    a:n.id,b,
    widthMM:original.widthMM,
    slack:original.slack,
    controls:[]
  });

  // Move every surviving dynamic point away from the deleted parent strap.
  // Auto crossing points are removed and recalculated later.
  migrateDynamicNodesAfterSplit(originalId,n,t,left,right);

  updateStrapGeometry(left);
  updateStrapGeometry(right);
  rebuildWrapsForNode(n);
  rebuildWrapsForNode(nodes.get(a));
  rebuildWrapsForNode(nodes.get(b));

  return {original,children:[left.id,right.id],t};
}
function restoreSplitPart(part,n){
  if(!part)return;
  for(const id of part.children||[])if(straps.has(id))removeStrapBare(id);
  restoreStrapSnapshot(part.original);
}
function convertDynamicPointToRing(n){
  if(!n||n.ringVisible)return;

  // Ring geometry/state must exist BEFORE child straps are generated,
  // otherwise the first render still treats the node as a point.
  n.ringVisible=true;
  rebuildNodeVisual(n);
  syncNodeTransform(n);

  if(n.source==='strap'&&n.parentStrapId){
    const s=straps.get(n.parentStrapId);if(!s)return;
    const part=splitOneStrapAtNode(s,n,n.t);
    n.splitMeta={kind:'single',part};
    n.source='junction';n.parentStrapId=null;

  }else if(n.source==='crossing'&&n.crossing){
    const sa=straps.get(n.crossing.strapAId),sb=straps.get(n.crossing.strapBId);
    if(!sa||!sb)return;

    const crossingSnapshot={...n.crossing};
    const wereMirrorPair=sa.mirrorId===sb.id||sb.mirrorId===sa.id;

    const partA=splitOneStrapAtNode(sa,n,n.crossing.tA);
    const partB=splitOneStrapAtNode(sb,n,n.crossing.tB);

    if(wereMirrorPair)pairSplitChildren(partA,partB);

    n.splitMeta={kind:'crossing',partA,partB,crossing:crossingSnapshot};
    n.source='junction';n.crossing=null;n.autoCrossing=false;
  }

  updateAttachedStraps(n.id);
  rebuildAllWraps();
}
function convertRingBackToPoint(n){
  if(!n?.ringVisible||!n.splitMeta)return;
  const meta=n.splitMeta;
  if(meta.kind==='single'){
    restoreSplitPart(meta.part,n);
    n.source='strap';n.parentStrapId=meta.part.original.id;n.t=meta.part.t;
  }else if(meta.kind==='crossing'){
    restoreSplitPart(meta.partA,n);restoreSplitPart(meta.partB,n);
    n.source='crossing';n.crossing={...meta.crossing};n.autoCrossing=false;
  }
  n.splitMeta=null;n.ringVisible=false;
  rebuildNodeVisual(n);syncNodeTransform(n);rebuildAllWraps();
}
function removeStrap(id){
  const s=straps.get(id);if(!s)return;
  s.geometry.dispose();strapRoot.remove(s.group);straps.delete(id);
  for(const n of [...nodes.values()]){
    if(n.source==='strap'&&n.parentStrapId===id)removeNode(n.id,false);
    else if(n.source==='crossing'&&n.autoCrossing&&n.crossing&&(n.crossing.strapAId===id||n.crossing.strapBId===id))removeNode(n.id,false);
  }
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


function clearSelectionGlow(){
  helperRoot.children.filter(x=>x.userData?.selectionGlow).forEach(x=>helperRoot.remove(x));
}
function addGlowClone(obj,scale=1.08,opacity=.38){
  if(!obj)return;
  const mat=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity,side:THREE.BackSide,depthWrite:false});
  const g=obj.geometry?.clone?.();if(!g)return;
  const m=new THREE.Mesh(g,mat);m.userData.selectionGlow=true;
  obj.updateWorldMatrix(true,false);
  m.matrix.copy(obj.matrixWorld);m.matrix.decompose(m.position,m.quaternion,m.scale);m.scale.multiplyScalar(scale);
  helperRoot.add(m);
}
function refreshSelectionGlow(){
  clearSelectionGlow();
  if(!selected)return;
  if(selected.kind==='node'){
    addGlowClone(selected.visual,1.16,.5);
    const p=pairOfNode(selected);if(p)addGlowClone(p.visual,1.11,.22);
  }else if(selected.kind==='strap'){
    addGlowClone(selected.mesh,1.045,.45);
    const p=pairOfStrap(selected);if(p)addGlowClone(p.mesh,1.025,.18);
  }
}
function refreshConnectHints(){
  for(const n of nodes.values()){
    if(!n.visual)continue;
    if(tool==='connect'){
      n.visual.material.emissive?.set?.(connectStart===n.id?0x8a7a30:0x292715);
      if(n.visual.material.emissiveIntensity!==undefined)n.visual.material.emissiveIntensity=connectStart===n.id?.9:.18;
    }
  }
}
function selectObject(o){
  selected=o;
  refreshMaterials();refreshSelectionGlow();showSelection();updateAllControlHandles();refreshConnectHints();
}
function refreshMaterials(){
  clearSelectionGlow();
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
    const movableAnchor=selected.source==='strap'&&!selected.ringVisible;
    anchorPositionControl.classList.toggle('hidden',!movableAnchor);
    pointSizeSlider.value=selected.sizeMM;ringDiameterSlider.value=selected.diameterMM;ringThicknessSlider.value=selected.thicknessMM;
    if(movableAnchor){anchorPositionSlider.value=Math.round(selected.t*100);syncParamUI('anchorPosition',Math.round(selected.t*100))}
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
      locked:n.locked,mirrorId:n.mirrorId,source:n.source,parentStrapId:n.parentStrapId,t:n.t,crossing:n.crossing,autoCrossing:n.autoCrossing,splitMeta:n.splitMeta,mergedState:n.mergedState||null
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
  anchorPosition:{defaults:[25,50,75,90],min:0,max:100,step:1},
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

setupParam('pointSize',pointSizeSlider,$('pointSizeTools'),v=>{if(selected?.kind==='node'){selected.sizeMM=v;rebuildNodeVisual(selected);syncNodeTransform(selected);syncPairedNodeProps(selected)}});
setupParam('ringDiameter',ringDiameterSlider,$('ringDiameterTools'),v=>{if(selected?.kind==='node'){ringDefaults.diameterMM=v;localStorage.setItem('hd:ringDefaults',JSON.stringify(ringDefaults));selected.diameterMM=v;rebuildNodeVisual(selected);syncNodeTransform(selected);updateAttachedStraps(selected.id);rebuildWrapsForNode(selected);syncPairedNodeProps(selected)}});
setupParam('ringThickness',ringThicknessSlider,$('ringThicknessTools'),v=>{if(selected?.kind==='node'){ringDefaults.thicknessMM=v;localStorage.setItem('hd:ringDefaults',JSON.stringify(ringDefaults));selected.thicknessMM=v;rebuildNodeVisual(selected);syncNodeTransform(selected);updateAttachedStraps(selected.id);rebuildWrapsForNode(selected);syncPairedNodeProps(selected)}});
setupParam('strapWidth',strapWidthSlider,$('strapWidthTools'),v=>{if(selected?.kind==='strap'){strapDefaults.widthMM=v;localStorage.setItem('hd:strapDefaults',JSON.stringify(strapDefaults));selected.widthMM=v;updateStrapGeometry(selected);syncPairedStrapProps(selected)}});
setupParam('strapSlack',strapSlackSlider,$('strapSlackTools'),v=>{if(selected?.kind==='strap'){strapDefaults.slack=v;localStorage.setItem('hd:strapDefaults',JSON.stringify(strapDefaults));selected.slack=v;updateStrapGeometry(selected);syncPairedStrapProps(selected)}});
setupParam('anchorPosition',anchorPositionSlider,$('anchorPositionTools'),v=>{
  if(selected?.kind==='node'&&selected.source==='strap'&&!selected.ringVisible){
    selected.t=THREE.MathUtils.clamp(v/100,0,1);syncNodeTransform(selected);
  }
});
strapWidthSlider.addEventListener('change',refreshAutomaticCrossings);
strapSlackSlider.addEventListener('change',refreshAutomaticCrossings);

setupParam('rotX',rotXSlider,$('rotXTools'),v=>{modelRoot.rotation.x=THREE.MathUtils.degToRad(v)});
setupParam('rotY',rotYSlider,$('rotYTools'),v=>{modelRoot.rotation.y=THREE.MathUtils.degToRad(v)});
setupParam('rotZ',rotZSlider,$('rotZTools'),v=>{modelRoot.rotation.z=THREE.MathUtils.degToRad(v)});
setupParam('surfaceOffset',surfaceOffsetSlider,$('surfaceOffsetTools'),v=>{surfaceOffsetMM=v;for(const n of nodes.values())syncNodeTransform(n);for(const s of straps.values())updateStrapGeometry(s)});
globalAnchorSizeSlider.value=globalAnchorSizeMM;
setupParam('globalAnchorSize',globalAnchorSizeSlider,$('globalAnchorSizeTools'),v=>{
  globalAnchorSizeMM=v;localStorage.setItem('hd:anchorSize',String(v));
  for(const n of nodes.values())if(!n.ringVisible){n.sizeMM=v;rebuildNodeVisual(n);syncNodeTransform(n)}
  refreshMaterials();refreshSelectionGlow();
});

function setTool(t){
  if(t==='connect'){
    if(tool==='connect'){tool='ring';connectStart=null}
    else{tool='connect';connectStart=null}
  }else{
    tool='ring';connectStart=null;
  }
  connectToggle.classList.toggle('active',tool==='connect');
  connectToggle.setAttribute('aria-pressed',String(tool==='connect'));
  refreshMaterials();refreshSelectionGlow();refreshConnectHints();
}
buildTools.addEventListener('click',e=>{
  const b=e.target.closest('.tool');if(b?.dataset.tool==='connect')setTool('connect');
});

nodeRingToggle.addEventListener('click',()=>{
  if(selected?.kind!=='node')return;
  const n=selected;
  const partner=pairOfNode(n);

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
  updateAttachedStraps(n.id);rebuildAllWraps();showSelection();commitHistory();refreshAutomaticCrossings();
});
lockSelectedBtn.addEventListener('click',()=>{if(!selected)return;selected.locked=!selected.locked;showSelection();commitHistory()});
deleteSelectedBtn.addEventListener('click',()=>{
  if(!selected)return;const was=selected;
  if(was.kind==='node')removeNode(was.id);else removeStrap(was.id);
  selected=null;hideSelection();rebuildAllWraps();refreshAutomaticCrossings();commitHistory();
});
undoBtn.addEventListener('click',undo);redoBtn.addEventListener('click',redo);

curveAutoBtn.addEventListener('click',()=>{if(selected?.kind!=='strap')return;selected.controls=[];updateStrapGeometry(selected);syncPairedStrapProps(selected);showSelection();refreshAutomaticCrossings();commitHistory()});
curvePlusBtn.addEventListener('click',()=>{
  if(selected?.kind!=='strap')return;
  const s=selected;
  if(!s.controls.length){
    const f=strapFrame(s),auto=autoControlWorld(s),base=f.A.clone().lerp(f.B,.5),d=auto.clone().sub(base);
    s.controls=[
      {t:.33,sideFactor:0,normalFactor:0},
      {t:.67,sideFactor:0,normalFactor:0}
    ];
  }else{
    const sorted=s.controls.slice().sort((a,b)=>a.t-b.t);
    let bestT=.5,bestGap=-1,prev=0;
    for(const c of [...sorted,{t:1}]){const gap=c.t-prev;if(gap>bestGap){bestGap=gap;bestT=(prev+c.t)/2}prev=c.t}
    s.controls.push({t:bestT,sideFactor:0,normalFactor:0});s.controls.sort((a,b)=>a.t-b.t);
  }
  updateStrapGeometry(s);syncPairedStrapProps(s);showSelection();refreshAutomaticCrossings();commitHistory();
});
curveMinusBtn.addEventListener('click',()=>{
  if(selected?.kind!=='strap')return;
  if(selected.controls.length<=2)selected.controls=[];
  else selected.controls.splice(Math.floor(selected.controls.length/2),1);
  updateStrapGeometry(selected);syncPairedStrapProps(selected);showSelection();refreshAutomaticCrossings();commitHistory();
});

addAnchorBtn.addEventListener('click',()=>{
  if(selected?.kind!=='strap')return;
  const s=selected,t=.5,p=strapPointAt(s,t),normal=strapNormalAt(s,t);
  const n=makeNode({position:p.toArray(),normal:normal.toArray(),ringVisible:false,source:'strap',parentStrapId:s.id,t,sizeMM:globalAnchorSizeMM});
  const ps=pairOfStrap(s);
  if(ps){
    const pp=strapPointAt(ps,t),pn=strapNormalAt(ps,t);
    const m=makeNode({position:pp.toArray(),normal:pn.toArray(),ringVisible:false,source:'strap',parentStrapId:ps.id,t,sizeMM:globalAnchorSizeMM,mirrorId:n.id});
    n.mirrorId=m.id;
  }
  selectObject(n);commitHistory();
});



const CROSSING_THRESHOLD=.035;
let crossingRefreshBusy=false;

function closestSegmentPoints(p1,q1,p2,q2){
  const d1=q1.clone().sub(p1),d2=q2.clone().sub(p2),r=p1.clone().sub(p2);
  const a=d1.dot(d1),e=d2.dot(d2),f=d2.dot(r);
  let s=0,t=0;
  if(a<=1e-9&&e<=1e-9)return {s:0,t:0,pA:p1.clone(),pB:p2.clone(),dist:p1.distanceTo(p2)};
  if(a<=1e-9){s=0;t=THREE.MathUtils.clamp(f/e,0,1)}
  else{
    const c=d1.dot(r);
    if(e<=1e-9){t=0;s=THREE.MathUtils.clamp(-c/a,0,1)}
    else{
      const b=d1.dot(d2),den=a*e-b*b;
      s=den!==0?THREE.MathUtils.clamp((b*f-c*e)/den,0,1):0;
      t=(b*s+f)/e;
      if(t<0){t=0;s=THREE.MathUtils.clamp(-c/a,0,1)}
      else if(t>1){t=1;s=THREE.MathUtils.clamp((b-c)/a,0,1)}
    }
  }
  const pA=p1.clone().addScaledVector(d1,s),pB=p2.clone().addScaledVector(d2,t);
  return {s,t,pA,pB,dist:pA.distanceTo(pB)};
}
function bestCrossingBetween(sa,sb){
  if(sa.a===sb.a||sa.a===sb.b||sa.b===sb.a||sa.b===sb.b)return null;
  const ca=strapCurve(sa),cb=strapCurve(sb),N=14;
  let best=null;
  let a0=ca.getPoint(0);
  for(let i=0;i<N;i++){
    const a1=ca.getPoint((i+1)/N);let b0=cb.getPoint(0);
    for(let j=0;j<N;j++){
      const b1=cb.getPoint((j+1)/N);
      const hit=closestSegmentPoints(a0,a1,b0,b1);
      const tA=(i+hit.s)/N,tB=(j+hit.t)/N;
      if(tA>.06&&tA<.94&&tB>.06&&tB<.94&&hit.dist<CROSSING_THRESHOLD&&(!best||hit.dist<best.dist)){
        best={...hit,tA,tB};
      }
      b0=b1;
    }
    a0=a1;
  }
  return best;
}

function crossingKey(sa,sb){
  return [sa.id,sb.id].sort().join('::');
}
function clearAutomaticCrossings(validKeys=null){
  for(const n of [...nodes.values()]){
    if(n.source!=='crossing'||!n.autoCrossing||n.ringVisible)continue;
    const key=n.crossing?.key||null;
    if(!validKeys||!key||!validKeys.has(key))removeNode(n.id,false);
  }
}

function crossingBlockedByExistingAnchor(p,ignoreKey=null){
  for(const n of nodes.values()){
    if(n.source==='crossing'&&n.autoCrossing&&!n.ringVisible){
      if(ignoreKey&&n.crossing?.key===ignoreKey)continue;
    }

    // Explicit point/ring/junction owns this location.
    if(n.autoCrossing&&!n.ringVisible)continue;

    const np=nodeWorldPosition(n);
    let radius=.052;
    if(n.ringVisible)radius=Math.max(radius,ringMajor(n)+.052);

    if(np.distanceTo(p)<radius)return true;
  }
  return false;
}


function cleanupOrphanDynamicNodes(){
  for(const n of [...nodes.values()]){
    if(n.source==='strap'&&n.parentStrapId&&!straps.has(n.parentStrapId)){
      removeNode(n.id,false);
      continue;
    }
    if(n.source==='crossing'&&n.crossing){
      if(!straps.has(n.crossing.strapAId)||!straps.has(n.crossing.strapBId)){
        removeNode(n.id,false);
      }
    }
  }
}

function refreshAutomaticCrossings(){
  if(crossingRefreshBusy)return;
  crossingRefreshBusy=true;
  try{
    cleanupOrphanDynamicNodes();
    const arr=[...straps.values()];
    const validKeys=new Set();

    for(let i=0;i<arr.length;i++)for(let j=i+1;j<arr.length;j++){
      const sa=arr[i],sb=arr[j];
      const hit=bestCrossingBetween(sa,sb);
      if(!hit)continue;

      const key=crossingKey(sa,sb);
      validKeys.add(key);

      const p=hit.pA.clone().lerp(hit.pB,.5);
      const normal=strapNormalAt(sa,hit.tA).add(strapNormalAt(sb,hit.tB));
      if(normal.lengthSq()<1e-8)normal.set(0,0,1);
      normal.normalize();

      let n=[...nodes.values()].find(n=>
        n.source==='crossing'&&n.autoCrossing&&!n.ringVisible&&n.crossing?.key===key
      );

      // Never create another automatic anchor beside an existing user-owned
      // anchor, converted ring, or junction. One physical intersection = one node.
      if(!n&&crossingBlockedByExistingAnchor(p,key))continue;

      if(n){
        n.crossing={
          key,
          strapAId:sa.id,tA:hit.tA,
          strapBId:sb.id,tB:hit.tB
        };
        setNodeWorldPosition(n,p);
        n.normal=normal.toArray();
        syncNodeTransform(n);
      }else{
        n=makeNode({
          position:p.toArray(),normal:normal.toArray(),ringVisible:false,sizeMM:globalAnchorSizeMM,
          source:'crossing',autoCrossing:true,
          crossing:{key,strapAId:sa.id,tA:hit.tA,strapBId:sb.id,tB:hit.tB}
        });
      }
    }

    clearAutomaticCrossings(validKeys);
  }finally{
    crossingRefreshBusy=false;
  }
}

const AXIS_SNAP_IN=.095;
const AXIS_SNAP_OUT=.108;

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
  dst.controls=src.controls.map(c=>({
    ...c,
    sideFactor:-(c.sideFactor??0)
  }));
  updateStrapGeometry(dst);
}

function serializeNodeForMerge(n){
  return {
    id:n.id,position:[...n.position],normal:[...n.normal],ringVisible:n.ringVisible,
    diameterMM:n.diameterMM,thicknessMM:n.thicknessMM,sizeMM:n.sizeMM,
    locked:n.locked,source:n.source,parentStrapId:n.parentStrapId,t:n.t,crossing:n.crossing,autoCrossing:n.autoCrossing
  };
}
function captureMergeTopology(a,b){
  return [...straps.values()]
    .filter(s=>s.a===a.id||s.b===a.id||s.a===b.id||s.b===b.id)
    .map(s=>({id:s.id,a:s.a,b:s.b,widthMM:s.widthMM,slack:s.slack,locked:s.locked,mirrorId:s.mirrorId||null,controls:s.controls.map(c=>({...c}))}));
}

function mergeRingPair(a,b){
  if(!a||!b||a.id===b.id)return a;
  const pa=nodeWorldPosition(a),pb=nodeWorldPosition(b);
  const p=pa.clone().lerp(pb,.5);p.x=0;
  const n=nodeWorldNormal(a).add(nodeWorldNormal(b));if(n.lengthSq()<1e-8)n.set(0,0,1);n.x=0;n.normalize();
  const state={left:serializeNodeForMerge(a),right:serializeNodeForMerge(b),topology:captureMergeTopology(a,b)};
  const merged=makeNode({position:p.toArray(),normal:n.toArray(),ringVisible:true,diameterMM:a.diameterMM,thicknessMM:a.thicknessMM,sizeMM:a.sizeMM});
  merged.mergedState=state;

  for(const s of straps.values()){
    if(s.a===a.id||s.a===b.id)s.a=merged.id;
    if(s.b===a.id||s.b===b.id)s.b=merged.id;
    updateStrapGeometry(s);
  }
  for(const s of [...straps.values()])if(s.a===merged.id&&s.b===merged.id)removeStrap(s.id);

  nodeRoot.remove(a.group);nodes.delete(a.id);
  nodeRoot.remove(b.group);nodes.delete(b.id);
  selected=merged;rebuildWrapsForNode(merged);return merged;
}

function restoreTopologyAfterEntmerge(merged,left,right,state){
  for(const s of [...straps.values()])if(s.a===merged.id||s.b===merged.id)removeStrap(s.id);
  for(const d of state.topology||[]){
    const a=d.a===state.left.id?left.id:d.a===state.right.id?right.id:d.a;
    const b=d.b===state.left.id?left.id:d.b===state.right.id?right.id:d.b;
    if(!nodes.has(a)||!nodes.has(b)||a===b)continue;
    const s=makeStrap({id:d.id,a,b,widthMM:d.widthMM,slack:d.slack,locked:d.locked,controls:d.controls});
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
  nodeRoot.remove(merged.group);nodes.delete(merged.id);
  selected=p.x<0?left:right;rebuildAllWraps();return selected;
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
  n.mirrorId=m.id;m.mirrorId=n.id;copyNodeVisualProps(n,m);return m;
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

function screenSpaceNodeHit(x,y){
  const rect=canvas.getBoundingClientRect();
  const px=x-rect.left,py=y-rect.top;
  let best=null,bestD=Infinity;
  for(const n of nodes.values()){
    const wp=n.group.position.clone();
    const q=wp.project(camera);
    if(q.z<-1||q.z>1)continue;
    const sx=(q.x*.5+.5)*rect.width;
    const sy=(-q.y*.5+.5)*rect.height;
    const d=Math.hypot(px-sx,py-sy);
    // Deliberately forgiving touch target. Visual ring itself can be thin.
    const radius=n.ringVisible?46:30;
    if(d<radius&&d<bestD){best={kind:'node',id:n.id};bestD=d}
  }
  return best;
}
function interactiveHit(x,y){
  // V1.2: selection is always attempted before body placement.
  // Screen-space node hit makes thin rings reliable on touch screens.
  const softNode=screenSpaceNodeHit(x,y);if(softNode)return softNode;
  setPointer(x,y);
  const nodeHits=[];for(const n of nodes.values())if(n.hit)nodeHits.push(n.hit);
  const nh=raycaster.intersectObjects(nodeHits,false)[0];if(nh)return {kind:'node',id:nh.object.userData.id};
  const meshes=[...straps.values()].map(s=>s.mesh);
  const sh=raycaster.intersectObjects(meshes,false)[0];if(sh)return {kind:'strap',id:sh.object.userData.id};
  return null;
}
function snapAxis(p){if(Math.abs(p.x)<AXIS_SNAP_IN)p.x=0;return p}

let pointers=new Map(),gesture=null,single=null,dragRaf=0,pendingDrag=null;
function requestNodeDrag(n,x,y){
  pendingDrag={n,x,y};
  if(dragRaf)return;
  dragRaf=requestAnimationFrame(()=>{
    dragRaf=0;const q=pendingDrag;pendingDrag=null;if(!q)return;

    // Merged center ring: move on a camera-facing plane so it can leave the axis
    // without requiring a new pointer gesture.
    if(q.n.mergedState){
      const planeP=screenPlanePoint(q.x,q.y,nodeWorldPosition(q.n));
      if(!planeP)return;
      const current=nodeWorldPosition(q.n);
      current.x=planeP.x;
      setNodeWorldPosition(q.n,current);syncNodeTransform(q.n);

      const active=maybeAxisMergeOrEntmerge(q.n);
      if(active!==q.n){
        if(single)single.activeNodeId=active.id;
        selected=active;
        showSelection();updateAttachedStraps(active.id);rebuildAllWraps();
      }
      return;
    }

    const hit=bodyHit(q.x,q.y);if(!hit)return;
    const p=snapAxis(hit.point.clone()),normal=worldNormal(hit);
    setNodeWorldPosition(q.n,p);q.n.normal=normal.toArray();syncNodeTransform(q.n);
    updateAttachedStraps(q.n.id);

    const partner=pairOfNode(q.n);
    if(partner){
      const mp=p.clone();mp.x*=-1;
      const mn=normal.clone();mn.x*=-1;
      setNodeWorldPosition(partner,mp);partner.normal=mn.toArray();syncNodeTransform(partner);
      updateAttachedStraps(partner.id);

      const active=maybeAxisMergeOrEntmerge(q.n);
      if(active!==q.n){
        if(single)single.activeNodeId=active.id;
        selected=active;
        showSelection();rebuildAllWraps();
      }
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
  single={sx:e.clientX,sy:e.clientY,lx:e.clientX,ly:e.clientY,moved:false,hit,activeNodeId:hit?.kind==='node'?hit.id:null};
  if(hit?.kind==='node'){
    const n=nodes.get(hit.id);selectObject(n);
  }else if(hit?.kind==='strap'){
    selectObject(straps.get(hit.id));
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
    const activeId=single.activeNodeId||single.hit.id;
    const n=nodes.get(activeId);
    if(n&&!n.locked&&n.source!=='strap')requestNodeDrag(n,e.clientX,e.clientY);
    single.lx=e.clientX;single.ly=e.clientY;return;
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
  if(was.moved){rebuildAllWraps();refreshAutomaticCrossings();commitHistory();return}
  const hit=was.hit||interactiveHit(e.clientX,e.clientY);
  if(hit?.kind==='node'){
    const n=nodes.get(hit.id);selectObject(n);
    if(tool==='connect'){
      if(!connectStart){connectStart=n.id;refreshMaterials();refreshSelectionGlow();refreshConnectHints();showToast(`${n.id} gewählt`)}
      else if(connectStart!==n.id){
        const a=nodes.get(connectStart);let s=makeStrap({a:a.id,b:n.id});
        if(mirrorMode){
          const ma=mirrorNode(a),mb=mirrorNode(n);
          if(ma.id!==a.id||mb.id!==n.id){const ms=makeStrap({a:ma.id,b:mb.id,widthMM:s.widthMM,slack:s.slack});s.mirrorId=ms.id;ms.mirrorId=s.id}
        }
        connectStart=null;tool='ring';connectToggle.classList.remove('active');connectToggle.setAttribute('aria-pressed','false');selectObject(s);rebuildAllWraps();refreshAutomaticCrossings();commitHistory();
      }
    }
    return;
  }
  if(hit?.kind==='strap'){selectObject(straps.get(hit.id));return}
  if(tool!=='connect'&&mode==='build'){
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
