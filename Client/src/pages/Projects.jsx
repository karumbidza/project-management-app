// FOLLO SLA
import { useState, useMemo } from "react";
import { useSelector, shallowEqual } from "react-redux";
import { Plus, Search, FolderOpen, AlertCircle } from "lucide-react";
import ProjectCard from "../components/ProjectCard";
import CreateProjectDialog from "../components/CreateProjectDialog";
import CreateWorkspaceDialog from "../components/CreateWorkspaceDialog";
import useUserRole from "../hooks/useUserRole";

// Stable empty array to prevent selector re-renders
const EMPTY_ARRAY = [];

export default function Projects() {
    const { canCreateProjects } = useUserRole();

    const currentWorkspace = useSelector((state) => state?.workspace?.currentWorkspace);
    const hasWorkspace = Boolean(currentWorkspace?.id);
    
    const projects = useSelector(
        (state) => state?.workspace?.currentWorkspace?.projects ?? EMPTY_ARRAY,
        shallowEqual
    );

    const [searchTerm, setSearchTerm] = useState("");
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [showCreateWorkspace, setShowCreateWorkspace] = useState(false);
    const [filters, setFilters] = useState({
        status: "ALL",
        priority: "ALL",
    });

    // Use useMemo for derived state instead of useState + useEffect
    const filteredProjects = useMemo(() => {
        let filtered = projects;

        if (searchTerm) {
            filtered = filtered.filter(
                (project) =>
                    project.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    project.description?.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        if (filters.status !== "ALL") {
            filtered = filtered.filter((project) => project.status === filters.status);
        }

        if (filters.priority !== "ALL") {
            filtered = filtered.filter(
                (project) => project.priority === filters.priority
            );
        }

        return filtered;
    }, [projects, searchTerm, filters]);

    // Guard: if dialog opens without workspace, close it
    const handleOpenCreateProject = () => {
        if (!hasWorkspace) {
            setShowCreateWorkspace(true);
            return;
        }
        setIsDialogOpen(true);
    };

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            {/* No-workspace banner */}
            {!hasWorkspace && (
                <div className="flex items-center gap-3 p-4 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300">
                    <AlertCircle className="size-5 shrink-0" />
                    <div className="flex-1 text-sm">
                        <span className="font-medium">No workspace found.</span> Create a workspace to get started.
                    </div>
                    <button onClick={() => setShowCreateWorkspace(true)} className="px-4 py-1.5 text-sm rounded bg-amber-600 text-white hover:bg-amber-700 transition whitespace-nowrap">
                        Create Workspace
                    </button>
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                <div>
                    <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white mb-1"> Projects </h1>
                    <p className="text-gray-500 dark:text-zinc-400 text-sm"> Manage and track your projects </p>
                </div>
                {canCreateProjects && (
                    <div className="relative group">
                        <button onClick={handleOpenCreateProject} disabled={!hasWorkspace} className={`flex items-center px-5 py-2 text-sm rounded bg-gradient-to-br from-blue-500 to-blue-600 text-white transition ${!hasWorkspace ? "opacity-50 cursor-not-allowed" : "hover:opacity-90"}`} >
                            <Plus className="size-4 mr-2" /> New Project
                        </button>
                        {!hasWorkspace && (
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 text-xs rounded bg-zinc-800 text-white whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
                                Create a workspace first before adding projects
                            </div>
                        )}
                    </div>
                )}
                <CreateProjectDialog isDialogOpen={isDialogOpen} setIsDialogOpen={setIsDialogOpen} />
            </div>

            {/* Search and Filters */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative w-full max-w-sm">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-zinc-400 w-4 h-4" />
                    <input onChange={(e) => setSearchTerm(e.target.value)} value={searchTerm} className="w-full pl-10 text-sm pr-4 py-2 rounded-lg border border-gray-300 dark:border-zinc-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-400 focus:border-blue-500 outline-none" placeholder="Search projects..." />
                </div>
                <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className="px-3 py-2 rounded-lg border border-gray-300 dark:border-zinc-700 text-gray-900 dark:text-white text-sm" >
                    <option value="ALL">All Status</option>
                    <option value="ACTIVE">Active</option>
                    <option value="PLANNING">Planning</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="ON_HOLD">On Hold</option>
                    <option value="CANCELLED">Cancelled</option>
                </select>
                <select value={filters.priority} onChange={(e) => setFilters({ ...filters, priority: e.target.value })} className="px-3 py-2 rounded-lg border border-gray-300 dark:border-zinc-700 text-gray-900 dark:text-white text-sm" >
                    <option value="ALL">All Priority</option>
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                </select>
            </div>

            {/* Projects Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredProjects.length === 0 ? (
                    <div className="col-span-full text-center py-16">
                        <div className="w-24 h-24 mx-auto mb-6 bg-gray-200 dark:bg-zinc-800 rounded-full flex items-center justify-center">
                            <FolderOpen className="w-12 h-12 text-gray-400 dark:text-zinc-500" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                            No projects found
                        </h3>
                        <p className="text-gray-500 dark:text-zinc-400 mb-6 text-sm">
                            Create your first project to get started
                        </p>
                        <button onClick={handleOpenCreateProject} disabled={!hasWorkspace} className={`flex items-center gap-1.5 px-4 py-2 rounded mx-auto text-sm ${hasWorkspace ? "bg-blue-500 hover:bg-blue-600 text-white" : "bg-zinc-300 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400 cursor-not-allowed"}`} >
                            <Plus className="size-4" />
                            {hasWorkspace ? "Create Project" : "Create Workspace First"}
                        </button>
                    </div>
                ) : (
                    filteredProjects.filter(p => p?.id).map((project) => (
                        <ProjectCard key={project.id} project={project} />
                    ))
                )}
            </div>
            {/* Create Workspace Dialog */}
            {showCreateWorkspace && (
                <CreateWorkspaceDialog isOpen={showCreateWorkspace} onClose={() => setShowCreateWorkspace(false)} />
            )}
        </div>
    );
}
