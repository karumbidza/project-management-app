// TASKK MOBILE
import { useState, useEffect } from 'react';

export function useIsMobile(breakpoint = 768) {
    const [isMobile, setIsMobile] = useState(() => window.innerWidth < breakpoint);
    const [isTablet, setIsTablet] = useState(() => window.innerWidth >= breakpoint && window.innerWidth < 1024);

    useEffect(() => {
        const handler = () => {
            setIsMobile(window.innerWidth < breakpoint);
            setIsTablet(window.innerWidth >= breakpoint && window.innerWidth < 1024);
        };
        window.addEventListener('resize', handler);
        return () => window.removeEventListener('resize', handler);
    }, [breakpoint]);

    return { isMobile, isTablet };
}
