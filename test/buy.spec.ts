import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { DowgoERC20, ERC20 } from "../typechain";
import {
  initialDowgoSupply,
  initialUSDCReserve,
  initialUser1USDCBalance,
  initRatio,
  ONE_DOWGO_UNIT,
  initialPrice,
  transactionFee,
  WHITELISTED_ROLE,
  mockUSDCSupply,
  lowInitialPrice,
  lowInitialUSDCReserve,
  lowInitialUser1USDCBalance,
  lowMockUSDCSupply,
  lowInitialDowgoSupply,
  ONE_USDC_UNIT,
} from "./test-constants";
import { approveAndSendUSDC, approveTransfer, setupTestEnvDowgoERC20 } from "./testUtils";

describe("DowgoERC20 - buy", function () {
  let dowgoERC20: DowgoERC20;
  let usdcERC20: ERC20;
  let dowgoAdmin: SignerWithAddress;
  let usdcCreator: SignerWithAddress;
  let addr1: SignerWithAddress;
  let addr2: SignerWithAddress;
  let addr3: SignerWithAddress;
  const BUY_AMOUNT = ONE_DOWGO_UNIT;
  // Cost of buying dowgo with fee
  const USDC_COST_NO_FEE = BUY_AMOUNT.mul(initialPrice).div(ONE_DOWGO_UNIT);
  const USDC_FEE = USDC_COST_NO_FEE.mul(transactionFee).div(10000);
  const TOTAL_USDC_COST = USDC_COST_NO_FEE.add(USDC_FEE);

  beforeEach(async () => {
    ({ dowgoERC20, addr1, addr2, addr3, usdcERC20, dowgoAdmin, usdcCreator } =
      await setupTestEnvDowgoERC20({
        initialPrice,
        initialUSDCReserve,
        initialUser1USDCBalance,
        mockUSDCSupply,
        initialDowgoSupply,
      }));
  });
  it("Should let first address buy dowgo token against usdc", async function () {
    // Approve erc20 transfer
    await approveTransfer(usdcERC20, addr1, dowgoERC20.address, TOTAL_USDC_COST);

    // Create buy tx
    const buyTx = await dowgoERC20.connect(addr1).buy_dowgo(BUY_AMOUNT);

    // wait until the transaction is mined
    await buyTx.wait();

    // check for user 1 dowgo balabnce
    expect(await dowgoERC20.balanceOf(addr1.address)).to.equal(BUY_AMOUNT);

    // check for totalSupply
    expect(await dowgoERC20.totalSupply()).to.equal(BUY_AMOUNT.add(initialDowgoSupply));

    // check that user 1 owns 100-2=98 USDC
    expect(await usdcERC20.balanceOf(addr1.address)).to.equal(
      initialUser1USDCBalance.sub(TOTAL_USDC_COST)
    );

    // check that contract owns 60+2USDC
    expect(await usdcERC20.balanceOf(dowgoERC20.address)).to.equal(
      TOTAL_USDC_COST.add(initialUSDCReserve)
    );
    expect(await dowgoERC20.totalUSDCReserve()).to.equal(USDC_COST_NO_FEE.add(initialUSDCReserve));
    expect(await dowgoERC20.adminTreasury()).to.equal(USDC_FEE);

    // check for Buy Event
    const eventFilter2 = dowgoERC20.filters.BuyDowgo(addr1.address);
    let events2 = await dowgoERC20.queryFilter(eventFilter2);
    expect(events2[0] && events2[0].args[1] && events2[0].args[1]).to.equal(BUY_AMOUNT);
  });
  it("Should let first address buy dowgo token against usdc INFINITE ALLOWANCE", async function () {
    const INFINITE_ALLOWANCE = "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
    // Approve erc20 transfer
    await approveTransfer(usdcERC20, addr1, dowgoERC20.address, BigNumber.from(INFINITE_ALLOWANCE));

    // Create buy tx
    const buyTx = await dowgoERC20.connect(addr1).buy_dowgo(BUY_AMOUNT);

    // wait until the transaction is mined
    await buyTx.wait();

    // check for user 1 dowgo balabnce
    expect(await dowgoERC20.balanceOf(addr1.address)).to.equal(BUY_AMOUNT);

    // check for totalSupply
    expect(await dowgoERC20.totalSupply()).to.equal(BUY_AMOUNT.add(initialDowgoSupply));

    // check that user 1 owns 100-2=98 USDC
    expect(await usdcERC20.balanceOf(addr1.address)).to.equal(
      initialUser1USDCBalance.sub(TOTAL_USDC_COST)
    );

    // check that contract owns 60+2USDC
    expect(await usdcERC20.balanceOf(dowgoERC20.address)).to.equal(
      TOTAL_USDC_COST.add(initialUSDCReserve)
    );
    expect(await dowgoERC20.totalUSDCReserve()).to.equal(USDC_COST_NO_FEE.add(initialUSDCReserve));
    expect(await dowgoERC20.adminTreasury()).to.equal(USDC_FEE);

    // check for Buy Event
    const eventFilter2 = dowgoERC20.filters.BuyDowgo(addr1.address);
    let events2 = await dowgoERC20.queryFilter(eventFilter2);
    expect(events2[0] && events2[0].args[1] && events2[0].args[1]).to.equal(BUY_AMOUNT);
  });
  it("Should not let user 2 who owns no USDC to buy dowgo", async function () {
    try {
      // Approve erc20 transfer
      await approveTransfer(usdcERC20, addr2, dowgoERC20.address, TOTAL_USDC_COST);

      // Create buy tx
      const buyTx = await dowgoERC20.connect(addr2).buy_dowgo(BUY_AMOUNT);

      // wait until the transaction is mined
      await buyTx.wait();
    } catch (e: any) {
      expect(e.toString()).to.equal(
        `Error: VM Exception while processing transaction: reverted with reason string 'ERC20: transfer amount exceeds balance'`
      );
    }
    // check for user 2 dowgo balabnce
    expect(await dowgoERC20.balanceOf(addr2.address)).to.equal(BigNumber.from(0));

    // Check that USDC haven't been sent
    expect(await dowgoERC20.totalUSDCReserve()).to.equal(initialUSDCReserve);
    expect(await dowgoERC20.adminTreasury()).to.equal(BigNumber.from(0));

    // check for PriceSet Event not fired
    const eventFilter = dowgoERC20.filters.BuyDowgo(addr1.address);
    let events = await dowgoERC20.queryFilter(eventFilter);
    expect(events.length === 0).to.be.true;
  });
  it("Should not let user 3 - who isn't whitelisted - buy dowgo", async function () {
    try {
      // Approve erc20 transfer
      await approveTransfer(usdcERC20, addr3, dowgoERC20.address, TOTAL_USDC_COST);

      // Create buy tx
      const buyTx = await dowgoERC20.connect(addr3).buy_dowgo(BUY_AMOUNT);

      // wait until the transaction is mined
      await buyTx.wait();
    } catch (e: any) {
      expect(e.toString()).to.equal(
        `Error: VM Exception while processing transaction: reverted with reason string 'AccessControl: account ${addr3.address.toLowerCase()} is missing role ${WHITELISTED_ROLE}'`
      );
    }
    // check for user 3 dowgo balabnce
    expect(await dowgoERC20.balanceOf(addr3.address)).to.equal(BigNumber.from(0));

    // Check that USDC supply hasn't changed
    expect(await dowgoERC20.totalUSDCReserve()).to.equal(initialUSDCReserve);
    expect(await dowgoERC20.adminTreasury()).to.equal(BigNumber.from(0));

    // check for BuyDowgo Event not fired
    const eventFilter = dowgoERC20.filters.BuyDowgo(addr1.address);
    let events = await dowgoERC20.queryFilter(eventFilter);
    expect(events.length === 0).to.be.true;
  });
  it("Should not let user 1 buy too much tokens (more than 3%*10%=0.3% of total supply =3DWG)", async function () {
    const {
      dowgoERC20: lowdDowgoERC20,
      addr1: lowAddr1,
      usdcERC20: lowUSDCERC20,
    } = await setupTestEnvDowgoERC20({
      initialPrice: lowInitialPrice,
      initialUSDCReserve: lowInitialUSDCReserve,
      initialUser1USDCBalance: lowInitialUser1USDCBalance,
      mockUSDCSupply: lowMockUSDCSupply,
      initialDowgoSupply: lowInitialDowgoSupply,
    });

    const BUY_AMOUNT_TOO_HIGH = BUY_AMOUNT.mul(4);

    // Cost of buying dowgo with fee
    const USDC_COST_NO_FEE_TOO_HIGH = BUY_AMOUNT_TOO_HIGH.mul(lowInitialPrice).div(ONE_DOWGO_UNIT);
    const USDC_FEE_TOO_HIGH = USDC_COST_NO_FEE_TOO_HIGH.mul(transactionFee).div(10000);
    const TOTAL_USDC_COST_TOO_HIGH = USDC_COST_NO_FEE_TOO_HIGH.add(USDC_FEE_TOO_HIGH);

    try {
      // Approve erc20 transfer
      await approveTransfer(
        lowUSDCERC20,
        lowAddr1,
        lowdDowgoERC20.address,
        TOTAL_USDC_COST_TOO_HIGH
      );

      // Create buy tx
      const buyTx = await lowdDowgoERC20.connect(lowAddr1).buy_dowgo(BUY_AMOUNT_TOO_HIGH);

      // wait until the transaction is mined
      await buyTx.wait();
    } catch (e: any) {
      expect(e.toString()).to.equal(
        `Error: VM Exception while processing transaction: reverted with reason string 'Contract already sold all dowgo tokens before next rebalancing'`
      );
    }

    // check for user 1 dowgo balabnce
    expect(await lowdDowgoERC20.balanceOf(addr2.address)).to.equal(BigNumber.from(0));

    // Check that supply of both USDC and Dowgo hasnt been changed
    expect(await lowdDowgoERC20.totalUSDCReserve()).to.equal(lowInitialUSDCReserve);
    expect(await lowdDowgoERC20.totalSupply()).to.equal(lowInitialDowgoSupply);
    expect(await lowdDowgoERC20.adminTreasury()).to.equal(BigNumber.from(0));

    // check for BuyDowgo Event not fired
    const eventFilter = lowdDowgoERC20.filters.BuyDowgo(lowAddr1.address);
    let events = await lowdDowgoERC20.queryFilter(eventFilter);
    expect(events.length === 0).to.be.true;
  });
  it("Should not let user 1 buy too much tokens (more than 10k USD worth)", async function () {
    // This is worth 200*51= 10,200 USD
    const BUY_AMOUNT_TOO_HIGH = BUY_AMOUNT.mul(51);

    // Cost of buying dowgo with fee
    const USDC_COST_NO_FEE_TOO_HIGH = BUY_AMOUNT_TOO_HIGH.mul(initialPrice).div(ONE_DOWGO_UNIT);
    const USDC_FEE_TOO_HIGH = USDC_COST_NO_FEE_TOO_HIGH.mul(transactionFee).div(10000);
    const TOTAL_USDC_COST_TOO_HIGH = USDC_COST_NO_FEE_TOO_HIGH.add(USDC_FEE_TOO_HIGH);

    try {
      // Approve erc20 transfer
      await approveTransfer(usdcERC20, addr1, dowgoERC20.address, TOTAL_USDC_COST_TOO_HIGH);

      // Create buy tx
      const buyTx = await dowgoERC20.connect(addr1).buy_dowgo(BUY_AMOUNT_TOO_HIGH);

      // wait until the transaction is mined
      await buyTx.wait();
    } catch (e: any) {
      expect(e.toString()).to.equal(
        `Error: VM Exception while processing transaction: reverted with reason string 'User can't go above USD 10k limit'`
      );
    }

    // check for user 1 dowgo balabnce
    expect(await dowgoERC20.balanceOf(addr2.address)).to.equal(BigNumber.from(0));

    // Check that supply of both USDC and Dowgo hasnt been changed
    expect(await dowgoERC20.totalUSDCReserve()).to.equal(initialUSDCReserve);
    expect(await dowgoERC20.totalSupply()).to.equal(initialDowgoSupply);
    expect(await dowgoERC20.adminTreasury()).to.equal(BigNumber.from(0));

    // check for BuyDowgo Event not fired
    const eventFilter = dowgoERC20.filters.BuyDowgo(addr1.address);
    let events = await dowgoERC20.queryFilter(eventFilter);
    expect(events.length === 0).to.be.true;
  });
  it("Should not let admin admin_buy too much tokens (more than 8M worth)", async function () {
    // The initial minted amount is 2M usd. So minting 7M usd worth,
    // meaning 7M/200=35k dwg should throw an error
    const BUY_AMOUNT_ABOVE_LIMIT = BigNumber.from(35 * 1000).mul(ONE_DOWGO_UNIT);

    // Cost of buying dowgo with fee
    const USDC_COST_NO_FEE_TOO_HIGH = BUY_AMOUNT_ABOVE_LIMIT.mul(initialPrice).div(ONE_DOWGO_UNIT);
    const USDC_FEE_TOO_HIGH = USDC_COST_NO_FEE_TOO_HIGH.mul(transactionFee).div(10000);
    const TOTAL_USDC_COST_TOO_HIGH = USDC_COST_NO_FEE_TOO_HIGH.add(USDC_FEE_TOO_HIGH);

    try {
      // Send 7M usd to admin
      await approveAndSendUSDC(
        usdcERC20,
        usdcCreator,
        dowgoAdmin.address,
        TOTAL_USDC_COST_TOO_HIGH
      );
      // Approve erc20 transfer
      await approveTransfer(usdcERC20, dowgoAdmin, dowgoERC20.address, TOTAL_USDC_COST_TOO_HIGH);

      // Create buy tx
      const buyTx = await dowgoERC20.connect(dowgoAdmin).admin_buy_dowgo(BUY_AMOUNT_ABOVE_LIMIT);

      // wait until the transaction is mined
      await buyTx.wait();
    } catch (e: any) {
      expect(e.toString()).to.equal(
        `Error: VM Exception while processing transaction: reverted with reason string 'Dowgo Supply shouldn't go above the 8M usd limit'`
      );
    }

    // check for user 1 dowgo balabnce
    expect(await dowgoERC20.balanceOf(addr2.address)).to.equal(BigNumber.from(0));

    // Check that supply of both USDC and Dowgo hasnt been changed
    expect(await dowgoERC20.totalUSDCReserve()).to.equal(initialUSDCReserve);
    expect(await dowgoERC20.totalSupply()).to.equal(initialDowgoSupply);
    expect(await dowgoERC20.adminTreasury()).to.equal(BigNumber.from(0));

    // check for BuyDowgo Event not fired
    const eventFilter = dowgoERC20.filters.BuyDowgo(addr1.address);
    let events = await dowgoERC20.queryFilter(eventFilter);
    expect(events.length === 0).to.be.true;
  });
  it("Should not let addr1 buy too much tokens (more than 8M worth)", async function () {
    const ADMIN_BUY = BigNumber.from(29995).mul(ONE_DOWGO_UNIT);
    const ADMIN_BUY_USD = ADMIN_BUY.mul(initialPrice).div(ONE_DOWGO_UNIT);
    const BUY_AMOUNT_ABOVE_LIMIT = BigNumber.from(6).mul(ONE_DOWGO_UNIT);

    // Cost of buying dowgo with fee
    const USDC_COST_NO_FEE_TOO_HIGH = BUY_AMOUNT_ABOVE_LIMIT.mul(initialPrice).div(ONE_DOWGO_UNIT);
    const USDC_FEE_TOO_HIGH = USDC_COST_NO_FEE_TOO_HIGH.mul(transactionFee).div(10000);
    const TOTAL_USDC_COST_TOO_HIGH = USDC_COST_NO_FEE_TOO_HIGH.add(USDC_FEE_TOO_HIGH);

    // Send 7M usd to admin
    await approveAndSendUSDC(usdcERC20, usdcCreator, dowgoAdmin.address, ADMIN_BUY_USD);
    // Approve erc20 transfer
    await approveTransfer(usdcERC20, dowgoAdmin, dowgoERC20.address, ADMIN_BUY_USD);

    // first admin_buy enough to bring it to 7.999 M usd, (7.999-2)/200= 29995 dwg
    const buyAdminTx = await dowgoERC20.connect(dowgoAdmin).admin_buy_dowgo(ADMIN_BUY);
    await buyAdminTx.wait();

    try {
      // Approve erc20 transfer
      await approveTransfer(usdcERC20, addr1, dowgoERC20.address, TOTAL_USDC_COST_TOO_HIGH);

      // Then buy 1200 usd worth of dwg: 6 dwg
      // Create buy tx
      const buyTx = await dowgoERC20.connect(addr1).buy_dowgo(BUY_AMOUNT_ABOVE_LIMIT);

      // wait until the transaction is mined
      await buyTx.wait();
    } catch (e: any) {
      expect(e.toString()).to.equal(
        `Error: VM Exception while processing transaction: reverted with reason string 'Dowgo Supply shouldn't go above the 8M usd limit'`
      );
    }

    // check for user 1 dowgo balabnce
    expect(await dowgoERC20.balanceOf(addr1.address)).to.equal(BigNumber.from(0));

    // Check that supply of both USDC and Dowgo hasnt been changed
    expect(await dowgoERC20.totalSupply()).to.equal(initialDowgoSupply.add(ADMIN_BUY));
    expect(await dowgoERC20.adminTreasury()).to.equal(BigNumber.from(0));

    // check for BuyDowgo Event not fired
    const eventFilter = dowgoERC20.filters.BuyDowgo(addr1.address);
    let events = await dowgoERC20.queryFilter(eventFilter);
    expect(events.length === 0).to.be.true;
  });
  it("Should let admin buy too much tokens (more than 3%*10%=0.3% of total supply =3DWG) using admin_buy", async function () {
    let initialAdminUSDCBalance = await usdcERC20.balanceOf(dowgoAdmin.address);
    const BUY_AMOUNT_TOO_HIGH = initialDowgoSupply;

    // Approve erc20 transfer
    await approveTransfer(
      usdcERC20,
      dowgoAdmin,
      dowgoERC20.address,
      BUY_AMOUNT_TOO_HIGH.mul(initialPrice).div(ONE_DOWGO_UNIT)
    );

    // Create buy tx
    const buyTx = await dowgoERC20.connect(dowgoAdmin).admin_buy_dowgo(BUY_AMOUNT_TOO_HIGH);

    // wait until the transaction is mined
    await buyTx.wait();

    // check that admin owns less USDC
    expect(await usdcERC20.balanceOf(dowgoAdmin.address)).to.equal(
      initialAdminUSDCBalance.sub(
        BUY_AMOUNT_TOO_HIGH.mul(initialPrice)
          .mul(initRatio)
          .div(ONE_DOWGO_UNIT)
          .div(BigNumber.from(10000))
      ),
      "USDC amount not substracted from admin"
    );

    // check that contract owns 60+(8*0.03)
    expect(await usdcERC20.balanceOf(dowgoERC20.address)).to.equal(
      BUY_AMOUNT_TOO_HIGH.mul(initialPrice)
        .mul(initRatio)
        .div(ONE_DOWGO_UNIT)
        .div(BigNumber.from(10000))
        .add(initialUSDCReserve),
      "Contract doesn't own right amount of USDC"
    );
    expect(await dowgoERC20.totalUSDCReserve()).to.equal(
      BUY_AMOUNT_TOO_HIGH.mul(initialPrice)
        .mul(initRatio)
        .div(ONE_DOWGO_UNIT)
        .div(BigNumber.from(10000))
        .add(initialUSDCReserve),
      "Contract doesn't own right amount of USDC"
    );

    // check for second admin Buy Event
    const eventFilter2 = dowgoERC20.filters.AdminBuyDowgo(dowgoAdmin.address);
    let events2 = await dowgoERC20.queryFilter(eventFilter2);
    expect(events2[1] && events2[1].args[1] && events2[1].args[1]).to.equal(BUY_AMOUNT_TOO_HIGH);
  });
});
