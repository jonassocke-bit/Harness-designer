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
