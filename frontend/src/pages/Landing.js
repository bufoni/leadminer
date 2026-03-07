import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { SectionContainer, SectionHeading } from '../components/ui/section-container';
import { FeatureCard } from '../components/ui/feature-card';
import LanguageSelector from '../components/LanguageSelector';
import ThemeSelector from '../components/ThemeSelector';
import { ArrowRight, Search, Zap, Database, Shield, TrendingUp, Users, LayoutDashboard, UserPlus, Download, CheckCircle2, Quote, Menu, X, Play, MapPin, Hash, KeyRound, Camera, Video, Sparkles, FileDown } from 'lucide-react';

/** Product UI mockup for hero right side (browser-style frame + search/leads preview) */
function HeroMockup() {
  return (
    <div className="relative w-full max-w-lg mx-auto lg:max-w-none">
      <div className="relative rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-gray-900/80 shadow-2xl shadow-violet-500/10 overflow-hidden">
        {/* Browser chrome */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-gray-900">
          <div className="flex gap-1.5">
            <span className="w-3 h-3 rounded-full bg-red-400/80" />
            <span className="w-3 h-3 rounded-full bg-amber-400/80" />
            <span className="w-3 h-3 rounded-full bg-emerald-400/80" />
          </div>
          <div className="flex-1 flex justify-center">
            <span className="text-xs text-gray-400 dark:text-gray-500 truncate max-w-[180px]">
              app.leadminer.com.br
            </span>
          </div>
        </div>
        {/* Mock content: search + platform + sample results */}
        <div className="p-4 md:p-5 space-y-4">
          <div className="flex gap-2">
            <div className="flex-1 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center gap-2 px-3">
              <Search className="h-4 w-4 text-gray-400 shrink-0" />
              <span className="text-sm text-gray-400 dark:text-gray-500">marketing digital, growth</span>
            </div>
          </div>
          <div className="flex gap-2">
            <span className="px-3 py-1.5 rounded-lg bg-violet-500/20 text-violet-600 dark:text-violet-400 text-xs font-medium">
              Instagram
            </span>
            <span className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs">
              TikTok
            </span>
          </div>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-white/5"
              >
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-400 to-fuchsia-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="h-3 w-20 md:w-24 bg-gray-200 dark:bg-gray-700 rounded mb-1.5" />
                  <div className="h-2.5 w-28 md:w-32 bg-gray-100 dark:bg-gray-700/80 rounded" />
                </div>
                <span className="text-xs font-medium text-violet-600 dark:text-violet-400 shrink-0">Score 78</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const Landing = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isLoggedIn = !!user;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const plans = [
    { id: 'trial', name: 'Trial', price: 0, leads: 10, features: ['10 leads', 'Busca básica', 'Exportação CSV'] },
    { id: 'starter', name: 'Starter', price: 147, leads: 300, features: ['300 leads/mês', 'Busca avançada', 'Exportação CSV', 'Tags e status'] },
    { id: 'pro', name: 'Pro', price: 397, leads: 2000, features: ['2.000 leads/mês', 'Busca avançada', 'Exportação CSV', 'Tags e status', 'Suporte prioritário'], popular: true },
    { id: 'business', name: 'Business', price: 1497, leads: 10000, features: ['10.000 leads/mês', 'Busca avançada', 'Exportação CSV', 'Tags e status', 'Suporte VIP', 'API access'] }
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#030712]">
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-white/5 backdrop-blur-sm sticky top-0 z-50 bg-white/80 dark:bg-[#030712]/80">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link to="/" className="text-2xl font-bold text-gradient">
            LeadMiner
          </Link>
          <div className="hidden md:flex items-center gap-3">
            <LanguageSelector />
            <ThemeSelector />
            {isLoggedIn ? (
              <Link to="/dashboard">
                <Button data-testid="header-dashboard-button" className="bg-violet-600 hover:bg-violet-700 text-white inline-flex items-center gap-2">
                  <LayoutDashboard className="h-4 w-4" />
                  {t('landing.dashboard')}
                </Button>
              </Link>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost" data-testid="header-login-button" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                    {t('landing.login')}
                  </Button>
                </Link>
                <Link to="/register">
                  <Button data-testid="header-register-button" className="bg-violet-600 hover:bg-violet-700 text-white">
                    {t('landing.startFree')}
                  </Button>
                </Link>
              </>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="md:hidden text-gray-700 dark:text-gray-200"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label="Abrir menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 dark:border-white/10 px-4 py-4 bg-white/95 dark:bg-[#030712]/95">
            <div className="flex items-center gap-2 mb-4">
              <LanguageSelector />
              <ThemeSelector />
            </div>
            <div className="grid grid-cols-1 gap-2">
              {isLoggedIn ? (
                <Link to="/dashboard" onClick={() => setMobileMenuOpen(false)}>
                  <Button data-testid="header-dashboard-button-mobile" className="w-full bg-violet-600 hover:bg-violet-700 text-white inline-flex items-center justify-center gap-2">
                    <LayoutDashboard className="h-4 w-4" />
                    {t('landing.dashboard')}
                  </Button>
                </Link>
              ) : (
                <>
                  <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="ghost" data-testid="header-login-button-mobile" className="w-full text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5">
                      {t('landing.login')}
                    </Button>
                  </Link>
                  <Link to="/register" onClick={() => setMobileMenuOpen(false)}>
                    <Button data-testid="header-register-button-mobile" className="w-full bg-violet-600 hover:bg-violet-700 text-white">
                      {t('landing.startFree')}
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden section-container py-16 md:py-24 lg:py-28">
        <div className="absolute inset-0 bg-gradient-to-b from-violet-500/10 to-transparent" />
        <div className="section-inner relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left: Headline, subheadline, CTAs, trust metrics */}
            <div className="order-2 lg:order-1 text-center lg:text-left">
              <h1 className="font-bold tracking-tight mb-4 md:mb-6 text-gray-900 dark:text-white">
                {t('landing.heroHeadline')}
              </h1>
              <p className="text-base md:text-lg text-gray-600 dark:text-gray-400 mb-6 md:mb-8 max-w-xl mx-auto lg:mx-0 leading-relaxed">
                {t('landing.heroSubheadline')}
              </p>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center lg:justify-start">
                {isLoggedIn ? (
                  <Link to="/dashboard">
                    <Button data-testid="hero-cta-button" size="lg" className="bg-violet-600 hover:bg-violet-700 text-white group inline-flex items-center gap-2 w-full sm:w-auto">
                      <LayoutDashboard className="h-5 w-5" />
                      {t('landing.goToDashboard')}
                      <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </Link>
                ) : (
                  <>
                    <Link to="/register" className="w-full sm:w-auto">
                      <Button data-testid="hero-cta-button" size="lg" className="bg-violet-600 hover:bg-violet-700 text-white group inline-flex items-center gap-2 w-full sm:w-auto text-base px-8">
                        {t('landing.heroCtaPrimary')}
                        <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                      </Button>
                    </Link>
                    <a href="#demo" className="w-full sm:w-auto">
                      <Button variant="outline" size="lg" className="w-full sm:w-auto border-gray-300 dark:border-white/20 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 inline-flex items-center gap-2">
                        <Play className="h-5 w-5" />
                        {t('landing.heroCtaSecondary')}
                      </Button>
                    </a>
                  </>
                )}
              </div>
              <div className="mt-8 flex flex-wrap justify-center lg:justify-start gap-6 md:gap-10 text-sm text-gray-500 dark:text-gray-400">
                <span className="inline-flex items-center gap-2">
                  <Users className="h-5 w-5 text-violet-500" />
                  <strong className="text-gray-700 dark:text-gray-200">{t('landing.heroTrustUsers')}</strong>
                </span>
                <span className="inline-flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-violet-500" />
                  <strong className="text-gray-700 dark:text-gray-200">{t('landing.heroTrustLeads')}</strong>
                </span>
              </div>
            </div>

            {/* Right: Product screenshot / UI mockup */}
            <div className="order-1 lg:order-2 flex justify-center lg:justify-end">
              <HeroMockup />
            </div>
          </div>
        </div>
      </section>

      {/* Social proof */}
      <SectionContainer className="py-10 md:py-12">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row gap-6 items-center">
          <div className="flex-1">
            <p className="text-xs font-semibold tracking-wide text-violet-600 dark:text-violet-400 uppercase mb-2">
              {t('landing.socialProofTitle')}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t('landing.socialProofSubtitle')}
            </p>
          </div>
          <div className="flex-1 w-full">
            <Card className="bg-white dark:bg-gray-900/50 border-gray-200 dark:border-white/5 p-5 flex gap-3">
              <div className="mt-1">
                <Quote className="h-6 w-6 text-violet-500" />
              </div>
              <div>
                <p className="text-gray-700 dark:text-gray-200 text-sm mb-3 italic">
                  {t('landing.testimonialQuote')}
                </p>
                <div className="text-sm">
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {t('landing.testimonialName')}
                  </span>
                  <span className="text-gray-500 dark:text-gray-400">
                    {' — '}
                    {t('landing.testimonialRole')}
                  </span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </SectionContainer>

      {/* Example Leads Section */}
      <SectionContainer className="py-16 md:py-20">
        <SectionHeading
          title={t('landing.exampleLeadsTitle')}
          subtitle={t('landing.exampleLeadsSubtitle')}
        />
        <div className="max-w-4xl mx-auto">
          <Card className="bg-white dark:bg-gray-900/50 border-gray-200 dark:border-white/5 overflow-hidden">
            <div className="p-4 md:p-6 border-b border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-gray-900/30">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">{t('landing.exampleLeadsSearchLabel')}</p>
              <div className="flex flex-wrap gap-4 md:gap-6 text-sm">
                <span className="inline-flex items-center gap-2">
                  <span className="text-gray-500 dark:text-gray-400">{t('landing.exampleLeadsHashtag')}:</span>
                  <span className="font-medium text-gray-900 dark:text-white">#dentist</span>
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="text-gray-500 dark:text-gray-400">{t('landing.exampleLeadsLocation')}:</span>
                  <span className="font-medium text-gray-900 dark:text-white">São Paulo</span>
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="text-gray-500 dark:text-gray-400">{t('landing.exampleLeadsPlatform')}:</span>
                  <span className="font-medium text-gray-900 dark:text-white">Instagram</span>
                </span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[500px] text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-gray-900/30">
                    <th className="py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">{t('landing.exampleLeadsColProfile')}</th>
                    <th className="py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">{t('landing.exampleLeadsColFollowers')}</th>
                    <th className="py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">{t('landing.exampleLeadsColCity')}</th>
                    <th className="py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">{t('landing.exampleLeadsColContact')}</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { profile: '@clinicadentalsp', followers: '8.2k', city: 'São Paulo', contact: 'website' },
                    { profile: '@sorrisoperfeito', followers: '5.1k', city: 'São Paulo', contact: 'email' },
                    { profile: '@dr.dentista.sp', followers: '12k', city: 'São Paulo', contact: 'website' },
                    { profile: '@odontoclinic', followers: '3.8k', city: 'São Paulo', contact: 'phone' },
                    { profile: '@estudioodontal', followers: '6.4k', city: 'São Paulo', contact: 'website' },
                  ].map((row, i) => (
                    <tr key={i} className="border-b border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                      <td className="py-3 px-4 font-medium text-violet-600 dark:text-violet-400">{row.profile}</td>
                      <td className="py-3 px-4 text-gray-600 dark:text-gray-400">{row.followers}</td>
                      <td className="py-3 px-4 text-gray-600 dark:text-gray-400">{row.city}</td>
                      <td className="py-3 px-4 text-gray-600 dark:text-gray-400">{row.contact}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 md:p-6 border-t border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-gray-900/30">
              <Link to="/register">
                <Button className="w-full sm:w-auto bg-violet-600 hover:bg-violet-700 text-white inline-flex items-center gap-2" data-testid="example-leads-export-button">
                  <Download className="h-4 w-4" />
                  {t('landing.exampleLeadsExportButton')}
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </SectionContainer>

      {/* Features Section */}
      <SectionContainer className="bg-gray-100 dark:bg-gray-900/20">
        <SectionHeading
          title={t('landing.featuresTitle')}
          subtitle={t('landing.featuresSubtitle')}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          <FeatureCard icon={Hash} title={t('landing.featureHashtagTitle')} description={t('landing.featureHashtagDesc')} iconClassName="bg-violet-500/10" />
          <FeatureCard icon={KeyRound} title={t('landing.featureKeywordTitle')} description={t('landing.featureKeywordDesc')} iconClassName="bg-blue-500/10" />
          <FeatureCard icon={Camera} title={t('landing.featureInstagramTitle')} description={t('landing.featureInstagramDesc')} iconClassName="bg-pink-500/10" />
          <FeatureCard icon={Video} title={t('landing.featureTiktokTitle')} description={t('landing.featureTiktokDesc')} iconClassName="bg-slate-500/10" />
          <FeatureCard icon={MapPin} title={t('landing.featureLocationTitle')} description={t('landing.featureLocationDesc')} iconClassName="bg-emerald-500/10" />
          <FeatureCard icon={Sparkles} title={t('landing.featureEnrichmentTitle')} description={t('landing.featureEnrichmentDesc')} iconClassName="bg-amber-500/10" />
          <FeatureCard icon={FileDown} title={t('landing.featureCsvTitle')} description={t('landing.featureCsvDesc')} iconClassName="bg-cyan-500/10" />
          <FeatureCard icon={LayoutDashboard} title={t('landing.featureDashboardTitle')} description={t('landing.featureDashboardDesc')} iconClassName="bg-fuchsia-500/10" />
        </div>
      </SectionContainer>

      {/* How the Platform Works - Workflow */}
      <SectionContainer className="py-16 md:py-20 bg-gray-100 dark:bg-gray-900/20">
        <SectionHeading
          title={t('landing.workflowTitle')}
          subtitle={t('landing.workflowSubtitle')}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          {[
            { step: 1, icon: Search, titleKey: 'workflowStep1Title', descKey: 'workflowStep1Desc', iconBg: 'bg-violet-500/10', iconColor: 'text-violet-500' },
            { step: 2, icon: Users, titleKey: 'workflowStep2Title', descKey: 'workflowStep2Desc', iconBg: 'bg-blue-500/10', iconColor: 'text-blue-500' },
            { step: 3, icon: MapPin, titleKey: 'workflowStep3Title', descKey: 'workflowStep3Desc', iconBg: 'bg-emerald-500/10', iconColor: 'text-emerald-500' },
            { step: 4, icon: Download, titleKey: 'workflowStep4Title', descKey: 'workflowStep4Desc', iconBg: 'bg-fuchsia-500/10', iconColor: 'text-fuchsia-500' },
          ].map(({ step, icon: Icon, titleKey, descKey, iconBg, iconColor }) => (
            <Card
              key={step}
              className="bg-white dark:bg-gray-900/50 border-gray-200 dark:border-white/5 p-6 h-full flex flex-col"
            >
              <div className={`w-12 h-12 rounded-lg ${iconBg} ${iconColor} flex items-center justify-center mb-4 shrink-0`}>
                <Icon className="h-6 w-6" />
              </div>
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                {t('landing.workflowStepLabel')} {step}
              </span>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2 leading-snug">
                {t(`landing.${titleKey}`)}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                {t(`landing.${descKey}`)}
              </p>
            </Card>
          ))}
        </div>
      </SectionContainer>

      {/* Pricing Section */}
      <SectionContainer>
        <SectionHeading
          title={t('landing.pricingTitle')}
          subtitle={t('landing.pricingSubtitle')}
        />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
            {plans.map((plan) => {
              const pricePerLead = plan.price > 0 && plan.leads > 0 ? (plan.price / plan.leads).toFixed(2) : null;
              return (
                <Card
                  key={plan.id}
                  data-testid={`pricing-plan-${plan.id}`}
                  className={`bg-white dark:bg-gray-900/50 border p-6 relative transition-all ${
                    plan.popular
                      ? 'border-violet-500 ring-2 ring-violet-500/30 shadow-xl shadow-violet-500/25 scale-[1.02] z-10'
                      : 'border-gray-200 dark:border-white/5'
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge variant="primary" className="px-3 py-1">{t('landing.recommended')}</Badge>
                    </div>
                  )}
                  <h3 className="font-semibold mb-3 text-gray-900 dark:text-white">{plan.name}</h3>
                  <div className="mb-3">
                    <span className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">R$ {plan.price}</span>
                    {plan.price > 0 && <span className="text-gray-500 dark:text-gray-400">{t('landing.perMonth')}</span>}
                  </div>
                  <div className="mb-4 space-y-1 text-sm">
                    <p className="text-gray-600 dark:text-gray-400">
                      <span className="font-medium text-gray-700 dark:text-gray-300">{t('landing.leadsIncluded')}:</span>{' '}
                      {plan.leads.toLocaleString('pt-BR')}
                    </p>
                    {pricePerLead ? (
                      <p className="text-violet-600 dark:text-violet-400 font-medium">
                        R$ {Number(pricePerLead).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} {t('landing.pricePerLead')}
                      </p>
                    ) : (
                      <p className="text-gray-500 dark:text-gray-400">{t('landing.pricePerLead')}: —</p>
                    )}
                  </div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                    {t('landing.featuresIncluded')}
                  </p>
                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start text-sm text-gray-600 dark:text-gray-400">
                        <span className="text-violet-400 mr-2 shrink-0">✓</span>
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Link to="/register">
                    <Button
                      data-testid={`pricing-cta-${plan.id}`}
                      className={`w-full ${
                        plan.popular
                          ? 'bg-violet-600 hover:bg-violet-700 text-white'
                          : 'bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-900 dark:text-white border border-gray-200 dark:border-white/10'
                      }`}
                    >
                      {plan.price === 0 ? t('landing.startFreePricing') : t('landing.subscribeNow')}
                    </Button>
                  </Link>
                </Card>
              );
            })}
          </div>
      </SectionContainer>

      {/* Final CTA */}
      <SectionContainer className="py-16">
        <Card className="max-w-3xl mx-auto text-center bg-white dark:bg-gray-900/50 border-gray-200 dark:border-white/5 px-8 py-10">
          <h2 className="font-semibold mb-4 text-gray-900 dark:text-white">
            {t('landing.ctaFinalTitle')}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-8 text-base md:text-lg">
            {t('landing.ctaFinalSubtitle')}
          </p>
          <Link to="/register">
            <Button
              size="lg"
              className="bg-violet-600 hover:bg-violet-700 text-white inline-flex items-center gap-2 px-8"
            >
              {t('landing.ctaFinalButton')}
              <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
        </Card>
      </SectionContainer>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-white/5 py-8">
        <div className="container mx-auto px-4 text-center text-gray-500 dark:text-gray-500 text-sm">
          <p>{t('landing.footer')}</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;