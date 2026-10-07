# Encurtador

Encurtador de URLs com API autenticada, redirecionamento público e auditoria de acessos. O mesmo Cloudflare Worker serve a apresentação gerada pelo Next.js e executa a API em TypeScript.

Apresentação: [encurtador.marcosmeireles359.workers.dev](https://encurtador.marcosmeireles359.workers.dev).

## Stack e arquitetura

| Camada | Tecnologia | Responsabilidade |
| --- | --- | --- |
| Apresentação | Next.js App Router, React, TypeScript | Geração estática da página pública |
| Estilos | Tailwind CSS 4, shadcn/ui e Radix | Tokens e componentes locais acessíveis |
| HTTP | Cloudflare Workers | Rotas, autenticação, redirecionamento e assets |
| Criação pública | Rate Limiting binding | 5 solicitações por minuto por IP em cada localidade |
| Links | Cloudflare KV | Destino, data de criação e contador legado |
| Acessos | Durable Objects SQLite | Um objeto por código; contador e eventos transacionais |
| Retenção | Alarmes de Durable Objects | Exclusão de eventos vencidos em lotes |

O frontend é exportado para `web/out`. Não há servidor Next.js, SSR, Server Actions nem backend adicional. Assets versionados de `/_next/` são servidos diretamente pela infraestrutura de assets; as rotas de API e links continuam passando pelo Worker. A raiz serve HTML, inclusive via HEAD. Com `Accept: application/json`, `GET /` retorna o catálogo de endpoints.

No redirecionamento, o Worker busca o destino no KV, extrai os metadados permitidos e agenda a persistência com `ctx.waitUntil`. O Durable Object incrementa o contador e insere o evento na mesma transação SQLite. O cliente recebe um `302` com `Cache-Control: no-store`.

## Estrutura

```text
src/
  index.ts           Rotas HTTP e integração com assets
  auth.ts            API Key, JSON e respostas de erro
  urls.ts            Criação, consulta, exclusão e redirecionamento
  audit.ts           Extração de metadados, filtros e retenção
  click-counter.ts   Contador, SQLite, paginação e alarmes
  types.ts           Bindings e contratos compartilhados
  log.ts             Logs estruturados
web/
  app/               Layout e página Next.js
  components/ui/     Variantes de componentes shadcn/ui
  lib/               Utilitário de classes dos componentes
  public/            Assets públicos
tests/audit.mjs      Integração com Worker, assets e SQLite reais locais
wrangler.toml        Bindings, assets, migrações e observabilidade
```

## Instalação e desenvolvimento

Requer Node.js 22 ou superior, npm com suporte a workspaces e, para publicar, conta Cloudflare com Workers, KV e Durable Objects SQLite disponíveis.

```sh
npm ci
npm run dev
```

`dev` gera os assets e inicia o Wrangler local. Crie `.dev.vars` na raiz com `API_KEY=uma-chave-local`; esse arquivo não deve ser versionado. Para editar apenas a apresentação com atualização automática, use `npm run dev:web` e abra o endereço informado pelo Next.js. O servidor Next de desenvolvimento não executa a API do Worker.

O frontend usa o compilador Webpack do Next.js. O Turbopack apresentou falha na inicialização do subprocesso de CSS no ambiente Windows utilizado para validar este projeto.

No Windows, encerre o Wrangler local antes de executar outro build ou publicar: a observação dos assets pode manter `web/out` aberto e impedir a substituição da exportação.

## Configuração

| Nome | Tipo | Uso |
| --- | --- | --- |
| `API_KEY` | Secret | Obrigatório para gestão e consulta de auditoria |
| `PUBLIC_BASE_URL` | Variável | Origem usada para montar `short_url`; vazio usa a origem da requisição |
| `AUDIT_RETENTION_MONTHS` | Variável | Meses de retenção para novos eventos; padrão 12, intervalo 1–120 |
| `URLS` | KV binding | Namespace dos links; configure o ID da sua conta |
| `CLICK_COUNTER` | Durable Object binding | Classe `ClickCounter`, com backend SQLite |
| `ASSETS` | Assets binding | Exportação Next.js em `web/out` |
| `PUBLIC_RATE_LIMIT` | Rate Limit binding | Limite da criação pública; namespace definido em `wrangler.toml` |

Use uma origem HTTP(S) confiável para `PUBLIC_BASE_URL`. Preserve o nome da classe e a migração `v1` ao atualizar uma instalação existente. O binding `API_KEY` é um secret do Worker e nunca deve ser incluído em variáveis `NEXT_PUBLIC_*`, no HTML ou em chamadas públicas do frontend.

## API

| Método | Rota | Acesso | Resposta principal |
| --- | --- | --- | --- |
| GET / HEAD | `/` | Público | Página de apresentação |
| POST | `/shorten` | API Key | `201`, link criado |
| POST | `/public/shorten` | Público, mesma origem | `201`, link criado com código automático |
| GET | `/{code}` | Público | `302`, redirecionamento |
| GET | `/urls` | API Key | `count`, `items` com links e contagens |
| GET | `/urls/{code}` | API Key | Detalhes e contador acumulado |
| GET | `/urls/{code}/clicks` | API Key | `items`, `next_cursor` |
| DELETE | `/urls/{code}` | API Key | Remove link, auditoria e contador |
| GET | `/health` | Público | `200`, `{"status":"ok"}` |

Envie `X-API-Key` nas operações protegidas. Sem chave válida, a resposta é `401`; sem secret configurado, `500`. Erros JSON seguem o formato `{"error":"mensagem"}`. As respostas da API usam `Cache-Control: no-store`. O CORS permite todas as origens; isso não substitui a autenticação.

### Criar um link

Exemplo com credencial fictícia:

```http
POST /shorten
Content-Type: application/json
X-API-Key: <sua-chave>

{"url":"https://exemplo.com.br/conteudo","code":"minha-ideia"}
```

```json
{
  "code": "minha-ideia",
  "short_url": "https://encurtador.marcosmeireles359.workers.dev/minha-ideia",
  "url": "https://exemplo.com.br/conteudo",
  "created_at": "2026-10-07T12:00:00-03:00",
  "clicks": 0
}
```

`url` deve usar HTTP(S), não conter usuário/senha e ter até 2.048 caracteres. O corpo JSON é limitado a 16 KiB, inclusive sem `Content-Length`. `code` é opcional na criação autenticada; quando informado, aceita 3–32 caracteres de `[a-zA-Z0-9_-]`, exceto nomes reservados (`urls`, `shorten`, `health`). Sem código, são gerados sete caracteres alfanuméricos. Um código já existente retorna `409`. O destino é redirecionado como informado, incluindo parâmetros e fragmento; a cópia na auditoria é sanitizada.

### Formulário público

A página envia apenas `{"url":"https://exemplo.com"}` a `POST /public/shorten`, sem API Key. O endpoint exige `Content-Type: application/json` e `Origin` igual à origem da requisição; não libera CORS. Esses controles restringem chamadas de outras páginas, mas não autenticam clientes externos, que podem declarar um `Origin` arbitrário.

O IP usado no limite vem de cabeçalhos gerenciados pela Cloudflare. O binding permite 5 solicitações por 60 segundos e retorna `429` com `Retry-After: 60` ao exceder. A limitação é local à infraestrutura Cloudflare e tem consistência eventual; não é uma cota global exata nem proteção completa contra abuso distribuído. Requisições inválidas que chegam à validação de corpo também consomem essa cota. Sem IP verificável, a criação pública falha com `503`.

O formulário tem validação, prevenção de envios duplicados, timeout de 15 segundos e estados acessíveis de carregamento/erro/sucesso. A cópia usa a Clipboard API; se a permissão for recusada, o resultado permanece selecionável para cópia manual. Uma resposta perdida pode ocorrer depois de o link já ter sido criado; tentar novamente pode gerar outro código.

## Auditoria

Cada GET de um link válido gera um evento. Robôs, prévias e verificadores também podem gerar eventos. O registro não comprova identidade nem chegada ao destino.

`GET /urls/{code}/clicks` exige o cabeçalho `X-API-Key`.

Parâmetros opcionais:

| Parâmetro | Uso |
| --- | --- |
| `limit` | De 1 a 100; padrão 50 |
| `cursor` | Valor de `next_cursor` da página anterior |
| `from` | Horário UTC inclusivo, por exemplo `2026-10-01T00:00:00Z` |
| `until` | Horário UTC inclusivo; padrão é o instante da consulta |

Datas aceitam segundos com ou sem três casas de milissegundos. Mantenha os mesmos filtros durante a paginação. A resposta contém `items`, do mais recente ao mais antigo na ordem de gravação, e `next_cursor`, que é `null` ao final.

Cada item contém:

- `id`, `event_id`, `created_at`, `expires_at` e `code`.
- `destination`: destino naquele acesso, sem credenciais, parâmetros ou fragmento.
- `ip`: IP público informado pela Cloudflare.
- `referrer`: somente a origem (protocolo, domínio e porta) da página anterior.
- `user_agent`, `browser`, `os` e `device`: dados declarados pelo cliente e inferências aproximadas.
- `headers`: lista explícita de cabeçalhos de idioma, formatos aceitos, Client Hints, contexto da navegação, preferência de privacidade, pré-carregamento e identificação da requisição Cloudflare.
- `campaign`: apenas `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content` e `utm_id`.
- `cloudflare`: localização aproximada, rede/ASN, protocolo, TLS, datacenter, latência e sinais de bots disponíveis.

Campos indisponíveis retornam `null`. Não há coleta por JavaScript, GPS ou cookies de identificação. Cabeçalhos e campanhas são dados não confiáveis; limites de tamanho evitam eventos excessivos. Não coloque segredos ou dados pessoais em caminhos de URLs ou campos UTM. Cookies, autorização, API Keys, parâmetros arbitrários, certificados de cliente e o valor aleatório da negociação TLS não são armazenados.

## Retenção e funcionamento

`AUDIT_RETENTION_MONTHS` em `wrangler.toml` define o prazo para novos eventos: padrão 12 meses corridos, configurável entre 1 e 120. Datas no fim do mês são ajustadas ao último dia do mês de vencimento. Alterações não modificam o vencimento dos eventos já gravados.

Eventos vencidos deixam de aparecer imediatamente nas consultas. Alarmes removem fisicamente os eventos em lotes de até 1.000, sem depender de novos cliques. A execução dos alarmes está sujeita à disponibilidade e aos atrasos/retries da plataforma. A contagem acumulada continua existindo após a expiração. Excluir o link também exclui seus eventos e contador; a auditoria não é um arquivo imutável.

Gravação do evento e incremento do contador ocorrem na mesma transação. A persistência roda em segundo plano com `waitUntil`, mantendo o redirecionamento rápido. Uma falha de armazenamento gera `click.increment_failed` nos logs e não impede o redirecionamento; nesse caso, o acesso pode ficar sem evento e sem incremento. Monitore esse erro e os limites/custos dos Durable Objects. Esta implementação não promete captura sem perdas.

A retenção descrita aplica-se aos eventos ativos deste aplicativo. Logs e mecanismos de recuperação/backups da Cloudflare têm políticas próprias. Os logs de invocação estão configurados para ocultar a query string.

## Validação e publicação

Com as dependências instaladas e Node.js 22 ou superior:

```sh
npm test
npm run typecheck
npm run build
npm exec wrangler deploy -- --dry-run
```

Os testes usam Miniflare e esbuild já fornecidos pelo Wrangler, sem novos pacotes. Verificam o Worker e o SQLite no runtime local. Metadados reais e recursos do plano devem ser conferidos após a publicação na Cloudflare; o ambiente local usa metadados controlados.

Para uma instalação nova, configure os bindings da sua conta, autentique o Wrangler e cadastre o secret:

```sh
npm exec wrangler login
npm exec wrangler secret put API_KEY
npm run deploy
```

`deploy` primeiro gera o frontend e então publica Worker e assets juntos. Em uma instalação existente, mantenha os bindings e secrets já configurados. A coleta começa com novos acessos após a publicação; não há metadados retroativos dos cliques antigos. Contagens legadas são preservadas.

## Segurança e limites operacionais

- Cabeçalhos e parâmetros são dados não confiáveis. A extração usa uma lista explícita de campos e limites de tamanho; as consultas SQL usam parâmetros vinculados.
- A apresentação é estática e não solicita nem armazena credenciais. O HTML inclui proteções contra framing e interpretação incorreta de conteúdo.
- Há limite de frequência na criação pública; as operações autenticadas não têm limite próprio. Não há segregação por usuário ou permissões por link: uma API Key válida acessa toda a gestão. Aplique controles adicionais de tráfego da Cloudflare conforme a exposição e o volume.
- KV tem consistência eventual. A verificação seguida de gravação de um código não é uma reserva atômica; criações simultâneas do mesmo código exigem coordenação adicional se isso for um requisito.
- `GET /urls` percorre todos os links e não oferece paginação. Prefira consulta por código em bases grandes. A consulta de auditoria é paginada e limitada a 100 eventos por resposta.
- Falhas na persistência podem causar perda do evento e do incremento. Monitore `click.increment_failed`, limites de armazenamento, custos e disponibilidade da plataforma.
- Não há garantia de identidade, unicidade de visitantes, precisão geográfica ou chegada ao destino. A inferência de navegador/dispositivo é aproximada.

Arquivos de código, testes, configuração, documentação e `package-lock.json` devem permanecer no Git. Builds (`web/out`, `.next`), caches, logs, arquivos locais de IDE e credenciais são ignorados. `next-env.d.ts` é gerado pelo Next.js; não edite nem versione esse arquivo.
