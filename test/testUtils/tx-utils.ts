import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber } from "ethers";
import { ONE_DOWGO_UNIT, ONE_USDC_UNIT } from "../test-constants";

import { DowgoERC20, ERC20, ERC20PresetFixedSupply } from "../../typechain";

export const approveTransfer = async (
  erc20: ERC20,
  from: SignerWithAddress,
  to: string,
  amount: BigNumber
) => {
  const approveTx = await erc20.connect(from).approve(to, amount);
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
  dowgoERC20: DowgoERC20,
  dowgoAdmin: SignerWithAddress,
  amount: BigNumber
) => {
  let price = await dowgoERC20.currentPrice();
  let initRatio = await dowgoERC20.targetRatio();
  await approveTransfer(
    usdcERC20,
    dowgoAdmin,
    dowgoERC20.address,
    amount
      .mul(price)
      .mul(initRatio)
      .div(ONE_DOWGO_UNIT)
      .div(BigNumber.from(10000))
  );
  const increaseTx = await dowgoERC20
    .connect(dowgoAdmin)
    .admin_buy_dowgo(amount);
  await increaseTx.wait();
};

export const whitelistUser = async (
  dowgoERC20: DowgoERC20,
  dowgoAdmin: SignerWithAddress,
  user: string
) => {
  const whitelistUser1Tx = await dowgoERC20.connect(dowgoAdmin).whitelist(user);
  await whitelistUser1Tx.wait();
};
