// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Ownable2StepUpgradeable } from "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import { SafeERC20, IERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { AddressLib } from "../utils/AddressLib.sol";
import { BaseErrors } from "./BaseErrors.sol";

abstract contract BaseWithdrawal is Ownable2StepUpgradeable {

    using AddressLib for address;
    using SafeERC20 for IERC20;

    error CustomErrorWithdraw(uint16 _errorCode);

    uint[50] private __gap;

    /// Transfer event
    /// @param _to address  Destination address
    /// @param _amount uint  Transfer amount
    /// @param _tokenAddress address  Transfer token address (address(0) - native coins)
    event TransferEvent(address _to, uint _amount, address _tokenAddress);

    /// Return coni balance
    /// @return uint
    function getBalance() public view returns(uint) {
        return address(this).balance;
    }

    /// Return token balance
    /// @return uint
    function getTokenBalance(IERC20 _token) public view returns(uint) {
        return _token.balanceOf(address(this));
    }

    /// Transfer coins (only for owner)
    /// @param _to address  Destination address
    /// @param _amount uint  Transfer amount
    function transferCoins(address _to, uint _amount) external onlyOwner {
        require(!_to.isContract(), CustomErrorWithdraw(BaseErrors.WITHDRAWAL__TARGET_ADDRESS_IS_CONTRACT__ERROR));
        require(getBalance() >= _amount, CustomErrorWithdraw(BaseErrors.WITHDRAWAL__COINS_BALANCE_NOT_ENOUGH__ERROR));
        (bool successFee, ) = _to.call{value: _amount}("");
        require(successFee, CustomErrorWithdraw(BaseErrors.WITHDRAWAL__TRANSFER_FAILED__ERROR));
        emit TransferEvent(_to, _amount, address(0));
    }

    /// Transfer tokens (only for owner)
    /// @param _token IERC20  Token address
    /// @param _to address  Destination address
    /// @param _amount uint  Transfer amount
    function transferTokens(IERC20 _token, address _to, uint _amount) external onlyOwner {
        require(getTokenBalance(_token) >= _amount, CustomErrorWithdraw(BaseErrors.WITHDRAWAL__TOKENS_BALANCE_NOT_ENOUGH__ERROR));
        _token.safeTransfer(_to, _amount);
        emit TransferEvent(_to, _amount, address(_token));
    }
}
