# 🧪 Como Testar WebSocket

Este documento explica **4 formas diferentes** de testar o WebSocket do Miu Controle.

---

## 🚀 Método 1: Script Node.js Interativo (Recomendado)

### Passo 1: Certifique-se que o servidor está rodando

```bash
npm run start:dev
```

### Passo 2: Execute o script de teste

```bash
node test-websocket.js
```

### Passo 3: Faça login

Digite seu email e senha quando solicitado.

### Passo 4: Teste os eventos

Escolha a opção **1** para criar uma transação de teste. Você verá:
- O evento `transaction.created` sendo recebido em tempo real
- O evento `balance.updated` logo em seguida

### Passo 5: Verifique o status

Escolha a opção **2** para ver quantos clientes estão conectados.

---

## 🌐 Método 2: Teste no Navegador (Console)

### Passo 1: Abra o DevTools

Pressione `F12` em qualquer página web e vá para a aba **Console**.

### Passo 2: Cole este código

```javascript
// 1. Carregar Socket.IO
const script = document.createElement('script');
script.src = 'https://cdn.socket.io/4.7.5/socket.io.min.js';
document.head.appendChild(script);

// 2. Aguardar carregar e conectar
script.onload = () => {
  // Substitua pelo seu token JWT
  const token = 'COLE_SEU_TOKEN_AQUI';
  
  const socket = io('http://localhost:3001', {
    auth: { token },
    transports: ['websocket', 'polling']
  });

  socket.on('connect', () => {
    console.log('✅ Conectado! ID:', socket.id);
  });

  socket.on('transaction.created', (data) => {
    console.log('🆕 Nova transação:', data);
  });

  socket.on('balance.updated', (data) => {
    console.log('💰 Saldo atualizado:', data);
  });

  socket.on('notification.new', (data) => {
    console.log('🔔 Notificação:', data);
  });

  // Guardar socket globalmente
  window.socket = socket;
};
```

### Passo 3: Obter seu token JWT

Faça login via API ou frontend e copie o `accessToken`.

### Passo 4: Substituir no código

Troque `'COLE_SEU_TOKEN_AQUI'` pelo seu token real.

### Passo 5: Criar uma transação

Use outro navegador ou tab para criar uma transação e veja o evento aparecer no console!

---

## 🔧 Método 3: Teste com cURL + Postman/Insomnia

### Passo 1: Conectar WebSocket no Postman/Insomnia

1. Abra Postman ou Insomnia
2. Crie uma nova requisição **WebSocket**
3. URL: `ws://localhost:3001`
4. Headers: `Authorization: Bearer SEU_TOKEN_AQUI`

ou

Query params: `?token=SEU_TOKEN_AQUI`

### Passo 2: Conectar

Clique em **Connect**. Você deve ver a mensagem de conexão bem-sucedida.

### Passo 3: Criar transação via cURL

Em outro terminal:

```bash
curl -X POST http://localhost:3001/transactions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -d '{
    "accountId": "ID_DA_SUA_CONTA",
    "type": "EXPENSE",
    "amount": 50.00,
    "description": "Teste WebSocket",
    "date": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"
  }'
```

### Passo 4: Ver evento no Postman/Insomnia

Você deve ver o evento `transaction.created` aparecer na aba de WebSocket!

---

## 🧑‍💻 Método 4: Teste Multi-dispositivo

### Passo 1: Execute o script em 2 terminais

**Terminal 1**:
```bash
node test-websocket.js
```

**Terminal 2**:
```bash
node test-websocket.js
```

### Passo 2: Faça login com o MESMO usuário nos dois

### Passo 3: Crie transação no Terminal 1

Escolha opção **1** no primeiro terminal.

### Passo 4: Observe no Terminal 2

O **Terminal 2** deve receber o evento automaticamente! 🎉

Isso prova que **múltiplos dispositivos do mesmo usuário sincronizam em tempo real**.

---

## 🔍 Método 5: Verificar Status do WebSocket

### Via Script

```bash
node test-websocket.js
# Escolha opção 2
```

### Via cURL

```bash
curl -H "Authorization: Bearer SEU_TOKEN" \
  http://localhost:3001/websocket/status
```

**Resposta esperada**:
```json
{
  "totalConnections": 2,
  "connectedUsers": ["user-id-123"],
  "timestamp": "2025-12-31T19:20:00.000Z"
}
```

---

## 🐛 Troubleshooting

### ❌ Erro: "Cannot find module 'socket.io-client'"

```bash
npm install socket.io-client axios
```

### ❌ Erro: "401 Unauthorized"

Seu token JWT está inválido ou expirado. Faça login novamente:

```bash
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"seu@email.com","password":"suasenha"}'
```

### ❌ Não recebe eventos

1. Verifique se o servidor está rodando: `npm run start:dev`
2. Verifique os logs do servidor: deve mostrar `🟢 Client connected`
3. Certifique-se que está usando o evento correto: `transaction.created` (não `transactionCreated`)

### ❌ Eventos duplicados

Se estiver recebendo eventos duplicados, você tem múltiplas conexões abertas. Feche todas e reconecte.

---

## ✅ Checklist de Validação

Após testar, confirme que:

- [ ] Consegue conectar com token JWT válido
- [ ] Token inválido é rejeitado (erro 401)
- [ ] Recebe evento `transaction.created` ao criar transação
- [ ] Recebe evento `transaction.updated` ao editar transação
- [ ] Recebe evento `transaction.deleted` ao deletar transação
- [ ] Recebe evento `balance.updated` após qualquer operação
- [ ] Múltiplos dispositivos do mesmo usuário sincronizam
- [ ] Usuários diferentes NÃO recebem eventos uns dos outros
- [ ] Endpoint `/websocket/status` retorna dados corretos

---

## 🎯 Fluxo de Teste Completo Recomendado

1. ✅ **Iniciar servidor**: `npm run start:dev`
2. ✅ **Executar script**: `node test-websocket.js`
3. ✅ **Fazer login**: Digite credenciais
4. ✅ **Ver conexão**: Deve mostrar "WebSocket conectado"
5. ✅ **Criar transação**: Escolha opção 1
6. ✅ **Ver eventos**: Veja `transaction.created` e `balance.updated`
7. ✅ **Verificar status**: Escolha opção 2
8. ✅ **Abrir segundo terminal**: Repita passos 2-4
9. ✅ **Testar sync**: Crie transação no terminal 1, veja evento no terminal 2

---

**✨ Se todos os passos funcionaram, parabéns! O WebSocket está 100% operacional!**
