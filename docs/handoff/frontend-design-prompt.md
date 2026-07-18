# Prompt — Novo frontend do Miu Controle (visual + refatoração da API)

> **Como usar:** cole este prompt no Claude Code, aberto no repositório
> `miu-controle-frontend`. Tenha à mão a pasta `docs/handoff/` do backend
> (referência completa da API) e o `docs/handoff/openapi.json` (tipos). Trabalhe em
> uma branch nova. Implemente na ordem sugerida na seção 9.

---

Você é um(a) engenheiro(a) de produto sênior especialista em **design de fintechs mobile-first** e em **Next.js**. Sua missão é **redesenhar do zero o visual e a experiência** do web app **Miu Controle** e, ao mesmo tempo, **refatorar toda a camada de API** para o novo backend versionado (`/api/v1`). O resultado deve ser um app **lindo, acolhedor, rápido e mobile-first**, com um design system consistente que possa ser portado para o app mobile.

## 0. Regras inegociáveis

- **Idioma:** toda a UI, microcopy, mensagens e comentários em **português (pt-BR)**.
- **Mobile-first de verdade:** projete cada tela primeiro para 375px de largura; depois expanda para tablet/desktop. Nada de "desktop encolhido".
- **Stack (manter):** Next.js 16 (App Router) · React 19 · TypeScript · **Tailwind v4** (config CSS-first via `@theme` no `globals.css`) · **@tanstack/react-query** · axios · react-hook-form + zod · **recharts** · lucide-react (ícones). Não introduza libs de UI pesadas (MUI/Chakra); construa componentes próprios com Tailwind.
- **Fonte da verdade da API:** `docs/handoff/` (um `.md` por domínio + `README.md` com convenções) e `docs/handoff/openapi.json`. **Não invente endpoints**; se algo não existir lá, pergunte.
- **Não quebre a build.** Entregue TypeScript tipado (use o `openapi.json` para gerar/derivar tipos).

---

## 1. O produto

O **Miu Controle** é um app de **finanças pessoais** para o público brasileiro. A tese central: *a maioria das pessoas desiste de controlar as finanças porque **registrar cada gasto é lento e chato**.* Então o norte do produto é:

> **Registrar uma despesa em menos de 5 segundos, sem fricção — e tornar o acompanhamento algo prazeroso, não uma tarefa.**

O app deve ser **acolhedor e motivacional** (não um dashboard bancário frio), transmitir **confiança** (é dinheiro) e **celebrar o progresso** do usuário. Mascote: **"Miu"**, um gato simpático, que aparece em estados vazios, onboarding, conquistas e mensagens — com leveza, sem infantilizar.

**5 formas de lançar transações** (o coração do produto — dê destaque máximo):
1. **Manual** — rápido, via botão flutuante (FAB).
2. **OCR** — foto do comprovante → extração automática → confirmação.
3. **Recorrente** — salário, contas fixas (geradas automaticamente).
4. **Importação** — extrato **OFX/CSV** do banco.
5. **WhatsApp** — manda "mercado 50" e vira transação.
   *(Notificação bancária Android = "em breve", depende do app.)*

---

## 2. Princípios de UX

1. **Lançar em <5s é a métrica-norte.** O FAB de "+" deve estar sempre acessível; o fluxo manual padrão é: valor → categoria (sugerida por IA) → salvar. Tudo o mais é opcional.
2. **Feedback imediato:** updates otimistas + confirmação via WebSocket. Saldo e listas reagem na hora.
3. **Hierarquia clara:** o número que importa em destaque; o resto respira. Evite densidade excessiva no mobile.
4. **Estados vazios motivacionais** (com o Miu): todo primeiro uso de uma tela ensina e convida à ação — nunca uma tela em branco.
5. **Confiança:** valores monetários sempre formatados em BRL (R$ 1.234,56); receitas em verde, despesas em vermelho, de forma consistente.
6. **Acessibilidade:** contraste AA, alvos de toque ≥44px, foco de teclado visível, `aria-*` corretos, respeita `prefers-reduced-motion`.
7. **Microcopy pt-BR acolhedor** e específico (ex.: "Boa! Você registrou gastos 7 dias seguidos 🐱" em vez de "Sucesso").

---

## 3. Direção de arte & Design System (tokens)

Defina os tokens no `globals.css` com **Tailwind v4 `@theme`** (variáveis CSS), pensados para **light e dark** e para serem **espelhados no app Expo/NativeWind** (mesmos nomes).

**Paleta:**
- **Primária (índigo):** `#6366F1` (marca, ações, links). Escala 50→900.
- **Receita/sucesso (verde):** `#10B981`.
- **Despesa/erro (vermelho):** `#EF4444`.
- **Alerta (âmbar):** `#F59E0B`.
- **Info:** azul `#3B82F6`.
- **Neutros:** cinzas para texto/bordas/superfícies. Semânticos: `background`, `foreground`, `card`, `muted`, `border`, `ring` (mantenha os nomes já usados no repo).
- **Dark mode** como cidadão de 1ª classe (o repo já tem `ThemeProvider`).

**Tipografia:** uma sans moderna e legível (ex.: Inter/Geist). Escala tipográfica com números tabulares para valores. Peso forte nos saldos.

**Forma & profundidade:** raios generosos (cards ~16px, botões ~12px, pills full), sombras suaves em camadas, superfícies com leve elevação. Estética "soft fintech".

**Ícones:** lucide-react. **Categorias/contas** têm `color` (hex) e `icon` vindos da API — renderize-os como identidade visual (chip colorido + ícone/emoji).

**Mascote Miu:** conjunto de estados (feliz, comemorando, pensando, cochilando/empty). Usar em: onboarding, empty states, conquistas/metas batidas, erros amigáveis. Nunca no meio de fluxos críticos de dados.

**Motion:** transições suaves (200–300ms), animação de contagem em valores, celebração (confete discreto) ao bater meta/mission, skeletons em vez de spinners. Respeitar `prefers-reduced-motion`.

Entregue uma página `/design-system` (o repo já tem a rota) exibindo tokens, tipografia, cores semânticas, e todos os componentes com seus estados.

---

## 4. Biblioteca de componentes (specs)

Construa (com variantes, estados `hover/active/disabled/loading`, e dark mode):

- **AppShell** — **mobile:** bottom nav com 4–5 itens (Início, Transações, +[FAB central], Metas, Mais) + header enxuto; **desktop:** sidebar + topbar. O **FAB "+"** abre o menu de lançamento (as 5 vias).
- **MoneyText** — formata BRL, cor por sinal/tipo, números tabulares, animação de contagem.
- **AmountInput** — teclado numérico grande (mobile), máscara R$, decimal vírgula; é o campo herói do lançamento manual.
- **CategoryPicker** — grid de categorias (chip cor + ícone), busca, destaque da categoria sugerida pela IA (com badge "sugerido").
- **AccountChip / AccountCard** — nome, tipo, saldo, cor/ícone; card mostra saldo e ações.
- **TransactionRow** — ícone da categoria, descrição, merchant/brand (logo se houver), conta, data, valor colorido, badge de `source` (Manual/OCR/Recorrente/Importado/WhatsApp).
- **BudgetBar** — barra de progresso com faixas OK/atenção/estourado.
- **ProgressRing** — anel de progresso para metas (com % e mascote ao completar).
- **StatCard / KPI** — título, valor, delta vs período anterior (seta + %).
- **Charts** (wrappers recharts): linha (evolução patrimonial/tendência), barras (mês a mês), donut (por categoria), área (fluxo de caixa/projeção). Tema claro/escuro, tooltips em pt-BR, responsivos com scroll horizontal quando necessário.
- **Sheet/Modal**, **BottomSheet** (mobile), **Toast**, **ConfirmDialog**.
- **Skeletons**, **EmptyState** (com Miu + CTA), **ErrorState** (amigável + "tentar de novo").
- **Badge/StatusPill**, **SegmentedControl/Tabs**, **DateRangePicker** (mês atual como padrão), **FilterSheet**.
- **FAB de lançamento** + **LaunchMenu** (as 5 vias).

---

## 5. Mapa de telas (completo) + endpoints `/api/v1`

Para cada tela: layout mobile e desktop, estados (loading/empty/error), e os endpoints que consome. (Detalhes de payload/response em `docs/handoff/`.)

### Auth & Onboarding
- **Login** — email/senha (`POST /auth/login`) + **botões Google/Apple** (fluxo Better Auth: abre `/api/auth/signin/google|apple` → recebe `sessionToken` → `POST /auth/google/exchange`|`/apple/exchange` → guarda JWT). Link "esqueci a senha".
- **Registro** (`POST /auth/register`) — validação forte de senha (mostrar requisitos). Após registrar, tela de "verifique seu email".
- **Esqueci / Reset senha** (`/auth/forgot-password`, `/auth/verify-reset-token`, `/auth/reset-password`), **Verificar email** (`/auth/verify-email`, `/auth/resend-verification`).
- **Onboarding** em passos (`GET /onboarding/status`, `POST /onboarding/step`, `POST /onboarding/complete`): boas-vindas do Miu → tema → renda mensal → personalidade da IA (conservador/investidor/educador) → cria 1ª conta e 1ª meta. Barra de progresso + XP ao concluir.

### Início (Dashboard) — `GET /dashboard/home` (1 chamada traz tudo)
Renderize os blocos: **saldo total** + contas; **resumo do mês** (receita/despesa/saldo + comparação com mês anterior); **ritmo de gastos** (acumulado vs esperado); **evolução patrimonial** (6 meses); **top categorias** (com variação); **metas** (perto de completar); **orçamentos** (atenção/estourados); **recorrentes próximas** (7 dias); **transações recentes**; **datas importantes**; **insights** (cards `warning/info/success/error`). FAB "+" sempre visível.

### Lançamento (as 5 vias — destaque máximo)
- **Manual** (`POST /transactions`, `source=MANUAL`): fluxo herói valor→categoria→salvar; categoria sugerida por IA (campo `aiCategorized`/`aiConfidence`); opcionais recolhidos (conta, data, tags, notas). Update otimista.
- **OCR** (`POST /transactions/from-receipt` multipart `image` → preview; depois `POST /transactions/from-receipt/confirm`): abrir câmera/upload → loading "Miu está lendo o comprovante…" → tela de **confirmação editável** (descrição, valor, data, merchant, categoria sugerida, itens do cupom) → salvar (`source=OCR`).
- **Importação OFX/CSV** (`POST /import/preview` multipart `file` + opções → `POST /import/confirm`): upload → para CSV, UI de **mapeamento de colunas** (data/valor/descrição, delimitador, separador decimal, formato de data) → **preview em lista com resumo** (total receita/despesa, período) e seleção do que importar → confirmar (mostra `imported`/`skipped` de duplicatas).
- **WhatsApp** — tela explicativa: como conectar o número e exemplos de mensagem ("mercado 50", "+2000 salário"). (O recebimento é via webhook no backend; o front só orienta e mostra as transações com `source=WHATSAPP`.)
- **Recorrentes** (`/recurring-transactions` CRUD + `toggle-active` + `process-now`): criar salário/contas fixas (frequência, dia, valor); lista com próxima ocorrência; transações geradas têm `source=RECURRING`.

### Transações — `GET /transactions` (**paginação cursor** `{items,nextCursor,hasMore}`)
Lista com **infinite scroll** (React Query `useInfiniteQuery`), **filtros** (tipo, categoria, conta, status, período, busca) em bottom-sheet, agrupamento por dia com subtotal. **Detalhe** (`GET /:id`), **editar** (`PATCH /:id`), **excluir** (`DELETE /:id`), **corrigir categoria da IA** (`POST /:id/correct-category`). Stats: `GET /transactions/stats/monthly`, `/stats/category/:id`.

### Contas — `/accounts` (CRUD, `GET /accounts/balance` para saldo total). Cards por conta (tipo/cor/ícone), criar/editar (saldo inicial), soft-delete.
### Categorias — `/categories` (CRUD; sistema vs usuário; hierarquia; `GET /:id/stats`). Seletor de cor + ícone.
### Orçamentos — `/budgets` (CRUD, `GET /budgets/summary`). Barras com faixa de alerta; status **`OK/WARNING/EXCEEDED`** (⚠️ o dashboard usa minúsculas `ok/warning/exceeded` — normalize no front).
### Metas — `/goals` (CRUD, `/summary`, `/hierarchy`, `/:id/contribute`, `/:id/withdraw`, imagem `POST|DELETE /:id/image`, **links de compra** `/:id/purchase-links`). Cards com ProgressRing + imagem; contribuir/retirar; galeria de links de compra com preço. *(Obs.: `parentId`/`distributionStrategy` não são aceitos no create hoje — não exponha ainda.)*
### Projetos — `/projects` (projetos + itens + **cotações**; `/:id/summary`; converter cotação em transação via `POST /projects/:id/items/:itemId/convert`). Fluxo: projeto → itens → cotações de fornecedores → selecionar → converter (debita conta, item vira comprado).

### Insights & IA
- **Previsões** (`/predictions/*`), **Projeções de fluxo de caixa** (`/projections/cash-flow` com cenários), **Análise mensal** (`/analysis/monthly-comparison`).
- **Simulador "E se"** (`POST /scenarios/simulate`) + **Viabilidade de compra** (`POST /scenarios/affordability` — score 0–100, semáforo CAN_AFFORD/CAUTION/NOT_RECOMMENDED + recomendações).
- **Planejamento de meta** (`/planning/goal/:goalId/calculate` + `save`), **Fundo de emergência** (`/emergency-fund/*`), **Recomendações** (`/recommendations` aplicar/dispensar), **Health-score** (`GET /health-score` + `/achievements`), **Alertas proativos** (`/proactive-alerts`).
- **Config de IA** (`/ai/config` CRUD + `/test`; `/ai/usage-stats`, `/ai/categorization-stats`; `/ai/analytics/forecast|anomalies|trends|goal-forecast`): gerenciar chaves (OpenAI/Gemini), modelos, e ver uso/custo.

### Engajamento, avisos e conta
- **Gamificação** (`/gamification/profile`, `/gamification/missions`): perfil com XP, nível, streak; missões da semana; conquistas.
- **Notificações** (`/notifications` cursor, `unread-count`, `mark-as-read`, `mark-all-as-read`, `clear-read`): sino com badge; painel; realtime via WS `notification.new`.
- **Relatórios & Export** (`/reports/*`; `/export/csv|excel|pdf` — download com filtros).
- **Perfil / Configurações** (`/users/me` GET/PATCH, avatar, `/users/me/password`, **sessões** `/auth/sessions*`, tema, idioma; excluir conta).
- **Admin** (só `Role=ADMIN`): feedback (`/feedback`), release-notes, métricas (`/admin/*`). Esconder do usuário comum.

---

## 6. Integração com a API (regras técnicas)

- **Base URL:** `NEXT_PUBLIC_API_URL` + **`/api/v1`** em TODAS as chamadas de controller. **Exceção:** o OAuth do Better Auth vive em `/api/auth/*` (sem `v1`).
- **Auth JWT:** guardar `accessToken` + `refreshToken`; enviar `Authorization: Bearer <accessToken>`. **Interceptor** no `api-client.ts`: em `401`, tentar `POST /auth/refresh` uma vez e repetir a request; se falhar, deslogar. (O repo já tem `token.service.ts` + `AuthContext` — refatore, não recrie do zero.)
- **OAuth Google/Apple:** iniciar em `/api/auth/signin/*`, capturar o `sessionToken` e trocar por JWT em `/auth/google|apple/exchange`.
- **Paginação cursor:** listas grandes retornam `{ items, nextCursor, hasMore }`. Use `useInfiniteQuery` com `getNextPageParam = last => last.nextCursor`.
- **Erros:** padronize um handler — `400` traz `message` como **array** (mostrar por campo no form); `429` traz `retryAfter` (mostrar "tente em Xs"); `408` timeout. Toasts amigáveis em pt-BR.
- **WebSocket (tempo real):** Socket.IO conectando com `{ auth: { token: accessToken } }`. Ao receber `transaction.created/updated/deleted` e `balance.updated`, **invalide as queries** relevantes do React Query (transações, dashboard, contas). `notification.new` alimenta o sino. (O repo já tem `SocketContext` — refatore.)
- **Tipos:** derive do `docs/handoff/openapi.json` (ex.: `openapi-typescript`) ou mantenha `src/types/api.ts` alinhado ao contrato.

---

## 7. Refatoração da API (limpeza obrigatória)

O backend mudou. Ajuste a camada `services/*.actions.ts` e os tipos:
- **Prefixe tudo com `/api/v1`** (hoje as chamadas não têm o prefixo/versão).
- **Remova** o que não existe mais: `currencies`, `exchange-rates`, `inflation` (multi-moeda e simulador de inflação foram removidos) e o endpoint `/ai/analytics/financial-health` (use `GET /health-score`).
- **`affordability`** deixou de ser módulo próprio: agora é `POST /scenarios/affordability`.
- Confirme que **OCR confirm**, **import**, **whatsapp** e `source=RECURRING/WHATSAPP/OCR/IMPORTED` estão contemplados.
- Rotas/telas órfãs no app atual (ex.: `investments`, `sync`, `financial-health` como página separada) devem ser reavaliadas/removidas conforme o contrato real.

---

## 8. Motion & microinterações
Transições de página suaves; valores com animação de contagem; **confete discreto** ao bater meta ou completar missão; feedback tátil/visual ao salvar um lançamento (o "clique" de <5s deve ser satisfatório); skeletons no carregamento; o Miu reage a marcos. Sempre respeitando `prefers-reduced-motion`.

---

## 9. Entregáveis, ordem e critérios de aceite

**Ordem de implementação sugerida:**
1. **Design system** — tokens no `globals.css`, tema claro/escuro, e a página `/design-system` com todos os componentes.
2. **Camada de API** — refatorar `api-client.ts` (interceptor/refresh), `token.service.ts`, `AuthContext`, `SocketContext`, e os `*.actions.ts` para `/api/v1` (+ limpeza da seção 7). Tipos a partir do `openapi.json`.
3. **Auth + Onboarding.**
4. **Dashboard home.**
5. **Lançamento (as 5 vias).** ← prioridade de produto.
6. **Transações, Contas, Categorias, Orçamentos, Metas.**
7. **Projetos, Insights/IA, Gamificação, Notificações, Relatórios/Export, Perfil, Admin.**

**Checklist de aceite (cada tela):**
- [ ] Mobile-first (375px) impecável + responsivo até desktop.
- [ ] Dark mode correto.
- [ ] Estados **loading (skeleton)**, **vazio (com Miu + CTA)** e **erro (amigável)**.
- [ ] Tokens do design system (zero cores/spacing hardcoded fora dos tokens).
- [ ] Acessibilidade (contraste AA, foco, alvos ≥44px, aria).
- [ ] Consome os endpoints `/api/v1` corretos (conferidos em `docs/handoff/`).
- [ ] Realtime: reflete eventos WebSocket quando aplicável.
- [ ] Microcopy pt-BR acolhedora.
- [ ] TypeScript tipado e build passando.

**Antes de começar:** leia `docs/handoff/README.md` e os `.md` dos domínios que for tocar. Se encontrar divergência entre este prompt e o `docs/handoff/`, **o `docs/handoff/` (e o `openapi.json`) prevalece** — e me avise.
