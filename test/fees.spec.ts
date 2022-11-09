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

describe("DowgoERC20 - fees", function () {
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

      // Let user 1 buy 1 Dowgo

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
  });
  it("Check that treasury has collected the fee", async function () {
    expect(await dowgoERC20.adminTreasury()).to.equal(
      USDC_FEE
    );
  });
  it("Check that treasury has collected the fee - twice", async function () {
    // Let user 1 buy 1 Dowgo

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

    // Check Treasury
    expect(await dowgoERC20.adminTreasury()).to.equal(
      USDC_FEE.mul(2)
    );
  });
  it("Should let admin withdraw the fee", async function () {
    // Create withdraw tx
    const withdrawTx = await dowgoERC20.connect(dowgoAdmin).withdraw_treasury(USDC_FEE);

    // wait until the transaction is mined
    await withdrawTx.wait();

    // check for WithdrawUSDC Event
    const eventFilter2 = dowgoERC20.filters.WithdrawUSDCTreasury(dowgoAdmin.address);
    let events2 = await dowgoERC20.queryFilter(eventFilter2);
    expect(events2[0] && events2[0].args[1] && events2[0].args[1]).to.equal(
        USDC_FEE
    );

    // check pending usdc balances
    // USDC balance on tresury
    expect(await dowgoERC20.adminTreasury()).to.equal(0);
    // dowgoAdmin usdc balance
    expect(await usdcERC20.balanceOf(dowgoAdmin.address)).to.equal(
      initialUSDCReserve.add(USDC_FEE)
    );
    // dowgo sc usdc balance
    expect(await usdcERC20.balanceOf(dowgoERC20.address)).to.equal(
      initialUSDCReserve.add(USDC_COST_NO_FEE)
    );
  });
  it("Should not let user 1, who is not an admin, withdraw from treasury", async function () {
    try {
        // Create withdraw tx
        const withdrawTx = await dowgoERC20.connect(addr1).withdraw_treasury(USDC_FEE);
    
        // wait until the transaction is mined
        await withdrawTx.wait();
    } catch (e: any) {
      expect(e.toString()).to.equal(
        `Error: VM Exception while processing transaction: reverted with reason string 'AccessControl: account ${addr1.address.toLocaleLowerCase()} is missing role 0x0000000000000000000000000000000000000000000000000000000000000000'`
      );
    }
    // check pending USDC balances
    // USDC balance on treasury
    expect(await dowgoERC20.adminTreasury()).to.equal(USDC_FEE);
    // addr1 usdc balance
    expect(await usdcERC20.balanceOf(addr1.address)).to.equal(
        initialUser1USDCBalance.sub(TOTAL_USDC_COST)
    );
    // dowgo sc usdc balance
    expect(await usdcERC20.balanceOf(dowgoERC20.address)).to.equal(
      initialUSDCReserve.add(TOTAL_USDC_COST)
    );

    // check for PriceSet Event not fired
    const eventFilter = dowgoERC20.filters.WithdrawUSDCTreasury(addr1.address);
    let events = await dowgoERC20.queryFilter(eventFilter);
    expect(events.length === 0).to.be.true;
  });
});
