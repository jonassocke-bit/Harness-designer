# Harness Designer V0.6 — Smooth Collision Envelope

## Smooth collision envelope
- Visible mannequin stays unchanged.
- A separate internal collision envelope can be generated around it.
- Model menu controls:
  - Oberflächenglättung 0–100 %
  - Hüllenabstand 0–30 mm
  - Hülle anzeigen An/Aus
- Rings, strap path projection and picking use the envelope when smoothing or inflate is active.
- Turning smoothing and inflate both to zero falls back to the original body mesh.

## Visual inspection
- Envelope can be shown as a translucent white shell.
- The shell is independent from the visible mannequin.

## Compact UI
- Bottom sheets, sliders, labels and buttons use less vertical space.
- Build tools and bottom mode switch are smaller.
- Utility bubbles are slightly smaller.
