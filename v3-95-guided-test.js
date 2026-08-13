// ============================================================================
// V3.2.1 RING MERGE FIX
// Test-only layer. Golden Harness Designer logic above remains untouched.
// ============================================================================
(function(){
  'use strict';
  const RELEASE={build:'V3.2.1 RING MERGE FIX',base:'V3.1.0 MODULAR GOLDEN'};

  const TESTS={
    build:{
      title:'1 · Build / Patchnotes',
      instruction:'Unten muss „V3.2.1 · Ring Merge Fix“ stehen. App und Mannequin müssen normal starten.',
      golden:'pass'
    },
    snapThreshold:{
      title:'2 · Snap-Schwelle – kleine Ringe',
      instruction:'Nimm zwei kleine Ringe und nähere sie langsam an. Sie sollen spätestens dann soft-mergen, wenn sie optisch bereits deutlich ineinander liegen/nahezu deckungsgleich sind. Bitte Screenshot machen, falls du wieder einen Zustand erreichst, bei dem du sagst „spätestens hier“ und noch nichts passiert. Gleichzeitig prüfen: nebeneinanderliegende, aber klar getrennte Ringe dürfen NICHT mergen.',
      golden:'known',known:'V3.2.0 war trotz größerer Hitbox beim eigentlichen Snap noch zu streng.'
    },
    unmergeDirection:{
      title:'3 · Trennen merkt die Herkunftsrichtung',
      instruction:'Ziehe Ring A von links/rechts/oben auf Ring B, lasse los und drücke danach „Trennen“. A soll auf ungefähr derselben Seite von B wieder auftauchen, aus der er beim Merge kam. Wiederhole das aus mindestens zwei deutlich verschiedenen Richtungen. Exakte alte Position ist nicht nötig – die Richtung soll plausibel sein.',
      golden:'known',known:'V3.2.0 setzte den getrennten Ring ohne gespeicherte Eintrittsrichtung generisch ab.'
    },
    thirdHover:{
      title:'4 · Dritter Ring – Hover-Meldung',
      instruction:'Soft-merge A+B. Ziehe C über den gemergten Ring und HALTE den Finger dort: die Meldung muss dauerhaft sichtbar bleiben. Ziehe C weg: Meldung muss sofort verschwinden. Fahre wieder darüber: Meldung muss wieder erscheinen. Es darf weiterhin kein 3er-Soft-Merge entstehen.',
      golden:'known',known:'V3.2.0 zeigte nur einen kurzen Toast pro Drag.'
    },
    panelUnmerge:{
      title:'5 · Fläche – exakter Restore nach Soft-Merge/Trennen',
      instruction:'Erzeuge eine Fläche mit mindestens vier Boundary-Ringen. Zwei davon sollen A und B sein. Soft-merge A auf B und trenne wieder. Danach muss die Fläche wieder GENAU an A und B sowie an allen unbeteiligten Boundary-Punkten hängen. Bewege nacheinander A, B und einen unbeteiligten Punkt deutlich: jeweils darf nur der erwartete Boundary-Punkt folgen. Bitte Screenshot + Kommentar bei jedem Springen/Verlust.',
      golden:'known',known:'V3.2.0 konnte nach Entmerge einen Boundary-Slot verlieren oder auf einen falschen Ring umhängen.'
    },
    panelFinalize:{
      title:'6 · Fläche – endgültiges Verschmelzen',
      instruction:'Mit einer Fläche, die A und/oder B benutzt: soft-merge A+B und drücke „endgültig verschmelzen“. Danach soll die Fläche den verbleibenden Host sauber benutzen. Bewege den Host und danach andere Boundary-Punkte. Kein Punkt darf plötzlich zu einer alten/gelöschten Ring-ID zurückspringen.',
      golden:'known'
    },
    mirrorToSingle:{
      title:'7 · Spiegelring → einzelner Ring',
      instruction:'Erzeuge ein Spiegelpaar A/A′ und einen einzelnen Ring B. Ziehe einen physischen Ring des Spiegelpaares auf B. Der Merge muss jetzt möglich sein. Erwartung: der gemergte physische Ring wird Teil von B; sein früherer Spiegelpartner bleibt als eigenständiger Ring erhalten statt den Merge zu blockieren. Trenne anschließend wieder und prüfe, ob das ursprüngliche Spiegelpaar sinnvoll wiederhergestellt wird.',
      golden:'known',known:'V3.2.0 übersprang Generic Merge vollständig, sobald der bewegte Ring einen Mirror-Partner hatte.'
    },
    mirrorToMirror:{
      title:'8 · Spiegelpaar ↔ Spiegelpaar',
      instruction:'Erzeuge zwei Spiegelpaare. Ziehe einen Ring aus Paar 1 nahezu deckungsgleich auf einen Ring aus Paar 2. Der betreffende physische Ring muss soft-mergen können. Prüfe danach die drei übrigen sichtbaren/aktiven Ringzustände: nichts darf verschwinden oder unbedienbar werden. Teste anschließend Trennen.',
      golden:'known'
    },
    strapAttachments:{
      title:'9 · Riemen-Attachments unverändert',
      instruction:'Wiederhole einen Soft-Merge/Trennen-Fall mit je einem Riemen an Gast und Host. Beide ursprünglichen Verbindungen müssen nach Trennen wieder korrekt sein. Danach finalisieren und prüfen, dass beide Riemen am verbleibenden Host hängen.',
      golden:'pass'
    },
    finalMergeAgain:{
      title:'10 · Finalisieren → erneut mergen',
      instruction:'A+B endgültig verschmelzen und danach C darauf soft-mergen. Das muss weiterhin funktionieren. Versuche zusätzlich D als dritten Soft-Merge: D muss blockiert werden, bis C getrennt oder finalisiert wurde.',
      golden:'pass'
    },
    axisMirrorRegression:{
      title:'11 · Mittelachsen-Merge unverändert',
      instruction:'Teste das klassische Spiegelpaar-Merge auf der Körpermittelachse und das Entmerge durch seitliches Wegziehen. Das ist eine getrennte Logik und darf durch die Generic-Merge-Fixes nicht schlechter geworden sein.',
      golden:'pass'
    },
    undo:{
      title:'12 · Undo / Redo',
      instruction:'Undo/Redo nach Soft-Merge, Trennen und endgültigem Verschmelzen testen – jeweils bevorzugt einmal mit Fläche. Keine Geister-Ringe, verlorenen Boundary-Punkte oder kaputten Riemen.',
      golden:'pass'
    },
    ui:{
      title:'13 · Auswahl / Buttons',
      instruction:'Bei normalem Ring darf kein Finalisieren-Button erscheinen. Bei Soft-Merge muss „endgültig verschmelzen“ sichtbar sein. Nach Trennen oder Finalisieren muss der Button wieder verschwinden.',
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
