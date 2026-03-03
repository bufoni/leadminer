import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Toaster } from './components/ui/sonner';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import GoogleAuthCallback from './pages/GoogleAuthCallback';
import FacebookAuthCallback from './pages/FacebookAuthCallback';
import Dashboard from './pages/Dashboard';
import SearchPage from './pages/SearchPage';
import SearchesPage from './pages/SearchesPage';
import LeadsPage from './pages/LeadsPage';
import SettingsPage from './pages/SettingsPage';
import Analytics from './pages/Analytics';
import AdminDashboard from './pages/AdminDashboard';
import api from './lib/api';
import { toast } from 'sonner';
import './App.css';

const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#030712] flex items-center justify-center">
        <div className="text-white">Carregando...</div>
      </div>
    );
  }

  return user ? children : <Navigate to="/login" />;
};

const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#030712] flex items-center justify-center">
        <div className="text-white">Carregando...</div>
      </div>
    );
  }

  return !user ? children : <Navigate to="/dashboard" />;
};

const PaymentSuccessHandler = () => {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const { updateUser } = useAuth();

  useEffect(() => {
    if (sessionId) {
      checkPaymentStatus(sessionId);
    }
  }, [sessionId]);

  const checkPaymentStatus = async (sessionId) => {
    let attempts = 0;
    const maxAttempts = 5;

    const poll = async () => {
      if (attempts >= maxAttempts) {
        toast.error('Tempo limite de verificação excedido');
        return;
      }

      try {
        const response = await api.get(`/payments/status/${sessionId}`);
        
        if (response.data.payment_status === 'paid') {
          toast.success('Pagamento confirmado! Seu plano foi atualizado.');
          // Refresh user data
          const userResponse = await api.get('/auth/me');
          updateUser(userResponse.data);
          return;
        } else if (response.data.status === 'expired') {
          toast.error('Sessão de pagamento expirada');
          return;
        }

        attempts++;
        setTimeout(poll, 2000);
      } catch (error) {
        toast.error('Erro ao verificar pagamento');
      }
    };

    toast.info('Verificando pagamento...');
    poll();
  };

  return <Dashboard />;
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route
            path="/"
            element={
              <PublicRoute>
                <Landing />
              </PublicRoute>
            }
          />
          <Route
            path="/login"
            element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            }
          />
          <Route
            path="/register"
            element={
              <PublicRoute>
                <Register />
              </PublicRoute>
            }
          />
          <Route
            path="/auth/google/callback"
            element={<GoogleAuthCallback />}
          />
          <Route
            path="/auth/facebook/callback"
            element={<FacebookAuthCallback />}
          />
          <Route
            path="/dashboard"
            element={
              <PrivateRoute>
                <PaymentSuccessHandler />
              </PrivateRoute>
            }
          />
          <Route
            path="/search"
            element={
              <PrivateRoute>
                <SearchPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/searches"
            element={
              <PrivateRoute>
                <SearchesPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/leads"
            element={
              <PrivateRoute>
                <LeadsPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <PrivateRoute>
                <SettingsPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/analytics"
            element={
              <PrivateRoute>
                <Analytics />
              </PrivateRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <PrivateRoute>
                <AdminDashboard />
              </PrivateRoute>
            }
          />
        </Routes>
        <Toaster position="top-right" theme="dark" />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;