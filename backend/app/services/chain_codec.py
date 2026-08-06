"""鏈上編碼純函式與最小 ABI（FR-5.2 / §9）。無 I/O，可獨立測試."""

SPECIES_CODE: dict[str, int] = {"taiwania": 1, "acacia": 2, "fraxinus": 3}


def carbon_kg(co2e_tons: float) -> int:
    """噸 -> 公斤取整（FR-5.2：×1000 避免浮點上鏈）."""
    return int(round(co2e_tons * 1000))


def geo_hash_bytes32(hex64: str) -> bytes:
    """DB geo_hash（64 hex）-> bytes32；格式錯誤 raise ValueError."""
    if len(hex64) != 64:
        raise ValueError(f"geo_hash 長度必須為 64 hex，得到 {len(hex64)}")
    return bytes.fromhex(hex64)


# GreenAssetNFT 最小 ABI（與 contracts/contracts/GreenAssetNFT.sol 對應）
GREEN_ASSET_ABI: list = [
    {
        "type": "function",
        "name": "mintPlot",
        "stateMutability": "nonpayable",
        "inputs": [
            {"name": "to", "type": "address"},
            {"name": "geoHash", "type": "bytes32"},
            {"name": "carbonKg", "type": "uint256"},
            {"name": "speciesCode", "type": "uint8"},
        ],
        "outputs": [{"name": "tokenId", "type": "uint256"}],
    },
    {
        "type": "function",
        "name": "getPlotData",
        "stateMutability": "view",
        "inputs": [{"name": "tokenId", "type": "uint256"}],
        "outputs": [
            {
                "name": "",
                "type": "tuple",
                "components": [
                    {"name": "geoHash", "type": "bytes32"},
                    {"name": "carbonKg", "type": "uint256"},
                    {"name": "speciesCode", "type": "uint8"},
                    {"name": "mintedAt", "type": "uint64"},
                ],
            }
        ],
    },
    {
        "type": "event",
        "name": "PlotMinted",
        "anonymous": False,
        "inputs": [
            {"indexed": True, "name": "tokenId", "type": "uint256"},
            {"indexed": False, "name": "geoHash", "type": "bytes32"},
            {"indexed": False, "name": "carbonKg", "type": "uint256"},
        ],
    },
]
