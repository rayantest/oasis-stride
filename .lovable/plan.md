# Vacation mode

A switch at the bottom of the page that puts the whole app into a read-only, guilt-free state. Yes, it makes sense — here's how it would work.

## Behaviour

When vacation mode is ON:
- Every logging, typing, editing and deleting control is visually grayed out (dimmed + desaturated) and cannot be tapped: food input, photo scan, saved-food chips, rep logging, target editor, profile/goal forms, InBody entry, delete buttons.
- The app stays fully viewable: charts, history, past-day browsing, Diet/Movement tab switch, language toggle, expanding/collapsing sections, and the "!" info popovers keep working.
- A soft banner sits at the top: "Vacation mode — enjoy it. Nothing to log, nothing to catch up on." with an Unlock button.
- The AI coach card shows a short rest message instead of pushing advice, and does not call the AI.

Turning it off is one tap, any time; everything returns exactly as it was. No data is deleted or altered while it's on.

## The switch

At the bottom of the page (below the last section, above the safe area), a palm/sun-icon row: "Vacation mode" with a toggle switch and one line of explanation. Tapping ON asks for a quick confirm; tapping OFF is immediate.

## Persistence

Stored in the browser (same mechanism as the language choice), so it survives reloads on that device. No database change needed. If you'd rather it follow you across devices, that would need a small settings field in the database — say the word and I'll do that instead.

## Technical notes

- New `src/lib/vacation.tsx`: `VacationProvider` + `useVacation()` (state in `localStorage`), mounted next to `LanguageProvider` in `src/routes/__root.tsx`.
- The page root in `src/routes/index.tsx` gets a `data-vacation="on"` attribute. In `src/styles.css`, a rule under that attribute applies `pointer-events: none; opacity: .45; filter: grayscale(.8)` to interactive descendants, with an opt-out class (`vacation-allow`) applied to the tab switch, language toggle, back-to-today, section headers, metric dropdowns, info buttons, the banner and the vacation switch itself.
- CSS alone is not a hard guard, so the handful of write paths (food/exercise/scan inserts, target save, profile save, deletes) also early-return with a gentle toast when vacation mode is on, and `CoachCard` skips its AI request.
- New strings added to the i18n dictionaries so the banner, switch and toasts work in Arabic too.
