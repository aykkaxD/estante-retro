'use strict';

// Auxiliar local da Estante Retro: proxy restrito para a API da SteamGridDB.
// Escuta apenas no loopback e nunca registra a chave recebida.
const http = require('node:http');
const STEAMGRIDDB_ORIGIN = 'https://www.steamgriddb.com/api/v2';
const HOST = '127.0.0.1';
const PORT = Number(process.env.PORT || 3210);
const MAX_BODY_BYTES = 16 * 1024;

function responseHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  };
}

function send(res, statusCode, payload) {
  res.writeHead(statusCode, responseHeaders());
  res.end(JSON.stringify(payload));
}

function safeApiPath(value) {
  if (typeof value !== 'string' || value.length < 2 || value.length > 1000 || !value.startsWith('/')) {
    throw new Error('Caminho de API inválido.');
  }
  if (value.includes('\\') || value.includes('..') || /[\u0000-\u001f]/.test(value)) {
    throw new Error('Caminho de API inválido.');
  }
  let parsed;
  try { parsed = new URL(value, 'https://local.invalid'); }
  catch (_) { throw new Error('Caminho de API inválido.'); }
  if (parsed.origin !== 'https://local.invalid') throw new Error('Destino de API não permitido.');
  const pathname = parsed.pathname;
  if (/^\/search\/autocomplete\/[A-Za-z0-9%._~+'()*!\-]+$/.test(pathname)) {
    if ([...parsed.searchParams.keys()].length) throw new Error('Parâmetros não permitidos nesta busca.');
    return pathname;
  }
  if (/^\/grids\/game\/\d+$/.test(pathname)) {
    for (const key of parsed.searchParams.keys()) {
      if (!['dimensions', 'limit'].includes(key)) throw new Error('Parâmetro de API não permitido.');
    }
    const dimensions = parsed.searchParams.get('dimensions');
    const limit = parsed.searchParams.get('limit');
    if (dimensions && dimensions !== '600x900') throw new Error('Dimensão de arte não permitida.');
    if (limit && (!/^\d{1,2}$/.test(limit) || Number(limit) < 1 || Number(limit) > 50)) throw new Error('Limite de resultados inválido.');
    return pathname + parsed.search;
  }
  throw new Error('Este auxiliar só permite buscas de título e grades de jogo SteamGridDB.');
}

async function readJson(req) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > MAX_BODY_BYTES) throw Object.assign(new Error('Requisição muito grande.'), { statusCode: 413 });
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch (_) { throw Object.assign(new Error('Corpo JSON inválido.'), { statusCode: 400 }); }
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, responseHeaders());
    return res.end();
  }
  if (req.url !== '/api/steamgriddb' || req.method !== 'POST') {
    return send(res, 404, { success: false, message: 'Rota não encontrada.' });
  }
  try {
    const body = await readJson(req);
    const key = String(body?.key || '').trim();
    if (!key || key.length > 512 || /[\r\n]/.test(key)) return send(res, 400, { success: false, message: 'Informe uma chave SteamGridDB válida.' });
    const path = safeApiPath(body?.path);
    const upstream = await fetch(STEAMGRIDDB_ORIGIN + path, {
      method: 'GET',
      headers: { Authorization: 'Bearer ' + key, Accept: 'application/json' },
      signal: AbortSignal.timeout(15000)
    });
    const raw = await upstream.text();
    let payload;
    try { payload = JSON.parse(raw); }
    catch (_) { payload = { success: false, message: 'A SteamGridDB retornou uma resposta inesperada.' }; }
    send(res, upstream.status, payload);
  } catch (error) {
    const status = Number(error?.statusCode) || (error?.name === 'TimeoutError' ? 504 : 400);
    send(res, status, { success: false, message: status === 504 ? 'Tempo esgotado ao consultar a SteamGridDB.' : (error?.message || 'Falha na integração SteamGridDB.') });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Auxiliar SteamGridDB da Estante Retro ativo em http://${HOST}:${PORT}/api/steamgriddb`);
  console.log('Deixe esta janela aberta enquanto usar as buscas de capas no HTML local.');
});

server.on('error', error => {
  if (error.code === 'EADDRINUSE') console.error(`A porta ${PORT} já está em uso. Feche outra instância do auxiliar e tente de novo.`);
  else console.error('Não foi possível iniciar o auxiliar:', error.message);
  process.exitCode = 1;
});
