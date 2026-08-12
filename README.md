# Harness Designer V1.9i — DOUBLE SIDE TEST

Based directly on V1.9h offset test.

Only intended change:
- PANEL_MAT and PANEL_SEL render with THREE.DoubleSide.

No geometry, panel extraction, clipping, offset, strap, ring or snap logic was changed.

If the angle-dependent white cracks disappear, back-face culling / triangle winding is the cause.
If they remain, the issue is a real geometry discontinuity.
