// FOLLO ACCESS-SEC
// FOLLO AUDIT
// FOLLO AUTH-FIX
// FOLLO FIX
// FOLLO BUGFIX-REFRESH
// FOLLO ACCESS
// FOLLO ROLE-FIX
// FOLLO ROLE-FLASH
import { useState, useEffect, useRef } from 'react'
import Navbar from '../components/Navbar'
import Sidebar from '../components/Sidebar'
import MemberSidebar from '../components/MemberSidebar'
import AppLoadingSkeleton from '../components/AppLoadingSkeleton'
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
    const { loadingStates, error, workspaces, currentWorkspace, myProjects, currentProject, isMemberView, roleConfirmed } = useSelector((state) => state.workspace)
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
        // FOLLO ROLE-FLASH: clearWorkspaceState also resets roleConfirmed → skeleton re-shows
        if (prevUserIdRef.current && prevUserIdRef.current !== userId) {
            dispatch(clearWorkspaceState())
            hasFetched.current = false
            // Clear previous user's localStorage (workspace/project selections, etc.)
            const keysToKeep = new Set(['theme', 'colorMode'])
            Object.keys(localStorage).forEach(key => {
                if (!keysToKeep.has(key)) localStorage.removeItem(key)
            })
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

    // FOLLO ACCESS-SEC — re-fetch workspace on tab focus to catch role changes
    useEffect(() => {
        if (!userId || !getToken) return;
        const handleFocus = () => {
            dispatch(fetchWorkspaces(getToken));
        };
        window.addEventListener('focus', handleFocus);
        return () => window.removeEventListener('focus', handleFocus);
    }, [userId, dispatch]); // eslint-disable-line react-hooks/exhaustive-deps

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

    // FOLLO ROLE-FLASH: Block sidebar render until role is confirmed.
    // roleConfirmed becomes true only after fetchWorkspaces fulfills or rejects.
    // This guarantees the CORRECT sidebar (admin or member) renders on the very first frame —
    // eliminating the flash where admin sidebar briefly shows for a member user.
    if (!roleConfirmed) {
        return <AppLoadingSkeleton />;
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
    // FOLLO AUTH-FIX: Use live userId from useAuth() (already in scope), not user?.id
    // FOLLO ROLE-FLASH: Gate on roleConfirmed (not workspacesLoaded) so focus-triggered re-fetches
    // don't briefly flip the sidebar. roleConfirmed only resets on user switch, not on re-fetch.
    const isAdminInAnyWorkspace = roleConfirmed && workspaces?.some(ws => {
        if (ws.ownerId === userId) return true;
        return ws.members?.some(m =>
            (m.userId === userId || m.user?.id === userId) && m.role === 'ADMIN'
        );
    });

    // FOLLO ROLE-FIX: Member view is based on WorkspaceMember.role, not project count.
    const isMemberInAnyWorkspace = roleConfirmed && (workspaces?.some(ws =>
        ws.members?.some(m =>
            (m.userId === userId || m.user?.id === userId) && m.role === 'MEMBER'
        )
    ) ?? false);
    const showMemberView = roleConfirmed && isMemberInAnyWorkspace && !isAdminInAnyWorkspace;

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
