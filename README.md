# V1.9k2 BODY COLOR SAFE

Rebuilt directly from the known-starting V1.9j3.

V1.9k startup bug:
BODY_MAT referenced `bodyColorHex` before `bodyColorHex` was initialized,
causing a browser ReferenceError (temporal dead zone). `node --check` cannot
detect that class of runtime initialization error.

V1.9k2:
- leaves BODY_MAT startup construction exactly as in V1.9j3
- initializes bodyColorHex before runtime use
- applies saved color only after the fallback body exists
- recolors all body mesh materials live
- stores the chosen color in localStorage
- reapplies it after integrated body morph/model updates

No panel geometry/extraction logic was changed.
