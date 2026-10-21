const { test } = require('node:test');
const assert = require('node:assert/strict');
const { selectTownWeather, cwaUrl } = require('../../gas/cwa.js');
const load = () => JSON.parse(JSON.stringify(require('../fixtures/cwa-061-zhongshan-2026-10-20.json')));
const pops = json => json.records.Locations[0].Location[0].WeatherElement.find(e => e.ElementName === '3小時降雨機率').Time;

test('selects weather, temperature and rain for the best window', () => {
  assert.deepEqual(selectTownWeather(load(), '2026-10-20', { start: '17:11', end: '17:52' }),
    { wx: '晴', temp: 31, pop: 0 });
});

test('a window crossing 18:00 takes the higher rain probability', () => {
  const j = load();
  pops(j)[1].ElementValue[0].ProbabilityOfPrecipitation = '60';
  assert.deepEqual(selectTownWeather(j, '2026-10-20', { start: '17:40', end: '18:20' }),
    { wx: '晴', temp: 31, pop: 60 });
});

test('a response without the requested town throws', () => {
  const j = load();
  j.records.Locations[0].Location = [];
  assert.throws(() => selectTownWeather(j, '2026-10-20', { start: '17:11', end: '17:52' }, '中山區'));
});

test('a response for a different town throws', () => {
  assert.throws(() => selectTownWeather(load(), '2026-10-20', { start: '17:11', end: '17:52' }, '大同區'));
});

test('a response without rain probability throws', () => {
  const j = load();
  j.records.Locations[0].Location[0].WeatherElement = [];
  assert.throws(() => selectTownWeather(j, '2026-10-20', { start: '17:11', end: '17:52' }, '中山區'));
});

test('cwaUrl picks the county dataset and encodes the town', () => {
  const u = cwaUrl('臺北市/中山區', '2026-10-20', 'K');
  assert.ok(u.startsWith('https://opendata.cwa.gov.tw/api/v1/rest/datastore/F-D0047-061?'));
  assert.ok(u.includes('LocationName=' + encodeURIComponent('中山區')));
  assert.ok(u.includes('timeFrom=2026-10-20T15%3A00%3A00'));
});
