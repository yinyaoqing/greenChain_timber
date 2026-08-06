"use client";

import type mapboxgl from "mapbox-gl";

export interface PlotFormProps {
  geometry: GeoJSON.Polygon;
  areaHa: number;
  map: mapboxgl.Map | null;
  onReset: () => void;
}

export default function PlotForm({ areaHa }: PlotFormProps) {
  return (
    <div className="rounded-lg bg-white/95 p-4 shadow-lg">
      <p className="text-sm text-stone-500">申報表單（Task 7 實作）｜{areaHa.toFixed(4)} ha</p>
    </div>
  );
}
