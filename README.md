# Harness Designer V1.8e

Based on the stable V1.8d/V1.8c line.

Changes:
- Manual cyan guide is now generated from the perfectly straight Ring-A-centre -> Ring-B-centre chord.
- Projection samples are spaced by strap length: approximately one sample every 5 cm (3–24 segments).
- Each chord sample is ray-cast toward the mannequin along the interpolated endpoint surface normal.
- Rare missed samples are interpolated, so the cyan line has no holes.
- Auto uses exactly the same projected chord data as manual mode.
- Auto route reduction is capped at 8 points.
- Auto button now has an explicit visible active/pressed style.
- While +Punkt mode is waiting for input, two-finger pinch/pan works normally.
- One-finger drag still rotates the camera while staying in point-placement mode.
- Panel code is unchanged.
