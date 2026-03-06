import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { 
  Users, 
  Search, 
  TrendingUp, 
  DollarSign, 
  Activity,
  Server,
  Shield,
  Plus,
  Trash2,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Eye
} from 'lucide-react';

const AdminDashboard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [adminStats, setAdminStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [proxies, setProxies] = useState([]);
  const [recentSearches, setRecentSearches] = useState([]);

  // Form states for quick add
  const [accountUsername, setAccountUsername] = useState('');
  const [accountPassword, setAccountPassword] = useState('');
  const [addingAccount, setAddingAccount] = useState(false);
  const [proxyHost, setProxyHost] = useState('');
  const [proxyPort, setProxyPort] = useState('');
  const [proxyUsername, setProxyUsername] = useState('');
  const [proxyPassword, setProxyPassword] = useState('');
  const [addingProxy, setAddingProxy] = useState(false);

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchAdminData();
    }
  }, [user]);

  const fetchAdminData = async () => {
    try {
      const [
        statsRes,
        accountsRes,
        proxiesRes,
        searchesRes
      ] = await Promise.all([
        api.get('/admin/stats'),
        api.get('/scraping-accounts'),
        api.get('/proxies'),
        api.get('/admin/recent-searches')
      ]);

      setAdminStats(statsRes.data);
      setAccounts(accountsRes.data);
      setProxies(proxiesRes.data);
      setRecentSearches(searchesRes.data);

      // Try to fetch users list if endpoint exists
      try {
        const usersRes = await api.get('/admin/users');
        setUsers(usersRes.data);
      } catch (e) {
        // Users endpoint might not exist yet
      }
    } catch (error) {
      console.error('Error fetching admin data:', error);
      // Individual requests might fail, continue with partial data
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
      fetchAdminData();
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
      fetchAdminData();
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
      fetchAdminData();
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
      fetchAdminData();
    } catch (error) {
      toast.error('Erro ao remover proxy');
    }
  };

  // Redirect non-admin users
  if (!user || user.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

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
      <div className="p-8">
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
              <Shield className="h-5 w-5 text-red-400" />
            </div>
            <div>
              <h1 className="text-4xl font-bold">Admin Dashboard</h1>
              <p className="text-gray-400">Painel de administração do sistema</p>
            </div>
          </div>
        </div>

        {/* System Health Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <Card data-testid="admin-stat-total-users" className="bg-gray-900/50 border-white/5 p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Users className="h-4 w-4 text-blue-400" />
              </div>
              <span className="text-xs text-gray-400">Total</span>
            </div>
            <div className="text-2xl font-bold">{adminStats?.total_users || 0}</div>
            <div className="text-xs text-gray-400">Usuários</div>
          </Card>

          <Card data-testid="admin-stat-total-leads" className="bg-gray-900/50 border-white/5 p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-emerald-400" />
              </div>
              <span className="text-xs text-gray-400">Total</span>
            </div>
            <div className="text-2xl font-bold">{adminStats?.total_leads || 0}</div>
            <div className="text-xs text-gray-400">Leads Gerados</div>
          </Card>

          <Card data-testid="admin-stat-total-searches" className="bg-gray-900/50 border-white/5 p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
                <Search className="h-4 w-4 text-violet-400" />
              </div>
              <span className="text-xs text-gray-400">Total</span>
            </div>
            <div className="text-2xl font-bold">{adminStats?.total_searches || 0}</div>
            <div className="text-xs text-gray-400">Buscas</div>
          </Card>

          <Card data-testid="admin-stat-active-accounts" className="bg-gray-900/50 border-white/5 p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Activity className="h-4 w-4 text-amber-400" />
              </div>
              <span className="text-xs text-gray-400">Ativos</span>
            </div>
            <div className="text-2xl font-bold">{accounts.filter(a => a.status === 'active').length}</div>
            <div className="text-xs text-gray-400">Contas IG</div>
          </Card>

          <Card data-testid="admin-stat-active-proxies" className="bg-gray-900/50 border-white/5 p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 rounded-lg bg-fuchsia-500/10 flex items-center justify-center">
                <Server className="h-4 w-4 text-fuchsia-400" />
              </div>
              <span className="text-xs text-gray-400">Ativos</span>
            </div>
            <div className="text-2xl font-bold">{proxies.filter(p => p.status === 'active').length}</div>
            <div className="text-xs text-gray-400">Proxies</div>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Instagram Accounts Management */}
          <Card className="bg-gray-900/50 border-white/5 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Activity className="h-5 w-5 text-amber-400" />
                Contas do Instagram
              </h2>
              <Button
                size="sm"
                variant="ghost"
                onClick={fetchAdminData}
                className="text-gray-400 hover:text-white"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>

            {/* Quick Add Form */}
            <form onSubmit={addAccount} className="mb-4 p-3 bg-gray-950/50 rounded-lg border border-white/5">
              <div className="flex gap-2">
                <Input
                  data-testid="quick-add-username"
                  value={accountUsername}
                  onChange={(e) => setAccountUsername(e.target.value)}
                  placeholder="Username"
                  required
                  className="bg-gray-900 border-gray-800 text-white text-sm flex-1"
                />
                <Input
                  type="password"
                  data-testid="quick-add-password"
                  value={accountPassword}
                  onChange={(e) => setAccountPassword(e.target.value)}
                  placeholder="Senha"
                  required
                  className="bg-gray-900 border-gray-800 text-white text-sm flex-1"
                />
                <Button
                  type="submit"
                  data-testid="quick-add-submit"
                  disabled={addingAccount}
                  size="sm"
                  className="bg-violet-600 hover:bg-violet-700 text-white"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </form>

            {/* Accounts List */}
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {accounts.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-amber-400" />
                  <p>Nenhuma conta cadastrada</p>
                </div>
              ) : (
                accounts.map((account) => (
                  <div
                    key={account.id}
                    data-testid={`admin-account-${account.id}`}
                    className="flex items-center justify-between p-3 bg-gray-950/50 rounded-lg border border-white/5 hover:border-violet-500/30 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      {account.status === 'active' ? (
                        <CheckCircle className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-400" />
                      )}
                      <span className="font-medium text-sm">@{account.username}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          account.status === 'active'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-red-500/10 text-red-400'
                        }`}
                      >
                        {account.status}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        data-testid={`admin-delete-account-${account.id}`}
                        onClick={() => deleteAccount(account.id)}
                        className="text-red-400 hover:text-red-300 p-1 h-auto"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* Proxies Management */}
          <Card className="bg-gray-900/50 border-white/5 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Server className="h-5 w-5 text-fuchsia-400" />
                Proxies
              </h2>
            </div>

            {/* Add Proxy Form */}
            <form onSubmit={addProxy} className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 p-3 bg-gray-950/50 rounded-lg border border-white/5">
              <Input
                data-testid="admin-proxy-host-input"
                value={proxyHost}
                onChange={(e) => setProxyHost(e.target.value)}
                placeholder="Host"
                required
                className="bg-gray-900 border-gray-700 text-white text-sm"
              />
              <Input
                type="number"
                data-testid="admin-proxy-port-input"
                value={proxyPort}
                onChange={(e) => setProxyPort(e.target.value)}
                placeholder="Porta"
                required
                className="bg-gray-900 border-gray-700 text-white text-sm"
              />
              <Input
                data-testid="admin-proxy-username-input"
                value={proxyUsername}
                onChange={(e) => setProxyUsername(e.target.value)}
                placeholder="User (opcional)"
                className="bg-gray-900 border-gray-700 text-white text-sm"
              />
              <div className="flex gap-2">
                <Input
                  type="password"
                  data-testid="admin-proxy-password-input"
                  value={proxyPassword}
                  onChange={(e) => setProxyPassword(e.target.value)}
                  placeholder="Senha (opcional)"
                  className="bg-gray-900 border-gray-700 text-white text-sm flex-1"
                />
                <Button
                  type="submit"
                  data-testid="admin-add-proxy-button"
                  disabled={addingProxy}
                  size="sm"
                  className="bg-violet-600 hover:bg-violet-700 text-white shrink-0"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </form>

            {/* Proxies List */}
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {proxies.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <Server className="h-8 w-8 mx-auto mb-2 text-fuchsia-400 opacity-50" />
                  <p>Nenhum proxy cadastrado</p>
                </div>
              ) : (
                proxies.map((proxy) => (
                  <div
                    key={proxy.id}
                    data-testid={`admin-proxy-${proxy.id}`}
                    className="flex items-center justify-between p-3 bg-gray-950/50 rounded-lg border border-white/5 hover:border-violet-500/30 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      {proxy.status === 'active' ? (
                        <CheckCircle className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-400" />
                      )}
                      <span className="font-medium text-sm">{proxy.host}:{proxy.port}</span>
                      {proxy.username && (
                        <span className="text-xs text-gray-400">({proxy.username})</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          proxy.status === 'active'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-red-500/10 text-red-400'
                        }`}
                      >
                        {proxy.status}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        data-testid={`admin-delete-proxy-${proxy.id}`}
                        onClick={() => deleteProxy(proxy.id)}
                        className="text-red-400 hover:text-red-300 p-1 h-auto"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        {/* Recent Searches */}
        <Card className="bg-gray-900/50 border-white/5 p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Search className="h-5 w-5 text-violet-400" />
              Buscas Recentes (Sistema)
            </h2>
          </div>

          {recentSearches.length === 0 ? (
            <p className="text-gray-400 text-center py-8">Nenhuma busca no sistema ainda</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {recentSearches.map((search) => (
                <div
                  key={search.id}
                  data-testid={`admin-search-${search.id}`}
                  className="flex items-center justify-between p-4 bg-gray-950/50 rounded-lg border border-white/5"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">
                        {search.keywords?.join(', ') || 'Sem palavras-chave'}
                      </span>
                      {search.hashtags?.length > 0 && (
                        <span className="text-xs text-violet-400">
                          #{search.hashtags.join(' #')}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400">
                      Usuário: {search.user_email || search.user_id?.slice(0, 8) || 'N/A'} • 
                      {new Date(search.created_at).toLocaleString('pt-BR')}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-400">{search.leads_found || 0} leads</span>
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        search.status === 'finished'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : search.status === 'running'
                          ? 'bg-amber-500/10 text-amber-400'
                          : search.status === 'failed'
                          ? 'bg-red-500/10 text-red-400'
                          : 'bg-blue-500/10 text-blue-400'
                      }`}
                    >
                      {search.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Users List (if available) */}
        {users.length > 0 && (
          <Card className="bg-gray-900/50 border-white/5 p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-400" />
              Usuários Registrados
            </h2>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {users.map((u) => (
                <div
                  key={u.id}
                  data-testid={`admin-user-${u.id}`}
                  className="flex items-center justify-between p-3 bg-gray-950/50 rounded-lg border border-white/5"
                >
                  <div className="flex items-center gap-3">
                    {u.avatar_url ? (
                      <img src={u.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center">
                        <span className="text-sm text-violet-400">{u.name?.charAt(0) || '?'}</span>
                      </div>
                    )}
                    <div>
                      <div className="font-medium text-sm">{u.name}</div>
                      <div className="text-xs text-gray-400">{u.email}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      u.role === 'admin'
                        ? 'bg-red-500/10 text-red-400'
                        : 'bg-gray-500/10 text-gray-400'
                    }`}>
                      {u.role}
                    </span>
                    <span className="text-xs px-2 py-1 rounded-full bg-violet-500/10 text-violet-400">
                      {u.plan}
                    </span>
                    <span className="text-xs text-gray-400">
                      {u.leads_used || 0}/{u.leads_limit || 0}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdminDashboard;
