# Personal OAuth AI Gateway

Gateway local compatível com a API da OpenAI. Conecta uma conta autorizada por OAuth, cria API keys próprias (`pai_...`) e oferece endpoints compatíveis para uso local, scripts e n8n no mesmo computador.

## Requisitos

- Node.js 20 ou superior;
- npm;
- Docker Desktop, caso prefira executar em container;
- conta elegível para OAuth quando `PROVIDER=authorized` for usado.

## Executar localmente com Node.js

```powershell
npm install
Copy-Item .env.example .env
```

Configure o `.env`:

```env
PORT=3333
HOST=127.0.0.1
DATABASE_PATH=./data/gateway.db
ADMIN_TOKEN=troque-por-um-token-forte
PROVIDER=authorized
OAUTH_STORAGE_KEY=troque-por-um-segredo-longo-e-aleatorio
DASHBOARD_URL=http://127.0.0.1:5173
```

Inicie API e dashboard:

```powershell
npm run dev
```

URLs locais:

- Dashboard: `http://127.0.0.1:5173`
- API: `http://127.0.0.1:3333`
- Base URL: `http://127.0.0.1:3333/v1`
- Health check: `http://127.0.0.1:3333/health`

## Executar localmente com Docker

O container reúne a API e o dashboard na porta `3333`. O banco SQLite e a sessão OAuth ficam em `./data`.

```powershell
Copy-Item .env.example .env
docker compose up -d --build
```

Abra `http://127.0.0.1:3333`.

Comandos úteis:

```powershell
docker compose logs -f
docker compose ps
docker compose down
```

Não remova o diretório `data`, pois ele contém o banco e a sessão OAuth criptografada.

## OAuth local

1. Configure `PROVIDER=authorized`.
2. Defina uma `OAUTH_STORAGE_KEY` longa e aleatória.
3. Inicie o projeto.
4. Abra o dashboard local.
5. Clique em **Conectar à OpenAI**.

O fluxo usa callback local em `127.0.0.1`. O logout remove a sessão persistida. O OAuth autoriza o uso de inferência disponível para a conta; ele não cria uma API key da OpenAI.

## API keys

As API keys são criadas no dashboard. A chave completa é mostrada somente no momento da criação. O servidor armazena apenas o hash no SQLite e permite criar e revogar várias chaves individualmente.

Rotas `/v1/*` exigem:

```text
Authorization: Bearer pai_sua_chave
```

Rotas administrativas exigem o `ADMIN_TOKEN`.

## Endpoints

- `GET /v1/models`
- `POST /v1/chat/completions`
- `POST /v1/responses`
- `GET /v1/usage`

Exemplo:

```powershell
Invoke-RestMethod `
  http://127.0.0.1:3333/v1/models `
  -Headers @{ Authorization = 'Bearer pai_sua_chave' }
```

## n8n local

Na credencial OpenAI do n8n local, use:

```text
Base URL: http://127.0.0.1:3333/v1
API Key: pai_sua_chave
```

Para outro container na mesma rede Docker:

```text
http://personal-ai-gateway:3333/v1
```

Um n8n remoto não acessa `127.0.0.1` deste computador. Este projeto agora é destinado ao uso local; n8n remoto exigiria túnel ou exposição pública, fora da configuração padrão.

## Validação

```powershell
npm run typecheck
npm run test
npm run build
```

## Segurança

- Não versione `.env`, tokens OAuth, `ADMIN_TOKEN`, `OAUTH_STORAGE_KEY` ou API keys.
- Não exponha o dashboard ou `/admin/*` diretamente na internet.
- Preserve `data/gateway.db` e `data/oauth-session.enc`.
- Se um segredo for exposto, substitua-o imediatamente.
