import type { WalletState, MarginLock, PnLSummary } from '../types/trading';
import { EventEmitter } from '../utils/EventEmitter';

const INITIAL_CAPITAL = 100000;
const STORAGE_KEY = 'algotrader_wallet';

// MarginLock, PnLSummary imported from types/trading

class PaperWalletService extends EventEmitter {
    private wallet: WalletState;
    private marginLocks: Map<string, MarginLock> = new Map();
    private peakBalance: number;
    private initialCapital: number;

    constructor() {
        super();
        this.initialCapital = INITIAL_CAPITAL;
        this.wallet = this.loadWallet();
        this.peakBalance = this.wallet.balance;
    }

    private loadWallet(): WalletState {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                return JSON.parse(stored);
            } catch (e) {
                console.error('Failed to load wallet from storage', e);
            }
        }
        return this.defaultWallet();
    }

    private defaultWallet(): WalletState {
        return {
            balance: this.initialCapital,
            usedMargin: 0,
            availableMargin: this.initialCapital,
            realizedPnl: 0,
            unrealizedPnl: 0,
        };
    }

    private saveWallet(): void {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.wallet));
        this.emit('wallet:updated', this.getWallet());
    }

    getWallet(): WalletState {
        return { ...this.wallet };
    }

    getBalance(): number { return this.wallet.balance; }
    getAvailable(): number { return this.wallet.availableMargin; }
    getLocked(): number { return this.wallet.usedMargin; }

    /** Lock margin for a specific order */
    lockMargin(orderId: string, amount: number): boolean {
        if (this.wallet.availableMargin < amount) {
            this.emit('wallet:insufficientFunds', { orderId, required: amount, available: this.wallet.availableMargin });
            return false;
        }
        this.marginLocks.set(orderId, { orderId, amount, lockedAt: new Date() });
        this.wallet.usedMargin += amount;
        this.wallet.availableMargin = this.wallet.balance - this.wallet.usedMargin + this.wallet.unrealizedPnl;
        this.saveWallet();
        this.emit('wallet:marginLocked', { orderId, amount });
        return true;
    }

    /** Release margin for a specific order (on fill, cancel, or reject) */
    releaseMargin(orderId: string): number {
        const lock = this.marginLocks.get(orderId);
        if (!lock) return 0;
        this.marginLocks.delete(orderId);
        this.wallet.usedMargin = Math.max(0, this.wallet.usedMargin - lock.amount);
        this.wallet.availableMargin = this.wallet.balance - this.wallet.usedMargin + this.wallet.unrealizedPnl;
        this.saveWallet();
        this.emit('wallet:marginReleased', { orderId, amount: lock.amount });
        return lock.amount;
    }

    /** Legacy reserve — used by engine if it doesn't track orderId */
    reserveCapital(amount: number): boolean {
        if (this.wallet.availableMargin < amount) return false;
        this.wallet.usedMargin += amount;
        this.wallet.availableMargin = this.wallet.balance - this.wallet.usedMargin;
        this.saveWallet();
        return true;
    }

    releaseCapital(amount: number): void {
        this.wallet.usedMargin = Math.max(0, this.wallet.usedMargin - amount);
        this.wallet.availableMargin = this.wallet.balance - this.wallet.usedMargin;
        this.saveWallet();
    }

    updateUnrealizedPnl(pnl: number): void {
        this.wallet.unrealizedPnl = Math.round(pnl * 100) / 100;
        this.wallet.availableMargin = this.wallet.balance - this.wallet.usedMargin + this.wallet.unrealizedPnl;
        this.saveWallet();
    }

    recordRealizedPnl(pnl: number): void {
        this.wallet.balance = Math.round((this.wallet.balance + pnl) * 100) / 100;
        this.wallet.realizedPnl = Math.round((this.wallet.realizedPnl + pnl) * 100) / 100;
        this.wallet.availableMargin = this.wallet.balance - this.wallet.usedMargin + this.wallet.unrealizedPnl;
        if (this.wallet.balance > this.peakBalance) {
            this.peakBalance = this.wallet.balance;
        }
        this.saveWallet();
        this.emit('wallet:pnlRecorded', { pnl, balance: this.wallet.balance });
    }

    getPnLSummary(): PnLSummary {
        const drawdown = this.peakBalance - this.wallet.balance;
        return {
            totalRealizedPnl: this.wallet.realizedPnl,
            totalUnrealizedPnl: this.wallet.unrealizedPnl,
            netPnl: Math.round((this.wallet.realizedPnl + this.wallet.unrealizedPnl) * 100) / 100,
            returnPercent: Math.round(((this.wallet.balance - this.initialCapital) / this.initialCapital) * 10000) / 100,
            peakBalance: this.peakBalance,
            drawdown: Math.round(drawdown * 100) / 100,
            drawdownPercent: this.peakBalance > 0 ? Math.round((drawdown / this.peakBalance) * 10000) / 100 : 0,
        };
    }

    hasAvailable(amount: number): boolean {
        return this.wallet.availableMargin >= amount;
    }

    reset(): void {
        this.wallet = this.defaultWallet();
        this.marginLocks.clear();
        this.peakBalance = this.initialCapital;
        this.saveWallet();
        this.emit('wallet:reset', this.getWallet());
    }

    setInitialCapital(amount: number): void {
        this.initialCapital = amount;
        this.reset();
    }
}

export const paperWalletService = new PaperWalletService();
