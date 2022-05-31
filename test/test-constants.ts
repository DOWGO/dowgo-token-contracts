import { BigNumber } from "ethers"

export const ONE_UNIT=BigNumber.from((10**18).toString())

// Initial USDC amounts
export const initialUSDCReserve=BigNumber.from(1000).mul(ONE_UNIT) // initial USDC reserve in the SC is 1k
export const mockUSDCSupply=BigNumber.from(1000000).mul(ONE_UNIT) // initial suply of mock usdc is 1M

// Initial USDC User amounts
export const initialUser1USDCBalance=BigNumber.from(100).mul(ONE_UNIT)

export const initialEthBalance=BigNumber.from(10000).mul(ONE_UNIT)


// Contract Settings
export const initialPrice=ONE_UNIT.mul(2)// start price is 2USDC/DWG
export const initRatio=BigNumber.from(300) // out of 10k => 3%