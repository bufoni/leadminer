import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import DashboardLayout from '../components/DashboardLayout';
import api from '../lib/api';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { SectionContainer } from '../components/ui/section-container';
import { toast } from 'sonner';
import { Users, Search, TrendingUp, Package } from 'lucide-react';
import PlatformLogo from '../components/PlatformLogo';
import { Link } from 'react-router-dom';

const Dashboard = () => {
  const { user } = useAuth();
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
      <DashboardLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-gray-900 dark:text-white">Carregando...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <SectionContainer className="py-8 md:py-10">
        <div className="mb-8">
          <h1 className="font-bold mb-2 text-gray-900 dark:text-white">Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-400">Bem-vindo de volta, {user?.name}!</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card data-testid="stat-total-leads" className="bg-white dark:bg-gray-900/50 border-gray-200 dark:border-white/5 p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-violet-400" />
              </div>
            </div>
            <div className="text-2xl md:text-3xl font-bold mb-1 text-gray-900 dark:text-white">{stats?.total_leads || 0}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Total de Leads</div>
          </Card>

          <Card data-testid="stat-leads-used" className="bg-white dark:bg-gray-900/50 border-gray-200 dark:border-white/5 p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-blue-400" />
              </div>
            </div>
            <div className="text-2xl md:text-3xl font-bold mb-1 text-gray-900 dark:text-white">{stats?.leads_used || 0}/{stats?.leads_limit || 0}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Leads Usados</div>
          </Card>

          <Card data-testid="stat-total-searches" className="bg-white dark:bg-gray-900/50 border-gray-200 dark:border-white/5 p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <Search className="h-5 w-5 text-emerald-400" />
              </div>
            </div>
            <div className="text-2xl md:text-3xl font-bold mb-1 text-gray-900 dark:text-white">{stats?.total_searches || 0}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Buscas Realizadas</div>
          </Card>

          <Card data-testid="stat-current-plan" className="bg-white dark:bg-gray-900/50 border-gray-200 dark:border-white/5 p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 rounded-lg bg-fuchsia-500/10 flex items-center justify-center">
                <Package className="h-5 w-5 text-fuchsia-400" />
              </div>
            </div>
            <div className="text-2xl md:text-3xl font-bold mb-1 capitalize text-gray-900 dark:text-white">{stats?.plan || 'Trial'}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Plano Atual</div>
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
            <Button data-testid="quick-action-view-leads" variant="outline" className="w-full border-gray-300 dark:border-white/10 text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-white/5 h-12">
              <Users className="mr-2 h-4 w-4" />
              Ver Leads
            </Button>
          </Link>
          <Link to="/analytics">
            <Button data-testid="quick-action-analytics" variant="outline" className="w-full border-gray-300 dark:border-white/10 text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-white/5 h-12">
              <TrendingUp className="mr-2 h-4 w-4" />
              Analytics
            </Button>
          </Link>
          <Link to="/settings">
            <Button data-testid="quick-action-settings" variant="outline" className="w-full border-gray-300 dark:border-white/10 text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-white/5 h-12">
              <Package className="mr-2 h-4 w-4" />
              Configurações
            </Button>
          </Link>
        </div>

        {/* Recent Searches */}
        <Card className="bg-white dark:bg-gray-900/50 border-gray-200 dark:border-white/5 p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Buscas Recentes</h2>
          {searches.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">Nenhuma busca realizada ainda</p>
          ) : (
            <div className="space-y-3">
              {searches.map((search) => (
                <div
                  key={search.id}
                  data-testid={`search-item-${search.id}`}
                  className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-950/50 rounded-lg border border-gray-200 dark:border-white/5 hover:border-violet-500/30 transition-all"
                >
                  <div className="flex-1">
                    <div className="font-medium mb-1 flex items-center gap-2 flex-wrap text-gray-900 dark:text-white">
                      {search.keywords.join(', ') || 'Sem palavras-chave'}
                      {search.platform === 'tiktok' ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs border border-gray-300 dark:border-white/10 text-gray-500 dark:text-gray-400">
                          <PlatformLogo platform="tiktok" className="h-3 w-3" /> TikTok
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs border border-gray-300 dark:border-white/10 text-gray-500 dark:text-gray-400">
                          <PlatformLogo platform="instagram" className="h-3 w-3" /> Instagram
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {search.hashtags.length > 0 && `#${search.hashtags.join(' #')}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-sm text-gray-500 dark:text-gray-400">{search.leads_found} leads</div>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(search.status)}`}>
                      {getStatusText(search.status)}
                    </span>
                    {search.status === 'running' && (
                      <div className="text-sm text-gray-500 dark:text-gray-400">{search.progress}%</div>
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
      </SectionContainer>
    </DashboardLayout>
  );
};

export default Dashboard;