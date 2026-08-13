# V1.9l PANEL EDGE WELD

Built directly from user-confirmed starting V1.9k3.

Only `buildPanelGeometry()` was replaced.

Change:
- final clipped panel vertices are canonicalized into one indexed vertex pool
- coincident vertices use the exact same vertex index
- their normals are averaged once
- panel offset is applied once per shared vertex
- adjacent triangles therefore cannot separate again because of independent offsets

Unchanged:
- startup/init
- panel extraction
- clipping
- ring-hole selection
- straps/rings/snapping
- body system
- V1.9k3 mannequin color diagnostic
