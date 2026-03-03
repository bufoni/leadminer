import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import { Users, Search, TrendingUp, Package, LogOut } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [searches, setSearches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000); // Refresh every 5s
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [statsRes, searchesRes] = await Promise.all([
        api.get('/dashboard/stats'),
        api.get('/searches')
      ]);
      setStats(statsRes.data);
      setSearches(searchesRes.data.slice(0, 5));
    } catch (error) {
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const getStatusColor = (status) => {
    const colors = {
      queued: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
      running: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20 animate-pulse',
      finished: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
      failed: 'text-red-400 bg-red-500/10 border-red-500/20'
    };
    return colors[status] || colors.queued;
  };

  const getStatusText = (status) => {
    const text = {
      queued: 'Na fila',
      running: 'Processando',
      finished: 'Concluído',
      failed: 'Falhou'
    };
    return text[status] || status;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#030712] flex items-center justify-center">
        <div className="text-white">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#030712]">
      {/* Header */}
      <header className="border-b border-white/5 backdrop-blur-sm sticky top-0 z-50 bg-[#030712]/80">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="text-2xl font-bold text-gradient">LeadMiner</div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-400">{user?.name}</span>
            <Button
              variant="ghost"
              size="sm"
              data-testid="logout-button"
              onClick={handleLogout}
              className="text-gray-400 hover:text-white"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Dashboard</h1>
          <p className="text-gray-400">Bem-vindo de volta, {user?.name}!</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card data-testid="stat-total-leads" className="bg-gray-900/50 border-white/5 p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-violet-400" />
              </div>
            </div>
            <div className="text-3xl font-bold mb-1">{stats?.total_leads || 0}</div>
            <div className="text-sm text-gray-400">Total de Leads</div>
          </Card>

          <Card data-testid="stat-leads-used" className="bg-gray-900/50 border-white/5 p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-blue-400" />
              </div>
            </div>
            <div className="text-3xl font-bold mb-1">{stats?.leads_used || 0}/{stats?.leads_limit || 0}</div>
            <div className="text-sm text-gray-400">Leads Usados</div>
          </Card>

          <Card data-testid="stat-total-searches" className="bg-gray-900/50 border-white/5 p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <Search className="h-5 w-5 text-emerald-400" />
              </div>
            </div>
            <div className="text-3xl font-bold mb-1">{stats?.total_searches || 0}</div>
            <div className="text-sm text-gray-400">Buscas Realizadas</div>
          </Card>

          <Card data-testid="stat-current-plan" className="bg-gray-900/50 border-white/5 p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 rounded-lg bg-fuchsia-500/10 flex items-center justify-center">
                <Package className="h-5 w-5 text-fuchsia-400" />
              </div>
            </div>
            <div className="text-3xl font-bold mb-1 capitalize">{stats?.plan || 'Trial'}</div>
            <div className="text-sm text-gray-400">Plano Atual</div>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Link to="/search">
            <Button data-testid="quick-action-new-search" className="w-full bg-violet-600 hover:bg-violet-700 text-white h-12">
              <Search className="mr-2 h-4 w-4" />
              Nova Busca
            </Button>
          </Link>
          <Link to="/leads">
            <Button data-testid="quick-action-view-leads" variant="outline" className="w-full border-white/10 text-white hover:bg-white/5 h-12">
              <Users className="mr-2 h-4 w-4" />
              Ver Leads
            </Button>
          </Link>
          <Link to="/analytics">
            <Button data-testid="quick-action-analytics" variant="outline" className="w-full border-white/10 text-white hover:bg-white/5 h-12">
              <TrendingUp className="mr-2 h-4 w-4" />
              Analytics
            </Button>
          </Link>
          <Link to="/settings">
            <Button data-testid="quick-action-settings" variant="outline" className="w-full border-white/10 text-white hover:bg-white/5 h-12">
              <Package className="mr-2 h-4 w-4" />
              Configurações
            </Button>
          </Link>
        </div>

        {/* Recent Searches */}
        <Card className="bg-gray-900/50 border-white/5 p-6">
          <h2 className="text-xl font-semibold mb-4">Buscas Recentes</h2>
          {searches.length === 0 ? (
            <p className="text-gray-400 text-center py-8">Nenhuma busca realizada ainda</p>
          ) : (
            <div className="space-y-3">
              {searches.map((search) => (
                <div
                  key={search.id}
                  data-testid={`search-item-${search.id}`}
                  className="flex items-center justify-between p-4 bg-gray-950/50 rounded-lg border border-white/5 hover:border-violet-500/30 transition-all"
                >
                  <div className="flex-1">
                    <div className="font-medium mb-1">
                      {search.keywords.join(', ') || 'Sem palavras-chave'}
                    </div>
                    <div className="text-sm text-gray-400">
                      {search.hashtags.length > 0 && `#${search.hashtags.join(' #')}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-sm text-gray-400">{search.leads_found} leads</div>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(search.status)}`}>
                      {getStatusText(search.status)}
                    </span>
                    {search.status === 'running' && (
                      <div className="text-sm text-gray-400">{search.progress}%</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {searches.length > 0 && (
            <Link to="/searches">
              <Button variant="ghost" className="w-full mt-4 text-violet-400 hover:text-violet-300">
                Ver Todas as Buscas
              </Button>
            </Link>
          )}
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;