# AGENTS.md

## Visão geral

Este repositório contém um gateway local compatível com a API da OpenAI.

- API Fastify: `src/`
- Dashboard React/Vite: `web/src/`
- Banco SQLite e auditoria: `data/`
- Build compilado: `dist/` e `web/dist/`

## Comandos principais

```bash
npm install
npm run dev
npm run typecheck
npm run test
npm run build
npm start
```

Docker:

```powershell
docker compose up -d --build
docker compose logs -f
docker compose down
```

For Portainer/Swarm-style deployments, use `docker-compose.portainer.yml`. It references the published GHCR image and does not use `build:` or `container_name:`. The image is published by `.github/workflows/docker.yml` after pushes to `main`.

The container serves both the API and the dashboard on port `3333`. The Docker volume `gateway_data` must be preserved so SQLite and OAuth credentials survive service recreation.

URL matrix:

- local without Docker: dashboard `http://127.0.0.1:5173`, API base `http://127.0.0.1:3333/v1`;
- local with Docker: dashboard and API at `http://127.0.0.1:3333`, API base ending in `/v1`;
- another container in the same Compose network: `http://personal-ai-gateway:3333/v1`;
- remote n8n: use the HTTPS tunnel URL ending in `/v1`.

O modo `dev` inicia simultaneamente:

- API em `http://127.0.0.1:3333`
- Dashboard em `http://127.0.0.1:5173`

## Configuração

Use `.env.example` como referência e mantenha os segredos somente no `.env` local.

Para o OAuth real:

```env
PROVIDER=authorized
OAUTH_STORAGE_KEY=um-segredo-longo-e-aleatorio
```

Não substitua `ADMIN_TOKEN`, `OAUTH_STORAGE_KEY` ou API keys por valores reais no código, README ou testes versionados.

## Arquitetura

- `src/server.ts`: rotas Fastify, autenticação e respostas OpenAI-compatible.
- `src/oauth.ts`: PKCE, callback OAuth, refresh e sessão criptografada.
- `src/providers.ts`: provider mock e provider OAuth autorizado.
- `src/db.ts`: SQLite, API keys e métricas de requisição.
- `src/security.ts`: criação, hash e leitura de Bearer tokens.
- `web/src/main.tsx`: dashboard, OAuth e gerenciamento local de chaves.
- `web/src/style.css`: layout e estilos do dashboard.

## Regras de API

- Rotas `/v1/*` exigem `Authorization: Bearer pai_...`.
- Rotas `/admin/*` exigem `ADMIN_TOKEN`.
- API keys são exibidas somente na criação e devem ser armazenadas apenas como hash no servidor.
- É permitido criar várias API keys; cada uma deve possuir um ID próprio e poder ser revogada individualmente.
- Preserve os formatos compatíveis com OpenAI em `/v1/models`, `/v1/chat/completions` e `/v1/responses`.
- Alterações no formato de `/v1/responses` devem considerar clientes n8n e conteúdos de mensagem em texto ou array.

## Dashboard

- O dashboard deve bloquear o conteúdo quando não houver sessão OAuth autorizada.
- O botão de conexão deve ser o único elemento disponível nesse estado.
- O logout deve existir somente no menu superior e exigir confirmação em modal.
- Após conectar ou desconectar, o estado visual deve ser atualizado sem exigir reinício manual do navegador.
- API keys salvas no navegador ficam no `localStorage`; não exiba chaves completas em logs ou mensagens de erro.
- Mantenha a interface enxuta: conexão, gerenciamento de API keys e teste de requisição são as áreas principais.

## OAuth

- Preserve `state`, PKCE, nonce, validação do ID token e escopos existentes.
- A sessão é armazenada em `data/oauth-session.enc` e deve continuar criptografada.
- O callback deve redirecionar para `DASHBOARD_URL` após uma conexão bem-sucedida.
- O logout deve remover a sessão persistida, não apenas limpar a memória do processo.

## n8n remoto e túneis

Quando o n8n estiver remoto, `127.0.0.1` não aponta para esta máquina. A API pode ser exposta temporariamente com:

```powershell
cloudflared tunnel --protocol http2 --url http://127.0.0.1:3333
```

Na configuração padrão, o `cloudflared` roda no host, fora do container, e usa a porta Docker publicada `3333`. O Base URL no n8n deve terminar em `/v1`. Quick tunnels são temporários e não devem ser tratados como configuração de produção. Um serviço `cloudflared` separado pode apontar para `http://personal-ai-gateway:3333` dentro da rede do Compose.

## Processo de alteração

1. Leia os arquivos envolvidos antes de editar.
2. Preserve alterações existentes e não faça reset destrutivo do worktree.
3. Use `apply_patch` para alterações manuais.
4. Execute `npm run typecheck` após mudanças TypeScript.
5. Execute `npm run test` para mudanças na API, autenticação ou banco.
6. Execute `npm run build` para mudanças no dashboard ou no processo de produção.
7. Atualize `README.md` quando mudar configuração, endpoints ou fluxo de uso.

## Segurança

- Não exponha `ADMIN_TOKEN`, `OAUTH_STORAGE_KEY`, tokens OAuth ou API keys.
- Não adicione scraping, cookies de sessão, endpoints internos ou encaminhamento indevido de tokens.
- Antes de expor a API por túnel, considere autenticação adicional, limites de requisição e domínio estável.
- Não remova autenticação de rotas administrativas para facilitar testes.
- Não remova o volume `gateway_data` do Docker Compose; ele contém o estado persistente do gateway.
