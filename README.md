# Harness Designer V1.5 — Body System

Stable base: V1.4l
Integrated model block: Body Model Lab v0.2

## Body controls
- Female / Male
- Körperform: Schlank ↔ Neutral ↔ Curvy
- Muskulatur
- Höhe 145–205 cm
- Arme: Gerade ↔ A-Pose ↔ Unten
- Beine: Offen ↔ Zusammen

## Performance
The body morphs/height update live while sliding.
The harness itself is reprojected only when the slider is released (`change`).
No harness reprojection runs every frame.

## Reprojection
On a committed body change:
- user-placed surface nodes/rings are projected onto the current body mesh
- strap- and crossing-derived nodes keep their dynamic topology
- straps are rebuilt from their endpoints
- crossings and dynamic symmetry are reconciled afterwards

## Safety
- app still starts with the old procedural mannequin immediately
- Male/Female GLBs are loaded asynchronously afterwards
- if GLB loading fails, the fallback remains usable
- custom GLB upload is retained
- V1.4l strap, surface-follow, split, crossing, symmetry and coupling logic remain in place

## UI
The object header is repaired to fit:
name | couple | lock | delete
in one row.
