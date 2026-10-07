"use client";

import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";

export function ShortenForm() {
  const [url, setUrl] = useState("");
  const [shortUrl, setShortUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const pending = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    setError("");
    setShortUrl("");
    setCopied(false);
    setCopyError("");
    let parsed: URL;
    try {
      parsed = new URL(url.trim());
      if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error();
    } catch {
      setError("Informe um link válido, começando com https:// ou http://, sem usuário ou senha.");
      return;
    }
    pending.current = true;
    setLoading(true);
    try {
      const response = await fetch("/public/shorten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: parsed.toString() }),
        signal: AbortSignal.timeout(15000),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(typeof data.error === "string" ? data.error : "Não foi possível encurtar. Tente novamente.");
        return;
      }
      const result = new URL(data.short_url);
      if (!["https:", "http:"].includes(result.protocol) || result.username || result.password) throw new Error();
      setShortUrl(result.toString());
    } catch {
      setError("Não foi possível concluir a solicitação. Confira sua conexão e tente novamente.");
    } finally {
      pending.current = false;
      setLoading(false);
    }
  }

  async function copy() {
    setCopied(false);
    setCopyError("");
    try {
      await navigator.clipboard.writeText(shortUrl);
      setCopied(true);
    } catch {
      setCopyError("Selecione o link e copie manualmente.");
    }
  }

  return (
    <div id="encurtar" className="scroll-mt-8 overflow-hidden rounded-2xl border border-border bg-white">
      <div className="border-b border-border px-6 py-5"><h2 className="text-base font-medium">Seu próximo link começa aqui.</h2></div>
      <form onSubmit={submit} className="p-6 sm:p-8" aria-busy={loading}>
        <label htmlFor="url" className="text-sm font-medium">Link para encurtar</label>
        <input id="url" type="url" inputMode="url" autoComplete="url" required maxLength={2048} placeholder="https://seusite.com.br/seu-conteudo" value={url} disabled={loading} aria-invalid={Boolean(error)} aria-describedby={error ? "url-error" : "url-help"} onChange={event => { setUrl(event.target.value); setShortUrl(""); setError(""); setCopied(false); setCopyError(""); }} className="mt-3 block min-h-12 w-full min-w-0 rounded-lg border border-border bg-background px-4 text-base placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60" />
        <p id="url-help" className="mt-3 text-sm leading-6 text-muted-foreground">Cole um endereço completo. Nós cuidamos do tamanho.</p>
        <Button type="submit" disabled={loading} className="mt-6 w-full">{loading ? "Encurtando…" : "Encurtar link"}<span aria-hidden="true">{loading ? "" : "↗"}</span></Button>
        {error && <p id="url-error" role="alert" className="mt-4 text-sm leading-6 text-[#a12929]">{error}</p>}
        <div aria-live="polite" aria-atomic="true">
          {shortUrl && <div className="mt-6 border-t border-border pt-6">
            <p className="text-sm font-medium text-primary">Seu link está pronto para compartilhar.</p>
            <label htmlFor="short-url" className="sr-only">Link encurtado</label>
            <input id="short-url" value={shortUrl} readOnly onFocus={event => event.currentTarget.select()} className="mt-3 block min-h-12 w-full rounded-lg border border-border bg-muted px-3 font-mono text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" />
            <div className="mt-4 flex flex-wrap items-center gap-4"><Button type="button" variant="outline" onClick={copy}>{copied ? "Link copiado" : "Copiar link"}</Button><a href={shortUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center text-sm text-primary underline underline-offset-4">Abrir link <span aria-hidden="true" className="ml-2">↗</span></a></div>
            {copied && <p className="mt-3 text-sm text-primary">Copiado. Agora é só compartilhar.</p>}
            {copyError && <p className="mt-3 text-sm leading-6 text-muted-foreground">{copyError}</p>}
          </div>}
        </div>
      </form>
    </div>
  );
}
