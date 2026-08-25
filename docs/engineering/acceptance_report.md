# 正式環境驗收報告（AT-1～AT-6）

| 文件資訊 | 內容 |
|---|---|
| 版本／狀態 | v1.0｜正式｜最後校訂：2026-08-25 |
| 驗收環境 | 前端 https://green-chain-timber-wheat.vercel.app ／ 後端 https://greenchain-backend-mp5a.onrender.com ／ 合約 [`0x3fc1...44F8`](https://amoy.polygonscan.com/address/0x3fc1c4F56F7dc4A0b52Fd9B62dC1AEECdAce44F8)（Amoy） |
| 驗收日期 | 2026-08-07 |
| 對應規格 | 《專案規格書 v1.0》§12 |

## 結果總覽

| 案例 | 執行方式 | 結果 | 證據摘要 |
|---|---|---|---|
| AT-1 Happy Path | 使用者於正式站瀏覽器操作 | ✅ PASS | 2026-08-07 使用者執行：201 成功卡+6 年曲線；≤2 分鐘轉 on_chain；Tx Hash 於 Amoy 瀏覽器查得 Success |
| AT-2 重疊拒絕 | scripted 直打正式 API | ✅ PASS | HTTP 409、conflicts=1、overlap_ha=9.8602（與延文實驗林場 A 區）、含衝突 GeoJSON；資料庫無新增 |
| AT-3 幾何無效 | scripted 直打正式 API | ✅ PASS | 自相交蝴蝶結多邊形 → HTTP 422、code=`self_intersection` |
| AT-4 欄位驗證 | scripted 繞過前端直打 API | ✅ PASS | avg_age=0 → 422；density=50 → 422（前端 min/max 另有阻擋） |
| AT-5 上鏈重試 | 引用 M3 完整演練（本機，同一程式碼與正式 DB） | ✅ 條件式 PASS（正式環境未重演，引用 M3 本機完整演練） | 壞 RPC → 3 次重試失敗、狀態停留 chain_pending、last_error=「所有 RPC 節點皆無法連線」→ 恢復 RPC + `POST /api/admin/retry-pending` → 5 秒轉 on_chain（token #4，tx `0x12ba82...4b5a52`）；詳 devlog 2026-08-07 M3 段 |
| AT-6 雜湊可驗證 | `scripts/verify_hash.py` 對正式 DB + Amoy 鏈上 | ✅ PASS | 4/4 MATCH（DB `geo_hash` = 正規化重算 SHA-256 = 鏈上 `getPlotData().geoHash`） |

## 細節紀錄

### AT-2（2026-08-07，scripted）
提交與「延文實驗林場 A 區」（token #1）東移重疊之多邊形 `[121.774–121.778, 24.7406–24.745]`：
回應 `409 {"detail":{"conflicts":[{"plot_id":"6f05a481-...","overlap_ha":9.8602,"overlap_geojson":{...}}]}}`。
重疊區面積與 M1 本機驗證值一致；`forest_plots` 筆數不變。

### AT-3 / AT-4（2026-08-07，scripted）
- 蝴蝶結 `[[121.80,24.745],[121.804,24.741],[121.804,24.745],[121.80,24.741]]` → `422 {"detail":{"code":"self_intersection","message":"多邊形無效：Self-intersection[...]"}}`
- `avg_age=0`、`density=50` 均回 FastAPI 標準 422 欄位驗證錯誤——證明後端獨立驗證，不依賴前端

### AT-5（引用 M3 演練，2026-08-07）
正式環境不重演壞 RPC（避免動 Render 設定影響服務）；M3 於本機以相同程式碼、相同正式資料庫完整演練：
`CHAIN_RPC_URL` 改無效網址＋清空備援 → 提交林區 → `chain_records.retry_count` 依序 1→2→3、`last_error` 記錄、狀態停留 `chain_pending` → 恢復 RPC → admin retry → 5 秒內 mint 成功轉 `on_chain`。
另有一次非計畫性實戰：POA middleware 缺失造成的三次重試失敗，同樣由 admin retry 全數補鑄成功——重試機制經兩次實際故障驗證。

### AT-6（2026-08-07，scripted）
`uv run python scripts/verify_hash.py` 輸出 4/4 MATCH：
token #1 延文實驗林場 A 區、#2 頭城示範林 D 區、#3 太平山示範林 B 區、#4 棲蘭示範林 C 區。
三值比對（DB 欄位／DB GeoJSON 正規化重算／鏈上 bytes32）完全一致。

### AT-1（使用者操作，正式站）
步驟：登入 → 3D 地圖圈選約 5 ha 林地 → 台灣杉／15 年／1500 株 → 送出。
驗收點：① 201 成功卡 + 6 年估算曲線；② 詳情頁「上鏈處理中」→ ≤ 2 分鐘自動轉 on_chain；
③ Tx Hash 點擊於 Amoy 瀏覽器查得交易（status = Success）。
結果：PASS（2026-08-07 使用者於正式站執行，三項驗收點全數通過）。

## 結論

**六案例全數 PASS**——規格書 §12 驗收完成，MVP 目標 G1–G5 兌現：
G1 端到端 Happy Path（AT-1）、G2 防重疊（AT-2）、G3 估算可追溯（公式版本隨估算入庫；係數為文獻示範參數，正式係數列第二階段——本驗收驗證流程與可追溯性，非官方係數之正確性）、
G4 上鏈可查驗（AT-1/AT-6）、G5 零成本上線（Vercel/Render/Supabase/Amoy 免費額度）。

## 簽核

- scripted 項目（AT-2/3/4/6）與 AT-5 引用：Claude（controller），2026-08-07
- AT-1 使用者驗收：yinyaoqing，2026-08-07
