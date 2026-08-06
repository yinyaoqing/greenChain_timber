"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type mapboxgl from "mapbox-gl";
import MapView from "@/components/MapView";
import CarbonChart from "@/components/CarbonChart";
import StatusBadge from "@/components/StatusBadge";
import { getChainStatus, getForest } from "@/lib/api";
import type { PlotDetail } from "@/lib/types";
import { SPECIES_LABEL } from "@/lib/types";
import { formatHa } from "@/lib/format";

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
  const [loadError, setLoadError] = useState(false);
  const [map, setMap] = useState<mapboxgl.Map | null>(null);

  useEffect(() => {
    getForest(plotId)
      .then(setPlot)
      .catch(() => setLoadError(true));
  }, [plotId]);

  const onMapReady = useCallback((m: mapboxgl.Map) => setMap(m), []);

  useEffect(() => {
    if (map && plot) {
      addPlotLayer(map, plot.geometry);
      fitToPolygon(map, plot.geometry);
    }
  }, [map, plot]);

  // chain_pending 時每 10 秒輪詢上鏈狀態；轉 on_chain 後重抓詳情
  useEffect(() => {
    if (!plot || plot.status !== "chain_pending") return;
    const timer = setInterval(async () => {
      const s = await getChainStatus(plot.id).catch(() => null);
      if (s && s.status !== "chain_pending") {
        getForest(plot.id).then((p) => p && setPlot(p)).catch(() => {});
      }
    }, 10_000);
    return () => clearInterval(timer);
  }, [plot]);

  if (loadError) {
    return (
      <div className="p-12 text-center">
        <p className="text-stone-600">無法連線後端服務，請確認 API 是否啟動</p>
        <Link href="/dashboard" className="mt-2 inline-block text-emerald-700 underline">
          ← 回儀表板
        </Link>
      </div>
    );
  }
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
                <dd>{formatHa(plot.area_ha)}</dd>
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
              <dl className="mt-3 space-y-2 text-sm">
                <div>
                  <dt className="text-stone-500">Token ID</dt>
                  <dd className="font-mono">#{plot.chain_record.token_id}</dd>
                </div>
                <div>
                  <dt className="text-stone-500">合約地址</dt>
                  <dd>
                    <a
                      href={`https://amoy.polygonscan.com/address/${plot.chain_record.contract_address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="break-all font-mono text-xs text-emerald-700 underline"
                    >
                      {plot.chain_record.contract_address}
                    </a>
                  </dd>
                </div>
                <div>
                  <dt className="text-stone-500">Tx Hash（點擊至 Amoy 瀏覽器驗證）</dt>
                  <dd>
                    <a
                      href={`https://amoy.polygonscan.com/tx/${plot.chain_record.tx_hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="break-all font-mono text-xs text-emerald-700 underline"
                    >
                      {plot.chain_record.tx_hash}
                    </a>
                  </dd>
                </div>
              </dl>
            ) : plot.status === "chain_pending" ? (
              <p className="mt-2 flex items-center gap-2 text-sm text-amber-700">
                <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
                上鏈處理中——完成後將自動顯示 Tx Hash（每 10 秒更新）
              </p>
            ) : (
              <p className="mt-2 text-sm text-stone-500">尚無鏈上紀錄</p>
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
