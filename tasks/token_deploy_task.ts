import "@nomicfoundation/hardhat-toolbox";
import { task } from 'hardhat/config';

async function deployBase(hre: any) {
    const [owner] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("TestToken");

    let gasLimit = 0n;
    return {Token, owner, gasLimit};
}

task("token:deploy", "Deploy test token contract")
    .addPositionalParam("gasPrice", "Gas price (for some networks)", '0')
    .addPositionalParam("pauseInSeconds", "Pause script running in seconds", '2')
    .setAction(async (taskArgs, hre) => {
        let {Token, owner, gasLimit} = await deployBase(hre);

        const gasPrice = parseInt(taskArgs.gasPrice);
        console.log("Deploying test token contract...");

        const token = await Token.deploy();
        await token.waitForDeployment();
        gasLimit += await ethers.provider.estimateGas({
            data: (await (await ethers.getContractFactory("TestToken"))
                .getDeployTransaction()).data
        });

        console.log("\nDeployment was done\n");
        console.log("Total gas limit: %s", gasLimit.toString());
        console.log("Owner address: %s", owner.address);
        console.log("Token address: %s\n", await token.getAddress());
    })
