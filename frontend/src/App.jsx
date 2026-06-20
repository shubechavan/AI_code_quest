import { Navigate, Route, Routes } from 'react-router-dom';

import { AppLayout } from './components/layout/AppLayout.jsx';
import { ProtectedRoute } from './components/ProtectedRoute.jsx';
import { Admin } from './pages/Admin.jsx';
import { AlertQueue } from './pages/AlertQueue.jsx';
import { Analyze } from './pages/Analyze.jsx';
import { Audit } from './pages/Audit.jsx';
import { Dashboard } from './pages/Dashboard.jsx';
import { Login } from './pages/Login.jsx';
import { NotFound } from './pages/NotFound.jsx';
import { ReportView } from './pages/ReportView.jsx';
import { Reports } from './pages/Reports.jsx';
import { TransactionDetail } from './pages/TransactionDetail.jsx';

/**
 * Route map. Authenticated routes live under the AppLayout shell; the print-friendly
 * report view is intentionally outside the shell so it prints clean.
 */
export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="alerts" element={<AlertQueue />} />
        <Route path="analyze" element={<Analyze />} />
        <Route path="transactions/:id" element={<TransactionDetail />} />
        <Route path="reports" element={<Reports />} />
        <Route path="audit" element={<Audit />} />
        <Route path="admin" element={<Admin />} />
      </Route>

      {/* Standalone print view (no app chrome). */}
      <Route
        path="reports/:id/view"
        element={
          <ProtectedRoute>
            <ReportView />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
