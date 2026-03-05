# 🚀 Deploy do LeadMiner com Dokploy

## Pré-requisitos

- VPS com mínimo 2GB RAM (4GB recomendado para scraper)
- Dokploy instalado
- Domínio configurado (ex: leadminer.com.br, api.leadminer.com.br)

## Passo a Passo

### 1. Preparar o Código

```bash
# Clone o repositório na sua máquina local
git clone <seu-repositorio> leadminer
cd leadminer
```

### 2. Configurar Variáveis de Ambiente

```bash
# Copie o arquivo de exemplo
cp .env.example .env

# Edite com seus valores
nano .env
```

**Variáveis obrigatórias:**
- `JWT_SECRET` - Gere com: `openssl rand -hex 32`
- `BACKEND_URL` - URL da sua API (ex: https://api.leadminer.com.br)
- `STRIPE_SECRET_KEY` - Chave do Stripe para pagamentos
- `SENDGRID_API_KEY` - Chave do SendGrid para emails

### 3. No Dokploy

#### Opção A: Deploy via Git (Recomendado)

1. No Dokploy, crie um novo **Project**
2. Adicione um **Service** tipo **Docker Compose**
3. Conecte ao seu repositório Git
4. Selecione o arquivo `docker-compose.yml`
5. Configure as variáveis de ambiente no Dokploy
6. Deploy!

#### Opção B: Deploy Manual

1. Faça upload do código para sua VPS:
```bash
scp -r leadminer/ user@sua-vps:/opt/leadminer
```

2. Na VPS:
```bash
cd /opt/leadminer
docker-compose up -d
```

### 4. Configurar Domínios no Dokploy

Configure os domínios para cada serviço:

| Serviço | Domínio | Porta Interna |
|---------|---------|---------------|
| frontend | leadminer.com.br | 3000 → 80 |
| backend | api.leadminer.com.br | 8001 |
| scraper | (interno) | 8002 |

### 5. SSL/HTTPS

O Dokploy gerencia SSL automaticamente via Let's Encrypt.
Basta adicionar os domínios e ativar HTTPS.

### 6. Configurar Contas de Scraping

Após o deploy, acesse o sistema e configure:
1. Conta de Instagram para scraping
2. Proxy residencial (recomendado para produção)

```bash
# Via API (substitua o token)
curl -X POST https://api.seudominio.com.br/api/scraping-accounts \
  -H "Authorization: Bearer SEU_TOKEN_ADMIN" \
  -H "Content-Type: application/json" \
  -d '{"username": "sua_conta", "password": "sua_senha"}'
```

## Arquitetura

```
┌─────────────────────────────────────────────────────┐
│                    Internet                          │
└─────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────┐
│              Dokploy (Traefik/Nginx)                │
│         SSL Termination + Load Balancing            │
└─────────────────────────────────────────────────────┘
          │                              │
          ▼                              ▼
┌──────────────────┐          ┌──────────────────────┐
│    Frontend      │          │      Backend         │
│  (React/Nginx)   │ ◄──────► │     (FastAPI)        │
│   :3000 → :80    │          │       :8001          │
└──────────────────┘          └──────────────────────┘
                                       │
                    ┌──────────────────┼──────────────────┐
                    ▼                  ▼                  ▼
          ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
          │   MongoDB    │   │   Scraper    │   │   SendGrid   │
          │    :27017    │   │    :8002     │   │   (Email)    │
          └──────────────┘   └──────────────┘   └──────────────┘
```

## Comandos Úteis

```bash
# Ver logs
docker-compose logs -f backend
docker-compose logs -f scraper

# Reiniciar serviço
docker-compose restart backend

# Rebuild após alterações
docker-compose up -d --build

# Ver status
docker-compose ps

# Backup do MongoDB
docker exec leadminer-mongodb mongodump --out /backup
docker cp leadminer-mongodb:/backup ./backup
```

## Troubleshooting

### Scraper não funciona
- Verifique se a VPS tem pelo menos 2GB RAM
- Verifique logs: `docker-compose logs scraper`
- O Playwright precisa de dependências específicas

### Frontend não conecta ao backend
- Verifique a variável `REACT_APP_BACKEND_URL`
- Verifique se o CORS está configurado no backend

### MongoDB não inicia
- Verifique permissões do volume
- Verifique espaço em disco

## Recursos Recomendados

| Recurso | Mínimo | Recomendado |
|---------|--------|-------------|
| CPU | 2 cores | 4 cores |
| RAM | 2GB | 4GB |
| Disco | 20GB | 50GB |
| Banda | 100Mbps | 1Gbps |

## Suporte

Dúvidas? Entre em contato pelo suporte do LeadMiner.
