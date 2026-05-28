# ContaComigo

App PWA financeiro para ajudar pessoas a sair do sufoco financeiro.

## Arquivos principais

- `index.html`
- `style.css`
- `script.js`
- `manifest.json`
- `sw.js`
- `assets/`

## Como publicar no GitHub Pages

1. Envie todos os arquivos deste ZIP para o repositório.
2. Vá em **Settings > Pages**.
3. Em **Build and deployment**, selecione:
   - Source: **Deploy from a branch**
   - Branch: **main**
   - Folder: **/root**
4. Clique em **Save**.
5. Aguarde o link do GitHub Pages ficar disponível.

## Observação

A Clara está em modo local nesta versão. A próxima fase será conectar backend no Render e IA.


## Clara IA

Esta versão aponta o chat da Clara para:

```txt
https://contacomigo1-0.onrender.com/api/clara
```

Arquivos principais atualizados:

- `index.html`
- `script.js`
- `sw.js`


## V5

Menu inferior removido e substituído por menu lateral retrátil.


## V6 - Faturas Inteligentes

- Valor total da fatura
- Valor pago
- Restante automático
- Status automático: Em aberto, Parcial ou Quitada
- Cálculo do mês considera apenas o restante
- Backend da Clara IA atualizado para entender pagamentos parciais
