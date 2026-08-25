# 開發日誌（每日收工 15 分鐘自我 stand-up）

最後更新：2026-08-25

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

## M1 上線前檢查清單（已全數確認）

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

## 2026-08-07（晚）— M3 里程碑達成 ✅（W3 區塊鏈層全通）

- GreenAssetNFT 部署 Amoy：`0x3fc1c4F56F7dc4A0b52Fd9B62dC1AEECdAce44F8`（部署耗 ~0.044 POL）
- 實戰踩坑並修復：web3.py 需注入 ExtraDataToPOAMiddleware（Polygon/Amoy extraData 105 bytes）——
  首次 mint 三次重試失敗證明了重試/退避/last_error 機制如設計運作，admin retry-pending 補鑄全數成功
- 端到端：圈地 201 → 背景 mint → on_chain，token #1–#4 全部上鏈，tx receipt status=1
- AT-5 完整演練：壞 RPC → 3 次重試失敗停留 chain_pending（last_error「所有 RPC 節點皆無法連線」）→
  恢復 RPC + admin retry → 5 秒內轉 on_chain（token #4）
- AT-6：verify_hash.py 4/4 MATCH（DB geo_hash = 重算 SHA-256 = 鏈上 geoHash）
- chain-status 端點、NFT metadata 端點（UTF-8 正常）皆驗證通過
- 網路備註：官方 rpc-amoy.polygon.technology 本機 DNS 解析失敗，改用 publicnode（主）+ drpc（備援）
- 待辦（正式環境）：Render 補 4 個環境變數後正式站全通；前端詳情頁 Tx Hash 視覺確認

## 2026-08-07（深夜）— M4 里程碑達成 ✅✅ 四週 MVP 收官

- W4 Tasks 1–7 完成：keepalive（GH Actions cron）、展示資料整理（4 示範林區/三樹種）、
  UI 打磨（skeleton/格式化/導向/404）、README 定稿、Demo 腳本（3+8 分鐘）、CORS Preview regex
- **驗收 AT-1～AT-6 全數 PASS**（docs/acceptance_report.md）：AT-1 由使用者於正式站親測
  （圈地→2 分鐘內上鏈→Amoy 查得 Success）；G1–G5 全部兌現
- 里程碑回顧（原計畫 4 週，實際 2 天）：
  M1 後端+空間資料庫（08-06）→ M2 前端地圖（08-07）→ M3 區塊鏈層（08-07）→ M4 整合上線（08-07）
- 遺留清單（後續迭代）：農業部正式係數查證（carbon_coefficients.py PLACEHOLDER）、
  GET 401 導登入/AuthGuard returnTo/CarbonChart 基準年（W2 deferred）、
  overlap TOCTOU advisory lock（多使用者時）、GitHub Actions 事故期間的 CI 紅字待今日 run 洗綠
  （結案標註 2026-08-25：CI 是否已恢復綠燈，狀態未再追蹤）、
  Mapbox 用量監控、展示錢包餘額 ~0.04 POL（Demo 密集前補領；此為 08-07 快照）

## 2026-08-08 ~ 2026-08-25 — 第二階段策略與文件期

- 產品定位修正（2026-08-25 市場盡職調查）：我國自願減量專案申請人限事業、各級政府與公協會等
  機構，個人不得逕行申請——因此平台定位為**企業與聚合單位（產銷班／合作社／公協會）的數據
  基礎設施**，而非個人變現管道。技術資產不變，敘事重心調整（見 README「定位與界線」）
- 方法學口徑統一：環境部方法學架構＋農業部係數為藍本；現行係數為文獻示範參數（PLACEHOLDER），
  正式係數查證屬第二階段研發項目
- 本日（08-25）全文件一致性掃描與批次修正：demo_script／deploy／規格書／開發計畫／devlog／acceptance_report

## 2026-08-25（晚）— 送件前口徑翻轉 + T3 技術債清償

程式碼自 08-07 凍結後首次改動。範圍嚴格限定為「不佔用黑客松入選後六週交付承諾」的三項
（係數查證、公民開放驗證入口、地籍圖資介接均刻意**未動**，留作入選後交付）。

**1. 產品口徑翻轉（對齊判決書修正命題 A/B）**
- 首頁重寫：主 CTA 由「開始圈地申報」改為「檢視示範林區儀表板」，「林區數位建檔」降為次要；
  新增「誰在使用」三欄（企業永續部門／環境顧問與盡職調查／聚合單位與保育組織）
- 全站用語：圈地申報 → 林區建檔；企業儀表板 → 林區監測儀表板；圈選 → 圈繪
- README 重寫定位段：服務對象改為企業／顧問／聚合單位，明列「非個人碳權變現管道」

**2. 環資措辭紅線入 UI／README（判決書補查證 3）**
首頁新增「我們不做什麼（定位與界線）」四條、README 同步：碳匯≠碳權、天然林不談變現、
不碰額度交易撮合抽成、自願減量申請人限事業/政府/公協會（個人不得逕行申請）。
全站免責文字統一為「非經查證之減量額度」（含 `/api/nft/{id}/metadata` 的 description）。

**3. T3 技術債清償（W2/W3 deferred）**
- `showConflicts`/`clearConflicts` 由 `components/DrawPanel.tsx` 抽至 `lib/conflictLayer.ts`
- `lib/api.ts` 新增 `UnauthorizedError`；GET 401 或缺 token 不再顯示為「載入失敗」，
  改由 dashboard／詳情頁導向登入頁
- `AuthGuard` 與 `/login` 支援 returnTo（`lib/authRedirect.ts`，`safeReturnTo` 擋開放轉址）；
  登入預設去向由 `/draw` 改為 `/dashboard`（呼應主 CTA 翻轉）；login 表單包 Suspense 以用 useSearchParams
- `CarbonChart` 基準年改由 `created_at` 推導（新增 `createdAt` prop，缺值時退回當年）

**4. 營運保險檢查（2026-08-25 實測）**
- Amoy 合約 `0x3fc1…44F8` 存活；token #4 `ownerOf` 正常回應
- 展示錢包 `0x83a1…579a` 餘額 **0.1259 POL**（08-07 快照為 ~0.04，已回補，Demo 密集期充足）
- 生產後端 `greenchain-backend-mp5a.onrender.com/healthz` → `{"status":"ok","db":"up"}`（0.6s）
- 公開 metadata `/api/nft/1..4/metadata` 全數 200，示範資料四筆完整
- 前端 `green-chain-timber-wheat.vercel.app` → 200

驗證：backend 82 passed / 6 skipped；frontend eslint 0 error、build 通過（7 頁）。

### 部署事故：Vercel 全數 `Blocked`（2026-08-25 排除）

推送口徑翻轉版本後線上仍是舊版。Vercel Deployments 清單顯示**自 2026-08-14 起每一筆
deployment 皆為 `Blocked`**（非建置失敗——根本沒開始建置），線上內容停留在 08-14 版本。

- **原因**：`The deployment was blocked because the commit author did not have
  contributing access to the project on Vercel.` Vercel 以 commit 的 author email
  反查 GitHub 帳號；本機 git 身分 `josephyinyaoqing@gmail.com` 未掛在 GitHub 帳號
  `yinyaoqing` 之下，於是被判定為外部協作者——而 **Hobby 方案對私有 repo 不支援協作**。
- **非原因**（排除記錄）：Git 整合正常（Connected Aug 7）、用量未超限、程式碼無誤。
  **不要 Disconnect 重連**，那不會解決作者辨識問題，還可能弄丟環境變數綁定。
- **解法**：`git config user.email` 改為 GitHub noreply
  `42916369+yinyaoqing@users.noreply.github.com`，以空 commit（樹內容不變）重新觸發——推送後約 20 秒新版上線，無須升級 Pro、repo 維持私有。
- **後續**：GitHub Settings → Emails 補加驗證 `josephyinyaoqing@gmail.com`，讓歷史
  77 筆 commit 正確歸屬（待辦）。
- **上線驗證**：首頁舊字串「開始圈地申報」殘留 0 筆；新字串（檢視示範林區儀表板／
  我們不做什麼／碳匯≠碳權／天然林不談變現／不碰額度交易／個人不得逕行申請）各 1 筆；
  /dashboard、/draw、/login 皆 200；Render 亦同步部署，
  `/api/nft/1/metadata` description 已為「非經查證之減量額度」。

### 版控範圍收斂：內部文件移出公開 repo（2026-08-25）

本 repo 為 **public**（對外溝通以「原始碼全公開」為訴求，維持公開）。原先 `docs/` 下混放
了內部策略與未送件文件——任何人可經 raw.githubusercontent.com 直接讀取。已處理：

- **移出版控**（本機保留、`.gitignore` 永久排除）：`docs/external/`、`docs/strategy/`
  與 `docs/` 根目錄之內部報告共 14 份
- **維持公開**（技術資產，支撐「任何工程師可自行部署接手」之開源主張）：
  `docs/engineering/`、`docs/specs-p2/`、`docs/superpowers/plans/` 共 12 份
- 以 `git filter-repo` 兩趟清除全部歷史版本（含 2026-08-14 目錄重整前的舊路徑），
  force push 覆寫遠端。清理前 repo 為 0 fork／0 star／0 watcher，外流風險極低
- **副作用**：全部 commit hash 已改寫；僅改動已移除檔案的 commit 於清理後成為空 commit 而消失。
  為避免日後再次失效，本檔不再引用 commit hash
- 清理前完整備份（`git bundle --all` + docs 快照）留存於本機 scratchpad

**第二階段（同日）**：進一步把 `docs/` 與 `README.md` 自全部歷史剝離，再以單一一筆
commit 重新加入最終版本——歷史上因此看不到文件的逐版演進，只看得到程式碼 commit
與尾端這一筆。commit 數 64 → 47（差額為僅改動文件的 commit）。文件內容完整保留。

### /healthz 加建置資訊（2026-08-25）

原先 `/healthz` 只回 `{status, db}`，無法從外部判斷線上跑的是哪一版、自動部署是否生效。
現增回 `version`（Render 部署時注入之 `RENDER_GIT_COMMIT` 前 7 碼，本機為 `local`）與
`started_at`（本次啟動時間，免費方案冷啟後會更新）。用途：部署鏈路健檢、Demo 前確認
線上版本、免費實例冷啟判讀。
