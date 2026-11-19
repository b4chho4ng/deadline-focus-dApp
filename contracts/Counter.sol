// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

contract Counter {
  uint public x;
  uint public totalDeposits;

  mapping(address => uint) public deposits;

  event Increment(uint by);
  event Decrement(uint by);

  function inc() public {
    x++;
    emit Increment(1);
  }

  function incBy(uint by) public {
    require(by > 0, "incBy: increment should be positive");
    x += by;
    emit Increment(by);
  }

  function decBy(uint by) public {
    require(by > 0, "decBy: decrement should be positive");
    require(by <= x, "Insufficient balance");
    x -= by;
    emit Decrement(by);
  }

  function calculatePercentage(uint amount, uint percentage) public pure returns (uint) {
    return (amount * percentage) / 100;
  }

  function deposit() public payable {
    require(msg.value > 0, "Deposit must be more than 0");
    totalDeposits += msg.value;
    deposits[msg.sender] += msg.value;
  }

  function getMyDeposits() public view returns (uint) {
    return deposits[msg.sender];
  }

  function withdraw(uint amount) public {
    require(amount > 0, "Withdraw amount must be more than 0");
    require(amount <= deposits[msg.sender], "Insufficient balance");
    
    deposits[msg.sender] -= amount;
    totalDeposits -= amount;

    (bool success, ) = payable(msg.sender).call{value: amount}("");
    require(success, "ETH transfer failed");

  } 

}
