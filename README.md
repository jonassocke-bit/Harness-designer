# Harness Designer V0.10l — Drag Performance

Two-stage geometry update:

During finger drag:
- updates are coalesced to at most one geometry refresh per animation frame
- fast curve uses only 5 support points
- fast ribbon uses only 12 samples
- no automatic crossing refresh
- no ring-wrap rebuild
- no expensive surface-normal raycasts for ribbon orientation
- no full multi-pass solver

On pointer release:
- one full `updateAllGeometry()` restores final high-quality geometry,
  crossings, wraps and surface following.

This specifically targets the reported slowdown that occurs only while moving
a strap / strap endpoint. Static scene quality remains unchanged.
