# Harness Designer V1.7e

- Auto straps now use adaptive recursive surface guides: points are inserted only where a straight section materially misses body curvature.
- Auto UI reports the actual internal point count.
- Panel committed subdivision scales with physical panel size (2/3/4 levels).
- Large torso panels therefore receive more body-fit samples than small panels.
- Panels are geometrically clipped underneath existing straps that connect consecutive panel boundary nodes.
- Ring cut radius is tightened so the panel reaches closer to the ring.
- Live drag preview remains cheap; dense panel calculation still runs only after release.
