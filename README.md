# Harness Designer V0.10j

This build fixes the actual structural causes found by inspecting the DOM.

- Ring / Verbinden is `.build-tools`; that real element is now placed in the top row.
- Lock used to be outside the selection header. The lock button is now physically
  moved into the same `.sheet-row` as RING/N1 and Delete.
- Header is therefore truly: name | lock | delete, not a visual overlay.
- No geometry/model/strap/ring logic changed.
