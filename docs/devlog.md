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
