# 🌲 綠鏈林匯 GreenChain Timber

森林碳匯數位 MRV（Measurement, Reporting, Verification）監測與存證平台 MVP——
讓森林碳匯數據**可量測、可驗證、不可竄改**。

服務對象是**企業永續部門、環境顧問與聚合單位（產銷班／合作社／公協會）**：
平台提供的是額度產生前的數據信任基礎設施，不是個人碳權變現管道。

> ⚠️ **定位與界線**
> - **碳匯 ≠ 碳權**：本平台呈現碳儲存與固碳量之量測數據，估算值不等於亦不構成經查證之減量額度。
> - **天然林不談變現**：天然林與次生林場景僅提供碳儲存監測與生態價值展示，不涉碳權變現主張。
> - **不碰額度交易**：減量額度買賣屬主管機關規範之交易行為，本平台不參與撮合與抽成。
> - **申請資格**：我國自願減量專案申請人限事業、各級政府與公協會等機構，個人不得逕行申請；小林主須經聚合單位參與。
> - 本平台為技術展示原型。

**Live Demo:** https://green-chain-timber-wheat.vercel.app
**鏈上合約:** [`0x3fc1...44F8`](https://amoy.polygonscan.com/address/0x3fc1c4F56F7dc4A0b52Fd9B62dC1AEECdAce44F8)（Polygon Amoy 測試網）

## 核心流程

地圖圈繪林區 → PostGIS 空間防重疊檢查 → 農業部公式自動估算固碳量（當年 + 未來 5 年）
→ ERC-721 NFT 上鏈存證（幾何 SHA-256 指紋 + 碳噸數）→ 監測儀表板展示與鏈上驗證

## 系統架構

```
┌─────────────────────────────────────────────────────┐
│  Next.js 16 + Tailwind + Mapbox GL + Recharts        │
│  Vercel · green-chain-timber-wheat.vercel.app        │
└──────────────┬──────────────────────────────────────┘
               │ HTTPS / JSON (Supabase JWT, ES256/JWKS)
┌──────────────▼──────────────────────────────────────┐
│  FastAPI (Python 3.12) · Render                      │
│  ├─ /api/forest         建檔→防重疊→估算→入庫→觸發上鏈 │
│  ├─ carbon_calc         官方公式估算（MOA-2024-v1，候選係數）│
│  ├─ geo_service         幾何驗證/正規化/SHA-256       │
│  └─ chain_service       Web3.py Mint + 重試 + 回寫    │
└─────┬────────────────────────────┬──────────────────┘
      │ asyncpg                     │ JSON-RPC
┌─────▼──────────────┐   ┌─────────▼───────────────────┐
│ Supabase            │   │ Polygon Amoy (chainId 80002) │
│ PostgreSQL + PostGIS│   │ GreenAssetNFT (ERC-721)      │
│ + Auth (ES256)      │   │ geoHash 唯一性防重複申報      │
└─────────────────────┘   └──────────────────────────────┘
```

## Monorepo 結構

| 目錄 | 內容 | 工具鏈 |
|---|---|---|
| `backend/` | FastAPI + asyncpg + web3.py | uv（Python 3.12） |
| `frontend/` | Next.js App Router | npm（Node 20） |
| `contracts/` | GreenAssetNFT + Hardhat 測試/部署 | npm（Hardhat 2.x） |
| `docs/` | 規格書、開發計畫、devlog、部署指南、驗收報告 | — |

## 本機啟動

前置：Node 20、Python 3.12、[uv](https://docs.astral.sh/uv/)、各服務帳號（Supabase / Mapbox）。

### 後端

```bash
cd backend
cp .env.example .env        # 填 DATABASE_URL / SUPABASE_URL（chain 變數可留空）
uv sync
uv run python scripts/apply_schema.py   # 首次：建三表 + PostGIS 索引
uv run uvicorn app.main:app --port 8000
```

### 前端

```bash
cd frontend
cp .env.local.example .env.local        # 填四個 NEXT_PUBLIC_ 變數
npm install
npm run dev                             # http://localhost:3000
```

### 合約（選配，本機不部署也能跑核心流程）

```bash
cd contracts
npm install
npx hardhat test                        # 8 個合約測試
npm run deploy:amoy                     # 需 .env 私鑰 + Amoy 測試幣
```

## 測試

| 範圍 | 指令 | 說明 |
|---|---|---|
| 後端單元 | `cd backend && uv run pytest` | 85 tests（其中 6 個整合測試需 `TEST_DATABASE_URL`，未設定時自動 skip） |
| 合約 | `cd contracts && npx hardhat test` | mint/權限/geoHash 唯一性/tokenURI |
| 前端 | `cd frontend && npm run lint && npm run build` | 型別檢查 + prerender |
| AT-6 雜湊驗證 | `cd backend && uv run python scripts/verify_hash.py` | DB 重算 vs 鏈上 geoHash |

CI（GitHub Actions）於每次 push 跑三個 job：backend（ruff+pytest）、frontend（eslint+build）、contracts（hardhat test）。

## 部署

見 [docs/engineering/deploy.md](docs/engineering/deploy.md)——Vercel（前端）+ Render Blueprint（後端）+ keepalive workflow。
環境變數清單見各目錄 `.env.example`。

## 里程碑

| Tag | 內容 |
|---|---|
| `m1-backend` | 後端 + 空間資料庫（防重疊/估算/JWT/JWKS） |
| `m2-frontend` | 3D 圈繪建檔 + 儀表板（手動 E2E 6/6） |
| `m3-chain` | 合約部署 + 上鏈全通（AT-5/AT-6 過） |
| `m4-release` | 正式環境驗收 + 展示就緒 |

## 已知限制

- 估算係數為文獻常見值 placeholder（`MOA-2024-v1`），正式係數待農業部文獻查證
- 單一角色、無 RBAC/RLS；額度交易、遙測判釋、主網部署均為 out of scope（見規格書 §1.4）
- Amoy 為測試網，NFT 不具真實資產價值
