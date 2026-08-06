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
