# 開發日誌（每日收工 15 分鐘自我 stand-up）

格式：日期 / 今天完成 / 明天首件事 / 目前最大風險

---

## 2026-08-06 (W1 M1 里程碑驗收)

**今天完成**
- Tasks 1–10 全部實作完成（透過 subagent-driven TDD）
- 後端 47 項單元測試全綠（test_auth, test_carbon_calc, test_forest_api, test_geo_hash, test_geo_validation, test_healthz）
- ruff linting 檢查通過
- `.github/workflows/ci.yml` CI workflow 建立完成（ruff + pytest 自動化）
- 整合測試 6 項因無 TEST_DATABASE_URL 自動跳過（預期行為）

**明天首件事**
- 待 Supabase 資料庫與認證 Secret 建置完成
- 執行 M1 整合驗證：schema_apply 測試 + curl 端到端驗證 + chain-status 狀態查詢
- 確認重疊檢測、自交檢測、碳估算 API 全流程運行無誤

**目前最大風險**
- **MOA-2024-v1 碳係數缺文獻查證**：所有碳估算常數表仍為 PLACEHOLDER（規格 FR-4.5 要求的預留行為）；待查證完成後只需更新 `carbon_coefficients.py` 並重跑 `test_carbon_calc.py`，oracle 自動同步
- **auth.users 直插假設**：整合測試依賴可直接 insert `auth.users`；若 Supabase 約束不允許，需改用 TEST_USER_ID 環境變數（Task 8 Step 4 已留備註）

---

## M1 上線前檢查清單

1. Supabase 專案建立後，確認使用 legacy HS256 JWT secret：若專案預設為非對稱簽名金鑰（ES256），後端 `jwt.decode(algorithms=["HS256"])` 會全數 401——屆時需改為 JWKS 驗證。
2. IPv4 網路環境請使用 Session Pooler 連線字串（`aws-*.pooler.supabase.com:5432`，勿用 6543 transaction pooler）。
3. 整合測試的 `auth.users` 直插假設：若 Supabase 約束不允許直接 insert，需改用 TEST_USER_ID 方案。
4. 上線流程：套用 schema → 執行整合測試 → curl 三情境驗證 → 打上 `m1-backend` tag。

---

## 2026-08-06（晚）— M1 里程碑達成 ✅

- Supabase 專案建立（ref: ywjlamzobgtsbdkabdse，ap-southeast-1）；IPv4 網路採 Session Pooler 連線
- 專案使用非對稱 JWT 簽章金鑰（ECC P-256）→ 後端已升級 ES256/JWKS 驗證（保留 HS256 相容）
- schema.sql 套用成功且冪等；PostGIS 3.3.7；GIST 索引生效（EXPLAIN: Index Scan, 0.045 ms）
- 整合測試 6/6 通過（修復 fixture：asyncpg Connection __slots__ → yield tuple）
- 完整套件 61 passed（55 單元 + 6 整合）
- curl 四情境全過（真實 ES256 JWT）：401 無 token／201 完整申報（6 筆估算）／409 重疊（overlap_ha 9.8602 + 衝突 GeoJSON）／422 自相交
- 展示資料：「延文實驗林場 A 區」（台灣杉/15年/1500株/19.72 ha）已入庫，狀態 chain_pending
- 明天起：W2 前端計畫（Next.js + Mapbox）

## 2026-08-07 — M2 里程碑達成 ✅（W2 前端完成）

- W2 Tasks 1–9 以 subagent-driven TDD 完成（12 commits）：Landing/Auth/3D 圈地/表單三回應/儀表板/詳情頁
- 最終全分支審查修復：地圖載入失敗提示、繪製工具自動轉俯視（3D 地形點偏 mitigation）、詳情頁連線錯誤區分 404、註冊確認信防跳轉迴圈
- 手動 E2E 六項全過（使用者親測）：AuthGuard 導向／圈地→201 成功卡+曲線／儀表板→詳情飛行定位／409 紅色高亮／<0.1 ha 前端阻擋／免責標示雙處
- 版本紀錄：實際為 Next.js 16.3、recharts 3.10（計畫寫 15/2，程式碼已相應調整）；表單為點擊開啟而非自動彈出（UX 決策，記錄備查）
- W3 待辦（審查遺留）：GET 401 導登入、conflict helpers 抽到 lib/、AuthGuard returnTo、CarbonChart 基準年改 created_at
- 明天起：W3 區塊鏈計畫（Hardhat + GreenAssetNFT + chain_service）

## 2026-08-07（續）— W3 程式碼完成，待 M3 部署驗證

- W3 Tasks 1–7 完成（合約 8 測試、後端 79 tests、前端 lint/build 綠）；最終審查 4 個 Important 全修復：
  already-minted 防卡死（geoHashUsed 預檢 + 不可重試錯誤）、成功回寫原子化、mint 序列化 + pending nonce、admin timing-safe 比較、gas tip 25 gwei 下限
- 設計決策記錄：NFT mint 給平台錢包自身（規格 §9 允許，MVP 無使用者錢包）；metadata 端點公開屬設計（tokenURI 需可讀）
- M3 檢查清單（最終審查追加）：
  1) ETHERSCAN_API_KEY 需為 etherscan.io V2 multichain key（legacy polygonscan key 無效）；verify 失敗可改用 Polygonscan UI
  2) 對帳程序：tx 已上鏈但 plot 卡 chain_pending 時——polygonscan 查 PlotMinted 事件取 token_id，手動補 chain_records + status
  3) 首筆 mint pending > 2 分鐘：先查 gas tip 是否低於 Polygon 25 gwei 下限，再懷疑 RPC
  4) retry_count 語意：成功時 = 成功前的失敗次數（首次即成功為 0）
  5) Render 免費方案休眠會殺背景任務——W4 UptimeRobot 前，補鑄作業在本機執行較穩
