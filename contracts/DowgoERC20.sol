//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
// TODO: lock this

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

contract DWGToken is ERC20 {
    using SafeMath for uint256;

    // + Dowgo Token + // TODO: those are made useless by the use or ERC20

    /// Total supply of Dowgo tokens
    uint256 public totalDowgoSupply;

    // Balances of all owners
    mapping(address => uint256) public memberBalances;

    // + Ethereum +

    /// Total supply of Ethereum in the contract
    uint256 public totalEthSupply;

    // Eth Balances of all token owners
    mapping(address => uint256) public ethUserBalances;

    // Price in wei/Dowgo
    uint256 public currentPrice;

    constructor(uint256 initialSupply) ERC20("Dowgo", "DWG") {
        _mint(msg.sender, initialSupply);
    }

    // Buy Dowgo tokens by sending enough ETH
    function buy_dowgo(uint256 amount) external payable {
        // Check that the user sent enough ETH
        require(msg.value>=amount.mul(currentPrice).div(10**18));

        // Add Eth to the total reserve
        totalEthSupply = totalEthSupply.add(msg.value);

        //interactions
        _mint(msg.sender, amount); // TODO check result?
    }

    // Sell Dowgo tokens against ETH
    function sell_dowgo(uint256 amount) external {
        uint ethAmount=amount.mul(10**18).div(currentPrice);
        // Check that the user owns enough tokens
        require(balanceOf(msg.sender)>=amount);
        //this should never happen, hence the asset
        assert(totalEthSupply>=ethAmount); 

        // Transfer Eth from the reserve to the user eth balance
        totalEthSupply = totalEthSupply.sub(ethAmount);
        ethUserBalances[msg.sender]=ethUserBalances[msg.sender].add(ethAmount);

        //interactions
        _burn(msg.sender, amount); // TODO check result?
    }

    // Cash out available eth balance for a user
    function cash_out_eth(uint256 ethAmount) external payable {
        // Check that the user owns enough eth on the smart contract
        require(ethAmount<=ethUserBalances[msg.sender]);

        // Substract User balance
        ethUserBalances[msg.sender]=ethUserBalances[msg.sender].sub(ethAmount);

        //interactions
        (bool sent, bytes memory data) = msg.sender.call{value: ethAmount}("");
        require(sent, "Failed to cash out Ether");
    }
}