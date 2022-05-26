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

describe("DowgoERC20 - Eth Reserve", function () {
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
});