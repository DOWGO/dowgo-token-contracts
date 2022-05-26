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

describe("DowgoERC20 - init", function () {
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