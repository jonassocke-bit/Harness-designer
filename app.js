import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

window.THREE=THREE;
window.GLTFLoader=GLTFLoader;

const BUILD='V3.2.2 TOPOLOGY INTEGRITY';
const FILES=[
  "v3-00-registry.js",
  "v3-01-module-map.js",
  "v3-10-core-body.js",
  "v3-20-nodes-routing.js",
  "v3-30-panels.js",
  "v3-40-straps-runtime.js",
  "v3-50-history-ui.js",
  "v3-60-strip-solvers.js",
  "v3-70-topology-symmetry.js",
  "v3-80-interaction-runtime.js",
  "v3-90-diagnostics.js",
  "v3-95-guided-test.js"
];

function bootError(message,detail=''){
  console.error('[V3.1]',message,detail);
  let box=document.getElementById('v3ModularBootError');
  if(!box){
    box=document.createElement('div');
    box.id='v3ModularBootError';
    Object.assign(box.style,{
      position:'fixed',left:'10px',right:'10px',top:'70px',zIndex:'20000',
      padding:'12px',borderRadius:'12px',background:'#5b1515ee',color:'#fff',
      font:'12px/1.4 ui-monospace,monospace',whiteSpace:'pre-wrap'
    });
    document.body.appendChild(box);
  }
  box.textContent=BUILD+'\n'+message+(detail?'\n\n'+detail:'');
}

async function loadAll(){
  const sources=[];
  for(const file of FILES){
    const url='./'+file+'?build=322';
    let response;
    try{response=await fetch(url,{cache:'no-store'})}
    catch(e){throw new Error('Modul konnte nicht geladen werden: '+file+'\n'+e)}
    if(!response.ok)throw new Error('Modul fehlt/HTTP '+response.status+': '+file);
    sources.push('// ===== '+file+' =====\n'+await response.text());
  }
  return sources;
}

try{
  const sources=await loadAll();
  const script=document.createElement('script');
  script.dataset.v3Bundle=BUILD;
  script.textContent=sources.join('\n');
  document.body.appendChild(script);
  console.info('[V3.1] all modules loaded',FILES);
}catch(e){
  bootError('MODULAR BOOT FAILED',String(e?.stack||e));
}
