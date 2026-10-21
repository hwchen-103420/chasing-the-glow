export const TEXT = {
  vetoed: '不建議',
  nodata: '暫無分數',
  weatherRef: '天氣參考',
  noCam: '尚無直播',
  openYoutube: '在 YouTube 開啟',
  nav: 'Google 地圖導航',
  updated: t => `分數更新於 ${t}`,
};

export const STATUS_TEXT = {
  sea: '看得到落日到海平面',
  blocked: '落日會提早落到山稜或建築後',
  afterglow: '只看得到晚霞',
};

export function tierText(item) {
  if (item.vetoed) return TEXT.vetoed;
  if (item.tier === 'nodata') return TEXT.nodata;
  return item.qualityText ?? item.tier;
}

export function stateClasses(item) {
  return [
    `tier-${item.tier}`,
    item.status ? `status-${item.status}` : null,
    item.vetoed ? 'is-vetoed' : null,
    item.favorite ? 'is-favorite' : null,
  ].filter(Boolean);
}

export function glyphSrc(spot) {
  if (spot.vetoed) return 'assets/icons/veto.svg';
  if (spot.tier === 'nodata' || !spot.status) return 'assets/icons/nodata.svg';
  return `assets/icons/status-${spot.status}.svg`;
}
