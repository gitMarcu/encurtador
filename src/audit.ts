export interface AuditQuery {
  limit: number;
  cursor: number;
  from: number;
  until: number;
}

export interface AuditMetadata {
  event_id: string;
  created_at: string;
  code: string;
  destination: string;
  ip: string | null;
  referrer: string | null;
  user_agent: string | null;
  browser: string | null;
  os: string | null;
  device: string | null;
  headers: Record<string, string | null>;
  campaign: Record<string, string | null>;
  cloudflare: Record<string, unknown>;
}

const HEADER_NAMES = [
  'accept', 'accept-language', 'accept-encoding', 'sec-ch-ua',
  'sec-ch-ua-mobile', 'sec-ch-ua-platform', 'sec-ch-ua-platform-version',
  'sec-ch-ua-full-version-list', 'sec-ch-ua-model', 'sec-ch-ua-arch',
  'sec-ch-ua-bitness', 'sec-ch-ua-wow64', 'sec-fetch-site', 'sec-fetch-mode',
  'sec-fetch-dest', 'sec-fetch-user', 'save-data', 'dnt', 'sec-gpc',
  'purpose', 'sec-purpose', 'cf-ray',
];
const CF_FIELDS = [
  'country', 'city', 'continent', 'region', 'regionCode', 'postalCode',
  'metroCode', 'latitude', 'longitude', 'timezone', 'isEUCountry',
  'asn', 'asOrganization', 'colo', 'httpProtocol', 'tlsVersion', 'tlsCipher',
  'tlsClientCiphersSha1', 'tlsClientExtensionsSha1', 'tlsClientExtensionsSha1Le',
  'tlsClientHelloLength', 'clientAcceptEncoding', 'clientTcpRtt', 'clientQuicRtt',
  'requestPriority',
];

function bounded(value: unknown, limit = 1024): string | number | boolean | null {
  if (typeof value === 'string') return value.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, limit);
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return null;
}

function fields(source: Record<string, unknown>, names: string[]): Record<string, unknown> {
  return Object.fromEntries(names.map(name => [name, bounded(source[name])]));
}

export function auditExpiresAt(timestamp: number, configured?: string): number {
  const months = Number(configured ?? 12);
  if (!Number.isInteger(months) || months < 1 || months > 120) {
    throw new Error('AUDIT_RETENTION_MONTHS deve estar entre 1 e 120');
  }
  const date = new Date(timestamp);
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(date.getUTCDate(), lastDay));
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.getTime();
}

export function collectAudit(request: Request, code: string, destination: string): AuditMetadata {
  const header = (name: string, limit = 1024) => bounded(request.headers.get(name), limit) as string | null;
  const ua = header('user-agent', 2048);
  const browser = ua ? /Edg(?:A|iOS)?\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\/|FxiOS\//.test(ua) ? 'Firefox' : /Chrome\/|CriOS\//.test(ua) ? 'Chrome' : /Version\/.*Safari\//.test(ua) ? 'Safari' : null : null;
  const os = ua ? /Android/.test(ua) ? 'Android' : /iPhone|iPad|iPod/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Macintosh/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : null : null;
  const parsed = new URL(destination);
  parsed.username = '';
  parsed.password = '';
  parsed.search = '';
  parsed.hash = '';
  let referrer: string | null = null;
  try {
    const origin = new URL(request.headers.get('referer') ?? '');
    if (['http:', 'https:'].includes(origin.protocol)) referrer = origin.origin;
  } catch {}
  const cf = (request.cf ?? {}) as Record<string, unknown>;
  const cloudflare = fields(cf, CF_FIELDS);
  const bots = cf.botManagement as Record<string, unknown> | undefined;
  cloudflare.botManagement = bots ? {
    ...fields(bots, ['score', 'verifiedBot', 'signedAgent', 'staticResource', 'ja3Hash', 'ja4']),
    detectionIds: Array.isArray(bots.detectionIds) ? bots.detectionIds.filter(value => typeof value === 'number' && Number.isFinite(value)).slice(0, 32) : null,
  } : null;
  const edge = cf.edgeL4 as Record<string, unknown> | undefined;
  cloudflare.edgeL4 = edge ? fields(edge, ['deliveryRate']) : null;
  const params = new URL(request.url).searchParams;
  return {
    event_id: crypto.randomUUID(), created_at: new Date().toISOString(), code, destination: parsed.toString(),
    ip: header('cf-connecting-ip', 64), referrer, user_agent: ua,
    browser, os,
    device: ua ? /iPad|Tablet/.test(ua) || /Android/.test(ua) && !/Mobile/.test(ua) ? 'tablet' : /Mobile|iPhone|iPod/.test(ua) || header('sec-ch-ua-mobile') === '?1' ? 'mobile' : os ? 'desktop' : null : null,
    headers: Object.fromEntries(HEADER_NAMES.map(name => [name, header(name)])),
    campaign: Object.fromEntries(['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id'].map(name => [name, bounded(params.get(name), 256) as string | null])),
    cloudflare,
  };
}

export function parseAuditQuery(params: URLSearchParams): AuditQuery | null {
  const integer = (name: string, fallback: number, max: number) => {
    const raw = params.get(name);
    if (raw === null) return fallback;
    if (!/^\d{1,16}$/.test(raw)) return NaN;
    const value = Number(raw);
    return Number.isSafeInteger(value) && value > 0 && value <= max ? value : NaN;
  };
  const date = (name: string, fallback: number) => {
    const raw = params.get(name);
    if (raw === null) return fallback;
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(raw)) return NaN;
    const value = Date.parse(raw);
    if (!Number.isFinite(value)) return NaN;
    return new Date(value).toISOString() === (raw.includes('.') ? raw : raw.replace('Z', '.000Z')) ? value : NaN;
  };
  const query = {
    limit: integer('limit', 50, 100), cursor: integer('cursor', Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER),
    from: date('from', 0), until: date('until', Date.now()),
  };
  return Object.values(query).every(Number.isFinite) && query.from <= query.until ? query : null;
}
