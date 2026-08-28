"use client";

import { useState } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import type mapboxgl from "mapbox-gl";
import { submitForest } from "@/lib/api";
import { loginHref } from "@/lib/authRedirect";
import type { Species, SubmitSuccess } from "@/lib/types";
import { clearConflicts, showConflicts } from "@/lib/conflictLayer";
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
  const t = useTranslations("plotForm");
  const ts = useTranslations("species");
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
        router.replace(loginHref("/draw"));
        break;
      case "error":
        setPhase({ kind: "invalid", message: result.message });
        break;
    }
  }

  if (phase.kind === "done") {
    return (
      <div className="max-h-[calc(100vh-12rem)] overflow-y-auto rounded-lg bg-white/95 p-4 shadow-lg">
        <h3 className="font-bold text-emerald-800">{t("successTitle")}</h3>
        <p className="mt-1 text-sm text-stone-600">
          {name}｜{ts(species)}｜{phase.data.plot.area_ha.toFixed(4)} ha
        </p>
        <p className="mt-1 text-sm text-amber-700">{t("chainPending")}</p>
        <div className="mt-3">
          <CarbonChart estimates={phase.data.estimates} createdAt={phase.data.plot.created_at} />
        </div>
        <p className="mt-1 text-xs text-stone-400">{t("demoNote")}</p>
        <div className="mt-3 flex gap-2">
          <Link
            href={`/dashboard/${phase.data.plot.id}`}
            className="flex-1 rounded-md bg-emerald-700 py-2 text-center text-sm text-white hover:bg-emerald-800"
          >
            {t("toDetail")}
          </Link>
          <button
            onClick={onReset}
            className="rounded-md border border-stone-300 px-3 py-2 text-sm hover:bg-stone-100"
          >
            {t("drawAnother")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="rounded-lg bg-white/95 p-4 shadow-lg">
      <h3 className="font-bold text-stone-800">{t("title")}</h3>
      <p className="mt-1 text-xs text-stone-500">{t("drawnArea", { area: areaHa.toFixed(4) })}</p>

      <label className="mt-3 block text-sm">
        {t("name")}
        <input
          required
          maxLength={100}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("namePlaceholder")}
          className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2"
        />
      </label>

      <label className="mt-3 block text-sm">
        {t("species")}
        <select
          value={species}
          onChange={(e) => setSpecies(e.target.value as Species)}
          className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2"
        >
          {(["taiwania", "acacia", "fraxinus"] as Species[]).map((s) => (
            <option key={s} value={s}>{ts(s)}</option>
          ))}
        </select>
      </label>

      <label className="mt-3 block text-sm">
        {t("avgAge")}
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
        {t("density")}
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
          {t("conflict", { count: phase.count, total: phase.totalOverlapHa.toFixed(4) })}
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
        {phase.kind === "submitting" ? t("submitting") : t("submit")}
      </button>
    </form>
  );
}
