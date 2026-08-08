# Harness Designer V0.7 — Dynamic Node Core

Major controlled rewrite of the construction graph.

Implemented:
- unified NODE model for body nodes and strap nodes
- strap nodes are stored by percentage along their parent strap and recalculated dynamically
- strap shape handle stores local offsets in a moving strap frame instead of a fixed world coordinate
- tapping ANY existing ring/node/strap/strap-handle always selects it and opens its editor
- strap contact on a visible ring is recalculated from the current strap direction every rebuild
- nodes can toggle between white construction point and physical ring
- when a strap node becomes a ring, its parent strap is rendered as two segments ending at the ring; turning Ring off restores a continuous strap
- mirrored pairs retain linked geometry parameters
- envelope controls retained
- surface nodes retain centre-axis snap

Intentionally deferred:
- automatic crossing nodes
- multi-contact ring seating
- adaptive high-curvature surface solver
- symmetric collision envelope
- final resizable/scrolling menu system
