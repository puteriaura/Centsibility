# Penny animation package

The 12 approved MVP states are implemented as editable SVG + CSS. Neutral is deliberately static; the other 11 have actual motion. This package recreates Penny as deterministic vector artwork rather than moving a flattened generated image.

## View and download

Open `index.html` in a browser. Each state has Replay, SVG download, and Still download controls. The gallery also has reduced-motion, dark-background, pause, and Repeat previews controls. Preview repetition is enabled by default, with a brief pause between gestures, and stops when paused, hidden, offscreen, or reduced motion is enabled. This affects the gallery only; exported one-shot SVGs still play once. `welcome.html` shows the first completed animation on its own.

- `animated/`: 12 SVG files with self-contained CSS and no external dependencies.
- `static/`: 12 still SVGs matching the reduced-motion poses.
- `previews/`: 12 rendered GIF previews and desktop/mobile gallery screenshots.
- `manifest.json`: names, durations, playback modes, tool choice, and file paths.
- `build.mjs`: editable vector artwork and animation definitions.
- `verify.mjs`: executable browser verification and optional GIF export.

## Decisions where the request left placeholders

- Scope: the 12 MVP states from the approved catalog, reused across app contexts.
- Primary format: web-embeddable SVG + CSS, provided as downloadable files.
- Canvas: transparent, scalable 512 × 512 SVG viewBox. CSS motion follows browser refresh rate rather than a fixed video frame rate.
- GIF previews: 512 × 512, sampled at 30 fps, white background. GIF timing has centisecond precision, so display cadence varies slightly. One-shot previews repeat for review and include a 0.5-second final hold. Loading previews contain exactly one seamless cycle. The primary one-shot SVGs do not repeat.
- Palette: flat muted gold `#E2C66B`, ochre thickness `#CBA951`, brown stick limbs `#82602D`, plum shoes `#302046`, ink face `#211D17`, restrained green check `#44836C`.
- Dark backgrounds use lighter plum shoes `#856591` and lighter brown limbs `#BA9557`. Standalone SVGs follow the OS color-scheme preference; the preview's dark-background toggle demonstrates this treatment explicitly.
- Style: slightly asymmetric coin shape, small dot eyes and pen-line mouth, simple stick arms without gloves, no perimeter outline, gradients, texture, shine, halo, or confetti.
- Pacing: clear gestures sized for phone screens, one grounded hop for celebration, no rubbery coin deformation. Happy lifts 20px, Celebrate lifts 44px, and Loading rocks through ±6° in the 512px viewBox. Welcome uses an 80° wave swing. Durations and static reduced-motion poses are unchanged from the first build.
- Reduced motion: immediately use the matching still pose, with no active animation. Supply ordinary app text for loading, save status, errors, and budget information.

## Tool choice, one line per state

Chromium is the free, open-source rendering tool for every SVG/CSS state. No paid tool or animation library is used. Node.js runs the source-file builder; Playwright verifies rendered behavior; FFmpeg encodes GIF previews. These supporting tools are also free and open source.

| State | What happens | Motion duration | Playback | Animation tool and reason |
| --- | --- | --- | --- | --- |
| Neutral | Ready pose | 0s | Static | Chromium / SVG: keeps the resting state still and scalable. |
| Welcome | A small two-part wave, then a raised-arm hold | 1.1s | One-shot | Chromium / SVG+CSS: rotates one arm cleanly around its attachment. |
| Guide | One arm extends toward the next action | 0.7s | One-shot | Chromium / SVG+CSS: a single rotation communicates direction. |
| Happy | Small lift and settle with an open smile | 0.6s | One-shot | Chromium / SVG+CSS: one translation keeps the coin rigid. |
| Encouraging | Whole-character supportive nod and arm gesture | 0.7s | One-shot | Chromium / SVG+CSS: rotation makes the nod visible without elaborate rigging. |
| Attentive | Brief calm whole-character tilt | 0.5s | One-shot | Chromium / SVG+CSS: a 6° rotation draws attention without alarm. |
| Proud | Arms gently settle into a confident pose | 0.8s | One-shot | Chromium / SVG+CSS: coordinated arm rotations retain the simple drawing. |
| Celebrate | One modest hop and raised arms | 1.2s | One-shot | Chromium / SVG+CSS: translation and arm rotation carry the whole gesture. |
| Reassuring | Arms open gently | 0.9s | One-shot | Chromium / SVG+CSS: mirrored rotations form a supportive gesture. |
| Loading | Restrained alternating tilt, eyes awake | 1.6s per cycle | Pending-only loop | Chromium / SVG+CSS: a native repeat indicates ongoing work without fake progress. |
| Saved | Small nod and separate check appears | 0.5s | One-shot | Chromium / SVG+CSS: opacity and a small transform confirm completion. |
| Unavailable | Tiny settle into a calm straight-mouth pose | 0.5s | One-shot | Chromium / SVG+CSS: one rotation settles without sadness or blame. |

## Embed

Serve the SVG with `image/svg+xml`. Example:

```html
<img src="/mascot/animated/welcome.svg" width="160" height="160" alt="Penny welcomes you">
```

Use an empty `alt` when Penny is decorative and nearby text already carries the status. The SVG's internal CSS respects the operating system's reduced-motion preference. For an application-specific reduced-motion toggle, select the corresponding `static/` asset. An external `<img>`'s internals cannot be controlled through parent-page CSS.

For an inline SVG, copy the SVG markup into the component. Selectors are scoped per state so different Penny states can coexist. Restart a one-shot by replacing or remounting that SVG. Do not queue repeated save feedback. Trigger Saved only after confirmed persistence; use the same state for income and expenses. Use Attentive or Reassuring for budget setbacks, never a disappointed face.

Stop or remove Loading when work completes or the graphic is offscreen. The supplied gallery pauses when hidden or offscreen; a consuming app needs equivalent lifecycle control. Native mobile frameworks do not directly play SVG CSS: these files need a web renderer or a deliberate port to the platform's animation system. No native Rive, Lottie, MP4, or app integration is included.

## Rebuild and verify

From the Centsibility project root:

```text
node mascot/penny-animations/build.mjs
node mascot/penny-animations/verify.mjs
node mascot/penny-animations/verify.mjs all
```

The builder uses Node.js standard libraries only. Verification uses the project's existing Playwright dependency and an installed Chromium executable. Adjust the executable path in `verify.mjs` on another machine. GIF export additionally requires FFmpeg on PATH. No installation was needed on this machine.

Verification covers actual changing poses, every OS reduced-motion fallback matching its still file, gallery replay, manual reduced motion after replay, CSS isolation across simultaneous states, and mobile layout without horizontal overflow. Static fallback screenshots were visually inspected on light and dark backgrounds. Frame-sequence GIFs were rendered from the same actual SVG timelines.

The original draft and earlier raster explorations remain separate. This folder is the animation source of truth for the approved outline-free direction.
