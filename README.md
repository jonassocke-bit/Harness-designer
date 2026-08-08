# Harness Designer V0.7b

Fixes for node/ring editing:

- normal strap anchors can now be dragged directly along their parent strap
- their percentage `t` updates while dragging, so they remain dynamic
- after converting a strap anchor into a ring, it becomes a freely movable body/surface node
- moving that converted ring moves the endpoints of BOTH split strap segments
- converted rings receive a stored construction-surface point + normal
- every visible ring now uses exactly the same ring menu:
  - Ring toggle
  - diameter
  - thickness
  - point size
- turning a converted ring back off merges the two strap segments and restores the percentage-based strap anchor editor
- surface rings and converted rings share the same drag behavior
