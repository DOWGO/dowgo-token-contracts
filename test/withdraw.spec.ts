import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { DowgoERC20, ERC20 } from "../typechain";
import { ONE_USDC_UNIT } from "./test-constants";
import { setupTestEnvDowgoERC20Whitelisted } from "./testUtils/setup";

describe("DowgoERC20 - withdraw", function () {
  let dowgoERC20: DowgoERC20;
  let usdcERC20: ERC20;
  let addr2: SignerWithAddress;

  // buy tokens before selling them
  beforeEach(async () => {
    ({ dowgoERC20, addr2, usdcERC20 } =
      await setupTestEnvDowgoERC20Whitelisted());
  });
  it("Should not let user withdraw with no balance", async function () {
    try {
      const decreaseTx = await dowgoERC20
        .connect(addr2)
        .withdraw_usdc(ONE_USDC_UNIT);

      // wait until the transaction is mined
      await decreaseTx.wait();
    } catch (e: any) {
      expect(e.toString()).to.equal(
        `Error: VM Exception while processing transaction: reverted with reason string 'User doesn't have that much USDC credit'`
      );
    }

    // check for WithdrawUSDC Event absence
    const eventFilter2 = dowgoERC20.filters.WithdrawUSDC(addr2.address);
    let events2 = await dowgoERC20.queryFilter(eventFilter2);
    expect(events2.length).to.equal(0);

    // check pending total supply of usdc on the contract
    expect(await dowgoERC20.usdcUserBalances(dowgoERC20.address)).to.equal(
      BigNumber.from(0)
    );

    // check that user 2 still has no usdc
    expect(await dowgoERC20.usdcUserBalances(addr2.address)).to.equal(
      BigNumber.from(0)
    );
    expect(await usdcERC20.balanceOf(addr2.address)).to.equal(
      BigNumber.from(0)
    );
  });
});
