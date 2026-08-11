import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const $=id=>document.getElementById(id);
const canvas=$('scene'),viewport=$('viewport');
const selectionPanel=$('selectionPanel'),modelPanel=$('modelPanel');
const nodeControls=$('nodeControls'),strapControls=$('strapControls');
const selectionLabel=$('selectionLabel'),selectionTitle=$('selectionTitle');
const linkSelectedBtn=$('linkSelectedBtn'),lockSelectedBtn=$('lockSelectedBtn'),deleteSelectedBtn=$('deleteSelectedBtn');
const undoBtn=$('undoBtn'),redoBtn=$('redoBtn');
const mirrorToggle=$('mirrorToggle'),mirrorSelectedBtn=$('mirrorSelectedBtn'),rotateModelBtn=$('rotateModelBtn');
const buildTools=$('buildTools'),connectToggle=$('connectToggle'),restoreUI=$('restoreUI'),modePill=$('modePill'),toast=$('toast');
const modelInput=$('modelInput'),uploadModelBtn=$('uploadModelBtn'),reloadModelBtn=$('reloadModelBtn');
const closeModelPanelBtn=$('closeModelPanelBtn'),rotationResetBtn=$('rotationResetBtn');
const bodyFemaleBtn=$('bodyFemaleBtn'),bodyMaleBtn=$('bodyMaleBtn');
const bodyShapeSlider=$('bodyShapeSlider'),bodyMuscleSlider=$('bodyMuscleSlider'),bodyHeightSlider=$('bodyHeightSlider'),bodyArmsSlider=$('bodyArmsSlider'),bodyLegsSlider=$('bodyLegsSlider');
const bodyShapeValue=$('bodyShapeValue'),bodyMuscleValue=$('bodyMuscleValue'),bodyHeightValue=$('bodyHeightValue'),bodyArmsValue=$('bodyArmsValue'),bodyLegsValue=$('bodyLegsValue');
const bodySystemPanel=document.querySelector('.body-system');


const nodeRingToggle=$('nodeRingToggle');
const pointSizeControl=$('pointSizeControl'),ringDiameterControl=$('ringDiameterControl'),ringThicknessControl=$('ringThicknessControl');
const pointSizeSlider=$('pointSizeSlider'),ringDiameterSlider=$('ringDiameterSlider'),ringThicknessSlider=$('ringThicknessSlider');
const anchorPositionControl=$('anchorPositionControl'),anchorPositionSlider=$('anchorPositionSlider');
const strapWidthSlider=$('strapWidthSlider'),strapSlackSlider=$('strapSlackSlider');
const curvePointCount=$('curvePointCount'),curveMinusBtn=$('curveMinusBtn'),curvePlusBtn=$('curvePlusBtn'),curveAutoBtn=$('curveAutoBtn');
const addAnchorBtn=$('addAnchorBtn');

const rotXSlider=$('rotXSlider'),rotYSlider=$('rotYSlider'),rotZSlider=$('rotZSlider'),surfaceOffsetSlider=$('surfaceOffsetSlider');
const globalAnchorSizeSlider=$('globalAnchorSizeSlider');
const selectionColorPicker=$('selectionColorPicker');

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
const waypointGuideRoot=new THREE.Group();scene.add(waypointGuideRoot);

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
let integratedBodyRoot=null,integratedBodyMesh=null,integratedBodyDict=null;
let integratedBodyBaseScale=1,integratedBodyLoading=false,usingIntegratedBody=true;
let bodySystem={
  gender:localStorage.getItem('hd:bodyGender')||'female',
  shape:Number(localStorage.getItem('hd:bodyShape')||0),
  muscle:Number(localStorage.getItem('hd:bodyMuscle')||0),
  height:Number(localStorage.getItem('hd:bodyHeight')||175),
  arms:Number(localStorage.getItem('hd:bodyArms')||0),
  legs:Number(localStorage.getItem('hd:bodyLegs')||0)
};
let camAz=0,camEl=.02,camDist=5.25;
const target=new THREE.Vector3(0,.08,0);
let tool='ring',mode='build',mirrorMode=false,surfaceOffsetMM=2;
let globalAnchorSizeMM=Number(localStorage.getItem('hd:anchorSize'))||12;
let selectionColorHex=localStorage.getItem('hd:selectionColor')||'#00d8ff';
let ringDefaults=(()=>{try{return {...{diameterMM:40,thicknessMM:6},...JSON.parse(localStorage.getItem('hd:ringDefaults')||'{}')}}catch{return {diameterMM:40,thicknessMM:6}}})();
let strapDefaults=(()=>{try{return {...{widthMM:30,slack:8},...JSON.parse(localStorage.getItem('hd:strapDefaults')||'{}')}}catch{return {widthMM:30,slack:8}}})();
let selected=null,connectStart=null;
let waypointPlacementStrapId=null;
let waypointGuideSamples=null;
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

const integratedLoader=new GLTFLoader();

function integratedBodyUrl(g){
  return g==='male'?'./male_custom_morph.glb':'./female_custom_morph.glb';
}
function setBodyUIEnabled(enabled){
  bodySystemPanel.classList.toggle('disabled',!enabled);
}
function updateBodyUI(){
  const sh=bodySystem.shape,ar=bodySystem.arms;
  bodyFemaleBtn.classList.toggle('active',bodySystem.gender==='female');
  bodyMaleBtn.classList.toggle('active',bodySystem.gender==='male');
  bodyShapeSlider.value=bodySystem.shape;
  bodyMuscleSlider.value=bodySystem.muscle;
  bodyHeightSlider.value=bodySystem.height;
  bodyArmsSlider.value=bodySystem.arms;
  bodyLegsSlider.value=bodySystem.legs;
  bodyShapeValue.textContent=Math.abs(sh)<.03?'Neutral':sh<0?`Schlank ${Math.round(-sh*100)}%`:`Curvy ${Math.round(sh*100)}%`;
  bodyMuscleValue.textContent=`${Math.round(bodySystem.muscle*100)}%`;
  bodyHeightValue.textContent=`${Math.round(bodySystem.height)} cm`;
  bodyArmsValue.textContent=Math.abs(ar)<.03?'A-Pose':ar<0?`Gerade ${Math.round(-ar*100)}%`:`Unten ${Math.round(ar*100)}%`;
  bodyLegsValue.textContent=bodySystem.legs<.03?'Offen':`Zusammen ${Math.round(bodySystem.legs*100)}%`;
}
function saveBodyUI(){
  localStorage.setItem('hd:bodyGender',bodySystem.gender);
  localStorage.setItem('hd:bodyShape',String(bodySystem.shape));
  localStorage.setItem('hd:bodyMuscle',String(bodySystem.muscle));
  localStorage.setItem('hd:bodyHeight',String(bodySystem.height));
  localStorage.setItem('hd:bodyArms',String(bodySystem.arms));
  localStorage.setItem('hd:bodyLegs',String(bodySystem.legs));
}
function applyIntegratedBodyMorphs(){
  if(!integratedBodyRoot||!integratedBodyMesh||!integratedBodyDict)return;
  const d=integratedBodyDict,inf=integratedBodyMesh.morphTargetInfluences;
  if(inf){
    for(const k of Object.keys(d))inf[d[k]]=0;
    if(d.Skinny!==undefined)inf[d.Skinny]=Math.max(0,-bodySystem.shape);
    if(d.Overweight!==undefined)inf[d.Overweight]=Math.max(0,bodySystem.shape);
    if(d.Muscular!==undefined)inf[d.Muscular]=bodySystem.muscle;
    if(d.ArmsStraight!==undefined)inf[d.ArmsStraight]=Math.max(0,-bodySystem.arms);
    if(d.ArmsDown!==undefined)inf[d.ArmsDown]=Math.max(0,bodySystem.arms);
    if(d.LegsTogether!==undefined)inf[d.LegsTogether]=bodySystem.legs;
  }
  const heightFactor=bodySystem.height/180;
  integratedBodyRoot.scale.setScalar(integratedBodyBaseScale*heightFactor);
  integratedBodyRoot.updateMatrixWorld(true);
}
function fitIntegratedBodyToHarnessScene(obj){
  // neutral 180 cm model -> existing mannequin working height 3.3 scene units
  obj.scale.setScalar(1);
  obj.position.set(0,0,0);
  obj.updateMatrixWorld(true);
  let box=new THREE.Box3().setFromObject(obj);
  const size=box.getSize(new THREE.Vector3());
  integratedBodyBaseScale=3.3/Math.max(size.y,.001);
  obj.scale.setScalar(integratedBodyBaseScale*(bodySystem.height/180));
  obj.updateMatrixWorld(true);
  box=new THREE.Box3().setFromObject(obj);
  const c=box.getCenter(new THREE.Vector3());
  obj.position.x-=c.x;
  obj.position.z-=c.z;
  obj.position.y+=(-1.75-box.min.y);
  obj.updateMatrixWorld(true);
}
function collectIntegratedBodyMeshes(obj){
  bodyMeshes=[];
  obj.traverse(x=>{
    if(x.isMesh){
      x.material=BODY_MAT.clone();
      x.receiveShadow=false;x.castShadow=false;
      bodyMeshes.push(x);
    }
  });
}
function reprojectHarnessToBody(){
  if(!usingIntegratedBody||!bodyMeshes.length||!nodes.size)return;

  // The source GLBs are already geometrically symmetric. Here we additionally
  // guarantee that all mirrored design objects use one shared surface solution,
  // so tiny triangle/raycast differences can never break visual symmetry.
  const handled=new Set();
  for(const n of nodes.values()){
    if(handled.has(n.id))continue;
    if(n.source==='strap'||n.source==='crossing')continue;

    const partner=pairOfNode(n);
    if(partner&&partner.source!=='strap'&&partner.source!=='crossing'){
      // Use the left object as canonical master where possible.
      const master=nodeWorldPosition(n).x<=0?n:partner;
      const mate=master===n?partner:n;
      const current=nodeWorldPosition(master);
      const hit=nearestBodySurface(current);
      if(hit)applyMirroredNodeSurface(master,mate,hit.point,hit.normal);
      handled.add(master.id);handled.add(mate.id);
      continue;
    }

    const current=nodeWorldPosition(n);
    const hit=nearestBodySurface(current);
    if(!hit)continue;
    let p=hit.point.clone(),normal=hit.normal.clone();
    if(Math.abs(p.x)<AXIS_SNAP_IN){
      p.x=0;
      normal=symmetryAxisNormal(normal);
    }
    setNodeWorldPosition(n,p);
    n.normal=normal.toArray();
    syncNodeTransform(n);
    handled.add(n.id);
  }

  // Body shape changed: surface waypoints get one fresh projection too.
  reprojectAllWaypoints();
  for(const s of straps.values())updateStrapGeometry(s);
  rebuildAllWraps();
  refreshAutomaticCrossings();
  dynReconcileSymmetry({syncProps:true});
  refreshMaterials();
}
function realignIntegratedBodyFeet(){
  if(!integratedBodyRoot)return;
  integratedBodyRoot.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(integratedBodyRoot);
  integratedBodyRoot.position.y+=(-1.75-box.min.y);
  integratedBodyRoot.updateMatrixWorld(true);
}
async function loadIntegratedBody(gender=bodySystem.gender,{reproject=false,clearExistingHarness=false}={}){
  if(integratedBodyLoading)return;
  integratedBodyLoading=true;
  try{
    const gltf=await integratedLoader.loadAsync(integratedBodyUrl(gender));
    const obj=gltf.scene;
    const mesh=obj.getObjectByProperty('isMesh',true);
    if(!mesh)throw new Error('Kein Body-Mesh im GLB');

    modelRoot.clear();
    bodyMeshes=[];
    importedModel=null;
    integratedBodyRoot=obj;
    integratedBodyMesh=mesh;
    integratedBodyDict=mesh.morphTargetDictionary||{};
    usingIntegratedBody=true;
    bodySystem.gender=gender;

    modelRoot.add(obj);
    fitIntegratedBodyToHarnessScene(obj);
    collectIntegratedBodyMeshes(obj);
    applyIntegratedBodyMorphs();
    realignIntegratedBodyFeet();
    setBodyUIEnabled(true);
    updateBodyUI();
    saveBodyUI();

    if(clearExistingHarness)clearHarness();
    else if(reproject)reprojectHarnessToBody();

    showToast(gender==='male'?'Male Body geladen':'Female Body geladen');
  }catch(err){
    console.error('Body-System load failed',err);
    // Hard fallback means the app still starts and remains usable.
    integratedBodyRoot=null;integratedBodyMesh=null;integratedBodyDict=null;
    usingIntegratedBody=false;
    buildFallback();
    setBodyUIEnabled(false);
    showToast('Body-Modell nicht geladen – Fallback aktiv');
  }finally{
    integratedBodyLoading=false;
  }
}

function commitBodyChange(){
  if(!usingIntegratedBody)return;
  applyIntegratedBodyMorphs();
  realignIntegratedBodyFeet();
  reprojectHarnessToBody();
  saveBodyUI();
  commitHistory();
}

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
function nearestBodySurface(worldPoint){
  // Approximate closest surface by casting through the point from several axes.
  // This works for points inside the torso/shoulder as well as slightly outside it.
  const dirs=[
    new THREE.Vector3(1,0,0),new THREE.Vector3(0,1,0),new THREE.Vector3(0,0,1),
    new THREE.Vector3(1,1,0).normalize(),new THREE.Vector3(1,0,1).normalize(),
    new THREE.Vector3(0,1,1).normalize()
  ];
  let best=null,bestDist=Infinity;

  for(const d0 of dirs){
    for(const sign of [-1,1]){
      const d=d0.clone().multiplyScalar(sign);
      const origin=worldPoint.clone().addScaledVector(d,3.5);
      raycaster.set(origin,d.clone().negate());
      const hits=raycaster.intersectObjects(bodyMeshes,true);
      for(const h of hits){
        const dd=h.point.distanceTo(worldPoint);
        if(dd<bestDist){
          bestDist=dd;
          best={point:h.point.clone(),normal:worldNormal(h)};
        }
      }
    }
  }
  return best;
}

function makeSurfaceGuideForStrap(s,t){
  const f=strapFrame(s);
  const candidate=f.A.clone().lerp(f.B,t);
  const hit=nearestBodySurface(candidate);

  if(hit){
    return {
      t,
      surfacePos:hit.point.toArray(),
      surfaceNormal:hit.normal.toArray()
    };
  }

  // Fallback remains deterministic even if an imported mesh cannot be projected.
  const p=strapCurve(s).getPoint(t);
  return {
    t,
    surfacePos:p.toArray(),
    surfaceNormal:strapNormalAt(s,t).toArray()
  };
}


function nearestBodySurfacePreferred(worldPoint,preferredNormal){
  const pref=preferredNormal?.clone?.().normalize?.()||new THREE.Vector3(0,0,1);

  // Build directions around the expected surface normal. The normal-directed
  // casts strongly discourage jumping from torso to an unrelated nearby limb.
  let tangentA=new THREE.Vector3().crossVectors(pref,Math.abs(pref.y)<.9?WORLD_UP:new THREE.Vector3(1,0,0));
  if(tangentA.lengthSq()<1e-8)tangentA.set(1,0,0);
  tangentA.normalize();
  const tangentB=new THREE.Vector3().crossVectors(pref,tangentA).normalize();

  const dirs=[
    pref.clone(),
    pref.clone().multiplyScalar(-1),
    pref.clone().addScaledVector(tangentA,.35).normalize(),
    pref.clone().addScaledVector(tangentA,-.35).normalize(),
    pref.clone().addScaledVector(tangentB,.35).normalize(),
    pref.clone().addScaledVector(tangentB,-.35).normalize()
  ];

  let best=null,bestScore=Infinity;
  for(const d of dirs){
    const origin=worldPoint.clone().addScaledVector(d,2.4);
    raycaster.set(origin,d.clone().negate());
    const hits=raycaster.intersectObjects(bodyMeshes,true);

    for(const h of hits.slice(0,5)){
      const normal=worldNormal(h);
      const dist=h.point.distanceTo(worldPoint);
      const alignment=normal.dot(pref);

      // Strong penalty for a surface facing the wrong way.
      const score=dist + Math.max(0,.35-alignment)*.35;
      if(score<bestScore){
        bestScore=score;
        best={point:h.point.clone(),normal};
      }
    }
  }
  return best;
}

function surfaceClearanceForStrap(s){
  const f=strapFrame(s);
  const slack=THREE.MathUtils.clamp(s.slack/100,0,1);

  // Same length-relative philosophy as the good standard straps,
  // but surface mode stays much closer to the body.
  const base=surfaceOffsetScene()+.007;
  const relative=THREE.MathUtils.clamp(f.length*.12,.008,.10);
  return base+slack*relative;
}

function projectSurfaceMidpoint(a,b,normalA,normalB){
  const candidate=a.clone().lerp(b,.5);
  let preferred=normalA.clone().add(normalB);
  if(preferred.lengthSq()<1e-8)preferred=normalA.clone();
  preferred.normalize();

  const hit=nearestBodySurfacePreferred(candidate,preferred);
  if(hit)return hit;

  // Deterministic fallback: keep segment midpoint + interpolated normal.
  return {point:candidate,normal:preferred};
}

function buildSurfaceGuideChain(s,level){
  const aNode=nodes.get(s.a),bNode=nodes.get(s.b);
  if(!aNode||!bNode)return null;

  const A=nodeWorldPosition(aNode);
  const B=nodeWorldPosition(bNode);
  const nA=nodeWorldNormal(aNode);
  const nB=nodeWorldNormal(bNode);

  // Recursively split every existing section. Level 1 -> 1 internal point,
  // level 2 -> 3, level 3 -> 7, etc.
  function subdivide(a,b,na,nb,depth){
    if(depth<=0)return [
      {point:a.clone(),normal:na.clone().normalize()},
      {point:b.clone(),normal:nb.clone().normalize()}
    ];

    const mid=projectSurfaceMidpoint(a,b,na,nb);
    const left=subdivide(a,mid.point,na,mid.normal,depth-1);
    const right=subdivide(mid.point,b,mid.normal,nb,depth-1);
    return left.slice(0,-1).concat(right);
  }

  const guides=subdivide(A,B,nA,nB,level);
  const clearance=surfaceClearanceForStrap(s);

  // Endpoints stay at their actual nodes. Only internal guides sit on/lift off
  // the body surface; visibleEndpoint later handles the ring radius.
  for(let i=1;i<guides.length-1;i++){
    guides[i].point.addScaledVector(guides[i].normal,clearance);
  }
  return guides;
}

function surfaceCurveData(s){
  const level=THREE.MathUtils.clamp(Math.round(s.surfaceLevel||0),1,4);
  const guides=buildSurfaceGuideChain(s,level);
  if(!guides||guides.length<3)return null;

  const aNode=nodes.get(s.a),bNode=nodes.get(s.b);
  const firstGuide=guides[1].point;
  const lastGuide=guides[guides.length-2].point;
  const a=visibleEndpoint(aNode,firstGuide);
  const b=visibleEndpoint(bNode,lastGuide);

  const points=guides.map((g,i)=>{
    if(i===0)return a.clone();
    if(i===guides.length-1)return b.clone();
    return g.point.clone();
  });

  const curve=new THREE.CatmullRomCurve3(points,false,'centripetal',.35);
  return {curve,guides,points};
}

function surfaceNormalAtData(data,t){
  const guides=data.guides;
  if(!guides?.length)return new THREE.Vector3(0,0,1);

  const x=THREE.MathUtils.clamp(t,0,1)*(guides.length-1);
  const i=Math.min(guides.length-2,Math.floor(x));
  const f=x-i;

  let n=guides[i].normal.clone().lerp(guides[i+1].normal,f);
  if(n.lengthSq()<1e-8)n=guides[i].normal.clone();
  return n.normalize();
}

function worldNormal(hit){
  if(!hit?.face)return new THREE.Vector3(0,0,1);
  const nm=new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld);
  return hit.face.normal.clone().applyMatrix3(nm).normalize();
}

function mirrorWorldPointX(p){
  return new THREE.Vector3(-p.x,p.y,p.z);
}
function mirrorWorldNormalX(n){
  return new THREE.Vector3(-n.x,n.y,n.z).normalize();
}
function applyMirroredNodeSurface(master,partner,point,normal){
  setNodeWorldPosition(master,point);
  master.normal=normal.toArray();
  syncNodeTransform(master);

  if(partner){
    const mp=mirrorWorldPointX(point);
    const mn=mirrorWorldNormalX(normal);
    setNodeWorldPosition(partner,mp);
    partner.normal=mn.toArray();
    syncNodeTransform(partner);
  }
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
    dynEditStamp:data.dynEditStamp||0,
    previousPartnerId:data.previousPartnerId||null,
    manualUnlinked:!!data.manualUnlinked,
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

function symmetryAxisNormal(normal){
  // A node snapped to x=0 must have an orientation that is itself mirror-symmetric.
  // Remove only the lateral X component. Y/Z still define front/back tilt along
  // the mannequin, so rings can follow chest/abdomen curvature without twisting
  // left/right due to tiny mesh asymmetries.
  const n=normal.clone();
  n.x=0;
  if(n.lengthSq()<1e-8)n.set(0,0,1);
  return n.normalize();
}
function nodeNormalForDisplay(n){
  const normal=nodeWorldNormal(n);
  const p=nodeWorldPosition(n);
  return Math.abs(p.x)<AXIS_SNAP_IN ? symmetryAxisNormal(normal) : normal;
}


// V1.6a paired objects use one canonical LEFT-side master.
// The right-side partner remains a real record for compatibility/undo/unlink,
// but its spatial state and rendered strap mesh are derived from the master.
function pairMasterNode(n){
  const p=pairOfNode(n);if(!p)return n;
  const nx=nodeWorldPosition(n).x,px=nodeWorldPosition(p).x;
  if(Math.abs(nx-px)<1e-7)return n.id<p.id?n:p;
  return nx<px?n:p;
}
function pairMasterStrap(s){
  const p=pairOfStrap(s);if(!p)return s;
  const avg=q=>{
    const a=nodes.get(q.a),b=nodes.get(q.b);
    return a&&b?(nodeWorldPosition(a).x+nodeWorldPosition(b).x)*.5:0;
  };
  const sx=avg(s),px=avg(p);
  if(Math.abs(sx-px)<1e-7)return s.id<p.id?s:p;
  return sx<px?s:p;
}
function forceMirrorNodeFromMaster(master,slave,{visualProps=false}={}){
  if(!master||!slave||master===slave)return;
  const p=mirrorWorldPointX(nodeWorldPosition(master));
  const n=mirrorWorldNormalX(nodeWorldNormal(master));
  setNodeWorldPosition(slave,p);
  slave.normal=n.toArray();
  if(visualProps){
    slave.ringVisible=master.ringVisible;
    slave.diameterMM=master.diameterMM;
    slave.thicknessMM=master.thicknessMM;
    slave.sizeMM=master.sizeMM;
    rebuildNodeVisual(slave);
  }
  syncNodeTransform(slave);
}
function mirrorStrapMeshFromMaster(master,slave){
  if(!master||!slave||master===slave)return;
  slave.widthMM=master.widthMM;
  slave.slack=master.slack;
  slave.surfaceLevel=master.surfaceLevel||0;

  // Keep materialized waypoint state ready for a future unlink, but do not
  // independently project it while the pair is linked.
  slave.controls=master.controls.map(c=>{
    const d={...c};
    if(c.surfacePos)d.surfacePos=[-c.surfacePos[0],c.surfacePos[1],c.surfacePos[2]];
    if(c.surfaceNormal)d.surfaceNormal=[-c.surfaceNormal[0],c.surfaceNormal[1],c.surfaceNormal[2]];
    d.offsetSide=-(c.offsetSide||0);
    return d;
  });

  const src=master.geometry.getAttribute('position');
  const dst=slave.geometry.getAttribute('position');
  if(src&&dst&&src.count===dst.count){
    for(let i=0;i<src.count;i++)dst.setXYZ(i,-src.getX(i),src.getY(i),src.getZ(i));
    dst.needsUpdate=true;
    slave.geometry.computeVertexNormals();
    slave.geometry.computeBoundingSphere();
  }

  for(const n of nodes.values()){
    if(n.source==='strap'&&n.parentStrapId===slave.id)syncNodeTransform(n);
    else if(n.source==='crossing'&&n.crossing&&(n.crossing.strapAId===slave.id||n.crossing.strapBId===slave.id))syncNodeTransform(n);
  }
  updateControlHandles(slave);
}
function enforcePairMasterVisuals(){
  const doneN=new Set();
  for(const n of nodes.values()){
    const p=pairOfNode(n);
    if(!p||doneN.has(n.id)||doneN.has(p.id))continue;
    const m=pairMasterNode(n),slave=m===n?p:n;
    forceMirrorNodeFromMaster(m,slave,{visualProps:true});
    doneN.add(m.id);doneN.add(slave.id);
  }
  const doneS=new Set();
  for(const s of straps.values()){
    const p=pairOfStrap(s);
    if(!p||doneS.has(s.id)||doneS.has(p.id))continue;
    const m=pairMasterStrap(s),slave=m===s?p:s;
    // Calculate only canonical side, mirror the rendered mesh to the other.
    updateStrapGeometry(m,{skipPairMirror:true});
    mirrorStrapMeshFromMaster(m,slave);
    doneS.add(m.id);doneS.add(slave.id);
  }
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
  const p=nodeWorldPosition(n),normal=nodeNormalForDisplay(n);

  // Persist the symmetry-safe normal while snapped to the center axis.
  // This also prevents pairing checks / connected strap frames from seeing a
  // slightly asymmetric normal caused by the underlying body mesh.
  if(Math.abs(p.x)<AXIS_SNAP_IN)n.normal=normal.toArray();

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

function waypointFramePosition(s,c){
  const f=strapFrame(s);
  const base=f.A.clone().lerp(f.B,THREE.MathUtils.clamp(c.t??.5,0,1));
  return base
    .addScaledVector(f.tangent,c.offsetTangent||0)
    .addScaledVector(f.side,c.offsetSide||0)
    .addScaledVector(f.normal,c.offsetNormal||0);
}
function bindWaypointToFrame(s,c,worldPos,worldNormal){
  const f=strapFrame(s);
  const base=f.A.clone().lerp(f.B,THREE.MathUtils.clamp(c.t??.5,0,1));
  const d=worldPos.clone().sub(base);
  c.waypoint=true;
  c.surfacePos=worldPos.toArray();
  c.surfaceNormal=worldNormal.clone().normalize().toArray();
  c.offsetTangent=d.dot(f.tangent);
  c.offsetSide=d.dot(f.side);
  c.offsetNormal=d.dot(f.normal);
}
function waypointControlAt(s,t){
  t=THREE.MathUtils.clamp(t,.03,.97);

  // Use the current visible curve as the candidate. This means every new
  // waypoint refines the path that already exists instead of restarting from
  // the straight A->B chord.
  const candidate=effectiveStrapCurve(s).getPoint(t);
  let preferred=strapNormalAt(s,t);
  if(preferred.lengthSq()<1e-8)preferred=strapFrame(s).normal.clone();

  const hit=nearestBodySurfacePreferred(candidate,preferred)||
            nearestBodySurface(candidate);

  const point=hit?.point?.clone?.()||candidate.clone();
  const normal=hit?.normal?.clone?.()||preferred.clone().normalize();

  const c={t,waypoint:true};
  bindWaypointToFrame(s,c,point,normal);
  return c;
}
function nextWaypointT(s){
  const ts=[0,...s.controls.filter(c=>c.waypoint).map(c=>THREE.MathUtils.clamp(c.t,0,1)),1].sort((a,b)=>a-b);
  let bestT=.5,bestGap=-1;
  for(let i=0;i<ts.length-1;i++){
    const gap=ts[i+1]-ts[i];
    if(gap>bestGap){bestGap=gap;bestT=(ts[i]+ts[i+1])*.5}
  }
  return bestT;
}
function addSurfaceWaypoint(s,t=nextWaypointT(s)){
  if(!s)return null;
  // New UI uses waypoints, never recursive SurfaceLevel subdivision.
  s.surfaceLevel=0;
  const c=waypointControlAt(s,t);
  s.controls.push(c);
  updateStrapGeometry(s);
  return c;
}
function reprojectWaypoint(s,c){
  if(!c?.waypoint)return;
  const candidate=waypointFramePosition(s,c);
  const preferred=c.surfaceNormal
    ?new THREE.Vector3().fromArray(c.surfaceNormal).normalize()
    :strapFrame(s).normal.clone();

  const hit=nearestBodySurfacePreferred(candidate,preferred)||
            nearestBodySurface(candidate);
  if(!hit)return;

  bindWaypointToFrame(s,c,hit.point,hit.normal);
}
function reprojectStrapWaypoints(s){
  if(!s?.controls?.some(c=>c.waypoint))return;
  for(const c of s.controls)if(c.waypoint)reprojectWaypoint(s,c);
  updateStrapGeometry(s);
}
function mirrorWaypointsToPartner(src,dst){
  if(!src||!dst)return;
  const sw=src.controls.filter(c=>c.waypoint).slice().sort((a,b)=>a.t-b.t);
  const dw=dst.controls.filter(c=>c.waypoint).slice().sort((a,b)=>a.t-b.t);
  if(sw.length!==dw.length)return;

  for(let i=0;i<sw.length;i++){
    if(!sw[i].surfacePos||!sw[i].surfaceNormal)continue;
    const p=mirrorWorldPointX(new THREE.Vector3().fromArray(sw[i].surfacePos));
    const n=mirrorWorldNormalX(new THREE.Vector3().fromArray(sw[i].surfaceNormal));
    dw[i].t=sw[i].t;
    bindWaypointToFrame(dst,dw[i],p,n);
  }
  updateStrapGeometry(dst);
}
function reprojectAttachedWaypoints(nodeId){
  const touched=new Set();
  for(const s of straps.values()){
    if(touched.has(s.id))continue;
    if((s.a===nodeId||s.b===nodeId)&&s.controls.some(c=>c.waypoint)){
      const ps=pairOfStrap(s);
      const master=ps && s.id>ps.id ? ps : s;
      const mate=ps ? (master===s?ps:s) : null;
      if(!touched.has(master.id)){
        reprojectStrapWaypoints(master);
        if(mate)mirrorWaypointsToPartner(master,mate);
        touched.add(master.id);
        if(mate)touched.add(mate.id);
      }
    }
  }
  return touched;
}
function reprojectAllWaypoints(){
  const handled=new Set();
  for(const s of straps.values()){
    if(handled.has(s.id)||!s.controls.some(c=>c.waypoint))continue;
    const ps=pairOfStrap(s);
    const master=ps && s.id>ps.id ? ps : s;
    const mate=ps ? (master===s?ps:s) : null;
    reprojectStrapWaypoints(master);
    if(mate)mirrorWaypointsToPartner(master,mate);
    handled.add(master.id);
    if(mate)handled.add(mate.id);
  }
}
function waypointPatternMatches(a,b){
  const ac=a.controls.filter(c=>c.waypoint),bc=b.controls.filter(c=>c.waypoint);
  if(ac.length!==bc.length)return false;
  for(let i=0;i<ac.length;i++){
    if(Math.abs((ac[i].t??0)-(bc[i].t??0))>.002)return false;
  }
  return true;
}
function syncWaypointPattern(src,dst){
  const srcWp=src.controls.filter(c=>c.waypoint).slice().sort((a,b)=>a.t-b.t);
  if(!srcWp.length)return false;
  if(waypointPatternMatches(src,dst))return true;

  dst.surfaceLevel=0;
  dst.controls=[];
  for(const c of srcWp)dst.controls.push(waypointControlAt(dst,c.t));
  return true;
}

function manualControlWorld(s,c){
  const f=strapFrame(s);
  const slack=THREE.MathUtils.clamp(s.slack/100,0,1);
  const relativeBulge=THREE.MathUtils.clamp(f.length*.28,.018,.24);
  const baseClearance=THREE.MathUtils.clamp(f.length*.018,.006,.022);
  const clearance=baseClearance+slack*relativeBulge;

  // V1.5c: real surface waypoint.
  // During endpoint drag this is pure vector math: no raycast, no recursive
  // subdivision, no body-surface search. The expensive projection happens once
  // on pointer-up.
  if(c.waypoint){
    const p=waypointFramePosition(s,c);
    const n=c.surfaceNormal?new THREE.Vector3().fromArray(c.surfaceNormal).normalize():f.normal;
    return p.addScaledVector(n,clearance);
  }

  // Legacy explicit surface controls from old saved projects.
  if(c.surfacePos){
    const p=new THREE.Vector3().fromArray(c.surfacePos);
    const n=c.surfaceNormal?new THREE.Vector3().fromArray(c.surfaceNormal).normalize():f.normal;
    return p.addScaledVector(n,clearance);
  }

  // Legacy control compatibility for older saved projects.
  const sideScale=THREE.MathUtils.clamp(f.length,.12,1.2);
  return f.A.clone().lerp(f.B,c.t)
    .addScaledVector(f.side,(c.sideFactor??0)*sideScale)
    .addScaledVector(f.normal,clearance+(c.normalFactor??0)*relativeBulge);
}
function strapCurve(s){
  const A=nodeWorldPosition(nodes.get(s.a)),B=nodeWorldPosition(nodes.get(s.b));
  if(!s.controls.length){
    return new THREE.QuadraticBezierCurve3(A,autoControlWorld(s),B);
  }
  const pts=[A,...s.controls.slice().sort((a,b)=>a.t-b.t).map(c=>manualControlWorld(s,c)),B];
  return new THREE.CatmullRomCurve3(pts,false,'centripetal',.45);
}
function effectiveStrapCurve(s){
  if((s.surfaceLevel||0)>0){
    const data=surfaceCurveData(s);
    if(data)return data.curve;
  }
  return strapCurve(s);
}
function strapPointAt(s,t){return effectiveStrapCurve(s).getPoint(THREE.MathUtils.clamp(t,0,1))}
function strapNormalAt(s,t){
  const tt=THREE.MathUtils.clamp(t,0,1);

  if((s.surfaceLevel||0)>0){
    const data=surfaceCurveData(s);
    if(data){
      const tan=data.curve.getTangent(tt).normalize();
      let n=surfaceNormalAtData(data,tt);
      n.addScaledVector(tan,-n.dot(tan));
      if(n.lengthSq()>1e-8)return n.normalize();
    }
  }

  const f=strapFrame(s),tan=strapCurve(s).getTangent(tt).normalize();
  let n=f.normal.clone().addScaledVector(tan,-f.normal.dot(tan));
  if(n.lengthSq()<1e-8)n=f.normal.clone();
  return n.normalize();
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
    surfaceLevel:data.surfaceLevel??0,
    dynEditStamp:data.dynEditStamp||0,
    previousPartnerId:data.previousPartnerId||null,
    manualUnlinked:!!data.manualUnlinked,
    group:new THREE.Group(),mesh:null,geometry:initStrapGeometry(),
    controlGroup:new THREE.Group()
  };
  s.mesh=new THREE.Mesh(s.geometry,selected?.id===id?STRAP_SEL:STRAP_MAT);
  s.mesh.userData={kind:'strapMesh',id};s.group.add(s.mesh,s.controlGroup);
  straps.set(id,s);strapRoot.add(s.group);
  updateStrapGeometry(s);updateControlHandles(s);
  return s;
}
function updateStrapGeometry(s,{skipPairMirror=false}={}){
  if(!skipPairMirror){
    const ps=pairOfStrap(s);
    if(ps){
      const master=pairMasterStrap(s);
      if(master!==s){
        // Linked mirror side never solves its own curve.
        mirrorStrapMeshFromMaster(master,s);
        return;
      }
    }
  }
  const aNode=nodes.get(s.a),bNode=nodes.get(s.b);if(!aNode||!bNode)return;

  const surfaceMode=(s.surfaceLevel||0)>0;
  let renderCurve=null;
  let surfaceData=null;

  if(!surfaceMode){
    // IMPORTANT: untouched fast V1.4h standard path.
    const curve=strapCurve(s);
    const firstGuide=curve.getPoint(1/STRAP_SAMPLES),lastGuide=curve.getPoint(1-1/STRAP_SAMPLES);
    const a=visibleEndpoint(aNode,firstGuide),b=visibleEndpoint(bNode,lastGuide);

    if(!s.controls.length){
      const ctrl=autoControlWorld(s);
      renderCurve=new THREE.QuadraticBezierCurve3(a,ctrl,b);
    }else{
      // V1.5c waypoint path: A -> P1 -> P2 -> B.
      // This remains the cheap standard geometry path; controls are evaluated
      // with vector math only while dragging.
      const pts=[a,...s.controls.slice().sort((x,y)=>x.t-y.t).map(c=>manualControlWorld(s,c)),b];
      renderCurve=new THREE.CatmullRomCurve3(pts,false,'centripetal',.45);
    }
  }else{
    surfaceData=surfaceCurveData(s);
    if(!surfaceData){
      // Fail-safe fallback to the known-good standard geometry.
      const curve=strapCurve(s);
      const a=visibleEndpoint(aNode,curve.getPoint(1/STRAP_SAMPLES));
      const b=visibleEndpoint(bNode,curve.getPoint(1-1/STRAP_SAMPLES));
      renderCurve=new THREE.QuadraticBezierCurve3(a,autoControlWorld(s),b);
      surfaceData=null;
    }else{
      renderCurve=surfaceData.curve;
    }
  }

  const pos=s.geometry.getAttribute('position');
  const halfW=Math.max(.0003,s.widthMM*.0037*.5);
  const halfT=.0045;
  let prevSide=null,prevNormal=null;

  for(let i=0;i<=STRAP_SAMPLES;i++){
    const t=i/STRAP_SAMPLES,p=renderCurve.getPoint(t);
    const tan=renderCurve.getTangent(t).normalize();

    let normal;
    if(surfaceData){
      // Body normal controls the flat face in surface mode.
      normal=surfaceNormalAtData(surfaceData,t);
      normal.addScaledVector(tan,-normal.dot(tan));

      if(normal.lengthSq()<1e-8){
        normal=prevNormal?prevNormal.clone():strapFrame(s).normal.clone();
        normal.addScaledVector(tan,-normal.dot(tan));
      }
      normal.normalize();
    }else{
      // Exact old orientation behavior for normal straps.
      normal=prevNormal?prevNormal.clone():strapFrame(s).normal.clone();
      normal.addScaledVector(tan,-normal.dot(tan));
      if(normal.lengthSq()<1e-8)normal=strapFrame(s).normal.clone();
      normal.normalize();
    }

    let side=new THREE.Vector3().crossVectors(normal,tan);
    if(side.lengthSq()<1e-8)side=prevSide?prevSide.clone():new THREE.Vector3(1,0,0);
    side.normalize();

    // Parallel-transport style continuity: never allow a sudden 180° frame flip.
    if(prevSide&&side.dot(prevSide)<0){
      side.negate();
      normal.negate();
    }

    normal=new THREE.Vector3().crossVectors(tan,side).normalize();

    // Extra surface-mode safeguard: keep the chosen normal on the same hemisphere
    // as the mannequin normal unless that would flip the previous frame.
    if(surfaceData){
      const bodyN=surfaceNormalAtData(surfaceData,t);
      if(normal.dot(bodyN)<0){
        normal.negate();
        side.negate();
      }
      if(prevSide&&side.dot(prevSide)<0){
        side.negate();
        normal.negate();
      }
    }

    prevSide=side.clone();
    prevNormal=normal.clone();

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

  // Dynamic nodes still update only for this strap.
  for(const n of nodes.values()){
    if(n.source==='strap'&&n.parentStrapId===s.id)syncNodeTransform(n);
    else if(n.source==='crossing'&&n.crossing&&(n.crossing.strapAId===s.id||n.crossing.strapBId===s.id))syncNodeTransform(n);
  }
  updateControlHandles(s);

  if(!skipPairMirror){
    const ps=pairOfStrap(s);
    if(ps&&pairMasterStrap(s)===s)mirrorStrapMeshFromMaster(s,ps);
  }
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
  return {id:s.id,a:s.a,b:s.b,widthMM:s.widthMM,slack:s.slack,locked:s.locked,mirrorId:s.mirrorId||null,controls:s.controls.map(c=>({...c})),surfaceLevel:s.surfaceLevel||0,previousPartnerId:s.previousPartnerId||null,manualUnlinked:!!s.manualUnlinked};
}
function removeStrapBare(id){
  const s=straps.get(id);if(!s)return;
  s.geometry.dispose();strapRoot.remove(s.group);straps.delete(id);
}
function restoreStrapSnapshot(d){
  if(!d||!nodes.has(d.a)||!nodes.has(d.b)||d.a===d.b)return null;
  const s=makeStrap({id:d.id,a:d.a,b:d.b,widthMM:d.widthMM,slack:d.slack,locked:d.locked,mirrorId:d.mirrorId,controls:d.controls,surfaceLevel:d.surfaceLevel||0,previousPartnerId:d.previousPartnerId||null,manualUnlinked:!!d.manualUnlinked});
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
    controls:[],
    surfaceLevel:original.surfaceLevel||0
  });
  const right=makeStrap({
    a:n.id,b,
    widthMM:original.widthMM,
    slack:original.slack,
    controls:[],
    surfaceLevel:original.surfaceLevel||0
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



function applySelectionColor(){
  const c=new THREE.Color(selectionColorHex);
  METAL_SEL.color.copy(c);
  METAL_SEL.emissive.copy(c);
  METAL_SEL.emissiveIntensity=.75;
  POINT_SEL.color.copy(c);
  STRAP_SEL.color.copy(c).multiplyScalar(.82);
  STRAP_SEL.emissive.copy(c);
  STRAP_SEL.emissiveIntensity=.62;
}

function refreshConnectHints(){
  // Connection hinting reuses live materials only; no geometry/material clones.
  if(tool!=='connect')return;
  for(const n of nodes.values()){
    if(!n.visual)continue;
    if(selected?.kind==='node'&&(n.id===selected.id||pairOfNode(selected)?.id===n.id))continue;
    if(n.ringVisible){
      n.visual.material=METAL_MAT;
      if(connectStart===n.id)n.visual.material=METAL_SEL;
    }else{
      n.visual.material=connectStart===n.id?POINT_SEL:POINT_MAT;
    }
  }
}

function selectObject(o){
  if(waypointPlacementStrapId&&o?.id!==waypointPlacementStrapId)cancelWaypointPlacement({quiet:true});
  selected=o;
  refreshMaterials();
  showSelection();
  updateAllControlHandles();
}

function refreshMaterials(){
  const selectedNodePair=selected?.kind==='node'?pairOfNode(selected):null;
  const selectedStrapPair=selected?.kind==='strap'?pairOfStrap(selected):null;

  for(const n of nodes.values()){
    if(!n.visual)continue;
    const on=selected?.kind==='node'&&(n.id===selected.id||n.id===selectedNodePair?.id);
    n.visual.material=on?(n.ringVisible?METAL_SEL:POINT_SEL):(n.ringVisible?METAL_MAT:POINT_MAT);
  }

  for(const s of straps.values()){
    const on=selected?.kind==='strap'&&(s.id===selected.id||s.id===selectedStrapPair?.id);
    s.mesh.material=on?STRAP_SEL:STRAP_MAT;
  }

  refreshConnectHints();
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
  updateLinkButton();
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
    const wp=selected.controls.filter(c=>c.waypoint).length;
    const lvl=selected.surfaceLevel||0;
    if(wp)curvePointCount.textContent=`${wp} ${wp===1?'Punkt':'Punkte'} · ${wp+1} Teile`;
    else if(lvl){
      const internal=Math.pow(2,lvl)-1,sections=Math.pow(2,lvl);
      curvePointCount.textContent=`Legacy · ${internal} Punkte · ${sections} Teile`;
    }else curvePointCount.textContent='Standard';
  }
}
function hideSelection(){selectionPanel.classList.add('hidden');updateLinkButton()}

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
    straps:[...straps.values()].map(s=>({id:s.id,a:s.a,b:s.b,widthMM:s.widthMM,slack:s.slack,locked:s.locked,mirrorId:s.mirrorId,controls:s.controls,surfaceLevel:s.surfaceLevel||0}))
  };
}
function restore(snap){
  restoring=true;
  clearHarness();nextNodeId=snap.nextNodeId||1;nextStrapId=snap.nextStrapId||1;surfaceOffsetMM=snap.surfaceOffsetMM??2;surfaceOffsetSlider.value=surfaceOffsetMM;syncParamUI('surfaceOffset',surfaceOffsetMM);
  for(const d of snap.nodes||[])makeNode(d);
  for(const d of snap.straps||[])if(nodes.has(d.a)&&nodes.has(d.b))makeStrap(d);
  rebuildAllWraps();dynReconcileSymmetry({syncProps:false});restoring=false;updateHistoryButtons();
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
  surfaceOffset:{defaults:[0,2,5,10],min:0,max:30,step:.5},
  globalAnchorSize:{defaults:[8,12,16,20],min:4,max:30,step:1}
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
setupParam('strapWidth',strapWidthSlider,$('strapWidthTools'),v=>{if(selected?.kind==='strap'){strapDefaults.widthMM=v;localStorage.setItem('hd:strapDefaults',JSON.stringify(strapDefaults));selected.widthMM=v;dynTouchEntity(selected);updateStrapGeometry(selected);syncPairedStrapProps(selected);refreshMaterials()}});
setupParam('strapSlack',strapSlackSlider,$('strapSlackTools'),v=>{if(selected?.kind==='strap'){strapDefaults.slack=v;localStorage.setItem('hd:strapDefaults',JSON.stringify(strapDefaults));selected.slack=v;dynTouchEntity(selected);updateStrapGeometry(selected);syncPairedStrapProps(selected);refreshMaterials()}});
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
    if(tool==='connect'){tool='ring';connectStart=null}
    else{tool='connect';connectStart=null}
  }else{
    tool='ring';connectStart=null;
  }
  connectToggle.classList.toggle('active',tool==='connect');
  connectToggle.setAttribute('aria-pressed',String(tool==='connect'));
  refreshMaterials();refreshConnectHints();
}
buildTools.addEventListener('click',e=>{
  const b=e.target.closest('.tool');if(b?.dataset.tool==='connect')setTool('connect');
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
linkSelectedBtn.addEventListener('click',()=>{
  if(!selected)return;
  const linked=selected.kind==='node'?!!pairOfNode(selected):!!pairOfStrap(selected);

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
  }else{
    const partner=pairOfStrap(was);
    if(straps.has(was.id))removeStrap(was.id);
    if(partner&&straps.has(partner.id))removeStrap(partner.id);
  }

  selected=null;
  hideSelection();
  rebuildAllWraps();
  refreshAutomaticCrossings();
  commitHistory();
});
undoBtn.addEventListener('click',undo);redoBtn.addEventListener('click',redo);



function clearWaypointGuide(){
  waypointGuideSamples=null;
  while(waypointGuideRoot.children.length){
    const o=waypointGuideRoot.children.pop();
    o.geometry?.dispose?.();
    o.material?.dispose?.();
  }
}
function buildWaypointGuide(s){
  clearWaypointGuide();
  if(!s)return false;

  const curve=effectiveStrapCurve(s);
  const samples=[];
  const N=14;

  for(let i=0;i<=N;i++){
    const t=i/N;
    const candidate=curve.getPoint(t);
    let preferred;
    try{preferred=strapNormalAt(s,t)}catch{preferred=strapFrame(s).normal.clone()}
    if(preferred.lengthSq()<1e-8)preferred=strapFrame(s).normal.clone();

    const hit=nearestBodySurfacePreferred(candidate,preferred)||
              nearestBodySurface(candidate);
    if(!hit)continue;

    // Lift by a few mm purely for z-fighting-safe visualization.
    const surfacePoint=hit.point.clone();
    const normal=hit.normal.clone().normalize();
    const displayPoint=surfacePoint.clone().addScaledVector(normal,.009);
    samples.push({t,point:surfacePoint,normal,displayPoint});
  }

  if(samples.length<2)return false;
  waypointGuideSamples=samples;

  const positions=[];
  for(const g of samples)positions.push(g.displayPoint.x,g.displayPoint.y,g.displayPoint.z);

  const geom=new THREE.BufferGeometry();
  geom.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  const mat=new THREE.LineBasicMaterial({
    color:0x00d8ff,transparent:true,opacity:.96,depthTest:true,depthWrite:false
  });
  const line=new THREE.Line(geom,mat);
  line.renderOrder=20;
  waypointGuideRoot.add(line);

  const pgeom=geom.clone();
  const pmat=new THREE.PointsMaterial({
    color:0x00d8ff,size:4.5,sizeAttenuation:false,
    transparent:true,opacity:.8,depthTest:true,depthWrite:false
  });
  const points=new THREE.Points(pgeom,pmat);
  points.renderOrder=21;
  waypointGuideRoot.add(points);
  return true;
}
function waypointGuideHit(x,y){
  if(!waypointGuideSamples?.length)return null;
  const rect=canvas.getBoundingClientRect();
  const px=x-rect.left,py=y-rect.top;

  let best=null,bestD=Infinity;
  for(let i=0;i<waypointGuideSamples.length-1;i++){
    const a=waypointGuideSamples[i],b=waypointGuideSamples[i+1];
    const qa=a.displayPoint.clone().project(camera);
    const qb=b.displayPoint.clone().project(camera);
    if(qa.z<-1||qa.z>1||qb.z<-1||qb.z>1)continue;

    const ax=(qa.x*.5+.5)*rect.width, ay=(-qa.y*.5+.5)*rect.height;
    const bx=(qb.x*.5+.5)*rect.width, by=(-qb.y*.5+.5)*rect.height;
    const abx=bx-ax,aby=by-ay,len2=abx*abx+aby*aby;
    if(len2<1e-8)continue;

    const u=THREE.MathUtils.clamp(((px-ax)*abx+(py-ay)*aby)/len2,0,1);
    const sx=ax+u*abx,sy=ay+u*aby,d=Math.hypot(px-sx,py-sy);
    if(d>=bestD)continue;

    const point=a.point.clone().lerp(b.point,u);
    let normal=a.normal.clone().lerp(b.normal,u);
    if(normal.lengthSq()<1e-8)normal=a.normal.clone();
    normal.normalize();

    // Do not allow selecting a guide segment hidden behind the mannequin.
    const visibilityProbe=point.clone().addScaledVector(normal,.012);
    if(bodyOccludesWorldPoint(visibilityProbe,.025))continue;

    bestD=d;
    best={
      t:THREE.MathUtils.lerp(a.t,b.t,u),
      point,normal,distancePx:d
    };
  }

  // Fairly generous touch corridor around the visible cyan line.
  return best&&bestD<=34?best:null;
}

function cancelWaypointPlacement({quiet=false}={}){
  const s=waypointPlacementStrapId?straps.get(waypointPlacementStrapId):null;
  waypointPlacementStrapId=null;
  clearWaypointGuide();
  curvePlusBtn.classList.remove('active');
  canvas.classList.remove('placing-waypoint');
  if(s)refreshMaterials();
  if(!quiet)showToast('Auflagepunkt abgebrochen');
}
function beginWaypointPlacement(s){
  if(!s)return;
  waypointPlacementStrapId=s.id;
  curvePlusBtn.classList.add('active');
  canvas.classList.add('placing-waypoint');
  selectObject(s);
  refreshMaterials();

  if(buildWaypointGuide(s))showToast('Auf die cyanfarbene Auflagelinie tippen');
  else{
    cancelWaypointPlacement({quiet:true});
    showToast('Auflagelinie konnte nicht berechnet werden');
  }
}
function addWaypointFromGuideHit(s,guideHit){
  if(!s||!guideHit)return false;
  let p=guideHit.point.clone(),normal=guideHit.normal.clone().normalize();
  const bestT=THREE.MathUtils.clamp(guideHit.t,.025,.975);

  const selectedSide=s;
  const ps0=pairOfStrap(s);
  const master=ps0?pairMasterStrap(s):s;
  if(master!==s){
    p=mirrorWorldPointX(p);
    normal=mirrorWorldNormalX(normal);
    s=master;
  }

  s.surfaceLevel=0;
  // V1.5f: a manually defined surface route should start fully taut.
  // Otherwise the slack offset immediately lifts the fresh waypoint away
  // from the body and makes the user's chosen route look wrong.
  s.slack=0;
  const c={t:bestT,waypoint:true};
  bindWaypointToFrame(s,c,p,normal);
  s.controls.push(c);
  s.controls.sort((a,b)=>a.t-b.t);
  updateStrapGeometry(s);

  const ps=pairOfStrap(s);
  if(ps){
    ps.surfaceLevel=0;
    ps.slack=0;
    const mirrored=mirrorWorldPointX(p);
    const mirroredNormal=mirrorWorldNormalX(normal);
    const pc={t:bestT,waypoint:true};
    bindWaypointToFrame(ps,pc,mirrored,mirroredNormal);
    ps.controls.push(pc);
    ps.controls.sort((a,b)=>a.t-b.t);
    updateStrapGeometry(ps);
  }
  return true;
}

curveAutoBtn.addEventListener('click',()=>{
  if(selected?.kind!=='strap')return;
  selected.surfaceLevel=0;
  selected.controls=[];

  const ps=pairOfStrap(selected);
  if(ps){ps.surfaceLevel=0;ps.controls=[];updateStrapGeometry(ps)}

  updateStrapGeometry(selected);
  showSelection();refreshAutomaticCrossings();commitHistory();
});

curvePlusBtn.addEventListener('click',()=>{
  if(selected?.kind!=='strap')return;
  const s=selected;
  const wpCount=s.controls.filter(c=>c.waypoint).length;
  if(wpCount>=6){showToast('Maximal 6 Auflagepunkte');return}
  if(waypointPlacementStrapId===s.id){cancelWaypointPlacement();return}
  beginWaypointPlacement(s);
});

curveMinusBtn.addEventListener('click',()=>{
  if(selected?.kind!=='strap')return;
  const s=selected;

  const i=[...s.controls].map((c,i)=>({c,i})).filter(x=>x.c.waypoint).at(-1)?.i;
  if(i===undefined){
    // One click also converts an old recursive surface strap back to Standard.
    if(s.surfaceLevel){s.surfaceLevel=0;updateStrapGeometry(s)}
  }else{
    s.controls.splice(i,1);
    updateStrapGeometry(s);
  }

  const ps=pairOfStrap(s);
  if(ps){
    const pi=[...ps.controls].map((c,i)=>({c,i})).filter(x=>x.c.waypoint).at(-1)?.i;
    if(pi!==undefined)ps.controls.splice(pi,1);
    else ps.surfaceLevel=0;
    updateStrapGeometry(ps);
  }

  showSelection();refreshAutomaticCrossings();commitHistory();
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
  const ca=effectiveStrapCurve(sa),cb=effectiveStrapCurve(sb),N=14;
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
    dynReconcileSymmetry({syncProps:false});
  }finally{
    crossingRefreshBusy=false;
  }
}

const AXIS_SNAP_IN=.095;
const AXIS_SNAP_OUT=.108;

const DYN_SYM_POS_TOL=.035;
let dynSymEditClock=1;
function dynTouchEntity(e){if(e)e.dynEditStamp=++dynSymEditClock}
function dynMirrorPoint(p){const q=p.clone();q.x*=-1;return q}
function dynNodeOnAxis(n){return Math.abs(nodeWorldPosition(n).x)<=DYN_SYM_POS_TOL}
function dynNodeClassMatches(a,b){
  if(!a||!b||a.id===b.id)return false;
  if(a.ringVisible!==b.ringVisible)return false;
  if(a.ringVisible)return true;
  return a.source===b.source;
}
function dynNodesAreMirrors(a,b){
  if(!dynNodeClassMatches(a,b))return false;
  return dynMirrorPoint(nodeWorldPosition(a)).distanceTo(nodeWorldPosition(b))<=DYN_SYM_POS_TOL;
}
function dynEndpointMirrors(aId,bId){
  const a=nodes.get(aId),b=nodes.get(bId);if(!a||!b)return false;
  if(a.id===b.id)return dynNodeOnAxis(a);
  return dynNodesAreMirrors(a,b);
}
function dynStrapsAreMirrors(a,b){
  if(!a||!b||a.id===b.id)return false;
  return (dynEndpointMirrors(a.a,b.a)&&dynEndpointMirrors(a.b,b.b))||
         (dynEndpointMirrors(a.a,b.b)&&dynEndpointMirrors(a.b,b.a));
}
function dynChooseMaster(a,b){
  if(selected?.id===a.id)return a;
  if(selected?.id===b.id)return b;
  return (a.dynEditStamp||0)>=(b.dynEditStamp||0)?a:b;
}

function rememberFormerPartners(a,b){
  if(!a||!b||a.id===b.id)return;
  a.previousPartnerId=b.id;
  b.previousPartnerId=a.id;
}
function clearCurrentPair(a,b){
  if(a?.mirrorId===b?.id)a.mirrorId=null;
  if(b?.mirrorId===a?.id)b.mirrorId=null;
}
function manuallyUnlinkSelected(){
  if(!selected)return false;
  const partner=selected.kind==='node'?pairOfNode(selected):pairOfStrap(selected);
  if(!partner)return false;

  rememberFormerPartners(selected,partner);
  selected.manualUnlinked=true;
  partner.manualUnlinked=true;
  clearCurrentPair(selected,partner);

  refreshMaterials();
  showSelection();
  return true;
}
function reconnectNodeToFormerPartner(n){
  const p=n?.previousPartnerId?nodes.get(n.previousPartnerId):null;
  if(!n||!p)return false;

  // Selected node is the explicit master.
  // Reconstruct exact mirror position, orientation and parameters.
  const masterPos=nodeWorldPosition(n);
  const slavePos=masterPos.clone();slavePos.x*=-1;

  const masterNormal=nodeWorldNormal(n);
  const slaveNormal=masterNormal.clone();slaveNormal.x*=-1;

  setNodeWorldPosition(p,slavePos);
  p.normal=slaveNormal.toArray();
  copyNodeVisualProps(n,p);

  n.manualUnlinked=false;
  p.manualUnlinked=false;
  n.mirrorId=p.id;
  p.mirrorId=n.id;
  rememberFormerPartners(n,p);

  syncNodeTransform(n);
  syncNodeTransform(p);
  updateAttachedStraps(n.id);
  updateAttachedStraps(p.id);
  rebuildWrapsForNode(n);
  rebuildWrapsForNode(p);

  // Their movement may restore/destroy strap symmetry around them.
  dynReconcileSymmetry({syncProps:true});
  refreshMaterials();
  showSelection();
  return true;
}
function reconnectStrapToFormerPartner(s){
  const p=s?.previousPartnerId?straps.get(s.previousPartnerId):null;
  if(!s||!p)return false;

  // Strap coupling is PROPERTY ONLY. Endpoints/length/position stay untouched.
  s.manualUnlinked=false;
  p.manualUnlinked=false;
  s.mirrorId=p.id;
  p.mirrorId=s.id;
  rememberFormerPartners(s,p);

  copyStrapProps(s,p);
  refreshMaterials();
  showSelection();
  return true;
}
function reconnectSelected(){
  if(!selected)return false;
  if(selected.kind==='node')return reconnectNodeToFormerPartner(selected);
  return reconnectStrapToFormerPartner(selected);
}
function updateLinkButton(){
  if(!selected){
    linkSelectedBtn.disabled=true;
    linkSelectedBtn.classList.remove('active','unlinked');
    linkSelectedBtn.setAttribute('aria-pressed','false');
    return;
  }

  const partner=selected.kind==='node'?pairOfNode(selected):pairOfStrap(selected);
  const formerId=selected.previousPartnerId;
  const formerExists=selected.kind==='node'?nodes.has(formerId):straps.has(formerId);
  const linked=!!partner;

  linkSelectedBtn.disabled=!linked&&!formerExists;
  linkSelectedBtn.classList.toggle('active',linked);
  linkSelectedBtn.classList.toggle('unlinked',!linked&&formerExists);
  linkSelectedBtn.setAttribute('aria-pressed',String(linked));
  linkSelectedBtn.title=linked?'Entkoppeln':formerExists?'Wieder koppeln':'Kein Partner';
}

function dynPairNodes(a,b,syncProps=true){
  if(!a||!b||a.id===b.id)return;
  if(a.mirrorId&&a.mirrorId!==b.id){const o=nodes.get(a.mirrorId);if(o?.mirrorId===a.id)o.mirrorId=null}
  if(b.mirrorId&&b.mirrorId!==a.id){const o=nodes.get(b.mirrorId);if(o?.mirrorId===b.id)o.mirrorId=null}
  a.mirrorId=b.id;b.mirrorId=a.id;
  a.manualUnlinked=false;b.manualUnlinked=false;
  rememberFormerPartners(a,b);
  const m=pairMasterNode(a),slave=m===a?b:a;
  if(syncProps)copyNodeVisualProps(m,slave);
  forceMirrorNodeFromMaster(m,slave,{visualProps:syncProps});
}
function dynPairStraps(a,b,syncProps=true){
  if(!a||!b||a.id===b.id)return;
  if(a.mirrorId&&a.mirrorId!==b.id){const o=straps.get(a.mirrorId);if(o?.mirrorId===a.id)o.mirrorId=null}
  if(b.mirrorId&&b.mirrorId!==a.id){const o=straps.get(b.mirrorId);if(o?.mirrorId===b.id)o.mirrorId=null}
  a.mirrorId=b.id;b.mirrorId=a.id;
  a.manualUnlinked=false;b.manualUnlinked=false;
  rememberFormerPartners(a,b);
  const m=pairMasterStrap(a),slave=m===a?b:a;
  if(syncProps){
    slave.widthMM=m.widthMM;slave.slack=m.slack;
    updateStrapGeometry(m,{skipPairMirror:true});
    mirrorStrapMeshFromMaster(m,slave);
  }
}
function dynReconcileSymmetry({syncProps=true}={}){
  for(const n of nodes.values()){
    if(!n.mirrorId)continue;
    const p=nodes.get(n.mirrorId);
    if(!p||!dynNodesAreMirrors(n,p)){
      if(p){
        rememberFormerPartners(n,p);
        if(p.mirrorId===n.id)p.mirrorId=null;
      }
      n.mirrorId=null;
    }
  }
  const nl=[...nodes.values()].filter(n=>!n.mergedState&&!dynNodeOnAxis(n)&&!n.manualUnlinked),usedN=new Set();
  for(const a of nl){
    if(a.mirrorId||usedN.has(a.id))continue;
    let best=null,bestD=Infinity,target=dynMirrorPoint(nodeWorldPosition(a));
    for(const b of nl){
      if(a.id===b.id||b.mirrorId||b.manualUnlinked||usedN.has(b.id)||!dynNodeClassMatches(a,b))continue;
      const d=target.distanceTo(nodeWorldPosition(b));
      if(d<=DYN_SYM_POS_TOL&&d<bestD){best=b;bestD=d}
    }
    if(best){dynPairNodes(a,best,syncProps);usedN.add(a.id);usedN.add(best.id)}
  }
  for(const s of straps.values()){
    if(!s.mirrorId)continue;
    const p=straps.get(s.mirrorId);
    if(!p||!dynStrapsAreMirrors(s,p)){
      if(p){
        rememberFormerPartners(s,p);
        if(p.mirrorId===s.id)p.mirrorId=null;
      }
      s.mirrorId=null;
    }
  }
  const sl=[...straps.values()].filter(s=>!s.manualUnlinked),usedS=new Set();
  for(const a of sl){
    if(a.mirrorId||usedS.has(a.id))continue;
    let best=null;
    for(const b of sl){
      if(a.id===b.id||b.mirrorId||b.manualUnlinked||usedS.has(b.id))continue;
      if(dynStrapsAreMirrors(a,b)){best=b;break}
    }
    if(best){dynPairStraps(a,best,syncProps);usedS.add(a.id);usedS.add(best.id)}
  }
  enforcePairMasterVisuals();
}

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

  const master=pairMasterStrap(src);
  const slave=master===src?dst:src;
  if(master!==src){
    master.widthMM=src.widthMM;
    master.slack=src.slack;
  }

  // Linked pairs use the canonical master's route. If the edit originated on
  // the visual side, mirror its materialized waypoint data back to the master.
  if(src.controls.some(c=>c.waypoint)){
    if(master!==src){
      master.controls=src.controls.map(c=>{
        const d={...c};
        if(c.surfacePos)d.surfacePos=[-c.surfacePos[0],c.surfacePos[1],c.surfacePos[2]];
        if(c.surfaceNormal)d.surfaceNormal=[-c.surfaceNormal[0],c.surfaceNormal[1],c.surfaceNormal[2]];
        d.offsetSide=-(c.offsetSide||0);
        return d;
      });
      master.surfaceLevel=0;
    }
  }else{
    master.surfaceLevel=src.surfaceLevel||0;
    master.controls=src.controls.map(c=>({...c}));
  }

  updateStrapGeometry(master,{skipPairMirror:true});
  mirrorStrapMeshFromMaster(master,slave);
}

function serializeNodeForMerge(n){
  return {
    id:n.id,position:[...n.position],normal:[...n.normal],ringVisible:n.ringVisible,
    diameterMM:n.diameterMM,thicknessMM:n.thicknessMM,sizeMM:n.sizeMM,
    locked:n.locked,source:n.source,parentStrapId:n.parentStrapId,t:n.t,crossing:n.crossing,autoCrossing:n.autoCrossing,previousPartnerId:n.previousPartnerId||null,manualUnlinked:!!n.manualUnlinked
  };
}
function captureMergeTopology(a,b){
  return [...straps.values()]
    .filter(s=>s.a===a.id||s.b===a.id||s.a===b.id||s.b===b.id)
    .map(s=>({id:s.id,a:s.a,b:s.b,widthMM:s.widthMM,slack:s.slack,locked:s.locked,mirrorId:s.mirrorId||null,controls:s.controls.map(c=>({...c})),surfaceLevel:s.surfaceLevel||0}));
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
    const s=makeStrap({id:d.id,a,b,widthMM:d.widthMM,slack:d.slack,locked:d.locked,controls:d.controls,surfaceLevel:d.surfaceLevel||0});
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
  n.mirrorId=m.id;m.mirrorId=n.id;rememberFormerPartners(n,m);copyNodeVisualProps(n,m);return m;
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
      const hasWp=selected.controls.some(c=>c.waypoint);
      const m=makeStrap({a:a.id,b:b.id,widthMM:selected.widthMM,slack:selected.slack,controls:hasWp?[]:selected.controls.map(c=>({...c,side:-c.side})),surfaceLevel:hasWp?0:(selected.surfaceLevel||0)});
      if(hasWp){
        for(const c of selected.controls.filter(c=>c.waypoint).sort((x,y)=>x.t-y.t))m.controls.push(waypointControlAt(m,c.t));
        updateStrapGeometry(m);
      }
      selected.mirrorId=m.id;m.mirrorId=selected.id;rememberFormerPartners(selected,m);
    }
    rebuildAllWraps();commitHistory();showToast('Riemen gespiegelt');
  }
});

rotateModelBtn.addEventListener('click',()=>{modelPanel.classList.remove('hidden');selectionPanel.classList.add('hidden')});
closeModelPanelBtn.addEventListener('click',()=>modelPanel.classList.add('hidden'));
uploadModelBtn.addEventListener('click',()=>modelInput.click());
reloadModelBtn.addEventListener('click',()=>loadIntegratedBody(bodySystem.gender,{reproject:false,clearExistingHarness:true}));
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
    integratedBodyRoot=null;integratedBodyMesh=null;integratedBodyDict=null;usingIntegratedBody=false;
    setBodyUIEnabled(false);
    clearHarness();commitHistory();showToast('Eigenes 3D-Modell geladen');
  }catch(err){console.error(err);showToast('Modell konnte nicht geladen werden')}
  finally{URL.revokeObjectURL(url);modelInput.value=''}
});


updateBodyUI();

function liveBodySliderUpdate(){
  bodySystem.shape=Number(bodyShapeSlider.value);
  bodySystem.muscle=Number(bodyMuscleSlider.value);
  bodySystem.height=Number(bodyHeightSlider.value);
  bodySystem.arms=Number(bodyArmsSlider.value);
  bodySystem.legs=Number(bodyLegsSlider.value);
  updateBodyUI();
  applyIntegratedBodyMorphs();
}
for(const s of [bodyShapeSlider,bodyMuscleSlider,bodyHeightSlider,bodyArmsSlider,bodyLegsSlider]){
  s.addEventListener('input',liveBodySliderUpdate);
  s.addEventListener('change',commitBodyChange);
}
bodyFemaleBtn.addEventListener('click',()=>{
  if(bodySystem.gender==='female'&&usingIntegratedBody)return;
  loadIntegratedBody('female',{reproject:nodes.size>0});
});
bodyMaleBtn.addEventListener('click',()=>{
  if(bodySystem.gender==='male'&&usingIntegratedBody)return;
  loadIntegratedBody('male',{reproject:nodes.size>0});
});

for(const b of modePill.querySelectorAll('.mode'))b.addEventListener('click',()=>{
  mode=b.dataset.mode;for(const x of modePill.querySelectorAll('.mode'))x.classList.toggle('active',x===b);
  if(mode!=='build')hideSelection();else showSelection();
  if(mode!=='build')showToast(mode==='accessories'?'Accessoires folgen später':'Fotomodus folgt später');
});


function bodyOccludesWorldPoint(worldPoint,tolerance=.065){
  const origin=camera.position.clone();
  const delta=worldPoint.clone().sub(origin);
  const targetDist=delta.length();
  if(targetDist<1e-6)return false;

  raycaster.set(origin,delta.normalize());
  const body=raycaster.intersectObjects(bodyMeshes,true)[0];
  if(!body)return false;

  return body.distance < targetDist-tolerance;
}

function screenRayBodyDistance(x,y){
  setPointer(x,y);
  const body=raycaster.intersectObjects(bodyMeshes,true)[0];
  return body?body.distance:Infinity;
}

function visibleNodeFromCamera(n){
  if(!n)return false;
  return !bodyOccludesWorldPoint(n.group.position,.075);
}

function screenSpaceNodeHit(x,y){
  const rect=canvas.getBoundingClientRect();
  const px=x-rect.left,py=y-rect.top;
  let best=null,bestD=Infinity;
  for(const n of nodes.values()){
    if(!visibleNodeFromCamera(n))continue;
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

function pointSegmentDistance2D(px,py,ax,ay,bx,by){
  const abx=bx-ax,aby=by-ay;
  const len2=abx*abx+aby*aby;
  if(len2<1e-8)return Math.hypot(px-ax,py-ay);
  const t=THREE.MathUtils.clamp(((px-ax)*abx+(py-ay)*aby)/len2,0,1);
  return Math.hypot(px-(ax+t*abx),py-(ay+t*aby));
}

function screenSpaceStrapHit(x,y){
  const rect=canvas.getBoundingClientRect();
  const px=x-rect.left,py=y-rect.top;
  let best=null,bestD=Infinity;

  for(const s of straps.values()){
    const curve=effectiveStrapCurve(s);
    const samples=18;
    let prevWorld=curve.getPoint(0);
    let prevProj=prevWorld.clone().project(camera);

    for(let i=1;i<=samples;i++){
      const t=i/samples;
      const world=curve.getPoint(t);
      const proj=world.clone().project(camera);

      // Ignore segments outside the camera clip volume.
      if(prevProj.z>=-1&&prevProj.z<=1&&proj.z>=-1&&proj.z<=1){
        const ax=(prevProj.x*.5+.5)*rect.width;
        const ay=(-prevProj.y*.5+.5)*rect.height;
        const bx=(proj.x*.5+.5)*rect.width;
        const by=(-proj.y*.5+.5)*rect.height;
        const d=pointSegmentDistance2D(px,py,ax,ay,bx,by);

        // Touch target is intentionally much wider than the visual strap.
        // A wider strap gets a slightly wider target, but even a thin strap
        // remains easy to select on iPhone.
        const hitRadius=THREE.MathUtils.clamp(18+(s.widthMM||20)*.18,20,34);

        if(d<hitRadius&&d<bestD){
          // Check a representative point on this segment against the mannequin.
          // Rear-side straps therefore still cannot be selected through the body.
          const midWorld=prevWorld.clone().lerp(world,.5);
          if(!bodyOccludesWorldPoint(midWorld,.06)){
            best={kind:'strap',id:s.id};
            bestD=d;
          }
        }
      }

      prevWorld=world;
      prevProj=proj;
    }
  }

  return best;
}

function interactiveHit(x,y){
  // Existing visible objects always win over placing a new ring.
  const softNode=screenSpaceNodeHit(x,y);
  if(softNode)return softNode;

  const softStrap=screenSpaceStrapHit(x,y);
  if(softStrap)return softStrap;

  // IMPORTANT:
  // Visibility helpers intentionally use the global raycaster too.
  // Therefore every real picking pass MUST restore the touch ray immediately
  // before intersectObjects(). Otherwise the ray can still point at the last
  // node checked for occlusion and that node gets selected from anywhere.
  setPointer(x,y);
  const bodyDistance=raycaster.intersectObjects(bodyMeshes,true)[0]?.distance??Infinity;

  // Node ray hits: first collect visible nodes. visibleNodeFromCamera() changes
  // the raycaster, so restore the actual touch ray afterwards.
  const nodeHits=[];
  for(const n of nodes.values()){
    if(n.hit&&visibleNodeFromCamera(n))nodeHits.push(n.hit);
  }
  setPointer(x,y);
  const nhits=raycaster.intersectObjects(nodeHits,false);
  for(const nh of nhits){
    if(nh.distance<=bodyDistance+.075)return {kind:'node',id:nh.object.userData.id};
  }

  // Strap ray hits use the same restored touch ray. No visibility helper is
  // called between this point and the strap intersection.
  setPointer(x,y);
  const meshes=[...straps.values()].map(s=>s.mesh);
  const shits=raycaster.intersectObjects(meshes,false);
  for(const sh of shits){
    if(sh.distance<=bodyDistance+.055)return {kind:'strap',id:sh.object.userData.id};
  }

  return null;
}
function snapAxis(p){if(Math.abs(p.x)<AXIS_SNAP_IN)p.x=0;return p}

let pointers=new Map(),gesture=null,single=null,dragRaf=0,pendingDrag=null;
function requestNodeDrag(n,x,y){
  pendingDrag={n,x,y};
  if(dragRaf)return;
  dragRaf=requestAnimationFrame(()=>{
    dragRaf=0;const q=pendingDrag;pendingDrag=null;if(!q)return;

    // Merged center ring:
    // X stays locked to the symmetry axis while Y/Z follow the mannequin.
    // A deliberate lateral pull entmerges in the same drag gesture.
    if(q.n.mergedState){
      const current=nodeWorldPosition(q.n);
      const planeP=screenPlanePoint(q.x,q.y,current);
      if(!planeP)return;

      if(Math.abs(planeP.x)>AXIS_SNAP_OUT){
        const release=current.clone();
        release.x=planeP.x;
        setNodeWorldPosition(q.n,release);

        const active=maybeAxisMergeOrEntmerge(q.n);
        if(active!==q.n){
          if(single)single.activeNodeId=active.id;
          selected=active;
          refreshMaterials();
          showSelection();
          updateAttachedStraps(active.id);
          rebuildAllWraps();
        }
        return;
      }

      const hit=bodyHit(q.x,q.y);
      if(hit){
        const p=hit.point.clone();
        p.x=0;

        const normal=symmetryAxisNormal(worldNormal(hit));

        setNodeWorldPosition(q.n,p);
        q.n.normal=normal.toArray();
        syncNodeTransform(q.n);
        updateAttachedStraps(q.n.id);
      }
      return;
    }

    const hit=bodyHit(q.x,q.y);if(!hit)return;
    let p=snapAxis(hit.point.clone());
    let normal=Math.abs(p.x)<AXIS_SNAP_IN?symmetryAxisNormal(worldNormal(hit)):worldNormal(hit);

    const partner=pairOfNode(q.n);
    if(partner){
      const master=pairMasterNode(q.n),slave=master===q.n?partner:q.n;

      // Input on the visual/right side is translated into master/left space.
      if(q.n!==master){
        p=mirrorWorldPointX(p);
        normal=mirrorWorldNormalX(normal);
      }

      setNodeWorldPosition(master,p);master.normal=normal.toArray();syncNodeTransform(master);
      forceMirrorNodeFromMaster(master,slave);
      updateAttachedStraps(master.id);

      // Do not independently solve the slave-side attached straps.
      for(const s of straps.values()){
        const ps=pairOfStrap(s);
        if(!ps)continue;
        const sm=pairMasterStrap(s),ss=sm===s?ps:s;
        if(s.a===master.id||s.b===master.id||s.a===slave.id||s.b===slave.id){
          updateStrapGeometry(sm,{skipPairMirror:true});
          mirrorStrapMeshFromMaster(sm,ss);
        }
      }

      const active=maybeAxisMergeOrEntmerge(master);
      if(active!==master){
        if(single)single.activeNodeId=active.id;
        selected=active;
        showSelection();rebuildAllWraps();
      }
    }else{
      setNodeWorldPosition(q.n,p);q.n.normal=normal.toArray();syncNodeTransform(q.n);
      updateAttachedStraps(q.n.id);
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

  // One-shot waypoint placement: the mannequin owns this tap.
  if(waypointPlacementStrapId){
    single={sx:e.clientX,sy:e.clientY,lx:e.clientX,ly:e.clientY,moved:false,hit:null,waypointPlacement:true};
    return;
  }

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
  if(single.waypointPlacement){
    // Point mode does not freeze navigation: drag rotates, tap places.
    if(single.moved){
      camAz-=(e.clientX-single.lx)*.007;
      camEl=THREE.MathUtils.clamp(camEl+(e.clientY-single.ly)*.006,-1.2,1.2);
      updateCamera();
    }
    single.lx=e.clientX;single.ly=e.clientY;
    return;
  }
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

  if(was.waypointPlacement){
    const s=waypointPlacementStrapId?straps.get(waypointPlacementStrapId):null;
    // A drag was camera navigation. Stay in placement mode and wait for a tap.
    if(was.moved)return;
    const gh=waypointGuideHit(e.clientX,e.clientY);
    if(!gh){showToast('Bitte direkt auf die cyanfarbene Linie tippen');return}

    if(s&&addWaypointFromGuideHit(s,gh)){
      waypointPlacementStrapId=null;
      clearWaypointGuide();
      curvePlusBtn.classList.remove('active');
      canvas.classList.remove('placing-waypoint');
      selectObject(s);
      strapSlackSlider.value=0;
      syncParamUI('strapSlack',0);
      showSelection();refreshAutomaticCrossings();
      dynReconcileSymmetry({syncProps:true});
      refreshMaterials();commitHistory();
      showToast('Auflagepunkt gesetzt');
    }else cancelWaypointPlacement({quiet:true});
    return;
  }

  if(was.moved){
    const movedNode=was.activeNodeId?nodes.get(was.activeNodeId):null;
    if(movedNode){
      dynTouchEntity(movedNode);

      // During drag waypoints followed with vector math only.
      // Now, once, snap affected waypoints back onto the body surface.
      reprojectAttachedWaypoints(movedNode.id);
      const partner=pairOfNode(movedNode);
      if(partner)reprojectAttachedWaypoints(partner.id);
    }
    rebuildAllWraps();refreshAutomaticCrossings();
    dynReconcileSymmetry({syncProps:true});
    refreshMaterials();commitHistory();return
  }
  const hit=was.hit||interactiveHit(e.clientX,e.clientY);
  if(hit?.kind==='node'){
    const n=nodes.get(hit.id);selectObject(n);
    if(tool==='connect'){
      if(!connectStart){connectStart=n.id;refreshMaterials();refreshConnectHints();showToast(`${n.id} gewählt`)}
      else if(connectStart!==n.id){
        const a=nodes.get(connectStart);let s=makeStrap({a:a.id,b:n.id});
        if(mirrorMode){
          const ma=mirrorNode(a),mb=mirrorNode(n);
          if(ma.id!==a.id||mb.id!==n.id){const ms=makeStrap({a:ma.id,b:mb.id,widthMM:s.widthMM,slack:s.slack});s.mirrorId=ms.id;ms.mirrorId=s.id;rememberFormerPartners(s,ms)}
        }
        connectStart=null;tool='ring';connectToggle.classList.remove('active');connectToggle.setAttribute('aria-pressed','false');
        dynReconcileSymmetry({syncProps:true});
        selectObject(s);rebuildAllWraps();refreshAutomaticCrossings();commitHistory();
      }
    }
    return;
  }
  if(hit?.kind==='strap'){selectObject(straps.get(hit.id));return}
  if(tool!=='connect'&&mode==='build'){
    const bh=bodyHit(e.clientX,e.clientY);if(!bh)return;
    const p=snapAxis(bh.point.clone());
    const normal=Math.abs(p.x)<AXIS_SNAP_IN?symmetryAxisNormal(worldNormal(bh)):worldNormal(bh);
    const n=makeNode({position:p.toArray(),normal:normal.toArray()});
    if(mirrorMode&&Math.abs(p.x)>.02){const m=mirrorNode(n);syncNodeTransform(m)}
    dynReconcileSymmetry({syncProps:true});
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

// Start from safe procedural fallback, then replace asynchronously.
// A body-GLB failure therefore cannot block the render loop.
setTimeout(()=>loadIntegratedBody(bodySystem.gender,{reproject:false}),0);

commitHistory();
