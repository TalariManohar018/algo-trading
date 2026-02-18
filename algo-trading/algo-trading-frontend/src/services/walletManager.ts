import { WalletState } from '../context/TradingContext';

class WalletManager {
    private readonly STORAGE_KEY = 'algo_trading_wallet';

    /**
     * Initialize wallet with starting capital
     */
    initializeWallet(startingCapital: number): WalletState {
        const wallet: WalletState = {
            balance: startingCapital,
            usedMargin: 0,
            availableMargin: startingCapital,
            realizedPnl: 0,
            unrealizedPnl: 0,
        };
        this.saveWallet(wallet);
        return wallet;
    }

    /**
     * Load wallet from storage
     */
    loadWallet(startingCapital: number = 100000): WalletState {
        const stored = localStorage.getItem(this.STORAGE_KEY);
        if (stored) {
            try {
                return JSON.parse(stored);
            } catch {
                return this.initializeWallet(startingCapital);
            }
        }
        return this.initializeWallet(startingCapital);
    }

    /**
     * Save wallet to storage
     */
    saveWallet(wallet: WalletState): void {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(wallet));
    }

    /**
     * Reserve margin for new position
     */
    reserveMargin(
        wallet: WalletState,
        price: number,
        quantity: number,
        marginPercent: number = 0.2
    ): { success: boolean; updatedWallet?: WalletState; error?: string } {
        const requiredMargin = price * quantity * marginPercent;

        if (requiredMargin > wallet.availableMargin) {
            return {
                success: false,
                error: `Insufficient margin. Required: ₹${requiredMargin.toFixed(2)}, Available: ₹${wallet.availableMargin.toFixed(2)}`,
            };
        }

        const updatedWallet: WalletState = {
            ...wallet,
            usedMargin: wallet.usedMargin + requiredMargin,
            availableMargin: wallet.availableMargin - requiredMargin,
        };

        return {
            success: true,
            updatedWallet,
        };
    }

    /**
     * Release margin when position closes
     */
    releaseMargin(
        wallet: WalletState,
        price: number,
        quantity: number,
        pnl: number,
        marginPercent: number = 0.2
    ): WalletState {
        const releasedMargin = price * quantity * marginPercent;

        return {
            ...wallet,
            balance: wallet.balance + pnl,
            usedMargin: Math.max(0, wallet.usedMargin - releasedMargin),
            availableMargin: wallet.availableMargin + releasedMargin + pnl,
            realizedPnl: wallet.realizedPnl + pnl,
        };
    }

    /**
     * Update unrealized PnL
     */
    updateUnrealizedPnl(wallet: WalletState, totalUnrealizedPnl: number): WalletState {
        return {
            ...wallet,
            unrealizedPnl: totalUnrealizedPnl,
        };
    }

    /**
     * Reset wallet to starting capital
     */
    resetWallet(startingCapital: number): WalletState {
        return this.initializeWallet(startingCapital);
    }

    /**
     * Get wallet summary
     */
    getWalletSummary(wallet: WalletState): {
        totalEquity: number;
        marginUtilization: number;
        netPnl: number;
    } {
        const totalEquity = wallet.balance + wallet.unrealizedPnl;
        const totalMargin = wallet.usedMargin + wallet.availableMargin;
        const marginUtilization = totalMargin > 0 ? (wallet.usedMargin / totalMargin) * 100 : 0;
        const netPnl = wallet.realizedPnl + wallet.unrealizedPnl;

        return {
            totalEquity,
            marginUtilization,
            netPnl,
        };
    }

    /**
     * Validate if order can be placed
     */
    canPlaceOrder(
        wallet: WalletState,
        orderValue: number,
        maxCapitalPerTradePercent: number
    ): { valid: boolean; reason?: string } {
        const totalCapital = wallet.balance + wallet.usedMargin;
        const maxAllowedValue = totalCapital * (maxCapitalPerTradePercent / 100);

        if (orderValue > maxAllowedValue) {
            return {
                valid: false,
                reason: `Order value ₹${orderValue.toFixed(2)} exceeds max capital per trade (${maxCapitalPerTradePercent}% of ₹${totalCapital.toFixed(2)})`,
            };
        }

        const requiredMargin = orderValue * 0.2;
        if (requiredMargin > wallet.availableMargin) {
            return {
                valid: false,
                reason: `Insufficient available margin. Required: ₹${requiredMargin.toFixed(2)}, Available: ₹${wallet.availableMargin.toFixed(2)}`,
            };
        }

        return { valid: true };
    }
}

export const walletManager = new WalletManager();
