import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { DowgoERC20, DowgoERC20__factory, ERC20, ERC20PresetFixedSupply__factory, ERC20__factory } from "../typechain";
import { initialPrice, initialUSDCReserve, initialUser1USDCBalance, initRatio, mockUSDCSupply, ONE_UNIT } from "./test-constants";
import { setupTestEnv } from "./test-utils";


describe("DowgoERC20 - init", function () {
  let dowgoERC20:DowgoERC20, usdcERC20:ERC20
  let addr1:SignerWithAddress

  beforeEach(async()=>{
   ({dowgoERC20,usdcERC20,addr1}=await setupTestEnv())
  })
    it("Should check that deployement was successful with right initial amount", async function () {

      expect(await dowgoERC20.totalSupply()).to.equal(BigNumber.from(0));;
      expect(await dowgoERC20.totalUSDCSupply()).to.equal(initialUSDCReserve);
      expect(await dowgoERC20.currentPrice()).to.equal(initialPrice);;
      expect(await dowgoERC20.minRatio()).to.equal(initRatio);;
      // check that user 1 owns 100 USDC
      expect(await usdcERC20.balanceOf(addr1.address)).to.equal(ONE_UNIT.mul(100));
    });
    it("Should check that first address has USDC", async function () {
      expect(await usdcERC20.balanceOf(addr1.address)).to.equal(initialUser1USDCBalance)
    });
});