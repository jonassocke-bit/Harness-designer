# V1.9k BODY COLOR TEST

Diagnostic build based directly on V1.9j3.

Only intended feature addition:
- live Mannequin color picker in the Body panel
- color applies to all mannequin body meshes
- chosen color is persisted in localStorage
- current default remains #e9e9e9

Purpose:
Use extreme mannequin colors (red, blue, black, green) to determine whether the
angle-dependent bright lines seen through panels are actually mannequin pixels
showing through, or are instead panel shading/lighting artifacts.

Panel geometry and extraction logic are otherwise unchanged.
