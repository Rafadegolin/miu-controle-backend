# 🎯 API de Imagens e Links de Compra para Metas

## 📋 Visão Geral

Esta funcionalidade permite que usuários adicionem **imagens** e **links de compra** às suas metas, transformando objetivos financeiros em um **vision board** visual e motivador.

### ✨ Funcionalidades

- 📸 Upload de imagem da meta (JPG, PNG, WEBP - máx 5MB)
- 🗑️ Remoção de imagem
- 🔗 Adicionar links de compra (até 10 por meta)
- ✏️ Editar links de compra
- ❌ Remover links de compra
- 💰 Calcular total de preços dos links

---

## 🗄️ Estrutura de Dados

### Modelo Goal (Prisma)

```prisma
model Goal {
  // ... campos existentes

  // 🆕 Campos de Imagem
  imageUrl      String?  @map("image_url")
  imageKey      String?  @map("image_key")
  imageMimeType String?  @map("image_mime_type")
  imageSize     Int?     @map("image_size")

  // 🆕 Links de Compra (JSON Array)
  purchaseLinks Json?    @map("purchase_links")
}
```

### Estrutura do JSON `purchaseLinks`

```typescript
interface PurchaseLink {
  id: string; // UUID único
  title: string; // Título do link (máx 200 caracteres)
  url: string; // URL HTTPS do produto
  price?: number; // Preço do produto
  currency?: string; // Moeda (ISO 4217: BRL, USD, etc)
  note?: string; // Notas adicionais (máx 500 caracteres)
  addedAt: string; // Data de adição (ISO 8601)
  updatedAt?: string; // Data de última atualização
}
```

**Exemplo:**

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "MacBook Pro M3 - 16GB RAM",
    "url": "https://www.amazon.com.br/Apple-MacBook-Pro/dp/B0ABCDEF",
    "price": 12500.0,
    "currency": "BRL",
    "note": "Aguardar Black Friday para desconto",
    "addedAt": "2024-12-03T03:00:00.000Z"
  },
  {
    "id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
    "title": "AppleCare+ 3 anos",
    "url": "https://www.apple.com/br/shop/product/S5389BZ/A",
    "price": 1200.0,
    "currency": "BRL",
    "note": "Garantia estendida",
    "addedAt": "2024-12-03T03:15:00.000Z"
  }
]
```

---

## 🔌 Endpoints da API

### 📸 Upload de Imagem

```http
POST /goals/:id/image
Content-Type: multipart/form-data
Authorization: Bearer {token}
```

**Form Data:**

- `image` (file): Arquivo de imagem (JPG, PNG, WEBP - máx 5MB)

**Response:**

```json
{
  "message": "Imagem da meta atualizada com sucesso",
  "goal": {
    "id": "uuid",
    "name": "Viagem para Europa",
    "imageUrl": "https://cdn.miu.com/goals/user-123/goal-456/image.webp",
    "imageKey": "goals/user-123/goal-456/image.webp",
    "imageMimeType": "image/webp",
    "imageSize": 245678
    // ... outros campos
  }
}
```

**Validações:**

- ✅ Formato: JPG, JPEG, PNG, WEBP
- ✅ Tamanho máximo: 5MB
- ✅ Meta deve pertencer ao usuário
- ✅ Deleta imagem antiga automaticamente se existir

---

### 🗑️ Remover Imagem

```http
DELETE /goals/:id/image
Authorization: Bearer {token}
```

**Response:**

```json
{
  "message": "Imagem removida com sucesso",
  "goal": {
    "id": "uuid",
    "imageUrl": null,
    "imageKey": null,
    "imageMimeType": null,
    "imageSize": null
  }
}
```

---

### ➕ Adicionar Link de Compra

```http
POST /goals/:id/purchase-links
Content-Type: application/json
Authorization: Bearer {token}
```

**Body:**

```json
{
  "title": "MacBook Pro M3 - 16GB RAM",
  "url": "https://www.amazon.com.br/produto/...",
  "price": 12500.0,
  "currency": "BRL",
  "note": "Aguardar Black Friday"
}
```

**Response:**

```json
{
  "message": "Link adicionado com sucesso",
  "goal": {
    "id": "uuid",
    "purchaseLinks": [
      {
        "id": "uuid-gerado",
        "title": "MacBook Pro M3 - 16GB RAM",
        "url": "https://www.amazon.com.br/produto/...",
        "price": 12500.0,
        "currency": "BRL",
        "note": "Aguardar Black Friday",
        "addedAt": "2024-12-03T03:00:00.000Z"
      }
    ]
  }
}
```

**Validações:**

- ✅ `title`: Obrigatório, máx 200 caracteres
- ✅ `url`: Obrigatório, HTTPS apenas
- ✅ `price`: Opcional, maior ou igual a 0
- ✅ `currency`: Opcional, 3 letras maiúsculas (ex: BRL, USD)
- ✅ `note`: Opcional, máx 500 caracteres
- ✅ Máximo de 10 links por meta

---

### ✏️ Atualizar Link de Compra

```http
PATCH /goals/:id/purchase-links/:linkId
Content-Type: application/json
Authorization: Bearer {token}
```

**Body:** (todos os campos são opcionais)

```json
{
  "title": "MacBook Pro M4 - 32GB RAM",
  "price": 15000.0,
  "note": "Novo modelo lançado!"
}
```

**Response:**

```json
{
  "message": "Link atualizado com sucesso",
  "goal": {
    /* ... */
  }
}
```

---

### ❌ Remover Link de Compra

```http
DELETE /goals/:id/purchase-links/:linkId
Authorization: Bearer {token}
```

**Response:**

```json
{
  "message": "Link removido com sucesso",
  "goal": {
    /* ... */
  }
}
```

---

### 💰 Resumo dos Links (Total de Preços)

```http
GET /goals/:id/purchase-links/summary
Authorization: Bearer {token}
```

**Response:**

```json
{
  "total": 3,
  "totalBRL": 15700.0,
  "byCurrenty": {
    "BRL": 15700.0,
    "USD": 0.0
  },
  "links": [
    {
      "id": "uuid-1",
      "title": "MacBook Pro M3",
      "url": "https://...",
      "price": 12500.0,
      "currency": "BRL",
      "note": "...",
      "addedAt": "2024-12-03T03:00:00.000Z"
    }
    // ... mais links
  ]
}
```

---

## 🔒 Segurança

### Rate Limiting

Os endpoints de upload e links possuem rate limiting para prevenir abuso:

- **Upload de imagem:** 5 uploads por minuto por usuário
- **CRUD de links:** 20 operações por minuto por usuário

### Validações de URL

- ✅ Apenas URLs HTTPS são aceitas
- ✅ URLs são validadas no formato correto
- 🔮 **Futuro:** Whitelist de domínios confiáveis (Amazon, Mercado Livre, etc)

### Controle de Acesso

- ✅ Usuário só pode manipular suas próprias metas
- ✅ Autenticação JWT obrigatória em todos os endpoints

---

## 📱 Casos de Uso

### 1. Vision Board da Meta

Usuário cria meta "Viagem para Europa" e adiciona:

- 📸 Foto da Torre Eiffel
- 🔗 Link da passagem aérea (R$ 4.500)
- 🔗 Link do hotel (R$ 3.200)
- 🔗 Link dos ingressos (R$ 800)

**Total planejado:** R$ 8.500  
**Diferença da meta:** +R$ 1.500 (margem de segurança)

### 2. Compra de Eletrônico

Meta "Novo Notebook":

- 📸 Foto do MacBook Pro
- 🔗 Amazon (R$ 12.500)
- 🔗 Kabum (R$ 12.200) ⭐ **Melhor preço**
- 🔗 AppleCare+ (R$ 1.200)

### 3. Reforma da Casa

Meta "Reforma Cozinha":

- 📸 Foto da cozinha dos sonhos (Pinterest)
- 🔗 Fogão (R$ 2.500)
- 🔗 Geladeira (R$ 4.800)
- 🔗 Bancada de granito (R$ 3.000)
- 🔗 Armários planejados (R$ 8.000)

---

## 🚀 Próximas Evoluções (Roadmap)

### Fase 2: Scraping de Preços

- 🤖 Atualização automática de preços
- 📉 Alertas de queda de preço (10%+)
- 📊 Histórico de variação de preços

### Fase 3: Integração com IA

- 🎨 Geração de imagens com DALL-E/Stable Diffusion
- 🖼️ Galeria de imagens sugeridas (Unsplash API)
- 🤖 Sugestão de produtos baseado no nome da meta

### Fase 4: Social Features

- 📤 Compartilhamento de metas (social share)
- 👥 Metas compartilhadas (família)
- 🏆 Gamificação e conquistas

---

## 🧪 Testando a API

### 1. Upload de Imagem

```bash
curl -X POST \
  http://localhost:3000/goals/{goalId}/image \
  -H 'Authorization: Bearer {token}' \
  -F 'image=@/path/to/image.jpg'
```

### 2. Adicionar Link

```bash
curl -X POST \
  http://localhost:3000/goals/{goalId}/purchase-links \
  -H 'Authorization: Bearer {token}' \
  -H 'Content-Type: application/json' \
  -d '{
    "title": "MacBook Pro M3",
    "url": "https://www.amazon.com.br/produto/...",
    "price": 12500.00,
    "currency": "BRL",
    "note": "Black Friday"
  }'
```

### 3. Obter Resumo

```bash
curl -X GET \
  http://localhost:3000/goals/{goalId}/purchase-links/summary \
  -H 'Authorization: Bearer {token}'
```

---

## 📝 Notas de Implementação

### Storage de Imagens

As imagens são armazenadas no **MinIO** (S3-compatible) com a seguinte estrutura:

```
goals/
  └── {userId}/
      └── {goalId}/
          └── image.{ext}
```

### Limpeza de Imagens Órfãs

- ⏰ Task agendada para limpar imagens de metas deletadas (após 30 dias)
- 🗑️ Imagens antigas são automaticamente deletadas ao fazer novo upload

### Performance

- 📦 Imagens são comprimidas automaticamente (WebP recomendado)
- 🚀 URLs são servidas via CDN
- 💾 Links são armazenados em JSON para flexibilidade

---

## ❓ FAQ

### Posso adicionar vídeos?

❌ Não no MVP. Apenas imagens estáticas (JPG, PNG, WEBP).

### Quantos links posso adicionar?

✅ Máximo de 10 links por meta.

### O preço dos links é atualizado automaticamente?

❌ Não no MVP. Fase 2 terá scraping automático.

### Posso usar links de qualquer site?

✅ Sim, mas recomendamos sites confiáveis (Amazon, Mercado Livre, etc).  
🔮 Fase 2 terá whitelist de domínios verificados.

### A imagem precisa ser da meta?

❌ Não! Pode ser qualquer imagem motivadora (Pinterest, Google, etc).

---

## 📊 Resposta Completa de Exemplo

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "user-123",
  "name": "Viagem para Europa",
  "description": "15 dias em Paris, Roma e Barcelona",
  "targetAmount": 15000.0,
  "currentAmount": 9750.0,
  "targetDate": "2025-12-31T00:00:00Z",
  "color": "#10B981",
  "icon": "✈️",
  "priority": 1,
  "status": "ACTIVE",

  "imageUrl": "https://cdn.miu.com/goals/user-123/goal-456/eiffel-tower.webp",
  "imageKey": "goals/user-123/goal-456/eiffel-tower.webp",
  "imageMimeType": "image/webp",
  "imageSize": 245678,

  "purchaseLinks": [
    {
      "id": "link-1",
      "title": "Passagem aérea Paris",
      "url": "https://www.latam.com/...",
      "price": 4500.0,
      "currency": "BRL",
      "note": "Ida: 15/dez | Volta: 30/dez",
      "addedAt": "2024-12-01T10:00:00Z"
    },
    {
      "id": "link-2",
      "title": "Hotel em Paris - 7 noites",
      "url": "https://www.booking.com/...",
      "price": 3200.0,
      "currency": "BRL",
      "note": "Próximo ao Louvre",
      "addedAt": "2024-12-01T10:15:00Z"
    }
  ],

  "percentage": 65.0,
  "remaining": 5250.0,
  "isOverdue": false,
  "daysRemaining": 365,

  "createdAt": "2024-11-01T00:00:00Z",
  "updatedAt": "2024-12-03T03:00:00Z",
  "completedAt": null
}
```

---

## 🎉 Conclusão

Essa funcionalidade transforma metas financeiras de **números frios** em um **vision board motivador**, aumentando o engajamento e tornando o planejamento financeiro mais visual e emocionante! 🎯🔥
