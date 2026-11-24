
import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.create();

describe("FocusFund", function () {

    
    it("Should allow the assigned verifier to reject a challenge", async function () {
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

        await expect(
            focusFund.connect(bob).rejectChallenge(0)
        )
            .to.emit(focusFund, "ChallengeRejected")
            .withArgs(0, bob.address, alice.address, deposit);

        const challenge = await focusFund.challenges(0);

        expect(challenge.status).to.equal(3n);
        expect(await focusFund.lostFunds(alice.address)).to.equal(deposit);
        expect(await ethers.provider.getBalance(await focusFund.getAddress())).to.equal(deposit);
    });

    it("Should reject rejection by someone other than the assigned verifier", async function () {
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
            focusFund.connect(charlie).rejectChallenge(0)
        ).to.be.revertedWith("You are not the verifier for this challenge");
    });

    it("Should reject rejection of a nonexistent challenge", async function () {
        const focusFund = await ethers.deployContract("FocusFund");
        const [, bob] = await ethers.getSigners();

        await expect(
            focusFund.connect(bob).rejectChallenge(0)
        ).to.be.revertedWith("Challenge does not exist");
    });

    it("Should reject rejection when the challenge is still active", async function () {
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
            focusFund.connect(bob).rejectChallenge(0)
        ).to.be.revertedWith("Challenge is not waiting approval");
    });

    it("Should reject a second rejection of the same challenge", async function () {
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
        await focusFund.connect(bob).rejectChallenge(0);

        await expect(
            focusFund.connect(bob).rejectChallenge(0)
        ).to.be.revertedWith("Challenge is not waiting approval");
    });

    it("Should accumulate lost funds from multiple rejected challenges", async function () {
        const focusFund = await ethers.deployContract("FocusFund");
        const [alice, bob] = await ethers.getSigners();

        const latestBlock = await ethers.provider.getBlock("latest");
        const deadline = BigInt(latestBlock!.timestamp + 3600);

        const firstDeposit = ethers.parseEther("1");
        const secondDeposit = ethers.parseEther("2");

        await focusFund.connect(alice).createChallenge(
            "Challenge 1",
            "First challenge",
            bob.address,
            deadline,
            { value: firstDeposit }
        );

        await focusFund.connect(alice).createChallenge(
            "Challenge 2",
            "Second challenge",
            bob.address,
            deadline,
            { value: secondDeposit }
        );

        await focusFund.connect(alice).submitEvidence(0, "ipfs://evidence-1");
        await focusFund.connect(alice).submitEvidence(1, "ipfs://evidence-2");

        await focusFund.connect(bob).rejectChallenge(0);
        await focusFund.connect(bob).rejectChallenge(1);

        expect(await focusFund.lostFunds(alice.address)).to.equal(
            ethers.parseEther("3")
        );

        expect(await ethers.provider.getBalance(await focusFund.getAddress())).to.equal(
            ethers.parseEther("3")
        );
    });

});
