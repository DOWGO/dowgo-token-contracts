import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { DowgoERC20, ERC20 } from "../typechain";
import {
  initialDowgoSupply,
  initialPrice,
  initialUSDCReserve,
  initialUser1USDCBalance,
  initRatio,
  mockUSDCSupply,
  ONE_DOWGO_UNIT,
  transactionFee,
  WHITELISTED_ROLE,
} from "./test-constants";
import { approveTransfer, setupTestEnvDowgoERC20 } from "./testUtils";

describe("DowgoERC20 - transfer", function () {
  let dowgoERC20: DowgoERC20;
  let usdcERC20: ERC20;
  let dowgoAdmin: SignerWithAddress;
  let addr1: SignerWithAddress; // Whitelisted and owns USDC
  let addr2: SignerWithAddress; // NO USDC
  let addr3: SignerWithAddress; // Not Whitelisted
  const TSF_AMOUNT = ONE_DOWGO_UNIT;

  // Cost of buying dowgo with fee
  const USDC_COST_NO_FEE = TSF_AMOUNT.mul(initialPrice).div(ONE_DOWGO_UNIT);
  const USDC_FEE = USDC_COST_NO_FEE.mul(transactionFee).div(10000);
  const TOTAL_USDC_COST = USDC_COST_NO_FEE.add(USDC_FEE);

  // buy tokens for addr1
  beforeEach(async () => {
    ({ dowgoERC20, addr1, addr2, addr3, usdcERC20, dowgoAdmin } =
      await setupTestEnvDowgoERC20({
        initialPrice,
        initialUSDCReserve,
        initialUser1USDCBalance,
        mockUSDCSupply,
        initialDowgoSupply,
      }));

    // Approve erc20 transfer
    await approveTransfer(
      usdcERC20,
      addr1,
      dowgoERC20.address,
      TOTAL_USDC_COST
    );
    // buy
    const buyTx = await dowgoERC20.connect(addr1).buy_dowgo(TSF_AMOUNT);

    // wait until the transaction is mined
    await buyTx.wait();
  });
  it("Should let first address transfer DWG to whitelisted addr2", async function () {
    // transfer
    const transferTx = await dowgoERC20
      .connect(addr1)
      .transfer(addr2.address, TSF_AMOUNT);
    await transferTx.wait();

    // check for Transfer Event
    const eventFilter = dowgoERC20.filters.Transfer(addr1.address);
    let events = await dowgoERC20.queryFilter(eventFilter);
    expect(events[0] && events[0].args[1] && events[0].args[0]).to.equal(
      addr1.address
    );
    expect(events[0] && events[0].args[1] && events[0].args[1]).to.equal(
      addr2.address
    );
    expect(events[0] && events[0].args[1] && events[0].args[2]).to.equal(
      TSF_AMOUNT
    );

    // check user1 dowgo balance
    expect(await dowgoERC20.balanceOf(addr1.address)).to.equal(0);
    // check user2 dowgo balance
    expect(await dowgoERC20.balanceOf(addr2.address)).to.equal(TSF_AMOUNT);
  });
  describe("Blacklist", function () {
    it("Should not let user 1 transfer tokens to non-whitelisted user 3", async function () {
      try {
        // Create transfer tx
        const transferTx = await dowgoERC20
          .connect(addr1)
          .transfer(addr3.address, TSF_AMOUNT);

        // wait until the transaction is mined
        await transferTx.wait();
      } catch (e: any) {
        expect(e.toString()).to.equal(
          `Error: VM Exception while processing transaction: reverted with reason string 'You can only transfer DWG to whitelisted users'`
        );
      }

      // Check that supply of both users in Dowgo hasnt been changed
      expect(await dowgoERC20.balanceOf(addr1.address)).to.equal(TSF_AMOUNT);
      expect(await dowgoERC20.balanceOf(addr3.address)).to.equal(0);

      // check for TransferDowgo Event not fired
      const eventFilter = dowgoERC20.filters.Transfer(addr1.address);
      let events = await dowgoERC20.queryFilter(eventFilter);
      expect(events.length === 0).to.be.true;
    });
    it("Should not let user 1 transfer tokens to user 2 after it has been blacklisted", async function () {
      try {
        const blacklistUser1Tx = await dowgoERC20
          .connect(dowgoAdmin)
          .revoke_whitelist(addr1.address);
        await blacklistUser1Tx.wait();

        // Create transfer tx
        const transferTx = await dowgoERC20
          .connect(addr1)
          .transfer(addr2.address, TSF_AMOUNT);

        // wait until the transaction is mined
        await transferTx.wait();
      } catch (e: any) {
        expect(e.toString()).to.equal(
          `Error: VM Exception while processing transaction: reverted with reason string 'AccessControl: account ${addr1.address.toLowerCase()} is missing role ${WHITELISTED_ROLE}'`
        );
      }

      // Check that supply of both users in Dowgo hasnt been changed
      expect(await dowgoERC20.balanceOf(addr1.address)).to.equal(TSF_AMOUNT);
      expect(await dowgoERC20.balanceOf(addr3.address)).to.equal(0);

      // check for TransferDowgo Event not fired
      const eventFilter = dowgoERC20.filters.Transfer(addr1.address);
      let events = await dowgoERC20.queryFilter(eventFilter);
      expect(events.length === 0).to.be.true;
    });
  });
  describe("10k limit", function () {
    it("Should not let admin transfer more than 10k worth of dwg to user2", async function () {
      // This is worth 200*51= 10,200 USD
      const TSF_AMOUNT_TOO_HIGH = ONE_DOWGO_UNIT.mul(51);

      try {
        // Create transfer tx
        const transferTx = await dowgoERC20
          .connect(dowgoAdmin)
          .transfer(addr2.address, TSF_AMOUNT_TOO_HIGH);

        // wait until the transaction is mined
        await transferTx.wait();
      } catch (e: any) {
        expect(e.toString()).to.equal(
          `Error: VM Exception while processing transaction: reverted with reason string 'User can't go above USD 10k limit'`
        );
      }

      // Check that supply of both users in Dowgo hasnt been changed
      expect(await dowgoERC20.balanceOf(addr1.address)).to.equal(TSF_AMOUNT);
      expect(await dowgoERC20.balanceOf(addr3.address)).to.equal(0);

      // check for TransferDowgo Event not fired
      const eventFilter = dowgoERC20.filters.Transfer(addr1.address);
      let events = await dowgoERC20.queryFilter(eventFilter);
      expect(events.length === 0).to.be.true;
    });
    it("Should not let addr1 transfer 6k dwg to user 2 (owning 6k) if it brings their amount above 10k - all in usd value", async function () {
      // This is worth 200*51= 10,200 USD
      const BUY_AMOUNT_TOO_HIGH_HALF = ONE_DOWGO_UNIT.mul(51);

      // Cost of buying dowgo with fee
      const USDC_COST_NO_FEE_TOO_HIGH =
        BUY_AMOUNT_TOO_HIGH_HALF.mul(initialPrice).div(ONE_DOWGO_UNIT);
      const USDC_FEE_TOO_HIGH =
        USDC_COST_NO_FEE_TOO_HIGH.mul(transactionFee).div(10000);
      const TOTAL_USDC_COST_TOO_HIGH =
        USDC_COST_NO_FEE_TOO_HIGH.add(USDC_FEE_TOO_HIGH);

      try {
        // 1. Buy Amount for addr1
        // Approve erc20 transfer
        await approveTransfer(
          usdcERC20,
          addr1,
          dowgoERC20.address,
          TOTAL_USDC_COST_TOO_HIGH
        );
        // buy
        const buyTx1 = await dowgoERC20
          .connect(addr1)
          .buy_dowgo(BUY_AMOUNT_TOO_HIGH_HALF);

        // wait until the transaction is mined
        await buyTx1.wait();

        expect(await dowgoERC20.balanceOf(addr1.address)).to.equal(
          TSF_AMOUNT.add(BUY_AMOUNT_TOO_HIGH_HALF)
        );

        // 1. Buy Amount for addr1
        // Approve erc20 transfer
        await approveTransfer(
          usdcERC20,
          addr1,
          dowgoERC20.address,
          TOTAL_USDC_COST_TOO_HIGH
        );
        // buy
        const buyTx2 = await dowgoERC20
          .connect(addr1)
          .buy_dowgo(BUY_AMOUNT_TOO_HIGH_HALF);

        // wait until the transaction is mined
        await buyTx2.wait();
        expect(await dowgoERC20.balanceOf(addr2.address)).to.equal(
          BUY_AMOUNT_TOO_HIGH_HALF
        );

        // Create transfer tx
        const transferTx = await dowgoERC20
          .connect(addr1)
          .transfer(addr2.address, BUY_AMOUNT_TOO_HIGH_HALF);

        // wait until the transaction is mined
        await transferTx.wait();
      } catch (e: any) {
        expect(e.toString()).to.equal(
          `Error: VM Exception while processing transaction: reverted with reason string 'User can't go above USD 10k limit'`
        );
      }

      // Check that supply of both users in Dowgo hasnt been changed
      expect(await dowgoERC20.balanceOf(addr1.address)).to.equal(TSF_AMOUNT);
      expect(await dowgoERC20.balanceOf(addr3.address)).to.equal(0);

      // check for TransferDowgo Event not fired
      const eventFilter = dowgoERC20.filters.Transfer(addr1.address);
      let events = await dowgoERC20.queryFilter(eventFilter);
      expect(events.length === 0).to.be.true;
    });
  });
});

describe("DowgoERC20 - transferFrom", function () {
  let dowgoERC20: DowgoERC20;
  let usdcERC20: ERC20;
  let dowgoAdmin: SignerWithAddress;
  let addr1: SignerWithAddress; // Whitelisted and owns USDC
  let addr2: SignerWithAddress; // NO USDC
  let addr3: SignerWithAddress; // Not Whitelisted
  const TSF_AMOUNT = ONE_DOWGO_UNIT;

  // Cost of buying dowgo with fee
  const USDC_COST_NO_FEE = TSF_AMOUNT.mul(initialPrice).div(ONE_DOWGO_UNIT);
  const USDC_FEE = USDC_COST_NO_FEE.mul(transactionFee).div(10000);
  const TOTAL_USDC_COST = USDC_COST_NO_FEE.add(USDC_FEE);

  // buy tokens for addr1
  beforeEach(async () => {
    ({ dowgoERC20, addr1, addr2, addr3, usdcERC20, dowgoAdmin } =
      await setupTestEnvDowgoERC20({
        initialPrice,
        initialUSDCReserve,
        initialUser1USDCBalance,
        mockUSDCSupply,
        initialDowgoSupply,
      }));

    // Approve erc20 transfer
    await approveTransfer(
      usdcERC20,
      addr1,
      dowgoERC20.address,
      TOTAL_USDC_COST
    );
    // buy
    const buyTx = await dowgoERC20.connect(addr1).buy_dowgo(TSF_AMOUNT);

    // wait until the transaction is mined
    await buyTx.wait();
  });
  it("Should let admin use transferFrom for addr1 transfer DWG to whitelisted addr2", async function () {
    // Approve erc20 transfer from dowgoAdmin for addr1
    await approveTransfer(dowgoERC20, addr1, dowgoAdmin.address, TSF_AMOUNT);

    // transfer
    const transferTx = await dowgoERC20
      .connect(dowgoAdmin)
      .transferFrom(addr1.address, addr2.address, TSF_AMOUNT);
    await transferTx.wait();

    // check for Transfer Event
    const eventFilter = dowgoERC20.filters.Transfer(addr1.address);
    let events = await dowgoERC20.queryFilter(eventFilter);
    expect(events[0] && events[0].args[1] && events[0].args[0]).to.equal(
      addr1.address
    );
    expect(events[0] && events[0].args[1] && events[0].args[1]).to.equal(
      addr2.address
    );
    expect(events[0] && events[0].args[1] && events[0].args[2]).to.equal(
      TSF_AMOUNT
    );

    // check user1 dowgo balance
    expect(await dowgoERC20.balanceOf(addr1.address)).to.equal(0);
    // check user2 dowgo balance
    expect(await dowgoERC20.balanceOf(addr2.address)).to.equal(TSF_AMOUNT);
  });
  it("Should NOT let admin use transferFrom for addr1 transfer DWG to whitelisted addr2 WITHOUT approval", async function () {
    try {
      // transfer
      const transferTx = await dowgoERC20
        .connect(dowgoAdmin)
        .transferFrom(addr1.address, addr2.address, TSF_AMOUNT);
      await transferTx.wait();

      // wait until the transaction is mined
      await transferTx.wait();
    } catch (e: any) {
      expect(e.toString()).to.equal(
        `Error: VM Exception while processing transaction: reverted with reason string 'ERC20: insufficient allowance'`
      );
    }

    // Check that supply of both users in Dowgo hasnt been changed
    expect(await dowgoERC20.balanceOf(addr1.address)).to.equal(TSF_AMOUNT);
    expect(await dowgoERC20.balanceOf(addr3.address)).to.equal(0);

    // check for TransferDowgo Event not fired
    const eventFilter = dowgoERC20.filters.Transfer(addr1.address);
    let events = await dowgoERC20.queryFilter(eventFilter);
    expect(events.length === 0).to.be.true;
  });
  it("Should not let admin use transferFrom for user 1 transfer tokens to non-whitelisted user 3", async function () {
    try {
      // Approve erc20 transfer from dowgoAdmin for addr1
      await approveTransfer(dowgoERC20, addr1, dowgoAdmin.address, TSF_AMOUNT);

      // transfer
      const transferTx = await dowgoERC20
        .connect(dowgoAdmin)
        .transferFrom(addr1.address, addr3.address, TSF_AMOUNT);

      // wait until the transaction is mined
      await transferTx.wait();
    } catch (e: any) {
      expect(e.toString()).to.equal(
        `Error: VM Exception while processing transaction: reverted with reason string 'You can only transfer DWG to whitelisted users'`
      );
    }

    // Check that supply of both users in Dowgo hasnt been changed
    expect(await dowgoERC20.balanceOf(addr1.address)).to.equal(TSF_AMOUNT);
    expect(await dowgoERC20.balanceOf(addr3.address)).to.equal(0);

    // check for TransferDowgo Event not fired
    const eventFilter = dowgoERC20.filters.Transfer(addr1.address);
    let events = await dowgoERC20.queryFilter(eventFilter);
    expect(events.length === 0).to.be.true;
  });
  it("Should not let admin use transferFrom for user 1 transfer tokens to user 2 after it has been blacklisted", async function () {
    try {
      const blacklistUser1Tx = await dowgoERC20
        .connect(dowgoAdmin)
        .revoke_whitelist(addr1.address);
      await blacklistUser1Tx.wait();

      // Approve erc20 transfer from dowgoAdmin for addr1
      await approveTransfer(dowgoERC20, addr1, dowgoAdmin.address, TSF_AMOUNT);

      // transfer
      const transferTx = await dowgoERC20
        .connect(dowgoAdmin)
        .transferFrom(addr1.address, addr2.address, TSF_AMOUNT);
      // wait until the transaction is mined
      await transferTx.wait();
    } catch (e: any) {
      expect(e.toString()).to.equal(
        `Error: VM Exception while processing transaction: reverted with reason string 'You can only transfer DWG from whitelisted users'`
      );
    }

    // Check that supply of both users in Dowgo hasnt been changed
    expect(await dowgoERC20.balanceOf(addr1.address)).to.equal(TSF_AMOUNT);
    expect(await dowgoERC20.balanceOf(addr3.address)).to.equal(0);

    // check for TransferDowgo Event not fired
    const eventFilter = dowgoERC20.filters.Transfer(addr1.address);
    let events = await dowgoERC20.queryFilter(eventFilter);
    expect(events.length === 0).to.be.true;
  });

  describe("10k limit", function () {
    it("Should not let admin transfer more than 10k worth of dwg to user2", async function () {
      // This is worth 200*51= 10,200 USD
      const TSF_AMOUNT_TOO_HIGH = ONE_DOWGO_UNIT.mul(51);

      try {
        // transfer
        const transferTx = await dowgoERC20
          .connect(dowgoAdmin)
          .transferFrom(dowgoAdmin.address, addr2.address, TSF_AMOUNT_TOO_HIGH);
        await transferTx.wait();
      } catch (e: any) {
        expect(e.toString()).to.equal(
          `Error: VM Exception while processing transaction: reverted with reason string 'User can't go above USD 10k limit'`
        );
      }

      // Check that supply of both users in Dowgo hasnt been changed
      expect(await dowgoERC20.balanceOf(addr1.address)).to.equal(TSF_AMOUNT);
      expect(await dowgoERC20.balanceOf(addr3.address)).to.equal(0);

      // check for TransferDowgo Event not fired
      const eventFilter = dowgoERC20.filters.Transfer(addr1.address);
      let events = await dowgoERC20.queryFilter(eventFilter);
      expect(events.length === 0).to.be.true;
    });
    it("Should not let addr1 transfer 6k dwg to user 2 (owning 6k) if it brings their amount above 10k - all in usd value", async function () {
      // This is worth 200*51= 10,200 USD
      const BUY_AMOUNT_TOO_HIGH_HALF = ONE_DOWGO_UNIT.mul(51);

      // Cost of buying dowgo with fee
      const USDC_COST_NO_FEE_TOO_HIGH =
        BUY_AMOUNT_TOO_HIGH_HALF.mul(initialPrice).div(ONE_DOWGO_UNIT);
      const USDC_FEE_TOO_HIGH =
        USDC_COST_NO_FEE_TOO_HIGH.mul(transactionFee).div(10000);
      const TOTAL_USDC_COST_TOO_HIGH =
        USDC_COST_NO_FEE_TOO_HIGH.add(USDC_FEE_TOO_HIGH);

      try {
        // 1. Buy Amount for addr1
        // Approve erc20 transfer
        await approveTransfer(
          usdcERC20,
          addr1,
          dowgoERC20.address,
          TOTAL_USDC_COST_TOO_HIGH
        );
        // buy
        const buyTx1 = await dowgoERC20
          .connect(addr1)
          .buy_dowgo(BUY_AMOUNT_TOO_HIGH_HALF);

        // wait until the transaction is mined
        await buyTx1.wait();

        expect(await dowgoERC20.balanceOf(addr1.address)).to.equal(
          TSF_AMOUNT.add(BUY_AMOUNT_TOO_HIGH_HALF)
        );

        // 1. Buy Amount for addr1
        // Approve erc20 transfer
        await approveTransfer(
          usdcERC20,
          addr1,
          dowgoERC20.address,
          TOTAL_USDC_COST_TOO_HIGH
        );
        // buy
        const buyTx2 = await dowgoERC20
          .connect(addr1)
          .buy_dowgo(BUY_AMOUNT_TOO_HIGH_HALF);

        // wait until the transaction is mined
        await buyTx2.wait();
        expect(await dowgoERC20.balanceOf(addr2.address)).to.equal(
          BUY_AMOUNT_TOO_HIGH_HALF
        );

        // transfer
        const transferTx = await dowgoERC20
          .connect(dowgoAdmin)
          .transferFrom(addr1.address, addr2.address, BUY_AMOUNT_TOO_HIGH_HALF);
        await transferTx.wait();
      } catch (e: any) {
        expect(e.toString()).to.equal(
          `Error: VM Exception while processing transaction: reverted with reason string 'User can't go above USD 10k limit'`
        );
      }

      // Check that supply of both users in Dowgo hasnt been changed
      expect(await dowgoERC20.balanceOf(addr1.address)).to.equal(TSF_AMOUNT);
      expect(await dowgoERC20.balanceOf(addr3.address)).to.equal(0);

      // check for TransferDowgo Event not fired
      const eventFilter = dowgoERC20.filters.Transfer(addr1.address);
      let events = await dowgoERC20.queryFilter(eventFilter);
      expect(events.length === 0).to.be.true;
    });
  });
});
