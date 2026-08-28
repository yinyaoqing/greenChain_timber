"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

// 預設視角：宜蘭延文實驗林場周邊
export const DEFAULT_CENTER: [number, number] = [121.754, 24.723];

export default function MapView({
  onReady,
  className,
}: {
  onReady?: (map: mapboxgl.Map) => void;
  className?: string;
}) {
  const t = useTranslations("draw");
  const containerRef = useRef<HTMLDivElement>(null);
  const onReadyRef = useRef(onReady);
  const [mapError, setMapError] = useState(false);
  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    if (!containerRef.current) return;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/satellite-streets-v12",
      center: DEFAULT_CENTER,
      zoom: 13.5,
      pitch: 60,
      bearing: -20,
      antialias: true,
    });
    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), "top-right");
    const loadedRef = { current: false };
    map.on("style.load", () => {
      loadedRef.current = true;
      map.addSource("mapbox-dem", {
        type: "raster-dem",
        url: "mapbox://mapbox.mapbox-terrain-dem-v1",
        tileSize: 512,
        maxzoom: 14,
      });
      map.setTerrain({ source: "mapbox-dem", exaggeration: 1.4 });
      onReadyRef.current?.(map);
    });
    map.on("error", (e) => {
      if (!loadedRef.current && e?.error) setMapError(true);
    });
    return () => map.remove();
  }, []);

  return (
    <div ref={containerRef} className={className ?? "h-full w-full"} style={{ position: "relative" }}>
      {mapError && (
        <div className="absolute inset-0 flex items-center justify-center bg-stone-100 p-6 text-center text-sm text-stone-600">
          {t("mapError")}
        </div>
      )}
    </div>
  );
}
