import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { DowgoERC20, DowgoERC20__factory, ERC20 } from "../typechain";
import {
  initialDowgoSupply,
  initialPrice,
  initialUSDCReserve,
  initialUser1USDCBalance,
  initPriceInteger,
  initRatio,
  ONE_UNIT,
} from "./test-constants";
import { approveTransfer, setupTestEnv } from "./test-utils";

describe("DowgoERC20 - sell", function () {
  let dowgoERC20: DowgoERC20;
  let usdcERC20: ERC20;
  let dowgoAdmin: SignerWithAddress;
  let addr1: SignerWithAddress;
  const SELL_AMOUNT = ONE_UNIT;

  // buy tokens before selling them
  beforeEach(async () => {
    ({ dowgoERC20, addr1, usdcERC20, dowgoAdmin } = await setupTestEnv());
    // Approve erc20 transfer
    await approveTransfer(
      usdcERC20,
      addr1,
      dowgoERC20.address,
      SELL_AMOUNT.mul(2)
    );
    // buy
    const buyTx = await dowgoERC20.connect(addr1).buy_dowgo(SELL_AMOUNT);

    // wait until the transaction is mined
    await buyTx.wait();
  });
  it("Should let first address sell dowgo token against usdc", async function () {
    // sell
    const sellTx = await dowgoERC20.connect(addr1).sell_dowgo(SELL_AMOUNT);
    await sellTx.wait();

    // check for Sell Event
    const eventFilter = dowgoERC20.filters.SellDowgo(addr1.address);
    let events = await dowgoERC20.queryFilter(eventFilter);
    expect(events[0] && events[0].args[1] && events[0].args[1]).to.equal(
      SELL_AMOUNT
    );

    // check pending USDC balance
    expect(await dowgoERC20.usdcUserBalances(addr1.address)).to.equal(
      initialPrice
    );

    // withdraw
    const withdrawTx = await dowgoERC20
      .connect(addr1)
      .withdraw_usdc(initialPrice);
    await withdrawTx.wait();

    // check for WithdrawUSDC Event
    const eventFilter2 = dowgoERC20.filters.WithdrawUSDC(addr1.address);
    let events2 = await dowgoERC20.queryFilter(eventFilter2);
    expect(events2[0] && events2[0].args[1] && events2[0].args[1]).to.equal(
      initialPrice
    );

    // check pending usdc balance
    expect(await dowgoERC20.usdcUserBalances(addr1.address)).to.equal(
      BigNumber.from(0)
    );

    // check that user 1 is back to owning 100 USDC
    expect(await usdcERC20.balanceOf(addr1.address)).to.equal(
      initialUser1USDCBalance
    );
  });
  it("Should not let user 1 sell an amount of tokens they don't own", async function () {
    const SELL_AMOUNT_TOO_HIGH = SELL_AMOUNT.mul(4);

    try {
      // Create sell tx
      const sellTx = await dowgoERC20
        .connect(addr1)
        .sell_dowgo(SELL_AMOUNT_TOO_HIGH);

      // wait until the transaction is mined
      await sellTx.wait();
    } catch (e: any) {
      expect(e.toString()).to.equal(
        `Error: VM Exception while processing transaction: reverted with reason string 'User doesn't own enough tokens to sell'`
      );
    }

    // Check that supply of both USDC and Dowgo hasnt been changed
    expect(await dowgoERC20.totalUSDCSupply()).to.equal(
      initialUSDCReserve.add(SELL_AMOUNT.mul(2))
    );
    expect(await dowgoERC20.totalSupply()).to.equal(
      initialDowgoSupply.add(SELL_AMOUNT)
    );

    // check for SellDowgo Event not fired
    const eventFilter = dowgoERC20.filters.SellDowgo(addr1.address);
    let events = await dowgoERC20.queryFilter(eventFilter);
    expect(events.length === 0).to.be.true;
  });
  it("Should not let user 1 sell too much tokens (more than 3%*10%=0.3% of total supply =3DWG)", async function () {
    const SELL_AMOUNT_TOO_HIGH = SELL_AMOUNT.mul(10);

    const usdcReserveBefore = await dowgoERC20.totalUSDCSupply();
    const dowgoSupplyBefore = await dowgoERC20.totalSupply();

    // First, the admin should send the tokens to the user
    await approveTransfer(
      dowgoERC20,
      dowgoAdmin,
      addr1.address,
      SELL_AMOUNT_TOO_HIGH
    );

    const transferTx = await dowgoERC20
      .connect(dowgoAdmin)
      .transfer(addr1.address, SELL_AMOUNT_TOO_HIGH);
    await transferTx.wait();

    try {
      // Create sell tx
      const sellTx = await dowgoERC20
        .connect(addr1)
        .sell_dowgo(SELL_AMOUNT_TOO_HIGH);

      // wait until the transaction is mined
      await sellTx.wait();
    } catch (e: any) {
      expect(e.toString()).to.equal(
        `Error: VM Exception while processing transaction: reverted with reason string 'Contract already bought all dowgo tokens before next rebalancing'`
      );
    }

    // Check that supply of both USDC and Dowgo hasnt been changed
    expect(await dowgoERC20.totalUSDCSupply()).to.equal(usdcReserveBefore);
    expect(await dowgoERC20.totalSupply()).to.equal(dowgoSupplyBefore);

    // check for SellDowgo Event not fired
    const eventFilter = dowgoERC20.filters.SellDowgo(addr1.address);
    let events = await dowgoERC20.queryFilter(eventFilter);
    expect(events.length === 0).to.be.true;
  });
  it("Should let admin sell too much tokens (more than 3%*10%=0.3% of total supply =3DWG) using admin_sell", async function () {
    let initialAdminUSDCBalance = await usdcERC20.balanceOf(dowgoAdmin.address);
    let initialContractUSDCBalance = await usdcERC20.balanceOf(
      dowgoERC20.address
    );
    const SELL_AMOUNT_TOO_HIGH = initialDowgoSupply;

    // Create sell tx
    const sellTx = await dowgoERC20
      .connect(dowgoAdmin)
      .admin_sell_dowgo(SELL_AMOUNT_TOO_HIGH);

    // wait until the transaction is mined
    await sellTx.wait();

    const usdcFromAdminSell = SELL_AMOUNT_TOO_HIGH.mul(initPriceInteger)
      .mul(initRatio)
      .div(BigNumber.from(10000));

    // check pending USDC balance
    expect(await dowgoERC20.usdcUserBalances(dowgoAdmin.address)).to.equal(
      usdcFromAdminSell
    );

    // withdraw
    const withdrawTx = await dowgoERC20
      .connect(dowgoAdmin)
      .withdraw_usdc(usdcFromAdminSell);
    await withdrawTx.wait();

    // check that admin owns more USDC
    expect(await usdcERC20.balanceOf(dowgoAdmin.address)).to.equal(
      initialAdminUSDCBalance.add(usdcFromAdminSell),
      "USDC amount not added to admin"
    );

    // check that contract owns targetRatio less USDC
    expect(await usdcERC20.balanceOf(dowgoERC20.address)).to.equal(
      initialContractUSDCBalance.sub(usdcFromAdminSell),
      "Contract doesn't own right amount of USDC"
    );
    expect(await dowgoERC20.totalUSDCSupply()).to.equal(
      initialContractUSDCBalance.sub(usdcFromAdminSell),
      "Contract doesn't own right amount of USDC"
    );

    // check for second admin Buy Event
    const eventFilter2 = dowgoERC20.filters.AdminSellDowgo(dowgoAdmin.address);
    let events2 = await dowgoERC20.queryFilter(eventFilter2);
    expect(events2[0] && events2[0].args[1] && events2[0].args[1]).to.equal(
      SELL_AMOUNT_TOO_HIGH
    );
  });
});
