import { useEffect, useRef } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import { setCurrentProject } from '../features/workspaceSlice'
import MyTasksSidebar from './MyTasksSidebar'
import { 
    LayoutDashboardIcon, 
    FolderOpenIcon, 
    CheckSquareIcon,
    GanttChart,
    ChevronDownIcon,
    UserCircle
} from 'lucide-react'
import { useUser } from '@clerk/clerk-react'

const MemberSidebar = ({ isSidebarOpen, setIsSidebarOpen }) => {
    const { myProjects, currentProject } = useSelector((state) => state.workspace);
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { user } = useUser();
    const sidebarRef = useRef(null);

    // Menu items for members - limited compared to admin
    const menuItems = [
        { name: 'My Dashboard', href: '/', icon: LayoutDashboardIcon },
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

    const handleProjectChange = (projectId) => {
        dispatch(setCurrentProject(projectId));
        navigate(`/project?id=${projectId}&tab=tasks`);
    };

    return (
        <div 
            ref={sidebarRef} 
            className={`z-10 bg-white dark:bg-zinc-900 min-w-68 flex flex-col h-screen border-r border-gray-200 dark:border-zinc-800 max-sm:absolute transition-all ${isSidebarOpen ? 'left-0' : '-left-full'}`}
        >
            {/* Member Profile Header */}
            <div className="p-4 border-b border-gray-200 dark:border-zinc-800">
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

            {/* My Projects Section */}
            <div className="flex-1 overflow-y-auto p-4">
                <div className="mb-3">
                    <h3 className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wider px-2">
                        My Projects ({myProjects?.length || 0})
                    </h3>
                </div>
                
                <div className="space-y-1">
                    {myProjects?.map((project) => (
                        <button
                            key={project.id}
                            onClick={() => handleProjectChange(project.id)}
                            className={`w-full flex items-center gap-3 py-2.5 px-3 rounded-lg transition-all text-left ${
                                currentProject?.id === project.id 
                                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800' 
                                    : 'text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800'
                            }`}
                        >
                            <FolderOpenIcon size={16} className={currentProject?.id === project.id ? 'text-blue-500' : 'text-gray-400'} />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{project.name}</p>
                                <p className="text-xs text-gray-500 dark:text-zinc-500 truncate">
                                    {project.myRole || 'Member'} • {project.tasks?.length || 0} tasks
                                </p>
                            </div>
                        </button>
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

            {/* Current Project Quick Actions */}
            {currentProject && (
                <div className="p-4 border-t border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/50">
                    <p className="text-xs text-gray-500 dark:text-zinc-400 mb-2">Current Project</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white mb-3 truncate">
                        {currentProject.name}
                    </p>
                    <div className="flex gap-2">
                        <button 
                            onClick={() => navigate(`/project?id=${currentProject.id}&tab=tasks`)}
                            className="flex-1 text-xs py-2 px-3 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
                        >
                            View Tasks
                        </button>
                        <button 
                            onClick={() => navigate(`/project?id=${currentProject.id}&tab=gantt`)}
                            className="flex-1 text-xs py-2 px-3 bg-gray-200 dark:bg-zinc-700 text-gray-700 dark:text-zinc-300 rounded hover:bg-gray-300 dark:hover:bg-zinc-600 transition"
                        >
                            <GanttChart size={12} className="inline mr-1" />
                            Gantt
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}

export default MemberSidebar
