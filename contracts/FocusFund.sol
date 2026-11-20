// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

contract FocusFund {
    uint public nextChallengeId;

    struct Challenge {
        string title;
        string description;
        address creator;
        address verifier;
        uint deposit;
        uint deadline;
        ChallengeStatus status;
        string evidence;
    }    

    enum ChallengeStatus {
        Active,
        Submitted,
        Approved,
        Rejected
    }

    mapping (uint => Challenge) public challenges;

    event ChallengeCreated(
        uint indexed challengeId,
        address indexed creator,
        uint deposit,
        uint deadline
    );

    event EvidenceSubmitted(
        uint indexed challengeId,
        address indexed creator,
        string evidence
    );


    function createChallenge(string memory title, string memory description, address verifier, uint deadline) public payable {
        require(msg.value > 0, "Deposit must be more than 0");
        require(deadline > block.timestamp, "Invalid deadline");
        require(msg.sender != verifier, "Challenge creator can not be verifier");
        require(verifier != address(0), "Invalid verifier");

        challenges[nextChallengeId] = Challenge({
            title: title,
            description: description,
            creator: msg.sender,
            verifier: verifier,
            deposit: msg.value,
            deadline: deadline,
            status: ChallengeStatus.Active,
            evidence: ""
        }); 

        emit ChallengeCreated(nextChallengeId, msg.sender, msg.value, deadline);

        nextChallengeId++;
    }

    

    function submitEvidence(uint challengeId, string memory evidenceURL) public {
        require(challengeId < nextChallengeId, "Challenge does not exist");
        require(msg.sender == challenges[challengeId].creator, "Challenge creator is different");
        require(challenges[challengeId].status == ChallengeStatus.Active, "The challenge must still be active");
        require(challenges[challengeId].deadline > block.timestamp, "Invalid deadline");

        challenges[challengeId].evidence = evidenceURL;
        challenges[challengeId].status = ChallengeStatus.Submitted;

        emit EvidenceSubmitted(challengeId, msg.sender, evidenceURL);
    }
}