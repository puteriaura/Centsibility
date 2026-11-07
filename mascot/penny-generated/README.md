# Penny generated design package

This package contains 11 PNG visual assets: one transparent full-body master, eight context reference sheets, one corrected 12-state MVP sheet, and one transparent face-only avatar. The context sheets cover 69 catalog entries; the MVP sheet reuses 12 states across those entries.

## Start here

- [12 MVP states](09-mvp-states.png)
- [Full-body master](00-penny-master.png)
- [Small avatar](10-small-avatar.png)

## Complete context catalog

- [CORE EMOTIONS — 12 entries](01-core-emotions.png)
- [ONBOARDING — 7 entries](02-onboarding.png)
- [MONEY EVENTS — 12 entries](03-money-events.png)
- [IDLE AND AMBIENT — 7 entries](04-idle-ambient.png)
- [UI INTERACTIONS — 7 entries](05-ui-interactions.png)
- [NOTIFICATIONS AND REMINDERS — 7 entries](06-notifications.png)
- [MILESTONES AND CELEBRATIONS — 6 entries](07-seasonal-milestones.png)
- [ERRORS AND EDGE CASES — 11 entries](08-errors-edge-cases.png)

## What these files are

Generated raster character-design references and static pose concepts. The sheets have white backgrounds and labels. Only the master and avatar were requested with transparent backgrounds. These are not individual transparent cutouts, editable vectors, frame-accurate sprite sheets, animated clips, or Rive files.

All sheets were visually inspected. The MVP Saved badge was corrected from a heart to a check; Loading was corrected to an awake face; Unavailable was corrected to a calm straight mouth. A generated artifact in the first avatar was removed through imagegen.

## Production cleanup

Use the corrected MVP sheet as the expression source of truth. The generated context sheets contain small differences in rim orientation, finger shape, pose scale, shading, and embellishments. Standardize these while rebuilding the character as layered vector art; do not auto-trace every panel separately. The avatar is simplified but has not been tested as an actual 40px export or platform app icon.

Keep sad and worried faces out of automatic spending feedback. The permission explanation pose on the onboarding sheet has clasped hands: use calm attentive Penny instead in the product so refusal never feels like disappointing the mascot.

## Motion handoff

Build one front-facing rigid coin rig with separate eyes, mouths, arms, short legs, and plum shoes. Each MVP state has a static reduced-motion fallback.

| State | Motion | Duration | Playback | Static fallback |
| --- | --- | --- | --- | --- |
| Neutral | Hold | 0s | Static | Neutral pose |
| Welcome | Two small waves | 1.1s | One-shot | Raised greeting hand |
| Guide | Extend pointing arm | 0.7s | One-shot | Pointing pose |
| Happy | Small lift and settle | 0.6s | One-shot | Happy face |
| Encouraging | Small nod | 0.7s | One-shot | Encouraging face |
| Attentive | Small lean and settle | 0.5s | One-shot | Attentive pose |
| Proud | Straighten and settle | 0.8s | One-shot | Proud pose |
| Celebrate | One modest hop; arms raised | 1.2s | One-shot | Raised arms and open smile |
| Reassuring | Open-hand gesture | 0.9s | One-shot | Supportive hand |
| Loading | Restrained alternating tilt | 1.6s cycle | Pending-only loop | Awake neutral pose with loading text |
| Saved | Confirmation nod | 0.5s | One-shot | Smile with check |
| Unavailable | Small settle | 0.5s | One-shot | Calm straight-mouth pose |

Celebrate a goal only after confirmed completion. Use the same Saved state for income and expenses. Budget limits and overspending use Attentive; missed habits use Neutral or Reassuring. Errors interrupt celebrations. Do not queue repeated feedback. Pause loops offscreen. Reduced motion immediately uses still poses.

Recommended implementation format: Rive plus transparent static exports. A native Rive project, runtime integration, and playable motion are not included in this generated art package.

## Prompts

[prompts.md](prompts.md) contains the generation and final correction prompts. The original Centsibility.jpeg was preserved.

