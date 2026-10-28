# Personal OAuth AI Gateway

Gateway local compatível com a API da OpenAI. Ele permite conectar uma conta autorizada por OAuth, criar API keys próprias (`pai_...`) e expor endpoints compatíveis com clientes OpenAI, automações, n8n e scripts locais.

> Projeto pessoal/local. Não o exponha publicamente sem autenticação, TLS, controle de acesso e uma revisão de segurança adequada.

## O que este projeto faz

- executa uma API HTTP local em `127.0.0.1:3333`;
- oferece um dashboard React/Vite em `127.0.0.1:5173`;
- autentica clientes com API keys próprias no formato `pai_...`;
- armazena somente o hash SHA-256 das API keys no SQLite;
- conecta uma conta ChatGPT/OpenAI por OAuth autorizado;
- oferece `/v1/chat/completions`, `/v1/responses` e `/v1/models`;
- registra contagem, status e latência das requisições;
- permite criar várias API keys, selecioná-las e revogá-las.

## Requisitos

- Node.js 20 ou superior;
- npm;
- conta elegível para OAuth, quando `PROVIDER=authorized` for usado.

## Instalação

```bash
npm install
```

No PowerShell:

```powershell
Copy-Item .env.example .env
```

Edite o `.env` antes de iniciar o projeto.

## Configuração

Exemplo para OAuth real:

```env
PORT=3333
HOST=127.0.0.1
DATABASE_PATH=./data/gateway.db
ADMIN_TOKEN=troque-por-um-token-administrativo-forte
PROVIDER=authorized
OAUTH_STORAGE_KEY=troque-por-um-segredo-longo-e-aleatorio
DASHBOARD_URL=http://127.0.0.1:5173
```

| Variável | Função | Padrão |
|---|---|---|
| `PORT` | Porta da API | `3333` |
| `HOST` | Endereço de bind | `127.0.0.1` |
| `DATABASE_PATH` | Banco SQLite e auditoria | `./data/gateway.db` |
| `ADMIN_TOKEN` | Protege rotas administrativas | `change-me-in-development` |
| `PROVIDER` | `mock` ou `authorized` | `mock` |
| `OAUTH_STORAGE_KEY` | Criptografa a sessão OAuth | — |
| `DASHBOARD_URL` | URL do redirecionamento OAuth | `http://127.0.0.1:5173` |

Não use valores de desenvolvimento em ambiente exposto.

## Executar com Docker

O container reúne a API e o dashboard na porta `3333` e mantém o SQLite no diretório `data/` do projeto.

1. Crie e configure o `.env`:

```powershell
Copy-Item .env.example .env
```

2. Ajuste pelo menos `ADMIN_TOKEN`, `PROVIDER` e `OAUTH_STORAGE_KEY`.
3. Suba o serviço:

```powershell
docker compose up -d --build
```

4. Abra <http://127.0.0.1:3333>.

### URLs conforme o cenário

| Cenário | URL do dashboard | Base URL da API |
|---|---|---|
| Sem Docker, acesso local | `http://127.0.0.1:5173` | `http://127.0.0.1:3333/v1` |
| Docker, acesso local | `http://127.0.0.1:3333` | `http://127.0.0.1:3333/v1` |
| n8n no mesmo host | — | `http://127.0.0.1:3333/v1` |
| n8n em outro container da mesma rede Compose | — | `http://personal-ai-gateway:3333/v1` |
| n8n remoto | — | `https://SEU-TUNEL.trycloudflare.com/v1` |

No cenário remoto, o dashboard continua sendo acessado localmente em `http://127.0.0.1:3333`; somente a API é exposta pelo túnel.

Comandos úteis:

```powershell
docker compose logs -f
docker compose ps
docker compose down
```

### Deploy pelo Portainer

O Portainer em modo Stack não compila `Dockerfile` via `build:`. Por isso, o workflow do GitHub Actions publica a imagem em `ghcr.io` a cada push na branch `main`. Use o arquivo `docker-compose.portainer.yml`, que referencia uma imagem pronta.

1. Acesse **Stacks → Add stack**.
2. Escolha **Git repository**.
3. Use:

```text
Repository URL: https://github.com/brunoomarcel/personal-ai-gateway.git
Compose path: docker-compose.portainer.yml
```

4. Em **Environment variables**, cadastre pelo menos:

```text
ADMIN_TOKEN=um-token-admin-forte
OAUTH_STORAGE_KEY=um-segredo-longo-e-aleatorio
PROVIDER=authorized
DASHBOARD_URL=https://personal-ai-gateway.medainer.com.br
DOMAIN=personal-ai-gateway.medainer.com.br
TRAEFIK_NETWORK=traefik-public
TRAEFIK_ENTRYPOINT=websecure
TRAEFIK_CERTRESOLVER=letsencrypt
HOST=0.0.0.0
PORT=3333
DATABASE_PATH=/app/data/gateway.db
```

5. Garanta que a imagem `ghcr.io/brunoomarcel/personal-ai-gateway:latest` foi publicada pelo GitHub Actions.
6. Clique em **Deploy the stack**.

O Compose cria o container `personal-ai-gateway`, publica a porta `3333` e cria o volume Docker `gateway_data` para preservar o SQLite e a sessão OAuth. Não é necessário criar uma pasta manualmente na VPS.

O Stack usa as labels do Traefik para fazer o roteamento:

```text
personal-ai-gateway.medainer.com.br → Traefik → personal-ai-gateway:3333
```

Antes do deploy, a rede Docker externa usada pelo Traefik deve existir e o nome deve ser informado em `TRAEFIK_NETWORK` (o padrão no arquivo é `traefik-public`). O nome do entrypoint e do resolver também precisa corresponder à configuração do seu Traefik. O Traefik solicita e renova o certificado HTTPS. Abra somente as portas `80` e `443` no firewall da VPS.

No Portainer, confirme em **Networks** o nome exato da rede do Traefik. Se ela não for `traefik-public`, altere `TRAEFIK_NETWORK` nas variáveis do Stack. O serviço do gateway e o Traefik precisam estar conectados à mesma rede overlay.

Depois do deploy, a URL do dashboard será `https://personal-ai-gateway.medainer.com.br` e a Base URL para o n8n será `https://personal-ai-gateway.medainer.com.br/v1`.

No modo local, o volume `./data:/app/data` preserva o banco; no Portainer, essa função é feita pelo volume `gateway_data`. O container simplifica a execução local, mas não torna a API acessível a um n8n remoto.

Na configuração padrão, o túnel roda **fora** do container, na máquina host, e encaminha para a porta publicada `3333`:

```text
n8n remoto → URL HTTPS do túnel → cloudflared no host → localhost:3333 → container
```

Para criar esse túnel:

```powershell
cloudflared tunnel --protocol http2 --url http://127.0.0.1:3333
```

Também é possível executar o `cloudflared` como um serviço separado no Docker Compose, apontando para `http://personal-ai-gateway:3333`. Isso exige configurar o túnel como serviço independente; não é incluído no quick tunnel padrão porque a URL temporária muda e não oferece uma configuração adequada para produção.

## Executar

Modo desenvolvimento, com API e dashboard:

```bash
npm run dev
```

URLs locais:

- Dashboard: <http://127.0.0.1:5173>
- API: <http://127.0.0.1:3333>
- Health check: <http://127.0.0.1:3333/health>

Versão compilada:

```bash
npm run build
npm start
```

## Conectar a conta OpenAI por OAuth

1. Defina `PROVIDER=authorized`.
2. Defina uma `OAUTH_STORAGE_KEY` forte.
3. Execute `npm run dev`.
4. Abra <http://127.0.0.1:5173>.
5. Clique em **Conectar à OpenAI**.
6. Conclua o consentimento.

O callback redireciona para `DASHBOARD_URL`. A sessão é gravada criptografada em `data/oauth-session.enc`.

O logout remove a sessão local e bloqueia o dashboard até uma nova conexão. O OAuth não fornece uma API key da OpenAI nem acesso a conversas do ChatGPT; ele autoriza somente a inferência disponível para a conta/plano.

## Criar API keys

No dashboard autenticado:

1. informe um nome em **Key name**;
2. informe o `ADMIN_TOKEN`;
3. clique em **Create new API key**;
4. guarde a chave exibida.

É possível criar várias chaves. Cada uma aparece em **Saved keys** e pode ser selecionada, copiada ou revogada. A chave completa só é exibida no momento da criação; o banco armazena apenas seu hash.

Também é possível criar uma chave pela API:

```powershell
$headers = @{
  Authorization = 'Bearer troque-o-admin-token'
  'Content-Type' = 'application/json'
}

Invoke-RestMethod `
  http://127.0.0.1:3333/admin/keys `
  -Method Post `
  -Headers $headers `
  -Body '{"name":"n8n-production"}'
```

Guarde o campo `key` retornado. Ele não será mostrado novamente pelo servidor.

## Usar a API

As rotas `/v1/*` exigem:

```http
Authorization: Bearer pai_sua_chave
```

### Listar modelos

```powershell
curl.exe http://127.0.0.1:3333/v1/models `
  -H "Authorization: Bearer pai_sua_chave"
```

### Chat Completions

```powershell
$headers = @{
  Authorization = 'Bearer pai_sua_chave'
  'Content-Type' = 'application/json'
}

$body = @{
  model = 'gpt-5-mini'
  messages = @(
    @{ role = 'user'; content = 'Explique esta arquitetura em uma frase.' }
  )
} | ConvertTo-Json -Depth 5

Invoke-RestMethod `
  http://127.0.0.1:3333/v1/chat/completions `
  -Method Post `
  -Headers $headers `
  -Body $body
```

O endpoint suporta `stream: true` para respostas SSE.

### Responses API

```powershell
$body = @{
  model = 'gpt-5-mini'
  input = 'Explique esta arquitetura em uma frase.'
} | ConvertTo-Json

Invoke-RestMethod `
  http://127.0.0.1:3333/v1/responses `
  -Method Post `
  -Headers $headers `
  -Body $body
```

O gateway aceita `input` textual e mensagens com conteúdo textual. Para integrações com incompatibilidade no Responses API, use `/v1/chat/completions`.

## Usar com n8n remoto

Um n8n remoto não consegue acessar `127.0.0.1` do seu computador. Exponha somente a API por um túnel.

Com Cloudflare Tunnel:

```powershell
cloudflared tunnel --protocol http2 --url http://127.0.0.1:3333
```

O comando exibirá uma URL como:

```text
https://exemplo.trycloudflare.com
```

Na credencial **OpenAI** do n8n:

- **API Key:** sua chave `pai_...`;
- **Organization ID:** deixe vazio;
- **Base URL:** `https://exemplo.trycloudflare.com/v1`;
- **Allowed HTTP Request Domains:** permita o domínio do túnel.

No nó **OpenAI Chat Model**:

1. selecione a credencial;
2. escolha um modelo disponível em `/v1/models`;
3. conecte o nó à entrada **Chat Model** do **AI Agent**;
4. se houver erro no Responses API, desligue **Use Responses API** para usar `/v1/chat/completions`.

O quick tunnel é temporário: a URL muda quando o processo é encerrado. Para uso contínuo, prefira túnel nomeado, domínio próprio e autenticação adicional.

### Exemplo de fluxo n8n

```text
Webhook → Edit Fields → AI Agent
                          ↑
                   OpenAI Chat Model
```

Payload do Webhook:

```json
{
  "message": "Explique esta arquitetura."
}
```

No AI Agent, use `{{$json.message}}` como mensagem do usuário.

## Endpoints

| Método | Rota | Autenticação | Descrição |
|---|---|---|---|
| `GET` | `/health` | nenhuma | Estado e provider ativo |
| `GET` | `/auth/chatgpt/status` | nenhuma | Estado da sessão OAuth |
| `GET` | `/auth/chatgpt/start` | navegador | Inicia OAuth |
| `GET` | `/auth/chatgpt/callback` | OAuth | Callback e redirecionamento |
| `POST` | `/auth/chatgpt/disconnect` | nenhuma | Remove sessão OAuth local |
| `GET` | `/v1/models` | API key | Lista modelos |
| `POST` | `/v1/chat/completions` | API key | Chat compatível com OpenAI |
| `POST` | `/v1/responses` | API key | Responses API compatível |
| `GET` | `/v1/usage` | `ADMIN_TOKEN` | Resumo de uso |
| `POST` | `/admin/keys` | `ADMIN_TOKEN` | Cria API key |
| `GET` | `/admin/keys` | `ADMIN_TOKEN` | Lista metadados das chaves |
| `DELETE` | `/admin/keys/:id` | `ADMIN_TOKEN` | Revoga uma chave |

## Testes e validação

```bash
npm run typecheck
npm run test
npm run build
```

## Estrutura principal

```text
src/server.ts       API Fastify e rotas
src/oauth.ts        Fluxo OAuth e sessão criptografada
src/providers.ts    Provider mock e provider autorizado
src/db.ts           SQLite, API keys e auditoria
src/security.ts     Geração e hash de API keys
web/src/main.tsx    Dashboard React
web/src/style.css   Estilos do dashboard
data/               Banco e sessão local
```

## Segurança e limitações

- o bind padrão é local (`127.0.0.1`);
- o túnel torna a API acessível pela internet;
- não compartilhe `ADMIN_TOKEN`, `OAUTH_STORAGE_KEY` ou API keys;
- as API keys completas ficam no `localStorage` do dashboard quando salvas pelo navegador;
- o endpoint administrativo não deve ser exposto publicamente sem controles adicionais;
- o quick tunnel não tem garantia de disponibilidade e sua URL muda;
- a implementação é voltada para uso pessoal e desenvolvimento, não para produção sem hardening.
