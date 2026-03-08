#!/usr/bin/env bash
# Verificação do serviço de scrape (scraper-service)
# Uso: ./verify-scraper.sh [URL_BASE]
# Exemplo: ./verify-scraper.sh http://localhost:8002

set -e
BASE="${1:-http://localhost:8002}"

echo "=== Verificando Scraper Service em $BASE ==="
echo ""

# 1. Health check
echo "1. Health check (GET $BASE/health)"
if curl -sf "$BASE/health" > /dev/null; then
  curl -s "$BASE/health" | head -5
  echo ""
  echo "   [OK] Serviço está no ar."
else
  echo "   [FALHA] Serviço não responde. Verifique:"
  echo "   - Docker: docker compose ps (serviço 'scraper' deve estar Up)"
  echo "   - Local: python main.py ou uvicorn main:app --host 0.0.0.0 --port 8002"
  exit 1
fi

echo ""

# 2. Teste mínimo de scrape (só para ver se o endpoint responde)
echo "2. Teste do endpoint POST /scrape (request mínimo)"
echo "   Payload: keywords=[\"test\"], platform=instagram, max_profiles=2"
BODY='{"keywords":["test"],"hashtags":[],"max_profiles":2,"accounts":[],"proxies":[],"platform":"instagram"}'
RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/scrape" -H "Content-Type: application/json" -d "$BODY")
HTTP_CODE=$(echo "$RESP" | tail -n1)
JSON=$(echo "$RESP" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
  TOTAL=$(echo "$JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('total_found', '?'))" 2>/dev/null || echo "?")
  echo "   HTTP $HTTP_CODE - total_found: $TOTAL"
  if [ "$TOTAL" = "0" ]; then
    echo ""
    echo "   [AVISO] total_found=0 é comum quando:"
    echo "   - Instagram: não há contas de scraping configuradas (login necessário para busca)"
    echo "   - Instagram: API topsearch pode estar bloqueada ou com formato alterado"
    echo "   - TikTok: página de busca pode ter mudado ou estar bloqueando headless"
    echo "   - Confira os logs do container: docker compose logs scraper -f"
  else
    echo "   [OK] Scraper retornou $TOTAL lead(s)."
  fi
else
  echo "   [FALHA] HTTP $HTTP_CODE"
  echo "$JSON" | head -20
  exit 1
fi

echo ""
echo "=== Dicas se sempre retornar 0 ==="
echo "- Instagram: cadastre ao menos uma 'conta de scraping' (admin) e use a mesma sessão."
echo "- Veja os logs: docker compose logs scraper -f (ou saída do uvicorn)."
echo "- Variável no backend: SCRAPER_SERVICE_URL (ex: http://localhost:8002 ou http://scraper:8002)."
