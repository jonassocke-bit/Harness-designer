// ============================================================================
// V3.2.0 RING MERGE
// Test-only layer. Golden Harness Designer logic above remains untouched.
// ============================================================================
(function(){
  'use strict';
  const RELEASE={build:'V3.2.0 RING MERGE',base:'V3.1.0 MODULAR GOLDEN'};

  const TESTS={
    startup:{
      title:'1 · Start / Build prüfen',
      instruction:'Prüfe zuerst unten die Patchnotes: dort muss V3.2.0 stehen. Mannequin, UI und vorhandene Golden-Funktionen müssen normal geladen sein.',
      golden:'pass'
    },
    smallRingSelect:{
      title:'2 · Kleinen Ring treffen',
      instruction:'Stelle den Ringdurchmesser deutlich kleiner als Standard ein (z. B. etwa 15–20 mm). Tippe den sichtbaren Ringrand anschließend mehrfach aus verschiedenen Zoomstufen an. Ziel: der Ring soll auf dem iPhone zuverlässig auswählbar sein, ohne dass du pixelgenau treffen musst. Bitte Fehler notieren, falls die Hitbox zu groß wirkt und du stattdessen benachbarte Objekte erwischst.',
      golden:'known',known:'V3.1: kleine Ringe waren unnötig schwer zu treffen.'
    },
    hitboxDebug:{
      title:'3 · Hitbox-Debug',
      instruction:'Aktiviere „Hitboxen“. Prüfe einen kleinen und einen großen Ring. Die cyanfarbene Auswahl-Hitbox soll mit dem Ring mitskalieren, aber sichtbar toleranter als der Metallrand sein. Sie darf nicht riesig über den Ring hinausragen.',
      golden:'known',known:'V3.2 verändert nur die unsichtbare/Debug-Hitbox, nicht die sichtbare Ringgeometrie.'
    },
    softMergeSmall:{
      title:'4 · Soft-Merge mit kleinen Ringen',
      instruction:'Setze zwei eher kleine Ringe dicht nebeneinander und ziehe Ring A nahezu deckungsgleich auf Ring B. Das Merge soll deutlich leichter auslösen als in V3.1, aber erst bei echter Beinahe-Überlappung. Prüfe auch, ob der Host-Ring nach dem Loslassen exakt an seiner Position bleibt.',
      golden:'known',known:'V3.1: Merge grundsätzlich möglich, bei kleinen Ringen schwer auszulösen.'
    },
    softMergePersistence:{
      title:'5 · Soft-Merge bleibt bestehen',
      instruction:'Nach dem Merge Finger vollständig loslassen, Kamera drehen und den gemergten Ring erneut auswählen. Es darf kein zweiter Ring wieder herausspringen. Der ⇄-Button soll nun „Trennen“ repräsentieren und zusätzlich muss „Ringe endgültig verschmelzen“ erscheinen.',
      golden:'pass'
    },
    sameGesturePullout:{
      title:'6 · Sofort wieder wegziehen',
      instruction:'Erzeuge erneut einen Soft-Merge und ziehe im selben Drag-Gesture direkt wieder deutlich vom Host weg. Der bewegte Ring soll sich wieder lösen, inklusive seiner ursprünglichen Attachments. Prüfe, dass kein doppelter oder verlorener Ring entsteht.',
      golden:'pass'
    },
    unmergeButton:{
      title:'7 · Trennen-Button',
      instruction:'Erzeuge einen Soft-Merge, lasse los und drücke anschließend ⇄ / Trennen. Der bewegte Gast-Ring soll wieder separat neben dem Host erscheinen. Falls vorher ein Riemen am Gast hing, prüfe bitte besonders, ob er wieder am richtigen Ring hängt.',
      golden:'pass'
    },
    thirdRingBlock:{
      title:'8 · Dritten Ring blockieren',
      instruction:'Merge Ring A weich auf Ring B. Setze dann Ring C und versuche C ebenfalls exakt auf den bereits gemergten Host zu ziehen. Es darf KEIN 3er-Soft-Merge entstehen. Stattdessen soll einmalig die Meldung „Bereits gemerged · erst trennen oder endgültig verschmelzen“ erscheinen. Prüfe, dass C beweglich bleibt und nichts verschwindet.',
      golden:'known',known:'Neu in V3.2: Soft-Merge ist bewusst auf genau zwei Ringe begrenzt.'
    },
    permanentMerge:{
      title:'9 · Endgültig verschmelzen',
      instruction:'Merge A weich auf B und drücke „Ringe endgültig verschmelzen“. Danach darf der Trennen-Zustand verschwinden: es existiert logisch nur noch ein Ring. Versuche den Ring erneut anzutippen und zu bewegen. Er soll sich wie ein normaler einzelner Ring verhalten.',
      golden:'known',known:'Neu in V3.2. Undo darf den Vorgang weiterhin rückgängig machen; nur der normale Trennen-Button soll ihn nicht mehr lösen.'
    },
    mergeAgainAfterFinalize:{
      title:'10 · Nach Finalisierung erneut mergen',
      instruction:'Nachdem A+B endgültig verschmolzen wurden, ziehe einen neuen Ring C darauf. Jetzt muss wieder ein normaler Soft-Merge möglich sein. Das ist der vorgesehene Weg, um nacheinander mehr als zwei ursprüngliche Ringe zusammenzuführen.',
      golden:'known',known:'Soll zeigen, dass wir keine komplexen 3er-Soft-Merge-Gruppen brauchen.'
    },
    strapAttachment:{
      title:'11 · Attachment-Remap: Riemen',
      instruction:'Baue zwei Ringe A/B, hänge an A einen Riemen zu Ring X und an B einen anderen Riemen zu Ring Y. Merge A auf B und finalisiere. Danach müssen BEIDE Riemen weiterhin am verbleibenden Ring hängen. Bewege ihn: beide Riemen müssen mitgehen. Bitte Screenshot machen, falls einer verschwindet, doppelt wird oder am falschen Punkt endet.',
      golden:'pass'
    },
    panelAttachment:{
      title:'12 · Attachment-Remap: Fläche',
      instruction:'Erzeuge eine Fläche, deren Boundary einen der später zu mergenden Ringe benutzt. Merge/finalisiere diesen Ring mit einem zweiten. Die Fläche muss bestehen bleiben und beim Verschieben des verbleibenden Rings weiter reagieren. Achte besonders darauf, ob am Rand plötzlich ein Loch oder ein zurückspringender Boundary-Punkt entsteht.',
      golden:'pass'
    },
    mirrorIsolation:{
      title:'13 · Spiegel-Logik nicht beschädigt',
      instruction:'Teste anschließend ein normales Spiegelpaar inklusive Mittelachsen-Merge und Entmerge. Diese Funktion wurde NICHT absichtlich verändert und muss sich wie V3.1 verhalten. Falls hier etwas anders ist, ist das eine echte Regression.',
      golden:'pass'
    },
    undoRedo:{
      title:'14 · Undo / Redo der neuen Merge-Schritte',
      instruction:'Teste Undo/Redo einmal nach Soft-Merge und einmal nach „endgültig verschmelzen“. Es dürfen keine Geister-Ringe, verlorene Riemen oder ungültigen Flächen entstehen. Die bekannte längere Ladezeit bei viel Geometrie ist weiterhin erlaubt.',
      golden:'known',known:'V3.1: Undo/Redo funktionierte, konnte bei viel Geometrie aber langsam sein.'
    },
    reload:{
      title:'15 · Reload nach Finalisierung',
      instruction:'Finalisiere einen Merge, lade die Seite neu und prüfe, ob der gespeicherte Zustand weiterhin genau einen Ring an dieser Stelle enthält und die App normal startet.',
      golden:'pass'
    }
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
