import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

const GoogleAuthCallback = () => {
  const navigate = useNavigate();
  const { updateUser } = useAuth();
  const { t } = useTranslation();
  const [processing, setProcessing] = useState(true);

  useEffect(() => {
    handleCallback();
  }, []);

  const handleCallback = async () => {
    try {
      const sessionId = sessionStorage.getItem('google_session_id');
      const referralCode = sessionStorage.getItem('google_referral_code');
      
      if (!sessionId) {
        toast.error(t('auth.callback.invalidSession'));
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

      if (is_new) {
        toast.success(t('auth.callback.accountCreated'));
      } else {
        toast.success(t('auth.callback.loginSuccess'));
      }

      navigate('/dashboard');
    } catch (error) {
      console.error('Google auth callback error:', error);
      toast.error(t('auth.callback.authError'));
      navigate('/login');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#030712] flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-12 w-12 animate-spin text-violet-500 mx-auto mb-4" />
        <p className="text-gray-900 dark:text-white text-lg">{t('auth.callback.processingGoogle')}</p>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-2">{t('auth.callback.pleaseWait')}</p>
      </div>
    </div>
  );
};

export default GoogleAuthCallback;