# Harness Designer V1.7f

Built on V1.7e.

## Auto is now the default strap mode
New straps start with Auto-Fit enabled automatically.

Adaptive fitting is stricter:
- max recursion depth 6
- minimum segment 0.075
- position tolerance ~0.009 scene units
- normal tolerance 0.12
- accepted longer segments receive an additional 1/3 + 2/3 verification pass

This intentionally prefers one extra guide point over a visible body intersection.

Manual `+ Punkt` remains available when a specific artistic route is desired.

## Smooth panel boundaries
The previous panel-edge method removed complete triangles under straps/rings,
which caused jagged/sawtooth edges and occasional overlap.

V1.7f changes the actual panel topology:
- each panel edge that has a boundary strap is inset to the strap's inner edge
- consecutive offset edges are intersected to form a smooth new contour
- rings are true circular holes passed directly to `THREE.ShapeUtils.triangulateShape`
- no triangle-centroid clipping is required for the visible boundary

The same smooth contour is used for both drag preview and committed body-fit geometry.

Dynamic panel subdivision by physical size from V1.7e remains active.
