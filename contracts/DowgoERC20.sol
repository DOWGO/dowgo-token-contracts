//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
// TODO: lock this

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

import "hardhat/console.sol"; //TODO: get rid of this in prod

contract DowgoERC20 is ERC20, AccessControl {
  using SafeMath for uint256;

  // + USDC +

  // USDC token instance
  IERC20 usdcToken;

  /// Total supply of Ethereum in the contract
  uint256 public totalUSDCSupply;

  // Eth Balances of all token owners
  mapping(address => uint256) public usdcUserBalances;

  // Price in USDC-wei/Dowgo
  uint256 public currentPrice; //TODO: reduce int range?

  // Min collateral ratio out of total AUM. Should be 3%, is a number out of 10k (so 300 for 3%)
  uint256 public targetRatio; //TODO: reduce int range?

  // collateral range, the % (out of 10k) around which the ratio can vary
  uint256 public collRange; //TODO: reduce int range?

  // Events

  //TODO: event descriptions
  /**
   * @dev Emitted when a user buys dowgo tokens from the contract
   *
   * Note that `value` may be zero.
   */
  event BuyDowgo(
    address indexed buyer,
    uint256 dowgoAmount,
    uint256 usdcAmount
  );

  /**
   * @dev Emitted when a user sells dowgo tokens back to the contract
   *
   * Note that `value` may be zero.
   */
  event SellDowgo(
    address indexed seller,
    uint256 dowgoAmount,
    uint256 usdcAmount
  );

  /**
   * @dev Emitted when a user withdraws their eth balance from the contract
   *
   * Note that `value` may be zero.
   */
  event WithdrawUSDC(address indexed user, uint256 amount);

  /**
   * @dev Emitted when a user withdraws their eth balance from the contract
   *
   * Note that `value` may be zero.
   */
  event USDCSupplyIncreased(address indexed user, uint256 amount);

  /**
   * @dev Emitted when a user withdraws their eth balance from the contract
   *
   * Note that `value` may be zero.
   */
  event USDCSupplyDecreased(address indexed user, uint256 amount);

  /**
   * @dev Emitted when a user withdraws their eth balance from the contract
   */
  event PriceSet(address indexed user, uint256 amount);

  constructor(
    uint256 _initialPrice,
    uint256 _targetRatio,
    uint256 _collRange,
    address usdcTokenAddress
  ) ERC20("Dowgo", "DWG") {
    usdcToken = IERC20(usdcTokenAddress);
    currentPrice = _initialPrice;
    targetRatio = _targetRatio;
    collRange = _collRange;
    _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
  }

  // Grant a user the role of admin //TODO: remove admin?
  function grant_admin(address newAdmin) public onlyRole(DEFAULT_ADMIN_ROLE) {
    grantRole(DEFAULT_ADMIN_ROLE, newAdmin);
  }

  // Get user USDC Allowance to use this contract
  function get_usdc_allowance() public view returns (uint256) {
    return usdcToken.allowance(msg.sender, address(this));
  }

  // Buy Dowgo tokens by sending enough USDC // TODO: allow zero tsf? Put usdc amoutn in input?
  function buy_dowgo(uint256 dowgoAmount) public returns (bool) {
    // usdc amount for the desired dowgo amount
    uint256 usdcAmount = dowgoAmount.mul(currentPrice).div(10**18);

    // Check buying dowgo won't let the collateral ratio go above target+collRange
    uint256 targetUSDCCollateral = totalSupply()
      .add(dowgoAmount)
      .mul(currentPrice)
      .div(10**18)
      .mul(targetRatio)
      .div(10**4);
    require(
      totalUSDCSupply.add(usdcAmount) <
        targetUSDCCollateral.mul(collRange).div(10**4).add(
          targetUSDCCollateral
        ),
      "Contract already sold all dowgo tokens before next rebalancing"
    );

    // Check that the user has enough USDC allowance on the contract
    require(
      usdcAmount <= get_usdc_allowance(),
      "Please approve tokens before transferring"
    );

    // Add USDC to the total reserve
    totalUSDCSupply = totalUSDCSupply.add(usdcAmount); // TODO check balance dif?

    // Interactions
    // Send USDC to this contract
    bool sent = usdcToken.transferFrom(msg.sender, address(this), usdcAmount);
    require(sent, "Failed to transfer usdc from user to dowgo smart contract"); //TODO: test this with moch usdc

    // Mint new dowgo tokens
    _mint(msg.sender, dowgoAmount); // TODO check result?
    emit BuyDowgo(msg.sender, dowgoAmount, usdcAmount);
    return true;
  }

  // Let Admin buy Dowgo tokens without the collateral limit (because they will trigger the rebalancing)
  // Only requires targetRatio= 3% of real price
  // NB: this allows the admin to inflate the supply drastically, but so would setgin the price very low //TODO: think about hose attack vectors
  function admin_buy_dowgo(uint256 dowgoAmount)
    public
    onlyRole(DEFAULT_ADMIN_ROLE)
    returns (bool)
  {
    uint256 usdcAmount = dowgoAmount
      .mul(currentPrice)
      .div(10**18)
      .mul(targetRatio)
      .div(10**4);
    // Check that the user has enough USDC allowance on the contract
    require(
      usdcAmount <= get_usdc_allowance(),
      "Please approve tokens before transferring"
    );

    // Add USDC to the total reserve
    totalUSDCSupply = totalUSDCSupply.add(usdcAmount); // TODO check balance dif?

    // Interactions
    // Send USDC to this contract
    bool sent = usdcToken.transferFrom(msg.sender, address(this), usdcAmount);
    require(sent, "Failed to transfer usdc from user to dowgo smart contract"); //TODO: test this with moch usdc

    // Mint new dowgo tokens
    _mint(msg.sender, dowgoAmount); // TODO check result?
    emit BuyDowgo(msg.sender, dowgoAmount, usdcAmount);
    return true;
  }

  // Sell Dowgo tokens against ETH // TODO check non-zero
  function sell_dowgo(uint256 dowgoAmount) external {
    uint256 usdcAmount = dowgoAmount.mul(currentPrice).div(10**18);
    // Check that the user owns enough tokens
    require(balanceOf(msg.sender) >= dowgoAmount);
    // Check selling dowgo won't let the collateral ratio go under target minus collRange
    uint256 targetUSDCCollateral = totalSupply()
      .sub(dowgoAmount)
      .mul(currentPrice)
      .div(10**18)
      .mul(targetRatio)
      .div(10**4);
    require(
      totalUSDCSupply.sub(usdcAmount) >
        targetUSDCCollateral.sub(
          targetUSDCCollateral.mul(collRange).div(10**4)
        ),
      "Contract already bought all dowgo tokens before next rebalancing"
    );
    //this should never happen, hence the assert
    assert(totalUSDCSupply >= usdcAmount);

    // Transfer Eth from the reserve to the user eth balance
    totalUSDCSupply = totalUSDCSupply.sub(usdcAmount);
    usdcUserBalances[msg.sender] = usdcUserBalances[msg.sender].add(usdcAmount);

    //interactions
    _burn(msg.sender, dowgoAmount); // TODO check result?
    emit SellDowgo(msg.sender, dowgoAmount, usdcAmount);
  }

  // Cash out available eth balance for a user
  function withdraw_usdc(uint256 usdcAmount) public {
    // Check that the user owns enough eth on the smart contract
    require(
      usdcAmount <= usdcUserBalances[msg.sender],
      "User doesn't have that much usdc credit"
    );

    uint256 totalUsdcBalance = usdcToken.balanceOf(address(this));
    assert(usdcAmount <= totalUsdcBalance); //this shuold never error

    // Substract User balance
    usdcUserBalances[msg.sender] = usdcUserBalances[msg.sender].sub(usdcAmount);

    //interactions //TODO: check return value?
    bool sent = usdcToken.transfer(msg.sender, usdcAmount);
    require(sent, "Failed to usdc token to user"); //TODO: test this
    emit WithdrawUSDC(msg.sender, usdcAmount);
  }

  // Increase USDC reserve of the contract
  function increase_usdc_supply(uint256 usdcAmount)
    public
    onlyRole(DEFAULT_ADMIN_ROLE)
  {
    // Effect
    // Add Eth to the total reserve
    totalUSDCSupply = totalUSDCSupply.add(usdcAmount); // TODO check balance dif?

    //Interation
    // Send USDC to this contract
    usdcToken.transferFrom(msg.sender, address(this), usdcAmount);

    emit USDCSupplyIncreased(msg.sender, usdcAmount);
  }

  // Increase USDC reserve of the contract
  function decrease_usdc_supply(uint256 usdcAmount)
    public
    onlyRole(DEFAULT_ADMIN_ROLE)
  {
    // Check that this action won't let the collateral drop under target minus collRange
    uint256 targetUSDCCollateral = totalSupply()
      .mul(currentPrice)
      .div(10**18)
      .mul(targetRatio)
      .div(10**4);
    require(
      totalUSDCSupply.sub(usdcAmount) >=
        targetUSDCCollateral.sub(
          targetUSDCCollateral.mul(collRange).div(10**4)
        ),
      "Cannot go under min ratio for eth reserves"
    );

    // Remove Eth from the total reserve
    totalUSDCSupply = totalUSDCSupply.sub(usdcAmount); // TODO check balance dif?
    usdcUserBalances[msg.sender] = usdcUserBalances[msg.sender].add(usdcAmount);

    emit USDCSupplyDecreased(msg.sender, usdcAmount);
  }

  // Set Price
  function set_current_price(uint256 newPrice)
    public
    onlyRole(DEFAULT_ADMIN_ROLE)
  {
    require(newPrice > 0, "Price must be >0");

    currentPrice = newPrice;
    emit PriceSet(msg.sender, newPrice);
  }
}
