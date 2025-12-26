# Troubleshooting - Deployment Issues

## Issue 1: GitHub Actions - package-lock.json Sync Error

### Erro
```
npm error Invalid: lock file's @types/uuid@10.0.0 does not satisfy @types/uuid@8.3.4
npm error Invalid: lock file's uuid@13.0.0 does not satisfy uuid@8.3.2
```

### Causa
O `package-lock.json` estava desatualizado após alterações no `package.json`.

### Solução
```bash
npm install
```

Isso regenera o `package-lock.json` com as versões corretas.

---

## Issue 2: Node.js Version Incompatibility

### Erro
```
npm warn EBADENGINE Unsupported engine {
npm warn EBADENGINE   package: '@nestjs/core@11.1.9',
npm warn EBADENGINE   required: { node: '>= 20' },
npm warn EBADENGINE   current: { node: 'v18.20.8', npm: '10.8.2' }
npm warn EBADENGINE }
```

### Causa
NestJS 11.x requer Node.js 20 ou superior, mas o Dockerfile estava usando Node.js 18.

### Solução
Atualizado o `Dockerfile` para usar `node:20-alpine`:

```dockerfile
FROM node:20-alpine AS builder
# ...
FROM node:20-alpine AS production
```

---

## Issue 3: UUID ESM Module Error

### Erro (Runtime na VPS)
```
Error [ERR_REQUIRE_ESM]: require() of ES Module /app/node_modules/uuid/dist-node/index.js from /app/dist/src/goals/goals.service.js not supported.
```

### Causa
UUID versão 13 é **ESM-only** (ECMAScript Modules), mas o NestJS compila para **CommonJS** por padrão.

### Solução
Revertido para UUID 8.3.2 que suporta ambos os formatos:

```json
{
  "dependencies": {
    "uuid": "^8.3.2"
  },
  "devDependencies": {
    "@types/uuid": "^8.3.4"
  }
}
```

---

## Issue 4: Caminho Incorreto do main.js

### Erro (Primeiro erro no Easypanel)
```
Error: Cannot find module '/app/dist/main.js'
```

### Causa
O NestJS compila mantendo a estrutura de diretórios. O arquivo compilado fica em `/app/dist/src/main.js` e não `/app/dist/main.js`.

### Solução
Corrigido no `docker-entrypoint.sh`:

```bash
# Antes
exec node dist/main.js

# Depois
exec node dist/src/main.js
```

---

## Testando Localmente

Para testar o build do Docker localmente antes de fazer deploy:

```bash
# Build da imagem
docker build -t miu-backend:test .

# Verificar se o build foi bem-sucedido e a estrutura está correta
docker run --rm miu-backend:test ls -la /app/dist/src/

# Deve mostrar main.js e outros arquivos compilados
```

---

## Checklist de Deploy

Antes de fazer push para produção:

- [x] Node.js 20 no Dockerfile
- [x] UUID na versão 8.3.2
- [x] package-lock.json atualizado
- [x] Caminho correto no entrypoint (`dist/src/main.js`)
- [ ] Build local bem-sucedido
- [ ] Variáveis de ambiente configuradas no servidor
- [ ] DATABASE_URL apontando para o banco correto

---

## Próximos Passos

1. **Commit das mudanças**:
   ```bash
   git add .
   git commit -m "fix: update Node.js to v20 and fix UUID compatibility"
   git push origin main
   ```

2. **Monitorar GitHub Actions**: Verificar se o build passa sem erros

3. **Verificar Deploy**: Conferir os logs no Easypanel/VPS para confirmar que a aplicação iniciou corretamente

4. **Teste da API**: Fazer requisições para verificar se os endpoints estão funcionando
