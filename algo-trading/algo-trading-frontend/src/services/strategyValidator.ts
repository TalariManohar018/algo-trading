import { ExecutableStrategy, StrategyCondition } from '../types/strategy';
import { conditionEngine } from './conditionEngine';

export interface ValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}

class StrategyValidator {
    /**
     * Validate complete strategy
     */
    validateStrategy(strategy: Partial<ExecutableStrategy>): ValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];

        // Required fields
        if (!strategy.name || strategy.name.trim().length === 0) {
            errors.push('Strategy name is required');
        }

        if (!strategy.symbol || strategy.symbol.trim().length === 0) {
            errors.push('Symbol is required');
        }

        if (!strategy.instrumentType) {
            errors.push('Instrument type is required');
        }

        if (!strategy.timeframe) {
            errors.push('Timeframe is required');
        }

        if (!strategy.quantity || strategy.quantity <= 0) {
            errors.push('Quantity must be greater than 0');
        }

        if (!strategy.orderType) {
            errors.push('Order type is required');
        }

        if (!strategy.productType) {
            errors.push('Product type is required');
        }

        if (!strategy.maxTradesPerDay || strategy.maxTradesPerDay <= 0) {
            errors.push('Max trades per day must be greater than 0');
        }

        // Validate entry conditions
        if (!strategy.entryConditions || strategy.entryConditions.length === 0) {
            errors.push('At least one entry condition is required');
        } else {
            const entryValidation = conditionEngine.validateConditions(strategy.entryConditions);
            if (!entryValidation.valid) {
                errors.push(...entryValidation.errors.map(e => `Entry: ${e}`));
            }
        }

        // Validate exit conditions
        if (!strategy.exitConditions || strategy.exitConditions.length === 0) {
            warnings.push('No exit conditions defined - positions may not close automatically');
        } else {
            const exitValidation = conditionEngine.validateConditions(strategy.exitConditions);
            if (!exitValidation.valid) {
                errors.push(...exitValidation.errors.map(e => `Exit: ${e}`));
            }
        }

        // Validate trading window
        if (!strategy.tradingWindow) {
            errors.push('Trading window is required');
        } else {
            if (!strategy.tradingWindow.startTime || !strategy.tradingWindow.endTime) {
                errors.push('Trading window start and end times are required');
            } else if (strategy.tradingWindow.startTime >= strategy.tradingWindow.endTime) {
                errors.push('Trading window end time must be after start time');
            }
        }

        // Validate square off time
        if (!strategy.squareOffTime) {
            errors.push('Square off time is required');
        }

        // Validate risk config
        if (!strategy.riskConfig) {
            warnings.push('Risk configuration is missing');
        } else {
            if (!strategy.riskConfig.maxLossPerTrade || strategy.riskConfig.maxLossPerTrade <= 0) {
                errors.push('Max loss per trade must be greater than 0');
            }

            if (strategy.riskConfig.stopLossPercent !== undefined && strategy.riskConfig.stopLossPercent <= 0) {
                errors.push('Stop loss percent must be greater than 0');
            }

            if (strategy.riskConfig.takeProfitPercent !== undefined && strategy.riskConfig.takeProfitPercent <= 0) {
                errors.push('Take profit percent must be greater than 0');
            }

            if (strategy.riskConfig.stopLossPercent && strategy.riskConfig.takeProfitPercent) {
                if (strategy.riskConfig.takeProfitPercent <= strategy.riskConfig.stopLossPercent) {
                    warnings.push('Take profit should ideally be greater than stop loss');
                }
            }
        }

        // Check for conflicting conditions
        if (strategy.entryConditions && strategy.exitConditions) {
            const conflicts = this.checkConflictingConditions(strategy.entryConditions, strategy.exitConditions);
            if (conflicts.length > 0) {
                warnings.push(...conflicts);
            }
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings,
        };
    }

    /**
     * Check for conflicting entry/exit conditions
     */
    private checkConflictingConditions(entryConditions: StrategyCondition[], exitConditions: StrategyCondition[]): string[] {
        const warnings: string[] = [];

        // Check if entry and exit conditions are too similar
        for (const entry of entryConditions) {
            for (const exit of exitConditions) {
                if (entry.indicatorType === exit.indicatorType &&
                    entry.conditionType === exit.conditionType &&
                    Math.abs(entry.value - exit.value) < 1) {
                    warnings.push(`Entry and exit conditions for ${entry.indicatorType} are very similar`);
                }
            }
        }

        return warnings;
    }

    /**
     * Validate time format (HH:MM)
     */
    validateTimeFormat(time: string): boolean {
        const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
        return timeRegex.test(time);
    }
}

export const strategyValidator = new StrategyValidator();
