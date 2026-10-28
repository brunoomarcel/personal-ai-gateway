# AGENTS.md

## Visão geral

Gateway local compatível com a API da OpenAI.

- API Fastify: `src/`
- Dashboard React/Vite: `web/src/`
- Banco SQLite e auditoria: `data/`
- Build compilado: `dist/` e `web/dist/`

## Comandos

```bash
npm install
npm run dev
npm run typecheck
npm run test
npm run build
npm start
```

Docker local:

```powershell
docker compose up -d --build
docker compose logs -f
docker compose down
```

O container local serve API e dashboard em `http://127.0.0.1:3333`. O volume `./data:/app/data` deve ser preservado para manter SQLite e sessão OAuth.

## Configuração

Use `.env.example` como referência e mantenha segredos somente no `.env` local.

OAuth real:

```env
PROVIDER=authorized
OAUTH_STORAGE_KEY=um-segredo-longo-e-aleatorio
```

## Arquitetura

- `src/server.ts`: rotas Fastify, autenticação e respostas compatíveis com OpenAI.
- `src/oauth.ts`: PKCE, callback local, refresh e sessão criptografada.
- `src/providers.ts`: provider mock e provider OAuth autorizado.
- `src/db.ts`: SQLite, API keys e métricas.
- `src/security.ts`: criação, hash e leitura de Bearer tokens.
- `web/src/main.tsx`: dashboard, OAuth e gerenciamento local de chaves.
- `web/src/style.css`: layout e estilos do dashboard.

## Regras

- Rotas `/v1/*` exigem `Authorization: Bearer pai_...`.
- Rotas `/admin/*` exigem `ADMIN_TOKEN`.
- API keys são exibidas somente na criação e armazenadas apenas como hash no servidor.
- É permitido criar várias API keys e revogá-las individualmente.
- Preserve os formatos compatíveis com OpenAI em `/v1/models`, `/v1/chat/completions` e `/v1/responses`.
- O OAuth usa callback local e deve preservar state, PKCE, nonce, validação do ID token e escopos.
- A sessão fica em `data/oauth-session.enc` e o logout deve removê-la do disco.

## Dashboard

- Bloqueia o conteúdo sem sessão OAuth autorizada.
- Exibe somente conexão quando não há sessão.
- Logout apenas no menu superior e com confirmação.
- API keys do navegador ficam no `localStorage`; nunca exiba chaves completas em logs.
- Mantenha a interface focada em conexão, API keys e teste de requisição.

## Processo de alteração

1. Leia os arquivos envolvidos antes de editar.
2. Preserve alterações existentes e não faça reset destrutivo.
3. Use `apply_patch` para edições manuais.
4. Execute `npm run typecheck` após mudanças TypeScript.
5. Execute `npm run test` para mudanças na API, autenticação ou banco.
6. Execute `npm run build` para mudanças no dashboard ou produção.
7. Atualize `README.md` quando mudar configuração, endpoints ou fluxo.

## Segurança

- Não exponha `ADMIN_TOKEN`, `OAUTH_STORAGE_KEY`, tokens OAuth ou API keys.
- Não adicione scraping, cookies de sessão ou encaminhamento indevido de tokens.
- Não remova autenticação administrativa para facilitar testes.
- Não remova o diretório `data`, que contém o estado persistente local.
