
HD.UI={
  $:id=>document.getElementById(id),
  init(){
    const $=this.$;
    for(const [id,tool] of [["toolRing","ring"],["toolConnect","connect"],["toolPanel","panel"]])$(id).onclick=()=>this.setTool(tool);
    $("mirrorToggle").onclick=()=>{HD.State.mirrorMode=!HD.State.mirrorMode;this.refresh()};
    $("undoBtn").onclick=()=>HD.History.undo();$("redoBtn").onclick=()=>HD.History.redo();
    $("nodeDiameter").oninput=e=>this.editNode("diameterMM",+e.target.value);
    $("nodeThickness").oninput=e=>this.editNode("thicknessMM",+e.target.value);
    $("nodeRing").onchange=e=>this.editNode("ringVisible",e.target.checked,true);
    $("nodeDelete").onclick=()=>this.deleteSelected();
    $("strapDelete").onclick=()=>this.deleteSelected();$("panelDelete").onclick=()=>this.deleteSelected();
    $("strapWidth").oninput=e=>this.editStrap("widthMM",+e.target.value);
    $("strapDebug").onclick=()=>{const s=this.selectedObj();if(s?.kind==="strap"){s.debug=!s.debug;HD.Straps.refreshDebug(s);this.refresh()}};
    $("panelOffset").oninput=e=>{const p=this.selectedObj();if(p?.kind==="panel"){p.offsetMM=+e.target.value;HD.Panels.rebuild(p);this.refresh()}};
    $("nodeMirror").onclick=()=>{const n=this.selectedObj();if(n?.kind==="node"&&!HD.Nodes.pair(n)){HD.Nodes.mirror(n);HD.History.commit();this.refresh()}};
    $("nodeUnlink").onclick=()=>this.unlinkSelected();$("strapUnlink").onclick=()=>this.unlinkSelected();
    $("bodyColor").oninput=e=>HD.Body.setColor(e.target.value);
    $("bodyModel").onchange=async e=>{HD.State.bodyModel=e.target.value;await HD.App.loadBody(e.target.value);HD.Nodes.refreshAll();for(const s of HD.State.straps.values())HD.Straps.rebuild(s);for(const p of HD.State.panels.values())HD.Panels.rebuild(p);HD.History.commit()};
    $("surfaceOffset").oninput=e=>{HD.State.surfaceOffsetMM=+e.target.value;HD.Nodes.refreshAll();for(const s of HD.State.straps.values())HD.Straps.rebuild(s);for(const p of HD.State.panels.values())HD.Panels.rebuild(p);this.refresh()};
    $("hitboxDebug").onclick=()=>{HD.State.hitboxDebug=!HD.State.hitboxDebug;HD.Nodes.refreshDebug();this.refresh()};
    $("clearBtn").onclick=()=>{HD.App.clearSceneData();HD.History.commit();this.refresh()};
    $("buildCancel").onclick=()=>this.cancelBuild();$("buildConfirm").onclick=()=>this.confirmPanel();
    this.refresh();
  },
  selectedObj(){
    const s=HD.State.selected;if(!s)return null;
    return s.kind==="node"?HD.State.nodes.get(s.id):s.kind==="strap"?HD.State.straps.get(s.id):HD.State.panels.get(s.id);
  },
  select(ref){
    HD.State.selected=ref;
    if(HD.State.tool==="connect"&&ref.kind==="node")return this.connectPick(ref.id);
    if(HD.State.tool==="panel"&&ref.kind==="node")return this.panelPick(ref.id);
    HD.Nodes.refreshAll();HD.Straps.refreshAll();HD.Panels.refreshAll();this.refresh();
  },
  setTool(tool){HD.State.tool=tool;HD.State.connectStart=null;HD.State.panelBuild=[];this.refresh()},
  connectPick(id){
    if(!HD.State.connectStart){HD.State.connectStart=id;this.refresh();return}
    if(HD.State.connectStart!==id){
      const s=HD.Straps.create({a:HD.State.connectStart,b:id});
      if(s&&HD.State.mirrorMode){
        const a=HD.Nodes.pair(HD.State.nodes.get(s.a)),b=HD.Nodes.pair(HD.State.nodes.get(s.b));
        if(a&&b){const m=HD.Straps.create({a:a.id,b:b.id,widthMM:s.widthMM});s.mirrorId=m.id;m.mirrorId=s.id}
      }
      HD.History.commit();
    }
    HD.State.connectStart=null;this.refresh();
  },
  panelPick(id){if(!HD.State.panelBuild.includes(id))HD.State.panelBuild.push(id);this.refresh()},
  confirmPanel(){if(HD.State.panelBuild.length>=3){HD.Panels.create({boundarySlots:HD.State.panelBuild});HD.History.commit()}HD.State.panelBuild=[];this.refresh()},
  cancelBuild(){HD.State.connectStart=null;HD.State.panelBuild=[];HD.State.tool="ring";this.refresh()},
  editNode(key,val,rebuild=false){
    const n=this.selectedObj();if(n?.kind!=="node")return;n[key]=val;if(rebuild)HD.Nodes.rebuild(n);HD.Nodes.sync(n);
    const pair=HD.Nodes.pair(n);if(pair){pair[key]=val;if(rebuild)HD.Nodes.rebuild(pair);HD.Nodes.sync(pair)}
    for(const s of HD.State.straps.values())if(s.a===n.id||s.b===n.id||s.a===pair?.id||s.b===pair?.id)HD.Straps.rebuild(s);
    HD.Panels.rebuildForNode(n.id);if(pair)HD.Panels.rebuildForNode(pair.id);HD.History.commit();this.refresh();
  },
  editStrap(key,val){const s=this.selectedObj();if(s?.kind!=="strap")return;s[key]=val;HD.Straps.rebuild(s);const p=HD.Straps.pair(s);if(p){p[key]=val;HD.Straps.rebuild(p)}HD.History.commit();this.refresh()},
  unlinkSelected(){
    const o=this.selectedObj();if(!o)return;
    if(o.kind==="node"){const p=HD.Nodes.pair(o);if(p){o.previousPartnerId=p.id;p.previousPartnerId=o.id;o.mirrorId=p.mirrorId=null}}
    if(o.kind==="strap"){const p=HD.Straps.pair(o);if(p){o.previousPartnerId=p.id;p.previousPartnerId=o.id;o.mirrorId=p.mirrorId=null}}
    HD.History.commit();this.refresh();
  },
  deleteSelected(){const o=this.selectedObj();if(!o)return;if(o.kind==="node")HD.Nodes.remove(o.id);if(o.kind==="strap")HD.Straps.remove(o.id);if(o.kind==="panel")HD.Panels.remove(o.id);HD.State.selected=null;HD.History.commit();this.refresh()},
  refresh(){
    const $=this.$,S=HD.State,o=this.selectedObj();
    for(const [id,t] of [["toolRing","ring"],["toolConnect","connect"],["toolPanel","panel"]])$(id).classList.toggle("active",S.tool===t);
    $("mirrorToggle").classList.toggle("active",S.mirrorMode);
    $("nodePanel").classList.toggle("hidden",o?.kind!=="node");$("strapPanel").classList.toggle("hidden",o?.kind!=="strap");$("panelPanel").classList.toggle("hidden",o?.kind!=="panel");
    $("selectionNone").classList.toggle("hidden",!!o);
    if(o?.kind==="node"){$("nodeRing").checked=o.ringVisible;$("nodeDiameter").value=o.diameterMM;$("nodeThickness").value=o.thicknessMM;$("nodeDiameterVal").textContent=o.diameterMM+" mm";$("nodeThicknessVal").textContent=o.thicknessMM+" mm"}
    if(o?.kind==="strap"){$("strapWidth").value=o.widthMM;$("strapWidthVal").textContent=o.widthMM+" mm";$("strapDebug").classList.toggle("active",o.debug)}
    if(o?.kind==="panel"){$("panelOffset").value=o.offsetMM;$("panelOffsetVal").textContent=o.offsetMM.toFixed(1)+" mm"}
    $("surfaceOffset").value=S.surfaceOffsetMM;$("surfaceOffsetVal").textContent=S.surfaceOffsetMM.toFixed(1)+" mm";$("bodyColor").value=S.bodyColor;$("bodyModel").value=S.bodyModel;$("hitboxDebug").classList.toggle("active",S.hitboxDebug);
    const build=S.tool==="connect"||S.tool==="panel";$("buildHelp").classList.toggle("hidden",!build);
    if(S.tool==="connect"){$("buildTitle").textContent="Verbinden";$("buildText").textContent=S.connectStart?"Zweiten Ring wählen":"Ersten Ring wählen";$("buildConfirm").classList.add("hidden")}
    if(S.tool==="panel"){$("buildTitle").textContent="Fläche";$("buildText").textContent=`${S.panelBuild.length} Punkte gewählt`;$("buildConfirm").classList.toggle("hidden",S.panelBuild.length<3)}
    HD.Nodes.refreshAll();HD.Straps.refreshAll();HD.Panels.refreshAll();this.updateHistory();
  },
  updateHistory(){this.$("undoBtn").disabled=HD.State.undo.length<2;this.$("redoBtn").disabled=!HD.State.redo.length}
};
