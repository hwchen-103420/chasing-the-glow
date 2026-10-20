# 觀夕平台 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 一頁式電腦版網站：地圖上的景點圖釘、三個區域卡片與常造訪景點，告訴使用者今天值不值得去看夕陽、去哪、何時最好看。

**Architecture:** 靜態網頁（GitHub Pages）負責所有判斷與畫面；判斷邏輯是純 ES module，用 `node --test` 測試。Google Apps Script 只負責抓資料（Sunsethue、氣象署、METAR／TAF）、快取、以 `doGet` 回傳 JSON；GAS 檔案用 CommonJS 匯出守衛，讓同一份檔案能在 Node 測試。

**Tech Stack:** 原生 JavaScript（ES2022 modules）、Leaflet 1.9.4（unpkg）、CARTO light_all 底圖、Google Apps Script（V8）、Node 20+ 內建測試、Playwright（已安裝的 Chromium）做煙霧測試。

**Spec:** `docs/superpowers/specs/2026-10-20-sunset-platform-design.md`（含 §編號）；資料 `data/spots.json`。

## Global Constraints

- 時區一律 Asia/Taipei（UTC+8，無日光節約）；畫面時間格式 `HH:MM`。
- 分數等級：`<0.20` Poor、`<0.40` Fair、`<0.60` Good、`≥0.60` Great；分數只用 Sunsethue 原值，不混合計算。
- 否決：鄉鎮 `pop >= 50` → 不建議。`pop` 為 null 時不否決。
- 提示標記文字逐字使用 spec §4.5 與 Task 4 的 `FLAG` 常數。
- 圖示不用 emoji；所有狀態用文字＋CSS class 表示，最終圖示由 Claude Design 提供。
- 金鑰只存在 GAS 指令碼屬性（`SUNSETHUE_KEY`、`CWA_KEY`），不得出現在 repo 任何檔案。
- 新增景點、直播、常造訪景點只改 `data/spots.json`，程式不得寫死景點 id 或網格。
- 同一時間最多播放一個直播。
- Sunsethue 認證：header `x-api-key`。METAR／TAF：`https://aviationweather.gov/api/data/metar?ids=RCSS,RCTP&format=json&taf=true`。

## Review Focus

1. **夏季最佳時段跨過 18:00**（例 18:35–19:20 跨氣象署 15–18／18–21 兩段）→ `pop` 取兩段最大值、`wx` 取開始時間所在段。測試在 Task 6。
2. **TAF 時間跨日與 `24` 時**（`2018/2024`、`2022/2024`、`2000/2106`）→ `24` 視為隔日 00Z、跨月日期正確。測試在 Task 3。
3. **METAR 沒有雲層或特殊能見度**（`clouds: []`、`visib: "6+"`、`visib: 3`、缺欄位）→ 不當掉、不產生雲層類標記。測試在 Task 3、4。
4. **資料不是今天的／09:00 前還沒有今天的資料**→ 顯示「資料不是今天的」橫幅，圖釘用 nodata 樣式，不套用否決。測試在 Task 5。
5. **某網格查不到、`favorites` 含不存在的 id、景點沒有直播**→ 該區 nodata、略過該 id 並 `console.warn`、詳情顯示「尚無直播」。測試在 Task 5、8。

---

## File Structure

```
package.json                    # "type":"module", scripts: test, validate
scripts/validate-spots.mjs      # spots.json 防呆檢查（CLI）
src/config.js                   # 門檻值、GAS 網址、文字常數
src/logic/core.js               # 等級、否決、方位、狀態、最佳時段、時間工具
src/logic/aviation.js           # METAR 正規化、TAF 解析、時段重疊
src/logic/flags.js              # 提示標記
src/logic/model.js              # buildViewModel：API＋spots → 畫面資料
src/ui/geo.js                   # 方位箭頭、扇形、YouTube 嵌入網址
src/ui/map.js                   # Leaflet 地圖與圖釘
src/ui/panel.js                 # 區域卡片、常造訪景點、小卡片、詳情卡
src/app.js                      # 啟動、抓資料、錯誤橫幅
index.html, styles.css          # 依 DOM 契約；Task 9 換成 Claude Design 版本
assets/icons/                   # Claude Design 提供的 SVG
gas/package.json                # {"type":"commonjs"}
gas/appsscript.json             # timeZone Asia/Taipei, V8
gas/time.js gas/sunsethue.js gas/cwa.js gas/Code.js
docs/claude-design-brief.md     # 給 Claude Design 的設計需求與 DOM 契約
test/*.test.js, test/gas/*.test.cjs, test/e2e/smoke.mjs
test/fixtures/                  # 2026-10-20 實測回應（已存在）
```

---

### Task 1: 專案骨架與 spots.json 檢查

**Files:**
- Create: `package.json`, `scripts/validate-spots.mjs`, `test/validate-spots.test.js`

**Interfaces:**
- Produces: `validateSpots(data: object) -> string[]`（錯誤訊息陣列，空陣列＝通過）；`gridOf(lat, lng) -> "25,121.25"` 格式字串（無條件捨去到 0.25°，整數部分不補 `.0`，例 `"25,121"`）。兩者皆 export。

- [ ] **Step 1: 寫失敗測試** `test/validate-spots.test.js`
  - `gridOf(25.1689, 121.4415) === "25,121.25"`、`gridOf(25.0565, 121.5075) === "25,121.5"`、`gridOf(25.0881, 121.1757) === "25,121"`
  - 讀入 `data/spots.json` → `validateSpots(data)` 為 `[]`
  - 複製後刪掉一個景點的 `view_az_range` → 錯誤含該景點 id
  - `ref_cams` 放不存在的 cam id → 錯誤含該 cam id
  - `favorites` 放不存在的 id → 錯誤含該 id
  - 把某景點 `sunsethue_grid` 改成 `"25,121.75"` → 錯誤（與 `gridOf` 不符）
  - 某景點的網格在 `regions` 找不到 → 錯誤
- [ ] **Step 2:** `node --test test/validate-spots.test.js` → FAIL（module not found）
- [ ] **Step 3: 實作** `scripts/validate-spots.mjs`：export 兩個函式；直接執行時讀 `data/spots.json`，有錯就逐行印出並 `process.exit(1)`，否則印 `spots.json OK (N spots, M cams)`。
  `regions[]` 必填：`grid, name, cwa_town, metar_overhead(RCSS|RCTP)`。
  景點必填欄位：`id, name, lat, lng, view_az_range([min,max] 且 0≤min<max≤360), horizon_block(sea|ridge|buildings), sunsethue_grid, cwa_town("縣市/鄉鎮"), metar_overhead(RCSS|RCTP), ref_cams(陣列), nav_url`；`summit_cloud_ft` 可為 null 或正數。
  `package.json`：`{"type":"module","scripts":{"test":"node --test test/","validate":"node scripts/validate-spots.mjs"}}`
- [ ] **Step 4:** `npm test` → PASS；`npm run validate` → `spots.json OK (9 spots, 9 cams)`
- [ ] **Step 5:** commit `feat: spots.json validator`

---

### Task 2: 核心判斷（等級、否決、狀態、最佳時段）

**Files:**
- Create: `src/config.js`, `src/logic/core.js`, `test/core.test.js`

**Interfaces:**
- Produces（`src/config.js`）：
  ```js
  export const CONFIG = {
    gasUrl: '',                      // Task 10 填入
    tierBounds: [0.20, 0.40, 0.60],
    vetoPop: 50,
    lowCloudFt: 3000, highCloudFt: 8000,
    hazeVisKm: 5, hazeSpreadC: 2,
    metarMaxAgeMin: 90,
    clearSkyCloudCover: 0.10,
    summitMetarFromHour: 15,         // 台灣時間
    tafEveningUtcHours: [9, 10],     // 17–18L
  };
  ```
- Produces（`src/logic/core.js`）：
  - `qualityTier(q: number|null|undefined) -> 'poor'|'fair'|'good'|'great'|'nodata'`
  - `isVetoed(pop: number|null) -> boolean`
  - `inAzRange(az: number, range: [number, number]) -> boolean`（含端點）
  - `spotStatus(sunAz: number, spot) -> 'sea'|'blocked'|'afterglow'`（spec §4.3）
  - `bestWindow(region) -> {start:'HH:MM', end:'HH:MM'}|null`（`golden_hour[0]`→`blue_hour[1]`；缺任一回 null）
  - `taipeiDate(d: Date) -> 'YYYY-MM-DD'`、`taipeiHour(d: Date) -> number`
  - `hhmmToDate(dateStr: 'YYYY-MM-DD', hhmm: 'HH:MM') -> Date`（台灣時間轉 Date）

- [ ] **Step 1: 寫失敗測試** `test/core.test.js`
  - `qualityTier`: 0.19→poor、0.20→fair、0.39→fair、0.40→good、0.59→good、0.60→great、null→nodata
  - `isVetoed`: 49→false、50→true、null→false
  - `inAzRange(240,[240,300])`、`(300,[240,300])` → true；`(239.9,[240,300])` → false
  - `spotStatus(259.3, {view_az_range:[230,310], horizon_block:'sea'})` → `'sea'`；同方位 `ridge` → `'blocked'`；`spotStatus(290, {view_az_range:[200,280], ...})` → `'afterglow'`
  - `bestWindow({golden_hour:['17:11','17:37'], blue_hour:['17:42','17:52']})` → `{start:'17:11', end:'17:52'}`；缺 `blue_hour` → null
  - `taipeiDate(new Date('2026-10-20T16:30:00Z'))` → `'2026-10-21'`；`taipeiHour` 同一時間 → 0
  - `hhmmToDate('2026-10-20','17:11').toISOString()` → `'2026-10-20T09:11:00.000Z'`
- [ ] **Step 2:** `node --test test/core.test.js` → FAIL
- [ ] **Step 3:** 實作上述函式（固定 +8 小時換算，不依賴執行環境時區）
- [ ] **Step 4:** `node --test test/core.test.js` → PASS
- [ ] **Step 5:** commit `feat: core sunset judgment logic`

---

### Task 3: METAR 正規化與 TAF 解析

**Files:**
- Create: `src/logic/aviation.js`, `test/aviation.test.js`

**Interfaces:**
- Consumes: fixture `test/fixtures/metar-2026-10-20T0300Z.json`（aviationweather JSON 陣列；`obsTime` 為 epoch 秒，`visib` 可能是字串 `"6+"` 或數字英里，`clouds` 為 `[{cover, base}]`）
- Produces:
  - `normalizeMetar(m) -> {station, obsTime: Date, visibKm: number|null, temp, dewp, clouds: [{cover, baseFt}], raw, rawTaf}`；`"6+"`→10；數字→`×1.609` 取一位小數；缺 `clouds`→`[]`
  - `isMetarFresh(metar, now: Date, maxAgeMin: number) -> boolean`
  - `parseTaf(raw: string, now: Date = new Date()) -> TafGroup[]`，`TafGroup = {type:'BASE'|'FM'|'BECMG'|'TEMPO'|'PROB', from: Date, to: Date, clouds:[{cover, baseFt}], wx: string[]}`
  - `groupsOverlapping(groups: TafGroup[], from: Date, to: Date) -> TafGroup[]`（`g.from < to && g.to > from`）

TAF 解析規則（實作者需要的決定）：
- 標頭 `TAF ICAO ddhhmmZ ddhh/ddhh`；年月取自 `now`；任何 `dd` 小於發布日時視為下個月。
- `hh` 為 `24` 時換成隔日 `00`。
- 分段標記：`FM ddhhmm`（到下一個 FM 或 TAF 結束）、`BECMG ddhh/ddhh`、`TEMPO ddhh/ddhh`、`PROB30|PROB40 [TEMPO] ddhh/ddhh`（型別記 `PROB`）；第一段之前為 `BASE`，期間為整份 TAF 有效期。
- 雲：`(FEW|SCT|BKN|OVC)(\d{3})` → `baseFt = n*100`；`NSC`、`SKC`、`CAVOK` → 無雲。
- 天氣：含 `RA|SHRA|TS|DZ` 的 token（可帶 `-`/`+`/`VC`）收進 `wx`。

- [ ] **Step 1: 寫失敗測試** `test/aviation.test.js`（`now = new Date('2026-10-20T03:10:00Z')`）
  - fixture RCSS → `visibKm === 10`、`clouds` 為 `[{cover:'FEW',baseFt:2000},{cover:'SCT',baseFt:3500}]`、`obsTime.toISOString() === '2026-10-20T03:00:00.000Z'`
  - `normalizeMetar({...rcss, visib: 3})` → `visibKm === 4.8`；`clouds` 缺 → `[]`
  - `isMetarFresh(rcss, now, 90)` → true；`now` 加 2 小時 → false
  - `parseTaf(RCSS rawTaf, now)`：BASE `2026-10-20T00Z → 2026-10-21T00Z`、`clouds[0].baseFt === 1500`；最後一段 TEMPO `from 2026-10-20T18Z`、`to 2026-10-21T00Z`
  - RCTP rawTaf：`BECMG 2010/2012` → `from 10Z to 12Z`；BASE `to === 2026-10-21T06Z`
  - `parseTaf('TAF RCTP 302300Z 3100/0106 ...', new Date('2026-10-30T23:10Z'))` → BASE `from 2026-10-31T00Z`、`to 2026-11-01T06Z`
  - `parseTaf('TAF RCSS 200500Z 2006/2106 25008KT 9999 BKN025 TEMPO 2009/2012 -SHRA BKN012', now)` → TEMPO `wx` 含 `'-SHRA'`、`clouds[0].baseFt === 1200`
  - `CAVOK` 段 → `clouds === []`
  - `groupsOverlapping(groups, 09:11Z, 09:52Z)` 只回傳時間重疊的段
- [ ] **Step 2:** `node --test test/aviation.test.js` → FAIL
- [ ] **Step 3:** 實作 `src/logic/aviation.js`
- [ ] **Step 4:** `node --test test/aviation.test.js` → PASS
- [ ] **Step 5:** commit `feat: METAR normalize and TAF parser`

---

### Task 4: 提示標記

**Files:**
- Create: `src/logic/flags.js`, `test/flags.test.js`

**Interfaces:**
- Consumes: Task 2 `CONFIG`、`hhmmToDate`、`taipeiHour`；Task 3 `TafGroup`、`groupsOverlapping`、`isMetarFresh`
- Produces:
  ```js
  export const FLAG = {
    WEST_LOW:  '西方低雲多，落日可能被擋',
    TAF_WORSE: '傍晚預報轉差',
    HAZE:      '水氣重或有霾，顏色可能混濁',
    HIGH_CLOUD:'有中高雲，有機會火燒雲',
    CLEAR:     '晴空無雲，天空顏色會比較單調',
    SUMMIT:    '山頂視野可能受雲層干擾',
  };
  ```
  - `westFlags({rctp, rctpTaf, date, now}) -> string[]`：WEST_LOW（RCTP 新鮮且任一層 BKN/OVC `baseFt < lowCloudFt`）；TAF_WORSE（`date` 當天 `tafEveningUtcHours` 區間重疊的 RCTP TAF 段，有 BKN/OVC `< lowCloudFt` 或 `wx` 非空）
  - `overheadFlags({metar, westLow: boolean, now}) -> string[]`：HAZE（新鮮且 `visibKm < hazeVisKm` 或 `temp - dewp <= hazeSpreadC`）；HIGH_CLOUD（新鮮、`!westLow`、有 SCT/BKN 且 `baseFt >= highCloudFt`）
  - `clearSkyFlags(region) -> string[]`：`cloud_cover < clearSkyCloudCover` → CLEAR
  - `summitFlags({spot, rcssTaf, rcss, window:{from: Date, to: Date}, now}) -> string[]`（spec §4.5 虛擬碼；`spot.summit_cloud_ft == null` → `[]`；METAR 只在 `taipeiHour(now) >= summitMetarFromHour` 且新鮮時納入；FEW 以上都算）

- [ ] **Step 1: 寫失敗測試** `test/flags.test.js`（用手工 metar 物件與 `parseTaf` 結果）
  - RCTP `BKN025` → WEST_LOW；`BKN030` → 不觸發；`SCT020` → 不觸發；過期（obsTime 早 2 小時）→ 不觸發
  - RCTP TAF `TEMPO 2009/2012 -SHRA` → TAF_WORSE；`TEMPO 2012/2015 BKN010` → 不觸發（不重疊 09–10Z）
  - 能見度 4.8 → HAZE；`temp 29, dewp 27` → HAZE；`29/26` → 不觸發
  - `SCT080` 且 `westLow=false` → HIGH_CLOUD；`westLow=true` → 不觸發；`SCT070` → 不觸發
  - `cloud_cover 0` → CLEAR；`0.10` → 不觸發
  - 大屯山（`summit_cloud_ft 4000`）：TAF 時段內 `FEW039` → SUMMIT；`FEW040` → 不觸發；TAF 段不重疊 window → 不觸發
  - 14:59 時 METAR `FEW030`、TAF 無低雲 → 不觸發；15:00 → SUMMIT；METAR 過期 → 不觸發
  - `summit_cloud_ft: null` 的景點 → `[]`
- [ ] **Step 2:** `node --test test/flags.test.js` → FAIL
- [ ] **Step 3:** 實作 `src/logic/flags.js`
- [ ] **Step 4:** `node --test test/flags.test.js` → PASS
- [ ] **Step 5:** commit `feat: rule-based hint flags`

---

### Task 5: 畫面資料模型

**Files:**
- Create: `src/logic/model.js`, `test/model.test.js`, `test/fixtures/api-2026-10-20.json`（依 spec §3 格式手寫：3 個 regions 用 Sunsethue 實測值、3 個 towns、`metar` 為 fixture 原樣的 `{RCSS: {...}, RCTP: {...}}`）

**Interfaces:**
- Consumes: Tasks 2–4
- Produces: `buildViewModel(spotsData, api: object|null, now: Date) -> ViewModel`
  ```
  ViewModel = {
    banners: string[],            // '無法取得資料' | '資料不是今天的'
    updatedAt: string|null,       // 'HH:MM'
    regions: RegionVM[],          // 依 spotsData.regions 順序
    spots: SpotVM[],              // 依 spotsData.spots 順序
    favorites: SpotVM[],          // 依 spotsData.favorites，略過不存在 id（console.warn）
  }
  RegionVM = { grid, name, tier, quality, qualityText, window, weather, vetoed, flags }
  SpotVM   = { ...spot, tier, status, vetoed, window, weather, flags, cams: Cam[], favorite }
  weather  = { wx, temp, pop } | null
  ```
  規則：
  - `api` 為 null → banner `無法取得資料`；所有 tier = `nodata`、status 用 `spotStatus` 無法算時為 null、flags `[]`。
  - `api.date !== taipeiDate(now)` → banner `資料不是今天的`，regions 視為不存在（nodata、不否決、無 flags），weather 仍顯示。
  - 景點 flags 順序：`westFlags` → `overheadFlags`（依 `spot.metar_overhead`）→ `clearSkyFlags`（依網格）→ `summitFlags`；區域 flags 用 `westFlags` → `overheadFlags`（依 `region.metar_overhead`）→ `clearSkyFlags`。
  - `api.regions[grid].date !== taipeiDate(now)` 的網格視同不存在（nodata）。
  - `weather` 為 null 時 flags 末尾加 `降雨資料暫缺`，不否決。
  - `cams` 依 `ref_cams` 順序展開成 cam 物件。

- [ ] **Step 1: 寫失敗測試** `test/model.test.js`（`now = 2026-10-20T07:00:00Z`）
  - fixture → 9 個 spots；漁人碼頭 `tier 'fair'`、`status 'sea'`；大稻埕 `status 'blocked'`；`window {start:'17:11', end:'17:52'}`
  - `favorites.map(s=>s.id)` → `['dadaocheng-wharf','tamsui-golden-waterfront','datunshan-lookout']`
  - favorites 加入 `'nope'` → 結果不含、`console.warn` 被呼叫一次
  - 把 `towns['臺北市/大同區'].pop` 設 50 → 大稻埕 `vetoed true`，大屯山 `false`
  - `api=null` → banner 含 `無法取得資料`，所有 tier `nodata`
  - `api.date='2026-10-19'` → banner 含 `資料不是今天的`、tier `nodata`、`vetoed false`
  - 移除 `regions['25,121']` → 許厝港 `tier 'nodata'`，其他不受影響
  - `regions['25,121'].date = '2026-10-19'`（其餘為今天）→ 許厝港 `tier 'nodata'`，其他不受影響
  - 許厝港沒有 town 資料 → `weather null`、flags 含 `降雨資料暫缺`
- [ ] **Step 2:** `node --test test/model.test.js` → FAIL
- [ ] **Step 3:** 實作 `src/logic/model.js`
- [ ] **Step 4:** `npm test` → 全部 PASS
- [ ] **Step 5:** commit `feat: view model`

---

### Task 6: GAS 抓取、快取與 JSON 端點

**Files:**
- Create: `gas/package.json`、`gas/appsscript.json`、`gas/time.js`、`gas/sunsethue.js`、`gas/cwa.js`、`gas/Code.js`、`test/gas/sunsethue.test.cjs`、`test/gas/cwa.test.cjs`
- Modify: `package.json` 的 test script 改為 `node --test test/ test/gas/`

**Interfaces:**
- 每個 gas 檔尾端：`if (typeof module !== 'undefined') module.exports = { ... };`（GAS 執行時無 `module`，Node 測試時可 require）
- Produces:
  - `gas/time.js`: `toTaipeiHHMM(iso: string) -> 'HH:MM'`、`taipeiDateStr(d: Date) -> 'YYYY-MM-DD'`
  - `gas/sunsethue.js`: `sunsethueUrl(lat, lng, date) -> string`；`parseSunsethue(json, date) -> {date, quality_text, cloud_cover, sunset, direction, golden_hour:[HH:MM,HH:MM], blue_hour:[HH:MM,HH:MM]}`
  - `gas/cwa.js`: `CWA_DATASETS = {'臺北市':'F-D0047-061','新北市':'F-D0047-069','桃園市':'F-D0047-005'}`；`cwaUrl(town: '縣市/鄉鎮', date, key) -> string`（`LocationName`、`timeFrom=${date}T15:00:00`、`timeTo=${date}T21:00:00`、URL 編碼）；`selectTownWeather(json, date, window:{start,end}) -> {wx, temp, pop}`（spec §3 選取規則）
  - `gas/Code.js`（只在 GAS 執行，不測）：
    - 指令碼屬性：`SUNSETHUE_KEY`、`CWA_KEY`、`SPOTS_URL`（GitHub Pages 上 `data/spots.json` 的網址）
    - `refreshDaily()`：讀 `SPOTS_URL` → 對每個 `regions[].grid` 以該格任一景點座標呼叫 Sunsethue（`UrlFetchApp`，header `x-api-key`，`muteHttpExceptions`）→ 對所有不重複的 `cwa_town`（spots 與 regions）呼叫氣象署，window 用該鄉鎮所屬網格的 `bestWindow`（無資料時用 `{start:'17:00',end:'18:00'}`）→ 將 `{date, updated_at, regions, towns, errors}` 存入指令碼屬性 `DAILY`；單一來源失敗時保留 `DAILY` 中該 key 的舊值，並在 `errors` 加上來源名稱
    - `fetchAviation_()`：抓 METAR/TAF，`CacheService.getScriptCache()` 存 600 秒，回傳 `{RCSS: obj, RCTP: obj}`
    - `doGet()`：回傳 `ContentService` JSON = `DAILY` ＋ `metar: fetchAviation_()`；aviation 失敗時 `metar: {}` 並在 `errors` 加 `aviation`
    - `installTriggers()`：刪除舊的 `refreshDaily` 觸發器，建立每日 9、12、15 時三個
  - `gas/appsscript.json`：`{"timeZone":"Asia/Taipei","runtimeVersion":"V8","exceptionLogging":"STACKDRIVER","webapp":{"executeAs":"USER_DEPLOYING","access":"ANYONE_ANONYMOUS"}}`

- [ ] **Step 1: 寫失敗測試**
  - `sunsethue.test.cjs`：`parseSunsethue(fixture, '2026-10-20')` → `date '2026-10-20'`、`sunset '17:23'`、`direction 259.3`、`golden_hour ['17:11','17:37']`、`blue_hour ['17:42','17:52']`、`quality 0.36`、`quality_text 'Fair'`；`sunsethueUrl(25.0841,121.5285,'2026-10-20')` 含 `latitude=25.0841&longitude=121.5285&date=2026-10-20&type=sunset`
  - `cwa.test.cjs`：fixture（中山區）、window `17:11–17:52` → `{wx:'晴', temp:31, pop:0}`；把 fixture 18–21 段 pop 改 60、window `17:40–18:20` → `{wx:'晴', temp:31, pop:60}`（temp 取 17 時整點值）；`cwaUrl('臺北市/中山區','2026-10-20','K')` 以 `/F-D0047-061?` 開頭並含編碼後的 `LocationName`
- [ ] **Step 2:** `node --test test/gas/` → FAIL
- [ ] **Step 3:** 實作 `time.js`、`sunsethue.js`、`cwa.js`，再寫 `Code.js`
- [ ] **Step 4:** `npm test` → 全部 PASS
- [ ] **Step 5:** commit `feat: GAS data fetcher and JSON endpoint`

---

### Task 7: Claude Design 設計需求書（人工檢查點）

**Files:**
- Create: `docs/claude-design-brief.md`

**Interfaces:**
- Produces: DOM 契約（Task 8、9 依此實作）
  - 版面容器 id：`#map`（左，約 65%）、`#regions`、`#favorites`、`#detail`（詳情卡浮層）、`#banner`、`#updated`
  - `<template>` id 與欄位（以 `data-field` 標記）：
    - `tpl-region-card`：`name, tier-text, quality, wx, temp, pop, window, flags`
    - `tpl-tooltip`：`name, tier-text, quality, status-text, wx, temp, pop, flags`
    - `tpl-favorite-card`：同 `tpl-tooltip`
    - `tpl-detail`：`tpl-tooltip` 欄位＋`window, cam, cam-label, cam-switch, cam-open, nav, close`
  - 狀態 class：`tier-poor|tier-fair|tier-good|tier-great|tier-nodata`、`is-vetoed`、`is-favorite`、`is-selected`、`status-sea|status-blocked|status-afterglow`
  - 圖釘：`<div class="pin tier-* status-* [is-vetoed] [is-favorite]">`，內含 `<img class="pin-glyph">`
  - 圖示檔名：`assets/icons/status-sea.svg`、`status-blocked.svg`、`status-afterglow.svg`、`veto.svg`、`nodata.svg`、`favorite.svg`
  - 文字：狀態 `看得到落日到海平面`／`落日會提早落到山稜或建築後`／`只看得到晚霞`；否決 `不建議`；無資料 `暫無分數`；直播非朝西 `天氣參考`；無直播 `尚無直播`；導航按鈕 `Google 地圖導航`
- 內容另含：spec §5、§6 的版面與視覺規則、9 個景點與今天的實測資料當示意內容、「不要 emoji」、「交接時保留上述 id、class、data-field 與檔名」。

- [ ] **Step 1:** 撰寫 `docs/claude-design-brief.md`
- [ ] **Step 2:** commit `docs: Claude Design brief`
- [ ] **Step 3（使用者）:** 在 Claude Design 依需求書製作，匯出 HTML 交接包放到 `design/handoff/`。Task 8 不需要等這一步。

---

### Task 8: 前端（功能版，依 DOM 契約）

**Files:**
- Create: `src/ui/geo.js`、`src/ui/map.js`、`src/ui/panel.js`、`src/app.js`、`index.html`、`styles.css`（暫用簡單色塊）、`test/geo.test.js`、`test/e2e/smoke.mjs`

**Interfaces:**
- Consumes: Task 5 `buildViewModel`、Task 7 DOM 契約、`CONFIG.gasUrl`
- Produces:
  - `src/ui/geo.js`: `destinationPoint(lat, lng, azDeg, km) -> [lat, lng]`；`sectorPolygon(lat, lng, [min,max], km, steps=24) -> [lat,lng][]`（含中心點）；`youtubeEmbedUrl(url) -> 'https://www.youtube.com/embed/{id}?autoplay=1&mute=1'`（支援 `watch?v=` 與 `youtu.be/`，無法解析回 null）
  - `src/ui/map.js`: `createMap(el) -> map`；`renderPins(map, spots: SpotVM[], sunAzByGrid, handlers:{onHover(spot, el), onLeave(), onClick(spot)}) -> {select(id)}`；每個景點畫箭頭（`destinationPoint` 3 km）與扇形（`sectorPolygon` 2 km）
  - `src/ui/panel.js`: `renderRegions(el, regions)`、`renderFavorites(el, favorites, handlers)`、`showTooltip(spot, anchorEl)`、`hideTooltip()`、`openDetail(spot)`、`closeDetail()`；`openDetail` 先清空舊 iframe 再建立新的（同時只有一個直播）；`cam-switch` 在 `cams.length > 1` 時顯示並切換；`cams[i].sees_west_sky !== true` 時 `cam-label` 顯示 `天氣參考`；`cam-open` 連到原 YouTube 網址（新分頁，文字 `在 YouTube 開啟`）；`cams` 為空時 `cam` 區顯示 `尚無直播`
  - `src/app.js`: 載入 `data/spots.json` 與 `CONFIG.gasUrl`（失敗時 api=null）→ `buildViewModel` → 呈現；`#banner` 顯示 banners；`#updated` 顯示 `資料更新於 HH:MM`
- Leaflet：`https://unpkg.com/leaflet@1.9.4/dist/leaflet.js` 與 `.css`；底圖 `https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png`，attribution `© OpenStreetMap contributors © CARTO`；初始 `fitBounds` 涵蓋所有景點，padding 40px。

- [ ] **Step 1: 寫失敗測試** `test/geo.test.js`
  - `destinationPoint(25, 121.5, 270, 3)` → 緯度 ≈ 25（±0.001）、經度 < 121.5
  - `sectorPolygon(25,121.5,[240,300],2,6)` 長度 8（中心＋7 點），首尾為中心
  - `youtubeEmbedUrl('https://www.youtube.com/watch?v=34h_Cy_n0Ok')` → `'https://www.youtube.com/embed/34h_Cy_n0Ok?autoplay=1&mute=1'`；`youtu.be/abc` 形式可解析；`'not a url'` → null
- [ ] **Step 2:** `node --test test/geo.test.js` → FAIL
- [ ] **Step 3:** 實作 `geo.js`，再實作 `map.js`、`panel.js`、`app.js`、`index.html`、`styles.css`
- [ ] **Step 4:** `node --test test/geo.test.js` → PASS
- [ ] **Step 5: 煙霧測試** `test/e2e/smoke.mjs`：以 `python3 -m http.server 8765` 提供網站；Playwright（`executablePath: '/opt/pw-browsers/chromium'` 若預設找不到）攔截 `CONFIG.gasUrl` 回傳 `test/fixtures/api-2026-10-20.json`（`date` 改為今天）、攔截圖磚與 YouTube 回空內容。檢查：
  - `.pin` 共 9 個；`#regions` 3 張卡；`#favorites` 依序為大稻埕、淡水金色水岸、大屯山
  - 滑過漁人碼頭圖釘 → 小卡片出現且含 `Fair` 與 `看得到落日到海平面`
  - 點擊大稻埕方塊 → `#detail iframe` 恰 1 個、`src` 含 `Ndo_8RuefH4`；再點大屯山 → 仍恰 1 個 iframe、`src` 含 `d9KuXrPCWYU`
  - 攔截改回傳 HTTP 500 → `#banner` 含 `無法取得資料`、`.pin` 仍有 9 個
  Run: `node test/e2e/smoke.mjs` → 印出 `smoke OK`
- [ ] **Step 6:** commit `feat: functional front-end`

---

### Task 9: 套用 Claude Design 交接包

**前置：** Task 7 Step 3 完成，`design/handoff/` 存在。

**Files:**
- Modify: `index.html`（只換 `<template>` 內部結構與版面外框）、`styles.css`（換成交接包樣式）
- Create: `assets/icons/*.svg`（交接包提供的 6 個檔案）

- [ ] **Step 1:** 比對交接包與 DOM 契約；缺少的 id／class／data-field／圖示，列出清單請使用者回 Claude Design 補，或在本任務中補上最小對應
- [ ] **Step 2:** 套用樣式、模板與圖示；`src/` 下的 JS 不應需要修改（若需要，說明原因）
- [ ] **Step 3:** `node test/e2e/smoke.mjs` → `smoke OK`；`npm test` → PASS
- [ ] **Step 4:** 截圖 1440×900 全頁，與使用者確認
- [ ] **Step 5:** commit `feat: apply Claude Design`

---

### Task 10: 部署與上線檢查

**Files:**
- Modify: `src/config.js`（`gasUrl`）
- Create: `docs/deploy.md`（部署與日常維護步驟：新增景點流程、`npm run validate`、更換金鑰）

- [ ] **Step 1（使用者）:** 建立 GitHub repo，啟用 Pages（main 分支根目錄）；確認 `https://<user>.github.io/<repo>/data/spots.json` 可開
- [ ] **Step 2（使用者＋Claude）:** 建立 GAS 專案，貼上 `gas/*.js` 與 `appsscript.json`；設定指令碼屬性 `SUNSETHUE_KEY`、`CWA_KEY`、`SPOTS_URL`；手動執行 `refreshDaily` 一次並授權；執行 `installTriggers`
- [ ] **Step 3:** 部署為網頁應用程式，把網址填入 `CONFIG.gasUrl`；commit 並推送
- [ ] **Step 4: 上線驗證**：直接開 GAS 網址，JSON 含 `date` 為今天、3 個 regions、所有 towns、`metar.RCSS` 與 `metar.RCTP`、`errors: []`；開 Pages 網址，9 個圖釘、3 張區域卡、3 個常造訪景點，點一個景點可播放直播
- [ ] **Step 5:** 隔天 09:00 後確認觸發器有跑（`updated_at` 為當天 09:0x）
- [ ] **Step 6:** commit `chore: deploy config and docs`
