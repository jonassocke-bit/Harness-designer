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


function projectEdgeCandidateToBody(candidate,preferredNormal){
  let pref=preferredNormal.clone().normalize();
  let best=null,bestScore=Infinity;

  for(const sign of [1,-1]){
    const origin=candidate.clone().addScaledVector(pref,sign*1.35);
    const dir=pref.clone().multiplyScalar(-sign);
    raycaster.set(origin,dir);

    const hits=raycaster.intersectObjects(bodyMeshes,true);
    for(const h of hits.slice(0,5)){
      const n=worldNormal(h);
      const alignment=n.dot(pref);
      const dist=h.point.distanceTo(candidate);
      const sidePenalty=alignment<-.15?.8:(1-Math.max(0,alignment))*.08;
      const score=dist+sidePenalty;
      if(score<bestScore){
        bestScore=score;
        best={point:h.point.clone(),normal:n.clone().normalize()};
      }
    }
  }
  return best;
}

function widthConstrainedProjectedRoute(s,samples,lift){
  if(!samples||samples.length<2)return samples||[];

  const halfW=Math.max(.0003,s.widthMM*.0037*.5);
  const out=[];
  let prevSide=null;

  for(let i=0;i<samples.length;i++){
    const g=samples[i];

    const pPrev=samples[Math.max(0,i-1)].point;
    const pNext=samples[Math.min(samples.length-1,i+1)].point;
    let tangent=pNext.clone().sub(pPrev);
    if(tangent.lengthSq()<1e-8)tangent=strapFrame(s).tangent.clone();
    tangent.normalize();

    let normal=g.normal.clone();
    normal.addScaledVector(tangent,-normal.dot(tangent));
    if(normal.lengthSq()<1e-8)normal=strapFrame(s).normal.clone();
    normal.normalize();

    let side=new THREE.Vector3().crossVectors(normal,tangent);
    if(side.lengthSq()<1e-8)side=prevSide?prevSide.clone():strapFrame(s).side.clone();
    side.normalize();

    if(prevSide&&side.dot(prevSide)<0)side.negate();
    prevSide=side.clone();

    // Three lanes: center, left edge and right edge.
    const centerShell=g.point.clone().addScaledVector(normal,lift);
    const leftCandidate=centerShell.clone().addScaledVector(side,-halfW);
    const rightCandidate=centerShell.clone().addScaledVector(side,halfW);

    const leftHit=projectEdgeCandidateToBody(
      g.point.clone().addScaledVector(side,-halfW),normal
    );
    const rightHit=projectEdgeCandidateToBody(
      g.point.clone().addScaledVector(side,halfW),normal
    );

    let requiredLift=0;
    if(leftHit){
      const desired=leftHit.point.clone().addScaledVector(leftHit.normal,lift);
      requiredLift=Math.max(requiredLift,desired.clone().sub(leftCandidate).dot(normal));
    }
    if(rightHit){
      const desired=rightHit.point.clone().addScaledVector(rightHit.normal,lift);
      requiredLift=Math.max(requiredLift,desired.clone().sub(rightCandidate).dot(normal));
    }

    // Never push inward. Only lift the center enough for BOTH outer edges.
    const correction=Math.max(0,requiredLift);
    const correctedPoint=g.point.clone().addScaledVector(normal,correction);

    out.push({
      ...g,
      point:correctedPoint,
      normal,
      side,
      displayPoint:correctedPoint.clone().addScaledVector(normal,lift),
      leftDisplay:leftCandidate.clone().addScaledVector(normal,correction),
      rightDisplay:rightCandidate.clone().addScaledVector(normal,correction)
    });
  }
  return out;
}

function rebuildClassicMethod(s){
  if(!s?.autoProject)return;

  const lift=waypointBaseLiftForStrap(s);
  let samples=projectedChordSamples(s,{lift});
  if(samples.length<3)return;

  // First obtain the centerline surface route.
  samples=refineProjectedGuide(s,samples,lift,2);

  // Width-aware constraint: center + both actual strap edges.
  // The center is lifted only where either outer edge would intersect the body.
  samples=widthConstrainedProjectedRoute(s,samples,lift);

  // Then tension/simplify the width-safe route.
  const reduced=tautenProjectedRoute(samples,lift,12);

  s.surfaceLevel=0;
  s.controls=[];
  for(const g of reduced.slice(1,-1)){
    const c={t:g.t,waypoint:true,autoProjected:true};
    bindWaypointToFrame(s,c,g.point,g.normal);
    s.controls.push(c);
  }
  s.controls.sort((a,b)=>a.t-b.t);
  updateStrapGeometry(s);
}

function methodBaseCurve(s){
  const f=strapFrame(s);
  return new THREE.QuadraticBezierCurve3(f.A,autoControlWorld(s),f.B);
}
function smoothMethodPush(values,radius=4,passes=2){
  if(!values?.length)return [];
  const req=values.slice();let out=values.slice();
  for(let pass=0;pass<passes;pass++){
    const next=out.slice();
    for(let i=0;i<out.length;i++){
      let sum=out[i]*4,w=4;
      for(let d=1;d<=radius;d++){
        const ww=radius+1-d;
        if(i-d>=0){sum+=out[i-d]*ww;w+=ww}
        if(i+d<out.length){sum+=out[i+d]*ww;w+=ww}
      }
      next[i]=Math.max(req[i],sum/w);
    }
    out=next;
  }
  return out;
}
function buildPushMethodRoute(s,samples,lift){
  const base=methodBaseCurve(s);
  const measured=widthConstrainedProjectedRoute(s,samples,lift);
  const raw=measured.map(g=>{
    const p=base.getPoint(g.t),n=g.normal.clone().normalize();
    return Math.max(0,-p.clone().sub(g.displayPoint).dot(n));
  });
  const pushes=smoothMethodPush(raw,5,3);
  return measured.map((g,i)=>({...g,finalPoint:base.getPoint(g.t).addScaledVector(g.normal,pushes[i]),push:pushes[i]}));
}
function projectedChordSamplesStrip(s,{lift=0}={}){
  const a=nodes.get(s.a),b=nodes.get(s.b);if(!a||!b)return [];
  const A=nodeWorldPosition(a),B=nodeWorldPosition(b);
  const ha=nearestBodySurface(A),hb=nearestBodySurface(B);
  const nA=ha?.normal||nodeWorldNormal(a),nB=hb?.normal||nodeWorldNormal(b);
  const segments=THREE.MathUtils.clamp(Math.ceil(A.distanceTo(B)/.037),7,96),out=[];
  for(let i=0;i<=segments;i++){
    const t=i/segments,c=A.clone().lerp(B,t);
    let n=nA.clone().lerp(nB,t);if(n.lengthSq()<1e-8)n=strapFrame(s).normal.clone();n.normalize();
    const h=nearestBodySurfacePreferred(c,n)||nearestBodySurface(c);if(!h)continue;
    out.push({t,point:h.point.clone(),normal:h.normal.clone().normalize(),displayPoint:h.point.clone().addScaledVector(h.normal,lift)});
  }
  return out;
}
function buildStripMethodRoute(s,samples,lift){
  const measured=widthConstrainedProjectedRoute(s,samples,lift);
  const halfW=Math.max(.0003,s.widthMM*.0037*.5),out=[];let prevSide=null;
  for(let i=0;i<measured.length;i++){
    const g=measured[i],pp=measured[Math.max(0,i-1)].point,pn=measured[Math.min(measured.length-1,i+1)].point;
    let tan=pn.clone().sub(pp);if(tan.lengthSq()<1e-8)tan=strapFrame(s).tangent.clone();tan.normalize();
    let n=g.normal.clone();n.addScaledVector(tan,-n.dot(tan));if(n.lengthSq()<1e-8)n=strapFrame(s).normal.clone();n.normalize();
    let side=new THREE.Vector3().crossVectors(n,tan);if(side.lengthSq()<1e-8)side=prevSide?prevSide.clone():strapFrame(s).side.clone();side.normalize();
    if(prevSide&&side.dot(prevSide)<0)side.negate();prevSide=side.clone();
    const lh=projectEdgeCandidateToBody(g.point.clone().addScaledVector(side,-halfW),n);
    const rh=projectEdgeCandidateToBody(g.point.clone().addScaledVector(side,halfW),n);
    const left=(lh?lh.point:g.point.clone().addScaledVector(side,-halfW)).clone().addScaledVector(lh?lh.normal:n,lift);
    const right=(rh?rh.point:g.point.clone().addScaledVector(side,halfW)).clone().addScaledVector(rh?rh.normal:n,lift);
    const mid=left.clone().lerp(right,.5);
    let nn=(lh?.normal||n).clone().lerp(rh?.normal||n,.5);if(nn.lengthSq()<1e-8)nn=n.clone();nn.normalize();
    out.push({...g,finalPoint:mid,normal:nn,stripLeft:left,stripRight:right});
  }
  if(out.length>=2){
    const fix=(g,next,node)=>{
      const center=visibleEndpoint(node,next.finalPoint),halfW=Math.max(.0003,s.widthMM*.0037*.5);
      let side=g.stripRight.clone().sub(g.stripLeft);if(side.lengthSq()<1e-8)side=strapFrame(s).side.clone();side.normalize();
      g.finalPoint=center;g.stripLeft=center.clone().addScaledVector(side,-halfW);g.stripRight=center.clone().addScaledVector(side,halfW);
    };
    fix(out[0],out[1],nodes.get(s.a));
    fix(out[out.length-1],out[out.length-2],nodes.get(s.b));
  }
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
function clearStrapMethodDebug(s){
  if(!s?.controlGroup)return;
  while(s.controlGroup.children.length){const o=s.controlGroup.children.pop();o.geometry?.dispose?.();o.material?.dispose?.()}
}
function updateStrapMethodDebug(s,route){
  clearStrapMethodDebug(s);if(!s?.debugRoute||!route?.length)return;
  const line=(getter,opacity)=>{
    const pos=[];for(const g of route){const p=getter(g);if(p)pos.push(p.x,p.y,p.z)}
    if(pos.length<6)return;const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
    const mat=new THREE.LineBasicMaterial({color:0x00d8ff,transparent:true,opacity,depthWrite:false});const l=new THREE.Line(geo,mat);l.renderOrder=20;s.controlGroup.add(l);
  };
  line(g=>g.finalPoint||g.displayPoint,.95);line(g=>g.stripLeft||g.leftDisplay,.40);line(g=>g.stripRight||g.rightDisplay,.40);
  const pts=[],every=Math.max(1,Math.ceil(route.length/14));for(let i=0;i<route.length;i+=every){const p=route[i].finalPoint||route[i].displayPoint;pts.push(p.x,p.y,p.z)}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pts,3));
  const mat=new THREE.PointsMaterial({color:0x00d8ff,size:4,sizeAttenuation:false,depthWrite:false});s.controlGroup.add(new THREE.Points(geo,mat));
}
function rebuildAutoProjection(s){
  if(!s)return;s.autoProject=true;s.autoMethod='strip';s.previewMode=false;
  const lift=waypointBaseLiftForStrap(s);let samples=projectedChordSamplesStrip(s,{lift});
  if(samples.length<3){updateStrapGeometry(s);return}
  samples=refineProjectedGuide(s,samples,lift,2);
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

