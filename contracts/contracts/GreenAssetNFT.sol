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
