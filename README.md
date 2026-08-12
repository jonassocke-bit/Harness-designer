# V1.9j2 PANEL FLOODFILL LITE

Rebuilt directly from working V1.9f2.

The previous V1.9j could stall on iPhone because it constructed triangle
adjacency for the entire mannequin mesh.

This build:
- removes the average-normal rejection;
- gathers only triangles that overlap the requested panel region;
- constructs connectivity only among those candidate triangles;
- selects the connected candidate component nearest the panel center;
- retains V1.9f2 exact boundary clipping/triangulation;
- adds optional yellow source-triangle debug;
- adds committed panel build timing;
- keeps ring-hole logic unchanged.

No whole-body adjacency arrays or whole-body floodfill are allocated.
