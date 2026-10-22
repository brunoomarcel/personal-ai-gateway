# Personal OAuth AI Gateway

Prova de conceito local para estudar uma API compatível com formatos OpenAI, API Keys próprias e adaptadores de inferência. O repositório original estava vazio; não havia SDK OAuth existente para reutilizar.

## Executar

```bash
npm install
Copy-Item .env.example .env
npm run dev
```

O gateway escuta em `127.0.0.1:3333`. A UI Vite fica em `http://localhost:5173`.

## Conectar sua conta ChatGPT por OAuth

O fluxo real usa o caminho oficial **Sign in with ChatGPT** para apps open-source. No `.env`, defina:

```env
PROVIDER=authorized
OAUTH_STORAGE_KEY=uma-chave-local-longa-e-secreta
```

Reinicie `npm run dev` e abra `http://127.0.0.1:3333/auth/chatgpt/start`. O navegador pedirá login e consentimento. O callback local valida `state`, PKCE, nonce, assinatura do ID token e o escopo `chatgpt.tokens.use.direct`; os tokens são armazenados criptografados em `data/oauth-session.enc`. Depois, `/v1/models` e `/v1/responses` usam o access token OAuth na API pública `https://api.openai.com/v1`.

Esse consentimento não libera conversas do ChatGPT nem sua API key; ele autoriza somente inferência elegível da Responses API para a conta/plano, conforme disponibilidade da OpenAI. A primeira autorização pode exigir elegibilidade/rollout do recurso.

Crie uma chave administrativa e de cliente:

```powershell
$h=@{Authorization='Bearer change-me-in-development';'Content-Type'='application/json'}
Invoke-RestMethod http://localhost:3333/admin/keys -Method Post -Headers $h -Body '{"name":"local-dev"}'
```

Use o valor `key` retornado uma única vez:

```powershell
$h=@{Authorization='Bearer pai_COLE_A_CHAVE';'Content-Type'='application/json'}
Invoke-RestMethod http://localhost:3333/v1/chat/completions -Method Post -Headers $h -Body '{"model":"mock-gpt-4o-mini","messages":[{"role":"user","content":"Olá"}]}'
```

## Arquitetura e limites

```mermaid
flowchart LR
 C[Cliente / n8n / Python] -->|pai_ Bearer| G[Fastify Gateway]
 G --> K[(SQLite: hashes, auditoria)]
 G --> A[InferenceProvider]
 A --> M[MockOAuthProvider]
 A -. somente SDK oficial injetado .-> O[AuthorizedOAuthProvider]
 D[Dashboard admin] -->|ADMIN_TOKEN separado| G
```

O mock foi verificado localmente. A integração OAuth real permanece conceitual: não havia SDK nem sessão no projeto, e o adaptador autorizado recusa execução sem uma implementação oficial injetada. Não há scraping, cookies, endpoints internos ou encaminhamento de tokens.

## Endpoints

`POST /v1/chat/completions` suporta mensagens, modelo e SSE (`stream:true`). `POST /v1/responses` aceita `input` textual ou mensagens e retorna um envelope `response`; ferramentas, multimodalidade, background mode e IDs de conversa ainda não são suportados. `GET /v1/models` exige API key. Rotas `/admin/*` e `/v1/usage` exigem `ADMIN_TOKEN`.

Chaves são aleatórias, armazenadas somente como SHA-256, exibidas uma vez, revogáveis e auditadas. O servidor tem limite de corpo, rate limit, timeout implícito do Fastify, bind local padrão e logs sem segredos. Para produção, adicionar scrypt/pepper, quotas atômicas, CSRF no dashboard, TLS/reverse proxy, testes de carga e autenticação de sessão administrativa.

## Exemplos

Python: `requests.post('http://localhost:3333/v1/chat/completions', headers={'Authorization':'Bearer pai_...'}, json={'model':'mock-gpt-4o-mini','messages':[{'role':'user','content':'Oi'}]})`.

n8n usa um nó HTTP Request com o mesmo URL, header Bearer e JSON. Evolution API deve chamar um backend próprio, que valida o webhook e então chama este gateway; nunca exponha a `pai_` key no frontend. Um frontend React deve seguir a mesma regra: backend autenticado, não chave no navegador.
