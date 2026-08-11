# Harness Designer V1.8h MESH PATH — experimental side-by-side build

This build is based directly on V1.8g so it can be compared against it.

Difference:
V1.8g projects discrete chord samples with raycasts.
V1.8h computes an A* route over the actual triangle-vertex graph of the mannequin.

Mesh-path method:
1. Find body mesh vertices nearest Ring A and Ring B.
2. Build/reuse body triangle adjacency.
3. A* searches an actual connected surface-edge route between those vertices.
4. Search cost mildly prefers the original straight A→B chord, preventing needless paths around the back.
5. The resulting mesh-edge polyline is resampled at approximately 1.7 cm spacing.
6. Cyan guide and Auto both use this same surface path.
7. If the graph method is unavailable, V1.8g projection is used as fallback.

Because every raw path segment is a real mesh edge, a convex shoulder cannot make the guide chord through the mannequin between projected samples.

Panels are unchanged.
