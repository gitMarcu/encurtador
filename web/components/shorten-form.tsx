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
    <div id="encurtar" className="panel shorten">
      <form onSubmit={submit} className="shorten__form" aria-busy={loading}>
        <label htmlFor="url" className="field-label">Link para encurtar</label>
        <input id="url" type="url" inputMode="url" autoComplete="url" required maxLength={2048} placeholder="https://exemplo.com.br/pagina" value={url} disabled={loading} aria-invalid={Boolean(error)} aria-describedby={error ? "url-error" : "url-help"} onChange={event => { setUrl(event.target.value); setShortUrl(""); setError(""); setCopied(false); setCopyError(""); }} className="input" />
        {error
          ? <p id="url-error" role="alert" className="help help--error">{error}</p>
          : <p id="url-help" className="help">Começando com https:// ou http://.</p>}
        <Button type="submit" disabled={loading} className="btn--block">{loading ? "Encurtando…" : "Encurtar link"}</Button>
        {!shortUrl && <p className="shorten__format">O link sai como <span className="measured">cuturl.dev/</span> mais 7 caracteres, por exemplo <span className="measured">cuturl.dev/k3Fq9aZ</span>.</p>}
        <div aria-live="polite" aria-atomic="true">
          {shortUrl && <div className="result">
            <label htmlFor="short-url" className="field-label">Link encurtado</label>
            <input id="short-url" value={shortUrl} readOnly onFocus={event => event.currentTarget.select()} className="input input--measured" />
            <div className="result__actions"><Button type="button" variant="outline" onClick={copy}>{copied ? "Link copiado" : "Copiar link"}</Button><a href={shortUrl} target="_blank" rel="noopener noreferrer" className="link">Abrir link<span className="visually-hidden"> (abre em nova aba)</span></a></div>
            {copyError && <p className="help">{copyError}</p>}
          </div>}
        </div>
      </form>
    </div>
  );
}
