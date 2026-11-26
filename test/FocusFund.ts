
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



    describe("Challenge expiration", function () {

        it("Should expire a challenge after its deadline and record lost funds", async function () {
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

            await ethers.provider.send("evm_increaseTime", [3601]);
            await ethers.provider.send("evm_mine", []);

            await expect(
                focusFund.connect(bob).claimExpiredChallenge(0)
            )
                .to.emit(focusFund, "ChallengeExpired")
                .withArgs(0, alice.address, deposit);

            const challenge = await focusFund.challenges(0);

            expect(challenge.status).to.equal(4n);
            expect(await focusFund.lostFunds(alice.address)).to.equal(deposit);

            expect(
                await ethers.provider.getBalance(await focusFund.getAddress())
            ).to.equal(deposit);
        });


        it("Should allow anyone to expire a challenge", async function () {
            const focusFund = await ethers.deployContract("FocusFund");
            const [alice, bob, charlie] = await ethers.getSigners();

            const latestBlock = await ethers.provider.getBlock("latest");
            const deadline = BigInt(latestBlock!.timestamp + 3600);
            const deposit = ethers.parseEther("1");

            await focusFund.connect(alice).createChallenge(
                "Read a book",
                "Read for one hour",
                bob.address,
                deadline,
                { value: deposit }
            );

            await ethers.provider.send("evm_increaseTime", [3601]);
            await ethers.provider.send("evm_mine", []);

            await focusFund.connect(charlie).claimExpiredChallenge(0);

            expect(await focusFund.lostFunds(alice.address)).to.equal(deposit);
            expect(await focusFund.lostFunds(charlie.address)).to.equal(0n);
        });


        it("Should not expire a challenge before its deadline", async function () {
            const focusFund = await ethers.deployContract("FocusFund");
            const [alice, bob] = await ethers.getSigners();

            const latestBlock = await ethers.provider.getBlock("latest");
            const deadline = BigInt(latestBlock!.timestamp + 3600);

            await focusFund.connect(alice).createChallenge(
                "Exercise",
                "Exercise for 30 minutes",
                bob.address,
                deadline,
                { value: ethers.parseEther("1") }
            );

            await expect(
                focusFund.connect(bob).claimExpiredChallenge(0)
            ).to.be.revertedWith("Challenge is still Active");
        });


        it("Should not expire a challenge that does not exist", async function () {
            const focusFund = await ethers.deployContract("FocusFund");
            const [alice] = await ethers.getSigners();

            await expect(
                focusFund.connect(alice).claimExpiredChallenge(0)
            ).to.be.revertedWith("Challenge does not exist");
        });


        it("Should not expire a challenge that has already submitted evidence", async function () {
            const focusFund = await ethers.deployContract("FocusFund");
            const [alice, bob] = await ethers.getSigners();

            const latestBlock = await ethers.provider.getBlock("latest");
            const deadline = BigInt(latestBlock!.timestamp + 3600);

            await focusFund.connect(alice).createChallenge(
                "Finish homework",
                "Complete the assignment",
                bob.address,
                deadline,
                { value: ethers.parseEther("1") }
            );

            await focusFund.connect(alice).submitEvidence(
                0,
                "ipfs://example-evidence"
            );

            await ethers.provider.send("evm_increaseTime", [3601]);
            await ethers.provider.send("evm_mine", []);

            await expect(
                focusFund.connect(bob).claimExpiredChallenge(0)
            ).to.be.revertedWith("Challenge must be Active");
        });


        it("Should not expire a challenge more than once", async function () {
            const focusFund = await ethers.deployContract("FocusFund");
            const [alice, bob] = await ethers.getSigners();

            const latestBlock = await ethers.provider.getBlock("latest");
            const deadline = BigInt(latestBlock!.timestamp + 3600);
            const deposit = ethers.parseEther("1");

            await focusFund.connect(alice).createChallenge(
                "Learn Java",
                "Study Java for one hour",
                bob.address,
                deadline,
                { value: deposit }
            );

            await ethers.provider.send("evm_increaseTime", [3601]);
            await ethers.provider.send("evm_mine", []);

            await focusFund.connect(bob).claimExpiredChallenge(0);

            await expect(
                focusFund.connect(bob).claimExpiredChallenge(0)
            ).to.be.revertedWith("Challenge must be Active");

            expect(await focusFund.lostFunds(alice.address)).to.equal(deposit);
        });

    });


    describe("Expiration detection", function () {

        it("Should return false when an active challenge has not reached its deadline", async function () {
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

            expect(await focusFund.isReadyToExpire(0)).to.equal(false);
        });


        it("Should return true when an active challenge has passed its deadline", async function () {
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

            expect(await focusFund.isReadyToExpire(0)).to.equal(true);
        });


        it("Should return false when a challenge has submitted evidence", async function () {
            const focusFund = await ethers.deployContract("FocusFund");
            const [alice, bob] = await ethers.getSigners();

            const latestBlock = await ethers.provider.getBlock("latest");
            const deadline = BigInt(latestBlock!.timestamp + 3600);

            await focusFund.connect(alice).createChallenge(
                "Finish homework",
                "Complete the assignment",
                bob.address,
                deadline,
                { value: ethers.parseEther("1") }
            );

            await focusFund.connect(alice).submitEvidence(
                0,
                "ipfs://example-evidence"
            );

            await ethers.provider.send("evm_increaseTime", [3601]);
            await ethers.provider.send("evm_mine", []);

            expect(await focusFund.isReadyToExpire(0)).to.equal(false);
        });


        it("Should return false when a challenge is approved", async function () {
            const focusFund = await ethers.deployContract("FocusFund");
            const [alice, bob] = await ethers.getSigners();

            const latestBlock = await ethers.provider.getBlock("latest");
            const deadline = BigInt(latestBlock!.timestamp + 3600);

            await focusFund.connect(alice).createChallenge(
                "Learn Java",
                "Study Java",
                bob.address,
                deadline,
                { value: ethers.parseEther("1") }
            );

            await focusFund.connect(alice).submitEvidence(
                0,
                "ipfs://example-evidence"
            );

            await focusFund.connect(bob).approveChallenge(0);

            expect(await focusFund.isReadyToExpire(0)).to.equal(false);
        });


        it("Should return false when a challenge is rejected", async function () {
            const focusFund = await ethers.deployContract("FocusFund");
            const [alice, bob] = await ethers.getSigners();

            const latestBlock = await ethers.provider.getBlock("latest");
            const deadline = BigInt(latestBlock!.timestamp + 3600);

            await focusFund.connect(alice).createChallenge(
                "Exercise",
                "Exercise for 30 minutes",
                bob.address,
                deadline,
                { value: ethers.parseEther("1") }
            );

            await focusFund.connect(alice).submitEvidence(
                0,
                "ipfs://example-evidence"
            );

            await focusFund.connect(bob).rejectChallenge(0);

            expect(await focusFund.isReadyToExpire(0)).to.equal(false);
        });


        it("Should return false when a challenge has already been expired", async function () {
            const focusFund = await ethers.deployContract("FocusFund");
            const [alice, bob] = await ethers.getSigners();

            const latestBlock = await ethers.provider.getBlock("latest");
            const deadline = BigInt(latestBlock!.timestamp + 3600);

            await focusFund.connect(alice).createChallenge(
                "Read a book",
                "Read for one hour",
                bob.address,
                deadline,
                { value: ethers.parseEther("1") }
            );

            await ethers.provider.send("evm_increaseTime", [3601]);
            await ethers.provider.send("evm_mine", []);

            await focusFund.claimExpiredChallenge(0);

            expect(await focusFund.isReadyToExpire(0)).to.equal(false);
        });


        it("Should revert when checking a nonexistent challenge", async function () {
            const focusFund = await ethers.deployContract("FocusFund");

            await expect(
                focusFund.isReadyToExpire(0)
            ).to.be.revertedWith("Challenge does not exist");
        });

    });


    describe("Verifier replacement", function () {

        it("Should allow the creator to replace the verifier after the review deadline", async function () {
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

            await focusFund.connect(alice).submitEvidence(
            0,
            "ipfs://example-evidence"
            );

            await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60 + 1]);
            await ethers.provider.send("evm_mine", []);

            await expect(focusFund.connect(alice).replaceVerifier(0, charlie.address))
            .to.emit(focusFund, "VerifierReplaced")
            .withArgs(0, bob.address, charlie.address);

            const challenge = await focusFund.challenges(0);

            expect(challenge.verifier).to.equal(charlie.address);
        });


        it("Should not allow someone other than the creator to replace the verifier", async function () {
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

            await focusFund.connect(alice).submitEvidence(0, "ipfs://example-evidence");

            await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60 + 1]);
            await ethers.provider.send("evm_mine", []);

            await expect(focusFund.connect(charlie).replaceVerifier(0, charlie.address))
            .to.be.revertedWith("Only creator can replace verifier");
        });


        it("Should not allow replacement before the review deadline", async function () {
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

            await focusFund.connect(alice).submitEvidence(0, "ipfs://example-evidence");

            await expect(focusFund.connect(alice).replaceVerifier(0, charlie.address))
            .to.be.revertedWith("Review deadline has not passed");
        });


        it("Should not allow the creator to select themselves as the new verifier", async function () {
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

            await focusFund.connect(alice).submitEvidence(0, "ipfs://example-evidence");

            await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60 + 1]);
            await ethers.provider.send("evm_mine", []);

            await expect(focusFund.connect(alice).replaceVerifier(0, alice.address))
            .to.be.revertedWith("Invalid verifier");
        });


        it("Should not allow the creator to select the current verifier again", async function () {
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

            await focusFund.connect(alice).submitEvidence(0, "ipfs://example-evidence");

            await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60 + 1]);
            await ethers.provider.send("evm_mine", []);

            await expect(focusFund.connect(alice).replaceVerifier(0, bob.address))
            .to.be.revertedWith("Invalid verifier");
        });


        it("Should not allow the zero address as the new verifier", async function () {
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

            await focusFund.connect(alice).submitEvidence(0, "ipfs://example-evidence");

            await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60 + 1]);
            await ethers.provider.send("evm_mine", []);

            await expect(
            focusFund.connect(alice).replaceVerifier(0, ethers.ZeroAddress)
            ).to.be.revertedWith("Invalid verifier");
        });


        it("Should not allow replacement for a nonexistent challenge", async function () {
            const focusFund = await ethers.deployContract("FocusFund");
            const [alice, , charlie] = await ethers.getSigners();

            await expect(focusFund.connect(alice).replaceVerifier(0, charlie.address))
            .to.be.revertedWith("Challenge does not exist");
        });


        it("Should reset the review deadline after replacing the verifier", async function () {
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

            await focusFund.connect(alice).submitEvidence(0, "ipfs://example-evidence");

            await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60 + 1]);
            await ethers.provider.send("evm_mine", []);

            await focusFund.connect(alice).replaceVerifier(0, charlie.address);

            const challenge = await focusFund.challenges(0);
            const currentBlock = await ethers.provider.getBlock("latest");

            expect(challenge.reviewDeadline).to.equal(
            BigInt(currentBlock!.timestamp) + BigInt(7 * 24 * 60 * 60)
            );
        });


        it("Should prevent the old verifier from approving after replacement", async function () {
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

            await focusFund.connect(alice).submitEvidence(0, "ipfs://example-evidence");

            await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60 + 1]);
            await ethers.provider.send("evm_mine", []);

            await focusFund.connect(alice).replaceVerifier(0, charlie.address);

            await expect(focusFund.connect(bob).approveChallenge(0))
            .to.be.revertedWith("You are not the verifier for this challenge");
        });

    });

    
    describe("Charity contributions", function () {

        it("Should allow a user to contribute part of their lost funds", async function () {
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

            await focusFund.connect(alice).openCharityEvent();

            await expect(focusFund.connect(alice).contributeToCharity(ethers.parseEther("0.4")))
            .to.emit(focusFund, "ContributedToCharity")
            .withArgs(alice.address, ethers.parseEther("0.4"));

            expect(await focusFund.lostFunds(alice.address))
            .to.equal(ethers.parseEther("0.6"));

            expect(await focusFund.charityPool())
            .to.equal(ethers.parseEther("0.4"));
        });


        it("Should allow a user to contribute their entire lost-funds balance", async function () {
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

            await focusFund.connect(alice).openCharityEvent();

            await focusFund.connect(alice).contributeToCharity(ethers.parseEther("1"));

            expect(await focusFund.lostFunds(alice.address)).to.equal(0);
            expect(await focusFund.charityPool()).to.equal(ethers.parseEther("1"));
        });


        it("Should not allow contributions when no charity event is active", async function () {
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
            focusFund.connect(alice).contributeToCharity(ethers.parseEther("0.5"))
            ).to.be.revertedWith("No active charity event right now");
        });


        it("Should not allow a zero contribution", async function () {
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

            await focusFund.connect(alice).openCharityEvent();

            await expect(
            focusFund.connect(alice).contributeToCharity(0)
            ).to.be.revertedWith("Invalid donation amount");
        });


        it("Should not allow a user to contribute more than their lost funds", async function () {
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

            await focusFund.connect(alice).openCharityEvent();

            await expect(
            focusFund.connect(alice).contributeToCharity(ethers.parseEther("1.1"))
            ).to.be.revertedWith("Insufficient funds");
        });

    });


    describe("Charity withdrawals", function () {

        it("Should allow the admin to withdraw the charity pool", async function () {
            const focusFund = await ethers.deployContract("FocusFund");
            const [admin, alice, bob, recipient] = await ethers.getSigners();

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

            await focusFund.connect(admin).openCharityEvent();
            await focusFund.connect(alice).contributeToCharity(ethers.parseEther("1"));
            await focusFund.connect(admin).closeCharityEvent();

            await expect(focusFund.connect(admin).withdrawCharityFunds(recipient.address))
            .to.emit(focusFund, "CharityFundsWithdrawn")
            .withArgs(recipient.address, ethers.parseEther("1"));

            expect(await focusFund.charityPool()).to.equal(0);
        });


        it("Should not allow someone other than the admin to withdraw", async function () {
            const focusFund = await ethers.deployContract("FocusFund");
            const [admin, alice, bob] = await ethers.getSigners();

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

            await focusFund.connect(admin).openCharityEvent();
            await focusFund.connect(alice).contributeToCharity(ethers.parseEther("1"));
            await focusFund.connect(admin).closeCharityEvent();

            await expect(
            focusFund.connect(alice).withdrawCharityFunds(admin.address)
            ).to.be.revertedWith("Only admin can call this function");
        });


        it("Should not allow withdrawal while a charity event is active", async function () {
            const focusFund = await ethers.deployContract("FocusFund");
            const [admin, alice, bob] = await ethers.getSigners();

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

            await focusFund.connect(admin).openCharityEvent();
            await focusFund.connect(alice).contributeToCharity(ethers.parseEther("1"));

            await expect(
            focusFund.connect(admin).withdrawCharityFunds(bob.address)
            ).to.be.revertedWith("Event is still active");
        });


        it("Should not allow the zero address as recipient", async function () {
            const focusFund = await ethers.deployContract("FocusFund");
            const [admin, alice, bob] = await ethers.getSigners();

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

            await focusFund.connect(admin).openCharityEvent();
            await focusFund.connect(alice).contributeToCharity(ethers.parseEther("1"));
            await focusFund.connect(admin).closeCharityEvent();

            await expect(
            focusFund.connect(admin).withdrawCharityFunds(ethers.ZeroAddress)
            ).to.be.revertedWith("Invalid recipient");
        });


        it("Should not allow withdrawal when the charity pool is empty", async function () {
            const focusFund = await ethers.deployContract("FocusFund");
            const [admin, recipient] = await ethers.getSigners();

            await expect(
            focusFund.connect(admin).withdrawCharityFunds(recipient.address)
            ).to.be.revertedWith("Insufficient charity pool");
        });


        it("Should transfer the ETH to the recipient", async function () {
            const focusFund = await ethers.deployContract("FocusFund");
            const [admin, alice, bob, recipient] = await ethers.getSigners();

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

            await focusFund.connect(admin).openCharityEvent();
            await focusFund.connect(alice).contributeToCharity(ethers.parseEther("1"));
            await focusFund.connect(admin).closeCharityEvent();

            const recipientBalanceBefore = await ethers.provider.getBalance(recipient.address);

            await focusFund.connect(admin).withdrawCharityFunds(recipient.address);

            const recipientBalanceAfter = await ethers.provider.getBalance(recipient.address);

            expect(recipientBalanceAfter - recipientBalanceBefore)
            .to.equal(ethers.parseEther("1"));
        });


        it("Should preserve the charity pool if the recipient rejects ETH", async function () {
            const focusFund = await ethers.deployContract("FocusFund");
            const [admin, alice, bob] = await ethers.getSigners();

            const RejectEther = await ethers.getContractFactory("RejectEther");
            const rejectEther = await RejectEther.deploy();

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

            await focusFund.connect(admin).openCharityEvent();
            await focusFund.connect(alice).contributeToCharity(ethers.parseEther("1"));
            await focusFund.connect(admin).closeCharityEvent();

            await expect(
            focusFund.connect(admin).withdrawCharityFunds(await rejectEther.getAddress())
            ).to.be.revertedWith("Transfer error");

            expect(await focusFund.charityPool()).to.equal(ethers.parseEther("1"));
        });

    });



});
