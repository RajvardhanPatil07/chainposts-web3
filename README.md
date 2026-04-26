<p align="center">
  <img src="public/chainposts-logo.png" alt="ChainPosts logo" width="96" />
</p>

<h1 align="center">ChainPosts</h1>

<p align="center">
  A wallet-connected Web3 mini social app for publishing short posts directly into smart contract storage.
</p>

<p align="center">
  <a href="https://chainposts-web3.vercel.app/">Live UI</a>
  ·
  <a href="#run-locally">Run Locally</a>
  ·
  <a href="WEB3_CLUB_TENURE_REPORT.md">Club Report</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Solidity-0.8.28-1f2937?style=flat-square" alt="Solidity badge" />
  <img src="https://img.shields.io/badge/Hardhat-Local%20Chain-facc15?style=flat-square&logo=ethereum&logoColor=111827" alt="Hardhat badge" />
  <img src="https://img.shields.io/badge/React-19-0f172a?style=flat-square&logo=react" alt="React badge" />
  <img src="https://img.shields.io/badge/Vercel-Deployed-111827?style=flat-square&logo=vercel" alt="Vercel badge" />
</p>

## Overview

ChainPosts is a simple decentralized application that lets users connect a wallet, write a short message, and publish it on-chain. The project was built as a hands-on Web3 club project to practice the full dApp workflow: smart contract development, frontend integration, wallet interaction, testing, debugging, and deployment.

## Features

- Wallet connect with MetaMask
- Short posts stored directly in contract storage
- 280-byte post limit enforced in Solidity
- Recent post feed pulled from the contract
- Dark and light mode UI
- Local Hardhat deployment flow
- Frontend hosted on Vercel
- User-friendly wallet and RPC error handling

## Tech Stack

- Solidity
- Hardhat
- Ethers.js
- React
- Vite
- Lucide React
- MetaMask
- Vercel

## Smart Contract

The contract in [contracts/ChainPosts.sol](contracts/ChainPosts.sol) exposes three core behaviors:

- `createPost(string content)` stores a new post on-chain
- `getPost(uint256 id)` returns a single post by id
- `getRecentPosts(uint256 count)` returns the newest posts first

It also uses:

- custom errors for cleaner validation
- `PostCreated` events for post creation tracking
- `totalPosts` as an on-chain counter

## Run Locally

1. Install dependencies:

```bash
npm install
```

2. Start the local blockchain:

```bash
npm run node
```

3. In a new terminal, deploy the contract:

```bash
npm run deploy
```

4. Start the frontend:

```bash
npm run dev
```

5. Open the local app and connect MetaMask to:

- RPC URL: `http://127.0.0.1:8545`
- Chain ID: `31337`
- Currency symbol: `ETH`

## Scripts

```bash
npm run compile
npm run test
npm run build
npm run deploy
npm run dev
```

## Project Structure

```text
contracts/            Solidity smart contracts
scripts/              Hardhat deploy script
src/                  React frontend
src/contracts/        Generated frontend contract metadata
test/                 Contract tests
public/               Static assets including app branding
```

<details>
  <summary><strong>Live deployment note</strong></summary>

The current Vercel deployment is available at [chainposts-web3.vercel.app](https://chainposts-web3.vercel.app/), but the app is still configured around a local Hardhat RPC by default. That means the hosted UI is live, while real posting still expects a reachable blockchain endpoint and matching deployed contract metadata.

For a fully public version, the next step is deploying the contract to a public testnet and updating:

- `VITE_POSTS_CONTRACT_ADDRESS`
- `VITE_EXPECTED_CHAIN_ID`
- `VITE_RPC_URL`
</details>

<details>
  <summary><strong>Troubleshooting MetaMask and RPC issues</strong></summary>

If publishing fails, check the following:

- MetaMask is connected to chain `31337`
- the RPC URL is `http://127.0.0.1:8545`
- the local Hardhat node is running
- the contract has been redeployed after restarting the chain
- the selected wallet has test ETH

The frontend also includes friendlier handling for common wallet errors such as:

- rejected wallet requests
- insufficient funds
- wrong network
- low-level RPC errors like `could not coalesce error`
</details>

## Concepts Practiced

- writing and testing Solidity contracts
- contract storage and events
- wallet connection in frontend apps
- reading and writing with Ethers.js
- local blockchain development with Hardhat
- handling chain IDs, RPC endpoints, and deployment metadata
- shipping a Web3 frontend to production

## Additional Documentation

- Tenure report: [WEB3_CLUB_TENURE_REPORT.md](WEB3_CLUB_TENURE_REPORT.md)
