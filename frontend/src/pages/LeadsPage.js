import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import api from '../lib/api';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { Checkbox } from '../components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { SectionContainer } from '../components/ui/section-container';
import { toast } from 'sonner';
import { Download, Search, ExternalLink, Edit2, Sparkles, Copy, Loader2, RefreshCw, TrendingUp, MoreHorizontal, ChevronLeft, ChevronRight } from 'lucide-react';
import PlatformLogo from '../components/PlatformLogo';
import { ScoreWithTooltip, ScoreStatsSummary } from '../components/LeadScore';

const PAGE_SIZE = 10;

function buildCSVFromLeads(leads) {
  const headers = ['username', 'name', 'bio', 'followers', 'city', 'email', 'phone', 'profile_url'];
  const escape = (v) => (v == null ? '' : String(v).replace(/"/g, '""'));
  const row = (lead) =>
    headers.map((h) => `"${escape(h === 'city' ? (lead.city ?? lead.location ?? '') : lead[h])}"`).join(',');
  return ['\uFEFF' + headers.join(','), ...leads.map(row)].join('\r\n');
}

const LeadsPage = () => {
  const { t } = useTranslation();
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
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [tableSortKey, setTableSortKey] = useState('score');
  const [tableSortDir, setTableSortDir] = useState('desc');
  const [page, setPage] = useState(1);

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
      toast.error(t('leads.loadError'));
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
      toast.error(t('leads.loadError'));
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

  const sortedLeads = useMemo(() => {
    const list = [...filteredLeads];
    const dir = tableSortDir === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      let va = a[tableSortKey];
      let vb = b[tableSortKey];
      if (tableSortKey === 'username') {
        va = (a.username || '').toLowerCase();
        vb = (b.username || '').toLowerCase();
        return dir * (va < vb ? -1 : va > vb ? 1 : 0);
      }
      if (tableSortKey === 'followers') {
        va = Number(a.followers) ?? 0;
        vb = Number(b.followers) ?? 0;
        return dir * (va - vb);
      }
      if (tableSortKey === 'score') {
        va = Number(a.score) ?? 0;
        vb = Number(b.score) ?? 0;
        return dir * (va - vb);
      }
      if (tableSortKey === 'created_at') {
        va = new Date(a.created_at || 0).getTime();
        vb = new Date(b.created_at || 0).getTime();
        return dir * (va - vb);
      }
      return 0;
    });
    return list;
  }, [filteredLeads, tableSortKey, tableSortDir]);

  const totalPages = Math.max(1, Math.ceil(sortedLeads.length / PAGE_SIZE));
  const paginatedLeads = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return sortedLeads.slice(start, start + PAGE_SIZE);
  }, [sortedLeads, page]);

  const toggleSort = (key) => {
    if (tableSortKey === key) setTableSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setTableSortKey(key);
      setTableSortDir(key === 'username' ? 'asc' : 'desc');
    }
    setPage(1);
  };

  const toggleSelectAll = (checked) => {
    if (checked) setSelectedIds(new Set(paginatedLeads.map((l) => l.id)));
    else setSelectedIds(new Set());
  };

  const toggleSelectOne = (id, checked) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const selectedLeads = useMemo(() => filteredLeads.filter((l) => selectedIds.has(l.id)), [filteredLeads, selectedIds]);

  const exportSelectedCSV = () => {
    if (selectedLeads.length === 0) {
      toast.error(t('leads.selectOne'));
      return;
    }
    const csv = buildCSVFromLeads(selectedLeads);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'leads-selecionados.csv';
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t('leads.exportCount', { count: selectedLeads.length }));
  };

  const clearSelection = () => setSelectedIds(new Set());

  useEffect(() => setPage(1), [filteredLeads.length]);

  const updateLeadStatus = async (leadId, newStatus) => {
    try {
      await api.patch(`/leads/${leadId}`, { status: newStatus });
      setLeads(
        leads.map((lead) =>
          lead.id === leadId ? { ...lead, status: newStatus } : lead
        )
      );
      toast.success(t('leads.statusUpdated'));
    } catch (error) {
      toast.error(t('leads.statusError'));
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
      toast.success(t('leads.qualificationUpdated'));
    } catch (error) {
      toast.error(t('leads.qualificationError'));
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
      toast.success(t('leads.notesSaved'));
    } catch (error) {
      toast.error(t('leads.notesError'));
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
      toast.error(t('leads.messageError'));
      setAiMessageLead(null);
    } finally {
      setGeneratingMessage(false);
    }
  };

  const copyMessage = () => {
    if (suggestedMessage) {
      navigator.clipboard.writeText(suggestedMessage);
      toast.success(t('leads.messageCopied'));
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
      toast.success(t('leads.csvSuccess'));
    } catch (error) {
      toast.error(t('leads.csvError'));
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
    const key = { new: 'statusNew', contacted: 'statusContacted', discarded: 'statusDiscarded' }[status];
    return key ? t(`leads.${key}`) : status;
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
          <div className="text-gray-900 dark:text-white">{t('common.loading')}</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <SectionContainer className="py-8 md:py-10">
        <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="font-bold mb-2 text-gray-900 dark:text-white">{t('leads.title')}</h1>
            <p className="text-gray-500 dark:text-gray-400">{filteredLeads.length} {t('leads.foundCount')}</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
            <Button
              onClick={recalculateScores}
              disabled={recalculating}
              variant="outline"
              className="w-full sm:w-auto border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              {recalculating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              {t('leads.recalculateScores')}
            </Button>
            <Button
              data-testid="export-csv-button"
              onClick={exportCSV}
              className="w-full sm:w-auto bg-violet-600 hover:bg-violet-700 text-white"
            >
              <Download className="mr-2 h-4 w-4" />
              {t('leads.exportAll')}
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
                placeholder={t('leads.searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-gray-50 dark:bg-gray-950/50 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger data-testid="status-filter" className="bg-gray-50 dark:bg-gray-950/50 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">
                <SelectValue placeholder={t('leads.filterByStatus')} />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">
                <SelectItem value="all">{t('leads.statusAll')}</SelectItem>
                <SelectItem value="new">{t('leads.statusNew')}</SelectItem>
                <SelectItem value="contacted">{t('leads.statusContacted')}</SelectItem>
                <SelectItem value="discarded">{t('leads.statusDiscarded')}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={qualificationFilter} onValueChange={setQualificationFilter}>
              <SelectTrigger data-testid="qualification-filter" className="bg-gray-50 dark:bg-gray-950/50 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">
                <SelectValue placeholder={t('leads.filterByQualification')} />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">
                <SelectItem value="all">{t('leads.qualificationAll')}</SelectItem>
                <SelectItem value="quente">{t('leads.qualificationHot')}</SelectItem>
                <SelectItem value="morno">{t('leads.qualificationWarm')}</SelectItem>
                <SelectItem value="frio">{t('leads.qualificationCold')}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(value) => { setSortBy(value); fetchLeads(); }}>
              <SelectTrigger className="bg-gray-50 dark:bg-gray-950/50 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">
                <TrendingUp className="mr-2 h-4 w-4" />
                <SelectValue placeholder={t('leads.sortBy')} />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">
                <SelectItem value="score">{t('leads.sortScore')}</SelectItem>
                <SelectItem value="followers">{t('leads.sortFollowers')}</SelectItem>
                <SelectItem value="created_at">{t('leads.sortRecent')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>

        {/* Bulk actions bar */}
        {selectedIds.size > 0 && (
          <Card className="bg-violet-500/10 border-violet-500/20 p-4 mb-4 flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {selectedIds.size} selecionado(s)
            </span>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={clearSelection} className="border-gray-300 dark:border-white/20">
                Limpar
              </Button>
              <Button size="sm" onClick={exportSelectedCSV} className="bg-violet-600 hover:bg-violet-700 text-white">
                <Download className="h-4 w-4 mr-1" />
                {t('leads.exportSelected')}
              </Button>
            </div>
          </Card>
        )}

        {/* Leads Table */}
        {filteredLeads.length === 0 ? (
          <Card className="bg-white dark:bg-gray-900/50 border-gray-200 dark:border-white/5 p-12">
            <div className="text-center">
              <p className="text-gray-500 dark:text-gray-400">
                {leads.length === 0 ? t('leads.noLeads') : t('leads.noLeadsMatch')}
              </p>
            </div>
          </Card>
        ) : (
          <Card className="bg-white dark:bg-gray-900/50 border-gray-200 dark:border-white/5 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-sm text-left">
                <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-white/10">
                  <tr>
                    <th className="w-10 py-3 px-3">
                      <Checkbox
                        checked={paginatedLeads.length > 0 && paginatedLeads.every((l) => selectedIds.has(l.id))}
                        onCheckedChange={toggleSelectAll}
                        aria-label={t('leads.selectAll')}
                        className="border-gray-400 data-[state=checked]:bg-violet-600 data-[state=checked]:border-violet-600"
                      />
                    </th>
                    <th className="py-3 px-3 text-gray-500 dark:text-gray-400 font-medium w-12">{t('leads.photo')}</th>
                    <th className="py-3 px-3 text-gray-500 dark:text-gray-400 font-medium">
                      <button type="button" onClick={() => toggleSort('username')} className="flex items-center gap-1 hover:text-gray-900 dark:hover:text-white">
                        {t('leads.username')} {tableSortKey === 'username' && (tableSortDir === 'asc' ? '↑' : '↓')}
                      </button>
                    </th>
                    <th className="py-3 px-3 text-gray-500 dark:text-gray-400 font-medium max-w-[180px] hidden md:table-cell">{t('leads.bio')}</th>
                    <th className="py-3 px-3 text-gray-500 dark:text-gray-400 font-medium">
                      <button type="button" onClick={() => toggleSort('followers')} className="flex items-center gap-1 hover:text-gray-900 dark:hover:text-white">
                        {t('leads.followers')} {tableSortKey === 'followers' && (tableSortDir === 'asc' ? '↑' : '↓')}
                      </button>
                    </th>
                    <th className="py-3 px-3 text-gray-500 dark:text-gray-400 font-medium hidden sm:table-cell">{t('leads.city')}</th>
                    <th className="py-3 px-3 text-gray-500 dark:text-gray-400 font-medium hidden sm:table-cell">{t('leads.contact')}</th>
                    <th className="py-3 px-3 text-gray-500 dark:text-gray-400 font-medium w-12">{t('leads.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedLeads.map((lead) => (
                    <tr
                      key={lead.id}
                      data-testid={`lead-card-${lead.id}`}
                      className="border-b border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                    >
                      <td className="py-2 px-3">
                        <Checkbox
                          checked={selectedIds.has(lead.id)}
                          onCheckedChange={(checked) => toggleSelectOne(lead.id, !!checked)}
                          aria-label={`Selecionar ${lead.username}`}
                          className="border-gray-400 data-[state=checked]:bg-violet-600 data-[state=checked]:border-violet-600"
                        />
                      </td>
                      <td className="py-2 px-3">
                        {(lead.profile_picture || lead.avatar_url) ? (
                          <img
                            src={lead.profile_picture || lead.avatar_url}
                            alt=""
                            className="w-10 h-10 rounded-full object-cover"
                            width={40}
                            height={40}
                            loading="lazy"
                            decoding="async"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-violet-500/20 flex items-center justify-center text-violet-400 font-semibold text-sm">
                            {(lead.name || lead.username || '?').charAt(0).toUpperCase()}
                          </div>
                        )}
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <a
                            href={lead.profile_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-violet-600 dark:text-violet-400 hover:underline"
                          >
                            @{lead.username}
                          </a>
                          {lead.platform === 'tiktok' ? (
                            <PlatformLogo platform="tiktok" className="h-3.5 w-3.5 text-gray-500" />
                          ) : (
                            <PlatformLogo platform="instagram" className="h-3.5 w-3.5 text-gray-500" />
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-3 max-w-[180px] hidden md:table-cell">
                        <span className="line-clamp-2 text-gray-600 dark:text-gray-400">{lead.bio || '—'}</span>
                      </td>
                      <td className="py-2 px-3 text-gray-600 dark:text-gray-400 tabular-nums">
                        {lead.followers != null ? Number(lead.followers).toLocaleString() : '—'}
                      </td>
                      <td className="py-2 px-3 text-gray-600 dark:text-gray-400 hidden sm:table-cell">
                        {lead.city || lead.location || '—'}
                      </td>
                      <td className="py-2 px-3 text-gray-600 dark:text-gray-400 hidden sm:table-cell">
                        {lead.email ? (
                          <a href={`mailto:${lead.email}`} className="text-violet-500 hover:underline truncate block max-w-[140px]">{lead.email}</a>
                        ) : lead.phone ? (
                          <span>{lead.phone}</span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-2 px-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={t('leads.actions')}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-white dark:bg-gray-900 border-gray-200 dark:border-white/10 min-w-[180px]">
                            <DropdownMenuItem asChild>
                              <a href={lead.profile_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                                <ExternalLink className="h-4 w-4" /> Ver perfil
                              </a>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => generateAIMessage(lead)} data-testid={`ai-message-${lead.id}`}>
                              <Sparkles className="h-4 w-4 mr-2" /> Sugerir mensagem
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEditDialog(lead)}>
                              <Edit2 className="h-4 w-4 mr-2" /> Notas
                            </DropdownMenuItem>
                            <div className="border-t border-gray-200 dark:border-white/10 my-1" />
                            <span className="px-2 py-1.5 text-xs text-gray-500 dark:text-gray-400">Status</span>
                            {['new', 'contacted', 'discarded'].map((s) => (
                              <DropdownMenuItem key={s} onClick={() => updateLeadStatus(lead.id, s)} data-testid={s === lead.status ? `lead-status-${lead.id}` : undefined}>
                                {getStatusText(s)} {lead.status === s ? '✓' : ''}
                              </DropdownMenuItem>
                            ))}
                            <span className="px-2 py-1.5 text-xs text-gray-500 dark:text-gray-400 mt-1">Qualificação</span>
                            {['quente', 'morno', 'frio'].map((q) => (
                              <DropdownMenuItem key={q} onClick={() => updateLeadQualification(lead.id, q)} data-testid={lead.qualification === q ? `lead-qualification-${lead.id}` : undefined}>
                                {q} {lead.qualification === q ? '✓' : ''}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 border-t border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-gray-900/30">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, sortedLeads.length)} de {sortedLeads.length}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  aria-label="Página anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-gray-600 dark:text-gray-300 px-2">
                  Página {page} de {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  aria-label="Próxima página"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Notes & AI dialogs (unchanged) */}
        <Dialog open={editingLead != null} onOpenChange={(open) => !open && setEditingLead(null)}>
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
                  placeholder="Adicione suas anotações..."
                  className="bg-gray-50 dark:bg-gray-950/50 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white mt-2"
                  rows={6}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setEditingLead(null)} className="border-gray-300 dark:border-white/10 text-gray-700 dark:text-white">
                  {t('common.cancel')}
                </Button>
                <Button onClick={saveNotes} className="bg-violet-600 hover:bg-violet-700 text-white">
                  {t('common.save')}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

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