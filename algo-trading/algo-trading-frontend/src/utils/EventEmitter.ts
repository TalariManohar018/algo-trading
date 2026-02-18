/**
 * Simple EventEmitter implementation for browser
 * Provides a lightweight event system for the paper trading engine
 */

export type EventHandler = (...args: any[]) => void;

export class EventEmitter {
    private events: Map<string, EventHandler[]> = new Map();

    on(event: string, handler: EventHandler): void {
        if (!this.events.has(event)) {
            this.events.set(event, []);
        }
        this.events.get(event)!.push(handler);
    }

    off(event: string, handler: EventHandler): void {
        const handlers = this.events.get(event);
        if (handlers) {
            const index = handlers.indexOf(handler);
            if (index !== -1) {
                handlers.splice(index, 1);
            }
        }
    }

    emit(event: string, ...args: any[]): void {
        const handlers = this.events.get(event);
        if (handlers) {
            handlers.forEach(handler => {
                try {
                    handler(...args);
                } catch (error) {
                    console.error(`Error in event handler for "${event}":`, error);
                }
            });
        }
    }

    removeAllListeners(event?: string): void {
        if (event) {
            this.events.delete(event);
        } else {
            this.events.clear();
        }
    }

    listenerCount(event: string): number {
        return this.events.get(event)?.length || 0;
    }
}
