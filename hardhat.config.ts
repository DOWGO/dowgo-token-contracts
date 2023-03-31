import * as dotenv from "dotenv";

import { HardhatUserConfig, task } from "hardhat/config";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";

dotenv.config();

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

// private keys for "dowgo" seed in ganache-cli
const testPrivKey0 = "0x1d0be9777146d0f5a455baf3a1e6310aa9610fd96e1d238ae5277895dd7a6a49";
const testPrivKey1 = "0xd7f9281e35187a1d2370409f2a978f98e9b3ef8f9168d5b8d26126e9fba77d9a";
const testPrivKey2 = "0xc6dc38ec805a8de9e8b3bfaf7cfd760b5f3adc780da265f5578bd584eb1c2ddf";
const testPrivKey3 = "0x1f85725e6dd3a7c98141c8593b20bf138f28571bebf6bebe059324046a3bcdf3";

const config: HardhatUserConfig = {
  solidity: "0.8.17",
  networks: {
    local: {
      url: "localhost:8545",
      accounts: [testPrivKey0, testPrivKey1, testPrivKey2, testPrivKey3],
    },
    ropsten: {
      url: process.env.ROPSTEN_URL || "",
      accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
};

export default config;
