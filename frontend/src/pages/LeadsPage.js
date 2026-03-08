import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { SectionContainer } from '../components/ui/section-container';
import { toast } from 'sonner';
import {
  Download, Search, ExternalLink, Edit2, Sparkles, Copy, Loader2,
  RefreshCw, MoreHorizontal, ChevronLeft, ChevronRight,
  MapPin, Globe, Mail, Phone, Star, MessageCircle,
  LayoutGrid, LayoutList, Filter, X, Users, CheckCircle2, XCircle,
  Linkedin, Facebook,
} from 'lucide-react';
import PlatformLogo from '../components/PlatformLogo';
import { ScoreWithTooltip, ScoreStatsSummary, ScoreBadge } from '../components/LeadScore';

const PAGE_SIZE = 12;

/* ─── Profile Photo ─── */
function ProfilePhoto({ lead, size = 'md' }) {
  const src = lead.profile_image_url || lead.profile_picture || lead.avatar_url;
  const initial = (lead.name || lead.username || '?').charAt(0).toUpperCase();
  const [imgError, setImgError] = useState(false);
  const sizeClass = size === 'lg' ? 'w-14 h-14' : size === 'sm' ? 'w-8 h-8' : 'w-10 h-10';
  const textSize = size === 'lg' ? 'text-lg' : size === 'sm' ? 'text-xs' : 'text-sm';

  if (src && !imgError) {
    return (
      <img src={src} alt="" className={`${sizeClass} rounded-full object-cover bg-gray-200 dark:bg-gray-700`}
        loading="lazy" decoding="async" onError={() => setImgError(true)} />
    );
  }
  return (
    <div className={`${sizeClass} rounded-full bg-violet-500/20 flex items-center justify-center text-violet-400 font-semibold ${textSize} shrink-0`}>
      {initial}
    </div>
  );
}

/* ─── Platform Icon ─── */
function PlatformIcon({ platform, className = 'h-4 w-4' }) {
  if (platform === 'linkedin') return <Linkedin className={`${className} text-blue-500`} />;
  if (platform === 'facebook') return <Facebook className={`${className} text-blue-600`} />;
  return <PlatformLogo platform={platform} className={className} />;
}

function PlatformBadge({ platform }) {
  const labels = { instagram: 'Instagram', tiktok: 'TikTok', linkedin: 'LinkedIn', facebook: 'Facebook' };
  const colors = {
    instagram: 'bg-pink-500/10 text-pink-500 border-pink-500/20',
    tiktok: 'bg-gray-500/10 text-gray-300 border-gray-500/20',
    linkedin: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    facebook: 'bg-blue-600/10 text-blue-600 border-blue-600/20',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${colors[platform] || colors.instagram}`}>
      <PlatformIcon platform={platform} className="h-3 w-3" />
      {labels[platform] || platform}
    </span>
  );
}

/* ─── Skeleton Loader ─── */
function LeadCardSkeleton() {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-gray-800/30 p-4 animate-pulse">
      <div className="flex gap-3">
        <div className="w-14 h-14 rounded-full bg-gray-300 dark:bg-gray-700" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-3/4" />
          <div className="h-3 bg-gray-300 dark:bg-gray-700 rounded w-1/2" />
        </div>
      </div>
      <div className="mt-3 space-y-2">
        <div className="h-3 bg-gray-300 dark:bg-gray-700 rounded w-2/3" />
        <div className="h-10 bg-gray-300 dark:bg-gray-700 rounded" />
      </div>
    </div>
  );
}

function LeadTableSkeleton() {
  return (
    <div className="animate-pulse space-y-1">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <div className="w-4 h-4 bg-gray-300 dark:bg-gray-700 rounded" />
          <div className="w-10 h-10 bg-gray-300 dark:bg-gray-700 rounded-full" />
          <div className="flex-1 h-4 bg-gray-300 dark:bg-gray-700 rounded" />
          <div className="w-20 h-4 bg-gray-300 dark:bg-gray-700 rounded" />
          <div className="w-16 h-4 bg-gray-300 dark:bg-gray-700 rounded" />
        </div>
      ))}
    </div>
  );
}

/* ─── CSV Builder ─── */
function buildCSVFromLeads(leads) {
  const headers = ['username', 'name', 'bio', 'followers', 'city', 'email', 'phone', 'website', 'platform', 'profile_url'];
  const escape = (v) => (v == null ? '' : String(v).replace(/"/g, '""'));
  const row = (lead) =>
    headers.map((h) => `"${escape(h === 'city' ? (lead.city ?? lead.location ?? '') : lead[h])}"`).join(',');
  return ['\uFEFF' + headers.join(','), ...leads.map(row)].join('\r\n');
}

/* ─── WhatsApp URL ─── */
function getWhatsAppUrl(phone) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10) return null;
  const num = digits.startsWith('55') ? digits : `55${digits}`;
  return `https://wa.me/${num}`;
}

/* ═══════════════════════════════════════════════════════════ */
/*                      LEAD CARD (MOBILE)                    */
/* ═══════════════════════════════════════════════════════════ */
function LeadCard({ lead, selected, onSelect, onStatusChange, onQualChange, onEdit, onAI, onFavorite, isFavorite, getStatusText, t }) {
  const waUrl = getWhatsAppUrl(lead.phone);
  const [expanded, setExpanded] = useState(false);

  return (
    <article
      data-testid={`lead-card-${lead.id}`}
      className={`rounded-xl border transition-all ${
        selected
          ? 'border-violet-500/50 bg-violet-500/5 dark:bg-violet-500/10'
          : 'border-gray-200 dark:border-white/10 bg-white dark:bg-gray-800/30'
      } shadow-sm`}
    >
      {/* Header */}
      <div className="p-4 pb-3">
        <div className="flex gap-3">
          <div className="flex items-start gap-2 shrink-0">
            <Checkbox checked={selected} onCheckedChange={(c) => onSelect(lead.id, !!c)}
              className="mt-1 border-gray-400 data-[state=checked]:bg-violet-600 data-[state=checked]:border-violet-600" />
            <ProfilePhoto lead={lead} size="lg" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-semibold text-gray-900 dark:text-white truncate text-base">
                  {lead.name || `@${lead.username}`}
                </h3>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <a href={lead.profile_url} target="_blank" rel="noopener noreferrer"
                    className="text-sm text-violet-600 dark:text-violet-400 hover:underline">
                    @{lead.username}
                  </a>
                  <PlatformBadge platform={lead.platform} />
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => onFavorite(lead.id)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5"
                  aria-label={isFavorite ? 'Remover favorito' : 'Favoritar'}>
                  <Star className={`h-5 w-5 ${isFavorite ? 'fill-yellow-400 text-yellow-400' : 'text-gray-400'}`} />
                </button>
                {lead.score != null && <ScoreBadge score={lead.score} size="sm" />}
              </div>
            </div>
          </div>
        </div>

        {/* Location */}
        {(lead.city || lead.location) && (
          <div className="mt-2.5 flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="text-sm">{lead.city || lead.location}</span>
          </div>
        )}

        {/* Bio (expandable) */}
        {lead.bio && (
          <div className="mt-2">
            <p className={`text-sm text-gray-600 dark:text-gray-400 ${expanded ? '' : 'line-clamp-2'}`}>
              {lead.bio}
            </p>
            {lead.bio.length > 100 && (
              <button onClick={() => setExpanded(!expanded)}
                className="text-xs text-violet-500 mt-0.5 hover:underline">
                {expanded ? 'ver menos' : 'ver mais'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Contact Action Buttons */}
      <div className="px-4 pb-3">
        <div className="flex flex-wrap gap-2">
          {lead.phone && (
            <a href={`tel:${lead.phone.replace(/\D/g, '')}`}
              className="inline-flex items-center gap-1.5 min-h-[40px] px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400 hover:bg-green-500/20 active:bg-green-500/30 text-sm font-medium flex-1 min-w-[100px] justify-center">
              <Phone className="h-4 w-4" /> Ligar
            </a>
          )}
          {waUrl && (
            <a href={waUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 min-h-[40px] px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 active:bg-emerald-500/30 text-sm font-medium flex-1 min-w-[100px] justify-center">
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </a>
          )}
          {lead.email && (
            <a href={`mailto:${lead.email}`}
              className="inline-flex items-center gap-1.5 min-h-[40px] px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 active:bg-blue-500/30 text-sm font-medium flex-1 min-w-[100px] justify-center">
              <Mail className="h-4 w-4" /> Email
            </a>
          )}
          {lead.website && (
            <a href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`}
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 min-h-[40px] px-3 py-2 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-600 dark:text-violet-400 hover:bg-violet-500/20 active:bg-violet-500/30 text-sm font-medium flex-1 min-w-[100px] justify-center">
              <Globe className="h-4 w-4" /> Site
            </a>
          )}
          <a href={lead.profile_url} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 min-h-[40px] px-3 py-2 rounded-lg bg-gray-500/10 border border-gray-500/20 text-gray-600 dark:text-gray-400 hover:bg-gray-500/20 active:bg-gray-500/30 text-sm font-medium flex-1 min-w-[100px] justify-center">
            <ExternalLink className="h-4 w-4" /> Perfil
          </a>
        </div>
        {!lead.phone && !lead.email && !lead.website && (
          <p className="text-sm text-gray-500 dark:text-gray-500 py-1 text-center">Sem dados de contato</p>
        )}
      </div>

      {/* Footer: status + actions */}
      <div className="px-4 pb-3 pt-2 border-t border-gray-100 dark:border-white/5 flex items-center gap-2 flex-wrap">
        <Select value={lead.status || 'new'} onValueChange={(v) => onStatusChange(lead.id, v)}>
          <SelectTrigger className="h-8 text-xs flex-1 min-w-0 max-w-[120px] border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-gray-800/50">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-white/10">
            <SelectItem value="new">{getStatusText('new')}</SelectItem>
            <SelectItem value="contacted">{getStatusText('contacted')}</SelectItem>
            <SelectItem value="discarded">{getStatusText('discarded')}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={lead.qualification || 'morno'} onValueChange={(v) => onQualChange(lead.id, v)}>
          <SelectTrigger className="h-8 text-xs flex-1 min-w-0 max-w-[110px] border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-gray-800/50">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-white/10">
            <SelectItem value="quente">{t('leads.qualificationHot')}</SelectItem>
            <SelectItem value="morno">{t('leads.qualificationWarm')}</SelectItem>
            <SelectItem value="frio">{t('leads.qualificationCold')}</SelectItem>
          </SelectContent>
        </Select>
        <div className="ml-auto flex gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(lead)}><Edit2 className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onAI(lead)}><Sparkles className="h-4 w-4" /></Button>
        </div>
      </div>
    </article>
  );
}

/* ═══════════════════════════════════════════════════════════ */
/*                        MAIN PAGE                           */
/* ═══════════════════════════════════════════════════════════ */
const LeadsPage = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const searchId = searchParams.get('search_id');

  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [qualificationFilter, setQualificationFilter] = useState('all');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [contactFilter, setContactFilter] = useState('all');
  const [sortBy, setSortBy] = useState('created_at');
  const [editingLead, setEditingLead] = useState(null);
  const [editNotes, setEditNotes] = useState('');
  const [aiMessageLead, setAiMessageLead] = useState(null);
  const [suggestedMessage, setSuggestedMessage] = useState('');
  const [generatingMessage, setGeneratingMessage] = useState(false);
  const [scoreStats, setScoreStats] = useState(null);
  const [recalculating, setRecalculating] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [favorites, setFavorites] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('leadminer_favorites') || '[]')); }
    catch { return new Set(); }
  });
  const [viewMode, setViewMode] = useState('cards');
  const [tableSortKey, setTableSortKey] = useState('created_at');
  const [tableSortDir, setTableSortDir] = useState('desc');
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => { fetchLeads(); fetchScoreStats(); }, [searchId]);

  const fetchLeads = async () => {
    try {
      const params = { sort_by: sortBy };
      if (searchId) params.search_id = searchId;
      const response = await api.get('/leads', { params });
      setLeads(response.data);
    } catch { toast.error(t('leads.loadError')); }
    finally { setLoading(false); }
  };

  const fetchScoreStats = async () => {
    try { const r = await api.get('/leads/score-stats'); setScoreStats(r.data); } catch {}
  };

  const recalculateScores = async () => {
    setRecalculating(true);
    try { const r = await api.post('/leads/recalculate-scores'); toast.success(r.data.message); fetchLeads(); fetchScoreStats(); }
    catch { toast.error(t('leads.loadError')); }
    finally { setRecalculating(false); }
  };

  /* ─── Filtering ─── */
  const filteredLeads = useMemo(() => {
    let list = leads;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      list = list.filter(l =>
        l.username?.toLowerCase().includes(q) || l.name?.toLowerCase().includes(q) ||
        l.email?.toLowerCase().includes(q) || l.bio?.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== 'all') list = list.filter(l => l.status === statusFilter);
    if (qualificationFilter !== 'all') list = list.filter(l => l.qualification === qualificationFilter);
    if (platformFilter !== 'all') list = list.filter(l => l.platform === platformFilter);
    if (contactFilter === 'has_phone') list = list.filter(l => l.phone);
    else if (contactFilter === 'has_email') list = list.filter(l => l.email);
    else if (contactFilter === 'has_website') list = list.filter(l => l.website);
    else if (contactFilter === 'has_any') list = list.filter(l => l.phone || l.email || l.website);
    else if (contactFilter === 'favorites') list = list.filter(l => favorites.has(l.id));
    return list;
  }, [leads, searchTerm, statusFilter, qualificationFilter, platformFilter, contactFilter, favorites]);

  /* ─── Sorting ─── */
  const sortedLeads = useMemo(() => {
    const list = [...filteredLeads];
    const dir = tableSortDir === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      if (tableSortKey === 'username') return dir * ((a.username || '').toLowerCase() < (b.username || '').toLowerCase() ? -1 : 1);
      if (tableSortKey === 'followers') return dir * ((a.followers || 0) - (b.followers || 0));
      if (tableSortKey === 'score') return dir * ((a.score || 0) - (b.score || 0));
      if (tableSortKey === 'platform') return dir * ((a.platform || '').localeCompare(b.platform || ''));
      if (tableSortKey === 'city') return dir * ((a.city || a.location || '').localeCompare(b.city || b.location || ''));
      return dir * (new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
    });
    return list;
  }, [filteredLeads, tableSortKey, tableSortDir]);

  const totalPages = Math.max(1, Math.ceil(sortedLeads.length / PAGE_SIZE));
  const paginatedLeads = useMemo(() => sortedLeads.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [sortedLeads, page]);

  useEffect(() => setPage(1), [filteredLeads.length]);

  const toggleSort = (key) => {
    if (tableSortKey === key) setTableSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setTableSortKey(key); setTableSortDir(key === 'username' ? 'asc' : 'desc'); }
    setPage(1);
  };

  /* ─── Selection ─── */
  const toggleSelectAll = (checked) => {
    setSelectedIds(checked ? new Set(paginatedLeads.map(l => l.id)) : new Set());
  };
  const toggleSelectOne = (id, checked) => {
    setSelectedIds(prev => { const n = new Set(prev); checked ? n.add(id) : n.delete(id); return n; });
  };
  const selectedLeads = useMemo(() => filteredLeads.filter(l => selectedIds.has(l.id)), [filteredLeads, selectedIds]);

  /* ─── Favorites ─── */
  const toggleFavorite = useCallback((id) => {
    setFavorites(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      localStorage.setItem('leadminer_favorites', JSON.stringify([...n]));
      return n;
    });
  }, []);

  /* ─── Actions ─── */
  const updateLeadStatus = async (leadId, newStatus) => {
    try { await api.patch(`/leads/${leadId}`, { status: newStatus }); setLeads(l => l.map(x => x.id === leadId ? { ...x, status: newStatus } : x)); toast.success(t('leads.statusUpdated')); }
    catch { toast.error(t('leads.statusError')); }
  };
  const updateLeadQualification = async (leadId, qual) => {
    try { await api.patch(`/leads/${leadId}`, { qualification: qual }); setLeads(l => l.map(x => x.id === leadId ? { ...x, qualification: qual } : x)); toast.success(t('leads.qualificationUpdated')); }
    catch { toast.error(t('leads.qualificationError')); }
  };
  const saveNotes = async () => {
    try { await api.patch(`/leads/${editingLead.id}`, { notes: editNotes }); setLeads(l => l.map(x => x.id === editingLead.id ? { ...x, notes: editNotes } : x)); setEditingLead(null); toast.success(t('leads.notesSaved')); }
    catch { toast.error(t('leads.notesError')); }
  };
  const generateAIMessage = async (lead) => {
    setAiMessageLead(lead); setGeneratingMessage(true); setSuggestedMessage('');
    try { const r = await api.post(`/leads/${lead.id}/suggest-message`); setSuggestedMessage(r.data.suggested_message); }
    catch { toast.error(t('leads.messageError')); setAiMessageLead(null); }
    finally { setGeneratingMessage(false); }
  };
  const exportSelectedCSV = () => {
    if (selectedLeads.length === 0) { toast.error(t('leads.selectOne')); return; }
    const csv = buildCSVFromLeads(selectedLeads);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'leads-selecionados.csv'; a.click(); URL.revokeObjectURL(a.href);
    toast.success(t('leads.exportCount', { count: selectedLeads.length }));
  };
  const exportCSV = async () => {
    try { const r = await api.get('/leads/export/csv', { responseType: 'blob' }); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([r.data])); a.download = 'leads.csv'; a.click(); toast.success(t('leads.csvSuccess')); }
    catch { toast.error(t('leads.csvError')); }
  };
  const markSelectedContacted = async () => {
    for (const lead of selectedLeads) await updateLeadStatus(lead.id, 'contacted');
    toast.success(`${selectedLeads.length} lead(s) marcado(s) como contatados`);
    setSelectedIds(new Set());
  };

  const getStatusText = (s) => {
    const k = { new: 'statusNew', contacted: 'statusContacted', discarded: 'statusDiscarded' }[s];
    return k ? t(`leads.${k}`) : s;
  };
  const activeFilterCount = [statusFilter, qualificationFilter, platformFilter, contactFilter].filter(f => f !== 'all').length;

  /* ─── Render ─── */
  if (loading) {
    return (
      <DashboardLayout>
        <SectionContainer className="py-8 md:py-10">
          <div className="mb-8"><div className="h-8 w-32 bg-gray-300 dark:bg-gray-700 rounded animate-pulse" /><div className="h-4 w-48 bg-gray-300 dark:bg-gray-700 rounded mt-2 animate-pulse" /></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => <LeadCardSkeleton key={i} />)}
          </div>
        </SectionContainer>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <SectionContainer className="py-6 md:py-10">
        {/* Header */}
        <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">{t('leads.title')}</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              {filteredLeads.length} {t('leads.foundCount')}
              {filteredLeads.length !== leads.length && ` (${leads.length} total)`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            <Button onClick={recalculateScores} disabled={recalculating} variant="outline" size="sm"
              className="border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300">
              {recalculating ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1.5 h-4 w-4" />}
              <span className="hidden sm:inline">{t('leads.recalculateScores')}</span>
              <span className="sm:hidden">Scores</span>
            </Button>
            <Button onClick={exportCSV} size="sm" className="bg-violet-600 hover:bg-violet-700 text-white">
              <Download className="mr-1.5 h-4 w-4" />
              <span className="hidden sm:inline">{t('leads.exportAll')}</span>
              <span className="sm:hidden">Exportar</span>
            </Button>
          </div>
        </div>

        {/* Score Stats */}
        {scoreStats && scoreStats.total > 0 && <div className="mb-6"><ScoreStatsSummary stats={scoreStats} /></div>}

        {/* Search + Filter Toggle + View Toggle */}
        <div className="mb-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input placeholder={t('leads.searchPlaceholder')} value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              className="bg-white dark:bg-gray-900/50 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white pl-10" />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}
              className={`border-gray-300 dark:border-gray-700 ${showFilters ? 'bg-violet-500/10 border-violet-500/30' : ''}`}>
              <Filter className="h-4 w-4 mr-1.5" />
              Filtros
              {activeFilterCount > 0 && (
                <span className="ml-1.5 bg-violet-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">{activeFilterCount}</span>
              )}
            </Button>
            <div className="hidden md:flex border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <button onClick={() => setViewMode('cards')}
                className={`px-3 py-2 ${viewMode === 'cards' ? 'bg-violet-600 text-white' : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button onClick={() => setViewMode('table')}
                className={`px-3 py-2 ${viewMode === 'table' ? 'bg-violet-600 text-white' : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                <LayoutList className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <Card className="bg-white dark:bg-gray-900/50 border-gray-200 dark:border-white/5 p-4 mb-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="bg-gray-50 dark:bg-gray-950/50 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white text-sm">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">
                  <SelectItem value="all">{t('leads.statusAll')}</SelectItem>
                  <SelectItem value="new">{t('leads.statusNew')}</SelectItem>
                  <SelectItem value="contacted">{t('leads.statusContacted')}</SelectItem>
                  <SelectItem value="discarded">{t('leads.statusDiscarded')}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={qualificationFilter} onValueChange={setQualificationFilter}>
                <SelectTrigger className="bg-gray-50 dark:bg-gray-950/50 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white text-sm">
                  <SelectValue placeholder="Qualificação" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">
                  <SelectItem value="all">{t('leads.qualificationAll')}</SelectItem>
                  <SelectItem value="quente">{t('leads.qualificationHot')}</SelectItem>
                  <SelectItem value="morno">{t('leads.qualificationWarm')}</SelectItem>
                  <SelectItem value="frio">{t('leads.qualificationCold')}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={platformFilter} onValueChange={setPlatformFilter}>
                <SelectTrigger className="bg-gray-50 dark:bg-gray-950/50 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white text-sm">
                  <SelectValue placeholder="Plataforma" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">
                  <SelectItem value="all">Todas plataformas</SelectItem>
                  <SelectItem value="instagram">Instagram</SelectItem>
                  <SelectItem value="tiktok">TikTok</SelectItem>
                  <SelectItem value="linkedin">LinkedIn</SelectItem>
                  <SelectItem value="facebook">Facebook</SelectItem>
                </SelectContent>
              </Select>
              <Select value={contactFilter} onValueChange={setContactFilter}>
                <SelectTrigger className="bg-gray-50 dark:bg-gray-950/50 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white text-sm">
                  <SelectValue placeholder="Contato" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="has_any">Com contato</SelectItem>
                  <SelectItem value="has_phone">Com telefone</SelectItem>
                  <SelectItem value="has_email">Com email</SelectItem>
                  <SelectItem value="has_website">Com website</SelectItem>
                  <SelectItem value="favorites">⭐ Favoritos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between mt-3">
              <Select value={tableSortKey + '_' + tableSortDir} onValueChange={(v) => {
                const [k, d] = v.split('_'); setTableSortKey(k); setTableSortDir(d); setPage(1);
              }}>
                <SelectTrigger className="bg-gray-50 dark:bg-gray-950/50 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white text-sm max-w-[200px]">
                  <SelectValue placeholder="Ordenar" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">
                  <SelectItem value="created_at_desc">Mais recentes</SelectItem>
                  <SelectItem value="score_desc">Maior score</SelectItem>
                  <SelectItem value="followers_desc">Mais seguidores</SelectItem>
                  <SelectItem value="platform_asc">Plataforma</SelectItem>
                  <SelectItem value="city_asc">Cidade</SelectItem>
                  <SelectItem value="username_asc">Nome (A-Z)</SelectItem>
                </SelectContent>
              </Select>
              {activeFilterCount > 0 && (
                <Button variant="ghost" size="sm" onClick={() => { setStatusFilter('all'); setQualificationFilter('all'); setPlatformFilter('all'); setContactFilter('all'); }}
                  className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                  <X className="h-3.5 w-3.5 mr-1" /> Limpar filtros
                </Button>
              )}
            </div>
          </Card>
        )}

        {/* Bulk Actions */}
        {selectedIds.size > 0 && (
          <Card className="bg-violet-500/10 border-violet-500/20 p-3 mb-4 flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm font-medium text-gray-900 dark:text-white">{selectedIds.size} selecionado(s)</span>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setSelectedIds(new Set())} className="border-gray-300 dark:border-white/20 h-8">
                Limpar
              </Button>
              <Button size="sm" onClick={markSelectedContacted} className="bg-yellow-600 hover:bg-yellow-700 text-white h-8">
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Contatado
              </Button>
              <Button size="sm" onClick={exportSelectedCSV} className="bg-violet-600 hover:bg-violet-700 text-white h-8">
                <Download className="h-3.5 w-3.5 mr-1" /> Exportar
              </Button>
            </div>
          </Card>
        )}

        {/* Content */}
        {filteredLeads.length === 0 ? (
          <Card className="bg-white dark:bg-gray-900/50 border-gray-200 dark:border-white/5 p-12">
            <div className="text-center">
              <Users className="h-16 w-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {leads.length === 0 ? t('leads.noLeads') : t('leads.noLeadsMatch')}
              </h3>
              <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto mb-6">
                {leads.length === 0
                  ? 'Faça uma busca por hashtag ou palavra-chave para encontrar leads.'
                  : 'Tente ajustar os filtros ou a busca para encontrar leads.'}
              </p>
              {leads.length === 0 && (
                <Button onClick={() => window.location.href = '/search'} className="bg-violet-600 hover:bg-violet-700 text-white">
                  <Search className="h-4 w-4 mr-2" /> Nova Busca
                </Button>
              )}
              {leads.length > 0 && activeFilterCount > 0 && (
                <Button variant="outline" onClick={() => { setStatusFilter('all'); setQualificationFilter('all'); setPlatformFilter('all'); setContactFilter('all'); setSearchTerm(''); }}>
                  <X className="h-4 w-4 mr-2" /> Limpar todos os filtros
                </Button>
              )}
            </div>
          </Card>
        ) : (
          <>
            {/* Cards View (mobile always, desktop optional) */}
            {(viewMode === 'cards' || typeof window !== 'undefined') && (
              <div className={viewMode === 'table' ? 'md:hidden' : ''}>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {paginatedLeads.map(lead => (
                    <LeadCard key={lead.id} lead={lead}
                      selected={selectedIds.has(lead.id)} onSelect={toggleSelectOne}
                      onStatusChange={updateLeadStatus} onQualChange={updateLeadQualification}
                      onEdit={(l) => { setEditingLead(l); setEditNotes(l.notes || ''); }}
                      onAI={generateAIMessage} onFavorite={toggleFavorite} isFavorite={favorites.has(lead.id)}
                      getStatusText={getStatusText} t={t} />
                  ))}
                </div>
              </div>
            )}

            {/* Table View (desktop only) */}
            {viewMode === 'table' && (
              <div className="hidden md:block">
                <Card className="bg-white dark:bg-gray-900/50 border-gray-200 dark:border-white/5 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px] text-sm text-left">
                      <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-white/10">
                        <tr>
                          <th className="w-10 py-3 px-3">
                            <Checkbox checked={paginatedLeads.length > 0 && paginatedLeads.every(l => selectedIds.has(l.id))}
                              onCheckedChange={toggleSelectAll}
                              className="border-gray-400 data-[state=checked]:bg-violet-600 data-[state=checked]:border-violet-600" />
                          </th>
                          <th className="w-6 py-3 px-1"><Star className="h-3.5 w-3.5 text-gray-400" /></th>
                          <th className="py-3 px-3 text-gray-500 dark:text-gray-400 font-medium w-12">Foto</th>
                          <th className="py-3 px-3 text-gray-500 dark:text-gray-400 font-medium">
                            <button onClick={() => toggleSort('username')} className="flex items-center gap-1 hover:text-gray-900 dark:hover:text-white">
                              Nome {tableSortKey === 'username' && (tableSortDir === 'asc' ? '↑' : '↓')}
                            </button>
                          </th>
                          <th className="py-3 px-3 text-gray-500 dark:text-gray-400 font-medium w-24">
                            <button onClick={() => toggleSort('platform')} className="flex items-center gap-1 hover:text-gray-900 dark:hover:text-white">
                              Plataforma {tableSortKey === 'platform' && (tableSortDir === 'asc' ? '↑' : '↓')}
                            </button>
                          </th>
                          <th className="py-3 px-3 text-gray-500 dark:text-gray-400 font-medium">
                            <button onClick={() => toggleSort('city')} className="flex items-center gap-1 hover:text-gray-900 dark:hover:text-white">
                              Cidade {tableSortKey === 'city' && (tableSortDir === 'asc' ? '↑' : '↓')}
                            </button>
                          </th>
                          <th className="py-3 px-3 text-gray-500 dark:text-gray-400 font-medium">Contato</th>
                          <th className="py-3 px-3 text-gray-500 dark:text-gray-400 font-medium">
                            <button onClick={() => toggleSort('score')} className="flex items-center gap-1 hover:text-gray-900 dark:hover:text-white">
                              Score {tableSortKey === 'score' && (tableSortDir === 'asc' ? '↑' : '↓')}
                            </button>
                          </th>
                          <th className="py-3 px-3 text-gray-500 dark:text-gray-400 font-medium">Status</th>
                          <th className="py-3 px-3 text-gray-500 dark:text-gray-400 font-medium w-12">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedLeads.map(lead => {
                          const waUrl = getWhatsAppUrl(lead.phone);
                          return (
                            <tr key={lead.id} className="border-b border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                              <td className="py-2 px-3">
                                <Checkbox checked={selectedIds.has(lead.id)} onCheckedChange={c => toggleSelectOne(lead.id, !!c)}
                                  className="border-gray-400 data-[state=checked]:bg-violet-600 data-[state=checked]:border-violet-600" />
                              </td>
                              <td className="py-2 px-1">
                                <button onClick={() => toggleFavorite(lead.id)} className="p-1 hover:bg-gray-100 dark:hover:bg-white/5 rounded">
                                  <Star className={`h-4 w-4 ${favorites.has(lead.id) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300 dark:text-gray-600'}`} />
                                </button>
                              </td>
                              <td className="py-2 px-3"><ProfilePhoto lead={lead} /></td>
                              <td className="py-2 px-3">
                                <div className="font-medium text-gray-900 dark:text-white truncate max-w-[200px]">{lead.name || `@${lead.username}`}</div>
                                <a href={lead.profile_url} target="_blank" rel="noopener noreferrer"
                                  className="text-xs text-violet-600 dark:text-violet-400 hover:underline">@{lead.username}</a>
                              </td>
                              <td className="py-2 px-3"><PlatformBadge platform={lead.platform} /></td>
                              <td className="py-2 px-3 text-gray-600 dark:text-gray-400 text-sm">{lead.city || lead.location || '—'}</td>
                              <td className="py-2 px-3">
                                <div className="flex items-center gap-1.5">
                                  {lead.phone && <a href={`tel:${lead.phone.replace(/\D/g, '')}`} className="p-1.5 rounded bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-500/20" title={lead.phone}><Phone className="h-3.5 w-3.5" /></a>}
                                  {waUrl && <a href={waUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20" title="WhatsApp"><MessageCircle className="h-3.5 w-3.5" /></a>}
                                  {lead.email && <a href={`mailto:${lead.email}`} className="p-1.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20" title={lead.email}><Mail className="h-3.5 w-3.5" /></a>}
                                  {lead.website && <a href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded bg-violet-500/10 text-violet-600 dark:text-violet-400 hover:bg-violet-500/20" title={lead.website}><Globe className="h-3.5 w-3.5" /></a>}
                                  {!lead.phone && !lead.email && !lead.website && <span className="text-gray-400 text-xs">—</span>}
                                </div>
                              </td>
                              <td className="py-2 px-3">{lead.score != null && <ScoreBadge score={lead.score} size="sm" />}</td>
                              <td className="py-2 px-3">
                                <Select value={lead.status || 'new'} onValueChange={v => updateLeadStatus(lead.id, v)}>
                                  <SelectTrigger className="h-7 text-xs border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-gray-900/50 min-w-[90px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-white/10">
                                    <SelectItem value="new">{getStatusText('new')}</SelectItem>
                                    <SelectItem value="contacted">{getStatusText('contacted')}</SelectItem>
                                    <SelectItem value="discarded">{getStatusText('discarded')}</SelectItem>
                                  </SelectContent>
                                </Select>
                              </td>
                              <td className="py-2 px-3">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="bg-white dark:bg-gray-900 border-gray-200 dark:border-white/10 min-w-[180px]">
                                    <DropdownMenuItem asChild>
                                      <a href={lead.profile_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2"><ExternalLink className="h-4 w-4" /> Ver perfil</a>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => generateAIMessage(lead)}><Sparkles className="h-4 w-4 mr-2" /> Sugerir mensagem</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => { setEditingLead(lead); setEditNotes(lead.notes || ''); }}><Edit2 className="h-4 w-4 mr-2" /> Notas</DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            )}

            {/* Pagination */}
            <div className="flex flex-wrap items-center justify-between gap-4 mt-4 px-1">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, sortedLeads.length)} de {sortedLeads.length}
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-gray-600 dark:text-gray-300 px-2">
                  {page} / {totalPages}
                </span>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}

        {/* Notes Dialog */}
        <Dialog open={editingLead != null} onOpenChange={open => !open && setEditingLead(null)}>
          <DialogContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-white/5 text-gray-900 dark:text-white">
            <DialogHeader><DialogTitle>Notas do Lead</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label>Notas</Label>
                <Textarea value={editNotes} onChange={e => setEditNotes(e.target.value)}
                  placeholder="Adicione suas anotações..." className="bg-gray-50 dark:bg-gray-950/50 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white mt-2" rows={6} />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setEditingLead(null)} className="border-gray-300 dark:border-white/10 text-gray-700 dark:text-white">{t('common.cancel')}</Button>
                <Button onClick={saveNotes} className="bg-violet-600 hover:bg-violet-700 text-white">{t('common.save')}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* AI Message Dialog */}
        <Dialog open={aiMessageLead !== null} onOpenChange={open => !open && setAiMessageLead(null)}>
          <DialogContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-white/5 text-gray-900 dark:text-white max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-violet-400" /> Mensagem Sugerida por IA</DialogTitle>
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
                    <Button variant="outline" onClick={() => setAiMessageLead(null)} className="border-gray-300 dark:border-white/10 text-gray-700 dark:text-white">Fechar</Button>
                    <Button onClick={() => { navigator.clipboard.writeText(suggestedMessage); toast.success(t('leads.messageCopied')); }} className="bg-violet-600 hover:bg-violet-700 text-white">
                      <Copy className="h-4 w-4 mr-2" /> Copiar
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
