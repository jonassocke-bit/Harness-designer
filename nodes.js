
HD.Nodes={
  root:new THREE.Group(),debugRoot:new THREE.Group(),
  mat:null,sel:null,pointMat:null,hitMat:null,
  init(scene){
    this.mat=new THREE.MeshStandardMaterial({color:0xc8c9cd,roughness:.25,metalness:.85});
    this.sel=new THREE.MeshStandardMaterial({color:0x00d8ff,roughness:.18,metalness:.8,emissive:0x006980,emissiveIntensity:.7});
    this.pointMat=new THREE.MeshBasicMaterial({color:0xffffff});
    this.hitMat=new THREE.MeshBasicMaterial({transparent:true,opacity:.001,depthWrite:false});
    scene.add(this.root,this.debugRoot);
  },
  create(data={}){
    const id=data.id||HD.makeId("node");
    const n={
      id,kind:"node",position:data.position||[0,0,0],normal:data.normal||[0,0,1],
      ringVisible:data.ringVisible!==false,diameterMM:data.diameterMM??32,thicknessMM:data.thicknessMM??6,
      locked:!!data.locked,mirrorId:data.mirrorId||null,previousPartnerId:data.previousPartnerId||null,
      mergedState:data.mergedState||null,snapMergeState:data.snapMergeState||null,
      group:new THREE.Group(),visual:null,hit:null
    };
    n.group.userData={kind:"node",id};HD.State.nodes.set(id,n);this.root.add(n.group);this.rebuild(n);this.sync(n);return n;
  },
  rebuild(n){
    if(n.visual){n.visual.geometry.dispose();n.group.remove(n.visual)}
    if(n.hit){n.hit.geometry.dispose();n.group.remove(n.hit)}
    if(n.ringVisible){
      n.visual=new THREE.Mesh(new THREE.TorusGeometry(HD.G.ringMajor(n),HD.G.ringTube(n),12,40),this.mat);
      n.hit=new THREE.Mesh(new THREE.TorusGeometry(HD.G.ringMajor(n),Math.max(HD.G.ringTube(n)*1.15,HD.CFG.ringHitTubeMin),10,40),this.hitMat);
    }else{
      n.visual=new THREE.Mesh(new THREE.SphereGeometry(.012,16,12),this.pointMat);
      n.hit=new THREE.Mesh(new THREE.SphereGeometry(.022,12,8),this.hitMat);
    }
    n.visual.userData=n.hit.userData={kind:"node",id:n.id};n.group.add(n.visual,n.hit);this.refreshMaterial(n);
  },
  sync(n){
    let normal=HD.G.nodeNormal(n),p=HD.G.nodePos(n);
    if(Math.abs(p.x)<=HD.CFG.axisSnapIn){p.x=0;n.position=HD.G.arr(p);normal.x=0;if(normal.lengthSq()<1e-8)normal.set(0,0,1);normal.normalize()}
    const lift=HD.mm(HD.State.surfaceOffsetMM)+(n.ringVisible?HD.G.ringTube(n):0);
    n.group.position.copy(p).addScaledVector(normal,lift);
    n.group.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),normal);
  },
  setPose(n,p,normal){n.position=HD.G.arr(p);n.normal=HD.G.arr(normal.normalize());this.sync(n)},
  refreshMaterial(n){
    const selected=HD.State.selected?.kind==="node"&&HD.State.selected.id===n.id;
    n.visual.material=selected?this.sel:(n.ringVisible?this.mat:this.pointMat);
  },
  refreshAll(){for(const n of HD.State.nodes.values()){this.sync(n);this.refreshMaterial(n)}this.refreshDebug()},
  mirror(n){
    const p=HD.G.mirrorPoint(HD.G.nodePos(n)),normal=HD.G.mirrorNormal(HD.G.nodeNormal(n));
    const m=this.create({position:HD.G.arr(p),normal:HD.G.arr(normal),ringVisible:n.ringVisible,diameterMM:n.diameterMM,thicknessMM:n.thicknessMM});
    n.mirrorId=m.id;m.mirrorId=n.id;n.previousPartnerId=m.id;m.previousPartnerId=n.id;return m;
  },
  pair(n){return n?.mirrorId?HD.State.nodes.get(n.mirrorId)||null:null},
  genericSnapIn(a,b){return Math.max(HD.CFG.genericSnapMin,Math.min(HD.G.ringMajor(a),HD.G.ringMajor(b))*HD.CFG.genericSnapRatio)},
  genericSnapOut(a){return Math.max(HD.CFG.genericSnapOutMin,HD.G.ringMajor(a)*HD.CFG.genericSnapOutRatio)},
  nearestSnap(n){
    if(!n.ringVisible)return null;
    let best=null,bd=Infinity,p=HD.G.nodePos(n);
    for(const o of HD.State.nodes.values()){
      if(o===n||!o.ringVisible)continue;
      const d=p.distanceTo(HD.G.nodePos(o));
      if(d<this.genericSnapIn(n,o)&&d<bd){best=o;bd=d}
    }return best;
  },
  mergeGeneric(guest,host){
    host.snapMergeState={guest:HD.History.nodeData(guest),topology:HD.History.captureTopologyForNode(guest.id)};
    HD.Panels.onNodeMerge(guest.id,host.id);
    HD.Straps.remapNode(guest.id,host.id);
    this.removeBare(guest.id);
    HD.State.selected={kind:"node",id:host.id};return host;
  },
  unmergeGeneric(host){
    const st=host.snapMergeState;if(!st)return host;
    const hp=HD.G.nodePos(host),p=hp.clone().add(new THREE.Vector3(this.genericSnapOut(host)*1.5,0,0));
    const g=this.create({...st.guest,position:HD.G.arr(p),snapMergeState:null});
    HD.Straps.restoreTopology(st.topology,host.id,g.id);
    HD.Panels.onNodeUnmerge(host.id,g.id);
    host.snapMergeState=null;HD.State.selected={kind:"node",id:g.id};return g;
  },
  removeBare(id){const n=HD.State.nodes.get(id);if(!n)return;n.visual?.geometry.dispose();n.hit?.geometry.dispose();this.root.remove(n.group);HD.State.nodes.delete(id)},
  remove(id){
    for(const s of [...HD.State.straps.values()])if(s.a===id||s.b===id)HD.Straps.remove(s.id);
    for(const p of [...HD.State.panels.values()])if(p.boundarySlots.some(x=>x===id))HD.Panels.remove(p.id);
    this.removeBare(id);
  },
  refreshDebug(){
    this.debugRoot.clear();if(!HD.State.hitboxDebug)return;
    for(const n of HD.State.nodes.values()){
      if(!n.ringVisible)continue;
      const g=new THREE.TorusGeometry(HD.G.ringMajor(n),Math.max(HD.G.ringTube(n)*1.15,HD.CFG.ringHitTubeMin),8,32);
      const e=new THREE.EdgesGeometry(g);g.dispose();
      const l=new THREE.LineSegments(e,new THREE.LineBasicMaterial({color:0x00d8ff,depthTest:false}));
      l.position.copy(n.group.position);l.quaternion.copy(n.group.quaternion);this.debugRoot.add(l);
    }
  }
};
