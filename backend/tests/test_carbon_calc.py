import math
from dataclasses import FrozenInstanceError

import pytest

from app.services.carbon_calc import CarbonEstimate, YearEstimate, estimate_carbon
from app.services.carbon_coefficients import (
    CARBON_FRACTION,
    CO2_CONVERSION,
    FORMULA_VERSION,
    SPECIES_COEFFICIENTS,
)

ALL_SPECIES = ["taiwania", "acacia", "fraxinus"]


def _oracle_stock_co2e(species: str, age: int, density: int, area_ha: float) -> float:
    """依規格書 FR-4.2 換算鏈獨立重算碳儲存量（測試 oracle，不呼叫被測模組內部函式）."""
    c = SPECIES_COEFFICIENTS[species]
    if age <= 0:
        return 0.0
    volume = c["v_max"] * (1 - math.exp(-c["k"] * age)) ** c["m"] * density * area_ha
    return volume * c["wood_density"] * c["bef"] * CARBON_FRACTION * CO2_CONVERSION


class TestEstimateCarbon:
    def test_returns_six_yearly_estimates_with_offsets_0_to_5(self):
        result = estimate_carbon("taiwania", 15, 1500, 5.0)
        assert isinstance(result, CarbonEstimate)
        assert [y.year_offset for y in result.yearly] == [0, 1, 2, 3, 4, 5]

    def test_formula_version_and_snapshot(self):
        result = estimate_carbon("acacia", 20, 2000, 3.0)
        assert result.formula_version == FORMULA_VERSION
        snap = result.input_snapshot
        assert snap["species"] == "acacia"
        assert snap["avg_age"] == 20
        assert snap["density"] == 2000
        assert snap["area_ha"] == 3.0
        assert snap["coefficients"] == SPECIES_COEFFICIENTS["acacia"]

    @pytest.mark.parametrize("species", ALL_SPECIES)
    @pytest.mark.parametrize("age", [1, 15, 100])  # 含邊界年齡 1 與 100
    def test_annual_co2e_matches_hand_calc(self, species, age):
        density, area = 1500, 5.0
        result = estimate_carbon(species, age, density, area)
        for y in result.yearly:
            a = age + y.year_offset
            expected = _oracle_stock_co2e(species, a, density, area) - _oracle_stock_co2e(
                species, a - 1, density, area
            )
            assert y.co2e_tons == pytest.approx(expected, abs=1e-3)

    @pytest.mark.parametrize("species", ALL_SPECIES)
    def test_annual_values_positive(self, species):
        result = estimate_carbon(species, 10, 1000, 1.0)
        assert all(y.co2e_tons > 0 for y in result.yearly)

    def test_scales_linearly_with_area(self):
        one = estimate_carbon("taiwania", 15, 1500, 1.0)
        ten = estimate_carbon("taiwania", 15, 1500, 10.0)
        for y1, y10 in zip(one.yearly, ten.yearly, strict=True):
            assert y10.co2e_tons == pytest.approx(y1.co2e_tons * 10, rel=1e-3)

    def test_unknown_species_raises_value_error(self):
        with pytest.raises(ValueError, match="unknown species"):
            estimate_carbon("bamboo", 10, 1000, 1.0)


def test_year_estimate_is_frozen():
    y = YearEstimate(year_offset=0, co2e_tons=1.0)
    with pytest.raises(FrozenInstanceError):
        y.co2e_tons = 2.0
