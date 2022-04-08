//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
// TODO: lock this

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

import "hardhat/console.sol"; //TODO: get rid of this in prod

contract DowgoERC20 is ERC20 {
    using SafeMath for uint256;

    // + Dowgo Token + // TODO: those are made useless by the use or ERC20

    /// Total supply of Dowgo tokens
    // uint256 public totalDowgoSupply;

    // // Balances of all owners
    // mapping(address => uint256) public memberBalances;

    // + Ethereum +

    /// Total supply of Ethereum in the contract
    uint256 public totalEthSupply;

    // Eth Balances of all token owners
    mapping(address => uint256) public ethUserBalances;

    // Price in wei/Dowgo
    uint256 public currentPrice;

    constructor(uint256 initialSupply,uint256 initialPrice) ERC20("Dowgo", "DWG") {
        currentPrice=initialPrice;
        _mint(msg.sender, initialSupply);
    }

    // Buy Dowgo tokens by sending enough ETH
    function buy_dowgo(uint256 dowgoAmount) external payable {
        // Check that the user sent enough ETH
        require(msg.value>=dowgoAmount.mul(currentPrice).div(10**18));

        // Add Eth to the total reserve
        totalEthSupply = totalEthSupply.add(msg.value); // TODO check balance dif?

        //interactions
        _mint(msg.sender, dowgoAmount); // TODO check result?
    }

    // Sell Dowgo tokens against ETH
    function sell_dowgo(uint256 dowgoAmount) external {
        uint ethAmount=dowgoAmount.mul(currentPrice).div(10**18);
        // Check that the user owns enough tokens
        require(balanceOf(msg.sender)>=dowgoAmount);
        //this should never happen, hence the asset
        assert(totalEthSupply>=ethAmount); 

        // Transfer Eth from the reserve to the user eth balance
        totalEthSupply = totalEthSupply.sub(ethAmount);
        ethUserBalances[msg.sender]=ethUserBalances[msg.sender].add(ethAmount);

        //interactions
        _burn(msg.sender, dowgoAmount); // TODO check result?
    }

    // Cash out available eth balance for a user
    function withdraw_eth(uint256 ethAmount) external payable {
        // Check that the user owns enough eth on the smart contract
        require(ethAmount<=ethUserBalances[msg.sender]);

        // Substract User balance
        ethUserBalances[msg.sender]=ethUserBalances[msg.sender].sub(ethAmount);

        //interactions
        (bool sent,) = msg.sender.call{value: ethAmount}("");
        require(sent, "Failed to cash out Ether ");
    }
}