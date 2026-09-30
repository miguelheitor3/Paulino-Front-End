# Worker para o bucket de mídias R2

Este Worker é a porta de upload e exclusão do bucket `imoveis`. O bucket continua público somente para leitura pelo domínio `midia.paulinoimobiliaria.com.br`; gravação e exclusão exigem sessão Supabase e um dos e-mails autorizados.

## Preparar e publicar

1. Instale Node.js se ainda não estiver instalado.
2. Abra o PowerShell nesta pasta `cloudflare/r2-worker`.
3. Execute `npx wrangler login` e autorize o acesso à sua conta Cloudflare.
4. No painel R2, confirme que o bucket se chama exatamente `imoveis`.
5. Execute `npx wrangler secret put SUPABASE_ANON_KEY` e cole a chave pública `anon` atual do projeto Supabase.
6. Execute `npx wrangler secret put ADMIN_EMAILS` e informe o e-mail usado para entrar no painel. Para mais de um administrador, separe os e-mails por vírgula.
7. Execute `npx wrangler deploy`.
8. Copie a URL `workers.dev` mostrada pelo Wrangler para `R2_WORKER_URL` em `assets/config.js`.

Nunca configure `service_role` no Worker ou no site. O Worker usa a chave `anon` apenas para validar a sessão no Auth do Supabase.

## Ativação da migração

`R2_STORAGE_ENABLED` permanece `false` por segurança: enquanto isso, o projeto continua lendo, enviando e apagando no Supabase. Primeiro copie os objetos existentes do bucket Supabase `fotos-imoveis` para o bucket R2 `imoveis`, mantendo os caminhos. Confira fotos e vídeos no domínio público. Só então altere `R2_STORAGE_ENABLED` para `true` e publique o site.

Não apague o bucket antigo até confirmar que todos os imóveis carregam as mídias pelo R2 e que cadastro, edição e exclusão estão funcionando.
