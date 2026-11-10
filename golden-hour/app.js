(() => {
  'use strict';
  const C = window.GoldenHourCore, $ = id => document.getElementById(id), KEY = 'golden-hour-v1';
  let state = C.fresh(), ready = false, overlay = null, blocked = false, revision = 0, savedRevision = 0;
  let queue = Promise.resolve(), lastSide = -Infinity;
  let plan = [], planKey = '', builtLocation = null, placeCursor = 0;
  // Select storage once. A failing native store never silently becomes browser storage.
  const nativeStore = window.creationStorage?.plain;
  const storageName = nativeStore ? 'R1' : 'Browser';
  const store = nativeStore || { getItem: key => localStorage.getItem(key), setItem: (key, value) => localStorage.setItem(key, value) };
  const isDevice = !!(window.closeWebView || nativeStore);
  const text = (id, value) => { const element = $(id); if (element) element.textContent = value; };
  const encode = value => btoa(JSON.stringify(value)); // State holds ASCII ids only.
  const deadline = promise => {
    let timer;
    return Promise.race([Promise.resolve(promise), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Storage timed out')), 4000); })]).finally(() => clearTimeout(timer));
  };
  function status(message, error = false) { text('save-state', message); $('save-state').dataset.error = String(error); }

  /* ---------- plan ---------- */

  function buildPlan() {
    const location = C.current(state).location, today = C.todayLocal();
    const key = location.id + ':' + C.dateKey(today);
    if (key === planKey) return;
    planKey = key; builtLocation = null;
    plan = C.dayPlan(location, today, C.DAY_COUNT);
  }

  function buildDays() {
    const location = C.current(state).location;
    if (builtLocation === location.id) return;
    builtLocation = location.id;
    const list = $('day-list');
    list.textContent = '';
    plan.forEach((day, index) => {
      const row = document.createElement('div');
      row.className = 'day-row'; row.id = 'day-' + index;
      row.setAttribute('role', 'option'); row.setAttribute('aria-selected', 'false');
      const date = document.createElement('span'); date.className = 'd'; date.textContent = C.formatDateShort(day.date);
      const times = document.createElement('span'); times.className = 't';
      times.textContent = C.formatTime12(day.events.local.sunrise) + ' · ' + C.formatTime12(day.events.local.sunset);
      row.append(date, times);
      row.setAttribute('aria-label', C.formatDateLong(day.date) + ', sunrise ' + C.formatTime12(day.events.local.sunrise) + ', sunset ' + C.formatTime12(day.events.local.sunset));
      row.addEventListener('click', () => { if (ready && !overlay) { state.dayIndex = index; render(); save(); } });
      list.appendChild(row);
    });
  }

  function scrollSelectedIntoView() {
    const list = $('day-list'), row = $('day-' + state.dayIndex);
    if (!list || !row) return;
    const top = row.offsetTop, bottom = top + row.offsetHeight;
    if (top < list.scrollTop) list.scrollTop = top;
    else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight;
  }

  function render() {
    buildPlan(); buildDays();
    const location = C.current(state).location, day = plan[state.dayIndex];
    const local = day.events.local;
    text('place-name', location.name);
    text('selected-date', C.formatDateLong(day.date));
    text('day-position', (state.dayIndex + 1) + ' / ' + C.DAY_COUNT);
    plan.forEach((_, index) => {
      const row = $('day-' + index);
      if (!row) return;
      const on = index === state.dayIndex;
      row.setAttribute('aria-selected', String(on));
      row.classList.toggle('is-selected', on);
    });
    $('day-list').setAttribute('aria-activedescendant', 'day-' + state.dayIndex);
    scrollSelectedIntoView();
    text('golden-am', C.formatWindow12(local.goldenAM));
    text('golden-pm', C.formatWindow12(local.goldenPM));
    text('blue-am', C.formatWindow12(local.blueAM));
    text('blue-pm', C.formatWindow12(local.bluePM));
    text('card-title', C.formatDateLong(day.date));
    text('card-place', location.name);
    text('card-sunrise', C.formatTime12(local.sunrise));
    text('card-golden-am', C.formatWindow12(local.goldenAM));
    text('card-noon', C.formatTime12(local.solarNoon));
    text('card-golden-pm', C.formatWindow12(local.goldenPM));
    text('card-sunset', C.formatTime12(local.sunset));
    text('card-blue-am', C.formatWindow12(local.blueAM));
    text('card-blue-pm', C.formatWindow12(local.bluePM));
    $('places-open').disabled = !ready;
    $('app').setAttribute('aria-busy', String(!ready));
    $('retry-save').hidden = !blocked;
    text('input-hint', isDevice ? 'Wheel / click' : 'Arrows / Enter');
  }

  /* ---------- storage ---------- */

  function save() {
    revision++; const thisRevision = revision, snapshot = encode(state);
    if (blocked) { status('Not saved: Save again', true); return queue; }
    status('Saving...');
    queue = queue.then(async () => {
      if (blocked) return;
      try {
        await deadline(store.setItem(KEY, snapshot)); savedRevision = thisRevision;
        if (savedRevision === revision) status(storageName + ' saved');
      } catch (e) { blocked = true; status('Save failed: Save again', true); text('places-hint', e.message + '. The current plan is still in memory.'); render(); }
    });
    return queue;
  }

  function retrySave() {
    blocked = false; $('retry-save').hidden = true;
    text('places-hint', 'Saving the current plan.');
    save();
  }

  /* ---------- interaction ---------- */

  function change(fn) { if (!ready || overlay) return; fn(); render(); save(); }
  function move(delta) { change(() => C.move(state, delta)); }

  function updatePlaceCursor() {
    C.LOCATIONS.forEach((location, index) => {
      const button = $('place-' + location.id);
      if (button) button.setAttribute('aria-selected', String(index === placeCursor));
    });
    $('place-list').setAttribute('aria-activedescendant', 'place-' + C.LOCATIONS[placeCursor].id);
  }

  function movePlaceCursor(delta) {
    placeCursor = Math.max(0, Math.min(C.LOCATIONS.length - 1, placeCursor + delta));
    updatePlaceCursor();
  }

  function choosePlace(id) {
    state.locationId = id;
    openOverlay(null);
    render(); save();
  }

  function onWheel(delta) {
    if (!ready) return;
    if (overlay === 'places') { movePlaceCursor(delta); return; }
    if (overlay) return;
    move(delta);
  }

  function openOverlay(name) {
    if (!ready && name) return;
    overlay = name;
    for (const id of ['places', 'day-card']) $(id).hidden = id !== name;
    // Prevent keyboard and screen-reader focus from reaching controls behind a modal.
    for (const element of $('app').children) if (element.tagName !== 'SECTION') element.inert = !!name;
    if (name === 'places') {
      placeCursor = Math.max(0, C.LOCATIONS.findIndex(l => l.id === state.locationId));
      updatePlaceCursor();
      $('place-list').focus();
    } else if (name === 'day-card') {
      $('card-close').focus();
    } else {
      $('places-open').focus();
    }
  }

  C.LOCATIONS.forEach(location => {
    const button = document.createElement('button');
    button.type = 'button'; button.id = 'place-' + location.id;
    button.setAttribute('role', 'option'); button.setAttribute('aria-selected', 'false');
    const name = document.createElement('span'); name.textContent = location.name;
    const zone = document.createElement('span'); zone.className = 'tz';
    const today = C.todayLocal();
    zone.textContent = C.zoneAbbreviation(location.tz, today.y, today.m, today.d);
    button.append(name, zone);
    button.addEventListener('click', () => { if (ready) choosePlace(location.id); });
    $('place-list').appendChild(button);
  });

  $('places-open').addEventListener('click', () => openOverlay('places'));
  $('places-close').addEventListener('click', () => openOverlay(null));
  $('card-close').addEventListener('click', () => openOverlay(null));
  $('retry-save').addEventListener('click', retrySave);
  $('places-save').addEventListener('click', retrySave);
  $('exit').addEventListener('click', async () => {
    $('exit').disabled = true;
    await queue;
    if (blocked || savedRevision !== revision) { text('places-hint', 'Not saved. Use Save again before exiting.'); $('exit').disabled = false; return; }
    try { if (window.closeWebView) window.closeWebView.postMessage(''); else text('places-hint', 'Saved. You can close this browser tab.'); }
    catch (e) { text('places-hint', 'Could not exit: ' + e.message); }
    $('exit').disabled = false;
  });

  window.addEventListener('scrollUp', () => onWheel(-1));
  window.addEventListener('scrollDown', () => onWheel(1));
  window.addEventListener('sideClick', () => {
    if (!ready) return;
    const now = performance.now();
    if (now - lastSide < 250) return; // Native double-click is two clicks about 50 ms apart.
    lastSide = now;
    if (overlay === 'places') { choosePlace(C.LOCATIONS[placeCursor].id); return; }
    if (overlay === 'day-card') { openOverlay(null); return; }
    openOverlay('day-card');
  });
  window.addEventListener('keydown', event => {
    if (overlay) {
      if (event.key === 'Escape') { event.preventDefault(); openOverlay(null); return; }
      if (overlay === 'places' && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) { event.preventDefault(); movePlaceCursor(event.key === 'ArrowUp' ? -1 : 1); return; }
      if (overlay === 'places' && (event.key === 'Enter' || event.key === ' ')) {
        const active = document.activeElement;
        const inList = !!active && !!active.closest && !!active.closest('#place-list');
        if (inList || !active || active.tagName !== 'BUTTON') { event.preventDefault(); choosePlace(C.LOCATIONS[placeCursor].id); return; }
      }
      if (event.key === 'Tab') {
        const buttons = [...$(overlay).querySelectorAll('button:not(:disabled)')], first = buttons[0], last = buttons.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
      return;
    }
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') { event.preventDefault(); move(event.key === 'ArrowUp' ? -1 : 1); }
    else if (['Enter', ' '].includes(event.key) && !['BUTTON', 'INPUT', 'TEXTAREA', 'SELECT', 'A'].includes(document.activeElement?.tagName)) { event.preventDefault(); openOverlay('day-card'); }
  });
  // Desktop preview only: the R1 reports hardware scrolling as scrollUp/scrollDown.
  if (!isDevice) {
    $('day-list').addEventListener('wheel', event => { event.preventDefault(); onWheel(event.deltaY > 0 ? 1 : -1); }, { passive: false });
    $('place-list').addEventListener('wheel', event => { event.preventDefault(); movePlaceCursor(event.deltaY > 0 ? 1 : -1); }, { passive: false });
  }
  // Each action queues its save immediately; page exit is not used as the sole save trigger.
  async function init() {
    status('Loading...'); render();
    try {
      const raw = await deadline(store.getItem(KEY));
      if (raw !== null && raw !== undefined) state = C.validate(JSON.parse(atob(raw)));
      status(raw ? storageName + ' restored' : storageName + ': new plan');
    } catch (e) { blocked = true; status('Load failed: Save again', true); text('places-hint', e.message + '. Save again replaces stored data with the current plan.'); }
    finally { ready = true; render(); }
  }
  init();
})();
