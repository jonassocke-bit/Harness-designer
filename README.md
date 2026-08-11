# Harness Designer V1.7a — startup hotfix

Built directly from V1.7.

Fix:
- repaired the `mirrorSelectedBtn` handler after the panel branch was inserted
- node / strap / panel mirror branches are now one valid, explicit handler
- the render loop starts before asynchronous model work
- initial history snapshot is guarded so a history error cannot block first render

No panel geometry, raster, strap, body or Undo/Redo feature logic was otherwise changed.
