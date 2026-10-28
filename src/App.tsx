import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { queryClient } from '@/data/client';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AppShell } from '@/components/layout/AppShell';
import { UpdatePrompt } from '@/components/layout/UpdatePrompt';
import AuthPage from '@/pages/AuthPage';
import TodayPage from '@/pages/TodayPage';
import TasksPage from '@/pages/TasksPage';
import NotesPage from '@/pages/NotesPage';
import JotsPage from '@/pages/JotsPage';
import PageView from '@/pages/PageView';
import SearchPage from '@/pages/SearchPage';
import SchedulePage from '@/pages/SchedulePage';
import SettingsPage from '@/pages/SettingsPage';

function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="min-h-dvh bg-background" />;
  if (!user) return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={300}>
        <AuthProvider>
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <Routes>
              <Route path="/auth" element={<AuthPage />} />
              <Route element={<RequireAuth />}>
                <Route element={<AppShell />}>
                  <Route index element={<TodayPage />} />
                  <Route path="tasks" element={<TasksPage />} />
                  <Route path="tasks/list/:listId" element={<TasksPage />} />
                  <Route path="schedule" element={<SchedulePage />} />
                  <Route path="notes" element={<NotesPage />} />
                  <Route path="notes/f/:folderId" element={<NotesPage />} />
                  <Route path="jots" element={<JotsPage />} />
                  <Route path="p/:id" element={<PageView />} />
                  <Route path="search" element={<SearchPage />} />
                  <Route path="settings" element={<SettingsPage />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
              </Route>
            </Routes>
          </BrowserRouter>
          <Toaster position="top-center" />
          <UpdatePrompt />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
