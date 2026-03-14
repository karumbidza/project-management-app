// FOLLO SRP
import { PenIcon } from "lucide-react";

const ProjectInfoCard = ({ project, formatDate }) => {
    if (!project) return null;

    return (
        <div className="p-4 rounded-md bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 border border-gray-300 dark:border-zinc-800 ">
            <p className="text-xl font-medium mb-4">Project Details</p>
            <h2 className="text-gray-900 dark:text-zinc-100 flex items-center gap-2"> <PenIcon className="size-4" /> {project.name}</h2>
            <p className="text-xs mt-3">Project Start Date: {formatDate(project.startDate)}</p>
            <div className="flex flex-wrap gap-4 text-sm text-gray-500 dark:text-zinc-400 mt-3">
                <span>Status: {project.status}</span>
                <span>Priority: {project.priority}</span>
                <span>Progress: {project.progress}%</span>
            </div>
        </div>
    );
};

export default ProjectInfoCard;
