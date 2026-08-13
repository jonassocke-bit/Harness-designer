// ============================================================================
// V3.1.0 MODULAR BASE
// Test-only layer. Golden Harness Designer logic above remains untouched.
// ============================================================================
(function(){
  'use strict';
  const RELEASE={build:'V3.1.0 MODULAR BASE',base:'V1.9f2 GOLDEN'};

  const TESTS={
    startup:{title:'App starten',instruction:'Mannequin und bekannte UI müssen vollständig sichtbar sein.',golden:'pass'},
    camera:{title:'Kamera testen',instruction:'Ein Finger drehen, zwei Finger zoomen.',golden:'pass'},
    ringCreate:{title:'Ring platzieren',instruction:'Setze irgendwo einen neuen Ring auf den Körper.',golden:'pass'},
    ringMove:{title:'Ring verschieben',instruction:'Ziehe den Ring über den Körper und lasse ihn los.',golden:'pass'},
    ringEdit:{title:'Ring bearbeiten',instruction:'Ändere Durchmesser und Ringstärke.',golden:'pass'},
    mirror:{title:'Ring spiegeln',instruction:'Erzeuge ein Spiegelpaar und bewege den Master.',golden:'pass'},
    axisSnap:{title:'Mittelachsen-Snap',instruction:'Ziehe ein Spiegelpaar zur Körpermitte.',golden:'pass'},
    genericSnap:{title:'Ring ↔ Ring Snap',instruction:'Ziehe zwei beliebige Ringe fast exakt übereinander.',golden:'known',known:'Golden: grundsätzlich möglich, aber kleine Ringe schwer zu treffen. Mehrfach-Merge/Finalisieren noch ungeklärt.'},
    connect:{title:'Riemen verbinden',instruction:'Verbinde zwei Ringe über „Verbinden“.',golden:'known',known:'Golden: funktioniert, aber Geometrie kann kantig und nicht gerade sein.'},
    strapPreview:{title:'Riemen-Preview',instruction:'Bewege einen Endring eines vorhandenen Riemens. Der Drag soll flüssig bleiben.',golden:'pass'},
    strapBasic:{title:'Einfacher Riemen',instruction:'Prüfe einen Riemen an einer relativ flachen Körperstelle.',golden:'known',known:'Golden: funktional, aber unnötig lange Ladezeit für einfache Geometrie.'},
    strapComplex:{title:'Riemen Brust / Schulter',instruction:'Prüfe einen Riemen über Brust oder Schulter aus mehreren Winkeln.',golden:'known',known:'Golden: Schlangenlinien, abgehackte Linienführung und teils Körperdurchdringung möglich.'},
    strapEndpoints:{title:'Riemen-Endpunkte',instruction:'Prüfe, ob der Riemen plausibel am sichtbaren Ring endet.',golden:'known',known:'Golden: Endpunkt kann teilweise über den Ring hinauslaufen.'},
    panelCreate:{title:'Fläche erstellen',instruction:'Erstelle aus mindestens drei Ringen eine Fläche.',golden:'known',known:'Golden: funktioniert schnell, an Ringen aber noch fransige Kante.'},
    panelComplex:{title:'Große Fläche',instruction:'Erzeuge eine größere Fläche über komplexer Körpergeometrie.',golden:'known',known:'Golden: kleine schmale winkelabhängige Dreiecksspalten bleiben, akzeptiert.'},
    panelSpeed:{title:'Flächen-Speed',instruction:'Erzeuge eine mittelgroße Fläche. Sie sollte praktisch sofort erscheinen.',golden:'pass'},
    undoRedo:{title:'Undo / Redo',instruction:'Mache eine Änderung rückgängig und stelle sie wieder her.',golden:'known',known:'Golden: funktional, bei viel Geometrie aber lange Ladezeiten.'},
    reload:{title:'Reload',instruction:'Lade die Seite neu. Die App muss erneut zuverlässig starten.',golden:'pass'},
    ui:{title:'UI bedienen',instruction:'Panel scrollen/ziehen und alle wichtigen Buttons erreichen.',golden:'pass'}
  };

  const QUEUE=Object.keys(TESTS);
  const RUN_KEY='hd:v3:testRun:'+RELEASE.build;
  const HISTORY_KEY='hd:v3:testHistory';
  const DB_NAME='HarnessDesignerV3Tests',DB_STORE='screenshots';

  let run={results:{},startedAt:null,complete:false},index=0;
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
  const shotKey=id=>RELEASE.build+':'+id;

  async function putShot(id,blob){
    const db=await openDb();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(DB_STORE,'readwrite');
      tx.objectStore(DB_STORE).put(blob,shotKey(id));
      tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);
    });
  }
  async function getShot(id){
    try{
      const db=await openDb();
      return await new Promise((resolve,reject)=>{
        const req=db.transaction(DB_STORE,'readonly').objectStore(DB_STORE).get(shotKey(id));
        req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error);
      });
    }catch(e){return null}
  }
  async function deleteShot(id){
    try{
      const db=await openDb();
      await new Promise((resolve,reject)=>{
        const tx=db.transaction(DB_STORE,'readwrite');tx.objectStore(DB_STORE).delete(shotKey(id));
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
      const t=TESTS[id],r=run.results[id],shot=await getShot(id),url=shot?await dataUrl(shot):null;
      sections+=`<section>
        <h2>${escapeHtml(t.title)}</h2>
        <p><b>Status:</b> ${escapeHtml(r?.status||'ungetestet')}${t.golden==='known'?' · KNOWN':''}</p>
        ${t.known?`<p><b>Golden:</b> ${escapeHtml(t.known)}</p>`:''}
        ${r?.note?`<p><b>Kommentar:</b> ${escapeHtml(r.note)}</p>`:''}
        ${url?`<img src="${url}" alt="Screenshot ${escapeHtml(t.title)}">`:''}
      </section>`;
    }
    const doc=`<!doctype html><meta charset="utf-8"><title>${RELEASE.build}</title>
      <style>body{font:14px system-ui;max-width:900px;margin:auto;padding:24px}pre{white-space:pre-wrap;background:#f4f4f4;padding:12px}section{padding:16px 0;border-bottom:1px solid #ccc}img{display:block;max-width:100%;max-height:700px;margin-top:10px;border:1px solid #999}</style>
      <h1>${RELEASE.build}</h1><pre>${escapeHtml(logText())}</pre>${sections}`;
    const blob=new Blob([doc],{type:'text/html'});
    const u=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=u;a.download='Harness-Designer-'+RELEASE.build.replace(/\s+/g,'-')+'-report.html';
    a.click();setTimeout(()=>URL.revokeObjectURL(u),2000);
  }

  const escapeHtml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function mount(){
    const btn=document.createElement('button');btn.id='v3TestBtn';btn.textContent='TEST';
    const g=document.createElement('div');g.id='v3Guide';
    g.innerHTML='<div class="head"><span class="count"></span><span class="title"></span><button class="close">×</button></div><div class="instruction"></div><div class="known"></div><div class="actions"><button class="pass">✓ Funktioniert</button><button class="fail">✕ Fehler</button><button class="skip">Skip</button></div><input class="note" placeholder="Kommentar / Fehlerbeschreibung…"><div id="v3ShotWrap"><img class="shotPreview"><div id="v3ShotMeta"><span>📷 Screenshot gespeichert</span><button class="deleteShot">Löschen</button></div></div><div class="nav"><button class="prev">← Zurück</button><button class="next">Weiter →</button><button class="shot">📷 Screenshot</button></div>';
    const summary=document.createElement('div');summary.id='v3GuideSummary';
    document.body.append(btn,g,summary);
    const $=q=>g.querySelector(q);
    let previewUrl=null;

    async function render(){
      summary.style.display='none';
      if(index>=QUEUE.length){showSummary();return}
      const id=QUEUE[index],t=TESTS[id],r=run.results[id]||{};
      $('.count').textContent=(index+1)+'/'+QUEUE.length;$('.title').textContent=t.title;$('.instruction').textContent=t.instruction;
      $('.known').textContent=t.known||'';$('.known').style.display=t.known?'block':'none';
      $('.note').value=r.note||'';$('.prev').disabled=index===0;$('.next').disabled=index===QUEUE.length-1;
      ['pass','fail','skip'].forEach(k=>$('.'+k).classList.toggle('activeAnswer',r.status===k));

      if(previewUrl){URL.revokeObjectURL(previewUrl);previewUrl=null}
      const shot=await getShot(id);
      if(shot){
        previewUrl=URL.createObjectURL(shot);
        $('.shotPreview').src=previewUrl;
        $('#v3ShotWrap').style.display='block';
        $('.shot').textContent='📷 Neu aufnehmen';
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
      if(index<QUEUE.length-1)index++;else index=QUEUE.length;
      render();
    }

    async function showSummary(){
      g.style.display='none';run.complete=true;save();saveHistory();
      summary.innerHTML='<div class="log"></div><div class="summaryActions"><button class="copy">Log kopieren</button><button class="export">Report + Bilder</button><button class="back">← Letzte Frage</button><button class="closeSum">Schließen</button></div>';
      summary.querySelector('.log').textContent=logText();summary.style.display='block';
      summary.querySelector('.copy').onclick=async()=>{const ok=await copyText(logText());summary.querySelector('.copy').textContent=ok?'✓ Kopiert':'Kopieren fehlgeschlagen'};
      summary.querySelector('.export').onclick=async()=>{summary.querySelector('.export').textContent='Export…';try{await exportReport();summary.querySelector('.export').textContent='✓ Exportiert'}catch(e){summary.querySelector('.export').textContent='Export fehlgeschlagen'}};
      summary.querySelector('.back').onclick=()=>{index=QUEUE.length-1;render()};
      summary.querySelector('.closeSum').onclick=()=>summary.style.display='none';
    }

    $('.pass').onclick=()=>record('pass');$('.fail').onclick=()=>record('fail');$('.skip').onclick=()=>record('skip');
    $('.note').onchange=()=>{const id=QUEUE[index],r=run.results[id]||{};run.results[id]={...r,note:$('.note').value.trim()};save()};
    $('.prev').onclick=()=>{if(index>0){index--;render()}};
    $('.next').onclick=()=>{if(index<QUEUE.length-1){index++;render()}};
    $('.close').onclick=()=>g.style.display='none';
    $('.shot').onclick=async()=>{
      const id=QUEUE[index];$('.shot').textContent='Aufnahme…';
      try{await capture(id);await render()}
      catch(e){$('.shot').textContent='Screenshot fehlgeschlagen'}
    };
    $('.deleteShot').onclick=async()=>{await deleteShot(QUEUE[index]);await render()};

    btn.onclick=()=>{
      summary.style.display='none';
      if(!run.startedAt){run.startedAt=new Date().toISOString();save()}
      const first=QUEUE.findIndex(id=>!run.results[id]);
      index=first<0?0:first;
      render();
    };

    window.HDV3GuidedTest={RELEASE,TESTS,getRun:()=>JSON.parse(JSON.stringify(run)),getLog:logText,exportReport};
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
