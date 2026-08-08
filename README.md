# Harness Designer V0.5e

Critical UI fix:
- Ring editor was broken because Three.js ring groups store their type in `userData.kind`, while the UI checked `selected.kind`.
- Central `kindOf()` now handles both Three.js objects and plain connection objects.

Changes:
- Ring mode: tap ring => ring menu with diameter/thickness.
- Connect mode: tap strap => strap menu.
- Strap midpoint handles are visible and draggable again in Connect mode.
- Mirror and model-rotation controls are separate circular bubbles in the upper-right.
- Mirror bubble is a true toggle: white=on, dark=off; it never changes Ring/Connect mode.
- Instruction banner removed.
- Floor now shows the world x=0 mirror centreline as a visual alignment guide.
- Manual X/Y/Z rotation remains available.
