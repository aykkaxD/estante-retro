const ESTANTE_SHARE_MAX_TOKEN=180000;
const ESTANTE_SHARE_MAX_JSON=4*1024*1024;
if(location.hash.startsWith('#estante-share='))document.body.classList.add('estante-share-body');

function estanteShareEscape(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));}
function estanteShareImage(value){try{const url=new URL(String(value||''));if(url.protocol!=='https:')return '';url.username='';url.password='';url.hash='';return url.href.slice(0,3000);}catch(error){return '';}}
function estanteShareOfferUrl(value){try{const url=new URL(String(value||''));return ['https:','http:'].includes(url.protocol)?url.href.slice(0,2000):'';}catch(error){return '';}}
function estanteShareWish(item){
 const kind=['game','console','accessory'].includes(item.kind)?item.kind:'game';
 return {kind,title:String(item.title||'').slice(0,160),platformName:String(item.platformName||consoles.find(platform=>platform.id===item.platformId)?.name||'').slice(0,100),genre:String(item.genre||'').slice(0,80),brand:String(item.brand||'').slice(0,60),consoleType:String(item.consoleType||'').slice(0,60),accessoryType:String(item.accessoryType||'').slice(0,60),year:Number(item.year)||0,priority:['Alta','Média','Baixa'].includes(item.priority)?item.priority:'Média',targetPrice:wishlistTargetPrice(item),coverImage:estanteShareImage(item.coverImage),offers:(Array.isArray(item.offers)?item.offers:[]).slice(0,10).map(offer=>({store:String(offer.store||'').slice(0,80),price:hasMoneyValue(offer.price)?Number(offer.price):null,date:String(offer.date||'').slice(0,10),url:estanteShareOfferUrl(offer.url)}))};
}
function estanteBuildSharePayload(kind){
 const safeProfile={name:String(profile.displayName||profile.nickname||'Minha coleção').slice(0,80),about:String(profile.about||'').slice(0,500),favoritePlatform:consoles.find(platform=>platform.id===profile.favoritePlatform)?.name||'',collectionGoal:Math.max(0,Number(profile.collectionGoal)||0),avatarImage:estanteShareImage(profile.avatarImage)};
 const safeWishlist=wishlist.map(estanteShareWish).filter(item=>item.title);
 if(kind==='wishlist')return {schemaVersion:1,type:'wishlist',createdAt:new Date().toISOString(),profile:safeProfile,wishlist:safeWishlist};
 const safeConsoles=consoles.slice(0,500).map(platform=>({name:String(platform.name||'').slice(0,100),brand:String(platform.brand||'').slice(0,60),type:String(platform.type||'').slice(0,60),year:Number(platform.year)||0,coverImage:estanteShareImage(platform.coverImage),games:(Array.isArray(platform.games)?platform.games:[]).slice(0,5000).map(game=>({title:String(game.title||'').slice(0,160),year:Number(game.year)||0,genre:String(game.genre||'').slice(0,80),status:normalizeGameStatus(game.status),coverImage:estanteShareImage(game.coverImage)})).filter(game=>game.title)}));
 const safeAccessories=accessories.slice(0,5000).map(item=>({name:String(item.name||'').slice(0,120),type:String(item.type||'').slice(0,80),platformName:String(item.platformName||consoles.find(platform=>platform.id===item.platformId)?.name||'').slice(0,100),condition:String(item.condition||'').slice(0,60),coverImage:estanteShareImage(item.coverImage)})).filter(item=>item.name);
 return {schemaVersion:1,type:'profile',createdAt:new Date().toISOString(),profile:safeProfile,consoles:safeConsoles,accessories:safeAccessories,wishlist:safeWishlist};
}
function estanteValidateSharePayload(data){
 if(!data||typeof data!=='object'||data.schemaVersion!==1||!['profile','wishlist'].includes(data.type)||!data.profile||typeof data.profile.name!=='string')return false;
 if(!Array.isArray(data.wishlist)||data.wishlist.length>20000)return false;
 if(data.type==='profile'&&(!Array.isArray(data.consoles)||data.consoles.length>500||!Array.isArray(data.accessories)||data.accessories.length>5000))return false;
 let gameCount=0;
 for(const platform of data.consoles||[]){if(!platform||typeof platform.name!=='string'||!Array.isArray(platform.games))return false;gameCount+=platform.games.length;if(gameCount>20000)return false;}
 return data.wishlist.every(item=>item&&typeof item.title==='string')&&(data.accessories||[]).every(item=>item&&typeof item.name==='string');
}
function estanteBytesToBase64Url(bytes){let binary='';for(let index=0;index<bytes.length;index+=0x8000)binary+=String.fromCharCode(...bytes.subarray(index,index+0x8000));return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
function estanteBase64UrlToBytes(value){const base64=value.replace(/-/g,'+').replace(/_/g,'/');const binary=atob(base64+'='.repeat((4-base64.length%4)%4));const bytes=new Uint8Array(binary.length);for(let index=0;index<binary.length;index++)bytes[index]=binary.charCodeAt(index);return bytes;}
async function estanteStreamBytes(stream,maxBytes){const reader=stream.getReader(),chunks=[];let size=0;while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>maxBytes){await reader.cancel();throw new Error('O conteúdo compartilhado é grande demais.');}chunks.push(value);}const output=new Uint8Array(size);let offset=0;for(const chunk of chunks){output.set(chunk,offset);offset+=chunk.length;}return output;}
async function estanteEncodeShare(data){
 const raw=new TextEncoder().encode(JSON.stringify(data));if(raw.length>ESTANTE_SHARE_MAX_JSON)throw new Error('Este conteúdo é grande demais para compartilhar por link.');
 let bytes=raw,codec='raw';
 if(typeof CompressionStream==='function'){bytes=await estanteStreamBytes(new Blob([raw]).stream().pipeThrough(new CompressionStream('gzip')),ESTANTE_SHARE_MAX_JSON);codec='gz';}
 const token=estanteBytesToBase64Url(bytes);if(token.length>ESTANTE_SHARE_MAX_TOKEN)throw new Error('O link ficou grande demais. Tente compartilhar apenas a wishlist.');
 const url=new URL(location.pathname,location.origin);url.hash=`estante-share=v1.${codec}.${token}`;return url.href;
}
async function estanteDecodeShare(hash){
 const match=String(hash||'').match(/^#estante-share=v1\.(gz|raw)\.([A-Za-z0-9_-]+)$/);if(!match||match[2].length>ESTANTE_SHARE_MAX_TOKEN)throw new Error('Este link compartilhado está inválido ou incompleto.');
 let bytes=estanteBase64UrlToBytes(match[2]);if(match[1]==='gz'){if(typeof DecompressionStream!=='function')throw new Error('Este navegador não oferece suporte para abrir este link. Atualize o navegador e tente novamente.');bytes=await estanteStreamBytes(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')),ESTANTE_SHARE_MAX_JSON);}
 if(bytes.length>ESTANTE_SHARE_MAX_JSON)throw new Error('O conteúdo compartilhado é grande demais.');
 const data=JSON.parse(new TextDecoder().decode(bytes));if(!estanteValidateSharePayload(data))throw new Error('Os dados deste link compartilhado não são válidos.');return data;
}
async function estanteShare(kind){
 try{
  const link=await estanteEncodeShare(estanteBuildSharePayload(kind));
  if(navigator.share){try{await navigator.share({title:kind==='wishlist'?'Wishlist da Estante Retro':'Perfil da Estante Retro',text:'Veja esta coleção compartilhada da Estante Retro.',url:link});return;}catch(error){if(error?.name==='AbortError')return;}}
  try{await navigator.clipboard.writeText(link);toast('Link copiado. Qualquer pessoa com ele poderá ver esta cópia.');}
  catch(error){window.prompt('Copie o link público da sua cópia compartilhada:',link);}
 }catch(error){toast(error?.message||'Não foi possível criar o link compartilhado.');}
}
function estanteShareImageMarkup(source,label,className=''){
 const image=estanteShareImage(source);return `<div class="estante-share-image ${className}">${image?`<img loading="lazy" src="${estanteShareEscape(image)}" alt="${estanteShareEscape(label)}">`:`<span aria-hidden="true">${estanteShareEscape(String(label||'?').slice(0,2).toUpperCase())}</span>`}</div>`;
}
function estanteRenderSharedWishlist(items){
 if(!items.length)return '<p class="estante-share-empty">Esta wishlist ainda não tem itens.</p>';
 return `<div class="estante-share-wishlist">${items.map(item=>{const kind=item.kind==='console'?'Console':item.kind==='accessory'?'Acessório':'Jogo';const meta=[kind,item.platformName,item.genre,item.brand,item.consoleType,item.accessoryType,item.year].filter(Boolean).join(' · ');const offers=(Array.isArray(item.offers)?item.offers:[]).filter(offer=>hasMoneyValue(offer.price));return `<article class="estante-share-item">${estanteShareImageMarkup(item.coverImage,item.title)}<div class="estante-share-item-copy"><strong>${estanteShareEscape(item.title)}</strong><small>${estanteShareEscape(meta)}</small><span>${estanteShareEscape(item.priority||'Média')} prioridade${hasMoneyValue(item.targetPrice)?` · Preço-alvo ${money(item.targetPrice)}`:''}</span>${offers.length?`<details><summary>${offers.length} oferta(s)</summary>${offers.map(offer=>{const href=estanteShareOfferUrl(offer.url);return `<p>${hasMoneyValue(offer.price)?money(offer.price):'Preço não informado'} · ${estanteShareEscape(offer.store||'Loja não informada')}${offer.date?' · '+estanteShareEscape(displayDate(offer.date)):''}${href?` · <a href="${estanteShareEscape(href)}" target="_blank" rel="noopener noreferrer">Abrir ↗</a>`:''}</p>`;}).join('')}</details>`:''}</div></article>`;}).join('')}</div>`;
}
function estanteRenderShareProfile(data){
 const games=(data.consoles||[]).flatMap(platform=>(platform.games||[]).map(game=>({...game,platformName:platform.name})));
 const done=games.filter(game=>isGameCompleted(game.status)).length;
 const consolesHtml=(data.consoles||[]).map(platform=>`<details class="estante-share-platform"><summary>${estanteShareImageMarkup(platform.coverImage,platform.name,'is-small')}<span><strong>${estanteShareEscape(platform.name)}</strong><small>${platform.games.length} jogo(s)${platform.brand?' · '+estanteShareEscape(platform.brand):''}</small></span></summary><div class="estante-share-platform-games">${platform.games.length?platform.games.map(game=>`<div>${estanteShareImageMarkup(game.coverImage,game.title,'is-tiny')}<span><strong>${estanteShareEscape(game.title)}</strong><small>${estanteShareEscape([game.year,game.genre,normalizeGameStatus(game.status)].filter(Boolean).join(' · '))}</small></span></div>`).join(''):'<p>Nenhum jogo cadastrado.</p>'}</div></details>`).join('');
 const accessoriesHtml=(data.accessories||[]).length?`<div class="estante-share-wishlist">${data.accessories.map(item=>`<article class="estante-share-item">${estanteShareImageMarkup(item.coverImage,item.name)}<div class="estante-share-item-copy"><strong>${estanteShareEscape(item.name)}</strong><small>${estanteShareEscape([item.type,item.platformName,item.condition].filter(Boolean).join(' · '))}</small></div></article>`).join('')}</div>`:'<p class="estante-share-empty">Nenhum acessório cadastrado.</p>';
 const profile=data.profile;const main=$('#mainContent');
 main.innerHTML=`<article class="estante-share-page"><header class="estante-share-header"><a href="${estanteShareEscape(location.pathname)}" class="estante-share-brand">ESTANTE <span>RETRO</span></a><span>Perfil compartilhado</span></header><section class="estante-share-profile-hero">${estanteShareImageMarkup(profile.avatarImage,profile.name,'is-avatar')}<div><small>COLEÇÃO COMPARTILHADA</small><h1>${estanteShareEscape(profile.name)}</h1>${profile.about?`<p>${estanteShareEscape(profile.about)}</p>`:''}${profile.favoritePlatform?`<span>Plataforma favorita: ${estanteShareEscape(profile.favoritePlatform)}</span>`:''}</div></section><div class="estante-share-stats"><article><strong>${data.consoles.length}</strong><span>Plataformas</span></article><article><strong>${games.length}</strong><span>Jogos</span></article><article><strong>${data.accessories.length}</strong><span>Acessórios</span></article><article><strong>${done}</strong><span>Concluídos</span></article></div><section><h2>Plataformas e jogos</h2>${consolesHtml||'<p class="estante-share-empty">Nenhuma plataforma cadastrada.</p>'}</section><section><h2>Acessórios</h2>${accessoriesHtml}</section><section><h2>Wishlist <span>${data.wishlist.length}</span></h2>${estanteRenderSharedWishlist(data.wishlist)}</section><footer>Esta é uma cópia pública sem prazo de expiração. Anotações pessoais e valores pagos são omitidos; preços-alvo e ofertas salvas na wishlist aparecem.</footer></article>`;
}
function estanteRenderSharedWishlistPage(data){
 const main=$('#mainContent'),profile=data.profile;main.innerHTML=`<article class="estante-share-page"><header class="estante-share-header"><a href="${estanteShareEscape(location.pathname)}" class="estante-share-brand">ESTANTE <span>RETRO</span></a><span>Wishlist compartilhada</span></header><section class="estante-share-profile-hero">${estanteShareImageMarkup(profile.avatarImage,profile.name,'is-avatar')}<div><small>WISHLIST DE</small><h1>${estanteShareEscape(profile.name)}</h1><p>${data.wishlist.length} item(ns) que quer encontrar</p></div></section>${estanteRenderSharedWishlist(data.wishlist)}<footer>Esta é uma cópia pública sem prazo de expiração. Anotações pessoais e valores pagos são omitidos; preços-alvo e ofertas salvas aparecem.</footer></article>`;
}
async function estanteOpenSharedPage(){
 const app=$('.app');if(!app)return;app.classList.add('estante-share-mode');
 for(const selector of ['.sidebar','.topbar','.hero','#stats','.footer-note','.cloud-sync-banner']){const node=$(selector);if(node)node.hidden=true;}
 const main=$('#mainContent');main.innerHTML='<div class="estante-share-page"><p role="status">Abrindo conteúdo compartilhado…</p></div>';
 try{const data=await estanteDecodeShare(location.hash);document.title=`${data.type==='wishlist'?'Wishlist':'Perfil'} de ${data.profile.name} · Estante Retro`;if(data.type==='wishlist')estanteRenderSharedWishlistPage(data);else estanteRenderShareProfile(data);}
 catch(error){main.innerHTML=`<article class="estante-share-page"><header class="estante-share-header"><span class="estante-share-brand">ESTANTE <span>RETRO</span></span></header><h1>Não foi possível abrir este link</h1><p>${estanteShareEscape(error?.message||'O conteúdo compartilhado está inválido.')}</p><a href="${estanteShareEscape(location.pathname)}">Abrir a Estante</a></article>`;}
}

if(location.hash.startsWith('#estante-share='))void estanteOpenSharedPage();
