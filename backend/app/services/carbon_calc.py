"""碳匯估算模組（FR-4.1–4.3）。純函式、無 I/O，公式係數見 carbon_coefficients.py."""

import math
from dataclasses import dataclass

from app.services.carbon_coefficients import (
    CARBON_FRACTION,
    CO2_CONVERSION,
    FORMULA_VERSION,
    SPECIES_COEFFICIENTS,
)


@dataclass(frozen=True)
class YearEstimate:
    year_offset: int  # 0 = 當年, 1–5 = 未來逐年
    co2e_tons: float  # 該年度固碳量（噸 CO2e/年）


@dataclass(frozen=True)
class CarbonEstimate:
    formula_version: str
    input_snapshot: dict
    yearly: list[YearEstimate]


def _tree_volume_m3(coef: dict[str, float], age: int) -> float:
    """單株材積 Chapman-Richards 生長模型（m3/株）."""
    if age <= 0:
        return 0.0
    return coef["v_max"] * (1 - math.exp(-coef["k"] * age)) ** coef["m"]


def _stand_stock_co2e_tons(species: str, age: int, density: int, area_ha: float) -> float:
    """林分於指定年齡的碳儲存量（噸 CO2e）：蓄積 -> 生物量 -> 碳 -> CO2e."""
    coef = SPECIES_COEFFICIENTS[species]
    volume = _tree_volume_m3(coef, age) * density * area_ha
    biomass_tons = volume * coef["wood_density"] * coef["bef"]
    return biomass_tons * CARBON_FRACTION * CO2_CONVERSION


def estimate_carbon(species: str, avg_age: int, density: int, area_ha: float) -> CarbonEstimate:
    """輸入樹種/平均年齡/密度/面積，輸出當年 + 未來 5 年逐年固碳量（蓄積增量法）."""
    if species not in SPECIES_COEFFICIENTS:
        raise ValueError(f"unknown species: {species}")

    yearly = []
    for offset in range(6):
        age = avg_age + offset
        annual = _stand_stock_co2e_tons(species, age, density, area_ha) - _stand_stock_co2e_tons(
            species, age - 1, density, area_ha
        )
        yearly.append(YearEstimate(year_offset=offset, co2e_tons=round(annual, 4)))

    input_snapshot = {
        "species": species,
        "avg_age": avg_age,
        "density": density,
        "area_ha": area_ha,
        "coefficients": SPECIES_COEFFICIENTS[species],
    }
    return CarbonEstimate(
        formula_version=FORMULA_VERSION, input_snapshot=input_snapshot, yearly=yearly
    )
