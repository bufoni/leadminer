import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import api from '../lib/api';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [facebookLoading, setFacebookLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await login(email, password);
      toast.success('Login realizado com sucesso!');
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      const redirectUrl = `${window.location.origin}/auth/google/callback`;
      const response = await api.post('/auth/google/session', { redirect_url: redirectUrl });
      
      // Store session_id for callback
      sessionStorage.setItem('google_session_id', response.data.session_id);
      
      // Redirect to Google
      window.location.href = response.data.auth_url;
    } catch (error) {
      toast.error('Erro ao iniciar login com Google');
      setGoogleLoading(false);
    }
  };

  const handleFacebookLogin = async () => {
    setFacebookLoading(true);
    try {
      const redirectUrl = `${window.location.origin}/auth/facebook/callback`;
      const response = await api.post('/auth/facebook/session', { redirect_url: redirectUrl });
      
      // Store session_id (state) for callback
      sessionStorage.setItem('facebook_session_id', response.data.session_id);
      
      // Redirect to Facebook
      window.location.href = response.data.auth_url;
    } catch (error) {
      toast.error('Erro ao iniciar login com Facebook');
      setFacebookLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#030712] px-4">
      <div className="w-full max-w-md">
        <div className="bg-gray-900/50 border border-white/5 rounded-lg p-8 backdrop-blur-sm">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <img 
                src="https://static.prod-images.emergentagent.com/jobs/303cf839-62ca-4b43-8c31-9c5fe9bec8e9/images/64a5a31919abdae9ff3732c8bdff9a51f971ae3cb297e25197ec7ab583a76e76.png" 
                alt="LeadMiner Logo" 
                className="w-16 h-16"
              />
            </div>
            <h1 className="text-3xl font-bold text-gradient mb-2">LeadMiner</h1>
            <p className="text-gray-400">Entre na sua conta</p>
          </div>

          {/* Social Login Buttons */}
          <div className="space-y-3 mb-6">
            {/* Google Login */}
            <Button
              type="button"
              data-testid="google-login-button"
              onClick={handleGoogleLogin}
              disabled={googleLoading || facebookLoading}
              className="w-full bg-white hover:bg-gray-100 text-gray-900 font-medium"
            >
              {googleLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              )}
              Continuar com Google
            </Button>

            {/* Facebook Login */}
            <Button
              type="button"
              data-testid="facebook-login-button"
              onClick={handleFacebookLogin}
              disabled={facebookLoading || googleLoading}
              className="w-full bg-[#1877F2] hover:bg-[#166FE5] text-white font-medium"
            >
              {facebookLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              )}
              Continuar com Facebook
            </Button>
          </div>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-700"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-gray-900/50 text-gray-400">Ou continue com email</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                data-testid="login-email-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-gray-950/50 border-gray-800 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                data-testid="login-password-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-gray-950/50 border-gray-800 text-white"
              />
            </div>

            <Button
              type="submit"
              data-testid="login-submit-button"
              disabled={loading}
              className="w-full bg-violet-600 hover:bg-violet-700 text-white"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Entrando...
                </>
              ) : (
                'Entrar'
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-400">
            Não tem uma conta?{' '}
            <Link to="/register" className="text-violet-400 hover:text-violet-300">
              Cadastre-se
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;