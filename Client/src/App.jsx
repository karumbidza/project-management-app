// FOLLO ACCESS-SEC
// FOLLO PERF
import { Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
import Layout from "./pages/Layout";
import { Toaster } from "react-hot-toast";
import { Loader2 } from "lucide-react";

// Lazy load all page components for faster initial load
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Projects = lazy(() => import("./pages/Projects"));
const Team = lazy(() => import("./pages/Team"));
const ProjectDetails = lazy(() => import("./pages/ProjectDetails"));
const TaskDetails = lazy(() => import("./pages/TaskDetails"));
const Settings = lazy(() => import("./pages/Settings"));
const Reports = lazy(() => import("./pages/Reports"));
const MyTasks = lazy(() => import("./pages/MyTasks"));
const AccessRevoked = lazy(() => import("./pages/AccessRevoked"));

// Loading spinner for lazy-loaded pages
const PageLoader = () => (
    <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
    </div>
);

const App = () => {
    return (
        <>
            <Toaster />
            <Routes>
                {/* FOLLO ACCESS-SEC — top-level route, outside Layout (no sidebar) */}
                <Route path="/access-revoked" element={
                    <Suspense fallback={<PageLoader />}>
                        <AccessRevoked />
                    </Suspense>
                } />
                <Route path="/" element={<Layout />}>
                    <Route index element={
                        <Suspense fallback={<PageLoader />}>
                            <Dashboard />
                        </Suspense>
                    } />
                    <Route path="tasks" element={
                        <Suspense fallback={<PageLoader />}>
                            <MyTasks />
                        </Suspense>
                    } />
                    <Route path="team" element={
                        <Suspense fallback={<PageLoader />}>
                            <Team />
                        </Suspense>
                    } />
                    <Route path="projects" element={
                        <Suspense fallback={<PageLoader />}>
                            <Projects />
                        </Suspense>
                    } />
                    <Route path="project" element={
                        <Suspense fallback={<PageLoader />}>
                            <ProjectDetails />
                        </Suspense>
                    } />
                    <Route path="projectsDetail" element={
                        <Suspense fallback={<PageLoader />}>
                            <ProjectDetails />
                        </Suspense>
                    } />
                    <Route path="taskDetails" element={
                        <Suspense fallback={<PageLoader />}>
                            <TaskDetails />
                        </Suspense>
                    } />
                    <Route path="settings" element={
                        <Suspense fallback={<PageLoader />}>
                            <Settings />
                        </Suspense>
                    } />
                    <Route path="reports" element={
                        <Suspense fallback={<PageLoader />}>
                            <Reports />
                        </Suspense>
                    } />
                </Route>
            </Routes>
        </>
    );
};

export default App;
