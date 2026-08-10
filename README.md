# Harness Designer V1.4 — Anchors, Split/Merge & Crossings

Built on V1.3.

## Dynamic strap anchors
- `+ Anker auf Riemen` creates a dynamic node at t=0.5.
- Anchor position is editable with a 0–100% slider.
- Anchor follows the strap automatically.
- Anchors are pickable connection targets.
- Mirrored straps create paired mirrored anchors.

## Point <-> Ring with real topology
- Turning a strap anchor into a ring physically splits its parent strap into two straps.
- Turning the ring back into a point removes the two children and restores the original through-strap.
- Existing side straps attached to the node remain attached.
- Crossing points use the same mechanism, splitting both crossing straps into four children.

## Automatic crossings
- Crossings are detected between strap curves after drag/release or structural edits.
- No global crossing search happens during pointermove.
- An automatic crossing creates a dynamic point tied to both straps.
- Crossing point can be selected and converted into a real ring.
- Shared-endpoint straps are excluded.
- Automatic non-ring crossing points are rebuilt after relevant changes.

## Retained
- V1.3 continuous mirror-axis merge/entmerge.
- topology-preserving ring-pair merge/entmerge.
- length-relative slack.
- ring-first touch picking.
