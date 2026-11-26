// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

contract FocusFund {
    //STATE VARIABLES:
    uint public nextChallengeId;
    uint public charityPool;
    address public immutable admin;
    bool public charityEventActive;

    uint public constant REVIEW_PERIOD = 7 days;


    //CHALLENGE STRUCT !IMPORTANT
    struct Challenge {
        string title;
        string description;
        address creator;
        address verifier;
        uint deposit;
        uint deadline;
        ChallengeStatus status;
        string evidence;
        uint reviewDeadline;
    }    



    //ENUM FOR CHALLENGE STATUS
    enum ChallengeStatus {
        Active,
        Submitted,
        Approved,
        Rejected,
        Expired
    }
    

    //MAPPINGS:
    //challenges for making and storing multiple Challenge,
    //lostFunds for managing each user's lost fund after a challenge is rejected
    mapping (uint => Challenge) public challenges;
    mapping (address => uint) public lostFunds;



    //EVENTS:
    //ChallengeCreated event 
    event ChallengeCreated(
        uint indexed challengeId,
        address indexed creator,
        uint deposit,
        uint deadline
    );

    //EvidenceSubmitted event 
    event EvidenceSubmitted(
        uint indexed challengeId,
        address indexed creator,
        string evidence
    );

    //ChallengeApproved event 
    event ChallengeApproved(
        uint indexed challengeId,
        address indexed verifier,
        address indexed creator,
        uint depositReturned
    );

    //ChallengeRejected event 
    event ChallengeRejected(
        uint indexed challengeId,
        address indexed verifier,
        address indexed creator,
        uint lostDeposit
    );

    //ChallengeExpired event 
    event ChallengeExpired(
        uint indexed challengeId,
        address indexed creator,
        uint lostDeposit
    );

    //VerifierReplaced event
    event VerifierReplaced(
        uint indexed challengeId,
        address oldVerifier,
        address indexed newVerifier
    );

    //Charity events
    event CharityEventOpened(address indexed admin);
    event CharityEventClosed(address indexed admin);
    event ContributedToCharity(
        address indexed contributor,
        uint amount
    );

    event CharityFundsWithdrawn(
        address indexed recipient,
        uint amount
    );



    //Constructor that runs at contract deployment
    constructor() {
        admin = msg.sender;
    }



    //modifier to replace later require(admin), for reusability
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can call this function");
        _;
    }



    //FUNCTIONS:
    //Function to create a challenge
    function createChallenge(string memory title, string memory description, address verifier, uint deadline) public payable {
        require(msg.value > 0, "Deposit must be more than 0");
        require(block.timestamp < deadline, "Invalid deadline");
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
            evidence: "",
            reviewDeadline: 0
        }); 

        emit ChallengeCreated(nextChallengeId, msg.sender, msg.value, deadline);

        nextChallengeId++;
    }

    

    //Function to submit evidence for an existing challenge
    function submitEvidence(uint challengeId, string memory evidenceURL) public {
        Challenge storage challenge = challenges[challengeId];
    
        require(challengeId < nextChallengeId, "Challenge does not exist");
        require(msg.sender == challenge.creator, "Challenge creator is different");
        require(challenge.status == ChallengeStatus.Active, "The challenge has expired");
        require(block.timestamp < challenge.deadline, "Challenge expired");

        challenge.evidence = evidenceURL;
        challenge.status = ChallengeStatus.Submitted;
        challenge.reviewDeadline = block.timestamp + REVIEW_PERIOD;

        emit EvidenceSubmitted(challengeId, msg.sender, evidenceURL);
    }



    //Function to approve a challenge
    function approveChallenge(uint challengeId) public {
        Challenge storage challenge = challenges[challengeId];

        require(challengeId < nextChallengeId, "Challenge does not exist");
        require(msg.sender == challenge.verifier, "You are not the verifier for this challenge");
        require(challenge.status == ChallengeStatus.Submitted, "Challenge is not waiting approval");
        require(block.timestamp < challenge.reviewDeadline, "Review deadline has passed");

        uint depositReturned = challenge.deposit;

        challenge.status = ChallengeStatus.Approved;

        (bool success, ) = payable(challenge.creator).call{value: depositReturned}("");
        require(success, "Transfer back failed");

        emit ChallengeApproved(
            challengeId,
            msg.sender,
            challenge.creator,
            depositReturned
        );
    }



    //Function to reject a challenge
    function rejectChallenge(uint challengeId) public {
        Challenge storage challenge = challenges[challengeId];

        require(challengeId < nextChallengeId, "Challenge does not exist");
        require(msg.sender == challenge.verifier, "You are not the verifier for this challenge");
        require(challenge.status == ChallengeStatus.Submitted, "Challenge is not waiting approval");
        require(block.timestamp < challenge.reviewDeadline, "Review deadline has passed");

        uint lostFund = challenge.deposit;
        
        challenge.status = ChallengeStatus.Rejected;

        lostFunds[challenge.creator] += lostFund;

        emit ChallengeRejected(
            challengeId,
            msg.sender,
            challenge.creator,
            lostFund
        );
    }



    //Function to make a challenge expired
    function claimExpiredChallenge(uint challengeId) public {
        Challenge storage challenge = challenges[challengeId];

        require(challengeId < nextChallengeId, "Challenge does not exist");
        require(block.timestamp >= challenge.deadline, "Challenge is still Active");  
        require(challenge.status == ChallengeStatus.Active, "Challenge must be Active");

        uint lostFund = challenge.deposit;

        challenge.status = ChallengeStatus.Expired;

        lostFunds[challenge.creator] += lostFund;

        emit ChallengeExpired(
            challengeId,
            challenge.creator,
            lostFund
        );
    }



    //View function to return if a challenge's status is Active or not
    function isReadyToExpire(uint challengeId) public view returns (bool) {
        require(challengeId < nextChallengeId, "Challenge does not exist");

        Challenge storage challenge = challenges[challengeId];

        return(
            challenge.status == ChallengeStatus.Active &&
            block.timestamp >= challenge.deadline
        );
    }



    //Function to re-assign a new verifier after the verifying deadline
    function replaceVerifier(uint challengeId, address newVerifier) public {
        Challenge storage challenge = challenges[challengeId];
        
        require(challengeId < nextChallengeId, "Challenge does not exist");
        require(msg.sender == challenge.creator, "Only creator can replace verifier");
        require(challenge.status == ChallengeStatus.Submitted, "Challenge evidence is not submitted yet");
        require(newVerifier != challenge.verifier && 
                newVerifier != challenge.creator &&
                newVerifier != address(0),
                "Invalid verifier");
        require(block.timestamp >= challenge.reviewDeadline, "Review deadline has not passed");

        address oldVerifier = challenge.verifier;
        challenge.verifier = newVerifier;

        challenge.reviewDeadline = block.timestamp + REVIEW_PERIOD;

        emit VerifierReplaced(
            challengeId,
            oldVerifier,
            newVerifier
        );
    }



    //Function to start a charity event
    function openCharityEvent() public onlyAdmin {
        require(charityEventActive == false, "Event is already active");

        charityEventActive = true;

        emit CharityEventOpened(msg.sender);
    }

    function closeCharityEvent() public onlyAdmin {
        require(charityEventActive == true, "No active charity event right now");

        charityEventActive = false;

        emit CharityEventClosed(msg.sender);
    }




    //Function for users to donate to charity
    function contributeToCharity(uint donation) public {
        require(charityEventActive == true, "No active charity event right now");
        require(donation > 0, "Invalid donation amount");
        require(donation <= lostFunds[msg.sender], "Insufficient funds");

        lostFunds[msg.sender] -= donation;

        charityPool += donation;

        emit ContributedToCharity(
            msg.sender,
            donation
        );
    }




    //Withdraw to charity recipient function
    function withdrawCharityFunds(address charityOwner) public onlyAdmin {
        require(charityEventActive == false, "Event is still active");
        require(charityOwner != address(0), "Invalid recipient");
        require(charityPool > 0, "Insufficient charity pool");

        uint finalCharityPool = charityPool;
        charityPool = 0;

        (bool success, ) = payable(charityOwner).call{value: finalCharityPool}("");
        require(success, "Transfer error");

        emit CharityFundsWithdrawn(
            charityOwner,
            finalCharityPool
        );
    }
}