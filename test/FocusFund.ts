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

        expect(await focusFund.nextChallengeId()).to.equal(1);
    });

});