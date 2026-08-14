# V1.9f2 FILLED EDGE

Rebuilt cleanly from V1.9e after V1.9f failed to start.

The previous package accidentally left duplicate JavaScript statements behind
the replaced extraction function. This build replaces the whole function
between explicit function boundaries and passes Node syntax/structure checks.

Edge fix:
- source body triangles are no longer discarded merely because their centroid
  lies outside the requested panel;
- every body triangle with real area overlap is retained;
- the existing clipping stage cuts it at the requested boundary;
- the clipped polygon is triangulated;
- new edge vertices remain reconstructed from the original mannequin triangle.

No dense panel raycast pass was added.


# V3.0.0a REGRESSION HARNESS

No design logic changes.

Adds:
- guided Smoke / Impact / Full regression testing
- Golden known-issue classification
- automatic invariant checks
- per-build saved manual results
- explicit module → affected workflow impact matrix
- future build API: `HDV3Regression.setChangedModules([...])`

For this calibration build, Impact/Full intentionally run the Golden baseline suite once.
Future modularization builds will declare only their changed modules and show a much shorter list.


## V3.0.0f CAPTURE FIX
- Screenshot capture renders the current WebGL frame explicitly before reading it.
- Short deliberate capture delay added for Safari/WebGL reliability.
- Second render immediately before canvas readback.
- Black-frame detection added; a black capture now reports an error instead of silently saving.
- Existing screenshot preview / delete / retake / HTML report export retained.
- Visible build/patchnote version updated.
- Harness design logic unchanged.


## V3.2.0
Ring Snap/Merge Impact Patch. See PATCHNOTES.md. V3.1.0 remains the Modular Golden reference.


## V3.2.1
Targeted Ring/Topology fix. See PATCHNOTES.md (newest first).


## V3.2.2
Topology Integrity: panel outer hull, mirror pair transactions, mirror-priority Entmerge, multi-screenshot debug.


## V3.3.0
Edge-first strap solver + visual step debugger. V3.2.2 topology remains the reference base.


## V3.3.1
Continuity-aware Surface-Walker, live/mirrored width, endpoint blending, tester final-page fix.


## V3.4.0
Rebuilt strap construction from V3.3.1: 2-tap Direct or optional 3-tap Guided, rigid parallel nominal edges, global ± projection.
