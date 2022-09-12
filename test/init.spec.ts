import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber } from "ethers";
import {
  DowgoERC20,
  DowgoERC20__factory,
  ERC20,
  ERC20PresetFixedSupply__factory,
  ERC20__factory,
} from "../typechain";
import {
  collRange,
  initialDowgoSupply,
  initialPrice,
  initialUSDCReserve,
  initialUser1USDCBalance,
  initRatio,
  mockUSDCSupply,
  ONE_UNIT,
} from "./test-constants";
import { setupTestEnv } from "./test-utils";

describe("DowgoERC20 - init", function () {
  let dowgoERC20: DowgoERC20, usdcERC20: ERC20;
  let addr1: SignerWithAddress, dowgoAdmin: SignerWithAddress;

  beforeEach(async () => {
    ({ dowgoERC20, usdcERC20, addr1, dowgoAdmin } = await setupTestEnv());
  });
  it("Should check that deployement was successful with right initial amount", async function () {
    expect(await dowgoERC20.totalSupply()).to.equal(initialDowgoSupply);
    expect(await dowgoERC20.totalUSDCSupply()).to.equal(initialUSDCReserve);
    expect(await dowgoERC20.currentPrice()).to.equal(initialPrice);
    expect(await dowgoERC20.targetRatio()).to.equal(initRatio);
    expect(await dowgoERC20.collRange()).to.equal(collRange);
  });
  it("Should check that first address has 100 USDC", async function () {
    // check that user 1 owns 100 USDC
    expect(await usdcERC20.balanceOf(addr1.address)).to.equal(
      initialUser1USDCBalance
    );
  });
  it("Should check that admins has USDC", async function () {
    // check that admin owns 1000 USDC
    expect(await usdcERC20.balanceOf(dowgoAdmin.address)).to.equal(
      initialUSDCReserve
    );
  });
  it("Should check that dowgo contract owns 1000 USDC", async function () {
    expect(await usdcERC20.balanceOf(dowgoERC20.address)).to.equal(
      initialUSDCReserve
    );
  });
});
