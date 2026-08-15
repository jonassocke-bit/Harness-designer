(()=>{
  'use strict';
  const BUILD='V3.5.4 CLEAN ROUTING + UI DOCK';

  // ------------------------------------------------------------------------
  // 1) Visible strip: smooth over left / center / right curves.
  //    At t=0/1, translate the entire cross-section so its MIDPOINT is
  //    exactly the ring center. Width is preserved, longitudinal overshoot is not.
  // ------------------------------------------------------------------------
  const updateDirectStripGeometryBaseV354=updateDirectStripGeometry;
  updateDirectStripGeometry=function(s){
    if(!s?.methodRoute?.length)return updateDirectStripGeometryBaseV354(s);

    const route=s.methodRoute.slice().sort((a,b)=>(a.t??0)-(b.t??0));
    if(route.length<2)return updateDirectStripGeometryBaseV354(s);

    const leftPts=route.map(g=>g.stripLeft.clone());
    const rightPts=route.map(g=>g.stripRight.clone());
    const centerPts=route.map(g=>
      (g.center?.clone?.()||g.stripLeft.clone().lerp(g.stripRight,.5))
    );

    const lc=leftPts.length>2?new THREE.CatmullRomCurve3(leftPts,false,'centripetal',.35):null;
    const cc=centerPts.length>2?new THREE.CatmullRomCurve3(centerPts,false,'centripetal',.35):null;
    const rc=rightPts.length>2?new THREE.CatmullRomCurve3(rightPts,false,'centripetal',.35):null;

    const pos=s.geometry.getAttribute('position'),halfT=.0045;
    const sections=[];
    const aNode=nodes.get(s.a),bNode=nodes.get(s.b);
    const A=aNode?nodeWorldPosition(aNode):centerPts[0].clone();
    const B=bNode?nodeWorldPosition(bNode):centerPts[centerPts.length-1].clone();
    let prevSide=null,prevNormal=null;

    const sample=(curve,pts,t)=>curve?curve.getPoint(t):(
      t<=0?pts[0].clone():t>=1?pts[pts.length-1].clone():
      pts[Math.min(pts.length-1,Math.round(t*(pts.length-1)))].clone()
    );

    for(let i=0;i<=STRAP_SAMPLES;i++){
      const t=i/STRAP_SAMPLES;
      let lb=sample(lc,leftPts,t), rb=sample(rc,rightPts,t);
      let center=sample(cc,centerPts,t);

      // Reconstruct the cross-section around the smoothed center curve.
      let side=rb.clone().sub(lb);
      const width=side.length();
      if(side.lengthSq()<1e-10)side=prevSide?.clone()||strapFrame(s).side.clone();
      side.normalize();
      if(prevSide&&side.dot(prevSide)<0)side.negate();

      if(width>1e-8){
        lb=center.clone().addScaledVector(side,-width*.5);
        rb=center.clone().addScaledVector(side, width*.5);
      }

      // Hard stop at ring centers. Translate, never collapse width.
      if(i===0){
        const mid=lb.clone().lerp(rb,.5),delta=A.clone().sub(mid);
        lb.add(delta);rb.add(delta);center.copy(A);
      }else if(i===STRAP_SAMPLES){
        const mid=lb.clone().lerp(rb,.5),delta=B.clone().sub(mid);
        lb.add(delta);rb.add(delta);center.copy(B);
      }

      const eps=1/STRAP_SAMPLES;
      const p0=sample(cc,centerPts,Math.max(0,t-eps));
      const p1=sample(cc,centerPts,Math.min(1,t+eps));
      let tangent=p1.sub(p0);
      if(tangent.lengthSq()<1e-10)tangent=strapFrame(s).tangent.clone();
      tangent.normalize();

      let normal=new THREE.Vector3().crossVectors(tangent,side);
      if(normal.lengthSq()<1e-10)normal=prevNormal?.clone()||strapFrame(s).normal.clone();
      normal.normalize();

      const source=stripRouteAt(route,t);
      if(source?.normal&&normal.dot(source.normal)<0){normal.negate();side.negate()}
      if(prevNormal&&normal.dot(prevNormal)<0){normal.negate();side.negate()}

      prevSide=side.clone();prevNormal=normal.clone();

      const lt=lb.clone().addScaledVector(normal,halfT*2);
      const rt=rb.clone().addScaledVector(normal,halfT*2);
      const verts=[lb,rb,lt,rt];
      for(let k=0;k<4;k++)pos.setXYZ(i*4+k,verts[k].x,verts[k].y,verts[k].z);
      sections.push({lb,rb,lt,rt});
    }

    setAdaptiveStripIndices(s,sections);
    pos.needsUpdate=true;
    s.geometry.computeVertexNormals();
    s.geometry.computeBoundingSphere();
    return true;
  };

  // ------------------------------------------------------------------------
  // 2) Complexity:
  //    Keep the automatic model analysis, but make the torso less noisy.
  //    Add a modest chest prior; shoulder / zone boundaries remain decisive.
  // ------------------------------------------------------------------------
  const bodyComplexityAtBaseV354=bodyComplexityAtV351;
  bodyComplexityAtV351=function(p){
    const raw=bodyComplexityAtBaseV354(p);
    const box=getBodyBoundsV344(),c=box.getCenter(new THREE.Vector3()),sz=box.getSize(new THREE.Vector3());
    const x=(p.x-c.x)/(sz.x||1),y=(p.y-c.y)/(sz.y||1);
    let zone='torso';try{zone=classifyBodyZoneWorldPoint(p)}catch(e){}

    if(zone!=='torso')return raw;

    // Torso can be solved more cheaply in general.
    let v=Math.min(raw,.38);

    // Chest gets a stable medium floor rather than noisy whole-torso complexity.
    if(y>.035&&y<.235&&Math.abs(x)<.235)v=Math.max(v,.44);

    // Existing boundary complexity can still push shoulder / neck / groin higher.
    try{v=Math.max(v,bodyZoneBoundaryComplexityV351(p)*.88)}catch(e){}
    return THREE.MathUtils.clamp(v,0,1);
  };

  // Adaptive: permit a little more density only where complexity is genuinely high.
  if(typeof adaptiveRefineTsV351==='function'){
    const adaptiveRefineBaseV354=adaptiveRefineTsV351;
    adaptiveRefineTsV351=function(route){
      const ts=new Set(adaptiveRefineBaseV354(route));
      for(let i=0;i<route.length-1&&ts.size<40;i++){
        const a=route[i],b=route[i+1];
        if(Math.max(a.complexity||0,b.complexity||0)>.60){
          ts.add((a.t+b.t)*.5);
        }
      }
      return [...ts].sort((a,b)=>a-b);
    };
  }

  // ------------------------------------------------------------------------
  // 3) Complexity surface overlay. Analysis remains sparse/cached internally,
  //    visualization colors the actual mannequin triangles.
  // ------------------------------------------------------------------------
  rebuildBodyComplexityDebugV351=function(){
    clearBodyComplexityDebugV351();
    if(!bodyComplexityDebugV351)return;
    const group=new THREE.Group(),tmpColor=new THREE.Color();

    for(const src of bodyMeshes){
      const pos=src.geometry?.attributes?.position;if(!pos)continue;
      const geo=src.geometry.clone();
      const colors=new Float32Array(pos.count*3);
      src.updateWorldMatrix(true,false);

      for(let i=0;i<pos.count;i++){
        const p=new THREE.Vector3().fromBufferAttribute(pos,i).applyMatrix4(src.matrixWorld);
        const q=bodyComplexityAtV351(p);
        // blue -> cyan/green -> yellow -> red
        if(q<.33)tmpColor.setHSL(.62-q*.55,.92,.52);
        else if(q<.66)tmpColor.setHSL(.38-(q-.33)*.72,.94,.51);
        else tmpColor.setHSL(.14-(q-.66)*.39,.95,.50);
        colors[i*3]=tmpColor.r;colors[i*3+1]=tmpColor.g;colors[i*3+2]=tmpColor.b;
      }

      geo.setAttribute('color',new THREE.BufferAttribute(colors,3));
      const mat=new THREE.MeshBasicMaterial({
        vertexColors:true,transparent:true,opacity:.70,depthWrite:false,
        side:THREE.DoubleSide
      });
      const mesh=new THREE.Mesh(geo,mat);
      mesh.matrix.copy(src.matrixWorld);mesh.matrixAutoUpdate=false;mesh.renderOrder=124;
      group.add(mesh);
    }
    helperRoot.add(group);bodyComplexityDebugGroupV351=group;
  };

  // ------------------------------------------------------------------------
  // 4) Zone surface overlay already exists in V3.5.2. Fix arm calibration:
  //    classify using a broad smooth shoulder->armpit transition.
  // ------------------------------------------------------------------------
  const classifyBodyZoneBaseV354=classifyBodyZoneWorldPoint;
  classifyBodyZoneWorldPoint=function(p){
    const base=classifyBodyZoneBaseV354(p);
    const box=getBodyBoundsV344(),c=box.getCenter(new THREE.Vector3()),sz=box.getSize(new THREE.Vector3());
    const x=(p.x-c.x)/(sz.x||1),y=(p.y-c.y)/(sz.y||1),ax=Math.abs(x);
    const lm=computeBodyZoneLandmarksV348();

    if(y>lm.neckY)return 'head';

    const low=lm.armpitY-.055,high=lm.shoulderY+.025;
    const k=THREE.MathUtils.clamp((y-low)/Math.max(.001,high-low),0,1);
    const smooth=k*k*(3-2*k);
    const boundary=THREE.MathUtils.lerp(lm.armpitX,lm.shoulderX,smooth);
    if(y>low&&ax>boundary)return x<0?'armL':'armR';

    const legCut=lm.groinY+THREE.MathUtils.clamp(ax/.30,0,1)*lm.vDepth;
    if(y<legCut)return x<0?'legL':'legR';
    return 'torso';
  };

  // ------------------------------------------------------------------------
  // 5) Toolbox: tiny collapsed launcher, dock left/right, no dead side strip.
  // ------------------------------------------------------------------------
  function patchToolboxV354(){
    const el=document.getElementById('v344Tools');if(!el)return false;
    el.classList.add('v354Tools');

    const header=el.querySelector('.v344Header');
    const title=el.querySelector('.v344Title');
    if(title)title.textContent='';

    let dock=localStorage.getItem('HD_V354_TOOL_DOCK')||'left';
    const applyDock=()=>{
      el.classList.toggle('dockRight',dock==='right');
      el.classList.toggle('dockLeft',dock!=='right');
      el.style.left=dock==='right'?'auto':'6px';
      el.style.right=dock==='right'?'6px':'auto';
    };

    let dockBtn=el.querySelector('.v354Dock');
    if(!dockBtn){
      dockBtn=document.createElement('button');
      dockBtn.className='v354Dock';dockBtn.type='button';dockBtn.textContent='⇆';
      dockBtn.setAttribute('aria-label','Toolbox links/rechts andocken');
      header?.insertBefore(dockBtn,header.querySelector('.v344Collapse'));
    }
    dockBtn.onclick=e=>{
      e.stopPropagation();
      dock=dock==='right'?'left':'right';
      localStorage.setItem('HD_V354_TOOL_DOCK',dock);
      applyDock();
    };

    const collapse=el.querySelector('.v344Collapse');
    const sync=()=>{
      const closed=el.classList.contains('collapsed');
      if(collapse)collapse.textContent=closed?'☰':'−';
    };
    collapse?.addEventListener('click',()=>requestAnimationFrame(sync));
    applyDock();sync();

    // Default to collapsed once for V3.5.4.
    if(!localStorage.getItem('HD_V354_TOOL_INIT')){
      localStorage.setItem('HD_V354_TOOL_INIT','1');
      el.classList.add('collapsed');sync();
    }
    return true;
  }

  function injectV354Styles(){
    if(document.getElementById('v354Styles'))return;
    const st=document.createElement('style');st.id='v354Styles';
    st.textContent=`
      #v344Tools.v354Tools{
        width:min(250px,calc(100vw - 12px))!important;
        max-width:calc(100vw - 12px)!important;
        box-sizing:border-box!important;
      }
      #v344Tools.v354Tools .v344Body{
        grid-template-columns:repeat(2,minmax(0,1fr))!important;
        overflow-x:hidden!important;
      }
      #v344Tools.v354Tools button,#v344Tools.v354Tools select{
        min-width:0!important;max-width:100%!important;box-sizing:border-box!important
      }
      #v344Tools.v354Tools.collapsed{
        width:42px!important;min-width:42px!important;height:42px!important;
        border-radius:14px!important;overflow:hidden!important
      }
      #v344Tools.v354Tools.collapsed .v344Body{display:none!important}
      #v344Tools.v354Tools.collapsed .v344Header{
        width:42px!important;height:42px!important;min-height:42px!important;padding:0!important;
        display:flex!important;align-items:center!important;justify-content:center!important
      }
      #v344Tools.v354Tools.collapsed .v344Title,
      #v344Tools.v354Tools.collapsed .v354Dock{display:none!important}
      #v344Tools.v354Tools.collapsed .v344Collapse{
        display:block!important;width:42px!important;height:42px!important;
        border:0!important;background:transparent!important;font-size:20px!important
      }
      #v344Tools.v354Tools.dockLeft{left:6px!important;right:auto!important}
      #v344Tools.v354Tools.dockRight{right:6px!important;left:auto!important}
    `;
    document.head.appendChild(st);
  }

  // ------------------------------------------------------------------------
  // 6) Guide metadata: V3.5.3 patch mutates existing test ids. V3.5.4 has a
  //    deliberately short new list, so only update release metadata.
  // ------------------------------------------------------------------------
  function patchGuideMetaV354(){
    const api=window.HDV3GuidedTest;if(!api?.RELEASE)return false;
    api.RELEASE.build=BUILD;
    api.RELEASE.base='V3.5.3 SURFACE CLEANUP + MIDPOINT RESET';
    return true;
  }

  injectV354Styles();
  let tries=0;
  const timer=setInterval(()=>{
    patchToolboxV354();
    patchGuideMetaV354();
    if(++tries>40)clearInterval(timer);
  },100);
})();