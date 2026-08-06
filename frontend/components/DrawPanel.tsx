"use client";

import { useCallback, useRef, useState } from "react";
import type mapboxgl from "mapbox-gl";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";
import turfArea from "@turf/area";
import MapView from "@/components/MapView";
import PlotForm from "@/components/PlotForm";
import type { Conflict } from "@/lib/types";

const MIN_AREA_HA = 0.1;
const MAX_AREA_HA = 1000;
const MAX_VERTICES = 500;

const CONFLICT_SOURCE = "conflict-areas";

/** 409 衝突區紅色高亮（FR-2.6）。Task 7 於送出流程呼叫 */
export function showConflicts(map: mapboxgl.Map, conflicts: Conflict[]) {
  clearConflicts(map);
  map.addSource(CONFLICT_SOURCE, {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: conflicts.map((c) => ({
        type: "Feature" as const,
        properties: { plot_id: c.plot_id, overlap_ha: c.overlap_ha },
        geometry: c.overlap_geojson,
      })),
    },
  });
  map.addLayer({
    id: `${CONFLICT_SOURCE}-fill`,
    type: "fill",
    source: CONFLICT_SOURCE,
    paint: { "fill-color": "#dc2626", "fill-opacity": 0.45 },
  });
  map.addLayer({
    id: `${CONFLICT_SOURCE}-line`,
    type: "line",
    source: CONFLICT_SOURCE,
    paint: { "line-color": "#b91c1c", "line-width": 2 },
  });
}

export function clearConflicts(map: mapboxgl.Map) {
  for (const id of [`${CONFLICT_SOURCE}-fill`, `${CONFLICT_SOURCE}-line`]) {
    if (map.getLayer(id)) map.removeLayer(id);
  }
  if (map.getSource(CONFLICT_SOURCE)) map.removeSource(CONFLICT_SOURCE);
}

interface DrawState {
  geometry: GeoJSON.Polygon | null;
  areaHa: number;
  vertexCount: number;
}

export default function DrawPanel() {
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
        ? `面積 ${areaHa.toFixed(4)} ha 小於下限 ${MIN_AREA_HA} ha`
        : areaHa > MAX_AREA_HA
          ? `面積 ${areaHa.toFixed(1)} ha 超過上限 ${MAX_AREA_HA} ha`
          : vertexCount > MAX_VERTICES
            ? `頂點數 ${vertexCount} 超過上限 ${MAX_VERTICES}`
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
          <p className="text-sm text-stone-600">
            點選左上 <span className="font-mono">▢</span> 多邊形工具，逐點圈選林地邊界，
            雙擊閉合；可拖曳頂點修改、垃圾桶刪除重繪。
          </p>
        ) : (
          <>
            <p className="text-sm text-stone-500">圈選面積</p>
            <p className="text-2xl font-bold text-emerald-800">
              {areaHa.toFixed(4)} <span className="text-base font-normal">公頃</span>
            </p>
            <p className="mt-1 text-xs text-stone-500">頂點數 {vertexCount}</p>
            {areaError && <p className="mt-2 text-sm text-red-600">{areaError}</p>}
            <div className="mt-3 flex gap-2">
              <button
                disabled={!ready}
                onClick={() => setFormOpen(true)}
                className="flex-1 rounded-md bg-emerald-700 py-2 text-sm text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                填寫申報資料
              </button>
              <button
                onClick={resetDrawing}
                className="rounded-md border border-stone-300 px-3 py-2 text-sm hover:bg-stone-100"
              >
                重繪
              </button>
            </div>
          </>
        )}
      </div>

      {/* 右側：申報表單（Task 7 實作 PlotForm 內容） */}
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
