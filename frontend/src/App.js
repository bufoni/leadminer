import React, { useEffect, lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserRouter, Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { Toaster } from './components/ui/sonner';
import api from './lib/api';
import { toast } from 'sonner';
import './App.css';

// Code splitting: lazy load all page components for smaller initial bundle and better LCP
const Landing = lazy(() => import('./pages/Landing'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const GoogleAuthCallback = lazy(() => import('./pages/GoogleAuthCallback'));
const FacebookAuthCallback = lazy(() => import('./pages/FacebookAuthCallback'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const SearchPage = lazy(() => import('./pages/SearchPage'));
const SearchesPage = lazy(() => import('./pages/SearchesPage'));
const LeadsPage = lazy(() => import('./pages/LeadsPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const Analytics = lazy(() => import('./pages/Analytics'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));

function NotFound() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#030712] flex flex-col items-center justify-center px-4">
      <h1 className="text-6xl font-bold text-gray-900 dark:text-white">404</h1>
      <p className="mt-2 text-gray-600 dark:text-gray-400">
        {t('common.pageNotFound', 'Página não encontrada')}
      </p>
      <a
        href="/"
        className="mt-6 text-primary-600 dark:text-primary-400 hover:underline font-medium"
      >
        {t('common.backHome', 'Voltar ao início')}
      </a>
    </div>
  );
}

/** Fallback with reserved height to avoid CLS when lazy chunks load */
function PageFallback() {
  const { t } = useTranslation();
  return (
    <div className="min-h-[60vh] flex items-center justify-center bg-gray-50 dark:bg-[#030712]" aria-label={t('common.loading')}>
      <div className="text-gray-500 dark:text-gray-400">{t('common.loading')}</div>
    </div>
  );
}

const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const { t } = useTranslation();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#030712] flex items-center justify-center">
        <div className="text-gray-900 dark:text-white">{t('common.loading')}</div>
      </div>
    );
  }

  return user ? children : <Navigate to="/login" />;
};

const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const { t } = useTranslation();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#030712] flex items-center justify-center">
        <div className="text-gray-900 dark:text-white">{t('common.loading')}</div>
      </div>
    );
  }

  return !user ? children : <Navigate to="/dashboard" />;
};

const PaymentSuccessHandler = () => {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const { updateUser } = useAuth();
  const { t } = useTranslation();

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
        toast.error(t('app.payment.timeout'));
        return;
      }

      try {
        const response = await api.get(`/payments/status/${sessionId}`);
        
        if (response.data.payment_status === 'paid') {
          toast.success(t('app.payment.success'));
          const userResponse = await api.get('/auth/me');
          updateUser(userResponse.data);
          return;
        } else if (response.data.status === 'expired') {
          toast.error(t('app.payment.expired'));
          return;
        }

        attempts++;
        setTimeout(poll, 2000);
      } catch (error) {
        toast.error(t('app.payment.error'));
      }
    };

    toast.info(t('app.payment.verifying'));
    poll();
  };

  return <Dashboard />;
};

function AppToaster() {
  const { theme } = useTheme();
  return (
    <Toaster
      position="top-right"
      theme={theme}
      offset={{ top: "5rem" }}
    />
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
        <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/" element={<Landing />} />
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
          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
        <AppToaster />
      </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;