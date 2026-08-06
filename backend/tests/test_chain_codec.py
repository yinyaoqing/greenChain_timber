import pytest

from app.services.chain_codec import (
    GREEN_ASSET_ABI,
    SPECIES_CODE,
    carbon_kg,
    geo_hash_bytes32,
)


def test_species_codes_match_spec():
    assert SPECIES_CODE == {"taiwania": 1, "acacia": 2, "fraxinus": 3}


@pytest.mark.parametrize(
    ("tons", "kg"),
    [(357.3476, 357348), (0.0004, 0), (0.0006, 1), (1.0, 1000), (0.9999, 1000)],
)
def test_carbon_kg_rounds_to_int(tons, kg):
    result = carbon_kg(tons)
    assert result == kg
    assert isinstance(result, int)


def test_geo_hash_bytes32_roundtrip():
    hex64 = "ab" * 32
    b = geo_hash_bytes32(hex64)
    assert isinstance(b, bytes)
    assert len(b) == 32
    assert b.hex() == hex64


def test_geo_hash_bytes32_rejects_bad_input():
    with pytest.raises(ValueError):
        geo_hash_bytes32("ab" * 31)  # 太短
    with pytest.raises(ValueError):
        geo_hash_bytes32("zz" * 32)  # 非 hex


def test_abi_contains_required_entries():
    names = {e.get("name") for e in GREEN_ASSET_ABI}
    assert {"mintPlot", "getPlotData", "PlotMinted"} <= names
