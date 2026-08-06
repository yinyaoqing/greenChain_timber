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
