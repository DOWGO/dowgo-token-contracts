//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
// TODO: lock this

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

import "hardhat/console.sol"; //TODO: get rid of this in prod

contract DowgoERC20 is ERC20, AccessControl {
  using SafeMath for uint256;

  // + Ethereum +

  /// Total supply of Ethereum in the contract
  uint256 public totalEthSupply;

  // Eth Balances of all token owners
  mapping(address => uint256) public ethUserBalances;

  // Price in wei/Dowgo
  uint256 public currentPrice; //TODO: reduce int range?

  // Min collateral ratio out of 10000
  uint256 public minRatio; //TODO: reduce int range?

  // Events

  //TODO: event descriptions
  /**
   * @dev Emitted when a user buys dowgo tokens from the contract
   *
   * Note that `value` may be zero.
   */
  event BuyDowgo(address indexed buyer, uint256 amount);

  /**
   * @dev Emitted when a user sells dowgo tokens back to the contract
   *
   * Note that `value` may be zero.
   */
  event SellDowgo(address indexed seller, uint256 amount);

  /**
   * @dev Emitted when a user withdraws their eth balance from the contract
   *
   * Note that `value` may be zero.
   */
  event WithdrawEth(address indexed user, uint256 amount);

  /**
   * @dev Emitted when a user withdraws their eth balance from the contract
   *
   * Note that `value` may be zero.
   */
  event EthSupplyIncreased(address indexed user, uint256 amount);

  /**
   * @dev Emitted when a user withdraws their eth balance from the contract
   *
   * Note that `value` may be zero.
   */
  event EthSupplyDecreased(address indexed user, uint256 amount);

  /**
   * @dev Emitted when a user withdraws their eth balance from the contract
   */
  event PriceSet(address indexed user, uint256 amount);

  constructor(uint256 _initialPrice, uint256 _minRatio) ERC20("Dowgo", "DWG") {
    currentPrice = _initialPrice;
    minRatio = _minRatio;
    _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
  }

  // Grant a user the role of admin //TODO: remove admin?
  function grant_admin(address newAdmin) public onlyRole(DEFAULT_ADMIN_ROLE) {
    grantRole(DEFAULT_ADMIN_ROLE, newAdmin);
  }

  // Buy Dowgo tokens by sending enough ETH // TODO: allow zero tsf?
  function buy_dowgo(uint256 dowgoAmount) external payable {
    // Check that the user sent enough ETH
    require(msg.value >= dowgoAmount.mul(currentPrice).div(10**18));

    // Add Eth to the total reserve
    totalEthSupply = totalEthSupply.add(msg.value); // TODO check balance dif?

    //interactions
    _mint(msg.sender, dowgoAmount); // TODO check result?
    emit BuyDowgo(msg.sender, dowgoAmount);
  }

  // Sell Dowgo tokens against ETH
  function sell_dowgo(uint256 dowgoAmount) external {
    uint256 ethAmount = dowgoAmount.mul(currentPrice).div(10**18);
    // Check that the user owns enough tokens
    require(balanceOf(msg.sender) >= dowgoAmount);
    //this should never happen, hence the asset
    assert(totalEthSupply >= ethAmount);

    // Transfer Eth from the reserve to the user eth balance
    totalEthSupply = totalEthSupply.sub(ethAmount);
    ethUserBalances[msg.sender] = ethUserBalances[msg.sender].add(ethAmount);

    //interactions
    _burn(msg.sender, dowgoAmount); // TODO check result?
    emit SellDowgo(msg.sender, dowgoAmount);
  }

  // Cash out available eth balance for a user
  function withdraw_eth(uint256 ethAmount) external payable {
    // Check that the user owns enough eth on the smart contract
    require(ethAmount <= ethUserBalances[msg.sender]);

    // Substract User balance
    ethUserBalances[msg.sender] = ethUserBalances[msg.sender].sub(ethAmount);

    //interactions
    (bool sent, ) = msg.sender.call{value: ethAmount}("");
    require(sent, "Failed to cash out Ether ");
    emit WithdrawEth(msg.sender, ethAmount);
  }

  // Increase Eth reserve of the contract
  function increase_eth_supply() external payable onlyRole(DEFAULT_ADMIN_ROLE) {
    // Add Eth to the total reserve
    totalEthSupply = totalEthSupply.add(msg.value); // TODO check balance dif?
    emit EthSupplyIncreased(msg.sender, msg.value);
  }

  // Increase Eth reserve of the contract
  function decrease_eth_supply(uint256 ethAmount)
    external
    onlyRole(DEFAULT_ADMIN_ROLE)
  {
    // Check that this action won't let the collateral drop under the minimum ratio
    require(
      totalEthSupply.sub(ethAmount) >=
        totalSupply().mul(currentPrice).div(10**18).mul(minRatio).div(10**4),
      "Cannot go under min ratio for eth reserves"
    );

    // Remove Eth from the total reserve
    totalEthSupply = totalEthSupply.sub(ethAmount); // TODO check balance dif?
    ethUserBalances[msg.sender] = ethUserBalances[msg.sender].add(ethAmount);

    emit EthSupplyDecreased(msg.sender, ethAmount);
  }

  // Set Price
  function set_current_price(uint256 newPrice)
    external
    onlyRole(DEFAULT_ADMIN_ROLE)
  {
    require(newPrice > 0, "Price must be >0");

    currentPrice = newPrice;
    emit PriceSet(msg.sender, newPrice);
  }
}
