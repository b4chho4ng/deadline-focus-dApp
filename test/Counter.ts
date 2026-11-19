
import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.create();

describe("Counter", function () {

  it("Should emit the Increment event when calling inc()", async function () {
    const counter = await ethers.deployContract("Counter");

    await expect(counter.inc())
      .to.emit(counter, "Increment")
      .withArgs(1n);
  });

  it("Should allow a user to deposit ETH", async function () {
    const counter = await ethers.deployContract("Counter");
    const [alice] = await ethers.getSigners();

    await counter.connect(alice).deposit({
      value: ethers.parseEther("5")
    });

    expect(await counter.deposits(alice.address))
      .to.equal(ethers.parseEther("5"));

    expect(await counter.totalDeposits())
      .to.equal(ethers.parseEther("5"));
  });

  it("Should allow a user to withdraw ETH", async function () {
    const counter = await ethers.deployContract("Counter");
    const [alice] = await ethers.getSigners();

    await counter.connect(alice).deposit({
      value: ethers.parseEther("5")
    });

    await counter.connect(alice).withdraw(
      ethers.parseEther("2")
    );

    expect(await counter.deposits(alice.address))
      .to.equal(ethers.parseEther("3"));

    expect(await counter.totalDeposits())
      .to.equal(ethers.parseEther("3"));

    expect(await ethers.provider.getBalance(await counter.getAddress()))
      .to.equal(ethers.parseEther("3"));
  });

  it("Should reject withdrawals exceeding the user's deposit", async function () {
    const counter = await ethers.deployContract("Counter");
    const [alice] = await ethers.getSigners();

    await counter.connect(alice).deposit({
      value: ethers.parseEther("5")
    });

    await expect(
      counter.connect(alice).withdraw(ethers.parseEther("6"))
    ).to.be.revertedWith("Insufficient balance");
  });

});
