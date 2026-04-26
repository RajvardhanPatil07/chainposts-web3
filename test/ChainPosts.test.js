const assert = require("node:assert/strict");
const { ethers } = require("hardhat");

async function expectRevert(promise, expectedName) {
  try {
    await promise;
    assert.fail(`Expected ${expectedName} revert`);
  } catch (error) {
    assert.match(error.message, new RegExp(expectedName));
  }
}

describe("ChainPosts", function () {
  async function deployFixture() {
    const [alice, bob] = await ethers.getSigners();
    const ChainPosts = await ethers.getContractFactory("ChainPosts");
    const chainPosts = await ChainPosts.deploy();
    await chainPosts.waitForDeployment();

    return { alice, bob, chainPosts };
  }

  it("stores posts on-chain and returns the newest posts first", async function () {
    const { alice, bob, chainPosts } = await deployFixture();

    await chainPosts.connect(alice).createPost("gm web3");
    await chainPosts.connect(bob).createPost("stored directly on-chain");

    assert.equal(await chainPosts.totalPosts(), 2n);

    const firstPost = await chainPosts.getPost(0);
    assert.equal(firstPost.id, 0n);
    assert.equal(firstPost.author, alice.address);
    assert.equal(firstPost.content, "gm web3");
    assert.ok(firstPost.timestamp > 0n);

    const recentPosts = await chainPosts.getRecentPosts(10);
    assert.equal(recentPosts.length, 2);
    assert.equal(recentPosts[0].id, 1n);
    assert.equal(recentPosts[0].author, bob.address);
    assert.equal(recentPosts[0].content, "stored directly on-chain");
    assert.equal(recentPosts[1].id, 0n);
  });

  it("rejects empty posts and posts over 280 bytes", async function () {
    const { chainPosts } = await deployFixture();

    await expectRevert(chainPosts.createPost(""), "PostEmpty");
    await expectRevert(chainPosts.createPost("x".repeat(281)), "PostTooLong");
  });

  it("reverts when a requested post does not exist", async function () {
    const { chainPosts } = await deployFixture();

    await expectRevert(chainPosts.getPost(0), "PostNotFound");
  });
});
