export type Species = "taiwania" | "acacia" | "fraxinus";

export const SPECIES_LABEL: Record<Species, string> = {
  taiwania: "台灣杉",
  acacia: "相思樹",
  fraxinus: "光臘樹",
};

export type PlotStatus = "active" | "chain_pending" | "on_chain" | "rejected";

export const STATUS_LABEL: Record<PlotStatus, string> = {
  active: "已建檔",
  chain_pending: "上鏈處理中",
  on_chain: "已上鏈",
  rejected: "已駁回",
};

export interface YearEstimate {
  year_offset: number;
  co2e_tons: number;
}

export interface SubmitSuccess {
  plot: { id: string; area_ha: number; status: PlotStatus; created_at: string };
  estimates: YearEstimate[];
  chain: { status: string };
}

export interface Conflict {
  plot_id: string;
  overlap_ha: number;
  overlap_geojson: GeoJSON.Polygon | GeoJSON.MultiPolygon;
}

export interface PlotListItem {
  id: string;
  name: string;
  species: Species;
  area_ha: number;
  status: PlotStatus;
  co2e_current: number | null;
  geometry_simplified: GeoJSON.Polygon;
  created_at: string;
}

export interface ChainRecord {
  contract_address: string | null;
  token_id: number | null;
  tx_hash: string | null;
  chain_id: number;
  minted_at: string | null;
}

export interface PlotDetail {
  id: string;
  owner_id: string;
  name: string;
  species: Species;
  avg_age: number;
  density: number;
  area_ha: number;
  geo_hash: string;
  status: PlotStatus;
  created_at: string;
  geometry: GeoJSON.Polygon;
  estimates: { formula_version: string; year_offset: number; co2e_tons: number }[];
  chain_record: ChainRecord | null;
}

export interface ForestSubmission {
  name: string;
  species: Species;
  avg_age: number;
  density: number;
  geometry: GeoJSON.Polygon;
}
