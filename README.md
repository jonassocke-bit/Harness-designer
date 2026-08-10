# Harness Designer V1.4e — Interaction / Highlight Cleanup

- Merged center rings can move smoothly along the mirror axis:
  - X stays snapped to 0
  - Y/Z follow the mannequin surface under the finger
  - lateral drag beyond the release threshold entmerges in the same gesture
- Deleting one member of a mirrored ring pair deletes both.
- Deleting one member of a mirrored strap pair deletes both.
- Clone-based glow is removed.
- Selection highlight is applied directly to the real node/strap materials.
- Both members of a mirror pair receive the same highlight.
- Highlight follows movement, resize and strap deformation automatically.
- Global selection color picker added to the 3D model/settings panel.
- Selection color is persisted in localStorage.
- V1.4d one-shot connect UX and V1.4b topology remain intact.
