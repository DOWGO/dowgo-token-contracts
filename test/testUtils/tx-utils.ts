import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber } from "ethers";
import { ethers, network } from "hardhat";
import {
  collRange,
  initialDowgoSupply,
  initialPrice,
  initialUSDCReserve,
  initialUser1USDCBalance,
  initRatio,
  mockUSDCSupply,
  ONE_UNIT,
} from "../test-constants";

import {
  DowgoERC20,
  DowgoERC20Whitelisted,
  DowgoERC20__factory,
  DowgoERC20Whitelisted__factory,
  ERC20,
  ERC20PresetFixedSupply__factory,
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
