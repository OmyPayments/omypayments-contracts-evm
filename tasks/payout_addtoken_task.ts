import "@nomicfoundation/hardhat-toolbox";
import { task } from 'hardhat/config';
import { Chains } from "./base/base_chains";

async function deployBase(hre: any, payoutAddress: any, isTestnet: any) {
    const [owner] = await ethers.getSigners();
    const Payout = await ethers.getContractFactory("MassPayoutV1");

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

    const payout = await Payout.attach(payoutAddress == '0' ? currentChain.contractAddresses.massPayout : payoutAddress);

    let gasLimit = 0n;
    return {Payout, payout, owner, gasLimit, currentChain};
}

task("payout:addToken", "Add approved token")
    .addPositionalParam("tokenAddress", "Token address")
    .addPositionalParam("payoutAddress", "Payout contract address", '0')
    .addPositionalParam("isTestnet", "Is testnet flag (1 - testnet, 0 - mainnet)", '0')
    .addPositionalParam("gasPrice", "Gas price (for some networks)", '0')
    .addPositionalParam("pauseInSeconds", "Pause script running in seconds", '2')
    .setAction(async (taskArgs, hre) => {
        let {Payout, payout, owner, gasLimit, currentChain} = await deployBase(hre, taskArgs.payoutAddress, taskArgs.isTestnet);

        let tx;
        const gasPrice = parseInt(taskArgs.gasPrice);
        console.log("Adding token...");

        tx = await payout.connect(owner).addToken(taskArgs.tokenAddress, gasPrice > 0 ? {gasPrice: gasPrice} : {});
        if (taskArgs.pauseInSeconds != '0') {
            await new Promise(f => setTimeout(f, taskArgs.pauseInSeconds * 1000));
        }
        gasLimit += (await ethers.provider.getTransactionReceipt(tx.hash)).gasUsed;

        console.log("\nToken added successfully\n");
        console.log("Total gas limit: %s", gasLimit.toString());
        console.log("Target contract address: %s", await payout.getAddress());
        console.log("Transaction hash: %s\n", tx.hash);
    })
