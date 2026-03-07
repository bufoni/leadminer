import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import DashboardLayout from '../components/DashboardLayout';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card } from '../components/ui/card';
import { SectionContainer } from '../components/ui/section-container';
import { toast } from 'sonner';
import { Loader2, Plus, X, Users, Hash, KeyRound, MapPin, Search } from 'lucide-react';
import PlatformLogo from '../components/PlatformLogo';
import { Link } from 'react-router-dom';

const SearchPage = () => {
  const { user, updateUser } = useAuth();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [searchType, setSearchType] = useState('hashtag'); // 'hashtag' | 'keyword'
  const [keywords, setKeywords] = useState(['']);
  const [hashtags, setHashtags] = useState(['']);
  const [location, setLocation] = useState('');
  const [maxLeads, setMaxLeads] = useState(10);
  const [platform, setPlatform] = useState('instagram'); // 'instagram' | 'tiktok'

  const leadsRemaining = Math.max(0, (user?.leads_limit || 0) - (user?.leads_used || 0));

  useEffect(() => {
    if (maxLeads > leadsRemaining) {
      setMaxLeads(Math.min(leadsRemaining, 10));
    }
  }, [leadsRemaining]);

  const addKeyword = () => setKeywords([...keywords, '']);
  const removeKeyword = (index) => setKeywords(keywords.filter((_, i) => i !== index));
  const updateKeyword = (index, value) => {
    const next = [...keywords];
    next[index] = value;
    setKeywords(next);
  };

  const addHashtag = () => setHashtags([...hashtags, '']);
  const removeHashtag = (index) => setHashtags(hashtags.filter((_, i) => i !== index));
  const updateHashtag = (index, value) => {
    const next = [...hashtags];
    next[index] = value.replace('#', '');
    setHashtags(next);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const validKeywords = searchType === 'keyword' ? keywords.filter(k => k.trim()) : [];
    const validHashtags = searchType === 'hashtag' ? hashtags.filter(h => h.trim()) : [];

    if (validKeywords.length === 0 && validHashtags.length === 0) {
      toast.error(searchType === 'hashtag' ? t('search.errorAddHashtag') : t('search.errorAddKeyword'));
      setLoading(false);
      return;
    }

    try {
      await api.post('/searches', {
        keywords: validKeywords,
        hashtags: validHashtags,
        location: location.trim() || null,
        max_leads: maxLeads,
        platform
      });
      if (updateUser && user) {
        updateUser({ ...user, leads_used: user.leads_used + maxLeads });
      }
      toast.success(t('search.successStart'));
      window.location.href = '/searches';
    } catch (error) {
      toast.error(error.response?.data?.detail || t('search.errorStart'));
    } finally {
      setLoading(false);
    }
  };

  const segmentClass = (active) =>
    active
      ? 'border-violet-500 bg-violet-500/15 text-violet-600 dark:text-violet-400'
      : 'border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-gray-950/50 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-white/20';

  return (
    <DashboardLayout>
      <SectionContainer className="py-8 md:py-10">
        <div className="max-w-2xl mx-auto">
          <div className="mb-6">
            <h1 className="font-bold mb-1 text-gray-900 dark:text-white">{t('search.title')}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('search.description')}
            </p>
          </div>

          {/* Plan / quota */}
          <Card className="bg-white dark:bg-gray-900/50 border-gray-200 dark:border-white/5 p-4 mb-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-6">
                <div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{t('search.available')}</span>
                  <p className="text-xl font-bold text-emerald-500 dark:text-emerald-400">{leadsRemaining}</p>
                </div>
                <div className="h-8 w-px bg-gray-200 dark:bg-white/10" />
                <div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{t('search.usedLimit')}</span>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">{user?.leads_used || 0} / {user?.leads_limit || 0}</p>
                </div>
                <div className="h-8 w-px bg-gray-200 dark:bg-white/10" />
                <div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{t('search.plan')}</span>
                  <p className="text-lg font-semibold capitalize text-gray-900 dark:text-white">{user?.plan}</p>
                </div>
              </div>
              {leadsRemaining === 0 && (
                <Link to="/settings" className="text-sm text-violet-500 dark:text-violet-400 hover:underline">
                  {t('search.viewPlans')}
                </Link>
              )}
            </div>
            {leadsRemaining === 0 && (
              <p className="mt-3 text-sm text-red-500 dark:text-red-400">
                {t('search.limitReached')}
              </p>
            )}
          </Card>

          {/* Main search form */}
          <Card className="bg-white dark:bg-gray-900/50 border-gray-200 dark:border-white/5 p-6 md:p-8">
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* 1. Platform */}
              <div className="space-y-3">
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('search.platform')}</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    data-testid="platform-instagram"
                    onClick={() => setPlatform('instagram')}
                    className={`flex items-center justify-center gap-2 py-3 px-4 rounded-lg border-2 transition-all ${segmentClass(platform === 'instagram')}`}
                  >
                    <PlatformLogo platform="instagram" className="h-5 w-5" />
                    Instagram
                  </button>
                  <button
                    type="button"
                    data-testid="platform-tiktok"
                    onClick={() => setPlatform('tiktok')}
                    className={`flex items-center justify-center gap-2 py-3 px-4 rounded-lg border-2 transition-all ${segmentClass(platform === 'tiktok')}`}
                  >
                    <PlatformLogo platform="tiktok" className="h-5 w-5" />
                    TikTok
                  </button>
                </div>
              </div>

              {/* 2. Search type */}
              <div className="space-y-3">
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('search.searchType')}</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSearchType('hashtag')}
                    className={`flex items-center justify-center gap-2 py-3 px-4 rounded-lg border-2 transition-all ${segmentClass(searchType === 'hashtag')}`}
                  >
                    <Hash className="h-5 w-5" />
                    {t('search.hashtags')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSearchType('keyword')}
                    className={`flex items-center justify-center gap-2 py-3 px-4 rounded-lg border-2 transition-all ${segmentClass(searchType === 'keyword')}`}
                  >
                    <KeyRound className="h-5 w-5" />
                    {t('search.keywords')}
                  </button>
                </div>
              </div>

              {/* 3. Search input(s) */}
              <div className="space-y-3">
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {searchType === 'hashtag' ? t('search.hashtags') : t('search.keywords')}
                </Label>
                {searchType === 'hashtag' ? (
                  <>
                    <div className="space-y-2">
                      {hashtags.map((hashtag, index) => (
                        <div key={index} className="flex gap-2">
                          <span className="flex items-center px-3 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-white/10">#</span>
                          <Input
                            data-testid={`hashtag-input-${index}`}
                            value={hashtag}
                            onChange={(e) => updateHashtag(index, e.target.value)}
                            placeholder="Ex: dentista, clinica"
                            className="bg-gray-50 dark:bg-gray-950/50 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white min-w-0 flex-1"
                          />
                            {hashtags.length > 1 && (
                              <Button type="button" variant="ghost" size="icon" onClick={() => removeHashtag(index)} className="text-gray-400 hover:text-red-500 shrink-0" aria-label="Remover">
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                        </div>
                      ))}
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={addHashtag} data-testid="add-hashtag-button" className="border-gray-300 dark:border-white/10 text-gray-600 dark:text-gray-300">
                      <Plus className="mr-2 h-4 w-4" /> {t('search.addHashtag')}
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="space-y-2">
                      {keywords.map((keyword, index) => (
                        <div key={index} className="flex gap-2">
                          <Input
                            data-testid={`keyword-input-${index}`}
                            value={keyword}
                            onChange={(e) => updateKeyword(index, e.target.value)}
                            placeholder="Ex: marketing digital"
                            className="bg-gray-50 dark:bg-gray-950/50 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white min-w-0 flex-1"
                          />
                            {keywords.length > 1 && (
                              <Button type="button" variant="ghost" size="icon" onClick={() => removeKeyword(index)} className="text-gray-400 hover:text-red-500 shrink-0" aria-label="Remover">
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                        </div>
                      ))}
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={addKeyword} data-testid="add-keyword-button" className="border-gray-300 dark:border-white/10 text-gray-600 dark:text-gray-300">
                      <Plus className="mr-2 h-4 w-4" /> {t('search.addKeyword')}
                    </Button>
                  </>
                )}
              </div>

              {/* 4. Location */}
              <div className="space-y-2">
                <Label htmlFor="location" className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-gray-500" />
                  {t('search.locationOptional')}
                </Label>
                <Input
                  id="location"
                  data-testid="location-input"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Ex: São Paulo, Brasil"
                  className="bg-gray-50 dark:bg-gray-950/50 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white"
                />
              </div>

              {/* 5. Max leads (compact) */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <Users className="h-4 w-4 text-gray-500" />
                  {t('search.leadsQuantity')}
                </Label>
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    type="range"
                    min="1"
                    max={Math.min(leadsRemaining, 50)}
                    value={maxLeads}
                    onChange={(e) => setMaxLeads(parseInt(e.target.value))}
                    className="h-2 flex-1 min-w-[120px] max-w-[200px] rounded-lg appearance-none bg-gray-200 dark:bg-gray-800 accent-violet-600 cursor-pointer"
                    data-testid="max-leads-slider"
                    disabled={leadsRemaining === 0}
                  />
                  <Input
                    type="number"
                    min="1"
                    max={Math.min(leadsRemaining, 50)}
                    value={maxLeads}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 1;
                      setMaxLeads(Math.min(Math.max(val, 1), Math.min(leadsRemaining, 50)));
                    }}
                    className="w-20 h-9 text-center bg-gray-50 dark:bg-gray-950/50 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white"
                    data-testid="max-leads-input"
                    disabled={leadsRemaining === 0}
                  />
                  <span className="text-xs text-gray-500 dark:text-gray-400">máx. {Math.min(leadsRemaining, 50)}</span>
                </div>
              </div>

              {/* Run Search */}
              <div className="pt-2">
                <Button
                  type="submit"
                  data-testid="start-search-button"
                  disabled={loading || leadsRemaining === 0}
                  className="w-full h-12 text-base font-semibold bg-violet-600 hover:bg-violet-700 text-white rounded-lg shadow-lg shadow-violet-500/20"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      {t('search.startingSearch')}
                    </>
                  ) : (
                    <>
                      <Search className="mr-2 h-5 w-5" />
                      {t('search.runSearch')}
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </SectionContainer>
    </DashboardLayout>
  );
};

export default SearchPage;