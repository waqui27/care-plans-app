import { Routes, Route, Navigate } from 'react-router-dom';
import { auth } from './api.js';
import Login from './pages/Login.jsx';
import PatientPage from './pages/PatientPage.jsx';
import Dashboard from './pages/Dashboard.jsx';
import PageEditor from './pages/PageEditor.jsx';
import PlanLibrary from './pages/PlanLibrary.jsx';
import Leads from './pages/Leads.jsx';
import Analytics from './pages/Analytics.jsx';
import Settings from './pages/Settings.jsx';
import Super from './pages/Super.jsx';

function RequireAuth({ children, role }) {
  if (!auth.token) return <Navigate to="/login" replace />;
  if (role && auth.role !== role) return <Navigate to={auth.role === 'superadmin' ? '/super' : '/dashboard'} replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/p/:slug" element={<PatientPage />} />
      <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
      <Route path="/pages/:id" element={<RequireAuth><PageEditor /></RequireAuth>} />
      <Route path="/library" element={<RequireAuth><PlanLibrary /></RequireAuth>} />
      <Route path="/leads" element={<RequireAuth><Leads /></RequireAuth>} />
      <Route path="/analytics" element={<RequireAuth><Analytics /></RequireAuth>} />
      <Route path="/settings" element={<RequireAuth><Settings /></RequireAuth>} />
      <Route path="/super" element={<RequireAuth role="superadmin"><Super /></RequireAuth>} />
      <Route path="*" element={<Navigate to={auth.token ? (auth.role === 'superadmin' ? '/super' : '/dashboard') : '/login'} replace />} />
    </Routes>
  );
}
