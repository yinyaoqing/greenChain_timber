"""農業部主要造林樹種生物量係數表.

版本：MOA-2024-v1
換算流程（FR-4.2）：
    單株材積 v(age) = v_max * (1 - exp(-k * age)) ** m   [m3/株, Chapman-Richards]
    林分蓄積 = v(age) * 種植密度(株/ha) * 面積(ha)          [m3]
    生物量   = 蓄積 * wood_density * bef                   [噸]
    碳       = 生物量 * CARBON_FRACTION                    [噸 C]
    CO2e     = 碳 * CO2_CONVERSION                         [噸 CO2e]

注意：以下所有樹種係數皆為文獻常見值 PLACEHOLDER（規格書 FR-4.5 / R1），
正式係數待農業部/林業署文獻查證（docs/references/）後更新；
更新時 bump FORMULA_VERSION（如 MOA-2024-v2），舊版常數保留以維持估算可追溯（G3）。
"""

FORMULA_VERSION = "MOA-2024-v1"

CARBON_FRACTION = 0.5  # 碳轉換係數（IPCC 預設值）
CO2_CONVERSION = 44 / 12  # C -> CO2e 分子量比

SPECIES_COEFFICIENTS: dict[str, dict[str, float]] = {
    # 台灣杉 Taiwania cryptomerioides
    "taiwania": {
        "v_max": 0.60,  # PLACEHOLDER 單株漸近材積 (m3)
        "k": 0.050,  # PLACEHOLDER 生長速率
        "m": 2.5,  # PLACEHOLDER 形狀參數
        "wood_density": 0.35,  # PLACEHOLDER 木材密度 (噸/m3)
        "bef": 1.40,  # PLACEHOLDER 生物量擴展係數
    },
    # 相思樹 Acacia confusa
    "acacia": {
        "v_max": 0.45,  # PLACEHOLDER
        "k": 0.065,  # PLACEHOLDER
        "m": 2.2,  # PLACEHOLDER
        "wood_density": 0.60,  # PLACEHOLDER
        "bef": 1.50,  # PLACEHOLDER
    },
    # 光臘樹 Fraxinus griffithii
    "fraxinus": {
        "v_max": 0.50,  # PLACEHOLDER
        "k": 0.055,  # PLACEHOLDER
        "m": 2.3,  # PLACEHOLDER
        "wood_density": 0.55,  # PLACEHOLDER
        "bef": 1.50,  # PLACEHOLDER
    },
}
