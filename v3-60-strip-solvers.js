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
  // V3.4.2: global 0 really means near-contact.
  // Keep only a tiny anti-z-fighting clearance; no hidden length-dependent air gap.
  return surfaceOffsetScene()+.0012;
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
    const origin=candidate.clone().addScaledVector(pref,sign*1.35),dir=pref.clone().multiplyScalar(-sign);raycaster.set(origin,dir);
    for(const h of raycaster.intersectObjects(bodyMeshes,true).slice(0,8)){
      const n=worldNormal(h).clone().normalize(),align=n.dot(pref),dist=h.point.distanceTo(candidate);
      out.push({point:h.point.clone(),normal:n,baseScore:dist+(align<-.2?.9:(1-Math.max(0,align))*.08),raySign:sign});
    }
  } out.sort((a,b)=>a.baseScore-b.baseScore);return out;
}
function segmentCutsBody(a,b){return bodyOccludesWorldPoint(a.clone().lerp(b,.5),.006)}
function continuityScore(h,ctx,candidate){
  let score=h.baseScore;if(!ctx)return score;
  if(ctx.expected)score+=h.point.distanceTo(ctx.expected)*1.6;
  if(ctx.prevPoint){score+=h.point.distanceTo(ctx.prevPoint)*.45;if(segmentCutsBody(ctx.prevPoint,h.point))score+=4}
  if(ctx.prevNormal){const d=THREE.MathUtils.clamp(h.normal.dot(ctx.prevNormal),-1,1);score+=(1-d)*.22;if(d<-.1)score+=1.2}
  return score;
}
function rigidStrapGuideFrame(s){
  const a=nodes.get(s.a),b=nodes.get(s.b);if(!a||!b)return null;
  const A0=nodeWorldPosition(a),B0=nodeWorldPosition(b);
  const guideTarget=s.routingGuide?new THREE.Vector3().fromArray(s.routingGuide):null;
  // A guided strap must reorient its ring attachments toward the chosen route.
  // The guide is still NOT a waypoint in the surface solve.
  const A=visibleEndpoint(a,guideTarget||B0),B=visibleEndpoint(b,guideTarget||A0);

  let tangent=B.clone().sub(A);
  if(tangent.lengthSq()<1e-10)return null;
  tangent.normalize();

  const mid=A.clone().lerp(B,.5);
  let planeNormal=null;

  // Optional third construction tap: orientation only.
  if(s.routingGuide){
    let g=new THREE.Vector3().fromArray(s.routingGuide).sub(mid);
    g.addScaledVector(tangent,-g.dot(tangent));
    if(g.lengthSq()>1e-10)planeNormal=g.normalize();
  }

  // Direct strap: choose orientation ONCE from endpoint normals.
  if(!planeNormal){
    planeNormal=nodeWorldNormal(a).clone().add(nodeWorldNormal(b));
    planeNormal.addScaledVector(tangent,-planeNormal.dot(tangent));
    if(planeNormal.lengthSq()<1e-10){
      planeNormal=nodeWorldNormal(a).clone();
      planeNormal.addScaledVector(tangent,-planeNormal.dot(tangent));
    }
    if(planeNormal.lengthSq()<1e-10){
      planeNormal=strapFrame(s).normal.clone();
      planeNormal.addScaledVector(tangent,-planeNormal.dot(tangent));
    }
    planeNormal.normalize();
  }

  let side=new THREE.Vector3().crossVectors(planeNormal,tangent);
  if(side.lengthSq()<1e-10)side=strapFrame(s).side.clone();
  side.normalize();

  // Deterministic L/R sign.
  const fs=strapFrame(s).side;
  if(fs.lengthSq()>1e-10&&side.dot(fs)<0)side.negate();

  const projectionAxis=new THREE.Vector3().crossVectors(tangent,side).normalize();
  return {A,B,mid,tangent,side,projectionAxis};
}

function filteredBodyHitsV344(origin,dir,allowedZones){
  raycaster.set(origin,dir);
  const hits=raycaster.intersectObjects(bodyMeshes,true);
  return allowedZones?hits.filter(h=>allowedZones.has(classifyBodyZoneWorldPoint(h.point))):hits;
}
function radialProjectionCenterV344(s,frame){
  const {A,B,mid,projectionAxis}=frame;
  let inward=projectionAxis.clone().normalize();
  if(s.routingGuide){
    const g=new THREE.Vector3().fromArray(s.routingGuide).sub(mid);
    if(g.dot(inward)>0)inward.negate();
  }
  const depth=THREE.MathUtils.clamp(A.distanceTo(B)*.34,.10,.45);
  return mid.clone().addScaledVector(inward,-depth);
}
function radialSurfaceHitV344(candidate,center,allowedZones){
  const dir=candidate.clone().sub(center);
  if(dir.lengthSq()<1e-12)return null;
  dir.normalize();
  const hits=filteredBodyHitsV344(center,dir,allowedZones);
  if(!hits.length)return null;
  let best=null,bd=Infinity;
  for(const h of hits){const d=h.point.distanceTo(candidate);if(d<bd){best=h;bd=d}}
  return best?{point:best.point.clone(),normal:worldNormal(best).clone().normalize(),distance:bd}:null;
}
function projectionHits(candidate,axis,sign,allowedZones=null){
  const dir=axis.clone().normalize().multiplyScalar(sign);
  const origin=candidate.clone().addScaledVector(dir,-1.20);
  return filteredBodyHitsV344(origin,dir,allowedZones).slice(0,14).map(h=>({
    point:h.point.clone(),normal:worldNormal(h).clone().normalize(),distance:h.point.distanceTo(candidate)
  })).sort((a,b)=>a.distance-b.distance);
}
function chooseProjectionHitGlobal(candidate,axis,sign,prevPoint=null,allowedZones=null){
  const hits=projectionHits(candidate,axis,sign,allowedZones);
  if(!hits.length)return null;
  if(!prevPoint)return hits[0];

  let best=null,bestScore=Infinity;
  for(const h of hits){
    const score=h.distance*.30+h.point.distanceTo(prevPoint)*.70;
    if(score<bestScore){bestScore=score;best=h}
  }
  return best;
}

function projectedChordSamplesStrip(s,{lift=0}={}){
  const frame=rigidStrapGuideFrame(s);if(!frame)return [];
  const {A,B,side,projectionAxis}=frame;
  const allowedZones=allowedZonesForStrap(s);
  const radialCenter=radialProjectionCenterV344(s,frame);
  const segments=THREE.MathUtils.clamp(Math.ceil(A.distanceTo(B)/.025),8,80);
  const halfW=Math.max(.0003,s.widthMM*.0037*.5);
  const route=[];
  let prevL=null,prevR=null,radialFallbacks=0;

  for(let i=0;i<=segments;i++){
    const t=i/segments;
    const center=A.clone().lerp(B,t);
    const nominalLeft=center.clone().addScaledVector(side,-halfW);
    const nominalRight=center.clone().addScaledVector(side,halfW);
    let lh=radialSurfaceHitV344(nominalLeft,radialCenter,allowedZones);
    let rh=radialSurfaceHitV344(nominalRight,radialCenter,allowedZones);
    if(!lh){radialFallbacks++;lh=chooseProjectionHitGlobal(nominalLeft,projectionAxis,1,prevL,allowedZones)||chooseProjectionHitGlobal(nominalLeft,projectionAxis,-1,prevL,allowedZones)}
    if(!rh){radialFallbacks++;rh=chooseProjectionHitGlobal(nominalRight,projectionAxis,1,prevR,allowedZones)||chooseProjectionHitGlobal(nominalRight,projectionAxis,-1,prevR,allowedZones)}
    if(!lh||!rh)continue;
    const left=lh.point.clone().addScaledVector(lh.normal,lift);
    const right=rh.point.clone().addScaledVector(rh.normal,lift);
    prevL=left;prevR=right;
    let normal=lh.normal.clone().lerp(rh.normal,.5);
    if(normal.lengthSq()<1e-10)normal=projectionAxis.clone();
    normal.normalize();
    route.push({t,center,normal,side:side.clone(),nominalLeft,nominalRight,leftHit:lh.point.clone(),rightHit:rh.point.clone(),leftNormal:lh.normal.clone(),rightNormal:rh.normal.clone(),stripLeft:left,stripRight:right,radialCenter:radialCenter.clone()});
  }
  s.routingDebug={mode:'radial',zones:[...allowedZones],radialCenter:radialCenter.clone(),radialFallbacks,frame:{A:A.clone(),B:B.clone(),side:side.clone(),projectionAxis:projectionAxis.clone()}};
  return route;
}
function projectEdgeCandidateToBody(candidate,preferredNormal){
  // Compatibility for the conservative smoothing pass only.
  // Do not perform a new route decision here.
  raycaster.set(candidate.clone().addScaledVector(preferredNormal,1.0),preferredNormal.clone().negate().normalize());
  const h=raycaster.intersectObjects(bodyMeshes,true)[0];
  return h?{point:h.point.clone(),normal:worldNormal(h).clone().normalize()}:null;
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
    const blend=(i0,i1,node)=>{const g0=out[i0],g1=out[i1],mid=g1.stripLeft.clone().lerp(g1.stripRight,.5),center=visibleEndpoint(node,mid),n=nodeWorldNormal(node),lift2=lift;let side=g0.stripRight.clone().sub(g0.stripLeft);if(side.lengthSq()<1e-10)side=strapFrame(s).side.clone();side.normalize();const hw=Math.max(.0003,s.widthMM*.0037*.5),target=center.clone().addScaledVector(n,lift2),L=target.clone().addScaledVector(side,-hw),R=target.clone().addScaledVector(side,hw);g0.stripLeft=L;g0.stripRight=R;g1.stripLeft=g1.stripLeft.clone().lerp(L,.22);g1.stripRight=g1.stripRight.clone().lerp(R,.22)};
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
    nominalCenters:samples.map(g=>g.center.clone()),
    routingDebug:s.routingDebug||null,
    radialCenter:s.routingDebug?.radialCenter?.clone?.()||null,
    routingGuide:s.routingGuide?new THREE.Vector3().fromArray(s.routingGuide):null,
    probesLeft:samples.map(g=>({from:g.nominalLeft.clone(),to:(g.leftHit||g.stripLeft).clone()})),
    probesRight:samples.map(g=>({from:g.nominalRight.clone(),to:(g.rightHit||g.stripRight).clone()})),
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
  ['Starre Hilfslinien','Weiße direkte A→B-Linie plus zwei echte parallele Außenlinien. Der optionale dritte Körperpunkt bestimmt nur die Ebene dieses Linienpaares; ohne ihn wird die Ebene einmal aus den Ringlagen bestimmt.'],
  ['Globale ± Projektion','Beide Außenkanten werden gemeinsam als komplette + oder komplette − Variante projiziert. Gemischte Richtungen sind ausgeschlossen; gewählt wird nach Gültigkeit/Breitenkohärenz und danach Pfadlänge.'],
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
    if(d.routingGuide)strapDebugPoints(s,[d.routingGuide],0xffd54a,10);
    strapDebugLine(s,d.nominalCenters,0xffffff,.72);
    strapDebugLine(s,d.nominalLeft,0xff6b6b,.98);
    strapDebugLine(s,d.nominalRight,0x6ba8ff,.98);
  }
  if(show(2)){
    if(d.routingGuide)strapDebugPoints(s,[d.routingGuide],0xffd54a,10);
    if(d.radialCenter){
      strapDebugPoints(s,[d.radialCenter],0xffffff,9);
      strapDebugLine(s,d.probesLeft.map(q=>[d.radialCenter,q.to]),0xff6b6b,.72,true);
      strapDebugLine(s,d.probesRight.map(q=>[d.radialCenter,q.to]),0x6ba8ff,.72,true);
    }else{
      strapDebugLine(s,d.probesLeft.map(q=>[q.from,q.to]),0xff6b6b,.72,true);
      strapDebugLine(s,d.probesRight.map(q=>[q.from,q.to]),0x6ba8ff,.72,true);
    }
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
  updateControlHandles(s);
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
  if(s?.kind==='strap')updateControlHandles(s);
}
function strapRouteLooksPlausible(route){if(!route||route.length<2)return false;for(let i=1;i<route.length;i++){const a=route[i-1],b=route[i],sa=a.stripRight.clone().sub(a.stripLeft),sb=b.stripRight.clone().sub(b.stripLeft);if(a.stripLeft.distanceTo(b.stripLeft)>.34||a.stripRight.distanceTo(b.stripRight)>.34)return false;if(segmentCutsBody(a.stripLeft,b.stripLeft)||segmentCutsBody(a.stripRight,b.stripRight))return false;if(sa.lengthSq()>1e-10&&sb.lengthSq()>1e-10&&sa.dot(sb)<0)return false}return true}
function rebuildAutoProjection(s){
  if(!s)return;s.autoProject=true;s.autoMethod='strip';s.previewMode=false;const lift=Math.max(waypointBaseLiftForStrap(s),surfaceOffsetMM*.001);
  let samples=projectedChordSamplesStrip(s,{lift});if(samples.length<2){updateStrapGeometry(s);return}let route=buildStripMethodRoute(s,samples,lift);
  if(!strapRouteLooksPlausible(route)){samples=projectedChordSamplesStrip(s,{lift});route=buildStripMethodRoute(s,samples,lift)}
  const deleted=s.deletedStripTs||[];if(deleted.length)route=route.filter((g,i)=>i===0||i===route.length-1||!deleted.some(t=>Math.abs(g.t-t)<.018));s.methodRoute=route;s.controls=[];s.surfaceLevel=0;updateStrapGeometry(s);updateStrapMethodDebug(s,route);
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

