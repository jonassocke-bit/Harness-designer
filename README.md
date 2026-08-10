# Harness Designer V1.4g — Surface guides & visible-only picking

Built on stable V1.4f.

## Strap surface guides
- Each `+ Punkt` now creates ONE explicit surface guide.
- The guide is projected to the nearest mannequin/body surface.
- Guides store body-surface position + surface normal.
- A Catmull-Rom curve runs through the ordered surface guides.
- Slack lifts the curve outward from those guides instead of replacing them.
- This is intended for shoulder, flank, hip and front-to-back routing.
- Mirrored straps regenerate guide points on their own mirrored body surface.

## Visible-only picking
- Rings/points hidden behind the mannequin are ignored.
- Strap ray hits are compared against the nearest mannequin ray hit.
- A strap behind the body cannot be selected through the mannequin.
- Generous touch targets remain for visible rings.
- This allows building the back without constantly catching front-side objects.

Existing V1.4f selection color, pair delete, one-shot connect,
axis merge/entmerge and topology logic are retained.
