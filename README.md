# Harness Designer V1.4f — Safe highlight recovery

Built from the known-good V1.4d, not from V1.4e.

- Completely removes clone-based selection glow geometry.
- No material cloning during drag or geometry rebuild.
- Selection uses the three pre-existing selected materials only.
- Both members of a mirrored node/strap pair are highlighted equally.
- Global selection color picker changes those persistent selected materials.
- Selection highlight is refreshed only after explicit UI edits/selection changes.
- Pair deletion: deleting one mirrored node/strap deletes its paired partner.
- Merged center ring:
  - X remains snapped to 0 while moving along mannequin Y/Z.
  - lateral pull beyond snap-out threshold entmerges in the same gesture.
- Keeps V1.4d startup safeguard, one-shot connect UX, defaults, global anchor size,
  and V1.4b topology logic.
