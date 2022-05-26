import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers, network } from "hardhat";
import { DowgoERC20, DowgoERC20__factory } from "../typechain";

const ONE_UNIT=BigNumber.from((10**18).toString())
const initialEthReserve=BigNumber.from(1000).mul(ONE_UNIT)
const initialEthBalance=BigNumber.from(10000).mul(ONE_UNIT)
const initialPrice=ONE_UNIT.mul(2)// start price is 2ETH/DWG
const initRatio=BigNumber.from(300) // out of 10k

describe("DowgoERC20", function () {
  let dowgoERC20:DowgoERC20
  let owner:SignerWithAddress
  let addr1:SignerWithAddress
  let addr2:SignerWithAddress

  beforeEach(async()=>{
    // reset network
    await network.provider.request({
      method: "hardhat_reset",
      params: [],
    });
    // get addresses
    ([owner, addr1, addr2] = await ethers.getSigners());
    // deploy contract
    const DowgoERC20Factory:DowgoERC20__factory = await ethers.getContractFactory("DowgoERC20");
    dowgoERC20 = await DowgoERC20Factory.deploy(initialPrice,initRatio);
    await dowgoERC20.deployed();

    // increase total reserve
    const increaseTx = await dowgoERC20.connect(owner).increase_eth_supply({value:initialEthReserve});
    await increaseTx.wait();
  })
  describe("DowgoERC20 - buy - single", function () {
    it("Should let first address buy dowgo token against eth", async function () {
      const buyTx = await dowgoERC20.connect(addr1).buy_dowgo(ONE_UNIT,{value:initialPrice});

      // wait until the transaction is mined
      await buyTx.wait();

      expect(await dowgoERC20.balanceOf(addr1.address)).to.equal(ONE_UNIT);

      // check for Buy Event
      const eventFilter2=dowgoERC20.filters.BuyDowgo(addr1.address)
      let events2=await dowgoERC20.queryFilter(eventFilter2)
      expect(events2[0]&&events2[0].args[1]&&events2[0].args[1]).to.equal(ONE_UNIT);
    });
  });
});