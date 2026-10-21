# 觀夕平台：Claude Design 設計需求書

請依本文件設計「觀夕平台」電腦版（1440×900 為主）的介面。網站用途：打開一頁就能判斷今天值不值得去看夕陽、去哪個點、何時最好看。使用者是自己和家人，下午在電腦前決定傍晚要不要出門。

**重要：** 所有圖示請自行繪製成 SVG，**不要使用 emoji**。交接時請**保留本文件「DOM 契約」中所有 id、class、data-field 與圖示檔名**，程式靠這些名稱接上資料。

## 1. 版面

```
┌──────────────────────────────┬────────────────────────┐
│                              │ 今日概況（#regions）      │
│   北部地圖（#map，約 65% 寬）   │ 3 張區域卡片並排           │
│   Leaflet＋淡色極簡底圖         ├────────────────────────┤
│   景點圖釘、日落方向短線、       │ 常造訪的景點（#favorites） │
│   可見範圍淡色扇形               │ 3 個方塊                 │
└──────────────────────────────┴────────────────────────┘
#banner：頁面上方的提示橫幅（平常隱藏）
#updated：頁尾「資料更新於 HH:MM」與資料來源
#detail：點擊景點後的詳情卡浮層
```

地圖由程式以 Leaflet 繪製（底圖 CARTO light_all）。你需要設計的是：圖釘、日落方向線與扇形的顏色、區域卡片、常造訪景點方塊、滑過小卡片、詳情卡、橫幅與頁尾。

## 2. 視覺規則

**分數等級色**（圖釘底色、小卡片與方塊底色）：

| 等級 | class | 色彩方向 |
|---|---|---|
| Poor（0–20%） | `tier-poor` | 冷灰藍 |
| Fair（20–40%） | `tier-fair` | 淡琥珀 |
| Good（40–60%） | `tier-good` | 橘色 |
| Great（60% 以上） | `tier-great` | 深橘紅，加外發光，一眼可辨 |
| 無資料 | `tier-nodata` | 灰色外框、空心 |
| 不建議（降雨 ≥ 50%） | `is-vetoed` | 灰色＋雨滴圖示，蓋過等級色 |

**景點狀態圖案**（圖釘中央的圖示）：

| 狀態 | class | 圖案方向 | 文字 |
|---|---|---|---|
| sea | `status-sea` | 太陽碰到水平線 | 看得到落日到海平面 |
| blocked | `status-blocked` | 太陽一半在山稜後 | 落日會提早落到山稜或建築後 |
| afterglow | `status-afterglow` | 只有彩霞、沒有太陽 | 只看得到晚霞 |

原則：
- 顏色與圖案都要能單獨辨識；小卡片上一律寫出文字等級。
- 常造訪的景點：圖釘加小標記（`is-favorite`，圖示 `favorite.svg`），不加名次。
- 選取中的圖釘：`is-selected`。

## 3. 互動

| 動作 | 結果 |
|---|---|
| 滑過圖釘 | 顯示小卡片（`tpl-tooltip`），底色為等級色 |
| 點擊圖釘 | 開啟詳情卡（`tpl-detail`）並播放直播 |
| 滑過常造訪方塊 | 方塊放大，顯示小卡片內容 |
| 點擊常造訪方塊 | 開啟詳情卡，地圖同步選取 |
| 關閉詳情卡 | 停止直播 |

同時只播放一個直播（16:9 YouTube 嵌入）。

## 4. DOM 契約

**容器 id：** `#map`、`#regions`、`#favorites`、`#detail`、`#banner`、`#updated`

**模板**（`<template>`，欄位以 `data-field` 標記；程式只填文字或屬性，不改結構）：

| 模板 id | data-field |
|---|---|
| `tpl-region-card` | `name, tier-text, quality, wx, temp, pop, window, flags` |
| `tpl-tooltip` | `name, tier-text, quality, status-text, wx, temp, pop, flags` |
| `tpl-favorite-card` | 同 `tpl-tooltip` |
| `tpl-detail` | `tpl-tooltip` 全部欄位＋`window, cam, cam-label, cam-switch, cam-open, nav, close` |

- `flags`：程式會放入多個 `<li>`，請把它設計成清單。
- `cam`：程式放入 iframe 或「尚無直播」文字。
- `cam-label`：鏡頭非朝西時顯示「天氣參考」。
- `cam-switch`：有兩支以上直播時顯示的切換按鈕。
- `cam-open`：連結文字「在 YouTube 開啟」。
- `nav`：按鈕文字「Google 地圖導航」。

**圖釘結構：**
```html
<div class="pin tier-fair status-sea is-favorite">
  <img class="pin-glyph" src="assets/icons/status-sea.svg" alt="">
</div>
```

**圖示檔名（放在 `assets/icons/`）：** `status-sea.svg`、`status-blocked.svg`、`status-afterglow.svg`、`veto.svg`、`nodata.svg`、`favorite.svg`

**文字：** 不建議、暫無分數、天氣參考、尚無直播、在 YouTube 開啟、Google 地圖導航、無法取得資料、資料不是今天的、資料更新於 HH:MM

## 5. 示意資料（2026-10-20 實測）

區域：

| 區域 | 等級 | 分數 | 天氣 | 降雨 | 最佳時段 | 提示 |
|---|---|---|---|---|---|---|
| 淡水河口 | Fair | 37% | 晴 29°C | 10% | 17:11–17:53 | 晴空無雲，天空顏色會比較單調 |
| 台北盆地 | Fair | 36% | 晴 31°C | 0% | 17:11–17:52 | 晴空無雲，天空顏色會比較單調 |
| 桃園海岸 | Fair | 36% | 晴 29°C | 0% | 17:12–17:54 | 晴空無雲，天空顏色會比較單調 |

景點（9 個，皆為 Fair）：漁人碼頭、許厝港觀景台、大屯山觀景台（status-sea）；淡水金色水岸、大稻埕碼頭、內湖碧山巖、軍艦岩、劍潭山微風平台、象山（status-blocked）。常造訪：大稻埕碼頭、淡水金色水岸、大屯山觀景台。大屯山另有提示「山頂視野可能受雲層干擾」。

請另外做幾個狀態的示意：一個 Great 圖釘、一個不建議（is-vetoed）圖釘、一個無資料圖釘、「資料不是今天的」橫幅。

## 6. 交接

匯出 HTML 交接包，內含：`index.html`（版面與上述 `<template>`）、樣式檔、`assets/icons/` 下 6 個 SVG。不需要寫任何 JavaScript。
