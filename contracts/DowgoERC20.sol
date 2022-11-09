///SPDX-License-Identifier: Unlicense
pragma solidity 0.8.17;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

contract DowgoERC20 is ERC20, AccessControl {
  using SafeMath for uint256;

  /// USDC token instance
  IERC20 usdcToken;

  //// Total reserve of USDC in the contract
  uint256 public totalUSDCReserve;

  /// USDC Balances of all token owners
  mapping(address => uint256) public usdcUserBalances;

  //// USDC treasury of admin in the contract (coming from fees)
  uint256 public adminTreasury;

  /// Transaction fee - % (out of 10k), every time a user mints/buys dowgo
  uint16 public transactionFee;

  /// Management fee - % (out of 10^9), monthly on the total usdc reserve
  uint32 public managementFee;

  /// Price in USDC/Dowgo - same deciamls as USDC reserve
  uint256 public currentPrice;

  /// Min collateral ratio out of total AUM, is a number out of 10k Example : For 3%, 300
  uint16 public targetRatio;

  /// Collateral range, the % (out of 10k)
  uint16 public collRange;

  /// Create a new role identifier for whitelisted users
  bytes32 public constant WHITELISTED_ROLE = keccak256("WHITELISTED_ROLE");

  /// Events

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
   * @dev Emitted when the admin buys dowgo tokens from the contract at targetRatio of the price
   *
   * Note that `value` may be zero.
   */
  event AdminBuyDowgo(
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
   * @dev Emitted when the admin sells dowgo tokens back to the contract at targetRatio of the price
   *
   * Note that `value` may be zero.
   */
  event AdminSellDowgo(
    address indexed seller,
    uint256 dowgoAmount,
    uint256 usdcAmount
  );

  /**
   * @dev Emitted when a user withdraws their USDC balance from the contract
   *
   * Note that `value` may be zero.
   */
  event WithdrawUSDC(address indexed user, uint256 amount);

  /**
   * @dev Emitted when the admin increases the USDC supply to reflect the stock market's evolution
   *
   * Note that `value` may be zero.
   */
  event USDCSupplyIncreased(address indexed user, uint256 amount);

  /**
   * @dev Emitted when the admin decreases the USDC supply to reflect the stock market's evolution
   *
   * Note that `value` may be zero.
   */
  event USDCSupplyDecreased(address indexed user, uint256 amount);

  /**
   * @dev Emitted when the admin sets the new price for the dowgo token to reflect the stock market's evolution
   */
  event PriceSet(address indexed user, uint256 amount);

  constructor(
    uint256 _initialPrice,
    uint16 _targetRatio,
    uint16 _collRange,
    address _usdcTokenAddress,
    uint16 _transactionFee,
    uint32 _managementFee
  ) ERC20("Dowgo", "DWG") {
    usdcToken = IERC20(_usdcTokenAddress);
    currentPrice = _initialPrice;
    targetRatio = _targetRatio;
    collRange = _collRange;
    transactionFee=_transactionFee;
    managementFee=_managementFee;
    _setupRole(WHITELISTED_ROLE, msg.sender);
    _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
  }

  /// Role Management

  /// Grant a user the role of admin, must be a whitelisted user
  function grant_admin(address newAdmin) public onlyRole(DEFAULT_ADMIN_ROLE) {
    _checkRole(WHITELISTED_ROLE,newAdmin);
    grantRole(DEFAULT_ADMIN_ROLE, newAdmin);
  }

  /// Revoke from a user the role of admin
  function revoke_admin(address banishedAdmin) public onlyRole(DEFAULT_ADMIN_ROLE) {
    revokeRole(DEFAULT_ADMIN_ROLE, banishedAdmin);
  }

  /// Whitelist a user
  function whitelist(address newWhitelistedUser) public onlyRole(DEFAULT_ADMIN_ROLE) {
    grantRole(WHITELISTED_ROLE, newWhitelistedUser);
  }

  /// Remove a user from the whitelist
  /// If it is an admin, their role as an admin must first be revoked
  function revoke_whitelist(address banishedUserFromWhitelist) public onlyRole(DEFAULT_ADMIN_ROLE) {
    require(hasRole(DEFAULT_ADMIN_ROLE, banishedUserFromWhitelist)==false,"User must first be revoked the role of admin");
    revokeRole(WHITELISTED_ROLE, banishedUserFromWhitelist);
  }

  /// Get user USDC Allowance to use this contract
  function get_usdc_allowance() public view returns (uint256) {
    return usdcToken.allowance(msg.sender, address(this));
  }

  /// Buy Dowgo tokens by sending enough USDC : price + transaction fee
  function buy_dowgo(uint256 dowgoAmount) public onlyRole(WHITELISTED_ROLE) returns (bool) {
    /// USDC amount for the desired dowgo amount
    uint256 usdcAmount = dowgoAmount.mul(currentPrice).div(10**18);

    /// USDC fee for the desired dowgo amount
    uint256 usdcFee = usdcAmount.mul(transactionFee).div(10**4);

    /// Check buying dowgo won't let the collateral ratio go above target+collRange
    uint256 targetUSDCCollateral = totalSupply()
      .add(dowgoAmount)
      .mul(currentPrice)
      .mul(targetRatio)
      .div(10**18) /// div for dowgoAmount
      .div(10**4); /// div for targetRatio
    require(
      totalUSDCReserve.add(usdcAmount) <
        targetUSDCCollateral.mul(collRange).div(10**4).add(
          targetUSDCCollateral
        ),
      "Contract already sold all dowgo tokens before next rebalancing"
    );

    /// Check that the user has enough USDC allowance on the contract
    require(
      usdcAmount <= get_usdc_allowance(),
      "Please approve tokens before transferring"
    );

    /// Add USDC to the total reserve
    totalUSDCReserve = totalUSDCReserve.add(usdcAmount);

    /// Add USDC fee to the admin treasury
    adminTreasury = adminTreasury.add(usdcFee);

    /// Interactions
    /// Send USDC to this contract
    bool sent = usdcToken.transferFrom(msg.sender, address(this), usdcAmount.add(usdcFee));
    require(sent, "Failed to transfer USDC from user to dowgo smart contract"); ///TODO: test this with moch usdc

    /// Mint new dowgo tokens
    _mint(msg.sender, dowgoAmount); /// TODO check result?
    emit BuyDowgo(msg.sender, dowgoAmount, usdcAmount);
    return true;
  }

  /// Let Admin buy Dowgo tokens without the collateral limit (because they will trigger the rebalancing)
  /// Only requires targetRatio of real price
  /// NB: this allows the admin to inflate the supply drastically for a <targetRatio> of the price
  /// Price update should be ran before
  
  function admin_buy_dowgo(uint256 dowgoAmount)
    public
    onlyRole(DEFAULT_ADMIN_ROLE)
    returns (bool)
  {
    /// USDC Amount is targetRatio % of real amount because the admin will increase USDC balance (and buy stocks) in FTX directly
    uint256 usdcAmount = dowgoAmount
      .mul(currentPrice)
      .mul(targetRatio)
      .div(10**18) /// div for dowgoAmount
      .div(10**4); /// div for targetRatio

    /// Check that the user has enough USDC allowance on the contract
    require(
      usdcAmount <= get_usdc_allowance(),
      "Please approve tokens before transferring"
    );

    /// Add USDC to the total reserve
    totalUSDCReserve = totalUSDCReserve.add(usdcAmount);

    /// Interactions
    /// Send USDC to this contract
    bool sent = usdcToken.transferFrom(msg.sender, address(this), usdcAmount);
    require(sent, "Failed to transfer USDC from user to dowgo smart contract");

    /// Mint new dowgo tokens
    _mint(msg.sender, dowgoAmount);
    emit AdminBuyDowgo(msg.sender, dowgoAmount, usdcAmount);
    return true;
  }

  /// Sell Dowgo tokens against ETH
  function sell_dowgo(uint256 dowgoAmount) public onlyRole(WHITELISTED_ROLE) returns (bool) {
    uint256 usdcAmount = dowgoAmount.mul(currentPrice).div(10**18);

    /// Check that the user owns enough tokens
    require(balanceOf(msg.sender) >= dowgoAmount, "User doesn't own enough tokens to sell");

    /// Check selling dowgo won't let the collateral ratio go under target minus collRange
    uint256 targetUSDCCollateral = totalSupply()
      .sub(dowgoAmount)
      .mul(currentPrice)
      .mul(targetRatio)
      .div(10**18) /// div for dowgoAmount
      .div(10**4); /// div for targetRatio
    require(
      totalUSDCReserve.sub(usdcAmount) >
        targetUSDCCollateral.sub(
          targetUSDCCollateral.mul(collRange).div(10**4)
        ),
      "Contract already bought all dowgo tokens before next rebalancing"
    );

    ///this should never happen, hence the assert
    assert(totalUSDCReserve >= usdcAmount);

    /// Transfer USDC from the reserve to the user USDC balance
    totalUSDCReserve = totalUSDCReserve.sub(usdcAmount);
    usdcUserBalances[msg.sender] = usdcUserBalances[msg.sender].add(usdcAmount);

    /// Interactions
    _burn(msg.sender, dowgoAmount); /// TODO check result?
    emit SellDowgo(msg.sender, dowgoAmount, usdcAmount);

    return true;
  }

  /// Let Admin sell Dowgo tokens without the collateral limit (because they will trigger the rebalancing)
  /// Only requires targetRatio of real price
  /// NB: this allows the admin to deflate the supply drastically for a <targetRatio> of the price
  /// Price update should be ran before
  function admin_sell_dowgo(uint256 dowgoAmount) public
    onlyRole(DEFAULT_ADMIN_ROLE) returns (bool) {
    /// USDC Amount is targetRatio % of real amount because the admin will sell stocks in FTX directly
    uint256 usdcAmount = dowgoAmount
      .mul(currentPrice)
      .mul(targetRatio)
      .div(10**18) /// div for dowgoAmount
      .div(10**4); /// div for targetRatio


    /// Check that the user owns enough tokens
    require(balanceOf(msg.sender) >= dowgoAmount, "Admin doesn't own enough tokens to sell");

    /// Transfer USDC from the reserve to the user USDC balance
    totalUSDCReserve = totalUSDCReserve.sub(usdcAmount);
    usdcUserBalances[msg.sender] = usdcUserBalances[msg.sender].add(usdcAmount);

    ///interactions
    _burn(msg.sender, dowgoAmount);
    emit AdminSellDowgo(msg.sender, dowgoAmount, usdcAmount);

    return true;
  }

  /// Cash out available USDC balance for a user
  function withdraw_usdc(uint256 usdcAmount) public {
    /// Check that the user owns enough USDC on the smart contract
    require(
      usdcAmount <= usdcUserBalances[msg.sender],
      "User doesn't have that much USDC credit"
    );

    uint256 totalUsdcBalance = usdcToken.balanceOf(address(this));
    assert(usdcAmount <= totalUsdcBalance); ///this shuold never error

    /// Substract User balance
    usdcUserBalances[msg.sender] = usdcUserBalances[msg.sender].sub(usdcAmount);

    ///interactions ///TODO: check return value?
    bool sent = usdcToken.transfer(msg.sender, usdcAmount);
    require(sent, "Failed to withdraw USDC to user"); ///TODO: test this with mock usdc
    emit WithdrawUSDC(msg.sender, usdcAmount);
  }

  /// Increase USDC reserve of the contract
  function increase_usdc_reserve(uint256 usdcAmount)
    public
    onlyRole(DEFAULT_ADMIN_ROLE)
  {
    /// Effect
    /// Add Eth to the total reserve
    totalUSDCReserve = totalUSDCReserve.add(usdcAmount);

    ///Interation
    /// Send USDC to this contract
    usdcToken.transferFrom(msg.sender, address(this), usdcAmount);

    emit USDCSupplyIncreased(msg.sender, usdcAmount);
  }

  /// Decrease USDC reserve of the contract
  function decrease_usdc_reserve(uint256 usdcAmount)
    public
    onlyRole(DEFAULT_ADMIN_ROLE)
  {
    /// Check that this action won't let the collateral drop under target minus collRange
    uint256 targetUSDCCollateral = totalSupply()
      .mul(currentPrice)
      .mul(targetRatio)
      .div(10**18) /// div for dowgoAmount
      .div(10**4); /// div for targetRatio
    require(
      totalUSDCReserve.sub(usdcAmount) >=
        targetUSDCCollateral.sub(
          targetUSDCCollateral.mul(collRange).div(10**4)
        ),
      "Cannot go under min ratio for USDC reserves"
    );

    /// Remove USDC from the total reserve
    totalUSDCReserve = totalUSDCReserve.sub(usdcAmount);
    usdcUserBalances[msg.sender] = usdcUserBalances[msg.sender].add(usdcAmount);

    emit USDCSupplyDecreased(msg.sender, usdcAmount);
  }

  /// Set Price
  function set_current_price(uint256 newPrice)
    public
    onlyRole(DEFAULT_ADMIN_ROLE)
  {
    require(newPrice > 0, "Price must be >0");

    currentPrice = newPrice;
    emit PriceSet(msg.sender, newPrice);
  }
}
