#!/bin/bash
# ══════════════════════════════════════════════
# PIPA DRIVEN CRM — Deploy Script para VPS
# ══════════════════════════════════════════════
#
# USO:
#   1. Crie um Droplet Ubuntu 24.04 na DigitalOcean
#   2. Copie o projeto para o VPS
#   3. Execute: bash deploy.sh
#
# ══════════════════════════════════════════════

set -e

# ── Cores ─────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${GREEN}[PIPA]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
err()  { echo -e "${RED}[ERRO]${NC} $1"; exit 1; }

# ── Carregar .env.production ──────────────────
if [ -f .env.production ]; then
    export $(grep -v '^#' .env.production | xargs)
    log "Variáveis de ambiente carregadas."
else
    err "Arquivo .env.production não encontrado. Copie o .env.production e preencha."
fi

# ── Validar variáveis ─────────────────────────
[ -z "$VITE_SUPABASE_URL" ] && err "VITE_SUPABASE_URL não definida no .env.production"
[ -z "$VITE_SUPABASE_ANON_KEY" ] && err "VITE_SUPABASE_ANON_KEY não definida no .env.production"

DOMAIN="${DOMAIN:-}"

# ══════════════════════════════════════════════
# ETAPA 1: Instalar dependências do sistema
# ══════════════════════════════════════════════
log "Etapa 1/5 — Instalando dependências do sistema..."

# Atualizar sistema
apt-get update -qq && apt-get upgrade -y -qq

# Instalar Docker se não existir
if ! command -v docker &> /dev/null; then
    log "Instalando Docker..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
    log "Docker instalado."
else
    log "Docker já instalado."
fi

# Instalar Docker Compose plugin se não existir
if ! docker compose version &> /dev/null; then
    log "Instalando Docker Compose..."
    apt-get install -y -qq docker-compose-plugin
fi

# Firewall
log "Configurando firewall..."
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# ══════════════════════════════════════════════
# ETAPA 2: Configurar SSL (se tiver domínio)
# ══════════════════════════════════════════════
log "Etapa 2/5 — Configurando Nginx..."

if [ -n "$DOMAIN" ]; then
    log "Domínio detectado: $DOMAIN"

    # Trocar placeholder pelo domínio real no nginx-ssl.conf
    sed "s/DOMAIN_PLACEHOLDER/$DOMAIN/g" nginx-ssl.conf > nginx.conf
    log "Nginx configurado com SSL para $DOMAIN"

    # Gerar certificado SSL
    log "Etapa 3/5 — Gerando certificado SSL..."

    # Primeiro, subir sem SSL para validar o domínio
    docker compose up -d --build crm

    # Gerar certificado
    docker compose run --rm certbot certonly \
        --webroot \
        --webroot-path /var/www/certbot \
        -d "$DOMAIN" \
        --email admin@pipadriven.com.br \
        --agree-tos \
        --no-eff-email

    # Rebuild com SSL
    docker compose down
    log "Certificado SSL gerado."
else
    warn "Sem domínio configurado. Rodando em HTTP (IP direto)."
    log "Para adicionar domínio depois, edite DOMAIN no .env.production e rode novamente."
fi

# ══════════════════════════════════════════════
# ETAPA 4: Build e deploy
# ══════════════════════════════════════════════
log "Etapa 4/5 — Build e deploy da aplicação..."

docker compose up -d --build

# ══════════════════════════════════════════════
# ETAPA 5: Verificar
# ══════════════════════════════════════════════
log "Etapa 5/5 — Verificando..."

sleep 5

if docker compose ps | grep -q "Up"; then
    echo ""
    echo "══════════════════════════════════════════"
    echo ""
    log "PIPA DRIVEN CRM está no ar!"
    echo ""

    if [ -n "$DOMAIN" ]; then
        log "Acesse: https://$DOMAIN"
    else
        # Pegar IP público
        PUBLIC_IP=$(curl -s ifconfig.me 2>/dev/null || echo "SEU_IP")
        log "Acesse: http://$PUBLIC_IP"
    fi

    echo ""
    echo "══════════════════════════════════════════"
else
    err "Algo deu errado. Verifique com: docker compose logs"
fi
