from app.services.geo_service import geometry_hash, normalize_geometry

# 宜蘭延文實驗林場周邊示範多邊形（順時針、起點非最西南、含閉合點）
BASE_RING = [
    [121.7520, 24.7250],
    [121.7560, 24.7250],
    [121.7560, 24.7210],
    [121.7520, 24.7210],
    [121.7520, 24.7250],
]


def _poly(ring):
    return {"type": "Polygon", "coordinates": [ring]}


class TestNormalizeGeometry:
    def test_output_ring_is_counterclockwise_and_starts_southwest(self):
        norm = normalize_geometry(_poly(BASE_RING))
        ring = norm["coordinates"][0]
        # 起點 = 最西南頂點（min 經度，再 min 緯度）
        assert ring[0] == [121.752, 24.721]
        # 閉合：首尾相同
        assert ring[0] == ring[-1]
        # 逆時針：shoelace 有向面積 > 0
        area2 = sum(
            ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1]
            for i in range(len(ring) - 1)
        )
        assert area2 > 0

    def test_rounds_to_6_decimals(self):
        ring = [
            [121.75201234567, 24.72501234567],
            [121.75601234567, 24.72501234567],
            [121.75601234567, 24.72101234567],
            [121.75201234567, 24.72101234567],
            [121.75201234567, 24.72501234567],
        ]
        norm = normalize_geometry(_poly(ring))
        for x, y in norm["coordinates"][0]:
            assert round(x, 6) == x
            assert round(y, 6) == y


class TestGeometryHashReproducibility:
    """AT-6 核心：同一多邊形不同表示法 -> 雜湊必須相同."""

    def test_hash_is_64_hex_chars(self):
        h = geometry_hash(_poly(BASE_RING))
        assert len(h) == 64
        assert all(c in "0123456789abcdef" for c in h)

    def test_rotated_start_vertex_same_hash(self):
        rotated = BASE_RING[2:-1] + BASE_RING[:2] + [BASE_RING[2]]
        assert geometry_hash(_poly(rotated)) == geometry_hash(_poly(BASE_RING))

    def test_reversed_winding_same_hash(self):
        reversed_ring = list(reversed(BASE_RING))
        assert geometry_hash(_poly(reversed_ring)) == geometry_hash(_poly(BASE_RING))

    def test_extra_precision_same_hash(self):
        noisy = [[x + 1e-9, y - 1e-9] for x, y in BASE_RING]
        assert geometry_hash(_poly(noisy)) == geometry_hash(_poly(BASE_RING))

    def test_unclosed_ring_same_hash(self):
        unclosed = BASE_RING[:-1]
        assert geometry_hash(_poly(unclosed)) == geometry_hash(_poly(BASE_RING))

    def test_different_polygon_different_hash(self):
        other = [[p[0] + 0.01, p[1]] for p in BASE_RING]
        assert geometry_hash(_poly(other)) != geometry_hash(_poly(BASE_RING))
