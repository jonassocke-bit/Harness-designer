
HD.Panels={
  root:new THREE.Group(),mat:null,sel:null,
  init(scene){
    this.mat=new THREE.MeshStandardMaterial({color:0x202124,roughness:.68,side:THREE.DoubleSide,transparent:true,opacity:.94});
    this.sel=new THREE.MeshStandardMaterial({color:0x00d8ff,roughness:.6,side:THREE.DoubleSide,transparent:true,opacity:.86,emissive:0x00566a,emissiveIntensity:.5});
    scene.add(this.root);
  },
  create(data={}){
    const ids=(data.boundarySlots||data.nodeIds||[]).filter(id=>HD.State.nodes.has(id));
    if(new Set(ids).size<3)return null;
    const id=data.id||HD.makeId("panel"),p={id,kind:"panel",boundarySlots:[...ids],offsetMM:data.offsetMM??HD.CFG.panelDefaultOffsetMM,locked:!!data.locked,mesh:new THREE.Mesh(new THREE.BufferGeometry(),this.mat)};
    p.mesh.userData={kind:"panel",id};p.mesh.renderOrder=1;HD.State.panels.set(id,p);this.root.add(p.mesh);this.rebuild(p);return p;
  },
  boundary(p){return p.boundarySlots.map(id=>HD.State.nodes.get(id)).filter(Boolean).map(HD.G.nodePos)},
  avgNormal(p){const n=new THREE.Vector3();for(const id of p.boundarySlots){const q=HD.State.nodes.get(id);if(q)n.add(HD.G.nodeNormal(q))}if(n.lengthSq()<1e-8)n.set(0,0,1);return n.normalize()},
  rebuild(p,{preview=false}={}){
    const boundary=this.boundary(p);if(boundary.length<3){p.mesh.visible=false;return}
    p.mesh.visible=true;
    if(preview){
      const basis=HD.G.poly2D(boundary,this.avgNormal(p)),contour=boundary.map(basis.to2),tris=THREE.ShapeUtils.triangulateShape(contour,[]),pos=[];
      for(const t of tris)for(const i of t){const q=boundary[i].clone().addScaledVector(basis.n,HD.mm(p.offsetMM));pos.push(q.x,q.y,q.z)}
      return this.setGeometry(p,pos);
    }
    const basis=HD.G.poly2D(boundary,this.avgNormal(p)),contour=boundary.map(basis.to2),btris=THREE.ShapeUtils.triangulateShape(contour,[]);
    let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
    for(const q of contour){minX=Math.min(minX,q.x);minY=Math.min(minY,q.y);maxX=Math.max(maxX,q.x);maxY=Math.max(maxY,q.y)}
    const positions=[],va=new THREE.Vector3(),vb=new THREE.Vector3(),vc=new THREE.Vector3(),na=new THREE.Vector3(),nb=new THREE.Vector3(),nc=new THREE.Vector3();
    const pointInTri=(pt,a,b,c)=>{
      const bc=HD.G.bary2(pt,a,b,c);return bc.u>=-1e-7&&bc.v>=-1e-7&&bc.w>=-1e-7;
    };
    for(const mesh of HD.Body.meshes){
      mesh.updateMatrixWorld(true);const g=mesh.geometry,idx=g.index?.array||null,tc=idx?idx.length/3:g.attributes.position.count/3;
      for(let ti=0;ti<tc;ti++){
        const ia=idx?idx[ti*3]:ti*3,ib=idx?idx[ti*3+1]:ti*3+1,ic=idx?idx[ti*3+2]:ti*3+2;
        HD.Body.vertexWorld(mesh,ia,va);HD.Body.vertexWorld(mesh,ib,vb);HD.Body.vertexWorld(mesh,ic,vc);
        const c=va.clone().add(vb).add(vc).multiplyScalar(1/3),c2=basis.to2(c);
        if(c2.x<minX||c2.x>maxX||c2.y<minY||c2.y>maxY||!HD.G.pointInPoly(c2,contour))continue;
        // cheap cuts by ring, strap, older panel
        let reject=false;
        for(const id of p.boundarySlots){
          const n=HD.State.nodes.get(id);if(n?.ringVisible&&c.distanceTo(HD.G.nodePos(n))<HD.G.ringMajor(n)+HD.G.ringTube(n)*1.2){reject=true;break}
        }
        if(reject)continue;
        for(const s of HD.State.straps.values()){
          for(let i=0;i<s.route.length-1&&!reject;i++){
            const a=s.route[i].point,b=s.route[i+1].point,cp=HD.G.closestPointSegment(c,a,b).p;
            if(c.distanceTo(cp)<HD.mm(s.widthMM)*.52)reject=true;
          }
        }
        if(reject)continue;
        HD.Body.normalWorld(mesh,ia,na);HD.Body.normalWorld(mesh,ib,nb);HD.Body.normalWorld(mesh,ic,nc);
        for(const [q,n] of [[va,na],[vb,nb],[vc,nc]]){
          const out=q.clone().addScaledVector(n,HD.mm(p.offsetMM));positions.push(out.x,out.y,out.z)
        }
      }
    }
    this.setGeometry(p,positions);
  },
  setGeometry(p,pos){
    const g=new THREE.BufferGeometry();g.setAttribute("position",new THREE.Float32BufferAttribute(pos,3));if(pos.length){g.computeVertexNormals();g.computeBoundingSphere()}
    p.mesh.geometry.dispose();p.mesh.geometry=g;this.refreshMaterial(p);
  },
  refreshMaterial(p){p.mesh.material=(HD.State.selected?.kind==="panel"&&HD.State.selected.id===p.id)?this.sel:this.mat},
  refreshAll(){for(const p of HD.State.panels.values())this.refreshMaterial(p)},
  remove(id){const p=HD.State.panels.get(id);if(!p)return;p.mesh.geometry.dispose();this.root.remove(p.mesh);HD.State.panels.delete(id)},
  onNodeMerge(from,to){for(const p of HD.State.panels.values()){p.boundarySlots=p.boundarySlots.map(id=>id===from?to:id);this.rebuild(p)}},
  onNodeUnmerge(host,guest){/* topology restoration is handled by History snapshots in V2 alpha */},
  rebuildForNode(id,{preview=false}={}){for(const p of HD.State.panels.values())if(p.boundarySlots.includes(id))this.rebuild(p,{preview})}
};
