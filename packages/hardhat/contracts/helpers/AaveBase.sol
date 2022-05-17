// SPDX-License-Identifier: agpl-3.0
pragma solidity >=0.8.0 <0.9.0;

import { IPoolAddressesProvider } from "@aave/core-v3/contracts/interfaces/IPoolAddressesProvider.sol";
import {IPool} from "@aave/core-v3/contracts/interfaces/IPool.sol";
import { IPriceOracleGetter } from "@aave/core-v3/contracts/interfaces/IPriceOracleGetter.sol";

abstract contract AaveBase {
  IPoolAddressesProvider public immutable ADDRESSES_PROVIDER;
  IPool public immutable LENDING_POOL;
  IPriceOracleGetter public immutable AAVE_ORACLE;

  constructor(IPoolAddressesProvider provider, IPriceOracleGetter priceOracleAddress) {
    ADDRESSES_PROVIDER = provider;
    LENDING_POOL = IPool(provider.getPool());
    AAVE_ORACLE = IPriceOracleGetter(priceOracleAddress);
  }
}
