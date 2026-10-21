/* CWA township forecast (鄉鎮未來3天天氣預報): request URL and value selection. */
var CWA_DATASETS = { '臺北市': 'F-D0047-061', '新北市': 'F-D0047-069', '桃園市': 'F-D0047-005' };

function cwaUrl(town, date, key) {
  var parts = town.split('/');
  var ds = CWA_DATASETS[parts[0]];
  if (!ds) throw new Error('CWA: no dataset for ' + parts[0]);
  var q = {
    Authorization: key,
    LocationName: parts[1],
    timeFrom: date + 'T15:00:00',
    timeTo: date + 'T21:00:00',
  };
  return 'https://opendata.cwa.gov.tw/api/v1/rest/datastore/' + ds + '?' +
    Object.keys(q).map(function (k) { return k + '=' + encodeURIComponent(q[k]); }).join('&');
}

function cwaElement_(json, name) {
  var loc = json && json.records && json.records.Locations && json.records.Locations[0] &&
    json.records.Locations[0].Location && json.records.Locations[0].Location[0];
  var els = (loc && loc.WeatherElement) || [];
  for (var i = 0; i < els.length; i++) if (els[i].ElementName === name) return els[i].Time || [];
  return [];
}

function cwaNumber_(v) {
  var n = parseFloat(v);
  return isNaN(n) ? null : n;
}

function selectTownWeather(json, date, window, townName) {
  var loc = json && json.records && json.records.Locations && json.records.Locations[0] &&
    json.records.Locations[0].Location && json.records.Locations[0].Location[0];
  if (!loc) throw new Error('CWA: no location in response');
  if (townName && loc.LocationName !== townName) {
    throw new Error('CWA: expected ' + townName + ' but got ' + loc.LocationName);
  }
  var start = Date.parse(date + 'T' + window.start + ':00+08:00');
  var end = Date.parse(date + 'T' + window.end + ':00+08:00');

  var pop = null;
  cwaElement_(json, '3小時降雨機率').forEach(function (t) {
    if (Date.parse(t.StartTime) < end && Date.parse(t.EndTime) > start) {
      var p = cwaNumber_(t.ElementValue[0].ProbabilityOfPrecipitation);
      if (p !== null && (pop === null || p > pop)) pop = p;
    }
  });

  var wx = null;
  cwaElement_(json, '天氣現象').forEach(function (t) {
    if (Date.parse(t.StartTime) <= start && Date.parse(t.EndTime) > start) wx = t.ElementValue[0].Weather;
  });

  var hour = Date.parse(date + 'T' + window.start.slice(0, 2) + ':00:00+08:00');
  var temp = null;
  cwaElement_(json, '溫度').forEach(function (t) {
    if (Date.parse(t.DataTime) === hour) temp = cwaNumber_(t.ElementValue[0].Temperature);
  });

  if (pop === null) throw new Error('CWA: no rain probability for the window');
  return { wx: wx, temp: temp, pop: pop };
}

if (typeof module !== 'undefined') {
  module.exports = { CWA_DATASETS: CWA_DATASETS, cwaUrl: cwaUrl, selectTownWeather: selectTownWeather };
}
