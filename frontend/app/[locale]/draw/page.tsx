"use client";

import dynamic from "next/dynamic";
import AuthGuard from "@/components/AuthGuard";

const DrawPanel = dynamic(() => import("@/components/DrawPanel"), {
  ssr: false,
  loading: () => (
    <div className="flex h-96 items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-stone-300 border-t-emerald-700" />
    </div>
  ),
});

export default function DrawPage() {
  return (
    <AuthGuard>
      <DrawPanel />
    </AuthGuard>
  );
}
