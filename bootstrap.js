const statusEl = document.getElementById('bootStatus');
const errorEl = document.getElementById('bootError');
const overlay = document.getElementById('bootOverlay');
const status = t => { if (statusEl) statusEl.textContent = t; };
let failed = false;
const fail = e => {
  if (failed) return;
  failed = true;
  console.error('[HD boot]', e);
  status('Startfehler');
  if (errorEl) errorEl.textContent = String(e?.stack || e?.message || e);
};
window.addEventListener('error', e => fail(e.error || e.message));
window.addEventListener('unhandledrejection', e => fail(e.reason));

async function loadClassic(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = false;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Konnte '+src+' nicht laden'));
    document.head.appendChild(s);
  });
}

try {
  status('Three.js laden…');
  const THREE_MODULE = await import('three');

  status('GLTF Loader laden…');
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');

  // ES module namespace objects are read-only/non-extensible. The V2 classic
  // modules expect a global THREE object, so expose a normal mutable object.
  window.THREE = { ...THREE_MODULE, GLTFLoader };

  if (!window.THREE.WebGLRenderer || !window.THREE.GLTFLoader) {
    throw new Error('Three.js oder GLTFLoader wurde nicht korrekt initialisiert.');
  }

  const files = [
    'config.js','state.js','geometry.js','body.js','nodes.js','straps.js',
    'panels.js','history.js','interaction.js','ui.js','app.js'
  ];

  for (const file of files) {
    status('Modul: '+file);
    await loadClassic(file);
  }

  if (!window.HD?.App) throw new Error('HD.App fehlt nach dem Laden der Module.');

  status('3D-Szene initialisieren…');
  if (!HD.App.renderer) HD.App.init();

  status('Mannequin laden…');
  await HD.App.start();

  status('Bereit');
  setTimeout(() => { if (!failed && overlay) overlay.style.display='none'; }, 120);
} catch (e) {
  fail(e);
}
