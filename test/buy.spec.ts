import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { DowgoERC20, ERC20 } from "../typechain";
import {
  initialDowgoSupply,
  initialUSDCReserve,
  initPriceInteger,
  ONE_UNIT,
  initialUser1USDCBalance,
  initRatio,
} from "./test-constants";
import { approveTransfer, setupTestEnv } from "./test-utils";

describe("DowgoERC20 - buy", function () {
  let dowgoERC20: DowgoERC20;
  let usdcERC20: ERC20;
  let dowgoAdmin: SignerWithAddress;
  let addr1: SignerWithAddress;
  let addr2: SignerWithAddress;
  const BUY_AMOUNT = ONE_UNIT;

  beforeEach(async () => {
    ({ dowgoERC20, addr1, addr2, usdcERC20, dowgoAdmin } = await setupTestEnv());
  });
  it("Should let first address buy dowgo token against usdc", async function () {
    // Approve erc20 transfer
    await approveTransfer(
      usdcERC20,
      addr1,
      dowgoERC20.address,
      BUY_AMOUNT.mul(initPriceInteger)
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
      initialUser1USDCBalance.sub(BUY_AMOUNT.mul(initPriceInteger))
    );

    // check that contract owns 60+2USDC
    expect(await usdcERC20.balanceOf(dowgoERC20.address)).to.equal(
      BUY_AMOUNT.mul(initPriceInteger).add(initialUSDCReserve)
    );
    expect(await dowgoERC20.totalUSDCSupply()).to.equal(
      BUY_AMOUNT.mul(initPriceInteger).add(initialUSDCReserve)
    );

    // check for Buy Event
    const eventFilter2 = dowgoERC20.filters.BuyDowgo(addr1.address);
    let events2 = await dowgoERC20.queryFilter(eventFilter2);
    expect(events2[0] && events2[0].args[1] && events2[0].args[1]).to.equal(
      BUY_AMOUNT
    );
  });
  it("Should not let user 2 who owns no usdc to buy dowgo", async function () {
    try {
      // Approve erc20 transfer
      await approveTransfer(
        usdcERC20,
        addr2,
        dowgoERC20.address,
        BUY_AMOUNT.mul(initPriceInteger)
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

    // Check that price has NOT been set
    expect(await dowgoERC20.totalUSDCSupply()).to.equal(initialUSDCReserve);

    // check for PriceSet Event not fired
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
        BUY_AMOUNT_TOO_HIGH.mul(initPriceInteger)
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

    // Check that supply of both USDC and Dowgo hasnt been changed
    expect(await dowgoERC20.totalUSDCSupply()).to.equal(initialUSDCReserve);
    expect(await dowgoERC20.totalSupply()).to.equal(initialDowgoSupply);

    // check for BuyDowgo Event not fired
    const eventFilter = dowgoERC20.filters.BuyDowgo(addr1.address);
    let events = await dowgoERC20.queryFilter(eventFilter);
    expect(events.length === 0).to.be.true;
  });
  it("Should let admin buy too much tokens (more than 3%*10%=0.3% of total supply =3DWG) using admin_buy", async function () {
    let initialAdminUSDCBalance=await usdcERC20.balanceOf(dowgoAdmin.address)
    const BUY_AMOUNT_TOO_HIGH = initialDowgoSupply
    
      // Approve erc20 transfer
      await approveTransfer(
        usdcERC20,
        dowgoAdmin,
        dowgoERC20.address,
        BUY_AMOUNT_TOO_HIGH.mul(initPriceInteger)
      );

      // Create buy tx
      const buyTx = await dowgoERC20
        .connect(dowgoAdmin)
        .admin_buy_dowgo(BUY_AMOUNT_TOO_HIGH);

      // wait until the transaction is mined
      await buyTx.wait();

    // check that admin owns 100-2=98 USDC
    expect(await usdcERC20.balanceOf(dowgoAdmin.address)).to.equal(
      initialAdminUSDCBalance.sub(BUY_AMOUNT_TOO_HIGH.mul(initPriceInteger).mul(initRatio).div(BigNumber.from(10000))),"USDC amount not substracted from admin"
    );

    // check that contract owns 60+(8*0.03)
    expect(await usdcERC20.balanceOf(dowgoERC20.address)).to.equal(
      BUY_AMOUNT_TOO_HIGH.mul(initPriceInteger).mul(initRatio).div(BigNumber.from(10000)).add(initialUSDCReserve), "Contract doesn't own right amount of USDC"
    );
    expect(await dowgoERC20.totalUSDCSupply()).to.equal(
      BUY_AMOUNT_TOO_HIGH.mul(initPriceInteger).mul(initRatio).div(BigNumber.from(10000)).add(initialUSDCReserve), "Contract doesn't own right amount of USDC"
    );

    // check for second admin Buy Event
    const eventFilter2 = dowgoERC20.filters.BuyDowgo(dowgoAdmin.address);
    let events2 = await dowgoERC20.queryFilter(eventFilter2);
    console.log(events2)
    expect(events2[1] && events2[1].args[1] && events2[1].args[1]).to.equal(
      BUY_AMOUNT_TOO_HIGH
    );
  });
});
