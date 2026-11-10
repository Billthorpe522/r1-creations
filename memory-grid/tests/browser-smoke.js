/* Browser-console expression. Start on a fresh session; run in test browser only.
   Native hardware events here are EMULATED; no physical-R1 claim. */
(async () => {
  const results = [], $ = id => document.getElementById(id);
  const check = (name, passed) => results.push({ name, passed: !!passed });
  const click = id => $(id).click();
  const emit = name => window.dispatchEvent(new Event(name));
  const key = k => $('grid').dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  const waitFor = async (fn, timeout = 9000) => { const start = Date.now(); while (Date.now() - start < timeout) { if (fn()) return true; await pause(40); } return false; };
  const phase = () => $('app').dataset.phase;
  const saved = async () => { for (let i = 0; i < 150; i++) { if (!$('save-state').textContent.includes('Saving')) break; await pause(20); } };
  const overlays = ['menu', 'help', 'gameover', 'confirm'];
  const cursor = () => { const id = $('grid').getAttribute('aria-activedescendant'); return id ? Number(id.split('-')[1]) : -1; };
  const moveTo = index => { let at = cursor(); while (at !== index) { emit(at < index ? 'scrollDown' : 'scrollUp'); at = at < index ? at + 1 : at - 1; } };
  // One pick per hardware press. Native double clicks arrive about 50 ms apart and are ignored.
  const pick = async index => { moveTo(index); await pause(280); emit('sideClick'); };
  // Record every shape that lights up, in the order it lights.
  const lit = [];
  const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      const nowLit = mutation.target.classList.contains('is-lit');
      const wasLit = String(mutation.oldValue || '').split(/\s+/).includes('is-lit');
      if (nowLit && !wasLit) lit.push(Number(mutation.target.dataset.tile));
    }
  });
  observer.observe($('grid'), { subtree: true, attributes: true, attributeFilter: ['class'], attributeOldValue: true });
  // Normalise whatever state was restored so the run is repeatable.
  await waitFor(() => $('app').getAttribute('aria-busy') === 'false');
  for (let i = 0; i < 4 && overlays.some(id => !$(id).hidden); i++) { $(overlays.find(id => !$(id).hidden)).querySelector('button').click(); await pause(40); }
  if (phase() !== 'title') { click('title-btn'); await pause(60); if (!$('confirm').hidden) { click('confirm-leave'); await pause(60); } }
  check('Ready after initialization', $('app').getAttribute('aria-busy') === 'false');
  check('Title panel visible on load', !$('title-panel').hidden);
  check('Grid hidden on the title screen', $('grid').hidden);
  check('Start control offered on the title', !$('start').hidden);
  check('Title shows best round and games played', /Best round \d+ · \d+ games played/.test($('title-stats').textContent));
  const tiles = [...document.querySelectorAll('.tile')];
  check('Nine tiles rendered', tiles.length === 9);
  check('Every tile has a distinct shape', new Set(tiles.map(tile => tile.innerHTML)).size === 9);
  check('Every tile has an accessible label', tiles.every(tile => (tile.getAttribute('aria-label') || '').length > 0));
  check('Grid exposes listbox semantics', $('grid').getAttribute('role') === 'listbox' && tiles.every(tile => tile.getAttribute('role') === 'option'));
  const bestBefore = Number($('app').dataset.best), gamesBefore = Number($('app').dataset.games);
  lit.length = 0;
  click('start');
  check('Start begins round one', $('app').dataset.round === '1' && phase() === 'preview');
  check('Round one uses three shapes', Number($('app').dataset.length) === 3);
  check('Preview finishes before the player turn', await waitFor(() => phase() === 'input'));
  check('Round one showed three shapes in order', lit.length === 3);
  check('Cursor starts on the first tile', cursor() === 0);
  emit('scrollDown');
  check('Wheel down moves the cursor forward', cursor() === 1);
  emit('scrollUp');
  check('Wheel up moves the cursor back', cursor() === 0);
  for (let i = 0; i < 12; i++) emit('scrollDown');
  check('Cursor stops at the last tile', cursor() === 8);
  for (let i = 0; i < 12; i++) emit('scrollUp');
  check('Cursor stops at the first tile', cursor() === 0);
  key('ArrowDown');
  check('Arrow down moves the cursor', cursor() === 1);
  key('ArrowUp');
  check('Arrow up moves the cursor back', cursor() === 0);
  const first = lit.slice(-3);
  moveTo(first[0]);
  await pause(280);
  emit('sideClick');
  check('Correct pick flashes green', $('tile-' + first[0]).classList.contains('is-correct'));
  emit('sideClick');
  check('Duplicate side clicks are ignored', Number($('app').dataset.entered) === 1);
  await pick(first[1]);
  await pick(first[2]);
  check('Correct picks advance the round', await waitFor(() => $('app').dataset.round === '2'));
  check('Round two adds a shape', Number($('app').dataset.length) === 4);
  check('Round two previews before the player turn', await waitFor(() => phase() === 'input'));
  const second = lit.slice(-4);
  check('Round two showed four shapes in order', second.length === 4);
  await pick(second[0]);
  check('Correct pick in round two is recorded', Number($('app').dataset.entered) === 1);
  const wrong = (second[1] + 1) % 9;
  moveTo(wrong);
  key('Enter');
  check('Enter picks the shape under the cursor', $('tile-' + wrong).classList.contains('is-wrong'));
  check('Wrong pick ends the game', await waitFor(() => !$('gameover').hidden, 4000));
  check('Game over shows the round reached', $('gameover-round').textContent === '2');
  check('Game over shows the best round', $('gameover-best').textContent === String(Math.max(bestBefore, 2)));
  check('Game over shows games played', $('gameover-games').textContent === String(gamesBefore + 1));
  check('Background controls are inert while the game over screen is open', document.querySelector('header').inert === true);
  await saved();
  const raw = window.creationStorage ? await window.creationStorage.plain.getItem('memory-grid-v1') : localStorage.getItem('memory-grid-v1');
  let stored = null;
  try { stored = MemoryCore.validate(JSON.parse(atob(raw))); } catch (e) { stored = null; }
  check('Saved state validates', !!stored);
  check('Saved state keeps the puzzle and progress', !!stored && stored.status === 'gameover' && stored.sequence.length === 4 && stored.entered.length === 1);
  const beforeReplay = lit.length;
  click('replay-seq');
  check('Replay closes the game over screen', $('gameover').hidden);
  check('Missed shapes can be replayed', await waitFor(() => lit.length >= beforeReplay + 4, 9000));
  check('Replay returns to the game over screen', await waitFor(() => !$('gameover').hidden, 9000));
  click('again');
  check('Play again starts a fresh round one', $('app').dataset.round === '1' && phase() === 'preview');
  click('menu-open');
  check('Menu opens over the board', !$('menu').hidden);
  check('Background controls are inert while the menu is open', document.querySelector('header').inert === true);
  check('Exit control is offered', !$('exit').hidden);
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  check('Escape closes the menu', $('menu').hidden);
  click('title-btn');
  check('Leaving a round asks for confirmation', !$('confirm').hidden);
  click('confirm-cancel');
  check('Keeping the round preserves it', $('confirm').hidden && $('app').dataset.round === '1');
  await saved();
  check('Save status is honest', $('save-state').textContent.endsWith('saved'));
  const rawAgain = window.creationStorage ? await window.creationStorage.plain.getItem('memory-grid-v1') : localStorage.getItem('memory-grid-v1');
  let latest = null;
  try { latest = MemoryCore.validate(JSON.parse(atob(rawAgain))); } catch (e) { latest = null; }
  check('Latest queued save persisted', !!latest && latest.version === MemoryCore.STATE_VERSION && latest.round === 1);
  observer.disconnect();
  window.memoryGridResults = results;
  return { passed: results.filter(r => r.passed).length, total: results.length, results };
})();
