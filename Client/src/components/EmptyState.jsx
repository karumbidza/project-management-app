// FOLLO ACCESS-UX
const EmptyState = ({
    icon: Icon,
    emoji,
    title,
    description,
    action,
    actionLabel,
    secondaryAction,
    secondaryActionLabel,
    className = '',
}) => (
    <div className={`flex flex-col items-center justify-center py-16 text-center px-6 ${className}`}>
        {emoji && <div className="text-4xl mb-4">{emoji}</div>}
        {Icon && !emoji && <Icon className="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-zinc-600" />}
        <p className="text-base font-medium text-gray-700 dark:text-zinc-300 mb-2">{title}</p>
        {description && (
            <p className="text-sm text-gray-400 dark:text-zinc-500 max-w-sm mx-auto leading-relaxed">
                {description}
            </p>
        )}
        {(action || secondaryAction) && (
            <div className="flex items-center gap-3 mt-5">
                {action && (
                    <button
                        onClick={action}
                        className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition"
                    >
                        {actionLabel}
                    </button>
                )}
                {secondaryAction && (
                    <button
                        onClick={secondaryAction}
                        className="px-4 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
                    >
                        {secondaryActionLabel}
                    </button>
                )}
            </div>
        )}
    </div>
);

export default EmptyState;
