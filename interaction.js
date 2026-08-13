
HD.Interaction={
  pointers:new Map(),gesture:null,
  init(canvas){
    canvas.addEventListener("pointerdown",e=>this.down(e));
    canvas.addEventListener("pointermove",e=>this.move(e));
    canvas.addEventListener("pointerup",e=>this.up(e));
    canvas.addEventListener("pointercancel",e=>this.up(e));
  },
  setPointer(e){
    const r=HD.App.canvas.getBoundingClientRect();
    HD.App.pointer.set((e.clientX-r.left)/r.width*2-1,-((e.clientY-r.top)/r.height)*2+1);
    HD.App.raycaster.setFromCamera(HD.App.pointer,HD.App.camera);
  },
  hitObject(e){
    this.setPointer(e);
    const bodyDist=HD.Body.ray(HD.App.raycaster)?.distance??Infinity;
    const nh=HD.App.raycaster.intersectObjects([...HD.State.nodes.values()].map(n=>n.hit),false)[0];
    if(nh&&nh.distance<bodyDist+.08)return {kind:"node",id:nh.object.userData.id};
    const sh=HD.App.raycaster.intersectObjects([...HD.State.straps.values()].map(s=>s.mesh),false)[0];
    if(sh&&sh.distance<bodyDist+.06)return {kind:"strap",id:sh.object.userData.id};
    const ph=HD.App.raycaster.intersectObjects([...HD.State.panels.values()].map(p=>p.mesh),false)[0];
    if(ph&&ph.distance<bodyDist+.06)return {kind:"panel",id:ph.object.userData.id};
    return null;
  },
  bodyHit(e){this.setPointer(e);return HD.Body.ray(HD.App.raycaster)},
  down(e){
    HD.App.canvas.setPointerCapture(e.pointerId);this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY});
    if(this.pointers.size===2){this.gesture={type:"camera2"};return}
    const hit=this.hitObject(e);
    if(hit){HD.UI.select(hit);if(hit.kind==="node"){const n=HD.State.nodes.get(hit.id);if(!n.locked)this.gesture={type:"nodeDrag",id:n.id}}return}
    if(HD.State.tool==="ring"){
      const h=this.bodyHit(e);if(h){const n=HD.Nodes.create({position:HD.G.arr(h.point),normal:HD.G.arr(HD.G.worldNormalFromHit(h))});if(HD.State.mirrorMode&&Math.abs(h.point.x)>HD.CFG.axisSnapIn)HD.Nodes.mirror(n);HD.UI.select({kind:"node",id:n.id});HD.History.commit()}
      return;
    }
    this.gesture={type:"camera1"};
  },
  move(e){
    const p=this.pointers.get(e.pointerId);if(!p)return;
    const dx=e.clientX-p.lastX,dy=e.clientY-p.lastY;p.lastX=e.clientX;p.lastY=e.clientY;
    if(this.pointers.size===2){
      const arr=[...this.pointers.values()];const a=arr[0],b=arr[1];
      if(!this.gesture.prevDist)this.gesture.prevDist=Math.hypot(a.x-b.x,a.y-b.y);
      const d=Math.hypot(a.x-b.x,a.y-b.y),delta=d-this.gesture.prevDist;this.gesture.prevDist=d;
      HD.App.camera.position.multiplyScalar(1-delta*.002);return;
    }
    if(this.gesture?.type==="camera1"){HD.App.orbitYaw-=dx*.008;HD.App.orbitPitch-=dy*.008;HD.App.updateCamera();return}
    if(this.gesture?.type==="nodeDrag"){
      const n=HD.State.nodes.get(this.gesture.id),h=this.bodyHit(e);if(!n||!h)return;
      let pos=h.point.clone(),normal=HD.G.worldNormalFromHit(h);
      if(Math.abs(pos.x)<HD.CFG.axisSnapIn)pos.x=0;
      HD.Nodes.setPose(n,pos,normal);
      const pair=HD.Nodes.pair(n);
      if(pair){HD.Nodes.setPose(pair,HD.G.mirrorPoint(pos),HD.G.mirrorNormal(normal))}
      for(const s of HD.State.straps.values())if(s.a===n.id||s.b===n.id||s.a===pair?.id||s.b===pair?.id)HD.Straps.rebuild(s,{preview:true});
      HD.Panels.rebuildForNode(n.id,{preview:true});if(pair)HD.Panels.rebuildForNode(pair.id,{preview:true});
    }
  },
  up(e){
    const gesture=this.gesture;this.pointers.delete(e.pointerId);
    if(this.pointers.size){return}
    this.gesture=null;
    if(gesture?.type==="nodeDrag"){
      let n=HD.State.nodes.get(gesture.id);if(!n)return;
      const target=HD.Nodes.nearestSnap(n);if(target)n=HD.Nodes.mergeGeneric(n,target);
      for(const s of HD.State.straps.values())if(s.a===n.id||s.b===n.id)HD.Straps.rebuild(s);
      HD.Panels.rebuildForNode(n.id);
      HD.Nodes.refreshAll();HD.History.commit();HD.UI.refresh();
    }
  }
};
