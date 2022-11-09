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
} from "./test-constants";
import { approveTransfer, setupTestEnvDowgoERC20 } from "./testUtils";

describe("DowgoERC20 - buy", function () {
  let dowgoERC20: DowgoERC20;
  let usdcERC20: ERC20;
  let dowgoAdmin: SignerWithAddress;
  let addr1: SignerWithAddress;
  let addr2: SignerWithAddress;
  let addr3: SignerWithAddress;
  const BUY_AMOUNT = ONE_DOWGO_UNIT;
  // Cost of buying dowgo with fee
  const USDC_COST_NO_FEE = BUY_AMOUNT.mul(initialPrice).div(ONE_DOWGO_UNIT);
  const USDC_FEE = USDC_COST_NO_FEE.mul(transactionFee).div(10000);
  const TOTAL_USDC_COST = USDC_COST_NO_FEE.add(USDC_FEE);

  beforeEach(async () => {
    ({ dowgoERC20, addr1, addr2, addr3, usdcERC20, dowgoAdmin } =
      await setupTestEnvDowgoERC20());
  });
  it("Should let first address buy dowgo token against usdc", async function () {
    // Approve erc20 transfer
    await approveTransfer(
      usdcERC20,
      addr1,
      dowgoERC20.address,
      TOTAL_USDC_COST
    );

    // Create buy tx
    const buyTx = await dowgoERC20.connect(addr1).buy_dowgo(BUY_AMOUNT);

    // wait until the transaction is mined
    await buyTx.wait();

    // check for user 1 dowgo balabnce
    expect(await dowgoERC20.balanceOf(addr1.address)).to.equal(BUY_AMOUNT);

    // check for totalSupply
    expect(await dowgoERC20.totalSupply()).to.equal(
      BUY_AMOUNT.add(initialDowgoSupply)
    );

    // check that user 1 owns 100-2=98 USDC
    expect(await usdcERC20.balanceOf(addr1.address)).to.equal(
      initialUser1USDCBalance.sub(TOTAL_USDC_COST)
    );

    // check that contract owns 60+2USDC
    expect(await usdcERC20.balanceOf(dowgoERC20.address)).to.equal(
      TOTAL_USDC_COST.add(initialUSDCReserve)
    );
    expect(await dowgoERC20.totalUSDCReserve()).to.equal(
      USDC_COST_NO_FEE.add(initialUSDCReserve)
    );
    expect(await dowgoERC20.adminTreasury()).to.equal(
      USDC_FEE
    );

    // check for Buy Event
    const eventFilter2 = dowgoERC20.filters.BuyDowgo(addr1.address);
    let events2 = await dowgoERC20.queryFilter(eventFilter2);
    expect(events2[0] && events2[0].args[1] && events2[0].args[1]).to.equal(
      BUY_AMOUNT
    );
  });
  it("Should let first address buy dowgo token against usdc INFINITE ALLOWANCE", async function () {
    const INFINITE_ALLOWANCE =
      "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
    // Approve erc20 transfer
    await approveTransfer(
      usdcERC20,
      addr1,
      dowgoERC20.address,
      BigNumber.from(INFINITE_ALLOWANCE)
    );

    // Create buy tx
    const buyTx = await dowgoERC20.connect(addr1).buy_dowgo(BUY_AMOUNT);

    // wait until the transaction is mined
    await buyTx.wait();

    // check for user 1 dowgo balabnce
    expect(await dowgoERC20.balanceOf(addr1.address)).to.equal(BUY_AMOUNT);

    // check for totalSupply
    expect(await dowgoERC20.totalSupply()).to.equal(
      BUY_AMOUNT.add(initialDowgoSupply)
    );

    // check that user 1 owns 100-2=98 USDC
    expect(await usdcERC20.balanceOf(addr1.address)).to.equal(
      initialUser1USDCBalance.sub(TOTAL_USDC_COST)
    );

    // check that contract owns 60+2USDC
    expect(await usdcERC20.balanceOf(dowgoERC20.address)).to.equal(
      TOTAL_USDC_COST.add(initialUSDCReserve)
    );
    expect(await dowgoERC20.totalUSDCReserve()).to.equal(
      USDC_COST_NO_FEE.add(initialUSDCReserve)
    );
    expect(await dowgoERC20.adminTreasury()).to.equal(
      USDC_FEE
    );

    // check for Buy Event
    const eventFilter2 = dowgoERC20.filters.BuyDowgo(addr1.address);
    let events2 = await dowgoERC20.queryFilter(eventFilter2);
    expect(events2[0] && events2[0].args[1] && events2[0].args[1]).to.equal(
      BUY_AMOUNT
    );
  });
  it("Should not let user 2 who owns no USDC to buy dowgo", async function () {
    try {
      // Approve erc20 transfer
      await approveTransfer(
        usdcERC20,
        addr2,
        dowgoERC20.address,
        TOTAL_USDC_COST
      );

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
    expect(await dowgoERC20.adminTreasury()).to.equal(
      BigNumber.from(0)
    );

    // check for PriceSet Event not fired
    const eventFilter = dowgoERC20.filters.BuyDowgo(addr1.address);
    let events = await dowgoERC20.queryFilter(eventFilter);
    expect(events.length === 0).to.be.true;
  });
  it("Should not let user 3 - who isn't whitelisted - buy dowgo", async function () {
    try {
      // Approve erc20 transfer
      await approveTransfer(
        usdcERC20,
        addr3,
        dowgoERC20.address,
        TOTAL_USDC_COST
      );

      // Create buy tx
      const buyTx = await dowgoERC20.connect(addr3).buy_dowgo(BUY_AMOUNT);

      // wait until the transaction is mined
      await buyTx.wait();
    } catch (e: any) {
      expect(e.toString()).to.equal(
        `Error: VM Exception while processing transaction: reverted with reason string 'AccessControl: account ${addr3.address.toLowerCase()} is missing role 0x8429d542926e6695b59ac6fbdcd9b37e8b1aeb757afab06ab60b1bb5878c3b49'`
      );
    }
    // check for user 3 dowgo balabnce
    expect(await dowgoERC20.balanceOf(addr3.address)).to.equal(BigNumber.from(0));

    // Check that USDC supply hasn't changed
    expect(await dowgoERC20.totalUSDCReserve()).to.equal(initialUSDCReserve);
    expect(await dowgoERC20.adminTreasury()).to.equal(
      BigNumber.from(0)
    );

    // check for BuyDowgo Event not fired
    const eventFilter = dowgoERC20.filters.BuyDowgo(addr1.address);
    let events = await dowgoERC20.queryFilter(eventFilter);
    expect(events.length === 0).to.be.true;
  });
  it("Should not let user 1 buy too much tokens (more than 3%*10%=0.3% of total supply =3DWG)", async function () {
    const BUY_AMOUNT_TOO_HIGH = BUY_AMOUNT.mul(4);
    try {
      // Approve erc20 transfer
      await approveTransfer(
        usdcERC20,
        addr1,
        dowgoERC20.address,
        BUY_AMOUNT_TOO_HIGH.mul(initialPrice).div(ONE_DOWGO_UNIT)
      );

      // Create buy tx
      const buyTx = await dowgoERC20
        .connect(addr1)
        .buy_dowgo(BUY_AMOUNT_TOO_HIGH);

      // wait until the transaction is mined
      await buyTx.wait();
    } catch (e: any) {
      expect(e.toString()).to.equal(
        `Error: VM Exception while processing transaction: reverted with reason string 'Contract already sold all dowgo tokens before next rebalancing'`
      );
    }

    // check for user 1 dowgo balabnce
    expect(await dowgoERC20.balanceOf(addr2.address)).to.equal(BigNumber.from(0));

    // Check that supply of both USDC and Dowgo hasnt been changed
    expect(await dowgoERC20.totalUSDCReserve()).to.equal(initialUSDCReserve);
    expect(await dowgoERC20.totalSupply()).to.equal(initialDowgoSupply);
    expect(await dowgoERC20.adminTreasury()).to.equal(
      BigNumber.from(0)
    );

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
    const buyTx = await dowgoERC20
      .connect(dowgoAdmin)
      .admin_buy_dowgo(BUY_AMOUNT_TOO_HIGH);

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
    expect(events2[1] && events2[1].args[1] && events2[1].args[1]).to.equal(
      BUY_AMOUNT_TOO_HIGH
    );
  });
});
