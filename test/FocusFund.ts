
import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.create();

describe("FocusFund", function () {

    it("Should allow the assigned verifier to approve a challenge and refund the deposit", async function () {
        const focusFund = await ethers.deployContract("FocusFund");
        const [alice, bob] = await ethers.getSigners();

        const latestBlock = await ethers.provider.getBlock("latest");
        const deadline = BigInt(latestBlock!.timestamp + 3600);
        const deposit = ethers.parseEther("1");

        await focusFund.connect(alice).createChallenge(
            "Study Solidity",
            "Study for two hours",
            bob.address,
            deadline,
            { value: deposit }
        );

        await focusFund.connect(alice).submitEvidence(
            0,
            "ipfs://example-evidence"
        );

        const aliceBalanceBefore = await ethers.provider.getBalance(alice.address);

        await expect(
            focusFund.connect(bob).approveChallenge(0)
        )
            .to.emit(focusFund, "ChallengeApproved")
            .withArgs(0, bob.address, alice.address, deposit);

        const aliceBalanceAfter = await ethers.provider.getBalance(alice.address);
        const challenge = await focusFund.challenges(0);

        expect(aliceBalanceAfter - aliceBalanceBefore).to.equal(deposit);
        expect(challenge.status).to.equal(2n);
        expect(await ethers.provider.getBalance(await focusFund.getAddress())).to.equal(0n);
    });

    it("Should reject approval by the challenge creator", async function () {
        const focusFund = await ethers.deployContract("FocusFund");
        const [alice, bob] = await ethers.getSigners();

        const latestBlock = await ethers.provider.getBlock("latest");
        const deadline = BigInt(latestBlock!.timestamp + 3600);

        await focusFund.connect(alice).createChallenge(
            "Study Solidity",
            "Study for two hours",
            bob.address,
            deadline,
            { value: ethers.parseEther("1") }
        );

        await focusFund.connect(alice).submitEvidence(0, "ipfs://evidence");

        await expect(
            focusFund.connect(alice).approveChallenge(0)
        ).to.be.revertedWith("You are not the verifier for this challenge");
    });

    it("Should reject approval by an unrelated user", async function () {
        const focusFund = await ethers.deployContract("FocusFund");
        const [alice, bob, charlie] = await ethers.getSigners();

        const latestBlock = await ethers.provider.getBlock("latest");
        const deadline = BigInt(latestBlock!.timestamp + 3600);

        await focusFund.connect(alice).createChallenge(
            "Study Solidity",
            "Study for two hours",
            bob.address,
            deadline,
            { value: ethers.parseEther("1") }
        );

        await focusFund.connect(alice).submitEvidence(0, "ipfs://evidence");

        await expect(
            focusFund.connect(charlie).approveChallenge(0)
        ).to.be.revertedWith("You are not the verifier for this challenge");
    });

    it("Should reject approval of a nonexistent challenge", async function () {
        const focusFund = await ethers.deployContract("FocusFund");
        const [, bob] = await ethers.getSigners();

        await expect(
            focusFund.connect(bob).approveChallenge(0)
        ).to.be.revertedWith("Challenge does not exist");
    });

    it("Should reject approval when the challenge is still active", async function () {
        const focusFund = await ethers.deployContract("FocusFund");
        const [alice, bob] = await ethers.getSigners();

        const latestBlock = await ethers.provider.getBlock("latest");
        const deadline = BigInt(latestBlock!.timestamp + 3600);

        await focusFund.connect(alice).createChallenge(
            "Study Solidity",
            "Study for two hours",
            bob.address,
            deadline,
            { value: ethers.parseEther("1") }
        );

        await expect(
            focusFund.connect(bob).approveChallenge(0)
        ).to.be.revertedWith("Challenge is not waiting approval");
    });

    it("Should reject approval of an already approved challenge", async function () {
        const focusFund = await ethers.deployContract("FocusFund");
        const [alice, bob] = await ethers.getSigners();

        const latestBlock = await ethers.provider.getBlock("latest");
        const deadline = BigInt(latestBlock!.timestamp + 3600);

        await focusFund.connect(alice).createChallenge(
            "Study Solidity",
            "Study for two hours",
            bob.address,
            deadline,
            { value: ethers.parseEther("1") }
        );

        await focusFund.connect(alice).submitEvidence(0, "ipfs://evidence");

        await focusFund.connect(bob).approveChallenge(0);

        await expect(
            focusFund.connect(bob).approveChallenge(0)
        ).to.be.revertedWith("Challenge is not waiting approval");
    });

});
