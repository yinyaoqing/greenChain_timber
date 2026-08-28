"use client";

import { useCallback, useEffect, useState } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import type mapboxgl from "mapbox-gl";
import MapView from "@/components/MapView";
import CarbonChart from "@/components/CarbonChart";
import StatusBadge from "@/components/StatusBadge";
import { UnauthorizedError, getChainStatus, getForest } from "@/lib/api";
import { loginHref } from "@/lib/authRedirect";
import type { PlotDetail } from "@/lib/types";
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
  const router = useRouter();
  const t = useTranslations("plotDetail");
  const tc = useTranslations("common");
  const ts = useTranslations("species");
  const locale = useLocale();

  useEffect(() => {
    getForest(plotId)
      .then(setPlot)
      .catch((e: unknown) => {
        if (e instanceof UnauthorizedError) {
          router.replace(loginHref(`/dashboard/${plotId}`));
          return;
        }
        setLoadError(true);
      });
  }, [plotId, router]);

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
        <p className="text-stone-600">{t("backendDown")}</p>
        <Link href="/dashboard" className="mt-2 inline-block text-emerald-700 underline">
          {tc("backToDashboard")}
        </Link>
      </div>
    );
  }
  if (plot === undefined) return <p className="p-8 text-stone-500">{tc("loading")}</p>;
  if (plot === null) {
    return (
      <div className="p-12 text-center">
        <p className="text-stone-600">{t("notFound")}</p>
        <Link href="/dashboard" className="mt-2 inline-block text-emerald-700 underline">
          {tc("backToDashboard")}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/dashboard" className="text-sm text-stone-500 hover:text-emerald-700">
            {tc("backToDashboard")}
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
            <h2 className="font-semibold text-stone-800">{t("attrsTitle")}</h2>
            <dl className="mt-3 space-y-2 text-sm text-stone-600">
              <div className="flex justify-between">
                <dt>{t("species")}</dt>
                <dd>{ts(plot.species)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>{t("avgAge")}</dt>
                <dd>{plot.avg_age} {tc("yearsUnit")}</dd>
              </div>
              <div className="flex justify-between">
                <dt>{t("density")}</dt>
                <dd>{plot.density} {tc("densityUnit")}</dd>
              </div>
              <div className="flex justify-between">
                <dt>{t("area")}</dt>
                <dd>{formatHa(plot.area_ha, locale)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>{t("createdAt")}</dt>
                <dd>{new Date(plot.created_at).toLocaleDateString(locale)}</dd>
              </div>
              <div>
                <dt>{t("geoHash")}</dt>
                <dd className="mt-1 break-all font-mono text-xs text-stone-400">
                  {plot.geo_hash}
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-xl border border-stone-200 bg-white p-5">
            <h2 className="font-semibold text-stone-800">{t("chainTitle")}</h2>
            {plot.chain_record?.tx_hash ? (
              <dl className="mt-3 space-y-2 text-sm">
                <div>
                  <dt className="text-stone-500">{t("tokenId")}</dt>
                  <dd className="font-mono">#{plot.chain_record.token_id}</dd>
                </div>
                <div>
                  <dt className="text-stone-500">{t("contractAddress")}</dt>
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
                  <dt className="text-stone-500">{t("txHashLabel")}</dt>
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
                {t("chainPendingHint")}
              </p>
            ) : (
              <p className="mt-2 text-sm text-stone-500">{t("noChainRecord")}</p>
            )}
          </div>
        </aside>
      </div>

      <div className="mt-6 rounded-xl border border-stone-200 bg-white p-5">
        <h2 className="font-semibold text-stone-800">{t("estimatesTitle")}</h2>
        <p className="text-xs text-stone-400">
          {t("formulaNote", { version: plot.estimates[0]?.formula_version ?? "—" })}
        </p>
        <div className="mt-3">
          <CarbonChart estimates={plot.estimates} createdAt={plot.created_at} />
        </div>
      </div>
    </div>
  );
}
