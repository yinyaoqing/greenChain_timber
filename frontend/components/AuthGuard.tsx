"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/hooks/useSession";
import { loginHref } from "@/lib/authRedirect";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { session, loading } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (loading || session) return;
    // 於 effect 內讀 location，避免 useSearchParams 觸發 Suspense 邊界需求
    router.replace(loginHref(window.location.pathname + window.location.search));
  }, [loading, session, router]);

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-stone-500">載入中…</div>;
  }
  if (!session) return null;
  return <>{children}</>;
}
