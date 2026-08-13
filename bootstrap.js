const statusEl = document.getElementById('bootStatus');
const errorEl = document.getElementById('bootError');
const overlay = document.getElementById('bootOverlay');
const status = t => { if (statusEl) statusEl.textContent = t; };
const fail = e => {
  console.error('[HD boot]', e);
  status('Startfehler');
  if (errorEl) errorEl.textContent = String(e?.stack || e?.message || e);
};
window.addEventListener('error', e => fail(e.error || e.message));
window.addEventListener('unhandledrejection', e => fail(e.reason));

async function loadClassic(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src; s.async = false;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Konnte '+src+' nicht laden'));
    document.head.appendChild(s);
  });
}

try {
  status('Three.js laden…');
  const THREE = await import('https://cdn.jsdelivr.net/npm/three@0.179.1/build/three.module.js');
  window.THREE = THREE;
  status('GLTF Loader laden…');
  const { GLTFLoader } = await import('https://cdn.jsdelivr.net/npm/three@0.179.1/examples/jsm/loaders/GLTFLoader.js');
  window.THREE.GLTFLoader = GLTFLoader;

  const files = ['config.js','state.js','geometry.js','body.js','nodes.js','straps.js','panels.js','history.js','interaction.js','ui.js','app.js'];
  for (const file of files) { status('Modul: '+file); await loadClassic(file); }

  if (!window.HD?.App) throw new Error('HD.App fehlt nach dem Laden der Module.');
  status('3D-Szene initialisieren…');
  // app.js normally waits for DOMContentLoaded; module execution here occurs after parsing,
  // so initialize explicitly only if it has not already initialized.
  if (!HD.App.renderer) HD.App.init();
  status('Mannequin laden…');
  await HD.App.start();
  status('Bereit');
  setTimeout(() => { overlay.style.display='none'; }, 120);
} catch (e) { fail(e); }
