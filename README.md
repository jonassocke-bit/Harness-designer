# V1.9n SURFACE LAB

Built directly from user-confirmed V1.9k3.

- Panels are back to the minimal fast body-triangle extraction.
- Final auto straps are an experimental body-mesh extraction inside the
  current Strip left/right footprint.
- During ring dragging the old geometry is retained as the cheap preview.
- Straps have priority over panels.
- Older existing panels have priority over newer panels, so neighboring
  surfaces do not simply render on top of each other.
- The mannequin color diagnostic remains.

The internal priority boundary is deliberately triangle-level in this lab
build. The goal is to test the common surface approach and speed before an
exact secondary boundary-cut pass.
