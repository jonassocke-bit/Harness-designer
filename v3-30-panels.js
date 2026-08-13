function normalizePanelSlots(data){
  if(Array.isArray(data?.boundarySlots)&&data.boundarySlots.length){
    return historyClone(data.boundarySlots).map(s=>({
      currentId:s.currentId,
      mergeStack:Array.isArray(s.mergeStack)?historyClone(s.mergeStack):[]
    }));
  }
  return (data?.nodeIds||[]).map(id=>({currentId:id,mergeStack:[]}));
}
function panelCurrentIds(panel,{unique=true}={}){
  const raw=panel.boundarySlots.map(s=>s.currentId).filter(id=>nodes.has(id));
  if(!unique)return raw;

  // Collapse coincident logical slots only for rendering. The logical slots
  // themselves stay intact so an Entmerge can restore the original boundary.
  const out=[];
  for(const id of raw){
    if(out[out.length-1]!==id)out.push(id);
  }
  if(out.length>1&&out[0]===out[out.length-1])out.pop();

  const seen=new Set(),uniqueIds=[];
  for(const id of out)if(!seen.has(id)){seen.add(id);uniqueIds.push(id)}
  return uniqueIds;
}
function syncPanelNodeIds(panel){
  panel.nodeIds=panelCurrentIds(panel,{unique:true});
}
function panelBoundaryWorld(panel){
  syncPanelNodeIds(panel);
  return panel.nodeIds.map(id=>nodes.get(id)).filter(Boolean).map(nodeWorldPosition);
}
function panelAverageNormal(panel){
  const ids=panelCurrentIds(panel,{unique:true});
  const ns=ids.map(id=>nodes.get(id)).filter(Boolean).map(nodeWorldNormal);
  const n=new THREE.Vector3();
  for(const x of ns)n.add(x);
  if(n.lengthSq()<1e-8)n.set(0,0,1);
  return n.normalize();
}
function panelBasis(panel){
  const pts=panelBoundaryWorld(panel);
  const origin=pts.reduce((a,p)=>a.add(p),new THREE.Vector3()).multiplyScalar(1/Math.max(pts.length,1));
  let normal=panelAverageNormal(panel);
  let u=pts.length>1?pts[1].clone().sub(pts[0]):new THREE.Vector3(1,0,0);
  u.addScaledVector(normal,-u.dot(normal));
  if(u.lengthSq()<1e-8)u=new THREE.Vector3(1,0,0).addScaledVector(normal,-normal.x);
  u.normalize();
  const v=new THREE.Vector3().crossVectors(normal,u).normalize();
  return {origin,normal,u,v};
}
function panel2D(panel,world,basis=panelBasis(panel)){
  const d=world.clone().sub(basis.origin);
  return new THREE.Vector2(d.dot(basis.u),d.dot(basis.v));
}
function pointInPoly2(p,poly){
  let inside=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const a=poly[i],b=poly[j];
    if(((a.y>p.y)!=(b.y>p.y))&&(p.x<(b.x-a.x)*(p.y-a.y)/((b.y-a.y)||1e-9)+a.x))inside=!inside;
  }
  return inside;
}
function panelSurfacePoint(candidate,preferredNormal){
  const n=preferredNormal.clone().normalize();
  let best=null,bestScore=Infinity;

  // Small panels are best solved along their own local normal. Unlike the
  // generic nearest-surface search this cannot jump sideways onto a breast,
  // arm or the opposite side of the torso.
  for(const sign of [1,-1]){
    const origin=candidate.clone().addScaledVector(n,sign*1.25);
    const dir=n.clone().multiplyScalar(-sign);
    raycaster.set(origin,dir);
    const hits=raycaster.intersectObjects(bodyMeshes,true);

    for(const h of hits.slice(0,6)){
      const normal=worldNormal(h);
      const dist=h.point.distanceTo(candidate);
      const alignment=Math.abs(normal.dot(n));
      const score=dist+(1-alignment)*.08;
      if(score<bestScore){
        bestScore=score;
        best={point:h.point.clone(),normal};
      }
    }
  }
  return best||{point:candidate.clone(),normal:n};
}
function panelOffsetScene(panel){
  return Math.max(0,Number(panel.offsetMM??panelDefaults.offsetMM))*0.0037;
}
function panelHasArea(panel){
  const boundary=panelBoundaryWorld(panel);
  if(boundary.length<3)return false;
  const basis=panelBasis(panel);
  const poly=boundary.map(p=>panel2D(panel,p,basis));
  let area=0;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++)area+=poly[j].x*poly[i].y-poly[i].x*poly[j].y;
  return Math.abs(area)*.5>0.00012;
}
function panelCutRings(panel){
  return panelCurrentIds(panel,{unique:true})
    .map(id=>nodes.get(id))
    .filter(n=>n?.ringVisible)
    .map(n=>({p:nodeWorldPosition(n),r:ringMajor(n)+ringTube(n)*1.35}));
}
function buildPanelPreviewGeometry(panel){
  if(!panelHasArea(panel))return new THREE.BufferGeometry();
  const boundary=panelBoundaryWorld(panel);
  const basis=panelBasis(panel);
  const contour=boundary.map(p=>panel2D(panel,p,basis));
  const tris=THREE.ShapeUtils.triangulateShape(contour,[]);
  const positions=[],normals=[];
  const lift=panelOffsetScene(panel);
  for(const tri of tris){
    for(const idx of tri){
      const p=boundary[idx].clone().addScaledVector(basis.normal,lift);
      positions.push(p.x,p.y,p.z);
      normals.push(basis.normal.x,basis.normal.y,basis.normal.z);
    }
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
  g.computeBoundingSphere();
  return g;
}

function bodyVertexWorld(mesh,index,out=new THREE.Vector3()){
  // THREE.Mesh.getVertexPosition includes morphTargetInfluences when available.
  if(typeof mesh.getVertexPosition==='function')mesh.getVertexPosition(index,out);
  else out.fromBufferAttribute(mesh.geometry.attributes.position,index);
  return out.applyMatrix4(mesh.matrixWorld);
}
function bodyVertexNormalWorld(mesh,index,out=new THREE.Vector3()){
  const na=mesh.geometry.attributes.normal;
  if(na)out.fromBufferAttribute(na,index);
  else out.set(0,0,1);
  return out.applyMatrix3(new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld)).normalize();
}
function panelPlaneDistance(p,basis){
  return Math.abs(p.clone().sub(basis.origin).dot(basis.normal));
}
function pointSegmentDistance2(p,a,b){
  const abx=b.x-a.x,aby=b.y-a.y;
  const den=abx*abx+aby*aby||1e-12;
  const t=THREE.MathUtils.clamp(((p.x-a.x)*abx+(p.y-a.y)*aby)/den,0,1);
  const x=a.x+abx*t,y=a.y+aby*t;
  return Math.hypot(p.x-x,p.y-y);
}
function panelPolygonMargin2(p,poly){
  let d=Infinity;
  for(let i=0;i<poly.length;i++)d=Math.min(d,pointSegmentDistance2(p,poly[i],poly[(i+1)%poly.length]));
  return d;
}
function extractBodyTrianglesForPanel(panel){
  const boundary=panelBoundaryWorld(panel);
  if(boundary.length<3)return [];

  const basis=panelBasis(panel);
  const poly=boundary.map(p=>panel2D(panel,p,basis));
  const boundaryTris=THREE.ShapeUtils.triangulateShape(poly,[]);
  const cutRings=panelCutRings(panel);

  let boundaryDepth=0;
  for(const p of boundary)boundaryDepth=Math.max(boundaryDepth,panelPlaneDistance(p,basis));
  const slab=Math.max(.10,boundaryDepth+.24);

  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(const p of poly){
    minX=Math.min(minX,p.x); minY=Math.min(minY,p.y);
    maxX=Math.max(maxX,p.x); maxY=Math.max(maxY,p.y);
  }

  const result=[];
  const va=new THREE.Vector3(),vb=new THREE.Vector3(),vc=new THREE.Vector3();
  const na=new THREE.Vector3(),nb=new THREE.Vector3(),nc=new THREE.Vector3();

  for(const mesh of bodyMeshes){
    if(!mesh || !mesh.geometry || !mesh.geometry.attributes || !mesh.geometry.attributes.position)continue;
    mesh.updateMatrixWorld(true);

    const g=mesh.geometry;
    const idx=g.index ? g.index.array : null;
    const triCount=idx ? Math.floor(idx.length/3) : Math.floor(g.attributes.position.count/3);

    for(let ti=0;ti<triCount;ti++){
      const ia=idx?idx[ti*3]:ti*3;
      const ib=idx?idx[ti*3+1]:ti*3+1;
      const ic=idx?idx[ti*3+2]:ti*3+2;

      bodyVertexWorld(mesh,ia,va);
      bodyVertexWorld(mesh,ib,vb);
      bodyVertexWorld(mesh,ic,vc);

      const centroid=va.clone().add(vb).add(vc).multiplyScalar(1/3);
      if(panelPlaneDistance(centroid,basis)>slab)continue;

      bodyVertexNormalWorld(mesh,ia,na);
      bodyVertexNormalWorld(mesh,ib,nb);
      bodyVertexNormalWorld(mesh,ic,nc);

      let avgN=na.clone().add(nb).add(nc);
      if(avgN.lengthSq()<1e-8)avgN=basis.normal.clone();
      avgN.normalize();
      if(avgN.dot(basis.normal)<-.18)continue;

      const tri2=[
        panel2D(panel,va,basis),
        panel2D(panel,vb,basis),
        panel2D(panel,vc,basis)
      ];

      let tMinX=Infinity,tMinY=Infinity,tMaxX=-Infinity,tMaxY=-Infinity;
      for(const p of tri2){
        tMinX=Math.min(tMinX,p.x); tMinY=Math.min(tMinY,p.y);
        tMaxX=Math.max(tMaxX,p.x); tMaxY=Math.max(tMaxY,p.y);
      }
      if(tMaxX<minX || tMinX>maxX || tMaxY<minY || tMinY>maxY)continue;

      // Retain every mannequin triangle that has a genuine area overlap with
      // the requested panel, even if the triangle centroid lies outside it.
      let overlaps=false;
      for(const bt of boundaryTris){
        const clipTri=[poly[bt[0]],poly[bt[1]],poly[bt[2]]];
        if(clipTriangleToTriangle(tri2,clipTri).length>=3){
          overlaps=true;
          break;
        }
      }
      if(!overlaps)continue;

      if(cutRings.some(r=>centroid.distanceTo(r.p)<r.r))continue;

      result.push({
        p:[va.clone(),vb.clone(),vc.clone()],
        n:[na.clone(),nb.clone(),nc.clone()],
        centroid:centroid.clone(),
        margin:panelPolygonMargin2(panel2D(panel,centroid,basis),poly)
      });
    }
  }
  return result;
}

function signedArea2(poly){
  let a=0;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    a+=poly[j].x*poly[i].y-poly[i].x*poly[j].y;
  }
  return a*.5;
}
function clipPolyAgainstEdge(poly,a,b,keepLeft=true){
  const out=[];
  if(!poly.length)return out;

  const cross=(p)=>(b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x);
  const inside=(p)=>keepLeft?cross(p)>=-1e-9:cross(p)<=1e-9;

  for(let i=0;i<poly.length;i++){
    const cur=poly[i],prev=poly[(i+poly.length-1)%poly.length];
    const curIn=inside(cur),prevIn=inside(prev);

    if(curIn!==prevIn){
      const dx=cur.x-prev.x,dy=cur.y-prev.y;
      const ex=b.x-a.x,ey=b.y-a.y;
      const den=dx*ey-dy*ex;

      if(Math.abs(den)>1e-12){
        const t=((a.x-prev.x)*ey-(a.y-prev.y)*ex)/den;
        out.push({
          x:prev.x+dx*t,
          y:prev.y+dy*t
        });
      }
    }
    if(curIn)out.push({x:cur.x,y:cur.y});
  }
  return out;
}
function clipTriangleToTriangle(subject,clipTri){
  let poly=subject.map(p=>({x:p.x,y:p.y}));
  const keepLeft=signedArea2(clipTri)>=0;

  for(let i=0;i<3&&poly.length>=3;i++){
    poly=clipPolyAgainstEdge(
      poly,
      clipTri[i],
      clipTri[(i+1)%3],
      keepLeft
    );
  }
  return poly;
}
function barycentric2D(p,a,b,c){
  const v0x=b.x-a.x,v0y=b.y-a.y;
  const v1x=c.x-a.x,v1y=c.y-a.y;
  const v2x=p.x-a.x,v2y=p.y-a.y;
  const den=v0x*v1y-v1x*v0y;

  if(Math.abs(den)<1e-12)return {u:1,v:0,w:0};

  const v=(v2x*v1y-v1x*v2y)/den;
  const w=(v0x*v2y-v2x*v0y)/den;
  const u=1-v-w;
  return {u,v,w};
}
function interpolateBodyTriPoint(tri,p2,basis,panel){
  const a2=panel2D(panel,tri.p[0],basis);
  const b2=panel2D(panel,tri.p[1],basis);
  const c2=panel2D(panel,tri.p[2],basis);
  const bc=barycentric2D(p2,a2,b2,c2);

  const q=tri.p[0].clone().multiplyScalar(bc.u)
    .addScaledVector(tri.p[1],bc.v)
    .addScaledVector(tri.p[2],bc.w);

  let n=tri.n[0].clone().multiplyScalar(bc.u)
    .addScaledVector(tri.n[1],bc.v)
    .addScaledVector(tri.n[2],bc.w);

  if(n.lengthSq()<1e-10)n=tri.n[0].clone();
  n.normalize();
  return {q,n};
}
function clippedPanelPieces(panel,extracted){
  const boundary=panelBoundaryWorld(panel);
  const basis=panelBasis(panel);
  const contour=boundary.map(p=>panel2D(panel,p,basis));
  const boundaryTris=THREE.ShapeUtils.triangulateShape(contour,[]);
  const pieces=[];

  for(const tri of extracted){
    const subject=tri.p.map(p=>panel2D(panel,p,basis));

    for(const bt of boundaryTris){
      const clipTri=bt.map(i=>contour[i]);
      const clipped=clipTriangleToTriangle(subject,clipTri);
      if(clipped.length<3)continue;

      // Fan triangulation is valid here because clipping a triangle against
      // another triangle always produces a convex polygon.
      for(let i=1;i<clipped.length-1;i++){
        pieces.push([
          interpolateBodyTriPoint(tri,clipped[0],basis,panel),
          interpolateBodyTriPoint(tri,clipped[i],basis,panel),
          interpolateBodyTriPoint(tri,clipped[i+1],basis,panel)
        ]);
      }
    }
  }
  return pieces;
}
function buildPanelGeometry(panel){
  if(!panelHasArea(panel))return new THREE.BufferGeometry();

  const extracted=extractBodyTrianglesForPanel(panel);
  if(!extracted.length)return buildPanelPreviewGeometry(panel);

  // Only boundary triangles are cut. Interior body triangles pass through
  // unchanged in practice; all resulting vertices still lie exactly on the
  // original mannequin triangles via barycentric interpolation.
  const pieces=clippedPanelPieces(panel,extracted);
  if(!pieces.length)return buildPanelPreviewGeometry(panel);

  const positions=[],normals=[];
  const lift=panelOffsetScene(panel);

  for(const tri of pieces){
    const centroid=tri[0].q.clone().add(tri[1].q).add(tri[2].q).multiplyScalar(1/3);

    // Keep the existing simple ring opening behaviour for this test.
    // Outer panel boundary is now exact; ring-hole clipping can be the next
    // isolated refinement if needed.
    const cutRings=panelCutRings(panel);
    if(cutRings.some(r=>centroid.distanceTo(r.p)<r.r))continue;

    for(const v of tri){
      const q=v.q.clone().addScaledVector(v.n,lift);
      positions.push(q.x,q.y,q.z);
      normals.push(v.n.x,v.n.y,v.n.z);
    }
  }

  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
  g.computeBoundingSphere();
  g.userData={
    extraction:true,
    cleanBoundary:true,
    sourceTriangles:extracted.length,
    outputTriangles:positions.length/9
  };
  return g;
}
function makePanel(data={}){
  const id=data.id||`P${nextPanelId++}`;
  const num=Number(id.replace(/\D/g,''));if(Number.isFinite(num))nextPanelId=Math.max(nextPanelId,num+1);

  const panel={
    id,kind:'panel',
    boundarySlots:normalizePanelSlots(data),
    nodeIds:[],
    offsetMM:data.offsetMM??panelDefaults.offsetMM,
    mirrorId:data.mirrorId||null,
    locked:!!data.locked,
    previousPartnerId:data.previousPartnerId||null,
    manualUnlinked:!!data.manualUnlinked,
    group:new THREE.Group(),mesh:null
  };
  syncPanelNodeIds(panel);

  panel.mesh=new THREE.Mesh(buildPanelGeometry(panel),selected?.id===id?PANEL_SEL:PANEL_MAT);
  panel.mesh.userData={kind:'panelMesh',id};
  panel.mesh.renderOrder=1;
  panel.group.add(panel.mesh);
  panelRoot.add(panel.group);
  panels.set(id,panel);
  return panel;
}
function updatePanelGeometry(panel,{preview=false}={}){
  if(!panel)return;
  syncPanelNodeIds(panel);
  const old=panel.mesh.geometry;
  panel.mesh.geometry=preview?buildPanelPreviewGeometry(panel):buildPanelGeometry(panel);
  old?.dispose?.();
  panel.mesh.visible=panel.nodeIds.length>=3&&panelHasArea(panel);
}
function updatePanelsForNode(nodeId,{preview=true}={}){
  for(const p of panels.values()){
    if(!p.boundarySlots.some(s=>s.currentId===nodeId))continue;
    if(preview){
      panelDirty.add(p.id);
      updatePanelGeometry(p,{preview:true});
    }else{
      updatePanelGeometry(p);
    }
  }
}
function finalizeDirtyPanels(){
  if(!panelDirty.size)return;
  const ids=[...panelDirty];
  panelDirty.clear();
  requestAnimationFrame(()=>{
    for(const id of ids){
      const p=panels.get(id);
      if(p)updatePanelGeometry(p);
    }
  });
}

function captureGenericPanelMergeState(guest,host){
  const out=[];
  for(const panel of panels.values()){
    const slots=[];
    panel.boundarySlots.forEach((slot,index)=>{
      if(slot.currentId===guest.id||slot.currentId===host.id){
        slots.push({
          index,
          currentId:slot.currentId,
          mergeStack:historyClone(slot.mergeStack||[])
        });
      }
    });
    if(slots.length)out.push({panelId:panel.id,slots});
  }
  return out;
}
function applyGenericPanelMerge(guest,host,snapshot){
  const snapByPanel=new Map((snapshot||[]).map(x=>[x.panelId,x]));
  for(const panel of panels.values()){
    const rec=snapByPanel.get(panel.id);
    if(!rec)continue;
    let touched=false;
    for(const item of rec.slots){
      const slot=panel.boundarySlots[item.index];
      if(!slot)continue;
      slot.currentId=host.id;
      // Keep a breadcrumb for debug/history, but restoration uses the exact snapshot.
      slot.mergeStack=historyClone(item.mergeStack||[]);
      slot.mergeStack.push({mergedId:host.id,branch:item.currentId===guest.id?'guest':'host',generic:true});
      touched=true;
    }
    if(touched){
      syncPanelNodeIds(panel);
      panelDirty.add(panel.id);
      updatePanelGeometry(panel,{preview:true});
    }
  }
}
function restoreGenericPanelMerge(snapshot){
  for(const rec of snapshot||[]){
    const panel=panels.get(rec.panelId);
    if(!panel)continue;
    let touched=false;
    for(const item of rec.slots||[]){
      const slot=panel.boundarySlots[item.index];
      if(!slot)continue;
      slot.currentId=item.currentId;
      slot.mergeStack=historyClone(item.mergeStack||[]);
      touched=true;
    }
    if(touched){
      syncPanelNodeIds(panel);
      panelDirty.add(panel.id);
      updatePanelGeometry(panel,{preview:true});
    }
  }
}
function finalizeGenericPanelMerge(snapshot,guestId,hostId){
  for(const rec of snapshot||[]){
    const panel=panels.get(rec.panelId);
    if(!panel)continue;
    let touched=false;
    for(const item of rec.slots||[]){
      const slot=panel.boundarySlots[item.index];
      if(!slot)continue;
      // Permanent merge: every former guest/host occurrence now genuinely belongs to host.
      slot.currentId=hostId;
      slot.mergeStack=historyClone(item.mergeStack||[]);
      touched=true;
    }
    if(touched){
      syncPanelNodeIds(panel);
      panelDirty.add(panel.id);
      updatePanelGeometry(panel,{preview:true});
    }
  }
}

function panelHandleNodeMerge(left,right,merged){
  for(const panel of panels.values()){
    let touched=false;
    for(const slot of panel.boundarySlots){
      if(slot.currentId===left.id){
        slot.mergeStack.push({mergedId:merged.id,branch:'left'});
        slot.currentId=merged.id;touched=true;
      }else if(slot.currentId===right.id){
        slot.mergeStack.push({mergedId:merged.id,branch:'right'});
        slot.currentId=merged.id;touched=true;
      }
    }
    if(touched){
      syncPanelNodeIds(panel);
      panelDirty.add(panel.id);
      updatePanelGeometry(panel,{preview:true});
    }
  }
}
function panelHandleNodeEntmerge(merged,left,right){
  for(const panel of panels.values()){
    let touched=false;
    for(const slot of panel.boundarySlots){
      if(slot.currentId!==merged.id)continue;
      const rec=slot.mergeStack[slot.mergeStack.length-1];
      if(!rec||rec.mergedId!==merged.id)continue;
      slot.mergeStack.pop();
      slot.currentId=rec.branch==='left'?left.id:right.id;
      touched=true;
    }
    if(touched){
      syncPanelNodeIds(panel);
      panelDirty.add(panel.id);
      updatePanelGeometry(panel,{preview:true});
    }
  }
}
function removePanel(id){
  const p=panels.get(id);if(!p)return;
  p.mesh.geometry?.dispose?.();
  panelRoot.remove(p.group);
  panels.delete(id);
  panelDirty.delete(id);
}
function pairOfPanel(p){return p?.mirrorId&&panels.has(p.mirrorId)?panels.get(p.mirrorId):null}
function mirrorPanelFrom(panel){
  if(!panel)return null;

  const mirroredSlots=[];
  for(const slot of panel.boundarySlots){
    const n=nodes.get(slot.currentId);
    if(!n)return null;

    let mid=slot.currentId;
    if(Math.abs(nodeWorldPosition(n).x)>=AXIS_SNAP_IN){
      const m=pairOfNode(n);
      if(!m)return null;
      mid=m.id;
    }
    mirroredSlots.push({currentId:mid,mergeStack:[]});
  }

  const mirroredIds=mirroredSlots.map(s=>s.currentId);
  if(mirroredIds.every((x,i)=>x===panel.boundarySlots[i]?.currentId))return null;

  const existing=[...panels.values()].find(p=>{
    const ids=p.boundarySlots.map(s=>s.currentId);
    return p!==panel&&ids.length===mirroredIds.length&&ids.every((id,i)=>id===mirroredIds[i]);
  });
  if(existing){
    panel.mirrorId=existing.id;existing.mirrorId=panel.id;return existing;
  }

  const m=makePanel({
    boundarySlots:mirroredSlots,
    offsetMM:panel.offsetMM
  });
  panel.mirrorId=m.id;m.mirrorId=panel.id;
  return m;
}
function panelHit(x,y){
  if(!panels.size)return null;
  setPointer(x,y);
  const bh=raycaster.intersectObjects(bodyMeshes,true)[0]?.distance??Infinity;
  setPointer(x,y);
  const hits=raycaster.intersectObjects([...panels.values()].filter(p=>p.mesh.visible).map(p=>p.mesh),false);
  for(const h of hits)if(h.distance<=bh+.08)return {kind:'panel',id:h.object.userData.id};
  return null;
}
function updateAllPanels(){
  panelDirty.clear();
  for(const p of panels.values())updatePanelGeometry(p);
}


const STRAP_SAMPLES=18;
