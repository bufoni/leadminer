import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import DashboardLayout from '../components/DashboardLayout';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';
import { Card } from '../components/ui/card';
import { SectionContainer } from '../components/ui/section-container';
import { toast } from 'sonner';
import { TrendingUp, Users, DollarSign, Target, BarChart3 } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const Analytics = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [overview, setOverview] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [funnel, setFunnel] = useState([]);
  const [sourceBreakdown, setSourceBreakdown] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const [overviewRes, timelineRes, funnelRes, sourceRes] = await Promise.all([
        api.get('/analytics/overview'),
        api.get('/analytics/leads-timeline?days=30'),
        api.get('/analytics/conversion-funnel'),
        api.get('/analytics/source-breakdown')
      ]);
      setOverview(overviewRes.data);
      setTimeline(timelineRes.data);
      setFunnel(funnelRes.data);
      setSourceBreakdown(sourceRes.data);
    } catch (error) {
      toast.error(t('analytics.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const COLORS = ['#7c3aed', '#0ea5e9', '#10b981', '#f59e0b'];

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-gray-900 dark:text-white">{t('analytics.loading')}</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <SectionContainer className="py-8 md:py-10">
        <div className="mb-8">
          <h1 className="font-bold mb-2 text-gray-900 dark:text-white">{t('analytics.title')}</h1>
          <p className="text-gray-600 dark:text-gray-400">{t('analytics.subtitle')}</p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card data-testid="kpi-total-leads" className="bg-white dark:bg-gray-900/50 border-gray-200 dark:border-white/5 p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-violet-400" />
              </div>
            </div>
            <div className="text-2xl md:text-3xl font-bold mb-1 text-gray-900 dark:text-white">{overview?.total_leads || 0}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">{t('analytics.totalLeads')}</div>
            <div className="text-sm text-emerald-400 mt-2">+{overview?.leads_this_month || 0} {t('analytics.thisMonth')}</div>
          </Card>

          <Card data-testid="kpi-conversion" className="bg-white dark:bg-gray-900/50 border-gray-200 dark:border-white/5 p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Target className="h-5 w-5 text-blue-400" />
              </div>
            </div>
            <div className="text-2xl md:text-3xl font-bold mb-1 text-gray-900 dark:text-white">{overview?.conversion_rate || 0}%</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Taxa de Conversão</div>
          </Card>

          <Card data-testid="kpi-cost" className="bg-white dark:bg-gray-900/50 border-gray-200 dark:border-white/5 p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-emerald-400" />
              </div>
            </div>
            <div className="text-2xl md:text-3xl font-bold mb-1 text-gray-900 dark:text-white">R${overview?.cost_per_lead || 0}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Custo por Lead</div>
          </Card>

          <Card data-testid="kpi-roi" className="bg-white dark:bg-gray-900/50 border-gray-200 dark:border-white/5 p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 rounded-lg bg-fuchsia-500/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-fuchsia-400" />
              </div>
            </div>
            <div className="text-2xl md:text-3xl font-bold mb-1 text-gray-900 dark:text-white">{overview?.roi_estimate || 0}%</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">ROI Estimado</div>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Timeline */}
          <Card className="bg-white dark:bg-gray-900/50 border-gray-200 dark:border-white/5 p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
              <BarChart3 className="h-5 w-5 text-violet-400" />
              Leads nos Últimos 30 Dias
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={timeline}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '8px'
                  }}
                />
                <Line type="monotone" dataKey="count" stroke="#7c3aed" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          {/* Conversion Funnel */}
          <Card className="bg-white dark:bg-gray-900/50 border-gray-200 dark:border-white/5 p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Funil de Conversão</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={funnel} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis type="number" stroke="#9ca3af" />
                <YAxis dataKey="stage" type="category" stroke="#9ca3af" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '8px'
                  }}
                />
                <Bar dataKey="count" fill="#0ea5e9" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* Source Breakdown */}
        {sourceBreakdown.length > 0 && (
          <Card className="bg-white dark:bg-gray-900/50 border-gray-200 dark:border-white/5 p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Leads por Fonte</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={sourceBreakdown}
                  dataKey="count"
                  nameKey="source"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label
                >
                  {sourceBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '8px'
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        )}

        {/* Additional Metrics */}
        <Card className="bg-white dark:bg-gray-900/50 border-gray-200 dark:border-white/5 p-6 mt-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Métricas Adicionais</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <div className="text-gray-500 dark:text-gray-400 text-sm mb-1">Média de Seguidores</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{overview?.avg_followers?.toLocaleString() || 0}</div>
            </div>
            <div>
              <div className="text-gray-500 dark:text-gray-400 text-sm mb-1">Leads Este Mês</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{overview?.leads_this_month || 0}</div>
            </div>
            <div>
              <div className="text-gray-500 dark:text-gray-400 text-sm mb-1">Plano Atual</div>
              <div className="text-2xl font-bold capitalize text-gray-900 dark:text-white">{user?.plan}</div>
            </div>
          </div>
        </Card>
      </SectionContainer>
    </DashboardLayout>
  );
};

export default Analytics;