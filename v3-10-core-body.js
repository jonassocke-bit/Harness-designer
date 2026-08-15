
const $=id=>document.getElementById(id);
const canvas=$('scene'),viewport=$('viewport');
const selectionPanel=$('selectionPanel'),modelPanel=$('modelPanel');
const nodeControls=$('nodeControls'),strapControls=$('strapControls');
const selectionLabel=$('selectionLabel'),selectionTitle=$('selectionTitle');
const linkSelectedBtn=$('linkSelectedBtn'),lockSelectedBtn=$('lockSelectedBtn'),deleteSelectedBtn=$('deleteSelectedBtn'),finalizeMergeBtn=$('finalizeMergeBtn');
const undoBtn=$('undoBtn'),redoBtn=$('redoBtn');
const mirrorToggle=$('mirrorToggle'),mirrorSelectedBtn=$('mirrorSelectedBtn'),rotateModelBtn=$('rotateModelBtn');
const buildTools=$('buildTools'),connectToggle=$('connectToggle'),restoreUI=$('restoreUI'),modePill=$('modePill'),toast=$('toast');
const panelToggle=$('panelToggle'),panelConfirmBtn=$('panelConfirmBtn');
const panelControls=$('panelControls'),panelOffsetSlider=$('panelOffsetSlider'),panelOffsetTools=$('panelOffsetTools');
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
const curvePointCount=$('curvePointCount'),curveMinusBtn=$('curveMinusBtn'),curvePlusBtn=$('curvePlusBtn'),curveAutoBtn=$('curveAutoBtn'),strapDebugBtn=$('strapDebugBtn');
const hitboxDebugBtn=$('hitboxDebugBtn');
const addAnchorBtn=$('addAnchorBtn');

const rotXSlider=$('rotXSlider'),rotYSlider=$('rotYSlider'),rotZSlider=$('rotZSlider'),surfaceOffsetSlider=$('surfaceOffsetSlider');
const globalAnchorSizeSlider=$('globalAnchorSizeSlider');
const selectionColorPicker=$('selectionColorPicker');

const scene=new THREE.Scene();
scene.background=new THREE.Color(0x0b0b0e);
scene.fog=new THREE.Fog(0x0b0b0e,6.5,10);

const camera=new THREE.PerspectiveCamera(31,1,.001,50);
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
const panelRoot=new THREE.Group();scene.add(panelRoot);
const panelGuideRoot=new THREE.Group();scene.add(panelGuideRoot);
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
const PANEL_PICK_MAT=new THREE.MeshStandardMaterial({color:0x00d8ff,roughness:.2,metalness:.55,emissive:0x007c96,emissiveIntensity:.55});
const PANEL_MAT=new THREE.MeshStandardMaterial({color:0x202124,roughness:.68,metalness:0,side:THREE.DoubleSide,transparent:true,opacity:.92,polygonOffset:true,polygonOffsetFactor:3,polygonOffsetUnits:3});
const PANEL_SEL=new THREE.MeshStandardMaterial({color:0x00d8ff,roughness:.62,metalness:0,side:THREE.DoubleSide,emissive:0x007c96,emissiveIntensity:.55,transparent:true,opacity:.82,polygonOffset:true,polygonOffsetFactor:3,polygonOffsetUnits:3});
const PANEL_GUIDE_MAT=new THREE.PointsMaterial({color:0x00d8ff,size:5,sizeAttenuation:false,transparent:true,opacity:.9,depthTest:true,depthWrite:false});

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
let panelDefaults=(()=>{try{return {...{offsetMM:1},...JSON.parse(localStorage.getItem('hd:panelDefaults')||'{}')}}catch{return {offsetMM:1}}})();
let selected=null,connectStart=null,connectGuidePoint=null;
let waypointPlacementStrapId=null;
let waypointGuideSamples=null;
let nextNodeId=1,nextStrapId=1,nextPanelId=1;
let panels=new Map();
let panelBuildNodes=[];
let panelDirty=new Set(),panelRebuildRaf=0;
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
  invalidateBodyAnalysisV351();
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
  invalidateBodyAnalysisV351();
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
  invalidateBodyAnalysisV351();
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
  updateAllPanels();
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


// ===== V3.4.4 BODY ZONES / HITBOXES =====
const BODY_ZONE_COLORS={torso:0x32c7ff,head:0xff5fc8,armL:0xff9638,armR:0xffd84a,legL:0x75e06e,legR:0x31b85a};
let bodyZoneDebug=false,bodyZoneDebugGroup=null;
// ============================================================
// V3.5.1 · CACHED BODY ANALYSIS + COMPLEXITY LAYER
// ============================================================
let bodyBoundsCacheV351=null;
let bodyComplexityMapV351=null;
let bodyComplexityDebugV351=false;
let bodyComplexityDebugGroupV351=null;

function clearBodyComplexityDebugV351(){
  if(!bodyComplexityDebugGroupV351)return;
  helperRoot.remove(bodyComplexityDebugGroupV351);
  bodyComplexityDebugGroupV351.traverse(o=>{
    o.geometry?.dispose?.();
    if(Array.isArray(o.material))o.material.forEach(m=>m.dispose?.());
    else o.material?.dispose?.();
  });
  bodyComplexityDebugGroupV351=null;
}
function invalidateBodyAnalysisV351(){
  bodyBoundsCacheV351=null;
  bodyZoneLandmarksV348=null;
  bodyComplexityMapV351=null;
  clearBodyComplexityDebugV351();
}
function getBodyBoundsV344(){
  if(bodyBoundsCacheV351)return bodyBoundsCacheV351.clone();
  const b=new THREE.Box3();
  for(const m of bodyMeshes)b.expandByObject(m);
  bodyBoundsCacheV351=b.clone();
  return b;
}



const BODY_ZONE_CAL_KEY_V350='HD_BODY_ZONE_CAL_V350';
let bodyZoneCalibrationV350={neck:0,shoulderY:0,shoulderX:0,armpitY:0,armpitX:0,groin:0,vDepth:0};
try{Object.assign(bodyZoneCalibrationV350,JSON.parse(localStorage.getItem(BODY_ZONE_CAL_KEY_V350)||'{}'))}catch{}
function saveBodyZoneCalibrationV350(){
  try{localStorage.setItem(BODY_ZONE_CAL_KEY_V350,JSON.stringify(bodyZoneCalibrationV350))}catch{}
  bodyZoneLandmarksV348=null;
  bodyComplexityMapV351=null;
  clearBodyComplexityDebugV351();
  if(bodyZoneDebug)rebuildBodyZoneDebug();
  if(bodyComplexityDebugV351)rebuildBodyComplexityDebugV351();
}

let bodyZoneLandmarksV348=null;
function computeBodyZoneLandmarksV348(){
  if(bodyZoneLandmarksV348)return bodyZoneLandmarksV348;

  const box=getBodyBoundsV344(),c=box.getCenter(new THREE.Vector3()),sz=box.getSize(new THREE.Vector3());
  const samples=[];

  // Gather world vertices as normalized x/y.
  for(const m of bodyMeshes){
    const pos=m.geometry?.attributes?.position;
    if(!pos)continue;
    const step=Math.max(1,Math.floor(pos.count/24000));
    for(let i=0;i<pos.count;i+=step){
      const p=new THREE.Vector3().fromBufferAttribute(pos,i).applyMatrix4(m.matrixWorld);
      samples.push({
        x:(p.x-c.x)/(sz.x||1),
        y:(p.y-c.y)/(sz.y||1)
      });
    }
  }

  // Width profile by y bins.
  const bins=80,prof=Array.from({length:bins},()=>[]);
  for(const s of samples){
    const bi=THREE.MathUtils.clamp(Math.floor((s.y+.5)*bins),0,bins-1);
    prof[bi].push(Math.abs(s.x));
  }
  const widthAt=i=>{
    const arr=prof[i];if(!arr?.length)return 0;
    arr.sort((a,b)=>a-b);
    return arr[Math.floor(arr.length*.92)]||0;
  };
  const ys=i=>(i+.5)/bins-.5;
  const widths=prof.map((_,i)=>widthAt(i));

  // Neck base: first strong width increase while scanning downward from head.
  let neckY=.245;
  for(let i=bins-3;i>Math.floor(bins*.55);i--){
    const w=widths[i],w2=widths[Math.max(0,i-3)];
    if(w>.12 && w>w2*1.18){neckY=ys(i);break}
  }

  // Groin/leg split: find local narrowing/central split region below pelvis.
  // Keep conservative torso pelvis, but derive around actual mesh profile.
  let groinY=-.12;
  let best=Infinity,bestY=groinY;
  for(let i=Math.floor(bins*.18);i<Math.floor(bins*.44);i++){
    const w=widths[i];
    if(w>0 && w<best){best=w;bestY=ys(i)}
  }
  if(Number.isFinite(bestY))groinY=bestY+.025;

  // Shoulder/armpit band: use widest upper torso band and derive diagonal.
  let shoulderY=.20,shoulderX=.20;
  let maxW=0;
  for(let i=Math.floor(bins*.52);i<Math.floor(bins*.75);i++){
    if(widths[i]>maxW){maxW=widths[i];shoulderY=ys(i);shoulderX=widths[i]}
  }
  const armpitY=shoulderY-.17;
  const armpitX=Math.max(.13,shoulderX*.68);

  bodyZoneLandmarksV348={
    neckY:neckY+bodyZoneCalibrationV350.neck,
    shoulderY:shoulderY+bodyZoneCalibrationV350.shoulderY,
    shoulderX:Math.min(.30,Math.max(.10,shoulderX*.82+bodyZoneCalibrationV350.shoulderX)),
    armpitY:armpitY+bodyZoneCalibrationV350.armpitY,
    armpitX:Math.min(.28,Math.max(.08,armpitX+bodyZoneCalibrationV350.armpitX)),
    groinY:groinY+bodyZoneCalibrationV350.groin,
    vDepth:.025+bodyZoneCalibrationV350.vDepth
  };
  return bodyZoneLandmarksV348;
}

function buildBodyComplexityMapV351(){
  if(bodyComplexityMapV351)return bodyComplexityMapV351;
  const box=getBodyBoundsV344();
  const size=box.getSize(new THREE.Vector3());
  const nx=14,ny=30,nz=10;
  const cells=new Map();
  const keyOf=(ix,iy,iz)=>`${ix}|${iy}|${iz}`;

  let totalVerts=0;
  for(const m of bodyMeshes)totalVerts+=m.geometry?.attributes?.position?.count||0;
  const globalStep=Math.max(1,Math.ceil(totalVerts/18000));

  let cursor=0;
  for(const m of bodyMeshes){
    const pos=m.geometry?.attributes?.position;
    const nor=m.geometry?.attributes?.normal;
    if(!pos||!nor)continue;
    m.updateWorldMatrix(true,false);
    const nm=new THREE.Matrix3().getNormalMatrix(m.matrixWorld);

    for(let i=0;i<pos.count;i++,cursor++){
      if(cursor%globalStep)continue;

      const p=new THREE.Vector3().fromBufferAttribute(pos,i).applyMatrix4(m.matrixWorld);
      const n=new THREE.Vector3().fromBufferAttribute(nor,i).applyMatrix3(nm).normalize();

      const ux=THREE.MathUtils.clamp((p.x-box.min.x)/(size.x||1),0,.999999);
      const uy=THREE.MathUtils.clamp((p.y-box.min.y)/(size.y||1),0,.999999);
      const uz=THREE.MathUtils.clamp((p.z-box.min.z)/(size.z||1),0,.999999);
      const ix=Math.floor(ux*nx),iy=Math.floor(uy*ny),iz=Math.floor(uz*nz);
      const key=keyOf(ix,iy,iz);
      let c=cells.get(key);
      if(!c){
        c={ix,iy,iz,count:0,sumN:new THREE.Vector3(),sumP:new THREE.Vector3()};
        cells.set(key,c);
      }
      c.count++;
      c.sumN.add(n);
      c.sumP.add(p);
    }
  }

  for(const c of cells.values()){
    c.center=c.sumP.clone().multiplyScalar(1/Math.max(1,c.count));
    const meanLen=c.sumN.length()/Math.max(1,c.count);
    // 0 = normals locally agree, 1 = highly varying normals / curvature.
    c.curvature=THREE.MathUtils.clamp((1-meanLen)*2.2,0,1);
  }

  bodyComplexityMapV351={box,size,nx,ny,nz,cells,keyOf};
  return bodyComplexityMapV351;
}
function bodyZoneBoundaryComplexityV351(p){
  const box=getBodyBoundsV344(),c=box.getCenter(new THREE.Vector3()),sz=box.getSize(new THREE.Vector3());
  const x=(p.x-c.x)/(sz.x||1),y=(p.y-c.y)/(sz.y||1),ax=Math.abs(x);
  const lm=computeBodyZoneLandmarksV348();

  const dNeck=Math.abs(y-lm.neckY);
  const k=THREE.MathUtils.clamp((y-lm.armpitY)/(Math.max(.001,lm.shoulderY-lm.armpitY)),0,1);
  const armBoundary=THREE.MathUtils.lerp(lm.armpitX,lm.shoulderX,k);
  const dArm=Math.abs(ax-armBoundary);
  const legCut=lm.groinY+THREE.MathUtils.clamp(ax/.30,0,1)*lm.vDepth;
  const dLeg=Math.abs(y-legCut);

  const near=(d,r)=>THREE.MathUtils.clamp(1-d/r,0,1);
  return Math.max(
    near(dNeck,.035),
    (y>lm.armpitY-.06&&y<lm.shoulderY+.06)?near(dArm,.045):0,
    near(dLeg,.045)
  );
}
function bodyComplexityAtV351(p){
  const map=buildBodyComplexityMapV351();
  const {box,size,nx,ny,nz,cells,keyOf}=map;
  const ux=THREE.MathUtils.clamp((p.x-box.min.x)/(size.x||1),0,.999999);
  const uy=THREE.MathUtils.clamp((p.y-box.min.y)/(size.y||1),0,.999999);
  const uz=THREE.MathUtils.clamp((p.z-box.min.z)/(size.z||1),0,.999999);
  const ix=Math.floor(ux*nx),iy=Math.floor(uy*ny),iz=Math.floor(uz*nz);

  let curvature=0;
  // Small neighborhood keeps the map stable when a point lands near a cell edge.
  for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(let dz=-1;dz<=1;dz++){
    const c=cells.get(keyOf(ix+dx,iy+dy,iz+dz));
    if(c)curvature=Math.max(curvature,c.curvature);
  }
  const boundary=bodyZoneBoundaryComplexityV351(p);
  return THREE.MathUtils.clamp(Math.max(curvature,boundary*.92),0,1);
}
function rebuildBodyComplexityDebugV351(){
  clearBodyComplexityDebugV351();
  if(!bodyComplexityDebugV351)return;
  const map=buildBodyComplexityMapV351();
  const pts=[],cols=[];
  const color=new THREE.Color();

  for(const c of map.cells.values()){
    if(!c.center)continue;
    const score=Math.max(c.curvature,bodyZoneBoundaryComplexityV351(c.center)*.92);
    // blue -> green -> yellow -> red
    if(score<.33)color.setHSL(.60-score*.45,.9,.55);
    else if(score<.66)color.setHSL(.32-(score-.33)*.55,.95,.52);
    else color.setHSL(.12-(score-.66)*.35,.95,.52);
    pts.push(c.center.clone());
    cols.push(color.r,color.g,color.b);
  }
  const g=new THREE.BufferGeometry().setFromPoints(pts);
  g.setAttribute('color',new THREE.Float32BufferAttribute(cols,3));
  const m=new THREE.PointsMaterial({
    size:.016,sizeAttenuation:true,vertexColors:true,
    depthTest:false,depthWrite:false,transparent:true,opacity:.82
  });
  const cloud=new THREE.Points(g,m);cloud.renderOrder=124;
  const group=new THREE.Group();group.add(cloud);
  helperRoot.add(group);bodyComplexityDebugGroupV351=group;
}
function setBodyComplexityDebugV351(v){
  bodyComplexityDebugV351=!!v;
  rebuildBodyComplexityDebugV351();
}
function classifyBodyZoneWorldPoint(p){
  const box=getBodyBoundsV344(),c=box.getCenter(new THREE.Vector3()),sz=box.getSize(new THREE.Vector3());
  const x=(p.x-c.x)/(sz.x||1),y=(p.y-c.y)/(sz.y||1),ax=Math.abs(x);
  const lm=computeBodyZoneLandmarksV348();

  if(y>lm.neckY)return 'head';

  // Diagonal shoulder -> armpit based on actual mannequin landmarks.
  const k=THREE.MathUtils.clamp((y-lm.armpitY)/(lm.shoulderY-lm.armpitY),0,1);
  const armBoundary=THREE.MathUtils.lerp(lm.armpitX,lm.shoulderX,k);
  if(y>lm.armpitY-.01 && ax>armBoundary)return x<0?'armL':'armR';

  // Pelvis/crotch remains torso. Shallow V around measured groin height.
  const legCut=lm.groinY + THREE.MathUtils.clamp(ax/.30,0,1)*lm.vDepth;
  if(y<legCut)return x<0?'legL':'legR';

  return 'torso';
}
function zoneForNode(n){return n?classifyBodyZoneWorldPoint(nodeWorldPosition(n)):'torso'}
function allowedZonesForStrap(s){
  const za=zoneForNode(nodes.get(s.a)),zb=zoneForNode(nodes.get(s.b));
  if(za===zb)return new Set([za]);
  const out=new Set([za,zb]);
  if(s.routingGuide)out.add(classifyBodyZoneWorldPoint(new THREE.Vector3().fromArray(s.routingGuide)));
  return out;
}
function clearBodyZoneDebug(){
  if(!bodyZoneDebugGroup)return;
  helperRoot.remove(bodyZoneDebugGroup);
  bodyZoneDebugGroup.traverse(o=>{o.geometry?.dispose?.();o.material?.dispose?.()});
  bodyZoneDebugGroup=null;
}
function rebuildBodyZoneDebug(){
  bodyZoneLandmarksV348=null;
  clearBodyZoneDebug();if(!bodyZoneDebug)return;
  const group=new THREE.Group();group.renderOrder=120;
  for(const m of bodyMeshes){
    const pos=m.geometry?.attributes?.position;if(!pos)continue;
    const buckets={torso:[],head:[],armL:[],armR:[],legL:[],legR:[]};
    const step=Math.max(1,Math.floor(pos.count/18000));
    for(let i=0;i<pos.count;i+=step){
      const p=new THREE.Vector3().fromBufferAttribute(pos,i).applyMatrix4(m.matrixWorld);
      buckets[classifyBodyZoneWorldPoint(p)].push(p);
    }
    for(const [zone,pts] of Object.entries(buckets)){
      if(!pts.length)continue;
      const g=new THREE.BufferGeometry().setFromPoints(pts);
      const mat=new THREE.PointsMaterial({color:BODY_ZONE_COLORS[zone],size:.012,sizeAttenuation:true,transparent:true,opacity:.82,depthTest:false,depthWrite:false});
      const cloud=new THREE.Points(g,mat);cloud.renderOrder=120;group.add(cloud);
    }
  }
  const box=getBodyBoundsV344(),c=box.getCenter(new THREE.Vector3()),sz=box.getSize(new THREE.Vector3());
  const X=n=>c.x+n*sz.x,Y=n=>c.y+n*sz.y,Z=n=>c.z+n*sz.z;
  const mkBoundary=pts=>{
    const g=new THREE.BufferGeometry().setFromPoints(pts);
    const l=new THREE.Line(
      g,
      new THREE.LineBasicMaterial({color:0xff3344,depthTest:false,transparent:true,opacity:.98})
    );
    l.renderOrder=122;group.add(l);
  };
  const lm=computeBodyZoneLandmarksV348();
  // Red boundaries from the SAME live landmark values as the classifier.
  mkBoundary([
    new THREE.Vector3(X(-.16),Y(lm.neckY),Z(.31)),
    new THREE.Vector3(X(.16),Y(lm.neckY),Z(.31))
  ]);
  mkBoundary([
    new THREE.Vector3(X(-lm.shoulderX),Y(lm.shoulderY),Z(.31)),
    new THREE.Vector3(X(-lm.armpitX),Y(lm.armpitY),Z(.31))
  ]);
  mkBoundary([
    new THREE.Vector3(X(lm.shoulderX),Y(lm.shoulderY),Z(.31)),
    new THREE.Vector3(X(lm.armpitX),Y(lm.armpitY),Z(.31))
  ]);
  mkBoundary([
    new THREE.Vector3(X(-.30),Y(lm.groinY+lm.vDepth),Z(.31)),
    new THREE.Vector3(X(0),Y(lm.groinY),Z(.31)),
    new THREE.Vector3(X(.30),Y(lm.groinY+lm.vDepth),Z(.31))
  ]);
  helperRoot.add(group);bodyZoneDebugGroup=group;
}
function setBodyZoneDebug(v){bodyZoneDebug=!!v;rebuildBodyZoneDebug()}

const HITBOX_COLORS={node:0x00e5ff,strap:0xffd54a,guide:0xff4fd8,panel:0x52ef7d,snap:0xff7a21};
let hitboxOverlayDebugV344=false,hitboxDebugGroupV344=null;
function clearHitboxDebug(){
  if(!hitboxDebugGroupV344)return;
  helperRoot.remove(hitboxDebugGroupV344);
  hitboxDebugGroupV344.traverse(o=>{o.geometry?.dispose?.();o.material?.dispose?.()});
  hitboxDebugGroupV344=null;
}
function rebuildHitboxDebug(){
  clearHitboxDebug();if(!hitboxOverlayDebugV344)return;
  const group=new THREE.Group();group.renderOrder=125;
  const sphere=(p,r,color,opacity)=>{const o=new THREE.Mesh(new THREE.SphereGeometry(r,12,8),new THREE.MeshBasicMaterial({color,wireframe:true,transparent:true,opacity,depthTest:false,depthWrite:false}));o.position.copy(p);o.renderOrder=125;group.add(o)};
  const boxFor=(obj,color,opacity)=>{const box=new THREE.Box3().setFromObject(obj);if(box.isEmpty())return;const size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());const o=new THREE.Mesh(new THREE.BoxGeometry(Math.max(size.x,.01),Math.max(size.y,.01),Math.max(size.z,.01)),new THREE.MeshBasicMaterial({color,wireframe:true,transparent:true,opacity,depthTest:false,depthWrite:false}));o.position.copy(center);o.renderOrder=125;group.add(o)};
  for(const n of nodes.values()){
    const p=nodeWorldPosition(n),rr=Math.max(.035,(n.diameterMM||20)*.001*.7);
    sphere(p,rr,HITBOX_COLORS.node,.55);sphere(p,rr*1.8,HITBOX_COLORS.snap,.22);
  }
  for(const s of straps.values()){
    if(s.mesh)boxFor(s.mesh,HITBOX_COLORS.strap,.42);
    if(s.guideHandle)sphere(s.guideHandle.position,.05,HITBOX_COLORS.guide,.65);
  }
  for(const p of panels.values())if(p.mesh)boxFor(p.mesh,HITBOX_COLORS.panel,.38);
  helperRoot.add(group);hitboxDebugGroupV344=group;
}
function setHitboxOverlayDebugV344(v){hitboxOverlayDebugV344=!!v;rebuildHitboxDebug()}
