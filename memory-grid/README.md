# Memory Grid

A Simon-style sequence memory game for the Rabbit R1. Nine tiles, nine distinct shapes, and a sequence that grows by one shape every round. No packages, API keys, network calls, remote fonts, analytics or backend.

## Try it

- Open `index.html` in this folder.
- On desktop, click a tile, or move the cursor with Arrow Up / Arrow Down and press Enter or Space.
- On R1, wheel up/down moves a cursor linearly through the nine tiles in row-major order. The side click selects the shape under the cursor. Rapid duplicate hardware clicks within 250 ms are ignored.
- Round 1 shows three shapes, each lit about 420 ms with about 150 ms gaps. Repeat the sequence in order; a correct tile flashes green, a wrong tile flashes red and ends the game.
- Finishing a round advances immediately to the next round, which previews its longer sequence before your turn.
- The game ends at round 7 (nine shapes). Game over shows the round reached, the missed sequence (replay it), your best round and games played.
- Menu offers Help, a theme toggle, Save again and Exit. Menu > Title asks before leaving a live round.

## Shapes

Each tile carries its own shape, not only its own colour: circle, square, triangle, diamond, star, hexagon, cross, ring and arrow. Shapes are drawn with inline SVG strokes, so the grid stays legible in dark mode and for colour-blind players. The same nine shapes are used for the lit, correct and wrong states.

## What is saved

The current round, best round, games played, the active sequence and the shapes you have already entered correctly this turn. Changes are queued immediately and written serially, so a slow older save cannot overwrite a later one. Wait for `Browser saved` or `R1 saved` before closing.

On the R1, the app uses the documented `window.creationStorage.plain` API with Base64 data. On desktop it uses localStorage. These stores are separate; desktop preview progress does not sync to your R1.

A corrupt, stale or unreadable saved game is NOT silently replaced. The app falls back to a fresh game, shows a warning and keeps the stored data untouched. Menu > Save again explicitly replaces stored state with the current in-memory game. Save errors also show a warning and block the Exit button until a successful retry. Storage calls time out after four seconds; actual device storage behaviour still needs testing. Saved data carries a `version` field and is validated on load, so a format change starts a fresh game instead of crashing.

## Editing the game

- `core.js` holds all game logic as pure functions: sequence generation (never the same tile twice in a row), round and sequence-length progression, applying player input, cursor movement, persistence validation, the fresh-state factory and game-over stats. It exports through `module.exports` in Node and as `window.MemoryCore` in a browser.
- `app.js` holds only DOM, events and storage: the tile grid, playback, overlays, theme and the save queue.
- Change `FIRST_SEQUENCE_LENGTH`, `MAX_SEQUENCE_LENGTH` or `TILE_COUNT` in `core.js` to retune the game, then rerun the Node tests and the layout tests at 240 x 282.

## Tests

- `node memory-grid/tests/core.test.cjs` from the workspace root runs the model tests and prints a pass count.
- `tests/browser-smoke.js` is a browser-console expression for a fresh test session. Do not run it on real progress: it changes game state. It uses emulated wheel/side events and verifies the latest saved state.
- `tests/browser-layout.js` checks the title, round, confirm, game-over, menu and help screens at exactly 240 x 282. Run it in both light and dark emulated media modes. It also changes the current game.
- Keep the browser tab in the foreground while running the browser suites. A hidden tab clamps timers to about one second, which stretches the shape playback and makes the suites time out.
- The JSON files next to the suites (`core-results.json`, `smoke-results.json`, `layout-results.json`, `reload-results.json`) hold actual results from this build, including browser-storage EMULATION. They do not establish physical-device compatibility.

## Official platform references

- https://www.rabbit.tech/support/article/how-to-use-r1-creations
- https://github.com/rabbit-hmi-oss/creations-sdk/blob/main/plugin-demo/reference/creation-triggers.md
- https://github.com/rabbit-hmi-oss/creations-sdk/tree/main/qr

Status: verified in a desktop browser at the 240 x 282 R1 viewport. Not yet installed or tested on a physical R1.
