import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { DowgoERC20, ERC20 } from "../typechain";
import { ONE_UNIT } from "./test-constants";
import { approveTransfer, setupTestEnv } from "./test-utils";


describe("DowgoERC20 - buy", function () {
  let dowgoERC20:DowgoERC20
  let usdcERC20:ERC20
  let addr1:SignerWithAddress

  beforeEach(async()=>{
    ({dowgoERC20,addr1,usdcERC20}=await setupTestEnv())
  })
    it("Should let first address buy dowgo token against eth", async function () {
      // Approve erc20 transfer
      await approveTransfer(usdcERC20,addr1,dowgoERC20.address,ONE_UNIT.mul(2))
      
      // Create buy tx
      const buyTx = await dowgoERC20.connect(addr1).buy_dowgo(ONE_UNIT);

      // wait until the transaction is mined
      await buyTx.wait();

      // check for user 1 dowgo balabnce
      expect(await dowgoERC20.balanceOf(addr1.address)).to.equal(ONE_UNIT);
      
      // check for totalSupply
      expect(await dowgoERC20.totalSupply()).to.equal(ONE_UNIT);

      // check that user 1 owns 100-2=98 USDC
      expect(await usdcERC20.balanceOf(addr1.address)).to.equal(ONE_UNIT.mul(98));

      // check that contract owns 1000+2USDC
      expect(await usdcERC20.balanceOf(dowgoERC20.address)).to.equal(ONE_UNIT.mul(1000+2));
      expect(await dowgoERC20.totalUSDCSupply()).to.equal(ONE_UNIT.mul(1000+2));

      // check for Buy Event
      const eventFilter2=dowgoERC20.filters.BuyDowgo(addr1.address)
      let events2=await dowgoERC20.queryFilter(eventFilter2)
      expect(events2[0]&&events2[0].args[1]&&events2[0].args[1]).to.equal(ONE_UNIT);
    });
});