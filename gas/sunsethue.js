/* Sunsethue event API: request URL and response parsing. */
function sunsethueTime_() {
  return typeof module !== 'undefined' ? require('./time.js') : { toTaipeiHHMM: toTaipeiHHMM };
}

function sunsethueUrl(lat, lng, date) {
  return 'https://api.sunsethue.com/event?latitude=' + lat + '&longitude=' + lng +
    '&date=' + date + '&type=sunset';
}

function parseSunsethue(json, date, fetchedAt) {
  var d = json && json.data;
  if (!d || !d.magics) throw new Error('Sunsethue: unexpected response ' + JSON.stringify(json).slice(0, 200));
  var t = sunsethueTime_().toTaipeiHHMM;
  return {
    date: date,
    fetched_at: fetchedAt || null,
    quality: d.quality,
    quality_text: d.quality_text,
    cloud_cover: d.cloud_cover,
    sunset: t(d.time),
    direction: d.direction,
    golden_hour: d.magics.golden_hour.map(t),
    blue_hour: d.magics.blue_hour.map(t),
  };
}

if (typeof module !== 'undefined') module.exports = { sunsethueUrl: sunsethueUrl, parseSunsethue: parseSunsethue };
