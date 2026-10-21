const R_KM = 6371;
const rad = d => (d * Math.PI) / 180;
const deg = r => (r * 180) / Math.PI;

export function destinationPoint(lat, lng, azDeg, km) {
  const d = km / R_KM;
  const θ = rad(azDeg);
  const φ1 = rad(lat);
  const λ1 = rad(lng);
  const φ2 = Math.asin(Math.sin(φ1) * Math.cos(d) + Math.cos(φ1) * Math.sin(d) * Math.cos(θ));
  const λ2 = λ1 + Math.atan2(Math.sin(θ) * Math.sin(d) * Math.cos(φ1), Math.cos(d) - Math.sin(φ1) * Math.sin(φ2));
  return [deg(φ2), deg(λ2)];
}

export function sectorPolygon(lat, lng, [min, max], km, steps = 24) {
  const pts = [[lat, lng]];
  for (let i = 0; i <= steps; i++) pts.push(destinationPoint(lat, lng, min + ((max - min) * i) / steps, km));
  return pts;
}

export function youtubeEmbedUrl(url) {
  let id = null;
  try {
    const u = new URL(url);
    if (u.hostname === 'youtu.be') id = u.pathname.slice(1);
    else if (u.hostname.endsWith('youtube.com')) id = u.searchParams.get('v');
  } catch {
    return null;
  }
  return id && /^[\w-]{6,}$/.test(id) ? `https://www.youtube.com/embed/${id}?autoplay=1&mute=1` : null;
}
