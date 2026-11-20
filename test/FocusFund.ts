
import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.create();

describe("FocusFund", function () {

    it("Should create a challenge and store its information", async function () {
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

        const challenge = await focusFund.challenges(0);

        expect(challenge.title).to.equal("Study Solidity");
        expect(challenge.description).to.equal("Study for two hours");
        expect(challenge.creator).to.equal(alice.address);
        expect(challenge.verifier).to.equal(bob.address);
        expect(challenge.deposit).to.equal(ethers.parseEther("1"));
        expect(challenge.deadline).to.equal(deadline);
        expect(challenge.status).to.equal(0n);
        expect(await focusFund.nextChallengeId()).to.equal(1);
    });

    it("Should allow the creator to submit evidence and emit an event", async function () {
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

        const evidenceURL = "ipfs://example-evidence";

        await expect(
            focusFund.connect(alice).submitEvidence(0, evidenceURL)
        )
            .to.emit(focusFund, "EvidenceSubmitted")
            .withArgs(0, alice.address, evidenceURL);

        const challenge = await focusFund.challenges(0);

        expect(challenge.evidence).to.equal(evidenceURL);
        expect(challenge.status).to.equal(1n);
    });

    it("Should reject evidence submitted by someone other than the creator", async function () {
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

        await expect(
            focusFund.connect(charlie).submitEvidence(
                0,
                "ipfs://example-evidence"
            )
        ).to.be.revertedWith("Challenge creator is different");
    });

    it("Should reject evidence submitted twice", async function () {
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

        await focusFund.connect(alice).submitEvidence(
            0,
            "ipfs://first-evidence"
        );

        await expect(
            focusFund.connect(alice).submitEvidence(
                0,
                "ipfs://second-evidence"
            )
        ).to.be.revertedWith("The challenge must still be active");
    });

    it("Should reject evidence submitted after the deadline", async function () {
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

        await ethers.provider.send("evm_increaseTime", [3601]);
        await ethers.provider.send("evm_mine", []);

        await expect(
            focusFund.connect(alice).submitEvidence(
                0,
                "ipfs://late-evidence"
            )
        ).to.be.revertedWith("Invalid deadline");
    });

});
