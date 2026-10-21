const CLOUD_RE = /^(FEW|SCT|BKN|OVC)(\d{3})/;
const WX_RE = /^(\+|-|VC)?[A-Z]*(RA|TS|DZ)[A-Z]*$/;
const PERIOD_RE = /^(\d{2})(\d{2})\/(\d{2})(\d{2})$/;

export function normalizeMetar(m) {
  if (!m) return null;
  let visibKm = null;
  if (typeof m.visib === 'string' && m.visib.includes('+')) visibKm = 10;
  else if (m.visib !== undefined && m.visib !== null && !Number.isNaN(parseFloat(m.visib))) {
    visibKm = Math.round(parseFloat(m.visib) * 1.609 * 10) / 10;
  }
  return {
    station: m.icaoId,
    obsTime: new Date(m.obsTime * 1000),
    visibKm,
    temp: m.temp ?? null,
    dewp: m.dewp ?? null,
    clouds: (m.clouds ?? [])
      .filter(c => c && typeof c.base === 'number' && /^(FEW|SCT|BKN|OVC)$/.test(c.cover))
      .map(c => ({ cover: c.cover, baseFt: c.base })),
    raw: m.rawOb ?? '',
    rawTaf: m.rawTaf ?? '',
  };
}

export function isMetarFresh(metar, now, maxAgeMin) {
  if (!metar?.obsTime) return false;
  return now.getTime() - metar.obsTime.getTime() <= maxAgeMin * 60e3;
}

export function parseTaf(raw, now = new Date()) {
  const tokens = (raw ?? '').trim().split(/\s+/).filter(t => !['TAF', 'AMD', 'COR'].includes(t));
  const issue = tokens.findIndex(t => /^\d{6}Z$/.test(t));
  if (issue < 0 || !PERIOD_RE.test(tokens[issue + 1] ?? '')) return [];
  const issueDay = Number(tokens[issue].slice(0, 2));

  let year = now.getUTCFullYear();
  let month = now.getUTCMonth();
  if (issueDay > now.getUTCDate()) month -= 1;
  const at = (dd, hh, mm = 0) => {
    const m = dd < issueDay ? month + 1 : month;
    return new Date(Date.UTC(year, m, dd, hh, mm));
  };
  const period = tok => {
    const [, d1, h1, d2, h2] = tok.match(PERIOD_RE).map(Number);
    return [at(d1, h1), at(d2, h2)];
  };

  const [tafFrom, tafTo] = period(tokens[issue + 1]);
  const groups = [];
  let cur = { type: 'BASE', from: tafFrom, to: tafTo, clouds: [], wx: [] };
  groups.push(cur);

  for (let i = issue + 2; i < tokens.length; i++) {
    const t = tokens[i];
    let next = null;
    if (/^FM\d{6}$/.test(t)) {
      const from = at(Number(t.slice(2, 4)), Number(t.slice(4, 6)), Number(t.slice(6, 8)));
      next = { type: 'FM', from, to: tafTo };
    } else if (t === 'BECMG' || t === 'TEMPO' || /^PROB\d{2}$/.test(t)) {
      const type = t.startsWith('PROB') ? 'PROB' : t;
      if (type === 'PROB' && tokens[i + 1] === 'TEMPO') i++;
      if (!PERIOD_RE.test(tokens[i + 1] ?? '')) continue;
      const [from, to] = period(tokens[++i]);
      next = { type, from, to };
    }
    if (next) {
      if (next.type === 'FM') {
        for (const g of groups) if ((g.type === 'BASE' || g.type === 'FM') && g.to > next.from) g.to = next.from;
      }
      cur = { ...next, clouds: [], wx: [] };
      groups.push(cur);
      continue;
    }
    const c = t.match(CLOUD_RE);
    if (c) {
      cur.clouds.push({ cover: c[1], baseFt: Number(c[2]) * 100 });
      cur.cloudsSet = true;
    } else if (WX_RE.test(t)) {
      cur.wx.push(t);
      cur.wxSet = true;
    } else if (t === 'CAVOK' || t === 'NSC' || t === 'SKC') {
      cur.cloudsSet = true;
      if (t === 'CAVOK') cur.wxSet = true;
    } else if (t === 'NSW') {
      cur.wxSet = true;
    }
  }
  applyBecmg(groups);
  for (const g of groups) { delete g.cloudsSet; delete g.wxSet; }
  return groups;
}

// BECMG: elements it omits stay as before; once its period ends the new
// conditions replace the prevailing group until the next change or TAF end.
function applyBecmg(groups) {
  const prevailing = groups.filter(g => g.type === 'BASE' || g.type === 'FM');
  for (const b of groups.filter(g => g.type === 'BECMG')) {
    const prev = prevailing.filter(g => g.from <= b.from && g.to > b.from).at(-1);
    if (!prev) continue;
    if (!b.cloudsSet) b.clouds = prev.clouds.map(c => ({ ...c }));
    if (!b.wxSet) b.wx = [...prev.wx];
    const prevEnd = prev.to;
    if (prev.to > b.to) prev.to = b.to;
    b.to = prevEnd;
    prevailing.push(b);
  }
}

export function groupsOverlapping(groups, from, to) {
  return groups.filter(g => g.from < to && g.to > from);
}
