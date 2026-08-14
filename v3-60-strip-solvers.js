function clearWaypointGuide(){
  waypointGuideSamples=null;
  while(waypointGuideRoot.children.length){
    const o=waypointGuideRoot.children.pop();
    o.geometry?.dispose?.();
    o.material?.dispose?.();
  }
}

// V1.8d: one shared projection path for the manual cyan guide and Auto.
// Start from the straight endpoint chord, project samples to the mannequin,
// reject implausible jumps, then fill tiny misses by interpolation.
// This is intentionally NOT the old recursive collision solver.

function waypointBaseLiftForStrap(s){
  const f=strapFrame(s);
  return surfaceOffsetScene()+THREE.MathUtils.clamp(f.length*.018,.006,.022);
}

// Cheap tautening pass over the already-computed dense surface samples.
// No new raycasts: a shortcut is accepted only when its straight segment
// stays outside the sampled body shell at every intermediate sample.
function tautenProjectedRoute(samples,clearance,maxPoints=12){
  if(!samples||samples.length<=2)return samples||[];

  function shortcutIsClear(i,j){
    if(j<=i+1)return true;
    const a=samples[i].point,b=samples[j].point;
    for(let k=i+1;k<j;k++){
      const u=(samples[k].t-samples[i].t)/
              Math.max(1e-8,samples[j].t-samples[i].t);
      const q=a.clone().lerp(b,u);
      const surf=samples[k].point;
      const n=samples[k].normal;
      const signed=q.clone().sub(surf).dot(n);

      // Direct line must remain above the same virtual design shell.
      if(signed<clearance-.003)return false;
    }
    return true;
  }

  const keep=[samples[0]];
  let i=0;
  while(i<samples.length-1&&keep.length<maxPoints-1){
    let best=i+1;

    // Greedy: jump as far as possible while staying clear of body samples.
    for(let j=samples.length-1;j>i+1;j--){
      if(shortcutIsClear(i,j)){best=j;break}
    }

    keep.push(samples[best]);
    i=best;
  }

  if(keep[keep.length-1]!==samples[samples.length-1])
    keep.push(samples[samples.length-1]);

  return keep;
}

function projectedChordSamples(s,{count=null,lift=0}={}){
  const aNode=nodes.get(s.a),bNode=nodes.get(s.b);
  if(!aNode||!bNode)return [];

  const A=nodeWorldPosition(aNode),B=nodeWorldPosition(bNode);
  const nA=nodeWorldNormal(aNode),nB=nodeWorldNormal(bNode);
  const length=A.distanceTo(B);

  // Approx. one projection sample every 1 cm.
  // Existing scene scale: 1 mm ≈ 0.0037 scene units => 10 mm ≈ 0.037.
  const segments=count??THREE.MathUtils.clamp(Math.ceil(length/.037),7,96);
  const raw=[];

  for(let i=0;i<=segments;i++){
    const t=i/segments;
    const candidate=A.clone().lerp(B,t);

    let preferred=nA.clone().lerp(nB,t);
    if(preferred.lengthSq()<1e-8)preferred=strapFrame(s).normal.clone();
    preferred.normalize();

    let best=null,bestScore=Infinity;

    // Cast from outside toward the mannequin along the interpolated endpoint normal.
    // This keeps every sample tied to the SAME straight A→B chord instead of
    // following an already-curved strap or hopping to a nearby body region.
    for(const sign of [1,-1]){
      const origin=candidate.clone().addScaledVector(preferred,sign*1.35);
      const dir=preferred.clone().multiplyScalar(-sign);
      raycaster.set(origin,dir);

      const hits=raycaster.intersectObjects(bodyMeshes,true);
      for(const h of hits.slice(0,5)){
        const normal=worldNormal(h);
        const alignment=normal.dot(preferred);
        const distance=h.point.distanceTo(candidate);

        // Prefer the intended body side and the hit closest to the chord point.
        const sidePenalty=alignment<-.15?.8:(1-Math.max(0,alignment))*.08;
        const score=distance+sidePenalty;
        if(score<bestScore){
          bestScore=score;
          best={point:h.point.clone(),normal};
        }
      }
    }

    // Endpoints themselves remain exact ring centres for a stable parameter line.
    if(i===0)best={point:A.clone(),normal:nA.clone().normalize()};
    if(i===segments)best={point:B.clone(),normal:nB.clone().normalize()};

    if(best){
      raw.push({
        t,
        point:best.point,
        normal:best.normal.clone().normalize()
      });
    }
  }

  // Fill the rare missed raycast between neighbouring valid samples.
  // No visual gap is allowed in the manual cyan guide.
  const out=[];
  for(let i=0;i<=segments;i++){
    const t=i/segments;
    let g=raw.find(x=>Math.abs(x.t-t)<1e-8);
    if(!g){
      let left=null,right=null;
      for(const x of raw){
        if(x.t<t)left=x;
        if(x.t>t){right=x;break}
      }
      if(left&&right){
        const u=(t-left.t)/(right.t-left.t);
        let n=left.normal.clone().lerp(right.normal,u);
        if(n.lengthSq()<1e-8)n=left.normal.clone();
        g={t,point:left.point.clone().lerp(right.point,u),normal:n.normalize()};
      }
    }
    if(g)out.push({
      ...g,
      displayPoint:g.point.clone().addScaledVector(g.normal,lift)
    });
  }
  return out;
}

function simplifyProjectedRoute(samples,maxPoints=9){
  if(samples.length<=2)return samples;
  // Keep points only where the surface route visibly bends away from the
  // straight segment. Large smooth areas therefore cost almost nothing.
  const keep=[samples[0]];
  let anchor=0;
  while(anchor<samples.length-1&&keep.length<maxPoints-1){
    const end=Math.min(samples.length-1,anchor+6);
    let bestI=-1,bestD=.010;
    const a=samples[anchor].point,b=samples[end].point;
    const ab=b.clone().sub(a),den=Math.max(ab.lengthSq(),1e-9);
    for(let i=anchor+1;i<end;i++){
      const p=samples[i].point;
      const u=THREE.MathUtils.clamp(p.clone().sub(a).dot(ab)/den,0,1);
      const q=a.clone().addScaledVector(ab,u);
      const d=p.distanceTo(q);
      if(d>bestD){bestD=d;bestI=i}
    }
    if(bestI>anchor){keep.push(samples[bestI]);anchor=bestI}
    else anchor=end;
  }
  if(keep[keep.length-1]!==samples[samples.length-1])keep.push(samples[samples.length-1]);
  return keep;
}


function edgeSurfaceCandidates(candidate,preferredNormal){
  const pref=preferredNormal.clone().normalize(),out=[];
  for(const sign of [1,-1]){
    const origin=candidate.clone().addScaledVector(pref,sign*1.35);
    raycaster.set(origin,pref.clone().multiplyScalar(-sign));
    const hits=raycaster.intersectObjects(bodyMeshes,true);
    for(const h of hits.slice(0,8))out.push({
      point:h.point.clone(),normal:worldNormal(h).clone().normalize(),
      raySign:sign,distance:h.point.distanceTo(candidate)
    });
  }
  out.sort((x,y)=>x.distance-y.distance);return out;
}
function projectEdgeCandidateToBody(candidate,preferredNormal){
  // Compatibility helper still used by the smoothing stage.
  // It deliberately performs a simple local projection only; continuity
  // decisions are handled earlier by chooseProjectionHit().
  const cands=edgeSurfaceCandidates(candidate,preferredNormal);
  return cands.length?cands[0]:null;
}
function projectionVector(candidate,hit){return hit.point.clone().sub(candidate)}
function projectionAngleDeg(a,b){
  if(!a||!b||a.lengthSq()<1e-12||b.lengthSq()<1e-12)return 0;
  return THREE.MathUtils.radToDeg(a.angleTo(b));
}
function chooseProjectionHit(candidate,preferredNormal,referenceVector=null){
  const cands=edgeSurfaceCandidates(candidate,preferredNormal);
  if(!cands.length)return null;
  if(!referenceVector)return {...cands[0],angleDeg:0,rejected:[]};
  let best=null,bestScore=Infinity;const rejected=[];
  for(const h of cands){
    const v=projectionVector(candidate,h),angle=projectionAngleDeg(referenceVector,v);
    const score=angle*.018+h.distance*.20; // direction dominates distance
    const item={...h,angleDeg:angle};
    if(score<bestScore){if(best)rejected.push(best);best=item;bestScore=score}else rejected.push(item);
  }
  return {...best,rejected};
}
function lockedNominalFrames(s,count){
  const a=nodes.get(s.a),b=nodes.get(s.b);if(!a||!b)return [];
  const A0=nodeWorldPosition(a),B0=nodeWorldPosition(b);
  const A=visibleEndpoint(a,B0),B=visibleEndpoint(b,A0);
  let tangent=B.clone().sub(A);if(tangent.lengthSq()<1e-10)tangent=strapFrame(s).tangent.clone();tangent.normalize();
  const halfW=Math.max(.0003,s.widthMM*.0037*.5),frames=[];let prevSide=null;
  let guidedSide=null;
  if(s.guideActive&&s.guidePoint){
    const M=A.clone().lerp(B,.5),G=new THREE.Vector3().fromArray(s.guidePoint);
    let guideDir=G.clone().sub(M);guideDir.addScaledVector(tangent,-guideDir.dot(tangent));
    if(guideDir.lengthSq()>1e-10){guideDir.normalize();guidedSide=new THREE.Vector3().crossVectors(guideDir,tangent).normalize()}
  }
  for(let i=0;i<=count;i++){
    const t=i/count;
    const center=(s.guideActive&&s.guidePoint)?new THREE.QuadraticBezierCurve3(A,new THREE.Vector3().fromArray(s.guidePoint),B).getPoint(t):A.clone().lerp(B,t);
    let normal=nodeWorldNormal(a).clone().lerp(nodeWorldNormal(b),t);
    normal.addScaledVector(tangent,-normal.dot(tangent));
    if(normal.lengthSq()<1e-10)normal=frames.at(-1)?.normal.clone()||strapFrame(s).normal.clone();
    normal.normalize();
    let side=guidedSide?guidedSide.clone():new THREE.Vector3().crossVectors(normal,tangent);
    if(side.lengthSq()<1e-10)side=prevSide?.clone()||strapFrame(s).side.clone();
    side.normalize();
    if(prevSide&&side.dot(prevSide)<0)side.negate(); // never swap L/R
    if(prevSide){
      const ang=THREE.MathUtils.radToDeg(prevSide.angleTo(side));
      if(ang>18)side=prevSide.clone().lerp(side,18/ang).normalize();
    }
    prevSide=side.clone();
    frames.push({t,center,normal,side,
      nominalLeft:center.clone().addScaledVector(side,-halfW),
      nominalRight:center.clone().addScaledVector(side,halfW)});
  }
  return frames;
}
function projectedChordSamplesStrip(s,{lift=0}={}){
  const a=nodes.get(s.a),b=nodes.get(s.b);if(!a||!b)return [];
  const A=nodeWorldPosition(a),B=nodeWorldPosition(b);
  const segments=THREE.MathUtils.clamp(Math.ceil(A.distanceTo(B)/.030),7,72);
  const frames=lockedNominalFrames(s,segments),out=[],recentL=[],recentR=[];
  const rollingRef=arr=>{
    if(!arr.length)return null;
    const v=new THREE.Vector3();for(const x of arr.slice(-4))v.add(x.clone().normalize());
    return v.lengthSq()>1e-12?v.normalize():arr.at(-1).clone().normalize();
  };
  for(const f of frames){
    const lh=chooseProjectionHit(f.nominalLeft,f.normal,rollingRef(recentL));
    const rh=chooseProjectionHit(f.nominalRight,f.normal,rollingRef(recentR));
    const lv=lh?projectionVector(f.nominalLeft,lh):f.normal.clone();
    const rv=rh?projectionVector(f.nominalRight,rh):f.normal.clone();
    recentL.push(lv);recentR.push(rv);
    const left=(lh?.point||f.nominalLeft).clone().addScaledVector(lh?.normal||f.normal,lift);
    const right=(rh?.point||f.nominalRight).clone().addScaledVector(rh?.normal||f.normal,lift);
    let n=(lh?.normal||f.normal).clone().lerp(rh?.normal||f.normal,.5);if(n.lengthSq()<1e-10)n=f.normal.clone();n.normalize();
    out.push({...f,normal:n,leftHit:lh?.point?.clone()||null,rightHit:rh?.point?.clone()||null,
      leftNormal:(lh?.normal||f.normal).clone(),rightNormal:(rh?.normal||f.normal).clone(),
      leftProjection:lv.clone(),rightProjection:rv.clone(),leftAngle:lh?.angleDeg||0,rightAngle:rh?.angleDeg||0,
      leftRejected:(lh?.rejected||[]).map(x=>({point:x.point.clone(),angleDeg:x.angleDeg||0})),
      rightRejected:(rh?.rejected||[]).map(x=>({point:x.point.clone(),angleDeg:x.angleDeg||0})),
      stripLeft:left,stripRight:right});
  }
  return out;
}
function edgeFirstSegmentNeedsRefine(a,b){
  const ml=a.stripLeft.clone().lerp(b.stripLeft,.5);
  const mr=a.stripRight.clone().lerp(b.stripRight,.5);
  return bodyOccludesWorldPoint(ml,.008)||bodyOccludesWorldPoint(mr,.008);
}

function buildStripMethodRoute(s,samples,lift){
  if(!samples?.length)return [];
  const rawLeft=samples.map(g=>g.stripLeft.clone());
  const rawRight=samples.map(g=>g.stripRight.clone());

  // One conservative relaxation pass. We only reproject if smoothing would
  // put an edge back inside the mannequin.
  const smoothEdge=(key)=>{
    const out=[];
    for(let i=0;i<samples.length;i++){
      const g=samples[i];
      if(i===0||i===samples.length-1){out.push(g[key].clone());continue}
      const prev=samples[i-1][key],cur=g[key],next=samples[i+1][key];
      const candidate=prev.clone().multiplyScalar(.18).add(cur.clone().multiplyScalar(.64)).add(next.clone().multiplyScalar(.18));
      if(bodyOccludesWorldPoint(candidate,.006)){
        const nkey=key==='stripLeft'?'leftNormal':'rightNormal';
        const h=projectEdgeCandidateToBody(candidate,g[nkey]||g.normal);
        out.push((h?.point||cur).clone().addScaledVector(h?.normal||g.normal,lift));
      }else out.push(candidate);
    }
    return out;
  };

  const finalLeft=smoothEdge('stripLeft');
  const finalRight=smoothEdge('stripRight');
  const out=samples.map((g,i)=>{
    let n=(g.leftNormal||g.normal).clone().lerp(g.rightNormal||g.normal,.5);
    if(n.lengthSq()<1e-10)n=g.normal.clone();
    n.normalize();
    return {...g,stripLeft:finalLeft[i],stripRight:finalRight[i],normal:n};
  });

  if(out.length>=3){
    const blend=(i0,i1,node)=>{const g0=out[i0],g1=out[i1],mid=g1.stripLeft.clone().lerp(g1.stripRight,.5),center=visibleEndpoint(node,mid),n=nodeWorldNormal(node),lift2=Math.max(lift,surfaceOffsetMM*.001);let side=g0.stripRight.clone().sub(g0.stripLeft);if(side.lengthSq()<1e-10)side=strapFrame(s).side.clone();side.normalize();const hw=Math.max(.0003,s.widthMM*.0037*.5),target=center.clone().addScaledVector(n,lift2),L=target.clone().addScaledVector(side,-hw),R=target.clone().addScaledVector(side,hw);g0.stripLeft=L;g0.stripRight=R;g1.stripLeft=g1.stripLeft.clone().lerp(L,.22);g1.stripRight=g1.stripRight.clone().lerp(R,.22)};
    blend(0,1,nodes.get(s.a));blend(out.length-1,out.length-2,nodes.get(s.b));
  }

  // Debug trace is the exact data produced by this solve.
  s.debugTrace={
    endpoints:[
      visibleEndpoint(nodes.get(s.a),nodeWorldPosition(nodes.get(s.b))),
      visibleEndpoint(nodes.get(s.b),nodeWorldPosition(nodes.get(s.a)))
    ],
    nominalLeft:samples.map(g=>g.nominalLeft.clone()),
    nominalRight:samples.map(g=>g.nominalRight.clone()),
    probesLeft:samples.map(g=>({from:g.nominalLeft.clone(),to:(g.leftHit||g.stripLeft).clone()})),
    probesRight:samples.map(g=>({from:g.nominalRight.clone(),to:(g.rightHit||g.stripRight).clone()})),
    projectionAnglesLeft:samples.map(g=>g.leftAngle||0),
    projectionAnglesRight:samples.map(g=>g.rightAngle||0),
    rejectedLeft:samples.map(g=>g.leftRejected||[]),
    rejectedRight:samples.map(g=>g.rightRejected||[]),
    projectedLeft:rawLeft,
    projectedRight:rawRight,
    finalLeft:finalLeft.map(p=>p.clone()),
    finalRight:finalRight.map(p=>p.clone())
  };
  return out;
}
function methodRouteToControls(s,route,maxControls){
  if(!route?.length)return [];
  const target=Math.min(maxControls,Math.max(7,Math.ceil(route.length/2))),keep=[route[0]];
  for(let k=1;k<target-1;k++){
    const t=k/(target-1);let best=route[1],bd=Infinity;
    for(let i=1;i<route.length-1;i++){const d=Math.abs(route[i].t-t);if(d<bd){bd=d;best=route[i]}}
    if(keep[keep.length-1]!==best)keep.push(best);
  }
  keep.push(route[route.length-1]);return keep;
}
const STRAP_DEBUG_STEPS=[
  ['Direkte Verbindung','Direkte Verbindung zwischen den sichtbaren Anschlussstellen der Ringe.'],
  ['L/R Frame Lock','Nominelle Außenkanten mit fester Links/Rechts-Identität. Sie dürfen sich kontinuierlich drehen, aber niemals die Seiten tauschen.'],
  ['Projektionsrichtungen','Projektionsvektoren zur Oberfläche. Gelb = >25° Abweichung, Rot = >60°. Schwach rot = stark abweichender verworfener Kandidat.'],
  ['Projizierte Punkte','Unabhängig berechnete Körperkontaktpunkte der linken und rechten Außenkante.'],
  ['Rohe Außenkanten','Projizierte Punkte direkt miteinander verbunden – vor der leichten Glättung.'],
  ['Finale Außenkanten','Tatsächlich für den Riemen verwendete linke und rechte Außenkante.'],
  ['Triangulation','Dreiecksnetz zwischen den beiden finalen Außenkanten.']
];
function clearStrapMethodDebug(s){
  if(!s?.controlGroup)return;
  while(s.controlGroup.children.length){
    const o=s.controlGroup.children.pop();
    o.geometry?.dispose?.();o.material?.dispose?.();
  }
}
function strapDebugLine(s,points,color=0x00d8ff,opacity=.9,segments=false){
  if(!points?.length)return;
  const pos=[];
  if(segments){
    for(const pair of points)for(const p of pair)pos.push(p.x,p.y,p.z);
  }else for(const p of points)pos.push(p.x,p.y,p.z);
  if(pos.length<6)return;
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  const mat=new THREE.LineBasicMaterial({color,transparent:true,opacity,depthTest:true,depthWrite:false});
  const obj=segments?new THREE.LineSegments(geo,mat):new THREE.Line(geo,mat);
  obj.renderOrder=40;s.controlGroup.add(obj);
}
function strapDebugPoints(s,points,color=0x00d8ff,size=5){
  if(!points?.length)return;
  const pos=[];for(const p of points)pos.push(p.x,p.y,p.z);
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  const mat=new THREE.PointsMaterial({color,size,sizeAttenuation:false,depthTest:true,depthWrite:false});
  const obj=new THREE.Points(geo,mat);obj.renderOrder=41;s.controlGroup.add(obj);
}
function strapDebugTriangles(s,left,right){
  const seg=[];
  for(let i=0;i<Math.min(left.length,right.length)-1;i++){
    const l0=left[i],r0=right[i],l1=left[i+1],r1=right[i+1];
    seg.push([l0,r0],[l1,r1],[l0,l1],[r0,r1]);
    const alt=stripQuadScore(l0,r0,l1,r1,1)>stripQuadScore(l0,r0,l1,r1,0);
    seg.push(alt?[l0,r1]:[r0,l1]);
  }
  strapDebugLine(s,seg,0xffd54a,.78,true);
}
function updateStrapMethodDebug(s,route){
  clearStrapMethodDebug(s);
  if(!s?.debugRoute||!s.debugTrace)return;
  const d=s.debugTrace;
  const show=(step)=>s.debugAll||s.debugStep===step;

  if(show(0))strapDebugLine(s,d.endpoints,0xffffff,.95);
  if(show(1)){
    strapDebugLine(s,d.nominalLeft,0xff6b6b,.95);
    strapDebugLine(s,d.nominalRight,0x6ba8ff,.95);
  }
  if(show(2)){
    const draw=(probes,angles,color)=>{
      const good=[],warn=[],bad=[];
      probes.forEach((q,i)=>{const a=angles?.[i]||0;(a>60?bad:a>25?warn:good).push([q.from,q.to])});
      strapDebugLine(s,good,color,.76,true);strapDebugLine(s,warn,0xffd54a,.95,true);strapDebugLine(s,bad,0xff334f,1,true);
    };
    draw(d.probesLeft,d.projectionAnglesLeft,0xff6b6b);draw(d.probesRight,d.projectionAnglesRight,0x6ba8ff);
    const rej=[];
    for(const [i,list] of (d.rejectedLeft||[]).entries())for(const h of list)if((h.angleDeg||0)>60)rej.push([d.nominalLeft[i],h.point]);
    for(const [i,list] of (d.rejectedRight||[]).entries())for(const h of list)if((h.angleDeg||0)>60)rej.push([d.nominalRight[i],h.point]);
    strapDebugLine(s,rej,0xff0033,.28,true);
  }
  if(show(3)){
    strapDebugPoints(s,d.projectedLeft,0xff6b6b,5);
    strapDebugPoints(s,d.projectedRight,0x6ba8ff,5);
  }
  if(show(4)){
    strapDebugLine(s,d.projectedLeft,0xff6b6b,.95);
    strapDebugLine(s,d.projectedRight,0x6ba8ff,.95);
  }
  if(show(5)){
    strapDebugLine(s,d.finalLeft,0x00f0b5,1);
    strapDebugLine(s,d.finalRight,0x00f0b5,1);
  }
  if(show(6))strapDebugTriangles(s,d.finalLeft,d.finalRight);

  if(s.mesh)s.mesh.visible=s.debugAll||s.debugStep===6;
}
let strapDebugBodyBackup=null;
function setStrapDebugBodyMode(active){
  if(active){
    if(strapDebugBodyBackup)return;
    strapDebugBodyBackup=bodyMeshes.map(m=>({mesh:m,material:m.material}));
    for(const {mesh,material} of strapDebugBodyBackup){
      const mat=material.clone();
      mat.transparent=true;mat.opacity=.23;mat.side=THREE.FrontSide;mat.depthWrite=false;
      mesh.material=mat;
    }
  }else{
    if(!strapDebugBodyBackup)return;
    for(const {mesh,material} of strapDebugBodyBackup){
      mesh.material?.dispose?.();
      mesh.material=material;
    }
    strapDebugBodyBackup=null;
  }
}
function refreshStrapDebugPanel(s){
  const panel=document.getElementById('strapDebugPanel');
  if(!panel)return;
  const step=THREE.MathUtils.clamp(s?.debugStep||0,0,STRAP_DEBUG_STEPS.length-1);
  document.getElementById('strapDebugStepLabel').textContent=`${step+1}/${STRAP_DEBUG_STEPS.length} · ${STRAP_DEBUG_STEPS[step][0]}`;
  document.getElementById('strapDebugDescription').textContent=STRAP_DEBUG_STEPS[step][1];
  document.getElementById('strapDebugAllBtn').classList.toggle('active',!!s?.debugAll);
}
function openStrapDebugMode(s){
  if(!s?.debugTrace)rebuildAutoProjection(s);
  s.debugRoute=true;s.debugStep=THREE.MathUtils.clamp(s.debugStep||0,0,STRAP_DEBUG_STEPS.length-1);
  document.getElementById('strapDebugPanel')?.classList.remove('hidden');
  setStrapDebugBodyMode(true);
  updateStrapMethodDebug(s,s.methodRoute||[]);
  refreshStrapDebugPanel(s);
  strapDebugBtn.classList.add('active');
}
function closeStrapDebugMode(s=selected){
  if(s?.kind==='strap'){
    s.debugRoute=false;s.debugAll=false;
    clearStrapMethodDebug(s);
    if(s.mesh)s.mesh.visible=true;
  }
  setStrapDebugBodyMode(false);
  document.getElementById('strapDebugPanel')?.classList.add('hidden');
  strapDebugBtn.classList.remove('active');
}
function strapRouteLooksPlausible(route){
  if(!route||route.length<2)return false;
  for(let i=1;i<route.length;i++){
    const a=route[i-1],b=route[i];
    const sa=a.stripRight.clone().sub(a.stripLeft),sb=b.stripRight.clone().sub(b.stripLeft);
    if(sa.lengthSq()>1e-10&&sb.lengthSq()>1e-10&&sa.dot(sb)<0)return false;
  }
  return true;
}
function rebuildAutoProjection(s){
  if(!s)return;
  s.autoProject=true;s.autoMethod='strip';s.previewMode=false;
  const lift=Math.max(waypointBaseLiftForStrap(s),surfaceOffsetMM*.001);
  const samples=projectedChordSamplesStrip(s,{lift});
  if(samples.length<2){updateStrapGeometry(s);return}
  let route=buildStripMethodRoute(s,samples,lift);
  const deleted=s.deletedStripTs||[];
  if(deleted.length)route=route.filter((g,i)=>i===0||i===route.length-1||!deleted.some(t=>Math.abs(g.t-t)<.018));
  s.methodRoute=route;s.controls=[];s.surfaceLevel=0;
  updateStrapGeometry(s);updateStrapMethodDebug(s,route);
}
function projectChordPointToBody(s,t,lift=0){
  const aNode=nodes.get(s.a),bNode=nodes.get(s.b);
  if(!aNode||!bNode)return null;

  const A=nodeWorldPosition(aNode),B=nodeWorldPosition(bNode);
  const nA=nodeWorldNormal(aNode),nB=nodeWorldNormal(bNode);
  const candidate=A.clone().lerp(B,t);

  let preferred=nA.clone().lerp(nB,t);
  if(preferred.lengthSq()<1e-8)preferred=strapFrame(s).normal.clone();
  preferred.normalize();

  let best=null,bestScore=Infinity;
  for(const sign of [1,-1]){
    const origin=candidate.clone().addScaledVector(preferred,sign*1.35);
    const dir=preferred.clone().multiplyScalar(-sign);
    raycaster.set(origin,dir);

    const hits=raycaster.intersectObjects(bodyMeshes,true);
    for(const h of hits.slice(0,5)){
      const normal=worldNormal(h);
      const alignment=normal.dot(preferred);
      const distance=h.point.distanceTo(candidate);
      const sidePenalty=alignment<-.15?.8:(1-Math.max(0,alignment))*.08;
      const score=distance+sidePenalty;

      if(score<bestScore){
        bestScore=score;
        best={
          t,
          point:h.point.clone(),
          normal:normal.clone().normalize()
        };
      }
    }
  }

  if(!best)return null;
  best.displayPoint=best.point.clone().addScaledVector(best.normal,lift);
  return best;
}

function guideSegmentNeedsRefine(a,b){
  // Test the visible straight segment itself. On a convex shoulder/chest the
  // endpoints can both be correct while the chord between them dives through
  // the mannequin.
  const mid=a.displayPoint.clone().lerp(b.displayPoint,.5);
  return bodyOccludesWorldPoint(mid,.012);
}

function refineProjectedGuide(s,samples,lift,maxDepth=2){
  if(samples.length<2)return samples;

  function refinePair(a,b,depth){
    if(depth>=maxDepth||!guideSegmentNeedsRefine(a,b))return [a,b];

    const t=(a.t+b.t)*.5;
    const mid=projectChordPointToBody(s,t,lift);
    if(!mid)return [a,b];

    const left=refinePair(a,mid,depth+1);
    const right=refinePair(mid,b,depth+1);
    return left.slice(0,-1).concat(right);
  }

  const out=[];
  for(let i=0;i<samples.length-1;i++){
    const part=refinePair(samples[i],samples[i+1],0);
    if(i)part.shift();
    out.push(...part);
  }
  return out;
}
function buildWaypointGuide(s){
  clearWaypointGuide();
  if(!s)return false;
  const guideLift=waypointBaseLiftForStrap(s);
  let samples=projectedChordSamples(s,{lift:guideLift});
  if(samples.length<2)return false;

  // Locally refine only where straight visual segments would cut into a
  // strongly convex part of the mannequin.
  samples=refineProjectedGuide(s,samples,guideLift,2);
  // For the 3-line experiment, apply the same width constraint to the guide.
  samples=widthConstrainedProjectedRoute(s,samples,guideLift);
  waypointGuideSamples=samples;

  const positions=[];
  for(const g of samples)positions.push(g.displayPoint.x,g.displayPoint.y,g.displayPoint.z);
  const geom=new THREE.BufferGeometry();
  geom.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  const mat=new THREE.LineBasicMaterial({
    color:0x00d8ff,transparent:true,opacity:.96,depthTest:true,depthWrite:false
  });
  const line=new THREE.Line(geom,mat);line.renderOrder=20;waypointGuideRoot.add(line);

  // Thin outer-edge guides: same route, actual current strap width.
  for(const key of ['leftDisplay','rightDisplay']){
    const edgePos=[];
    for(const g of samples){
      const p=g[key]||g.displayPoint;
      edgePos.push(p.x,p.y,p.z);
    }
    const eg=new THREE.BufferGeometry();
    eg.setAttribute('position',new THREE.Float32BufferAttribute(edgePos,3));
    const em=new THREE.LineBasicMaterial({
      color:0x00d8ff,transparent:true,opacity:.48,depthTest:true,depthWrite:false
    });
    const el=new THREE.Line(eg,em);
    el.renderOrder=19;
    waypointGuideRoot.add(el);
  }

  const pgeom=geom.clone();
  const pmat=new THREE.PointsMaterial({
    color:0x00d8ff,size:4.2,sizeAttenuation:false,
    transparent:true,opacity:.8,depthTest:true,depthWrite:false
  });
  const points=new THREE.Points(pgeom,pmat);points.renderOrder=21;waypointGuideRoot.add(points);
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
  s.autoProject=false;
  const aps=pairOfStrap(s);if(aps)aps.autoProject=false;
  showSelection();
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

