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
