import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber } from "ethers";
import { ethers, network } from "hardhat";
import { ONE_UNIT } from "../test-constants";

import {
  DowgoERC20,
  DowgoERC20Whitelisted,
  DowgoERC20__factory,
  DowgoERC20Whitelisted__factory,
  ERC20,
  ERC20PresetFixedSupply__factory,
  ERC20PresetFixedSupply,
} from "../../typechain";

export const approveTransfer = async (
  usdcERC20: ERC20,
  from: SignerWithAddress,
  to: string,
  amount: BigNumber
) => {
  const approveTx = await usdcERC20.connect(from).approve(to, amount);
  await approveTx.wait();
};

export const sendUSDCToUser = async (
  usdcERC20: ERC20,
  usdcCreator: SignerWithAddress,
  to: string,
  amount: BigNumber
) => {
  const sendToUserTx = await usdcERC20
    .connect(usdcCreator)
    .transfer(to, amount);
  await sendToUserTx.wait();
};

export const approveAndSendUSDC = async (
  usdcERC20: ERC20,
  usdcCreator: SignerWithAddress,
  to: string,
  amount: BigNumber
) => {
  await approveTransfer(usdcERC20, usdcCreator, to, amount);
  await sendUSDCToUser(usdcERC20, usdcCreator, to, amount);
};

export const increaseDowgoSupply = async (
  usdcERC20: ERC20PresetFixedSupply,
  dowgoERC20: DowgoERC20Whitelisted,
  dowgoAdmin: SignerWithAddress,
  amount: BigNumber
) => {
  let price = await dowgoERC20.currentPrice();
  let initRatio = await dowgoERC20.targetRatio();
  await approveTransfer(
    usdcERC20,
    dowgoAdmin,
    dowgoERC20.address,
    amount.mul(price).div(ONE_UNIT).mul(initRatio).div(BigNumber.from(10000))
  );
  const increaseTx = await dowgoERC20
    .connect(dowgoAdmin)
    .admin_buy_dowgo(amount);
  await increaseTx.wait();
};

export const whitelistUser = async (
  dowgoERC20: DowgoERC20Whitelisted,
  dowgoAdmin: SignerWithAddress,
  user: string
) => {
  const whitelistUser1Tx = await dowgoERC20.connect(dowgoAdmin).whitelist(user);
  await whitelistUser1Tx.wait();
};
