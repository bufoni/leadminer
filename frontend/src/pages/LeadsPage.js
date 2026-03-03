import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../lib/api';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { ArrowLeft, Download, Search, ExternalLink } from 'lucide-react';

const LeadsPage = () => {
  const [searchParams] = useSearchParams();
  const searchId = searchParams.get('search_id');
  
  const [leads, setLeads] = useState([]);
  const [filteredLeads, setFilteredLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetchLeads();
  }, [searchId]);

  useEffect(() => {
    filterLeads();
  }, [leads, searchTerm, statusFilter]);

  const fetchLeads = async () => {
    try {
      const params = searchId ? { search_id: searchId } : {};
      const response = await api.get('/leads', { params });
      setLeads(response.data);
    } catch (error) {
      toast.error('Erro ao carregar leads');
    } finally {
      setLoading(false);
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
      contacted: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
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
          <Link to="/dashboard">
            <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-4xl font-bold mb-2">Leads</h1>
            <p className="text-gray-400">{filteredLeads.length} leads encontrados</p>
          </div>
          <Button
            data-testid="export-csv-button"
            onClick={exportCSV}
            className="bg-violet-600 hover:bg-violet-700 text-white"
          >
            <Download className="mr-2 h-4 w-4" />
            Exportar CSV
          </Button>
        </div>

        {/* Filters */}
        <Card className="bg-gray-900/50 border-white/5 p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                data-testid="search-leads-input"
                placeholder="Buscar por nome, username ou email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-gray-950/50 border-gray-800 text-white pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger data-testid="status-filter" className="bg-gray-950/50 border-gray-800 text-white">
                <SelectValue placeholder="Filtrar por status" />
              </SelectTrigger>
              <SelectContent className="bg-gray-900 border-gray-800 text-white">
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="new">Novo</SelectItem>
                <SelectItem value="contacted">Contatado</SelectItem>
                <SelectItem value="discarded">Descartado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>

        {/* Leads Table */}
        {filteredLeads.length === 0 ? (
          <Card className="bg-gray-900/50 border-white/5 p-12">
            <div className="text-center">
              <p className="text-gray-400">
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
                className="bg-gray-900/50 border-white/5 p-4 hover:border-violet-500/30 transition-all"
              >
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-lg">{lead.name || lead.username}</h3>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(
                          lead.status
                        )}`}
                      >
                        {getStatusText(lead.status)}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-400">
                      <div>Username: @{lead.username}</div>
                      {lead.email && <div>Email: {lead.email}</div>}
                      {lead.phone && <div>Telefone: {lead.phone}</div>}
                      {lead.followers && <div>Seguidores: {lead.followers.toLocaleString()}</div>}
                    </div>
                    {lead.bio && (
                      <p className="text-sm text-gray-400 mt-2 line-clamp-2">{lead.bio}</p>
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
                    <Select
                      value={lead.status}
                      onValueChange={(value) => updateLeadStatus(lead.id, value)}
                    >
                      <SelectTrigger
                        data-testid={`lead-status-${lead.id}`}
                        className="bg-gray-950/50 border-gray-800 text-white w-[140px]"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-900 border-gray-800 text-white">
                        <SelectItem value="new">Novo</SelectItem>
                        <SelectItem value="contacted">Contatado</SelectItem>
                        <SelectItem value="discarded">Descartado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default LeadsPage;