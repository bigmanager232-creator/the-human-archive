import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import Navigation from './components/Navigation';
import Dashboard from './pages/Dashboard';
import Archives from './pages/Archives';
import Upload from './pages/Upload';
import ArchiveDetail from './pages/ArchiveDetail';
import Territories from './pages/Territories';
import Login from './pages/Login';
import ResetPassword from './pages/ResetPassword';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="container main-content"><p>Chargement…</p></div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <div className="app-layout">
      {user && <Navigation />}
      <main>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/" element={
            <ProtectedRoute><Dashboard /></ProtectedRoute>
          } />
          <Route path="/archives" element={
            <ProtectedRoute><Archives /></ProtectedRoute>
          } />
          <Route path="/archives/:id" element={
            <ProtectedRoute><ArchiveDetail /></ProtectedRoute>
          } />
          <Route path="/territories" element={
            <ProtectedRoute><Territories /></ProtectedRoute>
          } />
          <Route path="/upload" element={
            <ProtectedRoute><Upload /></ProtectedRoute>
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
