// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

contract FocusFund {
    //State variables
    uint public nextChallengeId;
    uint public charityPool;

    //Challenge struct !important
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

    //enum for Challenge Status
    enum ChallengeStatus {
        Active,
        Submitted,
        Approved,
        Rejected
    }

    //mapping challenges for making and storing multiple Challenge,
    //mapping lostFunds for managing each user's lost fund after a challenge is rejected
    mapping (uint => Challenge) public challenges;
    mapping (address => uint) public lostFunds;


    //ChallengeCreated event for front end
    event ChallengeCreated(
        uint indexed challengeId,
        address indexed creator,
        uint deposit,
        uint deadline
    );

    //EvidenceSubmitted event for front end
    event EvidenceSubmitted(
        uint indexed challengeId,
        address indexed creator,
        string evidence
    );

    //ChallengeApproved event for front end
    event ChallengeApproved(
        uint indexed challengeId,
        address indexed verifier,
        address indexed creator,
        uint depositReturned
    );


    //ChallengeRejected event for front end
    event ChallengeRejected(
        uint indexed challengeId,
        address indexed verifier,
        address indexed creator,
        uint lostDeposit
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



    function approveChallenge(uint challengeId) public {
        require(challengeId < nextChallengeId, "Challenge does not exist");
        require(msg.sender == challenges[challengeId].verifier, "You are not the verifier for this challenge");
        require(challenges[challengeId].status == ChallengeStatus.Submitted, "Challenge is not waiting approval");

        uint depositReturned = challenges[challengeId].deposit;

        challenges[challengeId].status = ChallengeStatus.Approved;

        (bool success, ) = payable(challenges[challengeId].creator).call{value: depositReturned}("");
        require(success, "Transfer back failed");

        emit ChallengeApproved(
            challengeId,
            msg.sender,
            challenges[challengeId].creator,
            depositReturned
        );
    }



    function rejectChallenge(uint challengeId) public {
        require(challengeId < nextChallengeId, "Challenge does not exist");
        require(msg.sender == challenges[challengeId].verifier, "You are not the verifier for this challenge");
        require(challenges[challengeId].status == ChallengeStatus.Submitted, "Challenge is not waiting approval");

        uint lostFund = challenges[challengeId].deposit;
        
        challenges[challengeId].status = ChallengeStatus.Rejected;

        lostFunds[challenges[challengeId].creator] += lostFund;

        emit ChallengeRejected(
            challengeId,
            msg.sender,
            challenges[challengeId].creator,
            lostFund
        );
    }
}