import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { ArrowRight, Search, Zap, Database, Shield, TrendingUp, Users, LayoutDashboard } from 'lucide-react';

const Landing = () => {
  const { user } = useAuth();
  const isLoggedIn = !!user;

  const plans = [
    { id: 'trial', name: 'Trial', price: 0, leads: 10, features: ['10 leads', 'Busca básica', 'Exportação CSV'] },
    { id: 'starter', name: 'Starter', price: 147, leads: 300, features: ['300 leads/mês', 'Busca avançada', 'Exportação CSV', 'Tags e status'] },
    { id: 'pro', name: 'Pro', price: 397, leads: 2000, features: ['2.000 leads/mês', 'Busca avançada', 'Exportação CSV', 'Tags e status', 'Suporte prioritário'], popular: true },
    { id: 'business', name: 'Business', price: 1497, leads: 10000, features: ['10.000 leads/mês', 'Busca avançada', 'Exportação CSV', 'Tags e status', 'Suporte VIP', 'API access'] }
  ];

  return (
    <div className="min-h-screen bg-[#030712]">
      {/* Header */}
      <header className="border-b border-white/5 backdrop-blur-sm sticky top-0 z-50 bg-[#030712]/80">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link to="/" className="text-2xl font-bold text-gradient">
            LeadMiner
          </Link>
          <div className="flex gap-3">
            {isLoggedIn ? (
              <Link to="/dashboard">
                <Button data-testid="header-dashboard-button" className="bg-violet-600 hover:bg-violet-700 text-white inline-flex items-center gap-2">
                  <LayoutDashboard className="h-4 w-4" />
                  Dashboard
                </Button>
              </Link>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost" data-testid="header-login-button" className="text-gray-400 hover:text-white">
                    Login
                  </Button>
                </Link>
                <Link to="/register">
                  <Button data-testid="header-register-button" className="bg-violet-600 hover:bg-violet-700 text-white">
                    Começar Grátis
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 md:py-32">
        <div className="absolute inset-0 bg-gradient-to-b from-violet-500/10 to-transparent"></div>
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6">
              <span className="text-gradient">Mine Leads</span>
              <br />
              <span className="text-white">Do Instagram</span>
            </h1>
            <p className="text-xl text-gray-400 mb-8 max-w-2xl mx-auto">
              Extraia dados públicos do Instagram de forma inteligente e automatizada. 
              Encontre leads qualificados para o seu negócio.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              {isLoggedIn ? (
                <Link to="/dashboard">
                  <Button data-testid="hero-cta-button" size="lg" className="bg-violet-600 hover:bg-violet-700 text-white group inline-flex items-center gap-2">
                    <LayoutDashboard className="h-5 w-5" />
                    Ir para o Dashboard
                    <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              ) : (
                <Link to="/register">
                  <Button data-testid="hero-cta-button" size="lg" className="bg-violet-600 hover:bg-violet-700 text-white group">
                    Começar Gratuitamente
                    <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-gray-900/20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-semibold mb-4">Recursos Poderosos</h2>
            <p className="text-gray-400 text-lg">Tudo que você precisa para gerar leads qualificados</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-gray-900/50 border border-white/5 rounded-lg p-6 hover:border-violet-500/30 transition-all">
              <div className="w-12 h-12 rounded-lg bg-violet-500/10 flex items-center justify-center mb-4">
                <Search className="h-6 w-6 text-violet-400" />
              </div>
              <h3 className="text-xl font-medium mb-2">Busca Avançada</h3>
              <p className="text-gray-400">Busque por palavras-chave, hashtags e localização específica.</p>
            </div>

            <div className="bg-gray-900/50 border border-white/5 rounded-lg p-6 hover:border-violet-500/30 transition-all">
              <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center mb-4">
                <Zap className="h-6 w-6 text-blue-400" />
              </div>
              <h3 className="text-xl font-medium mb-2">Processamento Rápido</h3>
              <p className="text-gray-400">Sistema de fila assíncrona para buscas rápidas e eficientes.</p>
            </div>

            <div className="bg-gray-900/50 border border-white/5 rounded-lg p-6 hover:border-violet-500/30 transition-all">
              <div className="w-12 h-12 rounded-lg bg-emerald-500/10 flex items-center justify-center mb-4">
                <Database className="h-6 w-6 text-emerald-400" />
              </div>
              <h3 className="text-xl font-medium mb-2">Exportação CSV</h3>
              <p className="text-gray-400">Exporte todos os seus leads em formato CSV para usar em CRMs.</p>
            </div>

            <div className="bg-gray-900/50 border border-white/5 rounded-lg p-6 hover:border-violet-500/30 transition-all">
              <div className="w-12 h-12 rounded-lg bg-fuchsia-500/10 flex items-center justify-center mb-4">
                <Shield className="h-6 w-6 text-fuchsia-400" />
              </div>
              <h3 className="text-xl font-medium mb-2">Segurança Total</h3>
              <p className="text-gray-400">Proxy rotation e rate limiting para máxima segurança.</p>
            </div>

            <div className="bg-gray-900/50 border border-white/5 rounded-lg p-6 hover:border-violet-500/30 transition-all">
              <div className="w-12 h-12 rounded-lg bg-orange-500/10 flex items-center justify-center mb-4">
                <TrendingUp className="h-6 w-6 text-orange-400" />
              </div>
              <h3 className="text-xl font-medium mb-2">Dashboard Analytics</h3>
              <p className="text-gray-400">Visualize métricas em tempo real de suas buscas.</p>
            </div>

            <div className="bg-gray-900/50 border border-white/5 rounded-lg p-6 hover:border-violet-500/30 transition-all">
              <div className="w-12 h-12 rounded-lg bg-pink-500/10 flex items-center justify-center mb-4">
                <Users className="h-6 w-6 text-pink-400" />
              </div>
              <h3 className="text-xl font-medium mb-2">Gestão de Leads</h3>
              <p className="text-gray-400">Organize leads com tags e status personalizados.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-semibold mb-4">Planos e Preços</h2>
            <p className="text-gray-400 text-lg">Escolha o plano ideal para o seu negócio</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
            {plans.map((plan) => (
              <div
                key={plan.id}
                data-testid={`pricing-plan-${plan.id}`}
                className={`bg-gray-900/50 border rounded-lg p-6 relative ${
                  plan.popular ? 'border-violet-500/50 shadow-lg shadow-violet-500/20' : 'border-white/5'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-violet-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                      POPULAR
                    </span>
                  </div>
                )}
                <h3 className="text-xl font-semibold mb-2">{plan.name}</h3>
                <div className="mb-4">
                  <span className="text-4xl font-bold">R${plan.price}</span>
                  {plan.price > 0 && <span className="text-gray-400">/mês</span>}
                </div>
                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start text-sm text-gray-400">
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
                        : 'bg-white/5 hover:bg-white/10 text-white border border-white/10'
                    }`}
                  >
                    {plan.price === 0 ? 'Começar Grátis' : 'Assinar Agora'}
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8">
        <div className="container mx-auto px-4 text-center text-gray-500 text-sm">
          <p>© 2024 LeadMiner. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;