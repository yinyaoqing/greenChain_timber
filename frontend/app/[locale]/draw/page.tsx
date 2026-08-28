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
