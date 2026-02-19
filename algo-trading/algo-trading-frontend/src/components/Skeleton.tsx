// ============================================================
// SKELETON — Lightweight loading placeholders
// ============================================================

interface SkeletonRowProps { cols?: number; }

export function SkeletonRow({ cols = 6 }: SkeletonRowProps) {
    return (
        <tr className="border-b border-gray-50">
            {Array.from({ length: cols }).map((_, i) => (
                <td key={i} className="px-4 py-3">
                    <div className="skeleton-shimmer h-3.5 rounded w-full" />
                </td>
            ))}
        </tr>
    );
}

export function SkeletonTable({ rows = 5, cols = 6 }: { rows?: number; cols?: number }) {
    return (
        <>
            {Array.from({ length: rows }).map((_, i) => (
                <SkeletonRow key={i} cols={cols} />
            ))}
        </>
    );
}

export function SkeletonCard() {
    return (
        <div className="stat-card animate-pulse">
            <div className="skeleton h-3 w-24 mb-3 rounded" />
            <div className="skeleton h-7 w-32 mb-2 rounded" />
            <div className="skeleton h-3 w-20 rounded" />
        </div>
    );
}

export function SkeletonCards({ count = 3 }: { count?: number }) {
    return (
        <div className={`grid grid-cols-1 md:grid-cols-${count} gap-5`}>
            {Array.from({ length: count }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
    );
}
