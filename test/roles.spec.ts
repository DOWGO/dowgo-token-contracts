import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "ethers";
import { DowgoERC20, ERC20 } from "../typechain";
import {
  DEFAULT_ADMIN_ROLE,
  WHITELISTED_ROLE,
  initialDowgoSupply,
  initialPrice,
  initialUSDCReserve,
  initialUser1USDCBalance,
  mockUSDCSupply,
} from "./test-constants";

import { setupTestEnvDowgoERC20 } from "./testUtils";

describe("DowgoERC20 - roles", function () {
  let dowgoERC20: DowgoERC20, usdcERC20: ERC20;
  let addr1: SignerWithAddress,
    addr2: SignerWithAddress,
    addr3: SignerWithAddress,
    dowgoAdmin: SignerWithAddress;

  beforeEach(async () => {
    ({ dowgoERC20, usdcERC20, addr1, addr2, addr3, dowgoAdmin } =
      await setupTestEnvDowgoERC20({
        initialPrice,
        initialUSDCReserve,
        initialUser1USDCBalance,
        mockUSDCSupply,
        initialDowgoSupply,
      }));
  });
  it("Should check that user1 is whitelisted", async function () {
    expect(
      await dowgoERC20.hasRole(WHITELISTED_ROLE, addr1.address),
      "role change wasn't enacted"
    );
  });
  it("Should check that user1 can be blacklisted", async function () {
    const blacklistUser1Tx = await dowgoERC20
      .connect(dowgoAdmin)
      .revoke_whitelist(addr1.address);
    await blacklistUser1Tx.wait();
    expect(
      (await dowgoERC20.hasRole(WHITELISTED_ROLE, addr1.address)) === false,
      "role revokation wasn't enacted"
    );
  });
  it("Should add user 1 as admin and whitelisted user", async function () {
    const addAdminUser1Tx = await dowgoERC20
      .connect(dowgoAdmin)
      .grant_admin(addr1.address);
    await addAdminUser1Tx.wait();

    expect(
      await dowgoERC20.hasRole(DEFAULT_ADMIN_ROLE, addr1.address),
      "role change wasn't enacted"
    );
    expect(
      await dowgoERC20.hasRole(WHITELISTED_ROLE, addr1.address),
      "role change wasn't enacted"
    );
  });
  it("Should not be able to add non whitelisted as admin", async function () {
    try {
      const addAdminUser3Tx = await dowgoERC20
        .connect(dowgoAdmin)
        .grant_admin(addr3.address);
      await addAdminUser3Tx.wait();
    } catch (e: any) {
      expect(e.toString()).to.equal(
        `Error: VM Exception while processing transaction: reverted with reason string 'AccessControl: account ${addr3.address.toLowerCase()} is missing role ${WHITELISTED_ROLE}'`
      );
    }

    expect(
      (await dowgoERC20.hasRole(DEFAULT_ADMIN_ROLE, addr3.address)) == false,
      "role change shouldn't have been enacted"
    );
  });
  it("Should not be able to add to whitelist if not admin", async function () {
    try {
      const addAdminUser3Tx = await dowgoERC20
        .connect(addr2)
        .whitelist(addr3.address);
      await addAdminUser3Tx.wait();
    } catch (e: any) {
      expect(e.toString()).to.equal(
        `Error: VM Exception while processing transaction: reverted with reason string 'AccessControl: account ${addr2.address.toLowerCase()} is missing role ${DEFAULT_ADMIN_ROLE}'`
      );
    }

    expect(
      (await dowgoERC20.hasRole(DEFAULT_ADMIN_ROLE, addr3.address)) == false,
      "role change shouldn't have been enacted"
    );
  });
});
