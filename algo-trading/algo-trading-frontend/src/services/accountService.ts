export interface AccountData {
    walletBalance: number;
    availableMargin: number;
    usedMargin: number;
    realizedPnl: number;
    unrealizedPnl: number;
    totalPnl: number;
    startingCapital: number;
}

class AccountService {
    async getAccountData(): Promise<AccountData> {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 300));

        const stored = localStorage.getItem('algotrader_account');
        if (stored) {
            try {
                return JSON.parse(stored);
            } catch {
                // Fall through to default
            }
        }

        const settings = JSON.parse(localStorage.getItem('algotrader_settings') || '{}');
        const startingCapital = settings.startingCapital || 100000;
        const currentBalance = settings.currentBalance || startingCapital;

        // Calculate PnL from trades
        const trades = JSON.parse(localStorage.getItem('algotrader_trades') || '[]');
        const closedTrades = trades.filter((t: any) => t.status === 'CLOSED');
        const openTrades = trades.filter((t: any) => t.status === 'OPEN');

        const realizedPnl = closedTrades.reduce((sum: number, t: any) => sum + (t.pnl || 0), 0);
        const unrealizedPnl = openTrades.reduce((sum: number, t: any) => {
            // Mock unrealized PnL calculation
            const currentPrice = t.entryPrice * (1 + (Math.random() * 0.04 - 0.02)); // ±2% mock movement
            const pnl = t.orderSide === 'BUY'
                ? (currentPrice - t.entryPrice) * t.quantity
                : (t.entryPrice - currentPrice) * t.quantity;
            return sum + pnl;
        }, 0);

        // Calculate margin
        const usedMargin = openTrades.reduce((sum: number, t: any) => {
            return sum + (t.entryPrice * t.quantity * 0.2); // 20% margin requirement
        }, 0);
        const availableMargin = currentBalance - usedMargin;

        const accountData: AccountData = {
            walletBalance: currentBalance,
            availableMargin,
            usedMargin,
            realizedPnl,
            unrealizedPnl,
            totalPnl: realizedPnl + unrealizedPnl,
            startingCapital,
        };

        // Store for consistency
        localStorage.setItem('algotrader_account', JSON.stringify(accountData));

        return accountData;
    }

    async updateBalance(newBalance: number): Promise<void> {
        await new Promise(resolve => setTimeout(resolve, 100));

        const accountData = await this.getAccountData();
        accountData.walletBalance = newBalance;
        localStorage.setItem('algotrader_account', JSON.stringify(accountData));
    }
}

export const accountService = new AccountService();
