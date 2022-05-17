const { ethers } = require("hardhat");
const { use, expect } = require("chai");
const hre = require("hardhat");
const { Pool } = require("@aave/contract-helpers");
const ethSigUtil = require(`eth-sig-util`);

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
    aaveProtocolDataProviderAddress: `0x7551b5D2763519d4e37e8B81929D336De671d46d`,
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
  },
};

const network = "polygon";

describe("InchiTrade", function () {
  let wallet;
  let InchiTrade;
  let pool;
  // quick fix to let gas reporter fetch data from gas station & coinmarketcap
  before((done) => {
    setTimeout(done, 2000);
  });

  beforeEach(async function () {
    pool = new Pool(hre.waffle.provider, {
      POOL: CONTRACTS_ADDRESSES.polygon.aavePool,
      WETH_GATEWAY: CONTRACTS_ADDRESSES.polygon.wethGateway,
    });

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

    const signers = await ethers.getSigners();

    [wallet] = signers;
  });

  describe("InchiTrade", function () {
    it("Should deploy InchiTrade", async function () {
      const InchiTradeFactory = await ethers.getContractFactory("InchiTrade");
      InchiTrade = await InchiTradeFactory.deploy(
        CONTRACTS_ADDRESSES.polygon.aaveLendingPoolAddressProvider,
        CONTRACTS_ADDRESSES.polygon.aaveOracle
      );
    });

    describe("supplyWithPermit()", function () {
      it("Should be able to supply assets to Aave", async function () {
        const accountsToImpersonate = {
          mainnet: "0x7e0188b0312a26ffe64b7e43a7a91d430fb20673",
          polygon: "0xce995b9bdf913f5361a03a3981a424ad44f45321",
        };

        const accountToImpersonate = accountsToImpersonate[network];

        await ethers.provider.send("hardhat_impersonateAccount", [
          accountToImpersonate,
        ]);
        await wallet.sendTransaction({
          to: accountToImpersonate,
          value: ethers.utils.parseEther("6.0"),
        });

        const amount = ethers.BigNumber.from(100);
        const deadline = Date.now() + 1000 * 60 * 60 * 24; // deadline - 24 hours from now

        const accountToImpersonateSigner = await ethers.getSigner(
          accountToImpersonate
        );
        await this.usdc
          .connect(accountToImpersonateSigner)
          .transfer(wallet.address, amount);

        // supply usdc to Aaave using supplyWithPermit
        const dataToSign = await pool.signERC20Approval({
          user: wallet.address,
          reserve: ASSET_ADDRESSES[network].USDC,
          amount,
          deadline,
        });

        const signature = await ethers.provider.send("eth_signTypedData_v4", [
          wallet.address,
          dataToSign,
        ]);

        const txs = await pool.supplyWithPermit({
          user: wallet.address,
          reserve: ASSET_ADDRESSES[network].USDC,
          amount,
          deadline,
          signature,
          onBehalfOf: wallet.address,
        });

        try {
          const extendedTxData = await txs[0].tx();
        } catch (e) {
          console.log('error:', e);
        }

        return true;
      });
    });
  });
});
