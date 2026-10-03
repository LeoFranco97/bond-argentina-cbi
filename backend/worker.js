/**
 * Bond and Partners, CBI Argentina
 * Recebe os leads da landing page e guarda num banco que só o dono abre.
 *
 * Roda num Cloudflare Worker, de graça.
 *
 *   POST /lead    recebe o formulário da página e grava
 *   GET  /admin   painel privado, pede usuário e senha
 *   GET  /admin.csv  baixa tudo em CSV, mesma senha
 *
 * Nada aqui é público. A senha vive como secret do Worker, nunca no site.
 */

const ALLOWED_ORIGINS = [
  "https://leofranco97.github.io",
  "http://localhost:8731",
];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") return preflight(origin);

    if (url.pathname === "/lead" && request.method === "POST") {
      return handleLead(request, env, origin);
    }
    if (url.pathname === "/admin" && request.method === "GET") {
      return handleAdmin(request, env, "html");
    }
    if (url.pathname === "/admin.csv" && request.method === "GET") {
      return handleAdmin(request, env, "csv");
    }
    return new Response("Not found", { status: 404 });
  },
};

/* ------------------------------------------------------------------ */
/* CORS                                                                */
/* ------------------------------------------------------------------ */

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function preflight(origin) {
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}

/* ------------------------------------------------------------------ */
/* Recebe o lead                                                       */
/* ------------------------------------------------------------------ */

const FIELDS = ["name", "email", "phone", "citizenship", "who", "route", "timing", "notes"];
const MAX = 2000;

async function handleLead(request, env, origin) {
  const headers = { ...corsHeaders(origin), "Content-Type": "application/json" };

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "bad_json" }, 400, headers);
  }

  // armadilha de robô: o campo website é invisível na página, humano nunca preenche
  if (body.website) return json({ ok: true }, 200, headers);

  const name = str(body.name);
  const email = str(body.email);
  if (!name || !isEmail(email)) {
    return json({ ok: false, error: "missing_fields" }, 422, headers);
  }

  // um mesmo IP não grava mais de 5 por hora
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const rateKey = `rate:${ip}:${Math.floor(Date.now() / 3600000)}`;
  const seen = parseInt((await env.LEADS.get(rateKey)) || "0", 10);
  if (seen >= 5) return json({ ok: false, error: "rate_limited" }, 429, headers);
  await env.LEADS.put(rateKey, String(seen + 1), { expirationTtl: 7200 });

  const lead = { received_at: new Date().toISOString() };
  for (const f of FIELDS) lead[f] = str(body[f]);
  lead.country = request.headers.get("CF-IPCountry") || "";
  lead.page = str(body.page) || "argentina-cbi";

  const id = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  await env.LEADS.put(`lead:${id}`, JSON.stringify(lead));

  return json({ ok: true }, 200, headers);
}

function str(v) {
  return typeof v === "string" ? v.trim().slice(0, MAX) : "";
}
function isEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
}
function json(obj, status, headers) {
  return new Response(JSON.stringify(obj), { status, headers });
}

/* ------------------------------------------------------------------ */
/* Painel privado                                                      */
/* ------------------------------------------------------------------ */

async function handleAdmin(request, env, format) {
  if (!authorised(request, env)) {
    return new Response("Authentication required", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="Bond leads", charset="UTF-8"' },
    });
  }

  const list = await env.LEADS.list({ prefix: "lead:" });
  const leads = [];
  for (const k of list.keys) {
    const raw = await env.LEADS.get(k.name);
    if (raw) {
      try {
        leads.push(JSON.parse(raw));
      } catch {}
    }
  }
  leads.sort((a, b) => (a.received_at < b.received_at ? 1 : -1));

  if (format === "csv") {
    const cols = ["received_at", "country", ...FIELDS];
    const rows = [cols.join(",")];
    for (const l of leads) rows.push(cols.map((c) => csv(l[c])).join(","));
    return new Response("﻿" + rows.join("\r\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="bond-leads-${today()}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  return new Response(page(leads), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

function authorised(request, env) {
  const header = request.headers.get("Authorization") || "";
  if (!header.startsWith("Basic ")) return false;
  let decoded;
  try {
    decoded = atob(header.slice(6));
  } catch {
    return false;
  }
  const i = decoded.indexOf(":");
  if (i < 0) return false;
  const user = decoded.slice(0, i);
  const pass = decoded.slice(i + 1);
  return safeEqual(user, env.ADMIN_USER || "") && safeEqual(pass, env.ADMIN_PASS || "");
}

// comparação de tempo constante, para a senha não vazar pelo tempo de resposta
function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function csv(v) {
  const s = v == null ? "" : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function today() {
  return new Date().toISOString().slice(0, 10);
}
function esc(v) {
  return String(v == null ? "" : v).replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]
  );
}

function page(leads) {
  const rows = leads
    .map(
      (l) => `<tr>
  <td class="t">${esc(l.received_at).replace("T", " ").slice(0, 16)}</td>
  <td><b>${esc(l.name)}</b>${l.notes ? `<div class="n">${esc(l.notes)}</div>` : ""}</td>
  <td><a href="mailto:${esc(l.email)}">${esc(l.email)}</a>${
    l.phone ? `<div class="n">${esc(l.phone)}</div>` : ""
  }</td>
  <td>${esc(l.citizenship)}</td>
  <td>${esc(l.who)}</td>
  <td>${esc(l.route)}</td>
  <td>${esc(l.timing)}</td>
</tr>`
    )
    .join("\n");

  return `<!DOCTYPE html><html lang="pt-BR"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Leads, CBI Argentina</title>
<style>
:root{--bg:#060C17;--card:#0C1829;--rule:#1B2E4A;--hi:#F3F6FA;--mid:#AAB8CE;--gold:#C9A24A}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--hi);font:15px/1.55 ui-sans-serif,system-ui,-apple-system,sans-serif;padding:32px 20px}
.wrap{max-width:1180px;margin:0 auto}
header{display:flex;align-items:baseline;justify-content:space-between;gap:20px;flex-wrap:wrap;margin-bottom:26px}
h1{font-size:22px;font-weight:600;margin:0;letter-spacing:-.01em}
.count{color:var(--gold);font-weight:600}
a.dl{color:var(--bg);background:var(--gold);text-decoration:none;padding:9px 18px;border-radius:999px;font-weight:600;font-size:14px}
table{width:100%;border-collapse:collapse;background:var(--card);border:1px solid var(--rule);border-radius:12px;overflow:hidden}
th,td{text-align:left;padding:12px 14px;border-bottom:1px solid var(--rule);vertical-align:top}
th{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--mid);font-weight:600;background:#09111F}
tr:last-child td{border-bottom:none}
td.t{color:var(--mid);white-space:nowrap;font-variant-numeric:tabular-nums}
.n{color:var(--mid);font-size:13px;margin-top:3px}
a{color:var(--gold)}
.empty{padding:48px 20px;text-align:center;color:var(--mid);background:var(--card);border:1px solid var(--rule);border-radius:12px}
@media(max-width:720px){table,thead,tbody,tr,td{display:block;width:100%}thead{display:none}
tr{border-bottom:1px solid var(--rule);padding:6px 0}td{border:none;padding:5px 14px}}
</style></head><body><div class="wrap">
<header>
  <h1>Leads, CBI Argentina <span class="count">${leads.length}</span></h1>
  <a class="dl" href="/admin.csv">Baixar CSV</a>
</header>
${
  leads.length
    ? `<table><thead><tr><th>Quando</th><th>Nome</th><th>Contato</th><th>Cidadania</th><th>Quem aplica</th><th>Rota</th><th>Quando quer</th></tr></thead><tbody>${rows}</tbody></table>`
    : `<div class="empty">Nenhum lead ainda.</div>`
}
</div></body></html>`;
}
