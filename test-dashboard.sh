#!/bin/bash

# Script de teste do endpoint /dashboard/home
# Este script demonstra como testar o endpoint com dados reais

echo "========================================="
echo "   TESTE DO ENDPOINT /dashboard/home"
echo "========================================="
echo ""

# Configurações
API_URL="http://localhost:3000"
EMAIL="seu-email@example.com"
PASSWORD="sua-senha"

echo "1. Fazendo login..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

# Extrair token (assumindo jq instalado)
TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.accessToken')

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ Erro ao fazer login. Verifique as credenciais."
  echo "Resposta: $LOGIN_RESPONSE"
  exit 1
fi

echo "✅ Login realizado com sucesso!"
echo "Token: ${TOKEN:0:20}..."
echo ""

echo "2. Consultando dashboard..."
echo ""

DASHBOARD_RESPONSE=$(curl -s -X GET "$API_URL/dashboard/home" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json")

echo "========================================="
echo "   RESPOSTA DO DASHBOARD"
echo "========================================="
echo ""
echo $DASHBOARD_RESPONSE | jq '.'
echo ""

# Extrair alguns dados importantes
echo "========================================="
echo "   RESUMO EXECUTIVO"
echo "========================================="
echo ""
echo "💰 Saldo Total: R\$ $(echo $DASHBOARD_RESPONSE | jq -r '.accountsSummary.totalBalance')"
echo "📊 Receitas do Mês: R\$ $(echo $DASHBOARD_RESPONSE | jq -r '.currentMonth.income')"
echo "💸 Despesas do Mês: R\$ $(echo $DASHBOARD_RESPONSE | jq -r '.currentMonth.expense')"
echo "💵 Saldo do Mês: R\$ $(echo $DASHBOARD_RESPONSE | jq -r '.currentMonth.balance')"
echo "🏦 Contas Ativas: $(echo $DASHBOARD_RESPONSE | jq -r '.accountsSummary.activeAccountsCount')"
echo "🎯 Metas Ativas: $(echo $DASHBOARD_RESPONSE | jq -r '.goals.totalActiveGoals')"
echo "📋 Orçamentos: $(echo $DASHBOARD_RESPONSE | jq -r '.budgets.totalBudgets')"
echo "🔔 Notificações Não Lidas: $(echo $DASHBOARD_RESPONSE | jq -r '.notifications.unreadCount')"
echo ""

echo "========================================="
echo "   INSIGHTS"
echo "========================================="
echo ""
echo $DASHBOARD_RESPONSE | jq -r '.insights[] | "[\(.type)] \(.icon) \(.title): \(.message)"'
echo ""

echo "✅ Teste concluído!"
