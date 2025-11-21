import "@nomicfoundation/hardhat-toolbox";
import { task } from 'hardhat/config';
const bigInt = require("big-integer");
import {Chains} from "./base/base_chains";

async function deployBase(hre, implementationVersion, isTestnet) {
    const [owner] = await ethers.getSigners();
    const MassPayout = await ethers.getContractFactory("MassPayoutV" + implementationVersion);
    let gasLimit = bigInt(0);

    const chains = isTestnet == 1 ? Chains.testnet : Chains.mainnet;

    let currentChain = null;
    for (let i = 0; i < chains.length; i++) {
        if (chains[i].networkName == hre.network.name) {
            currentChain = chains[i];
            break;
        }
    }
    if (!currentChain) {
        throw new Error('Chain not supported!');
    }

    return {owner, MassPayout, gasLimit, currentChain};
}

task("payout:upgrade", "Update payout contract")
    .addPositionalParam("implementationVersion", "Implementation version", '1')
    .addPositionalParam("isTestnet", "Is testnet flag (1 - testnet, 0 - mainnet)", '0')
    .addPositionalParam("gasPrice", "Gas price (for some networks)", '0')
    .setAction(async (taskArgs, hre) => {
        let {owner, MassPayout, gasLimit, currentChain} = await deployBase(hre, taskArgs.implementationVersion, taskArgs.isTestnet);

        console.log("Upgrading payout implementation...");

        const payout = await upgrades.upgradeProxy(currentChain.contractAddresses.massPayout.address, MassPayout);
        gasLimit = gasLimit.add(payout.deployTransaction.gasLimit);
        console.log("Translator implementation upgrade successfully");

        console.log("Updating was done\n");
        console.log("Total gas limit: %s", gasLimit.toString());
        console.log("Owner address: %s", owner.address);
        console.log("Payout address: %s", await payout.getAddress());
        console.log("Transaction hash: %s\n", payout.deployTransaction.hash);
    });
