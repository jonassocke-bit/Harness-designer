# Harness Designer V1.5a — Picking fix

Built directly on V1.5.

Fixes a global-Raycaster state bug in `interactiveHit()`:

- node visibility checks use the same raycaster as touch picking
- those checks leave the raycaster aimed at the last tested node
- the old code then raycasted node hit meshes without restoring the touch ray
- result: a distant/last node could be selected even when tapping empty space

V1.5a explicitly restores `setPointer(x,y)` immediately before every real
node/strap `intersectObjects()` picking pass.

No strap geometry, body morph, reprojection, symmetry, split, crossing,
surface-follow or coupling code was changed.
