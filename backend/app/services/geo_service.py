"""幾何服務：正規化、雜湊（本任務）；驗證、面積（Task 4 加入）。FR-3.3 / FR-5.6."""

import hashlib
import json


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
