# 觀夕平台 設計規格（v1，電腦版）

日期：2026-10-20　狀態：已審（v1.1：前三名改為常造訪的景點；新增大屯山山頂雲層標記）

## 0. 目標與範圍

**一句話：** 打開一頁就能判斷「今天值不值得去看夕陽、去哪個點、什麼時候最好看」，不用再東拼西湊資訊。

**使用者與情境：** Howard 與家人自用；主要在電腦上，下午時決定傍晚要不要出門。

**網站自己提供的價值**（Sunsethue 沒有的部分）：
1. 每個景點今天是「看得到落日到海平面／落日會提早被擋／只看得到晚霞」
2. 最佳觀賞時段
3. 每個點的直播畫面（朝西的看夕陽，其餘當天氣參考）
4. METAR／TAF／氣象署資料轉成的提示標記

**範圍外（v1 不做）：** 手機版版面、公開給他人使用、計算出發時間（改用 Google 地圖導航連結）、自行計算夕陽分數、觀賞紀錄、推播通知。

## 1. 架構

```
GitHub Pages（靜態網頁）
  index.html + data/spots.json
        │  fetch JSON
        ▼
Google Apps Script 網頁應用程式（doGet 回傳 JSON）
  ├─ 時間觸發器 09:00 / 12:00 / 15:00
  │    └─ Sunsethue（3 個網格）＋ 氣象署鄉鎮預報 → 存入指令碼屬性
  └─ 收到請求時
       └─ METAR／TAF（aviationweather.gov）→ CacheService 快取 10 分鐘
```

- API 金鑰（Sunsethue、氣象署）只存在 GAS 指令碼屬性，不出現在網頁或 GitHub。
- 每日 Sunsethue 用量：3 時段 × 3 網格 = 9 次，約 45 點（免費額度 1,000 點）。

## 2. 資料來源

| 資料 | 來源 | 金鑰 | 更新 | 用途 |
|---|---|---|---|---|
| 夕陽分數、雲量、日落時間與方位、黃金／藍調時刻 | Sunsethue `/event?latitude&longitude&date&type=sunset`，header `x-api-key` | 需要（已申請） | 觸發器 3 次／日 | 圖釘顏色、區域分數、最佳時段、狀態判斷 |
| 鄉鎮天氣（天氣現象、溫度、降雨機率） | 氣象署開放資料，鄉鎮天氣預報（臺北市、新北市、桃園市） | 需要（待申請） | 觸發器 3 次／日 | 小卡片天氣、降雨否決 |
| METAR／TAF（RCSS、RCTP） | `aviationweather.gov/api/data/metar?ids=RCSS,RCTP&format=json&taf=true` | 不需要 | 請求時取得，快取 10 分鐘 | 提示標記 |
| 直播 | YouTube 嵌入（`cams`） | 不需要 | 即時 | 景點詳情 |
| 景點、方位、鄉鎮、網格 | `data/spots.json` | — | 手動維護 | 全部 |

## 3. GAS 輸出格式

```json
{
  "date": "2026-10-20",
  "updated_at": "2026-10-20T15:00:12+08:00",
  "regions": {
    "25,121.5": {
      "quality": 0.36, "quality_text": "Fair", "cloud_cover": 0,
      "sunset": "17:23", "direction": 259.3,
      "golden_hour": ["17:11", "17:37"], "blue_hour": ["17:42", "17:52"]
    }
  },
  "towns": {
    "臺北市/中山區": { "wx": "多雲", "temp": 27, "pop": 10 }
  },
  "metar": {
    "RCSS": { "raw": "...", "obs_time": "...", "visib_km": 10, "temp": 34, "dewp": 26,
              "clouds": [{ "cover": "FEW", "base_ft": 2000 }] },
    "RCTP": { "raw": "...", "taf": "..." }
  },
  "errors": []
}
```

- 時間一律轉成台灣時間 `HH:MM`。
- `pop` 取涵蓋最佳觀賞時段開始時間的那一個預報時段。
- `errors` 列出這次取不到的來源，前端據此顯示提示。

## 4. 判斷邏輯

### 4.1 分數等級（依 Sunsethue 官方分級）

```
quality <  0.20 → Poor
quality <  0.40 → Fair
quality <  0.60 → Good
quality >= 0.60 → Great
```

分數一律使用 Sunsethue 原值，不與其他資料混合計算。

### 4.2 否決

```
if 景點所屬鄉鎮 pop >= 50%:
    spot.vetoed = true        // 圖釘與卡片改為「不建議」樣式
```

區域卡片以該區代表鄉鎮的 `pop` 判斷，規則相同。

### 4.3 景點狀態

```
sun_az = regions[spot.sunsethue_grid].direction

if sun_az 不在 spot.view_az_range:     status = "afterglow"   // 只看得到晚霞
elif spot.horizon_block == "sea":      status = "sea"         // 看得到落日到海平面
else:                                  status = "blocked"     // 落日會提早落到山稜／建築後
```

`view_az_range` 為 `[min, max]` 度數，含端點。

### 4.4 最佳觀賞時段

```
best_window = golden_hour.start → blue_hour.end     // 例：17:11–17:52
```

### 4.5 提示標記（規則式，不影響分數）

| 標記 | 條件 | 套用範圍 |
|---|---|---|
| 西方低雲多，落日可能被擋 | RCTP 任一層 BKN／OVC 且雲底 < 3000 ft | 所有景點、所有區域 |
| 傍晚預報轉差 | RCTP TAF 在 17–18L（09–10Z）有 BKN／OVC 雲底 < 3000 ft，或含 RA／SHRA／TS | 所有景點、所有區域 |
| 水氣重或有霾，顏色可能混濁 | 頭頂測站能見度 < 5 km，或溫度露點差 ≤ 2°C | 依 `metar_overhead` |
| 有中高雲，有機會火燒雲 | 頭頂測站有 SCT／BKN 且雲底 ≥ 8000 ft，且未觸發「西方低雲多」 | 依 `metar_overhead` |
| 晴空無雲，天空顏色會比較單調 | Sunsethue `cloud_cover` < 0.10 | 依網格 |

- 頭頂測站：許厝港用 RCTP，其餘用 RCSS（`spots.json` 的 `metar_overhead`）。
- METAR 觀測時間超過 90 分鐘視為過期，不產生 METAR 類標記。
- 門檻值集中寫在一個設定物件，方便日後調整。

另有一條景點專屬標記：

| 標記 | 條件 | 套用範圍 |
|---|---|---|
| 山頂視野可能受雲層干擾 | RCSS TAF 在最佳觀賞時段內，或（15:00 後）RCSS 當下 METAR，有任一層雲（FEW 以上）雲底 < `summit_cloud_ft`；兩者任一符合即警示 | `summit_cloud_ft` 有值的景點（目前只有大屯山，4000 ft） |

```
for spot in spots where spot.summit_cloud_ft != null:
    low = layer => layer.cover in {FEW, SCT, BKN, OVC} and layer.base_ft < spot.summit_cloud_ft

    groups = RCSS TAF 中有效時間涵蓋 best_window 的預報組（含 TEMPO／BECMG）
    taf_hit = any(low(l) for g in groups for l in g.clouds)

    metar_hit = false
    if 現在時間 >= 15:00（台灣時間） and RCSS METAR 未過期（≤ 90 分鐘）:
        metar_hit = any(low(l) for l in RCSS_METAR.clouds)

    if taf_hit or metar_hit:
        spot.flags += "山頂視野可能受雲層干擾"
```

### 4.6 常造訪的景點

- 固定顯示 `spots.json` 的 `favorites` 清單（目前：大稻埕碼頭、淡水金色水岸、大屯山），**不排名**，依清單順序顯示。
- 要更換景點，只改 `favorites`，不需要改程式。
- 被否決的景點仍顯示，套用「不建議」樣式。
- `favorites` 裡的 id 若不存在於 `spots`，略過並在瀏覽器 console 警告。

## 5. 版面（電腦版）

```
┌──────────────────────────────┬────────────────────────┐
│                              │ 今日概況                 │
│                              │ [淡水河口][台北盆地][桃園海岸] │
│   北部地圖（約 65% 寬）        │ 分數等級、天氣、提示標記      │
│                              │ 最佳時段 17:11–17:52      │
│   景點圖釘＋日落方向箭頭        ├────────────────────────┤
│   ＋可見範圍扇形               │ 常造訪的景點（3 個方塊）     │
│                              │                        │
└──────────────────────────────┴────────────────────────┘
頁尾：資料更新時間、資料來源
```

- 地圖：Leaflet，極簡淡色底圖；初始範圍涵蓋桃園海岸到內湖。
- 每個圖釘畫出：今天的日落方向短線，以及 `view_az_range` 的淡色扇形。
- 區域卡片標題用區域名稱（淡水河口／台北盆地／桃園海岸），不用縣市名。

### 互動

| 動作 | 結果 |
|---|---|
| 滑過圖釘 | 小卡片：景點名稱、分數（數值與等級）、狀態、天氣（天氣現象、溫度、降雨機率）、提示標記 |
| 點擊圖釘 | 展開大卡片：小卡片內容＋直播嵌入＋Google 地圖導航按鈕；地圖上的圖釘保持選取 |
| 滑過常造訪景點方塊 | 方塊放大，顯示小卡片內容 |
| 點擊常造訪景點方塊 | 同點擊圖釘：展開大卡片並播放直播；地圖同步選取該圖釘 |
| 大卡片關閉 | 停止播放直播 |

- 同一時間最多只播放一個直播。
- 直播來源為 `ref_cams` 的第一個；超過一個時可切換。直播的 `sees_west_sky` 不是 true 時，標示「天氣參考」。
- 導航連結：`https://www.google.com/maps/dir/?api=1&destination={lat},{lng}`，新分頁開啟。

## 6. 視覺規則（交由 Claude Design 繪製）

- **所有圖示由 Claude Design 繪製，不使用 emoji。**
- 圖釘：顏色表示分數等級，圖案表示景點狀態；兩者都要能單獨辨識。

| 等級 | 顏色方向 | 備註 |
|---|---|---|
| Poor | 冷灰藍 | |
| Fair | 淡琥珀 | |
| Good | 橘色 | |
| Great | 深橘紅 | 加外發光，一眼可辨 |
| 不建議（否決） | 灰色＋雨滴圖案 | 不顯示狀態圖案 |
| 無資料 | 灰色外框、空心 | 與「不建議」明顯不同 |

| 狀態 | 圖案方向 |
|---|---|
| sea | 太陽碰到水平線 |
| blocked | 太陽一半在山稜後 |
| afterglow | 只有彩霞、沒有太陽 |

- 常造訪的景點：圖釘加一個小標記（樣式由 Claude Design 決定），不加名次數字。
- 小卡片與常造訪景點方塊：以分數等級色為底色；文字等級一律寫出，顏色不是唯一的資訊。
- 色碼與圖案細節在 Claude Design 中決定，完成後回填到程式的設定檔。

## 7. 資料檔 `data/spots.json`

| 欄位 | 說明 |
|---|---|
| `spots[].id, name, area, lat, lng` | 基本資料 |
| `spots[].view_az_range` | 可見方位範圍 `[min, max]` |
| `spots[].horizon_block` | `sea`／`ridge`／`buildings` |
| `spots[].verified` | 方位是否已實地確認 |
| `spots[].sunsethue_grid` | 對應的 Sunsethue 網格 |
| `spots[].cwa_town` | 氣象署鄉鎮，例：`臺北市/中山區` |
| `spots[].metar_overhead` | 頭頂參考測站 `RCSS`／`RCTP` |
| `spots[].ref_cams` | 參考直播 id 清單，第一個為預設 |
| `spots[].nav_url, notes` | 導航連結、備註 |
| `spots[].summit_cloud_ft` | 山頂雲層干擾門檻（ft），無則為 `null` |
| `favorites` | 常造訪景點的 id 清單，依序顯示 |
| `cams[]` | `id, name, url, source, facing, sees_west_sky, verified` |
| `regions[]` | `grid, name, cwa_town, lat, lng` |
| `metar` | `west_horizon`、`stations` |

新增景點或直播只需要改這個檔案，不需要改程式。

## 8. 錯誤處理

| 狀況 | 處理 |
|---|---|
| Sunsethue 某次觸發失敗 | 保留上一次成功的資料，頁尾顯示「分數更新於 HH:MM」 |
| 當天完全沒有 Sunsethue 資料 | 該區圖釘用「無資料」樣式，區域卡片顯示「暫無分數」；仍顯示天氣與直播 |
| 氣象署失敗 | 不套用否決，小卡片顯示「降雨資料暫缺」 |
| METAR／TAF 失敗或過期 | 不顯示 METAR 類標記，其餘照常 |
| GAS 本身無回應 | 頁面上方顯示錯誤橫幅；地圖與景點仍顯示（只有 spots.json 的資料） |
| 資料日期不是今天 | 頁面上方顯示「資料不是今天的」 |
| 直播離線 | YouTube 播放器自行顯示離線畫面；大卡片附「在 YouTube 開啟」連結 |
| 景點沒有直播 | 大卡片的直播區顯示「尚無直播」 |

## 9. 測試與驗證

- **判斷邏輯單元測試**：等級分界（0.19／0.20／0.40／0.60）、否決（49／50%）、狀態判斷（方位在範圍端點、範圍外）、每一條提示標記的觸發與不觸發（含大屯山雲底 3999／4000 ft、TAF 預報組不涵蓋最佳時段、15:00 前後 METAR 是否納入、TAF 與 METAR 任一觸發）、常造訪景點的順序與不存在 id 的略過。判斷邏輯寫成純函式，不依賴網路。
- **GAS 測試**：用固定的範例回應（今天實測的 Sunsethue JSON、METAR 原文）測試解析與格式轉換。
- **實地對照**：上線後兩週，每次去看夕陽時對照網站判斷（狀態、提示標記）是否正確，用來校正 `view_az_range`、`horizon_block` 與標記門檻。

## 10. 開工前待辦（使用者）

1. 申請氣象署開放資料金鑰。
2. 日落時段打開 4 支直播，確認 `facing`／`sees_west_sky`。
3. 補上缺少直播的景點：淡水金色水岸、漁人碼頭、大屯山、軍艦岩、許厝港。
4. 之後實地造訪時，用指南針確認 `view_az_range`。

以上不影響開工；第 1 項在接上氣象署資料之前完成即可。

## 11. 實作順序（概要，細節見實作計畫）

1. GAS：Sunsethue 與 METAR 抓取、快取、doGet JSON
2. 判斷邏輯純函式＋單元測試
3. Claude Design：版面、圖釘、卡片樣式
4. 前端：依 Claude Design 交接包實作，接上 GAS
5. 氣象署資料與否決規則
6. 部署 GitHub Pages、設定觸發器
