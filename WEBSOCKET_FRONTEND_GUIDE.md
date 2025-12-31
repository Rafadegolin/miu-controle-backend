# 🔌 WebSockets: Guia Completo para Integração no Frontend

## 📋 Visão Geral

O sistema de WebSockets foi implementado com sucesso no backend usando **Socket.IO** e **NestJS**. Agora você pode receber atualizações em tempo real sobre transações, saldos, notificações e muito mais, eliminando a necessidade de polling e permitindo sincronização automática entre múltiplos dispositivos.

---

## ✅ O Que Foi Implementado

### 🎯 Eventos Disponíveis

| Evento | Quando É Emitido | Payload |
|--------|------------------|---------|
| `transaction.created` | Nova transação criada | `{ transactionId, accountId, categoryId, type, amount, description, date }` |
| `transaction.updated` | Transação editada | `{ transactionId, accountId, categoryId, type, amount, description, date }` |
| `transaction.deleted` | Transação deletada | `{ transactionId, accountId }` |
| `balance.updated` | Saldo de conta atualizado | `{ accountId, previousBalance, newBalance, difference }` |
| `notification.new` | Nova notificação criada | `{ notificationId, type, title, message, data }` |

### 🔐 Segurança

- ✅ **Autenticação JWT obrigatória** no handshake
- ✅ **Isolamento por usuário** - cada usuário tem sua própria room (`user:${userId}`)
- ✅ **Validação de permissões** - usuários só recebem eventos próprios
- ✅ **CORS configurado** - mesmas origens permitidas da API REST

### ⚡ Performance

- ✅ **Reconexão automática** com backoff exponencial
- ✅ **Heartbeat** a cada 30 segundos (ping/pong)
- ✅ **Timeout** de 60 segundos sem resposta = desconexão
- ✅ **Multi-dispositivo** - mesmo usuário em múltiplos clients sincroniza

---

## 🚀 Como Conectar ao WebSocket

### 1. Instalar Socket.IO Client

```bash
npm install socket.io-client
```

### 2. Criar Hook React de Conexão

Crie o arquivo `src/hooks/useWebSocket.ts`:

```typescript
import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface UseWebSocketReturn {
  socket: Socket | null;
  connected: boolean;
}

/**
 * Hook para gerenciar conexão WebSocket com autenticação JWT
 * @param token - JWT token obtido do login
 * @returns {{ socket, connected }}
 */
export function useWebSocket(token: string | null): UseWebSocketReturn {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Se não houver token, não conectar
    if (!token) {
      if (socket) {
        socket.close();
        setSocket(null);
        setConnected(false);
      }
      return;
    }

    // Conectar ao WebSocket com autenticação JWT
    const newSocket = io(process.env.NEXT_PUBLIC_API_URL!, {
      auth: {
        token, // JWT token no handshake
      },
      transports: ['websocket', 'polling'],
      reconnect: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
    });

    // Event listeners
    newSocket.on('connect', () => {
      console.log('✅ WebSocket conectado:', newSocket.id);
      setConnected(true);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('❌ WebSocket desconectado:', reason);
      setConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('🚫 Erro na conexão WebSocket:', error.message);
      setConnected(false);
    });

    newSocket.on('reconnect', (attemptNumber) => {
      console.log(`🔄 Reconectado após ${attemptNumber} tentativas`);
      setConnected(true);
    });

    newSocket.on('reconnect_attempt', (attemptNumber) => {
      console.log(`🔄 Tentando reconectar (tentativa ${attemptNumber})...`);
    });

    newSocket.on('reconnect_failed', () => {
      console.error('❌ Falha ao reconectar após múltiplas tentativas');
    });

    // Listener de confirmação de conexão (emitido pelo servidor)
    newSocket.on('connected', (data) => {
      console.log('🎉 Mensagem do servidor:', data);
    });

    setSocket(newSocket);

    // Cleanup ao desmontar
    return () => {
      newSocket.close();
      setSocket(null);
      setConnected(false);
    };
  }, [token]);

  return { socket, connected };
}
```

### 3. Usar o Hook no Componente Principal

No layout principal ou no `src/app/dashboard/layout.tsx`:

```typescript
'use client';

import { useWebSocket } from '@/hooks/useWebSocket';
import { useAuth } from '@/hooks/useAuth'; // Seu hook de autenticação
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { token } = useAuth(); // Obter token JWT
  const { socket, connected } = useWebSocket(token);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!socket) return;

    // ==================== TRANSAÇÕES ====================

    // Evento: Nova transação criada
    socket.on('transaction.created', (data) => {
      console.log('📥 Nova transação:', data);
      
      // Invalidar queries para refetch automático
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['monthly-stats'] });
      
      // Opcional: Mostrar toast de notificação
      toast.success(`Transação criada: ${data.description}`);
    });

    // Evento: Transação atualizada
    socket.on('transaction.updated', (data) => {
      console.log('✏️ Transação atualizada:', data);
      
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['monthly-stats'] });
    });

    // Evento: Transação deletada
    socket.on('transaction.deleted', (data) => {
      console.log('🗑️ Transação deletada:', data.transactionId);
      
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['monthly-stats'] });
    });

    // ==================== SALDO ====================

    // Evento: Saldo atualizado
    socket.on('balance.updated', (data) => {
      console.log('💰 Saldo atualizado:', data);
      
      // Invalidar cache de contas e dashboard
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      
      // Opcional: Animação de atualização de saldo
      // ...
    });

    // ==================== NOTIFICAÇÕES ====================

    // Evento: Nova notificação
    socket.on('notification.new', (data) => {
      console.log('🔔 Nova notificação:', data);
      
      // Invalidar lista de notificações
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      
      // Mostrar toast/alert
      if (data.type === 'BUDGET_ALERT') {
        toast.warning(data.title, { description: data.message });
      } else if (data.type === 'BUDGET_EXCEEDED') {
        toast.error(data.title, { description: data.message });
      } else if (data.type === 'GOAL_ACHIEVED') {
        toast.success(data.title, { description: data.message });
      } else {
        toast.info(data.title, { description: data.message });
      }
    });

    // Cleanup dos listeners ao desmontar
    return () => {
      socket.off('transaction.created');
      socket.off('transaction.updated');
      socket.off('transaction.deleted');
      socket.off('balance.updated');
      socket.off('notification.new');
    };
  }, [socket, queryClient]);

  return (
    <div>
      {/* Indicador de conexão WebSocket (opcional) */}
      <div className="fixed bottom-4 right-4 flex items-center gap-2">
        <div className={`h-2 w-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
        <span className="text-xs text-gray-500">
          {connected ? 'Online' : 'Offline'}
        </span>
      </div>

      {children}
    </div>
  );
}
```

---

## 📦 Interfaces TypeScript

Crie o arquivo `src/types/websocket.ts`:

```typescript
/**
 * Payloads de eventos WebSocket
 */

export interface TransactionCreatedPayload {
  transactionId: string;
  accountId: string;
  categoryId?: string;
  type: 'INCOME' | 'EXPENSE';
  amount: number;
  description: string;
  date: Date;
}

export interface TransactionUpdatedPayload {
  transactionId: string;
  accountId: string;
  categoryId?: string;
  type: 'INCOME' | 'EXPENSE';
  amount: number;
  description: string;
  date: Date;
}

export interface TransactionDeletedPayload {
  transactionId: string;
  accountId: string;
}

export interface BalanceUpdatedPayload {
  accountId: string;
  previousBalance: number;
  newBalance: number;
  difference: number;
}

export interface NotificationPayload {
  notificationId: string;
  type: 'BUDGET_ALERT' | 'BUDGET_EXCEEDED' | 'GOAL_ACHIEVED' | 'GOAL_MILESTONE' | 'SYSTEM';
  title: string;
  message: string;
  data?: any;
}
```

---

## 🔍 Estratégias de Invalidação de Cache

### Com React Query

```typescript
// Exemplo de lógica otimizada
socket.on('transaction.created', (data: TransactionCreatedPayload) => {
  // Opção 1: Invalidar tudo relacionado a transações
  queryClient.invalidateQueries({ queryKey: ['transactions'] });
  
  // Opção 2: Atualizar cache manualmente (otimistic update)
  queryClient.setQueryData(['transactions'], (old: any) => {
    return {
      ...old,
      items: [data, ...old.items], // Adiciona no início
    };
  });
  
  // Opção 3: Refetch apenas queries específicas
  queryClient.refetchQueries({ 
    queryKey: ['transactions'], 
    exact: false 
  });
});
```

### Com SWR

```typescript
import useSWR, { mutate } from 'swr';

socket.on('transaction.created', (data) => {
  // Invalidar cache SWR
  mutate('/api/transactions');
  mutate('/api/dashboard');
});
```

---

## 🎨 Exemplo de Componente com Indicador de Status

```typescript
'use client';

import { useWebSocket } from '@/hooks/useWebSocket';
import { useAuth } from '@/hooks/useAuth';

export function WebSocketStatus() {
  const { token } = useAuth();
  const { connected } = useWebSocket(token);

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
      <div className="relative">
        <div className={`h-3 w-3 rounded-full transition-colors ${
          connected ? 'bg-green-500' : 'bg-gray-400'
        }`} />
        {connected && (
          <div className="absolute inset-0 h-3 w-3 rounded-full bg-green-500 animate-ping" />
        )}
      </div>
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {connected ? 'Conectado' : 'Desconectado'}
      </span>
    </div>
  );
}
```

---

## 🐛 Troubleshooting

### Problema: Conexão recusada com erro 401

```bash
# Verificar se o token está sendo enviado corretamente
console.log('Token:', token);

# O token deve estar no formato:
// "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Solução**: Certifique-se de que o token JWT é válido e não está expirado. Você pode decodificá-lo em [jwt.io](https://jwt.io) para verificar.

### Problema: Eventos não estão sendo recebidos

```typescript
// Adicionar logs para debug
socket.on('transaction.created', (data) => {
  console.log('📥 Evento recebido:', data); // Deve aparecer no console
});

// Verificar se está inscrito no evento correto
socket.on('transactionCreated', ...); // ❌ ERRADO
socket.on('transaction.created', ...); // ✅ CORRETO
```

### Problema: Reconexão não funciona

```typescript
// Verificar configuração de reconexão
const socket = io(url, {
  reconnection: true, // Deve estar true
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
});

// Adicionar listener de reconexão
socket.io.on('reconnect', (attempt) => {
  console.log(`Reconectado após ${attempt} tentativas`);
});
```

### Problema: WebSocket usa polling em vez de websocket

```typescript
// Forçar uso de websocket
const socket = io(url, {
  transports: ['websocket'], // Remove 'polling' se necessário
});

// Verificar no console:
// "Transport: websocket" significa que está usando WebSocket ✅
// "Transport: polling" significa fallback para long-polling ⚠️
```

---

## 🧪 Testando a Integração

### Teste 1: Verificar Conexão

1. Abrir DevTools → Console
2. Procurar por: `✅ WebSocket conectado: {id}`
3. Se aparecer, a conexão está funcionando!

### Teste 2: Criar Transação e Ver Evento

1. Abrir duas abas do navegador com o mesmo usuário
2. **Aba 1**: Adicionar listener no console:
   ```javascript
   window.socket?.on('transaction.created', console.log);
   ```
3. **Aba 2**: Criar uma transação pela UI
4. **Aba 1**: Deve exibir o log do evento no console

### Teste 3: Multi-dispositivo

1. Fazer login no celular e no desktop
2. Criar transação em um dispositivo
3. Ver atualização instantânea no outro dispositivo

---

## ⚙️ Variáveis de Ambiente Necessárias

Adicione ao `.env.local` do frontend:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
# ou em produção:
NEXT_PUBLIC_API_URL=https://api.miucontrole.com.br
```

---

## 📊 Impactos no Backend

### Serviços Modificados

- ✅ `TransactionsService` - Emite eventos ao criar/editar/deletar transações
- ✅ `NotificationsService` - Emite evento ao criar notificações

### Novos Módulos

- ✅ `WebsocketModule` - Módulo principal do WebSocket
- ✅ `WebsocketGateway` - Gateway Socket.IO com autenticação JWT
- ✅ `WebsocketService` - Serviço para emissão de eventos
- ✅ `WebsocketController` - Endpoint de status (`GET /websocket/status`)
- ✅ `WsJwtGuard` - Guard de autenticação JWT para WebSocket

### Endpoints Adicionados

```bash
GET /websocket/status
Authorization: Bearer {token}
```

**Resposta**:
```json
{
  "totalConnections": 5,
  "connectedUsers": ["user-123", "user-456"],
  "timestamp": "2025-12-31T19:15:00.000Z"
}
```

---

## ✅ Checklist de Implementação Frontend

- [ ] Instalar `socket.io-client`
- [ ] Criar hook `useWebSocket` com autenticação JWT
- [ ] Configurar variável `NEXT_PUBLIC_API_URL`
- [ ] Adicionar listeners de eventos no layout principal
- [ ] Integrar com React Query/SWR para invalidação de cache
- [ ] Adicionar indicador visual de conexão WebSocket
- [ ] Implementar toasts/notificações para eventos importantes
- [ ] Testar multi-dispositivo
- [ ] Testar reconexão (desligar/ligar servidor)
- [ ] Adicionar tratamento de erros

---

## 🚀 Próximos Passos Recomendados (Futuro)

1. **Animações de Atualização**: Destacar visualmente quando dados são atualizados via WebSocket
2. **Notificações de Desktop**: Usar API de Notificações do navegador
3. **Sincronização Otimista**: Atualizar UI antes de receber confirmação do servidor
4. **Offline Mode**: Armazenar ações localmente e sincronizar ao reconectar
5. **Métricas**: Monitorar taxa de sucesso de conexões e reconexões

---

## 📚 Recursos Adicionais

- [Documentação Socket.IO Client](https://socket.io/docs/v4/client-api/)
- [React Query Invalidation](https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation)
- [Next.js com WebSockets](https://socket.io/how-to/use-with-nextjs)

---

## 💡 Dicas Finais

1. **Performance**: Use `queryClient.invalidateQueries` ao invés de múltiplos `refetchQueries`
2. **Debug**: Sempre deixe `console.log` nos listeners durante desenvolvimento
3. **Produção**: Remova logs de debug em produção
4. **Token Refresh**: Se o token expirar, reconectar o WebSocket com novo token
5. **Graceful Degradation**: Se WebSocket falhar, a app ainda deve funcionar via polling manual

---

**✨ Implementação concluída com sucesso! O sistema está pronto para receber atualizações em tempo real!**
