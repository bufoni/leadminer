import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

const FacebookAuthCallback = () => {
  const navigate = useNavigate();
  const { updateUser } = useAuth();
  const [searchParams] = useSearchParams();
  const [processing, setProcessing] = useState(true);

  useEffect(() => {
    handleCallback();
  }, []);

  const handleCallback = async () => {
    try {
      // Get authorization code and state from URL
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const error = searchParams.get('error');
      
      if (error) {
        toast.error('Autenticação cancelada ou erro no Facebook');
        navigate('/login');
        return;
      }
      
      const sessionId = sessionStorage.getItem('facebook_session_id');
      const referralCode = sessionStorage.getItem('facebook_referral_code');
      
      if (!code) {
        toast.error('Código de autorização não recebido');
        navigate('/login');
        return;
      }
      
      if (!sessionId || sessionId !== state) {
        toast.error('Sessão inválida ou expirada');
        navigate('/login');
        return;
      }

      // Call backend to process Facebook auth
      const response = await api.post('/auth/facebook/callback', { 
        code: code,
        state: state,
        referral_code: referralCode 
      });

      const { token, user, is_new } = response.data;

      // Save to localStorage
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));

      // Update context
      updateUser(user);

      // Clear session storage
      sessionStorage.removeItem('facebook_session_id');
      sessionStorage.removeItem('facebook_referral_code');

      // Show success message
      if (is_new) {
        toast.success('Conta criada com sucesso! Bem-vindo ao LeadMiner!');
      } else {
        toast.success('Login realizado com sucesso!');
      }

      // Redirect to dashboard
      navigate('/dashboard');
    } catch (error) {
      console.error('Facebook auth callback error:', error);
      toast.error('Erro ao processar autenticação. Tente novamente.');
      navigate('/login');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#030712] flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-12 w-12 animate-spin text-[#1877F2] mx-auto mb-4" />
        <p className="text-white text-lg">Processando autenticação do Facebook...</p>
        <p className="text-gray-400 text-sm mt-2">Por favor, aguarde</p>
      </div>
    </div>
  );
};

export default FacebookAuthCallback;
