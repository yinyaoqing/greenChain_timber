"use client";

import { use } from "react";
import dynamic from "next/dynamic";
import AuthGuard from "@/components/AuthGuard";

const PlotDetailView = dynamic(() => import("@/components/PlotDetailView"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center p-8">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-stone-300 border-t-emerald-700" />
    </div>
  ),
});

export default function PlotDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <AuthGuard>
      <PlotDetailView plotId={id} />
    </AuthGuard>
  );
}
