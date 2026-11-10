/* Run with: node golden-hour/tests/core.test.cjs */
'use strict';
const assert = require('node:assert/strict'), C = require('../core.js');
const results = [];
const test = (name, fn) => {
  try { fn(); results.push({ name, passed: true }); }
  catch (e) { results.push({ name, passed: false, error: e.message }); }
};
const near = (actual, expected, tolerance, label) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, label + ': got ' + actual + ', expected ' + expected + ' +/- ' + tolerance);

/* ---------- location and calendar data ---------- */

test('Six locations with unique ids', () => {
  assert.equal(C.LOCATIONS.length, 6);
  assert.equal(new Set(C.LOCATIONS.map(l => l.id)).size, 6);
});
test('Location coordinates are plausible', () => {
  for (const l of C.LOCATIONS) {
    assert.ok(Math.abs(l.lat) <= 90 && Math.abs(l.lon) <= 180, l.id);
    assert.ok(l.lat > 25 && l.lat < 50, l.id + ' latitude');
    assert.ok(l.lon > -125 && l.lon < -65, l.id + ' longitude');
  }
});
test('Every location has a known timezone rule', () => {
  for (const l of C.LOCATIONS) assert.ok(C.ZONES[l.tz], l.id + ' timezone ' + l.tz);
});
test('Plan covers fourteen days', () => assert.equal(C.DAY_COUNT, 14));

/* ---------- Julian day ---------- */

test('Julian day at the J2000 epoch', () => assert.equal(C.julianDay(2000, 1, 1), 2451544.5));
test('Julian day matches UTC epoch arithmetic', () => {
  for (const [y, m, d] of [[1970, 1, 1], [2026, 6, 21], [2026, 11, 10], [2030, 1, 1]]) {
    assert.equal(C.jdToMinutes(C.julianDay(y, m, d)), Date.UTC(y, m - 1, d) / 60000);
  }
});
test('Julian century is zero at J2000', () => assert.equal(C.solarState(2451545.0).T, 0));

/* ---------- solar state ---------- */

test('Declination is near zero at the March equinox', () => near(C.solarState(C.julianDay(2026, 3, 20) + 0.5).declination, 0, 0.1, 'equinox declination'));
test('Declination is near +23.44 at the June solstice', () => near(C.solarState(C.julianDay(2026, 6, 21) + 0.5).declination, 23.44, 0.05, 'June declination'));
test('Declination is near -23.44 at the December solstice', () => near(C.solarState(C.julianDay(2026, 12, 21) + 0.5).declination, -23.44, 0.05, 'December declination'));
test('Equation of time crosses zero in mid April', () => near(C.solarState(C.julianDay(2026, 4, 15) + 0.5).equationOfTime, 0, 0.5, 'April equation of time'));
test('Equation of time crosses zero in mid June', () => near(C.solarState(C.julianDay(2026, 6, 13) + 0.5).equationOfTime, 0, 0.5, 'June equation of time'));
test('Equation of time crosses zero in early September', () => near(C.solarState(C.julianDay(2026, 9, 1) + 0.5).equationOfTime, 0, 0.5, 'September equation of time'));
test('Equation of time is near its February minimum', () => near(C.solarState(C.julianDay(2026, 2, 11) + 0.5).equationOfTime, -14.2, 0.6, 'February equation of time'));
test('Equation of time is near its November maximum', () => near(C.solarState(C.julianDay(2026, 11, 3) + 0.5).equationOfTime, 16.4, 0.6, 'November equation of time'));
test('Sun eccentricity is near 0.0167', () => near(C.solarState(2451545.0).e, 0.0167, 0.0002, 'eccentricity'));
test('Mean longitude advances about one degree a day', () => {
  const a = C.solarState(C.julianDay(2026, 6, 21) + 0.5).L0, b = C.solarState(C.julianDay(2026, 6, 22) + 0.5).L0;
  near(b - a, 0.9856, 0.01, 'daily longitude step');
});
test('Hour angle is undefined when the sun never reaches the altitude', () => assert.ok(Number.isNaN(C.hourAngle(89, 23.44, 6))));
test('Hour angle shrinks as the altitude rises', () => {
  const low = C.hourAngle(41.8781, 23.44, -0.833), high = C.hourAngle(41.8781, 23.44, 20);
  assert.ok(low > high && high > 0, 'hour angles ' + low + ' ' + high);
});

/* ---------- daylight saving ---------- */

test('Second Sunday in March 2026 is March 8', () => assert.deepEqual(C.nthSunday(2026, 3, 2), { y: 2026, m: 3, d: 8 }));
test('First Sunday in November 2026 is November 1', () => assert.deepEqual(C.nthSunday(2026, 11, 1), { y: 2026, m: 11, d: 1 }));
test('Second Sunday in March 2027 is March 14', () => assert.deepEqual(C.nthSunday(2027, 3, 2), { y: 2027, m: 3, d: 14 }));
test('First Sunday in November 2027 is November 7', () => assert.deepEqual(C.nthSunday(2027, 11, 1), { y: 2027, m: 11, d: 7 }));
test('Nth Sunday always lands on a Sunday', () => {
  for (const [y, m, n] of [[2026, 3, 2], [2027, 11, 1], [2028, 3, 2]]) {
    const s = C.nthSunday(y, m, n);
    assert.equal(new Date(Date.UTC(s.y, s.m - 1, s.d)).getUTCDay(), 0);
  }
});
test('DST runs from the second Sunday in March to the first Sunday in November', () => {
  assert.equal(C.isUsDstDate(2026, 3, 7), false);
  assert.equal(C.isUsDstDate(2026, 3, 8), true);
  assert.equal(C.isUsDstDate(2026, 10, 31), true);
  assert.equal(C.isUsDstDate(2026, 11, 1), true);
  assert.equal(C.isUsDstDate(2026, 11, 2), false);
});
test('Chicago switches to daylight time on the second Sunday in March', () => {
  assert.equal(C.zoneOffsetMinutes('America/Chicago', 2026, 3, 7), -360);
  assert.equal(C.zoneOffsetMinutes('America/Chicago', 2026, 3, 8), -300);
});
test('Chicago switches back on the first Sunday in November', () => {
  assert.equal(C.zoneOffsetMinutes('America/Chicago', 2026, 11, 1), -300);
  assert.equal(C.zoneOffsetMinutes('America/Chicago', 2026, 11, 2), -360);
});
test('Phoenix never observes daylight saving', () => {
  for (const [m, d] of [[1, 15], [4, 10], [7, 4], [10, 20], [12, 21]]) assert.equal(C.zoneOffsetMinutes('America/Phoenix', 2026, m, d), -420);
});
test('Zone offsets match the IANA standard offsets', () => {
  assert.equal(C.zoneOffsetMinutes('America/New_York', 2026, 1, 15), -300);
  assert.equal(C.zoneOffsetMinutes('America/New_York', 2026, 7, 15), -240);
  assert.equal(C.zoneOffsetMinutes('America/Los_Angeles', 2026, 1, 15), -480);
  assert.equal(C.zoneOffsetMinutes('America/Los_Angeles', 2026, 7, 15), -420);
});
test('Zone abbreviations report daylight and standard time', () => {
  assert.equal(C.zoneAbbreviation('America/Chicago', 2026, 7, 1), 'CDT');
  assert.equal(C.zoneAbbreviation('America/Chicago', 2026, 12, 1), 'CST');
  assert.equal(C.zoneAbbreviation('America/Phoenix', 2026, 7, 1), 'MST');
  assert.equal(C.zoneAbbreviation('America/New_York', 2026, 7, 1), 'EDT');
  assert.equal(C.zoneAbbreviation('America/Los_Angeles', 2026, 12, 1), 'PST');
});
test('Unknown timezone is rejected', () => assert.throws(() => C.zoneOffsetMinutes('Mars/Olympus', 2026, 1, 1)));

/* ---------- sunrise and sunset against api.sunrise-sunset.org (UTC) ---------- */

const REFERENCE = [
  // location id, date, sunrise UTC, sunset UTC, solar noon UTC
  ['chicago-il', [2026, 6, 21], '2026-06-21 10:15:31', '2026-06-22 01:29:16', '2026-06-21 17:52:24'],
  ['chicago-il', [2026, 12, 21], '2026-12-21 13:14:46', '2026-12-21 22:22:37', '2026-12-21 17:48:42'],
  ['chicago-il', [2026, 11, 10], '2026-11-10 12:34:17', '2026-11-10 22:34:37', '2026-11-10 17:34:27'],
  ['manhattan-il', [2026, 6, 21], '2026-06-21 10:18:32', '2026-06-22 01:29:07', '2026-06-21 17:53:49'],
  ['manhattan-il', [2026, 12, 21], '2026-12-21 13:14:43', '2026-12-21 22:25:32', '2026-12-21 17:50:07'],
  ['manhattan-il', [2026, 11, 10], '2026-11-10 12:34:41', '2026-11-10 22:37:03', '2026-11-10 17:35:52'],
  ['los-angeles-ca', [2026, 6, 21], '2026-06-21 12:42:04', '2026-06-22 03:07:40', '2026-06-21 19:54:52'],
  ['los-angeles-ca', [2026, 12, 21], '2026-12-21 14:54:39', '2026-12-22 00:47:44', '2026-12-21 19:51:12'],
  ['phoenix-az', [2026, 6, 21], '2026-06-21 12:19:00', '2026-06-22 02:41:22', '2026-06-21 19:30:11'],
  ['phoenix-az', [2026, 12, 21], '2026-12-21 14:28:25', '2026-12-22 00:24:36', '2026-12-21 19:26:30'],
  ['new-york-ny', [2026, 6, 21], '2026-06-21 09:25:01', '2026-06-22 00:30:46', '2026-06-21 16:57:53'],
  ['new-york-ny', [2026, 12, 21], '2026-12-21 12:16:31', '2026-12-21 21:31:51', '2026-12-21 16:54:11'],
  ['nashville-tn', [2026, 6, 21], '2026-06-21 10:30:17', '2026-06-22 01:07:43', '2026-06-21 17:49:00'],
  ['chicago-il', [2026, 3, 8], '2026-03-08 12:13:25', '2026-03-08 23:48:59', '2026-03-08 18:01:12'],
  ['chicago-il', [2026, 11, 1], '2026-11-01 12:23:15', '2026-11-01 22:44:55', '2026-11-01 17:34:05']
];
const referenceMinutes = text => {
  const [date, time] = text.split(' '), [y, m, d] = date.split('-').map(Number), [hh, mm] = time.split(':').map(Number);
  return Date.UTC(y, m - 1, d, hh, mm) / 60000;
};
const worstDelta = { minutes: 0 };
for (const [id, [y, m, d], rise, set, noon] of REFERENCE) {
  const label = id + ' ' + y + '-' + m + '-' + d;
  test('Sunrise and sunset match the reference within two minutes: ' + label, () => {
    const location = C.LOCATIONS.find(l => l.id === id);
    const events = C.dayEvents(location, y, m, d);
    const deltas = [
      Math.abs(events.abs.sunrise - referenceMinutes(rise)),
      Math.abs(events.abs.sunset - referenceMinutes(set)),
      Math.abs(events.abs.solarNoon - referenceMinutes(noon))
    ];
    worstDelta.minutes = Math.max(worstDelta.minutes, ...deltas);
    for (const delta of deltas) assert.ok(delta <= 2, label + ' delta ' + delta.toFixed(2) + ' minutes');
  });
}
test('Every reference row is within one minute of the published values', () => {
  assert.ok(worstDelta.minutes <= 1, 'worst delta ' + worstDelta.minutes.toFixed(3) + ' minutes');
});

/* ---------- event structure ---------- */

for (const location of C.LOCATIONS) {
  test('Sunrise, noon and sunset are ordered at ' + location.name, () => {
    const e = C.dayEvents(location, 2026, 6, 21);
    assert.ok(e.local.sunrise < e.local.solarNoon && e.local.solarNoon < e.local.sunset, location.name);
  });
  test('Golden and blue hour windows are ordered at ' + location.name, () => {
    const e = C.dayEvents(location, 2026, 6, 21).local;
    assert.ok(e.blueAM[1] <= e.goldenAM[0], 'blue AM ends before golden AM');
    assert.ok(e.goldenAM[0] <= e.goldenAM[1] && e.goldenAM[1] <= e.solarNoon, 'golden AM');
    assert.ok(e.solarNoon <= e.goldenPM[0] && e.goldenPM[0] <= e.goldenPM[1], 'golden PM');
    assert.ok(e.goldenPM[1] <= e.bluePM[0] && e.bluePM[0] <= e.bluePM[1], 'blue PM');
  });
  test('Local times equal UTC plus the zone offset at ' + location.name, () => {
    const e = C.dayEvents(location, 2026, 6, 21);
    const expected = (value => (value + e.offsetMinutes + 1440) % 1440)(e.utc.sunrise);
    near(e.local.sunrise, expected, 1e-9, 'local sunrise');
  });
  test('A summer day is longer than a winter day at ' + location.name, () => {
    const summer = C.dayEvents(location, 2026, 6, 21), winter = C.dayEvents(location, 2026, 12, 21);
    const summerLength = (summer.local.sunset - summer.local.sunrise + 1440) % 1440;
    const winterLength = (winter.local.sunset - winter.local.sunrise + 1440) % 1440;
    assert.ok(summerLength > winterLength + 60, location.name + ' ' + summerLength + ' vs ' + winterLength);
  });
}
test('Chicago summer sunrise matches the published local time', () => {
  const e = C.dayEvents(C.LOCATIONS.find(l => l.id === 'chicago-il'), 2026, 6, 21);
  assert.equal(C.formatTime12(e.local.sunrise), '5:16 AM');
  assert.equal(C.formatTime12(e.local.sunset), '8:29 PM');
  assert.equal(C.formatTime12(e.local.solarNoon), '12:52 PM');
});
test('Phoenix keeps the same offset through summer and winter', () => {
  const summer = C.dayEvents(C.LOCATIONS.find(l => l.id === 'phoenix-az'), 2026, 6, 21);
  const winter = C.dayEvents(C.LOCATIONS.find(l => l.id === 'phoenix-az'), 2026, 12, 21);
  assert.equal(summer.offsetMinutes, winter.offsetMinutes);
  assert.ok(summer.local.solarNoon < 13 * 60 && summer.local.solarNoon > 12 * 60, 'Phoenix solar noon near 12:30');
});
test('Golden hour is longer than blue hour', () => {
  const e = C.dayEvents(C.LOCATIONS.find(l => l.id === 'chicago-il'), 2026, 6, 21).local;
  const golden = e.goldenAM[1] - e.goldenAM[0], blue = e.blueAM[1] - e.blueAM[0];
  assert.ok(golden > blue * 3, 'golden ' + golden + ' blue ' + blue);
});
test('Day events expose the offset used for that date', () => {
  assert.equal(C.dayEvents(C.LOCATIONS.find(l => l.id === 'chicago-il'), 2026, 7, 4).offsetMinutes, -300);
  assert.equal(C.dayEvents(C.LOCATIONS.find(l => l.id === 'chicago-il'), 2026, 12, 4).offsetMinutes, -360);
});

/* ---------- day plan ---------- */

test('Plan starts today and covers fourteen consecutive days', () => {
  const today = C.todayLocal();
  const plan = C.dayPlan(C.LOCATIONS[0], today);
  assert.equal(plan.length, 14);
  assert.deepEqual(plan[0].date, today);
  for (let i = 1; i < plan.length; i++) assert.deepEqual(plan[i].date, C.addDays(today, i));
});
test('Plan days advance one weekday at a time', () => {
  const plan = C.dayPlan(C.LOCATIONS[0], { y: 2026, m: 11, d: 10 });
  for (let i = 1; i < plan.length; i++) assert.equal((plan[i - 1].weekday + 1) % 7, plan[i].weekday);
});
test('Plan rows carry computed events', () => {
  const plan = C.dayPlan(C.LOCATIONS[0], { y: 2026, m: 6, d: 21 });
  assert.equal(plan[0].events.local.sunrise, C.dayEvents(C.LOCATIONS[0], 2026, 6, 21).local.sunrise);
});
test('Add days crosses month and year boundaries', () => {
  assert.deepEqual(C.addDays({ y: 2026, m: 12, d: 31 }, 1), { y: 2027, m: 1, d: 1 });
  assert.deepEqual(C.addDays({ y: 2026, m: 2, d: 28 }, 1), { y: 2026, m: 3, d: 1 });
  assert.deepEqual(C.addDays({ y: 2028, m: 2, d: 28 }, 1), { y: 2028, m: 2, d: 29 });
});

/* ---------- formatting ---------- */

test('Midnight and noon use the 12 hour clock', () => {
  assert.equal(C.formatTime12(0), '12:00 AM');
  assert.equal(C.formatTime12(720), '12:00 PM');
  assert.equal(C.formatTime12(60), '1:00 AM');
  assert.equal(C.formatTime12(780), '1:00 PM');
  assert.equal(C.formatTime12(1439), '11:59 PM');
  assert.equal(C.formatTime12(1440), '12:00 AM');
});
test('Missing times render as a dash', () => {
  assert.equal(C.formatTime12(null), '--');
  assert.equal(C.formatTime12(undefined), '--');
  assert.equal(C.formatWindow12(null), '--');
});
test('Rounding never produces a 60th minute', () => {
  for (let m = 0; m < 1440; m += 7) assert.ok(!C.formatTime12(m + 0.5).includes(':60'));
});
test('Compact times use a lower case suffix', () => {
  assert.equal(C.formatTime12Compact(0), '12:00a');
  assert.equal(C.formatTime12Compact(780), '1:00p');
});
test('Windows read as a range', () => assert.equal(C.formatWindow12([60, 120]), '1:00 AM - 2:00 AM'));
test('Dates format with weekday and month', () => {
  assert.equal(C.formatDateShort({ y: 2026, m: 6, d: 21 }), 'Sun Jun 21');
  assert.equal(C.formatDateLong({ y: 2026, m: 6, d: 21 }), 'Sunday, June 21, 2026');
});

/* ---------- saved state ---------- */

test('Fresh state is versioned and valid', () => {
  const state = C.fresh();
  assert.equal(state.version, 1);
  assert.equal(state.locationId, C.LOCATIONS[0].id);
  assert.equal(state.dayIndex, 0);
  assert.deepEqual(C.validate(state), state);
});
test('Fresh states do not share references', () => {
  const a = C.fresh(), b = C.fresh();
  a.dayIndex = 5;
  assert.equal(b.dayIndex, 0);
});
test('Wrong version is rejected', () => assert.throws(() => C.validate({ ...C.fresh(), version: 9 })));
test('Unknown location is rejected', () => assert.throws(() => C.validate({ ...C.fresh(), locationId: 'atlantis' })));
test('Out of range day index is rejected', () => {
  assert.throws(() => C.validate({ ...C.fresh(), dayIndex: -1 }));
  assert.throws(() => C.validate({ ...C.fresh(), dayIndex: 14 }));
  assert.throws(() => C.validate({ ...C.fresh(), dayIndex: 1.5 }));
});
test('Missing state is rejected', () => assert.throws(() => C.validate(null)));
test('Move clamps at both ends of the list', () => {
  const s = C.fresh();
  C.move(s, -5); assert.equal(s.dayIndex, 0);
  C.move(s, 99); assert.equal(s.dayIndex, 13);
  C.move(s, -1); assert.equal(s.dayIndex, 12);
});
test('Selecting a location keeps the day index', () => {
  const s = C.fresh();
  s.dayIndex = 4;
  C.selectLocation(s, 'new-york-ny');
  assert.equal(C.current(s).location.id, 'new-york-ny');
  assert.equal(s.dayIndex, 4);
});
test('Selecting an unknown location throws', () => assert.throws(() => C.selectLocation(C.fresh(), 'nope')));
test('Roundtrip serialization survives validation', () => {
  const s = C.fresh();
  C.move(s, 3); C.selectLocation(s, 'phoenix-az');
  assert.deepEqual(C.validate(JSON.parse(JSON.stringify(s))), s);
});

const failed = results.filter(r => !r.passed);
const report = { passed: results.length - failed.length, total: results.length, results };
require('node:fs').writeFileSync(require('node:path').join(__dirname, 'core-results.json'), JSON.stringify(report, null, 2));
console.log('Golden Hour core tests: ' + report.passed + '/' + report.total + ' passed');
if (failed.length) {
  for (const f of failed) console.error('FAIL: ' + f.name + '\n  ' + f.error);
  process.exitCode = 1;
}
