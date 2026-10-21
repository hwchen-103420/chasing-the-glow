# 觀夕平台：部署與維護

## 架構

- **網站**：GitHub Pages（本 repo 的 `main` 分支根目錄）
- **資料端點**：Google Apps Script 網頁應用程式（`gas/` 資料夾）
- **金鑰**：只存在 Apps Script 的「指令碼屬性」，不進 repo

## 一、GitHub Pages

1. 在 GitHub 建立 **public** repo（免費方案的 Pages 需要 public），例如 `sunset-site`，不要勾選建立 README。
2. 推上本 repo 的 `main` 分支。
3. repo → Settings → Pages → Source 選 **Deploy from a branch**，Branch 選 `main`、資料夾 `/ (root)` → Save。
4. 約 1 分鐘後開啟 `https://<帳號>.github.io/<repo>/data/spots.json`，看得到 JSON 就成功。

## 二、Apps Script

1. 到 <https://script.google.com> → 新專案，命名「觀夕平台資料」。
2. 專案設定（齒輪）→ 勾選「在編輯器中顯示 appsscript.json 資訊清單檔案」，再把內容換成 `gas/appsscript.json`。
3. 新增 5 個指令碼檔案，內容分別貼上 `gas/time.js`、`gas/sunsethue.js`、`gas/cwa.js`、`gas/log.js`、`gas/Code.js`（檔名可用 `time`、`sunsethue`、`cwa`、`log`、`Code`）。`gas/package.json` 不用貼。
4. 專案設定 → 指令碼屬性，新增三個：
   - `SUNSETHUE_KEY`：Sunsethue 金鑰
   - `CWA_KEY`：氣象署金鑰
   - `SPOTS_URL`：`https://<帳號>.github.io/<repo>/data/spots.json`
5. 編輯器上方選函式 `refreshDaily` → 執行，依提示授權。執行紀錄沒有錯誤即可。
6. 選函式 `setupLog` → 執行（建立「觀夕平台 觀賞紀錄」試算表，網址會出現在執行記錄）。
7. 選函式 `installTriggers` → 執行（建立每天 09:00、12:00、15:00、16:30 的自動更新）。
8. 右上「部署」→ 新增部署作業 → 類型「網頁應用程式」：
   - 執行身分：**我**
   - 誰可以存取：**所有人**
   → 部署，複製網址（`https://script.google.com/macros/s/…/exec`）。
9. 把網址填進 `src/config.js` 的 `gasUrl`，推上 GitHub。

**之後修改 GAS 程式**：改完要「部署 → 管理部署作業 → 編輯 → 版本：新版本」，網址不變。

## 三、上線檢查

- 直接開 GAS 網址：JSON 裡 `date` 是今天、`regions` 有 3 個網格、`towns` 有各鄉鎮、`metar` 有 `RCSS` 和 `RCTP`、`errors` 是 `[]`。
- 開網站：9 個圖釘、3 張區域卡、3 個常造訪景點，點景點會播直播。
- 隔天 09:00 後再開 GAS 網址，`updated_at` 應該是當天 09 點多。

## 日常維護

### 新增景點或直播
1. 改 `data/spots.json`（欄位說明見 `docs/superpowers/specs/2026-10-20-sunset-platform-design.md` §7）。
2. `npm run validate` 檢查。
3. `npm run fonts` 重新產生字型子集（新名稱裡有新字時需要；`npm test` 會提醒）。
4. 景點超出目前底圖範圍時，`npm run basemap` 重新產生底圖。
5. 推上 GitHub。Apps Script 下一次自動更新時會讀到新景點。

### 觀賞紀錄
- 試算表「觀夕平台 觀賞紀錄」在你的 Google 雲端硬碟，有兩張工作表：
  - `forecasts`：每次自動更新時各網格的分數、雲量、日落時間
  - `ratings`：網站詳情卡送出的評分（1–10）與當下網站顯示的內容
- 評分每小時上限 30 筆（防止濫用）；同一景點同一天可重複評分，每次新增一筆。

### 更換金鑰
Apps Script → 專案設定 → 指令碼屬性，直接改值，不用重新部署。

### 重建河川圖資
`data-src/rivers-osm.geojson` 來自 OpenStreetMap，在 <https://overpass-turbo.eu> 執行以下查詢後匯出 GeoJSON：

```
[out:json][timeout:90];
(
  way["waterway"="river"]["name"~"淡水河|基隆河|大漢溪|新店溪"](24.90,121.15,25.25,121.75);
  relation["waterway"="river"]["name"~"淡水河|基隆河|大漢溪|新店溪"](24.90,121.15,25.25,121.75);
  way["natural"="water"]["water"="river"](24.95,121.35,25.20,121.65);
  relation["natural"="water"]["water"="river"](24.95,121.35,25.20,121.65);
);
out geom;
```

### 字型授權
- 網站字型「GuanXi Round」為 jf open huninn（粉圓體）的子集，SIL OFL 1.1，授權見 `assets/fonts/OFL.txt`。
- Logo 為凝書體（creamfont）轉出的外框；**字型檔本身不得放進 repo**（買斷授權禁止轉交他人）。
