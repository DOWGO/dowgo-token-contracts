// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber } from "ethers";
import { ethers } from "hardhat";
import {
  collRange,
  initialDowgoSupply,
  initialPrice,
  initialUSDCReserve,
  initialUser1USDCBalance,
  initRatio,
  mockUSDCSupply,
} from "../test/test-constants";
import { approveTransfer } from "../test/test-utils";
import {
  DowgoERC20,
  DowgoERC20__factory,
  ERC20,
  ERC20PresetFixedSupply__factory,
} from "../typechain";

// TODO write this with actual USDC address
async function main() {
  let dowgoERC20: DowgoERC20, usdcERC20: ERC20;
  let dowgoAdmin: SignerWithAddress;
  let usdcCreator: SignerWithAddress;
  let addr1: SignerWithAddress;
  let addr2: SignerWithAddress;

  console.log("start deploy script...");

  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  // await hre.run('compile');

  // We get the contract to deploy
  [dowgoAdmin, usdcCreator, addr1, addr2] = await ethers.getSigners();

  // TODO: different script for Alpha

  // deploy mock USDC contract from usdcCreator address
  const ERC20Factory: ERC20PresetFixedSupply__factory =
    await ethers.getContractFactory("ERC20PresetFixedSupply");
  usdcERC20 = await ERC20Factory.connect(usdcCreator).deploy(
    "USDC",
    "USDC",
    mockUSDCSupply,
    usdcCreator.address
  );
  usdcERC20 = await usdcERC20.deployed();

  // Send 100 USDC to user 1
  await approveTransfer(
    usdcERC20,
    usdcCreator,
    addr1.address,
    initialUser1USDCBalance
  );
  const sendToUser1Tx = await usdcERC20
    .connect(usdcCreator)
    .transfer(addr1.address, initialUser1USDCBalance);
  await sendToUser1Tx.wait();

  // Send 2000 USDC to dowgoAdmin
  await approveTransfer(
    usdcERC20,
    usdcCreator,
    dowgoAdmin.address,
    initialUSDCReserve
  );
  const sendToOwnerTx = await usdcERC20
    .connect(usdcCreator)
    .transfer(dowgoAdmin.address, initialUSDCReserve.mul(2));
  await sendToOwnerTx.wait();

  // deploy contract
  const DowgoERC20Factory: DowgoERC20__factory =
    await ethers.getContractFactory("DowgoERC20");
  dowgoERC20 = await DowgoERC20Factory.connect(dowgoAdmin).deploy(
    initialPrice,
    initRatio,
    collRange,
    usdcERC20.address
  );
  await dowgoERC20.deployed();

  // increase total reserve by 30 USDC, buys 1000 dowgo for the admin
  await approveTransfer(
    usdcERC20,
    dowgoAdmin,
    dowgoERC20.address,
    initialUSDCReserve
  );
  const increaseTx = await dowgoERC20
    .connect(dowgoAdmin)
    .admin_buy_dowgo(initialDowgoSupply);
  await increaseTx.wait();

  console.log("mockERC20 deployed to:", usdcERC20.address);
  console.log("DowgoERC20 deployed to:", dowgoERC20.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
