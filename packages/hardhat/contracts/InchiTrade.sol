pragma solidity >=0.8.0 <0.9.0;
//SPDX-License-Identifier: MIT

// import { IPoolAddressesProvider } from "@aave/core-v3/contracts/interfaces/IPoolAddressesProvider.sol";
// import {IPool} from "@aave/core-v3/contracts/interfaces/IPool.sol";
// import { IPriceOracleGetter } from "@aave/core-v3/contracts/interfaces/IPriceOracleGetter.sol";
import "./helpers/AaveBase.sol";

contract InchiTrade is AaveBase {

  constructor(IPoolAddressesProvider _lendingPoolAddressProvider, IPriceOracleGetter _aaveOracleAddress)
	AaveBase(_lendingPoolAddressProvider, _aaveOracleAddress) {}

  // to support receiving ETH by default
  receive() external payable {}
  fallback() external payable {}
}
