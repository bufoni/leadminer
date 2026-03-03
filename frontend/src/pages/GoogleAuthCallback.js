import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

const GoogleAuthCallback = () => {
  const navigate = useNavigate();
  const { updateUser } = useAuth();
  const [processing, setProcessing] = useState(true);

  useEffect(() => {
    handleCallback();
  }, []);

  const handleCallback = async () => {
    try {
      const sessionId = sessionStorage.getItem('google_session_id');
      const referralCode = sessionStorage.getItem('google_referral_code');
      
      if (!sessionId) {
        toast.error('Sessão inválida');
        navigate('/login');
        return;
      }

      // Call backend to process Google auth
      const response = await api.post('/auth/google/callback', { 
        session_id: sessionId,
        referral_code: referralCode 
      });

      const { token, user, is_new } = response.data;

      // Save to localStorage
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));

      // Update context
      updateUser(user);

      // Clear session storage
      sessionStorage.removeItem('google_session_id');
      sessionStorage.removeItem('google_referral_code');

      // Show success message
      if (is_new) {
        toast.success('Conta criada com sucesso! Bem-vindo ao LeadMiner!');
      } else {
        toast.success('Login realizado com sucesso!');
      }

      // Redirect to dashboard
      navigate('/dashboard');
    } catch (error) {
      console.error('Google auth callback error:', error);
      toast.error('Erro ao processar autenticação. Tente novamente.');
      navigate('/login');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#030712] flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-12 w-12 animate-spin text-violet-500 mx-auto mb-4" />
        <p className="text-white text-lg">Processando autenticação...</p>
        <p className="text-gray-400 text-sm mt-2">Por favor, aguarde</p>
      </div>
    </div>
  );
};

export default GoogleAuthCallback;