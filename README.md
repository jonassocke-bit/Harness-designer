# Harness Designer V1.4k
Clean rebuild from working V1.4i.

Fixes V1.4j runtime regression caused by a duplicate function name colliding
with the existing split-pair helper. All new symmetry helpers use unique dyn*
names. Stale refreshSelectionGlow calls are also removed.

Dynamic symmetry is reconciled only after completed drags/topology changes:
mirrored crossing anchors convert together, pairs dissolve when asymmetry is
introduced, and reform when mirror geometry returns. V1.4i surface routing is unchanged.
