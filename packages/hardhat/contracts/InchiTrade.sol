pragma solidity ^0.8.10;
//SPDX-License-Identifier: MIT

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "./helpers/AaveBase.sol";
import "./helpers/LimitOrderProtocolBase.sol";
import "hardhat/console.sol";

contract InchiTrade is AaveBase, LimitOrderProtocolBase {
    using SafeMath for uint256;
  
    constructor(address _limitOrderProtocol, IPoolAddressesProvider _lendingPoolAddressProvider, IPriceOracleGetter _aaveOracleAddress) 
    LimitOrderProtocolBase(_limitOrderProtocol) AaveBase(_lendingPoolAddressProvider, _aaveOracleAddress) {}


    function notifyFillOrder(
        address /* taker */,
        address makerAsset,
        address takerAsset,
        uint256 makingAmount,
        uint256 takingAmount,
        bytes calldata interactiveData // abi.encode(orderHash)
    ) external override {
        console.log(msg.sender);
        console.log(LIMIT_ORDER_PROTOCOL);
        require(msg.sender == LIMIT_ORDER_PROTOCOL, "only LOP can exec callback");
        makerAsset;
        takingAmount;

        address userAddress;

        assembly {
            userAddress := shr(96, calldataload(interactiveData.offset))
        }

        //        uint256 contractBalanceBefore = IERC20(makerAsset).balanceOf(address(this));
        //        console.log(contractBalanceBefore);
        //        uint256 startGas = gasleft();
        // _liquidate(makerAsset, takerAsset, userAddress, takingAmount, false);
        //        uint256 gasUsed = startGas - gasleft();
        //        console.log('gasUsed', gasUsed);

        //        console.log('successful liquidation');
        // TODO: remove from a list of user's orders
        // deleteOrder(user)

        //        uint256 contractBalanceAfter = IERC20(makerAsset).balanceOf(address(this));
        //        console.log(contractBalanceAfter);
        //        console.log('makingAmount', makingAmount);
        //        console.log('takingAmount', takingAmount);
        POOL.borrow(makerAsset, makingAmount, 1, 0, userAddress);
        //approve makingAmount to send to taker
        IERC20(makerAsset).approve(msg.sender, makingAmount);

        // Check if liquidation profit is higher than makingAmount + gas cost

        // Calculate the the remainder and send it to a user
        // TODO: include fee
    }

    function isValidSignature(bytes32 hash, bytes memory signature) external override view returns (bytes4) {
        StaticOrder memory staticOrder = readStaticOrder(signature);

        bytes memory makerAssetData;
        bytes memory takerAssetData;
        bytes memory _getMakerAmount;
        bytes memory _getTakerAmount;
        bytes memory predicate;
        bytes memory permit;
        bytes memory interaction;

        assembly {// solhint-disable-line no-inline-assembly
            makerAssetData := add(add(signature, 64), mload(add(signature, 320)))
            takerAssetData := add(add(signature, 64), mload(add(signature, 352)))
            _getMakerAmount := add(add(signature, 64), mload(add(signature, 384)))
            _getTakerAmount := add(add(signature, 64), mload(add(signature, 416)))
            predicate := add(add(signature, 64), mload(add(signature, 448)))
            permit := add(add(signature, 64), mload(add(signature, 480)))
            interaction := add(add(signature, 64), mload(add(signature, 512)))
        }

        require(
            hashOrder(staticOrder, makerAssetData, takerAssetData, _getMakerAmount, _getTakerAmount, predicate, permit, interaction) == hash,
            "Liquidator: bad order"
        );

        return this.isValidSignature.selector;
    }

    function getHashFromSignature(bytes memory signature) external view returns (bytes32) {
        StaticOrder memory staticOrder = readStaticOrder(signature);

        bytes memory makerAssetData;
        bytes memory takerAssetData;
        bytes memory _getMakerAmount;
        bytes memory _getTakerAmount;
        bytes memory predicate;
        bytes memory permit;
        bytes memory interaction;

        assembly {// solhint-disable-line no-inline-assembly
            makerAssetData := add(add(signature, 64), mload(add(signature, 320)))
            takerAssetData := add(add(signature, 64), mload(add(signature, 352)))
            _getMakerAmount := add(add(signature, 64), mload(add(signature, 384)))
            _getTakerAmount := add(add(signature, 64), mload(add(signature, 416)))
            predicate := add(add(signature, 64), mload(add(signature, 448)))
            permit := add(add(signature, 64), mload(add(signature, 480)))
            interaction := add(add(signature, 64), mload(add(signature, 512)))
        }

        return hashOrder(staticOrder, makerAssetData, takerAssetData, _getMakerAmount, _getTakerAmount, predicate, permit, interaction);
    }

    function readSignature(bytes memory signature) external pure returns (uint256) {
        StaticOrder memory staticOrder = readStaticOrder(signature);

        bytes memory makerAssetData;
        bytes memory takerAssetData;
        bytes memory _getMakerAmount;
        bytes memory _getTakerAmount;
        bytes memory predicate;
        bytes memory permit;
        bytes memory interaction;

        assembly {// solhint-disable-line no-inline-assembly
            makerAssetData := add(add(signature, 64), mload(add(signature, 320)))
            takerAssetData := add(add(signature, 64), mload(add(signature, 352)))
            _getMakerAmount := add(add(signature, 64), mload(add(signature, 384)))
            _getTakerAmount := add(add(signature, 64), mload(add(signature, 416)))
            predicate := add(add(signature, 64), mload(add(signature, 448)))
            permit := add(add(signature, 64), mload(add(signature, 480)))
            interaction := add(add(signature, 64), mload(add(signature, 512)))
        }

        return staticOrder.takingAmount;
    }

    function readStaticOrder(bytes memory signature) public pure returns (StaticOrder memory) {
        StaticOrder memory staticOrder;
        uint256 salt;
        address makerAsset;
        address takerAsset;
        address maker;
        address receiver;
        address allowedSender;  // equals to Zero address on public orders
        uint256 makingAmount;
        uint256 takingAmount;

        assembly {// solhint-disable-line no-inline-assembly
            salt := mload(add(signature, 64))
            makerAsset := mload(add(signature, 96))
            takerAsset := mload(add(signature, 128))
            maker := mload(add(signature, 160))
            receiver := mload(add(signature, 192))
            allowedSender := mload(add(signature, 224))
            makingAmount := mload(add(signature, 256))
            takingAmount := mload(add(signature, 288))
        }

        staticOrder.salt = salt;
        staticOrder.makerAsset = makerAsset;
        staticOrder.takerAsset = takerAsset;
        staticOrder.maker = maker;
        staticOrder.receiver = receiver;
        staticOrder.allowedSender = allowedSender;
        staticOrder.makingAmount = makingAmount;
        staticOrder.takingAmount = takingAmount;

        return staticOrder;
    }

  // to support receiving ETH by default
  receive() external payable {}
  fallback() external payable {}
}
