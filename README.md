# Harness Designer V0.11a — Live Bezier Preview

Based on V0.11 Strap Engine 2.0.

During drag:
- shows the actual quadratic Bezier strap shape live
- updates once per animation frame
- 16 curve samples
- uses the same ribbonGeometry as the final strap
- skips body midpoint projection, crossings, ring-wrap rebuilds and full topology work
- final strap group is hidden only while the live preview is shown

On release:
- preview disappears
- one full V0.11 quality rebuild runs, including the single midpoint body query,
  crossings, wraps and all final topology

This restores WYSIWYG-style live editing while keeping the new lightweight
Strap Engine 2.0.
