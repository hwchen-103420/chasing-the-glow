// 載入畫面驅動：每格依 loaderState / frameAt 更新 #loader SVG，固定 5 秒後移除。
// 時間軸以 performance.now() 為準（從打開頁面起算），模組晚載入也不會拉長總時間。
import { LOADER, loaderState, lightsAt, frameAt } from './logic.js';

function startLoader(doc = document, win = window) {
  const root = doc.getElementById('loader');
  if (!root) return;
  if (doc.documentElement.classList.contains('no-loader')) { root.remove(); return; }

  const reduced = win.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const $ = id => doc.getElementById(id);
  const el = {
    skyTop: $('loader-sky-top'), skyBottom: $('loader-sky-bottom'),
    sun: $('loader-sun'), water: $('loader-water'), refl: $('loader-reflection'),
    lines: $('loader-lines'), pct: $('loader-pct'),
    bridgeLights: $('loader-bridge-lights'), beacon: $('loader-beacon'),
  };
  const H = LOADER.horizonY, R = LOADER.sun.r;
  let lastPct = -1;

  function apply(s, elapsed) {
    const f = frameAt(s.progress);
    const lights = lightsAt(s.progress, elapsed, { reduced });
    el.bridgeLights.setAttribute('opacity', lights.bridge.toFixed(3));
    el.beacon.setAttribute('opacity', lights.beacon.toFixed(3));
    el.skyTop.setAttribute('stop-color', f.skyTop);
    el.skyBottom.setAttribute('stop-color', f.skyBottom);
    el.sun.setAttribute('cx', f.sunX);
    el.sun.setAttribute('cy', f.sunY);
    el.sun.setAttribute('fill', f.sun);
    el.water.setAttribute('fill', f.water);
    el.lines.setAttribute('stroke', f.line);
    el.refl.setAttribute('stroke', f.sun);
    el.refl.setAttribute('transform', `translate(${f.sunX - LOADER.sun.from[0]} 0)`);
    // 太陽沉入水平線時倒影跟著消失
    el.refl.setAttribute('opacity', (0.6 * Math.min(1, Math.max(0, (H - (f.sunY - R)) / (2 * R)))).toFixed(3));
    el.pct.setAttribute('fill', f.text);
    if (s.pct !== lastPct) {
      el.pct.textContent = `${s.pct}%`;
      root.setAttribute('aria-valuenow', s.pct);
      lastPct = s.pct;
    }
    root.style.opacity = s.opacity;
  }

  // 預覽用：?still=0.3 停在指定進度（不淡出、不移除），供截關鍵格
  const still = new URLSearchParams(win.location.search).get('still');
  if (still != null) {
    const p = Math.min(1, Math.max(0, Number(still)));
    apply({ progress: p, pct: p >= 1 ? 100 : Math.floor(p * 99), opacity: 1 }, 0);
    return;
  }

  function tick() {
    const now = win.performance.now();
    const s = loaderState(now, { reduced });
    apply(s, now);
    if (s.phase === 'done') {
      try { win.sessionStorage.setItem(LOADER.storageKey, '1'); } catch {}
      root.remove();
      return;
    }
    win.requestAnimationFrame(tick);
  }
  win.requestAnimationFrame(tick);
}

startLoader();
