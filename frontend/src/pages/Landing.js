import React from 'react';
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
import { ArrowRight, Search, Zap, Database, Shield, TrendingUp, Users, LayoutDashboard, UserPlus, Download, CheckCircle2, Quote } from 'lucide-react';

const Landing = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isLoggedIn = !!user;

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
          <div className="flex items-center gap-3">
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
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden section-container py-20 md:py-28">
        <div className="absolute inset-0 bg-gradient-to-b from-violet-500/10 to-transparent" />
        <div className="section-inner relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="font-bold tracking-tight mb-6">
              <span className="text-gradient">{t('landing.mineLeads')}</span>
              <br />
              <span className="text-gray-900 dark:text-white">{t('landing.fromInstagram')}</span>
            </h1>
            <p className="text-base md:text-lg text-gray-600 dark:text-gray-400 mb-8 max-w-2xl mx-auto leading-relaxed">
              {t('landing.heroSubtitle')}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              {isLoggedIn ? (
                <Link to="/dashboard">
                  <Button data-testid="hero-cta-button" size="lg" className="bg-violet-600 hover:bg-violet-700 text-white group inline-flex items-center gap-2">
                    <LayoutDashboard className="h-5 w-5" />
                    {t('landing.goToDashboard')}
                    <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              ) : (
                <Link to="/register">
                  <Button data-testid="hero-cta-button" size="lg" className="bg-violet-600 hover:bg-violet-700 text-white group inline-flex items-center gap-2 text-base px-8">
                    {t('landing.startFreeCta')}
                    <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              )}
            </div>
            <p className="mt-6 text-sm text-gray-500 dark:text-gray-400 flex flex-wrap justify-center gap-x-4 gap-y-1">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                {t('landing.noCardTrial')}
              </span>
              <span>{t('landing.trustStrip').split(' · ').slice(1).join(' · ')}</span>
            </p>
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

      {/* Features Section */}
      <SectionContainer className="bg-gray-100 dark:bg-gray-900/20">
        <SectionHeading
          title={t('landing.featuresTitle')}
          subtitle={t('landing.featuresSubtitle')}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <FeatureCard icon={Search} title={t('landing.featureSearchTitle')} description={t('landing.featureSearchDesc')} />
          <FeatureCard icon={Zap} title={t('landing.featureFastTitle')} description={t('landing.featureFastDesc')} iconClassName="bg-blue-500/10" />
          <FeatureCard icon={Database} title={t('landing.featureExportTitle')} description={t('landing.featureExportDesc')} iconClassName="bg-emerald-500/10" />
          <FeatureCard icon={Shield} title={t('landing.featureSecurityTitle')} description={t('landing.featureSecurityDesc')} iconClassName="bg-fuchsia-500/10" />
          <FeatureCard icon={TrendingUp} title={t('landing.featureAnalyticsTitle')} description={t('landing.featureAnalyticsDesc')} iconClassName="bg-orange-500/10" />
          <FeatureCard icon={Users} title={t('landing.featureLeadsTitle')} description={t('landing.featureLeadsDesc')} iconClassName="bg-pink-500/10" />
        </div>
      </SectionContainer>

      {/* How it works */}
      <SectionContainer className="py-16">
        <SectionHeading
          className="mb-12"
          title={t('landing.howItWorksTitle')}
          subtitle={t('landing.howItWorksSubtitle')}
        />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <Card className="bg-white dark:bg-gray-900/50 border-gray-200 dark:border-white/5 p-6">
              <div className="w-10 h-10 rounded-full bg-violet-500/10 text-violet-500 flex items-center justify-center mb-4 text-sm font-semibold">
                1
              </div>
              <h3 className="font-semibold mb-2 text-gray-900 dark:text-white flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-violet-500" />
                {t('landing.step1Title')}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">{t('landing.step1Desc')}</p>
            </Card>
            <Card className="bg-white dark:bg-gray-900/50 border-gray-200 dark:border-white/5 p-6">
              <div className="w-10 h-10 rounded-full bg-violet-500/10 text-violet-500 flex items-center justify-center mb-4 text-sm font-semibold">
                2
              </div>
              <h3 className="font-semibold mb-2 text-gray-900 dark:text-white flex items-center gap-2">
                <Search className="h-5 w-5 text-violet-500" />
                {t('landing.step2Title')}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">{t('landing.step2Desc')}</p>
            </Card>
            <Card className="bg-white dark:bg-gray-900/50 border-gray-200 dark:border-white/5 p-6">
              <div className="w-10 h-10 rounded-full bg-violet-500/10 text-violet-500 flex items-center justify-center mb-4 text-sm font-semibold">
                3
              </div>
              <h3 className="font-semibold mb-2 text-gray-900 dark:text-white flex items-center gap-2">
                <Download className="h-5 w-5 text-violet-500" />
                {t('landing.step3Title')}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">{t('landing.step3Desc')}</p>
            </Card>
          </div>
      </SectionContainer>

      {/* Pricing Section */}
      <SectionContainer>
        <SectionHeading
          title={t('landing.pricingTitle')}
          subtitle={t('landing.pricingSubtitle')}
        />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
            {plans.map((plan) => (
              <Card
                key={plan.id}
                data-testid={`pricing-plan-${plan.id}`}
                className={`bg-white dark:bg-gray-900/50 border p-6 relative ${
                  plan.popular ? 'border-violet-500/50 shadow-lg shadow-violet-500/20' : 'border-gray-200 dark:border-white/5'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge variant="primary" className="px-3 py-1">{t('landing.mostPopular')}</Badge>
                  </div>
                )}
                <h3 className="font-semibold mb-2 text-gray-900 dark:text-white">{plan.name}</h3>
                <div className="mb-4">
                  <span className="text-4xl font-bold text-gray-900 dark:text-white">R${plan.price}</span>
                  {plan.price > 0 && <span className="text-gray-500 dark:text-gray-400">{t('landing.perMonth')}</span>}
                </div>
                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start text-sm text-gray-600 dark:text-gray-400">
                      <span className="text-violet-400 mr-2">✓</span>
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
            ))}
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