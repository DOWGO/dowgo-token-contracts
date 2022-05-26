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

describe("DowgoERC20 - setPrice", function () {
  let dowgoERC20:DowgoERC20
  let owner:SignerWithAddress
  let addr1:SignerWithAddress
  let addr2:SignerWithAddress
  const newPrice=ONE_UNIT.mul(3)

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