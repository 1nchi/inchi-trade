const { ethers } = require("hardhat");
const { use, expect } = require("chai");
const hre = require("hardhat");
const { Pool, UiPoolDataProvider, ERC20Service, BaseDebtToken} = require("@aave/contract-helpers");
const ethSigUtil = require(`eth-sig-util`);
const Wallet = require("ethereumjs-wallet").default;
const { buildOrderData, ABIOrder } = require("./helpers/orderUtils");
const { cutLastArg, toBN } = require("./helpers/utils");
const { web3 } = require("@openzeppelin/test-helpers/src/setup");
const { defaultAbiCoder } = require("ethers/lib/utils");

const CONTRACTS_ADDRESSES = {
  mainnet: {
    aaveProtocolDataProviderAddress: `0x057835Ad21a177dbdd3090bB1CAE03EaCF78Fc6d`,
    aaveLendingPoolAddressProvider: `0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5`,
    aaveOracle: `0xA50ba011c48153De246E5192C8f9258A2ba79Ca9`,
    aaveOracleOwner: `0xee56e2b3d491590b5b31738cc34d5232f378a8d5`,
    limitOrderProtocolAddress: `0xb707d89D29c189421163515c59E42147371D6857`,
    limitOrderProtocolAddressV2: `0x119c71D3BbAC22029622cbaEc24854d3D32D2828`,
  },
  polygon: {
    aaveProtocolDataProviderAddress: `0x69FA688f1Dc47d4B5d8029D5a35FB7a548310654`,
    aaveUIPoolDataProviderAddress: `0x8F1AD487C9413d7e81aB5B4E88B024Ae3b5637D0`,
    aaveLendingPoolAddressProvider: `0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb`,
    aavePool: `0x794a61358D6845594F94dc1DB02A252b5b4814aD`,
    aaveOracle: `0xb023e699F5a33916Ea823A16485e259257cA8Bd1`,
    aaveOracleOwner: `0xdc9A35B16DB4e126cFeDC41322b3a36454B1F772`,
    limitOrderProtocolAddress: `0x3ef51736315F52d568D6D2cf289419b9CfffE782`,
    limitOrderProtocolAddressV2: `0x94Bc2a1C732BcAd7343B25af48385Fe76E08734f`,
    Liquidator: `0x3890EB1F4928C8C0aB05d474b08f78950d25Ce45`,
    wethGateway: `0x9BdB5fcc80A49640c7872ac089Cc0e00A98451B6`,
  },
};

const ASSET_ADDRESSES = {
  mainnet: {
    DAI: "0x6b175474e89094c44da98b954eedeac495271d0f",
    WETH: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
    GUSD: "0x056fd409e1d7a124bd7017459dfea2f387b6d5cd",
    UNI: "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984",
  },
  polygon: {
    WMATIC: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
    DAI: "0x8f3cf7ad23cd3cadbd9735aff958023239c6a063",
    USDC: "0x2791bca1f2de4661ed88a30c99a7a9449aa84174",
    USDT: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
  },
};

const zeroAddress = `0x0000000000000000000000000000000000000000`;

const network = "polygon";

const privatekey =
  "59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
const account = Wallet.fromPrivateKey(Buffer.from(privatekey, "hex"));

function buildOrder(
  exchange,
  makerAsset,
  takerAsset,
  makingAmount,
  takingAmount,
  maker,
  allowedSender = zeroAddress,
  predicate = "0x",
  permit = "0x",
  interaction = "0x",
  receiver = zeroAddress
) {
  return buildOrderWithSalt(
    exchange,
    "1",
    makerAsset,
    takerAsset,
    makingAmount,
    takingAmount,
    maker,
    allowedSender,
    predicate,
    permit,
    interaction,
    receiver
  );
}

function buildOrderWithSalt(
  exchange,
  salt,
  makerAsset,
  takerAsset,
  makingAmount,
  takingAmount,
  maker,
  allowedSender = zeroAddress,
  predicate = "0x",
  permit = "0x",
  interaction = "0x",
  receiver = zeroAddress
) {
  return {
    salt: salt,
    makerAsset: makerAsset.address,
    takerAsset: takerAsset.address,
    maker,
    receiver,
    allowedSender,
    makingAmount,
    takingAmount,
    makerAssetData: "0x",
    takerAssetData: "0x",
    getMakerAmount: cutLastArg(
      exchange.interface.encodeFunctionData("getMakerAmount", [
        makingAmount,
        takingAmount,
        0,
      ])
    ),
    getTakerAmount: cutLastArg(
      exchange.interface.encodeFunctionData("getTakerAmount", [
        makingAmount,
        takingAmount,
        0,
      ])
    ),
    predicate,
    permit,
    interaction,
  };
}

describe("InchiTrade", function () {
  let wallet;
  let InchiTrade;
  let pool;
  let poolDataProviderContract;
  // quick fix to let gas reporter fetch data from gas station & coinmarketcap
  before((done) => {
    setTimeout(done, 2000);
  });

  beforeEach(async function () {
    const { chainId } = await ethers.provider.getNetwork();
    pool = new Pool(ethers.provider, {
      POOL: CONTRACTS_ADDRESSES[network].aavePool,
      WETH_GATEWAY: CONTRACTS_ADDRESSES[network].wethGateway,
    });

    poolDataProviderContract = new UiPoolDataProvider({
      uiPoolDataProviderAddress:
        CONTRACTS_ADDRESSES[network].aaveUIPoolDataProviderAddress,
      provider: ethers.provider,
      chainId,
    });

    const TokenMockFactory = await ethers.getContractFactory("TokenMock");
    this.tokenMock = await TokenMockFactory.deploy("USD Coin (PoS)", "USDC");

    this.limitOrderProtocolFactory = await ethers.getContractFactory(
      `LimitOrderProtocol`
    );
    this.swap = await this.limitOrderProtocolFactory.deploy();

    const InchiTradeFactory = await ethers.getContractFactory("InchiTrade");
    InchiTrade = await InchiTradeFactory.deploy(
      this.swap.address,
      CONTRACTS_ADDRESSES[network].aaveLendingPoolAddressProvider,
      CONTRACTS_ADDRESSES[network].aaveOracle
    );

    // this.swap = await ethers.getContractAt(`LimitOrderProtocol`, ASSET_ADDRESSES[network].limitOrderProtocolAddressV2);

    network !== "polygon" &&
      (this.weth = await ethers.getContractAt(
        `IWETH`,
        ASSET_ADDRESSES[network].WETH
      ));
    network === "polygon" &&
      (this.wmatic = await ethers.getContractAt(
        `IWETH`,
        ASSET_ADDRESSES[network].WMATIC
      ));

    this.dai = await ethers.getContractAt(
      `TokenMock`,
      ASSET_ADDRESSES[network].DAI
    );
    this.usdc = await ethers.getContractAt(
      `TokenMock`,
      ASSET_ADDRESSES[network].USDC
    );

    this.usdt = await ethers.getContractAt(
      `TokenMock`,
      ASSET_ADDRESSES[network].USDT
    );

    const signers = await ethers.getSigners();

    [wallet] = signers;
  });

  describe("InchiTrade", function () {
    // describe("supplyWithPermit()", function () {
    //   it("Should be able to supply assets to Aave using supplyWithPermit", async function () {
    //     const accountsToImpersonate = {
    //       mainnet: "0x7e0188b0312a26ffe64b7e43a7a91d430fb20673",
    //       polygon: "0xce995b9bdf913f5361a03a3981a424ad44f45321",
    //     };
    //     const accountToImpersonate = accountsToImpersonate[network];
    //     await ethers.provider.send("hardhat_impersonateAccount", [
    //       accountToImpersonate,
    //     ]);
    //     await wallet.sendTransaction({
    //       to: accountToImpersonate,
    //       value: ethers.utils.parseEther("15.0"),
    //     });
    //     const amount = 1;
    //     const deadline = Date.now() + 1000 * 60 * 60 * 24; // deadline - 24 hours from now
    //     const accountToImpersonateSigner = await ethers.getSigner(
    //       accountToImpersonate
    //     );
    //     await this.usdc
    //       .connect(accountToImpersonateSigner)
    //       .transfer(wallet.address, 10000000);
    //     await this.tokenMock.mint(wallet.address, '100000000');
    //     console.log(this.tokenMock.address);
    //     const nonces = await this.usdc.nonces(account.getAddressString());
    //     console.log('nonces', nonces.toString());
    //     // supply usdc to Aaave using supplyWithPermit
    //     let dataToSign = await pool.signERC20Approval({
    //       user: account.getAddressString(),
    //       reserve: ASSET_ADDRESSES[network].USDC,
    //       amount,
    //       deadline,
    //     });
    //     const dataToSignObject = JSON.parse(dataToSign);
    //     dataToSign = JSON.stringify(dataToSignObject);
    //     console.log(JSON.stringify(JSON.parse(dataToSign), null, 2));
    //     const dataToSign2Object = JSON.parse(dataToSign);
    //     dataToSign2Object.domain.verifyingContract = this.tokenMock.address;
    //     dataToSign2Object.message.nonce = 0;
    //     dataToSign2Object.message.spender = wallet.address;
    //     const dataToSign2 = JSON.stringify(dataToSign2Object);
    //     console.log(JSON.parse(dataToSign2).message);
    //     const signature = await ethers.provider.send("eth_signTypedData_v4", [
    //       account.getAddressString(),
    //       dataToSign,
    //     ]);
    //     const signature2 = ethSigUtil.signTypedData(account.getPrivateKey(), {data: JSON.parse(dataToSign)}, 'V4');
    //     console.log('signature === signature2', signature === signature2);
    //     console.log('account address:', account.getAddressString());
    //     console.log(ethSigUtil.recoverTypedSignature_v4({data: JSON.parse(dataToSign), sig: signature}));
    //     const sig = ethers.utils.splitSignature(signature);
    //     try {
    //       await this.usdc.permit(account.getAddressString(), wallet.address, JSON.parse(dataToSign).message.value, deadline, sig.v, sig.r, sig.s);
    //       const allowance = await this.tokenMock.allowance(account.getAddressString(), wallet.address);
    //       console.log('allowance', ethers.BigNumber.from(allowance).toNumber())
    //     } catch (e) {
    //       console.log(e);
    //     }
    //     // const txs = await pool.supplyWithPermit({
    //     //   user: wallet.address,
    //     //   reserve: ASSET_ADDRESSES[network].USDC,
    //     //   amount,
    //     //   deadline,
    //     //   signature,
    //     // });
    //     // try {
    //     //   const extendedTxData = await txs[0].tx();
    //     // } catch (e) {
    //     //   console.log('error:', e);
    //     // }
    //     return true;
    //   });
    // });
    it("Should open 2x long usdc <-> DAI position", async function () {
      const accountsToImpersonateUSDC = {
        mainnet: "0x7e0188b0312a26ffe64b7e43a7a91d430fb20673",
        polygon: "0xce995b9bdf913f5361a03a3981a424ad44f45321",
      };

      const accountsToImpersonateUSDT = {
        mainnet: "0x7e0188b0312a26ffe64b7e43a7a91d430fb20673",
        polygon: "0x546e3144bc11c78a4b940450c3809a11ad6d8bcb",
      };

      const accountToImpersonateUSDC = accountsToImpersonateUSDC[network];
      const accountToImpersonateUSDT = accountsToImpersonateUSDT[network];

      await ethers.provider.send("hardhat_impersonateAccount", [
        accountToImpersonateUSDC,
      ]);
      await ethers.provider.send("hardhat_impersonateAccount", [
        accountToImpersonateUSDT,
      ]);

      await wallet.sendTransaction({
        to: accountToImpersonateUSDC,
        value: ethers.utils.parseEther("15.0"),
      });

      await wallet.sendTransaction({
        to: accountToImpersonateUSDT,
        value: ethers.utils.parseEther("15.0"),
      });

      const amount = 10; // 10 USDC/USDT

      const accountToImpersonateUSDCSigner = await ethers.getSigner(
        accountToImpersonateUSDC
      );
      await this.usdc
        .connect(accountToImpersonateUSDCSigner)
        .transfer(InchiTrade.address, amount * 10 ** 6);

      await this.usdc
        .connect(accountToImpersonateUSDCSigner)
        .transfer(wallet.address, amount * 10 ** 6);

      const accountToImpersonateUSDTSigner = await ethers.getSigner(
        accountToImpersonateUSDT
      );
      await this.usdt
        .connect(accountToImpersonateUSDTSigner)
        .transfer(wallet.address, amount * 10 ** 6);

      await this.usdc
        .connect(wallet)
        .approve(this.swap.address, amount * 10 ** 6);

      const order = buildOrder(
        this.swap,
        this.usdt,
        this.usdc,
        1,
        1,
        InchiTrade.address
      );

      // const signature = ethers.utils.defaultAbiCoder.encode(
      //   Object.values(ABIOrder.Order),
      //   Object.values(order)
      // );

      order.interaction = InchiTrade.address + InchiTrade.address.slice(2);
      const signature = web3.eth.abi.encodeParameter(ABIOrder, order);

      const supplyTxs = await pool.supply({
        user: wallet.address,
        reserve: ASSET_ADDRESSES[network].USDC,
        amount,
      });

      try {
        const extendedTxData = await supplyTxs[0].tx();
        const { from, ...txData } = extendedTxData;
        const signer = ethers.provider.getSigner(from);
        const txResponse = await signer.sendTransaction({
          ...txData,
          value: txData.value ? ethers.BigNumber.from(txData.value) : undefined,
        });
        console.log("txResponse:", txResponse);
      } catch (e) {
        console.log("error:", e);
      }

      const reserves = await poolDataProviderContract.getReservesHumanized({
        lendingPoolAddressProvider: CONTRACTS_ADDRESSES[network].aaveLendingPoolAddressProvider
      });

      this.usdc.reserve = reserves.reservesData.find(reserve => reserve.underlyingAsset === this.usdc.address);
      const erc20Service = new ERC20Service(ethers.provider);

      this.usdc.debtToken = new BaseDebtToken(ethers.provider, erc20Service);

      console.log(`this.usdc.reserve.variableDebtTokenAddress`, this.usdc.reserve.stableDebtTokenAddress);
      const approveDelegationTxObject = this.usdc.debtToken.approveDelegation({
        user: wallet.address,
        delegatee: InchiTrade.address,
        debtTokenAddress: this.usdc.reserve.stableDebtTokenAddress,
        amount,
      });

      console.log(approveDelegationTxObject);

      try {
        const extendedTxData = await approveDelegationTxObject.tx();
        const { from, ...txData } = extendedTxData;
        const signer = ethers.provider.getSigner(from);
        const txResponse = await signer.sendTransaction({
          ...txData,
          value: txData.value ? ethers.BigNumber.from(txData.value) : undefined,
        });
        console.log("txResponse:", txResponse);
      } catch (e) {
        console.log("error:", e);
      }

      const txs = await pool.setUserEMode({
        user: wallet.address,
        categoryId: 1,
      });

      try {
        const extendedTxData = await txs[0].tx();
        const { from, ...txData } = extendedTxData;
        const signer = ethers.provider.getSigner(from);
        const txResponse = await signer.sendTransaction({
          ...txData,
          value: txData.value ? ethers.BigNumber.from(txData.value) : undefined,
        });
        console.log("txResponse:", txResponse);
      } catch (e) {
        console.log("error:", e);
      }

      try {
        // fill order
        // const userDataBefore = await this.lendingPool.methods.getUserAccountData(this.smartwallet.address).call();
        // console.log(`###: userDataBefore`, userDataBefore);
        const receipt = await this.swap
          .connect(wallet)
          .fillOrder(order, signature, 0, 1, 1);

        // const userDataAfter = await this.lendingPool.methods.getUserAccountData(this.smartwallet.address).call();
        // console.log(`###: userDataAfter`, userDataAfter);
      } catch (e) {
        console.log(e);
      }


      // const allowance = await this.usdc.allowance(
      //   wallet.address,
      //   CONTRACTS_ADDRESSES.polygon.aavePool
      // );

      

      // const userReserves =
      //   await poolDataProviderContract.getUserReservesHumanized({
      //     lendingPoolAddressProvider:
      //       CONTRACTS_ADDRESSES[network].aaveLendingPoolAddressProvider,
      //     user: wallet.address,
      //   });

      // console.log(userReserves);

      return true;
    });
  });
});
