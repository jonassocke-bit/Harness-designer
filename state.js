
HD.State={
  nodes:new Map(),
  straps:new Map(),
  panels:new Map(),
  nextNodeId:1,nextStrapId:1,nextPanelId:1,
  selected:null,tool:"ring",mirrorMode:false,
  connectStart:null,panelBuild:[],
  bodyModel:"female_custom_morph.glb",
  bodyColor:"#e9e9e9",surfaceOffsetMM:1.5,
  hitboxDebug:false,
  undo:[],redo:[],restoring:false
};
HD.makeId=(kind)=>{
  const S=HD.State;
  if(kind==="node")return "N"+S.nextNodeId++;
  if(kind==="strap")return "S"+S.nextStrapId++;
  return "P"+S.nextPanelId++;
};
HD.clone=v=>JSON.parse(JSON.stringify(v));
