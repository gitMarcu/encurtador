import { Button } from "@/components/ui/button";
import { ShortenForm } from "@/components/shorten-form";

const features = [
  ["Links que cabem em qualquer conversa.", "Transforme um endereço longo em um link curto, pronto para enviar em mensagens, publicar nas redes ou incluir em seus conteúdos.", "Cole, encurte e compartilhe"],
  ["Cada acesso, com mais contexto.", "O serviço registra contagem de acessos e informações disponíveis sobre origem, navegador, dispositivo e localização aproximada.", "Contagem e auditoria de acessos"],
  ["Controle ao longo de todo o caminho.", "A gestão protegida permite consultar os links, acompanhar registros e remover endereços que não precisam mais ser usados.", "Gestão com acesso restrito"],
];

export default function Home() {
  return (
    <>
      <a href="#conteudo" className="sr-only fixed left-4 top-4 z-10 rounded-lg bg-primary px-5 py-3 text-white focus:not-sr-only">Ir para o conteúdo</a>
      <div className="mx-auto max-w-6xl px-6 sm:px-10">
        <header className="flex min-h-24 items-center justify-between gap-4 border-b border-border">
          <a href="/" aria-label="Encurtador, início" className="flex items-center gap-3 text-base font-medium">
            <svg aria-hidden="true" width="32" height="32" viewBox="0 0 40 40"><rect width="40" height="40" rx="12" fill="currentColor"/><path d="M17 25h-3a7 7 0 0 1 0-14h7m-2 18h7a7 7 0 0 0 0-14h-3m-8 5h10" fill="none" stroke="var(--background)" strokeWidth="3" strokeLinecap="round"/></svg>
            Encurtador
          </a>
          <nav aria-label="Navegação principal" className="flex items-center gap-6 text-sm">
            <a href="#funcionalidades" className="hidden min-h-12 items-center hover:underline sm:inline-flex">Funcionalidades</a>
            <a href="#encurtar" className="inline-flex min-h-12 items-center gap-2 hover:underline">Encurtar um link <span aria-hidden="true">↗</span></a>
          </nav>
        </header>
        <main id="conteudo">
          <section className="grid items-center gap-12 py-16 lg:grid-cols-[1.15fr_1fr] lg:gap-16 lg:py-24" aria-labelledby="titulo">
            <div>
              <p className="mb-6 text-sm text-muted-foreground">Um caminho mais simples até o seu conteúdo.</p>
              <h1 id="titulo" className="max-w-2xl text-[clamp(2.75rem,6vw,4.5rem)] leading-[1.06] font-normal tracking-[-0.055em]">Links curtos.<br/><span className="text-primary">Prontos para compartilhar.</span></h1>
              <p className="mt-6 max-w-md text-base leading-7 text-muted-foreground">Cole seu endereço, receba um link curto e leve seu conteúdo a qualquer conversa. Simples de criar, fácil de compartilhar.</p>
              <Button asChild className="mt-8"><a href="#encurtar">Encurte agora <span aria-hidden="true">↗</span></a></Button>
            </div>
            <ShortenForm />
          </section>
          <section id="funcionalidades" className="border-t border-border py-16" aria-labelledby="recursos-titulo">
            <h2 id="recursos-titulo" className="mb-10 text-base font-medium">Pequeno no tamanho. Completo no caminho.</h2>
            <div className="grid gap-10 md:grid-cols-3 md:gap-8">{features.map(([title, text, detail]) => <article key={title}><h3 className="max-w-xs text-base font-medium leading-7">{title}</h3><p className="mt-4 text-base leading-7 text-muted-foreground">{text}</p><p className="mt-5 text-sm leading-6 text-primary">{detail}</p></article>)}</div>
          </section>
          <section className="rounded-2xl bg-primary p-8 text-primary-foreground sm:p-12" aria-labelledby="auditoria-titulo">
            <div className="grid gap-8 md:grid-cols-2 md:gap-16">
              <div><h2 id="auditoria-titulo" className="text-base font-medium">Uma memória para os seus acessos.</h2><p className="mt-4 text-base leading-7 text-[#d1e0d4]">Ao acessar um link curto, o serviço registra dados como IP, origem e navegador para auditoria. A retenção padrão é de 12 meses, com consulta restrita à gestão do serviço.</p></div>
              <div className="self-center border-t border-white/25 pt-6 md:border-t-0 md:border-l md:pt-0 md:pl-8"><p className="text-sm leading-7 text-[#d1e0d4]">Os dados variam conforme o navegador e a conexão. A localização é aproximada. Robôs e prévias também podem gerar acessos; os registros não comprovam a identidade de uma pessoa.</p></div>
            </div>
          </section>
        </main>
        <footer className="mt-16 flex flex-wrap items-center justify-between gap-4 border-t border-border py-8 text-sm text-muted-foreground"><p>Encurtador · links com contexto</p><p>Feito para compartilhar.</p></footer>
      </div>
    </>
  );
}
