import "@nomicfoundation/hardhat-toolbox";
import { task } from 'hardhat/config';
import { Chains } from "./base/base_chains";

async function deployBase(hre: any, isTestnet: any) {
    const [owner] = await ethers.getSigners();
    const Payout = await ethers.getContractFactory("MassPayoutV1");

    const chains = isTestnet == 1 ? Chains.testnet : Chains.mainnet;

    let chainIds = [];
    let currentChain = null;
    for (let i = 0; i < chains.length; i++) {
        chainIds.push(chains[i].id);
        if (chains[i].networkName == hre.network.name) {
            currentChain = chains[i];
        }
    }
    if (!currentChain) {
        throw new Error('Chain not supported!');
    }

    let gasLimit = 0n;
    return {Payout, owner, gasLimit};
}

task("payout:deploy", "Deploy mass payout contract")
    .addPositionalParam("isTestnet", "Is testnet flag (1 - testnet, 0 - mainnet)", '0')
    .addPositionalParam("gasPrice", "Gas price (for some networks)", '0')
    .addPositionalParam("pauseInSeconds", "Pause script running in seconds", '2')
    .setAction(async (taskArgs, hre) => {
        let {Payout, owner, gasLimit} = await deployBase(hre, taskArgs.isTestnet);

        let tx;
        const gasPrice = parseInt(taskArgs.gasPrice);
        console.log("Deploying mass payout contract...");

        const payout = await upgrades.deployProxy( Payout, [], {initialize: 'initialize', kind: 'uups'} );
        await payout.waitForDeployment();
        gasLimit += await ethers.provider.estimateGas({
            data: (await (await ethers.getContractFactory("MassPayoutV1"))
                .getDeployTransaction()).data
        });

        console.log("\nDeployment was done\n");
        console.log("Total gas limit: %s", gasLimit.toString());
        console.log("Owner address: %s", owner.address);
        console.log("Payout address: %s\n", await payout.getAddress());
    })
