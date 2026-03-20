// FOLLO ROLE-FLASH
// Neutral skeleton shown while role is being determined.
// Never shows admin OR member UI — eliminates role flash entirely.
export default function AppLoadingSkeleton() {
    return (
        <div className="flex h-screen overflow-hidden bg-white dark:bg-zinc-950">
            {/* Sidebar skeleton */}
            <div className="w-60 shrink-0 border-r border-zinc-200 dark:border-zinc-800 p-4 flex flex-col gap-2">
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
