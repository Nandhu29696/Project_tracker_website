import { lazy, Suspense, type ComponentType } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { FullPageSpinner } from '@/components/ui/misc';
import { GuestRoute, ProtectedRoute, RequirePermission } from '@/features/auth/guards';
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage';
import { LoginPage } from '@/pages/auth/LoginPage';
import { OAuthCallbackPage } from '@/pages/auth/OAuthCallbackPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';
import { ResetPasswordPage } from '@/pages/auth/ResetPasswordPage';
import { VerifyEmailPage } from '@/pages/auth/VerifyEmailPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { NotFoundPage } from '@/pages/ErrorPages';

// Route-level code splitting: the sign-in pages and the dashboard load first,
// everything else is fetched when first visited.
const named = <T extends string>(loader: () => Promise<Record<T, ComponentType>>, name: T) =>
  lazy(() => loader().then((m) => ({ default: m[name] })));

const ProfilePage = named(() => import('@/pages/ProfilePage'), 'ProfilePage');
const ProjectsPage = named(() => import('@/pages/projects/ProjectsPage'), 'ProjectsPage');
const ProjectDetailPage = named(
  () => import('@/pages/projects/ProjectDetailPage'),
  'ProjectDetailPage',
);
const ImportProjectsPage = named(
  () => import('@/pages/projects/ImportProjectsPage'),
  'ImportProjectsPage',
);
const UsersPage = named(() => import('@/pages/admin/UsersPage'), 'UsersPage');
const CategoriesPage = named(() => import('@/pages/admin/CategoriesPage'), 'CategoriesPage');
const MyWorkPage = named(() => import('@/pages/workitems/MyWorkPage'), 'MyWorkPage');
const WorkItemPage = named(() => import('@/pages/workitems/WorkItemPage'), 'WorkItemPage');
const WorkItemsPage = named(() => import('@/pages/workitems/WorkItemQueryPage'), 'WorkItemsPage');
const ReportsPage = named(() => import('@/pages/ReportsPage'), 'ReportsPage');
const NotificationsPage = named(() => import('@/pages/NotificationsPage'), 'NotificationsPage');
const SprintsPage = named(() => import('@/pages/SprintsPage'), 'SprintsPage');
const ImportCredentialsPage = named(
  () => import('@/pages/vault/ImportCredentialsPage'),
  'ImportCredentialsPage',
);
const BugsPage = named(() => import('@/pages/workitems/WorkItemQueryPage'), 'BugsPage');

export function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<FullPageSpinner />}>
        <Routes>
          {/* public - signed-out only */}
          <Route element={<GuestRoute />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          </Route>

          {/* public - links from emails / OAuth */}
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/auth/callback" element={<OAuthCallbackPage />} />

          {/* signed-in */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route element={<RequirePermission permission="workitem:read" />}>
                <Route path="my-work" element={<MyWorkPage />} />
                <Route path="work-items" element={<WorkItemsPage />} />
                <Route path="bugs" element={<BugsPage />} />
                <Route path="items/:key" element={<WorkItemPage />} />
              </Route>
              <Route element={<RequirePermission permission="project:read" />}>
                <Route path="projects" element={<ProjectsPage />} />
                <Route path="reports" element={<ReportsPage />} />
                <Route path="projects/:id" element={<ProjectDetailPage />} />
              </Route>
              <Route element={<RequirePermission permission="data:import" />}>
                <Route path="projects/import" element={<ImportProjectsPage />} />
              </Route>
              <Route path="backlog" element={<Navigate to="/work-items" replace />} />
              <Route element={<RequirePermission permission="workitem:read" />}>
                <Route path="sprints" element={<SprintsPage />} />
              </Route>
              <Route element={<RequirePermission permission="data:import" />}>
                <Route path="vault/import" element={<ImportCredentialsPage />} />
              </Route>

              <Route element={<RequirePermission permission="user:read" />}>
                <Route path="admin/users" element={<UsersPage />} />
              </Route>
              <Route element={<RequirePermission permission="settings:manage" />}>
                <Route path="admin/categories" element={<CategoriesPage />} />
              </Route>

              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
