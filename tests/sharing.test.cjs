const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.resolve(__dirname, '../js/sharing.js'), 'utf8');

function createSharingContext(overrides = {}) {
  const context = vm.createContext({
    location: { hash: '', href: 'https://estante.example/?private=query', origin: 'https://estante.example', pathname: '/', search: '?private=query' },
    URL,
    TextEncoder,
    TextDecoder,
    document: { body: { classList: { add() {} } } },
    profile: { displayName: 'Coleção pública', about: 'Sobre a coleção', favoritePlatform: '', collectionGoal: 30, avatarImage: 'data:image/png;base64,private-photo' },
    consoles: [{ id: 'p1', name: 'Console', games: [{ title: 'Jogo', status: 'Jogando', pricePaid: 120, marketValue: 200, notes: 'nota privada', coverImage: 'https://cdn.example/game.png' }] }],
    accessories: [{ name: 'Controle', type: 'Periférico', pricePaid: 40, notes: 'serial privado', coverImage: 'data:image/png;base64,private-image' }],
    wishlist: [{ id: 'w1', title: 'Desejado', kind: 'game', platformId: 'p1', targetPrice: 90, notes: 'nota wishlist privada', offers: [{ store: 'Loja', price: 85, url: 'https://store.example/item' }] }],
    normalizeGameStatus: status => status || 'Backlog',
    wishlistTargetPrice: item => item.targetPrice ?? null,
    hasMoneyValue: value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)),
    btoa,
    atob,
    ...overrides,
  });
  vm.runInContext(`${source}\nglobalThis.sharing = { build: estanteBuildSharePayload, validate: estanteValidateSharePayload, encode: estanteEncodeShare, decode: estanteDecodeShare };`, context);
  return context;
}

test('public shares keep collection details and omit personal notes and paid values', () => {
  const context = createSharingContext();
  const profile = context.sharing.build('profile');
  const serialized = JSON.stringify(profile);
  assert.equal(profile.type, 'profile');
  assert.equal(profile.consoles[0].games[0].title, 'Jogo');
  assert.equal(profile.wishlist[0].targetPrice, 90);
  assert.equal(profile.consoles[0].games[0].coverImage, 'https://cdn.example/game.png');
  for (const privateValue of ['pricePaid', 'marketValue', 'notes', 'private-photo', 'private-image', 'serial privado']) assert.equal(serialized.includes(privateValue), false);
});

test('shared links round-trip and omit query parameters from the site URL', async () => {
  const context = createSharingContext();
  const link = await context.sharing.encode(context.sharing.build('wishlist'));
  const parsedUrl = new URL(link);
  assert.equal(parsedUrl.origin, 'https://estante.example');
  assert.equal(parsedUrl.search, '');
  const decoded = await context.sharing.decode(parsedUrl.hash);
  assert.equal(decoded.type, 'wishlist');
  assert.equal(decoded.wishlist[0].title, 'Desejado');
});

test('rejects malformed shared payloads before rendering them', () => {
  const context = createSharingContext();
  assert.equal(context.sharing.validate({ schemaVersion: 1, type: 'wishlist', profile: { name: 'X' }, wishlist: [{ title: 'Y' }] }), true);
  assert.equal(context.sharing.validate({ schemaVersion: 1, type: 'profile', profile: { name: 'X' }, wishlist: [], consoles: 'invalid', accessories: [] }), false);
  assert.equal(context.sharing.validate({ schemaVersion: 2, type: 'wishlist', profile: { name: 'X' }, wishlist: [] }), false);
});
