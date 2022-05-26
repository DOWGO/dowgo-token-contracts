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

describe("DowgoERC20 - sell", function () {
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


    // buy tokens before selling them
    beforeEach(async()=>{
      // buy
      const buyTx = await dowgoERC20.connect(addr1).buy_dowgo(ONE_UNIT,{value:initialPrice});

      // wait until the transaction is mined
      await buyTx.wait();
    })
    it("Should let first address sell dowgo token against eth", async function () {
      // sell
      const sellTx = await dowgoERC20.connect(addr1).sell_dowgo(ONE_UNIT);
      await sellTx.wait();

      // check for Sell Event
      const eventFilter=dowgoERC20.filters.SellDowgo(addr1.address)
      let events=await dowgoERC20.queryFilter(eventFilter)
      expect(events[0]&&events[0].args[1]&&events[0].args[1]).to.equal(ONE_UNIT);

      // check pending eth balance
      expect(await dowgoERC20.ethUserBalances(addr1.address)).to.equal(initialPrice);

      // withdraw
      const withdrawTx = await dowgoERC20.connect(addr1).withdraw_eth(initialPrice);
      await withdrawTx.wait();

      // check for WithdrawEth Event
      const eventFilter2=dowgoERC20.filters.WithdrawEth(addr1.address)
      let events2=await dowgoERC20.queryFilter(eventFilter2)
      expect(events2[0]&&events2[0].args[1]&&events2[0].args[1]).to.equal(initialPrice);

      // check pending eth balance
      expect(await dowgoERC20.ethUserBalances(addr1.address)).to.equal(0);
      expect((initialEthBalance).sub((await addr1.getBalance())).lt(ONE_UNIT)).to.equal(true);
    });
});