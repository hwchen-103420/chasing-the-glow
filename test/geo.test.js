import { test } from 'node:test';
import assert from 'node:assert/strict';
import { destinationPoint, sectorPolygon, youtubeEmbedUrl } from '../src/ui/geo.js';

test('destinationPoint moves west along azimuth 270', () => {
  const [lat, lng] = destinationPoint(25, 121.5, 270, 3);
  assert.ok(Math.abs(lat - 25) < 0.001);
  assert.ok(lng < 121.5 && lng > 121.46);
});

test('sectorPolygon starts at the centre and spans the arc', () => {
  const p = sectorPolygon(25, 121.5, [240, 300], 2, 6);
  assert.equal(p.length, 8);
  assert.deepEqual(p[0], [25, 121.5]);
  const first = destinationPoint(25, 121.5, 240, 2);
  const last = destinationPoint(25, 121.5, 300, 2);
  assert.deepEqual(p[1], first);
  assert.deepEqual(p[7], last);
});

test('youtubeEmbedUrl handles watch and short links', () => {
  assert.equal(youtubeEmbedUrl('https://www.youtube.com/watch?v=34h_Cy_n0Ok'),
    'https://www.youtube.com/embed/34h_Cy_n0Ok?autoplay=1&mute=1');
  assert.equal(youtubeEmbedUrl('https://youtu.be/abcDEF12345'),
    'https://www.youtube.com/embed/abcDEF12345?autoplay=1&mute=1');
  assert.equal(youtubeEmbedUrl('https://www.youtube.com/live/34h_Cy_n0Ok?si=abc'),
    'https://www.youtube.com/embed/34h_Cy_n0Ok?autoplay=1&mute=1');
  assert.equal(youtubeEmbedUrl('https://www.youtube.com/embed/34h_Cy_n0Ok'),
    'https://www.youtube.com/embed/34h_Cy_n0Ok?autoplay=1&mute=1');
  assert.equal(youtubeEmbedUrl('not a url'), null);
});
