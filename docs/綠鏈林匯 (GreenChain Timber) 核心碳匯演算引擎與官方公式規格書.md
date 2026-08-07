# 綠鏈林匯核心碳匯演算引擎與官方公式規格書

| 文件資訊 | 內容 |
|---|---|
| 文件性質 | **第二階段（DBH 精確模式）引擎規格草案** |
| 與現行系統關係 | 現行 v1.0 引擎（樹種/林齡/密度輸入，`MOA-2024-v1`，已上線）**不受本文件影響**；本文件規範 SBIR 第二階段之「胸徑（DBH）輸入模式」，兩模式並存（年齡式＝快速估算、DBH 式＝實測精確估算） |
| 係數狀態 | 本文件所列 D／BEF／R 與材積式係數為**候選值**，正式定稿前須補齊文獻頁碼層級之可稽核引註（對應 SBIR 第二階段研發項目 1） |

本文件將行政院農業部林業及自然保育署公告之官方森林碳匯方法學，轉譯為軟體工程之後端運算邏輯（Algorithm-as-a-Code），落實「科學自動算」核心功能，並以 ISO 14064-2（專案層級溫室氣體量化）為報告架構之對接規範。

---

## 一、 核心碳匯計量公式（森林自願減量專案方法學）

森林碳匯的基本計量邏輯，係透過樹木的幾何尺寸（胸徑與樹高）推算實體材積，再依據乾物質質量換算為總生物量，最終依據元素碳與二氧化碳之分子量比例，計算碳儲存量（公噸 CO2）。

**兩個計量量之定義（不可混用）**：
*   **碳儲存量（Stock，噸 CO₂e）**：某時點該林分累積吸存之總量——本節公式之輸出。
*   **年固碳量（Annual Flux，噸 CO₂e/年）**：逐年蓄積增量，即 \(Stock_{t} - Stock_{t-1}\)——**儀表板曲線與鏈上 `carbonKg` 採用者為此值**（與現行 v1.0 系統及規格書 FR-4.3 一致）。

\[碳儲存量 (tCO_2e) = 材積 (V) \times 木材基本密度 (D) \times 生物量擴大因子 (BEF) \times (1 + R) \times 含碳率 (CF) \times \frac{44}{12}\]

### 1. 核心參數定義
*   **\(V\) (Volume, 材積)**：樹木主幹之實體體積（單位：立方公尺，\(m^3\)）。
*   **\(D\) (Density, 木材基本密度)**：各樹種全乾木材之密度常數（單位：公噸/立方公尺，\(t/m^3\)）。
*   **\(BEF\) (Biomass Expansion Factor, 生物量擴大因子)**：將樹幹重量擴大計算至整棵樹（包含樹枝、樹葉）之地上部係數。
*   **\(R\) (Root-shoot ratio, 根莖比)**：地下根系生物量與地上部生物量之比率。
*   **\(CF\) (Carbon Fraction, 含碳率)**：木材組織中碳元素之佔比，國際與台灣官方通用標準值定為 **0.5**。
*   **44/12（≈ 3.6667）**：由元素碳（C）轉換為二氧化碳（\(CO_2\)）的分子量比例換算常數。程式中一律使用精確分數 `44/12`（與現行 v1.0 引擎一致），文件敘述可以 3.67 近似表達。

### 2. 台灣主力造林樹種基本係數表（候選值）
後端演算法針對前端傳入之 `species` 代號，於版本化常數表中查閱並套用以下低海拔造林係數。**下列數值為待查證之候選值**，定稿時每一係數須註記文獻出處與頁碼（彙編版本／資料集連結），並沿用現行引擎之版本化熱更換機制：

| 樹種代號 (`species`) | 樹種正名 | 木材基本密度 (\(D\)) | 生物量擴大因子 (\(BEF\)) | 地下根莖比 (\(R\)) | 含碳率 (\(CF\)) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `taiwania` | **台灣杉** | 0.380 | 1.45 | 0.25 | 0.5 |
| `acacia` | **相思樹** | 0.650 | 1.52 | 0.28 | 0.5 |
| `fraxinus` | **光臘樹** | 0.580 | 1.48 | 0.26 | 0.5 |

### 3. 官方指定二元材積迴歸方程式
計算單棵樹材積（\(V\)）時，系統採用官方標準二元材積式（胸徑 \(DBH\) 單位為公分；樹高 \(H\) 單位為公尺）：
\[V = a \times (DBH)^b \times H^c\]
*   **台灣杉 (Taiwania)**：\(V = 0.000068 \times (DBH)^{1.852} \times H^{0.925}\)
*   **相思樹 (Acacia)**：\(V = 0.000075 \times (DBH)^{1.902} \times H^{0.855}\)
*   **光臘樹 (Fraxinus)**：\(V = 0.000071 \times (DBH)^{1.885} \times H^{0.890}\)

---

## 二、 後端 Python FastAPI 核心演算代碼（第二階段新模組 `carbon_calc_dbh.py`；現行 `carbon_calc.py`（年齡式）保留並存）

```python
import math
from pydantic import BaseModel

# 官方樹種參數字典 (對應農業部開放資料標準)
OFFICIAL_SPECIES_COEFFICIENTS = {
    "taiwania": {  # 台灣杉
        "name": "台灣杉",
        "density": 0.380,
        "bef": 1.45,
        "root_ratio": 0.25,
        "carbon_fraction": 0.5,
        "volume_formula": lambda dbh, h: 0.000068 * (dbh ** 1.852) * (h ** 0.925)
    },
    "acacia": {   # 相思樹
        "name": "相思樹",
        "density": 0.650,
        "bef": 1.52,
        "root_ratio": 0.28,
        "carbon_fraction": 0.5,
        "volume_formula": lambda dbh, h: 0.000075 * (dbh ** 1.902) * (h ** 0.855)
    },
    "fraxinus": {  # 光臘樹
        "name": "光臘樹",
        "density": 0.580,
        "bef": 1.48,
        "root_ratio": 0.26,
        "carbon_fraction": 0.5,
        "volume_formula": lambda dbh, h: 0.000071 * (dbh ** 1.885) * (h ** 0.890)
    }
}

class CarbonCalculationPayload(BaseModel):
    species: str        # 樹種代號
    avg_dbh: float      # 平均胸徑 (cm)
    avg_height: float   # 平均樹高 (m)
    tree_count: int     # 該林區估算總樹量

def calculate_forest_carbon_sink(payload: CarbonCalculationPayload) -> dict:
    """
    依據行政院農業部《造林碳匯專案方法學》計算森林二氧化碳吸存量
    """
    sp = payload.species.lower()
    if sp not in OFFICIAL_SPECIES_COEFFICIENTS:
        raise ValueError(f"不支援的樹種代號: {payload.species}")
        
    coef = OFFICIAL_SPECIES_COEFFICIENTS[sp]
    
    # Step 1: 計算單棵樹材積 (m3)
    single_tree_volume = coef["volume_formula"](payload.avg_dbh, payload.avg_height)
    
    # Step 2: 計算整片林區總材積
    total_volume = single_tree_volume * payload.tree_count
    
    # Step 3: 材積換算為地上部乾重量 = 材積 * 木材基本密度 * 生物量擴大因子
    above_ground_biomass = total_volume * coef["density"] * coef["bef"]
    
    # Step 4: 加上地下根系重量 = 地上部乾重 * (1 + 根莖比)
    total_biomass = above_ground_biomass * (1 + coef["root_ratio"])
    
    # Step 5: 乾重換算為純碳重量 = 總生物量 * 含碳率 (0.5)
    total_carbon_tons = total_biomass * coef["carbon_fraction"]
    
    # Step 6: 純碳轉換為二氧化碳當量公噸數 = 純碳重 * 44/12（精確分數，勿用 3.67 捨入值）
    total_co2_tons = total_carbon_tons * (44 / 12)

    # 未來 5 年動態推估：同時輸出「碳儲存量（stock）」與「年固碳量（annual_flux）」。
    # 注意：4.5% 為暫定示範成長率（PLACEHOLDER）——正式版須改以樹種別生長模型
    # （官方蓄積表或 Chapman-Richards 逐年推演 DBH/H）推導逐年增量，於查證時定稿；
    # 單一固定複利不分樹種與林齡，僅供介面展示用，不得作為正式估算依據。
    ANNUAL_GROWTH_RATE_PLACEHOLDER = 0.045
    growth_projection = []
    prev_stock = total_co2_tons / (1 + ANNUAL_GROWTH_RATE_PLACEHOLDER)  # year -1 之近似存量
    for year in range(0, 6):
        stock = total_co2_tons * ((1 + ANNUAL_GROWTH_RATE_PLACEHOLDER) ** year)
        growth_projection.append({
            "year_offset": year,
            "co2_stock_tons": round(stock, 3),          # 碳儲存量（存量）
            "co2e_tons_per_year": round(stock - prev_stock, 3),  # 年固碳量（增量）→ 儀表板/上鏈用
        })
        prev_stock = stock

    return {
        "species_name": coef["name"],
        "single_tree_volume_m3": round(single_tree_volume, 5),
        "total_volume_m3": round(total_volume, 3),
        "current_co2_stock_tons": round(total_co2_tons, 3),
        "growth_projection": growth_projection,
        "formula_version": "MOA-ARR-2024-draft",  # 候選係數查證定稿後改為正式版號並凍結
    }
```

---

## 三、 權威資料來源出處 (Data Sources)

本平台的計量模型與公式引數，追溯自以下國家部會公告之正式法規與學術文獻。**定稿要求：下列每一出處於係數查證完成時，須補齊至「文件版本＋頁碼／資料集永久連結」層級**（對應 SBIR 第二階段研發項目 1 之可稽核標準），現階段僅標示來源類別：

1.  **方法學基礎**（BEF 與 R 之規範常數出處）：
    *   **行政院環境部溫室氣體自願減量專案資訊平台**：《造林與植林碳匯專案活動方法學》。［待補：方法學編號、版次、對應條文／附表編號］
2.  **樹種材積迴歸式與基本係數**（D 與二元材積式係數出處）：
    *   **中華民國農業部林業及自然保育署（原林務局）**：《台灣主要造林樹種基本係數與材積式彙編》。［待補：版本年份與頁碼］
    *   **農業資料開放平臺（MOA Open Data）**：台灣主要造林樹種生長公式與基本參數資料集。［待補：資料集識別碼與永久連結］
3.  **國際審計對接規範**：
    *   **ISO 14064-2**（專案層級溫室氣體減量之量化、監測與報告規範）：本平台產出之數位化專案設計文件（Digital PDD）報告架構之對接標準。
    *   **ISO 14068-1:2023**（碳中和）：作為企業買方端碳中和宣告之脈絡參考，非本引擎之量化規範。
