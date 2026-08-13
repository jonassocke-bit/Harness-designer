
HD.History={
  nodeData:n=>({id:n.id,position:[...n.position],normal:[...n.normal],ringVisible:n.ringVisible,diameterMM:n.diameterMM,thicknessMM:n.thicknessMM,locked:n.locked,mirrorId:n.mirrorId,previousPartnerId:n.previousPartnerId}),
  strapData:s=>({id:s.id,a:s.a,b:s.b,widthMM:s.widthMM,locked:s.locked,mirrorId:s.mirrorId,previousPartnerId:s.previousPartnerId,deletedTs:s.deletedTs,debug:s.debug}),
  panelData:p=>({id:p.id,boundarySlots:[...p.boundarySlots],offsetMM:p.offsetMM,locked:p.locked}),
  captureTopologyForNode:id=>HD.Straps.topologyForNode(id),
  serialize(){
    const S=HD.State;
    return {nextNodeId:S.nextNodeId,nextStrapId:S.nextStrapId,nextPanelId:S.nextPanelId,bodyModel:S.bodyModel,bodyColor:S.bodyColor,surfaceOffsetMM:S.surfaceOffsetMM,mirrorMode:S.mirrorMode,
      nodes:[...S.nodes.values()].map(this.nodeData),straps:[...S.straps.values()].map(this.strapData),panels:[...S.panels.values()].map(this.panelData)};
  },
  signature(){return JSON.stringify(this.serialize())},
  commit(){
    if(HD.State.restoring)return;
    const snap=this.serialize(),sig=JSON.stringify(snap),u=HD.State.undo;
    if(u.length&&u[u.length-1].sig===sig)return;
    u.push({sig,snap});if(u.length>60)u.shift();HD.State.redo=[];
    try{localStorage.setItem(HD.CFG.storageKey,sig)}catch{}
    HD.UI?.updateHistory();
  },
  async restore(snap){
    HD.State.restoring=true;HD.App.clearSceneData();
    Object.assign(HD.State,{nextNodeId:snap.nextNodeId||1,nextStrapId:snap.nextStrapId||1,nextPanelId:snap.nextPanelId||1,bodyModel:snap.bodyModel||HD.State.bodyModel,bodyColor:snap.bodyColor||HD.State.bodyColor,surfaceOffsetMM:snap.surfaceOffsetMM??1.5,mirrorMode:!!snap.mirrorMode});
    if(HD.Body.currentModel!==HD.State.bodyModel)await HD.App.loadBody(HD.State.bodyModel);HD.Body.setColor(HD.State.bodyColor);
    for(const n of snap.nodes||[])HD.Nodes.create(n);
    for(const s of snap.straps||[])HD.Straps.create(s);
    for(const p of snap.panels||[])HD.Panels.create(p);
    HD.State.selected=null;HD.State.restoring=false;HD.UI.refresh();HD.Nodes.refreshAll();HD.Straps.refreshAll();HD.Panels.refreshAll();
  },
  async undo(){
    const u=HD.State.undo;if(u.length<2)return;const cur=u.pop();HD.State.redo.push(cur);await this.restore(u[u.length-1].snap);this.updateStorage();
  },
  async redo(){
    const r=HD.State.redo;if(!r.length)return;const item=r.pop();HD.State.undo.push(item);await this.restore(item.snap);this.updateStorage();
  },
  updateStorage(){try{localStorage.setItem(HD.CFG.storageKey,JSON.stringify(this.serialize()))}catch{}HD.UI?.updateHistory()}
};
