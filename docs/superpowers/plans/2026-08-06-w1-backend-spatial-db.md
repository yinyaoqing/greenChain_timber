# 綠鏈林匯 Week 1 — 後端與空間資料庫 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成里程碑 M1 — `POST /api/forest` 在本機跑通「JWT 驗證 → 幾何驗證 → 防重疊 → 碳匯估算 → 三表 transaction 入庫」，單元測試綠燈，可用 curl 完成一筆完整申報。

**Architecture:** FastAPI（Python 3.12）+ asyncpg 直連 Supabase PostgreSQL/PostGIS。估算模組 `carbon_calc.py` 與幾何模組 `geo_service.py` 為純函式、無 I/O，可獨立單元測試；空間重疊檢查交給 PostGIS（`ST_Intersects` + `ST_Intersection`）；上鏈（chain_service）屬 Week 3，本週僅將林區狀態寫為 `chain_pending` 佔位。

**Tech Stack:** Python 3.12、uv、FastAPI、asyncpg、Pydantic v2、shapely、pyproj、PyJWT、pytest、ruff、Supabase (PostgreSQL 15 + PostGIS)

**對應文件:** 《專案規格書 v1.0》FR-1/FR-3/FR-4、§7 資料模型、§8 API 規格；《開發計畫 v1.0》T1.1–T1.9

## Global Constraints

- 樹種代碼固定三值：`'taiwania'`（台灣杉）、`'acacia'`（相思樹）、`'fraxinus'`（光臘樹）
- 公式版本號：`MOA-2024-v1`；係數為文獻常見值 placeholder 時必須註記 `# PLACEHOLDER`（FR-4.5 / T1.1）
- 幾何統一存 EPSG:4326；面積計算轉 EPSG:3826（TWD97 / TM2），單位公頃
- 重疊判定門檻：交集面積 > 0.001 ha → HTTP 409（FR-3.2）
- 幾何驗證：多邊形有效、不可自相交、頂點數 ≤ 500、需落於台灣外接框 E119–122.1°、N21.8–25.4°，違者 422（FR-3.3）
- 欄位範圍：avg_age 1–100、density 100–10,000（株/公頃）、面積 0.1–1,000 ha（FR-2.3/FR-2.4）
- 雜湊正規化規則（FR-5.6）：座標精度小數 6 位、頂點逆時針、起點取最西南頂點、JSON key 排序、UTF-8 序列化後 SHA-256
- 秘密管理紅線：所有連線字串/私鑰只放 `.env`（已 `.gitignore`）；repo 只放 `.env.example`（變數名，無值）
- Commit 訊息格式：`T1.x: <內容>`；每個任務結束 commit 一次；main 永遠可部署
- 開發環境為 Windows；指令以 PowerShell 語法示範，工作目錄除特別註明外皆為 repo 根目錄下的 `backend/`

---

### Task 1: Backend 專案骨架與工具鏈（對應 T1.3 前置 / D0）

**Files:**
- Create: `backend/pyproject.toml`
- Create: `backend/.env.example`
- Create: `backend/app/__init__.py`（空檔）
- Create: `backend/app/services/__init__.py`（空檔）
- Create: `backend/app/db/__init__.py`（空檔）
- Create: `backend/app/routers/__init__.py`（空檔）
- Create: `backend/app/core/__init__.py`（空檔）
- Create: `backend/tests/__init__.py`（空檔）
- Create: `.gitignore`（repo 根目錄）
- Create: `docs/devlog.md`

**Interfaces:**
- Consumes: 無（首個任務）
- Produces: 可 `uv sync` 的 Python 專案；後續所有任務的目錄結構與依賴

- [ ] **Step 1: 建立 .gitignore（repo 根目錄）**

```gitignore
# Python
__pycache__/
*.pyc
.venv/
.pytest_cache/
.ruff_cache/

# 環境變數（秘密管理紅線：絕不進版控）
.env
.env.*
!.env.example

# Node（W2 起使用）
node_modules/
.next/

# Hardhat（W3 起使用）
contracts/artifacts/
contracts/cache/

# 編輯器
.vscode/
.idea/
```

- [ ] **Step 2: 建立 backend/pyproject.toml**

```toml
[project]
name = "greenchain-backend"
version = "0.1.0"
description = "GreenChain Timber MRV backend (FastAPI + PostGIS)"
requires-python = ">=3.12"
dependencies = [
    "fastapi>=0.115",
    "uvicorn[standard]>=0.30",
    "asyncpg>=0.29",
    "pydantic>=2.8",
    "pydantic-settings>=2.4",
    "shapely>=2.0",
    "pyproj>=3.6",
    "pyjwt>=2.9",
    "httpx>=0.27",
]

[dependency-groups]
dev = [
    "pytest>=8.3",
    "pytest-asyncio>=0.24",
    "ruff>=0.6",
]

[tool.pytest.ini_options]
testpaths = ["tests"]
asyncio_mode = "auto"

[tool.ruff]
line-length = 100
target-version = "py312"

[tool.ruff.lint]
select = ["E", "F", "I", "UP", "B"]
```

- [ ] **Step 3: 建立 backend/.env.example**

```bash
# Supabase Postgres 直連字串（Schema 套用與本機開發用 5432 直連，非 6543 pooler）
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@db.YOUR_PROJECT.supabase.co:5432/postgres

# Supabase Dashboard > Settings > API > JWT Secret
SUPABASE_JWT_SECRET=your-supabase-jwt-secret

# CORS 允許來源（逗號分隔）
CORS_ORIGINS=http://localhost:3000
```

- [ ] **Step 4: 建立空的 package 檔案與 devlog**

建立以下空檔：`backend/app/__init__.py`、`backend/app/services/__init__.py`、`backend/app/db/__init__.py`、`backend/app/routers/__init__.py`、`backend/app/core/__init__.py`、`backend/tests/__init__.py`。

建立 `docs/devlog.md`：

```markdown
# 開發日誌（每日收工 15 分鐘自我 stand-up）

格式：日期 / 今天完成 / 明天首件事 / 目前最大風險

---
```

- [ ] **Step 5: 安裝依賴並驗證**

Run（於 `backend/`）: `uv sync`
Expected: 建立 `.venv/` 並成功解析安裝所有依賴，無錯誤。

Run: `uv run python -c "import fastapi, asyncpg, shapely, pyproj, jwt; print('ok')"`
Expected: 輸出 `ok`

- [ ] **Step 6: Commit**

```powershell
git add .gitignore backend/ docs/devlog.md
git commit -m "T1.3: backend 專案骨架與工具鏈（uv + FastAPI 依賴 + ruff/pytest 設定）"
```

---

### Task 2: 碳匯係數表與估算模組 carbon_calc（對應 T1.1 / T1.6，FR-4.1–4.3）

**Files:**
- Create: `backend/app/services/carbon_coefficients.py`
- Create: `backend/app/services/carbon_calc.py`
- Test: `backend/tests/test_carbon_calc.py`

**Interfaces:**
- Consumes: 無
- Produces:
  - `carbon_coefficients.FORMULA_VERSION: str`（值 `"MOA-2024-v1"`）
  - `carbon_coefficients.SPECIES_COEFFICIENTS: dict[str, dict[str, float]]`（key 為三樹種代碼）
  - `carbon_calc.estimate_carbon(species: str, avg_age: int, density: int, area_ha: float) -> CarbonEstimate`
  - `CarbonEstimate`（frozen dataclass）：`formula_version: str`、`input_snapshot: dict`、`yearly: list[YearEstimate]`（恆為 6 筆，year_offset 0–5）
  - `YearEstimate`（frozen dataclass）：`year_offset: int`、`co2e_tons: float`（該年度固碳量，噸 CO₂e/年，四捨五入 4 位）

**估算模型說明（寫給實作者）：** 採單株 Chapman-Richards 生長模型近似農業部材積式：單株材積 `v(age) = v_max × (1 − e^(−k×age))^m`（m³/株）。林分蓄積 = `v(age) × density × area_ha`。換算鏈（FR-4.2）：蓄積 × 木材密度 × BEF = 生物量（噸）→ × 0.5 = 碳（噸）→ × 44/12 = CO₂e（噸）。**年度固碳量 = 該年齡碳儲存量 − 前一年齡碳儲存量**（蓄積增量法，FR-4.3）。所有係數均為 PLACEHOLDER，待文獻查證後更新（T1.1 的文獻查證是人工作業，不在本計畫內；查證後只改常數表並視情況 bump 版本號）。

- [ ] **Step 1: 建立係數表 carbon_coefficients.py**

```python
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
```

- [ ] **Step 2: 寫失敗測試 test_carbon_calc.py**

測試以「規格書換算鏈的獨立重算」作為 oracle（等同手算 Excel 對照，T1.6 DoD）：

```python
import math

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
        for y1, y10 in zip(one.yearly, ten.yearly):
            assert y10.co2e_tons == pytest.approx(y1.co2e_tons * 10, rel=1e-3)

    def test_unknown_species_raises_value_error(self):
        with pytest.raises(ValueError, match="unknown species"):
            estimate_carbon("bamboo", 10, 1000, 1.0)


def test_year_estimate_is_frozen():
    y = YearEstimate(year_offset=0, co2e_tons=1.0)
    with pytest.raises(Exception):
        y.co2e_tons = 2.0
```

- [ ] **Step 3: 執行測試確認失敗**

Run: `uv run pytest tests/test_carbon_calc.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.carbon_calc'`

- [ ] **Step 4: 實作 carbon_calc.py**

```python
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
```

- [ ] **Step 5: 執行測試確認通過**

Run: `uv run pytest tests/test_carbon_calc.py -v`
Expected: 全數 PASS（≥ 8 個案例，符合 T1.6 DoD「三樹種 × 邊界年齡」）

- [ ] **Step 6: Commit**

```powershell
git add backend/app/services/carbon_coefficients.py backend/app/services/carbon_calc.py backend/tests/test_carbon_calc.py
git commit -m "T1.6: carbon_calc 估算模組 + MOA-2024-v1 係數表（placeholder 註記）"
```

---

### Task 3: 幾何正規化與 SHA-256 雜湊（對應 T1.4，FR-5.6，AT-6 基礎）

**Files:**
- Create: `backend/app/services/geo_service.py`
- Test: `backend/tests/test_geo_hash.py`

**Interfaces:**
- Consumes: 無
- Produces:
  - `geo_service.normalize_geometry(geometry: dict) -> dict`（回傳正規化後 GeoJSON Polygon dict）
  - `geo_service.geometry_hash(geometry: dict) -> str`（64 字元 hex SHA-256）
  - 本檔於 Task 4 會再加入驗證與面積函式（同一檔案，分兩個任務實作）

**正規化規則（FR-5.6，逐條）：** ① 座標四捨五入到小數 6 位；② 去除閉合重複點與捨入後產生的連續重複點；③ 外環統一逆時針（shoelace 有向面積 > 0）；④ 起始頂點取最西南（先比最小經度，再比最小緯度）；⑤ 輸出 ring 重新閉合（首點複製到尾）；⑥ `json.dumps(sort_keys=True, separators=(",", ":"))` 後 UTF-8 編碼計算 SHA-256。

- [ ] **Step 1: 寫失敗測試 test_geo_hash.py**

```python
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
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `uv run pytest tests/test_geo_hash.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.geo_service'`

- [ ] **Step 3: 實作 normalize_geometry 與 geometry_hash**

```python
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
```

- [ ] **Step 4: 執行測試確認通過**

Run: `uv run pytest tests/test_geo_hash.py -v`
Expected: 全數 PASS

- [ ] **Step 5: Commit**

```powershell
git add backend/app/services/geo_service.py backend/tests/test_geo_hash.py
git commit -m "T1.4: 幾何正規化與 SHA-256 雜湊（雜湊可重現性測試通過）"
```

---

### Task 4: 幾何驗證與 EPSG:3826 面積計算（對應 T1.4，FR-3.3 / §5 NFR）

**Files:**
- Modify: `backend/app/services/geo_service.py`（Task 3 建立，於檔尾追加）
- Test: `backend/tests/test_geo_validation.py`

**Interfaces:**
- Consumes: Task 3 的 `geo_service.py`
- Produces:
  - `geo_service.GeometryError(Exception)`：屬性 `code: str`、`message: str`
  - `geo_service.validate_polygon(geometry: dict) -> None`（不合法時 raise `GeometryError`；code 值域：`"invalid_type"`、`"too_few_vertices"`、`"too_many_vertices"`、`"self_intersection"`、`"out_of_taiwan_bbox"`）
  - `geo_service.polygon_area_ha(geometry: dict) -> float`（EPSG:3826 面積，公頃，round 4 位）

- [ ] **Step 1: 寫失敗測試 test_geo_validation.py**

```python
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
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `uv run pytest tests/test_geo_validation.py -v`
Expected: FAIL — `ImportError: cannot import name 'GeometryError'`

- [ ] **Step 3: 於 geo_service.py 檔尾追加驗證與面積函式**

```python
# ---- 以下為 Task 4 追加：驗證與面積（FR-3.3 / §5 NFR）----

from pyproj import Transformer
from shapely.geometry import shape
from shapely.ops import transform as shapely_transform
from shapely.validation import explain_validity

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
```

- [ ] **Step 4: 執行測試確認通過**

Run: `uv run pytest tests/test_geo_validation.py tests/test_geo_hash.py -v`
Expected: 全數 PASS（含 Task 3 測試無回歸）

- [ ] **Step 5: Commit**

```powershell
git add backend/app/services/geo_service.py backend/tests/test_geo_validation.py
git commit -m "T1.4: 幾何驗證（自相交/頂點數/台灣外接框）與 EPSG:3826 面積計算"
```

---

### Task 5: 資料庫 Schema 與套用腳本（對應 T1.2，§7 資料模型）

**前置（人工，一次性）：** 於 Supabase Dashboard 建立專案，取得直連 `DATABASE_URL`（Settings → Database → Connection string，port 5432）與 `SUPABASE_JWT_SECRET`（Settings → API），填入 `backend/.env`。

**Files:**
- Create: `backend/app/db/schema.sql`
- Create: `backend/scripts/apply_schema.py`

**Interfaces:**
- Consumes: `.env` 中的 `DATABASE_URL`
- Produces: Supabase 上三張表 `forest_plots` / `carbon_estimates` / `chain_records` + GIST 索引；後續任務的 SQL 皆以此 schema 為準

- [ ] **Step 1: 建立 schema.sql（可重放，從零重建 = T1.2 DoD）**

```sql
-- 綠鏈林匯 schema v1（規格書 §7）。可於 Supabase SQL Editor 或 apply_schema.py 重放。
create extension if not exists postgis;

-- §7.1 核心資料表
create table if not exists forest_plots (
    id          uuid primary key default gen_random_uuid(),
    owner_id    uuid not null references auth.users (id),
    name        text not null,
    species     text not null check (species in ('taiwania', 'acacia', 'fraxinus')),
    avg_age     int  not null check (avg_age between 1 and 100),
    density     int  not null check (density between 100 and 10000),
    geom        geometry (Polygon, 4326) not null,
    area_ha     numeric(10, 4) not null,
    geo_hash    char(64) not null unique,
    status      text not null default 'chain_pending'
                check (status in ('active', 'chain_pending', 'on_chain', 'rejected')),
    created_at  timestamptz not null default now()
);

-- FR-3.4：GIST 空間索引
create index if not exists idx_forest_plots_geom on forest_plots using gist (geom);

-- §7.2 估算紀錄（可追溯，G3）
create table if not exists carbon_estimates (
    id              uuid primary key default gen_random_uuid(),
    plot_id         uuid not null references forest_plots (id) on delete cascade,
    formula_version text not null,
    input_snapshot  jsonb not null,
    year_offset     int not null check (year_offset between 0 and 5),
    co2e_tons       numeric(12, 4) not null,
    created_at      timestamptz not null default now(),
    unique (plot_id, year_offset)
);

-- §7.3 鏈上紀錄（W3 使用，先建表）
create table if not exists chain_records (
    id               uuid primary key default gen_random_uuid(),
    plot_id          uuid not null unique references forest_plots (id) on delete cascade,
    contract_address text,
    token_id         bigint,
    tx_hash          text,
    chain_id         int not null default 80002,
    minted_at        timestamptz,
    retry_count      int not null default 0,
    last_error       text
);
```

- [ ] **Step 2: 建立套用腳本 scripts/apply_schema.py**

```python
"""將 app/db/schema.sql 套用到 DATABASE_URL 指向的資料庫（冪等，可重放）.

用法（於 backend/）：uv run python scripts/apply_schema.py
"""

import asyncio
import os
import pathlib
import sys

import asyncpg


async def main() -> None:
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        # 允許從 .env 讀取（本機開發便利）
        env_path = pathlib.Path(__file__).resolve().parents[1] / ".env"
        if env_path.exists():
            for line in env_path.read_text(encoding="utf-8").splitlines():
                if line.startswith("DATABASE_URL="):
                    database_url = line.split("=", 1)[1].strip()
    if not database_url:
        sys.exit("DATABASE_URL 未設定（環境變數或 backend/.env）")

    sql = (
        pathlib.Path(__file__).resolve().parents[1] / "app" / "db" / "schema.sql"
    ).read_text(encoding="utf-8")
    conn = await asyncpg.connect(database_url)
    try:
        await conn.execute(sql)
        print("schema applied OK")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
```

- [ ] **Step 3: 套用並驗證（DoD：重放兩次皆成功）**

Run: `uv run python scripts/apply_schema.py`
Expected: `schema applied OK`

Run 再執行一次（驗證冪等）: `uv run python scripts/apply_schema.py`
Expected: `schema applied OK`（`if not exists` 保證可重放）

Run（驗證表與索引存在）:
```powershell
uv run python -c "import asyncio, asyncpg, os; asyncio.run((lambda: (lambda c=None: None))())" # 佔位，實際用下行
```
於 Supabase SQL Editor 執行：
```sql
select tablename from pg_tables where schemaname = 'public';
select indexname from pg_indexes where tablename = 'forest_plots';
```
Expected: 三張表齊全；`idx_forest_plots_geom` 存在。

- [ ] **Step 4: Commit**

```powershell
git add backend/app/db/schema.sql backend/scripts/apply_schema.py
git commit -m "T1.2: 三表 schema + GIST 索引 + 冪等套用腳本"
```

---

### Task 6: FastAPI 骨架 — settings / JSON log / 連線池 / healthz（對應 T1.3）

**Files:**
- Create: `backend/app/core/settings.py`
- Create: `backend/app/core/logging.py`
- Create: `backend/app/db/pool.py`
- Create: `backend/app/main.py`
- Test: `backend/tests/conftest.py`
- Test: `backend/tests/test_healthz.py`

**Interfaces:**
- Consumes: 環境變數 `DATABASE_URL`、`SUPABASE_JWT_SECRET`、`CORS_ORIGINS`
- Produces:
  - `settings.get_settings() -> Settings`（lru_cache；屬性 `database_url: str`、`supabase_jwt_secret: str`、`cors_origins: str`）
  - `pool.get_conn(request) `：FastAPI dependency，yield `asyncpg.Connection`；pool 不可用時 raise HTTPException 503
  - `main.app`：FastAPI 實例；lifespan 建立 `app.state.pool`（連線失敗時為 `None`，服務仍可啟動 — 讓單元測試與 healthz 不依賴 DB）
  - `GET /healthz` → `{"status": "ok", "db": "up" | "down"}`

- [ ] **Step 1: 寫失敗測試 conftest.py + test_healthz.py**

`tests/conftest.py`：

```python
"""測試共用設定：在 import app 之前塞入假環境變數，避免依賴真實 .env/DB."""

import os

# 指向不存在的 DB：pool 建立失敗 -> app.state.pool = None，單元測試不碰真實 DB
os.environ.setdefault("DATABASE_URL", "postgresql://invalid:invalid@127.0.0.1:1/invalid")
os.environ.setdefault("SUPABASE_JWT_SECRET", "test-secret")
os.environ.setdefault("CORS_ORIGINS", "http://localhost:3000")
```

`tests/test_healthz.py`：

```python
from fastapi.testclient import TestClient

from app.main import app


def test_healthz_returns_ok_even_without_db():
    with TestClient(app) as client:
        resp = client.get("/healthz")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["db"] == "down"  # conftest 指向無效 DB
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `uv run pytest tests/test_healthz.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.main'`

- [ ] **Step 3: 實作 settings.py / logging.py / pool.py / main.py**

`app/core/settings.py`：

```python
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str
    supabase_jwt_secret: str
    cors_origins: str = "http://localhost:3000"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
```

`app/core/logging.py`（結構化 JSON log，§5 NFR，不加額外依賴）：

```python
import json
import logging
import sys
from datetime import UTC, datetime


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "ts": datetime.now(UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
        }
        if record.exc_info:
            payload["exc"] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=False)


def setup_logging() -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(logging.INFO)
```

`app/db/pool.py`：

```python
import logging

import asyncpg
from fastapi import HTTPException, Request

logger = logging.getLogger(__name__)


async def create_pool(database_url: str) -> asyncpg.Pool | None:
    """建立連線池；失敗回傳 None（服務仍可啟動，healthz 回報 db down）."""
    try:
        return await asyncpg.create_pool(database_url, min_size=1, max_size=5, timeout=10)
    except Exception:
        logger.exception("database pool creation failed")
        return None


async def get_conn(request: Request):
    """FastAPI dependency：從 app.state.pool 取連線."""
    pool: asyncpg.Pool | None = request.app.state.pool
    if pool is None:
        raise HTTPException(status_code=503, detail="database unavailable")
    async with pool.acquire() as conn:
        yield conn
```

`app/main.py`：

```python
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.logging import setup_logging
from app.core.settings import get_settings
from app.db.pool import create_pool


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    app.state.pool = await create_pool(get_settings().database_url)
    yield
    if app.state.pool is not None:
        await app.state.pool.close()


app = FastAPI(title="GreenChain Timber API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origin_list,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/healthz")
async def healthz():
    db = "down"
    if app.state.pool is not None:
        try:
            async with app.state.pool.acquire() as conn:
                await conn.fetchval("select 1")
            db = "up"
        except Exception:
            db = "down"
    return {"status": "ok", "db": db}
```

- [ ] **Step 4: 執行測試確認通過**

Run: `uv run pytest tests/test_healthz.py -v`
Expected: PASS

- [ ] **Step 5: 本機實測連上 Supabase（需 Task 5 完成的 .env）**

Run: `uv run uvicorn app.main:app --port 8000`（背景或另開終端）
Run: `curl http://127.0.0.1:8000/healthz`
Expected: `{"status":"ok","db":"up"}`（T1.3 DoD：本機啟動並連上 Supabase）

- [ ] **Step 6: Commit**

```powershell
git add backend/app/core/ backend/app/db/pool.py backend/app/main.py backend/tests/conftest.py backend/tests/test_healthz.py
git commit -m "T1.3: FastAPI 骨架（settings/JSON log/asyncpg pool/healthz）"
```

---

### Task 7: Supabase JWT 驗證（對應 T1.7 前半，FR-1.3）

**Files:**
- Create: `backend/app/core/auth.py`
- Test: `backend/tests/test_auth.py`

**Interfaces:**
- Consumes: `settings.get_settings().supabase_jwt_secret`
- Produces:
  - `auth.get_current_user_id`：FastAPI dependency（`Depends`），從 `Authorization: Bearer <jwt>` 解出 Supabase user id，回傳 `uuid.UUID`；無效/缺 token 時 raise HTTPException 401
  - Supabase JWT 規格：HS256、audience `"authenticated"`、`sub` 為 user uuid

- [ ] **Step 1: 寫失敗測試 test_auth.py**

```python
import uuid
from datetime import UTC, datetime, timedelta

import jwt
import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from app.core.auth import get_current_user_id

SECRET = "test-secret"  # 與 conftest.py 的 SUPABASE_JWT_SECRET 一致
USER_ID = str(uuid.uuid4())


def _token(secret=SECRET, aud="authenticated", sub=USER_ID, expired=False):
    exp = datetime.now(UTC) + (timedelta(hours=-1) if expired else timedelta(hours=1))
    return jwt.encode({"sub": sub, "aud": aud, "exp": exp}, secret, algorithm="HS256")


@pytest.fixture
def client():
    app = FastAPI()

    @app.get("/whoami")
    async def whoami(user_id: uuid.UUID = Depends(get_current_user_id)):
        return {"user_id": str(user_id)}

    return TestClient(app)


def test_valid_token_returns_user_id(client):
    resp = client.get("/whoami", headers={"Authorization": f"Bearer {_token()}"})
    assert resp.status_code == 200
    assert resp.json()["user_id"] == USER_ID


def test_missing_token_401(client):
    assert client.get("/whoami").status_code == 401


def test_wrong_secret_401(client):
    resp = client.get(
        "/whoami", headers={"Authorization": f"Bearer {_token(secret='wrong')}"}
    )
    assert resp.status_code == 401


def test_expired_token_401(client):
    resp = client.get(
        "/whoami", headers={"Authorization": f"Bearer {_token(expired=True)}"}
    )
    assert resp.status_code == 401


def test_wrong_audience_401(client):
    resp = client.get(
        "/whoami", headers={"Authorization": f"Bearer {_token(aud='anon')}"}
    )
    assert resp.status_code == 401
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `uv run pytest tests/test_auth.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.core.auth'`

- [ ] **Step 3: 實作 auth.py**

```python
"""Supabase JWT 驗證（FR-1.3）：HS256 + audience 'authenticated'."""

import uuid

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.settings import get_settings

_bearer = HTTPBearer(auto_error=False)


async def get_current_user_id(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> uuid.UUID:
    if credentials is None:
        raise HTTPException(status_code=401, detail="missing bearer token")
    try:
        payload = jwt.decode(
            credentials.credentials,
            get_settings().supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
        )
        return uuid.UUID(payload["sub"])
    except (jwt.InvalidTokenError, KeyError, ValueError) as exc:
        raise HTTPException(status_code=401, detail="invalid token") from exc
```

- [ ] **Step 4: 執行測試確認通過**

Run: `uv run pytest tests/test_auth.py -v`
Expected: 5 案例全 PASS

- [ ] **Step 5: Commit**

```powershell
git add backend/app/core/auth.py backend/tests/test_auth.py
git commit -m "T1.7: Supabase JWT 驗證 dependency（HS256/audience/過期/缺 token 案例）"
```

---

### Task 8: 防重疊查詢與入庫 transaction（對應 T1.5 / T1.7 後半，FR-3.1–3.2）

**Files:**
- Create: `backend/app/db/queries.py`
- Test: `backend/tests/test_queries_integration.py`（整合測試；無 `TEST_DATABASE_URL` 時自動 skip）

**Interfaces:**
- Consumes: Task 5 schema、Task 2 `CarbonEstimate`
- Produces:
  - `queries.OVERLAP_THRESHOLD_HA = 0.001`
  - `queries.find_overlaps(conn, geometry: dict) -> list[dict]`：每筆 `{"plot_id": str, "overlap_ha": float, "overlap_geojson": dict}`；只回傳交集 > 0.001 ha 且 `status != 'rejected'` 者
  - `queries.insert_plot_with_estimates(conn, *, owner_id: uuid.UUID, name: str, species: str, avg_age: int, density: int, geometry: dict, area_ha: float, geo_hash: str, estimate: CarbonEstimate) -> dict`：單一 transaction 寫入 `forest_plots`（status `chain_pending`）+ 6 筆 `carbon_estimates`，回傳 `{"id": str, "area_ha": float, "status": str, "created_at": str}`；`geo_hash` 撞 UNIQUE 時 raise `asyncpg.UniqueViolationError`（由 router 轉 409）
  - `queries.list_plots(conn) -> list[dict]` 與 `queries.get_plot(conn, plot_id) -> dict | None`（Task 9 使用，本任務一併實作）

- [ ] **Step 1: 寫整合測試 test_queries_integration.py**

整合測試需要真實 PostGIS。使用 `TEST_DATABASE_URL` 環境變數（指向 Supabase 同專案即可；測試自建/自刪測試使用者與資料）。未設定時整檔 skip——CI 單元測試不受影響。

```python
"""整合測試：需要 TEST_DATABASE_URL 指向已套用 schema.sql 的 PostGIS 資料庫.

執行：$env:TEST_DATABASE_URL="postgresql://..."; uv run pytest tests/test_queries_integration.py -v
"""

import json
import os
import uuid

import asyncpg
import pytest

from app.db import queries
from app.services.carbon_calc import estimate_carbon
from app.services.geo_service import geometry_hash, polygon_area_ha

TEST_DB = os.environ.get("TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(not TEST_DB, reason="TEST_DATABASE_URL not set")


def _poly(ring):
    return {"type": "Polygon", "coordinates": [ring]}


BASE = _poly([
    [121.752, 24.725], [121.756, 24.725], [121.756, 24.7206],
    [121.752, 24.7206], [121.752, 24.725],
])
# 與 BASE 部分重疊（右半邊平移）
OVERLAPPING = _poly([
    [121.754, 24.725], [121.758, 24.725], [121.758, 24.7206],
    [121.754, 24.7206], [121.754, 24.725],
])
# 相鄰但不相交（東側緊鄰）
ADJACENT = _poly([
    [121.7561, 24.725], [121.760, 24.725], [121.760, 24.7206],
    [121.7561, 24.7206], [121.7561, 24.725],
])


@pytest.fixture
async def conn():
    c = await asyncpg.connect(TEST_DB)
    # Supabase auth.users 需要真實使用者才能滿足 FK；建立測試用假使用者
    test_user = uuid.uuid4()
    await c.execute(
        "insert into auth.users (id, email) values ($1, $2)",
        test_user, f"test-{test_user}@example.com",
    )
    c.test_user = test_user
    yield c
    # 清理：刪測試資料（cascade 清 estimates）與測試使用者
    await c.execute("delete from forest_plots where owner_id = $1", test_user)
    await c.execute("delete from auth.users where id = $1", test_user)
    await c.close()


async def _insert(c, geometry, name="測試林區"):
    area = polygon_area_ha(geometry)
    return await queries.insert_plot_with_estimates(
        c,
        owner_id=c.test_user,
        name=name,
        species="taiwania",
        avg_age=15,
        density=1500,
        geometry=geometry,
        area_ha=area,
        geo_hash=geometry_hash(geometry),
        estimate=estimate_carbon("taiwania", 15, 1500, area),
    )


async def test_insert_writes_plot_and_six_estimates(conn):
    plot = await _insert(conn, BASE)
    assert plot["status"] == "chain_pending"
    count = await conn.fetchval(
        "select count(*) from carbon_estimates where plot_id = $1", uuid.UUID(plot["id"])
    )
    assert count == 6


async def test_overlap_detected(conn):
    await _insert(conn, BASE)
    conflicts = await queries.find_overlaps(conn, OVERLAPPING)
    assert len(conflicts) == 1
    assert conflicts[0]["overlap_ha"] > 0.001
    assert conflicts[0]["overlap_geojson"]["type"] in ("Polygon", "MultiPolygon")


async def test_adjacent_not_flagged(conn):
    await _insert(conn, BASE)
    assert await queries.find_overlaps(conn, ADJACENT) == []


async def test_duplicate_geo_hash_raises_unique_violation(conn):
    await _insert(conn, BASE)
    with pytest.raises(asyncpg.UniqueViolationError):
        await _insert(conn, BASE, name="重複幾何")


async def test_list_and_get(conn):
    plot = await _insert(conn, BASE)
    plots = await queries.list_plots(conn)
    assert any(p["id"] == plot["id"] for p in plots)
    detail = await queries.get_plot(conn, uuid.UUID(plot["id"]))
    assert detail is not None
    assert len(detail["estimates"]) == 6
    assert detail["geometry"]["type"] == "Polygon"
    assert await queries.get_plot(conn, uuid.uuid4()) is None
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `$env:TEST_DATABASE_URL = (Get-Content .env | Select-String '^DATABASE_URL=').Line.Substring(13); uv run pytest tests/test_queries_integration.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.db.queries'`

- [ ] **Step 3: 實作 queries.py**

```python
"""SQL 查詢層：防重疊（FR-3.1–3.2）、入庫 transaction、清單/詳情（§8.2–8.3）."""

import json
import uuid

import asyncpg

from app.services.carbon_calc import CarbonEstimate

OVERLAP_THRESHOLD_HA = 0.001  # FR-3.2：約 10 m2，容忍圖徵誤差

_OVERLAP_SQL = """
select id,
       st_area(st_transform(st_intersection(geom, g.new_geom), 3826)) / 10000.0 as overlap_ha,
       st_asgeojson(st_intersection(geom, g.new_geom)) as overlap_geojson
from forest_plots,
     (select st_setsrid(st_geomfromgeojson($1), 4326) as new_geom) as g
where status != 'rejected'
  and st_intersects(geom, g.new_geom)
"""

_INSERT_PLOT_SQL = """
insert into forest_plots (owner_id, name, species, avg_age, density, geom, area_ha, geo_hash, status)
values ($1, $2, $3, $4, $5, st_setsrid(st_geomfromgeojson($6), 4326), $7, $8, 'chain_pending')
returning id, area_ha, status, created_at
"""

_INSERT_ESTIMATE_SQL = """
insert into carbon_estimates (plot_id, formula_version, input_snapshot, year_offset, co2e_tons)
values ($1, $2, $3, $4, $5)
"""

_LIST_SQL = """
select p.id, p.name, p.species, p.area_ha, p.status, p.created_at,
       ce.co2e_tons as co2e_current,
       st_asgeojson(st_simplifypreservetopology(p.geom, 0.0001)) as geometry_simplified
from forest_plots p
left join carbon_estimates ce on ce.plot_id = p.id and ce.year_offset = 0
order by p.created_at desc
"""

_GET_SQL = """
select p.id, p.owner_id, p.name, p.species, p.avg_age, p.density, p.area_ha,
       p.geo_hash, p.status, p.created_at,
       st_asgeojson(p.geom) as geometry
from forest_plots p
where p.id = $1
"""

_GET_ESTIMATES_SQL = """
select formula_version, year_offset, co2e_tons
from carbon_estimates where plot_id = $1 order by year_offset
"""

_GET_CHAIN_SQL = """
select contract_address, token_id, tx_hash, chain_id, minted_at
from chain_records where plot_id = $1
"""


async def find_overlaps(conn: asyncpg.Connection, geometry: dict) -> list[dict]:
    rows = await conn.fetch(_OVERLAP_SQL, json.dumps(geometry))
    return [
        {
            "plot_id": str(r["id"]),
            "overlap_ha": round(float(r["overlap_ha"]), 4),
            "overlap_geojson": json.loads(r["overlap_geojson"]),
        }
        for r in rows
        if float(r["overlap_ha"]) > OVERLAP_THRESHOLD_HA
    ]


async def insert_plot_with_estimates(
    conn: asyncpg.Connection,
    *,
    owner_id: uuid.UUID,
    name: str,
    species: str,
    avg_age: int,
    density: int,
    geometry: dict,
    area_ha: float,
    geo_hash: str,
    estimate: CarbonEstimate,
) -> dict:
    async with conn.transaction():
        row = await conn.fetchrow(
            _INSERT_PLOT_SQL,
            owner_id, name, species, avg_age, density,
            json.dumps(geometry), area_ha, geo_hash,
        )
        await conn.executemany(
            _INSERT_ESTIMATE_SQL,
            [
                (
                    row["id"],
                    estimate.formula_version,
                    json.dumps(estimate.input_snapshot, ensure_ascii=False),
                    y.year_offset,
                    y.co2e_tons,
                )
                for y in estimate.yearly
            ],
        )
    return {
        "id": str(row["id"]),
        "area_ha": float(row["area_ha"]),
        "status": row["status"],
        "created_at": row["created_at"].isoformat(),
    }


async def list_plots(conn: asyncpg.Connection) -> list[dict]:
    rows = await conn.fetch(_LIST_SQL)
    return [
        {
            "id": str(r["id"]),
            "name": r["name"],
            "species": r["species"],
            "area_ha": float(r["area_ha"]),
            "status": r["status"],
            "co2e_current": float(r["co2e_current"]) if r["co2e_current"] is not None else None,
            "geometry_simplified": json.loads(r["geometry_simplified"]),
            "created_at": r["created_at"].isoformat(),
        }
        for r in rows
    ]


async def get_plot(conn: asyncpg.Connection, plot_id: uuid.UUID) -> dict | None:
    row = await conn.fetchrow(_GET_SQL, plot_id)
    if row is None:
        return None
    estimates = await conn.fetch(_GET_ESTIMATES_SQL, plot_id)
    chain = await conn.fetchrow(_GET_CHAIN_SQL, plot_id)
    return {
        "id": str(row["id"]),
        "owner_id": str(row["owner_id"]),
        "name": row["name"],
        "species": row["species"],
        "avg_age": row["avg_age"],
        "density": row["density"],
        "area_ha": float(row["area_ha"]),
        "geo_hash": row["geo_hash"],
        "status": row["status"],
        "created_at": row["created_at"].isoformat(),
        "geometry": json.loads(row["geometry"]),
        "estimates": [
            {
                "formula_version": e["formula_version"],
                "year_offset": e["year_offset"],
                "co2e_tons": float(e["co2e_tons"]),
            }
            for e in estimates
        ],
        "chain_record": (
            {
                "contract_address": chain["contract_address"],
                "token_id": chain["token_id"],
                "tx_hash": chain["tx_hash"],
                "chain_id": chain["chain_id"],
                "minted_at": chain["minted_at"].isoformat() if chain["minted_at"] else None,
            }
            if chain
            else None
        ),
    }
```

- [ ] **Step 4: 執行整合測試確認通過**

Run: `$env:TEST_DATABASE_URL = (Get-Content .env | Select-String '^DATABASE_URL=').Line.Substring(13); uv run pytest tests/test_queries_integration.py -v`
Expected: 5 案例全 PASS（T1.5 DoD：相鄰不相交/微量重疊/大面積重疊行為正確）

註：若 `auth.users` 直插因 Supabase 版本欄位約束失敗，改用 Supabase Dashboard 手動建一個測試帳號，將其 uuid 設為環境變數 `TEST_USER_ID`，fixture 改讀該變數且不插入/刪除 auth.users。

- [ ] **Step 5: Commit**

```powershell
git add backend/app/db/queries.py backend/tests/test_queries_integration.py
git commit -m "T1.5: 防重疊查詢 + 三表 transaction 入庫 + 清單/詳情查詢（整合測試）"
```

---

### Task 9: API 端點組裝 — POST /api/forest 與 GET 端點（對應 T1.7 / T1.8，§8.1–8.3）

**Files:**
- Create: `backend/app/routers/forest.py`
- Modify: `backend/app/main.py`（掛 router）
- Test: `backend/tests/test_forest_api.py`（不碰 DB 的單元測試）
- Test: `backend/tests/test_forest_api_integration.py`（真實 DB，無 `TEST_DATABASE_URL` 時 skip）

**Interfaces:**
- Consumes: Task 2 `estimate_carbon`、Task 3/4 `geo_service`、Task 7 `get_current_user_id`、Task 8 `queries`、Task 6 `get_conn`
- Produces（§8.1 回應契約，W2 前端據此串接）:
  - `POST /api/forest` → 201 `{"plot": {id, area_ha, status}, "estimates": [{year_offset, co2e_tons} x6], "chain": {"status": "pending"}}`；409 `{"detail": {"conflicts": [{plot_id, overlap_ha, overlap_geojson}]}}`；422 `{"detail": {"code", "message"}}`（幾何/面積錯誤）或 Pydantic 422；401 未帶/無效 JWT
  - `GET /api/forest` → 200 陣列（list_plots 輸出）
  - `GET /api/forest/{id}` → 200（get_plot 輸出）或 404

- [ ] **Step 1: 寫失敗單元測試 test_forest_api.py**

不碰 DB 能走到的路徑：401（無 token）、422（欄位驗證，Pydantic 擋下）、422（幾何驗證，在 DB 之前擋下——以 dependency override 跳過 auth 與 DB）：

```python
import uuid

import pytest
from fastapi.testclient import TestClient

from app.core.auth import get_current_user_id
from app.db.pool import get_conn
from app.main import app

VALID_BODY = {
    "name": "延文實驗林場 A 區",
    "species": "taiwania",
    "avg_age": 15,
    "density": 1500,
    "geometry": {
        "type": "Polygon",
        "coordinates": [[
            [121.752, 24.725], [121.756, 24.725], [121.756, 24.7206],
            [121.752, 24.7206], [121.752, 24.725],
        ]],
    },
}


@pytest.fixture
def client():
    async def fake_user():
        return uuid.uuid4()

    async def fail_conn():
        raise AssertionError("此測試不應觸及資料庫")
        yield  # pragma: no cover

    app.dependency_overrides[get_current_user_id] = fake_user
    app.dependency_overrides[get_conn] = fail_conn
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def test_post_without_token_returns_401():
    with TestClient(app) as c:
        assert c.post("/api/forest", json=VALID_BODY).status_code == 401


def test_age_out_of_range_422(client):
    body = {**VALID_BODY, "avg_age": 0}
    assert client.post("/api/forest", json=body).status_code == 422


def test_density_out_of_range_422(client):
    body = {**VALID_BODY, "density": 50}
    assert client.post("/api/forest", json=body).status_code == 422


def test_invalid_species_422(client):
    body = {**VALID_BODY, "species": "bamboo"}
    assert client.post("/api/forest", json=body).status_code == 422


def test_self_intersecting_geometry_422(client):
    body = {
        **VALID_BODY,
        "geometry": {
            "type": "Polygon",
            "coordinates": [[
                [121.752, 24.725], [121.756, 24.721], [121.756, 24.725],
                [121.752, 24.721], [121.752, 24.725],
            ]],
        },
    }
    resp = client.post("/api/forest", json=body)
    assert resp.status_code == 422
    assert resp.json()["detail"]["code"] == "self_intersection"


def test_outside_taiwan_422(client):
    body = {
        **VALID_BODY,
        "geometry": {
            "type": "Polygon",
            "coordinates": [[
                [139.69, 35.68], [139.70, 35.68], [139.70, 35.69],
                [139.69, 35.69], [139.69, 35.68],
            ]],
        },
    }
    resp = client.post("/api/forest", json=body)
    assert resp.status_code == 422
    assert resp.json()["detail"]["code"] == "out_of_taiwan_bbox"


def test_area_too_small_422(client):
    # 約 0.01 ha 的微小多邊形（< 0.1 ha 下限）
    body = {
        **VALID_BODY,
        "geometry": {
            "type": "Polygon",
            "coordinates": [[
                [121.752, 24.725], [121.75210, 24.725], [121.75210, 24.72510],
                [121.752, 24.72510], [121.752, 24.725],
            ]],
        },
    }
    resp = client.post("/api/forest", json=body)
    assert resp.status_code == 422
    assert resp.json()["detail"]["code"] == "area_out_of_range"
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `uv run pytest tests/test_forest_api.py -v`
Expected: FAIL — 404（路由不存在，`ImportError` 或全部 404）

- [ ] **Step 3: 實作 routers/forest.py 並掛上 main.py**

`app/routers/forest.py`：

```python
"""林區 API（§8.1–8.3）：提交、清單、詳情."""

import uuid
from typing import Literal

import asyncpg
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.core.auth import get_current_user_id
from app.db import queries
from app.db.pool import get_conn
from app.services.carbon_calc import estimate_carbon
from app.services.geo_service import (
    GeometryError,
    geometry_hash,
    polygon_area_ha,
    validate_polygon,
)

router = APIRouter(prefix="/api/forest", tags=["forest"])

MIN_AREA_HA = 0.1
MAX_AREA_HA = 1000.0


class ForestSubmission(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    species: Literal["taiwania", "acacia", "fraxinus"]
    avg_age: int = Field(ge=1, le=100)
    density: int = Field(ge=100, le=10000)
    geometry: dict


@router.post("", status_code=201)
async def submit_forest(
    body: ForestSubmission,
    user_id: uuid.UUID = Depends(get_current_user_id),
    conn: asyncpg.Connection = Depends(get_conn),
):
    # 1. 幾何驗證（FR-3.3）—— 422
    try:
        validate_polygon(body.geometry)
    except GeometryError as exc:
        raise HTTPException(
            status_code=422, detail={"code": exc.code, "message": exc.message}
        ) from exc

    # 2. 面積範圍（FR-2.4 後端複驗）—— 422
    area_ha = polygon_area_ha(body.geometry)
    if not MIN_AREA_HA <= area_ha <= MAX_AREA_HA:
        raise HTTPException(
            status_code=422,
            detail={
                "code": "area_out_of_range",
                "message": f"面積 {area_ha} ha 超出允許範圍 {MIN_AREA_HA}–{MAX_AREA_HA} ha",
            },
        )

    # 3. 防重疊（FR-3.1–3.2）—— 409
    conflicts = await queries.find_overlaps(conn, body.geometry)
    if conflicts:
        raise HTTPException(status_code=409, detail={"conflicts": conflicts})

    # 4. 估算（FR-4）+ 入庫（單一 transaction）
    estimate = estimate_carbon(body.species, body.avg_age, body.density, area_ha)
    try:
        plot = await queries.insert_plot_with_estimates(
            conn,
            owner_id=user_id,
            name=body.name,
            species=body.species,
            avg_age=body.avg_age,
            density=body.density,
            geometry=body.geometry,
            area_ha=area_ha,
            geo_hash=geometry_hash(body.geometry),
            estimate=estimate,
        )
    except asyncpg.UniqueViolationError as exc:
        # geo_hash 撞 UNIQUE：與既有林區幾何完全相同
        raise HTTPException(
            status_code=409, detail={"conflicts": [], "message": "相同幾何的林區已存在"}
        ) from exc

    return {
        "plot": plot,
        "estimates": [
            {"year_offset": y.year_offset, "co2e_tons": y.co2e_tons} for y in estimate.yearly
        ],
        "chain": {"status": "pending"},  # W3 接上 chain_service
    }


@router.get("")
async def list_forest(
    user_id: uuid.UUID = Depends(get_current_user_id),
    conn: asyncpg.Connection = Depends(get_conn),
):
    return await queries.list_plots(conn)


@router.get("/{plot_id}")
async def get_forest(
    plot_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    conn: asyncpg.Connection = Depends(get_conn),
):
    plot = await queries.get_plot(conn, plot_id)
    if plot is None:
        raise HTTPException(status_code=404, detail="plot not found")
    return plot
```

`app/main.py` 修改 — 在 `app = FastAPI(...)` 與 CORS middleware 之後加：

```python
from app.routers.forest import router as forest_router

app.include_router(forest_router)
```

（import 放檔案頂部與其他 import 併列。）

- [ ] **Step 4: 執行單元測試確認通過**

Run: `uv run pytest tests/test_forest_api.py -v`
Expected: 8 案例全 PASS

- [ ] **Step 5: 寫 API 整合測試 test_forest_api_integration.py（201/409 完整流程）**

```python
"""API 整合測試：201 成功與 409 重疊，走真實 DB（TEST_DATABASE_URL）."""

import os
import uuid

import asyncpg
import pytest
from fastapi.testclient import TestClient

from app.core.auth import get_current_user_id
from app.main import app

TEST_DB = os.environ.get("TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(not TEST_DB, reason="TEST_DATABASE_URL not set")

RING_A = [
    [121.762, 24.735], [121.766, 24.735], [121.766, 24.7306],
    [121.762, 24.7306], [121.762, 24.735],
]
RING_A_OVERLAP = [
    [121.764, 24.735], [121.768, 24.735], [121.768, 24.7306],
    [121.764, 24.7306], [121.764, 24.735],
]


def _body(ring, name):
    return {
        "name": name,
        "species": "taiwania",
        "avg_age": 15,
        "density": 1500,
        "geometry": {"type": "Polygon", "coordinates": [ring]},
    }


@pytest.fixture
def client_with_user():
    test_user = uuid.uuid4()

    async def fake_user():
        return test_user

    app.dependency_overrides[get_current_user_id] = fake_user
    # 整合測試用真實 pool：把 app 的 DATABASE_URL 換成 TEST_DATABASE_URL
    os.environ["DATABASE_URL"] = TEST_DB
    from app.core.settings import get_settings

    get_settings.cache_clear()

    import asyncio

    async def _setup():
        c = await asyncpg.connect(TEST_DB)
        await c.execute(
            "insert into auth.users (id, email) values ($1, $2)",
            test_user, f"test-{test_user}@example.com",
        )
        await c.close()

    asyncio.run(_setup())

    with TestClient(app) as c:
        yield c

    async def _teardown():
        c = await asyncpg.connect(TEST_DB)
        await c.execute("delete from forest_plots where owner_id = $1", test_user)
        await c.execute("delete from auth.users where id = $1", test_user)
        await c.close()

    asyncio.run(_teardown())
    app.dependency_overrides.clear()
    get_settings.cache_clear()


def test_full_submit_then_overlap_409(client_with_user):
    c = client_with_user
    # 201：完整申報
    resp = c.post("/api/forest", json=_body(RING_A, "整合測試 A 區"))
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["plot"]["status"] == "chain_pending"
    assert len(body["estimates"]) == 6
    assert body["chain"]["status"] == "pending"
    plot_id = body["plot"]["id"]

    # 409：重疊提交
    resp2 = c.post("/api/forest", json=_body(RING_A_OVERLAP, "重疊區"))
    assert resp2.status_code == 409
    conflicts = resp2.json()["detail"]["conflicts"]
    assert conflicts[0]["plot_id"] == plot_id
    assert conflicts[0]["overlap_ha"] > 0.001

    # GET 清單與詳情
    plots = c.get("/api/forest").json()
    assert any(p["id"] == plot_id for p in plots)
    detail = c.get(f"/api/forest/{plot_id}").json()
    assert detail["name"] == "整合測試 A 區"
    assert len(detail["estimates"]) == 6

    # 404
    assert c.get(f"/api/forest/{uuid.uuid4()}").status_code == 404
```

- [ ] **Step 6: 執行整合測試確認通過**

Run: `$env:TEST_DATABASE_URL = (Get-Content .env | Select-String '^DATABASE_URL=').Line.Substring(13); uv run pytest tests/test_forest_api_integration.py -v`
Expected: PASS（T1.7 DoD：201/409/422 三情境符合 §8.1）

- [ ] **Step 7: Commit**

```powershell
git add backend/app/routers/forest.py backend/app/main.py backend/tests/test_forest_api.py backend/tests/test_forest_api_integration.py
git commit -m "T1.7+T1.8: POST /api/forest 組裝 + GET 清單/詳情端點"
```

---

### Task 10: CI 與 M1 里程碑驗證（對應 T1.9 + 週末檢核）

**Files:**
- Create: `.github/workflows/ci.yml`
- Modify: `docs/devlog.md`（記錄 M1 達成）

**Interfaces:**
- Consumes: 全部前述任務
- Produces: push/PR 觸發 ruff + pytest 的 CI；`m1-backend` git tag

- [ ] **Step 1: 建立 .github/workflows/ci.yml**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  backend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: backend
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v4
      - name: Install dependencies
        run: uv sync
      - name: Lint (ruff)
        run: uv run ruff check .
      - name: Unit tests
        # 整合測試（test_*_integration.py）因無 TEST_DATABASE_URL 自動 skip
        run: uv run pytest -v
        env:
          DATABASE_URL: postgresql://invalid:invalid@127.0.0.1:1/invalid
          SUPABASE_JWT_SECRET: ci-secret
```

- [ ] **Step 2: 本機模擬 CI 全綠**

Run（於 `backend/`）: `uv run ruff check .`
Expected: `All checks passed!`（有錯就修）

Run: `uv run pytest -v`
Expected: 單元測試全 PASS；整合測試顯示 SKIPPED（未帶 TEST_DATABASE_URL 時）

- [ ] **Step 3: M1 端到端 curl 驗證（里程碑 DoD：curl 跑通一筆完整申報）**

啟動：`uv run uvicorn app.main:app --port 8000`

取得 JWT：於 Supabase Dashboard 建立測試帳號後，用 anon key 登入取 access_token：

```powershell
$resp = Invoke-RestMethod -Method Post `
  -Uri "https://YOUR_PROJECT.supabase.co/auth/v1/token?grant_type=password" `
  -Headers @{ apikey = "YOUR_ANON_KEY"; "Content-Type" = "application/json" } `
  -Body '{"email":"demo@example.com","password":"demo-password"}'
$jwt = $resp.access_token
```

提交一筆申報（成功案例）：

```powershell
$body = @'
{
  "name": "延文實驗林場 A 區",
  "species": "taiwania",
  "avg_age": 15,
  "density": 1500,
  "geometry": {"type": "Polygon", "coordinates": [[
    [121.772, 24.745], [121.776, 24.745], [121.776, 24.7406],
    [121.772, 24.7406], [121.772, 24.745]
  ]]}
}
'@
Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:8000/api/forest" `
  -Headers @{ Authorization = "Bearer $jwt"; "Content-Type" = "application/json" } `
  -Body $body
```

Expected: 201；回傳 plot（status `chain_pending`）+ 6 筆 estimates + chain pending。

再提交重疊多邊形（座標平移 0.002°）→ Expected: 409 與 conflicts。
再提交自相交多邊形 → Expected: 422 與 `self_intersection`。

- [ ] **Step 4: 效能抽測（開發計畫 §7，10 分鐘內完成即可）**

於 Supabase SQL Editor 執行 EXPLAIN 確認重疊查詢走 GIST 索引：

```sql
explain analyze
select id from forest_plots
where status != 'rejected'
  and st_intersects(geom, st_setsrid(st_geomfromgeojson(
    '{"type":"Polygon","coordinates":[[[121.752,24.725],[121.756,24.725],[121.756,24.7206],[121.752,24.7206],[121.752,24.725]]]}'
  ), 4326));
```

Expected: 計畫含 `Index Scan using idx_forest_plots_geom`（資料量小時 Seq Scan 也可接受，記錄於 devlog 即可）。

- [ ] **Step 5: 更新 devlog、推上 GitHub、打 tag**

`docs/devlog.md` 追加 M1 達成記錄（日期、curl 三情境結果、已知 placeholder 係數風險）。

```powershell
git add .github/workflows/ci.yml docs/devlog.md
git commit -m "T1.9: CI（ruff + pytest）+ M1 里程碑驗證記錄"
git push origin main
git tag m1-backend
git push origin m1-backend
```

Expected: GitHub Actions 綠燈；tag `m1-backend` 作為可回退錨點。

---

## 已知風險與後續（不在本計畫範圍）

- **T1.1 文獻查證是人工作業**：本計畫所有係數皆 `# PLACEHOLDER`，UI（W2）需標示「示範估算值，非查證碳權」；查證完成後只需更新 `carbon_coefficients.py` 常數並重跑 `test_carbon_calc.py`（oracle 會同步採用新係數）。
- **auth.users 直插**：整合測試假設可直接 insert `auth.users`；若 Supabase 約束不允許，依 Task 8 Step 4 註記改用 `TEST_USER_ID` 環境變數。
- **W2（前端）、W3（區塊鏈）、W4（部署）** 各自另立計畫，於前一里程碑達成後撰寫，確保計畫基於實際 API 形狀。

## Self-Review 紀錄

- 規格覆蓋：FR-1.3（Task 7）、FR-2.4 後端複驗（Task 9）、FR-3.1–3.4（Tasks 4/5/8）、FR-4.1–4.5（Task 2）、FR-5.6（Task 3）、§7（Task 5）、§8.1–8.3（Task 9）、T1.9 CI（Task 10）。FR-5.1–5.5（上鏈）與 FR-2/FR-6 前端屬 W2/W3 計畫。§8.4 chain-status 端點依規格屬上鏈流程，隨 W3 chain_service 一併實作。
- Placeholder 掃描：僅碳係數常數表刻意標注 `# PLACEHOLDER`（規格 FR-4.5 要求的正式行為，非計畫缺口）。
- 型別一致性：`estimate_carbon` 簽名、`CarbonEstimate.yearly`、`GeometryError.code`、`get_conn`/`get_current_user_id` dependency 名稱已於 Tasks 2–9 間交叉核對一致。
