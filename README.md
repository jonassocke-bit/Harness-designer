# Harness Designer V1.8k

Based directly on V1.8i to restore the preferred strap behavior.

V1.8j is intentionally discarded.

What changed versus V1.8i:
- Ring-side visible strap endpoints now use the actual rendered ring plane:
  body surface + global surface offset + ring tube radius.
- The cyan manual projection guide no longer uses a fixed magic lift.
  It uses V1.8i's existing `surfaceClearanceForStrap(s)` value.

What did NOT change:
- strapFrame
- strapCurve
- manualControlWorld
- Auto route construction
- V1.8i tension / clearance / slack behavior
- ~1 cm projection sampling
- local convex refinement
- Auto ON by default
- panels

The strap is therefore NOT forced onto a common virtual shell. It retains the
slightly free/tensioned behavior seen in V1.8i, while ring transitions and the
cyan guide use consistent offsets.
