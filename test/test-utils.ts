import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber } from "ethers";
import { ethers, network } from "hardhat";
import { initialPrice, initialUSDCReserve, initialUser1USDCBalance, initRatio, mockUSDCSupply, ONE_UNIT } from "./test-constants";


import { DowgoERC20, DowgoERC20__factory, ERC20, ERC20PresetFixedSupply__factory } from "../typechain";

export const approveTransfer=async(usdcERC20:ERC20,from:SignerWithAddress,to:string,amount:BigNumber)=>{
  const approveTx = await usdcERC20.connect(from).approve(to,amount)
  await approveTx.wait();
}

export const setupTestEnv=async ()=>{
    let dowgoERC20:DowgoERC20, usdcERC20:ERC20
    let dowgoAdmin:SignerWithAddress
    let usdcCreator:SignerWithAddress
    let addr1:SignerWithAddress
    let addr2:SignerWithAddress

     // reset network
     await network.provider.request({
        method: "hardhat_reset",
        params: [],
      });
      // get addresses
      ([dowgoAdmin, usdcCreator, addr1, addr2] = await ethers.getSigners());
      // deploy mock USDC contract from usdcCreator address
      const ERC20Factory:ERC20PresetFixedSupply__factory = await ethers.getContractFactory("ERC20PresetFixedSupply");
      usdcERC20 = await ERC20Factory.connect(usdcCreator).deploy("USDC","USDC",mockUSDCSupply,usdcCreator.address);
      usdcERC20=await usdcERC20.deployed();
      // Send 100 USDC to user 1
      await approveTransfer(usdcERC20,usdcCreator,addr1.address,initialUser1USDCBalance)
      const sendToUser1Tx = await usdcERC20.connect(usdcCreator).transfer(addr1.address,initialUser1USDCBalance);
      await sendToUser1Tx.wait();
      // Send 2000 USDC to dowgoAdmin
      await approveTransfer(usdcERC20,usdcCreator,dowgoAdmin.address,initialUSDCReserve)
      const sendToOwnerTx = await usdcERC20.connect(usdcCreator).transfer(dowgoAdmin.address,initialUSDCReserve.mul(2));
      await sendToOwnerTx.wait();
      // deploy contract
      const DowgoERC20Factory:DowgoERC20__factory = await ethers.getContractFactory("DowgoERC20");
      dowgoERC20 = await DowgoERC20Factory.connect(dowgoAdmin).deploy(initialPrice,initRatio, usdcERC20.address);
      await dowgoERC20.deployed();
  
      // increase total reserve by 1000 USDC
      await approveTransfer(usdcERC20,dowgoAdmin,dowgoERC20.address,initialUSDCReserve)
      const increaseTx = await dowgoERC20.connect(dowgoAdmin).increase_usdc_supply(initialUSDCReserve);
      await increaseTx.wait();
      return {dowgoERC20,dowgoAdmin,addr1,addr2,usdcERC20}
}