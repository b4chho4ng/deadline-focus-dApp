// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

contract Counter {
  //State variables
  uint public x;
  uint public totalDeposits;


  //Mapping variable to store key => value pair
  mapping(address => uint) public deposits;


  //Event to send to frontend (?) when use 'emit'
  event Increment(uint by);
  event Decrement(uint by);


  //Increment function
  function inc() public {
    x++;
    emit Increment(1);
  }


  //Increment by function
  function incBy(uint by) public {
    require(by > 0, "incBy: increment should be positive");
    x += by;
    emit Increment(by);
  }


  //Decrement by function
  function decBy(uint by) public {
    require(by > 0, "decBy: decrement should be positive");
    require(by <= x, "Insufficient balance");
    x -= by;
    emit Decrement(by);
  }


  //Pure function to calculate using 2 arguments
  function calculatePercentage(uint amount, uint percentage) public pure returns (uint) {
    return (amount * percentage) / 100;
  }


  //Function to deposit money into the contract
  function deposit() public payable {
    require(msg.value > 0, "Deposit must be more than 0");
    totalDeposits += msg.value;
    deposits[msg.sender] += msg.value;
  }


  //address(this).balance tells the contract's actual ETH balance (totalDeposits might not be the only way the contract get money)


  //Function to get my own deposit stored in the contract
  function getMyDeposits() public view returns (uint) {
    return deposits[msg.sender];
  }


  //Function to withdraw an amount from the contract to your wallet
  function withdraw(uint amount) public {
    require(amount > 0, "Withdraw amount must be more than 0");
    require(amount <= deposits[msg.sender], "Insufficient balance");
    
    deposits[msg.sender] -= amount;
    totalDeposits -= amount;

    (bool success, ) = payable(msg.sender).call{value: amount}("");
    require(success, "ETH transfer failed");

  } 

}
