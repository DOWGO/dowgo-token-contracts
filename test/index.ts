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
  describe("DowgoERC20 - init", function () {
    it("Should check that deployement was successful with right initial amount", async function () {

      expect(await dowgoERC20.totalSupply()).to.equal(BigNumber.from(0));;
      expect(await dowgoERC20.totalEthSupply()).to.equal(initialEthReserve);
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
      const eventFilter2=dowgoERC20.filters.BuyDowgo(addr1.address)
      let events2=await dowgoERC20.queryFilter(eventFilter2)
      expect(events2[0]&&events2[0].args[1]&&events2[0].args[1]).to.equal(ONE_UNIT);
    });
  });
  describe("DowgoERC20 - sell", function () {

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
  describe("DowgoERC20 - increaseEthReserve", function () {
    it("Should let admin address increase eth reserve", async function () {
      const increaseTx = await dowgoERC20.connect(owner).increase_eth_supply({value:ONE_UNIT});

      // wait until the transaction is mined
      await increaseTx.wait();

      // Check that reserve has been increased
      expect(await dowgoERC20.totalEthSupply()).to.equal(ONE_UNIT.add(initialEthReserve));

      // check for EthSupplyIncreased Event
      const eventFilterOwner=dowgoERC20.filters.EthSupplyIncreased(owner.address)
      let events=await dowgoERC20.queryFilter(eventFilterOwner)
      expect(events[1]&&events[1].args[1]&&events[1].args[1]).to.equal(ONE_UNIT);
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
      expect(await dowgoERC20.totalEthSupply()).to.equal(initialEthReserve);

      // check for EthSupplyIncreased Event not fired
      const eventFilter=dowgoERC20.filters.EthSupplyIncreased(addr1.address)
      let events=await dowgoERC20.queryFilter(eventFilter)
      expect(events.length===0).to.be.true
    });
  });
  describe("DowgoERC20 - decreaseEthReserve", function () {
    // increase eth reserve before
    beforeEach(async()=>{
    })
    it("Should let admin address decrease eth reserve", async function () {
      const decreaseTx = await dowgoERC20.connect(owner).decrease_eth_supply(ONE_UNIT);

      // wait until the transaction is mined
      await decreaseTx.wait();

      // Check that reserve has been decreased
      expect(await dowgoERC20.totalEthSupply()).to.equal(initialEthReserve.sub(ONE_UNIT));

      // check for EthSupplyIncreased Event
      const eventFilterOwner=dowgoERC20.filters.EthSupplyDecreased(owner.address)
      let events=await dowgoERC20.queryFilter(eventFilterOwner)
      expect(events[0]&&events[0].args[1]&&events[0].args[1]).to.equal(ONE_UNIT);
      expect(await dowgoERC20.ethUserBalances(owner.address)).to.equal(ONE_UNIT);

      // withdraw
      const withdrawTx = await dowgoERC20.connect(owner).withdraw_eth(ONE_UNIT);
      await withdrawTx.wait();

      // check for WithdrawEth Event
      const eventFilter2=dowgoERC20.filters.WithdrawEth(owner.address)
      let events2=await dowgoERC20.queryFilter(eventFilter2)
      expect(events2[0]&&events2[0].args[1]&&events2[0].args[1]).to.equal(ONE_UNIT);

      // check pending eth balance
      expect(await dowgoERC20.ethUserBalances(owner.address)).to.equal(0);
    });
    it("Should not let non-admin address decrease eth reserve", async function () {
      try {
        const decreaseTx = await dowgoERC20.connect(addr1).decrease_eth_supply(ONE_UNIT);
  
        // wait until the transaction is mined
        await decreaseTx.wait();
      } catch(e:any){
        expect(e.toString()).to.equal(`Error: VM Exception while processing transaction: reverted with reason string 'AccessControl: account ${addr1.address.toLowerCase()} is missing role 0x0000000000000000000000000000000000000000000000000000000000000000'`)
      }
      
      // Check that reserve has NOT been decreased
      expect(await dowgoERC20.totalEthSupply()).to.equal(initialEthReserve);

      // check for EthSupplyIncreased Event not fired
      const eventFilter=dowgoERC20.filters.EthSupplyDecreased(addr1.address)
      let events=await dowgoERC20.queryFilter(eventFilter)
      expect(events.length===0).to.be.true
    });
    it("Should not let admin address decrease eth reserve bellow min ratio", async function () {
      // First mine some tokens
      const buyTx = await dowgoERC20.connect(addr1).buy_dowgo(ONE_UNIT,{value:initialPrice});

      // wait until the transaction is mined
      await buyTx.wait();

      try {
        const decreaseTx = await dowgoERC20.connect(owner).decrease_eth_supply(initialEthReserve.add(initialPrice));
  
        // wait until the transaction is mined
        await decreaseTx.wait();
      } catch(e:any){
        expect(e.toString()).to.equal(`Error: VM Exception while processing transaction: reverted with reason string 'Cannot go under min ratio for eth reserves'`)
      }
      
      // Check that reserve has NOT been decreased
      expect(await dowgoERC20.totalEthSupply()).to.equal(initialEthReserve.add(initialPrice));

      // check for EthSupplyIncreased Event not fired
      const eventFilter=dowgoERC20.filters.EthSupplyDecreased(owner.address)
      let events=await dowgoERC20.queryFilter(eventFilter)
      expect(events.length===0).to.be.true
    });
  });
  describe("DowgoERC20 - set price", function () {
    const newPrice=ONE_UNIT.mul(3)
    it("Should let admin set price", async function () {
      const setPriceTx = await dowgoERC20.connect(owner).set_current_price(newPrice);

      // wait until the transaction is mined
      await setPriceTx.wait();

      // Check that price has been set
      expect(await dowgoERC20.currentPrice()).to.equal(newPrice);

      // check for PriceSet Event
      const eventFilterOwner=dowgoERC20.filters.PriceSet(owner.address)
      let events=await dowgoERC20.queryFilter(eventFilterOwner)
      expect(events[0]&&events[0].args[1]&&events[0].args[1]).to.equal(newPrice);
    });
    it("Should not let non-admin address set price", async function () {
      try {
        const setPriceTx = await dowgoERC20.connect(addr1).set_current_price(newPrice);
  
        // wait until the transaction is mined
        await setPriceTx.wait();
      } catch(e:any){
        expect(e.toString()).to.equal(`Error: VM Exception while processing transaction: reverted with reason string 'AccessControl: account 0x70997970c51812dc3a010c7d01b50e0d17dc79c8 is missing role 0x0000000000000000000000000000000000000000000000000000000000000000'`)
      }
      
      // Check that price has NOT been set
      expect(await dowgoERC20.totalEthSupply()).to.equal(initialEthReserve);

      // check for PriceSet Event not fired
      const eventFilter=dowgoERC20.filters.PriceSet(addr1.address)
      let events=await dowgoERC20.queryFilter(eventFilter)
      expect(events.length===0).to.be.true
    });
    it("Should not let admin address set price to zero", async function () {
      try {
        const setPriceTx = await dowgoERC20.connect(owner).set_current_price(BigNumber.from(0));
  
        // wait until the transaction is mined
        await setPriceTx.wait();
      } catch(e:any){
        expect(e.toString()).to.equal(`Error: VM Exception while processing transaction: reverted with reason string 'Price must be >0'`)
      }
      
      // Check that price has NOT been set
      expect(await dowgoERC20.totalEthSupply()).to.equal(initialEthReserve);

      // check for PriceSet Event not fired
      const eventFilter=dowgoERC20.filters.PriceSet(addr1.address)
      let events=await dowgoERC20.queryFilter(eventFilter)
      expect(events.length===0).to.be.true
    });
  });
});