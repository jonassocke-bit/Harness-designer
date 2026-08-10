# Harness Designer V1.4a — Bugfix

Fixes three V1.4 issues:

1. Manual curve points no longer disable slack behavior.
   - Slack remains length-relative and body-outward.
   - Extra points only refine the curve.
   - Generated points no longer introduce a fixed oversized offset.

2. Automatic crossing points are stable.
   - Each crossing pair gets a stable key based on the two strap IDs.
   - Existing crossing nodes are updated/reused after movement.
   - Obsolete crossing nodes are removed.
   - No duplicate old crossing point should remain after recalculation.

3. Point -> Ring updates immediately.
   - Ring state is applied before the strap is physically split.
   - New child straps immediately recalculate visible endpoints against ring radius.
   - Ring wraps and attached strap geometry refresh immediately.
