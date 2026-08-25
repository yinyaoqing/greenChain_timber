# 部署指南（CI/CD）

最後校訂：2026-08-25

| 層 | 工具 | 觸發 | 狀態 |
|---|---|---|---|
| CI | GitHub Actions | 每次 push / PR | `backend`（ruff + pytest）+ `frontend`（eslint + build）兩個 job |
| CD 前端 | Vercel | push main 自動部署 | ✅ 已綁定：https://green-chain-timber-wheat.vercel.app |
| CD 後端 | Render Blueprint（`render.yaml`） | push main 自動部署 | ✅ 已綁定：https://greenchain-backend-mp5a.onrender.com |

---

## A. Vercel（前端）一次性設定

1. [vercel.com](https://vercel.com) 以 GitHub 登入 → **Add New → Project** → import `greenChain_timber`
2. **Root Directory 設為 `frontend`**（monorepo 關鍵設定），Framework 自動偵測 Next.js
3. Environment Variables 填入四個（值同本機 `frontend/.env.local`）：

| 變數 | 值 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://ywjlamzobgtsbdkabdse.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_...`（publishable key） |
| `NEXT_PUBLIC_API_BASE_URL` | `https://greenchain-backend-mp5a.onrender.com` |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | `pk.` 開頭的 Mapbox public token |

4. Deploy。之後每次 push main 自動部署正式版，PR 自動出 Preview

## B. Render（後端）一次性設定

1. [render.com](https://render.com) 以 GitHub 登入 → **New → Blueprint** → 選 `greenChain_timber` repo（會讀取根目錄 `render.yaml`）
2. 首次部署會要求填四個環境變數（值同本機 `backend/.env`）：

| 變數 | 值 |
|---|---|
| `DATABASE_URL` | Supabase Session Pooler 連線字串（含 URL-encoded 密碼） |
| `SUPABASE_URL` | `https://ywjlamzobgtsbdkabdse.supabase.co` |
| `SUPABASE_JWT_SECRET` | 保留欄位（本專案用 ES256/JWKS，留空） |
| `CORS_ORIGINS` | `http://localhost:3000,http://127.0.0.1:3000,https://green-chain-timber-wheat.vercel.app` |
| `CHAIN_RPC_URL` | Amoy 主 RPC（值存於 Render 環境變數） |
| `CHAIN_RPC_URL_FALLBACK` | Amoy 備援 RPC（值存於 Render 環境變數） |
| `MINTER_PRIVATE_KEY` | 服務錢包私鑰（值存於 Render 環境變數，絕不進版控） |
| `NFT_CONTRACT_ADDRESS` | `0x3fc1c4F56F7dc4A0b52Fd9B62dC1AEECdAce44F8` |

mint 執行位置說明：NFT 鑄造由後端服務（Render）執行，上列 `CHAIN_RPC_URL` / `CHAIN_RPC_URL_FALLBACK` / `MINTER_PRIVATE_KEY` / `NFT_CONTRACT_ADDRESS` 四項齊備後端才能上鏈。

另 `render.yaml` 已內建 `CORS_ORIGIN_REGEX=https://green-chain-timber[a-z0-9-]*\.vercel\.app`，
涵蓋所有 Vercel Preview 部署的隨機子網域（Preview 網址呼叫後端不再 CORS error）。

3. Deploy 完成後記下網址（實際為 `https://greenchain-backend-mp5a.onrender.com`）

## C. 互相回填（兩邊都部署完後）（已完成，保留供重建參考）

1. Vercel → Settings → Environment Variables：把 `NEXT_PUBLIC_API_BASE_URL` 改成 Render 網址（`https://greenchain-backend-mp5a.onrender.com`）→ Redeploy
2. Render → Environment：`CORS_ORIGINS` 加上 Vercel 網域（逗號分隔），例：
   `http://localhost:3000,http://127.0.0.1:3000,https://green-chain-timber-wheat.vercel.app`
3. 開 Vercel 網址走一次登入 → 圈地 → 儀表板，確認端到端可跑

## 注意事項

- **Render 免費方案冷啟動 ~30–60 s**（規格書 R3）：已由 `.github/workflows/keepalive.yml`
  每 10 分鐘 ping `/healthz` 保持喚醒（GitHub Actions cron，取代 UptimeRobot 免建帳號）；
  cron 偶有延遲屬正常，Demo 前仍建議手動開一次網址預熱
- **秘密紅線**：所有值只存 Vercel/Render 環境變數與本機 `.env`；`render.yaml` 僅宣告變數名（`sync: false`）
- CI 的 frontend build 使用 dummy 環境變數（只為型別檢查與 prerender），正式值一律由 Vercel 注入
