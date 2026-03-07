import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

const FacebookAuthCallback = () => {
  const navigate = useNavigate();
  const { updateUser } = useAuth();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();
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
        toast.error(t('auth.callback.authCanceled'));
        navigate('/login');
        return;
      }
      
      const sessionId = sessionStorage.getItem('facebook_session_id');
      const referralCode = sessionStorage.getItem('facebook_referral_code');
      
      if (!code) {
        toast.error(t('auth.callback.noAuthCode'));
        navigate('/login');
        return;
      }
      
      if (!sessionId || sessionId !== state) {
        toast.error(t('auth.callback.sessionExpired'));
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

      if (is_new) {
        toast.success(t('auth.callback.accountCreated'));
      } else {
        toast.success(t('auth.callback.loginSuccess'));
      }

      navigate('/dashboard');
    } catch (error) {
      console.error('Facebook auth callback error:', error);
      toast.error(t('auth.callback.authError'));
      navigate('/login');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#030712] flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-12 w-12 animate-spin text-[#1877F2] mx-auto mb-4" />
        <p className="text-gray-900 dark:text-white text-lg">{t('auth.callback.processing')}</p>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-2">{t('auth.callback.pleaseWait')}</p>
      </div>
    </div>
  );
};

export default FacebookAuthCallback;
