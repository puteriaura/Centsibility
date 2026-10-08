# Centsibility icons

Penny's simplified coin face is used for the AI icon and browser favicon. The app icon uses the same face on Penny's plum shoe color, with no coin outline, gradients, or added symbols.

`centsibility-app.svg` is the editable 1024px master. PNG exports are supplied at 180px (Apple touch icon), 192px, 512px, and 1024px. The web manifest uses the 192px and 512px versions. The 512px artwork fits the maskable icon safe area.

Regenerate PNGs from the repository root with `node mascot/penny-animations/export-app-icons.mjs`. It uses the existing Playwright dependency and local Chromium; set `CHROMIUM_PATH` if Chromium is installed elsewhere.

Animated app artwork lives in `src/assets/penny`, copied from `mascot/penny-animations/animated`. After changing the animation master, regenerate it with `node mascot/penny-animations/build.mjs` and copy the generated SVGs to `src/assets/penny`.
