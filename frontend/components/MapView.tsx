"use client";

import { useEffect, useRef } from "react";
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
  const containerRef = useRef<HTMLDivElement>(null);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

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
    map.on("style.load", () => {
      map.addSource("mapbox-dem", {
        type: "raster-dem",
        url: "mapbox://mapbox.mapbox-terrain-dem-v1",
        tileSize: 512,
        maxzoom: 14,
      });
      map.setTerrain({ source: "mapbox-dem", exaggeration: 1.4 });
      onReadyRef.current?.(map);
    });
    return () => map.remove();
  }, []);

  return <div ref={containerRef} className={className ?? "h-full w-full"} />;
}
