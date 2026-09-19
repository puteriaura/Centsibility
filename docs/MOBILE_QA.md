# Centsibility Mobile QA Checklist (Real Device Verification)

Run this checklist by hand on a physical iPhone (iOS Safari) and a physical Android device (Chrome), served over your local network:
```bash
npm run preview -- --host
```
Access via `http://<your-lan-ip>:4173` on the mobile device.

---

## 1. Hardware & OS Level Checks

### Notch, Dynamic Island & Home Indicator Overlap
- [ ] **[iOS] Topbar clearance**: Header content (logo, title, back buttons) clears notch/Dynamic Island with safe padding (`env(safe-area-inset-top)`).
- [ ] **[iOS] Bottom nav clearance**: Bottom navigation items and home indicator do not collide (`env(safe-area-inset-bottom)`).
- [ ] **[Android] Gesture bar clearance**: Bottom navigation does not clip behind the gesture navigation bar.
- [ ] **[Both] Horizontal safe areas**: In landscape orientation, content does not hide behind sensor housing or rounded corners.

### Virtual Keyboard & Form Inputs
- [ ] **No auto-zoom on focus (iOS Safari)**: Tap every text, email, password, and number input. The page MUST NOT zoom in automatically (requires font-size >= 16px).
- [ ] **Keyboard covering active field**: Focus inputs at the bottom of long forms (e.g. Schedule Hibah, Goal Creation, Settings). Page smoothly scrolls the focused input above the keyboard.
- [ ] **Bottom nav vs keyboard**: When virtual keyboard opens, bottom navigation either hides or stays anchored beneath the keyboard without obscuring the form submit buttons.
- [ ] **Number keypad type**: Tapping currency/amount inputs opens numeric keypad (`inputMode="decimal"` or `type="number"`).
- [ ] **Input accessory dismiss**: Tapping "Done" on iOS keyboard or background dismisses keyboard cleanly without layout jitter.

### Scrolling, Gestures & System Settings
- [ ] **Modal scroll lock (iOS Safari)**: Open any modal/bottom sheet (e.g., MoneyKeypad, EditKidForm, Zakat breakdown). Attempt to scroll the background overlay. Background page MUST remain locked and not scroll.
- [ ] **Pull-to-refresh interference**: Swiping down inside scrollable cards or tabs does not trigger unwanted browser pull-to-refresh.
- [ ] **Back-swipe gesture (iOS Safari)**: Swipe from left edge of screen to navigate back. Ensure transition is smooth and does not corrupt application state.
- [ ] **Rotate to landscape and back**: Rotate device to landscape (e.g. 844x390), verify content reflows without horizontal scrollbars, then rotate back to portrait.
- [ ] **System text zoom (Dynamic Type / Android font scaling)**: Set device text size to largest setting. Verify text wraps cleanly and does not truncate buttons, balance numbers, or navigation labels.

### Network Resilience & Offline
- [ ] **Slow 3G simulation**: Throttle connection in devtools or use 3G network. Skeleton states appear; no broken layout during data fetch.
- [ ] **Offline fallback**: Turn on Airplane mode. App handles failed requests gracefully without crashing or white-screening.

---

## 2. Core Flows Start to Finish

### Flow A: Landing Page & Public Navigation
- [ ] **Landing page render**: Hero, dual mode toggle, features, and footer render with no horizontal overflow.
- [ ] **Mode toggle**: Switch between "For Kids" and "For Parents" — animations are smooth and content adapts.
- [ ] **Navigation links**: Tapping "Log In" navigates cleanly to `/login`. Tapping "Kid Login" navigates to `/kid-login`.

### Flow B: Kid Experience (`/kid`)
- [ ] **Kid Home (`/kid`)**: Balance card, quick actions, streak counter, and recent transactions display correctly.
- [ ] **Bottom Nav**: 4 tabs (Penny / Deposit / Financing / Card) — verify NO "Scan" tab exists. Active state highlights clearly. Touch targets >= 44x44px.
- [ ] **Wallet (`/kid/wallet`)**: Transactions list scrolls smoothly; amount indicators (`+` / `-`) have sufficient contrast.
- [ ] **Card (`/kid/card`)**: Visual debit card renders without clipping. Toggle freeze/unfreeze controls.
- [ ] **Goals (`/kid/goals`)**: View goals progress bar. Tap "Create Goal" modal. Form inputs usable with keyboard.
- [ ] **Financing / Qard (`/kid/loans`)**: View loan calculator, repayment schedule, and request form.
- [ ] **Zakat & Sadaqah (`/kid/zakat`, `/kid/sadaqah`)**: View nisab calculation and donation pots.
- [ ] **Penny Sensei Chat (`/kid/chat`)**: Chat bubble stream renders cleanly; message composer pinned to bottom; input has 16px font and 48px height.

### Flow C: Parent Experience (`/parent`)
- [ ] **Parent Dashboard (`/parent`)**: Child selector chips, total family balance, quick transfer buttons.
- [ ] **Approvals (`/parent/approvals`)**: Pending tasks and loan requests list. Digital signature image renders with proper scaling.
- [ ] **Insights (`/parent/insights`)**: Recharts graphs fit screen width without horizontal scroll.
- [ ] **Reports (`/parent/reports`)**: Export statement triggers download/preview.
- [ ] **Settings (`/parent/settings`)**: Child account management, PIN security toggle, notification preferences.

---

## QA Sign-Off

| Tester Name | Device Model | OS Version | Browser | Date | Result (PASS / FAIL) |
|---|---|---|---|---|---|
| | iPhone | iOS | Safari | | |
| | Android | Android | Chrome | | |
