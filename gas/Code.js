/*
 * 觀夕平台 data endpoint (Google Apps Script).
 * Script properties: SUNSETHUE_KEY, CWA_KEY, SPOTS_URL. Stores the daily snapshot in DAILY.
 * Runs only inside Apps Script; the pure helpers it calls live in time.js, sunsethue.js, cwa.js.
 */
var AVIATION_URL = 'https://aviationweather.gov/api/data/metar?ids=RCSS,RCTP&format=json&taf=true';
var DEFAULT_WINDOW = { start: '17:00', end: '18:00' };

function refreshDaily() {
  var props = PropertiesService.getScriptProperties();
  var spots = fetchJson_(props.getProperty('SPOTS_URL'));
  var now = new Date();
  var date = taipeiDateStr(now);
  var old = JSON.parse(props.getProperty('DAILY') || '{}');

  var out = {
    date: date,
    updated_at: Utilities.formatDate(now, 'Asia/Taipei', "yyyy-MM-dd'T'HH:mm:ssXXX"),
    regions: old.regions || {},
    towns: old.date === date ? (old.towns || {}) : {},
    errors: [],
  };

  // Sunsethue: one call per grid, using the first spot in that grid (fallback: region lat/lng).
  spots.regions.forEach(function (reg) {
    var spot = spots.spots.filter(function (s) { return s.sunsethue_grid === reg.grid; })[0] || reg;
    try {
      var res = UrlFetchApp.fetch(sunsethueUrl(spot.lat, spot.lng, date), {
        headers: { 'x-api-key': props.getProperty('SUNSETHUE_KEY') },
        muteHttpExceptions: true,
      });
      out.regions[reg.grid] = parseSunsethue(JSON.parse(res.getContentText()), date);
    } catch (e) {
      out.errors.push('sunsethue:' + reg.grid);
      console.error(e);
    }
  });

  // CWA: one call per distinct town; window from the town's grid when today's data exists.
  var townGrid = {};
  spots.spots.forEach(function (s) { townGrid[s.cwa_town] = townGrid[s.cwa_town] || s.sunsethue_grid; });
  spots.regions.forEach(function (r) { townGrid[r.cwa_town] = townGrid[r.cwa_town] || r.grid; });
  Object.keys(townGrid).forEach(function (town) {
    var r = out.regions[townGrid[town]];
    var window = r && r.date === date && r.golden_hour && r.blue_hour
      ? { start: r.golden_hour[0], end: r.blue_hour[1] }
      : DEFAULT_WINDOW;
    try {
      var json = fetchJson_(cwaUrl(town, date, props.getProperty('CWA_KEY')));
      out.towns[town] = selectTownWeather(json, date, window);
    } catch (e) {
      out.errors.push('cwa:' + town);
      console.error(e);
    }
  });

  props.setProperty('DAILY', JSON.stringify(out));
  return out;
}

function fetchAviation_() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get('aviation');
  if (hit) return JSON.parse(hit);
  var list = fetchJson_(AVIATION_URL);
  var byStation = {};
  list.forEach(function (m) { byStation[m.icaoId] = m; });
  cache.put('aviation', JSON.stringify(byStation), 600);
  return byStation;
}

function doGet() {
  var daily = JSON.parse(PropertiesService.getScriptProperties().getProperty('DAILY') || 'null') ||
    { date: null, updated_at: null, regions: {}, towns: {}, errors: ['no-daily-data'] };
  try {
    daily.metar = fetchAviation_();
  } catch (e) {
    daily.metar = {};
    daily.errors.push('aviation');
  }
  return ContentService.createTextOutput(JSON.stringify(daily)).setMimeType(ContentService.MimeType.JSON);
}

function installTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'refreshDaily') ScriptApp.deleteTrigger(t);
  });
  [9, 12, 15].forEach(function (h) {
    ScriptApp.newTrigger('refreshDaily').timeBased().atHour(h).everyDays(1).create();
  });
}

function fetchJson_(url) {
  var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('HTTP ' + res.getResponseCode() + ' for ' + url.split('?')[0]);
  return JSON.parse(res.getContentText());
}
