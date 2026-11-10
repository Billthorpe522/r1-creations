# R1 Creations — Round 2

Two more Rabbit R1 creations, built alongside [Shoot Companion](https://billthorpe522.github.io/r1-shoot-companion/).

Both are static, offline-capable web apps sized for the R1's exact 240 × 282 screen, with
wheel navigation, side-button selection, light/dark themes, and persistence to the device's
own storage.

## Memory Grid — game

A Simon-style sequence memory game on a 3 × 3 grid of shape-coded tiles.

- Wheel moves the cursor across the 9 tiles; side button selects.
- Round 1 shows 3 tiles; each completed round adds one, up to 9.
- A wrong tile ends the run and replays the sequence you missed.
- Persists the round, best round, games played, and the puzzle in progress.

Live: https://billthorpe522.github.io/r1-creations/memory-grid/

## Golden Hour — solar photo planner

Sunrise, sunset, golden hour and blue hour for 14 days across six shooting locations.

- Wheel scrolls the days; the detail strip updates live.
- Locations: Manhattan IL, Chicago IL, Nashville TN, Phoenix AZ, Los Angeles CA, New York NY.
- Computed with the NOAA / Jean Meeus solar equations, including US daylight-saving rules
  (Phoenix does not observe DST).
- Side button opens a full day card with every computed value.
- Fully offline; no location permission, no network calls.

Live: https://billthorpe522.github.io/r1-creations/golden-hour/

## Install on the R1

Creations → **Add via QR code**, then scan the installation QR. Each QR carries the creation
JSON (title, url, description, iconUrl, themeColor) produced by Rabbit's official QR
generator — not a bare URL.

| Creation | Install QR |
|---|---|
| Memory Grid | `memory-grid/install/memory-grid-install-qr.png` |
| Golden Hour | `golden-hour/install/golden-hour-install-qr.png` |

Both payloads were decoded back independently with a separate decoder and match the creation
JSON exactly.

## Layout

```
memory-grid/    index.html  style.css  core.js  app.js  icon.png  build.py  install/  tests/
golden-hour/    index.html  style.css  core.js  app.js  icon.png  build.py  install/  tests/
```

`core.js` holds all logic as pure functions and exports via `module.exports` when available,
so it can be unit-tested in Node. `app.js` handles only DOM, events and storage. `build.py`
bundles each app into a single dependency-free HTML file.

## Testing

```bash
node memory-grid/tests/core.test.cjs   # 85/85
node golden-hour/tests/core.test.cjs   # 95/95
```

Browser suites (`tests/browser-smoke.js`, `tests/browser-layout.js`) must be run at a
240 × 282 viewport, against the live HTTPS URLs, in both light and dark themes. Keep the
browser tab in the foreground — a hidden tab clamps timers and makes the suites time out.

### Verified against the live build

- Live browser smoke: Memory Grid 47/47, Golden Hour 51/51.
- Live browser layout at 240 × 282: Memory Grid 6 states, Golden Hour 97 states, 0 overflow
  rows in light and dark.
- Solar accuracy independently checked against live `api.sunrise-sunset.org` over 42
  location-days: worst difference 0.174 minutes.
- Persistence across a real reload, and storage-failure handling with no silent fallback
  to localStorage, both confirmed live.

**Not yet tested on physical R1 hardware:** the wheel, side button, native Exit bridge,
native storage persistence across leave/reopen, and QR installation itself.

## Privacy

Public URLs mean the source is readable by anyone with the link. Neither creation contains
client names, credentials, or private data, and neither makes network calls at runtime.
