// TASKK BRAND
import { useEffect, useRef } from 'react'
import { NavLink } from 'react-router-dom'
import MyTasksSidebar from './MyTasksSidebar'
import ProjectSidebar from './ProjectsSidebar'
import WorkspaceDropdown from './WorkspaceDropdown'
import { BarChart3, FolderOpenIcon, LayoutDashboardIcon, SettingsIcon, UsersIcon } from 'lucide-react'
import useUserRole from '../hooks/useUserRole'

const Sidebar = ({ isSidebarOpen, setIsSidebarOpen }) => {
    const { isAdmin, canViewReports, canManageMembers } = useUserRole();

    // Base menu items - visible to all
    const baseMenuItems = [
        { name: 'Dashboard', href: '/', icon: LayoutDashboardIcon },
        { name: 'Projects', href: '/projects', icon: FolderOpenIcon },
    ];

    // Admin-only menu items
    const adminMenuItems = [
        ...(canManageMembers ? [{ name: 'Team', href: '/team', icon: UsersIcon }] : []),
        ...(canViewReports ? [{ name: 'Reports', href: '/reports', icon: BarChart3 }] : []),
        ...(isAdmin ? [{ name: 'Settings', href: '/settings', icon: SettingsIcon }] : []),
    ];

    const menuItems = [...baseMenuItems, ...adminMenuItems];

    const sidebarRef = useRef(null);

    useEffect(() => {
        function handleClickOutside(event) {
            if (sidebarRef.current && !sidebarRef.current.contains(event.target)) {
                setIsSidebarOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [setIsSidebarOpen]);

    return (
        <div ref={sidebarRef} className={`z-10 bg-white dark:bg-zinc-900 min-w-68 flex flex-col h-screen border-r border-gray-200 dark:border-zinc-800 max-sm:absolute transition-all ${isSidebarOpen ? 'left-0' : '-left-full'} `} >
            {/* TASKK BRAND — sidebar wordmark */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '16px 20px 12px' }}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="28" height="28" style={{ flexShrink: 0 }}>
                    <rect width="64" height="64" rx="14" fill="#0a0a0a"/>
                    <rect x="16" y="17" width="10" height="10" rx="2.5" fill="#ffffff"/>
                    <rect x="32" y="19" width="17" height="5" rx="2" fill="#ffffff"/>
                    <rect x="16" y="32" width="10" height="10" rx="2.5" fill="#ffffff"/>
                    <rect x="32" y="34" width="12" height="5" rx="2" fill="#ffffff"/>
                    <rect x="16" y="47" width="10" height="5" rx="2" fill="rgba(255,255,255,0.28)"/>
                    <rect x="32" y="47" width="17" height="5" rx="2" fill="rgba(255,255,255,0.28)"/>
                </svg>
                <span style={{ fontSize: '16px', fontWeight: 600, letterSpacing: '-0.5px', color: 'var(--color-text-primary)', lineHeight: 1 }}>Taskk</span>
            </div>
            <WorkspaceDropdown />
            <div className='flex-1 overflow-y-scroll no-scrollbar flex flex-col'>
                <div>
                    <div className='p-4'>
                        {menuItems.map((item) => (
                            <NavLink to={item.href} key={item.name} className={({ isActive }) => `flex items-center gap-3 py-2 px-4 text-gray-800 dark:text-zinc-100 cursor-pointer rounded transition-all  ${isActive ? 'bg-gray-100 dark:bg-zinc-900 dark:bg-gradient-to-br dark:from-zinc-800 dark:to-zinc-800/50  dark:ring-zinc-800' : 'hover:bg-gray-50 dark:hover:bg-zinc-800/60'}`} >
                                <item.icon size={16} />
                                <p className='text-sm truncate'>{item.name}</p>
                            </NavLink>
                        ))}
                    </div>
                    <MyTasksSidebar />
                    <ProjectSidebar />
                </div>


            </div>

        </div>
    )
}

export default Sidebar
