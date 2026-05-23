/**
 * routes.jsx — full role-aware route table for EMS_M1.
 *
 * All page routes are nested inside MainLayout (persistent shell with nav).
 * Teacher and student routes are guarded by ProtectedRoute.
 * '/' resolves via LandingRedirect based on auth state.
 *
 * Source: docs/spec_brief.txt §6 Recommended Architecture, §15.1 Component Hierarchy
 */

import { Routes, Route, Navigate } from 'react-router-dom';
import { auth } from '../services/index.js';

// Layout
import MainLayout    from '../components/layout/MainLayout.jsx';
import ProtectedRoute from '../components/shared/ProtectedRoute.jsx';

// Auth pages
import LoginPage    from '../pages/auth/LoginPage.jsx';
import RegisterPage from '../pages/auth/RegisterPage.jsx';

// Teacher pages (placeholder components — filled in D006)
import TeacherDashboard from '../pages/teacher/TeacherDashboard.jsx';
import TeacherExamsPage from '../pages/teacher/TeacherExamsPage.jsx';
import CreateExamPage   from '../pages/teacher/CreateExamPage.jsx';
import EditExamPage     from '../pages/teacher/EditExamPage.jsx';
import SubmissionsPage  from '../pages/teacher/SubmissionsPage.jsx';

// Student pages (placeholder components — filled in D007)
import StudentDashboard   from '../pages/student/StudentDashboard.jsx';
import AvailableExamsPage from '../pages/student/AvailableExamsPage.jsx';
import TakeExamPage       from '../pages/student/TakeExamPage.jsx';
import GradesPage         from '../pages/student/GradesPage.jsx';

// Misc
import NotFoundPage from '../pages/NotFoundPage.jsx';

/**
 * Full application route tree.
 *
 * All routes are nested under MainLayout so every page gets the nav shell.
 * ProtectedRoute enforces authentication and role restrictions at the component
 * level — no centralized auth check needed in this component.
 *
 * @returns {JSX.Element}
 */
function AppRoutes() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        {/* Landing — redirects based on auth state */}
        <Route path="/" element={<LandingRedirect />} />

        {/* Auth pages — accessible to everyone */}
        <Route path="/login"    element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Teacher routes — require role="teacher" */}
        <Route path="/teacher" element={
          <ProtectedRoute role="teacher"><TeacherDashboard /></ProtectedRoute>
        } />
        <Route path="/teacher/exams" element={
          <ProtectedRoute role="teacher"><TeacherExamsPage /></ProtectedRoute>
        } />
        <Route path="/teacher/exams/new" element={
          <ProtectedRoute role="teacher"><CreateExamPage /></ProtectedRoute>
        } />
        <Route path="/teacher/exams/:id/edit" element={
          <ProtectedRoute role="teacher"><EditExamPage /></ProtectedRoute>
        } />
        <Route path="/teacher/submissions" element={
          <ProtectedRoute role="teacher"><SubmissionsPage /></ProtectedRoute>
        } />

        {/* Student routes — require role="student" */}
        <Route path="/student" element={
          <ProtectedRoute role="student"><StudentDashboard /></ProtectedRoute>
        } />
        <Route path="/student/exams" element={
          <ProtectedRoute role="student"><AvailableExamsPage /></ProtectedRoute>
        } />
        <Route path="/student/exams/:id" element={
          <ProtectedRoute role="student"><TakeExamPage /></ProtectedRoute>
        } />
        <Route path="/student/grades" element={
          <ProtectedRoute role="student"><GradesPage /></ProtectedRoute>
        } />

        {/* 404 catch-all */}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

// ── LandingRedirect ───────────────────────────────────────────────────────────

/**
 * '/' handler — redirects immediately based on current auth state.
 *
 * Unauthenticated  → /login
 * Teacher          → /teacher
 * Student          → /student
 *
 * No business logic here — reads from auth.getCurrentUser() only.
 */
function LandingRedirect() {
  const user = auth.getCurrentUser();
  if (!user)                      return <Navigate to="/login"   replace />;
  if (user.role === 'teacher')    return <Navigate to="/teacher" replace />;
  return                                 <Navigate to="/student" replace />;
}

export default AppRoutes;
