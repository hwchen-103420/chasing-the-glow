/* Observation log: rows for the "forecasts" and "ratings" sheets (pure helpers; Code.js writes them). */
var FORECAST_HEADER = ['date', 'run_at', 'grid', 'quality', 'quality_text', 'cloud_cover',
  'sunset', 'direction', 'golden_start', 'blue_end'];

var RATING_HEADER = ['submitted_at', 'date', 'spot_id', 'spot_name', 'rating', 'mode', 'note',
  'shown_quality', 'shown_tier', 'shown_status', 'shown_flags', 'shown_pop', 'shown_wx', 'shown_updated_at'];

var RATING_MODES = ['onsite', 'cam'];

function forecastRows(daily) {
  return Object.keys(daily.regions || {})
    .filter(function (grid) { return daily.regions[grid].date === daily.date; })
    .map(function (grid) {
      var r = daily.regions[grid];
      return [daily.date, daily.updated_at, grid, r.quality, r.quality_text, r.cloud_cover,
        r.sunset, r.direction, (r.golden_hour || [])[0] || '', (r.blue_hour || [])[1] || ''];
    });
}

// Text cells starting with = + - @ would be evaluated by Sheets; prefix them with a quote.
function safeText_(v, max) {
  var s = String(v == null ? '' : v);
  if (s.length > max) throw new Error('text too long');
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function parseRating(body, spotIds, now) {
  var r = JSON.parse(body);
  if (!Number.isInteger(r.rating) || r.rating < 1 || r.rating > 10) throw new Error('rating must be 1–10');
  if (spotIds.indexOf(r.spot_id) < 0) throw new Error('unknown spot');
  if (RATING_MODES.indexOf(r.mode) < 0) throw new Error('mode must be onsite or cam');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date || '')) throw new Error('bad date');
  var s = r.shown || {};
  return [
    now.toISOString(), r.date, r.spot_id, safeText_(r.spot_name, 60), r.rating, r.mode,
    safeText_(r.note, 200),
    typeof s.quality === 'number' ? s.quality : '',
    safeText_(s.tier, 20), safeText_(s.status, 20),
    safeText_((s.flags || []).join(' | '), 500),
    typeof s.pop === 'number' ? s.pop : '',
    safeText_(s.wx, 40), safeText_(s.updated_at, 20),
  ];
}

if (typeof module !== 'undefined') {
  module.exports = {
    FORECAST_HEADER: FORECAST_HEADER, RATING_HEADER: RATING_HEADER,
    forecastRows: forecastRows, parseRating: parseRating,
  };
}
