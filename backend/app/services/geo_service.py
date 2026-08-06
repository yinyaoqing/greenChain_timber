"""幾何服務：正規化、雜湊（本任務）；驗證、面積（Task 4 加入）。FR-3.3 / FR-5.6."""

import hashlib
import json

from pyproj import Transformer
from shapely.geometry import shape
from shapely.ops import transform as shapely_transform
from shapely.validation import explain_validity


def _round_ring(ring: list[list[float]]) -> list[tuple[float, float]]:
    """捨入 6 位、去閉合點與連續重複點."""
    pts = [(round(x, 6), round(y, 6)) for x, y in ring]
    if len(pts) > 1 and pts[0] == pts[-1]:
        pts = pts[:-1]
    deduped: list[tuple[float, float]] = []
    for p in pts:
        if not deduped or p != deduped[-1]:
            deduped.append(p)
    return deduped


def _signed_area(pts: list[tuple[float, float]]) -> float:
    n = len(pts)
    return sum(
        pts[i][0] * pts[(i + 1) % n][1] - pts[(i + 1) % n][0] * pts[i][1] for i in range(n)
    )


def normalize_geometry(geometry: dict) -> dict:
    """FR-5.6：6 位精度、逆時針、最西南起點、閉合 ring."""
    pts = _round_ring(geometry["coordinates"][0])
    if _signed_area(pts) < 0:
        pts.reverse()
    start = min(range(len(pts)), key=lambda i: (pts[i][0], pts[i][1]))
    pts = pts[start:] + pts[:start]
    ring = [[x, y] for x, y in pts]
    ring.append(list(ring[0]))
    return {"type": "Polygon", "coordinates": [ring]}


def geometry_hash(geometry: dict) -> str:
    """正規化 GeoJSON 之 SHA-256（key 排序、無空白、UTF-8）."""
    normalized = normalize_geometry(geometry)
    payload = json.dumps(
        normalized, sort_keys=True, separators=(",", ":"), ensure_ascii=False
    ).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


# ---- 以下為 Task 4 追加：驗證與面積（FR-3.3 / §5 NFR）----

MAX_VERTICES = 500
# 台灣本島與離島外接框（FR-3.3）
TAIWAN_BBOX = (119.0, 21.8, 122.1, 25.4)  # (min_lon, min_lat, max_lon, max_lat)

_TO_TWD97 = Transformer.from_crs("EPSG:4326", "EPSG:3826", always_xy=True)


class GeometryError(Exception):
    def __init__(self, code: str, message: str):
        self.code = code
        self.message = message
        super().__init__(message)


def validate_polygon(geometry: dict) -> None:
    """FR-3.3：型別、頂點數、自相交、台灣外接框。不合法 raise GeometryError."""
    if geometry.get("type") != "Polygon" or not geometry.get("coordinates"):
        raise GeometryError("invalid_type", "geometry 必須為 GeoJSON Polygon")

    ring = geometry["coordinates"][0]
    # 頂點數以「去閉合點後」計（閉合重複點不算獨立頂點）
    vertex_count = len(ring) - 1 if len(ring) > 1 and ring[0] == ring[-1] else len(ring)
    if vertex_count < 3:
        raise GeometryError("too_few_vertices", "多邊形至少需要 3 個頂點")
    if vertex_count > MAX_VERTICES:
        raise GeometryError("too_many_vertices", f"頂點數 {vertex_count} 超過上限 {MAX_VERTICES}")

    geom = shape(geometry)
    if not geom.is_valid:
        raise GeometryError("self_intersection", f"多邊形無效：{explain_validity(geom)}")

    min_lon, min_lat, max_lon, max_lat = geom.bounds
    if (
        min_lon < TAIWAN_BBOX[0]
        or min_lat < TAIWAN_BBOX[1]
        or max_lon > TAIWAN_BBOX[2]
        or max_lat > TAIWAN_BBOX[3]
    ):
        raise GeometryError(
            "out_of_taiwan_bbox",
            "林區必須完整位於台灣範圍內（E119–122.1°, N21.8–25.4°）",
        )


def polygon_area_ha(geometry: dict) -> float:
    """轉 EPSG:3826（TWD97 / TM2）計算面積，回傳公頃（round 4 位）."""
    geom = shape(geometry)
    projected = shapely_transform(_TO_TWD97.transform, geom)
    return round(projected.area / 10_000.0, 4)
