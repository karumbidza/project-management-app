// FOLLO AUTH-FIX
// FOLLO FIX
// FOLLO BUGFIX-REFRESH
// FOLLO ACCESS
import { useState, useEffect, useRef } from 'react'
import Navbar from '../components/Navbar'
import Sidebar from '../components/Sidebar'
import MemberSidebar from '../components/MemberSidebar'
import { Outlet, useSearchParams } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { loadTheme } from '../features/themeSlice'
import { fetchWorkspaces, fetchMyProjects, setCurrentProject, clearWorkspaceState } from '../features/workspaceSlice'
import { fetchNotifications } from '../features/notificationSlice'
import { Loader2Icon } from 'lucide-react'
import { SignIn, SignUp, useUser, useAuth } from '@clerk/clerk-react'
import { useNotifications } from '../hooks/useNotifications'

function Layout() {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)
    const { loadingStates, error, workspaces, currentWorkspace, myProjects, currentProject, isMemberView } = useSelector((state) => state.workspace)
    const dispatch = useDispatch()
    const { user, isLoaded } = useUser()
    const { getToken, userId } = useAuth()
    const hasFetched = useRef(false)
    const prevUserIdRef = useRef(null)
    const [searchParams] = useSearchParams()
    const inviteEmail = searchParams.get('invite_email')
    const { subscribeToPush, permission } = useNotifications()

    // Initial load of theme
    useEffect(() => {
        dispatch(loadTheme())
    }, [dispatch])

    // FOLLO BUGFIX-REFRESH: Fetch workspaces AND myProjects when Clerk is FULLY loaded.
    // Must wait for isLoaded to ensure getToken() returns a valid JWT, not null.
    useEffect(() => {
        if (!isLoaded || !userId || !getToken) return

        // FOLLO AUTH-FIX: If userId changed, clear stale state from previous session
        if (prevUserIdRef.current && prevUserIdRef.current !== userId) {
            dispatch(clearWorkspaceState())
            hasFetched.current = false
        }
        prevUserIdRef.current = userId

        if (hasFetched.current) return
            
        // FOLLO BUGFIX-REFRESH: Verify token is valid before marking as fetched
        const loadInitialData = async () => {
            // Pre-check: if getToken() returns null, Clerk isn't ready yet — bail
            const token = await getToken()
            if (!token) return

            hasFetched.current = true

            try {
                const [workspacesData, projectsData] = await Promise.all([
                    dispatch(fetchWorkspaces(getToken)).unwrap().catch(err => {
                        console.error('[Layout] fetchWorkspaces failed:', err)
                        return []
                    }),
                    dispatch(fetchMyProjects(getToken)).unwrap().catch(err => {
                        console.error('[Layout] fetchMyProjects failed:', err)
                        return []
                    })
                ])

                // FOLLO ACCESS: No client-side fallback. The backend getMyProjects
                // now returns the correct set of projects for both admins & members.
                // If a member has no projects, they see an empty state.
            } catch (err) {
                console.error('[Layout] Initial load failed:', err)
                hasFetched.current = false // Allow retry on error
            }
        }

        loadInitialData()

        // FOLLO NOTIFY — fetch notifications + subscribe to push
        dispatch(fetchNotifications({ getToken }));
        if (permission === 'granted') {
            subscribeToPush(getToken);
        }
    }, [isLoaded, userId, dispatch]) // FOLLO BUGFIX-REFRESH: isLoaded in deps ensures Clerk is ready

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

    // FOLLO BUGFIX-REFRESH: Show spinner while initial data loads.
    // Covers the gap between "Clerk ready" and "first fetch pending/fulfilled".
    // hasFetched.current being false means we haven't even started fetching yet.
    const isInitialLoad = !hasFetched.current || 
        ((loadingStates?.workspaces || loadingStates?.myProjects) && 
         workspaces?.length === 0 && myProjects?.length === 0);
    if (isInitialLoad) {
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
    // Show member view if: user is not ADMIN/OWNER in any workspace AND has projects to view
    const workspacesLoaded = !loadingStates?.workspaces;
    
    // FOLLO AUTH-FIX: Use live userId from useAuth() (already in scope), not user?.id
    const isAdminInAnyWorkspace = workspaces?.some(ws => {
        if (ws.ownerId === userId) return true;
        return ws.members?.some(m => 
            (m.userId === userId || m.user?.id === userId) && m.role === 'ADMIN'
        );
    });
    
    // Member view: anyone who is not an admin in any workspace
    // Non-admins always see member sidebar — they cannot create workspaces
    const showMemberView = workspacesLoaded && !isAdminInAnyWorkspace;

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
