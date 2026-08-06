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
