// FOLLO ROLE-FLASH
// TASKK BRAND
// Neutral skeleton shown while role is being determined.
// Never shows admin OR member UI — eliminates role flash entirely.
export default function AppLoadingSkeleton() {
    return (
        <div className="flex h-screen overflow-hidden bg-white dark:bg-zinc-950">
            {/* Sidebar skeleton */}
            <div className="w-60 shrink-0 border-r border-zinc-200 dark:border-zinc-800 p-4 flex flex-col gap-2">
                {/* TASKK BRAND — skeleton brand mark */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                    <svg viewBox="0 0 64 64" width="28" height="28">
                        <rect width="64" height="64" rx="14" fill="#0a0a0a"/>
                        <rect x="16" y="17" width="10" height="10" rx="2.5" fill="#fff"/>
                        <rect x="32" y="19" width="17" height="5" rx="2" fill="#fff"/>
                        <rect x="16" y="32" width="10" height="10" rx="2.5" fill="#fff"/>
                        <rect x="32" y="34" width="12" height="5" rx="2" fill="#fff"/>
                        <rect x="16" y="47" width="10" height="5" rx="2" fill="rgba(255,255,255,0.3)"/>
                        <rect x="32" y="47" width="17" height="5" rx="2" fill="rgba(255,255,255,0.3)"/>
                    </svg>
                    <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text-primary)' }}>Taskk</span>
                </div>
                {/* Workspace picker */}
                <div className="h-9 rounded-lg bg-zinc-100 dark:bg-zinc-800 animate-pulse mb-4" />
                {/* Nav items */}
                {[1, 2, 3, 4, 5].map(i => (
                    <div
                        key={i}
                        className="h-9 rounded-lg bg-zinc-100 dark:bg-zinc-800 animate-pulse"
                        style={{ opacity: 1 - i * 0.12 }}
                    />
                ))}
            </div>

            {/* Main area */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Navbar skeleton */}
                <div className="h-14 border-b border-zinc-200 dark:border-zinc-800 px-6 flex items-center justify-between">
                    <div className="h-5 w-36 rounded bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
                    <div className="h-8 w-8 rounded-full bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
                </div>

                {/* Content skeleton */}
                <div className="flex-1 p-8 flex flex-col gap-4">
                    <div className="h-7 w-48 rounded-lg bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
                    {[1, 2, 3].map(i => (
                        <div
                            key={i}
                            className="h-20 rounded-xl bg-zinc-100 dark:bg-zinc-800 animate-pulse"
                            style={{ opacity: 1 - i * 0.2 }}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
