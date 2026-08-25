# 綠鏈林匯 Week 2 — 前端地圖與資料串接 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成里程碑 M2 — 登入 → 3D 地圖圈地 → 填表送出 → 看到 6 年固碳曲線，全程在瀏覽器完成；重疊時地圖紅色高亮衝突區；儀表板清單 + 詳情頁可瀏覽。

**Architecture:** Next.js 15（App Router, TypeScript）+ Tailwind CSS，全 client-side 渲染地圖（mapbox-gl 僅瀏覽器可用，動態載入）。Supabase Auth 走 supabase-js 瀏覽器端 session（ES256 token，後端以 JWKS 驗證——W1 已實測通過）；API 呼叫統一經 `lib/api.ts` typed client，回傳 discriminated union 處理 201/409/422/401 四種契約。

**Tech Stack:** Next.js 15、TypeScript、Tailwind CSS v4、@supabase/supabase-js v2、mapbox-gl v3、@mapbox/mapbox-gl-draw、@turf/area、recharts v2

**對應文件:** 《專案規格書 v1.0》FR-1 / FR-2 / FR-6、《開發計畫 v1.0》T2.1–T2.9

## Global Constraints

- **已實測的 API 契約（W1 M1 驗證，不得假設其他形狀）**：
  - `POST /api/forest` 201 → `{plot: {id, area_ha, status, created_at}, estimates: [{year_offset, co2e_tons}] x6, chain: {status: "pending"}}`
  - 409 → `{detail: {conflicts: [{plot_id, overlap_ha, overlap_geojson}]}}`（`overlap_geojson` 為 Polygon 或 MultiPolygon）
  - 422 幾何/面積 → `{detail: {code, message}}`（code ∈ invalid_type, holes_not_allowed, too_few_vertices, too_many_vertices, self_intersection, out_of_taiwan_bbox, area_out_of_range）；422 欄位 → FastAPI 標準 `{detail: [{loc, msg, ...}]}`
  - `GET /api/forest` → `[{id, name, species, area_ha, status, co2e_current, geometry_simplified, created_at}]`
  - `GET /api/forest/{id}` → 完整欄位 + `estimates[]` + `chain_record`（W2 恆為 null）
- 樹種代碼：`'taiwania'`（台灣杉）、`'acacia'`（相思樹）、`'fraxinus'`（光臘樹）
- 前端阻擋規則（與後端一致）：面積 0.1–1,000 ha、頂點 ≤ 500、avg_age 1–100、density 100–10,000
- 預設視角：宜蘭延文實驗林場周邊 `[121.754, 24.723]`，zoom 13.5、pitch 60
- 環境變數（`frontend/.env.local`，不進版控）：`NEXT_PUBLIC_SUPABASE_URL=https://ywjlamzobgtsbdkabdse.supabase.co`、`NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_3chOnxSQqBHwYHcxmdb6zg_beNVhyTX`、`NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000`、`NEXT_PUBLIC_MAPBOX_TOKEN`（**使用者前置作業：至 mapbox.com 註冊取得**）
- 全站 footer 免責標示（一字不差）：`本平台為技術展示原型，估算值不構成經查證之碳權`；估算結果旁標示：`示範估算值，非查證碳權`
- **不做前端自動化測試**（開發計畫 §7 明確排除）：每任務驗證 = `npm run build`（含型別檢查）通過 + 手動 DoD 清單；手動驗證時後端需在本機執行（`cd backend; uv run uvicorn app.main:app --port 8000`）
- Commit 訊息格式：`T2.x: <內容>`；每任務一 commit；main 保持可部署
- 指令工作目錄除特別註明外皆為 `frontend/`（Windows）

---

### Task 1: Next.js 骨架、全域 Layout 與 Landing Page（對應 T2.1）

**Files:**
- Create: `frontend/`（create-next-app 產生）
- Create: `frontend/.env.local.example`
- Create: `frontend/.env.local`（從 example 複製後填值——Mapbox token 若未就緒先留空，Task 4 前補上）
- Modify: `frontend/app/layout.tsx`
- Modify: `frontend/app/page.tsx`
- Modify: `frontend/app/globals.css`（保留 create-next-app 產物即可，不動）

**Interfaces:**
- Consumes: 無
- Produces: 頁面骨架 `/`、`/login`、`/draw`、`/dashboard`、`/dashboard/[id]`（後四者由後續任務建立）；`SITE_DISCLAIMER` 常數；全域 Header/Footer

- [ ] **Step 1: 建立 Next.js 專案**

於 repo 根目錄執行：

```powershell
npx create-next-app@latest frontend --typescript --tailwind --app --no-src-dir --import-alias "@/*" --eslint --use-npm --yes
cd frontend
npm install @supabase/supabase-js mapbox-gl @mapbox/mapbox-gl-draw @turf/area recharts
npm install -D @types/mapbox__mapbox-gl-draw
```

- [ ] **Step 2: 建立 .env.local.example 與 .env.local**

`frontend/.env.local.example`：

```bash
NEXT_PUBLIC_SUPABASE_URL=https://ywjlamzobgtsbdkabdse.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_3chOnxSQqBHwYHcxmdb6zg_beNVhyTX
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
# 至 https://account.mapbox.com/ 取得（Default public token 即可）
NEXT_PUBLIC_MAPBOX_TOKEN=pk.your-mapbox-token
```

複製為 `.env.local` 並確認 `frontend/.gitignore`（create-next-app 產生）含 `.env*.local`（anon key 為公開金鑰，入 example 無妨；Mapbox token 只進 `.env.local`）。

- [ ] **Step 3: 全域 layout（Header + Footer 免責標示）**

`frontend/app/layout.tsx`：

```tsx
import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";

export const SITE_DISCLAIMER = "本平台為技術展示原型，估算值不構成經查證之碳權";

export const metadata: Metadata = {
  title: "綠鏈林匯 GreenChain Timber",
  description: "數位 MRV 碳權透明化平台——圈地、估算、上鏈、驗證",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body className="flex min-h-screen flex-col bg-stone-50 text-stone-900 antialiased">
        <Header />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-stone-200 bg-white py-3 text-center text-xs text-stone-500">
          {SITE_DISCLAIMER}
        </footer>
      </body>
    </html>
  );
}
```

`frontend/components/Header.tsx`（登入狀態按鈕先佔位，Task 3 完成後自動生效——本任務先建立含 AuthButton 的完整版，AuthButton 於 Task 3 實作，此處以最小 stub 建立避免 build 失敗）：

```tsx
import Link from "next/link";
import AuthButton from "@/components/AuthButton";

export default function Header() {
  return (
    <header className="sticky top-0 z-20 border-b border-stone-200 bg-white/90 backdrop-blur">
      <nav className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
        <Link href="/" className="text-lg font-bold text-emerald-800">
          🌲 綠鏈林匯
        </Link>
        <Link href="/draw" className="text-sm text-stone-600 hover:text-emerald-700">
          圈地申報
        </Link>
        <Link href="/dashboard" className="text-sm text-stone-600 hover:text-emerald-700">
          企業儀表板
        </Link>
        <div className="ml-auto">
          <AuthButton />
        </div>
      </nav>
    </header>
  );
}
```

`frontend/components/AuthButton.tsx`（Task 3 會整檔改寫為真實登入狀態；本任務 stub）：

```tsx
"use client";

import Link from "next/link";

export default function AuthButton() {
  return (
    <Link
      href="/login"
      className="rounded-md bg-emerald-700 px-3 py-1.5 text-sm text-white hover:bg-emerald-800"
    >
      登入
    </Link>
  );
}
```

- [ ] **Step 4: Landing Page**

`frontend/app/page.tsx`：

```tsx
import Link from "next/link";

const STEPS = [
  { icon: "🗺️", title: "圈選林地", desc: "3D 衛星地圖上逐點圈出林區邊界" },
  { icon: "🧮", title: "自動估算", desc: "農業部公式估算當年與未來 5 年固碳量" },
  { icon: "⛓️", title: "上鏈存證", desc: "幾何指紋與碳噸數鑄造 NFT，防重複申報" },
  { icon: "📊", title: "透明驗證", desc: "企業儀表板檢視曲線與鏈上交易紀錄" },
];

export default function LandingPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <section className="text-center">
        <h1 className="text-4xl font-bold text-emerald-900">
          讓每一片森林的碳匯，都可量測、可驗證、不可竄改
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-stone-600">
          綠鏈林匯是數位 MRV 碳權透明化平台：地圖圈選林地、空間防重疊檢查、
          固碳量自動估算、區塊鏈存證，一站完成。
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <Link
            href="/draw"
            className="rounded-lg bg-emerald-700 px-6 py-3 font-medium text-white hover:bg-emerald-800"
          >
            開始圈地申報
          </Link>
          <Link
            href="/dashboard"
            className="rounded-lg border border-emerald-700 px-6 py-3 font-medium text-emerald-700 hover:bg-emerald-50"
          >
            瀏覽企業儀表板
          </Link>
        </div>
      </section>
      <section className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s) => (
          <div key={s.title} className="rounded-xl border border-stone-200 bg-white p-6">
            <div className="text-3xl">{s.icon}</div>
            <h3 className="mt-3 font-semibold">{s.title}</h3>
            <p className="mt-1 text-sm text-stone-600">{s.desc}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
```

- [ ] **Step 5: 驗證與 Commit**

Run: `npm run build`
Expected: build 成功、無型別錯誤。

Run: `npm run dev` 後開 http://localhost:3000
Expected: Landing 顯示 hero + 四步驟卡片；Header 三連結；Footer 免責標示一字不差。

```powershell
git add frontend/ ; git commit -m "T2.1: Next.js 骨架 + Layout/Header/Footer + Landing Page"
```

---

### Task 2: 型別定義與 API Client（對應 T2.5 前置）

**Files:**
- Create: `frontend/lib/types.ts`
- Create: `frontend/lib/supabase.ts`
- Create: `frontend/lib/api.ts`

**Interfaces:**
- Consumes: 環境變數
- Produces（後續所有任務依賴，簽名固定）:
  - `types.ts`：`Species`、`SPECIES_LABEL`、`PlotStatus`、`STATUS_LABEL`、`YearEstimate`、`SubmitSuccess`、`Conflict`、`PlotListItem`、`PlotDetail`、`ChainRecord`、`ForestSubmission`
  - `supabase.ts`：`export const supabase`（瀏覽器單例 client）
  - `api.ts`：`submitForest(body: ForestSubmission): Promise<SubmitResult>`、`listForest(): Promise<PlotListItem[]>`、`getForest(id: string): Promise<PlotDetail | null>`；`SubmitResult` discriminated union（kind: `"success" | "overlap" | "invalid" | "unauthorized" | "error"`）；`listForest`/`getForest` 未登入或非 2xx 時 throw `Error`

- [ ] **Step 1: types.ts**

```ts
export type Species = "taiwania" | "acacia" | "fraxinus";

export const SPECIES_LABEL: Record<Species, string> = {
  taiwania: "台灣杉",
  acacia: "相思樹",
  fraxinus: "光臘樹",
};

export type PlotStatus = "active" | "chain_pending" | "on_chain" | "rejected";

export const STATUS_LABEL: Record<PlotStatus, string> = {
  active: "已建檔",
  chain_pending: "上鏈處理中",
  on_chain: "已上鏈",
  rejected: "已駁回",
};

export interface YearEstimate {
  year_offset: number;
  co2e_tons: number;
}

export interface SubmitSuccess {
  plot: { id: string; area_ha: number; status: PlotStatus; created_at: string };
  estimates: YearEstimate[];
  chain: { status: string };
}

export interface Conflict {
  plot_id: string;
  overlap_ha: number;
  overlap_geojson: GeoJSON.Polygon | GeoJSON.MultiPolygon;
}

export interface PlotListItem {
  id: string;
  name: string;
  species: Species;
  area_ha: number;
  status: PlotStatus;
  co2e_current: number | null;
  geometry_simplified: GeoJSON.Polygon;
  created_at: string;
}

export interface ChainRecord {
  contract_address: string | null;
  token_id: number | null;
  tx_hash: string | null;
  chain_id: number;
  minted_at: string | null;
}

export interface PlotDetail {
  id: string;
  owner_id: string;
  name: string;
  species: Species;
  avg_age: number;
  density: number;
  area_ha: number;
  geo_hash: string;
  status: PlotStatus;
  created_at: string;
  geometry: GeoJSON.Polygon;
  estimates: { formula_version: string; year_offset: number; co2e_tons: number }[];
  chain_record: ChainRecord | null;
}

export interface ForestSubmission {
  name: string;
  species: Species;
  avg_age: number;
  density: number;
  geometry: GeoJSON.Polygon;
}
```

- [ ] **Step 2: supabase.ts**

```ts
import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);
```

- [ ] **Step 3: api.ts**

```ts
import { supabase } from "@/lib/supabase";
import type { Conflict, ForestSubmission, PlotDetail, PlotListItem, SubmitSuccess } from "@/lib/types";

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL!;

export type SubmitResult =
  | { kind: "success"; data: SubmitSuccess }
  | { kind: "overlap"; conflicts: Conflict[] }
  | { kind: "invalid"; code: string | null; message: string }
  | { kind: "unauthorized" }
  | { kind: "error"; message: string };

async function accessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

/** 422 detail 兩種形狀：幾何/面積 {code,message}；欄位驗證 FastAPI 標準 [{loc,msg}] */
function parse422(detail: unknown): { code: string | null; message: string } {
  if (Array.isArray(detail)) {
    const msgs = detail.map((d) => {
      const loc = Array.isArray(d?.loc) ? d.loc.filter((p: unknown) => p !== "body").join(".") : "";
      return loc ? `${loc}: ${d?.msg ?? ""}` : String(d?.msg ?? "");
    });
    return { code: null, message: msgs.join("；") || "欄位驗證失敗" };
  }
  const obj = detail as { code?: string; message?: string } | null;
  return { code: obj?.code ?? null, message: obj?.message ?? "資料驗證失敗" };
}

export async function submitForest(body: ForestSubmission): Promise<SubmitResult> {
  const token = await accessToken();
  if (!token) return { kind: "unauthorized" };
  let res: Response;
  try {
    res = await fetch(`${BASE}/api/forest`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return { kind: "error", message: "無法連線後端服務，請確認 API 是否啟動" };
  }
  if (res.status === 201) return { kind: "success", data: (await res.json()) as SubmitSuccess };
  const payload = await res.json().catch(() => null);
  if (res.status === 409) {
    const conflicts = (payload?.detail?.conflicts ?? []) as Conflict[];
    return { kind: "overlap", conflicts };
  }
  if (res.status === 422) return { kind: "invalid", ...parse422(payload?.detail) };
  if (res.status === 401) return { kind: "unauthorized" };
  return { kind: "error", message: `伺服器錯誤（HTTP ${res.status}）` };
}

async function authedGet<T>(path: string): Promise<{ status: number; data: T | null }> {
  const token = await accessToken();
  if (!token) throw new Error("未登入");
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 404) return { status: 404, data: null };
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return { status: res.status, data: (await res.json()) as T };
}

export async function listForest(): Promise<PlotListItem[]> {
  const { data } = await authedGet<PlotListItem[]>("/api/forest");
  return data ?? [];
}

export async function getForest(id: string): Promise<PlotDetail | null> {
  const { data } = await authedGet<PlotDetail>(`/api/forest/${id}`);
  return data;
}
```

- [ ] **Step 4: 驗證與 Commit**

Run: `npm run build`
Expected: 成功（GeoJSON 全域型別由 mapbox-gl 依賴的 @types/geojson 提供；若型別缺失，`npm i -D @types/geojson` 後重跑）。

```powershell
git add frontend/lib/ ; git commit -m "T2.5: 型別定義 + typed API client（201/409/422/401 契約處理）"
```

---

### Task 3: Supabase Auth — 登入頁、Session Hook、路由守衛（對應 T2.2，FR-1.1–1.3）

**Files:**
- Create: `frontend/hooks/useSession.ts`
- Create: `frontend/components/AuthGuard.tsx`
- Create: `frontend/app/login/page.tsx`
- Modify: `frontend/components/AuthButton.tsx`（整檔改寫 Task 1 的 stub）

**Interfaces:**
- Consumes: `lib/supabase.ts`
- Produces:
  - `useSession(): { session: Session | null; loading: boolean }`
  - `<AuthGuard>{children}</AuthGuard>`：loading 時顯示載入中；無 session 導向 `/login`；有 session 渲染 children
  - `/login`：Email + 密碼登入／註冊切換；成功後導向 `/draw`

- [ ] **Step 1: useSession.ts**

```ts
"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  return { session, loading };
}
```

- [ ] **Step 2: AuthGuard.tsx**

```tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/hooks/useSession";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { session, loading } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !session) router.replace("/login");
  }, [loading, session, router]);

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-stone-500">載入中…</div>;
  }
  if (!session) return null;
  return <>{children}</>;
}
```

- [ ] **Step 3: 登入頁 app/login/page.tsx**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } =
      mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.replace("/draw");
  }

  return (
    <div className="mx-auto mt-16 max-w-sm rounded-xl border border-stone-200 bg-white p-8">
      <h1 className="text-xl font-bold text-emerald-900">
        {mode === "signin" ? "登入" : "註冊"}
      </h1>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="w-full rounded-md border border-stone-300 px-3 py-2"
        />
        <input
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="密碼（至少 6 碼）"
          className="w-full rounded-md border border-stone-300 px-3 py-2"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md bg-emerald-700 py-2 text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          {busy ? "處理中…" : mode === "signin" ? "登入" : "註冊"}
        </button>
      </form>
      <button
        onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        className="mt-4 text-sm text-emerald-700 underline"
      >
        {mode === "signin" ? "沒有帳號？註冊" : "已有帳號？登入"}
      </button>
    </div>
  );
}
```

- [ ] **Step 4: AuthButton.tsx 改寫為真實登入狀態**

```tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/hooks/useSession";

export default function AuthButton() {
  const { session, loading } = useSession();
  const router = useRouter();

  if (loading) return <span className="text-sm text-stone-400">…</span>;

  if (!session) {
    return (
      <Link
        href="/login"
        className="rounded-md bg-emerald-700 px-3 py-1.5 text-sm text-white hover:bg-emerald-800"
      >
        登入
      </Link>
    );
  }
  return (
    <div className="flex items-center gap-3">
      <span className="hidden text-xs text-stone-500 sm:inline">{session.user.email}</span>
      <button
        onClick={async () => {
          await supabase.auth.signOut();
          router.replace("/");
        }}
        className="rounded-md border border-stone-300 px-3 py-1.5 text-sm hover:bg-stone-100"
      >
        登出
      </button>
    </div>
  );
}
```

- [ ] **Step 5: 驗證與 Commit**

Run: `npm run build` → 成功。

手動 DoD（後端啟動中）：`/login` 以測試帳號（yinyaoqing@protonmail.com）登入成功導向 `/draw`（404 屬正常，Task 6 建立）；Header 顯示 email + 登出；登出後回 Landing。

```powershell
git add frontend/ ; git commit -m "T2.2: Supabase Auth 登入/註冊 + useSession + AuthGuard"
```

---

### Task 4: Mapbox 3D 地圖元件（對應 T2.3，FR-2.1）

**前置（人工）：** `frontend/.env.local` 的 `NEXT_PUBLIC_MAPBOX_TOKEN` 必須已填入有效 token。

**Files:**
- Create: `frontend/components/MapView.tsx`

**Interfaces:**
- Consumes: `NEXT_PUBLIC_MAPBOX_TOKEN`
- Produces: `<MapView onReady={(map) => ...} className? />`——建立 satellite-streets 3D 地形地圖（宜蘭視角、NavigationControl、terrain exaggeration 1.4），style 載入完成後回呼 `onReady(map)`。**使用端必須以 `dynamic(() => import(...), { ssr: false })` 載入**（mapbox-gl 無法 SSR）

- [ ] **Step 1: MapView.tsx**

```tsx
"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

// 預設視角：宜蘭延文實驗林場周邊
export const DEFAULT_CENTER: [number, number] = [121.754, 24.723];

export default function MapView({
  onReady,
  className,
}: {
  onReady?: (map: mapboxgl.Map) => void;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    if (!containerRef.current) return;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/satellite-streets-v12",
      center: DEFAULT_CENTER,
      zoom: 13.5,
      pitch: 60,
      bearing: -20,
      antialias: true,
    });
    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), "top-right");
    map.on("style.load", () => {
      map.addSource("mapbox-dem", {
        type: "raster-dem",
        url: "mapbox://mapbox.mapbox-terrain-dem-v1",
        tileSize: 512,
        maxzoom: 14,
      });
      map.setTerrain({ source: "mapbox-dem", exaggeration: 1.4 });
      onReadyRef.current?.(map);
    });
    return () => map.remove();
  }, []);

  return <div ref={containerRef} className={className ?? "h-full w-full"} />;
}
```

- [ ] **Step 2: 驗證與 Commit**

Run: `npm run build` → 成功。

手動 DoD：任一頁暫掛 `<MapView>`（或直接於 Task 6 驗證）可傾斜旋轉、宜蘭 3D 地形正常渲染、右上導航控制可用。

```powershell
git add frontend/components/MapView.tsx ; git commit -m "T2.3: Mapbox 3D 地形地圖元件（satellite + terrain + 宜蘭視角）"
```

---

### Task 5: 呈現元件 — 固碳曲線與狀態徽章（對應 T2.7，FR-6.3 / FR-6.1）

**Files:**
- Create: `frontend/components/CarbonChart.tsx`
- Create: `frontend/components/StatusBadge.tsx`

**Interfaces:**
- Consumes: `lib/types.ts`
- Produces:
  - `<CarbonChart estimates={YearEstimate[]} />`：X 軸年度（當年起 6 年）、Y 軸噸 CO₂e/年、hover tooltip 精確值
  - `<StatusBadge status={PlotStatus} />`：含 `chain_pending` 動畫圓點

- [ ] **Step 1: CarbonChart.tsx**

```tsx
"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { YearEstimate } from "@/lib/types";

export default function CarbonChart({ estimates }: { estimates: YearEstimate[] }) {
  const baseYear = new Date().getFullYear();
  const data = [...estimates]
    .sort((a, b) => a.year_offset - b.year_offset)
    .map((e) => ({ year: `${baseYear + e.year_offset}`, co2e: e.co2e_tons }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
          <XAxis dataKey="year" tick={{ fontSize: 12 }} />
          <YAxis
            tick={{ fontSize: 12 }}
            label={{ value: "噸 CO₂e/年", angle: -90, position: "insideLeft", fontSize: 12 }}
          />
          <Tooltip formatter={(v: number) => [`${v.toFixed(4)} 噸 CO₂e`, "年固碳量"]} />
          <Line
            type="monotone"
            dataKey="co2e"
            stroke="#047857"
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 2: StatusBadge.tsx**

```tsx
import type { PlotStatus } from "@/lib/types";
import { STATUS_LABEL } from "@/lib/types";

const STYLE: Record<PlotStatus, string> = {
  active: "bg-stone-100 text-stone-700",
  chain_pending: "bg-amber-100 text-amber-800",
  on_chain: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-700",
};

export default function StatusBadge({ status }: { status: PlotStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLE[status]}`}
    >
      {status === "chain_pending" && (
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
      )}
      {STATUS_LABEL[status]}
    </span>
  );
}
```

- [ ] **Step 3: 驗證與 Commit**

Run: `npm run build` → 成功。

```powershell
git add frontend/components/ ; git commit -m "T2.7: Recharts 固碳曲線 + 狀態徽章元件"
```

---

### Task 6: 圈地頁 — 繪製工具與即時面積（對應 T2.4，FR-2.2 / FR-2.4）

**Files:**
- Create: `frontend/components/DrawPanel.tsx`
- Create: `frontend/app/draw/page.tsx`

**Interfaces:**
- Consumes: `MapView`、`AuthGuard`、`@turf/area`、mapbox-gl-draw
- Produces:
  - `/draw` 頁：AuthGuard 保護；地圖 + 繪製工具（逐點點擊、雙擊閉合、頂點拖曳、垃圾桶刪除）；即時面積（ha）顯示；面積 < 0.1 或 > 1,000 ha 或頂點 > 500 時顯示錯誤且不可進入表單
  - `DrawPanel` 內部狀態流：`idle → drawing → ready(geometry, areaHa) → submitting → done | conflict | invalid`（Task 7 完成表單與送出；本任務先做到 `ready` 狀態顯示面積與「填寫申報資料」按鈕 stub）
  - Produces for Task 7: `DrawPanel` 已 export；`draw` 實例透過 ref 保存；`clearConflicts(map)` 與 `showConflicts(map, conflicts)` 兩個模組函式（本任務一併實作，Task 7 呼叫）

- [ ] **Step 1: DrawPanel.tsx（含衝突圖層函式，表單送出留 stub）**

```tsx
"use client";

import { useCallback, useRef, useState } from "react";
import type mapboxgl from "mapbox-gl";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";
import turfArea from "@turf/area";
import MapView from "@/components/MapView";
import PlotForm from "@/components/PlotForm";
import type { Conflict } from "@/lib/types";

const MIN_AREA_HA = 0.1;
const MAX_AREA_HA = 1000;
const MAX_VERTICES = 500;

const CONFLICT_SOURCE = "conflict-areas";

/** 409 衝突區紅色高亮（FR-2.6）。Task 7 於送出流程呼叫 */
export function showConflicts(map: mapboxgl.Map, conflicts: Conflict[]) {
  clearConflicts(map);
  map.addSource(CONFLICT_SOURCE, {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: conflicts.map((c) => ({
        type: "Feature" as const,
        properties: { plot_id: c.plot_id, overlap_ha: c.overlap_ha },
        geometry: c.overlap_geojson,
      })),
    },
  });
  map.addLayer({
    id: `${CONFLICT_SOURCE}-fill`,
    type: "fill",
    source: CONFLICT_SOURCE,
    paint: { "fill-color": "#dc2626", "fill-opacity": 0.45 },
  });
  map.addLayer({
    id: `${CONFLICT_SOURCE}-line`,
    type: "line",
    source: CONFLICT_SOURCE,
    paint: { "line-color": "#b91c1c", "line-width": 2 },
  });
}

export function clearConflicts(map: mapboxgl.Map) {
  for (const id of [`${CONFLICT_SOURCE}-fill`, `${CONFLICT_SOURCE}-line`]) {
    if (map.getLayer(id)) map.removeLayer(id);
  }
  if (map.getSource(CONFLICT_SOURCE)) map.removeSource(CONFLICT_SOURCE);
}

interface DrawState {
  geometry: GeoJSON.Polygon | null;
  areaHa: number;
  vertexCount: number;
}

export default function DrawPanel() {
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const drawRef = useRef<MapboxDraw | null>(null);
  const [drawState, setDrawState] = useState<DrawState>({
    geometry: null,
    areaHa: 0,
    vertexCount: 0,
  });
  const [formOpen, setFormOpen] = useState(false);

  const syncFromDraw = useCallback(() => {
    const draw = drawRef.current;
    if (!draw) return;
    const features = draw.getAll().features;
    const poly = features.find((f) => f.geometry.type === "Polygon");
    if (!poly) {
      setDrawState({ geometry: null, areaHa: 0, vertexCount: 0 });
      setFormOpen(false);
      return;
    }
    const geometry = poly.geometry as GeoJSON.Polygon;
    const ring = geometry.coordinates[0] ?? [];
    const vertexCount = Math.max(0, ring.length - 1); // 閉合點不計
    const areaHa = turfArea(poly as GeoJSON.Feature) / 10_000;
    setDrawState({ geometry, areaHa, vertexCount });
  }, []);

  const onMapReady = useCallback(
    (map: mapboxgl.Map) => {
      mapRef.current = map;
      const draw = new MapboxDraw({
        displayControlsDefault: false,
        controls: { polygon: true, trash: true },
      });
      map.addControl(draw, "top-left");
      drawRef.current = draw;
      map.on("draw.create", () => {
        // 一次僅允許一個多邊形：保留最新
        const all = draw.getAll().features;
        if (all.length > 1) {
          for (const f of all.slice(0, -1)) draw.delete(String(f.id));
        }
        clearConflicts(map);
        syncFromDraw();
      });
      map.on("draw.update", () => {
        clearConflicts(map);
        syncFromDraw();
      });
      map.on("draw.delete", () => {
        clearConflicts(map);
        syncFromDraw();
      });
    },
    [syncFromDraw],
  );

  const { geometry, areaHa, vertexCount } = drawState;
  const areaError =
    geometry === null
      ? null
      : areaHa < MIN_AREA_HA
        ? `面積 ${areaHa.toFixed(4)} ha 小於下限 ${MIN_AREA_HA} ha`
        : areaHa > MAX_AREA_HA
          ? `面積 ${areaHa.toFixed(1)} ha 超過上限 ${MAX_AREA_HA} ha`
          : vertexCount > MAX_VERTICES
            ? `頂點數 ${vertexCount} 超過上限 ${MAX_VERTICES}`
            : null;
  const ready = geometry !== null && areaError === null;

  function resetDrawing() {
    drawRef.current?.deleteAll();
    if (mapRef.current) clearConflicts(mapRef.current);
    setDrawState({ geometry: null, areaHa: 0, vertexCount: 0 });
    setFormOpen(false);
  }

  return (
    <div className="relative h-[calc(100vh-8.5rem)]">
      <MapView onReady={onMapReady} className="h-full w-full" />

      {/* 左下：面積資訊卡 */}
      <div className="absolute bottom-4 left-4 z-10 w-72 rounded-lg bg-white/95 p-4 shadow-lg">
        {geometry === null ? (
          <p className="text-sm text-stone-600">
            點選左上 <span className="font-mono">▢</span> 多邊形工具，逐點圈選林地邊界，
            雙擊閉合；可拖曳頂點修改、垃圾桶刪除重繪。
          </p>
        ) : (
          <>
            <p className="text-sm text-stone-500">圈選面積</p>
            <p className="text-2xl font-bold text-emerald-800">
              {areaHa.toFixed(4)} <span className="text-base font-normal">公頃</span>
            </p>
            <p className="mt-1 text-xs text-stone-500">頂點數 {vertexCount}</p>
            {areaError && <p className="mt-2 text-sm text-red-600">{areaError}</p>}
            <div className="mt-3 flex gap-2">
              <button
                disabled={!ready}
                onClick={() => setFormOpen(true)}
                className="flex-1 rounded-md bg-emerald-700 py-2 text-sm text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                填寫申報資料
              </button>
              <button
                onClick={resetDrawing}
                className="rounded-md border border-stone-300 px-3 py-2 text-sm hover:bg-stone-100"
              >
                重繪
              </button>
            </div>
          </>
        )}
      </div>

      {/* 右側：申報表單（Task 7 實作 PlotForm 內容） */}
      {formOpen && geometry && (
        <div className="absolute right-4 top-4 z-10 w-80">
          <PlotForm
            geometry={geometry}
            areaHa={areaHa}
            map={mapRef.current}
            onReset={resetDrawing}
          />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: PlotForm 最小 stub（Task 7 整檔改寫）**

`frontend/components/PlotForm.tsx`：

```tsx
"use client";

import type mapboxgl from "mapbox-gl";

export interface PlotFormProps {
  geometry: GeoJSON.Polygon;
  areaHa: number;
  map: mapboxgl.Map | null;
  onReset: () => void;
}

export default function PlotForm({ areaHa }: PlotFormProps) {
  return (
    <div className="rounded-lg bg-white/95 p-4 shadow-lg">
      <p className="text-sm text-stone-500">申報表單（Task 7 實作）｜{areaHa.toFixed(4)} ha</p>
    </div>
  );
}
```

- [ ] **Step 3: app/draw/page.tsx**

```tsx
"use client";

import dynamic from "next/dynamic";
import AuthGuard from "@/components/AuthGuard";

const DrawPanel = dynamic(() => import("@/components/DrawPanel"), {
  ssr: false,
  loading: () => (
    <div className="flex h-96 items-center justify-center text-stone-500">地圖載入中…</div>
  ),
});

export default function DrawPage() {
  return (
    <AuthGuard>
      <DrawPanel />
    </AuthGuard>
  );
}
```

- [ ] **Step 4: 驗證與 Commit**

Run: `npm run build` → 成功。

手動 DoD：登入後 `/draw`——多邊形工具逐點繪製、雙擊閉合後面積即時顯示；拖曳頂點面積更新；圈 <0.1 ha 顯示錯誤且按鈕 disabled；垃圾桶刪除後回提示狀態；「填寫申報資料」開啟 stub 卡片。

```powershell
git add frontend/ ; git commit -m "T2.4: mapbox-gl-draw 圈選 + Turf 即時面積 + 範圍阻擋"
```

---

### Task 7: 申報表單與三種回應處理（對應 T2.5 / T2.6，FR-2.3 / FR-2.6）

**Files:**
- Modify: `frontend/components/PlotForm.tsx`（整檔改寫 Task 6 stub）

**Interfaces:**
- Consumes: `submitForest`、`showConflicts`/`clearConflicts`（自 `DrawPanel` import）、`CarbonChart`、`SPECIES_LABEL`
- Produces: 完整申報流程——表單驗證 → 送出 → 201 顯示估算結果卡（含曲線 + 「示範估算值，非查證碳權」標示 + 儀表板連結）；409 地圖紅色高亮 + 衝突面積說明；422 顯示錯誤訊息；401 導登入

- [ ] **Step 1: PlotForm.tsx 整檔改寫**

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type mapboxgl from "mapbox-gl";
import { submitForest } from "@/lib/api";
import type { Species, SubmitSuccess } from "@/lib/types";
import { SPECIES_LABEL } from "@/lib/types";
import { clearConflicts, showConflicts } from "@/components/DrawPanel";
import CarbonChart from "@/components/CarbonChart";

export interface PlotFormProps {
  geometry: GeoJSON.Polygon;
  areaHa: number;
  map: mapboxgl.Map | null;
  onReset: () => void;
}

type Phase =
  | { kind: "editing" }
  | { kind: "submitting" }
  | { kind: "done"; data: SubmitSuccess }
  | { kind: "conflict"; totalOverlapHa: number; count: number }
  | { kind: "invalid"; message: string };

export default function PlotForm({ geometry, areaHa, map, onReset }: PlotFormProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [species, setSpecies] = useState<Species>("taiwania");
  const [avgAge, setAvgAge] = useState(15);
  const [density, setDensity] = useState(1500);
  const [phase, setPhase] = useState<Phase>({ kind: "editing" });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPhase({ kind: "submitting" });
    if (map) clearConflicts(map);
    const result = await submitForest({
      name,
      species,
      avg_age: avgAge,
      density,
      geometry,
    });
    switch (result.kind) {
      case "success":
        setPhase({ kind: "done", data: result.data });
        break;
      case "overlap": {
        if (map) showConflicts(map, result.conflicts);
        const total = result.conflicts.reduce((s, c) => s + c.overlap_ha, 0);
        setPhase({ kind: "conflict", totalOverlapHa: total, count: result.conflicts.length });
        break;
      }
      case "invalid":
        setPhase({ kind: "invalid", message: result.message });
        break;
      case "unauthorized":
        router.replace("/login");
        break;
      case "error":
        setPhase({ kind: "invalid", message: result.message });
        break;
    }
  }

  if (phase.kind === "done") {
    return (
      <div className="max-h-[calc(100vh-12rem)] overflow-y-auto rounded-lg bg-white/95 p-4 shadow-lg">
        <h3 className="font-bold text-emerald-800">✅ 申報成功</h3>
        <p className="mt-1 text-sm text-stone-600">
          {name}｜{SPECIES_LABEL[species]}｜{phase.data.plot.area_ha.toFixed(4)} ha
        </p>
        <p className="mt-1 text-sm text-amber-700">⛓️ 上鏈處理中（區塊鏈功能將於後續版本啟用）</p>
        <div className="mt-3">
          <CarbonChart estimates={phase.data.estimates} />
        </div>
        <p className="mt-1 text-xs text-stone-400">示範估算值，非查證碳權</p>
        <div className="mt-3 flex gap-2">
          <Link
            href={`/dashboard/${phase.data.plot.id}`}
            className="flex-1 rounded-md bg-emerald-700 py-2 text-center text-sm text-white hover:bg-emerald-800"
          >
            前往林區詳情
          </Link>
          <button
            onClick={onReset}
            className="rounded-md border border-stone-300 px-3 py-2 text-sm hover:bg-stone-100"
          >
            再圈一塊
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="rounded-lg bg-white/95 p-4 shadow-lg">
      <h3 className="font-bold text-stone-800">林區申報資料</h3>
      <p className="mt-1 text-xs text-stone-500">圈選面積 {areaHa.toFixed(4)} ha</p>

      <label className="mt-3 block text-sm">
        林區名稱
        <input
          required
          maxLength={100}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例：延文實驗林場 B 區"
          className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2"
        />
      </label>

      <label className="mt-3 block text-sm">
        樹種
        <select
          value={species}
          onChange={(e) => setSpecies(e.target.value as Species)}
          className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2"
        >
          {(Object.keys(SPECIES_LABEL) as Species[]).map((s) => (
            <option key={s} value={s}>
              {SPECIES_LABEL[s]}
            </option>
          ))}
        </select>
      </label>

      <label className="mt-3 block text-sm">
        平均年齡（1–100 年）
        <input
          type="number"
          required
          min={1}
          max={100}
          value={avgAge}
          onChange={(e) => setAvgAge(Number(e.target.value))}
          className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2"
        />
      </label>

      <label className="mt-3 block text-sm">
        種植密度（100–10,000 株/公頃）
        <input
          type="number"
          required
          min={100}
          max={10000}
          value={density}
          onChange={(e) => setDensity(Number(e.target.value))}
          className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2"
        />
      </label>

      {phase.kind === "conflict" && (
        <div className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700">
          ⚠️ 與既有 {phase.count} 筆林區重疊（共 {phase.totalOverlapHa.toFixed(4)} ha，
          地圖紅色區域）。請重繪避開衝突區域後再送出。
        </div>
      )}
      {phase.kind === "invalid" && (
        <div className="mt-3 rounded-md bg-amber-50 p-3 text-sm text-amber-800">
          {phase.message}
        </div>
      )}

      <button
        type="submit"
        disabled={phase.kind === "submitting"}
        className="mt-4 w-full rounded-md bg-emerald-700 py-2 text-white hover:bg-emerald-800 disabled:opacity-50"
      >
        {phase.kind === "submitting" ? "送出中…" : "送出申報"}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: 驗證與 Commit**

Run: `npm run build` → 成功。

手動 DoD（後端啟動中，登入測試帳號）：
1. 圈一塊未重疊的 5–20 ha 林地 → 填表送出 → 成功卡 + 6 年曲線 + 免責標示
2. 圈一塊與「延文實驗林場 A 區」（`[121.772–121.776, 24.7406–24.745]`）重疊的多邊形 → 送出 → 地圖紅色高亮 + 衝突訊息（AT-2 前端部分）
3. 年齡改 0（繞過 min 用開發者工具）→ 送出 → 顯示欄位錯誤訊息

```powershell
git add frontend/components/PlotForm.tsx ; git commit -m "T2.5+T2.6: 申報表單 + 201/409/422 回應處理 + 衝突紅色高亮"
```

---

### Task 8: 儀表板清單頁（對應 T2.8，FR-6.1）

**Files:**
- Create: `frontend/app/dashboard/page.tsx`

**Interfaces:**
- Consumes: `listForest`、`StatusBadge`、`SPECIES_LABEL`、`AuthGuard`
- Produces: `/dashboard`——卡片列出全部林區（名稱、樹種、面積、當年固碳量、狀態徽章），點擊進 `/dashboard/[id]`；空清單顯示引導文案

- [ ] **Step 1: app/dashboard/page.tsx**

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AuthGuard from "@/components/AuthGuard";
import StatusBadge from "@/components/StatusBadge";
import { listForest } from "@/lib/api";
import type { PlotListItem } from "@/lib/types";
import { SPECIES_LABEL } from "@/lib/types";

function PlotCards() {
  const [plots, setPlots] = useState<PlotListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listForest()
      .then(setPlots)
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) return <p className="text-red-600">載入失敗：{error}</p>;
  if (plots === null) return <p className="text-stone-500">載入中…</p>;
  if (plots.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-stone-300 p-12 text-center">
        <p className="text-stone-500">尚無林區資料</p>
        <Link href="/draw" className="mt-2 inline-block text-emerald-700 underline">
          前往圈地申報 →
        </Link>
      </div>
    );
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {plots.map((p) => (
        <Link
          key={p.id}
          href={`/dashboard/${p.id}`}
          className="rounded-xl border border-stone-200 bg-white p-5 transition hover:border-emerald-400 hover:shadow-md"
        >
          <div className="flex items-start justify-between">
            <h3 className="font-semibold text-stone-800">{p.name}</h3>
            <StatusBadge status={p.status} />
          </div>
          <dl className="mt-3 space-y-1 text-sm text-stone-600">
            <div className="flex justify-between">
              <dt>樹種</dt>
              <dd>{SPECIES_LABEL[p.species]}</dd>
            </div>
            <div className="flex justify-between">
              <dt>面積</dt>
              <dd>{p.area_ha.toFixed(4)} ha</dd>
            </div>
            <div className="flex justify-between">
              <dt>當年固碳量</dt>
              <dd className="font-medium text-emerald-700">
                {p.co2e_current !== null ? `${p.co2e_current.toFixed(2)} 噸 CO₂e/年` : "—"}
              </dd>
            </div>
          </dl>
        </Link>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <AuthGuard>
      <div className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="text-2xl font-bold text-emerald-900">企業儀表板</h1>
        <p className="mt-1 text-sm text-stone-500">全部已申報林區與碳匯概況</p>
        <div className="mt-6">
          <PlotCards />
        </div>
      </div>
    </AuthGuard>
  );
}
```

- [ ] **Step 2: 驗證與 Commit**

Run: `npm run build` → 成功。

手動 DoD：`/dashboard` 顯示「延文實驗林場 A 區」等既有林區卡片，欄位與資料庫一致；狀態徽章「上鏈處理中」含動畫點；點卡片導向詳情（404 屬正常，Task 9 建立）。

```powershell
git add frontend/app/dashboard/page.tsx ; git commit -m "T2.8: 儀表板清單頁（卡片 + 狀態徽章）"
```

---

### Task 9: 林區詳情頁（對應 T2.9，FR-6.2 / FR-6.3 / FR-6.4 佔位）

**Files:**
- Create: `frontend/components/PlotDetailView.tsx`
- Create: `frontend/app/dashboard/[id]/page.tsx`

**Interfaces:**
- Consumes: `getForest`、`MapView`、`CarbonChart`、`StatusBadge`、`SPECIES_LABEL`
- Produces: `/dashboard/[id]`——地圖 flyTo/fitBounds 至該林區 + 綠色填色邊界；側欄屬性（名稱/樹種/年齡/密度/面積/geo_hash 縮寫/建立時間）；固碳曲線；鏈上憑證區塊（W2 顯示「上鏈處理中」與 W3 預告，`chain_record` 恆 null）；404 顯示查無此林區

- [ ] **Step 1: PlotDetailView.tsx**

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type mapboxgl from "mapbox-gl";
import MapView from "@/components/MapView";
import CarbonChart from "@/components/CarbonChart";
import StatusBadge from "@/components/StatusBadge";
import { getForest } from "@/lib/api";
import type { PlotDetail } from "@/lib/types";
import { SPECIES_LABEL } from "@/lib/types";

function addPlotLayer(map: mapboxgl.Map, geometry: GeoJSON.Polygon) {
  if (map.getSource("plot")) return;
  map.addSource("plot", {
    type: "geojson",
    data: { type: "Feature", properties: {}, geometry },
  });
  map.addLayer({
    id: "plot-fill",
    type: "fill",
    source: "plot",
    paint: { "fill-color": "#059669", "fill-opacity": 0.35 },
  });
  map.addLayer({
    id: "plot-line",
    type: "line",
    source: "plot",
    paint: { "line-color": "#047857", "line-width": 2.5 },
  });
}

function fitToPolygon(map: mapboxgl.Map, geometry: GeoJSON.Polygon) {
  const ring = geometry.coordinates[0] as [number, number][];
  let [minX, minY] = ring[0];
  let [maxX, maxY] = ring[0];
  for (const [x, y] of ring) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  map.fitBounds(
    [
      [minX, minY],
      [maxX, maxY],
    ],
    { padding: 80, pitch: 55, duration: 2500, maxZoom: 16 },
  );
}

export default function PlotDetailView({ plotId }: { plotId: string }) {
  const [plot, setPlot] = useState<PlotDetail | null | undefined>(undefined);
  const [map, setMap] = useState<mapboxgl.Map | null>(null);

  useEffect(() => {
    getForest(plotId)
      .then(setPlot)
      .catch(() => setPlot(null));
  }, [plotId]);

  const onMapReady = useCallback((m: mapboxgl.Map) => setMap(m), []);

  useEffect(() => {
    if (map && plot) {
      addPlotLayer(map, plot.geometry);
      fitToPolygon(map, plot.geometry);
    }
  }, [map, plot]);

  if (plot === undefined) return <p className="p-8 text-stone-500">載入中…</p>;
  if (plot === null) {
    return (
      <div className="p-12 text-center">
        <p className="text-stone-600">查無此林區</p>
        <Link href="/dashboard" className="mt-2 inline-block text-emerald-700 underline">
          ← 回儀表板
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/dashboard" className="text-sm text-stone-500 hover:text-emerald-700">
            ← 回儀表板
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-emerald-900">{plot.name}</h1>
        </div>
        <StatusBadge status={plot.status} />
      </div>

      <div className="mt-4 grid gap-6 lg:grid-cols-3">
        <div className="overflow-hidden rounded-xl border border-stone-200 lg:col-span-2">
          <MapView onReady={onMapReady} className="h-[420px] w-full" />
        </div>

        <aside className="space-y-4">
          <div className="rounded-xl border border-stone-200 bg-white p-5">
            <h2 className="font-semibold text-stone-800">林區屬性</h2>
            <dl className="mt-3 space-y-2 text-sm text-stone-600">
              <div className="flex justify-between">
                <dt>樹種</dt>
                <dd>{SPECIES_LABEL[plot.species]}</dd>
              </div>
              <div className="flex justify-between">
                <dt>平均年齡</dt>
                <dd>{plot.avg_age} 年</dd>
              </div>
              <div className="flex justify-between">
                <dt>種植密度</dt>
                <dd>{plot.density} 株/公頃</dd>
              </div>
              <div className="flex justify-between">
                <dt>面積</dt>
                <dd>{plot.area_ha.toFixed(4)} ha</dd>
              </div>
              <div className="flex justify-between">
                <dt>建立時間</dt>
                <dd>{new Date(plot.created_at).toLocaleDateString("zh-TW")}</dd>
              </div>
              <div>
                <dt>幾何指紋（SHA-256）</dt>
                <dd className="mt-1 break-all font-mono text-xs text-stone-400">
                  {plot.geo_hash}
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-xl border border-stone-200 bg-white p-5">
            <h2 className="font-semibold text-stone-800">鏈上憑證</h2>
            {plot.chain_record?.tx_hash ? (
              <p className="mt-2 break-all text-sm text-emerald-700">
                {plot.chain_record.tx_hash}
              </p>
            ) : (
              <p className="mt-2 text-sm text-amber-700">
                ⛓️ 上鏈處理中——NFT 存證與 Tx Hash 查驗將於區塊鏈模組上線後顯示
              </p>
            )}
          </div>
        </aside>
      </div>

      <div className="mt-6 rounded-xl border border-stone-200 bg-white p-5">
        <h2 className="font-semibold text-stone-800">固碳量預測（當年起 6 年）</h2>
        <p className="text-xs text-stone-400">
          公式版本 {plot.estimates[0]?.formula_version ?? "—"}｜示範估算值，非查證碳權
        </p>
        <div className="mt-3">
          <CarbonChart estimates={plot.estimates} />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: app/dashboard/[id]/page.tsx**

```tsx
"use client";

import { use } from "react";
import dynamic from "next/dynamic";
import AuthGuard from "@/components/AuthGuard";

const PlotDetailView = dynamic(() => import("@/components/PlotDetailView"), {
  ssr: false,
  loading: () => <p className="p-8 text-stone-500">載入中…</p>,
});

export default function PlotDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <AuthGuard>
      <PlotDetailView plotId={id} />
    </AuthGuard>
  );
}
```

- [ ] **Step 3: 驗證與 Commit**

Run: `npm run build` → 成功。

手動 DoD：從儀表板點「延文實驗林場 A 區」→ 地圖飛至該林區、綠色填色邊界；側欄屬性與 geo_hash 正確；曲線 6 點；鏈上區塊顯示處理中文案；亂打 UUID 顯示查無此林區。

```powershell
git add frontend/ ; git commit -m "T2.9: 林區詳情頁（flyTo + 綠色邊界 + 屬性側欄 + 曲線 + 鏈上佔位）"
```

---

### Task 10: M2 里程碑驗證與收尾（對應 W2 週末檢核）

**Files:**
- Modify: `docs/devlog.md`

**Interfaces:**
- Consumes: 全部前述任務
- Produces: M2 手動 E2E 全通、`m2-frontend` tag

- [ ] **Step 1: 完整建置與 lint**

Run（`frontend/`）: `npm run build` → 成功；`npm run lint` → 無 error（warning 記錄於 devlog）。

- [ ] **Step 2: M2 手動 E2E 檢核（後端啟動中）**

依序執行並記錄結果：
1. 未登入開 `/draw` → 導向 `/login`（FR-1.2）
2. 登入 → `/draw` 3D 地形圈選 5–20 ha → 面積顯示 → 填表（台灣杉/15/1500）→ 201 成功卡 + 6 年曲線
3. 儀表板出現新林區 → 點入詳情 → 地圖 flyTo + 綠色邊界 + 曲線
4. 再圈與上述重疊的多邊形 → 409 紅色高亮 + 衝突訊息 → 重繪避開 → 成功
5. 圈 <0.1 ha → 前端阻擋；自相交多邊形送出 → 422 訊息顯示
6. Footer 免責標示、估算卡「示範估算值」標示存在

- [ ] **Step 3: devlog、push 與 tag**

`docs/devlog.md` 追加 M2 達成記錄（六項檢核結果、遺留事項）。

```powershell
git add docs/devlog.md ; git commit -m "T2.9: devlog 記錄 M2 達成"
git push origin main
git tag m2-frontend
git push origin m2-frontend
```

---

## 已知風險與後續（不在本計畫範圍）

- **Mapbox token 是使用者前置作業**（Task 4 前必須就緒）；免費額度 50,000 loads/月，MVP 無虞（R4）
- **Vercel 部署**依開發計畫排在 W4（T4.1）；本計畫 DoD 為本機 `npm run build` + dev server 手動驗證
- **W3（區塊鏈）**：詳情頁鏈上區塊已留 `chain_record?.tx_hash` 條件渲染位；`chain_pending` 每 10 秒輪詢（FR-6.5）與 Tx Hash 超連結（FR-6.4）隨 W3 chain_service 一併實作
- 前端 Turf 面積（測地）與後端 EPSG:3826 面積差 <1%（T2.4 DoD）——手動驗證時比對 201 回傳的 `area_ha`

## Self-Review 紀錄

- 規格覆蓋：FR-1.1–1.3（Task 3）、FR-2.1（Task 4）、FR-2.2/2.4（Task 6）、FR-2.3/2.5/2.6（Task 7）、FR-6.1（Task 8）、FR-6.2/6.3（Task 9）、免責標示（Task 1/7/9）。FR-6.4/6.5（Tx Hash 連結與輪詢）依規格屬上鏈流程，隨 W3 實作，詳情頁已留條件渲染位。
- Placeholder 掃描：Task 1 的 `AuthButton` stub 與 Task 6 的 `PlotForm` stub 為刻意的先建後改（各自在 Task 3/Task 7 整檔改寫，計畫內含完整最終程式碼），非未完成缺口。
- 型別一致性：`SubmitResult` kind 值、`showConflicts`/`clearConflicts` 簽名、`PlotFormProps`、`MapView onReady` 於 Tasks 2–9 間交叉核對一致；`use(params)` 採 Next.js 15 Promise params 形式。
