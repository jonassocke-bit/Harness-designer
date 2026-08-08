# Harness Designer V0.6b

Second critical startup fix.

What was wrong:
- V0.6 accessed `scene` before it existed.
- V0.6a moved the envelope initialization, but the automated insertion landed
  inside the `scene.fog = new THREE.Fog(...)` statement. The file could still
  pass a basic syntax check while the scene initialization was malformed.

V0.6b:
- rebuilt directly from V0.6
- envelopeRoot is created only after BOTH `new THREE.Scene()` and the complete
  fog assignment have finished
- startup envelope creation is deferred to requestAnimationFrame
- envelope generation is fail-soft: if it errors, the editor falls back to
  the original body mesh instead of freezing
- defensive null guards added

No feature changes from V0.6.
