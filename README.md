# Harness Designer V1 — Clean Rewrite

Fresh implementation. No previous strap/node engine code was copied.

## Core architecture
- project state is plain data (`nodes`, `straps`)
- Three.js objects are render-only
- dragging a node updates only that node and straps directly connected to it
- no global geometry rebuild during ordinary drag

## Implemented
- iPhone-first compact UI based on the late V0.10 screenshots
- fallback mannequin
- GLB/GLTF model upload
- manual model XYZ rotation + surface offset
- ring/point unified node model
- ring diameter, thickness and point size
- direct numeric entry + 4 long-press-save presets
- ring placement and body-surface dragging
- center-axis snapping
- connect two nodes into a strap
- Strap Engine: automatic single-control quadratic Bezier
- width and slack
- live strap geometry updates using one persistent BufferGeometry
- additional manual curve points
- manual curve-point dragging
- Auto resets to the simple one-point strap
- ring-edge strap termination
- leather-colored ring wrap segments
- strap anchors stored as percentage `t` on the curve
- mirror mode + mirror selected
- object lock/delete
- undo/redo + local autosave snapshots
- single-finger camera / two-finger zoom+pan
- resizable, internally scrollable bottom sheet

## Deliberately deferred until the V1 core is stress-tested
- automatic crossing nodes
- true strap split/merge when an anchor is converted to a ring
- accessories / rivets / eyelets
- chains
- strap grid/pixel designer
- photo/pose mode
- light/material/blacklight controls
- randomizer / preset design generator

The next gate should be performance and interaction testing with 10–20 straps before those systems are added.
