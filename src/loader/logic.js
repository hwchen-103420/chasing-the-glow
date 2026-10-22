// 載入畫面：純函式（不碰 DOM），可在 Node 測試。
// 固定時間軸（不等資料）：0–4.1s 動畫 0→99%、4.1–4.4s 顯示 100%、4.4–5.0s 淡出 → 5.0s 顯示網站。

export const LOADER = {
  totalMs: 5000,        // 從打開頁面到 app 顯示
  holdMs: 300,          // 100% 停留
  fadeMs: 600,          // 淡出
  storageKey: 'loaderPlayed',

  // SVG 座標（viewBox 0 0 1440 900）
  horizonY: 600,
  sun: { r: 56, from: [600, 150], to: [760, 700] },

  // 80% 之後：橋體打燈漸亮（80→88%）、塔頂紅色航空障礙燈閃爍
  lights: {
    fromPct: 80, fullPct: 88,
    bridgeColor: '#ffdcae',
    beaconColor: '#ff3b30',
    beaconPeriodMs: 1500,   // 每分鐘 40 次（ICAO 中光度 B 型 20–60 次）
    beaconOnMs: 500,
  },

  // 天色關鍵格（Claude Design 定稿）
  keyframes: [
    {p: 0, skyTop: '#8db8df', skyBottom: '#e4eff6', sun: '#fffaf0', water: '#4f7da3', line: '#2a3d52', text: '#fbfcfe'},
    {p: 0.3, skyTop: '#7c9fc9', skyBottom: '#f6d394', sun: '#ffe2a0', water: '#7a6650', line: '#3a3140', text: '#fff4e0'},
    {p: 0.6, skyTop: '#4a5590', skyBottom: '#f08a52', sun: '#ff7a3d', water: '#5e3c4c', line: '#24203a', text: '#ffeede'},
    {p: 0.8, skyTop: '#232c62', skyBottom: '#8a6aa6', sun: '#e2484a', water: '#2f2c5a', line: '#1c1830', text: '#eceaf8'},
    {p: 1, skyTop: '#141b38', skyBottom: '#283158', sun: '#5a2a3a', water: '#141c3a', line: '#8f97c0', text: '#d9dcef'},
  ],
};

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

function easeInOut(x) {
  x = clamp(x, 0, 1);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/**
 * @param {number} elapsed  距離打開頁面的毫秒數（performance.now()）
 * @returns {{phase:'anim'|'hold'|'fade'|'done', pct:number, progress:number, opacity:number}}
 */
export function loaderState(elapsed, { reduced = false, cfg = LOADER } = {}) {
  const animMs = reduced ? 0 : cfg.totalMs - cfg.holdMs - cfg.fadeMs;
  const progress = animMs === 0 ? 1 : easeInOut(elapsed / animMs);
  if (elapsed < animMs) return { phase: 'anim', pct: Math.floor(progress * 99), progress, opacity: 1 };
  const t = elapsed - animMs;
  if (t < cfg.holdMs) return { phase: 'hold', pct: 100, progress, opacity: 1 };
  if (t < cfg.holdMs + cfg.fadeMs) {
    return { phase: 'fade', pct: 100, progress, opacity: 1 - (t - cfg.holdMs) / cfg.fadeMs };
  }
  return { phase: 'done', pct: 100, progress, opacity: 0 };
}

export function mixHex(a, b, t) {
  const pa = [1, 3, 5].map(i => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map(i => parseInt(b.slice(i, i + 2), 16));
  return '#' + pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

/**
 * 橋體打燈與障礙燈亮度（0–1）。
 * bridge 隨進度漸亮；beacon 依經過時間閃爍（不隨進度，所以停在 99% 時仍持續閃）；
 * 減少動態效果時障礙燈恆亮不閃。
 */
export function lightsAt(progress, elapsed, { reduced = false, cfg = LOADER } = {}) {
  const L = cfg.lights;
  const from = L.fromPct / 99, full = L.fullPct / 99;
  const bridge = clamp((progress - from) / (full - from), 0, 1);
  const on = reduced || ((elapsed % L.beaconPeriodMs) + L.beaconPeriodMs) % L.beaconPeriodMs < L.beaconOnMs;
  return { bridge, beacon: bridge > 0 && on ? bridge : 0 };
}

/** 某個進度（0–1）的畫面：各部位顏色與太陽座標 */
export function frameAt(p, cfg = LOADER) {
  p = clamp(p, 0, 1);
  const k = cfg.keyframes;
  let i = 0;
  while (i < k.length - 2 && p > k[i + 1].p) i++;
  const a = k[i], b = k[i + 1];
  const t = (p - a.p) / (b.p - a.p);
  const frame = {};
  for (const key of Object.keys(a)) if (key !== 'p') frame[key] = mixHex(a[key], b[key], t);
  const { from, to } = cfg.sun;
  frame.sunX = from[0] + (to[0] - from[0]) * p;
  frame.sunY = from[1] + (to[1] - from[1]) * p;
  return frame;
}
