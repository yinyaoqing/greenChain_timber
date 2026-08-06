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
