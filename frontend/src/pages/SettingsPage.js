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
import { ArrowLeft, Plus, Trash2, Check, Copy, Gift, Users as UsersIcon } from 'lucide-react';

const SettingsPage = () => {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [proxies, setProxies] = useState([]);
  const [plans, setPlans] = useState({});
  const [referralStats, setReferralStats] = useState(null);
  const [loading, setLoading] = useState(true);

  // Account form
  const [accountUsername, setAccountUsername] = useState('');
  const [accountPassword, setAccountPassword] = useState('');
  const [addingAccount, setAddingAccount] = useState(false);

  // Proxy form
  const [proxyHost, setProxyHost] = useState('');
  const [proxyPort, setProxyPort] = useState('');
  const [proxyUsername, setProxyUsername] = useState('');
  const [proxyPassword, setProxyPassword] = useState('');
  const [addingProxy, setAddingProxy] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [accountsRes, proxiesRes, plansRes, referralRes] = await Promise.all([
        api.get('/scraping-accounts'),
        api.get('/proxies'),
        api.get('/plans'),
        api.get('/referrals/my-code')
      ]);
      setAccounts(accountsRes.data);
      setProxies(proxiesRes.data);
      setPlans(plansRes.data);
      setReferralStats(referralRes.data);
    } catch (error) {
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const addAccount = async (e) => {
    e.preventDefault();
    setAddingAccount(true);
    try {
      await api.post('/scraping-accounts', {
        username: accountUsername,
        password: accountPassword
      });
      toast.success('Conta adicionada');
      setAccountUsername('');
      setAccountPassword('');
      fetchData();
    } catch (error) {
      toast.error('Erro ao adicionar conta');
    } finally {
      setAddingAccount(false);
    }
  };

  const deleteAccount = async (id) => {
    try {
      await api.delete(`/scraping-accounts/${id}`);
      toast.success('Conta removida');
      fetchData();
    } catch (error) {
      toast.error('Erro ao remover conta');
    }
  };

  const addProxy = async (e) => {
    e.preventDefault();
    setAddingProxy(true);
    try {
      await api.post('/proxies', {
        host: proxyHost,
        port: parseInt(proxyPort),
        username: proxyUsername || null,
        password: proxyPassword || null
      });
      toast.success('Proxy adicionado');
      setProxyHost('');
      setProxyPort('');
      setProxyUsername('');
      setProxyPassword('');
      fetchData();
    } catch (error) {
      toast.error('Erro ao adicionar proxy');
    } finally {
      setAddingProxy(false);
    }
  };

  const deleteProxy = async (id) => {
    try {
      await api.delete(`/proxies/${id}`);
      toast.success('Proxy removido');
      fetchData();
    } catch (error) {
      toast.error('Erro ao remover proxy');
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
          <p className="text-gray-400">Gerencie suas contas, proxies e plano</p>
        </div>

        <Tabs defaultValue="plan" className="space-y-6">
          <TabsList className="bg-gray-900/50 border border-white/5">
            <TabsTrigger data-testid="tab-plan" value="plan">Plano</TabsTrigger>
            <TabsTrigger data-testid="tab-referral" value="referral">Referral</TabsTrigger>
            {user?.role === 'admin' && (
              <>
                <TabsTrigger data-testid="tab-accounts" value="accounts">Contas Instagram</TabsTrigger>
                <TabsTrigger data-testid="tab-proxies" value="proxies">Proxies</TabsTrigger>
              </>
            )}
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

          {/* Accounts Tab - Admin Only */}
          {user?.role === 'admin' && (
          <TabsContent value="accounts">
            <Card className="bg-gray-900/50 border-white/5 p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">Adicionar Conta do Instagram</h2>
              <form onSubmit={addAccount} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Username</Label>
                    <Input
                      data-testid="account-username-input"
                      value={accountUsername}
                      onChange={(e) => setAccountUsername(e.target.value)}
                      placeholder="@username"
                      required
                      className="bg-gray-950/50 border-gray-800 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Senha</Label>
                    <Input
                      type="password"
                      data-testid="account-password-input"
                      value={accountPassword}
                      onChange={(e) => setAccountPassword(e.target.value)}
                      placeholder="Senha"
                      required
                      className="bg-gray-950/50 border-gray-800 text-white"
                    />
                  </div>
                </div>
                <Button
                  type="submit"
                  data-testid="add-account-button"
                  disabled={addingAccount}
                  className="bg-violet-600 hover:bg-violet-700 text-white"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar Conta
                </Button>
              </form>
            </Card>

            <Card className="bg-gray-900/50 border-white/5 p-6">
              <h2 className="text-xl font-semibold mb-4">Contas Cadastradas</h2>
              {accounts.length === 0 ? (
                <p className="text-gray-400 text-center py-8">Nenhuma conta cadastrada</p>
              ) : (
                <div className="space-y-2">
                  {accounts.map((account) => (
                    <div
                      key={account.id}
                      data-testid={`account-item-${account.id}`}
                      className="flex items-center justify-between p-3 bg-gray-950/50 rounded-lg border border-white/5"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-medium">@{account.username}</span>
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                            account.status === 'active'
                              ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                              : 'text-red-400 bg-red-500/10 border-red-500/20'
                          }`}
                        >
                          {account.status}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        data-testid={`delete-account-${account.id}`}
                        onClick={() => deleteAccount(account.id)}
                        className="text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>
          )}

          {/* Proxies Tab - Admin Only */}
          {user?.role === 'admin' && (
          <TabsContent value="proxies">
            <Card className="bg-gray-900/50 border-white/5 p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">Adicionar Proxy</h2>
              <form onSubmit={addProxy} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Host</Label>
                    <Input
                      data-testid="proxy-host-input"
                      value={proxyHost}
                      onChange={(e) => setProxyHost(e.target.value)}
                      placeholder="123.123.123.123"
                      required
                      className="bg-gray-950/50 border-gray-800 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Porta</Label>
                    <Input
                      type="number"
                      data-testid="proxy-port-input"
                      value={proxyPort}
                      onChange={(e) => setProxyPort(e.target.value)}
                      placeholder="8080"
                      required
                      className="bg-gray-950/50 border-gray-800 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Username (opcional)</Label>
                    <Input
                      data-testid="proxy-username-input"
                      value={proxyUsername}
                      onChange={(e) => setProxyUsername(e.target.value)}
                      placeholder="Username"
                      className="bg-gray-950/50 border-gray-800 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Senha (opcional)</Label>
                    <Input
                      type="password"
                      data-testid="proxy-password-input"
                      value={proxyPassword}
                      onChange={(e) => setProxyPassword(e.target.value)}
                      placeholder="Senha"
                      className="bg-gray-950/50 border-gray-800 text-white"
                    />
                  </div>
                </div>
                <Button
                  type="submit"
                  data-testid="add-proxy-button"
                  disabled={addingProxy}
                  className="bg-violet-600 hover:bg-violet-700 text-white"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar Proxy
                </Button>
              </form>
            </Card>

            <Card className="bg-gray-900/50 border-white/5 p-6">
              <h2 className="text-xl font-semibold mb-4">Proxies Cadastrados</h2>
              {proxies.length === 0 ? (
                <p className="text-gray-400 text-center py-8">Nenhum proxy cadastrado</p>
              ) : (
                <div className="space-y-2">
                  {proxies.map((proxy) => (
                    <div
                      key={proxy.id}
                      data-testid={`proxy-item-${proxy.id}`}
                      className="flex items-center justify-between p-3 bg-gray-950/50 rounded-lg border border-white/5"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-medium">
                          {proxy.host}:{proxy.port}
                        </span>
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                            proxy.status === 'active'
                              ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                              : 'text-red-400 bg-red-500/10 border-red-500/20'
                          }`}
                        >
                          {proxy.status}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        data-testid={`delete-proxy-${proxy.id}`}
                        onClick={() => deleteProxy(proxy.id)}
                        className="text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>
          )}
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default SettingsPage;