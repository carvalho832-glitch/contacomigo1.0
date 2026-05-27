# ContaComigo Clara IA API

Backend em Node + Express para conectar a Clara do app ContaComigo à Gemini API.

## Arquivos

- `server.js`
- `package.json`
- `.env.example`

## Variáveis no Render

Cadastre em **Environment**:

```txt
GEMINI_API_KEY=sua_chave_do_google_ai_studio
GEMINI_MODEL=gemini-2.5-flash
ALLOWED_ORIGINS=https://carvalho832-glitch.github.io
```

## Configuração no Render

- Service type: **Web Service**
- Build Command: `npm install`
- Start Command: `npm start`

Depois do deploy, teste:

```txt
https://SEU-SERVICO.onrender.com/health
```

Se aparecer `ok: true`, o backend está vivo.
