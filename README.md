# Harness Designer V1.4j

Built on V1.4i. The working optional surface-follow strap engine is unchanged.

## Fix: mirrored crossing anchors -> rings
Automatic crossing anchors are now geometrically paired with their mirrored
counterpart. Converting one mirrored crossing point to a ring converts the
partner too and repairs the split strap pairing on both sides.

## Dynamic symmetry pairing
Pairing is now treated as a property of current mirror geometry, not as a
permanent historical link.

- rings/anchors that are mirrored about X=0 can become pairs
- straps are pairs when their endpoint topology is mirrored about X=0
- if a shared center ring is moved off-axis, affected strap pairs dissolve
- when geometry is returned to mirror symmetry, the pairs reform
- no continuous all-frame scan: reconciliation happens after completed drags,
  crossing topology changes, conversion, and restore

When two previously independent straps re-form a pair and their parameters
differ, V1.4j uses the most recently edited member as the master. If one of
them is currently selected, the selected member wins. This avoids arbitrary
averaging and preserves an intentional edit.

Standard V1.4i strap performance/surface-follow behavior remains unchanged.
