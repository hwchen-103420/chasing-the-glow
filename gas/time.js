/* Time helpers (fixed UTC+8; Taiwan has no DST). */
function toTaipeiHHMM(iso) {
  var d = new Date(new Date(iso).getTime() + 8 * 3600 * 1000);
  return d.toISOString().slice(11, 16);
}

function taipeiDateStr(d) {
  return new Date(d.getTime() + 8 * 3600 * 1000).toISOString().slice(0, 10);
}

if (typeof module !== 'undefined') module.exports = { toTaipeiHHMM: toTaipeiHHMM, taipeiDateStr: taipeiDateStr };
