import { BigNumber, ethers } from "ethers";

// Token units
export const ONE_ETH_UNIT = BigNumber.from((10 ** 18).toString());
export const ONE_DOWGO_UNIT = BigNumber.from((10 ** 18).toString());
export const ONE_USDC_UNIT = BigNumber.from((10 ** 6).toString());

// Roles
export const DEFAULT_ADMIN_ROLE =
  "0x0000000000000000000000000000000000000000000000000000000000000000";
export const WHITELISTED_ROLE = ethers.utils.keccak256(
  ethers.utils.toUtf8Bytes("WHITELISTED_ROLE")
);

// Initial USDC amounts
export const initialDowgoSupply = BigNumber.from(1000).mul(ONE_DOWGO_UNIT);
export const initialUSDCReserve = BigNumber.from(60).mul(ONE_USDC_UNIT); // initial USDC reserve in the SC is 1k
export const mockUSDCSupply = BigNumber.from(1000000).mul(ONE_USDC_UNIT); // initial suply of mock usdc is 1M

// Initial USDC User amounts
export const initialUser1USDCBalance = BigNumber.from(100).mul(ONE_USDC_UNIT);

export const initialEthBalance = BigNumber.from(10000).mul(ONE_ETH_UNIT);

// Contract Settings
export const initPriceInteger = 2;
export const initialPrice = ONE_USDC_UNIT.mul(initPriceInteger); // start price is 2USDC/DWG
export const initRatio = BigNumber.from(300); // out of 10k => 3%
export const collRange = BigNumber.from(1000); // out of 10k i.e. 10%
export const transactionFee = BigNumber.from(100); // out of 10k i.e. 1%
