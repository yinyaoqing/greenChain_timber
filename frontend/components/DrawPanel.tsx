"use client";

import { useCallback, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type mapboxgl from "mapbox-gl";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";
import turfArea from "@turf/area";
import MapView from "@/components/MapView";
import PlotForm from "@/components/PlotForm";
import { clearConflicts } from "@/lib/conflictLayer";

const MIN_AREA_HA = 0.1;
const MAX_AREA_HA = 1000;
const MAX_VERTICES = 500;

interface DrawState {
  geometry: GeoJSON.Polygon | null;
  areaHa: number;
  vertexCount: number;
}

export default function DrawPanel() {
  const t = useTranslations("draw");
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const drawRef = useRef<MapboxDraw | null>(null);
  const [mapInstance, setMapInstance] = useState<mapboxgl.Map | null>(null);
  const [drawState, setDrawState] = useState<DrawState>({
    geometry: null,
    areaHa: 0,
    vertexCount: 0,
  });
  const [formOpen, setFormOpen] = useState(false);

  const syncFromDraw = useCallback(() => {
    const draw = drawRef.current;
    if (!draw) return;
    const features = draw.getAll().features;
    const poly = features.find((f) => f.geometry.type === "Polygon");
    if (!poly) {
      setDrawState({ geometry: null, areaHa: 0, vertexCount: 0 });
      setFormOpen(false);
      return;
    }
    const geometry = poly.geometry as GeoJSON.Polygon;
    const ring = geometry.coordinates[0] ?? [];
    const vertexCount = Math.max(0, ring.length - 1); // 閉合點不計
    const areaHa = turfArea(poly as GeoJSON.Feature) / 10_000;
    setDrawState({ geometry, areaHa, vertexCount });
  }, []);

  const onMapReady = useCallback(
    (map: mapboxgl.Map) => {
      mapRef.current = map;
      setMapInstance(map);
      const draw = new MapboxDraw({
        displayControlsDefault: false,
        controls: { polygon: true, trash: true },
      });
      map.addControl(draw as unknown as mapboxgl.IControl, "top-left");
      drawRef.current = draw;
      map.on("draw.modechange" as never, (e: { mode?: string }) => {
        if (e?.mode === "draw_polygon" && map.getPitch() > 10) {
          map.easeTo({ pitch: 0, duration: 600 });
        }
      });
      map.on("draw.create" as never, () => {
        // 一次僅允許一個多邊形：保留最新
        const all = draw.getAll().features;
        if (all.length > 1) {
          for (const f of all.slice(0, -1)) draw.delete(String(f.id));
        }
        clearConflicts(map);
        syncFromDraw();
      });
      map.on("draw.update" as never, () => {
        clearConflicts(map);
        syncFromDraw();
      });
      map.on("draw.delete" as never, () => {
        clearConflicts(map);
        syncFromDraw();
      });
    },
    [syncFromDraw],
  );

  const { geometry, areaHa, vertexCount } = drawState;
  const areaError =
    geometry === null
      ? null
      : areaHa < MIN_AREA_HA
        ? t("areaTooSmall", { area: areaHa.toFixed(4), min: MIN_AREA_HA })
        : areaHa > MAX_AREA_HA
          ? t("areaTooLarge", { area: areaHa.toFixed(1), max: MAX_AREA_HA })
          : vertexCount > MAX_VERTICES
            ? t("tooManyVertices", { count: vertexCount, max: MAX_VERTICES })
            : null;
  const ready = geometry !== null && areaError === null;

  function resetDrawing() {
    drawRef.current?.deleteAll();
    if (mapRef.current) clearConflicts(mapRef.current);
    setDrawState({ geometry: null, areaHa: 0, vertexCount: 0 });
    setFormOpen(false);
  }

  return (
    <div className="relative h-[calc(100vh-8.5rem)]">
      <MapView onReady={onMapReady} className="h-full w-full" />

      {/* 左下：面積資訊卡 */}
      <div className="absolute bottom-4 left-4 z-10 w-72 rounded-lg bg-white/95 p-4 shadow-lg">
        {geometry === null ? (
          <p className="text-sm text-stone-600">{t("hint")}</p>
        ) : (
          <>
            <p className="text-sm text-stone-500">{t("selectedArea")}</p>
            <p className="text-2xl font-bold text-emerald-800">
              {areaHa.toFixed(4)} <span className="text-base font-normal">{t("hectare")}</span>
            </p>
            <p className="mt-1 text-xs text-stone-500">{t("vertexCount", { count: vertexCount })}</p>
            {areaError && <p className="mt-2 text-sm text-red-600">{areaError}</p>}
            <div className="mt-3 flex gap-2">
              <button
                disabled={!ready}
                onClick={() => setFormOpen(true)}
                className="flex-1 rounded-md bg-emerald-700 py-2 text-sm text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {t("fillForm")}
              </button>
              <button
                onClick={resetDrawing}
                className="rounded-md border border-stone-300 px-3 py-2 text-sm hover:bg-stone-100"
              >
                {t("redraw")}
              </button>
            </div>
          </>
        )}
      </div>

      {/* 右側：林區建檔表單 */}
      {formOpen && geometry && (
        <div className="absolute right-4 top-4 z-10 w-80">
          <PlotForm
            geometry={geometry}
            areaHa={areaHa}
            map={mapInstance}
            onReset={resetDrawing}
          />
        </div>
      )}
    </div>
  );
}
