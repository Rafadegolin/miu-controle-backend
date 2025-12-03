# 🧪 Testes da API - Metas com Imagens e Links

## Variáveis de Ambiente

```bash
BASE_URL=http://localhost:3000
TOKEN=seu_jwt_token_aqui
GOAL_ID=uuid_da_meta
```

---

## 1. 📸 Upload de Imagem

### Request

```bash
curl -X POST \
  ${BASE_URL}/goals/${GOAL_ID}/image \
  -H "Authorization: Bearer ${TOKEN}" \
  -F "image=@/path/to/image.jpg"
```

### Response (200 OK)

```json
{
  "message": "Imagem da meta atualizada com sucesso",
  "goal": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Viagem para Europa",
    "imageUrl": "https://minio.local/goals/user-123/goal-456/image.jpg",
    "imageKey": "goals/user-123/goal-456/image.jpg",
    "imageMimeType": "image/jpeg",
    "imageSize": 1234567
  }
}
```

### Erros Comuns

- **400**: Formato inválido ou arquivo muito grande (>5MB)
- **404**: Meta não encontrada
- **401**: Token inválido

---

## 2. 🗑️ Remover Imagem

### Request

```bash
curl -X DELETE \
  ${BASE_URL}/goals/${GOAL_ID}/image \
  -H "Authorization: Bearer ${TOKEN}"
```

### Response (200 OK)

```json
{
  "message": "Imagem removida com sucesso",
  "goal": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "imageUrl": null,
    "imageKey": null,
    "imageMimeType": null,
    "imageSize": null
  }
}
```

---

## 3. ➕ Adicionar Link de Compra

### Request

```bash
curl -X POST \
  ${BASE_URL}/goals/${GOAL_ID}/purchase-links \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "MacBook Pro M3 - 16GB RAM",
    "url": "https://www.amazon.com.br/Apple-MacBook-Pro/dp/B0ABCDEF",
    "price": 12500.00,
    "currency": "BRL",
    "note": "Aguardar Black Friday para desconto"
  }'
```

### Response (200 OK)

```json
{
  "message": "Link adicionado com sucesso",
  "goal": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "purchaseLinks": [
      {
        "id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
        "title": "MacBook Pro M3 - 16GB RAM",
        "url": "https://www.amazon.com.br/Apple-MacBook-Pro/dp/B0ABCDEF",
        "price": 12500.0,
        "currency": "BRL",
        "note": "Aguardar Black Friday para desconto",
        "addedAt": "2024-12-03T03:00:00.000Z"
      }
    ]
  }
}
```

### Validações

- ✅ `title`: Obrigatório, máx 200 caracteres
- ✅ `url`: Obrigatório, HTTPS apenas
- ✅ `price`: Opcional, ≥ 0
- ✅ `currency`: Opcional, 3 letras maiúsculas
- ✅ `note`: Opcional, máx 500 caracteres
- ✅ Máximo 10 links por meta

### Erros Comuns

- **400**: Validação falhou ou limite de 10 links atingido
- **404**: Meta não encontrada

---

## 4. ✏️ Atualizar Link de Compra

### Request

```bash
curl -X PATCH \
  ${BASE_URL}/goals/${GOAL_ID}/purchase-links/${LINK_ID} \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "MacBook Pro M4 - 32GB RAM",
    "price": 15000.00,
    "note": "Novo modelo lançado! Melhor configuração"
  }'
```

### Response (200 OK)

```json
{
  "message": "Link atualizado com sucesso",
  "goal": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "purchaseLinks": [
      {
        "id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
        "title": "MacBook Pro M4 - 32GB RAM",
        "url": "https://www.amazon.com.br/Apple-MacBook-Pro/dp/B0ABCDEF",
        "price": 15000.0,
        "currency": "BRL",
        "note": "Novo modelo lançado! Melhor configuração",
        "addedAt": "2024-12-03T03:00:00.000Z",
        "updatedAt": "2024-12-03T05:30:00.000Z"
      }
    ]
  }
}
```

---

## 5. ❌ Remover Link de Compra

### Request

```bash
curl -X DELETE \
  ${BASE_URL}/goals/${GOAL_ID}/purchase-links/${LINK_ID} \
  -H "Authorization: Bearer ${TOKEN}"
```

### Response (200 OK)

```json
{
  "message": "Link removido com sucesso",
  "goal": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "purchaseLinks": []
  }
}
```

---

## 6. 💰 Resumo dos Links (Total de Preços)

### Request

```bash
curl -X GET \
  ${BASE_URL}/goals/${GOAL_ID}/purchase-links/summary \
  -H "Authorization: Bearer ${TOKEN}"
```

### Response (200 OK)

```json
{
  "total": 3,
  "totalBRL": 18700.0,
  "byCurrenty": {
    "BRL": 18700.0,
    "USD": 0.0
  },
  "links": [
    {
      "id": "link-1",
      "title": "MacBook Pro M3",
      "url": "https://www.amazon.com.br/...",
      "price": 12500.0,
      "currency": "BRL",
      "note": "Black Friday",
      "addedAt": "2024-12-03T03:00:00.000Z"
    },
    {
      "id": "link-2",
      "title": "AppleCare+ 3 anos",
      "url": "https://www.apple.com/...",
      "price": 1200.0,
      "currency": "BRL",
      "addedAt": "2024-12-03T03:15:00.000Z"
    },
    {
      "id": "link-3",
      "title": "Magic Keyboard",
      "url": "https://www.apple.com/...",
      "price": 5000.0,
      "currency": "BRL",
      "addedAt": "2024-12-03T03:30:00.000Z"
    }
  ]
}
```

---

## 7. 🎯 Obter Meta Completa (com imagem e links)

### Request

```bash
curl -X GET \
  ${BASE_URL}/goals/${GOAL_ID} \
  -H "Authorization: Bearer ${TOKEN}"
```

### Response (200 OK)

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "user-123",
  "name": "Viagem para Europa",
  "description": "15 dias em Paris, Roma e Barcelona",
  "targetAmount": 15000.0,
  "currentAmount": 9750.0,
  "targetDate": "2025-12-31T00:00:00.000Z",
  "color": "#10B981",
  "icon": "✈️",
  "priority": 1,
  "status": "ACTIVE",

  "imageUrl": "https://minio.local/goals/user-123/goal-456/eiffel.jpg",
  "imageKey": "goals/user-123/goal-456/eiffel.jpg",
  "imageMimeType": "image/jpeg",
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

  "contributions": [
    {
      "id": "contrib-1",
      "amount": 1000.0,
      "date": "2024-11-15T00:00:00Z"
    }
  ],

  "_count": {
    "contributions": 10
  },

  "createdAt": "2024-11-01T00:00:00Z",
  "updatedAt": "2024-12-03T03:00:00Z",
  "completedAt": null
}
```

---

## 🧪 Testes Automatizados

### Jest/Vitest (exemplo)

```typescript
describe('Goals Image & Links API', () => {
  let goalId: string;
  let token: string;

  beforeAll(async () => {
    // Login e criar meta de teste
    token = await login('user@test.com', 'password');
    const goal = await createGoal({ name: 'Test Goal', targetAmount: 10000 });
    goalId = goal.id;
  });

  describe('Upload Image', () => {
    it('should upload goal image successfully', async () => {
      const formData = new FormData();
      formData.append('image', fileBlob, 'test.jpg');

      const response = await fetch(`/goals/${goalId}/image`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.goal.imageUrl).toBeDefined();
    });

    it('should reject invalid file format', async () => {
      const formData = new FormData();
      formData.append('image', pdfBlob, 'test.pdf');

      const response = await fetch(`/goals/${goalId}/image`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      expect(response.status).toBe(400);
    });
  });

  describe('Purchase Links', () => {
    it('should add purchase link', async () => {
      const response = await fetch(`/goals/${goalId}/purchase-links`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: 'Test Product',
          url: 'https://amazon.com.br/product/123',
          price: 1000,
          currency: 'BRL',
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.goal.purchaseLinks).toHaveLength(1);
    });

    it('should reject more than 10 links', async () => {
      // Adicionar 10 links
      for (let i = 0; i < 10; i++) {
        await addPurchaseLink(goalId, {
          title: `Link ${i}`,
          url: `https://test.com/${i}`,
        });
      }

      // Tentar adicionar 11º
      const response = await addPurchaseLink(goalId, {
        title: 'Link 11',
        url: 'https://test.com/11',
      });
      expect(response.status).toBe(400);
      expect(response.data.message).toContain('Máximo de 10 links');
    });
  });
});
```

---

## 📊 Postman Collection

Importe esta collection no Postman:

```json
{
  "info": {
    "name": "Miu Controle - Goals Images & Links",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Upload Goal Image",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{token}}"
          }
        ],
        "body": {
          "mode": "formdata",
          "formdata": [
            {
              "key": "image",
              "type": "file",
              "src": "/path/to/image.jpg"
            }
          ]
        },
        "url": {
          "raw": "{{baseUrl}}/goals/{{goalId}}/image",
          "host": ["{{baseUrl}}"],
          "path": ["goals", "{{goalId}}", "image"]
        }
      }
    },
    {
      "name": "Delete Goal Image",
      "request": {
        "method": "DELETE",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{token}}"
          }
        ],
        "url": {
          "raw": "{{baseUrl}}/goals/{{goalId}}/image",
          "host": ["{{baseUrl}}"],
          "path": ["goals", "{{goalId}}", "image"]
        }
      }
    },
    {
      "name": "Add Purchase Link",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{token}}"
          },
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"title\": \"MacBook Pro M3\",\n  \"url\": \"https://www.amazon.com.br/produto/123\",\n  \"price\": 12500.00,\n  \"currency\": \"BRL\",\n  \"note\": \"Black Friday\"\n}"
        },
        "url": {
          "raw": "{{baseUrl}}/goals/{{goalId}}/purchase-links",
          "host": ["{{baseUrl}}"],
          "path": ["goals", "{{goalId}}", "purchase-links"]
        }
      }
    },
    {
      "name": "Update Purchase Link",
      "request": {
        "method": "PATCH",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{token}}"
          },
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"price\": 10999.00,\n  \"note\": \"Preço caiu!\"\n}"
        },
        "url": {
          "raw": "{{baseUrl}}/goals/{{goalId}}/purchase-links/{{linkId}}",
          "host": ["{{baseUrl}}"],
          "path": ["goals", "{{goalId}}", "purchase-links", "{{linkId}}"]
        }
      }
    },
    {
      "name": "Delete Purchase Link",
      "request": {
        "method": "DELETE",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{token}}"
          }
        ],
        "url": {
          "raw": "{{baseUrl}}/goals/{{goalId}}/purchase-links/{{linkId}}",
          "host": ["{{baseUrl}}"],
          "path": ["goals", "{{goalId}}", "purchase-links", "{{linkId}}"]
        }
      }
    },
    {
      "name": "Get Purchase Links Summary",
      "request": {
        "method": "GET",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{token}}"
          }
        ],
        "url": {
          "raw": "{{baseUrl}}/goals/{{goalId}}/purchase-links/summary",
          "host": ["{{baseUrl}}"],
          "path": ["goals", "{{goalId}}", "purchase-links", "summary"]
        }
      }
    }
  ],
  "variable": [
    {
      "key": "baseUrl",
      "value": "http://localhost:3000"
    },
    {
      "key": "token",
      "value": "seu_token_jwt"
    },
    {
      "key": "goalId",
      "value": "uuid_da_meta"
    },
    {
      "key": "linkId",
      "value": "uuid_do_link"
    }
  ]
}
```

---

## 🎉 Pronto para Testar!

1. Inicie o backend: `npm run start:dev`
2. Obtenha um token JWT fazendo login
3. Crie uma meta ou use uma existente
4. Teste os endpoints acima!

Happy Testing! 🚀
