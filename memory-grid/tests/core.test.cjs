/* Run with: node memory-grid/tests/core.test.cjs */
'use strict';
const assert = require('node:assert/strict'), C = require('../core.js');
const results = [];
const test = (name, fn) => {
  try { fn(); results.push({ name, passed: true }); }
  catch (e) { results.push({ name, passed: false, error: e.message }); }
};
const lcg = seed => () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };

// --- shape catalogue
test('Nine distinct shapes are exposed', () => assert.equal(C.SHAPES.length, 9));
test('Shapes are unique', () => assert.equal(new Set(C.SHAPES).size, C.SHAPES.length));
test('Every shape has a label', () => assert.equal(C.SHAPE_LABELS.length, C.SHAPES.length));
test('Shape labels are unique', () => assert.equal(new Set(C.SHAPE_LABELS).size, C.SHAPE_LABELS.length));
test('Tile count matches the shape count', () => assert.equal(C.TILE_COUNT, C.SHAPES.length));

// --- round and sequence length progression
test('Round one uses three tiles', () => assert.equal(C.sequenceLengthForRound(1), 3));
test('Round two uses four tiles', () => assert.equal(C.sequenceLengthForRound(2), 4));
test('Sequence length grows one tile per round', () => { for (let r = 2; r <= C.MAX_ROUND; r++) assert.equal(C.sequenceLengthForRound(r), C.sequenceLengthForRound(r - 1) + 1); });
test('Sequence length is capped at nine', () => assert.equal(C.sequenceLengthForRound(99), C.MAX_SEQUENCE_LENGTH));
test('Maximum sequence length is nine', () => assert.equal(C.MAX_SEQUENCE_LENGTH, 9));
test('There are seven rounds', () => assert.equal(C.MAX_ROUND, 7));

// --- sequence generation
test('Generated sequence has the requested length', () => assert.equal(C.generateSequence(5, lcg(1)).length, 5));
test('Generated sequence length is capped', () => assert.equal(C.generateSequence(40, lcg(1)).length, C.MAX_SEQUENCE_LENGTH));
test('Generated tiles stay inside the grid', () => { for (const tile of C.generateSequence(9, lcg(7))) assert.ok(tile >= 0 && tile < C.TILE_COUNT); });
test('Generated sequence never repeats a tile twice in a row', () => {
  for (let seed = 0; seed < 60; seed++) { const s = C.generateSequence(9, lcg(seed)); for (let i = 1; i < s.length; i++) assert.notEqual(s[i], s[i - 1]); }
});
test('A constant generator still avoids repeats', () => { const s = C.generateSequence(9, () => 0); for (let i = 1; i < s.length; i++) assert.notEqual(s[i], s[i - 1]); });
test('Generation is deterministic for a fixed generator', () => assert.deepEqual(C.generateSequence(6, lcg(3)), C.generateSequence(6, lcg(3))));
test('Random tile is always in range', () => { for (const r of [0, 0.5, 0.999999, 1]) assert.ok(C.randomTile(() => r) >= 0 && C.randomTile(() => r) < C.TILE_COUNT); });

// --- sequence extension
test('Extended sequence adds exactly one tile', () => assert.equal(C.extendSequence(C.generateSequence(3, lcg(5)), lcg(9)).length, 4));
test('Extended sequence never repeats the last tile', () => {
  const base = C.generateSequence(3, lcg(5));
  for (let seed = 0; seed < 40; seed++) { const s = C.extendSequence(base, lcg(seed)); assert.notEqual(s[s.length - 1], s[s.length - 2]); }
});
test('Extended sequence keeps the earlier tiles', () => { const base = C.generateSequence(3, lcg(5)); assert.deepEqual(C.extendSequence(base, lcg(11)).slice(0, 3), base); });
test('Extended sequence stays in range', () => { for (const tile of C.extendSequence(C.generateSequence(8, lcg(2)), lcg(4))) assert.ok(tile >= 0 && tile < C.TILE_COUNT); });

// --- fresh state
test('Fresh state starts on the title screen', () => assert.equal(C.fresh().status, 'title'));
test('Fresh state starts at round one', () => assert.equal(C.fresh().round, 1));
test('Fresh state has no puzzle', () => { const s = C.fresh(); assert.deepEqual(s.sequence, []); assert.deepEqual(s.entered, []); });
test('Fresh state counts no games', () => { const s = C.fresh(); assert.equal(s.gamesPlayed, 0); assert.equal(s.bestRound, 0); });
test('Fresh state has no shared mutable references', () => { const a = C.fresh(), b = C.fresh(); a.sequence.push(4); assert.deepEqual(b.sequence, []); });
test('Fresh state carries the version', () => assert.equal(C.fresh().version, C.STATE_VERSION));

// --- starting and leaving a game
test('Start game builds a three tile puzzle', () => { const s = C.fresh(); C.startGame(s, lcg(4)); assert.equal(s.sequence.length, 3); });
test('Start game enters the preview state', () => { const s = C.fresh(); C.startGame(s, lcg(4)); assert.equal(s.status, 'preview'); });
test('Start game clears progress and cursor', () => { const s = C.fresh(); s.entered = [1]; s.cursor = 7; C.startGame(s, lcg(4)); assert.deepEqual(s.entered, []); assert.equal(s.cursor, 0); });
test('Start game keeps best round and games played', () => { const s = C.fresh(); s.bestRound = 4; s.gamesPlayed = 9; C.startGame(s, lcg(4)); assert.equal(s.bestRound, 4); assert.equal(s.gamesPlayed, 9); });
test('Leaving to the title clears the puzzle', () => { const s = C.fresh(); C.startGame(s, lcg(4)); C.toTitle(s); assert.equal(s.status, 'title'); assert.deepEqual(s.sequence, []); assert.deepEqual(s.entered, []); });
test('Leaving to the title keeps the stats', () => { const s = C.fresh(); s.bestRound = 5; s.gamesPlayed = 7; C.toTitle(s); assert.equal(s.bestRound, 5); assert.equal(s.gamesPlayed, 7); });

// --- applying player input
test('Input is ignored outside the player turn', () => { const s = C.fresh(); assert.equal(C.applyInput(s, 0, lcg(1)).outcome, 'ignored'); });
test('Input is ignored during the preview', () => { const s = C.fresh(); C.startGame(s, lcg(1)); assert.equal(C.applyInput(s, 0, lcg(1)).outcome, 'ignored'); });
test('Input is ignored after the game is over', () => { const s = C.fresh(); C.startGame(s, lcg(1)); s.status = 'gameover'; assert.equal(C.applyInput(s, 0, lcg(1)).outcome, 'ignored'); });
test('Input rejects tiles outside the grid', () => { const s = C.fresh(); C.startGame(s, lcg(1)); s.status = 'input'; assert.equal(C.applyInput(s, 9, lcg(1)).outcome, 'ignored'); assert.equal(C.applyInput(s, -1, lcg(1)).outcome, 'ignored'); });
test('A correct tile is recorded', () => { const s = C.fresh(); C.startGame(s, lcg(6)); s.status = 'input'; const result = C.applyInput(s, s.sequence[0], lcg(6)); assert.equal(result.outcome, 'correct'); assert.deepEqual(s.entered, [s.sequence[0]]); });
test('A wrong tile ends the game', () => { const s = C.fresh(); C.startGame(s, lcg(6)); s.status = 'input'; const wrong = (s.sequence[0] + 1) % C.TILE_COUNT; assert.equal(C.applyInput(s, wrong, lcg(6)).outcome, 'wrong'); assert.equal(s.status, 'gameover'); });
test('A wrong tile is not recorded', () => { const s = C.fresh(); C.startGame(s, lcg(6)); s.status = 'input'; C.applyInput(s, (s.sequence[0] + 1) % C.TILE_COUNT, lcg(6)); assert.deepEqual(s.entered, []); });
test('A wrong tile counts the game', () => { const s = C.fresh(); C.startGame(s, lcg(6)); s.status = 'input'; C.applyInput(s, (s.sequence[0] + 1) % C.TILE_COUNT, lcg(6)); assert.equal(s.gamesPlayed, 1); });
test('A wrong tile records the round reached', () => { const s = C.fresh(); C.startGame(s, lcg(6)); s.status = 'input'; C.applyInput(s, (s.sequence[0] + 1) % C.TILE_COUNT, lcg(6)); assert.equal(s.bestRound, 1); });
test('A wrong tile never lowers the best round', () => { const s = C.fresh(); s.bestRound = 5; C.startGame(s, lcg(6)); s.status = 'input'; C.applyInput(s, (s.sequence[0] + 1) % C.TILE_COUNT, lcg(6)); assert.equal(s.bestRound, 5); });
test('Finishing a round advances to the next one', () => { const s = C.fresh(); C.startGame(s, lcg(8)); s.status = 'input'; for (const tile of s.sequence) C.applyInput(s, tile, lcg(8)); assert.equal(s.round, 2); });
test('Finishing a round grows the sequence by one', () => { const s = C.fresh(); C.startGame(s, lcg(8)); s.status = 'input'; for (const tile of s.sequence) C.applyInput(s, tile, lcg(8)); assert.equal(s.sequence.length, 4); });
test('Finishing a round clears the entered tiles', () => { const s = C.fresh(); C.startGame(s, lcg(8)); s.status = 'input'; for (const tile of s.sequence) C.applyInput(s, tile, lcg(8)); assert.deepEqual(s.entered, []); });
test('Finishing a round returns to the preview', () => { const s = C.fresh(); C.startGame(s, lcg(8)); s.status = 'input'; for (const tile of s.sequence) C.applyInput(s, tile, lcg(8)); assert.equal(s.status, 'preview'); });
test('Finishing a round keeps the earlier shapes', () => { const s = C.fresh(); C.startGame(s, lcg(8)); s.status = 'input'; const before = s.sequence.slice(); for (const tile of s.sequence) C.applyInput(s, tile, lcg(8)); assert.deepEqual(s.sequence.slice(0, 3), before); });
test('Finishing a round records the best round', () => { const s = C.fresh(); C.startGame(s, lcg(8)); s.status = 'input'; for (const tile of s.sequence) C.applyInput(s, tile, lcg(8)); assert.equal(s.bestRound, 1); });

// --- cursor movement
test('Cursor moves forward one tile', () => { const s = C.fresh(); assert.equal(C.moveCursor(s, 1), 1); });
test('Cursor moves backward one tile', () => { const s = C.fresh(); C.moveCursor(s, 4); assert.equal(C.moveCursor(s, -1), 3); });
test('Cursor stops at the first tile', () => { const s = C.fresh(); for (let i = 0; i < 20; i++) C.moveCursor(s, -1); assert.equal(s.cursor, 0); });
test('Cursor stops at the last tile', () => { const s = C.fresh(); for (let i = 0; i < 20; i++) C.moveCursor(s, 1); assert.equal(s.cursor, C.TILE_COUNT - 1); });
test('Cursor is set directly', () => { const s = C.fresh(); assert.equal(C.setCursor(s, 5), 5); });
test('Direct cursor setting is clamped', () => { const s = C.fresh(); assert.equal(C.setCursor(s, 99), C.TILE_COUNT - 1); assert.equal(C.setCursor(s, -3), 0); });

// --- stats
test('Stats report the round reached', () => { const s = C.fresh(); s.round = 3; assert.equal(C.stats(s).round, 3); });
test('Stats copy the sequence', () => { const s = C.fresh(); C.startGame(s, lcg(2)); const stats = C.stats(s); stats.sequence.push(8); assert.equal(s.sequence.length, 3); });
test('Stats copy the entered tiles', () => { const s = C.fresh(); C.startGame(s, lcg(2)); s.entered = [1, 2]; const stats = C.stats(s); stats.entered.push(8); assert.deepEqual(s.entered, [1, 2]); });

// --- validation
test('Validate accepts a fresh game', () => assert.equal(C.validate(C.fresh()).status, 'title'));
test('Validate accepts a preview state', () => { const s = C.fresh(); C.startGame(s, lcg(1)); assert.equal(C.validate(s).status, 'preview'); });
test('Validate accepts an input state', () => { const s = C.fresh(); C.startGame(s, lcg(1)); s.status = 'input'; s.entered = [s.sequence[0]]; assert.equal(C.validate(s).entered.length, 1); });
test('Validate accepts a game over state', () => { const s = C.fresh(); C.startGame(s, lcg(1)); s.status = 'gameover'; assert.equal(C.validate(s).status, 'gameover'); });
test('Validate accepts a winning state', () => { const s = C.fresh(); C.startGame(s, lcg(1)); s.round = C.MAX_ROUND; s.sequence = C.generateSequence(9, lcg(1)); s.entered = s.sequence.slice(); s.status = 'won'; assert.equal(C.validate(s).status, 'won'); });
test('Validate rejects a missing game', () => assert.throws(() => C.validate(null)));
test('Validate rejects the wrong version', () => assert.throws(() => C.validate({ ...C.fresh(), version: 9 })));
test('Validate rejects an unknown status', () => assert.throws(() => C.validate({ ...C.fresh(), status: 'playing' })));
test('Validate rejects a round out of range', () => assert.throws(() => C.validate({ ...C.fresh(), round: 99 })));
test('Validate rejects a round below one', () => { const s = C.fresh(); s.round = 0; assert.throws(() => C.validate(s)); });
test('Validate rejects a bad best round', () => assert.throws(() => C.validate({ ...C.fresh(), bestRound: -1 })));
test('Validate rejects negative games played', () => assert.throws(() => C.validate({ ...C.fresh(), gamesPlayed: -2 })));
test('Validate rejects a missing puzzle', () => { const s = C.fresh(); delete s.sequence; assert.throws(() => C.validate(s)); });
test('Validate rejects a tile outside the grid', () => { const s = C.fresh(); C.startGame(s, lcg(1)); s.sequence = [0, 9, 2]; assert.throws(() => C.validate(s)); });
test('Validate rejects a repeated tile in the sequence', () => { const s = C.fresh(); C.startGame(s, lcg(1)); s.sequence = [1, 1, 2]; assert.throws(() => C.validate(s)); });
test('Validate rejects entered tiles that do not match', () => { const s = C.fresh(); C.startGame(s, lcg(1)); s.status = 'input'; s.entered = [(s.sequence[0] + 1) % C.TILE_COUNT]; assert.throws(() => C.validate(s)); });
test('Validate rejects too many entered tiles', () => { const s = C.fresh(); C.startGame(s, lcg(1)); s.status = 'input'; s.entered = s.sequence.slice(); assert.throws(() => C.validate(s)); });
test('Validate rejects a sequence that does not match the round', () => { const s = C.fresh(); C.startGame(s, lcg(1)); s.round = 4; assert.throws(() => C.validate(s)); });
test('Validate rejects a title state holding a puzzle', () => { const s = C.fresh(); s.sequence = [1, 2, 3]; assert.throws(() => C.validate(s)); });
test('Validate rejects a preview state with entered tiles', () => { const s = C.fresh(); C.startGame(s, lcg(1)); s.entered = [s.sequence[0]]; assert.throws(() => C.validate(s)); });
test('Validate rejects a win outside the last round', () => { const s = C.fresh(); C.startGame(s, lcg(1)); s.status = 'won'; s.entered = s.sequence.slice(); assert.throws(() => C.validate(s)); });
test('Validate rejects a bad cursor', () => { const s = C.fresh(); s.cursor = 12; assert.throws(() => C.validate(s)); });
test('Validate returns copies of the puzzle', () => { const s = C.fresh(); C.startGame(s, lcg(1)); const clean = C.validate(s); clean.sequence.push(8); assert.equal(s.sequence.length, 3); });

// --- round trip and full games
test('Round trip serialization keeps the state', () => { const s = C.fresh(); C.startGame(s, lcg(9)); s.status = 'input'; s.entered = [s.sequence[0]]; assert.deepEqual(C.validate(JSON.parse(JSON.stringify(s))), s); });
test('A perfect game reaches the last round and wins', () => {
  const s = C.fresh();
  C.startGame(s, lcg(42));
  for (let round = 1; round <= C.MAX_ROUND; round++) {
    const sequence = s.sequence.slice();
    s.status = 'input';
    for (let i = 0; i < sequence.length; i++) {
      const result = C.applyInput(s, sequence[i], lcg(round));
      const last = i === sequence.length - 1;
      assert.equal(result.outcome, last ? (round === C.MAX_ROUND ? 'won' : 'advance') : 'correct');
    }
    if (round < C.MAX_ROUND) { assert.equal(s.round, round + 1); assert.equal(s.sequence.length, C.sequenceLengthForRound(round + 1)); }
  }
  assert.equal(s.status, 'won');
  assert.equal(s.bestRound, C.MAX_ROUND);
  assert.equal(s.gamesPlayed, 1);
});
test('A lost game reports the round reached', () => {
  const s = C.fresh();
  C.startGame(s, lcg(11));
  s.status = 'input';
  const wrong = (s.sequence[0] + 1) % C.TILE_COUNT;
  const result = C.applyInput(s, wrong, lcg(11));
  assert.equal(result.outcome, 'wrong');
  assert.equal(result.round, 1);
  assert.equal(C.stats(s).round, 1);
});

const report = { passed: results.filter(r => r.passed).length, total: results.length, results };
require('node:fs').writeFileSync(require('node:path').join(__dirname, 'core-results.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
console.log('Memory Grid core: ' + report.passed + '/' + report.total + ' passed');
if (report.passed !== report.total) process.exit(1);
