# Harness Designer V0.10m

Built from known-good V0.10j.

Menu:
- complete intact selection header is moved structurally into `.sheet-scroll`
- Ring/N1, Lock and Delete can scroll fully out of sight
- no HTML string-fragment surgery

Drag performance:
- NO strap ribbon geometry is rebuilt while dragging
- each connection uses one reusable BoxGeometry preview
- pointer movement only changes preview transform (position / quaternion / scale)
- final ribbon, crossings, wraps and surface following are rebuilt exactly once on release

This specifically targets the slowdown that occurs only while moving a strap/end node.
