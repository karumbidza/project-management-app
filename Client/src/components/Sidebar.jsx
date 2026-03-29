// TASKK BRAND
// TASKK MOBILE
import { useEffect, useRef } from 'react'
import { NavLink } from 'react-router-dom'
import MyTasksSidebar from './MyTasksSidebar'
import ProjectSidebar from './ProjectsSidebar'
import WorkspaceDropdown from './WorkspaceDropdown'
import { BarChart3, FolderOpenIcon, LayoutDashboardIcon, SettingsIcon, UsersIcon } from 'lucide-react'
import useUserRole from '../hooks/useUserRole'

const Sidebar = ({ isSidebarOpen, setIsSidebarOpen, collapsed = false }) => {
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
        <div
            ref={sidebarRef}
            className={`z-10 bg-white dark:bg-zinc-900 flex flex-col h-screen border-r border-gray-200 dark:border-zinc-800 max-sm:absolute transition-all ${isSidebarOpen ? 'left-0' : '-left-full'}`}
            style={{ width: collapsed ? 56 : undefined, minWidth: collapsed ? 56 : undefined }}
        >
            {/* TASKK MOBILE: hide workspace dropdown in collapsed (tablet) mode */}
            {!collapsed && <WorkspaceDropdown />}
            <div className='flex-1 overflow-y-scroll no-scrollbar flex flex-col'>
                <div>
                    <div className='p-2'>
                        {menuItems.map((item) => (
                            <NavLink
                                to={item.href}
                                key={item.name}
                                title={collapsed ? item.name : undefined}
                                className={({ isActive }) => `flex items-center gap-3 py-2 rounded transition-all ${collapsed ? 'justify-center px-2' : 'px-4'} ${isActive ? 'bg-gray-100 dark:bg-zinc-900 dark:bg-gradient-to-br dark:from-zinc-800 dark:to-zinc-800/50 dark:ring-zinc-800' : 'hover:bg-gray-50 dark:hover:bg-zinc-800/60'} text-gray-800 dark:text-zinc-100 cursor-pointer`}
                            >
                                <item.icon size={16} />
                                {!collapsed && <p className='text-sm truncate'>{item.name}</p>}
                            </NavLink>
                        ))}
                    </div>
                    {!collapsed && <MyTasksSidebar />}
                    {!collapsed && <ProjectSidebar />}
                </div>
            </div>
        </div>
    )
}

export default Sidebar
