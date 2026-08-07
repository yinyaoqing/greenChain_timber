# 綠鏈林匯 Week 3 — 區塊鏈防偽層 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成里程碑 M3 — 提交林區後 ≤ 2 分鐘狀態自動轉 `on_chain`，儀表板 Tx Hash 可連到 Amoy 區塊鏈瀏覽器查得交易，AT-6 雜湊比對輸出 MATCH。

**Architecture:** Solidity ERC-721（OpenZeppelin v5）部署 Polygon Amoy；後端 `chain_service.py` 以 Web3.py 同步呼叫包在 `asyncio.to_thread` 中、由 FastAPI BackgroundTask 觸發，失敗指數退避重試最多 3 次、**上鏈失敗不回滾資料庫**（FR-5.3）；鏈上只存 geoHash 指紋 + 碳公斤數（省 gas、避免地籍細節上鏈）。前端詳情頁 `chain_pending` 時每 10 秒輪詢 `/chain-status`。

**Tech Stack:** Hardhat 2.x + @nomicfoundation/hardhat-toolbox（ethers v6）、OpenZeppelin Contracts v5、Solidity 0.8.24、web3.py v7、既有 FastAPI/Next.js 堆疊

**對應文件:** 《專案規格書 v1.0》§9 / FR-5 / §8.4 / FR-6.4–6.5、《開發計畫 v1.0》T3.1–T3.7

## Global Constraints

- 合約規格（§9，**以此為準**）：`GreenAssetNFT`、`PlotData{bytes32 geoHash; uint256 carbonKg; uint8 speciesCode; uint64 mintedAt}`、`mintPlot(address to, bytes32 geoHash, uint256 carbonKg, uint8 speciesCode) external onlyOwner returns (uint256)`、`getPlotData(uint256) view returns (PlotData)`、`event PlotMinted(uint256 indexed tokenId, bytes32 geoHash, uint256 carbonKg)`、geoHash mapping 唯一性檢查重複 mint 直接 revert。（FR-5.2 提及鏈上記 plotId keccak，但 §9 具體簽名無此欄——採 §9，geoHash 即為 DB↔鏈的對應指紋；此裁決記錄於此。）
- 鏈上數值：`carbonKg` = 當年（year_offset 0）估算值 × 1000 四捨五入取整（公斤，避免浮點，FR-5.2）；`speciesCode`：1=台灣杉 taiwania、2=相思樹 acacia、3=光臘樹 fraxinus；`geoHash` = DB `geo_hash`（64 hex）轉 bytes32
- 部署鏈：Polygon Amoy 測試網，chainId **80002**；瀏覽器 `https://amoy.polygonscan.com`（tx: `/tx/{hash}`、address: `/address/{addr}`）
- 觸發時機（FR-5.3）：資料庫寫入成功後由 BackgroundTask 觸發 mint；**上鏈失敗不得回滾資料庫**；重試最多 3 次、指數退避（5s/15s/45s）；每次失敗記 `chain_records.retry_count`/`last_error`
- Mint 成功（FR-5.4）：回寫 `tx_hash`/`token_id`/`contract_address`/`minted_at`，`forest_plots.status` → `on_chain`
- 私鑰紅線（FR-5.5）：`MINTER_PRIVATE_KEY` 只存環境變數（`backend/.env`、`contracts/.env`、Render env），絕不進版控
- tokenURI（§9）：回傳後端 metadata 端點 `{baseURI}{tokenId}/metadata`，不做 IPFS；baseURI 部署參數 = `https://greenchain-backend-mp5a.onrender.com/api/nft/`
- 新環境變數（附錄 A）：`CHAIN_RPC_URL`（預設公開節點 `https://rpc-amoy.polygon.technology`）、`CHAIN_RPC_URL_FALLBACK`、`MINTER_PRIVATE_KEY`、`NFT_CONTRACT_ADDRESS`、`ADMIN_TOKEN`（admin retry 端點簡易保護）
- 鏈上設定不齊全（任一必要變數為空）時：提交流程照常運作、林區停留 `chain_pending`、mint 任務記 log 後直接返回——**不得讓核心申報流程因鏈上設定缺失而失敗**
- 前端輪詢（FR-6.5）：`chain_pending` 每 10 秒輪詢 `GET /api/forest/{id}/chain-status`；狀態變更後重抓詳情
- Commit 格式 `T3.x: <內容>`；後端指令於 `backend/`（uv）、合約指令於 `contracts/`（npm）、前端於 `frontend/`（npm）
- 使用者前置作業（Day 0，執行 Task 8 前必須就緒）：MetaMask 開發專用錢包私鑰、Amoy 測試幣 ≥ 1 POL、（選配）Alchemy Amoy RPC key 作備援

---

### Task 1: Hardhat 專案 + GreenAssetNFT 合約 + 測試（T3.1，§9）

**Files:**
- Create: `contracts/package.json`
- Create: `contracts/hardhat.config.js`
- Create: `contracts/.env.example`
- Create: `contracts/.gitignore`
- Create: `contracts/contracts/GreenAssetNFT.sol`
- Test: `contracts/test/GreenAssetNFT.test.js`
- Modify: `.github/workflows/ci.yml`（新增 contracts job）

**Interfaces:**
- Consumes: 無
- Produces: `GreenAssetNFT` 合約（簽名見 Global Constraints）；Task 2 的部署腳本與 Task 4 的 Python ABI 依此為準

- [ ] **Step 1: 建立 Hardhat 專案**

`contracts/package.json`：

```json
{
  "name": "greenchain-contracts",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "test": "hardhat test",
    "compile": "hardhat compile",
    "deploy:amoy": "hardhat run scripts/deploy.js --network amoy"
  },
  "devDependencies": {
    "@nomicfoundation/hardhat-toolbox": "^5.0.0",
    "hardhat": "^2.22.0"
  },
  "dependencies": {
    "@openzeppelin/contracts": "^5.1.0",
    "dotenv": "^16.4.0"
  }
}
```

`contracts/hardhat.config.js`：

```javascript
require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
  networks: {
    amoy: {
      url: process.env.AMOY_RPC_URL || "https://rpc-amoy.polygon.technology",
      chainId: 80002,
      accounts: process.env.MINTER_PRIVATE_KEY ? [process.env.MINTER_PRIVATE_KEY] : [],
    },
  },
  etherscan: {
    // 合約驗證（best-effort，需免費 Etherscan API key）
    apiKey: { polygonAmoy: process.env.ETHERSCAN_API_KEY || "" },
  },
};
```

`contracts/.env.example`：

```bash
AMOY_RPC_URL=https://rpc-amoy.polygon.technology
# MetaMask 開發專用錢包私鑰（0x 開頭，絕不進版控）
MINTER_PRIVATE_KEY=
# 合約原始碼驗證用（選配，https://etherscan.io/apis 免費申請）
ETHERSCAN_API_KEY=
# tokenURI base（後端 metadata 端點）
BASE_URI=https://greenchain-backend-mp5a.onrender.com/api/nft/
```

`contracts/.gitignore`：

```gitignore
node_modules/
artifacts/
cache/
.env
```

Run（`contracts/`）: `npm install`
Expected: 安裝成功。

- [ ] **Step 2: 寫失敗測試 test/GreenAssetNFT.test.js**

```javascript
const { expect } = require("chai");
const { ethers } = require("hardhat");

const GEO_HASH = "0x" + "ab".repeat(32); // 64 hex 假雜湊
const GEO_HASH_2 = "0x" + "cd".repeat(32);
const BASE_URI = "https://greenchain-backend-mp5a.onrender.com/api/nft/";

describe("GreenAssetNFT", function () {
  let nft, owner, other;

  beforeEach(async function () {
    [owner, other] = await ethers.getSigners();
    const F = await ethers.getContractFactory("GreenAssetNFT");
    nft = await F.deploy(BASE_URI);
  });

  it("owner 可 mint，tokenId 自 1 遞增，發出 PlotMinted 事件", async function () {
    await expect(nft.mintPlot(owner.address, GEO_HASH, 357348, 1))
      .to.emit(nft, "PlotMinted")
      .withArgs(1n, GEO_HASH, 357348n);
    expect(await nft.ownerOf(1)).to.equal(owner.address);

    await nft.mintPlot(owner.address, GEO_HASH_2, 1000, 2);
    expect(await nft.ownerOf(2)).to.equal(owner.address);
  });

  it("getPlotData 回傳完整 PlotData", async function () {
    await nft.mintPlot(owner.address, GEO_HASH, 357348, 3);
    const d = await nft.getPlotData(1);
    expect(d.geoHash).to.equal(GEO_HASH);
    expect(d.carbonKg).to.equal(357348n);
    expect(d.speciesCode).to.equal(3);
    expect(d.mintedAt).to.be.greaterThan(0n);
  });

  it("非 owner mint 應 revert（OwnableUnauthorizedAccount）", async function () {
    await expect(
      nft.connect(other).mintPlot(other.address, GEO_HASH, 1, 1)
    ).to.be.revertedWithCustomError(nft, "OwnableUnauthorizedAccount");
  });

  it("重複 geoHash 應 revert（鏈上第二道防重複申報，§9）", async function () {
    await nft.mintPlot(owner.address, GEO_HASH, 1, 1);
    await expect(nft.mintPlot(owner.address, GEO_HASH, 2, 2))
      .to.be.revertedWithCustomError(nft, "GeoHashAlreadyMinted")
      .withArgs(GEO_HASH);
  });

  it("speciesCode 0 或 >3 應 revert", async function () {
    await expect(nft.mintPlot(owner.address, GEO_HASH, 1, 0))
      .to.be.revertedWithCustomError(nft, "InvalidSpeciesCode");
    await expect(nft.mintPlot(owner.address, GEO_HASH, 1, 4))
      .to.be.revertedWithCustomError(nft, "InvalidSpeciesCode");
  });

  it("getPlotData 不存在的 token 應 revert", async function () {
    await expect(nft.getPlotData(99)).to.be.revertedWithCustomError(
      nft,
      "ERC721NonexistentToken"
    );
  });

  it("tokenURI = baseURI + tokenId + /metadata", async function () {
    await nft.mintPlot(owner.address, GEO_HASH, 1, 1);
    expect(await nft.tokenURI(1)).to.equal(`${BASE_URI}1/metadata`);
  });

  it("geoHashUsed 公開可查（供外部驗證）", async function () {
    expect(await nft.geoHashUsed(GEO_HASH)).to.equal(false);
    await nft.mintPlot(owner.address, GEO_HASH, 1, 1);
    expect(await nft.geoHashUsed(GEO_HASH)).to.equal(true);
  });
});
```

- [ ] **Step 3: 執行測試確認失敗**

Run: `npx hardhat test`
Expected: FAIL —— `HH700: Artifact for contract "GreenAssetNFT" not found`（合約尚未存在）

- [ ] **Step 4: 實作 contracts/GreenAssetNFT.sol**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

/// @title GreenAssetNFT — 綠鏈林匯林區碳資產存證（規格書 §9）
/// @notice 鏈上只存幾何指紋（geoHash）與碳公斤數；完整 GeoJSON 留在資料庫，
///         驗證時重算 SHA-256 比對（AT-6）。geoHash 唯一性 = 鏈上第二道防重複申報。
contract GreenAssetNFT is ERC721, Ownable {
    struct PlotData {
        bytes32 geoHash;      // 正規化 GeoJSON SHA-256
        uint256 carbonKg;     // 當年固碳量（公斤，避免浮點）
        uint8   speciesCode;  // 1=台灣杉 2=相思樹 3=光臘樹
        uint64  mintedAt;     // block.timestamp
    }

    uint256 private _nextTokenId = 1;
    mapping(uint256 tokenId => PlotData) private _plotData;
    mapping(bytes32 geoHash => bool) public geoHashUsed;
    string public baseURI;

    event PlotMinted(uint256 indexed tokenId, bytes32 geoHash, uint256 carbonKg);

    error GeoHashAlreadyMinted(bytes32 geoHash);
    error InvalidSpeciesCode(uint8 speciesCode);

    constructor(string memory baseURI_)
        ERC721("GreenChain Timber Asset", "GCTA")
        Ownable(msg.sender)
    {
        baseURI = baseURI_;
    }

    function mintPlot(address to, bytes32 geoHash, uint256 carbonKg, uint8 speciesCode)
        external
        onlyOwner
        returns (uint256 tokenId)
    {
        if (geoHashUsed[geoHash]) revert GeoHashAlreadyMinted(geoHash);
        if (speciesCode == 0 || speciesCode > 3) revert InvalidSpeciesCode(speciesCode);
        geoHashUsed[geoHash] = true;
        tokenId = _nextTokenId++;
        _plotData[tokenId] = PlotData({
            geoHash: geoHash,
            carbonKg: carbonKg,
            speciesCode: speciesCode,
            mintedAt: uint64(block.timestamp)
        });
        _safeMint(to, tokenId);
        emit PlotMinted(tokenId, geoHash, carbonKg);
    }

    function getPlotData(uint256 tokenId) external view returns (PlotData memory) {
        _requireOwned(tokenId);
        return _plotData[tokenId];
    }

    function setBaseURI(string calldata newBaseURI) external onlyOwner {
        baseURI = newBaseURI;
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return string.concat(baseURI, Strings.toString(tokenId), "/metadata");
    }
}
```

- [ ] **Step 5: 執行測試確認通過**

Run: `npx hardhat test`
Expected: 8 passing（T3.1 DoD：mint 成功、非 owner revert、重複 geoHash revert 全綠）

- [ ] **Step 6: CI 加入 contracts job**

`.github/workflows/ci.yml` 於 `frontend:` job 之後追加：

```yaml
  contracts:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: contracts
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: contracts/package-lock.json
      - name: Install dependencies
        run: npm ci
      - name: Hardhat tests
        run: npx hardhat test
```

- [ ] **Step 7: Commit**

```powershell
git add contracts/ .github/workflows/ci.yml
git commit -m "T3.1: GreenAssetNFT 合約 + Hardhat 測試 + CI contracts job"
```

---

### Task 2: 部署腳本（T3.2；實際部署留待 Task 8，需使用者私鑰與測試幣）

**Files:**
- Create: `contracts/scripts/deploy.js`

**Interfaces:**
- Consumes: Task 1 合約、`contracts/.env`（`MINTER_PRIVATE_KEY`、`AMOY_RPC_URL`、`BASE_URI`）
- Produces: `npm run deploy:amoy` 輸出合約地址；Task 8 執行後將地址填入 `backend/.env` 的 `NFT_CONTRACT_ADDRESS`

- [ ] **Step 1: 建立 scripts/deploy.js**

```javascript
const { ethers, network, run } = require("hardhat");
require("dotenv").config();

async function main() {
  const baseURI =
    process.env.BASE_URI || "https://greenchain-backend-mp5a.onrender.com/api/nft/";
  const [deployer] = await ethers.getSigners();
  if (!deployer) throw new Error("MINTER_PRIVATE_KEY 未設定（contracts/.env）");

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Network : ${network.name} (chainId ${network.config.chainId})`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance : ${ethers.formatEther(balance)} POL`);
  if (balance === 0n) throw new Error("錢包餘額為 0，請先自 Amoy Faucet 領取測試幣");

  const F = await ethers.getContractFactory("GreenAssetNFT");
  const nft = await F.deploy(baseURI);
  await nft.waitForDeployment();
  const address = await nft.getAddress();
  console.log(`GreenAssetNFT deployed: ${address}`);
  console.log(`baseURI: ${baseURI}`);
  console.log(`\n下一步：將地址填入 backend/.env 與 Render 環境變數的 NFT_CONTRACT_ADDRESS`);

  // best-effort 原始碼驗證（無 ETHERSCAN_API_KEY 或服務失敗時不阻斷部署）
  if (process.env.ETHERSCAN_API_KEY) {
    console.log("等待 5 個區塊後嘗試驗證原始碼…");
    await nft.deploymentTransaction().wait(5);
    try {
      await run("verify:verify", { address, constructorArguments: [baseURI] });
      console.log("合約原始碼驗證成功");
    } catch (e) {
      console.log(`驗證失敗（不影響部署）：${e.message}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
```

- [ ] **Step 2: 驗證腳本可編譯載入（不實際部署）**

Run（`contracts/`）: `npx hardhat compile && node -e "require('./scripts/deploy.js')" 2>&1 | head -1`
Expected: compile 成功；deploy.js 被 require 時因非 hardhat runtime 會報 HH error 或直接執行 main 失敗——只需確認**無語法錯誤**（`node --check scripts/deploy.js` 回傳 0 亦可作為替代驗證）。

- [ ] **Step 3: Commit**

```powershell
git add contracts/scripts/deploy.js
git commit -m "T3.2: Amoy 部署腳本（含餘額檢查與 best-effort 原始碼驗證）"
```

---

### Task 3: 後端 chain 基礎 — settings 擴充、web3 依賴、編碼純函式（T3.3 前置）

**Files:**
- Modify: `backend/pyproject.toml`（加 `web3>=7.0`）
- Modify: `backend/app/core/settings.py`
- Create: `backend/app/services/chain_codec.py`
- Modify: `backend/.env.example`
- Test: `backend/tests/test_chain_codec.py`

**Interfaces:**
- Consumes: 既有 `Settings`
- Produces:
  - `Settings` 新欄位（皆有預設空值）：`chain_rpc_url: str = "https://rpc-amoy.polygon.technology"`、`chain_rpc_url_fallback: str = ""`、`minter_private_key: str = ""`、`nft_contract_address: str = ""`、`chain_id: int = 80002`、`admin_token: str = ""`；property `chain_configured: bool`（private key 與 contract address 皆非空）
  - `chain_codec.SPECIES_CODE: dict[str, int]`（taiwania=1, acacia=2, fraxinus=3）
  - `chain_codec.carbon_kg(co2e_tons: float) -> int`
  - `chain_codec.geo_hash_bytes32(hex64: str) -> bytes`（長度/格式錯誤 raise ValueError）
  - `chain_codec.GREEN_ASSET_ABI: list`（mintPlot / getPlotData / PlotMinted 最小 ABI）

- [ ] **Step 1: 加依賴**

Run（`backend/`）: `uv add "web3>=7.0"`
Expected: 安裝成功、lock 更新。

- [ ] **Step 2: 寫失敗測試 test_chain_codec.py**

```python
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
```

- [ ] **Step 3: 執行測試確認失敗**

Run: `uv run pytest tests/test_chain_codec.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.chain_codec'`

- [ ] **Step 4: 實作 chain_codec.py 與 settings 擴充**

`backend/app/services/chain_codec.py`：

```python
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
```

`backend/app/core/settings.py` — `Settings` class 內追加欄位與 property：

```python
    # 區塊鏈（W3；未設定時上鏈停用、申報流程照常）
    chain_rpc_url: str = "https://rpc-amoy.polygon.technology"
    chain_rpc_url_fallback: str = ""
    minter_private_key: str = ""
    nft_contract_address: str = ""
    chain_id: int = 80002
    admin_token: str = ""

    @property
    def chain_configured(self) -> bool:
        return bool(self.minter_private_key and self.nft_contract_address)
```

`backend/.env.example` 追加：

```bash
# 區塊鏈（W3）：未設定時上鏈停用，申報流程照常（林區停留 chain_pending）
CHAIN_RPC_URL=https://rpc-amoy.polygon.technology
CHAIN_RPC_URL_FALLBACK=
MINTER_PRIVATE_KEY=
NFT_CONTRACT_ADDRESS=
# admin retry 端點簡易保護（自訂隨機字串）
ADMIN_TOKEN=
```

- [ ] **Step 5: 執行測試確認通過（含全套件無回歸）**

Run: `uv run pytest tests/test_chain_codec.py -v` → 全 PASS
Run: `uv run pytest -q` → 全綠（新增 web3 依賴不影響既有測試）

- [ ] **Step 6: Commit**

```powershell
git add backend/pyproject.toml backend/uv.lock backend/app/core/settings.py backend/app/services/chain_codec.py backend/.env.example backend/tests/test_chain_codec.py
git commit -m "T3.3: web3 依賴 + chain settings + 鏈上編碼純函式（species/kg/bytes32/ABI）"
```

---

### Task 4: chain_service — mint、重試、回寫（T3.3 / T3.4，FR-5.3–5.4）

**Files:**
- Create: `backend/app/services/chain_service.py`
- Test: `backend/tests/test_chain_service.py`

**Interfaces:**
- Consumes: Task 3 `chain_codec`、`get_settings()`、asyncpg pool
- Produces:
  - `chain_service.ChainMintError(Exception)`
  - `chain_service.mint_plot_sync(*, rpc_url: str, fallback_url: str, private_key: str, contract_address: str, chain_id: int, geo_hash_hex: str, carbon_kg_value: int, species_code: int) -> dict`——回傳 `{"tx_hash": "0x...", "token_id": int, "contract_address": str}`；同步阻塞（web3），呼叫端負責丟 thread
  - `chain_service.mint_and_record(pool, plot_id: uuid.UUID) -> None`——BackgroundTask 入口：讀取 plot 資料 → 至多 3 次嘗試（退避 `BACKOFF_SECONDS = [5, 15, 45]`，最後一次失敗不再等待）→ 成功回寫 `chain_records` + `status='on_chain'`；失敗記 `retry_count`/`last_error` 後留在 `chain_pending`；**任何例外都不往外拋**（背景任務不得炸掉事件圈）
  - 測試可注入點：模組層 `_mint_fn = mint_plot_sync`（`mint_and_record` 經由 `_mint_fn` 呼叫，測試 monkeypatch 之）

- [ ] **Step 1: 寫失敗測試 test_chain_service.py（mock web3 與 DB）**

```python
import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest

import app.services.chain_service as chain_service
from app.core.settings import get_settings


class FakeConn:
    """記錄 execute/fetchrow 呼叫的假連線."""

    def __init__(self, plot_row):
        self.plot_row = plot_row
        self.executed: list[tuple] = []

    async def fetchrow(self, sql, *args):
        return self.plot_row

    async def execute(self, sql, *args):
        self.executed.append((sql.strip().split()[0].lower(), args))


class FakePool:
    def __init__(self, conn):
        self._conn = conn

    def acquire(self):
        pool_conn = self._conn

        class _Ctx:
            async def __aenter__(self):
                return pool_conn

            async def __aexit__(self, *a):
                return False

        return _Ctx()


PLOT_ID = uuid.uuid4()
PLOT_ROW = {"geo_hash": "ab" * 32, "species": "taiwania", "co2e_tons": 357.3476}


@pytest.fixture
def chain_env(monkeypatch):
    monkeypatch.setenv("MINTER_PRIVATE_KEY", "0x" + "11" * 32)
    monkeypatch.setenv("NFT_CONTRACT_ADDRESS", "0x" + "22" * 20)
    get_settings.cache_clear()
    yield
    monkeypatch.delenv("MINTER_PRIVATE_KEY", raising=False)
    monkeypatch.delenv("NFT_CONTRACT_ADDRESS", raising=False)
    get_settings.cache_clear()


@pytest.fixture(autouse=True)
def fast_backoff(monkeypatch):
    monkeypatch.setattr(chain_service, "BACKOFF_SECONDS", [0, 0, 0])


async def test_success_first_try_writes_on_chain(chain_env, monkeypatch):
    conn = FakeConn(PLOT_ROW)
    result = {"tx_hash": "0xdead", "token_id": 7, "contract_address": "0x" + "22" * 20}
    mint = MagicMock(return_value=result)
    monkeypatch.setattr(chain_service, "_mint_fn", mint)

    await chain_service.mint_and_record(FakePool(conn), PLOT_ID)

    assert mint.call_count == 1
    verbs = [v for v, _ in conn.executed]
    assert "insert" in verbs  # chain_records upsert
    assert "update" in verbs  # status -> on_chain
    # mint 參數正確編碼
    kwargs = mint.call_args.kwargs
    assert kwargs["geo_hash_hex"] == "ab" * 32
    assert kwargs["carbon_kg_value"] == 357348
    assert kwargs["species_code"] == 1


async def test_retries_then_succeeds(chain_env, monkeypatch):
    conn = FakeConn(PLOT_ROW)
    mint = MagicMock(
        side_effect=[
            chain_service.ChainMintError("rpc down"),
            {"tx_hash": "0xbeef", "token_id": 8, "contract_address": "0x" + "22" * 20},
        ]
    )
    monkeypatch.setattr(chain_service, "_mint_fn", mint)

    await chain_service.mint_and_record(FakePool(conn), PLOT_ID)

    assert mint.call_count == 2
    verbs = [v for v, _ in conn.executed]
    assert "update" in verbs  # 最終成功


async def test_three_failures_stay_pending_no_raise(chain_env, monkeypatch):
    conn = FakeConn(PLOT_ROW)
    mint = MagicMock(side_effect=chain_service.ChainMintError("always down"))
    monkeypatch.setattr(chain_service, "_mint_fn", mint)

    await chain_service.mint_and_record(FakePool(conn), PLOT_ID)  # 不得拋例外

    assert mint.call_count == 3
    # 三次失敗各 upsert 一次 retry_count/last_error；無 status update
    verbs = [v for v, _ in conn.executed]
    assert verbs.count("insert") == 3
    assert "update" not in verbs


async def test_chain_not_configured_skips(monkeypatch):
    get_settings.cache_clear()  # conftest 環境無私鑰 -> chain_configured False
    conn = FakeConn(PLOT_ROW)
    mint = MagicMock()
    monkeypatch.setattr(chain_service, "_mint_fn", mint)

    await chain_service.mint_and_record(FakePool(conn), PLOT_ID)

    assert mint.call_count == 0
    assert conn.executed == []


async def test_plot_not_pending_skips(chain_env, monkeypatch):
    conn = FakeConn(None)  # 查無 chain_pending 的 plot
    mint = MagicMock()
    monkeypatch.setattr(chain_service, "_mint_fn", mint)

    await chain_service.mint_and_record(FakePool(conn), PLOT_ID)

    assert mint.call_count == 0
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `uv run pytest tests/test_chain_service.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.chain_service'`

- [ ] **Step 3: 實作 chain_service.py**

```python
"""上鏈服務（FR-5.3–5.4）：Web3.py mint + 指數退避重試 + 回寫。

設計：
- mint_plot_sync 為同步阻塞（web3.py），由 mint_and_record 以 asyncio.to_thread 執行
- 上鏈失敗絕不回滾資料庫；林區停留 chain_pending，retry_count/last_error 記錄於 chain_records
- 背景任務不得拋出例外（避免炸掉事件圈）
"""

import asyncio
import logging
import uuid

import asyncpg
from web3 import Web3

from app.core.settings import get_settings
from app.services.chain_codec import GREEN_ASSET_ABI, SPECIES_CODE, carbon_kg

logger = logging.getLogger(__name__)

BACKOFF_SECONDS = [5, 15, 45]
RECEIPT_TIMEOUT_S = 120


class ChainMintError(Exception):
    pass


def _connect(rpc_url: str, fallback_url: str) -> Web3:
    """主 RPC 優先，失敗切備援（R2 緩解）."""
    for url in [u for u in (rpc_url, fallback_url) if u]:
        try:
            w3 = Web3(Web3.HTTPProvider(url, request_kwargs={"timeout": 30}))
            if w3.is_connected():
                return w3
        except Exception:
            logger.warning("RPC 連線失敗，嘗試下一個: %s", url)
    raise ChainMintError("所有 RPC 節點皆無法連線")


def mint_plot_sync(
    *,
    rpc_url: str,
    fallback_url: str,
    private_key: str,
    contract_address: str,
    chain_id: int,
    geo_hash_hex: str,
    carbon_kg_value: int,
    species_code: int,
) -> dict:
    """同步 mint：建交易 -> 簽名 -> 送出 -> 等 receipt -> 解析 PlotMinted 取 tokenId."""
    w3 = _connect(rpc_url, fallback_url)
    account = w3.eth.account.from_key(private_key)
    contract = w3.eth.contract(
        address=Web3.to_checksum_address(contract_address), abi=GREEN_ASSET_ABI
    )
    try:
        fn = contract.functions.mintPlot(
            account.address, bytes.fromhex(geo_hash_hex), carbon_kg_value, species_code
        )
        tx = fn.build_transaction(
            {
                "from": account.address,
                "nonce": w3.eth.get_transaction_count(account.address),
                "chainId": chain_id,
            }
        )
        signed = account.sign_transaction(tx)
        tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=RECEIPT_TIMEOUT_S)
    except ChainMintError:
        raise
    except Exception as exc:  # RPC/nonce/gas/revert 皆轉為 ChainMintError 供重試
        raise ChainMintError(str(exc)) from exc

    if receipt["status"] != 1:
        raise ChainMintError(f"交易 revert：{tx_hash.hex()}")

    token_id = None
    for event in contract.events.PlotMinted().process_receipt(receipt):
        token_id = int(event["args"]["tokenId"])
    if token_id is None:
        raise ChainMintError("receipt 中找不到 PlotMinted 事件")

    return {
        "tx_hash": "0x" + tx_hash.hex().removeprefix("0x"),
        "token_id": token_id,
        "contract_address": Web3.to_checksum_address(contract_address),
    }


# 測試注入點：mint_and_record 一律經由 _mint_fn 呼叫
_mint_fn = mint_plot_sync

_FETCH_SQL = """
select p.geo_hash, p.species, ce.co2e_tons
from forest_plots p
join carbon_estimates ce on ce.plot_id = p.id and ce.year_offset = 0
where p.id = $1 and p.status = 'chain_pending'
"""

_UPSERT_SUCCESS_SQL = """
insert into chain_records (plot_id, contract_address, token_id, tx_hash, chain_id, minted_at, retry_count, last_error)
values ($1, $2, $3, $4, $5, now(), $6, null)
on conflict (plot_id) do update set
    contract_address = excluded.contract_address,
    token_id = excluded.token_id,
    tx_hash = excluded.tx_hash,
    chain_id = excluded.chain_id,
    minted_at = excluded.minted_at,
    retry_count = excluded.retry_count,
    last_error = null
"""

_MARK_ON_CHAIN_SQL = "update forest_plots set status = 'on_chain' where id = $1"

_UPSERT_FAILURE_SQL = """
insert into chain_records (plot_id, retry_count, last_error)
values ($1, $2, $3)
on conflict (plot_id) do update set
    retry_count = excluded.retry_count,
    last_error = excluded.last_error
"""


async def mint_and_record(pool: asyncpg.Pool, plot_id: uuid.UUID) -> None:
    """BackgroundTask 入口：mint + 回寫；至多 3 次嘗試、指數退避；永不拋例外."""
    try:
        settings = get_settings()
        if not settings.chain_configured:
            logger.info("chain 未設定，略過上鏈 plot_id=%s（停留 chain_pending）", plot_id)
            return

        async with pool.acquire() as conn:
            row = await conn.fetchrow(_FETCH_SQL, plot_id)
        if row is None:
            logger.info("plot 不存在或非 chain_pending，略過: %s", plot_id)
            return

        for attempt in range(3):
            try:
                result = await asyncio.to_thread(
                    _mint_fn,
                    rpc_url=settings.chain_rpc_url,
                    fallback_url=settings.chain_rpc_url_fallback,
                    private_key=settings.minter_private_key,
                    contract_address=settings.nft_contract_address,
                    chain_id=settings.chain_id,
                    geo_hash_hex=row["geo_hash"],
                    carbon_kg_value=carbon_kg(float(row["co2e_tons"])),
                    species_code=SPECIES_CODE[row["species"]],
                )
            except Exception as exc:
                logger.warning(
                    "mint 失敗 plot=%s attempt=%d error=%s", plot_id, attempt + 1, exc
                )
                async with pool.acquire() as conn:
                    await conn.execute(
                        _UPSERT_FAILURE_SQL, plot_id, attempt + 1, str(exc)[:500]
                    )
                if attempt < 2:
                    await asyncio.sleep(BACKOFF_SECONDS[attempt])
                continue

            async with pool.acquire() as conn:
                await conn.execute(
                    _UPSERT_SUCCESS_SQL,
                    plot_id,
                    result["contract_address"],
                    result["token_id"],
                    result["tx_hash"],
                    settings.chain_id,
                    attempt,
                )
                await conn.execute(_MARK_ON_CHAIN_SQL, plot_id)
            logger.info(
                "mint 成功 plot=%s token_id=%s tx=%s",
                plot_id,
                result["token_id"],
                result["tx_hash"],
            )
            return

        logger.error("mint 三次皆失敗，plot=%s 停留 chain_pending（可用 admin retry 補鑄）", plot_id)
    except Exception:
        logger.exception("mint_and_record 未預期例外 plot=%s", plot_id)
```

- [ ] **Step 4: 執行測試確認通過（含全套件）**

Run: `uv run pytest tests/test_chain_service.py -v` → 5 案例全 PASS
Run: `uv run pytest -q` → 全綠

- [ ] **Step 5: Commit**

```powershell
git add backend/app/services/chain_service.py backend/tests/test_chain_service.py
git commit -m "T3.3+T3.4: chain_service（Web3 mint + RPC 備援 + 指數退避重試 + 回寫）"
```

---

### Task 5: API 接線 — BackgroundTask 觸發、chain-status、admin retry、NFT metadata（T3.4–T3.5，§8.4）

**Files:**
- Modify: `backend/app/routers/forest.py`（POST 加 BackgroundTasks；新增 chain-status 端點）
- Create: `backend/app/routers/admin.py`
- Create: `backend/app/routers/nft.py`
- Modify: `backend/app/main.py`（掛兩個新 router）
- Test: `backend/tests/test_chain_endpoints.py`

**Interfaces:**
- Consumes: Task 4 `mint_and_record`、既有 `get_conn`/`get_current_user_id`/`queries`
- Produces（W3 前端據此串接）:
  - `POST /api/forest` 行為不變，但入庫成功後觸發 `background_tasks.add_task(mint_and_record, request.app.state.pool, plot_id)`
  - `GET /api/forest/{id}/chain-status`（JWT 必帶）→ 200 `{"status": PlotStatus, "tx_hash": str|null, "token_id": int|null}`；404 查無
  - `POST /api/admin/retry-pending`（Header `X-Admin-Token` 必帶且等於 `settings.admin_token`，否則 403；`admin_token` 未設定一律 403）→ `{"retriggered": int}`——對所有 `chain_pending` 林區重新排入 mint 背景任務
  - `GET /api/nft/{token_id}/metadata`（**公開，無 JWT**——區塊鏈瀏覽器需能讀）→ 200 ERC-721 metadata JSON `{name, description, attributes: [...]}`；404 查無

- [ ] **Step 1: 寫失敗測試 test_chain_endpoints.py**

```python
import uuid

import pytest
from fastapi.testclient import TestClient

from app.core.auth import get_current_user_id
from app.core.settings import get_settings
from app.db.pool import get_conn
from app.main import app


class FakeConn:
    """依 SQL 動詞/內容回應的假連線."""

    def __init__(self, rows: dict):
        self.rows = rows  # key: 片段字串 -> row/rows

    async def fetchrow(self, sql, *args):
        for key, val in self.rows.items():
            if key in sql:
                return val
        return None

    async def fetch(self, sql, *args):
        for key, val in self.rows.items():
            if key in sql:
                return val
        return []


def _client(rows, admin_token=""):
    async def fake_user():
        return uuid.uuid4()

    async def fake_conn():
        yield FakeConn(rows)

    if admin_token:
        import os

        os.environ["ADMIN_TOKEN"] = admin_token
        get_settings.cache_clear()
    app.dependency_overrides[get_current_user_id] = fake_user
    app.dependency_overrides[get_conn] = fake_conn
    return TestClient(app)


@pytest.fixture(autouse=True)
def _cleanup():
    yield
    app.dependency_overrides.clear()
    import os

    os.environ.pop("ADMIN_TOKEN", None)
    get_settings.cache_clear()


def test_chain_status_returns_status_and_chain_fields():
    plot_id = uuid.uuid4()
    rows = {"chain_records": {"status": "on_chain", "tx_hash": "0xabc", "token_id": 7}}
    with _client(rows) as c:
        resp = c.get(f"/api/forest/{plot_id}/chain-status")
    assert resp.status_code == 200
    assert resp.json() == {"status": "on_chain", "tx_hash": "0xabc", "token_id": 7}


def test_chain_status_404_unknown_plot():
    with _client({}) as c:
        assert c.get(f"/api/forest/{uuid.uuid4()}/chain-status").status_code == 404


def test_chain_status_requires_auth():
    with TestClient(app) as c:
        assert c.get(f"/api/forest/{uuid.uuid4()}/chain-status").status_code == 401


def test_admin_retry_403_without_token():
    with _client({}, admin_token="secret-token") as c:
        assert c.post("/api/admin/retry-pending").status_code == 403
        assert (
            c.post("/api/admin/retry-pending", headers={"X-Admin-Token": "wrong"}).status_code
            == 403
        )


def test_admin_retry_403_when_admin_token_unset():
    with _client({}) as c:  # settings.admin_token == ""
        assert (
            c.post("/api/admin/retry-pending", headers={"X-Admin-Token": ""}).status_code == 403
        )


def test_admin_retry_retriggers_pending():
    pending = [{"id": uuid.uuid4()}, {"id": uuid.uuid4()}]
    rows = {"chain_pending": pending}
    with _client(rows, admin_token="secret-token") as c:
        resp = c.post("/api/admin/retry-pending", headers={"X-Admin-Token": "secret-token"})
    assert resp.status_code == 200
    assert resp.json() == {"retriggered": 2}


def test_nft_metadata_public_no_auth():
    rows = {
        "token_id": {
            "name": "延文實驗林場 A 區",
            "species": "taiwania",
            "area_ha": 19.7204,
            "geo_hash": "ab" * 32,
            "co2e_tons": 357.3476,
            "token_id": 1,
        }
    }

    async def fake_conn():
        yield FakeConn(rows)

    app.dependency_overrides[get_conn] = fake_conn
    with TestClient(app) as c:
        resp = c.get("/api/nft/1/metadata")  # 無 Authorization header
    assert resp.status_code == 200
    body = resp.json()
    assert "延文實驗林場 A 區" in body["name"]
    assert isinstance(body["attributes"], list)


def test_nft_metadata_404():
    async def fake_conn():
        yield FakeConn({})

    app.dependency_overrides[get_conn] = fake_conn
    with TestClient(app) as c:
        assert c.get("/api/nft/999/metadata").status_code == 404
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `uv run pytest tests/test_chain_endpoints.py -v`
Expected: FAIL —— chain-status/admin/nft 路由 404

- [ ] **Step 3: 實作**

`backend/app/routers/forest.py` 修改（僅列變更處）：

import 區加：

```python
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from app.services.chain_service import mint_and_record
```

`submit_forest` 簽名加 `request: Request, background_tasks: BackgroundTasks`（放最前），return 前（插入成功後）加：

```python
    # FR-5.3：入庫成功後非同步觸發上鏈（失敗不回滾、不阻塞回應）
    background_tasks.add_task(
        mint_and_record, request.app.state.pool, uuid.UUID(plot["id"])
    )
```

檔尾新增 chain-status 端點：

```python
_CHAIN_STATUS_SQL = """
select p.status, cr.tx_hash, cr.token_id
from forest_plots p
left join chain_records cr on cr.plot_id = p.id
where p.id = $1
"""


@router.get("/{plot_id}/chain-status")
async def chain_status(
    plot_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    conn: asyncpg.Connection = Depends(get_conn),
):
    row = await conn.fetchrow(_CHAIN_STATUS_SQL, plot_id)
    if row is None:
        raise HTTPException(status_code=404, detail="plot not found")
    return {"status": row["status"], "tx_hash": row["tx_hash"], "token_id": row["token_id"]}
```

（注意：`/{plot_id}/chain-status` 需定義於 `/{plot_id}` 之前，或因 FastAPI 依宣告順序匹配、`chain-status` 較長路徑先宣告皆可——實作時將本端點放在 `get_forest` **之前**以避免被 `/{plot_id}` 吃掉。）

`backend/app/routers/admin.py`：

```python
"""管理端點（簡易保護：X-Admin-Token header，FR-5.3 手動補鑄）."""

import uuid

import asyncpg
from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Request

from app.core.settings import get_settings
from app.db.pool import get_conn
from app.services.chain_service import mint_and_record

router = APIRouter(prefix="/api/admin", tags=["admin"])

_PENDING_SQL = "select id from forest_plots where status = 'chain_pending'"


@router.post("/retry-pending")
async def retry_pending(
    request: Request,
    background_tasks: BackgroundTasks,
    x_admin_token: str | None = Header(default=None),
    conn: asyncpg.Connection = Depends(get_conn),
):
    settings = get_settings()
    if not settings.admin_token or x_admin_token != settings.admin_token:
        raise HTTPException(status_code=403, detail="forbidden")
    rows = await conn.fetch(_PENDING_SQL)
    for row in rows:
        background_tasks.add_task(
            mint_and_record, request.app.state.pool, uuid.UUID(str(row["id"]))
        )
    return {"retriggered": len(rows)}
```

`backend/app/routers/nft.py`：

```python
"""NFT metadata 端點（§9 tokenURI 指向；公開無 JWT——區塊鏈瀏覽器需可讀）."""

import asyncpg
from fastapi import APIRouter, Depends, HTTPException

from app.db.pool import get_conn

router = APIRouter(prefix="/api/nft", tags=["nft"])

_METADATA_SQL = """
select p.name, p.species, p.area_ha, p.geo_hash, cr.token_id, ce.co2e_tons
from chain_records cr
join forest_plots p on p.id = cr.plot_id
join carbon_estimates ce on ce.plot_id = p.id and ce.year_offset = 0
where cr.token_id = $1
"""

_SPECIES_ZH = {"taiwania": "台灣杉", "acacia": "相思樹", "fraxinus": "光臘樹"}


@router.get("/{token_id}/metadata")
async def nft_metadata(token_id: int, conn: asyncpg.Connection = Depends(get_conn)):
    row = await conn.fetchrow(_METADATA_SQL, token_id)
    if row is None:
        raise HTTPException(status_code=404, detail="token not found")
    return {
        "name": f"GreenChain Timber #{token_id} — {row['name']}",
        "description": "綠鏈林匯林區碳資產存證。鏈上 geoHash 為林區邊界正規化 GeoJSON 之 "
        "SHA-256 指紋；估算為示範性質，非查證碳權。",
        "attributes": [
            {"trait_type": "樹種", "value": _SPECIES_ZH.get(row["species"], row["species"])},
            {"trait_type": "面積 (ha)", "value": float(row["area_ha"])},
            {"trait_type": "當年固碳量 (噸 CO2e/年)", "value": float(row["co2e_tons"])},
            {"trait_type": "geoHash", "value": row["geo_hash"]},
        ],
    }
```

`backend/app/main.py`：import 與掛載加

```python
from app.routers.admin import router as admin_router
from app.routers.nft import router as nft_router

app.include_router(admin_router)
app.include_router(nft_router)
```

- [ ] **Step 4: 執行測試確認通過（含全套件）**

Run: `uv run pytest tests/test_chain_endpoints.py -v` → 全 PASS
Run: `uv run pytest -q` → 全綠、`uv run ruff check .` → clean

- [ ] **Step 5: Commit**

```powershell
git add backend/app/routers/ backend/app/main.py backend/tests/test_chain_endpoints.py
git commit -m "T3.4+T3.5: BackgroundTask 觸發 + chain-status + admin retry + NFT metadata 端點"
```

---

### Task 6: 前端 — 鏈上憑證區塊與 chain_pending 輪詢（T3.6，FR-6.4–6.5）

**Files:**
- Modify: `frontend/lib/types.ts`（加 `ChainStatus`）
- Modify: `frontend/lib/api.ts`（加 `getChainStatus`）
- Modify: `frontend/components/PlotDetailView.tsx`（輪詢 + 鏈上區塊改寫）

**Interfaces:**
- Consumes: Task 5 `GET /api/forest/{id}/chain-status` 契約
- Produces:
  - `types.ts`：`export interface ChainStatus { status: PlotStatus; tx_hash: string | null; token_id: number | null }`
  - `api.ts`：`getChainStatus(id: string): Promise<ChainStatus | null>`（走既有 `authedGet`，404 → null）
  - 詳情頁：`status === "chain_pending"` 時每 **10 秒**輪詢；偵測到狀態改變即重抓 `getForest` 更新整頁；鏈上區塊顯示 Token ID、合約地址（連 `https://amoy.polygonscan.com/address/{addr}`）、Tx Hash（連 `https://amoy.polygonscan.com/tx/{hash}`）

- [ ] **Step 1: types.ts 檔尾追加**

```ts
export interface ChainStatus {
  status: PlotStatus;
  tx_hash: string | null;
  token_id: number | null;
}
```

- [ ] **Step 2: api.ts 檔尾追加（import 區補 `ChainStatus`）**

```ts
export async function getChainStatus(id: string): Promise<ChainStatus | null> {
  const { data } = await authedGet<ChainStatus>(`/api/forest/${id}/chain-status`);
  return data;
}
```

- [ ] **Step 3: PlotDetailView.tsx 修改**

import 區加：

```tsx
import { getChainStatus, getForest } from "@/lib/api";
```

（原本已 import `getForest`，合併即可。）

元件內、既有 `useEffect` 之後加輪詢（FR-6.5）：

```tsx
  // chain_pending 時每 10 秒輪詢上鏈狀態；轉 on_chain 後重抓詳情
  useEffect(() => {
    if (!plot || plot.status !== "chain_pending") return;
    const timer = setInterval(async () => {
      const s = await getChainStatus(plot.id).catch(() => null);
      if (s && s.status !== "chain_pending") {
        getForest(plot.id).then((p) => p && setPlot(p)).catch(() => {});
      }
    }, 10_000);
    return () => clearInterval(timer);
  }, [plot]);
```

鏈上憑證區塊整段改寫（原本 `<h2>鏈上憑證</h2>` 的卡片）：

```tsx
          <div className="rounded-xl border border-stone-200 bg-white p-5">
            <h2 className="font-semibold text-stone-800">鏈上憑證</h2>
            {plot.chain_record?.tx_hash ? (
              <dl className="mt-3 space-y-2 text-sm">
                <div>
                  <dt className="text-stone-500">Token ID</dt>
                  <dd className="font-mono">#{plot.chain_record.token_id}</dd>
                </div>
                <div>
                  <dt className="text-stone-500">合約地址</dt>
                  <dd>
                    <a
                      href={`https://amoy.polygonscan.com/address/${plot.chain_record.contract_address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="break-all font-mono text-xs text-emerald-700 underline"
                    >
                      {plot.chain_record.contract_address}
                    </a>
                  </dd>
                </div>
                <div>
                  <dt className="text-stone-500">Tx Hash（點擊至 Amoy 瀏覽器驗證）</dt>
                  <dd>
                    <a
                      href={`https://amoy.polygonscan.com/tx/${plot.chain_record.tx_hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="break-all font-mono text-xs text-emerald-700 underline"
                    >
                      {plot.chain_record.tx_hash}
                    </a>
                  </dd>
                </div>
              </dl>
            ) : plot.status === "chain_pending" ? (
              <p className="mt-2 flex items-center gap-2 text-sm text-amber-700">
                <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
                上鏈處理中——完成後將自動顯示 Tx Hash（每 10 秒更新）
              </p>
            ) : (
              <p className="mt-2 text-sm text-stone-500">尚無鏈上紀錄</p>
            )}
          </div>
```

- [ ] **Step 4: 驗證與 Commit**

Run（`frontend/`）: `npm run lint` → 0 errors；`npm run build` → 成功。

```powershell
git add frontend/ ; git commit -m "T3.6: 詳情頁鏈上憑證區塊 + chain_pending 每 10 秒輪詢"
```

---

### Task 7: AT-6 驗證腳本 verify_hash.py（T3.7）

**Files:**
- Create: `backend/scripts/verify_hash.py`

**Interfaces:**
- Consumes: DB（`forest_plots` + `chain_records`）、`geo_service.geometry_hash`、`chain_codec.GREEN_ASSET_ABI`、`.env`
- Produces: CLI 腳本——對所有 `on_chain` 林區（或指定 plot_id）：DB GeoJSON 重算 SHA-256 vs 鏈上 `getPlotData(tokenId).geoHash`，逐筆輸出 `MATCH`/`MISMATCH`；任何 MISMATCH 時 exit code 1

- [ ] **Step 1: 建立 scripts/verify_hash.py**

```python
"""AT-6 驗證：資料庫 GeoJSON 依正規化規則重算 SHA-256，與鏈上 geoHash 比對.

用法（backend/）:
    uv run python scripts/verify_hash.py            # 驗證所有 on_chain 林區
    uv run python scripts/verify_hash.py <plot_id>  # 驗證單一林區
環境變數（.env）: DATABASE_URL, CHAIN_RPC_URL, NFT_CONTRACT_ADDRESS
"""

import asyncio
import json
import pathlib
import sys

import asyncpg
from web3 import Web3

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from app.services.chain_codec import GREEN_ASSET_ABI  # noqa: E402
from app.services.geo_service import geometry_hash  # noqa: E402


def _load_env() -> dict[str, str]:
    env: dict[str, str] = {}
    env_path = pathlib.Path(__file__).resolve().parents[1] / ".env"
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            if "=" in line and not line.strip().startswith("#"):
                key, _, value = line.partition("=")
                env[key.strip()] = value.strip().strip('"\'')
    return env


_SQL_ALL = """
select p.id, p.name, p.geo_hash, cr.token_id, st_asgeojson(p.geom) as geometry
from forest_plots p join chain_records cr on cr.plot_id = p.id
where p.status = 'on_chain' and cr.token_id is not null
"""


async def main() -> None:
    env = _load_env()
    plot_filter = sys.argv[1] if len(sys.argv) > 1 else None

    conn = await asyncpg.connect(env["DATABASE_URL"])
    try:
        rows = await conn.fetch(_SQL_ALL)
    finally:
        await conn.close()
    if plot_filter:
        rows = [r for r in rows if str(r["id"]) == plot_filter]
    if not rows:
        print("查無 on_chain 林區")
        return

    w3 = Web3(Web3.HTTPProvider(env.get("CHAIN_RPC_URL", "https://rpc-amoy.polygon.technology")))
    contract = w3.eth.contract(
        address=Web3.to_checksum_address(env["NFT_CONTRACT_ADDRESS"]), abi=GREEN_ASSET_ABI
    )

    mismatch = 0
    for row in rows:
        recomputed = geometry_hash(json.loads(row["geometry"]))
        on_chain = contract.functions.getPlotData(row["token_id"]).call()[0].hex()
        db_hash = row["geo_hash"]
        ok = recomputed == on_chain == db_hash
        status = "MATCH" if ok else "MISMATCH"
        if not ok:
            mismatch += 1
        print(f"[{status}] {row['name']} (token #{row['token_id']})")
        print(f"    DB geo_hash : {db_hash}")
        print(f"    重算 SHA-256 : {recomputed}")
        print(f"    鏈上 geoHash : {on_chain}")

    print(f"\n{len(rows) - mismatch}/{len(rows)} MATCH")
    if mismatch:
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
```

- [ ] **Step 2: 驗證與 Commit**

Run: `uv run python -c "import ast; ast.parse(open('scripts/verify_hash.py', encoding='utf-8').read()); print('py ok')"` → `py ok`
Run: `uv run ruff check scripts/` → clean
（實際執行留待 Task 8——需要已上鏈的林區。）

```powershell
git add backend/scripts/verify_hash.py
git commit -m "T3.7: AT-6 雜湊比對腳本（DB 重算 vs 鏈上 geoHash）"
```

---

### Task 8: M3 里程碑驗證（部署 + 端到端 + AT-5 + tag）

**前置（使用者，缺一不可）：** ① MetaMask 開發專用錢包私鑰已填入 `contracts/.env` 與 `backend/.env` 的 `MINTER_PRIVATE_KEY`；② 該錢包 Amoy 餘額 ≥ 1 POL；③ `backend/.env` 的 `ADMIN_TOKEN` 填一組隨機字串。

**Files:**
- Modify: `backend/.env`（`NFT_CONTRACT_ADDRESS` 部署後回填）
- Modify: `docs/devlog.md`

- [ ] **Step 1: 部署合約至 Amoy**

Run（`contracts/`）: `npm run deploy:amoy`
Expected: 輸出 `GreenAssetNFT deployed: 0x...`；記下地址。

- [ ] **Step 2: 回填設定**

`backend/.env`：`NFT_CONTRACT_ADDRESS=0x...`（部署地址）。
於 Amoy 瀏覽器 `https://amoy.polygonscan.com/address/0x...` 確認合約存在（T3.2 DoD）。

- [ ] **Step 3: 本機端到端（M3 核心 DoD）**

啟動後端與前端 → 瀏覽器登入 → 圈一塊新林地送出 → 詳情頁看著「上鏈處理中」→ **≤ 2 分鐘內自動轉 on_chain**、Tx Hash 出現 → 點擊 Tx Hash 於 Amoy 瀏覽器查得交易。

- [ ] **Step 4: AT-5 重試驗證**

1. `backend/.env` 把 `CHAIN_RPC_URL` 改成錯的（如 `https://invalid.example.com`）、`CHAIN_RPC_URL_FALLBACK` 留空，重啟後端
2. 圈一塊新林地送出 → 觀察後端 log 三次失敗、DB `chain_records.retry_count=3`、`last_error` 有值、狀態停留 `chain_pending`
3. 改回正確 RPC、重啟 → `curl -X POST http://127.0.0.1:8000/api/admin/retry-pending -H "X-Admin-Token: <ADMIN_TOKEN>"` → 回 `{"retriggered": 1}` → 該林區轉 `on_chain`

- [ ] **Step 5: AT-6 雜湊比對**

Run（`backend/`）: `uv run python scripts/verify_hash.py`
Expected: 所有 on_chain 林區輸出 `MATCH`，exit 0（T3.7 DoD）。

- [ ] **Step 6: 舊資料補鑄 + tokenURI 確認**

W1/W2 建立的既有 `chain_pending` 林區以 admin retry 一次補鑄；瀏覽器開 `http://127.0.0.1:8000/api/nft/1/metadata` 確認 JSON 可讀（T3.5 DoD）。

- [ ] **Step 7: Render 環境變數 + 正式環境驗證**

Render Dashboard → greenchain-backend → Environment 加入：`CHAIN_RPC_URL`、`MINTER_PRIVATE_KEY`、`NFT_CONTRACT_ADDRESS`、`ADMIN_TOKEN`（值同本機 `.env`）→ 服務自動重啟 → 於正式站（Vercel）圈一塊新林地驗證上鏈全流程。

- [ ] **Step 8: devlog、push、tag**

`docs/devlog.md` 追加 M3 達成記錄（端到端耗時、AT-5/AT-6 結果、合約地址）。

```powershell
git add docs/devlog.md
git commit -m "T3.7: devlog 記錄 M3 達成"
git push origin main
git tag m3-chain
git push origin m3-chain
```

---

## 已知風險與後續

- **R2（Amoy 不穩）**：RPC 備援 + 重試 + admin 補鑄三層緩解；若 Task 8 卡測試網，依開發計畫降級為「Demo 時手動觸發補鑄」，勿花超過 1 天
- **web3.py v7 API 差異**：`signed.raw_transaction`（snake_case）、`process_receipt`——若安裝版本 API 不符，實作者以實際版本文件為準並記錄於報告
- **Render 免費方案**：BackgroundTask 在請求回應後繼續執行沒問題，但服務**閒置休眠會殺掉進行中的任務**——停留 chain_pending 的林區以 admin retry 補鑄即可（W4 UptimeRobot 上線後大幅緩解）
- **私鑰**：`contracts/.env` 與 `backend/.env` 皆已 gitignore；commit 前照慣例 `git diff --staged` 自查

## Self-Review 紀錄

- 規格覆蓋：§9 合約全項（Task 1）、FR-5.1（Task 1/8）、FR-5.2 編碼（Task 3）、FR-5.3 非同步+重試+不回滾（Tasks 4/5）、FR-5.4 回寫（Task 4）、FR-5.5 私鑰（環境變數紅線）、FR-5.6（W1 已完成，AT-6 於 Task 7 驗證）、§8.4 chain-status（Task 5）、FR-6.4/6.5 前端（Task 6）、T3.2 部署+verify（Tasks 2/8）、T3.7 腳本（Task 7）
- 裁決記錄：FR-5.2 的 plotId 上鏈與 §9 簽名矛盾——採 §9（見 Global Constraints）
- Placeholder 掃描：無 TBD/TODO；Task 2 Step 2 的「不實際部署」為刻意（部署需使用者憑證，集中於 Task 8）
- 型別一致性：`mint_plot_sync` kwargs、`_mint_fn` 注入點、`ChainStatus` 欄位、`chain-status` 回應形狀、`BACKOFF_SECONDS` 於 Tasks 3–6 交叉核對一致
