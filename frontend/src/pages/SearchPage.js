import React, { useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card } from '../components/ui/card';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, Plus, X } from 'lucide-react';
import { Link } from 'react-router-dom';

const SearchPage = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [keywords, setKeywords] = useState(['']);
  const [hashtags, setHashtags] = useState(['']);
  const [location, setLocation] = useState('');

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
      await api.post('/searches', {
        keywords: validKeywords,
        hashtags: validHashtags,
        location: location.trim() || null
      });
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
          <h1 className="text-4xl font-bold mb-2">Nova Busca</h1>
          <p className="text-gray-400">Configure os parâmetros para encontrar leads no Instagram</p>
        </div>

        {/* Plan Info */}
        <Card className="bg-gray-900/50 border-white/5 p-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-400">Leads disponíveis</div>
              <div className="text-2xl font-bold">{user?.leads_limit - user?.leads_used || 0}</div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-400">Plano atual</div>
              <div className="text-lg font-semibold capitalize">{user?.plan}</div>
            </div>
          </div>
        </Card>

        {/* Search Form */}
        <Card className="bg-gray-900/50 border-white/5 p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
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

            {/* Submit */}
            <Button
              type="submit"
              data-testid="start-search-button"
              disabled={loading}
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