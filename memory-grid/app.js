(() => {
  'use strict';
  const C = window.MemoryCore, $ = id => document.getElementById(id), KEY = 'memory-grid-v1';
  let state = C.fresh(), ready = false, overlay = null, blocked = false, revision = 0, savedRevision = 0;
  let queue = Promise.resolve(), lastSide = -Infinity, playback = 0, helpReturn = null, themeMode = 'auto';
  // Select storage once. A failing native store never silently becomes browser storage.
  const nativeStore = window.creationStorage?.plain;
  const storageName = nativeStore ? 'R1' : 'Browser';
  const store = nativeStore || { getItem: key => localStorage.getItem(key), setItem: (key, value) => localStorage.setItem(key, value) };
  const text = (id, value) => { $(id).textContent = value; };
  const encode = value => btoa(JSON.stringify(value)); // State is numbers and short ASCII words only.
  const deadline = promise => {
    let timer;
    return Promise.race([Promise.resolve(promise), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Storage timed out')), 4000); })]).finally(() => clearTimeout(timer));
  };
  function status(message, error = false) { text('save-state', message); $('save-state').dataset.error = String(error); }

  // Nine inline shapes, drawn with strokes so they stay legible in dark mode.
  const SHAPE_SVG = [
    '<circle cx="12" cy="12" r="7.5"/>',
    '<rect x="5" y="5" width="14" height="14" rx="1.5"/>',
    '<path d="M12 4.5 20 19H4Z"/>',
    '<path d="M12 3.5 20.5 12 12 20.5 3.5 12Z"/>',
    '<path d="m12 3.4 2.6 5.4 6 .9-4.3 4.2 1 6-5.3-2.8-5.3 2.8 1-6L3.4 9.7l6-.9Z"/>',
    '<path d="M12 3.2 20 7.6v8.8L12 20.8 4 16.4V7.6Z"/>',
    '<path d="M12 4.5v15M4.5 12h15"/>',
    '<circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="3.2"/>',
    '<path d="M4.5 12H18M13.2 6.8 18.4 12l-5.2 5.2"/>'
  ];
  const grid = $('grid');
  C.SHAPES.forEach((shape, index) => {
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.id = 'tile-' + index;
    tile.className = 'tile';
    tile.dataset.tile = String(index);
    tile.dataset.shape = shape;
    tile.setAttribute('role', 'option');
    tile.setAttribute('aria-selected', 'false');
    tile.setAttribute('aria-label', C.SHAPE_LABELS[index]);
    tile.tabIndex = -1;
    tile.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + SHAPE_SVG[index] + '</svg>';
    tile.addEventListener('click', () => { C.setCursor(state, index); render(); selectTile(index); });
    grid.appendChild(tile);
  });

  function render() {
    const s = state, title = s.status === 'title';
    $('app').setAttribute('aria-busy', String(!ready));
    $('app').dataset.phase = s.status;
    $('app').dataset.round = String(s.round);
    $('app').dataset.best = String(s.bestRound);
    $('app').dataset.games = String(s.gamesPlayed);
    $('app').dataset.entered = String(s.entered.length);
    $('app').dataset.length = String(s.sequence.length);
    $('title-panel').hidden = !title;
    grid.hidden = title;
    text('round-label', title ? '' : 'Round ' + s.round + ' of ' + C.MAX_ROUND);
    text('progress', title ? 'Best round ' + s.bestRound : s.status === 'preview' ? 'Watch' : s.status === 'gameover' ? 'Game over' : s.status === 'won' ? 'You win' : s.entered.length + ' / ' + s.sequence.length);
    text('title-stats', 'Best round ' + s.bestRound + ' · ' + s.gamesPlayed + ' games played');
    $('start').hidden = !title;
    $('help-open').hidden = !title;
    $('replay').hidden = title;
    $('title-btn').hidden = title;
    for (let i = 0; i < C.TILE_COUNT; i++) $('tile-' + i).setAttribute('aria-selected', String(!title && s.status === 'input' && i === s.cursor));
    grid.setAttribute('aria-activedescendant', s.status === 'input' ? 'tile-' + s.cursor : '');
    text('input-hint', window.closeWebView || nativeStore ? 'Wheel / click' : 'Arrows / Enter');
  }
  function save() {
    revision++; const thisRevision = revision, snapshot = encode(state);
    if (blocked) { status('Not saved: Menu > Save again', true); return queue; }
    status('Saving...');
    queue = queue.then(async () => {
      if (blocked) return;
      try {
        await deadline(store.setItem(KEY, snapshot)); savedRevision = thisRevision;
        if (savedRevision === revision) status(storageName + ' saved');
      } catch (e) { blocked = true; status('Save failed: Menu > Save again', true); text('menu-status', e.message + '. The current game is still in memory.'); }
    });
    return queue;
  }
  function stopPlayback() {
    playback++;
    document.querySelectorAll('.tile.is-lit').forEach(tile => tile.classList.remove('is-lit'));
  }
  function playSequence(sequence, onDone) {
    const token = ++playback;
    document.querySelectorAll('.tile.is-lit').forEach(tile => tile.classList.remove('is-lit'));
    let i = 0;
    const step = () => {
      if (token !== playback) return;
      if (i >= sequence.length) { if (onDone) onDone(); return; }
      const tile = $('tile-' + sequence[i++]);
      tile.classList.add('is-lit');
      setTimeout(() => {
        if (token !== playback) return;
        tile.classList.remove('is-lit');
        setTimeout(step, 150);
      }, 420);
    };
    step();
  }
  function startPreview() {
    state.status = 'preview';
    render(); save();
    playSequence(state.sequence.slice(), () => {
      if (state.status !== 'preview') return;
      state.status = 'input';
      render(); save();
    });
  }
  function startGame() {
    C.startGame(state, Math.random);
    render(); save();
    startPreview();
  }
  function selectTile(index) {
    if (!ready || overlay || state.status !== 'input') return;
    const result = C.applyInput(state, index, Math.random);
    if (result.outcome === 'ignored') return;
    const tile = $('tile-' + index);
    if (result.outcome === 'wrong') {
      tile.classList.add('is-wrong');
      setTimeout(() => { tile.classList.remove('is-wrong'); showGameOver(); }, 520);
    } else if (result.outcome === 'advance' || result.outcome === 'won') {
      tile.classList.add('is-correct');
      setTimeout(() => { tile.classList.remove('is-correct'); if (result.outcome === 'won') showGameOver(); else startPreview(); }, 320);
    } else {
      tile.classList.add('is-correct');
      setTimeout(() => tile.classList.remove('is-correct'), 320);
    }
    render(); save();
  }
  function moveCursor(delta) {
    if (!ready || overlay || state.status !== 'input') return;
    C.moveCursor(state, delta);
    render(); save();
  }
  function showGameOver() {
    text('gameover-title', state.status === 'won' ? 'You win!' : 'Game over');
    text('gameover-round', String(state.round));
    text('gameover-best', String(state.bestRound));
    text('gameover-games', String(state.gamesPlayed));
    openOverlay('gameover');
  }
  function replayMissed() {
    openOverlay(null);
    playSequence(state.sequence.slice(), () => { if (state.status === 'gameover' || state.status === 'won') showGameOver(); });
  }
  function leaveRound() {
    stopPlayback();
    C.toTitle(state);
    openOverlay(null);
    render(); save();
  }
  function openOverlay(name) {
    if (!ready) return;
    overlay = name;
    for (const id of ['menu', 'help', 'gameover', 'confirm']) $(id).hidden = id !== name;
    // Prevent keyboard and screen-reader focus from reaching controls behind a modal.
    for (const element of $('app').children) if (element.tagName !== 'SECTION') element.inert = !!name;
    if (name) $(name).querySelector('button')?.focus();
    else if (state.status === 'title') $('start').focus(); else grid.focus();
  }
  function applyTheme() {
    const root = document.documentElement;
    root.classList.remove('dark', 'light');
    if (themeMode === 'dark') root.classList.add('dark');
    else if (themeMode === 'light') root.classList.add('light');
    text('theme', 'Theme: ' + themeMode.charAt(0).toUpperCase() + themeMode.slice(1));
  }
  $('start').addEventListener('click', startGame);
  $('help-open').addEventListener('click', () => { helpReturn = null; openOverlay('help'); });
  $('menu-help').addEventListener('click', () => { helpReturn = 'menu'; openOverlay('help'); });
  $('help-close').addEventListener('click', () => openOverlay(helpReturn));
  $('menu-open').addEventListener('click', () => openOverlay('menu'));
  $('menu-close').addEventListener('click', () => openOverlay(null));
  $('replay').addEventListener('click', replayMissed);
  $('replay-seq').addEventListener('click', replayMissed);
  $('again').addEventListener('click', () => { openOverlay(null); startGame(); });
  $('gameover-close').addEventListener('click', () => openOverlay(null));
  $('gameover-title').addEventListener('click', leaveRound);
  $('title-btn').addEventListener('click', () => { if (state.status === 'preview' || state.status === 'input') openOverlay('confirm'); else leaveRound(); });
  $('confirm-leave').addEventListener('click', leaveRound);
  $('confirm-cancel').addEventListener('click', () => openOverlay(null));
  $('theme').addEventListener('click', () => { themeMode = themeMode === 'auto' ? 'dark' : themeMode === 'dark' ? 'light' : 'auto'; applyTheme(); });
  $('retry-save').addEventListener('click', () => { blocked = false; text('menu-status', 'Saving the current game.'); save(); });
  $('exit').addEventListener('click', async () => {
    $('exit').disabled = true;
    await queue;
    if (blocked || savedRevision !== revision) { text('menu-status', 'Not saved. Use Save again before exiting.'); $('exit').disabled = false; return; }
    try { if (window.closeWebView) window.closeWebView.postMessage(''); else text('menu-status', 'Saved. You can close this browser tab.'); }
    catch (e) { text('menu-status', 'Could not exit: ' + e.message); }
    $('exit').disabled = false;
  });
  window.addEventListener('scrollUp', () => moveCursor(-1));
  window.addEventListener('scrollDown', () => moveCursor(1));
  window.addEventListener('sideClick', () => {
    if (!ready || overlay) return;
    const now = performance.now();
    if (now - lastSide < 250) return; // Native double-click is two clicks about 50 ms apart.
    lastSide = now;
    if (state.status === 'title') startGame();
    else if (state.status === 'input') selectTile(state.cursor);
    else if (state.status === 'gameover' || state.status === 'won') replayMissed();
  });
  window.addEventListener('keydown', event => {
    if (overlay) {
      if (event.key === 'Escape') {
        event.preventDefault();
        openOverlay(overlay === 'help' ? helpReturn : overlay === 'menu' ? null : null);
      } else if (event.key === 'Tab') {
        const buttons = [...$(overlay).querySelectorAll('button:not(:disabled)')], first = buttons[0], last = buttons.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
      return;
    }
    const target = event.target, onCanvas = target && (target === grid || grid.contains(target));
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      if (state.status !== 'input') return;
      event.preventDefault();
      moveCursor(event.key === 'ArrowUp' ? -1 : 1);
    } else if (event.key === 'Enter' || event.key === ' ') {
      const onButton = document.activeElement && document.activeElement.tagName === 'BUTTON';
      if (onCanvas || !onButton) {
        if (state.status === 'input') { event.preventDefault(); selectTile(state.cursor); }
        else if (state.status === 'title') { event.preventDefault(); startGame(); }
      }
    }
  });
  // Each action queues its save immediately; page exit is not used as the sole save trigger.
  async function init() {
    status('Loading...'); render();
    try {
      const raw = await deadline(store.getItem(KEY));
      if (raw !== null && raw !== undefined) state = C.validate(JSON.parse(atob(raw)));
      status(raw ? storageName + ' restored' : storageName + ': new game');
    } catch (e) { blocked = true; status('Load failed: Menu > Save again', true); text('menu-status', e.message + '. Save again replaces stored data with the current game.'); }
    finally {
      ready = true; render();
      if (state.status === 'preview') startPreview();
      else if (state.status === 'title') $('start').focus();
    }
  }
  init();
})();
