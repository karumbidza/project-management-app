// FOLLO DASHBOARD
import { useEffect, useRef } from "react";
import { X } from "lucide-react";

/**
 * SlidePanel — slides in from the right
 * Props: isOpen, onClose, title, children
 */
const SlidePanel = ({ isOpen, onClose, title, children }) => {
    const panelRef = useRef(null);

    // Close on Escape key
    useEffect(() => {
        if (!isOpen) return;
        const handleKey = (e) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("keydown", handleKey);
        return () => document.removeEventListener("keydown", handleKey);
    }, [isOpen, onClose]);

    // Close on click outside
    const handleBackdropClick = (e) => {
        if (panelRef.current && !panelRef.current.contains(e.target)) {
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex justify-end"
            onClick={handleBackdropClick}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/40 dark:bg-black/60" />

            {/* Panel */}
            <div
                ref={panelRef}
                className="relative w-full sm:w-[420px] h-full bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col animate-slide-in-right"
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
                    <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">{title}</h2>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 transition"
                    >
                        <X className="size-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4">
                    {children}
                </div>
            </div>

            <style>{`
                @keyframes slideInRight {
                    from { transform: translateX(100%); }
                    to { transform: translateX(0); }
                }
                .animate-slide-in-right {
                    animation: slideInRight 0.2s ease-out;
                }
            `}</style>
        </div>
    );
};

export default SlidePanel;
