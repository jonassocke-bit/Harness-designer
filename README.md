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
