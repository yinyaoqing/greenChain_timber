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
