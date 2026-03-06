import React, { useState, useEffect } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card } from '../components/ui/card';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, Plus, X, Users } from 'lucide-react';
import PlatformLogo from '../components/PlatformLogo';
import { Link } from 'react-router-dom';

const SearchPage = () => {
  const { user, updateUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [keywords, setKeywords] = useState(['']);
  const [hashtags, setHashtags] = useState(['']);
  const [location, setLocation] = useState('');
  const [maxLeads, setMaxLeads] = useState(10);
  const [platform, setPlatform] = useState('instagram'); // 'instagram' | 'tiktok'
  
  // Calculate leads remaining
  const leadsRemaining = Math.max(0, (user?.leads_limit || 0) - (user?.leads_used || 0));
  
  // Update maxLeads when leadsRemaining changes
  useEffect(() => {
    if (maxLeads > leadsRemaining) {
      setMaxLeads(Math.min(leadsRemaining, 10));
    }
  }, [leadsRemaining]);

  const addKeyword = () => setKeywords([...keywords, '']);
  const removeKeyword = (index) => setKeywords(keywords.filter((_, i) => i !== index));
  const updateKeyword = (index, value) => {
    const newKeywords = [...keywords];
    newKeywords[index] = value;
    setKeywords(newKeywords);
  };

  const addHashtag = () => setHashtags([...hashtags, '']);
  const removeHashtag = (index) => setHashtags(hashtags.filter((_, i) => i !== index));
  const updateHashtag = (index, value) => {
    const newHashtags = [...hashtags];
    newHashtags[index] = value.replace('#', '');
    setHashtags(newHashtags);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const validKeywords = keywords.filter(k => k.trim());
    const validHashtags = hashtags.filter(h => h.trim());

    if (validKeywords.length === 0 && validHashtags.length === 0) {
      toast.error('Adicione pelo menos uma palavra-chave ou hashtag');
      setLoading(false);
      return;
    }

    try {
      const response = await api.post('/searches', {
        keywords: validKeywords,
        hashtags: validHashtags,
        location: location.trim() || null,
        max_leads: maxLeads,
        platform
      });
      
      // Update user's leads used count optimistically
      if (updateUser && user) {
        updateUser({ ...user, leads_used: user.leads_used + maxLeads });
      }
      
      toast.success('Busca iniciada com sucesso!');
      window.location.href = '/searches';
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao iniciar busca');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="p-8 max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 text-gray-900 dark:text-white">Nova Busca</h1>
          <p className="text-gray-600 dark:text-gray-400">Configure os parâmetros para encontrar leads no Instagram ou TikTok</p>
        </div>

        {/* Plan Info */}
        <Card className="bg-white dark:bg-gray-900/50 border-gray-200 dark:border-white/5 p-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Leads disponíveis este mês</div>
              <div className="text-2xl font-bold text-emerald-400">{leadsRemaining}</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-500 dark:text-gray-400">Usados / Limite</div>
              <div className="text-lg font-semibold">{user?.leads_used || 0} / {user?.leads_limit || 0}</div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500 dark:text-gray-400">Plano atual</div>
              <div className="text-lg font-semibold capitalize">{user?.plan}</div>
            </div>
          </div>
          {leadsRemaining === 0 && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-center">
              <p className="text-red-400 text-sm">Você atingiu o limite de leads do mês. Faça upgrade do seu plano para continuar.</p>
              <Link to="/settings" className="text-violet-400 hover:text-violet-300 text-sm underline mt-2 inline-block">
                Ver planos
              </Link>
            </div>
          )}
        </Card>

        {/* Search Form */}
        <Card className="bg-white dark:bg-gray-900/50 border-gray-200 dark:border-white/5 p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Platform */}
            <div className="space-y-3">
              <Label>Plataforma</Label>
              <div className="flex gap-3">
                <button
                  type="button"
                  data-testid="platform-instagram"
                  onClick={() => setPlatform('instagram')}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg border transition-all ${
                    platform === 'instagram'
                      ? 'border-violet-500 bg-violet-500/20 text-violet-300'
                      : 'border-gray-300 dark:border-white/10 bg-gray-100 dark:bg-gray-950/50 text-gray-600 dark:text-gray-400 hover:border-gray-400 dark:hover:border-white/20'
                  }`}
                >
                  <PlatformLogo platform="instagram" className="h-6 w-6 text-white" />
                  Instagram
                </button>
                <button
                  type="button"
                  data-testid="platform-tiktok"
                  onClick={() => setPlatform('tiktok')}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg border transition-all ${
                    platform === 'tiktok'
                      ? 'border-violet-500 bg-violet-500/20 text-violet-300'
                      : 'border-gray-300 dark:border-white/10 bg-gray-100 dark:bg-gray-950/50 text-gray-600 dark:text-gray-400 hover:border-gray-400 dark:hover:border-white/20'
                  }`}
                >
                  <PlatformLogo platform="tiktok" className="h-6 w-6 text-white" />
                  TikTok
                </button>
              </div>
            </div>

            {/* Keywords */}
            <div className="space-y-3">
              <Label>Palavras-chave</Label>
              <div className="space-y-2">
                {keywords.map((keyword, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      data-testid={`keyword-input-${index}`}
                      value={keyword}
                      onChange={(e) => updateKeyword(index, e.target.value)}
                      placeholder="Ex: marketing digital"
                      className="bg-gray-950/50 border-gray-800 text-white"
                    />
                    {keywords.length > 1 && (
                      <Button
                        type="button"
                        data-testid={`remove-keyword-${index}`}
                        variant="ghost"
                        size="sm"
                        onClick={() => removeKeyword(index)}
                        className="text-red-400 hover:text-red-300"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <Button
                type="button"
                data-testid="add-keyword-button"
                variant="outline"
                size="sm"
                onClick={addKeyword}
                className="border-white/10 text-white hover:bg-white/5"
              >
                <Plus className="mr-2 h-4 w-4" />
                Adicionar palavra-chave
              </Button>
            </div>

            {/* Hashtags */}
            <div className="space-y-3">
              <Label>Hashtags</Label>
              <div className="space-y-2">
                {hashtags.map((hashtag, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      data-testid={`hashtag-input-${index}`}
                      value={hashtag}
                      onChange={(e) => updateHashtag(index, e.target.value)}
                      placeholder="Ex: marketingdigital"
                      className="bg-gray-950/50 border-gray-800 text-white"
                    />
                    {hashtags.length > 1 && (
                      <Button
                        type="button"
                        data-testid={`remove-hashtag-${index}`}
                        variant="ghost"
                        size="sm"
                        onClick={() => removeHashtag(index)}
                        className="text-red-400 hover:text-red-300"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <Button
                type="button"
                data-testid="add-hashtag-button"
                variant="outline"
                size="sm"
                onClick={addHashtag}
                className="border-white/10 text-white hover:bg-white/5"
              >
                <Plus className="mr-2 h-4 w-4" />
                Adicionar hashtag
              </Button>
            </div>

            {/* Location */}
            <div className="space-y-2">
              <Label htmlFor="location">Localização (opcional)</Label>
              <Input
                id="location"
                data-testid="location-input"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Ex: São Paulo, Brasil"
                className="bg-gray-950/50 border-gray-800 text-white"
              />
            </div>

            {/* Max Leads Selector */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Users className="h-4 w-4 text-violet-400" />
                Quantidade de leads desejada
              </Label>
              <div className="flex items-center gap-4">
                <Input
                  type="range"
                  min="1"
                  max={Math.min(leadsRemaining, 50)}
                  value={maxLeads}
                  onChange={(e) => setMaxLeads(parseInt(e.target.value))}
                  className="flex-1 h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-violet-600"
                  data-testid="max-leads-slider"
                  disabled={leadsRemaining === 0}
                />
                <div className="w-20 text-center">
                  <Input
                    type="number"
                    min="1"
                    max={Math.min(leadsRemaining, 50)}
                    value={maxLeads}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 1;
                      setMaxLeads(Math.min(Math.max(val, 1), Math.min(leadsRemaining, 50)));
                    }}
                    className="bg-gray-50 dark:bg-gray-950/50 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white text-center"
                    data-testid="max-leads-input"
                    disabled={leadsRemaining === 0}
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Máximo disponível: {Math.min(leadsRemaining, 50)} leads por busca
              </p>
            </div>

            {/* Submit */}
            <Button
              type="submit"
              data-testid="start-search-button"
              disabled={loading || leadsRemaining === 0}
              className="w-full bg-violet-600 hover:bg-violet-700 text-white"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Iniciando busca...
                </>
              ) : (
                'Iniciar Busca'
              )}
            </Button>
          </form>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default SearchPage;