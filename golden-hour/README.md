# Golden Hour

A sunrise, sunset, golden hour and blue hour planner for the Rabbit R1. Fourteen days across six shooting locations, computed on the device with NOAA solar equations. No packages, API keys, runtime network calls, remote fonts, analytics or backend.

## Try it

- Open `index.html` in this folder.
- On desktop, use Arrow Up / Arrow Down or the mouse wheel to move through the days, and click a day for the full detail card.
- On R1, wheel up/down moves through the fourteen days, the side click opens the day card, and the Places button opens the location picker.
- The header shows the chosen location and date. The list shows each day with sunrise and sunset times. The detail strip shows golden hour and blue hour for the selected day.
- The day card lists sunrise, golden hour AM, solar noon, golden hour PM, sunset, blue hour AM and blue hour PM.
- All times are local to the chosen location, and daylight saving is handled for US zones.

## Locations

Manhattan IL, Chicago IL, Nashville TN, Phoenix AZ, Los Angeles CA and New York NY. Phoenix uses `America/Phoenix`, which does not observe daylight saving.

## Accuracy

`core.js` implements the standard NOAA solar position equations, with the sunrise and sunset altitude set to -0.833 degrees for the solar radius and atmospheric refraction. Golden hour uses -4 to +6 degrees and blue hour uses -6 to -4 degrees.

Every event was checked against `api.sunrise-sunset.org` for 42 location-days spanning six locations and seven dates across the year. The worst difference was 0.174 minutes, under eleven seconds. The reference fixtures in `tests/core.test.cjs` were re-verified against the live API and matched exactly.

## What is saved

The chosen location, the selected day and the interface state. Changes are queued immediately and written serially, so a slow older save cannot overwrite a later one. Wait for `Browser saved` or `R1 saved` before closing.

On the R1, the app uses the documented `window.creationStorage.plain` API with Base64 data. On desktop it uses localStorage. These stores are separate; desktop preview progress does not sync to your R1.

A corrupt, stale or unreadable saved plan is NOT silently replaced. The app falls back to a fresh plan, shows a warning and keeps the stored data untouched. Save again explicitly replaces stored state with the current in-memory plan. A failed save shows a warning, offers a retry and does not fall back to localStorage. Storage calls time out after four seconds; actual device storage behaviour still needs testing. Saved data carries a `version` field and is validated on load, so a format change starts a fresh plan instead of crashing.

## Editing the planner

- `core.js` holds all calculation logic as pure functions: solar position, event times, the location table, day-plan construction, local time formatting and persistence validation. It exports through `module.exports` in Node and as `window.GoldenHourCore` in a browser.
- `app.js` holds only DOM, events and storage: the day list, the detail strip, the day card, the location picker and the save queue.
- Change `DAY_COUNT` or the `LOCATIONS` table in `core.js` to retune the planner, then rerun the Node tests and the layout tests at 240 x 282.
- `build.py` bundles the app into a single dependency-free `Golden-Hour.html` plus a `Golden-Hour.zip` archive.

## Tests

- `node golden-hour/tests/core.test.cjs` from the workspace root runs the model tests and prints a pass count. It covers the solar maths against live API fixtures, the US daylight saving rules, formatting and persistence validation.
- `tests/browser-smoke.js` is a browser-console expression for a fresh test session. Do not run it on real progress: it changes the saved location and day. It uses emulated wheel/side events and verifies the latest saved state.
- `tests/browser-layout.js` checks every location, all fourteen days, the day card and the location picker at exactly 240 x 282, in both light and dark emulated media modes. It also changes the saved location and day.
- Keep the browser tab in the foreground while running the browser suites. A hidden tab clamps timers to about one second, which stretches animations and makes the suites time out.

## Official platform references

- https://www.rabbit.tech/support/article/how-to-use-r1-creations
- https://github.com/rabbit-hmi-oss/creations-sdk/blob/main/plugin-demo/reference/creation-triggers.md
- https://github.com/rabbit-hmi-oss/creations-sdk/tree/main/qr

Status: verified in a desktop browser at the 240 x 282 R1 viewport. Not yet installed or tested on a physical R1.
