import type mapboxgl from "mapbox-gl";
import type { Conflict } from "@/lib/types";

const CONFLICT_SOURCE = "conflict-areas";

/** 409 衝突區紅色高亮（FR-2.6） */
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
