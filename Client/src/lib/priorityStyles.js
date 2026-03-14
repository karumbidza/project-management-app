// FOLLO WORKFLOW — shared priority display helper
const map = {
    CRITICAL: { bg: 'bg-red-100 dark:bg-red-900/30', color: 'text-red-700 dark:text-red-400', label: 'Critical', dot: 'bg-red-500' },
    HIGH:     { bg: 'bg-orange-100 dark:bg-orange-900/30', color: 'text-orange-700 dark:text-orange-400', label: 'High', dot: 'bg-orange-500' },
    MEDIUM:   { bg: 'bg-yellow-100 dark:bg-yellow-900/30', color: 'text-yellow-700 dark:text-yellow-400', label: 'Medium', dot: 'bg-yellow-500' },
    LOW:      { bg: 'bg-green-100 dark:bg-green-900/30', color: 'text-green-700 dark:text-green-400', label: 'Low', dot: 'bg-green-500' },
};

const fallback = { bg: 'bg-zinc-100 dark:bg-zinc-800', color: 'text-zinc-600 dark:text-zinc-400', label: 'None', dot: 'bg-zinc-400' };

export const getPriorityStyle = (priority) => map[priority] || fallback;
