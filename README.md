# Harness Designer V0.6a

Critical startup hotfix.

V0.6 attempted `scene.add(envelopeRoot)` before the Three.js `scene` variable
had been initialized. Safari therefore stopped execution immediately.

V0.6a:
- declares envelope state without accessing scene
- creates envelopeRoot only after THREE.Scene exists
- adds defensive envelope guards
- otherwise keeps V0.6 features unchanged
