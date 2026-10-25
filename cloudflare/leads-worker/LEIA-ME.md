# API de clientes e interessados

Worker separado do serviço que atende às mídias no Cloudflare R2. Ele grava em D1 os interessados do formulário de financiamento e os contatos registrados manualmente pela equipe; imóveis e sessões continuam no Supabase.

## Configuração inicial

1. No PowerShell, entre nesta pasta: `cd "C:\Users\migue\OneDrive\Desktop\descriçãoPaulino\cloudflare\leads-worker"`.
2. Faça login no Cloudflare com `npx wrangler login`.
3. Crie a base: `npx wrangler d1 create paulino-financiamento-leads`.
4. Copie o `database_id` retornado para `wrangler.toml`, substituindo o UUID zerado de exemplo.
5. Aplique as migrações pendentes: `npx wrangler d1 migrations apply paulino-financiamento-leads --remote`. Se o banco já recebeu a migração `0001`, este comando aplica a nova `0002` e preserva os registros existentes como financiamento.
6. Publique o Worker pela primeira vez: `npx wrangler deploy`.
7. Cadastre os segredos do Worker (cada comando solicitará o valor e publicará uma nova versão):
   - `npx wrangler secret put SUPABASE_ANON_KEY`
   - `npx wrangler secret put ADMIN_EMAILS` (um ou mais e-mails, separados por vírgula)
   - `npx wrangler secret put RATE_LIMIT_SECRET` (use um valor aleatório longo)
8. Confirme a migração com `npx wrangler d1 migrations list paulino-financiamento-leads --remote` e confira a URL do Worker no painel Cloudflare.
9. Confirme que a URL publicada corresponde a `LEADS_WORKER_URL` em `assets/config.js`.

O formulário aceita até cinco envios por endereço de rede a cada dez minutos; o endereço é guardado apenas como hash HMAC temporário. Se o deploy mostrar uma URL `workers.dev` diferente, atualize `LEADS_WORKER_URL` no arquivo `assets/config.js` e publique o site.

`SUPABASE_ANON_KEY` é usada pelo Worker para validar a sessão no Supabase Auth. Nunca configure a chave `service_role` neste Worker ou no navegador.

## Rotas

- `POST /api/leads`: recebe um cadastro público validado.
- `POST /api/admin/leads`: cria um contato manual classificado como compra, aluguel ou financiamento; exige sessão de administrador e confirmação de autorização do cliente.
- `GET /api/admin/leads`: lista até 500 cadastros; exige sessão de administrador.
- `PATCH /api/admin/leads/:id`: atualiza situação e observações; exige sessão de administrador.
- `DELETE /api/admin/leads/:id`: exclui um cadastro mediante confirmação no painel; exige sessão de administrador.

As origens permitidas ficam em `ALLOWED_ORIGINS`. A configuração inclui o domínio público e endereços comuns de desenvolvimento local (`localhost` nas portas 5500 e 8000). Se o domínio público ou a porta local mudar, ajuste essa variável e publique novamente com `npx wrangler deploy`.
