// --- V3 Golden diagnostics: append-only; legacy behavior above remains untouched ---
(function V3GoldenDiagnostics(){
  const BUILD='V3.0.0 GOLDEN';
  const BASE='V1.9f2 PANEL FILLED EDGE';
  const futureSlots={
    modes:['build','accessories','photo'],
    tools:['ring','connect','panel','strapPaint'],
    services:['bodySurface','snapMerge','history','persistence'],
    solvers:['strapLegacy','strapNext','panelLegacy','panelNext']
  };
  window.HDV3={
    build:BUILD,base:BASE,futureSlots,
    registry:{modes:new Map(),tools:new Map(),solvers:new Map()},
    registerMode(id,impl){this.registry.modes.set(id,impl)},
    registerTool(id,impl){this.registry.tools.set(id,impl)},
    registerSolver(id,impl){this.registry.solvers.set(id,impl)}
  };
  const report=()=>[
    BUILD,
    'Base: '+BASE,
    'URL: '+location.href,
    'ReadyState: '+document.readyState,
    'THREE: '+(typeof THREE!=='undefined'?'OK':'MISSING'),
    'Canvas: '+(document.querySelector('canvas')?'OK':'MISSING'),
    'Body meshes: '+(typeof bodyMeshes!=='undefined'?bodyMeshes.length:'legacy-private'),
    'Nodes: '+(typeof nodes!=='undefined'?nodes.size:'legacy-private'),
    'Straps: '+(typeof straps!=='undefined'?straps.size:'legacy-private'),
    'Panels: '+(typeof panels!=='undefined'?panels.size:'legacy-private'),
    '',
    'Reserved V3 extension slots:',
    JSON.stringify(futureSlots,null,2)
  ].join('\n');
  addEventListener('DOMContentLoaded',()=>{
    const b=document.createElement('button');b.id='v3DiagBtn';b.textContent='V3 DEBUG';
    const p=document.createElement('div');p.id='v3DiagPanel';
    b.onclick=()=>{p.textContent=report();p.style.display=p.style.display==='block'?'none':'block'};
    document.body.append(b,p);
  });
  addEventListener('error',e=>{
    const p=document.getElementById('v3DiagPanel');
    if(p){p.textContent=report()+'\n\nERROR:\n'+(e.error?.stack||e.message||'unknown');p.style.display='block'}
  });
  addEventListener('unhandledrejection',e=>{
    const p=document.getElementById('v3DiagPanel');
    if(p){p.textContent=report()+'\n\nPROMISE ERROR:\n'+(e.reason?.stack||e.reason||'unknown');p.style.display='block'}
  });
})();




