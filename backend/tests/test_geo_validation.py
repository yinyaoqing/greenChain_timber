import pytest

from app.services.geo_service import GeometryError, polygon_area_ha, validate_polygon


def _poly(ring):
    return {"type": "Polygon", "coordinates": [ring]}


# 宜蘭約 4.9 ha 的矩形：0.004° 經度 x 0.0044° 緯度
VALID_RING = [
    [121.752, 24.725],
    [121.756, 24.725],
    [121.756, 24.7206],
    [121.752, 24.7206],
    [121.752, 24.725],
]


class TestValidatePolygon:
    def test_valid_polygon_passes(self):
        validate_polygon(_poly(VALID_RING))  # 不應 raise

    def test_non_polygon_type_rejected(self):
        with pytest.raises(GeometryError) as exc:
            validate_polygon({"type": "Point", "coordinates": [121.75, 24.72]})
        assert exc.value.code == "invalid_type"

    def test_self_intersection_rejected(self):
        bowtie = [
            [121.752, 24.725],
            [121.756, 24.721],
            [121.756, 24.725],
            [121.752, 24.721],
            [121.752, 24.725],
        ]
        with pytest.raises(GeometryError) as exc:
            validate_polygon(_poly(bowtie))
        assert exc.value.code == "self_intersection"

    def test_too_many_vertices_rejected(self):
        import math

        n = 501
        ring = [
            [121.754 + 0.002 * math.cos(2 * math.pi * i / n),
             24.723 + 0.002 * math.sin(2 * math.pi * i / n)]
            for i in range(n)
        ]
        ring.append(ring[0])
        with pytest.raises(GeometryError) as exc:
            validate_polygon(_poly(ring))
        assert exc.value.code == "too_many_vertices"

    def test_outside_taiwan_bbox_rejected(self):
        tokyo = [
            [139.69, 35.68],
            [139.70, 35.68],
            [139.70, 35.69],
            [139.69, 35.69],
            [139.69, 35.68],
        ]
        with pytest.raises(GeometryError) as exc:
            validate_polygon(_poly(tokyo))
        assert exc.value.code == "out_of_taiwan_bbox"

    def test_triangle_minimum_passes(self):
        tri = [
            [121.752, 24.725],
            [121.756, 24.725],
            [121.754, 24.721],
            [121.752, 24.725],
        ]
        validate_polygon(_poly(tri))  # 不應 raise


class TestPolygonAreaHa:
    def test_area_close_to_expected(self):
        # 0.004° 經度（緯度 24.72 處約 404 m）x 0.0044° 緯度（約 487 m）≈ 19.7 ha
        # 精確值由 EPSG:3826 投影計算；此處驗證數量級與合理範圍
        area = polygon_area_ha(_poly(VALID_RING))
        assert 18.0 < area < 21.0

    def test_area_rounded_to_4_decimals(self):
        area = polygon_area_ha(_poly(VALID_RING))
        assert round(area, 4) == area
