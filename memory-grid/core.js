/* Memory Grid model. Pure logic only: the app owns DOM, events and storage. */
(function (root) {
  'use strict';
  const TILE_COUNT = 9, FIRST_SEQUENCE_LENGTH = 3, MAX_SEQUENCE_LENGTH = 9;
  const MAX_ROUND = MAX_SEQUENCE_LENGTH - FIRST_SEQUENCE_LENGTH + 1; // seven rounds
  const STATE_VERSION = 1;
  const SHAPES = ['circle', 'square', 'triangle', 'diamond', 'star', 'hexagon', 'cross', 'ring', 'arrow'];
  const SHAPE_LABELS = ['Circle', 'Square', 'Triangle', 'Diamond', 'Star', 'Hexagon', 'Cross', 'Ring', 'Arrow'];
  const STATUSES = ['title', 'preview', 'input', 'gameover', 'won'];

  function sequenceLengthForRound(round) {
    const n = FIRST_SEQUENCE_LENGTH + Math.max(1, Math.round(round)) - 1;
    return Math.min(MAX_SEQUENCE_LENGTH, n);
  }
  function fresh() {
    return { version: STATE_VERSION, status: 'title', round: 1, bestRound: 0, gamesPlayed: 0, sequence: [], entered: [], cursor: 0 };
  }
  function randomTile(rng) {
    const r = typeof rng === 'function' ? rng() : Math.random();
    const n = Math.floor((Number.isFinite(r) ? r : 0) * TILE_COUNT);
    return Math.max(0, Math.min(TILE_COUNT - 1, n));
  }
  // Never place the same tile twice in a row, even with a degenerate generator.
  function pushUnique(seq, rng) {
    let tile = randomTile(rng);
    for (let attempt = 0; attempt < 20 && seq.length && seq[seq.length - 1] === tile; attempt++) tile = randomTile(rng);
    if (seq.length && seq[seq.length - 1] === tile) tile = (seq[seq.length - 1] + 1) % TILE_COUNT;
    seq.push(tile);
    return seq;
  }
  function generateSequence(length, rng) {
    const seq = [];
    const total = Math.max(0, Math.min(MAX_SEQUENCE_LENGTH, Math.round(length)));
    for (let i = 0; i < total; i++) pushUnique(seq, rng);
    return seq;
  }
  function extendSequence(previous, rng) {
    const seq = previous.slice();
    pushUnique(seq, rng);
    return seq;
  }
  function startGame(state, rng) {
    state.round = 1;
    state.sequence = generateSequence(FIRST_SEQUENCE_LENGTH, rng);
    state.entered = [];
    state.cursor = 0;
    state.status = 'preview';
    return state;
  }
  function toTitle(state) {
    state.status = 'title';
    state.round = 1;
    state.sequence = [];
    state.entered = [];
    state.cursor = 0;
    return state;
  }
  function applyInput(state, tileIndex, rng) {
    if (state.status !== 'input') return { outcome: 'ignored' };
    if (!Number.isInteger(tileIndex) || tileIndex < 0 || tileIndex >= TILE_COUNT) return { outcome: 'ignored' };
    const expected = state.sequence[state.entered.length];
    if (expected === undefined) return { outcome: 'ignored' };
    if (tileIndex !== expected) {
      state.status = 'gameover';
      state.gamesPlayed += 1;
      state.bestRound = Math.max(state.bestRound, state.round);
      return { outcome: 'wrong', expected, received: tileIndex, round: state.round };
    }
    state.entered.push(tileIndex);
    if (state.entered.length === state.sequence.length) {
      state.bestRound = Math.max(state.bestRound, state.round);
      if (state.round >= MAX_ROUND) {
        state.status = 'won';
        state.gamesPlayed += 1;
        return { outcome: 'won', round: state.round };
      }
      state.round += 1;
      state.entered = [];
      state.sequence = extendSequence(state.sequence, rng);
      state.cursor = 0;
      state.status = 'preview'; // the next round starts with a playback, not with input
      return { outcome: 'advance', round: state.round };
    }
    return { outcome: 'correct', position: state.entered.length, total: state.sequence.length };
  }
  function moveCursor(state, delta) {
    const d = Number.isFinite(delta) ? Math.trunc(delta) : 0;
    state.cursor = Math.max(0, Math.min(TILE_COUNT - 1, state.cursor + d));
    return state.cursor;
  }
  function setCursor(state, index) {
    state.cursor = Math.max(0, Math.min(TILE_COUNT - 1, Number.isInteger(index) ? index : 0));
    return state.cursor;
  }
  function stats(state) {
    return { round: state.round, bestRound: state.bestRound, gamesPlayed: state.gamesPlayed, sequence: state.sequence.slice(), entered: state.entered.slice() };
  }
  function validate(value) {
    if (!value || typeof value !== 'object') throw new Error('Missing saved game');
    if (value.version !== STATE_VERSION) throw new Error('Unsupported saved game version');
    if (!STATUSES.includes(value.status)) throw new Error('Invalid game status');
    if (!Number.isInteger(value.round) || value.round < 1 || value.round > MAX_ROUND) throw new Error('Invalid round');
    if (!Number.isInteger(value.bestRound) || value.bestRound < 0 || value.bestRound > MAX_ROUND) throw new Error('Invalid best round');
    if (!Number.isInteger(value.gamesPlayed) || value.gamesPlayed < 0) throw new Error('Invalid games played');
    if (!Array.isArray(value.sequence) || !Array.isArray(value.entered)) throw new Error('Invalid puzzle');
    if (!Number.isInteger(value.cursor) || value.cursor < 0 || value.cursor >= TILE_COUNT) throw new Error('Invalid cursor');
    for (const tile of value.sequence) if (!Number.isInteger(tile) || tile < 0 || tile >= TILE_COUNT) throw new Error('Invalid tile in sequence');
    for (let i = 1; i < value.sequence.length; i++) if (value.sequence[i] === value.sequence[i - 1]) throw new Error('Repeated tile in sequence');
    for (const tile of value.entered) if (!Number.isInteger(tile) || tile < 0 || tile >= TILE_COUNT) throw new Error('Invalid entered tile');
    if (value.status === 'title') {
      if (value.sequence.length !== 0 || value.entered.length !== 0) throw new Error('Title state cannot hold a puzzle');
    } else {
      if (value.sequence.length !== sequenceLengthForRound(value.round)) throw new Error('Sequence length does not match the round');
      if (value.entered.length > value.sequence.length) throw new Error('Too many entered tiles');
      for (let i = 0; i < value.entered.length; i++) if (value.entered[i] !== value.sequence[i]) throw new Error('Entered tiles do not match the sequence');
      if (value.status === 'preview' && value.entered.length !== 0) throw new Error('Preview state cannot have entered tiles');
      if ((value.status === 'input' || value.status === 'gameover') && value.entered.length >= value.sequence.length) throw new Error('Finished round stored as unfinished');
      if (value.status === 'won' && (value.round !== MAX_ROUND || value.entered.length !== value.sequence.length)) throw new Error('Invalid winning state');
    }
    return { version: STATE_VERSION, status: value.status, round: value.round, bestRound: value.bestRound, gamesPlayed: value.gamesPlayed, sequence: value.sequence.slice(), entered: value.entered.slice(), cursor: value.cursor };
  }
  const api = { TILE_COUNT, FIRST_SEQUENCE_LENGTH, MAX_SEQUENCE_LENGTH, MAX_ROUND, STATE_VERSION, SHAPES, SHAPE_LABELS, STATUSES, sequenceLengthForRound, fresh, randomTile, generateSequence, extendSequence, startGame, toTitle, applyInput, moveCursor, setCursor, stats, validate };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.MemoryCore = api;
})(globalThis);
