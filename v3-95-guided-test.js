// ============================================================================
// V3.4.0 STRAP ROUTING REBUILD
// Test-only layer. Golden Harness Designer logic above remains untouched.
// ============================================================================
(function(){
  'use strict';
  const RELEASE={build:'V3.4.4b BOOT FIX',base:'V3.4.2 UNIFIED STRAP GUIDE'};

  const TESTS={
    build:{title:'1 · Build',instruction:'Unten muss V3.4.4 · Zones + Radial stehen.',golden:'pass'},
    zones:{title:'2 · Körperzonen beurteilen',instruction:'Zonen einschalten. Bitte Torso/Kopf/Arme/Beine beurteilen – besonders Schulter, Achsel, Hals und Becken. Screenshot bei jeder Grenze, die du anders ziehen würdest.',golden:'known'},
    torso:{title:'3 · Torso → Torso',instruction:'Zwei Ringe am Torso verbinden. Projektion darf nicht auf Arme, Kopf oder Beine springen.',golden:'known'},
    cross:{title:'4 · Torso → Arm',instruction:'Torso mit einem Arm verbinden. Solver darf nur beteiligte Endzonen und ggf. explizite Guide-Zone benutzen.',golden:'known'},
    radial:{title:'5 · Radiale Abstandslinien',instruction:'Debug Schritt 3: Abstandslinien sollen von einem gemeinsamen lokalen Zentrum auffächern und nicht parallel am Körper entlanglaufen.',golden:'known'},
    ring:{title:'6 · Ringanschlüsse',instruction:'Flache Ringe unterschiedlich positionieren. Prüfen, ob Start/Ende nachvollziehbar aus der Ringlage kommen.',golden:'known'},
    guide:{title:'7 · Guide Schulter → Achsel',instruction:'Guide verschieben und finalen Solve prüfen. Route soll nachvollziehbar reagieren.',golden:'known'},
    hitbox:{title:'8 · Hitboxen',instruction:'Hitboxen einschalten: Cyan Ringe, Gelb Riemen, Magenta Guide, Grün Flächen, Orange Snap/Merge. Durch Mannequin sichtbar.',golden:'known'},
    zoom:{title:'9 · Deep Zoom',instruction:'Sehr weit hineinzoomen. Alte Nahgrenze darf nicht mehr stoppen.',golden:'known'},
    save:{title:'10 · Save / Load',instruction:'Design speichern, verändern, wieder laden. Zustand muss zurückkehren.',golden:'known'},
    code:{title:'11 · Design-Code',instruction:'Code kopieren, Design verändern, Code laden. Konstruktion muss wiederhergestellt werden.',golden:'known'},
    backPan:{title:'12 · Zwei-Finger-Pan Rückseite',instruction:'Vorder-/Rückseite prüfen: links/rechts soll aus Bildschirmsicht gleich reagieren.',golden:'known'},
    regression:{title:'13 · Riemen Regression',instruction:'Mehrere normale Direct-/Guided-Riemen bauen und Stabilität mit V3.4.3 vergleichen.',golden:'known'},
    perf:{title:'14 · Performance',instruction:'Zonen/Hitboxen ausschalten und mehrere Riemen bauen.',golden:'known'},
    finalPage:{title:'15 · Abschluss',instruction:'Report mit Gesamtkommentar exportieren.',golden:'pass'}
  };

  const QUEUE=Object.keys(TESTS);
  const RUN_KEY='hd:v3:testRun:'+RELEASE.build;
  const HISTORY_KEY='hd:v3:testHistory';
  const DB_NAME='HarnessDesignerV3Tests',DB_STORE='screenshots';

  let run={results:{},startedAt:null,complete:false};
  const INDEX_KEY=RELEASE.build+':guided-index';
  let index=Math.max(0,Math.min(QUEUE.length-1,Number(localStorage.getItem(INDEX_KEY)||0)));
  const saveIndex=()=>{try{localStorage.setItem(INDEX_KEY,String(index))}catch(e){}};
  try{const x=JSON.parse(localStorage.getItem(RUN_KEY)||'null');if(x&&x.results)run=x}catch(e){}
  const save=()=>{try{localStorage.setItem(RUN_KEY,JSON.stringify(run))}catch(e){}};
  const saveHistory=()=>{try{const h=JSON.parse(localStorage.getItem(HISTORY_KEY)||'{}');h[RELEASE.build]={...run,build:RELEASE.build,base:RELEASE.base};localStorage.setItem(HISTORY_KEY,JSON.stringify(h))}catch(e){}};

  function logText(){
    return RELEASE.build+'\nBase: '+RELEASE.base+'\n\n'+QUEUE.map(id=>{
      const t=TESTS[id],r=run.results[id];
      const icon=r?.status==='pass'?'✓':r?.status==='fail'?'✕':r?.status==='skip'?'→':'?';
      return icon+' '+t.title+(t.golden==='known'?' [KNOWN]':'')+(r?.note?' — '+r.note:'');
    }).join('\n');
  }

  async function copyText(text){
    try{if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);return true}}catch(e){}
    try{const ta=document.createElement('textarea');ta.value=text;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();const ok=document.execCommand('copy');ta.remove();return ok}catch(e){return false}
  }

  // Lazy screenshot DB.
  function openDb(){
    return new Promise((resolve,reject)=>{
      const req=indexedDB.open(DB_NAME,1);
      req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(DB_STORE))req.result.createObjectStore(DB_STORE)};
      req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
    });
  }
  const shotPrefix=id=>RELEASE.build+':'+id+':';

  async function listShots(id){
    try{
      const db=await openDb();
      return await new Promise((resolve,reject)=>{
        const found=[];
        const req=db.transaction(DB_STORE,'readonly').objectStore(DB_STORE).openCursor();
        req.onsuccess=()=>{
          const cur=req.result;
          if(!cur){resolve(found.sort((a,b)=>a.key.localeCompare(b.key)));return}
          if(String(cur.key).startsWith(shotPrefix(id)))found.push({key:String(cur.key),blob:cur.value});
          cur.continue();
        };
        req.onerror=()=>reject(req.error);
      });
    }catch(e){return []}
  }
  async function putShot(id,blob){
    const db=await openDb();
    const existing=await listShots(id);
    const key=shotPrefix(id)+String(existing.length+1).padStart(3,'0');
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(DB_STORE,'readwrite');
      tx.objectStore(DB_STORE).put(blob,key);
      tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);
    });
  }
  async function deleteShotKey(key){
    try{
      const db=await openDb();
      await new Promise((resolve,reject)=>{
        const tx=db.transaction(DB_STORE,'readwrite');
        tx.objectStore(DB_STORE).delete(key);
        tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
      });
    }catch(e){}
  }
  const dataUrl=blob=>new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(blob)});

  async function capture(id){
    const canvas=document.querySelector('canvas');
    if(!canvas)throw new Error('Kein Canvas');

    // Force a real WebGL render immediately before capture.
    // We intentionally allow a short pause here for reliability.
    try{
      if(typeof renderer!=='undefined' && typeof scene!=='undefined' && typeof camera!=='undefined'){
        renderer.render(scene,camera);
      }else if(window.HD?.App?.renderer && window.HD?.App?.scene && window.HD?.App?.camera){
        window.HD.App.renderer.render(window.HD.App.scene,window.HD.App.camera);
      }
    }catch(e){}

    // Give Safari/WebGL time to present the freshly rendered frame.
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    await new Promise(r=>setTimeout(r,120));

    // Render once more directly before reading the canvas.
    try{
      if(typeof renderer!=='undefined' && typeof scene!=='undefined' && typeof camera!=='undefined'){
        renderer.render(scene,camera);
      }else if(window.HD?.App?.renderer && window.HD?.App?.scene && window.HD?.App?.camera){
        window.HD.App.renderer.render(window.HD.App.scene,window.HD.App.camera);
      }
    }catch(e){}

    const blob=await new Promise((resolve,reject)=>{
      try{
        canvas.toBlob(
          b=>b&&b.size>1000?resolve(b):reject(new Error('Screenshot leer oder zu klein')),
          'image/jpeg',
          .9
        );
      }catch(e){reject(e)}
    });

    // Detect an all-black capture cheaply before saving.
    try{
      const probe=document.createElement('canvas');
      probe.width=32;probe.height=32;
      const ctx=probe.getContext('2d',{willReadFrequently:true});
      ctx.drawImage(canvas,0,0,32,32);
      const d=ctx.getImageData(0,0,32,32).data;
      let sum=0;
      for(let i=0;i<d.length;i+=4)sum+=d[i]+d[i+1]+d[i+2];
      if(sum<32*32*3*2)throw new Error('Screenshot ist schwarz');
    }catch(e){
      if(String(e?.message||e).includes('schwarz'))throw e;
    }

    await putShot(id,blob);
    return blob;
  }

  async function exportReport(){
    let sections='';
    for(const id of QUEUE){
      const t=TESTS[id],r=run.results[id],shots=await listShots(id);
      let images='';
      for(let i=0;i<shots.length;i++){
        images+=`<img src="${await dataUrl(shots[i].blob)}" alt="Screenshot ${i+1} ${escapeHtml(t.title)}">`;
      }
      sections+=`<section>
        <h2>${escapeHtml(t.title)}</h2>
        <p><b>Status:</b> ${escapeHtml(r?.status||'ungetestet')}${t.golden==='known'?' · KNOWN':''}</p>
        ${t.known?`<p><b>Golden:</b> ${escapeHtml(t.known)}</p>`:''}
        ${r?.note?`<p><b>Kommentar:</b> ${escapeHtml(r.note)}</p>`:''}
        ${images}
      </section>`;
    }
    const doc=`<!doctype html><meta charset="utf-8"><title>${RELEASE.build}</title>
      <style>body{font:14px system-ui;max-width:900px;margin:auto;padding:24px}pre{white-space:pre-wrap;background:#f4f4f4;padding:12px}section{padding:16px 0;border-bottom:1px solid #ccc}img{display:block;max-width:100%;max-height:700px;margin-top:10px;border:1px solid #999}</style>
      <h1>${RELEASE.build}</h1><pre>${escapeHtml(logText())}</pre>${run.overallNote?`<section><h2>Gesamtkommentar</h2><p>${escapeHtml(run.overallNote).replace(/\n/g,'<br>')}</p></section>`:''}${sections}`;
    const blob=new Blob([doc],{type:'text/html'});
    const u=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=u;a.download='Harness-Designer-'+RELEASE.build.replace(/\s+/g,'-')+'-report.html';
    a.click();setTimeout(()=>URL.revokeObjectURL(u),2000);
  }

  const escapeHtml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function mount(){
    const btn=document.createElement('button');btn.id='v3TestBtn';btn.textContent='TEST';
    const g=document.createElement('div');g.id='v3Guide';
    g.innerHTML='<div class="head"><span class="count"></span><span class="title"></span><button class="close">×</button></div><div class="instruction"></div><div class="known"></div><div class="actions"><button class="pass">✓ Funktioniert</button><button class="fail">✕ Fehler</button><button class="skip">Skip</button></div><textarea class="note" rows="4" placeholder="Kommentar / Fehlerbeschreibung…"></textarea><div id="v3ShotWrap"><div class="shotGallery"></div><div id="v3ShotMeta"><span>📷 Screenshots gespeichert</span></div></div><div class="nav"><button class="prev">← Zurück</button><button class="next">Weiter →</button><button class="shot">📷 Screenshot</button></div>';
    const summary=document.createElement('div');summary.id='v3GuideSummary';
    document.body.append(btn,g,summary);
    const $=q=>g.querySelector(q);
    let previewUrls=[];

    async function render(){
      summary.style.display='none';
      if(index>=QUEUE.length){showSummary();return}
      const id=QUEUE[index],t=TESTS[id],r=run.results[id]||{};
      $('.count').textContent=(index+1)+'/'+QUEUE.length;$('.title').textContent=t.title;$('.instruction').textContent=t.instruction;
      $('.known').textContent=t.known||'';$('.known').style.display=t.known?'block':'none';
      $('.note').value=r.note||'';$('.prev').disabled=index===0;$('.next').disabled=index===QUEUE.length-1;
      ['pass','fail','skip'].forEach(k=>$('.'+k).classList.toggle('activeAnswer',r.status===k));

      for(const u of previewUrls)URL.revokeObjectURL(u);previewUrls=[];
      const shots=await listShots(id);
      const gallery=$('.shotGallery');gallery.innerHTML='';
      if(shots.length){
        $('#v3ShotWrap').style.display='block';
        $('#v3ShotMeta span').textContent='📷 '+shots.length+' Screenshot'+(shots.length===1?'':'s')+' gespeichert';
        for(const sh of shots){
          const tile=document.createElement('div');tile.className='shotTile';
          const img=document.createElement('img');const url=URL.createObjectURL(sh.blob);previewUrls.push(url);img.src=url;
          const del=document.createElement('button');del.type='button';del.textContent='×';
          del.onclick=async()=>{await deleteShotKey(sh.key);await render()};
          tile.append(img,del);gallery.append(tile);
        }
        $('.shot').textContent='📷 Weiteren Screenshot';
      }else{
        $('#v3ShotWrap').style.display='none';
        $('.shot').textContent='📷 Screenshot';
      }
      g.style.display='block';
    }

    function record(status){
      const id=QUEUE[index];
      run.results[id]={status,note:$('.note').value.trim(),at:new Date().toISOString()};
      save();
      const allAnswered=QUEUE.every(q=>!!run.results[q]?.status);
      if(index===QUEUE.length-1&&allAnswered){showSummary();return}
      index=(index+1)%QUEUE.length;saveIndex();
      render();
    }

    async function showSummary(){
      g.style.display='none';run.complete=true;save();saveHistory();
      summary.innerHTML='<div class="log"></div><textarea class="overallNote" rows="7" placeholder="Gesamtkommentar / Fazit zum Test…"></textarea><div class="summaryActions"><button class="copy">Log kopieren</button><button class="export">Report + Bilder</button><button class="back">← Letzte Frage</button><button class="closeSum">Schließen</button></div>';
      summary.querySelector('.log').textContent=logText();
      summary.querySelector('.overallNote').value=run.overallNote||'';
      summary.querySelector('.overallNote').oninput=e=>{run.overallNote=e.target.value;save();summary.querySelector('.log').textContent=logText()};
      summary.style.display='block';
      summary.querySelector('.copy').onclick=async()=>{const ok=await copyText(logText());summary.querySelector('.copy').textContent=ok?'✓ Kopiert':'Kopieren fehlgeschlagen'};
      summary.querySelector('.export').onclick=async()=>{summary.querySelector('.export').textContent='Export…';try{await exportReport();summary.querySelector('.export').textContent='✓ Exportiert'}catch(e){summary.querySelector('.export').textContent='Export fehlgeschlagen'}};
      summary.querySelector('.back').onclick=()=>{index=QUEUE.length-1;render()};
      summary.querySelector('.closeSum').onclick=()=>summary.style.display='none';
    }

    $('.pass').onclick=()=>record('pass');$('.fail').onclick=()=>record('fail');$('.skip').onclick=()=>record('skip');
    $('.note').onchange=()=>{const id=QUEUE[index],r=run.results[id]||{};run.results[id]={...r,note:$('.note').value.trim()};save()};
    $('.prev').onclick=()=>{index=(index-1+QUEUE.length)%QUEUE.length;saveIndex();render()};
    $('.next').onclick=()=>{index=(index+1)%QUEUE.length;saveIndex();render()};
    $('.close').onclick=()=>{
      const id=QUEUE[index],r=run.results[id]||{};
      run.results[id]={...r,note:$('.note').value.trim()};save();saveIndex();g.style.display='none';
    };
    $('.shot').onclick=async()=>{
      const id=QUEUE[index];
      const existing=run.results[id]||{};
      run.results[id]={...existing,note:$('.note').value.trim()};
      save();
      $('.shot').textContent='Aufnahme…';
      try{await capture(id);await render()}
      catch(e){$('.shot').textContent='Screenshot fehlgeschlagen'}
    };

    btn.onclick=()=>{
      summary.style.display='none';
      if(!run.startedAt){run.startedAt=new Date().toISOString();save()}
      if(index<0||index>=QUEUE.length)index=0;
      saveIndex();render();
    };

    window.HDV3GuidedTest={RELEASE,TESTS,getRun:()=>JSON.parse(JSON.stringify(run)),getLog:logText,exportReport};
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
