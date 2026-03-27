// FOLLO NAV
// FOLLO PROJECT-OVERVIEW
import { useMemo } from "react";
import { useSelector } from "react-redux";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeftIcon } from "lucide-react";
import ProjectOverview from "../components/project/ProjectOverview";
import EmptyState from "../components/EmptyState";
import useUserRole from "../hooks/useUserRole";

export default function ProjectOverviewPage() {
    const [searchParams] = useSearchParams();
    const id = searchParams.get("id");
    const navigate = useNavigate();
    const { isMemberView } = useUserRole();

    const workspaceProjects = useSelector((state) => state?.workspace?.currentWorkspace?.projects || []);
    const myProjects = useSelector((state) => state?.workspace?.myProjects || []);
    const projectsLoading = useSelector((state) => state?.workspace?.loadingStates?.myProjects || state?.workspace?.loadingStates?.workspaces);

    const project = useMemo(() => {
        if (!id) return null;
        return workspaceProjects.find(p => p.id === id) || myProjects.find(p => p.id === id) || null;
    }, [id, workspaceProjects, myProjects]);

    if (!project) {
        if (projectsLoading) {
            return (
                <div className="animate-pulse space-y-4 p-8 max-w-5xl mx-auto">
                    <div className="h-6 w-48 bg-gray-100 dark:bg-zinc-700 rounded" />
                    <div className="h-[400px] bg-gray-100 dark:bg-zinc-700 rounded-lg" />
                </div>
            );
        }
        return (
            <EmptyState
                emoji="🗂️"
                title="Project not found"
                description="This project may have been deleted, moved, or you may no longer have access."
                action={() => navigate("/projects")}
                actionLabel="Back to Projects"
            />
        );
    }

    return (
        <div className="max-w-6xl mx-auto px-6 py-8 text-zinc-900 dark:text-white">
            <div className="flex items-center gap-3 mb-6">
                <button
                    className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400"
                    onClick={() => navigate(`/projectsDetail?id=${id}&tab=tasks`)}
                >
                    <ArrowLeftIcon className="w-4 h-4" />
                </button>
                <h1 className="text-lg font-medium">{project.name}</h1>
                <span className="text-xs text-zinc-400 dark:text-zinc-500">Overview</span>
            </div>

            <ProjectOverview project={project} />
        </div>
    );
}
