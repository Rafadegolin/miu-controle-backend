# Script de teste do endpoint /dashboard/home para PowerShell
# Este script demonstra como testar o endpoint com dados reais

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "   TESTE DO ENDPOINT /dashboard/home" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Configurações
$API_URL = "http://localhost:3000"
$EMAIL = "seu-email@example.com"
$PASSWORD = "sua-senha"

Write-Host "1. Fazendo login..." -ForegroundColor Yellow
$loginBody = @{
    email = $EMAIL
    password = $PASSWORD
} | ConvertTo-Json

try {
    $loginResponse = Invoke-RestMethod -Uri "$API_URL/auth/login" -Method Post -Body $loginBody -ContentType "application/json"
    $token = $loginResponse.accessToken
    
    Write-Host "✅ Login realizado com sucesso!" -ForegroundColor Green
    Write-Host "Token: $($token.Substring(0, 20))..." -ForegroundColor Gray
    Write-Host ""
}
catch {
    Write-Host "❌ Erro ao fazer login. Verifique as credenciais." -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

Write-Host "2. Consultando dashboard..." -ForegroundColor Yellow
Write-Host ""

try {
    $headers = @{
        "Authorization" = "Bearer $token"
        "Content-Type" = "application/json"
    }
    
    $dashboard = Invoke-RestMethod -Uri "$API_URL/dashboard/home" -Method Get -Headers $headers
    
    Write-Host "=========================================" -ForegroundColor Cyan
    Write-Host "   RESPOSTA DO DASHBOARD" -ForegroundColor Cyan
    Write-Host "=========================================" -ForegroundColor Cyan
    Write-Host ""
    $dashboard | ConvertTo-Json -Depth 10
    Write-Host ""
    
    Write-Host "=========================================" -ForegroundColor Cyan
    Write-Host "   RESUMO EXECUTIVO" -ForegroundColor Cyan
    Write-Host "=========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "💰 Saldo Total: R$ $($dashboard.accountsSummary.totalBalance)" -ForegroundColor Green
    Write-Host "📊 Receitas do Mês: R$ $($dashboard.currentMonth.income)" -ForegroundColor Green
    Write-Host "💸 Despesas do Mês: R$ $($dashboard.currentMonth.expense)" -ForegroundColor Red
    Write-Host "💵 Saldo do Mês: R$ $($dashboard.currentMonth.balance)" -ForegroundColor $(if ($dashboard.currentMonth.balance -gt 0) { "Green" } else { "Red" })
    Write-Host "🏦 Contas Ativas: $($dashboard.accountsSummary.activeAccountsCount)"
    Write-Host "🎯 Metas Ativas: $($dashboard.goals.totalActiveGoals)"
    Write-Host "📋 Orçamentos: $($dashboard.budgets.totalBudgets)"
    Write-Host "🔔 Notificações Não Lidas: $($dashboard.notifications.unreadCount)"
    Write-Host ""
    
    Write-Host "=========================================" -ForegroundColor Cyan
    Write-Host "   INSIGHTS" -ForegroundColor Cyan
    Write-Host "=========================================" -ForegroundColor Cyan
    Write-Host ""
    
    foreach ($insight in $dashboard.insights) {
        $color = switch ($insight.type) {
            "success" { "Green" }
            "warning" { "Yellow" }
            "error" { "Red" }
            default { "White" }
        }
        Write-Host "[$($insight.type)] $($insight.icon) $($insight.title): $($insight.message)" -ForegroundColor $color
    }
    Write-Host ""
    
    Write-Host "✅ Teste concluído!" -ForegroundColor Green
}
catch {
    Write-Host "❌ Erro ao consultar dashboard." -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
