// ============================================================================
// V3.5.3 SURFACE CLEANUP + MIDPOINT RESET
// Patch layer on top of V3.5.2. Keep the working routing core intact and only
// tighten the reported edge cases / UI behavior.
// ============================================================================
(function V353Patch(){
  const BUILD='V3.5.3 SURFACE CLEANUP + MIDPOINT RESET';
  const BASE='V3.5.2 OUTSIDE + REPORT IMAGE';

  // --------------------------------------------------------------------------
  // 1) Arm-zone calibration: shoulder controls translate the whole diagonal.
  //    Achsel controls remain available as a local lower-end refinement.
  // --------------------------------------------------------------------------
  const computeBodyZoneLandmarksV348BaseV353=computeBodyZoneLandmarksV348;
  computeBodyZoneLandmarksV348=function(){
    const lm=computeBodyZoneLandmarksV348BaseV353();
    const sx=Number(bodyZoneCalibrationV350?.shoulderX||0);
    const sy=Number(bodyZoneCalibrationV350?.shoulderY||0);
    return {
      ...lm,
      armpitX:THREE.MathUtils.clamp(lm.armpitX+sx,.06,.34),
      armpitY:THREE.MathUtils.clamp(lm.armpitY+sy,-.42,.34)
    };
  };

  // --------------------------------------------------------------------------
  // 2) More Adaptive detail in the upper torso / chest region.
  // --------------------------------------------------------------------------
  const bodyComplexityAtV351BaseV353=bodyComplexityAtV351;
  bodyComplexityAtV351=function(p){
    let score=bodyComplexityAtV351BaseV353(p);
    try{
      const box=getBodyBoundsV344();
      const c=box.getCenter(new THREE.Vector3());
      const sz=box.getSize(new THREE.Vector3());
      const x=(p.x-c.x)/(sz.x||1);
      const y=(p.y-c.y)/(sz.y||1);
      const ax=Math.abs(x);
      const lm=computeBodyZoneLandmarksV348();
      const low=lm.armpitY-.055;
      const high=lm.neckY+.018;
      if(y>=low&&y<=high&&ax<Math.max(.15,lm.shoulderX*.96)){
        const centerY=THREE.MathUtils.lerp(lm.armpitY,lm.neckY,.48);
        const span=Math.max(.06,(high-low)*.55);
        const peak=1-THREE.MathUtils.clamp(Math.abs(y-centerY)/span,0,1);
        score=Math.max(score,.54+peak*.16);
      }
    }catch(e){}
    return THREE.MathUtils.clamp(score,0,1);
  };

  // --------------------------------------------------------------------------
  // 3) Head virtual closure. Eye sockets / mouth openings are treated as small
  //    holes in an otherwise closed outer skin. We sample neighboring rays and
  //    use an upper envelope depth only when the central hit is suspiciously
  //    recessed. The rendered mannequin remains untouched.
  // --------------------------------------------------------------------------
  const localZoneSurfaceHitV346BaseV353=localZoneSurfaceHitV346;
  function headEnvelopeSurfaceHitV353(candidate,allowedZones,prevPoint,searchNormal){
    let d=searchNormal.clone();
    if(d.lengthSq()<1e-10)return null;
    d.normalize();

    const central=localZoneSurfaceHitV346BaseV353(candidate,allowedZones,prevPoint,d);

    let u=new THREE.Vector3().crossVectors(d,WORLD_UP);
    if(u.lengthSq()<1e-8)u=new THREE.Vector3().crossVectors(d,new THREE.Vector3(1,0,0));
    if(u.lengthSq()<1e-8)u.set(1,0,0);
    u.normalize();
    const v=new THREE.Vector3().crossVectors(d,u).normalize();

    const offsets=[
      new THREE.Vector3(),
      u.clone().multiplyScalar(.026),u.clone().multiplyScalar(-.026),
      v.clone().multiplyScalar(.026),v.clone().multiplyScalar(-.026),
      u.clone().multiplyScalar(.052),u.clone().multiplyScalar(-.052),
      v.clone().multiplyScalar(.052),v.clone().multiplyScalar(-.052)
    ];

    const samples=[];
    for(const off of offsets){
      const c=candidate.clone().add(off);
      const origin=c.clone().addScaledVector(d,1.8);
      raycaster.set(origin,d.clone().negate());
      for(const h of raycaster.intersectObjects(bodyMeshes,true).slice(0,12)){
        if(allowedZones&&!allowedZones.has(classifyBodyZoneWorldPoint(h.point)))continue;
        if(classifyBodyZoneWorldPoint(h.point)!=='head')continue;
        const n=worldNormal(h).clone().normalize();
        if(n.dot(d)<-.18)continue;
        const depth=h.point.clone().sub(c).dot(d);
        samples.push({depth,normal:n,point:h.point.clone()});
        break;
      }
    }

    if(samples.length<3)return central;
    samples.sort((a,b)=>a.depth-b.depth);
    const envelope=samples[Math.floor((samples.length-1)*.70)];
    const centralDepth=central?central.point.clone().sub(candidate).dot(d):-Infinity;

    // Normal face/head surface stays exactly as V3.5.2. Only a meaningful local
    // depression (typical eye/mouth cavity) gets virtually sealed.
    if(central&&envelope.depth-centralDepth<.018)return central;

    const point=candidate.clone().addScaledVector(d,envelope.depth);
    if(prevPoint&&point.distanceTo(prevPoint)>.34&&central)return central;
    return {
      point,
      normal:envelope.normal.clone(),
      distance:point.distanceTo(candidate),
      dir:d.clone(),
      virtualHeadClosure:true
    };
  }

  localZoneSurfaceHitV346=function(candidate,allowedZones,prevPoint,searchNormal){
    let zone='torso';
    try{zone=classifyBodyZoneWorldPoint(candidate)}catch(e){}
    if(zone==='head')return headEnvelopeSurfaceHitV353(candidate,allowedZones,prevPoint,searchNormal);
    return localZoneSurfaceHitV346BaseV353(candidate,allowedZones,prevPoint,searchNormal);
  };

  // --------------------------------------------------------------------------
  // 4) Wide straps: >20 mm also solve the centerline against the body. If the
  //    middle would sit behind the local skin while both edges are valid, move
  //    the whole cross section outward without changing its width.
  // --------------------------------------------------------------------------
  const solveProjectedFramesV351BaseV353=solveProjectedFramesV351;
  solveProjectedFramesV351=function(s,frames,lift){
    const route=solveProjectedFramesV351BaseV353(s,frames,lift);
    if(!s||Number(s.widthMM)<=20||route.length<2)return route;

    const allowedZones=allowedZonesForStrap(s);
    let prevCenterHit=null,fixes=0,checks=0;
    for(const g of route){
      const h=localZoneSurfaceHitV346(g.center,allowedZones,prevCenterHit,g.normal);
      if(!h)continue;
      checks++;

      let n=h.normal.clone();
      if(n.lengthSq()<1e-10)n=g.normal.clone();
      n.normalize();
      if(n.dot(g.normal)<0)n.negate();

      const target=h.point.clone().addScaledVector(n,lift+.0015);
      const mid=g.stripLeft.clone().lerp(g.stripRight,.5);
      const push=target.clone().sub(mid).dot(n);
      if(push>.0015){
        const amount=Math.min(push,.20);
        g.stripLeft.addScaledVector(n,amount);
        g.stripRight.addScaledVector(n,amount);
        g.centerHit=h.point.clone();
        g.centerNormal=n.clone();
        fixes++;
      }
      prevCenterHit=h.point.clone();
    }
    if(s.routingDebug){
      s.routingDebug.centerlineChecks=checks;
      s.routingDebug.centerlineFixes=fixes;
      s.routingDebug.centerlineForWideStrap=true;
    }
    return route;
  };

  // The route builder performs a final smoothing pass after the frame solve.
  // Re-check the centerline afterwards so smoothing cannot re-introduce a
  // center-only body penetration on wide straps.
  const buildStripMethodRouteBaseV353=buildStripMethodRoute;
  buildStripMethodRoute=function(s,samples,lift){
    const out=buildStripMethodRouteBaseV353(s,samples,lift);
    if(!s||Number(s.widthMM)<=20||!out?.length)return out;

    const allowedZones=allowedZonesForStrap(s);
    let prevCenterHit=null,fixes=0;
    for(const g of out){
      const mid=g.stripLeft.clone().lerp(g.stripRight,.5);
      const candidate=g.center?.clone?.()||mid.clone();
      let preferred=g.normal?.clone?.()||strapFrame(s).normal.clone();
      if(preferred.lengthSq()<1e-10)preferred=strapFrame(s).normal.clone();
      preferred.normalize();
      const h=localZoneSurfaceHitV346(candidate,allowedZones,prevCenterHit,preferred);
      if(!h)continue;

      let n=h.normal.clone();
      if(n.lengthSq()<1e-10)n=preferred.clone();
      n.normalize();
      if(n.dot(preferred)<0)n.negate();
      const target=h.point.clone().addScaledVector(n,lift+.0015);
      const push=target.clone().sub(mid).dot(n);
      if(push>.0015){
        const amount=Math.min(push,.20);
        g.stripLeft.addScaledVector(n,amount);
        g.stripRight.addScaledVector(n,amount);
        g.normal=n.clone();
        fixes++;
      }
      prevCenterHit=h.point.clone();
    }

    if(s.debugTrace){
      s.debugTrace.finalLeft=out.map(g=>g.stripLeft.clone());
      s.debugTrace.finalRight=out.map(g=>g.stripRight.clone());
    }
    if(s.routingDebug){
      s.routingDebug.centerlinePostSmoothFixes=fixes;
      s.routingDebug.centerlineForWideStrap=true;
    }
    return out;
  };

  // --------------------------------------------------------------------------
  // 5) Smaller midpoint visual, same generous invisible touch target.
  // --------------------------------------------------------------------------
  updateControlHandles=function(s){
    s.controlGroup.clear();
    s.guideHandle=null;
    if(selected?.kind!=='strap'||selected.id!==s.id||s.debugRoute)return;

    const p=strapGuideHandlePosition(s);
    const visibleMat=new THREE.MeshBasicMaterial({
      color:s.routingGuide?0xffd54a:0x00d8ff,
      depthTest:false,depthWrite:false,transparent:true,opacity:.95
    });
    const visible=new THREE.Mesh(new THREE.SphereGeometry(.0175,14,10),visibleMat);
    visible.position.copy(p);
    visible.renderOrder=55;
    visible.userData={kind:'strapGuideHandleVisual',id:s.id};

    // Keep the old practical hit size even though the visible point is half size.
    const hitMat=new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthTest:false,depthWrite:false});
    const hit=new THREE.Mesh(new THREE.SphereGeometry(.038,12,8),hitMat);
    hit.position.copy(p);
    hit.renderOrder=54;
    hit.userData={kind:'strapGuideHandle',id:s.id};

    s.controlGroup.add(visible,hit);
    s.guideHandle=hit;
  };

  // --------------------------------------------------------------------------
  // 6) Replace the obsolete “− Punkt” action with midpoint Reset.
  // --------------------------------------------------------------------------
  function resetSelectedStrapGuideV353(){
    if(selected?.kind!=='strap')return;
    try{stripDeleteMode=false}catch(e){}

    const picked=selected;
    const mate=pairOfStrap(picked);
    const master=mate?pairMasterStrap(picked):picked;
    const slave=mate?(master===picked?mate:picked):null;

    master.routingGuide=null;
    master.routingMode='direct';
    if(slave){
      slave.routingGuide=null;
      slave.routingMode='direct';
    }

    rebuildAutoProjection(master);
    if(slave)reconcileMirrorStrapPair(master);

    updateControlHandles(master);
    if(slave)updateControlHandles(slave);
    curvePointCount.textContent='Auto · 1';
    curveMinusBtn.classList.remove('active');
    commitHistory();
    showToast('Mittelpunkt zurückgesetzt');
  }

  curveMinusBtn.textContent='Reset';
  curveMinusBtn.setAttribute('aria-label','Riemen-Mittelpunkt zurücksetzen');
  curveMinusBtn.addEventListener('click',e=>{
    e.preventDefault();
    e.stopImmediatePropagation();
    resetSelectedStrapGuideV353();
  },true);

  // The legacy selection renderer used the old button as a method-state toggle.
  // Keep Reset visually neutral whenever a strap is selected.
  if(typeof showSelection==='function'){
    const showSelectionBaseV353=showSelection;
    showSelection=function(){
      const r=showSelectionBaseV353.apply(this,arguments);
      if(selected?.kind==='strap'){
        curveMinusBtn.textContent='Reset';
        curveMinusBtn.classList.remove('active');
      }
      return r;
    };
  }

  // --------------------------------------------------------------------------
  // 7) UI cleanup: one version number, tiny toolbox launcher, mannequin controls
  //    moved into the toolbox so the separate model icon can disappear.
  // --------------------------------------------------------------------------
  function injectV353Styles(){
    if(document.getElementById('v353PatchStyles'))return;
    const st=document.createElement('style');
    st.id='v353PatchStyles';
    st.textContent=`
      #v3BuildBadge,#v3PatchNotes{display:none!important}
      .version-badge{
        position:fixed!important;right:7px!important;bottom:7px!important;z-index:10000!important;
        padding:0!important;background:none!important;border:0!important;
        color:rgba(255,255,255,.58)!important;font:700 8px/1 system-ui,-apple-system,sans-serif!important;
        letter-spacing:.04em!important;pointer-events:none!important
      }
      #rotateModelBtn{display:none!important}
      #modelPanel{display:none!important}
      #v344Tools.v353Tools{
        width:min(330px,calc(100vw - 12px))!important;
        max-width:calc(100vw - 12px)!important;
        max-height:min(76dvh,650px)!important;
        overflow:hidden!important;
        border-radius:14px!important
      }
      #v344Tools.v353Tools .v344Header{
        min-height:38px!important;height:38px!important;padding:0!important;
        display:flex!important;justify-content:flex-end!important;align-items:center!important;
        cursor:default!important
      }
      #v344Tools.v353Tools .v344Title{display:none!important}
      #v344Tools.v353Tools .v344Collapse{
        width:38px!important;height:38px!important;min-width:38px!important;padding:8px!important;
        border:0!important;background:transparent!important;color:#fff!important
      }
      #v344Tools.v353Tools .v344Collapse svg{display:block;width:22px;height:22px}
      #v344Tools.v353Tools .v344Body{
        max-height:calc(min(76dvh,650px) - 38px)!important;overflow-y:auto!important;
        -webkit-overflow-scrolling:touch!important;padding-bottom:10px!important
      }
      #v344Tools.v353Tools.collapsed{
        width:38px!important;height:38px!important;min-width:38px!important;max-width:38px!important;
        border-radius:12px!important;background:rgba(22,24,30,.86)!important
      }
      #v344Tools.v353Tools.collapsed .v344Body{display:none!important}
      #v344Tools.v353Tools .v353Mannequin{
        grid-column:1/-1;min-width:0;margin-top:7px;padding-top:8px;
        border-top:1px solid rgba(255,255,255,.10)
      }
      #v344Tools.v353Tools .v353SectionTitle{
        margin:0 0 6px;color:rgba(255,255,255,.60);font:750 10px/1.2 system-ui;
        letter-spacing:.12em;text-transform:uppercase
      }
      #v344Tools.v353Tools .v353Mannequin .parameter{padding:3px 0}
      #v344Tools.v353Tools .v353Mannequin .parameter-top>span{font-size:12px}
      #v344Tools.v353Tools .v353Mannequin .number-input{width:50px}
      #v344Tools.v353Tools .v353Mannequin .model-actions{margin-top:0}
      #v344Tools.v353Tools #v3DiagBtn{
        position:static!important;right:auto!important;bottom:auto!important;z-index:auto!important;
        width:100%!important;height:34px!important;padding:5px 7px!important;border-radius:8px!important
      }
    `;
    document.head.appendChild(st);
  }

  function toolsIconV353(){
    return '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M4 6h7M15 6h5M4 12h3M11 12h9M4 18h10M18 18h2"/><circle cx="13" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="16" cy="18" r="2"/></svg>';
  }

  function persistToolboxV353(el){
    try{
      const r=el.getBoundingClientRect();
      localStorage.setItem('HD_V347_TOOLS_UI',JSON.stringify({
        left:r.left,top:r.top,collapsed:el.classList.contains('collapsed')
      }));
    }catch(e){}
  }

  function cleanupAndCombineUIV353(){
    injectV353Styles();
    document.title='Harness Designer V3.5.3';
    document.getElementById('v3BuildBadge')?.remove();
    document.getElementById('v3PatchNotes')?.remove();
    const version=document.querySelector('.version-badge');
    if(version)version.textContent='V3.5.3';

    const tools=document.getElementById('v344Tools');
    if(!tools)return false;
    tools.classList.add('v353Tools');
    tools.querySelector('.v344Title')?.replaceChildren();

    const collapse=tools.querySelector('.v344Collapse');
    if(collapse){
      collapse.innerHTML=toolsIconV353();
      collapse.setAttribute('aria-label','Werkzeuge und Mannequin');
      if(!collapse.dataset.v353PointerGuard){
        collapse.dataset.v353PointerGuard='1';
        collapse.addEventListener('pointerdown',e=>e.stopPropagation());
      }
      collapse.onclick=e=>{
        e.preventDefault();e.stopPropagation();
        tools.classList.toggle('collapsed');
        collapse.innerHTML=toolsIconV353();
        persistToolboxV353(tools);
      };
    }

    if(!localStorage.getItem('HD_V353_TOOLS_COMPACT_INIT')){
      tools.classList.add('collapsed');
      localStorage.setItem('HD_V353_TOOLS_COMPACT_INIT','1');
      persistToolboxV353(tools);
    }

    const toolsBody=tools.querySelector('.v344Body');
    if(toolsBody&&!toolsBody.querySelector('.v353Mannequin')){
      const box=document.createElement('div');box.className='v353Mannequin';
      const title=document.createElement('div');title.className='v353SectionTitle';title.textContent='Mannequin';
      box.appendChild(title);

      const scroll=modelPanel?.querySelector?.('.sheet-scroll');
      if(scroll){
        for(const child of [...scroll.children]){
          if(child.classList?.contains('selection-head'))continue;
          box.appendChild(child);
        }
      }
      toolsBody.appendChild(box);
    }

    // Keep diagnostics available, but inside the single toolbox instead of as a
    // second floating button.
    const diag=document.getElementById('v3DiagBtn');
    if(diag&&toolsBody&&!toolsBody.contains(diag)){
      diag.textContent='Diagnose';
      toolsBody.appendChild(diag);
    }

    rotateModelBtn.style.display='none';
    modelPanel.classList.add('hidden');

    // Shoulder controls now translate the full arm boundary; explain that in UI.
    const zoneSheet=document.getElementById('v351ZoneSheet');
    if(zoneSheet){
      for(const row of zoneSheet.querySelectorAll('.v351ZoneRow')){
        const label=row.querySelector('span');
        if(label?.textContent==='Schulter Höhe')label.textContent='Arm/Schulter Höhe';
        if(label?.textContent==='Schulter Breite')label.textContent='Arm/Schulter Breite';
      }
    }
    return true;
  }

  // --------------------------------------------------------------------------
  // 8) Guided test release migration + reliable full-UI screenshot on iOS.
  //    The old foreignObject/SVG path is replaced by html2canvas, with a freshly
  //    rasterized WebGL frame temporarily overlaid so the 3D scene is included.
  // --------------------------------------------------------------------------
  const GUIDE_BUILD='V3.5.3 SURFACE CLEANUP + MIDPOINT RESET';
  const GUIDE_OLD_BUILD='V3.5.2 OUTSIDE + REPORT IMAGE';
  const GUIDE_DB='HarnessDesignerV3Tests',GUIDE_STORE='screenshots';

  function archiveOldGuideRunV353(api){
    const migrationKey='HD_V353_GUIDE_MIGRATED';
    if(localStorage.getItem(migrationKey))return false;
    const oldRunKey='hd:v3:testRun:'+GUIDE_OLD_BUILD;
    const raw=localStorage.getItem(oldRunKey);
    if(raw){
      try{
        const run=JSON.parse(raw);
        const h=JSON.parse(localStorage.getItem('hd:v3:testHistory')||'{}');
        h[GUIDE_OLD_BUILD]={...run,build:GUIDE_OLD_BUILD,base:api?.RELEASE?.base||BASE};
        localStorage.setItem('hd:v3:testHistory',JSON.stringify(h));
      }catch(e){}
      localStorage.removeItem(oldRunKey);
      localStorage.removeItem(GUIDE_OLD_BUILD+':guided-index');
      localStorage.setItem(migrationKey,'1');
      return true;
    }
    localStorage.setItem(migrationKey,'1');
    return false;
  }

  function openGuideDbV353(){
    return new Promise((resolve,reject)=>{
      const req=indexedDB.open(GUIDE_DB,1);
      req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(GUIDE_STORE))req.result.createObjectStore(GUIDE_STORE)};
      req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
    });
  }

  async function listGuideShotsV353(id){
    const db=await openGuideDbV353();
    const prefix=GUIDE_BUILD+':'+id+':';
    return new Promise((resolve,reject)=>{
      const out=[];
      const req=db.transaction(GUIDE_STORE,'readonly').objectStore(GUIDE_STORE).openCursor();
      req.onsuccess=()=>{
        const cur=req.result;
        if(!cur){resolve(out.sort((a,b)=>a.key.localeCompare(b.key)));return}
        if(String(cur.key).startsWith(prefix))out.push({key:String(cur.key),blob:cur.value});
        cur.continue();
      };
      req.onerror=()=>reject(req.error);
    });
  }

  async function saveGuideShotV353(id,blob){
    const db=await openGuideDbV353();
    const existing=await listGuideShotsV353(id);
    const key=GUIDE_BUILD+':'+id+':'+String(existing.length+1).padStart(3,'0');
    await new Promise((resolve,reject)=>{
      const tx=db.transaction(GUIDE_STORE,'readwrite');
      tx.objectStore(GUIDE_STORE).put(blob,key);
      tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
    });
    return key;
  }

  async function deleteGuideShotV353(key){
    const db=await openGuideDbV353();
    await new Promise((resolve,reject)=>{
      const tx=db.transaction(GUIDE_STORE,'readwrite');
      tx.objectStore(GUIDE_STORE).delete(key);
      tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
    });
  }

  let html2CanvasPromiseV353=null;
  function loadHtml2CanvasV353(){
    if(window.html2canvas)return Promise.resolve(window.html2canvas);
    if(html2CanvasPromiseV353)return html2CanvasPromiseV353;
    html2CanvasPromiseV353=new Promise((resolve,reject)=>{
      const s=document.createElement('script');
      s.src='https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
      s.async=true;
      s.onload=()=>window.html2canvas?resolve(window.html2canvas):reject(new Error('html2canvas fehlt'));
      s.onerror=()=>reject(new Error('html2canvas konnte nicht geladen werden'));
      document.head.appendChild(s);
    });
    return html2CanvasPromiseV353;
  }

  const nextFramesV353=(n=2)=>new Promise(resolve=>{
    const step=()=>{if(--n<=0)resolve();else requestAnimationFrame(step)};
    requestAnimationFrame(step);
  });

  async function captureFullUIV353(){
    const sceneCanvas=document.querySelector('#scene,canvas');
    if(!sceneCanvas)throw new Error('Kein Canvas');
    try{renderer.render(scene,camera)}catch(e){}
    await nextFramesV353(2);
    try{renderer.render(scene,camera)}catch(e){}

    const sceneBlob=await new Promise((resolve,reject)=>{
      try{sceneCanvas.toBlob(b=>b&&b.size>1000?resolve(b):reject(new Error('3D-Bild leer')),'image/jpeg',.90)}
      catch(e){reject(e)}
    });
    const sceneUrl=URL.createObjectURL(sceneBlob);
    const r=sceneCanvas.getBoundingClientRect();
    const overlay=document.createElement('img');
    overlay.src=sceneUrl;
    overlay.setAttribute('data-v353-scene-overlay','1');
    Object.assign(overlay.style,{
      position:'fixed',left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px',
      objectFit:'fill',zIndex:'1',pointerEvents:'none',margin:'0',padding:'0',border:'0'
    });
    document.body.appendChild(overlay);

    try{
      const html2canvas=await loadHtml2CanvasV353();
      await nextFramesV353(1);
      const w=Math.max(320,window.innerWidth),h=Math.max(320,window.innerHeight);
      const scale=Math.min(2,1400/w);
      const out=await html2canvas(document.body,{
        backgroundColor:'#090a0d',
        width:w,height:h,windowWidth:w,windowHeight:h,
        scrollX:0,scrollY:0,scale,
        useCORS:true,allowTaint:false,logging:false,
        imageTimeout:3500
      });
      return await new Promise((resolve,reject)=>out.toBlob(b=>b&&b.size>1000?resolve(b):reject(new Error('UI Screenshot leer')),'image/jpeg',.88));
    }finally{
      overlay.remove();
      URL.revokeObjectURL(sceneUrl);
    }
  }

  function currentGuideIdV353(api){
    const title=document.querySelector('#v3Guide .title')?.textContent||'';
    for(const [id,t] of Object.entries(api?.TESTS||{}))if(t?.title===title)return id;
    return 'shotUI';
  }

  async function appendShotPreviewV353(id,key,blob){
    const g=document.getElementById('v3Guide');if(!g)return;
    const wrap=g.querySelector('#v3ShotWrap'),gallery=g.querySelector('.shotGallery'),meta=g.querySelector('#v3ShotMeta span');
    if(!gallery)return;
    if(wrap)wrap.style.display='block';
    const tile=document.createElement('div');tile.className='shotTile';
    const img=document.createElement('img');const url=URL.createObjectURL(blob);img.src=url;
    const del=document.createElement('button');del.type='button';del.textContent='×';
    del.onclick=async()=>{try{await deleteGuideShotV353(key)}catch(e){}URL.revokeObjectURL(url);tile.remove();const n=gallery.children.length;if(meta)meta.textContent='📷 '+n+' Screenshot'+(n===1?'':'s')+' gespeichert'};
    tile.append(img,del);gallery.append(tile);
    const n=gallery.children.length;
    if(meta)meta.textContent='📷 '+n+' Screenshot'+(n===1?'':'s')+' gespeichert';
    const shotBtn=g.querySelector('.shot');if(shotBtn)shotBtn.textContent='📷 Weiteren Screenshot';
  }

  function patchGuidedTestV353(){
    const api=window.HDV3GuidedTest;
    if(!api?.RELEASE||!api?.TESTS)return false;

    if(archiveOldGuideRunV353(api)){
      // One clean reload prevents V3.5.2 answers already held in the old closure
      // from being relabelled as V3.5.3.
      location.reload();
      return true;
    }

    api.RELEASE.build=GUIDE_BUILD;
    api.RELEASE.base=BASE;
    if(api.TESTS.build)api.TESTS.build.instruction='Unten rechts muss nur V3.5.3 stehen. App, Mannequin und bestehende UI müssen normal starten.';
    if(api.TESTS.outsideShoulder)api.TESTS.outsideShoulder.instruction='Brust/Schulter testen. Adaptive muss in der Brustregion sichtbar dichter werden, ohne unnötig den ganzen Körper auf High zu rechnen.';
    if(api.TESTS.outsideHead)api.TESTS.outsideHead.instruction='Kopf testen. Augenhöhlen und Mundinnenraum dürfen die Riemenroute nicht mehr in Hohlräume ziehen; die äußere Kopfhülle muss geschlossen wirken.';
    if(api.TESTS.quality)api.TESTS.quality.instruction='Riemen >20 mm testen. Zusätzlich zu den Kanten muss die Mittellinie Körperkontakt prüfen, damit der Körper nicht durch die Riemenmitte clippt.';
    if(api.TESTS.zoneSurface)api.TESTS.zoneSurface.instruction='Zonen kalibrieren und Arm/Schulter-Grenze verschieben. Schulter-Regler müssen die gesamte Armgrenze bewegen, nicht nur das letzte Segment.';
    if(api.TESTS.toolbox)api.TESTS.toolbox.instruction='Kleines Werkzeug-Icon öffnen. Debug-Tools und Mannequin-Anpassungen müssen dort gemeinsam erreichbar sein; keine zusätzlichen Versionsblöcke.';
    if(api.TESTS.shotUI)api.TESTS.shotUI.instruction='Komplette UI aufnehmen. Canvas und sichtbare Bedienoberfläche müssen auf iPhone/Safari gemeinsam im Screenshot gespeichert werden.';

    const uiBtn=document.querySelector('#v3Guide .shotui');
    if(uiBtn&&!uiBtn.dataset.v353Patched){
      uiBtn.dataset.v353Patched='1';
      uiBtn.onclick=async()=>{
        const g=document.getElementById('v3Guide');
        const note=g?.querySelector('.note');
        note?.dispatchEvent(new Event('change',{bubbles:true}));
        const id=currentGuideIdV353(api);
        uiBtn.textContent='Aufnahme…';
        try{
          const blob=await captureFullUIV353();
          const key=await saveGuideShotV353(id,blob);
          await appendShotPreviewV353(id,key,blob);
          const choice=g?.querySelector('.captureChoice');if(choice)choice.hidden=true;
          uiBtn.textContent='Komplette UI';
        }catch(e){
          console.warn('[V3.5.3] UI screenshot failed',e);
          uiBtn.textContent='UI fehlgeschlagen';
          setTimeout(()=>{uiBtn.textContent='Komplette UI'},1400);
        }
      };
    }
    return true;
  }

  function initV353(){
    cleanupAndCombineUIV353();
    patchGuidedTestV353();

    // Zone sheet can be created later, so keep its labels in sync when opened.
    const oldOpen=openZoneCalibrationSheetV351;
    if(!oldOpen._v353Wrapped){
      const wrapped=function(){
        const r=oldOpen.apply(this,arguments);
        setTimeout(cleanupAndCombineUIV353,0);
        return r;
      };
      wrapped._v353Wrapped=true;
      openZoneCalibrationSheetV351=wrapped;
    }

    console.info('[V3.5.3] patch active',BUILD,'base',BASE);
  }

  // v3-80 creates the toolbox via setTimeout(0); v3-95 mounts the guide directly.
  // A short deferred init keeps this patch independent of scheduling details.
  setTimeout(initV353,60);
  setTimeout(()=>{cleanupAndCombineUIV353();patchGuidedTestV353()},220);
})();
