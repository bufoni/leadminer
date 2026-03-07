import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import api from '../lib/api';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { SectionContainer } from '../components/ui/section-container';
import { toast } from 'sonner';
import { Download, Search, ExternalLink, Edit2, Sparkles, Copy, Loader2, RefreshCw, TrendingUp } from 'lucide-react';
import PlatformLogo from '../components/PlatformLogo';
import { ScoreWithTooltip, ScoreStatsSummary } from '../components/LeadScore';

const LeadsPage = () => {
  const [searchParams] = useSearchParams();
  const searchId = searchParams.get('search_id');
  
  const [leads, setLeads] = useState([]);
  const [filteredLeads, setFilteredLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [qualificationFilter, setQualificationFilter] = useState('all');
  const [sortBy, setSortBy] = useState('score');
  const [editingLead, setEditingLead] = useState(null);
  const [editNotes, setEditNotes] = useState('');
  const [aiMessageLead, setAiMessageLead] = useState(null);
  const [suggestedMessage, setSuggestedMessage] = useState('');
  const [generatingMessage, setGeneratingMessage] = useState(false);
  const [scoreStats, setScoreStats] = useState(null);
  const [recalculating, setRecalculating] = useState(false);

  useEffect(() => {
    fetchLeads();
    fetchScoreStats();
  }, [searchId]);

  useEffect(() => {
    filterLeads();
  }, [leads, searchTerm, statusFilter, qualificationFilter]);

  const fetchLeads = async () => {
    try {
      const params = { sort_by: sortBy };
      if (searchId) params.search_id = searchId;
      const response = await api.get('/leads', { params });
      setLeads(response.data);
    } catch (error) {
      toast.error('Erro ao carregar leads');
    } finally {
      setLoading(false);
    }
  };

  const fetchScoreStats = async () => {
    try {
      const response = await api.get('/leads/score-stats');
      setScoreStats(response.data);
    } catch (error) {
      console.error('Error fetching score stats:', error);
    }
  };

  const recalculateScores = async () => {
    setRecalculating(true);
    try {
      const response = await api.post('/leads/recalculate-scores');
      toast.success(response.data.message);
      fetchLeads();
      fetchScoreStats();
    } catch (error) {
      toast.error('Erro ao recalcular scores');
    } finally {
      setRecalculating(false);
    }
  };

  const filterLeads = () => {
    let filtered = leads;

    if (searchTerm) {
      filtered = filtered.filter(
        (lead) =>
          lead.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
          lead.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          lead.email?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((lead) => lead.status === statusFilter);
    }

    if (qualificationFilter !== 'all') {
      filtered = filtered.filter((lead) => lead.qualification === qualificationFilter);
    }

    setFilteredLeads(filtered);
  };

  const updateLeadStatus = async (leadId, newStatus) => {
    try {
      await api.patch(`/leads/${leadId}`, { status: newStatus });
      setLeads(
        leads.map((lead) =>
          lead.id === leadId ? { ...lead, status: newStatus } : lead
        )
      );
      toast.success('Status atualizado');
    } catch (error) {
      toast.error('Erro ao atualizar status');
    }
  };

  const updateLeadQualification = async (leadId, newQualification) => {
    try {
      await api.patch(`/leads/${leadId}`, { qualification: newQualification });
      setLeads(
        leads.map((lead) =>
          lead.id === leadId ? { ...lead, qualification: newQualification } : lead
        )
      );
      toast.success('Qualificação atualizada');
    } catch (error) {
      toast.error('Erro ao atualizar qualificação');
    }
  };

  const openEditDialog = (lead) => {
    setEditingLead(lead);
    setEditNotes(lead.notes || '');
  };

  const saveNotes = async () => {
    try {
      await api.patch(`/leads/${editingLead.id}`, { notes: editNotes });
      setLeads(
        leads.map((lead) =>
          lead.id === editingLead.id ? { ...lead, notes: editNotes } : lead
        )
      );
      setEditingLead(null);
      toast.success('Notas salvas');
    } catch (error) {
      toast.error('Erro ao salvar notas');
    }
  };

  const generateAIMessage = async (lead) => {
    setAiMessageLead(lead);
    setGeneratingMessage(true);
    setSuggestedMessage('');
    
    try {
      const response = await api.post(`/leads/${lead.id}/suggest-message`);
      setSuggestedMessage(response.data.suggested_message);
    } catch (error) {
      toast.error('Erro ao gerar mensagem');
      setAiMessageLead(null);
    } finally {
      setGeneratingMessage(false);
    }
  };

  const copyMessage = () => {
    if (suggestedMessage) {
      navigator.clipboard.writeText(suggestedMessage);
      toast.success('Mensagem copiada!');
    }
  };

  const exportCSV = async () => {
    try {
      const response = await api.get('/leads/export/csv', {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'leads.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('CSV exportado com sucesso');
    } catch (error) {
      toast.error('Erro ao exportar CSV');
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      new: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
      contacted: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
      discarded: 'text-red-400 bg-red-500/10 border-red-500/20'
    };
    return colors[status] || colors.new;
  };

  const getStatusText = (status) => {
    const text = {
      new: 'Novo',
      contacted: 'Contatado',
      discarded: 'Descartado'
    };
    return text[status] || status;
  };

  const getQualificationColor = (qualification) => {
    const colors = {
      quente: 'text-red-400 bg-red-500/10 border-red-500/20',
      morno: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
      frio: 'text-blue-400 bg-blue-500/10 border-blue-500/20'
    };
    return colors[qualification] || colors.morno;
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
        <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="font-bold mb-2 text-gray-900 dark:text-white">Leads</h1>
            <p className="text-gray-500 dark:text-gray-400">{filteredLeads.length} leads encontrados</p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={recalculateScores}
              disabled={recalculating}
              variant="outline"
              className="border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              {recalculating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Recalcular Scores
            </Button>
            <Button
              data-testid="export-csv-button"
              onClick={exportCSV}
              className="bg-violet-600 hover:bg-violet-700 text-white"
            >
              <Download className="mr-2 h-4 w-4" />
              Exportar CSV
            </Button>
          </div>
        </div>

        {/* Score Stats Summary */}
        {scoreStats && scoreStats.total > 0 && (
          <div className="mb-6">
            <ScoreStatsSummary stats={scoreStats} />
          </div>
        )}

        {/* Filters */}
        <Card className="bg-white dark:bg-gray-900/50 border-gray-200 dark:border-white/5 p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 dark:text-gray-400" />
              <Input
                data-testid="search-leads-input"
                placeholder="Buscar por nome, username ou email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-gray-50 dark:bg-gray-950/50 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger data-testid="status-filter" className="bg-gray-50 dark:bg-gray-950/50 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">
                <SelectValue placeholder="Filtrar por status" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="new">Novo</SelectItem>
                <SelectItem value="contacted">Contatado</SelectItem>
                <SelectItem value="discarded">Descartado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={qualificationFilter} onValueChange={setQualificationFilter}>
              <SelectTrigger data-testid="qualification-filter" className="bg-gray-50 dark:bg-gray-950/50 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">
                <SelectValue placeholder="Filtrar por qualificação" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">
                <SelectItem value="all">Todas as qualificações</SelectItem>
                <SelectItem value="quente">🔥 Quente (70+)</SelectItem>
                <SelectItem value="morno">⚡ Morno (40-69)</SelectItem>
                <SelectItem value="frio">❄️ Frio (0-39)</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(value) => { setSortBy(value); fetchLeads(); }}>
              <SelectTrigger className="bg-gray-50 dark:bg-gray-950/50 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">
                <TrendingUp className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Ordenar por" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">
                <SelectItem value="score">Maior Score</SelectItem>
                <SelectItem value="followers">Mais Seguidores</SelectItem>
                <SelectItem value="created_at">Mais Recentes</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>

        {/* Leads Table */}
        {filteredLeads.length === 0 ? (
          <Card className="bg-white dark:bg-gray-900/50 border-gray-200 dark:border-white/5 p-12">
            <div className="text-center">
              <p className="text-gray-500 dark:text-gray-400">
                {leads.length === 0 ? 'Nenhum lead encontrado' : 'Nenhum lead corresponde aos filtros'}
              </p>
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredLeads.map((lead) => (
              <Card
                key={lead.id}
                data-testid={`lead-card-${lead.id}`}
                className="bg-white dark:bg-gray-900/50 border-gray-200 dark:border-white/5 p-4 hover:border-violet-500/30 transition-all"
              >
                <div className="flex flex-col md:flex-row gap-4">
                  {/* Score Badge */}
                  <div className="flex-shrink-0 flex items-center justify-center">
                    <ScoreWithTooltip score={lead.score || 0} breakdown={lead.score_breakdown || {}} />
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <h3 className="font-semibold text-lg">{lead.name || lead.username}</h3>
                      {lead.platform === 'tiktok' ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border border-gray-300 dark:border-white/10 bg-gray-100 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300">
                          <PlatformLogo platform="tiktok" className="h-3.5 w-3.5" /> TikTok
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border border-gray-300 dark:border-white/10 bg-gray-100 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300">
                          <PlatformLogo platform="instagram" className="h-3.5 w-3.5" /> Instagram
                        </span>
                      )}
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(
                          lead.status
                        )}`}
                      >
                        {getStatusText(lead.status)}
                      </span>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getQualificationColor(
                          lead.qualification || 'morno'
                        )}`}
                      >
                        {lead.qualification === 'quente' ? '🔥 ' : lead.qualification === 'frio' ? '❄️ ' : '⚡ '}
                        {lead.qualification || 'morno'}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-500 dark:text-gray-400">
                      <div>Username: @{lead.username}</div>
                      {lead.email && <div>Email: {lead.email}</div>}
                      {lead.phone && <div>Telefone: {lead.phone}</div>}
                      {lead.followers != null && <div>Seguidores: {Number(lead.followers).toLocaleString()}</div>}
                      {lead.platform === 'tiktok' && (lead.likes != null || lead.videos != null) && (
                        <div>
                          {lead.likes != null && `Curtidas: ${Number(lead.likes).toLocaleString()}`}
                          {lead.likes != null && lead.videos != null && ' · '}
                          {lead.videos != null && `Vídeos: ${Number(lead.videos).toLocaleString()}`}
                        </div>
                      )}
                    </div>
                    {lead.bio && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 line-clamp-2">{lead.bio}</p>
                    )}
                    {lead.notes && (
                      <div className="mt-2 p-2 bg-gray-100 dark:bg-gray-950/50 rounded text-sm text-gray-700 dark:text-gray-300">
                        <strong>Notas:</strong> {lead.notes}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 md:items-end justify-between">
                    <a
                      href={lead.profile_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-sm text-violet-400 hover:text-violet-300"
                    >
                      Ver perfil <ExternalLink className="h-3 w-3" />
                    </a>
                    <div className="flex gap-2">
                      <Select
                        value={lead.status}
                        onValueChange={(value) => updateLeadStatus(lead.id, value)}
                      >
                        <SelectTrigger
                          data-testid={`lead-status-${lead.id}`}
                          className="bg-gray-50 dark:bg-gray-950/50 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white w-[130px]"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">
                          <SelectItem value="new">Novo</SelectItem>
                          <SelectItem value="contacted">Contatado</SelectItem>
                          <SelectItem value="discarded">Descartado</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select
                        value={lead.qualification || 'morno'}
                        onValueChange={(value) => updateLeadQualification(lead.id, value)}
                      >
                        <SelectTrigger
                          data-testid={`lead-qualification-${lead.id}`}
                          className="bg-gray-50 dark:bg-gray-950/50 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white w-[110px]"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">
                          <SelectItem value="quente">Quente</SelectItem>
                          <SelectItem value="morno">Morno</SelectItem>
                          <SelectItem value="frio">Frio</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => generateAIMessage(lead)}
                        className="border-violet-500/30 text-violet-400 hover:bg-violet-500/10"
                        data-testid={`ai-message-${lead.id}`}
                      >
                        <Sparkles className="h-4 w-4 mr-1" />
                        Sugerir Mensagem
                      </Button>
                      <Dialog open={editingLead?.id === lead.id} onOpenChange={(open) => !open && setEditingLead(null)}>
                      <DialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditDialog(lead)}
                          className="border-gray-300 dark:border-white/10 text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-white/5"
                        >
                          <Edit2 className="h-4 w-4 mr-1" />
                          Notas
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-white/5 text-gray-900 dark:text-white">
                        <DialogHeader>
                          <DialogTitle>Notas do Lead</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 mt-4">
                          <div>
                            <Label>Notas</Label>
                            <Textarea
                              value={editNotes}
                              onChange={(e) => setEditNotes(e.target.value)}
                              placeholder="Adicione suas anotações sobre este lead..."
                              className="bg-gray-50 dark:bg-gray-950/50 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white mt-2"
                              rows={6}
                            />
                          </div>
                          <div className="flex gap-2 justify-end">
                            <Button
                              variant="outline"
                              onClick={() => setEditingLead(null)}
                              className="border-gray-300 dark:border-white/10 text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-white/5"
                            >
                              Cancelar
                            </Button>
                            <Button
                              onClick={saveNotes}
                              className="bg-violet-600 hover:bg-violet-700 text-white"
                            >
                              Salvar
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* AI Message Dialog */}
        <Dialog open={aiMessageLead !== null} onOpenChange={(open) => !open && setAiMessageLead(null)}>
          <DialogContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-white/5 text-gray-900 dark:text-white max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-violet-400" />
                Mensagem Sugerida por IA
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              {generatingMessage ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="h-12 w-12 animate-spin text-violet-500 mb-4" />
                  <p className="text-gray-500 dark:text-gray-400">Gerando mensagem personalizada...</p>
                </div>
              ) : (
                <>
                  <div className="bg-gray-50 dark:bg-gray-950/50 rounded-lg p-4 border border-gray-200 dark:border-white/5">
                    <Label className="text-gray-500 dark:text-gray-400 text-sm mb-2 block">Para: @{aiMessageLead?.username}</Label>
                    <p className="text-gray-900 dark:text-white whitespace-pre-wrap">{suggestedMessage}</p>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="outline"
                      onClick={() => setAiMessageLead(null)}
                      className="border-gray-300 dark:border-white/10 text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-white/5"
                    >
                      Fechar
                    </Button>
                    <Button
                      onClick={copyMessage}
                      className="bg-violet-600 hover:bg-violet-700 text-white"
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copiar Mensagem
                    </Button>
                  </div>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </SectionContainer>
    </DashboardLayout>
  );
};

export default LeadsPage;