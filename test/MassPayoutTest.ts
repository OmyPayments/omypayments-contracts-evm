import { expect } from "chai";
import { ethers } from "hardhat";
import { randomBytes, hexlify } from "ethers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

describe("MassPayout test", function () {
    async function deployContractsFixture() {
        const Token = await ethers.getContractFactory("TestToken");
        const Payout = await ethers.getContractFactory("MassPayoutV1");

        const zeroAddress: string = '0x0000000000000000000000000000000000000000';
        const [ owner, user1, user2 ] = await ethers.getSigners();

        const token = await Token.deploy();
        await token.waitForDeployment();

        const payout = await upgrades.deployProxy(Payout, [], {
            initialize: 'initialize',
            kind: 'uups',
        });
        await payout.waitForDeployment();

        return { Token, token, Payout, payout, owner, user1, user2, zeroAddress };
    }

    it("Should default payout balance should be 0 eth", async function () {
        const { Token, token, Payout, payout, owner, user1, user2, zeroAddress } = await loadFixture(deployContractsFixture);
        expect(await payout.getBalance()).to.eq(0);
    });

    it("Should withdraw coins", async function() {
        const { Token, token, Payout, payout, owner, user1, user2, zeroAddress } = await loadFixture(deployContractsFixture);
        const value = 1000;
        const wrongValue = 1000000;
        await expect(user1.sendTransaction({to: await payout.getAddress(), value: value})).to.changeEtherBalances(
            [user1, await payout.getAddress()],
            [-value, value]
        );

        await expect(payout.connect(user1).transferCoins(user2.address, value)).to.be.rejected;
        await expect(payout.connect(owner).transferCoins(user2.address, wrongValue))
            .to.be.revertedWithCustomError(payout, 'CustomErrorWithdraw')
            .withArgs(1102);
        const txTransfer = payout.connect(owner).transferCoins(user2.address, value);
        await expect(() => txTransfer).to.changeEtherBalances(
            [await payout.getAddress(), user2],
            [-value, value]
        );
    });

    it("Should withdraw tokens", async function() {
        const { Token, token, Payout, payout, owner, user1, user2, zeroAddress } = await loadFixture(deployContractsFixture);
        const value = 1000;
        const wrongValue = 1000000;

        const txTransferTokens = await token.transfer(await payout.getAddress(), value);
        await txTransferTokens.wait();

        const proxyBalanceTokenBefore = await token.balanceOf(await payout.getAddress());
        expect(proxyBalanceTokenBefore).to.eq(value);
        await payout.getTokenBalance(await token.getAddress());

        await expect(payout.connect(user1).transferTokens(await token.getAddress(), user2.address, value)).to.be.rejected;
        await expect(payout.connect(owner).transferTokens(await token.getAddress(), user2.address, wrongValue))
            .to.be.revertedWithCustomError(payout, 'CustomErrorWithdraw')
            .withArgs(1104);

        const txTransfer = await payout.transferTokens(await token.getAddress(), user2.address, value);
        await txTransfer.wait();
        const proxyBalanceAfter = await token.balanceOf(await payout.getAddress());
        expect(proxyBalanceAfter).to.eq(0);
        const userBalanceAfter = await token.balanceOf(user2.address);
        expect(userBalanceAfter).to.eq(value);
    });

    it("Should mass transfer tokens", async function() {
        const { Token, token, Payout, payout, owner, user1, user2, zeroAddress } = await loadFixture(deployContractsFixture);
        const targets = [user1.address, user2.address];
        const amounts = [1000, 2000];
        const wrongAmounts = [1000000, 2000000];
        const totalAmount = 3000n;
        const key = hexlify(randomBytes(32));
        const baseOwnerTokenAmount = await token.balanceOf(owner.address);

        await expect(token.connect(owner).approve(await payout.getAddress(), totalAmount)).to.not.rejected;
        await expect(payout.connect(user1).metaPayouts(token, targets, amounts, key))
            .to.be.revertedWithCustomError(payout, 'CustomError')
            .withArgs(1001);
        await expect(payout.connect(owner).metaPayouts(token, targets, amounts, key))
            .to.be.revertedWithCustomError(payout, 'CustomError')
            .withArgs(1203);
        await expect(payout.connect(owner).addToken(await token.getAddress())).to.not.rejected;
        await expect(payout.connect(owner).metaPayouts(token, targets, wrongAmounts, key))
            .to.be.revertedWithCustomError(payout, 'CustomError')
            .withArgs(1205);


        let eventTotalAmount, eventTargetsCount, eventKey;
        await expect(payout.connect(owner).metaPayouts(token, targets, amounts, key))
            .to.emit(payout, 'MetaPayoutsEvent')
            .withArgs(
                (value: any) => {eventTotalAmount = value; return true;},
                (value: any) => {eventTargetsCount = value; return true;},
                (value: any) => {eventKey = value; return true;},
            );
        expect(eventTotalAmount).to.eq(totalAmount);
        expect(eventTargetsCount).to.eq(targets.length);
        expect(eventKey).to.eq(key);
        expect(await token.balanceOf(user1.address)).to.eq(amounts[0]);
        expect(await token.balanceOf(user2.address)).to.eq(amounts[1]);
        expect(await token.balanceOf(await payout.getAddress())).to.eq(0);
        expect(await token.balanceOf(owner.address)).to.eq(baseOwnerTokenAmount - totalAmount);

        await expect(payout.connect(owner).metaPayouts(token, targets, amounts, key))
            .to.be.revertedWithCustomError(payout, 'CustomError')
            .withArgs(1206);
    });

    it("Highload tests", async function() {
        const { Token, token, Payout, payout, owner, user1, user2, zeroAddress } = await loadFixture(deployContractsFixture);
        const key = hexlify(randomBytes(32));

        let targets: any[] = [];
        let amounts: any[] = [];
        let totalAmount = 0n;
        for (let i = 0; i < 50; i++) {
            targets.push(user1.address);
            amounts.push(1000n);
            targets.push(user2.address);
            amounts.push(2000n);

            totalAmount += (1000n + 2000n);
        }

        console.log([
            targets,
            amounts,
            totalAmount,
        ]);

        await expect(payout.connect(owner).addToken(await token.getAddress())).to.not.rejected;
        await expect(token.connect(owner).approve(await payout.getAddress(), totalAmount)).to.not.rejected;
        await expect(payout.connect(owner).metaPayouts(token, targets, amounts, key))
            .to.emit(payout, 'MetaPayoutsEvent')
    });
});
