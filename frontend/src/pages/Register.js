import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { Loader2, Gift } from 'lucide-react';
import api from '../lib/api';

const Register = () => {
  const [searchParams] = useSearchParams();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [referrerName, setReferrerName] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [facebookLoading, setFacebookLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref) {
      setReferralCode(ref);
      validateReferral(ref);
    }
  }, [searchParams]);

  const validateReferral = async (code) => {
    try {
      const response = await api.get(`/referrals/validate/${code}`);
      setReferrerName(response.data.referrer_name);
      toast.success(`Você foi indicado por ${response.data.referrer_name}! Ganhe 20% de desconto na primeira compra.`);
    } catch (error) {
      console.error('Error validating referral:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error('As senhas não conferem. Confirme a senha.');
      return;
    }
    if (password.length < 6) {
      toast.error('A senha deve ter no mínimo 6 caracteres');
      return;
    }
    setLoading(true);

    try {
      await register(name, email, password, referralCode || null);
      toast.success('Conta criada com sucesso!');
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao criar conta');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleRegister = async () => {
    setGoogleLoading(true);
    try {
      const redirectUrl = `${window.location.origin}/auth/google/callback`;
      const response = await api.post('/auth/google/session', { redirect_url: redirectUrl });
      
      // Store session_id and referral for callback
      sessionStorage.setItem('google_session_id', response.data.session_id);
      if (referralCode) {
        sessionStorage.setItem('google_referral_code', referralCode);
      }
      
      // Redirect to Google
      window.location.href = response.data.auth_url;
    } catch (error) {
      toast.error('Erro ao iniciar cadastro com Google');
      setGoogleLoading(false);
    }
  };

  const handleFacebookRegister = async () => {
    setFacebookLoading(true);
    try {
      const redirectUrl = `${window.location.origin}/auth/facebook/callback`;
      const response = await api.post('/auth/facebook/session', { redirect_url: redirectUrl });
      
      // Store session_id and referral for callback
      sessionStorage.setItem('facebook_session_id', response.data.session_id);
      if (referralCode) {
        sessionStorage.setItem('facebook_referral_code', referralCode);
      }
      
      // Redirect to Facebook
      window.location.href = response.data.auth_url;
    } catch (error) {
      toast.error('Erro ao iniciar cadastro com Facebook');
      setFacebookLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#030712] px-4">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-white/5 rounded-lg p-8 shadow-sm dark:shadow-none backdrop-blur-sm">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <img 
                src="https://static.prod-images.emergentagent.com/jobs/303cf839-62ca-4b43-8c31-9c5fe9bec8e9/images/64a5a31919abdae9ff3732c8bdff9a51f971ae3cb297e25197ec7ab583a76e76.png" 
                alt="LeadMiner Logo" 
                className="w-16 h-16"
              />
            </div>
            <h1 className="text-3xl font-bold text-gradient mb-2">LeadMiner</h1>
            <p className="text-gray-600 dark:text-gray-400">Crie sua conta gratuita</p>
          </div>

          {/* Social Login Buttons */}
          <div className="space-y-3 mb-6">
            {/* Google Register */}
            <Button
              type="button"
              data-testid="google-register-button"
              onClick={handleGoogleRegister}
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

            {/* Facebook Register */}
            <Button
              type="button"
              data-testid="facebook-register-button"
              onClick={handleFacebookRegister}
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
              <span className="px-2 bg-white dark:bg-gray-900/50 text-gray-500 dark:text-gray-400">Ou continue com email</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {referrerName && (
              <div className="bg-violet-500/10 border border-violet-500/20 rounded-lg p-4 flex items-center gap-3">
                <Gift className="h-5 w-5 text-violet-400 flex-shrink-0" />
                <div className="text-sm">
                  <div className="font-medium text-gray-900 dark:text-white">Indicação de {referrerName}</div>
                  <div className="text-gray-600 dark:text-gray-400">Ganhe 20% de desconto na primeira compra!</div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                type="text"
                data-testid="register-name-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="bg-gray-50 dark:bg-gray-950/50 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                data-testid="register-email-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-gray-50 dark:bg-gray-950/50 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                data-testid="register-password-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="Mínimo 6 caracteres"
                className="bg-gray-50 dark:bg-gray-950/50 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar senha</Label>
              <Input
                id="confirmPassword"
                type="password"
                data-testid="register-confirm-password-input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                placeholder="Repita a senha"
                className="bg-gray-50 dark:bg-gray-950/50 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white"
              />
            </div>

            <Button
              type="submit"
              data-testid="register-submit-button"
              disabled={loading}
              className="w-full bg-violet-600 hover:bg-violet-700 text-white"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Criando conta...
                </>
              ) : (
                'Criar Conta'
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
            Já tem uma conta?{' '}
            <Link to="/login" className="text-violet-400 hover:text-violet-300">
              Entrar
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;