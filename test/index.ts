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

  beforeEach(async()=>{
    // reset network
    await network.provider.request({
      method: "hardhat_reset",
      params: [],
    });
    console.log('restarted');
    // get addresses
    ([owner, addr1] = await ethers.getSigners());
    // deploy contract
    const DowgoERC20Factory:DowgoERC20__factory = await ethers.getContractFactory("DowgoERC20");
    dowgoERC20 = await DowgoERC20Factory.deploy(initialEthReserve,initialPrice,initRatio);
    await dowgoERC20.deployed();
  })
  describe("DowgoERC20 - init", function () {
    it("Should check that deployement was successful with right initial amount", async function () {

      expect(await dowgoERC20.totalSupply()).to.equal(initialEthReserve);;
      expect(await dowgoERC20.totalEthSupply()).to.equal(BigNumber.from(0));
      expect(await dowgoERC20.currentPrice()).to.equal(initialPrice);;
      expect(await dowgoERC20.minRatio()).to.equal(initRatio);;
    });
    it("Should check that first address has ether", async function () {
      expect(await addr1.getBalance()).to.equal(initialEthBalance)
    });
  });
  describe("DowgoERC20 - buy", function () {
    it("Should let first address buy dowgo token against eth", async function () {
      const buyTx = await dowgoERC20.connect(addr1).buy_dowgo(ONE_UNIT,{value:initialPrice});

      // wait until the transaction is mined
      await buyTx.wait();

      expect(await dowgoERC20.balanceOf(addr1.address)).to.equal(ONE_UNIT);

      // check for Buy Event
      const event=dowgoERC20.filters.BuyDowgo(addr1.address)
      expect(event.topics&&event.topics[0]&&event.topics[0]===addr1.address)
    });
  });
  describe("DowgoERC20 - sell", function () {

    // deploy conttract and get test addresses
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
      const event=dowgoERC20.filters.SellDowgo(addr1.address)
      expect(event.topics&&event.topics[0]&&event.topics[0]===addr1.address)

      // check pending eth balance
      expect(await dowgoERC20.ethUserBalances(addr1.address)).to.equal(initialPrice);

      // withdraw
      const withdrawTx = await dowgoERC20.connect(addr1).withdraw_eth(initialPrice);
      await withdrawTx.wait();

      // check for WithdrawEth Event
      const withdrawEvent=dowgoERC20.filters.WithdrawEth(addr1.address)
      expect(withdrawEvent.topics&&withdrawEvent.topics[0]&&withdrawEvent.topics[0]===addr1.address)

      // check pending eth balance 276825861887155
      expect(await dowgoERC20.ethUserBalances(addr1.address)).to.equal(0);
      expect((initialEthBalance).sub((await addr1.getBalance())).lt(ONE_UNIT)).to.equal(true);
    });
  });
  describe("DowgoERC20 - increaseEthReserve", function () {
    it("Should let admin address increase eth reserve", async function () {
      const increaseTx = await dowgoERC20.connect(owner).increase_eth_supply({value:ONE_UNIT});

      // wait until the transaction is mined
      await increaseTx.wait();

      // Check that reserve has been increased
      expect(await dowgoERC20.totalEthSupply()).to.equal(ONE_UNIT);

      // check for EthSupplyIncreased Event
      const event=dowgoERC20.filters.EthSupplyIncreased()
      console.log("ev",event)
      expect(event.topics&&event.topics[0]&&event.topics[0]===addr1.address)
    });
    it("Should not let non-admin address increase eth reserve", async function () {
      try {
        const increaseTx = await dowgoERC20.connect(addr1).increase_eth_supply({value:ONE_UNIT});
  
        // wait until the transaction is mined
        await increaseTx.wait();
      } catch(e:any){
        expect(e.toString()).to.equal(`Error: VM Exception while processing transaction: reverted with reason string 'AccessControl: account ${addr1.address.toLowerCase()} is missing role 0x0000000000000000000000000000000000000000000000000000000000000000'`)
      }

      // Check that reserve has NOT been increased
      expect(await dowgoERC20.totalEthSupply()).to.equal(BigNumber.from(0));

      // check for EthSupplyIncreased Event
      const event=dowgoERC20.filters.EthSupplyIncreased()
      console.log("ev",event)
      expect(event.topics&&event.topics[0]&&event.topics[0]===addr1.address)
    });
  });
});