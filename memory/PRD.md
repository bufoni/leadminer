# LeadMiner - Product Requirements Document

## Visão Geral
**LeadMiner** é uma plataforma SaaS para geração de leads a partir de dados públicos do Instagram via web scraping controlado.

## Stack Tecnológico
- **Backend:** FastAPI (Python) - porta 8001
- **Frontend:** React + TailwindCSS - porta 3000
- **Database:** MongoDB
- **Scraper Service:** FastAPI microserviço isolado - porta 8002
- **Auth:** JWT + Google OAuth + Facebook OAuth (pendente configuração)

## Arquitetura

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│                 │     │                  │     │                 │
│    Frontend     │────▶│    Backend API   │────▶│ Scraper Service │
│   (React:3000)  │     │  (FastAPI:8001)  │     │  (FastAPI:8002) │
│                 │     │                  │     │                 │
└─────────────────┘     └────────┬─────────┘     └─────────────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │                 │
                        │    MongoDB      │
                        │                 │
                        └─────────────────┘
```

---

## Funcionalidades Implementadas

### Autenticação
- [x] Registro de usuário com JWT
- [x] Login com email/senha
- [x] Google OAuth (Emergent-managed)
- [x] Facebook OAuth (implementado, aguardando credenciais)
- [x] Sistema de roles (user/admin)

### Dashboard do Usuário
- [x] Estatísticas (total de leads, leads usados, buscas, plano)
- [x] Ações rápidas (nova busca, ver leads, analytics, configurações)
- [x] Listagem de buscas recentes
- [x] Menu lateral colapsável com logo

### Sistema de Busca
- [x] Busca por palavras-chave
- [x] Busca por hashtags
- [x] Status da busca (queued, running, finished, failed)
- [x] Progresso em tempo real
- [x] Chamada ao microserviço de scraping

### Gestão de Leads
- [x] Listagem de leads com filtros
- [x] Status do lead (novo, contatado, descartado)
- [x] Qualificação (morno, quente, frio)
- [x] Notas personalizadas
- [x] Tags
- [x] Exportação CSV

### Analytics
- [x] Overview com métricas (total leads, leads do mês, taxa conversão)
- [x] Timeline de leads
- [x] Funil de conversão
- [x] Breakdown por fonte

### Admin Dashboard (Fase 3)
- [x] Estatísticas do sistema (usuários, leads, buscas)
- [x] Gestão de contas do Instagram
- [x] Gestão de proxies
- [x] Listagem de buscas do sistema
- [x] Listagem de usuários

### Configurações
- [x] Upload de avatar
- [x] Visualização do perfil
- [x] Planos e upgrade (Stripe integrado)
- [x] Sistema de referral com desconto
- [x] Histórico de cobranças

### AI & Notificações (Fase 4)
- [x] Sugestão de mensagens de follow-up via GPT-4o-mini
- [x] Sistema de notificações para leads quentes sem contato

### Scraper Service (Microserviço Isolado)
- [x] Microserviço separado em `/app/scraper-service`
- [x] API REST para scraping
- [x] Scraping de hashtags
- [x] Scraping de keywords
- [x] Extração de username, nome, bio, seguidores
- [x] Detecção de email/telefone na bio
- [x] Health check endpoint
- [x] Fallback local quando serviço indisponível

---

## Planos e Limites

| Plano | Preço | Leads/mês |
|-------|-------|-----------|
| Trial | R$ 0 | 10 |
| Starter | R$ 147 | 300 |
| Pro | R$ 397 | 2.000 |
| Business | R$ 1.497 | 10.000 |

---

## Pendências e Próximas Tarefas

### P0 - Alta Prioridade
- [ ] Configurar credenciais do Facebook (FACEBOOK_APP_ID, FACEBOOK_APP_SECRET)
- [ ] Configurar proxies funcionais para o scraper

### P1 - Média Prioridade
- [ ] Implementar billing real com Stripe (webhooks)
- [ ] Sistema de filas com Redis para jobs

### P2 - Backlog
- [ ] Rate limiting para API
- [ ] Dashboard de métricas de scraping
- [ ] Logs centralizados

---

## Credenciais de Teste

**Admin:**
- Email: admin@leadminer.com
- Password: Admin123!

**Conta Instagram para Scraping:**
- Username: um.cafe.estoico
- (configurada no sistema)

---

## Estrutura de Arquivos

```
/app
├── backend/                 # API Principal
│   ├── server.py           # FastAPI app
│   ├── requirements.txt
│   └── tests/
├── frontend/               # React App
│   ├── src/
│   │   ├── components/
│   │   ├── contexts/
│   │   ├── pages/
│   │   └── lib/
│   └── package.json
├── scraper-service/        # Microserviço de Scraping
│   ├── main.py            # FastAPI scraper service
│   └── requirements.txt
└── memory/
    └── PRD.md
```

---

## APIs Principais

### Backend (porta 8001)

**Autenticação**
- `POST /api/auth/register` - Registro
- `POST /api/auth/login` - Login
- `POST /api/auth/google/session` - Iniciar OAuth Google
- `POST /api/auth/google/callback` - Callback Google
- `POST /api/auth/facebook/session` - Iniciar OAuth Facebook
- `POST /api/auth/facebook/callback` - Callback Facebook

**Busca e Leads**
- `POST /api/searches` - Nova busca (chama scraper service)
- `GET /api/searches` - Listar buscas
- `GET /api/leads` - Listar leads
- `PATCH /api/leads/{id}` - Atualizar lead
- `GET /api/leads/export/csv` - Exportar CSV

**Admin (requer role=admin)**
- `GET /api/admin/stats` - Estatísticas do sistema
- `GET /api/admin/users` - Listar usuários
- `GET /api/admin/recent-searches` - Buscas recentes
- `POST /api/scraping-accounts` - Adicionar conta IG
- `POST /api/proxies` - Adicionar proxy

### Scraper Service (porta 8002)

- `GET /health` - Health check
- `POST /scrape` - Scraping completo (keywords + hashtags)
- `POST /scrape/hashtag` - Scraping de hashtag específica
- `POST /scrape/keyword` - Scraping de keyword específica

---

## Variáveis de Ambiente

### Backend (.env)
```
MONGO_URL=mongodb://localhost:27017
DB_NAME=test_database
JWT_SECRET=...
STRIPE_API_KEY=sk_test_emergent
FACEBOOK_APP_ID=
FACEBOOK_APP_SECRET=
SCRAPER_SERVICE_URL=http://localhost:8002
```

### Scraper Service (.env)
```
SCRAPER_PORT=8002
```

---

## Última Atualização
**Data:** 03/03/2026
**Versão:** 1.1.0 - Microserviço de scraping separado
