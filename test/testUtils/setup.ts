import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers, network } from "hardhat";
import {
  collRange,
  initialDowgoSupply,
  initialPrice,
  initialUSDCReserve,
  initialUser1USDCBalance,
  initRatio,
  mockUSDCSupply,
} from "../test-constants";

import {
  DowgoERC20,
  DowgoERC20Whitelisted,
  DowgoERC20__factory,
  DowgoERC20Whitelisted__factory,
  ERC20,
  ERC20PresetFixedSupply__factory,
  ERC20PresetFixedSupply,
} from "../../typechain";
import {
  approveAndSendUSDC,
  approveTransfer,
  increaseDowgoSupply,
  whitelistUser,
} from "./tx-utils";

export const setupTestEnvDowgoERC20Whitelisted = async () => {
  let dowgoERC20: DowgoERC20Whitelisted, usdcERC20: ERC20PresetFixedSupply;
  let dowgoAdmin: SignerWithAddress;
  let usdcCreator: SignerWithAddress;
  // user 1 and 2 will be whitelisted but not user 3
  // user 1 adn 3 will get some USDC
  let addr1: SignerWithAddress;
  let addr2: SignerWithAddress;
  let addr3: SignerWithAddress;

  // reset network
  await network.provider.request({
    method: "hardhat_reset",
    params: [],
  });

  // get addresses
  [dowgoAdmin, usdcCreator, addr1, addr2, addr3] = await ethers.getSigners();

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
  await approveAndSendUSDC(
    usdcERC20,
    usdcCreator,
    addr1.address,
    initialUser1USDCBalance
  );

  // Send 100 USDC to user 3
  await approveAndSendUSDC(
    usdcERC20,
    usdcCreator,
    addr3.address,
    initialUser1USDCBalance
  );

  // Send 2000 USDC to dowgoAdmin
  await approveAndSendUSDC(
    usdcERC20,
    usdcCreator,
    dowgoAdmin.address,
    initialUSDCReserve.mul(2)
  );

  // Deploy Dowgo ERC20 Contract
  const DowgoERC20WhitelistedFactory: DowgoERC20Whitelisted__factory =
    await ethers.getContractFactory("DowgoERC20Whitelisted");
  dowgoERC20 = await DowgoERC20WhitelistedFactory.connect(dowgoAdmin).deploy(
    initialPrice,
    initRatio,
    collRange,
    usdcERC20.address
  );
  await dowgoERC20.deployed();

  // increase total reserve by 30 USDC, buys 1000 dowgo for the admin
  await increaseDowgoSupply(
    usdcERC20,
    dowgoERC20,
    dowgoAdmin,
    initialDowgoSupply
  );

  // whitelist user 1 and 2
  await whitelistUser(dowgoERC20, dowgoAdmin, addr1.address);
  await whitelistUser(dowgoERC20, dowgoAdmin, addr2.address);

  return { dowgoERC20, dowgoAdmin, addr1, addr2, addr3, usdcERC20 };
};

export const setupTestEnvDowgoERC20 = async () => {
  let dowgoERC20: DowgoERC20, usdcERC20: ERC20;
  let dowgoAdmin: SignerWithAddress;
  let usdcCreator: SignerWithAddress;
  let addr1: SignerWithAddress;
  let addr2: SignerWithAddress;

  // reset network
  await network.provider.request({
    method: "hardhat_reset",
    params: [],
  });
  // get addresses
  [dowgoAdmin, usdcCreator, addr1, addr2] = await ethers.getSigners();
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
  return { dowgoERC20, dowgoAdmin, addr1, addr2, usdcERC20 };
};
