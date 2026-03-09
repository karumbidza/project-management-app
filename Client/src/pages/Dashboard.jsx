import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useUser } from '@clerk/clerk-react'
import { useSelector } from 'react-redux'
import StatsGrid from '../components/StatsGrid'
import ProjectOverview from '../components/ProjectOverview'
import RecentActivity from '../components/RecentActivity'
import TasksSummary from '../components/TasksSummary'
import GanttWidget from '../components/GanttWidget'
import CreateProjectDialog from '../components/CreateProjectDialog'
import useUserRole from '../hooks/useUserRole'
import MemberDashboard from '../components/MemberDashboard'

const Dashboard = () => {

    const { user } = useUser()
    const { isAdmin, canCreateProjects, isMemberView } = useUserRole()
    const [isDialogOpen, setIsDialogOpen] = useState(false)

    // Show member dashboard for project-only members
    if (isMemberView) {
        return <MemberDashboard />
    }

    return (
        <div className='max-w-6xl mx-auto'>
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 ">
                <div>
                    <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white mb-1"> Welcome back, {user?.fullName || 'User'} </h1>
                    <p className="text-gray-500 dark:text-zinc-400 text-sm">
                        {isAdmin 
                            ? "Here's what's happening with your projects today" 
                            : "Here are your assigned tasks and projects"}
                    </p>
                </div>

                {canCreateProjects && (
                    <button onClick={() => setIsDialogOpen(true)} className="flex items-center gap-2 px-5 py-2 text-sm rounded bg-gradient-to-br from-blue-500 to-blue-600 text-white space-x-2 hover:opacity-90 transition" >
                        <Plus size={16} /> New Project
                    </button>
                )}

                <CreateProjectDialog isDialogOpen={isDialogOpen} setIsDialogOpen={setIsDialogOpen} />
            </div>

            <StatsGrid />

            {/* Gantt Timeline Widget */}
            <div className="mb-8">
                <GanttWidget />
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    <ProjectOverview />
                    {isAdmin && <RecentActivity />}
                </div>
                <div>
                    <TasksSummary />
                </div>
            </div>
        </div>
    )
}

export default Dashboard
