# Harness Designer V1.4b — Topology cleanup & split pairing

Focused bugfix over V1.4a.

## Exactly one anchor at a junction
- Splitting a strap now migrates surviving manual anchors to the correct child strap.
- Their `t` value is recalculated relative to the new child.
- Duplicate anchors at the actual split position are removed.
- Automatic crossing nodes attached to a deleted parent strap are discarded and recalculated.
- Orphan dynamic nodes referencing deleted straps are cleaned before crossing refresh.

## Crossing dedupe around converted rings
- Automatic crossing detection will not create another point beside an existing explicit:
  - anchor
  - ring
  - junction
- A converted crossing ring therefore owns that physical intersection.

## Mirrored split straps remain mirrored pairs
- If mirrored straps are split, their child straps are matched by mirrored endpoints.
- Matching children receive reciprocal `mirrorId`s.
- Width, slack and curve configuration are synchronized immediately.
- A mirrored X-crossing split into a center ring therefore becomes two new mirrored strap pairs.

## Split strap settings
- Both child straps inherit the exact parent width and slack at split time.
- Length-relative slack from V1.3/V1.4a remains active.
