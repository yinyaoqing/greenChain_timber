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
