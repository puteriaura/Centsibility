# Mobile UI and Design Audit

## 1. Verdict

This is a React web application pretending to be a mobile app. The core stack is capable of a good mobile product, but the current UI is not release-ready on phones. The landing page can overflow at 360px, the navigation contains a fake primary action, input text will trigger iOS zoom, and dialogs and several interactive surfaces are inaccessible. The visual system has a solid token start, then loses discipline in 3,286 lines of global CSS and many inline overrides. **Recommendation: fix in place with a mobile-first refactor; do not rebuild.**

## 2. DESIGN.md summary (15 lines)

1. Use white or near-white as the dominant surface, with AEON pink/magenta reserved for brand and important actions.
2. Core palette is specified through `--primary`, semantic text/surface colors, semantic feedback colors, and pastel illustration accents.
3. Use a rounded modern sans serif; the suggested stack is Inter, Nunito Sans, then system fonts.
4. Typography spans display 36–44px, h1 30–36px, h2 24–30px, body 15–16px, labels 13–14px, captions 11–13px, and strong tabular financial figures.
5. Use a 4px base grid; primary spacing should usually be on 8px increments.
6. Recommended mobile padding is 16px small, 20px normal, and 24px large.
7. Component rhythm is 8–12px inside controls, 16px related content, 24px component groups, 32px sections.
8. Radius tokens run 8/12/16/20/24px plus pill; normal cards are 12–16px.
9. Elevation is subtle and secondary to whitespace, tint, and rounded geometry.
10. Mobile navigation should be a small bottom-nav set with clearly pink active state; top bars stay compact.
11. Buttons are 44–52px high; inputs are 48–56px high with visible labels and pink focus.
12. Mobile content prioritizes account information, primary actions, alerts, recent activity, then secondary features; default to one column.
13. Tablet can use two columns; desktop should use constrained, intentionally different layouts rather than stretched mobile.
14. Motion should confirm state, honor reduced motion, and not trivialize financial actions.
15. Accessibility requires WCAG AA contrast, 44px targets, visible focus, icon labels, text alternatives, and reduced-motion support.

**DESIGN.md gap:** it says what mobile should prioritize, but gives no named breakpoint strategy, safe-area rule, keyboard/virtual-keyboard rule, target-size exception policy, or explicit 16px mobile input-font rule. Add those as concrete implementation requirements; otherwise each route invents its own behavior.

## 3. Stack and structure

| Area | Evidence | What it is |
|---|---|---|
| Framework/build | `package.json`, `vite.config.ts` | React 19 + TypeScript, Vite 7, Tailwind CSS 4 via Vite plugin. |
| Routing | `src/router.tsx`, `src/routeTree.gen.ts`, `src/routes/*.tsx` | TanStack Router file-based routes, with automatic route code splitting configured in `vite.config.ts`. |
| Styling | `src/styles.css`, `src/components/ui/*.tsx`, route JSX | Global CSS tokens/classes plus Tailwind utility classes plus extensive inline style objects. This is three styling systems in one UI. |
| State/data | `src/providers/auth.tsx`, `src/hooks/use-kid-data.ts`, `src/hooks/use-parent-data.ts` | React context and local hooks/state; Supabase auth/database/edge functions. No dedicated client-state store. |
| Navigation shell | `src/components/AppShell.tsx` | Sticky top bar and fixed five-item bottom nav for authenticated kid/parent experiences. |
| Target platform | `index.html`, `src/main.tsx` | Browser-only React DOM app. No native iOS/Android project, PWA manifest, or service worker was found. |

### Coverage map

Covered: `DESIGN.md`; the application entry/root/router; global styles and theme; app shell; all route names (23 route files); shared UI and banking component directories; landing components; data/auth hooks; configuration; all Arabic-script matches; RTL and Arabic-font/config search. Deep-read: landing, kid home, zakat, sadaqah, chat/insights interactions, modal/sheet, input/button/toast, transaction row, and the relevant CSS sections.

Not exhaustively read: every route body, every Supabase migration/function, test implementation, generated route tree, and dependency lockfile. Findings about those areas are not claimed.

## 4. Findings

Severity: **blocker** means a primary flow is misleading/broken; **high** materially harms phone usability or accessibility; **medium** is a clear quality/compliance problem; **low** is cleanup worth bundling into the refactor.

### A. DESIGN.md compliance and visual consistency

| ID | Severity | Evidence | What is wrong | Fix |
|---|---|---|---|---|
| D-01 | high | `src/features/landing/components/LandingHero.tsx:20`, `src/features/landing/components/LandingDualMode.tsx:11` | Both grids demand `minmax(320px, 1fr)` while their sections have 24px left/right padding. At a 360px viewport the content box is 312px, so the grid has a guaranteed overflow condition. This is the opposite of DESIGN.md’s one-column mobile default. | Make the mobile base `grid-template-columns: minmax(0, 1fr)` and introduce two columns only at a documented breakpoint. Test 320, 360, 390, and 430px. |
| D-02 | medium | `src/styles.css:1203-1213`, `src/styles.css:3031-3057` | `#8480D6`, `#FF9500`, `#221538`, and `#F3E8FF` are un-tokenized one-off colors. The violet composer is not part of DESIGN.md’s reconstructed palette; the dark banner contradicts its warning not to make dark navy/dark surfaces dominant. | Replace with documented semantic tokens or add a named, reviewed token only if the role is real. |
| D-03 | medium | `src/components/ui/sonner.tsx:11-16` | Toasts use raw colors and `borderRadius: "0px"`. Square notification chrome clashes directly with DESIGN.md’s 8px minimum radius and rounded UI language. | Use surface/border/text tokens and `--radius-sm`; define semantic success/error toast variants. |
| D-04 | medium | `src/styles.css:1-3286`, `src/features/landing/components/LandingHero.tsx:9-147`, `src/routes/kid.index.tsx:341-366` | Tokens exist, but are bypassed by 3,286 lines of global CSS, arbitrary Tailwind values, and large inline style objects. The result cannot stay visually consistent. The issue is architecture, not taste. | Establish CSS variables + component variants as the single source of visual decisions; migrate route-level inline styles only as their screens are touched. |
| D-05 | medium | `src/styles.css:1100`, `src/styles.css:1184`, `src/styles.css:2966`, `src/routes/kid.card.tsx:87-121` | Repeated 9–12px UI text is below DESIGN.md’s 11–13px caption band and makes a finance product visually fussy. The card screen uses 10px labels for CVV/expiry. | Reserve 11–13px only for noncritical metadata; use tokenized label/body sizes for financial labels and actionable copy. |

### B. Mobile fit, navigation, and resilience

| ID | Severity | Evidence | What is wrong | Fix |
|---|---|---|---|---|
| M-01 | blocker | `src/components/AppShell.tsx:202-219`, `src/components/AppShell.tsx:222-229`; `src/components/AppShell.tsx:233-252`, `src/components/AppShell.tsx:255-270` | The center bottom-nav item is labelled **Scan**, but it routes to the existing Deposit/Approve paths. Its active state checks `/scan`, for which no route exists. This is a prominent, deceptive action, not a shortcut. | Remove it until scanning exists, or build a real scan route and action. Do not label a deposit/approval shortcut as scan. |
| M-02 | high | `src/components/ui/button.tsx:23`, `src/styles.css:947-953`, `src/styles.css:3014-3021`, `src/routes/kid.goals.tsx:387-398` | Multiple controls are under the required 44px mobile target: small button 36px, shell icons 40px on narrow phones, chat action buttons 32px, and goal actions 38px. DESIGN.md itself requires 44px. | Make interactive hit areas at least 44×44 CSS px, even when the visual glyph stays small. |
| M-03 | high | `src/styles.css:122-131`, `src/components/ui/input.tsx:35`, `src/routes/kid.zakat.tsx:159,182`, `src/features/parent/components/ScheduleHibahSection.tsx:121,147`, `src/styles.css:3040-3048` | Inputs use 14–15px type. iOS Safari commonly zooms focused text inputs below 16px. That is disruptive in forms and chat. Zakat also drops input height to 44px, below DESIGN.md’s 48–56px input rule. | Set all editable input/select/textarea text to at least 16px and standardize height to 48px minimum. |
| M-04 | high | `index.html:5-10`, `src/features/landing/components/LandingNav.tsx:9-18` | The app opts into `viewport-fit=cover`, but the public landing header does not include `env(safe-area-inset-top)`. Content can sit under a notch/Dynamic Island. The authenticated shell handles top and bottom insets correctly; the landing page does not. | Give every full-bleed top/bottom surface safe-area padding, including landing and any full-screen modal/chat surface. |
| M-05 | medium | `src/components/ui/bottom-sheet.tsx:25-31,45`, `src/components/ui/modal.tsx:29-35,49-51` | Sheets/modals lock body scroll but have no virtual-keyboard strategy, no focus relocation, and no focus trap. A focused field can end behind a mobile keyboard; keyboard users can leave the dialog and interact with background content. | Use a tested dialog/sheet primitive or implement focus trap, focus restore, `dvh`-aware max height, and scroll-to-focused-control behavior. |
| M-06 | medium | `src/hooks/use-kid-data.ts:91,107`, `src/hooks/use-parent-data.ts:121,144`, `index.html` | Data hooks log failed fetches and poll, but the audited UI has no connection/offline state; no service worker/manifest was found. A low-connectivity user gets loading/skeleton or stale state without an actionable explanation. | Add a connection/error state with retry and last-updated status; decide explicitly whether offline read-only/PWA support is in scope. |
| M-07 | medium | `src/styles.css:773-816`, `src/styles.css:794-815` | At 700px the app becomes a fixed 480px phone frame, not a tablet layout. DESIGN.md calls for two-column tablet layouts and wider areas, not a permanently narrow phone simulation. | Keep the phone shell for an emulator preview only; add a real tablet breakpoint and page layout rules. |
| M-08 | low | `src/main.tsx:19-27` | A finance-related scheduled edge task is started on every client load and hourly thereafter. It is unrelated to rendering and adds network work on low-end/poor-network devices. Its backend safety is not verified. | Move scheduling to the server/platform scheduler; the client should only read and request user-driven operations. |

### C. UX and accessibility

| ID | Severity | Evidence | What is wrong | Fix |
|---|---|---|---|---|
| A-01 | high | `src/components/ui/modal.tsx:41-80`, `src/components/ui/bottom-sheet.tsx:37-74` | `role="dialog"` and `aria-modal` are present, but there is no `aria-labelledby`, initial focus, focus trap, or focus restoration. ARIA does not make this accessible by itself. | Give each dialog a labelled title, focus its first meaningful control, trap Tab, restore trigger focus on close, and keep Escape. |
| A-02 | high | `src/components/banking/TransactionRow.tsx:32-36` | A clickable transaction is a plain `div`. It cannot be reached or activated with a keyboard and has no button/link semantics. | Render a button or link when `onClick` exists; render a noninteractive row otherwise. |
| A-03 | high | `src/routes/kid.insights.tsx:285-300` | The Daily Wrap advances via clicking a generic `div`. There is no keyboard equivalent, no visible previous/next controls, and touch-zone behavior is undiscoverable. | Use labelled Previous/Next buttons with 44px targets; keep swipe/tap zones only as progressive enhancement. |
| A-04 | medium | `src/routes/kid.zakat.tsx:147-184` | Visible labels are not associated with their numeric inputs (`htmlFor`/`id` absent). `aria-label` supplies a name, but it duplicates the label and leaves the semantic relationship broken. | Generate stable IDs and bind each label; use `aria-describedby` for validation/help text. |
| A-05 | medium | `src/styles.css:32`, `src/styles.css:2966-2971`, `src/styles.css:3051-3056` | `--text-muted: #8A8A8A` on white is about 3.45:1, below WCAG AA’s 4.5:1 requirement for normal text. It is used for 10px chat/disclaimer and other small metadata, where contrast matters most. | Darken the muted token for text or reserve the current color for non-text decoration; verify all token pairs. |
| A-06 | medium | `src/components/ui/input.tsx:54-60` | Input errors announce with `role="alert"`, but are not connected to the input with `aria-describedby` or `aria-invalid`. A screen reader user hears an error without knowing which field it applies to. | Add deterministic error IDs, `aria-invalid`, and conditional `aria-describedby`. |
| A-07 | medium | `src/components/ui/button.tsx:52-58` | Loading buttons show a spinner and become disabled but retain their original accessible name/state; no `aria-busy` or loading status is exposed. | Add `aria-busy` and visually hidden loading text, or change the accessible label to “Saving…”. |
| A-08 | low | `src/features/landing/components/LandingNav.tsx:113-123,127-168` | The mobile nav trigger does not expose `aria-expanded` or `aria-controls`; menu open/closed state is invisible to assistive technology. | Add an ID to the controlled nav and bind `aria-expanded`/`aria-controls`; return focus appropriately after navigation. |

### D. Arabic/RTL cleanup: complete search inventory

`rg` found **17 Arabic-script occurrences in four source files**. No Arabic font files, `dir="rtl"`, RTL CSS, `I18nManager`, icon mirroring, locale files, or other Arabic-script matches were found. `components.json:13` explicitly has `"rtl": false`, so it is not a removal target. There are no image/font assets in the repository matching Arabic font extensions or Arabic filenames.

| ID | Evidence | Current text | Latin-letter replacement (transliteration, not translation) | Action |
|---|---|---|---|---|
| AR-01 | `src/routes/kid.index.tsx:172` | `السلام عليكم` | `As-salamu alaykum` | Replace UI string. |
| AR-02 | `src/features/landing/components/LandingShariahPillars.tsx:7` | `قَرْض` | `Qard` | Replace `ar` value; rename the property to `transliteration` or remove the duplicate display field. |
| AR-03 | `src/features/landing/components/LandingShariahPillars.tsx:13` | `هِبَة` | `Hibah` | Same action. |
| AR-04 | `src/features/landing/components/LandingShariahPillars.tsx:19` | `صَدَقَة` | `Sadaqah` | Same action. |
| AR-05 | `src/features/landing/components/LandingShariahPillars.tsx:25` | `زَكَاة` | `Zakat` | Same action. |
| AR-06 | `src/features/landing/components/LandingShariahPillars.tsx:36` | `بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ` | `Bismillahi r-Rahmani r-Rahim` | Replace UI text. Standard transliteration style varies; confirm capitalization/diacritic policy if a scholarly style is required. |
| AR-07 | `src/routes/kid.sadaqah.tsx:91` | `الصَّدَقَةُ تُطْفِئُ الخَطِيئَةَ` | `As-sadaqatu tutfi'u al-khati'ah` | Replace UI quote. Apostrophe convention should be confirmed if strict transliteration is required. |
| AR-08 | `src/routes/kid.zakat.tsx:103` | `خُذْ مِنْ أَمْوَالِهِمْ صَدَقَةً تُطَهِّرُهُمْ` | `Khudh min amwalihim sadaqatan tutahhiruhum` | Replace UI quote. The first word has several Latin spellings; this is the requested transliteration, not an English translation. |
| AR-09 | `src/routes/kid.zakat.tsx:290` | `الفُقَرَاء` | `Al-fuqara'` | Replace the `ar` value and rename/remove the property. |
| AR-10 | `src/routes/kid.zakat.tsx:291` | `المَسَاكِين` | `Al-masakin` | Same action. |
| AR-11 | `src/routes/kid.zakat.tsx:292` | `العَامِلِين عَلَيْهَا` | `Al-amilina alayha` | Same action. |
| AR-12 | `src/routes/kid.zakat.tsx:293` | `المُؤَلَّفَة قُلُوبُهُمْ` | `Al-mu'allafati qulubuhum` | Same action. |
| AR-13 | `src/routes/kid.zakat.tsx:294` | `فِي الرِّقَاب` | `Fi r-riqab` | Same action. |
| AR-14 | `src/routes/kid.zakat.tsx:295` | `الغَارِمِين` | `Al-gharimin` | Same action. |
| AR-15 | `src/routes/kid.zakat.tsx:296` | `فِي سَبِيلِ الله` | `Fi sabilillah` | Same action. |
| AR-16 | `src/routes/kid.zakat.tsx:297` | `ابْن السَّبِيل` | `Ibn as-sabil` | Same action. |

**Items to remove:** the `.sadaqah-arabic` selector in `src/styles.css:2609-2614` should be renamed or removed once its caller is converted. Remove no fonts or RTL configuration: none exists. `components.json:13` must remain `rtl: false`.

### E. Code health that blocks the UI work

| ID | Severity | Evidence | What is wrong | Fix |
|---|---|---|---|---|
| H-01 | high | `src/styles.css:1-3286`, `src/components/ui/card.tsx:57,76,100,138`, `src/features/landing/components/LandingHero.tsx:9-147` | Styling ownership is fragmented among huge global CSS, inline styles, and Tailwind. Global selectors such as `button`, `label`, and `nav:not(.shell-bottomnav)` make component changes unpredictable. | Keep resets/tokens global; move component styles into component-owned classes/variants and delete conflicting overrides as screens migrate. |
| H-02 | medium | `src/lib/theme.ts:3-19`, `src/styles.css:1-131` | `useTheme` exposes a toggle that always returns light and silently ignores user choice. It is dead/false capability adjacent to the UI system. | Remove the toggle until dark-mode tokens exist, or implement a complete theme with persisted preference and contrast verification. |
| H-03 | medium | `src/components/ui/button.tsx:4-34`, `src/styles.css:266-350` | The Button component’s variants/sizes are overridden by global `button` and `button[data-variant]` rules, including `!important`. This makes visual regressions likely and prevents reliable component reuse. | Pick one authority for button variants; eliminate global `!important` overrides. |
| H-04 | medium | `src/components/ui/sonner.tsx:8-18`, `src/components/ui/modal.tsx:41-80`, `src/components/ui/bottom-sheet.tsx:37-74` | Feedback/surface components each encode their own raw visual and behavior rules, so system-level fixes (radius, focus, reduced motion, safe areas) do not propagate. | Make toast/dialog/sheet first-class primitives with shared tokenized state styles and accessibility contracts. |

## 5. Stack decision

| Option | Effort | Risk | Throw away | Reuse |
|---|---|---|---|---|
| 1. Fix in place: mobile-first React web refactor | **M**. Rework shell, primitives, responsive rules, core routes, and test matrix; data/routing can stay. | Medium: global CSS can create regressions, so migrate by component/screen. | Little besides obsolete CSS/inline overrides and the fake Scan action. | React routes, Supabase integration, domain logic, TanStack Router, existing tokens, icons, tests, and most screen content. |
| 2. Rebuild for mobile: React Native + Expo | **L**. Recreate every screen, navigation, native accessibility, Supabase client behavior, test setup, and deployment pipeline. | High: feature parity and banking-flow regressions while two products coexist. | The existing DOM UI and Tailwind/CSS implementation. | Domain types, business logic with adaptation, Supabase schema/edge functions, copy, icons/design direction. |

**Recommendation: Option 1, fix in place.** This product has no demonstrated requirement for native-only device APIs, offline-first behavior, biometric security, push notifications, or app-store distribution that would justify throwing away a functioning React/Supabase app. The current failures are implementation discipline problems, not evidence that the web stack is incapable. Treat it as a mobile web app now; make an Expo decision only after actual native requirements are approved.

## 6. Phased fix plan

| Phase | Scope and likely files | Verification |
|---|---|---|
| 0. Baseline and decisions | Record screenshots/flows before changes; agree breakpoint matrix, 16px input rule, safe-area rules, and whether Scan exists. `DESIGN.md`, test plan only. | 320/360/390/430/768px visual baseline; keyboard-only and screen-reader smoke paths. |
| 1. Mobile foundation | Normalize tokens, globals, safe areas, input/button target sizes, typography, and bottom-nav behavior. `src/styles.css`, `src/components/ui/button.tsx`, `src/components/ui/input.tsx`, `src/components/AppShell.tsx`, `index.html`. | No horizontal scroll; all primary controls 44px+; inputs stay unzoomed on iOS; notch and bottom inset checks. |
| 2. Interaction/accessibility primitives | Replace/repair dialog, sheet, toast, transaction row, story navigation, and form error binding. `src/components/ui/{modal,bottom-sheet,sonner,input}.tsx`, `src/components/banking/TransactionRow.tsx`, `src/routes/kid.insights.tsx`, affected forms. | Tab/Shift+Tab stays in dialogs; Escape/close restores focus; all click actions keyboard-operable; axe/manual screen-reader pass. |
| 3. Route-by-route mobile cleanup | Fix landing 360px layout first, then kid home, wallet, calculator, parent reports/settings. Migrate inline styles toward primitives. Landing components, `src/routes/kid.*.tsx`, `src/routes/parent.*.tsx`. | Screenshot regression at 360/390/430/768px; long strings, Dynamic Type/200% zoom, virtual keyboard, loading/empty/error states. |
| 4. Arabic removal and resilience | Apply the inventory above, remove/rename Arabic-specific selector, add failed/offline/retry states. Four Arabic source files, `src/styles.css`, data hooks, relevant screens. | Repository Arabic-script scan returns no source matches; no RTL behavior remains; simulated offline/failure presents a retry state. |
| 5. Regression guardrails | Add component/mobile E2E coverage for nav, dialog, forms, route overflow, targets, and visual tokens. `tests/`, component tests, Playwright config if needed. | CI runs typecheck, lint, unit tests, route interaction tests, and mobile viewport smoke tests. |

## 7. Open questions

1. Is **Scan** an approved future feature, or should it disappear from both navigation variants now?
2. Is this intended to ship as a responsive web app, an installable PWA, or a native-store app? That changes the offline, auth, and device-integration requirements.
3. For the required transliterations, do you want a strict academic style with diacritics or the readable Latin style proposed above? The report has flagged wording where conventions vary.
4. Should the public landing page remain a marketing site separate from the authenticated product shell, or is it part of the same mobile app journey?

## 8. Skills used and skipped

Used:

- `design-system`: audited tokens, typography, spacing, visual consistency, components, and responsive behavior.
- `frontend-ui-engineering`: audited mobile-first layout, component ownership, loading/empty/error treatment, and responsive implementation.
- `frontend-a11y`: audited labels, semantic controls, dialog behavior, keyboard support, live feedback, and reduced-motion implementation.
- `accessibility`: applied WCAG 2.2 AA checks for focus, target size, contrast, reflow, semantics, and status communication.

Skipped because not applicable:

- `design-teardown`: requires a reference product/URL pair to measure against; this task is an internal compliance audit against `DESIGN.md`, not a comparative teardown.
- `react-native-patterns`: this is React DOM/Vite, not React Native/Expo; it is relevant only if the user later approves a rebuild.
- `agent-architecture-audit`: the repository may contain finance/AI-facing product features, but this task is a mobile UI audit, not an audit of an agent runtime’s orchestration layers.

No project files were modified except this report.
