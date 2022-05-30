import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers, network } from "hardhat";
import { DowgoERC20, DowgoERC20__factory, ERC20 } from "../typechain";
import { initialPrice, initialUser1USDCBalance, ONE_UNIT } from "./test-constants";
import { approveTransfer, setupTestEnv } from "./test-utils";


describe("DowgoERC20 - sell", function () {
  let dowgoERC20:DowgoERC20
  let usdcERC20:ERC20
  let addr1:SignerWithAddress

    // buy tokens before selling them
    beforeEach(async()=>{
      ({dowgoERC20,addr1,usdcERC20}=await setupTestEnv())
      // Approve erc20 transfer
      await approveTransfer(usdcERC20,addr1,dowgoERC20.address,ONE_UNIT.mul(2))
      // buy
      const buyTx = await dowgoERC20.connect(addr1).buy_dowgo(ONE_UNIT);

      // wait until the transaction is mined
      await buyTx.wait();
    })
    it("Should let first address sell dowgo token against usdc", async function () {
      // sell
      const sellTx = await dowgoERC20.connect(addr1).sell_dowgo(ONE_UNIT);
      await sellTx.wait();

      // check for Sell Event
      const eventFilter=dowgoERC20.filters.SellDowgo(addr1.address)
      let events=await dowgoERC20.queryFilter(eventFilter)
      expect(events[0]&&events[0].args[1]&&events[0].args[1]).to.equal(ONE_UNIT);

      // check pending eth balance
      expect(await dowgoERC20.usdcUserBalances(addr1.address)).to.equal(initialPrice);
      console.log("sold")
  //     const approveTx = await dowgoERC20.connect(addr1).approve_user(initialPrice.mul(2))
  // await approveTx.wait();
  // console.log(await usdcERC20.allowance(addr1.address,dowgoERC20.address))
  // console.log(await usdcERC20.allowance(dowgoERC20.address,addr1.address),initialPrice)
      // withdraw
      const withdrawTx = await dowgoERC20.connect(addr1).withdraw_usdc(initialPrice);
      await withdrawTx.wait();
      console.log("withdrawn")
      // check for WithdrawUSDC Event
      const eventFilter2=dowgoERC20.filters.WithdrawUSDC(addr1.address)
      let events2=await dowgoERC20.queryFilter(eventFilter2)
      expect(events2[0]&&events2[0].args[1]&&events2[0].args[1]).to.equal(initialPrice);
      console.log("withdrawn")

      // check pending usdc balance
      expect(await dowgoERC20.usdcUserBalances(addr1.address)).to.equal(BigNumber.from(0));
      console.log("withdrawn")

      // check that user 1 is back to owning 100 USDC
      expect(await usdcERC20.balanceOf(addr1.address)).to.equal(initialUser1USDCBalance);
    });
});