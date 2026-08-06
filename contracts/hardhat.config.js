require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      // Adaptation: @openzeppelin/contracts ^5.1 resolved to 5.6.1, whose
      // utils/Bytes.sol uses the `mcopy` opcode (Cancun). Hardhat 2.29's default
      // EVM version for solc 0.8.24 doesn't enable it, so pin explicitly.
      evmVersion: "cancun",
    },
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
