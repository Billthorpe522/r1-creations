/* Golden Hour — solar, timezone and planning logic as pure functions.
   No DOM, no network, no clock reads except the explicit todayLocal() helper.
   Solar math follows the NOAA / Jean Meeus equations. */
(function (root) {
  'use strict';
  const RAD = Math.PI / 180, DEG = 180 / Math.PI;
  const DAY_COUNT = 14;
  // Altitude in degrees. -0.833 = solar radius + atmospheric refraction.
  const ALT = { sunrise: -0.833, blueLow: -6, goldenLow: -4, goldenHigh: 6 };

  const LOCATIONS = [
    { id: 'manhattan-il', name: 'Manhattan, IL', lat: 41.4225, lon: -87.9859, tz: 'America/Chicago' },
    { id: 'chicago-il', name: 'Chicago, IL', lat: 41.8781, lon: -87.6298, tz: 'America/Chicago' },
    { id: 'nashville-tn', name: 'Nashville, TN', lat: 36.1627, lon: -86.7816, tz: 'America/Chicago' },
    { id: 'phoenix-az', name: 'Phoenix, AZ', lat: 33.4484, lon: -112.0740, tz: 'America/Phoenix' },
    { id: 'los-angeles-ca', name: 'Los Angeles, CA', lat: 34.0522, lon: -118.2437, tz: 'America/Los_Angeles' },
    { id: 'new-york-ny', name: 'New York, NY', lat: 40.7128, lon: -74.0060, tz: 'America/New_York' }
  ];

  // US zones: standard offset in minutes east of UTC plus the DST rule used.
  // 'us' = second Sunday in March to first Sunday in November. Phoenix never shifts.
  const ZONES = {
    'America/Chicago': { std: -360, dst: 'us' },
    'America/Phoenix': { std: -420, dst: 'none' },
    'America/Los_Angeles': { std: -480, dst: 'us' },
    'America/New_York': { std: -300, dst: 'us' }
  };

  const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const mod = (n, m) => ((n % m) + m) % m;
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

  /* ---------- calendar helpers ---------- */

  // Julian Day at 00:00 UT of the given Gregorian calendar date.
  function julianDay(year, month, day) {
    let y = year, m = month;
    if (m <= 2) { y -= 1; m += 12; }
    const a = Math.floor(y / 100), b = 2 - a + Math.floor(a / 4);
    return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + b - 1524.5;
  }

  // Julian Day -> UTC minutes since 1970-01-01 00:00.
  const jdToMinutes = jd => (jd - 2440587.5) * 1440;
  const minutesToJd = minutes => minutes / 1440 + 2440587.5;

  // nth Sunday of a month: n = 1 for the first Sunday.
  function nthSunday(year, month, n) {
    const first = new Date(Date.UTC(year, month - 1, 1));
    const day = 1 + mod(7 - first.getUTCDay(), 7) + (n - 1) * 7;
    return { y: year, m: month, d: day };
  }

  // US daylight saving time is in force on local dates from the second Sunday
  // in March through the first Sunday in November.
  function isUsDstDate(y, m, d) {
    const start = nthSunday(y, 3, 2), end = nthSunday(y, 11, 1);
    const key = (y * 10000) + (m * 100) + d;
    return key >= (start.y * 10000 + start.m * 100 + start.d) &&
           key <= (end.y * 10000 + end.m * 100 + end.d);
  }

  // UTC offset in minutes for a zone on a local calendar date.
  function zoneOffsetMinutes(zone, y, m, d) {
    const rule = ZONES[zone];
    if (!rule) throw new Error('Unknown timezone: ' + zone);
    if (rule.dst === 'us' && isUsDstDate(y, m, d)) return rule.std + 60;
    return rule.std;
  }

  function dateKey(date) { return date.y * 10000 + date.m * 100 + date.d; }

  // Zone abbreviation used in the location list, e.g. CDT, MST, PST, EST.
  const ZONE_INITIALS = { 'America/Chicago': 'C', 'America/Phoenix': 'M', 'America/Los_Angeles': 'P', 'America/New_York': 'E' };
  function zoneAbbreviation(zone, y, m, d) {
    const rule = ZONES[zone];
    if (!rule) return '';
    const dst = rule.dst === 'us' && isUsDstDate(y, m, d);
    return (ZONE_INITIALS[zone] || '') + (dst ? 'DT' : 'ST');
  }

  function addDays(date, count) {
    const dt = new Date(Date.UTC(date.y, date.m - 1, date.d) + count * 86400000);
    return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
  }

  function weekdayOf(date) {
    return new Date(Date.UTC(date.y, date.m - 1, date.d)).getUTCDay();
  }

  // The device's own local calendar date. Only place the clock is read.
  function todayLocal(now) {
    const d = now || new Date();
    return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() };
  }

  /* ---------- solar position ---------- */

  // Sun state for a Julian Day: Meeus low-accuracy series plus NOAA corrections.
  function solarState(jd) {
    const T = (jd - 2451545) / 36525;
    const L0 = mod(280.46646 + T * (36000.76983 + T * 0.0003032), 360);
    const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
    const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
    const C = Math.sin(M * RAD) * (1.914602 - T * (0.004817 + 0.000014 * T)) +
              Math.sin(2 * M * RAD) * (0.019993 - 0.000101 * T) +
              Math.sin(3 * M * RAD) * 0.000289;
    const trueLong = L0 + C;
    const appLong = trueLong - 0.00569 - 0.00478 * Math.sin((125.04 - 1934.136 * T) * RAD);
    const meanObliq = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
    const obliq = meanObliq + 0.00256 * Math.cos((125.04 - 1934.136 * T) * RAD);
    const declination = Math.asin(Math.sin(obliq * RAD) * Math.sin(appLong * RAD)) * DEG;
    const y = Math.pow(Math.tan(obliq * RAD / 2), 2);
    const equationOfTime = 4 * DEG * (
      y * Math.sin(2 * L0 * RAD) -
      2 * e * Math.sin(M * RAD) +
      4 * e * y * Math.sin(M * RAD) * Math.cos(2 * L0 * RAD) -
      0.5 * y * y * Math.sin(4 * L0 * RAD) -
      1.25 * e * e * Math.sin(2 * M * RAD));
    return { T, L0, M, e, C, trueLong, appLong, obliq, declination, equationOfTime };
  }

  // Hour angle in degrees at which the sun reaches the given altitude.
  // Returns NaN when the sun never reaches that altitude on the day.
  function hourAngle(lat, declination, altitude) {
    const cosH = (Math.sin(altitude * RAD) - Math.sin(lat * RAD) * Math.sin(declination * RAD)) /
                 (Math.cos(lat * RAD) * Math.cos(declination * RAD));
    if (cosH > 1 || cosH < -1) return NaN;
    return Math.acos(cosH) * DEG;
  }

  /* ---------- day events ---------- */

  // All solar events for one location on one local calendar date.
  // Times are minutes of day: `utc` is UTC, `local` is the location's clock.
  function dayEvents(location, y, m, d) {
    const offset = zoneOffsetMinutes(location.tz, y, m, d);
    const midnight = jdToMinutes(julianDay(y, m, d)); // UTC minutes of 00:00 UTC on that date
    // Evaluate the sun at local solar noon: the events of a date are closest to this instant.
    const state = solarState(minutesToJd(midnight + 720 - offset));
    const noonUtc = 720 - 4 * location.lon - state.equationOfTime; // minutes from 00:00 UTC
    const noonAbs = midnight + noonUtc; // UTC minutes since epoch
    const H = {
      sunrise: hourAngle(location.lat, state.declination, ALT.sunrise),
      blueLow: hourAngle(location.lat, state.declination, ALT.blueLow),
      goldenLow: hourAngle(location.lat, state.declination, ALT.goldenLow),
      goldenHigh: hourAngle(location.lat, state.declination, ALT.goldenHigh)
    };
    const utc = {
      solarNoon: mod(noonUtc, 1440),
      sunrise: isFinite(H.sunrise) ? mod(noonUtc - 4 * H.sunrise, 1440) : null,
      sunset: isFinite(H.sunrise) ? mod(noonUtc + 4 * H.sunrise, 1440) : null,
      goldenAM: isFinite(H.goldenLow) && isFinite(H.goldenHigh) ? [mod(noonUtc - 4 * H.goldenLow, 1440), mod(noonUtc - 4 * H.goldenHigh, 1440)] : null,
      goldenPM: isFinite(H.goldenLow) && isFinite(H.goldenHigh) ? [mod(noonUtc + 4 * H.goldenHigh, 1440), mod(noonUtc + 4 * H.goldenLow, 1440)] : null,
      blueAM: isFinite(H.blueLow) && isFinite(H.goldenLow) ? [mod(noonUtc - 4 * H.blueLow, 1440), mod(noonUtc - 4 * H.goldenLow, 1440)] : null,
      bluePM: isFinite(H.blueLow) && isFinite(H.goldenLow) ? [mod(noonUtc + 4 * H.goldenLow, 1440), mod(noonUtc + 4 * H.blueLow, 1440)] : null
    };
    const shift = value => value === null ? null : mod(value + offset, 1440);
    const local = {
      solarNoon: shift(utc.solarNoon),
      sunrise: shift(utc.sunrise),
      sunset: shift(utc.sunset),
      goldenAM: utc.goldenAM ? utc.goldenAM.map(shift) : null,
      goldenPM: utc.goldenPM ? utc.goldenPM.map(shift) : null,
      blueAM: utc.blueAM ? utc.blueAM.map(shift) : null,
      bluePM: utc.bluePM ? utc.bluePM.map(shift) : null
    };
    // Absolute UTC minutes since epoch, for tests and cross-checking.
    const abs = {
      solarNoon: noonAbs,
      sunrise: isFinite(H.sunrise) ? noonAbs - 4 * H.sunrise : null,
      sunset: isFinite(H.sunrise) ? noonAbs + 4 * H.sunrise : null
    };
    return { date: { y, m, d }, offsetMinutes: offset, declination: state.declination, equationOfTime: state.equationOfTime, utc, local, abs };
  }

  // 14 planned days starting at the given local date for one location.
  function dayPlan(location, startDate, count) {
    const days = [];
    const total = count === undefined ? DAY_COUNT : count;
    for (let i = 0; i < total; i++) {
      const date = addDays(startDate, i);
      days.push({
        index: i,
        date,
        weekday: weekdayOf(date),
        events: dayEvents(location, date.y, date.m, date.d)
      });
    }
    return days;
  }

  /* ---------- formatting ---------- */

  function formatTime12(minutes) {
    if (minutes === null || minutes === undefined || !isFinite(minutes)) return '--';
    const total = Math.round(mod(minutes, 1440));
    let hour = Math.floor(total / 60), mins = total % 60;
    const suffix = hour < 12 ? 'AM' : 'PM';
    let h12 = hour % 12; if (h12 === 0) h12 = 12;
    return h12 + ':' + String(mins).padStart(2, '0') + ' ' + suffix;
  }

  function formatTime12Compact(minutes) {
    if (minutes === null || minutes === undefined || !isFinite(minutes)) return '--';
    const total = Math.round(mod(minutes, 1440));
    let hour = Math.floor(total / 60), mins = total % 60;
    const suffix = hour < 12 ? 'a' : 'p';
    let h12 = hour % 12; if (h12 === 0) h12 = 12;
    return h12 + ':' + String(mins).padStart(2, '0') + suffix;
  }

  function formatWindow12(window) {
    if (!window) return '--';
    return formatTime12(window[0]) + ' - ' + formatTime12(window[1]);
  }

  function formatDateShort(date) {
    return WEEKDAYS[weekdayOf(date)] + ' ' + MONTHS[date.m - 1] + ' ' + date.d;
  }

  function formatDateLong(date) {
    const full = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return full[weekdayOf(date)] + ', ' + months[date.m - 1] + ' ' + date.d + ', ' + date.y;
  }

  /* ---------- saved state ---------- */

  function fresh() { return { version: 1, locationId: LOCATIONS[0].id, dayIndex: 0 }; }

  function validate(value) {
    if (!value || value.version !== 1) throw new Error('Unsupported saved state');
    if (!LOCATIONS.some(l => l.id === value.locationId)) throw new Error('Unknown location');
    if (!Number.isInteger(value.dayIndex) || value.dayIndex < 0 || value.dayIndex >= DAY_COUNT) throw new Error('Invalid day index');
    return { version: 1, locationId: value.locationId, dayIndex: value.dayIndex };
  }

  function current(state) {
    return { location: LOCATIONS.find(l => l.id === state.locationId), dayIndex: state.dayIndex };
  }

  function move(state, delta) {
    state.dayIndex = clamp(state.dayIndex + delta, 0, DAY_COUNT - 1);
    return state;
  }

  function selectLocation(state, id) {
    if (!LOCATIONS.some(l => l.id === id)) throw new Error('Unknown location');
    state.locationId = id;
    return state;
  }

  const api = {
    LOCATIONS, ZONES, WEEKDAYS, MONTHS, DAY_COUNT, ALT,
    julianDay, jdToMinutes, minutesToJd, nthSunday, isUsDstDate, zoneOffsetMinutes, zoneAbbreviation,
    solarState, hourAngle, dayEvents, dayPlan,
    addDays, weekdayOf, dateKey, todayLocal,
    formatTime12, formatTime12Compact, formatWindow12, formatDateShort, formatDateLong,
    fresh, validate, current, move, selectLocation
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.GoldenHourCore = api;
})(globalThis);
