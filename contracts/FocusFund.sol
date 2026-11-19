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
    }    



    mapping (uint => Challenge) public challenges;



    event ChallengeCreated(
        uint indexed challengeId,
        address indexed creator,
        uint deposit,
        uint deadline
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
            deadline: deadline
        }); 

        emit ChallengeCreated(nextChallengeId, msg.sender, msg.value, deadline);

        nextChallengeId++;
    }
}