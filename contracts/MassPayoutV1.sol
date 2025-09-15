// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { SafeERC20, IERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuardUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { BaseWithdrawal } from "./base/BaseWithdrawal.sol";
import { AddressLib } from "./utils/AddressLib.sol";
import { SafeMath } from "./utils/SafeMath.sol";
import { BaseSender } from "./base/BaseSender.sol";
import { BaseErrors } from "./base/BaseErrors.sol";

contract MassPayoutV1 is UUPSUpgradeable, ReentrancyGuardUpgradeable, BaseWithdrawal, BaseSender {

    using AddressLib for address;
    using SafeERC20 for IERC20;
    using SafeMath for uint;

    event AddTokenEvent(address _tokenAddress);
    event RemoveTokenEvent(address _tokenAddress);
    event MetaPayoutsEvent(uint _totalAmount, uint _targetsCount, bytes32 _key);

    struct Token {
        bool exists;
    }
    struct Payout {
        bool exists;
        uint totalAmount;
        uint targetsCount;
    }

    mapping(address => Token) public tokens;
    mapping(bytes32 => Payout) public payouts;

    /// Initializing function for upgradeable contracts (constructor)
    function initialize() initializer public {
        __Ownable_init(msg.sender);
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();

        _addSender(msg.sender);
    }

    receive() external payable {}
    fallback() external payable {}

    /// Upgrade implementation address for UUPS logic
    /// @param _newImplementation address  New implementation address
    function _authorizeUpgrade(address _newImplementation) internal onlyOwner override {}

    /// Add token (only for owner)
    /// @param _tokenAddress address  Token address
    function addToken(address _tokenAddress) public onlyOwner {
        require(_tokenAddress.isContract(), CustomError(BaseErrors.MASSPAYOUT__ADDRESS_IS_NOT_CONTRACT__ERROR));
        tokens[_tokenAddress].exists = true;
        emit AddTokenEvent(_tokenAddress);
    }

    /// Add multiple tokens (only for owner)
    /// @param  _tokenAddresses address[]  Token addresses list
    function addTokens(address[] calldata _tokenAddresses) public onlyOwner {
        for (uint i = 0; i < _tokenAddresses.length; i++) {
            addToken(_tokenAddresses[i]);
        }
    }

    /// Remove token (only for owner)
    /// @param  _tokenAddress address  Token address
    function removeToken(address _tokenAddress) public onlyOwner {
        require(tokens[_tokenAddress].exists, CustomError(BaseErrors.MASSPAYOUT__TOKEN_NOT_FOUND__ERROR));
        delete tokens[_tokenAddress];
        emit RemoveTokenEvent(_tokenAddress);
    }

    /// Meta payout - mass payout logic initiation
    /// @param _token IERC20  Token for payout
    /// @param _targets address[]  Targets list for payout
    /// @param _amounts uint[]  Payout amounts list
    /// @param _key bytes32  Unique payout key
    function metaPayouts(IERC20 _token, address[] calldata _targets, uint[] calldata _amounts, bytes32 _key) external payable nonReentrant onlySender {
        require(tokens[address(_token)].exists, CustomError(BaseErrors.MASSPAYOUT__TOKEN_NOT_SUPPORTED__ERROR));
        require(_targets.length == _amounts.length, CustomError(BaseErrors.MASSPAYOUT__WRONG_LIST_PARAMS_COUNT__ERROR));
        require(!payouts[_key].exists, CustomError(BaseErrors.MASSPAYOUT__MASSPAYOUT_EXECUTED_ALREADY__ERROR));

        uint totalAmount = 0;
        for (uint i = 0; i < _amounts.length; i++) {
            totalAmount = totalAmount.add(_amounts[i]);
        }

        require(
            _token.allowance(msg.sender, address(this)) >= totalAmount,
            CustomError(BaseErrors.MASSPAYOUT__TOKENS_BALANCE_NOT_ENOUGH__ERROR)
        );

        payouts[_key].exists = true;
        payouts[_key].totalAmount = totalAmount;
        payouts[_key].targetsCount = _targets.length;

        for (uint i = 0; i < _targets.length; i++) {
            _token.safeTransferFrom(msg.sender, _targets[i], _amounts[i]);
        }

        emit MetaPayoutsEvent(totalAmount, _targets.length, _key);
    }
}
