import { ShortenForm } from "@/components/shorten-form";

const longUrl = "https://loja.example.com.br/colecao/inverno-2026/camiseta-algodao-organico-manga-longa?cor=verde&tamanho=m&utm_source=newsletter&utm_campaign=inverno";
const shortUrl = "cuturl.dev/k3Fq9aZ";

// Campos de collectAudit (src/audit.ts), com valores de exemplo; o IP é do bloco de documentação 203.0.113.0/24
const record = [
  ["IP", "203.0.113.24"],
  ["Origem", "https://example.org"],
  ["Navegador", "Chrome"],
  ["Sistema", "Android"],
  ["Dispositivo", "mobile"],
  ["Local aproximado", "Campinas, BR"],
];

const calls = [
  ["Listar os links", "GET /urls"],
  ["Ver um link e seus acessos", "GET /urls/{código}"],
  ["Acompanhar os registros", "GET /urls/{código}/clicks"],
  ["Remover um endereço", "DELETE /urls/{código}"],
];

function Mark() {
  return <svg aria-hidden="true" viewBox="0 0 40 40"><rect width="40" height="40" rx="10" fill="currentColor"/><path d="M17 25h-3a7 7 0 0 1 0-14h7m-2 18h7a7 7 0 0 0 0-14h-3m-8 5h10" fill="none" stroke="var(--color-paper)" strokeWidth="3" strokeLinecap="round"/></svg>;
}

export default function Home() {
  return (
    <>
      <a href="#conteudo" className="skip">Ir para o conteúdo</a>
      <header className="nav">
        <div className="container nav__in">
          <a href="/" aria-label="cuturl.dev, início" className="wordmark"><Mark />cuturl.dev</a>
          <nav aria-label="Navegação principal">
            <a href="#funcionalidades" className="link link--nav">Exemplo de registro</a>
          </nav>
        </div>
      </header>
      <main id="conteudo">
        <section className="hero" aria-labelledby="titulo">
          <div className="container hero__in">
            <div className="hero__text">
              <h1 id="titulo">Links curtos que registram cada acesso</h1>
              <p className="lead">Cole um endereço completo e receba um link curto em cuturl.dev.</p>
            </div>
            <div className="hero__form"><ShortenForm /></div>
          </div>
        </section>

        <section id="funcionalidades" className="record" aria-labelledby="auditoria-titulo">
          <div className="container grid12 record__in">
            <div className="record__text">
              <h2 id="auditoria-titulo">O que cada acesso registra</h2>
              <p className="lead">Ao acessar um link curto, o serviço registra dados como IP, origem e navegador para auditoria.</p>
              <ul className="notes">
                <li>A retenção padrão é de 12 meses, com consulta restrita à gestão do serviço.</li>
                <li>Os dados variam conforme o navegador e a conexão.</li>
                <li>A localização é aproximada.</li>
                <li>Robôs e prévias também podem gerar acessos; os registros não comprovam a identidade de uma pessoa.</li>
              </ul>
            </div>
            <figure className="record__figure">
              <div className="panel trail">
                <div className="trail__head">
                  <p className="measured trail__title">{shortUrl}</p>
                  <time className="measured trail__time" dateTime="2026-11-06T14:32:07Z">2026-11-06 14:32:07 UTC</time>
                </div>
                <dl className="trail__list">
                  {record.map(([label, value]) => <div className="trail__row" key={label}><dt>{label}</dt><dd className="measured">{value}</dd></div>)}
                </dl>
              </div>
              <figcaption className="caption">Exemplo de registro com valores fictícios.</figcaption>
            </figure>
          </div>
        </section>

        <section className="compare" aria-labelledby="recursos-titulo">
          <div className="container">
            <div className="grid12 head">
              <h2 id="recursos-titulo">{longUrl.length} caracteres viram {shortUrl.length}</h2>
              <p className="lead">Pronto para enviar em mensagens, publicar nas redes ou incluir em seus conteúdos.</p>
            </div>
            <figure className="compare__figure">
              <div className="panel compare__panel">
                <div className="compare__row">
                  <span className="compare__label">Endereço original</span>
                  <p className="measured compare__long">{longUrl}</p>
                  <span className="measured compare__count">{longUrl.length} caracteres</span>
                </div>
                <div className="compare__row">
                  <span className="compare__label">Link curto</span>
                  <p className="compare__short">{shortUrl}</p>
                  <span className="measured compare__count">{shortUrl.length} caracteres</span>
                </div>
              </div>
              <figcaption className="caption">Exemplo com um endereço fictício.</figcaption>
            </figure>
          </div>
        </section>

        <section className="manage" aria-labelledby="gestao-titulo">
          <div className="container grid12 manage__in">
            <div className="manage__text">
              <h2 id="gestao-titulo">Quatro chamadas com a chave de API</h2>
              <p className="lead">A gestão protegida permite consultar os links, acompanhar registros e remover endereços que não precisam mais ser usados. Cada chamada exige a chave de API do serviço.</p>
            </div>
            <ul className="calls">
              {calls.map(([title, call]) => <li key={call}><h3>{title}</h3><code>{call}</code></li>)}
            </ul>
          </div>
        </section>
      </main>
      <footer className="foot">
        <div className="container foot__in">
          <div>
            <a href="/" aria-label="cuturl.dev, início" className="wordmark"><Mark />cuturl.dev</a>
            <p className="foot__line">Um encurtador de links que roda na Cloudflare.</p>
          </div>
          <a href="#encurtar" className="link">Encurtar um link</a>
        </div>
      </footer>
    </>
  );
}
