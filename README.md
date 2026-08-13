# Harness Designer V2 Alpha

This is a clean rebuild, not a patch of V1.

## Architecture
- `config.js` — immutable tuning constants
- `state.js` — pure application data
- `geometry.js` — math helpers only
- `body.js` — body loading + surface access
- `nodes.js` — rings / points / merge primitives
- `straps.js` — auto Strip solver + renderer
- `panels.js` — fast body-mesh extraction panels
- `history.js` — serialized data-model undo/redo/persistence
- `interaction.js` — pointer/camera/object interaction
- `ui.js` — UI binding only
- `app.js` — startup/render loop only

All files use the global `HD` namespace so they work as ordinary scripts and
do not require ES-module hosting.

## Implemented in this Alpha
- body loading (female / male)
- body color diagnostic
- global surface offset
- ring / point nodes
- dynamic ring hitboxes
- ring parameter editing
- mirror pairs
- generic ring merge/unmerge foundation
- auto Strip straps only
- 3-line concept: center projection + independently projected left/right edges
- cheap strap preview while moving a ring
- strap width editing
- strap debug lines
- fast extracted-body panels
- ring and strap panel cut approximation
- panel creation tool
- Undo / Redo from data snapshots
- localStorage persistence
- hitbox debug
- iPhone camera orbit + pinch zoom

## Deliberately deferred until Alpha is validated
- polished generic merge topology restoration for every nested case
- anchor-on-strap split/merge system
- auto crossing nodes
- exact strap-panel and panel-panel shared-edge clipping
- material editor / mesh materials
- Body Lab integration API beyond the current Body module seam
- advanced model upload

The point of V2 Alpha is to validate the architecture and core workflows before
adding those systems. Patches should stay isolated to the owning module.
