
HD.Straps={
  root:new THREE.Group(),debugRoot:new THREE.Group(),
  mat:null,sel:null,
  init(scene){
    this.mat=new THREE.MeshStandardMaterial({color:0x171718,roughness:.58,side:THREE.DoubleSide});
    this.sel=new THREE.MeshStandardMaterial({color:0x00d8ff,roughness:.5,side:THREE.DoubleSide,emissive:0x004c5e,emissiveIntensity:.5});
    scene.add(this.root,this.debugRoot);
  },
  create(data={}){
    if(!HD.State.nodes.has(data.a)||!HD.State.nodes.has(data.b)||data.a===data.b)return null;
    const id=data.id||HD.makeId("strap");
    const s={id,kind:"strap",a:data.a,b:data.b,widthMM:data.widthMM??20,locked:!!data.locked,
      mirrorId:data.mirrorId||null,previousPartnerId:data.previousPartnerId||null,
      deletedTs:data.deletedTs||[],route:[],mesh:new THREE.Mesh(new THREE.BufferGeometry(),this.mat),debug:!!data.debug};
    s.mesh.userData={kind:"strap",id};s.mesh.renderOrder=5;HD.State.straps.set(id,s);this.root.add(s.mesh);this.rebuild(s);return s;
  },
  pair(s){return s?.mirrorId?HD.State.straps.get(s.mirrorId)||null:null},
  frame(s){
    const A=HD.G.nodePos(HD.State.nodes.get(s.a)),B=HD.G.nodePos(HD.State.nodes.get(s.b));
    const tangent=B.clone().sub(A).normalize();
    let normal=HD.G.nodeNormal(HD.State.nodes.get(s.a)).add(HD.G.nodeNormal(HD.State.nodes.get(s.b))).normalize();
    normal.addScaledVector(tangent,-normal.dot(tangent));if(normal.lengthSq()<1e-8)normal.set(0,0,1);normal.normalize();
    let side=new THREE.Vector3().crossVectors(normal,tangent).normalize();
    return {A,B,tangent,normal,side,length:A.distanceTo(B)};
  },
  projectPoint(s,t){
    const f=this.frame(s),candidate=f.A.clone().lerp(f.B,t);
    let preferred=HD.G.nodeNormal(HD.State.nodes.get(s.a)).lerp(HD.G.nodeNormal(HD.State.nodes.get(s.b)),t).normalize();
    let best=null,score=Infinity;
    for(const sign of [1,-1]){
      HD.App.raycaster.set(candidate.clone().addScaledVector(preferred,sign*1.5),preferred.clone().multiplyScalar(-sign));
      const hits=HD.App.raycaster.intersectObjects(HD.Body.meshes,true);
      for(const h of hits.slice(0,4)){
        const n=HD.G.worldNormalFromHit(h),sc=h.point.distanceTo(candidate)+(1-Math.max(0,n.dot(preferred)))*.08;
        if(sc<score){score=sc;best={t,point:h.point.clone(),normal:n}}
      }
    }return best;
  },
  rebuild(s,{preview=false}={}){
    const a=HD.State.nodes.get(s.a),b=HD.State.nodes.get(s.b);if(!a||!b)return;
    if(preview){
      const f=this.frame(s),curve=new THREE.QuadraticBezierCurve3(f.A,f.A.clone().lerp(f.B,.5).addScaledVector(f.normal,.015),f.B);
      this.renderCurve(s,Array.from({length:14},(_,i)=>({t:i/13,point:curve.getPoint(i/13),normal:f.normal.clone()})));
      return;
    }
    const f=this.frame(s);
    const count=THREE.MathUtils.clamp(Math.ceil(f.length*HD.CFG.strapSamplesPerMeter),HD.CFG.strapMinSamples,HD.CFG.strapMaxSamples);
    const center=[];
    for(let i=0;i<=count;i++){const q=this.projectPoint(s,i/count);if(q)center.push(q)}
    if(center.length<2)return this.rebuild(s,{preview:true});

    let prevSide=null;const halfW=HD.mm(s.widthMM)*.5,lift=HD.mm(HD.State.surfaceOffsetMM);
    const route=[];
    for(let i=0;i<center.length;i++){
      const g=center[i],pp=center[Math.max(0,i-1)].point,pn=center[Math.min(center.length-1,i+1)].point;
      let tan=pn.clone().sub(pp).normalize(),n=g.normal.clone();n.addScaledVector(tan,-n.dot(tan));if(n.lengthSq()<1e-8)n=f.normal.clone();n.normalize();
      let side=new THREE.Vector3().crossVectors(n,tan);if(side.lengthSq()<1e-8)side=prevSide?.clone()||f.side.clone();side.normalize();
      if(prevSide&&side.dot(prevSide)<0)side.negate();prevSide=side.clone();
      const castEdge=(candidate)=>{
        let best=null,bd=Infinity;
        for(const sign of [1,-1]){
          HD.App.raycaster.set(candidate.clone().addScaledVector(n,sign*1.1),n.clone().multiplyScalar(-sign));
          for(const h of HD.App.raycaster.intersectObjects(HD.Body.meshes,true).slice(0,3)){
            const d=h.point.distanceTo(candidate);if(d<bd){bd=d;best={p:h.point.clone(),n:HD.G.worldNormalFromHit(h)}}
          }
        }return best;
      };
      const lh=castEdge(g.point.clone().addScaledVector(side,-halfW)),rh=castEdge(g.point.clone().addScaledVector(side,halfW));
      const left=(lh?.p||g.point.clone().addScaledVector(side,-halfW)).addScaledVector(lh?.n||n,lift);
      const right=(rh?.p||g.point.clone().addScaledVector(side,halfW)).addScaledVector(rh?.n||n,lift);
      route.push({t:g.t,left,right,normal:(lh?.n||n).clone().lerp(rh?.n||n,.5).normalize(),point:left.clone().lerp(right,.5)});
    }
    // endpoint at ring circumference
    const fix=(r,node,next)=>{
      if(!node.ringVisible)return;
      const c=HD.G.nodePos(node),nn=HD.G.nodeNormal(node);
      let d=next.point.clone().sub(c);d.addScaledVector(nn,-d.dot(nn));if(d.lengthSq()<1e-8)return;d.normalize();
      const center=c.clone().addScaledVector(d,HD.G.ringMajor(node));
      const side=r.right.clone().sub(r.left).normalize();
      r.left=center.clone().addScaledVector(side,-halfW);r.right=center.clone().addScaledVector(side,halfW);r.point=center;
    };
    if(route.length>1){fix(route[0],a,route[1]);fix(route[route.length-1],b,route[route.length-2])}
    s.route=route;this.renderRoute(s);this.refreshDebug(s);
  },
  renderCurve(s,samples){
    const f=this.frame(s),halfW=HD.mm(s.widthMM)*.5,pos=[];
    for(let i=0;i<samples.length;i++){
      const g=samples[i],pp=samples[Math.max(0,i-1)].point,pn=samples[Math.min(samples.length-1,i+1)].point;
      let tan=pn.clone().sub(pp).normalize(),n=g.normal.clone(),side=new THREE.Vector3().crossVectors(n,tan).normalize();
      const l=g.point.clone().addScaledVector(side,-halfW),r=g.point.clone().addScaledVector(side,halfW);
      pos.push(l.x,l.y,l.z,r.x,r.y,r.z);
    }
    this.geometryFromPairs(s,pos);
  },
  renderRoute(s){
    const pos=[];for(const r of s.route)pos.push(r.left.x,r.left.y,r.left.z,r.right.x,r.right.y,r.right.z);
    this.geometryFromPairs(s,pos);
  },
  geometryFromPairs(s,pos){
    const count=pos.length/6,idx=[];
    for(let i=0;i<count-1;i++){const a=i*2,b=a+2;idx.push(a,a+1,b,a+1,b+1,b)}
    const g=new THREE.BufferGeometry();g.setAttribute("position",new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();g.computeBoundingSphere();
    s.mesh.geometry.dispose();s.mesh.geometry=g;this.refreshMaterial(s);
  },
  refreshMaterial(s){s.mesh.material=(HD.State.selected?.kind==="strap"&&HD.State.selected.id===s.id)?this.sel:this.mat},
  refreshAll(){for(const s of HD.State.straps.values()){this.refreshMaterial(s);this.refreshDebug(s)}},
  remove(id){const s=HD.State.straps.get(id);if(!s)return;s.mesh.geometry.dispose();this.root.remove(s.mesh);HD.State.straps.delete(id)},
  remapNode(from,to){
    for(const s of [...HD.State.straps.values()]){
      if(s.a===from)s.a=to;if(s.b===from)s.b=to;
      if(s.a===s.b)this.remove(s.id);else this.rebuild(s);
    }
  },
  topologyForNode(nodeId){return [...HD.State.straps.values()].filter(s=>s.a===nodeId||s.b===nodeId).map(s=>HD.History.strapData(s))},
  restoreTopology(list,hostId,guestId){
    for(const d of list||[]){
      if(HD.State.straps.has(d.id))this.remove(d.id);
      const a=d.a===hostId?guestId:d.a,b=d.b===hostId?guestId:d.b;
      if(a!==b&&HD.State.nodes.has(a)&&HD.State.nodes.has(b))this.create({...d,a,b});
    }
  },
  refreshDebug(s){
    for(const o of [...this.debugRoot.children])if(o.userData.strapId===s.id){o.geometry.dispose();this.debugRoot.remove(o)}
    if(!s.debug||!s.route.length)return;
    const mk=(points,opacity)=>{
      const g=new THREE.BufferGeometry().setFromPoints(points),m=new THREE.LineBasicMaterial({color:0x00d8ff,opacity,transparent:true,depthWrite:false}),l=new THREE.Line(g,m);
      l.userData.strapId=s.id;this.debugRoot.add(l);
    };
    mk(s.route.map(x=>x.point),1);mk(s.route.map(x=>x.left),.45);mk(s.route.map(x=>x.right),.45);
  }
};
