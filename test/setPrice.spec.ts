import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { DowgoERC20 } from "../typechain";
import {
  initialDowgoSupply,
  initialPrice,
  initialUSDCReserve,
  initialUser1USDCBalance,
  mockUSDCSupply,
  ONE_USDC_UNIT,
} from "./test-constants";
import { setupTestEnvDowgoERC20 } from "./testUtils/setup";

describe("DowgoERC20 - setPrice", function () {
  let dowgoERC20: DowgoERC20;
  let dowgoAdmin: SignerWithAddress;
  let addr1: SignerWithAddress;
  const newPrice = ONE_USDC_UNIT.mul(3);

  beforeEach(async () => {
    ({ dowgoERC20, dowgoAdmin, addr1 } = await setupTestEnvDowgoERC20({
      initialPrice,
      initialUSDCReserve,
      initialUser1USDCBalance,
      mockUSDCSupply,
      initialDowgoSupply,
    }));
  });
  it("Should let admin set price", async function () {
    const setPriceTx = await dowgoERC20
      .connect(dowgoAdmin)
      .set_current_price(newPrice);

    // wait until the transaction is mined
    await setPriceTx.wait();

    // Check that price has been set
    expect(await dowgoERC20.currentPrice()).to.equal(newPrice);

    // check for PriceSet Event
    const eventFilterOwner = dowgoERC20.filters.PriceSet(dowgoAdmin.address);
    let events = await dowgoERC20.queryFilter(eventFilterOwner);
    expect(events[0] && events[0].args[1] && events[0].args[1]).to.equal(
      newPrice
    );
  });
  it("Should not let non-admin address set price", async function () {
    try {
      const setPriceTx = await dowgoERC20
        .connect(addr1)
        .set_current_price(newPrice);

      // wait until the transaction is mined
      await setPriceTx.wait();
    } catch (e: any) {
      expect(e.toString()).to.equal(
        `Error: VM Exception while processing transaction: reverted with reason string 'AccessControl: account ${addr1.address.toLocaleLowerCase()} is missing role 0x0000000000000000000000000000000000000000000000000000000000000000'`
      );
    }

    // Check that price has NOT been set
    expect(await dowgoERC20.totalUSDCReserve()).to.equal(initialUSDCReserve);

    // check for PriceSet Event not fired
    const eventFilter = dowgoERC20.filters.PriceSet(addr1.address);
    let events = await dowgoERC20.queryFilter(eventFilter);
    expect(events.length === 0).to.be.true;
  });
  it("Should not let admin address set price to zero", async function () {
    try {
      const setPriceTx = await dowgoERC20
        .connect(dowgoAdmin)
        .set_current_price(BigNumber.from(0));

      // wait until the transaction is mined
      await setPriceTx.wait();
    } catch (e: any) {
      expect(e.toString()).to.equal(
        `Error: VM Exception while processing transaction: reverted with reason string 'Price must be >0'`
      );
    }

    // Check that price has NOT been set
    expect(await dowgoERC20.totalUSDCReserve()).to.equal(initialUSDCReserve);

    // check for PriceSet Event not fired
    const eventFilter = dowgoERC20.filters.PriceSet(addr1.address);
    let events = await dowgoERC20.queryFilter(eventFilter);
    expect(events.length === 0).to.be.true;
  });
});
