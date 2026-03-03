import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { toast } from 'sonner';
import { ArrowLeft, Download, RefreshCw } from 'lucide-react';

const SearchesPage = () => {
  const [searches, setSearches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSearches();
    const interval = setInterval(fetchSearches, 3000);
    return () => clearInterval(interval);
  }, []);

  const fetchSearches = async () => {
    try {
      const response = await api.get('/searches');
      setSearches(response.data);
    } catch (error) {
      toast.error('Erro ao carregar buscas');
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
          <Button
            variant="ghost"
            size="sm"
            data-testid="refresh-button"
            onClick={fetchSearches}
            className="text-gray-400 hover:text-white"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold mb-2">Buscas</h1>
            <p className="text-gray-400">Acompanhe o status de todas as suas buscas</p>
          </div>
          <Link to="/search">
            <Button data-testid="new-search-button" className="bg-violet-600 hover:bg-violet-700 text-white">
              Nova Busca
            </Button>
          </Link>
        </div>

        {searches.length === 0 ? (
          <Card className="bg-gray-900/50 border-white/5 p-12">
            <div className="text-center">
              <p className="text-gray-400 mb-4">Nenhuma busca realizada ainda</p>
              <Link to="/search">
                <Button className="bg-violet-600 hover:bg-violet-700 text-white">
                  Criar Primeira Busca
                </Button>
              </Link>
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
            {searches.map((search) => (
              <Card
                key={search.id}
                data-testid={`search-card-${search.id}`}
                className="bg-gray-900/50 border-white/5 p-6 hover:border-violet-500/30 transition-all"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-lg">
                        {search.keywords.length > 0
                          ? search.keywords.join(', ')
                          : 'Sem palavras-chave'}
                      </h3>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(
                          search.status
                        )}`}
                      >
                        {getStatusText(search.status)}
                      </span>
                    </div>
                    {search.hashtags.length > 0 && (
                      <p className="text-sm text-gray-400 mb-1">#{search.hashtags.join(' #')}</p>
                    )}
                    {search.location && (
                      <p className="text-sm text-gray-400 mb-1">Localização: {search.location}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-400">
                      <span>{search.leads_found} leads encontrados</span>
                      <span>
                        {new Date(search.created_at).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {search.status === 'running' && (
                      <div className="w-32">
                        <div className="text-sm text-gray-400 mb-1">{search.progress}%</div>
                        <div className="w-full bg-gray-800 rounded-full h-2">
                          <div
                            className="bg-violet-600 h-2 rounded-full transition-all duration-500"
                            style={{ width: `${search.progress}%` }}
                          ></div>
                        </div>
                      </div>
                    )}

                    {search.status === 'finished' && search.leads_found > 0 && (
                      <Link to={`/leads?search_id=${search.id}`}>
                        <Button
                          size="sm"
                          data-testid={`view-leads-${search.id}`}
                          className="bg-violet-600 hover:bg-violet-700 text-white"
                        >
                          Ver Leads
                        </Button>
                      </Link>
                    )}
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

export default SearchesPage;