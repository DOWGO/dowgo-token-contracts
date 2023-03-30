import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { DowgoERC20, ERC20 } from "../typechain";
import {
  initialDowgoSupply,
  initialPrice,
  initialUSDCReserve,
  initialUser1USDCBalance,
  mockUSDCSupply,
  ONE_DOWGO_UNIT,
  ONE_USDC_UNIT,
  transactionFee,
} from "./test-constants";
import { approveTransfer, setupTestEnvDowgoERC20 } from "./testUtils";

const testUSDCAmount = ONE_USDC_UNIT;

describe("DowgoERC20 - USDC Reserve", function () {
  let dowgoERC20: DowgoERC20;
  let usdcERC20: ERC20;
  let dowgoAdmin: SignerWithAddress;
  let addr1: SignerWithAddress;
  let addr2: SignerWithAddress;

  beforeEach(async () => {
    ({ dowgoERC20, addr1, addr2, usdcERC20, dowgoAdmin } =
      await setupTestEnvDowgoERC20({
        initialPrice,
        initialUSDCReserve,
        initialUser1USDCBalance,
        mockUSDCSupply,
        initialDowgoSupply,
      }));
  });
  describe("DowgoERC20 - increase_usdc_reserve", function () {
    it("Should let admin address increase usdc reserve", async function () {
      await approveTransfer(
        usdcERC20,
        dowgoAdmin,
        dowgoERC20.address,
        testUSDCAmount
      );
      const increaseTx = await dowgoERC20
        .connect(dowgoAdmin)
        .increase_usdc_reserve(testUSDCAmount);

      // wait until the transaction is mined
      await increaseTx.wait();

      // Check that reserve has been increased
      expect(await dowgoERC20.totalUSDCReserve()).to.equal(
        testUSDCAmount.add(initialUSDCReserve)
      );

      // Check that the dowgo sc owns usdc
      expect(await usdcERC20.balanceOf(dowgoERC20.address)).to.equal(
        testUSDCAmount.add(initialUSDCReserve)
      );

      // Check that the admin sc was debited 1 usdc
      expect(await usdcERC20.balanceOf(dowgoAdmin.address)).to.equal(
        initialUSDCReserve.sub(testUSDCAmount)
      );

      // check for USDCSupplyIncreased Event
      const eventFilterOwner = dowgoERC20.filters.USDCSupplyIncreased(
        dowgoAdmin.address
      );
      let events = await dowgoERC20.queryFilter(eventFilterOwner);
      expect(events[0] && events[0].args[1] && events[0].args[1]).to.equal(
        testUSDCAmount
      );
    });
    it("Should not let non-admin address increase usdc reserve", async function () {
      try {
        await approveTransfer(
          usdcERC20,
          addr1,
          dowgoERC20.address,
          testUSDCAmount
        );
        const increaseTx = await dowgoERC20
          .connect(addr1)
          .increase_usdc_reserve(testUSDCAmount);

        // wait until the transaction is mined
        await increaseTx.wait();
      } catch (e: any) {
        expect(e.toString()).to.equal(
          `Error: VM Exception while processing transaction: reverted with reason string 'AccessControl: account ${addr1.address.toLowerCase()} is missing role 0x0000000000000000000000000000000000000000000000000000000000000000'`
        );
      }

      // Check that reserve has NOT been increased
      expect(await dowgoERC20.totalUSDCReserve()).to.equal(initialUSDCReserve);

      // Check that the dowgo sc doesn't own one more usdc
      expect(await usdcERC20.balanceOf(dowgoERC20.address)).to.equal(
        initialUSDCReserve
      );

      // Check that the admin sc was NOT debited 1 usdc
      expect(await usdcERC20.balanceOf(dowgoAdmin.address)).to.equal(
        initialUSDCReserve
      );

      // check for USDCSupplyIncreased Event not fired
      const eventFilter = dowgoERC20.filters.USDCSupplyIncreased(addr1.address);
      let events = await dowgoERC20.queryFilter(eventFilter);
      expect(events.length === 0).to.be.true;
    });
  });
  describe("DowgoERC20 - decrease_usdc_reserve", function () {
    const SMALL_DECREASE = testUSDCAmount.div(100);

    it("Should let admin address decrease usdc reserve", async function () {
      const decreaseTx = await dowgoERC20
        .connect(dowgoAdmin)
        .decrease_usdc_reserve(SMALL_DECREASE);

      // wait until the transaction is mined
      await decreaseTx.wait();

      // Check that reserve has been decreased
      expect(await dowgoERC20.totalUSDCReserve()).to.equal(
        initialUSDCReserve.sub(SMALL_DECREASE)
      );

      // check for USDCSupplyIncreased Event
      const eventFilterOwner = dowgoERC20.filters.USDCSupplyDecreased(
        dowgoAdmin.address
      );
      let events = await dowgoERC20.queryFilter(eventFilterOwner);
      expect(events[0] && events[0].args[1] && events[0].args[1]).to.equal(
        SMALL_DECREASE
      );
      expect(await dowgoERC20.usdcUserBalances(dowgoAdmin.address)).to.equal(
        SMALL_DECREASE
      );

      // withdraw
      const withdrawTx = await dowgoERC20
        .connect(dowgoAdmin)
        .withdraw_usdc(SMALL_DECREASE);
      await withdrawTx.wait();

      // check for WithdrawUSDC Event
      const eventFilter2 = dowgoERC20.filters.WithdrawUSDC(dowgoAdmin.address);
      let events2 = await dowgoERC20.queryFilter(eventFilter2);
      expect(events2[0] && events2[0].args[1] && events2[0].args[1]).to.equal(
        SMALL_DECREASE
      );

      // check pending usdc balances
      // dowgoAdmin balance on contract
      expect(await dowgoERC20.usdcUserBalances(dowgoAdmin.address)).to.equal(0);
      // dowgoAdmin usdc balance
      expect(await usdcERC20.balanceOf(dowgoAdmin.address)).to.equal(
        initialUSDCReserve.add(SMALL_DECREASE)
      );
      // dowgo sc usdc balance
      expect(await usdcERC20.balanceOf(dowgoERC20.address)).to.equal(
        initialUSDCReserve.sub(SMALL_DECREASE)
      );
    });
    it("Should not let non-admin address decrease usdc reserve", async function () {
      try {
        const decreaseTx = await dowgoERC20
          .connect(addr1)
          .decrease_usdc_reserve(testUSDCAmount);

        // wait until the transaction is mined
        await decreaseTx.wait();
      } catch (e: any) {
        expect(e.toString()).to.equal(
          `Error: VM Exception while processing transaction: reverted with reason string 'AccessControl: account ${addr1.address.toLowerCase()} is missing role 0x0000000000000000000000000000000000000000000000000000000000000000'`
        );
      }

      // Check that reserve has NOT been decreased
      expect(await dowgoERC20.totalUSDCReserve()).to.equal(initialUSDCReserve);

      // check for USDCSupplyIncreased Event not fired
      const eventFilter = dowgoERC20.filters.USDCSupplyDecreased(addr1.address);
      let events = await dowgoERC20.queryFilter(eventFilter);
      expect(events.length === 0).to.be.true;

      // check pending usdc balances
      // addr1 usdc balance
      expect(await usdcERC20.balanceOf(addr1.address)).to.equal(
        initialUser1USDCBalance
      );
      // dowgo sc usdc balance
      expect(await usdcERC20.balanceOf(dowgoERC20.address)).to.equal(
        initialUSDCReserve
      );
    });
    it("Should not let admin address decrease usdc reserve bellow min ratio", async function () {
      const TEST_AMOUNT = ONE_DOWGO_UNIT;
      const USDC_COST_NO_FEE =
        TEST_AMOUNT.mul(initialPrice).div(ONE_DOWGO_UNIT);
      const USDC_FEE = USDC_COST_NO_FEE.mul(transactionFee).div(10000);
      const TOTAL_USDC_COST = USDC_COST_NO_FEE.add(USDC_FEE);
      // Approve erc20 transfer
      await approveTransfer(
        usdcERC20,
        addr1,
        dowgoERC20.address,
        TOTAL_USDC_COST
      );
      // First mine some tokens
      const buyTx = await dowgoERC20.connect(addr1).buy_dowgo(TEST_AMOUNT);

      // wait until the transaction is mined
      await buyTx.wait();

      try {
        const decreaseTx = await dowgoERC20
          .connect(dowgoAdmin)
          .decrease_usdc_reserve(initialUSDCReserve.add(initialPrice));

        // wait until the transaction is mined
        await decreaseTx.wait();
      } catch (e: any) {
        expect(e.toString()).to.equal(
          `Error: VM Exception while processing transaction: reverted with reason string 'Cannot go under min ratio for USDC reserves'`
        );
      }

      // Check that reserve has NOT been decreased
      expect(await dowgoERC20.totalUSDCReserve()).to.equal(
        initialUSDCReserve.add(initialPrice)
      );

      // check for USDCSupplyIncreased Event not fired
      const eventFilter = dowgoERC20.filters.USDCSupplyDecreased(
        dowgoAdmin.address
      );
      let events = await dowgoERC20.queryFilter(eventFilter);
      expect(events.length === 0).to.be.true;

      // check pending usdc balances
      // dowgoAdmin balance on contract
      expect(await dowgoERC20.usdcUserBalances(dowgoAdmin.address)).to.equal(0);
      // dowgoAdmin 1000 usdc balance
      expect(await usdcERC20.balanceOf(dowgoAdmin.address)).to.equal(
        initialUSDCReserve
      );
      // dowgo sc usdc balance
      expect(await usdcERC20.balanceOf(dowgoERC20.address)).to.equal(
        initialUSDCReserve.add(initialPrice).add(USDC_FEE)
      );
    });
  });
});
