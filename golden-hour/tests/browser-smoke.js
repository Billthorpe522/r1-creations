/* Browser-console expression. Start on a fresh session (clear site data for
   http://127.0.0.1:8942 first); run in test browser only.
   Native hardware events here are EMULATED; no physical-R1 claim. */
(async () => {
  const results = [], $ = id => document.getElementById(id);
  const check = (name, passed) => results.push({ name, passed: !!passed });
  const click = id => $(id).click();
  const emit = name => window.dispatchEvent(new Event(name));
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  const saved = async () => {
    for (let i = 0; i < 100; i++) { if (!$('save-state').textContent.includes('Saving')) break; await pause(20); }
  };
  const C = window.GoldenHourCore;
  const errors = [];
  window.addEventListener('error', event => errors.push('error: ' + event.message));
  window.addEventListener('unhandledrejection', event => errors.push('rejection: ' + event.reason));
  const realError = console.error.bind(console);
  console.error = (...args) => { errors.push('console: ' + args.map(String).join(' ')); realError(...args); };
  const location = () => C.LOCATIONS.find(l => l.name === $('place-name').textContent);
  const index = () => parseInt($('day-position').textContent.split('/')[0].trim(), 10) - 1;
  const day = () => C.dayPlan(location(), C.todayLocal())[index()];
  const time = value => /^\d{1,2}:\d{2} (AM|PM)$/.test(value);

  check('Ready after initialization', $('app').getAttribute('aria-busy') === 'false');
  check('Header shows the first location', $('place-name').textContent === 'Manhattan, IL');
  check('Day list holds fourteen rows', document.querySelectorAll('#day-list .day-row').length === 14);
  check('Header shows the selected date', $('selected-date').textContent === C.formatDateLong(C.todayLocal()));
  check('First day starts selected', $('day-0').getAttribute('aria-selected') === 'true' && $('day-position').textContent === '1 / 14');
  check('Listbox points at the selected day', $('day-list').getAttribute('aria-activedescendant') === 'day-0');
  check('Rows show sunrise and sunset', time(C.formatTime12(day().events.local.sunrise)) && $('day-0').textContent.includes(C.formatTime12(day().events.local.sunrise)) && $('day-0').textContent.includes(C.formatTime12(day().events.local.sunset)));
  check('Detail strip shows four time windows', ['golden-am', 'golden-pm', 'blue-am', 'blue-pm'].every(id => /^\d{1,2}:\d{2} (AM|PM) - \d{1,2}:\d{2} (AM|PM)$/.test($(id).textContent)));
  check('Detail strip matches the computed day', $('golden-am').textContent === C.formatWindow12(day().events.local.goldenAM) && $('golden-pm').textContent === C.formatWindow12(day().events.local.goldenPM) && $('blue-am').textContent === C.formatWindow12(day().events.local.blueAM) && $('blue-pm').textContent === C.formatWindow12(day().events.local.bluePM));

  emit('scrollDown'); emit('scrollDown'); emit('scrollDown'); emit('scrollUp');
  check('Emulated wheel navigation', $('day-position').textContent === '3 / 14' && $('day-2').getAttribute('aria-selected') === 'true');
  check('Wheel updates the header date', $('selected-date').textContent === C.formatDateLong(C.dayPlan(location(), C.todayLocal())[2].date));
  check('Wheel updates the detail strip', $('golden-am').textContent === C.formatWindow12(C.dayPlan(location(), C.todayLocal())[2].events.local.goldenAM));
  check('Selected row scrolls into view', $('day-2').getBoundingClientRect().top >= $('day-list').getBoundingClientRect().top - 0.5);

  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  check('Desktop arrow navigation', $('day-position').textContent === '4 / 14');
  $('day-list').dispatchEvent(new WheelEvent('wheel', { deltaY: 120, bubbles: true, cancelable: true }));
  check('Desktop wheel navigation', $('day-position').textContent === '5 / 14');
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
  check('Arrow up moves back', $('day-position').textContent === '4 / 14');

  emit('sideClick');
  check('Side click opens the day card', !$('day-card').hidden);
  check('Day card lists every event', ['card-sunrise', 'card-golden-am', 'card-noon', 'card-golden-pm', 'card-sunset', 'card-blue-am', 'card-blue-pm'].every(id => $(id).textContent.includes(':')));
  check('Day card matches the computed day', $('card-sunrise').textContent === C.formatTime12(day().events.local.sunrise) && $('card-noon').textContent === C.formatTime12(day().events.local.solarNoon) && $('card-sunset').textContent === C.formatTime12(day().events.local.sunset));
  check('Day card shows the selected date', $('card-title').textContent === C.formatDateLong(day().date));
  check('Background is inert behind the card', document.querySelector('header').inert && $('day-list').inert);
  check('Focus moves into the card', document.activeElement === $('card-close'));
  emit('sideClick');
  check('Duplicate hardware click is ignored', !$('day-card').hidden);
  await pause(270); emit('sideClick');
  check('Side click closes the card', $('day-card').hidden);
  check('Focus returns to the trigger', document.activeElement === $('places-open'));

  click('places-open');
  check('Places opens the picker', !$('places').hidden);
  check('Picker lists six locations', document.querySelectorAll('#place-list button').length === 6);
  check('Picker marks the current location', $('place-manhattan-il').getAttribute('aria-selected') === 'true');
  check('Focus moves into the picker', document.activeElement === $('place-list'));
  emit('scrollDown');
  check('Wheel moves the picker cursor', $('place-chicago-il').getAttribute('aria-selected') === 'true' && $('place-manhattan-il').getAttribute('aria-selected') === 'false');
  emit('scrollUp');
  check('Wheel moves the picker cursor back', $('place-manhattan-il').getAttribute('aria-selected') === 'true');
  emit('scrollDown'); emit('scrollDown');
  check('Picker cursor reaches Nashville', $('place-nashville-tn').getAttribute('aria-selected') === 'true');
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  check('Escape cancels the picker', $('places').hidden && $('place-name').textContent === 'Manhattan, IL');

  click('places-open'); emit('scrollDown'); await pause(270); emit('sideClick');
  check('Side click selects a location', $('places').hidden && $('place-name').textContent === 'Chicago, IL');
  check('Day list rebuilt for the new location', $('day-0').textContent.includes(C.formatTime12(C.dayPlan(location(), C.todayLocal())[0].events.local.sunrise)));
  check('Selected day is kept across locations', $('day-position').textContent === '4 / 14');
  check('Detail strip follows the new location', $('golden-am').textContent === C.formatWindow12(day().events.local.goldenAM));

  click('places-open');
  check('Picker marks the new location', $('place-chicago-il').getAttribute('aria-selected') === 'true');
  const priorDay = $('day-position').textContent;
  emit('scrollDown');
  check('Wheel is ignored behind the picker', $('day-position').textContent === priorDay);
  check('Wheel moves the picker cursor', $('place-nashville-tn').getAttribute('aria-selected') === 'true');
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  check('Enter chooses the highlighted location', $('places').hidden && $('place-name').textContent === 'Nashville, TN');

  await saved();
  const raw = window.creationStorage ? await window.creationStorage.plain.getItem('golden-hour-v1') : localStorage.getItem('golden-hour-v1');
  const stored = C.validate(JSON.parse(atob(raw)));
  check('Saved state validates', stored.version === 1 && stored.locationId === 'nashville-tn');
  check('Latest queued save persisted', stored.dayIndex === index());
  check('Saved status is honest', $('save-state').textContent.endsWith('saved'));
  check('No page overflow', document.documentElement.scrollWidth <= 240 && document.documentElement.scrollHeight <= 282);
  check('Detail strip is inside the viewport', $('detail').getBoundingClientRect().bottom <= 282 && $('detail').getBoundingClientRect().right <= 240);

  // A failing store must warn and require an explicit retry, never silently overwrite.
  const realSetItem = localStorage.setItem.bind(localStorage);
  localStorage.setItem = () => { throw new Error('QuotaExceededError'); };
  emit('scrollDown');
  await pause(80);
  check('Save failure warns the user', $('save-state').dataset.error === 'true' && $('save-state').textContent.includes('Save again'));
  check('Save again control appears', !$('retry-save').hidden);
  localStorage.setItem = realSetItem;
  click('retry-save');
  await saved();
  check('Save again recovers', $('save-state').textContent.endsWith('saved') && $('retry-save').hidden);
  const recovered = C.validate(JSON.parse(atob(localStorage.getItem('golden-hour-v1'))));
  check('Recovered state is valid', recovered.version === 1 && recovered.dayIndex === index());
  check('No runtime errors', errors.length === 0);
  if (errors.length) console.log('runtime errors: ' + errors.join(' | '));

  window.goldenHourTestResults = results;
  return { passed: results.filter(r => r.passed).length, total: results.length, results };
})();
