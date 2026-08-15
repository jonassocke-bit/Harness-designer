// ============================================================================
// V3.4.0 STRAP ROUTING REBUILD
// Test-only layer. Golden Harness Designer logic above remains untouched.
// ============================================================================
(function(){
  'use strict';
  const RELEASE={build:'V3.5.4 CLEAN ROUTING + UI DOCK',base:'V3.5.3 SURFACE CLEANUP + MIDPOINT RESET'};

  const TESTS={
    ringStop:{title:'1 · Riemen endet am Ring',instruction:'Mehrere Riemenverbünde bauen. Der sichtbare Riemen darf längs an keinem Ende über den Ring hinauslaufen.',golden:'known'},
    smoothBand:{title:'2 · Glättung über L/C/R',instruction:'Fast und Adaptive vergleichen. Zwischen wenigen Solverpunkten soll das Band weich über linke Außenkante, Mittellinie und rechte Außenkante laufen – keine grobe plane Fläche.',golden:'known'},
    torsoComplexity:{title:'3 · Torso / Brust-Komplexität',instruction:'Komplexität einblenden. Torso insgesamt einfacher; Brust moderat dichter; Schulter/Achsel weiterhin klar komplex.',golden:'known'},
    zoneSurface:{title:'4 · Zonen als Oberfläche',instruction:'Zonen einblenden. Mannequin-Oberfläche muss flächig nach Zonen eingefärbt sein. Arm-/Schulter- und Leistenübergänge prüfen.',golden:'known'},
    armCalibration:{title:'5 · Arm-Zonengrenze',instruction:'Schulter/Achsel kalibrieren. Die gesamte relevante Armgrenze muss reagieren, nicht nur ein kurzes Endstück.',golden:'known'},
    toolbox:{title:'6 · Toolbox klein + Dock',instruction:'Eingeklappt nur ein kleines Werkzeug-Icon. Aufklappen, verschieben und links/rechts andocken. Kein leerer Seitenstreifen und nichts abgeschnitten.',golden:'known'},
    wideStrap:{title:'7 · Breiter Riemen',instruction:'30–40 mm Riemen über Brust/Schulter testen. V3.5.3-Mittellinien-Kollisionsschutz muss erhalten bleiben; kein Durchclippen.',golden:'known'},
    report:{title:'8 · Reportbild',instruction:'Kompaktes Reportbild erzeugen. Lesbarkeit und Größe prüfen; Abschluss muss jederzeit erreichbar bleiben.',golden:'pass'}
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

  async function capture3D(id){
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


  function inlineComputedStylesV352(src,dst){
    const props=['position','left','right','top','bottom','width','height','display','grid-template-columns','grid-template-rows','gap','padding','margin','border','border-radius','background','background-color','color','font','font-size','font-weight','line-height','text-align','opacity','transform','transform-origin','overflow','white-space','box-sizing','z-index','align-items','justify-content'];
    const a=[src,...src.querySelectorAll('*')],b=[dst,...dst.querySelectorAll('*')];
    for(let i=0;i<Math.min(a.length,b.length);i++){
      const cs=getComputedStyle(a[i]);for(const k of props)b[i].style.setProperty(k,cs.getPropertyValue(k));
      if(a[i] instanceof HTMLInputElement||a[i] instanceof HTMLTextAreaElement)b[i].setAttribute('value',a[i].value||'');
    }
  }
  async function captureFullUI(id){
    const canvas=document.querySelector('canvas');if(!canvas)throw new Error('Kein Canvas');
    try{renderer?.render?.(scene,camera)}catch(e){}
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    const clone=document.body.cloneNode(true);inlineComputedStylesV352(document.body,clone);
    const originalCanvases=[...document.body.querySelectorAll('canvas')],cloneCanvases=[...clone.querySelectorAll('canvas')];
    for(let i=0;i<cloneCanvases.length;i++){
      const img=document.createElement('img');try{img.src=originalCanvases[i].toDataURL('image/jpeg',.88)}catch(e){}
      const cs=getComputedStyle(originalCanvases[i]);img.style.cssText=cloneCanvases[i].style.cssText;img.style.width=cs.width;img.style.height=cs.height;img.style.objectFit='fill';cloneCanvases[i].replaceWith(img);
    }
    clone.querySelectorAll('script').forEach(x=>x.remove());
    const ser=new XMLSerializer().serializeToString(clone);
    const w=Math.max(320,window.innerWidth),h=Math.max(320,window.innerHeight);
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml" style="width:${w}px;height:${h}px;overflow:hidden;background:#090a0d">${ser}</div></foreignObject></svg>`;
    const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));
    try{
      const img=await new Promise((resolve,reject)=>{const x=new Image();x.onload=()=>resolve(x);x.onerror=reject;x.src=url});
      const out=document.createElement('canvas'),scale=Math.min(1.5,1400/w);out.width=Math.round(w*scale);out.height=Math.round(h*scale);
      out.getContext('2d').drawImage(img,0,0,out.width,out.height);
      const blob=await new Promise((resolve,reject)=>out.toBlob(b=>b?resolve(b):reject(new Error('UI Screenshot leer')),'image/jpeg',.86));
      await putShot(id,blob);return blob;
    }finally{URL.revokeObjectURL(url)}
  }
  async function compactReportImageV352(){
    const W=1400,pad=44,colGap=20,thumbW=(W-pad*2-colGap)/2,thumbH=thumbW*.62;
    const rows=[];
    for(const id of QUEUE){const r=run.results[id],shots=await listShots(id);if(r?.status||r?.note||shots.length)rows.push({id,t:TESTS[id],r,shots})}
    const maxShots=12;let shotCount=0;for(const row of rows){row.shots=row.shots.slice(0,Math.max(0,maxShots-shotCount));shotCount+=row.shots.length}
    const lineH=31,sectionBase=92;
    let H=150+(run.overallNote?100:0);
    for(const row of rows)H+=sectionBase+(row.r?.note?Math.min(4,Math.ceil(row.r.note.length/72))*lineH:0)+Math.ceil(row.shots.length/2)*(thumbH+18);
    const scale=Math.min(1,5600/H);H=Math.min(5600,H);
    const c=document.createElement('canvas');c.width=Math.round(W*scale);c.height=Math.round(H*scale);const ctx=c.getContext('2d');ctx.scale(scale,scale);
    ctx.fillStyle='#101218';ctx.fillRect(0,0,W,H/scale);ctx.fillStyle='#fff';ctx.font='700 42px system-ui';ctx.fillText(RELEASE.build,pad,62);ctx.font='24px system-ui';ctx.fillStyle='#aeb5c2';ctx.fillText('Kompakter Harness Designer Debug-Report',pad,103);
    let y=140;
    const wrap=(text,x,y0,maxW,maxLines=4)=>{const words=String(text||'').split(/\s+/);let line='',yy=y0,n=0;for(const word of words){const test=line?line+' '+word:word;if(ctx.measureText(test).width>maxW&&line){ctx.fillText(line,x,yy);yy+=lineH;n++;line=word;if(n>=maxLines)return yy}else line=test}if(line&&n<maxLines){ctx.fillText(line,x,yy);yy+=lineH}return yy};
    if(run.overallNote){ctx.fillStyle='#dce2ea';ctx.font='24px system-ui';y=wrap('Gesamt: '+run.overallNote,pad,y,W-pad*2,3)+18}
    for(const row of rows){ctx.fillStyle='#20242d';ctx.fillRect(pad,y-26,W-pad*2,52);ctx.font='700 24px system-ui';ctx.fillStyle=row.r?.status==='pass'?'#7ee2a8':row.r?.status==='fail'?'#ff8f8f':'#ffd77a';ctx.fillText((row.r?.status==='pass'?'✓ ':row.r?.status==='fail'?'✕ ':'→ ')+row.t.title,pad+16,y+8);y+=48;
      if(row.r?.note){ctx.fillStyle='#e5e8ed';ctx.font='23px system-ui';y=wrap(row.r.note,pad+8,y,W-pad*2-16,4)+8}
      for(let i=0;i<row.shots.length;i+=2){for(let j=0;j<2&&i+j<row.shots.length;j++){const sh=row.shots[i+j],url=URL.createObjectURL(sh.blob);try{const im=await new Promise((res,rej)=>{const z=new Image();z.onload=()=>res(z);z.onerror=rej;z.src=url});const x=pad+j*(thumbW+colGap),ratio=Math.min(thumbW/im.width,thumbH/im.height);const dw=im.width*ratio,dh=im.height*ratio;ctx.fillStyle='#090a0d';ctx.fillRect(x,y,thumbW,thumbH);ctx.drawImage(im,x+(thumbW-dw)/2,y+(thumbH-dh)/2,dw,dh)}finally{URL.revokeObjectURL(url)}}y+=thumbH+18}y+=18;
    }
    return await new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(new Error('Reportbild leer')),'image/png'));
  }
  async function copyReportImageV352(){
    const blob=await compactReportImageV352();
    if(navigator.clipboard?.write&&window.ClipboardItem){await navigator.clipboard.write([new ClipboardItem({'image/png':blob})]);return true}
    throw new Error('Bild-Zwischenablage wird hier nicht unterstützt');
  }


  async function richReportHtml(){
    let body=`<h1>${escapeHtml(RELEASE.build)}</h1><pre>${escapeHtml(logText())}</pre>`;
    if(run.overallNote)body+=`<h2>Gesamtkommentar</h2><p>${escapeHtml(run.overallNote).replace(/\n/g,'<br>')}</p>`;
    for(const id of QUEUE){
      const t=TESTS[id],r=run.results[id],shots=await listShots(id);
      body+=`<section><h2>${escapeHtml(t.title)}</h2><p><b>Status:</b> ${escapeHtml(r?.status||'ungetestet')}</p>`;
      if(r?.note)body+=`<p><b>Kommentar:</b> ${escapeHtml(r.note)}</p>`;
      for(const sh of shots)body+=`<img src="${await dataUrl(sh.blob)}" style="max-width:100%;height:auto" alt="Screenshot">`;
      body+='</section>';
    }
    return body;
  }
  async function copyRichReport(){
    const plain=logText()+(run.overallNote?'\n\nGesamtkommentar:\n'+run.overallNote:'');
    try{
      if(navigator.clipboard?.write && window.ClipboardItem){
        const rich=await richReportHtml();
        const item=new ClipboardItem({
          'text/plain':new Blob([plain],{type:'text/plain'}),
          'text/html':new Blob([rich],{type:'text/html'})
        });
        await navigator.clipboard.write([item]);
        return 'rich';
      }
    }catch(e){console.warn('Rich clipboard failed',e)}
    return await copyText(plain)?'text':false;
  }

  async function reportDocument(){
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
    return `<!doctype html><meta charset="utf-8"><title>${RELEASE.build}</title>
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <style>body{font:14px system-ui;max-width:900px;margin:auto;padding:24px}pre{white-space:pre-wrap;background:#f4f4f4;padding:12px}section{padding:16px 0;border-bottom:1px solid #ccc}img{display:block;max-width:100%;max-height:700px;margin-top:10px;border:1px solid #999}</style>
      <h1>${RELEASE.build}</h1><pre>${escapeHtml(logText())}</pre>${run.overallNote?`<section><h2>Gesamtkommentar</h2><p>${escapeHtml(run.overallNote).replace(/\n/g,'<br>')}</p></section>`:''}${sections}`;
  }
  function reportFilename(){
    return 'Harness-Designer-'+RELEASE.build.replace(/[^a-z0-9._-]+/gi,'-')+'-report.html';
  }
  async function exportReport(){
    const doc=await reportDocument();
    const blob=new Blob([doc],{type:'text/html'});
    const u=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=u;a.download=reportFilename();
    a.click();setTimeout(()=>URL.revokeObjectURL(u),2000);
  }
  async function shareReport(){
    const doc=await reportDocument();
    const file=new File([doc],reportFilename(),{type:'text/html'});
    try{
      if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]}))){
        await navigator.share({
          title:RELEASE.build,
          text:'Harness Designer Debug Report',
          files:[file]
        });
        return 'shared';
      }
    }catch(e){
      if(e?.name==='AbortError')return 'cancelled';
      console.warn('Native report share failed',e);
    }
    await exportReport();
    return 'exported';
  }

  const escapeHtml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function mount(){
    const btn=document.createElement('button');btn.id='v3TestBtn';btn.textContent='TEST';
    const g=document.createElement('div');g.id='v3Guide';
    g.innerHTML='<div class="head"><button class="prev">←</button><span class="count"></span><span class="title"></span><button class="report">REPORT</button><button class="next">→</button><button class="close">×</button></div><div class="instruction"></div><div class="known"></div><div class="actions"><button class="pass">✓ Funktioniert</button><button class="fail">✕ Fehler</button><button class="skip">Skip</button></div><textarea class="note" rows="4" placeholder="Kommentar / Fehlerbeschreibung…"></textarea><div id="v3ShotWrap"><div class="shotGallery"></div><div id="v3ShotMeta"><span>📷 Screenshots gespeichert</span></div></div><div class="nav"><button class="shot">📷 Screenshot</button></div><div class="captureChoice" hidden><button class="shot3d">3D-Ansicht</button><button class="shotui">Komplette UI</button></div>';
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
      $('.note').value=r.note||'';$('.prev').disabled=index===0;$('.next').disabled=false;
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
      summary.innerHTML='<div class="log"></div><textarea class="overallNote" rows="7" placeholder="Gesamtkommentar / Fazit zum Test…"></textarea><div class="summaryActions"><button class="imageCopy">Reportbild kopieren</button><button class="copy">Text kopieren</button><button class="share">Report teilen + Bilder</button><button class="export">HTML speichern</button><button class="back">← Letzte Frage</button><button class="closeSum">Schließen</button></div>';
      summary.querySelector('.log').textContent=logText();
      summary.querySelector('.overallNote').value=run.overallNote||'';
      summary.querySelector('.overallNote').oninput=e=>{run.overallNote=e.target.value;save();summary.querySelector('.log').textContent=logText()};
      summary.style.display='block';
      summary.querySelector('.imageCopy').onclick=async()=>{const b=summary.querySelector('.imageCopy');b.textContent='Bild wird gebaut…';try{await copyReportImageV352();b.textContent='✓ Reportbild kopiert'}catch(e){console.warn(e);b.textContent='Bildkopie fehlgeschlagen'}};
      summary.querySelector('.copy').onclick=async()=>{const ok=await copyText(logText()+(run.overallNote?'\n\nGesamtkommentar:\n'+run.overallNote:''));summary.querySelector('.copy').textContent=ok?'✓ Text kopiert':'Kopieren fehlgeschlagen'};
      summary.querySelector('.share').onclick=async()=>{const b=summary.querySelector('.share');b.textContent='Teilen…';try{const r=await shareReport();b.textContent=r==='shared'?'✓ Geteilt':r==='cancelled'?'Teilen abgebrochen':'✓ HTML gespeichert'}catch(e){b.textContent='Teilen fehlgeschlagen'}};
      summary.querySelector('.export').onclick=async()=>{summary.querySelector('.export').textContent='Speichern…';try{await exportReport();summary.querySelector('.export').textContent='✓ Gespeichert'}catch(e){summary.querySelector('.export').textContent='Speichern fehlgeschlagen'}};
      summary.querySelector('.back').onclick=()=>{index=QUEUE.length-1;render()};
      summary.querySelector('.closeSum').onclick=()=>summary.style.display='none';
    }

    $('.pass').onclick=()=>record('pass');$('.fail').onclick=()=>record('fail');$('.skip').onclick=()=>record('skip');
    $('.note').onchange=()=>{const id=QUEUE[index],r=run.results[id]||{};run.results[id]={...r,note:$('.note').value.trim()};save()};
    $('.prev').onclick=()=>{index=Math.max(0,index-1);saveIndex();render()};
    $('.next').onclick=()=>{if(index>=QUEUE.length-1){showSummary();return}index++;saveIndex();render()};
    $('.report').onclick=()=>showSummary();
    $('.close').onclick=()=>{
      const id=QUEUE[index],r=run.results[id]||{};
      run.results[id]={...r,note:$('.note').value.trim()};save();saveIndex();g.style.display='none';
    };
    $('.shot').onclick=()=>{const c=$('.captureChoice');c.hidden=!c.hidden};
    $('.shot3d').onclick=async()=>{const id=QUEUE[index],existing=run.results[id]||{};run.results[id]={...existing,note:$('.note').value.trim()};save();$('.shot3d').textContent='Aufnahme…';try{await capture3D(id);$('.captureChoice').hidden=true;await render()}catch(e){console.warn(e);$('.shot3d').textContent='3D fehlgeschlagen'}};
    $('.shotui').onclick=async()=>{const id=QUEUE[index],existing=run.results[id]||{};run.results[id]={...existing,note:$('.note').value.trim()};save();$('.shotui').textContent='Aufnahme…';try{await captureFullUI(id);$('.captureChoice').hidden=true;await render()}catch(e){console.warn(e);$('.shotui').textContent='UI fehlgeschlagen'}};

    btn.onclick=()=>{
      summary.style.display='none';
      if(!run.startedAt){run.startedAt=new Date().toISOString();save()}
      if(index<0||index>=QUEUE.length)index=0;
      saveIndex();render();
    };

    window.HDV3GuidedTest={RELEASE,TESTS,getRun:()=>JSON.parse(JSON.stringify(run)),getLog:logText,exportReport,shareReport,copyReportImage:copyReportImageV352,showSummary};
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
