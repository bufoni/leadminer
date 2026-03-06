import React, { useState, useEffect } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';
import { Check, Copy, Gift, Users as UsersIcon } from 'lucide-react';

const SettingsPage = () => {
  const { user, updateUser } = useAuth();
  const [plans, setPlans] = useState({});
  const [referralStats, setReferralStats] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [loading, setLoading] = useState(true);

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
        toast.success('Link de referral copiado!');
      } catch (error) {
        // Fallback for browsers that don't support clipboard
        const textArea = document.createElement('textarea');
        textArea.value = referralLink;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        toast.success('Link de referral copiado!');
      }
    }
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // 2MB limit
        toast.error('Imagem muito grande. Máximo 2MB');
        return;
      }
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadAvatar = async () => {
    if (!avatarPreview) return;
    
    setUploadingAvatar(true);
    try {
      await api.post('/users/avatar', { avatar: avatarPreview });
      
      // Update user context
      const updatedUser = { ...user, avatar_url: avatarPreview };
      updateUser(updatedUser);
      
      toast.success('Avatar atualizado!');
      setAvatarPreview(null);
    } catch (error) {
      toast.error('Erro ao atualizar avatar');
    } finally {
      setUploadingAvatar(false);
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
          <h1 className="text-4xl font-bold mb-2">Configurações</h1>
          <p className="text-gray-400">Gerencie seu plano, perfil e histórico</p>
        </div>

        <Tabs defaultValue="plan" className="space-y-6">
          <TabsList className="bg-gray-900/50 border border-white/5">
            <TabsTrigger data-testid="tab-plan" value="plan">Plano</TabsTrigger>
            <TabsTrigger data-testid="tab-referral" value="referral">Referral</TabsTrigger>
            <TabsTrigger data-testid="tab-profile" value="profile">Perfil</TabsTrigger>
            <TabsTrigger data-testid="tab-billing" value="billing">Histórico</TabsTrigger>
          </TabsList>

          {/* Plan Tab */}
          <TabsContent value="plan">
            <Card className="bg-gray-900/50 border-white/5 p-6 mb-6">
              <h2 className="text-2xl font-semibold mb-4">Plano Atual</h2>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <div className="text-3xl font-bold capitalize mb-2">{user?.plan}</div>
                  <div className="text-gray-400">
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
                  className={`bg-gray-900/50 border p-6 ${
                    user?.plan === planId ? 'border-violet-500/50' : 'border-white/5'
                  }`}
                >
                  <h3 className="text-xl font-semibold mb-2">{plan.name}</h3>
                  <div className="mb-4">
                    <span className="text-3xl font-bold">R${plan.price}</span>
                    {plan.price > 0 && <span className="text-gray-400">/mês</span>}
                  </div>
                  <div className="text-gray-400 mb-4">{plan.leads_limit} leads/mês</div>
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
            <Card className="bg-gray-900/50 border-white/5 p-6 mb-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-lg bg-violet-500/10 flex items-center justify-center">
                  <Gift className="h-6 w-6 text-violet-400" />
                </div>
                <div>
                  <h2 className="text-2xl font-semibold">Programa de Referral</h2>
                  <p className="text-gray-400 text-sm">Ganhe 20% de desconto para cada amigo que se cadastrar</p>
                </div>
              </div>

              <div className="bg-gray-950/50 rounded-lg p-6 mb-6">
                <div className="mb-4">
                  <Label className="text-gray-400 text-sm mb-2 block">Seu Link de Referral</Label>
                  <div className="flex gap-2">
                    <Input
                      data-testid="referral-link-input"
                      value={`${window.location.origin}/register?ref=${referralStats?.code || ''}`}
                      readOnly
                      className="bg-gray-900 border-gray-800 text-white flex-1"
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
                  <div className="bg-gray-900/50 rounded-lg p-4 border border-white/5">
                    <div className="flex items-center gap-2 mb-2">
                      <UsersIcon className="h-5 w-5 text-blue-400" />
                      <span className="text-gray-400 text-sm">Total Indicados</span>
                    </div>
                    <div className="text-3xl font-bold">{referralStats?.total_referrals || 0}</div>
                  </div>

                  <div className="bg-gray-900/50 rounded-lg p-4 border border-white/5">
                    <div className="flex items-center gap-2 mb-2">
                      <Check className="h-5 w-5 text-emerald-400" />
                      <span className="text-gray-400 text-sm">Conversões</span>
                    </div>
                    <div className="text-3xl font-bold">{referralStats?.successful_conversions || 0}</div>
                  </div>

                  <div className="bg-gray-900/50 rounded-lg p-4 border border-white/5">
                    <div className="flex items-center gap-2 mb-2">
                      <Gift className="h-5 w-5 text-violet-400" />
                      <span className="text-gray-400 text-sm">Seu Desconto</span>
                    </div>
                    <div className="text-3xl font-bold">
                      {referralStats?.discount_available ? '20%' : '0%'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                <h3 className="font-semibold text-blue-400 mb-2">Como funciona?</h3>
                <ul className="space-y-2 text-sm text-gray-400">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 mt-1">•</span>
                    <span>Compartilhe seu link de referral com amigos</span>
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
            <Card className="bg-gray-900/50 border-white/5 p-6">
              <h2 className="text-2xl font-semibold mb-6">Perfil</h2>
              
              <div className="space-y-6">
                {/* Avatar Upload */}
                <div>
                  <Label className="text-gray-400 text-sm mb-3 block">Foto de Perfil</Label>
                  <div className="flex items-center gap-6">
                    <div className="relative">
                      {(avatarPreview || user?.avatar_url) ? (
                        <img 
                          src={avatarPreview || user.avatar_url} 
                          alt="Avatar" 
                          className="w-24 h-24 rounded-full object-cover border-2 border-violet-500"
                        />
                      ) : (
                        <div className="w-24 h-24 rounded-full bg-violet-500/20 flex items-center justify-center border-2 border-violet-500">
                          <span className="text-3xl text-violet-400 font-semibold">{user?.name?.charAt(0)}</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="space-y-3">
                      <input
                        type="file"
                        id="avatar-upload"
                        accept="image/*"
                        onChange={handleAvatarChange}
                        className="hidden"
                        data-testid="avatar-input"
                      />
                      <label htmlFor="avatar-upload">
                        <Button
                          type="button"
                          as="span"
                          variant="outline"
                          className="border-white/10 text-white hover:bg-white/5 cursor-pointer"
                        >
                          Escolher Imagem
                        </Button>
                      </label>
                      {avatarPreview && (
                        <div className="flex gap-2">
                          <Button
                            data-testid="save-avatar-button"
                            onClick={uploadAvatar}
                            disabled={uploadingAvatar}
                            className="bg-violet-600 hover:bg-violet-700 text-white"
                          >
                            {uploadingAvatar ? 'Salvando...' : 'Salvar Avatar'}
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => setAvatarPreview(null)}
                            className="border-white/10 text-white hover:bg-white/5"
                          >
                            Cancelar
                          </Button>
                        </div>
                      )}
                      <p className="text-xs text-gray-400">JPG, PNG ou GIF. Máximo 2MB.</p>
                    </div>
                  </div>
                </div>

                {/* User Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-white/5">
                  <div>
                    <Label className="text-gray-400 text-sm">Nome</Label>
                    <div className="mt-2 text-white">{user?.name}</div>
                  </div>
                  <div>
                    <Label className="text-gray-400 text-sm">Email</Label>
                    <div className="mt-2 text-white">{user?.email}</div>
                  </div>
                  <div>
                    <Label className="text-gray-400 text-sm">Plano Atual</Label>
                    <div className="mt-2 text-white capitalize">{user?.plan}</div>
                  </div>
                  <div>
                    <Label className="text-gray-400 text-sm">Função</Label>
                    <div className="mt-2 text-white capitalize">{user?.role}</div>
                  </div>
                </div>
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