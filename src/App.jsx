import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clipboard,
  LogOut,
  Moon,
  Network,
  Power,
  RefreshCw,
  Send,
  Sun,
  Wallet,
} from "lucide-react";
import { ethers } from "ethers";
import chainPostsMetadata from "./contracts/ChainPosts.json";

const MAX_POST_BYTES = 280;
const FALLBACK_CHAIN_ID = 31337;
const FALLBACK_RPC_URL = "http://127.0.0.1:8545";
const LOGO_SRC = "/chainposts-logo.png";
const HARDHAT_FUNDED_BALANCE_HEX = "0x21e19e0c9bab2400000";

function getContractAddress() {
  const address =
    import.meta.env.VITE_POSTS_CONTRACT_ADDRESS || chainPostsMetadata.address;

  return ethers.isAddress(address) ? address : "";
}

function getExpectedChainId() {
  const configured =
    import.meta.env.VITE_EXPECTED_CHAIN_ID || chainPostsMetadata.chainId;
  const chainId = Number(configured);

  return Number.isFinite(chainId) && chainId > 0 ? chainId : FALLBACK_CHAIN_ID;
}

function getRpcUrl() {
  return import.meta.env.VITE_RPC_URL || FALLBACK_RPC_URL;
}

function getInitialTheme() {
  if (typeof window === "undefined") return "light";

  const requestedTheme = new URLSearchParams(window.location.search).get("theme");
  if (requestedTheme === "light" || requestedTheme === "dark") {
    return requestedTheme;
  }

  const savedTheme = window.localStorage.getItem("chainposts-theme");
  if (savedTheme === "light" || savedTheme === "dark") return savedTheme;

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function formatAddress(address) {
  if (!address) return "Not connected";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatDate(timestamp) {
  if (!timestamp) return "Pending";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(Number(timestamp) * 1000));
}

function normalizePost(post) {
  return {
    id: Number(post.id),
    author: post.author,
    content: post.content,
    timestamp: Number(post.timestamp),
  };
}

function getPostLength(content) {
  return new TextEncoder().encode(content).length;
}

function collectErrorMessages(value, messages = []) {
  if (!value) return messages;

  if (typeof value === "string") {
    messages.push(value);

    try {
      collectErrorMessages(JSON.parse(value), messages);
    } catch {
      // Not JSON, keep the original string only.
    }

    return messages;
  }

  if (typeof value !== "object") return messages;

  for (const key of ["shortMessage", "reason", "message"]) {
    if (typeof value[key] === "string") {
      messages.push(value[key]);
    }
  }

  for (const key of ["error", "data", "info", "payload", "body"]) {
    collectErrorMessages(value[key], messages);
  }

  return messages;
}

function parseWalletError(error) {
  const messages = collectErrorMessages(error);
  const reason = messages.find(Boolean);
  const combinedReason = messages.join(" ").toLowerCase();

  if (!reason) {
    return "Something went wrong. Please try again.";
  }

  if (combinedReason.includes("user rejected")) {
    return "Wallet request rejected.";
  }

  if (combinedReason.includes("postempty")) {
    return "Post cannot be empty.";
  }

  if (combinedReason.includes("posttoolong")) {
    return "Post is over the 280-byte limit.";
  }

  if (
    combinedReason.includes("insufficient funds") ||
    combinedReason.includes("exceeds the balance") ||
    combinedReason.includes("does not have enough funds")
  ) {
    return "This wallet has no Hardhat test ETH. I tried to fund it automatically; refresh and try again if MetaMask has not caught up.";
  }

  if (
    combinedReason.includes("could not coalesce error") ||
    combinedReason.includes("internal json-rpc error")
  ) {
    return "The wallet returned a low-level RPC error. Check that MetaMask is using http://127.0.0.1:8545 on chain 31337 and that the contract is deployed.";
  }

  return reason;
}

export default function App() {
  const contractAddress = useMemo(getContractAddress, []);
  const expectedChainId = useMemo(getExpectedChainId, []);
  const rpcUrl = useMemo(getRpcUrl, []);
  const hasInjectedWallet = typeof window !== "undefined" && Boolean(window.ethereum);

  const [theme, setTheme] = useState(getInitialTheme);
  const [account, setAccount] = useState("");
  const [chainId, setChainId] = useState(null);
  const [posts, setPosts] = useState([]);
  const [totalPosts, setTotalPosts] = useState(0);
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const draftBytes = getPostLength(draft);
  const isWrongChain = Boolean(chainId) && chainId !== expectedChainId;
  const canPublish =
    Boolean(account) &&
    Boolean(contractAddress) &&
    !isWrongChain &&
    draft.trim().length > 0 &&
    draftBytes <= MAX_POST_BYTES &&
    !isPublishing;

  const getBrowserProvider = useCallback(async () => {
    if (!window.ethereum) {
      throw new Error("No injected wallet found.");
    }

    return new ethers.BrowserProvider(window.ethereum);
  }, []);

  const getReadProvider = useCallback(() => {
    if (rpcUrl) {
      return new ethers.JsonRpcProvider(rpcUrl);
    }

    if (window.ethereum) {
      return new ethers.BrowserProvider(window.ethereum);
    }

    throw new Error("No wallet or RPC provider found.");
  }, [rpcUrl]);

  const refreshPosts = useCallback(async () => {
    if (!contractAddress) {
      setPosts([]);
      setTotalPosts(0);
      return;
    }

    setIsRefreshing(true);
    setError("");

    try {
      const readProvider = getReadProvider();
      const contract = new ethers.Contract(
        contractAddress,
        chainPostsMetadata.abi,
        readProvider
      );
      const [recentPosts, postCount] = await Promise.all([
        contract.getRecentPosts(50),
        contract.totalPosts(),
      ]);

      setPosts(recentPosts.map(normalizePost));
      setTotalPosts(Number(postCount));
    } catch (err) {
      setError(parseWalletError(err));
    } finally {
      setIsRefreshing(false);
    }
  }, [contractAddress, getReadProvider]);

  const syncWalletState = useCallback(async () => {
    if (!window.ethereum) return;

    const provider = await getBrowserProvider();
    const accounts = await provider.send("eth_accounts", []);
    const network = await provider.getNetwork();

    setAccount(accounts[0] || "");
    setChainId(Number(network.chainId));
  }, [getBrowserProvider]);

  const connectWallet = useCallback(async () => {
    if (!window.ethereum) {
      setError("Install a wallet extension such as MetaMask.");
      return;
    }

    setIsConnecting(true);
    setError("");
    setNotice("");

    try {
      const provider = await getBrowserProvider();
      const accounts = await provider.send("eth_requestAccounts", []);
      const network = await provider.getNetwork();

      setAccount(accounts[0] || "");
      setChainId(Number(network.chainId));
      setNotice("Wallet connected.");
    } catch (err) {
      setError(parseWalletError(err));
    } finally {
      setIsConnecting(false);
    }
  }, [getBrowserProvider]);

  const disconnectWallet = useCallback(() => {
    setAccount("");
    setNotice("Wallet disconnected from this session.");
  }, []);

  const switchToExpectedNetwork = useCallback(async () => {
    if (!window.ethereum) {
      setError("Install a wallet extension such as MetaMask.");
      return;
    }

    const chainIdHex = ethers.toQuantity(expectedChainId);

    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: chainIdHex }],
      });
      await syncWalletState();
    } catch (switchError) {
      if (switchError?.code !== 4902) {
        setError(parseWalletError(switchError));
        return;
      }

      try {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: chainIdHex,
              chainName: "Hardhat Local",
              nativeCurrency: {
                name: "Ether",
                symbol: "ETH",
                decimals: 18,
              },
              rpcUrls: [rpcUrl],
            },
          ],
        });
        await syncWalletState();
      } catch (addError) {
        setError(parseWalletError(addError));
      }
    }
  }, [expectedChainId, rpcUrl, syncWalletState]);

  const publishPost = useCallback(async () => {
    const trimmedPost = draft.trim();

    if (!canPublish || !trimmedPost) return;

    setIsPublishing(true);
    setError("");
    setNotice("Confirm the transaction in your wallet.");

    try {
      const provider = await getBrowserProvider();
      const signer = await provider.getSigner();
      const signerAddress = await signer.getAddress();
      const network = await provider.getNetwork();

      if (Number(network.chainId) !== expectedChainId) {
        throw new Error(`Switch to chain ${expectedChainId} before publishing.`);
      }

      const contractCode = await provider.getCode(contractAddress);
      if (contractCode === "0x") {
        throw new Error(
          `No ChainPosts contract found at ${formatAddress(contractAddress)} on this wallet network. Use RPC ${rpcUrl} and redeploy if needed.`
        );
      }

      const balance = await provider.getBalance(signerAddress);
      if (balance === 0n && expectedChainId === FALLBACK_CHAIN_ID) {
        const localProvider = new ethers.JsonRpcProvider(rpcUrl);
        await localProvider.send("hardhat_setBalance", [
          signerAddress,
          HARDHAT_FUNDED_BALANCE_HEX,
        ]);
        setNotice("Added local Hardhat test ETH. Confirm the transaction in your wallet.");
      }

      const contract = new ethers.Contract(
        contractAddress,
        chainPostsMetadata.abi,
        signer
      );
      const nonce = await provider.getTransactionCount(signerAddress, "pending");
      const tx = await contract.createPost(trimmedPost, { nonce });

      setNotice("Transaction submitted. Waiting for confirmation...");
      await tx.wait();

      setDraft("");
      setNotice("Post published on-chain.");
      await refreshPosts();
    } catch (err) {
      setError(parseWalletError(err));
      setNotice("");
    } finally {
      setIsPublishing(false);
    }
  }, [
    canPublish,
    contractAddress,
    draft,
    expectedChainId,
    getBrowserProvider,
    refreshPosts,
    rpcUrl,
  ]);

  const copyContractAddress = useCallback(async () => {
    if (!contractAddress) return;
    await navigator.clipboard.writeText(contractAddress);
    setNotice("Contract address copied.");
  }, [contractAddress]);

  const toggleTheme = useCallback(() => {
    setTheme((currentTheme) => (currentTheme === "light" ? "dark" : "light"));
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("chainposts-theme", theme);
  }, [theme]);

  useEffect(() => {
    syncWalletState();
    refreshPosts();
  }, [refreshPosts, syncWalletState]);

  useEffect(() => {
    if (!window.ethereum) return undefined;

    const handleAccountsChanged = (accounts) => {
      setAccount(accounts[0] || "");
    };

    const handleChainChanged = () => {
      syncWalletState();
      refreshPosts();
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);

    return () => {
      window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum.removeListener("chainChanged", handleChainChanged);
    };
  }, [refreshPosts, syncWalletState]);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <img className="chain-logo" src={LOGO_SRC} alt="ChainPosts" />
          <div>
            <h1>ChainPosts</h1>
            <p>Short posts, stored in a smart contract.</p>
          </div>
        </div>

        <div className="wallet-actions">
          <button
            className="icon-button theme-toggle"
            type="button"
            onClick={toggleTheme}
            title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
            aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
          >
            {theme === "light" ? (
              <Moon size={18} aria-hidden="true" />
            ) : (
              <Sun size={18} aria-hidden="true" />
            )}
          </button>
          <span className={account ? "status-pill success" : "status-pill"}>
            <Power size={16} aria-hidden="true" />
            {account ? formatAddress(account) : "Wallet offline"}
          </span>
          {account ? (
            <button
              className="icon-button secondary"
              type="button"
              onClick={disconnectWallet}
              title="Disconnect wallet from this page"
              aria-label="Disconnect wallet from this page"
            >
              <LogOut size={18} aria-hidden="true" />
            </button>
          ) : (
            <button
              className="primary-button"
              type="button"
              onClick={connectWallet}
              disabled={isConnecting}
            >
              <Wallet size={18} aria-hidden="true" />
              {isConnecting ? "Connecting" : "Connect wallet"}
            </button>
          )}
        </div>
      </header>

      <main className="workspace">
        <section className="composer-panel" aria-labelledby="composer-title">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Composer</p>
              <h2 id="composer-title">Publish on-chain</h2>
            </div>
            <span className={isWrongChain ? "network-chip warning" : "network-chip"}>
              <Network size={16} aria-hidden="true" />
              Chain {chainId || expectedChainId}
            </span>
          </div>

          {isWrongChain && (
            <div className="inline-alert warning" role="status">
              <AlertCircle size={18} aria-hidden="true" />
              <span>Switch to chain {expectedChainId} before publishing.</span>
              <button type="button" onClick={switchToExpectedNetwork}>
                Switch
              </button>
            </div>
          )}

          {!contractAddress && (
            <div className="inline-alert warning" role="status">
              <AlertCircle size={18} aria-hidden="true" />
              <span>Contract address is not configured.</span>
            </div>
          )}

          {!hasInjectedWallet && (
            <div className="inline-alert warning" role="status">
              <AlertCircle size={18} aria-hidden="true" />
              <span>Wallet extension not detected.</span>
            </div>
          )}

          <label className="post-label" htmlFor="post-content">
            Post
          </label>
          <textarea
            id="post-content"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={MAX_POST_BYTES}
            placeholder="gm, world"
            rows={7}
          />

          <div className="composer-footer">
            <span className={draftBytes > MAX_POST_BYTES ? "byte-count over" : "byte-count"}>
              {draftBytes}/{MAX_POST_BYTES} bytes
            </span>
            <button
              className="primary-button"
              type="button"
              onClick={publishPost}
              disabled={!canPublish}
            >
              <Send size={18} aria-hidden="true" />
              {isPublishing ? "Publishing" : "Publish"}
            </button>
          </div>

          {(notice || error) && (
            <div className={error ? "inline-alert danger" : "inline-alert success"} role="status">
              {error ? (
                <AlertCircle size={18} aria-hidden="true" />
              ) : (
                <CheckCircle2 size={18} aria-hidden="true" />
              )}
              <span>{error || notice}</span>
            </div>
          )}
        </section>

        <section className="feed-panel" aria-labelledby="feed-title">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Feed</p>
              <h2 id="feed-title">Latest posts</h2>
            </div>
            <button
              className="icon-button"
              type="button"
              onClick={refreshPosts}
              disabled={isRefreshing}
              title="Refresh posts"
              aria-label="Refresh posts"
            >
              <RefreshCw size={18} aria-hidden="true" />
            </button>
          </div>

          <div className="metrics-grid" aria-label="Contract summary">
            <div>
              <span>Total posts</span>
              <strong>{totalPosts}</strong>
            </div>
            <div>
              <span>Contract</span>
              <button
                className="address-button"
                type="button"
                onClick={copyContractAddress}
                disabled={!contractAddress}
                title="Copy contract address"
              >
                <Clipboard size={15} aria-hidden="true" />
                {contractAddress ? formatAddress(contractAddress) : "Missing"}
              </button>
            </div>
          </div>

          <div className="feed-list">
            {posts.length === 0 ? (
              <div className="empty-state">
                <p>No posts on this contract yet.</p>
              </div>
            ) : (
              posts.map((post) => (
                <article className="post-card" key={post.id}>
                  <div className="post-card-header">
                    <span>#{post.id}</span>
                    <time dateTime={new Date(post.timestamp * 1000).toISOString()}>
                      {formatDate(post.timestamp)}
                    </time>
                  </div>
                  <p>{post.content}</p>
                  <footer>{formatAddress(post.author)}</footer>
                </article>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
