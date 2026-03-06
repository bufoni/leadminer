import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';
import { Check, Copy, Gift, Users as UsersIcon, ImagePlus, Trash2 } from 'lucide-react';

const VALID_TABS = ['profile', 'plan', 'billing', 'referral'];

const SettingsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const activeTab = VALID_TABS.includes(tabFromUrl) ? tabFromUrl : 'profile';

  const { user, updateUser } = useAuth();
  const [plans, setPlans] = useState({});
  const [referralStats, setReferralStats] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [removingAvatar, setRemovingAvatar] = useState(false);
  const avatarInputRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [plansRes, referralRes] = await Promise.all([
        api.get('/plans'),
        api.get('/referrals/my-code')
      ]);
      setPlans(plansRes.data);
      setReferralStats(referralRes.data);

      const txResponse = await api.get('/payments/transactions');
      setTransactions(txResponse.data || []);
    } catch (error) {
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (planId) => {
    try {
      const origin = window.location.origin;
      const response = await api.post(`/payments/checkout?plan=${planId}`, { origin });
      window.location.href = response.data.url;
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao processar pagamento');
    }
  };

  const copyReferralCode = () => {
    if (referralStats) {
      const referralLink = `${window.location.origin}/register?ref=${referralStats.code}`;
      try {
        navigator.clipboard.writeText(referralLink);
        toast.success('Link de indicação copiado!');
      } catch (error) {
        // Fallback for browsers that don't support clipboard
        const textArea = document.createElement('textarea');
        textArea.value = referralLink;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        toast.success('Link de indicação copiado!');
      }
    }
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error('Imagem muito grande. Máximo 2MB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const uploadAvatar = async () => {
    if (!avatarPreview) return;
    setUploadingAvatar(true);
    try {
      const { data } = await api.post('/users/avatar', { avatar: avatarPreview });
      updateUser({ ...user, avatar_url: data.avatar_url });
      toast.success('Foto de perfil atualizada!');
      setAvatarPreview(null);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao atualizar foto.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const removeAvatar = async () => {
    setRemovingAvatar(true);
    try {
      await api.post('/users/avatar', { avatar: null });
      updateUser({ ...user, avatar_url: null });
      setAvatarPreview(null);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
      toast.success('Foto de perfil removida.');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao remover foto.');
    } finally {
      setRemovingAvatar(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error('A nova senha deve ter no mínimo 6 caracteres');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('A confirmação da senha não confere');
      return;
    }
    setChangingPassword(true);
    try {
      await api.patch('/users/password', {
        current_password: currentPassword,
        new_password: newPassword
      });
      toast.success('Senha alterada com sucesso');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao alterar senha');
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-white">Carregando...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-8 max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 text-gray-900 dark:text-white">Configurações</h1>
          <p className="text-gray-600 dark:text-gray-400">Gerencie seu plano, perfil e histórico</p>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setSearchParams({ tab: v })} className="space-y-6">
          <TabsList className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-white/5">
            <TabsTrigger data-testid="tab-profile" value="profile">Perfil</TabsTrigger>
            <TabsTrigger data-testid="tab-plan" value="plan">Plano</TabsTrigger>
            <TabsTrigger data-testid="tab-billing" value="billing">Histórico</TabsTrigger>
            <TabsTrigger data-testid="tab-referral" value="referral">Indicação</TabsTrigger>
          </TabsList>

          {/* Plan Tab */}
          <TabsContent value="plan">
            <Card className="bg-white dark:bg-gray-900/50 border-gray-200 dark:border-white/5 p-6 mb-6">
              <h2 className="text-2xl font-semibold mb-4">Plano Atual</h2>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <div className="text-3xl font-bold capitalize mb-2">{user?.plan}</div>
                  <div className="text-gray-500 dark:text-gray-400">
                    {user?.leads_used || 0} / {user?.leads_limit || 0} leads usados
                  </div>
                </div>
              </div>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Object.entries(plans).map(([planId, plan]) => (
                <Card
                  key={planId}
                  data-testid={`plan-card-${planId}`}
                  className={`bg-white dark:bg-gray-900/50 border p-6 ${
                    user?.plan === planId ? 'border-violet-500/50' : 'border-gray-200 dark:border-white/5'
                  }`}
                >
                  <h3 className="text-xl font-semibold mb-2">{plan.name}</h3>
                  <div className="mb-4">
                    <span className="text-3xl font-bold">R${plan.price}</span>
                    {plan.price > 0 && <span className="text-gray-500 dark:text-gray-400">/mês</span>}
                  </div>
                  <div className="text-gray-500 dark:text-gray-400 mb-4">{plan.leads_limit} leads/mês</div>
                  {user?.plan === planId ? (
                    <Button disabled className="w-full bg-emerald-600/20 text-emerald-400">
                      <Check className="mr-2 h-4 w-4" />
                      Plano Ativo
                    </Button>
                  ) : (
                    plan.price > 0 && (
                      <Button
                        data-testid={`upgrade-${planId}`}
                        onClick={() => handleUpgrade(planId)}
                        className="w-full bg-violet-600 hover:bg-violet-700 text-white"
                      >
                        Fazer Upgrade
                      </Button>
                    )
                  )}
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Referral Tab */}
          <TabsContent value="referral">
            <Card className="bg-white dark:bg-gray-900/50 border-gray-200 dark:border-white/5 p-6 mb-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-lg bg-violet-500/10 flex items-center justify-center">
                  <Gift className="h-6 w-6 text-violet-400" />
                </div>
                <div>
                  <h2 className="text-2xl font-semibold">Programa de Indicação</h2>
                  <p className="text-gray-500 dark:text-gray-400 text-sm">Ganhe 20% de desconto para cada amigo que se cadastrar</p>
                </div>
              </div>

              <div className="bg-gray-950/50 rounded-lg p-6 mb-6">
                <div className="mb-4">
                  <Label className="text-gray-500 dark:text-gray-400 text-sm mb-2 block">Seu link de indicação</Label>
                  <div className="flex gap-2">
                    <Input
                      data-testid="referral-link-input"
                      value={`${window.location.origin}/register?ref=${referralStats?.code || ''}`}
                      readOnly
                      className="bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white flex-1"
                    />
                    <Button
                      data-testid="copy-referral-button"
                      onClick={copyReferralCode}
                      className="bg-violet-600 hover:bg-violet-700 text-white"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                  <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 border border-gray-200 dark:border-white/5">
                    <div className="flex items-center gap-2 mb-2">
                      <UsersIcon className="h-5 w-5 text-blue-400" />
                      <span className="text-gray-500 dark:text-gray-400 text-sm">Total Indicados</span>
                    </div>
                    <div className="text-3xl font-bold">{referralStats?.total_referrals || 0}</div>
                  </div>

                  <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 border border-gray-200 dark:border-white/5">
                    <div className="flex items-center gap-2 mb-2">
                      <Check className="h-5 w-5 text-emerald-400" />
                      <span className="text-gray-500 dark:text-gray-400 text-sm">Conversões</span>
                    </div>
                    <div className="text-3xl font-bold">{referralStats?.successful_conversions || 0}</div>
                  </div>

                  <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 border border-gray-200 dark:border-white/5">
                    <div className="flex items-center gap-2 mb-2">
                      <Gift className="h-5 w-5 text-violet-400" />
                      <span className="text-gray-500 dark:text-gray-400 text-sm">Seu Desconto</span>
                    </div>
                    <div className="text-3xl font-bold">
                      {referralStats?.discount_available ? '20%' : '0%'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                <h3 className="font-semibold text-blue-400 mb-2">Como funciona?</h3>
                <ul className="space-y-2 text-sm text-gray-500 dark:text-gray-400">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 mt-1">•</span>
                    <span>Compartilhe seu link de indicação com amigos</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 mt-1">•</span>
                    <span>Quando eles se cadastrarem usando seu link, ganham 20% de desconto na primeira compra</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 mt-1">•</span>
                    <span>Você também ganha 20% de desconto nas suas próximas renovações!</span>
                  </li>
                </ul>
              </div>
            </Card>
          </TabsContent>

          {/* Profile Tab */}
          <TabsContent value="profile">
            <Card className="bg-white dark:bg-gray-900/50 border-gray-200 dark:border-white/5 p-6">
              <h2 className="text-2xl font-semibold mb-6 text-gray-900 dark:text-white">Perfil</h2>
              
              <div className="space-y-6">
                {/* Avatar Upload */}
                <div>
                  <Label className="text-gray-500 dark:text-gray-400 text-sm mb-3 block">Foto de Perfil</Label>
                  <div className="flex flex-wrap items-start gap-6">
                    <div className="relative shrink-0">
                      {(avatarPreview || user?.avatar_url) ? (
                        <img 
                          src={avatarPreview || user.avatar_url} 
                          alt="Sua foto de perfil" 
                          className="w-24 h-24 rounded-full object-cover border-2 border-violet-500 ring-2 ring-gray-200 dark:ring-gray-700"
                        />
                      ) : (
                        <div className="w-24 h-24 rounded-full bg-violet-500/20 flex items-center justify-center border-2 border-violet-500 ring-2 ring-gray-200 dark:ring-gray-700">
                          <span className="text-3xl text-violet-400 font-semibold">{user?.name?.charAt(0)}</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="space-y-3 flex-1 min-w-0">
                      <input
                        ref={avatarInputRef}
                        type="file"
                        id="avatar-upload"
                        accept="image/jpeg,image/png,image/gif,image/webp"
                        onChange={handleAvatarChange}
                        className="hidden"
                        data-testid="avatar-input"
                      />
                      <div className="flex flex-wrap gap-2 items-center">
                        <label htmlFor="avatar-upload" className="cursor-pointer inline-flex">
                          <Button
                            type="button"
                            as="span"
                            variant="outline"
                            className="border-gray-300 dark:border-white/10 text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-white/5 cursor-pointer inline-flex items-center gap-2"
                          >
                            <ImagePlus className="h-4 w-4" />
                            Trocar foto
                          </Button>
                        </label>
                        {(user?.avatar_url || avatarPreview) && (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={removeAvatar}
                            disabled={removingAvatar}
                            className="border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 inline-flex items-center gap-2"
                            data-testid="remove-avatar-button"
                          >
                            <Trash2 className="h-4 w-4" />
                            {removingAvatar ? 'Removendo...' : 'Remover foto'}
                          </Button>
                        )}
                      </div>
                      {avatarPreview && (
                        <div className="flex gap-2">
                          <Button
                            data-testid="save-avatar-button"
                            onClick={uploadAvatar}
                            disabled={uploadingAvatar}
                            className="bg-violet-600 hover:bg-violet-700 text-white"
                          >
                            {uploadingAvatar ? 'Salvando...' : 'Salvar foto'}
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => { setAvatarPreview(null); if (avatarInputRef.current) avatarInputRef.current.value = ''; }}
                            className="border-gray-300 dark:border-white/10 text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-white/5"
                          >
                            Cancelar
                          </Button>
                        </div>
                      )}
                      <p className="text-xs text-gray-500 dark:text-gray-400">JPG, PNG ou GIF. Máximo 2MB.</p>
                    </div>
                  </div>
                </div>

                {/* User Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-gray-200 dark:border-white/5">
                  <div>
                    <Label className="text-gray-500 dark:text-gray-400 text-sm">Nome</Label>
                    <div className="mt-2 text-gray-900 dark:text-white">{user?.name}</div>
                  </div>
                  <div>
                    <Label className="text-gray-500 dark:text-gray-400 text-sm">Email</Label>
                    <div className="mt-2 text-gray-900 dark:text-white">{user?.email}</div>
                  </div>
                  <div>
                    <Label className="text-gray-500 dark:text-gray-400 text-sm">Plano Atual</Label>
                    <div className="mt-2 text-gray-900 dark:text-white capitalize">{user?.plan}</div>
                  </div>
                  <div>
                    <Label className="text-gray-500 dark:text-gray-400 text-sm">Função</Label>
                    <div className="mt-2 text-gray-900 dark:text-white capitalize">{user?.role}</div>
                  </div>
                </div>

                {/* Change Password */}
                <form onSubmit={handleChangePassword} className="pt-6 mt-6 border-t border-gray-200 dark:border-white/5 space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Alterar senha</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="current-password">Senha atual</Label>
                      <Input
                        id="current-password"
                        type="password"
                        data-testid="current-password-input"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Digite sua senha atual"
                        required
                        className="bg-gray-950/50 border-gray-800 text-white"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="new-password">Nova senha</Label>
                      <Input
                        id="new-password"
                        type="password"
                        data-testid="new-password-input"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                        required
                        minLength={6}
                        className="bg-gray-950/50 border-gray-800 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirm-password">Confirmar nova senha</Label>
                      <Input
                        id="confirm-password"
                        type="password"
                        data-testid="confirm-password-input"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Repita a nova senha"
                        required
                        minLength={6}
                        className="bg-gray-950/50 border-gray-800 text-white"
                      />
                    </div>
                  </div>
                  <Button
                    type="submit"
                    data-testid="change-password-button"
                    disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
                    className="bg-violet-600 hover:bg-violet-700 text-white"
                  >
                    {changingPassword ? 'Alterando...' : 'Alterar senha'}
                  </Button>
                </form>
              </div>
            </Card>
          </TabsContent>

          {/* Billing History Tab */}
          <TabsContent value="billing">
            <Card className="bg-gray-900/50 border-white/5 p-6">
              <h2 className="text-2xl font-semibold mb-6">Histórico de Cobranças</h2>
              
              {transactions.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-400">Nenhuma cobrança ainda</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {transactions.map((tx) => (
                    <div
                      key={tx.id}
                      data-testid={`transaction-${tx.id}`}
                      className="flex items-center justify-between p-4 bg-gray-950/50 rounded-lg border border-white/5"
                    >
                      <div className="flex-1">
                        <div className="font-medium text-white mb-1">
                          Plano {tx.plan.charAt(0).toUpperCase() + tx.plan.slice(1)}
                        </div>
                        <div className="text-sm text-gray-400">
                          {new Date(tx.created_at).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: 'long',
                            year: 'numeric'
                          })}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="font-semibold text-white">
                            R$ {tx.amount.toFixed(2)}
                          </div>
                          {tx.discount_percent > 0 && (
                            <div className="text-xs text-emerald-400">
                              {tx.discount_percent}% desconto
                            </div>
                          )}
                        </div>
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${
                            tx.payment_status === 'paid'
                              ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                              : 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20'
                          }`}
                        >
                          {tx.payment_status === 'paid' ? 'Pago' : 'Pendente'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default SettingsPage;