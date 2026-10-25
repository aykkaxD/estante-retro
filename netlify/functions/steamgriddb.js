'use strict';

const STEAMGRIDDB_ORIGIN = 'https://www.steamgriddb.com/api/v2';

function safeApiPath(value) {
  if (typeof value !== 'string' || value.length < 2 || value.length > 1000 || !value.startsWith('/')) throw new Error('Caminho de API inválido.');
  if (value.includes('\\') || value.includes('..') || /[\u0000-\u001f]/.test(value)) throw new Error('Caminho de API inválido.');
  let parsed;
  try { parsed = new URL(value, 'https://local.invalid'); } catch (_) { throw new Error('Caminho de API inválido.'); }
  if (parsed.origin !== 'https://local.invalid') throw new Error('Destino de API não permitido.');
  const pathname = parsed.pathname;
  if (/^\/search\/autocomplete\/[A-Za-z0-9%._~+'()*!\-]+$/.test(pathname)) {
    if ([...parsed.searchParams.keys()].length) throw new Error('Parâmetros não permitidos nesta busca.');
    return pathname;
  }
  if (/^\/grids\/game\/\d+$/.test(pathname)) {
    for (const key of parsed.searchParams.keys()) if (!['dimensions', 'limit'].includes(key)) throw new Error('Parâmetro de API não permitido.');
    const dimensions = parsed.searchParams.get('dimensions');
    const limit = parsed.searchParams.get('limit');
    if (dimensions && dimensions !== '600x900') throw new Error('Dimensão de arte não permitida.');
    if (limit && (!/^\d{1,2}$/.test(limit) || Number(limit) < 1 || Number(limit) > 50)) throw new Error('Limite de resultados inválido.');
    return pathname + parsed.search;
  }
  throw new Error('Este endpoint só permite buscas de título e grades de jogo SteamGridDB.');
}

exports.handler = async function handler(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ success: false, message: 'Método não permitido.' }) };
  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch (_) { return { statusCode: 400, headers, body: JSON.stringify({ success: false, message: 'Corpo JSON inválido.' }) }; }
  const key = String(body?.key || '').trim();
  if (!key || key.length > 512 || /[\r\n]/.test(key)) return { statusCode: 400, headers, body: JSON.stringify({ success: false, message: 'Informe uma chave SteamGridDB válida.' }) };
  let path;
  try { path = safeApiPath(body?.path); }
  catch (error) { return { statusCode: 400, headers, body: JSON.stringify({ success: false, message: error.message }) }; }
  try {
    const upstream = await fetch(STEAMGRIDDB_ORIGIN + path, {
      method: 'GET',
      headers: { Authorization: 'Bearer ' + key, Accept: 'application/json' },
      signal: AbortSignal.timeout(15000)
    });
    const raw = await upstream.text();
    let payload;
    try { payload = JSON.parse(raw); }
    catch (_) { payload = { success: false, message: 'A SteamGridDB retornou uma resposta inesperada.' }; }
    return { statusCode: upstream.status, headers, body: JSON.stringify(payload) };
  } catch (error) {
    return { statusCode: error?.name === 'TimeoutError' ? 504 : 502, headers, body: JSON.stringify({ success: false, message: error?.name === 'TimeoutError' ? 'Tempo esgotado ao consultar a SteamGridDB.' : 'Não foi possível conectar à SteamGridDB.' }) };
  }
};
