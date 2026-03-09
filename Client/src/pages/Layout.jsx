import { useState, useEffect, useRef } from 'react'
import Navbar from '../components/Navbar'
import Sidebar from '../components/Sidebar'
import MemberSidebar from '../components/MemberSidebar'
import { Outlet, useSearchParams } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { loadTheme } from '../features/themeSlice'
import { fetchWorkspaces, fetchMyProjects } from '../features/workspaceSlice'
import { Loader2Icon } from 'lucide-react'
import { SignIn, SignUp, useUser, useAuth } from '@clerk/clerk-react'

function Layout() {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)
    const { loadingStates, error, workspaces, currentWorkspace, myProjects, currentProject, isMemberView } = useSelector((state) => state.workspace)
    const dispatch = useDispatch()
    const { user, isLoaded } = useUser()
    const { getToken } = useAuth()
    const hasFetched = useRef(false)
    const [searchParams] = useSearchParams()
    const inviteEmail = searchParams.get('invite_email')

    // Initial load of theme
    useEffect(() => {
        dispatch(loadTheme())
    }, [dispatch])

    // Fetch workspaces AND myProjects when user is authenticated
    useEffect(() => {
        if (user && getToken && !hasFetched.current) {
            hasFetched.current = true
            console.log('[Layout] Fetching data...');
            
            // Fetch both workspaces and my projects in parallel
            Promise.all([
                dispatch(fetchWorkspaces(getToken)).unwrap().catch(err => {
                    console.warn('[Layout] Workspaces fetch error:', err);
                    return []; // Return empty array on error
                }),
                dispatch(fetchMyProjects(getToken)).unwrap().catch(err => {
                    console.warn('[Layout] MyProjects fetch error:', err);
                    return [];
                })
            ]).then(([workspacesData, projectsData]) => {
                console.log('[Layout] Data loaded:', { 
                    workspaces: workspacesData?.length, 
                    myProjects: projectsData?.length 
                });
            }).catch(err => {
                console.error('[Layout] Fetch error:', err);
                hasFetched.current = false; // Allow retry on error
            });
        }
    }, [user, dispatch])

    // Debug log (only in dev)
    useEffect(() => {
        if (process.env.NODE_ENV === 'development') {
            console.log('[Layout] State:', { 
                workspacesCount: workspaces?.length, 
                currentWorkspace: currentWorkspace?.name,
                myProjectsCount: myProjects?.length,
                currentProject: currentProject?.name,
                isMemberView,
                loading: loadingStates?.workspaces || loadingStates?.myProjects,
                error 
            });
        }
    }, [workspaces?.length, currentWorkspace?.name, loadingStates?.workspaces, error])

    // 1. First: Wait for Clerk to finish loading
    if (!isLoaded) {
        return (
            <div className='flex items-center justify-center h-screen bg-white dark:bg-zinc-950'>
                <Loader2Icon className="size-7 text-blue-500 animate-spin" />
            </div>
        )
    }

    // 2. Second: Clerk loaded, but no user = show sign in/sign up
    if (!user) {
        return (
            <div className='flex items-center justify-center h-screen bg-white dark:bg-zinc-950'>
                {inviteEmail ? (
                    <SignUp 
                        initialValues={{ emailAddress: inviteEmail }}
                        signInUrl="/?mode=signin"
                    />
                ) : (
                    <SignIn />
                )}
            </div>
        )
    }

    // 3. Third: Check loading - only show spinner on FIRST load
    const isLoading = (loadingStates?.workspaces || loadingStates?.myProjects) && 
                      workspaces?.length === 0 && myProjects?.length === 0;
    if (isLoading) {
        return (
            <div className='flex items-center justify-center h-screen bg-white dark:bg-zinc-950'>
                <Loader2Icon className="size-7 text-blue-500 animate-spin" />
            </div>
        )
    }

    // 4. Show error if fetch failed and no data
    if (error && workspaces?.length === 0 && myProjects?.length === 0) {
        return (
            <div className='flex flex-col items-center justify-center h-screen bg-white dark:bg-zinc-950'>
                <p className="text-red-500 mb-4">Error: {error}</p>
                <button 
                    onClick={() => {
                        hasFetched.current = false
                        dispatch(fetchWorkspaces(getToken))
                        dispatch(fetchMyProjects(getToken))
                    }}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                    Retry
                </button>
            </div>
        )
    }

    // 5. Determine which sidebar to show based on user type
    // Only show member view if workspaces have finished loading and user truly has none
    const workspacesLoaded = !loadingStates?.workspaces;
    const showMemberView = isMemberView || (workspacesLoaded && myProjects?.length > 0 && workspaces?.length === 0);

    return (
        <div className="flex bg-white dark:bg-zinc-950 text-gray-900 dark:text-slate-100">
            {showMemberView ? (
                <MemberSidebar isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} />
            ) : (
                <Sidebar isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} />
            )}
            <div className="flex-1 flex flex-col h-screen">
                <Navbar isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} isMemberView={showMemberView} />
                <div className="flex-1 h-full p-6 xl:p-10 xl:px-16 overflow-y-scroll">
                    <Outlet context={{ isMemberView: showMemberView }} />
                </div>
            </div>
        </div>
    )
}

export default Layout
