import { supabase } from "@/lib/supabase";
import type { ChainStatus, Conflict, ForestSubmission, PlotDetail, PlotListItem, SubmitSuccess } from "@/lib/types";

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
  if (res.status === 201) {
    const data = (await res.json().catch(() => null)) as SubmitSuccess | null;
    if (!data) return { kind: "error", message: "伺服器回應格式異常" };
    return { kind: "success", data };
  }
  const payload = await res.json().catch(() => null);
  if (res.status === 409) {
    const conflicts = (payload?.detail?.conflicts ?? []) as Conflict[];
    return { kind: "overlap", conflicts };
  }
  if (res.status === 422) return { kind: "invalid", ...parse422(payload?.detail) };
  if (res.status === 401) return { kind: "unauthorized" };
  return { kind: "error", message: `伺服器錯誤（HTTP ${res.status}）` };
}

/** GET 端點的 401／無 token：由呼叫端導向登入頁（帶 returnTo），不顯示為載入錯誤 */
export class UnauthorizedError extends Error {
  constructor() {
    super("未登入或登入已逾期");
    this.name = "UnauthorizedError";
  }
}

async function authedGet<T>(path: string): Promise<{ status: number; data: T | null }> {
  const token = await accessToken();
  if (!token) throw new UnauthorizedError();
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) throw new UnauthorizedError();
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

export async function getChainStatus(id: string): Promise<ChainStatus | null> {
  const { data } = await authedGet<ChainStatus>(`/api/forest/${id}/chain-status`);
  return data;
}
