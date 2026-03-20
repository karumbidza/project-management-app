// FOLLO ACCESS
// FOLLO CLEAN-NAV
import { useState, useEffect, useRef } from 'react'
import { NavLink, useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import { setCurrentProject } from '../features/workspaceSlice'
import MyTasksSidebar from './MyTasksSidebar'
import {
    FolderOpenIcon,
    CheckSquareIcon,
    GanttChart,
    ChevronRightIcon,
    UserCircle,
    KanbanIcon,
    CalendarIcon
} from 'lucide-react'
import { useUser } from '@clerk/clerk-react'

// FOLLO CLEAN-NAV: Projects page is admin-only. Members navigate projects
// through the "My Projects" expandable tree below, not via a top-level nav item.

const getProjectSubItems = (projectId) => [
    { title: 'Tasks', icon: KanbanIcon, tab: 'tasks' },
    { title: 'Gantt', icon: GanttChart, tab: 'gantt' },
    { title: 'Calendar', icon: CalendarIcon, tab: 'calendar' },
];

const MemberSidebar = ({ isSidebarOpen, setIsSidebarOpen }) => {
    const { myProjects, currentProject } = useSelector((state) => state.workspace);
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const { user } = useUser();
    const sidebarRef = useRef(null);
    const [expandedProjects, setExpandedProjects] = useState(new Set());

    // FOLLO ACCESS: My Tasks is the member's primary/home view.
    // Projects nav is intentionally excluded — it's an admin-only page.
    const menuItems = [
        { name: 'My Tasks', href: '/tasks', icon: CheckSquareIcon },
    ];

    useEffect(() => {
        function handleClickOutside(event) {
            if (sidebarRef.current && !sidebarRef.current.contains(event.target)) {
                setIsSidebarOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [setIsSidebarOpen]);

    const toggleProject = (id) => {
        const newSet = new Set(expandedProjects);
        newSet.has(id) ? newSet.delete(id) : newSet.add(id);
        setExpandedProjects(newSet);
    };

    return (
        <div 
            ref={sidebarRef} 
            className={`z-10 bg-white dark:bg-zinc-900 min-w-68 flex flex-col h-screen border-r border-gray-200 dark:border-zinc-800 max-sm:absolute transition-all ${isSidebarOpen ? 'left-0' : '-left-full'}`}
        >
            {/* Member Profile Header */}
            <div className="px-4 h-[70px] flex items-center border-b border-gray-200 dark:border-zinc-800">
                <div className="flex items-center gap-3">
                    {user?.imageUrl ? (
                        <img 
                            src={user.imageUrl} 
                            alt={user.fullName} 
                            className="w-10 h-10 rounded-full"
                        />
                    ) : (
                        <UserCircle className="w-10 h-10 text-gray-400" />
                    )}
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {user?.fullName || 'Member'}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-zinc-400 truncate">
                            Team Member
                        </p>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <div className="p-4">
                {menuItems.map((item) => (
                    <NavLink 
                        to={item.href} 
                        key={item.name} 
                        className={({ isActive }) => `flex items-center gap-3 py-2 px-4 text-gray-800 dark:text-zinc-100 cursor-pointer rounded transition-all ${isActive ? 'bg-gray-100 dark:bg-zinc-800' : 'hover:bg-gray-50 dark:hover:bg-zinc-800/60'}`}
                    >
                        <item.icon size={16} />
                        <p className='text-sm truncate'>{item.name}</p>
                    </NavLink>
                ))}
            </div>

            <hr className='border-gray-200 dark:border-zinc-800' />

            {/* My Projects Section — expandable tree */}
            <div className="flex-1 overflow-y-auto p-4">
                <div className="mb-3">
                    <h3 className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wider px-2">
                        My Projects ({myProjects?.length || 0})
                    </h3>
                </div>
                
                <div className="space-y-1">
                    {myProjects?.map((project) => (
                        <div key={project.id}>
                            <button
                                onClick={() => toggleProject(project.id)}
                                className={`w-full flex items-center gap-2 py-2 px-3 rounded-lg transition-colors text-sm text-left ${
                                    expandedProjects.has(project.id)
                                        ? 'text-gray-900 dark:text-white'
                                        : 'text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800'
                                }`}
                            >
                                <ChevronRightIcon className={`size-3 text-gray-400 transition-transform ${expandedProjects.has(project.id) && 'rotate-90'}`} />
                                <div className="size-2 rounded-full bg-blue-500 shrink-0" />
                                <span className="truncate">{project.name}</span>
                            </button>

                            {expandedProjects.has(project.id) && (
                                <div className="ml-5 mt-1 space-y-0.5">
                                    {getProjectSubItems(project.id).map((subItem) => {
                                        const isActive =
                                            location.pathname === '/project' &&
                                            searchParams.get('id') === project.id &&
                                            searchParams.get('tab') === subItem.tab;

                                        return (
                                            <button
                                                key={subItem.title}
                                                onClick={() => {
                                                    dispatch(setCurrentProject(project.id));
                                                    navigate(`/project?id=${project.id}&tab=${subItem.tab}`);
                                                }}
                                                className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg transition-colors text-xs ${
                                                    isActive
                                                        ? 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400'
                                                        : 'text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-zinc-800'
                                                }`}
                                            >
                                                <subItem.icon className="size-3" />
                                                {subItem.title}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    ))}

                    {(!myProjects || myProjects.length === 0) && (
                        <div className="text-center py-8 text-gray-500 dark:text-zinc-500">
                            <FolderOpenIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                            <p className="text-sm">No projects assigned yet</p>
                            <p className="text-xs mt-1">Wait for an admin to invite you</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default MemberSidebar
