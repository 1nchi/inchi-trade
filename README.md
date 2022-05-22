# Inchi Trade

## How it works

User has 1000 USDC in his wallet and wants to 
1) Buy more than 9050 USDC for 9000 USDT (first limit order) 
2) Sell 9000 USDC for 9000 USDT to get $50 profit (second limit order)

1. Deposit USDC to Aave (supplyWithPermit) - zero gas
2. Approve credit delegation to InchiTrade contract (delegationWithSig) - zero gas
3. Activate E-mode to get higher borrowing power for stable coins
4. Create 1inch limit order:
		makingAmount - 9000 USDT
		takingAmount - 9050 USDC
		predicate - USDC/USDT price higher than 9050/9000
		callback - deposit makingAmount to Aave and borrow 9000 USDT to transfer to taker
4. Create 1inch limit order to close this position with profit:
		makingAmount - 9000 USDC
		takingAmount - 9000 USDT
		predicate - USDC/USDT price lower than 1
		callback - repay debt using takingAmount and withdraw 9000 USDC to transfer to taker