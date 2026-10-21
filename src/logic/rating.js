import { taipeiDate } from './core.js';

// What gets sent to GAS when the user rates a sunset: the rating plus a snapshot of what the site
// showed for that spot, so forecasts and reality can be compared later.
export function buildRatingPayload(spot, { rating, mode, note }, { now, updatedAt = null }) {
  if (!Number.isInteger(rating) || rating < 1 || rating > 10) throw new Error('rating must be 1–10');
  return {
    date: taipeiDate(now),
    spot_id: spot.id,
    spot_name: spot.name,
    rating,
    mode,
    note: (note ?? '').trim(),
    shown: {
      quality: spot.quality ?? null,
      tier: spot.tier,
      status: spot.status ?? null,
      flags: spot.flags ?? [],
      pop: spot.weather?.pop ?? null,
      wx: spot.weather?.wx ?? null,
      updated_at: updatedAt,
    },
  };
}
