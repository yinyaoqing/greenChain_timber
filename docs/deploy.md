# 部署指南（CI/CD）

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
| `SUPABASE_JWT_SECRET` | 留空（本專案用 ES256/JWKS） |
| `CORS_ORIGINS` | `http://localhost:3000,http://127.0.0.1:3000,https://green-chain-timber-wheat.vercel.app` |

3. Deploy 完成後記下網址（`https://greenchain-backend.onrender.com` 之類）

## C. 互相回填（兩邊都部署完後）

1. Vercel → Settings → Environment Variables：把 `NEXT_PUBLIC_API_BASE_URL` 改成 Render 網址 → Redeploy
2. Render → Environment：`CORS_ORIGINS` 加上 Vercel 網域（逗號分隔），例：
   `http://localhost:3000,http://127.0.0.1:3000,https://green-chain-timber.vercel.app`
3. 開 Vercel 網址走一次登入 → 圈地 → 儀表板，確認端到端可跑

## 注意事項

- **Render 免費方案冷啟動 ~30–60 s**（規格書 R3）：W4 會設 UptimeRobot 每 10 分鐘 ping `/healthz`；Demo 前先手動開一次網址預熱
- **秘密紅線**：所有值只存 Vercel/Render 環境變數與本機 `.env`；`render.yaml` 僅宣告變數名（`sync: false`）
- CI 的 frontend build 使用 dummy 環境變數（只為型別檢查與 prerender），正式值一律由 Vercel 注入
