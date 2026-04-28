const fs = require("node:fs");
const path = require("node:path");
const hre = require("hardhat");

async function main() {
  const ChainPosts = await hre.ethers.getContractFactory("ChainPosts");
  const chainPosts = await ChainPosts.deploy();
  await chainPosts.waitForDeployment();

  const address = await chainPosts.getAddress();
  const network = await hre.ethers.provider.getNetwork();
  const chainId = Number(network.chainId);
  const artifact = await hre.artifacts.readArtifact("ChainPosts");

  const metadata = {
    address,
    chainId,
    network: hre.network.name,
    abi: artifact.abi,
    bytecode: artifact.bytecode,
  };

  const contractMetadataPath = path.join(
    __dirname,
    "..",
    "src",
    "contracts",
    "ChainPosts.json"
  );
  fs.mkdirSync(path.dirname(contractMetadataPath), { recursive: true });
  fs.writeFileSync(contractMetadataPath, `${JSON.stringify(metadata, null, 2)}\n`);

  const envPath = path.join(__dirname, "..", ".env.local");
  fs.writeFileSync(
    envPath,
    [
      `VITE_POSTS_CONTRACT_ADDRESS=${address}`,
      `VITE_EXPECTED_CHAIN_ID=${chainId}`,
      "VITE_RPC_URL=http://127.0.0.1:8545",
      "",
    ].join("\n")
  );

  console.log(`ChainPosts deployed to ${address} on chain ${chainId}`);
  console.log(`Wrote frontend metadata to ${contractMetadataPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
