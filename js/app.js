
let currentView='allgames',currentConsole=null,searchTerm='',modalMode='console',gameFilter='all';
let progressFilter='all';
let platformFilters={brand:'all',type:'all',era:'all',sort:'name'};
let libraryGameFilters={status:'all',condition:'all',platform:'all',genre:'all',era:'all',sort:'title'};
let wishlistSort='date';
let wishlistFilters={kind:'all',priority:'all',platform:'all',price:'all'};
function searchMatches(...values){return !searchTerm||values.filter(value=>value!==null&&value!==undefined).join(' ').toLocaleLowerCase().includes(searchTerm);}
function setSearchContext(view=currentView){const input=$('#searchInput'),label=$('.search');const contexts={allgames:['Buscar jogos da coleção…','Buscar jogos da coleção'],platforms:['Buscar consoles e plataformas…','Buscar consoles e plataformas'],console:['Buscar jogos nesta plataforma…','Buscar jogos nesta plataforma'],wishlist:['Buscar na wishlist…','Buscar itens da wishlist'],progress:['Buscar jogos e progresso…','Buscar jogos e progresso'],profile:['Buscar em todo o perfil…','Buscar em todo o perfil'],accessories:['Buscar acessórios…','Buscar acessórios'],backup:['','']};const [placeholder,ariaLabel]=contexts[view]||contexts.allgames;label.hidden=!placeholder;input.placeholder=placeholder;input.setAttribute('aria-label',ariaLabel);input.value=searchTerm;}
function handleGlobalSearch(value){searchTerm=String(value||'').trim().toLocaleLowerCase();if(currentView==='platforms')renderPlatformCards(consoles.filter(c=>searchMatches(c.name,c.brand,c.type)));else if(currentView==='allgames')renderGameCards(allGames());else if(currentView==='wishlist')renderWishlist();else if(currentView==='console'){const c=consoles.find(c=>c.id===currentConsole);if(c)renderGameCards(c.games.map((g,i)=>({...g,consoleId:c.id,consoleName:c.name,gameIndex:i})));}else if(currentView==='progress')renderProgressView();else if(currentView==='profile')renderProfileOverviewView();else if(currentView==='accessories')renderAccessoriesView();}
function updateWishlistBadge(){const b=document.getElementById('wishlistNavCount');if(b)b.textContent=String(wishlist.length);}
const PROFILE_KEY=profileDataKey('estanteProfileV1');
function renderWishlistAcquisition(data){const offers=Array.isArray(data?.offers)?data.offers:[];return `<div class="field" style="padding:12px 14px;border:1px solid rgba(168,85,247,.3);border-radius:12px;background:rgba(168,85,247,.07)"><strong style="display:block;margin-bottom:5px">Veio da wishlist</strong><small style="color:#aab6cc">${hasMoneyValue(data.targetPrice)?`Preço-alvo: ${money(data.targetPrice)} · `:''}${offers.length} oferta(s) e histórico do preço-alvo preservados. O preço pago e o valor de mercado continuam separados.</small>${offers.length?`<details style="margin-top:8px"><summary>Ver ofertas salvas</summary>${offers.map(offer=>`<div style="margin-top:6px">${hasMoneyValue(offer.price)?money(offer.price):'Preço não informado'} · ${esc(offer.store||'Loja não informada')}${offer.date?' · '+esc(displayDate(offer.date)):''}${wishlistOfferSafeUrl(offer.url)?` · <a href="${esc(wishlistOfferSafeUrl(offer.url))}" target="_blank" rel="noopener noreferrer">Abrir oferta ↗</a>`:''}</div>`).join('')}</details>`:''}</div>`;}
let sidebarCollapsed=false;try{sidebarCollapsed=localStorage.getItem('estanteSidebarCollapsed')==='1';}catch(e){}
if(sidebarCollapsed)document.getElementById('app').classList.add('sidebar-collapsed');
const $=s=>document.querySelector(s);const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function money(v){if(!hasMoneyValue(v))return '—';return Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});}
function optionalMoney(v){if(v===null||v===undefined||String(v).trim()==='')return null;const n=Number(v);return Number.isFinite(n)&&n>=0?n:null;}
function displayDate(v){if(!v)return 'Não informada';const d=new Date(v+'T12:00:00');return Number.isNaN(d.getTime())?String(v):d.toLocaleDateString('pt-BR');}
let steamGridDbKey='';try{steamGridDbKey=localStorage.getItem('estanteSteamGridDBKey')||'';}catch(e){}
let activeSgdbGame=null,sgdbChosenCoverUrl='';
function sgdbIsHosted(){
  return location.protocol==='https:' && !['localhost','127.0.0.1','::1'].includes(location.hostname);
}
async function sgdbRequestAt(endpoint,path,key){
  let response;
  try{
    response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify({path,key})});
  }catch(e){throw new Error('SGDB_CONNECTION_FAILED: '+(e.message||'Falha de conexão'));}
  const contentType=response.headers.get('content-type')||'';
  let payload=null;
  try{payload=await response.json();}catch(e){}
  // HTML 404 da página estática significa que a função serverless não foi publicada.
  if(response.status===404&&!payload&&!contentType.toLowerCase().includes('json'))return {missingBackend:true};
  if(!payload){
    if(response.status===404)return {missingBackend:true};
    throw new Error('O serviço SteamGridDB respondeu em um formato inesperado (HTTP '+response.status+').');
  }
  if(response.status===401||response.status===403)throw new Error(payload.message||payload.errors?.[0]||'Chave inválida ou sem autorização. Confira a chave nas preferências do SteamGridDB.');
  if(response.status===502)throw new Error(payload.message||'O serviço não conseguiu acessar o SteamGridDB. Verifique a internet.');
  if(!response.ok||payload.success===false)throw new Error(payload.errors?.[0]||payload.message||('SteamGridDB retornou o erro '+response.status+'.'));
  return {data:payload.data||[]};
}
async function sgdbRequest(path,keyOverride){
  const key=String(keyOverride===undefined?steamGridDbKey:keyOverride).trim();
  if(!key)throw new Error('Configure sua chave da API do SteamGridDB primeiro.');
  const localEndpoint='http://127.0.0.1:3210/api/steamgriddb';
  if(sgdbIsHosted()){
    // No site publicado, preferimos a função Netlify: ela funciona também no celular e não depende do PC estar ligado.
    let hostedResult=null;
    try{hostedResult=await sgdbRequestAt('/.netlify/functions/steamgriddb',path,key);}catch(e){
      if(!String(e.message||'').startsWith('SGDB_CONNECTION_FAILED:'))throw e;
    }
    if(hostedResult&&!hostedResult.missingBackend)return hostedResult.data;
    // Compatibilidade com o antigo deploy estático: pode funcionar no computador se o auxiliar local estiver ativo.
    try{
      const localResult=await sgdbRequestAt(localEndpoint,path,key);
      if(!localResult.missingBackend)return localResult.data;
    }catch(e){
      if(!String(e.message||'').startsWith('SGDB_CONNECTION_FAILED:'))throw e;
      throw new Error('A integração da SteamGridDB ainda não está disponível neste site. Para funcionar no celular, publique também a função Netlify incluída no pacote atualizado. Se estiver no computador, você pode abrir o auxiliar INICIAR_STEAMGRIDDB.bat e permitir o acesso à rede local quando o Chrome perguntar. Detalhe: '+String(e.message).replace('SGDB_CONNECTION_FAILED: ',''));
    }
    throw new Error('A função da SteamGridDB não foi publicada. Um site publicado apenas pelo HTML/Netlify Drop não tem o serviço de API incluído. Publique o projeto com a pasta netlify/functions do pacote atualizado.');
  }
  try{
    const result=await sgdbRequestAt(localEndpoint,path,key);
    if(!result.missingBackend)return result.data;
    throw new Error('Auxiliar local não encontrado.');
  }catch(e){
    if(String(e.message||'').startsWith('SGDB_CONNECTION_FAILED:'))throw new Error('O auxiliar local da SteamGridDB não está acessível. Execute INICIAR_STEAMGRIDDB.bat e mantenha a janela aberta.');
    throw e;
  }
}
function safeHttpsUrl(value){
  try{const u=new URL(String(value||''));return u.protocol==='https:'?u.href:'https://www.mercadolivre.com.br';}catch(e){return 'https://www.mercadolivre.com.br';}
}
function openManualMarketEstimator(c,g){
  const searchTerm=`${g.title} ${c.name}`;
  const searchUrl=`https://lista.mercadolivre.com.br/${encodeURIComponent(searchTerm)}`;
  // Tenta abrir a pesquisa diretamente como parte do clique do usuário; o link no modal continua como alternativa se pop-ups forem bloqueados.
  try{window.open(safeHttpsUrl(searchUrl),'_blank','noopener,noreferrer');}catch(e){}
  $('#modalTitle').textContent='Estimar valor de mercado';
  $('#editorForm').innerHTML=`<p class="market-config-copy">A Estante não precisa de API paga nem de credenciais. Abra a pesquisa, confira anúncios do mesmo jogo e da mesma plataforma e insira abaixo somente os preços que considerar comparáveis.</p>
    <div class="market-estimate-card" style="margin:12px 0"><div class="market-estimate-main"><small>JOGO PESQUISADO</small><strong style="font-size:18px;letter-spacing:0">${esc(g.title)}</strong><small>${esc(c.name)} · priorize anúncios com condição e conteúdo semelhantes</small></div><div class="market-toolbar"><a class="primary" href="${esc(safeHttpsUrl(searchUrl))}" target="_blank" rel="noopener noreferrer" style="display:inline-block;text-decoration:none">Abrir busca no Mercado Livre ↗</a><a class="secondary" href="${esc(safeHttpsUrl('https://www.google.com/search?tbm=shop&q='+encodeURIComponent(`${g.title} ${c.name} jogo`)))}" target="_blank" rel="noopener noreferrer" style="display:inline-block;text-decoration:none">Google Shopping ↗</a></div></div>
    <div class="field"><label for="manualMarketPrices">Preços comparáveis (um por linha)</label><textarea id="manualMarketPrices" rows="7" placeholder="R$ 79,90\nR$ 95,00\n120,00" required style="width:100%;resize:vertical;min-height:140px">${esc((g.marketEstimate?.selectedPrices||[]).map(v=>Number(v).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})).join('\n'))}</textarea><small class="sgdb-help">Pode colar valores com “R$”, vírgula decimal ou ponto. Ignoramos linhas vazias e valores inválidos. Tente reunir de 3 a 8 anúncios comparáveis.</small></div>
    <div id="manualMarketStatus" class="market-config-status" role="status" aria-live="polite">A mediana reduz a influência de um anúncio muito caro ou muito barato. Ela representa preços anunciados, não necessariamente vendas concluídas.</div>
    <div class="market-key-actions"><button class="primary" type="button" id="calculateMarketMedian">Calcular mediana</button><button class="secondary" type="button" id="cancelEdit">Cancelar</button></div>`;
  $('#modalBackdrop').classList.add('open');
  $('#cancelEdit').onclick=()=>$('#modalBackdrop').classList.remove('open');
  $('#modalClose').onclick=()=>$('#modalBackdrop').classList.remove('open');
  $('#calculateMarketMedian').onclick=()=>{
    const status=$('#manualMarketStatus');
    const raw=$('#manualMarketPrices').value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
    const parsed=[];
    for(const line of raw){
      let v=line.replace(/R\$/ig,'').replace(/\s/g,'').replace(/[^\d,.-]/g,'');
      if(!v)continue;
      if(v.includes(',')){v=v.replace(/\./g,'').replace(',','.');}
      else if((v.match(/\./g)||[]).length>1 || /\.\d{3}$/.test(v)){v=v.replace(/\./g,'');}
      const n=Number(v);
      if(Number.isFinite(n)&&n>0)parsed.push(Math.round(n*100)/100);
    }
    if(parsed.length===0){status.className='market-config-status error';status.textContent='Insira pelo menos um preço válido, por exemplo: 89,90';return;}
    const sorted=[...parsed].sort((a,b)=>a-b);
    const mid=Math.floor(sorted.length/2);
    const median=sorted.length%2?sorted[mid]:Math.round(((sorted[mid-1]+sorted[mid])/2)*100)/100;
    g.marketEstimate={estimate:median,count:sorted.length,minimum:sorted[0],maximum:sorted[sorted.length-1],requestedCondition:g.condition||'Não informado',confidence:sorted.length>=6?'Boa':sorted.length>=3?'Moderada':'Baixa',researchedAt:todayISO(),searchUrl,selectedPrices:sorted,method:'manual-median'};
    persist();
    $('#modalBackdrop').classList.remove('open');
    renderDetailTab('finance');
    toast(`Mediana calculada: ${money(median)} · ${sorted.length} preço(s)`);
  };
}
function openSgdbSettings(){
  $('#modalTitle').textContent='Conectar ao SteamGridDB';
  $('#editorForm').innerHTML=`<div class="field"><label for="sgdbApiKey">Chave da API</label><input id="sgdbApiKey" type="password" autocomplete="off" spellcheck="false" placeholder="Cole sua chave de API aqui" value="${esc(steamGridDbKey)}"><div class="sgdb-help">A chave é necessária para buscar nomes de jogos e artes. Ela fica salva no armazenamento local deste navegador, não dentro dos registros dos jogos. No HTML local, execute INICIAR_STEAMGRIDDB.bat e mantenha a janela aberta. No site publicado, a integração usa a função Netlify do pacote atualizado; em um deploy estático antigo, ela ainda precisa ser publicada. A busca procura o título e carrega as artes da primeira correspondência; as sugestões permitem trocar de jogo.</div><div class="sgdb-help"><a href="https://www.steamgriddb.com/profile/preferences" target="_blank" rel="noopener noreferrer">Abrir preferências do SteamGridDB para obter a chave ↗</a></div><div class="sgdb-keyline"></div><div class="sgdb-actions"><button class="secondary" type="button" id="sgdbTestKey">Testar conexão</button><button class="secondary" type="button" id="sgdbClearKey">Remover chave</button><span id="sgdbSettingsStatus" class="sgdb-status"></span></div></div><div class="modal-actions"><button class="secondary" type="button" id="cancelEdit">Cancelar</button><button class="primary" type="submit">Salvar conexão</button></div>`;
  $('#modalBackdrop').classList.add('open');
  const status=$('#sgdbSettingsStatus');
  $('#sgdbTestKey').onclick=async()=>{const btn=$('#sgdbTestKey');btn.disabled=true;status.className='sgdb-status';status.textContent='Testando chave...';try{const result=await sgdbRequest('/search/autocomplete/Portal',$('#sgdbApiKey').value);status.className='sgdb-status success';status.textContent='Conexão funcionando! Foram encontrados '+result.length+' resultados de teste.';}catch(e){status.className='sgdb-status error';status.textContent=e.message;}finally{btn.disabled=false;}};
  $('#sgdbClearKey').onclick=()=>{$('#sgdbApiKey').value='';status.className='sgdb-status';status.textContent='A chave será removida ao salvar.';};
  $('#editorForm').onsubmit=e=>{e.preventDefault();steamGridDbKey=$('#sgdbApiKey').value.trim();try{if(steamGridDbKey)localStorage.setItem('estanteSteamGridDBKey',steamGridDbKey);else localStorage.removeItem('estanteSteamGridDBKey');}catch(err){}$('#modalBackdrop').classList.remove('open');toast(steamGridDbKey?'SteamGridDB configurado':'Chave do SteamGridDB removida');};
  $('#cancelEdit').onclick=()=>$('#modalBackdrop').classList.remove('open');
  $('#modalClose').onclick=()=>$('#modalBackdrop').classList.remove('open');
}
function setSgdbStatus(message,kind=''){const el=$('#sgdbCoverStatus');if(el){el.className='sgdb-status'+(kind?' '+kind:'');el.textContent=message;}}
function renderSgdbSuggestions(items){
  const wrap=$('#sgdbSuggestions');if(!wrap)return;
  if(!items.length){wrap.innerHTML='<div class="sgdb-status">Nenhum título encontrado. Você ainda pode digitar o nome manualmente.</div>';return;}
  wrap.innerHTML=items.slice(0,7).map(g=>`<button type="button" class="sgdb-suggestion" data-sgdb-id="${esc(g.id)}" data-sgdb-name="${esc(g.name)}" data-sgdb-date="${esc(g.release_date||'')}"><span>${esc(g.name)}<small>${esc((g.types||[]).join(' · ')||'Jogo')}</small></span><span>Usar ↗</span></button>`).join('');
  wrap.querySelectorAll('[data-sgdb-id]').forEach(btn=>btn.onclick=async()=>{
    activeSgdbGame={id:Number(btn.dataset.sgdbId),name:btn.dataset.sgdbName};
    $('#gtitle').value=activeSgdbGame.name;wrap.innerHTML='';
    const date=Number(btn.dataset.sgdbDate);if(date&&!$('#gyear').value){const year=new Date(date*1000).getFullYear();if(year>1970&&year<2100)$('#gyear').value=year;}
    setSgdbStatus('Buscando artes para '+activeSgdbGame.name+'…');
    await loadSgdbCovers(activeSgdbGame.id);
  });
}
async function searchSgdbTitles(query,showStatus=true){
  const q=String(query||'').trim();if(q.length<2)return [];
  if(!steamGridDbKey){if(showStatus)setSgdbStatus('Para sugestões automáticas, configure primeiro a chave do SteamGridDB.');return [];}
  try{return await sgdbRequest('/search/autocomplete/'+encodeURIComponent(q));}
  catch(e){if(showStatus)setSgdbStatus(e.message,'error');return [];}
}
async function loadSgdbCovers(gameId){
  const wrap=$('#sgdbCoverResults');if(!wrap)return;
  if(!steamGridDbKey){setSgdbStatus('Configure a chave do SteamGridDB para buscar capas.','error');return;}
  wrap.innerHTML='';setSgdbStatus('Carregando capas da SteamGridDB…');
  try{
    let covers=await sgdbRequest('/grids/game/'+encodeURIComponent(gameId)+'?dimensions=600x900&limit=32');
    if(!covers.length)covers=await sgdbRequest('/grids/game/'+encodeURIComponent(gameId)+'?limit=32');
    if(!covers.length){setSgdbStatus('O jogo foi encontrado, mas não há capas verticais disponíveis para essa correspondência. Escolha outro resultado acima ou envie uma imagem local.');return;}
    setSgdbStatus(covers.length+' opções encontradas. Clique em uma capa para selecioná-la.','success');
    wrap.innerHTML='<div class="sgdb-cover-grid">'+covers.slice(0,32).map((art,i)=>`<button type="button" class="sgdb-cover-option ${sgdbChosenCoverUrl===art.url?'selected':''}" data-sgdb-cover="${esc(art.url)}" title="Selecionar capa ${i+1}"><img loading="lazy" src="${esc(art.thumb||art.url)}" alt="Capa ${i+1}" onerror="this.onerror=null;this.src=this.dataset.full;" data-full="${esc(art.url)}"><span>${esc(art.style||art.author?.name||('Arte '+(i+1)))}</span></button>`).join('')+'</div>';
    wrap.querySelectorAll('[data-sgdb-cover]').forEach(btn=>btn.onclick=()=>{
      sgdbChosenCoverUrl=btn.dataset.sgdbCover;
      const preview=$('#gcoverPreview');if(preview)preview.innerHTML=`<img src="${esc(sgdbChosenCoverUrl)}" alt="Prévia da capa SteamGridDB">`;
      const file=$('#gcover');if(file)file.value='';const remove=$('#gremove');if(remove)remove.checked=false;
      wrap.querySelectorAll('.sgdb-cover-option').forEach(item=>item.classList.toggle('selected',item===btn));
      setSgdbStatus('Capa selecionada. Salve o jogo para aplicá-la.','success');
    });
  }catch(e){wrap.innerHTML='';setSgdbStatus(e.message,'error');}
}
function wireSgdbConsolePicker(existingConsole){
 const btn=$('#sgdbFindConsole');if(!btn)return;btn.onclick=async()=>{const name=$('#cname')?.value.trim()||existingConsole?.name||'';const status=$('#sgdbConsoleStatus'),wrap=$('#sgdbConsoleResults');if(!name){status.textContent='Digite o nome do console primeiro.';return;}if(!steamGridDbKey){status.className='sgdb-status error';status.textContent='Configure a chave SteamGridDB primeiro.';return;}btn.disabled=true;status.className='sgdb-status';status.textContent='Buscando títulos e artes relacionadas…';wrap.innerHTML='';try{const matches=await searchSgdbTitles(name,false);if(!matches.length){status.className='sgdb-status error';status.textContent='Nenhum resultado relacionado. Para uma imagem fiel do hardware, envie uma imagem PNG própria.';return;}const artSets=[];for(const m of matches.slice(0,3)){let arts=await sgdbRequest('/grids/game/'+encodeURIComponent(m.id)+'?limit=8');for(const a of arts.slice(0,4))artSets.push({...a,matchName:m.name,matchId:m.id});}if(!artSets.length){status.className='sgdb-status error';status.textContent='Encontramos títulos, mas não há artes disponíveis. Envie uma imagem local.';return;}status.className='sgdb-status';status.textContent='Artes relacionadas — a SteamGridDB não fornece necessariamente fotos do console físico.';wrap.innerHTML='<div class="sgdb-cover-grid">'+artSets.slice(0,12).map((a,i)=>`<button type="button" class="sgdb-cover-option" data-console-art="${esc(a.url)}" title="${esc(a.matchName)}"><img loading="lazy" src="${esc(a.thumb||a.url)}" alt="Arte relacionada ${i+1}"><span>${esc(a.matchName)}</span></button>`).join('')+'</div>';wrap.querySelectorAll('[data-console-art]').forEach(b=>b.onclick=()=>{const url=b.dataset.consoleArt;const preview=$('#ccoverPreview');if(preview)preview.innerHTML=`<img src="${esc(url)}" alt="Arte relacionada da SteamGridDB">`;const hidden=$('#ccoverRemoteUrl')||document.createElement('input');hidden.type='hidden';hidden.id='ccoverRemoteUrl';hidden.name='coverRemoteUrl';hidden.value=url;if(!hidden.parentNode)$('#editorForm').appendChild(hidden);const file=$('#ccover');if(file)file.value='';wrap.querySelectorAll('.sgdb-cover-option').forEach(x=>x.classList.toggle('selected',x===b));status.className='sgdb-status success';status.textContent='Arte selecionada. Salve o console para aplicar.';});}catch(e){status.className='sgdb-status error';status.textContent=e.message||'Falha ao buscar artes.';}finally{btn.disabled=false;}};
}
function wireSgdbGamePicker(game){
  const input=$('#gtitle'),suggestions=$('#sgdbSuggestions');if(!input||!suggestions)return;
  let timer=null;let lookupGeneration=0;
  input.addEventListener('input',()=>{
    activeSgdbGame=null;lookupGeneration++;clearTimeout(timer);suggestions.innerHTML='';
    const query=input.value.trim();if(query.length<2)return;
    timer=setTimeout(async()=>{
      if(!steamGridDbKey){suggestions.innerHTML='<div class="sgdb-status">Configure a chave para ver sugestões de jogos.</div>';return;}
      suggestions.innerHTML='<div class="sgdb-status">Buscando sugestões…</div>';
      const generation=lookupGeneration;const results=await searchSgdbTitles(query,true);
      if($('#gtitle')!==input||generation!==lookupGeneration)return;
      renderSgdbSuggestions(results);
    },350);
  });
  const manualSearch=$('#sgdbFindCovers');if(manualSearch)manualSearch.onclick=async()=>{
    const query=input.value.trim();if(!query){setSgdbStatus('Digite o nome do jogo antes de buscar capas.','error');input.focus();return;}
    if(!steamGridDbKey){setSgdbStatus('Configure sua chave no botão de configurações do SteamGridDB e tente novamente.','error');return;}
    const oldLabel=manualSearch.textContent;manualSearch.disabled=true;manualSearch.classList.add('sgdb-busy');manualSearch.textContent='Buscando capas…';
    const resultsWrap=$('#sgdbCoverResults');if(resultsWrap)resultsWrap.innerHTML='';
    setSgdbStatus(`Buscando “${query}” no SteamGridDB…`);
    try{
      let results;
      if(activeSgdbGame&&String(activeSgdbGame.name||'').toLocaleLowerCase()===query.toLocaleLowerCase())results=[activeSgdbGame];
      else results=await sgdbRequest('/search/autocomplete/'+encodeURIComponent(query));
      if(!results.length){suggestions.innerHTML='<div class="sgdb-status">Nenhum título correspondente encontrado. Confira a grafia ou tente o nome em inglês/japonês. Você ainda pode enviar uma capa local.</div>';setSgdbStatus('Nenhum jogo correspondente encontrado no SteamGridDB.','error');return;}
      renderSgdbSuggestions(results);
      const queryNormalized=query.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
      const best=results.find(x=>String(x.name||'').toLocaleLowerCase()===query.toLocaleLowerCase())
        ||results.find(x=>String(x.name||'').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim()===queryNormalized)
        ||results[0];
      activeSgdbGame={id:Number(best.id),name:String(best.name||query)};
      setSgdbStatus(`Jogo encontrado: ${activeSgdbGame.name}. Buscando artes…`);
      await loadSgdbCovers(activeSgdbGame.id);
      // Leave the alternatives available in the title field and bring the results into view.
      if(results.length>1){const current=$('#sgdbCoverStatus');if(current)current.textContent+=` Há ${results.length} correspondências; escolha outra sugestão acima se esta não for a correta.`;}
      if(resultsWrap)resultsWrap.scrollIntoView({behavior:'smooth',block:'nearest'});
    }catch(error){setSgdbStatus(error?.message||'Não foi possível buscar capas. Confira o serviço local e a chave.','error');}
    finally{manualSearch.disabled=false;manualSearch.classList.remove('sgdb-busy');manualSearch.textContent=oldLabel;}
  };
}
function iconFor(id){let body='';const edge='#d5d5df',dark='#222431',mid='#62667a';
if(id==='ps1')body=`<g transform="translate(17 26)"><path d="M20 27 78 5q6-2 12 2l45 20q8 4 0 9L77 58q-6 3-13 0L20 38q-9-5 0-11Z" fill="#b9bac8"/><path d="m25 27 53-18 49 22-53 22Z" fill="#dfdfeb"/><ellipse cx="78" cy="29" rx="22" ry="11" fill="#9d9fad" stroke="#757889"/><ellipse cx="78" cy="27" rx="18" ry="8" fill="#c9cad7"/><circle cx="119" cy="38" r="3" fill="#53576a"/><circle cx="129" cy="34" r="3" fill="#53576a"/><path d="m30 31 5 2" stroke="#65697a" stroke-width="2"/></g>`;
else if(id==='ps2')body=`<g transform="translate(49 6)"><path d="M20 5Q20 0 26 0h35q6 0 6 6v124q0 6-6 6H26q-6 0-6-6Z" fill="#272a38"/><path d="M26 7h34v121H26Z" fill="#181a25"/><path d="M31 10h3v115h-3Z" fill="#424657"/><path d="M35 14h21v98H35Z" fill="#202330"/><rect x="39" y="17" width="13" height="4" rx="2" fill="#5d6070"/><circle cx="45" cy="119" r="3.3" fill="#a4b5d1"/><rect x="38" y="126" width="15" height="2" rx="1" fill="#3a3d4b"/></g>`;
else if(id==='ps3')body=`<g transform="translate(17 24)"><path d="m9 25 52-19q9-3 17 0l55 20q8 3 0 8L81 58q-8 4-17 0L10 37q-10-5-1-12Z" fill="#232632"/><path d="m15 26 49-17 61 21-48 22Z" fill="#414451"/><path d="m23 29 40-14 49 16-39 18Z" fill="#1b1d28"/><path d="M20 35 62 50" stroke="#757988" stroke-width="1.4"/><circle cx="113" cy="32" r="2" fill="#90c5fb"/></g>`;
else if(id==='ps4')body=`<g transform="translate(24 25)"><path d="m12 24 68-18 43 17-67 24Z" fill="#232735"/><path d="m12 24 44 23v12L12 36Z" fill="#11141e"/><path d="m56 47 67-24v12L56 60Z" fill="#353a49"/><path d="m18 26 59-16 34 13-59 20Z" fill="#454b5d"/><path d="m24 29 49-13" stroke="#7b8293" stroke-width="1.2"/></g>`;
else if(id==='ps5')body=`<g transform="translate(38 7)"><path d="M33 5Q20 0 15 12L6 32l8 89q2 10 12 9l12-5V8Z" fill="#edf0f6"/><path d="M49 5Q62 0 67 12l9 20-8 89q-2 10-12 9l-12-5V8Z" fill="#f8f8fc"/><path d="M34 7h15v122H34Z" fill="#171b2b"/><path d="M35 12h13v3H35Z" fill="#3a4057"/><circle cx="41" cy="119" r="2" fill="#8d9bf7"/></g>`;
else if(id==='switch'||id==='switch2')body=`<g transform="translate(20 23)"><rect x="7" y="4" width="120" height="76" rx="10" fill="#242936" stroke="#626a7d"/><rect x="18" y="10" width="98" height="64" rx="3" fill="#101722"/><rect x="0" y="0" width="20" height="84" rx="8" fill="${id==='switch'?'#f14b67':'#29bde7'}"/><rect x="114" y="0" width="20" height="84" rx="8" fill="${id==='switch'?'#35cfe0':'#f25a60'}"/><circle cx="10" cy="16" r="4" fill="#ffcbd4" opacity=".8"/><circle cx="10" cy="66" r="3" fill="#ffcbd4" opacity=".8"/><path d="M5 35h10M10 30v10" stroke="#ffcbd4" stroke-width="2"/><circle cx="124" cy="17" r="4" fill="#ffd3d7" opacity=".8"/><circle cx="119" cy="54" r="2.5" fill="#ffd3d7"/><circle cx="129" cy="54" r="2.5" fill="#ffd3d7"/><circle cx="124" cy="49" r="2.5" fill="#ffd3d7"/><circle cx="124" cy="59" r="2.5" fill="#ffd3d7"/></g>`;
else if(id==='wii')body=`<g transform="translate(52 9)"><rect x="8" y="0" width="53" height="128" rx="7" fill="#e8ebf1"/><rect x="15" y="9" width="39" height="93" rx="3" fill="#f8f9fb"/><rect x="19" y="14" width="31" height="4" rx="2" fill="#b1b7c5"/><circle cx="35" cy="114" r="5" fill="#bbc4d2"/><rect x="22" y="124" width="26" height="2" rx="1" fill="#c6ccd8"/></g>`;
else if(id==='gamecube')body=`<g transform="translate(37 26)"><path d="m17 17 29-15 51 19-32 17Z" fill="#8881cd"/><path d="m17 17 48 21v37L17 55Z" fill="#4b4386"/><path d="m65 38 32-17v37L65 75Z" fill="#6259ab"/><path d="m27 21 19-10 40 15-21 11Z" fill="#7770b9"/><circle cx="43" cy="47" r="7" fill="#342b71" stroke="#9e95ec"/></g>`;
else if(id==='ds')body=`<g transform="translate(40 17)"><rect x="8" y="0" width="76" height="53" rx="8" fill="#cfd4e0" stroke="#929bad"/><rect x="17" y="7" width="58" height="38" rx="3" fill="#30374e"/><path d="M20 54h52" stroke="#e2e5ed" stroke-width="4"/><rect x="0" y="52" width="92" height="66" rx="9" fill="#d9deea" stroke="#939bae"/><rect x="10" y="59" width="72" height="43" rx="3" fill="#202a40"/><circle cx="14" cy="109" r="2" fill="#7d8498"/><circle cx="77" cy="109" r="2" fill="#7d8498"/></g>`;
else if(id==='psp'||id==='vita')body=`<g transform="translate(17 37)"><rect x="0" y="0" width="139" height="59" rx="17" fill="#292d3a" stroke="#62687b"/><rect x="34" y="7" width="72" height="43" rx="3" fill="#121927"/><rect x="38" y="11" width="64" height="35" rx="2" fill="#253c55"/><circle cx="16" cy="17" r="5" fill="#62697a"/><path d="M16 27v12M10 33h12" stroke="#c3c8d5" stroke-width="3"/><circle cx="121" cy="16" r="3.5" fill="#a0a7ba"/><circle cx="129" cy="25" r="3.5" fill="#a0a7ba"/><circle cx="113" cy="25" r="3.5" fill="#a0a7ba"/><circle cx="121" cy="34" r="3.5" fill="#a0a7ba"/></g>`;
else if(id==='xbox'||id==='seriesx')body=`<g transform="translate(48 7)"><rect x="9" y="0" width="56" height="130" rx="8" fill="#202a28" stroke="#5a6b5b"/><rect x="17" y="9" width="40" height="103" rx="3" fill="#18211f"/><circle cx="37" cy="17" r="4" fill="#89d86d"/><path d="M23 30 51 56M51 30 23 56" stroke="#405248" stroke-width="2"/><rect x="25" y="118" width="23" height="3" rx="2" fill="#7bc768"/></g>`;
else body=`<g transform="translate(25 13)"><rect x="7" y="0" width="117" height="83" rx="9" fill="#333748" stroke="#687084"/><rect x="15" y="8" width="101" height="68" rx="3" fill="#0d121d"/><path d="M0 89h131l-12 13H12Z" fill="#6b7185"/><path d="M55 91h22" stroke="#c8cfde" stroke-width="2"/><rect x="64" y="102" width="6" height="19" fill="#a1a9bb"/><path d="M42 122h53" stroke="#a1a9bb" stroke-width="5" stroke-linecap="round"/></g>`;
return `<svg viewBox="0 0 180 150" aria-hidden="true">${body}</svg>`}
function miniIcon(c){return `<div class="tiny-console" style="--tile:${c.color}19">${c.coverImage?`<img class="mini-cover-image" src="${esc(c.coverImage)}" alt="">`:iconFor(c.id)}</div>`}
function allGames(){return consoles.flatMap(c=>c.games.map((g,i)=>({...g,consoleId:c.id,consoleName:c.name,gameIndex:i})));}
function totalGames(){return consoles.reduce((n,c)=>n+c.games.length,0)}
function brandTagClass(brand){const b=String(brand||'').toLowerCase();if(b.includes('nintendo'))return 'brand-nintendo';if(b.includes('sony')||b.includes('playstation'))return 'brand-playstation';if(b.includes('xbox'))return 'brand-xbox';if(b.includes('sega'))return 'brand-sega';if(b.includes('computador')||b==='pc'||b.includes('computer'))return 'brand-computer';return 'brand-other';}
function profileInitials(){const base=(profile.nickname||profile.displayName||'Minha coleção').trim();const bits=base.split(/\s+/).filter(Boolean);return bits.length>1?(bits[0][0]+bits[1][0]).toUpperCase():base.slice(0,2).toUpperCase();}
function updateProfileBadge(){const b=$('#profileButton');if(!b)return;b.innerHTML=profile.avatarImage?`<img class="profile-avatar-image" src="${esc(profile.avatarImage)}" alt="">`:esc(profileInitials());b.title=`Configurar perfil${profile.nickname?' de '+profile.nickname:''}`;b.setAttribute('aria-label',b.title);document.documentElement.style.setProperty('--purple',profile.accentColor||'#a855f7');}
function openMobileSidebar(){const app=$('#app'),toggle=$('#mobileLibraryToggle');app.classList.add('mobile-sidebar-open');document.body.classList.add('mobile-library-open');if(toggle)toggle.setAttribute('aria-expanded','true');}
function closeMobileSidebar(){const app=$('#app'),toggle=$('#mobileLibraryToggle');app.classList.remove('mobile-sidebar-open');document.body.classList.remove('mobile-library-open');if(toggle)toggle.setAttribute('aria-expanded','false');}
function renderSidebarState(){const app=$('#app');app.classList.toggle('sidebar-collapsed',sidebarCollapsed);const b=$('#sidebarToggle');if(b){b.textContent=sidebarCollapsed?'⇥':'⇤';b.title=sidebarCollapsed?'Expandir barra lateral':'Minimizar barra lateral';b.setAttribute('aria-label',b.title);}}
function renderSidebar(){const list=$('#consoleList');list.innerHTML=consoles.map(c=>`<button class="consolelink ${currentView==='console'&&currentConsole===c.id?'active':''}" data-console="${esc(c.id)}" title="${esc(c.name)} · ${c.games.length} jogos" aria-label="${esc(c.name)}">${miniIcon(c)}<span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c.name)}</span><span style="margin-left:auto;color:#77768e;font-size:10px">${c.games.length}</span></button>`).join('');list.querySelectorAll('[data-console]').forEach(b=>b.onclick=()=>selectConsole(b.dataset.console));renderSidebarState();}
function renderStats(){
 const games=allGames();
 const completed=games.filter(g=>['Concluído','100%'].includes(normalizeGameStatus(g.status))).length;
 const playing=games.filter(g=>normalizeGameStatus(g.status)==='Jogando').length;
 const paidGames=games.filter(g=>hasMoneyValue(g.pricePaid));
 const totalPaid=paidGames.reduce((n,g)=>n+Number(g.pricePaid),0);
 const stats=[
  ['Jogos na coleção',games.length,'Em todas as plataformas','#28d9e8','#28d9e81b','▤'],
  ['Jogando agora',playing,'Seu momento atual','#a855f7','#a855f71b','▶'],
  ['Concluídos',completed,'Concluído ou 100%','#c7f464','#c7f4641b','✓'],
  ['Total investido',money(totalPaid),`${paidGames.length} jogos com preço registrado`,'#ff805c','#ff805c1b','$']
 ];
 $('#stats').innerHTML=stats.map(v=>`<div class="stat" style="--glow:${v[3]};--accent:${v[3]};--icbg:${v[4]}"><div class="stat-head"><span>${v[0]}</span><span class="stat-ic">${v[5]}</span></div><div class="stat-number" style="font-size:${String(v[1]).startsWith('R$')?'clamp(16px,1.8vw,23px)':'28px'}">${v[1]}</div><div class="stat-note">${v[2]}</div></div>`).join('');
}
function yearBucket(year){
 const y=Number(year);if(!y)return 'unknown';if(y<1980)return 'pre80';if(y<1990)return '80s';if(y<2000)return '90s';if(y<2010)return '00s';if(y<2020)return '10s';return '20s';
}
function yearBucketLabel(key){return ({pre80:'Até 1979','80s':'Anos 80','90s':'Anos 90','00s':'Anos 2000','10s':'Anos 2010','20s':'2020 em diante',unknown:'Ano não informado'})[key]||key;}
function selectOptions(items,current,allLabel){return `<option value="all">${allLabel}</option>${items.map(item=>`<option value="${esc(item)}" ${current===item?'selected':''}>${esc(item)}</option>`).join('')}`;}
function renderPlatformCards(items=consoles){
 const content=$('#mainContent');let filtered=[...items];
 if(platformFilters.brand!=='all')filtered=filtered.filter(c=>c.brand===platformFilters.brand);
 if(platformFilters.type!=='all')filtered=filtered.filter(c=>c.type===platformFilters.type);
 if(platformFilters.era!=='all')filtered=filtered.filter(c=>yearBucket(c.year)===platformFilters.era);
 if(platformFilters.sort==='games')filtered.sort((a,b)=>b.games.length-a.games.length||a.name.localeCompare(b.name,'pt-BR'));
 else if(platformFilters.sort==='oldest')filtered.sort((a,b)=>(Number(a.year)||9999)-(Number(b.year)||9999)||a.name.localeCompare(b.name,'pt-BR'));
 else if(platformFilters.sort==='newest')filtered.sort((a,b)=>(Number(b.year)||0)-(Number(a.year)||0)||a.name.localeCompare(b.name,'pt-BR'));
 else filtered.sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
 const brands=[...new Set(consoles.map(c=>c.brand).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
 const types=[...new Set(consoles.map(c=>c.type).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
 content.innerHTML=`
  <div class="section-head library-section-head"><div><h2>Plataformas</h2><p>${filtered.length} de ${items.length} ${items.length===1?'plataforma':'plataformas'} · selecione uma para abrir sua biblioteca</p></div><span class="library-count-pill">${filtered.length} resultado${filtered.length===1?'':'s'}</span></div>
  <div class="library-toolbar" aria-label="Filtros de plataformas">
   <label class="library-filter"><span>Fabricante</span><select id="platformBrandFilter">${selectOptions(brands,platformFilters.brand,'Todos')}</select></label>
   <label class="library-filter"><span>Tipo</span><select id="platformTypeFilter">${selectOptions(types,platformFilters.type,'Todos')}</select></label>
   <label class="library-filter"><span>Época</span><select id="platformEraFilter"><option value="all">Todas</option>${['pre80','80s','90s','00s','10s','20s','unknown'].map(k=>`<option value="${k}" ${platformFilters.era===k?'selected':''}>${yearBucketLabel(k)}</option>`).join('')}</select></label>
   <label class="library-filter library-sort"><span>Ordenar por</span><select id="platformSortFilter"><option value="name" ${platformFilters.sort==='name'?'selected':''}>Nome (A–Z)</option><option value="games" ${platformFilters.sort==='games'?'selected':''}>Mais jogos</option><option value="oldest" ${platformFilters.sort==='oldest'?'selected':''}>Mais antigo</option><option value="newest" ${platformFilters.sort==='newest'?'selected':''}>Mais recente</option></select></label>
   <button class="filter-reset" id="resetPlatformFilters" type="button">Limpar filtros</button>
  </div>
  <div class="platform-grid" id="platformGrid">${filtered.length?filtered.map(c=>`<article class="platform-card" data-platform="${esc(c.id)}" style="--accent:${c.color}"><div class="card-top"><span class="platform-pill ${brandTagClass(c.brand)}"><span>●</span>${esc(c.brand)}</span><button class="dots" aria-label="Editar plataforma" data-options="${esc(c.id)}" title="Editar plataforma">···</button></div><div class="console-art">${c.coverImage?`<img class="console-cover-image" src="${esc(c.coverImage)}" alt="Imagem de ${esc(c.name)}">`:iconFor(c.id)}</div><div class="card-bottom"><div><div class="platform-name">${esc(c.name)}</div><div class="platform-meta">${c.year?c.year+' · ':''}${esc(c.type)}</div></div><div class="gamecount">${c.games.length}<small>${c.games.length===1?'JOGO':'JOGOS'}</small></div></div></article>`).join(''):'<div class="empty collection-empty"><div class="empty-icon">▦</div><h3>Sua coleção começa aqui</h3><p>Cadastre um console ou plataforma para organizar os jogos que você possui. Você pode adicionar uma imagem, ano e fabricante.</p><button class="primary" type="button" id="emptyAddPlatform">＋ Adicionar primeiro console</button></div>'}</div>`;
 const rerender=()=>renderPlatformCards(items);
 $('#platformBrandFilter').onchange=e=>{platformFilters.brand=e.target.value;rerender();};
 $('#platformTypeFilter').onchange=e=>{platformFilters.type=e.target.value;rerender();};
 $('#platformEraFilter').onchange=e=>{platformFilters.era=e.target.value;rerender();};
 $('#platformSortFilter').onchange=e=>{platformFilters.sort=e.target.value;rerender();};
 $('#resetPlatformFilters').onclick=()=>{platformFilters={brand:'all',type:'all',era:'all',sort:'name'};rerender();};
 const emptyAdd=$('#emptyAddPlatform');if(emptyAdd)emptyAdd.onclick=()=>openEditor('console');
 content.querySelectorAll('[data-platform]').forEach(el=>el.onclick=()=>selectConsole(el.dataset.platform));
 content.querySelectorAll('[data-options]').forEach(el=>el.onclick=e=>{e.stopPropagation();openEditor('console',el.dataset.options);});
}
function renderGameCards(games){
 const content=$('#mainContent');let filtered=[...games];
 const hasPlatformFilter=currentView==='allgames';
 if(libraryGameFilters.status==='playing')filtered=filtered.filter(g=>g.status==='Jogando');
 else if(libraryGameFilters.status==='queue')filtered=filtered.filter(g=>normalizeGameStatus(g.status)==='Backlog');
 else if(libraryGameFilters.status==='completed')filtered=filtered.filter(g=>['Concluído','100%'].includes(normalizeGameStatus(g.status)));
 else if(libraryGameFilters.status==='100')filtered=filtered.filter(g=>g.status==='100%');
 else if(libraryGameFilters.status==='abandoned')filtered=filtered.filter(g=>g.status==='Abandonado');
 if(libraryGameFilters.condition!=='all')filtered=filtered.filter(g=>(g.condition||'Não informado')===libraryGameFilters.condition);
 if(hasPlatformFilter&&libraryGameFilters.platform!=='all')filtered=filtered.filter(g=>g.consoleId===libraryGameFilters.platform);
 if(libraryGameFilters.genre!=='all')filtered=filtered.filter(g=>(g.genre||'Sem gênero')===libraryGameFilters.genre);
 if(libraryGameFilters.era!=='all')filtered=filtered.filter(g=>yearBucket(g.year)===libraryGameFilters.era);
 if(searchTerm)filtered=filtered.filter(g=>([g.title,currentView==='console'?'':g.consoleName,g.genre,g.status,g.notes].filter(Boolean).join(' ')).toLocaleLowerCase().includes(searchTerm));
 const priceSort=v=>hasMoneyValue(v)?Number(v):Number.POSITIVE_INFINITY;
 if(libraryGameFilters.sort==='title-desc')filtered.sort((a,b)=>b.title.localeCompare(a.title,'pt-BR'));
 else if(libraryGameFilters.sort==='oldest')filtered.sort((a,b)=>(Number(a.year)||9999)-(Number(b.year)||9999)||a.title.localeCompare(b.title,'pt-BR'));
 else if(libraryGameFilters.sort==='newest')filtered.sort((a,b)=>(Number(b.year)||0)-(Number(a.year)||0)||a.title.localeCompare(b.title,'pt-BR'));
 else if(libraryGameFilters.sort==='platform')filtered.sort((a,b)=>a.consoleName.localeCompare(b.consoleName,'pt-BR')||a.title.localeCompare(b.title,'pt-BR'));
 else if(libraryGameFilters.sort==='paid')filtered.sort((a,b)=>priceSort(a.pricePaid)-priceSort(b.pricePaid)||a.title.localeCompare(b.title,'pt-BR'));
 else filtered.sort((a,b)=>a.title.localeCompare(b.title,'pt-BR'));
 const genres=[...new Set(allGames().map(g=>(g.genre||'Sem gênero').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
 const platformOptions=consoles.slice().sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
 const sourceCount=games.length;
 const activeFilter=libraryGameFilters.status!=='all'||libraryGameFilters.condition!=='all'||(hasPlatformFilter&&libraryGameFilters.platform!=='all')||libraryGameFilters.genre!=='all'||libraryGameFilters.era!=='all'||libraryGameFilters.sort!=='title';
 const label=currentView==='allgames'?'Todos os jogos':`Jogos de ${esc(consoles.find(c=>c.id===currentConsole)?.name||'')}`;
 content.innerHTML=`
  <div class="section-head library-section-head"><div><h2>${label}</h2><p>${filtered.length} de ${sourceCount} ${sourceCount===1?'jogo':'jogos'} · escolha filtros para encontrar algo mais rápido</p></div><span class="library-count-pill">${filtered.length} jogo${filtered.length===1?'':'s'}</span></div>
  <div class="library-toolbar game-library-toolbar" aria-label="Filtros de jogos">
   <label class="library-filter"><span>Situação</span><select id="gameStatusFilter"><option value="all" ${libraryGameFilters.status==='all'?'selected':''}>Todas</option><option value="playing" ${libraryGameFilters.status==='playing'?'selected':''}>Jogando</option><option value="queue" ${libraryGameFilters.status==='queue'?'selected':''}>Na fila</option><option value="completed" ${libraryGameFilters.status==='completed'?'selected':''}>Concluídos</option><option value="100" ${libraryGameFilters.status==='100'?'selected':''}>100%</option><option value="abandoned" ${libraryGameFilters.status==='abandoned'?'selected':''}>Abandonados</option></select></label>
   <label class="library-filter"><span>Condição</span><select id="gameConditionFilter">${selectOptions([...new Set(allGames().map(g=>g.condition||'Não informado'))].sort((a,b)=>a.localeCompare(b,'pt-BR')),libraryGameFilters.condition,'Todas')}</select></label>
   ${hasPlatformFilter?`<label class="library-filter"><span>Plataforma</span><select id="gamePlatformFilter"><option value="all">Todas</option>${platformOptions.map(c=>`<option value="${esc(c.id)}" ${libraryGameFilters.platform===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select></label>`:''}
   <label class="library-filter"><span>Gênero</span><select id="gameGenreFilter">${selectOptions(genres,libraryGameFilters.genre,'Todos')}</select></label>
   <label class="library-filter"><span>Época</span><select id="gameEraFilter"><option value="all">Todas</option>${['pre80','80s','90s','00s','10s','20s','unknown'].map(k=>`<option value="${k}" ${libraryGameFilters.era===k?'selected':''}>${yearBucketLabel(k)}</option>`).join('')}</select></label>
   <label class="library-filter library-sort"><span>Ordenar por</span><select id="gameSortFilter"><option value="title" ${libraryGameFilters.sort==='title'?'selected':''}>Título (A–Z)</option><option value="title-desc" ${libraryGameFilters.sort==='title-desc'?'selected':''}>Título (Z–A)</option><option value="oldest" ${libraryGameFilters.sort==='oldest'?'selected':''}>Mais antigo</option><option value="newest" ${libraryGameFilters.sort==='newest'?'selected':''}>Mais recente</option><option value="platform" ${libraryGameFilters.sort==='platform'?'selected':''}>Plataforma</option><option value="paid" ${libraryGameFilters.sort==='paid'?'selected':''}>Preço pago</option></select></label>
   ${activeFilter?'<button class="filter-reset" id="resetGameFilters" type="button">Limpar filtros</button>':''}
  </div>
  <div class="game-grid" id="gameGrid">${filtered.length?filtered.map(g=>`
   <article class="game-card" data-game="${esc(g.consoleId)}" data-index="${g.gameIndex}" style="--cover:${g.cover||'linear-gradient(145deg,#2b2141,#72508f)'}">
     <div class="game-art ${g.coverImage?'has-image':''}">${g.coverImage?`<img class="game-cover-image" src="${esc(g.coverImage)}" alt="Capa de ${esc(g.title)}">`:`<span class="game-glyph">${esc(g.glyph||g.title.slice(0,3).toUpperCase())}</span>`}<span class="game-year">${g.year||'SEM DATA'}</span></div>
     <div class="game-info"><div class="game-title-row"><div class="game-title" title="${esc(g.title)}">${esc(g.title)}</div><div class="game-menu-wrap"><button class="game-menu-trigger" type="button" data-game-menu-toggle aria-label="Opções de ${esc(g.title)}" aria-haspopup="menu" aria-expanded="false" title="Opções do jogo">⋯</button><div class="game-menu" role="menu"><button type="button" class="game-menu-action" data-game-action="open" role="menuitem">Abrir ficha</button><button type="button" class="game-menu-action" data-game-action="rename" role="menuitem">Renomear</button><button type="button" class="game-menu-action game-menu-action-danger" data-game-action="delete" role="menuitem">Mover para lixeira</button></div></div></div><div class="game-sub"><span>${esc(g.consoleName)}</span><span>${esc(g.genre||'Jogo')}</span></div>
       <div class="game-card-bottom"><span class="game-status ${g.status==='Backlog'?'backlog':''}">${esc(g.status||'Backlog')}</span>${hasMoneyValue(g.pricePaid)?`<span class="game-list-price">Pago ${money(g.pricePaid)}</span>`:''}</div>
     </div>
   </article>`).join(''):`<div class="empty collection-empty"><div class="empty-icon">＋</div><h3>${consoles.length?'Sua biblioteca está vazia':'Adicione um console primeiro'}</h3><p>${consoles.length?'Cadastre seu primeiro jogo para começar a montar a coleção. Você poderá guardar capa, plataforma, progresso e detalhes da edição.':'Crie uma plataforma na seção Plataformas. Depois, você poderá adicionar jogos a ela e organizar sua coleção.'}</p><button class="primary" type="button" id="emptyAddGame">＋ ${consoles.length?'Adicionar primeiro jogo':'Adicionar primeiro console'}</button></div>`}</div>`;
 const emptyAddGame=$('#emptyAddGame');if(emptyAddGame)emptyAddGame.onclick=()=>consoles.length?openEditor('game'):openEditor('console');
 const getSourceGames=()=>currentView==='allgames'?allGames():(()=>{const c=consoles.find(c=>c.id===currentConsole);return c?c.games.map((g,i)=>({...g,consoleId:c.id,consoleName:c.name,gameIndex:i})):[]})();
 const rerender=()=>renderGameCards(getSourceGames());
 $('#gameStatusFilter').onchange=e=>{libraryGameFilters.status=e.target.value;rerender();};
 $('#gameConditionFilter').onchange=e=>{libraryGameFilters.condition=e.target.value;rerender();};
 if($('#gamePlatformFilter'))$('#gamePlatformFilter').onchange=e=>{libraryGameFilters.platform=e.target.value;rerender();};
 $('#gameGenreFilter').onchange=e=>{libraryGameFilters.genre=e.target.value;rerender();};
 $('#gameEraFilter').onchange=e=>{libraryGameFilters.era=e.target.value;rerender();};
 $('#gameSortFilter').onchange=e=>{libraryGameFilters.sort=e.target.value;rerender();};
 const reset=$('#resetGameFilters');if(reset)reset.onclick=()=>{libraryGameFilters={status:'all',condition:'all',platform:'all',genre:'all',era:'all',sort:'title'};rerender();};
 const closeMenu=(card)=>{const wrap=card?.querySelector('.game-menu-wrap');if(wrap){wrap.classList.remove('open');const trigger=wrap.querySelector('[data-game-menu-toggle]');if(trigger)trigger.setAttribute('aria-expanded','false');}if(card)card.style.zIndex='';};
 content.querySelectorAll('[data-game-menu-toggle]').forEach(trigger=>trigger.onclick=e=>{
   e.preventDefault();e.stopPropagation();
   const card=trigger.closest('.game-card');const wrap=trigger.closest('.game-menu-wrap');
   const wasOpen=wrap.classList.contains('open');
   content.querySelectorAll('.game-card').forEach(other=>{const w=other.querySelector('.game-menu-wrap');if(w){w.classList.remove('open');const t=w.querySelector('[data-game-menu-toggle]');if(t)t.setAttribute('aria-expanded','false');other.style.zIndex='';}});
   if(!wasOpen){wrap.classList.add('open');trigger.setAttribute('aria-expanded','true');card.style.zIndex='30';}
 });
 content.querySelectorAll('.game-menu-action').forEach(actionButton=>actionButton.onclick=e=>{
   e.preventDefault();e.stopPropagation();
   const card=actionButton.closest('.game-card');const consoleId=card?.dataset.game;const gameIndex=Number(card?.dataset.index);const targetConsole=consoles.find(item=>item.id===consoleId);const targetGame=targetConsole?.games[gameIndex];
   if(!targetConsole||!targetGame){closeMenu(card);toast('Não consegui encontrar este jogo na coleção.');return;}
   const action=actionButton.dataset.gameAction;closeMenu(card);
   if(action==='open'){openGameDetail(targetConsole,targetGame);return;}
   if(action==='rename'){
     const previousTitle=targetGame.title;const previousGlyph=targetGame.glyph;
     const answer=window.prompt('Renomear jogo:',previousTitle||'');
     if(answer===null)return;
     const nextTitle=answer.trim();
     if(!nextTitle){toast('O título não pode ficar vazio.');return;}
     if(nextTitle===previousTitle)return;
     targetGame.title=nextTitle;targetGame.glyph=(nextTitle.match(/[A-ZÀ-Ý0-9]/gi)||[nextTitle.slice(0,3).toUpperCase()]).slice(0,4).join('').toUpperCase();
     if(!persist()){targetGame.title=previousTitle;targetGame.glyph=previousGlyph;return;}
     renderStats();rerender();toast('Jogo renomeado.');return;
   }
   if(action==='delete'){
     void estanteMoveGameToTrash(targetConsole,gameIndex);
   }
 });
 content.querySelectorAll('[data-game]').forEach(el=>el.onclick=e=>{if(e.target.closest('.game-menu-wrap'))return;const c=consoles.find(c=>c.id===el.dataset.game);const g=c?.games[Number(el.dataset.index)];if(g)openGameDetail(c,g);});
}

// Fecha os menus rápidos quando o usuário clica fora ou pressiona Esc.
document.addEventListener('click',e=>{
  if(e.target.closest('.game-menu-wrap'))return;
  document.querySelectorAll('.game-menu-wrap.open').forEach(w=>{w.classList.remove('open');const trigger=w.querySelector('[data-game-menu-toggle]');if(trigger)trigger.setAttribute('aria-expanded','false');});
  document.querySelectorAll('.game-card').forEach(card=>{card.style.zIndex='';});
});
document.addEventListener('keydown',e=>{
  if(e.key!=='Escape')return;
  document.querySelectorAll('.game-menu-wrap.open').forEach(w=>{w.classList.remove('open');const trigger=w.querySelector('[data-game-menu-toggle]');if(trigger){trigger.setAttribute('aria-expanded','false');trigger.focus();}});
  document.querySelectorAll('.game-card').forEach(card=>{card.style.zIndex='';});
});
function render(){
  setSearchContext(currentView);
  renderSidebarState();updateProfileBadge();updateWishlistBadge();
  $('#app').classList.remove('is-game-detail');document.querySelector('.hero').style.display='';$('#stats').style.display='';$('.footer-note').style.display='';
  renderSidebar();renderStats();const selected=consoles.find(c=>c.id===currentConsole);
  if(currentView==='platforms'){
    currentConsole=null;$('#breadcrumb').textContent='Plataformas';$('#heroEyebrow').textContent='Seu arquivo de jogos';$('#pageTitle').innerHTML='Sua estante<span style="color:var(--orange)">.</span>';
    $('#pageDescription').textContent=(profile.nickname?`Oi, ${profile.nickname}! `:'')+'Organize os consoles da sua coleção e abra cada um para ver os jogos cadastrados.';
    $('#heroAction').textContent='＋  Adicionar console';$('#heroAction').onclick=()=>openEditor('console');
    const filtered=consoles.filter(c=>!searchTerm||(c.name+' '+c.brand+' '+c.type).toLowerCase().includes(searchTerm));renderPlatformCards(filtered);
    $('#stats').style.display='';$('#addGameTop').style.display='';$('#addGameTop').title='Adicionar jogo';$('#addGameTop').onclick=()=>consoles.length?openEditor('game'):openEditor('console');
  }else if(currentView==='allgames'){
    currentConsole=null;$('#breadcrumb').textContent='Todos os jogos';$('#heroEyebrow').textContent='Sua biblioteca';$('#pageTitle').innerHTML='Todos os jogos<span style="color:var(--blue)">.</span>';
    $('#pageDescription').textContent='Sua biblioteca em um só lugar. Filtre por plataforma, gênero ou época, abra uma ficha para ver detalhes e atualize seu progresso sem complicação.';
    $('#heroAction').textContent='＋  Adicionar jogo';$('#heroAction').onclick=()=>consoles.length?openEditor('game'):openEditor('console');renderGameCards(allGames());
    $('#stats').style.display='';$('#addGameTop').style.display='';$('#addGameTop').title='Adicionar jogo';$('#addGameTop').onclick=()=>consoles.length?openEditor('game'):openEditor('console');
  }else if(currentView==='wishlist'){
    currentConsole=null;$('#breadcrumb').textContent='Wishlist';$('#heroEyebrow').textContent='Lista de desejos';$('#pageTitle').innerHTML='Próximos achados<span style="color:var(--pink)">.</span>';
    $('#pageDescription').textContent='Jogos, consoles e acessórios que você quer encontrar. Compare ofertas, prioridade e preço-alvo em um só lugar.';
    $('#heroAction').textContent='＋  Adicionar à wishlist';$('#heroAction').onclick=()=>openWishlistEditor();$('#stats').style.display='none';renderWishlist();
    $('#addGameTop').style.display='';$('#addGameTop').title='Adicionar à wishlist';$('#addGameTop').onclick=()=>openWishlistEditor();
  }else if(selected){
    $('#breadcrumb').textContent=selected.short;$('#heroEyebrow').textContent=selected.brand+' · '+selected.type;$('#pageTitle').innerHTML=esc(selected.name)+'<span style="color:'+selected.color+'">.</span>';
    $('#pageDescription').textContent=`Sua biblioteca de ${selected.name}. ${selected.games.length} ${selected.games.length===1?'jogo registrado':'jogos registrados'} nesta plataforma.`;
    $('#heroAction').textContent='＋  Adicionar jogo';$('#heroAction').onclick=()=>openEditor('game',selected.id);renderGameCards(selected.games.map((g,i)=>({...g,consoleId:selected.id,consoleName:selected.name,gameIndex:i})));
    $('#stats').style.display='';$('#addGameTop').style.display='';$('#addGameTop').title='Adicionar jogo';$('#addGameTop').onclick=()=>openEditor('game',currentConsole||undefined);
  }else{currentView='platforms';render();return;}
  document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===currentView));
}
function selectConsole(id){closeMobileSidebar();currentConsole=id;currentView='console';gameFilter='all';searchTerm='';$('#searchInput').value='';render();window.scrollTo({top:0,behavior:'smooth'});}
function openGameDetail(c,g){
 const cover=g.cover||'linear-gradient(145deg,#29203b,#71528b)';
 const auth=g.authenticity||'Não verificado';
 const condition=g.condition||'Condição não informada';
 const completeness=g.completeness||'Conteúdo não informado';
 const authClass=auth==='Pirata'?'is-counterfeit':auth==='Original'?'is-original':'';
 // A ficha do jogo passa a ocupar o foco da tela; os painéis globais ficam fora do caminho.
 $('#app').classList.add('is-game-detail');
 document.querySelector('.hero').style.display='none';
 $('#stats').style.display='none';
 $('.footer-note').style.display='none';
 $('#breadcrumb').textContent=g.title;
 const coverMarkup=g.coverImage?`<img src="${esc(g.coverImage)}" alt="Capa de ${esc(g.title)}">`:`<div class="detail-cover-fallback" style="background:${cover}"><span>${esc(g.glyph||g.title.slice(0,3).toUpperCase())}</span></div>`;
 $('#mainContent').innerHTML=`
   <div class="detail-backbar"><button class="detail-back-button" id="backToGamesTop" type="button">← &nbsp;Voltar à biblioteca</button><span style="font-size:11px;color:#77768d">Ficha da sua cópia</span></div>
   <section class="game-detail-hero">
     <div class="detail-cover-large">${coverMarkup}</div>
     <div class="detail-hero-copy">
       <div class="detail-kicker"><span class="detail-kicker-dot"></span>${esc(c.name)} <span class="detail-kicker-sep">/</span> ${esc(g.genre||'Jogo')}</div>
       <h1 class="detail-game-title inline-editable" tabindex="0" role="button" data-inline-field="title" data-inline-kind="text" title="Clique para editar o título">${esc(g.title)}</h1>
       <p class="detail-game-meta">${g.year?'Lançado em '+g.year:'Ano não informado'} <span>·</span> ${esc(g.status||'Backlog')}</p>
       <div class="detail-hero-tags"><span class="detail-chip status-chip">${esc(g.status||'Backlog')}</span><span class="detail-chip ${authClass}">${esc(auth)}</span><span class="detail-chip">${esc(condition)}</span></div>
       <div class="detail-hero-actions"><button class="secondary" id="editThisGame">Mais opções</button></div>
       <div class="detail-hero-hint">Sua cópia · dados e valores registrados por você</div>
     </div>
   </section>
   <nav class="game-detail-tabs" role="tablist" aria-label="Informações do jogo">
     <button class="detail-tab active" role="tab" aria-selected="true" data-detail-tab="overview">Resumo</button>
     <button class="detail-tab" role="tab" aria-selected="false" data-detail-tab="finance">Valores</button>
     <button class="detail-tab" role="tab" aria-selected="false" data-detail-tab="condition">Estado e notas</button>
     <button class="detail-tab" role="tab" aria-selected="false" data-detail-tab="collector">Colecionador</button>
   </nav>
   <section id="gameDetailPanel" class="game-detail-panel" role="tabpanel" aria-live="polite"></section>`;

 const paidKnown=hasMoneyValue(g.pricePaid), marketKnown=hasMoneyValue(g.marketValue);
 const delta=paidKnown&&marketKnown?Number(g.marketValue)-Number(g.pricePaid):null;
 const deltaColor=delta===null?'#85859b':delta>=0?'var(--lime)':'var(--orange)';
 const inlineHtml=(field,display,kind='text',extraClass='')=>`<strong class="inline-editable ${extraClass}" tabindex="0" role="button" data-inline-field="${field}" data-inline-kind="${kind}" title="Clique para editar">${display}</strong>`;
 const valueCard=(label,value,note,accent='var(--purple)',field=null)=>`<article class="detail-value-card" style="--value-accent:${accent}"><span>${label}</span>${field?inlineHtml(field,value,'money'):`<strong>${value}</strong>`}<small>${note}</small>${field?'<div class="inline-edit-hint">Clique no valor para editar</div>':''}</article>`;
 const infoCell=(label,value)=>`<div class="detail-info-cell"><span>${label}</span>${value && value.startsWith && value.startsWith('<strong')?value:`<strong>${value}</strong>`}</div>`;
 const inlineOptions={status:GAME_STATUSES,condition:['Não informado','Lacrado','Novo (aberto)','Excelente','Bom','Regular','Ruim / avariado','Não se aplica (digital)'],completeness:['Não informado','Completo (caixa, manual e mídia)','Completo sem manual','Mídia avulsa','Caixa ou itens faltando','Digital','Edição especial / colecionador'],authenticity:['Não verificado','Original','Pirata','Reprodução não oficial','Digital / não se aplica']};
 function parseInlineMoney(raw){let v=String(raw??'').trim().replace(/[R$\s]/g,'').replace(/[^0-9,.-]/g,'');if(!v)return null;if(v.includes(','))v=v.replace(/\./g,'').replace(',','.');else if((v.match(/\./g)||[]).length>1)v=v.replace(/\./g,'');const n=Number(v);return Number.isFinite(n)&&n>=0?n:undefined;}
 function attachInlineEditors(activeTab){
   document.querySelectorAll('#mainContent [data-inline-field]').forEach(el=>{
     el.onclick=()=>beginInlineEdit(el,activeTab);
     el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();beginInlineEdit(el,activeTab);}};
   });
 }
 function beginInlineEdit(el,activeTab){
   if(el.dataset.editing==='1')return;
   const field=el.dataset.inlineField,kind=el.dataset.inlineKind||'text';
   const original=el.textContent.replace(/✎\s*$/,'').trim();
   let control;
   if(kind==='select'){
     control=document.createElement('select');control.className='inline-edit-input';
     (inlineOptions[field]||[]).forEach(option=>{const opt=document.createElement('option');opt.value=option;opt.textContent=option;opt.selected=(String(g[field]||'Não informado')===option)||(field==='status'&&String(g[field]||'Backlog')===option);control.appendChild(opt);});
     if(![...control.options].some(o=>o.value===String(g[field]))) {const opt=document.createElement('option');opt.value=String(g[field]||'');opt.textContent=String(g[field]||'Não informado');opt.selected=true;control.insertBefore(opt,control.firstChild);}
   }else if(kind==='textarea'){
     control=document.createElement('textarea');control.rows=4;control.value=String(g[field]??'');control.className='inline-edit-input';control.placeholder='Escreva suas observações…';
   }else{
     control=document.createElement('input');control.className='inline-edit-input';control.type=kind==='number'?'number':'text';
     if(kind==='number'){control.min='1970';control.max='2100';control.step='1';control.inputMode='numeric';control.value=g[field]===null||g[field]===undefined?'':String(g[field]);}
     else if(kind==='money'){control.inputMode='decimal';control.placeholder='Ex.: 59,90';control.value=g[field]===null||g[field]===undefined?'':Number(g[field]).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});}
     else {control.value=String(g[field]??'');control.placeholder='Escreva aqui…';}
   }
   control.dataset.editing='1';el.dataset.editing='1';const parent=el.parentNode;parent.replaceChild(control,el);control.focus();if(control.select)control.select();
   let done=false;
   const cancel=()=>{if(done)return;done=true;openGameDetail(c,g);renderDetailTab(activeTab);};
   const commit=()=>{
     if(done)return;done=true;
     let value=control.value;
     if(kind==='money')value=parseInlineMoney(value);
     else if(kind==='number')value=String(value).trim()===''?null:Number.parseInt(value,10);
     else if(kind!=='select')value=String(value).trim();
     if(kind==='money'&&value===undefined){done=false;toast('Digite um valor válido, como 59,90.');control.focus();return;}
     if(kind==='number'&&value!==null&&!Number.isFinite(value)){done=false;toast('Digite um ano válido.');control.focus();return;}
     if(field==='title'&&!String(value||'').trim()){done=false;toast('O nome do jogo não pode ficar vazio.');control.focus();return;}
     if(kind==='money'&&value===null)value=null;
     const previousValue=g[field];
     if(field==='pricePaid'&&!sameOptionalNumber(previousValue,value)&&value!==null)recordPriceHistory(g,'paid',value,'Preço de compra editado');
     if(field==='marketValue'&&!sameOptionalNumber(previousValue,value)&&value!==null)recordPriceHistory(g,'market',value,'Valor de mercado editado');
     g[field]=field==='status'?normalizeGameStatus(value):value;
     if(field==='marketValue'){
       if(value===null){g.marketValueSource='';g.marketValueDate='';}
       else {g.marketValueSource='Editado manualmente';g.marketValueDate=todayISO();}
     }
     persist();renderStats();openGameDetail(c,g);renderDetailTab(activeTab);
     toast(field==='pricePaid'?'Preço pago atualizado':field==='marketValue'?'Valor de mercado atualizado':'Informação atualizada');
   };
   control.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();cancel();}else if(e.key==='Enter'&&(kind!=='textarea'||e.ctrlKey||e.metaKey)){e.preventDefault();commit();}});
   if(kind==='select')control.addEventListener('change',commit);
   control.addEventListener('blur',commit);
 }

 function renderDetailTab(tab){
   document.querySelectorAll('.detail-tab').forEach(btn=>{const active=btn.dataset.detailTab===tab;btn.classList.toggle('active',active);btn.setAttribute('aria-selected',String(active));});
   const panel=$('#gameDetailPanel');
   if(tab==='overview'){
     panel.innerHTML=`<div class="detail-section-heading"><div><h2>Resumo da sua cópia</h2><p>As informações mais úteis, sem precisar abrir cada seção.</p></div></div>
       <div class="detail-info-grid overview-info-grid">${infoCell('Plataforma',esc(c.name))}${infoCell('Situação',inlineHtml('status',esc(g.status||'Backlog'),'select'))}${infoCell('Ano de lançamento',inlineHtml('year',esc(g.year||'Não informado'),'number'))}${infoCell('Gênero',inlineHtml('genre',esc(g.genre||'Não definido'),'text'))}</div>
       <div class="overview-value-row"><div><span class="eyebrow-small">VALOR REGISTRADO</span><div class="overview-value-line"><div><small>Você pagou</small>${inlineHtml('pricePaid',paidKnown?money(g.pricePaid):'Ainda não informado','money')}</div><div><small>Mercado estimado</small>${inlineHtml('marketValue',marketKnown?money(g.marketValue):'Ainda não informado','money')}</div></div></div><button class="text-action" data-open-tab="finance">Ver resumo dos valores <span>→</span></button></div>
       ${g.notes?`<div class="detail-note-preview"><span class="eyebrow-small">SUA OBSERVAÇÃO</span><p>${esc(g.notes.length>240?g.notes.slice(0,240)+'…':g.notes)}</p><button class="text-action" data-open-tab="condition">Ler todas as notas →</button></div>`:''}`;
   }else if(tab==='finance'){
     const financePaidKnown=hasMoneyValue(g.pricePaid), financeMarketKnown=hasMoneyValue(g.marketValue);
     const financeDelta=financePaidKnown&&financeMarketKnown?Number(g.marketValue)-Number(g.pricePaid):null;
     const financeDeltaColor=financeDelta===null?'#85859b':financeDelta>=0?'var(--lime)':'var(--orange)';
     const estimate=g.marketEstimate||null;
     const estimateCards=estimate ? (estimate.estimate===null ? `<div class="market-estimate-card"><div class="market-auto-status">${esc(estimate.message||'Não foi possível encontrar anúncios comparáveis suficientes.')}</div>${estimate.searchUrl?`<a class="text-action" href="${esc(safeHttpsUrl(estimate.searchUrl))}" target="_blank" rel="noopener noreferrer">Abrir pesquisa no Mercado Livre ↗</a>`:''}</div>` : `<div class="market-estimate-card"><div class="market-estimate-head"><div class="market-estimate-main"><small>${estimate.selectedPrices?'MEDIANA DOS PREÇOS SELECIONADOS':'MEDIANA DE ANÚNCIOS ATIVOS'}</small><strong>${money(estimate.estimate)}</strong><small>${esc(estimate.count)} ${estimate.selectedPrices?'preço(s) selecionado(s)':'anúncio(s) comparável(is)'} · consultado em ${esc(displayDate(estimate.researchedAt))}</small></div><span class="market-confidence">Confiança ${esc(estimate.confidence||'Baixa')}</span></div><div class="market-estimate-facts"><div><small>Menor anúncio</small><strong>${money(estimate.minimum)}</strong></div><div><small>Maior anúncio</small><strong>${money(estimate.maximum)}</strong></div><div><small>Condição pesquisada</small><strong>${esc(estimate.requestedCondition||'Não identificada')}</strong></div></div>${estimate.conditionMatched===false?'<div class="market-warning">Poucos anúncios com a mesma condição; usei anúncios com condições variadas. Confira os resultados antes de aplicar o valor.</div>':''}<p class="market-disclaimer">É uma referência calculada a partir de preços anunciados, não de vendas concluídas. Pode incluir variações de edição, completude e conservação; confira os anúncios antes de salvar.</p><div class="market-toolbar"><button class="primary" id="useMarketEstimate">Usar esta estimativa</button><button class="secondary" id="refreshMarketEstimate">Atualizar pesquisa</button></div><div class="market-results-heading"><strong>${estimate.selectedPrices?'Preços usados na mediana':'Anúncios considerados'}</strong><span>${estimate.selectedPrices?'Valores selecionados por você':'Abra para conferir'}</span></div><div class="market-listings">${estimate.selectedPrices?(estimate.selectedPrices.map((price,index)=>`<div class="market-listing"><div><div class="market-listing-title">Preço selecionado ${index+1}</div><div class="market-listing-meta">Valor informado manualmente · Mercado Livre</div></div><div class="market-listing-price">${money(price)}</div></div>`).join('')):(estimate.listings||[]).slice(0,8).map(item=>`<a class="market-listing" href="${esc(safeHttpsUrl(item.permalink))}" target="_blank" rel="noopener noreferrer"><div><div class="market-listing-title">${esc(item.title)}</div><div class="market-listing-meta">${esc(item.condition||'Condição não informada')} · Mercado Livre</div></div><div class="market-listing-price">${money(item.price)}</div></a>`).join('')}</div><div class="market-search-links"><a href="${esc(safeHttpsUrl(estimate.searchUrl))}" target="_blank" rel="noopener noreferrer">Ver pesquisa completa ↗</a><a href="${esc(safeHttpsUrl('https://www.google.com/search?tbm=shop&q='+encodeURIComponent(`${g.title} ${c.short} jogo preço`)))}" target="_blank" rel="noopener noreferrer">Google Shopping ↗</a><a href="${esc(safeHttpsUrl('https://www.olx.com.br/brasil?q='+encodeURIComponent(`${g.title} ${c.short}`)))}" target="_blank" rel="noopener noreferrer">OLX ↗</a><a href="${esc(safeHttpsUrl('https://shopee.com.br/search?keyword='+encodeURIComponent(`${g.title} ${c.short}`)))}" target="_blank" rel="noopener noreferrer">Shopee ↗</a></div></div>`) : `<div class="market-estimate-card"><div class="market-auto-status">${marketKnown?'Último valor registrado manualmente ou por pesquisa anterior.':'Ainda não foi calculada uma estimativa.'} Abra uma busca, escolha anúncios comparáveis e insira seus preços para calcular a mediana.</div></div>`;
     panel.innerHTML=`<div class="detail-section-heading"><div><h2>Valores do jogo</h2><p>Clique diretamente no preço para escrever ou corrigir. A diferença é calculada automaticamente.</p></div></div>
       <div class="detail-value-grid">${valueCard('Preço pago',financePaidKnown?money(g.pricePaid):'Clique para informar',financePaidKnown?'Sua compra':'Clique no valor para registrar quanto pagou','var(--orange)','pricePaid')}${valueCard('Valor de mercado',financeMarketKnown?money(g.marketValue):'Clique para informar',financeMarketKnown?'Estimativa registrada':'Clique no valor para registrar uma estimativa','var(--lime)','marketValue')}${valueCard('Diferença estimada',financeDelta===null?'—':money(financeDelta),financeDelta===null?'Informe os dois valores':financeDelta>=0?'Mercado acima do preço pago':'Mercado abaixo do preço pago',financeDeltaColor)}</div>
       <div class="detail-info-grid detail-source-grid">${infoCell('Fonte do preço',esc(g.marketValueSource||'Não registrada'))}${infoCell('Pesquisado em',esc(displayDate(g.marketValueDate)))}</div>
       ${renderPriceHistoryMarkup(g)}
       <div class="market-toolbar"><button class="primary" id="marketEstimateBtn">${estimate?'Atualizar mediana manualmente':'Pesquisar anúncios e calcular mediana'}</button></div><div id="marketAutoStatus" class="market-auto-status" role="status" aria-live="polite"></div>${estimateCards}
       <p class="detail-footnote">Método gratuito e sem API: a Estante abre pesquisas para você conferir anúncios e calcula a mediana dos preços que selecionar. Compare a mesma plataforma, edição, completude e conservação sempre que possível. O valor é uma referência de preços anunciados, não de vendas concluídas.</p>`;
     $('#marketEstimateBtn').onclick=()=>openManualMarketEstimator(c,g);
     const refresh=$('#refreshMarketEstimate');if(refresh)refresh.onclick=()=>openManualMarketEstimator(c,g);
     const use=$('#useMarketEstimate');if(use)use.onclick=()=>{
       if(!g.marketEstimate||!Number.isFinite(Number(g.marketEstimate.estimate))){toast('Não há uma estimativa válida para aplicar.');return;}
       const previousMarketValue=g.marketValue;
       g.marketValue=Number(g.marketEstimate.estimate);
       if(!sameOptionalNumber(previousMarketValue,g.marketValue))recordPriceHistory(g,'market',g.marketValue,`Mercado Livre · mediana de ${g.marketEstimate.count} preço(s)`);
       g.marketValueSource=`Mercado Livre · mediana ${g.marketEstimate.method==='manual-median'?'manual ':''}de ${g.marketEstimate.count} preço(s)`;
       g.marketValueDate=g.marketEstimate.researchedAt||todayISO();
       persist();renderStats();renderDetailTab('finance');toast('Estimativa aplicada à ficha do jogo');
     };
   }else if(tab==='collector'){
     const collectorCell=(label,value)=>`<div class="collector-cell"><small>${label}</small><strong>${value&&String(value).trim()?esc(value):'Não informado'}</strong></div>`;
     const ratingText=hasMoneyValue(g.rating)?`${g.rating}/10`:'Sem avaliação';
     const playtimeText=hasMoneyValue(g.playtimeHours)?`${g.playtimeHours} h`:'Não informado';
     panel.innerHTML=`<div class="detail-section-heading"><div><h2>Detalhes de colecionador</h2><p>Informações específicas da edição e estado da sua cópia.</p></div><button class="secondary" id="editCollectorDetails" type="button">Editar detalhes</button></div>
       <div class="collector-grid">${collectorCell('Região',g.region)}${collectorCell('Edição',g.edition)}${collectorCell('Idioma',g.language)}${collectorCell('Discos/cartuchos',g.mediaCount)}${collectorCell('Manual incluso',g.hasManual)}${collectorCell('Caixa e encarte',g.boxCondition)}${collectorCell('Estado da mídia',g.discCondition)}${collectorCell('Estado do manual',g.manualCondition)}${collectorCell('Condição geral',condition)}${collectorCell('Completude',completeness)}${collectorCell('Autenticidade',auth)}${collectorCell('Sua avaliação',ratingText)}${collectorCell('Horas jogadas',playtimeText)}${collectorCell('Data de conclusão',g.completionDate?displayDate(g.completionDate):'Não informada')}</div>
       <div class="detail-note-preview" style="margin-top:14px"><span class="eyebrow-small">DICA DE INVENTÁRIO</span><p>Registre a região, edição e os detalhes físicos para diferenciar versões do mesmo jogo. São campos pessoais; a Estante não verifica autenticidade automaticamente.</p></div>`;
     const editCollector=$('#editCollectorDetails');if(editCollector)editCollector.onclick=()=>openEditor('game',c.id,g);
   }else if(tab==='condition'){
     panel.innerHTML=`<div class="detail-section-heading"><div><h2>Estado e notas</h2><p>Conservação e informações da sua cópia. Clique em qualquer campo editável para alterar.</p></div></div>
       <div class="condition-detail-grid">
         <article class="condition-detail-card"><span class="condition-icon">◈</span><small>Condição física</small>${inlineHtml('condition',esc(condition),'select')}<p>Conservação geral da mídia e dos itens.</p></article>
         <article class="condition-detail-card"><span class="condition-icon">▣</span><small>Caixa e conteúdo</small>${inlineHtml('completeness',esc(completeness),'select')}<p>Caixa, manual, mídia e extras incluídos.</p></article>
         <article class="condition-detail-card"><span class="condition-icon">✓</span><small>Autenticidade</small>${inlineHtml('authenticity',esc(auth),'select',`auth-value ${authClass}`)}<p>${auth==='Original'?'Marcado como original.':auth==='Pirata'?'Marcado como cópia pirata.':auth==='Reprodução não oficial'?'Reprodução não oficial registrada.':auth==='Digital / não se aplica'?'Registro digital.':'Ainda não foi confirmado se é original.'}</p></article>
       </div>
       <div class="detail-notes-card"><div class="detail-notes-heading"><span class="eyebrow-small">OBSERVAÇÕES</span><span class="detail-notes-count">${(g.notes||'').length} caracteres</span></div><p class="inline-editable" tabindex="0" role="button" data-inline-field="notes" data-inline-kind="textarea" title="Clique para editar as observações">${g.notes?esc(g.notes):'Clique aqui para escrever observações sobre a sua cópia.'}</p><div class="inline-edit-hint">Clique no texto para escrever ou corrigir notas</div></div>`;
   }
   panel.querySelectorAll('[data-open-tab]').forEach(btn=>btn.onclick=()=>renderDetailTab(btn.dataset.openTab==='notes'?'condition':btn.dataset.openTab));
   attachInlineEditors(tab);
 }
 document.querySelectorAll('.detail-tab').forEach(btn=>btn.onclick=()=>renderDetailTab(btn.dataset.detailTab));
 renderDetailTab('overview');
 $('#editThisGame').onclick=()=>openEditor('game',c.id,g);
 $('#backToGamesTop').onclick=()=>{render();window.scrollTo({top:0,behavior:'smooth'});};
}
function openEditor(mode,consoleId,game){
  const returnToGameDetail=mode==='game'&&!!document.querySelector('.game-detail-hero');
  const returnToProfile=currentView==='profile';
  modalMode=mode;
  activeSgdbGame=game?.sgdbGameId?{id:Number(game.sgdbGameId),name:game.title}:null;
  sgdbChosenCoverUrl=(mode==='game'&&/^https?:\/\//i.test(game?.coverImage||''))?(game.coverImage):'';
  const isGame=mode==='game';
  const existingConsole=!isGame&&consoleId?consoles.find(c=>c.id===consoleId):null;
  $('#modalTitle').textContent=game?'Editar jogo':isGame?'Adicionar jogo':existingConsole?'Editar console':'Adicionar console';
  let form='';
  if(isGame){
    const existingImage=game?.coverImage||'';
    form=`
      <div class="field"><label for="gtitle">Nome do jogo</label><input id="gtitle" name="title" required maxlength="90" value="${esc(game?.title||'')}" placeholder="Ex.: Final Fantasy X" autocomplete="off" /><div class="sgdb-help">As sugestões de nomes vêm da SteamGridDB quando a conexão está configurada.</div><div class="sgdb-suggestions" id="sgdbSuggestions"></div></div>
      <div class="field"><label for="gconsole">Plataforma</label><select id="gconsole" name="consoleId">${consoles.map(c=>`<option value="${esc(c.id)}" ${c.id===(consoleId||currentConsole)?'selected':''}>${esc(c.name)}</option>`).join('')}</select></div>
      <div class="form-row"><div class="field"><label for="gyear">Ano de lançamento</label><input id="gyear" name="year" type="number" min="1970" max="2100" value="${game?.year||''}" placeholder="2005" /></div><div class="field"><label for="ggenre">Gênero</label><input id="ggenre" name="genre" value="${esc(game?.genre||'')}" placeholder="Aventura" /></div></div>
      <div class="field"><label for="gstatus">Situação na sua biblioteca</label><select id="gstatus" name="status">${GAME_STATUSES.map(status=>`<option ${normalizeGameStatus(game?.status)===(status)?'selected':''}>${status}</option>`).join('')}</select></div>
      ${game?.wishlistAcquisition?renderWishlistAcquisition(game.wishlistAcquisition):''}
      <div class="editor-section"><strong>Compra e valor de mercado</strong><small>Valores em reais (R$)</small></div>
      <div class="form-row"><div class="field"><label for="gpaid">Quanto você pagou (R$)</label><input id="gpaid" name="pricePaid" type="number" min="0" step="0.01" value="${game?.pricePaid??''}" placeholder="Ex.: 85,00" /></div><div class="field"><label for="gmarket">Valor de mercado estimado (R$)</label><input id="gmarket" name="marketValue" type="number" min="0" step="0.01" value="${game?.marketValue??''}" placeholder="Ex.: 120,00" /></div></div>
      <div class="form-row"><div class="field"><label for="gmarketSource">Fonte do preço de mercado</label><input id="gmarketSource" name="marketValueSource" value="${esc(game?.marketValueSource||'')}" maxlength="120" placeholder="Ex.: Mercado Livre, OLX, loja local" /></div><div class="field"><label for="gmarketDate">Data da pesquisa</label><input id="gmarketDate" name="marketValueDate" type="date" value="${esc(game?.marketValueDate||todayISO())}" /></div></div>
      <div class="editor-section"><strong>Condição e autenticidade</strong><small>Principalmente para jogos físicos</small></div>
      <div class="form-row"><div class="field"><label for="gcondition">Condição física</label><select id="gcondition" name="condition"><option value="Não informado" ${!game?.condition||game.condition==='Não informado'?'selected':''}>Não informada</option><option value="Lacrado" ${game?.condition==='Lacrado'?'selected':''}>Lacrado</option><option value="Novo (aberto)" ${game?.condition==='Novo (aberto)'?'selected':''}>Novo (aberto)</option><option value="Excelente" ${game?.condition==='Excelente'?'selected':''}>Excelente</option><option value="Bom" ${game?.condition==='Bom'?'selected':''}>Bom</option><option value="Regular" ${game?.condition==='Regular'?'selected':''}>Regular</option><option value="Ruim / avariado" ${game?.condition==='Ruim / avariado'?'selected':''}>Ruim / avariado</option><option value="Não se aplica (digital)" ${game?.condition==='Não se aplica (digital)'?'selected':''}>Não se aplica (digital)</option></select></div><div class="field"><label for="gcomplete">Completude / conteúdo</label><select id="gcomplete" name="completeness"><option value="Não informado" ${!game?.completeness||game.completeness==='Não informado'?'selected':''}>Não informado</option><option value="Completo (caixa, manual e mídia)" ${game?.completeness==='Completo (caixa, manual e mídia)'?'selected':''}>Completo (caixa, manual e mídia)</option><option value="Completo sem manual" ${game?.completeness==='Completo sem manual'?'selected':''}>Completo sem manual</option><option value="Mídia avulsa" ${game?.completeness==='Mídia avulsa'?'selected':''}>Mídia avulsa</option><option value="Caixa ou itens faltando" ${game?.completeness==='Caixa ou itens faltando'?'selected':''}>Caixa ou itens faltando</option><option value="Digital" ${game?.completeness==='Digital'?'selected':''}>Digital</option><option value="Edição especial / colecionador" ${game?.completeness==='Edição especial / colecionador'?'selected':''}>Edição especial / colecionador</option></select></div></div>
      <div class="field"><label for="gauthenticity">Autenticidade</label><select id="gauthenticity" name="authenticity"><option value="Não verificado" ${!game?.authenticity||game.authenticity==='Não verificado'?'selected':''}>Não verificado / não tenho certeza</option><option value="Original" ${game?.authenticity==='Original'?'selected':''}>Original</option><option value="Pirata" ${game?.authenticity==='Pirata'?'selected':''}>Pirata</option><option value="Reprodução não oficial" ${game?.authenticity==='Reprodução não oficial'?'selected':''}>Reprodução não oficial</option><option value="Digital / não se aplica" ${game?.authenticity==='Digital / não se aplica'?'selected':''}>Digital / não se aplica</option></select><div class="sgdb-help">“Reprodução não oficial” é útil para cartuchos, discos ou caixas reproduzidos; “Não verificado” evita marcar como original sem confirmação.</div></div>
      <div class="editor-section"><strong>Detalhes de colecionador</strong><small>Região, edição, conteúdo e estado dos itens</small></div>
      <div class="form-row"><div class="field"><label for="gregion">Região</label><select id="gregion" name="region"><option value="Não informada" ${!game?.region||game.region==='Não informada'?'selected':''}>Não informada</option><option value="PAL" ${game?.region==='PAL'?'selected':''}>PAL</option><option value="NTSC-U" ${game?.region==='NTSC-U'?'selected':''}>NTSC-U (EUA/Américas)</option><option value="NTSC-J" ${game?.region==='NTSC-J'?'selected':''}>NTSC-J (Japão)</option><option value="Outra" ${game?.region==='Outra'?'selected':''}>Outra</option><option value="Digital / não se aplica" ${game?.region==='Digital / não se aplica'?'selected':''}>Digital / não se aplica</option></select></div><div class="field"><label for="gedition">Edição</label><input id="gedition" name="edition" maxlength="100" value="${esc(game?.edition||'')}" placeholder="Standard, Platinum, edição limitada..." /></div></div>
      <div class="form-row"><div class="field"><label for="glanguage">Idioma da cópia</label><input id="glanguage" name="language" maxlength="80" value="${esc(game?.language||'')}" placeholder="Português, inglês, japonês..." /></div><div class="field"><label for="gmediaCount">Quantidade de discos/cartuchos</label><input id="gmediaCount" name="mediaCount" type="number" min="1" max="99" step="1" value="${game?.mediaCount??''}" placeholder="Ex.: 2" /></div></div>
      <div class="form-row"><div class="field"><label for="gmanual">Manual incluso?</label><select id="gmanual" name="hasManual"><option value="Não informado" ${!game?.hasManual||game.hasManual==='Não informado'?'selected':''}>Não informado</option><option value="Sim" ${game?.hasManual==='Sim'?'selected':''}>Sim</option><option value="Não" ${game?.hasManual==='Não'?'selected':''}>Não</option><option value="Não se aplica" ${game?.hasManual==='Não se aplica'?'selected':''}>Não se aplica</option></select></div><div class="field"><label for="gboxCondition">Estado da caixa/encarte</label><select id="gboxCondition" name="boxCondition"><option value="Não informado" ${!game?.boxCondition||game.boxCondition==='Não informado'?'selected':''}>Não informado</option><option ${game?.boxCondition==='Excelente'?'selected':''}>Excelente</option><option ${game?.boxCondition==='Bom'?'selected':''}>Bom</option><option ${game?.boxCondition==='Regular'?'selected':''}>Regular</option><option ${game?.boxCondition==='Ruim / avariado'?'selected':''}>Ruim / avariado</option><option ${game?.boxCondition==='Sem caixa'?'selected':''}>Sem caixa</option><option ${game?.boxCondition==='Não se aplica'?'selected':''}>Não se aplica</option></select></div></div>
      <div class="form-row"><div class="field"><label for="gdiscCondition">Estado da mídia</label><select id="gdiscCondition" name="discCondition"><option value="Não informado" ${!game?.discCondition||game.discCondition==='Não informado'?'selected':''}>Não informado</option><option ${game?.discCondition==='Excelente'?'selected':''}>Excelente</option><option ${game?.discCondition==='Bom'?'selected':''}>Bom</option><option ${game?.discCondition==='Regular'?'selected':''}>Regular</option><option ${game?.discCondition==='Riscos / avariado'?'selected':''}>Riscos / avariado</option><option ${game?.discCondition==='Não se aplica'?'selected':''}>Não se aplica</option></select></div><div class="field"><label for="gmanualCondition">Estado do manual</label><select id="gmanualCondition" name="manualCondition"><option value="Não informado" ${!game?.manualCondition||game.manualCondition==='Não informado'?'selected':''}>Não informado</option><option ${game?.manualCondition==='Excelente'?'selected':''}>Excelente</option><option ${game?.manualCondition==='Bom'?'selected':''}>Bom</option><option ${game?.manualCondition==='Regular'?'selected':''}>Regular</option><option ${game?.manualCondition==='Ruim / avariado'?'selected':''}>Ruim / avariado</option><option ${game?.manualCondition==='Não tem manual'?'selected':''}>Não tem manual</option><option ${game?.manualCondition==='Não se aplica'?'selected':''}>Não se aplica</option></select></div></div>
      <div class="editor-section"><strong>Seu progresso e avaliação</strong><small>Opcional · informações pessoais de jogo</small></div>
      <div class="form-row"><div class="field"><label for="gcompletionDate">Data em que terminou</label><input id="gcompletionDate" name="completionDate" type="date" value="${esc(game?.completionDate||'')}" /></div><div class="field"><label for="grating">Sua nota (1–10)</label><input id="grating" name="rating" type="number" min="1" max="10" step="1" value="${game?.rating??''}" placeholder="Ex.: 9" /></div></div>
      <div class="field"><label for="gplaytimeHours">Horas jogadas (opcional)</label><input id="gplaytimeHours" name="playtimeHours" type="number" min="0" max="99999" step="0.5" value="${game?.playtimeHours??''}" placeholder="Ex.: 23,5" /></div>
      <div class="field"><label for="gnotes">Observações da cópia</label><textarea id="gnotes" name="notes" maxlength="1500" placeholder="Defeitos, riscos, estado do disco/cartucho, selo, edição, acessórios ou detalhes da compra...">${esc(game?.notes||'')}</textarea></div>
      <div class="editor-section"><strong>Capa do jogo</strong><small>Personalize a arte da ficha</small></div><div class="sgdb-actions"><button class="secondary" type="button" id="sgdbFindCovers">Buscar capas na SteamGridDB</button><span class="sgdb-brand">STEAMGRIDDB</span></div><div id="sgdbCoverStatus" class="sgdb-status">Escolha uma capa online ou envie sua própria imagem abaixo.</div><div id="sgdbCoverResults"></div><div class="cover-upload" style="margin-top:11px"><div class="cover-preview" id="gcoverPreview">${existingImage?`<img src="${esc(existingImage)}" alt="Prévia da capa">`:`<span>${esc(game?.glyph||'CAPA')}</span>`}</div><div class="cover-upload-controls"><input class="image-file-input" id="gcover" name="coverFile" type="file" accept="image/*"><small>Ou envie uma imagem JPG, PNG ou WEBP do seu computador.</small>${existingImage?'<label class="cover-remove"><input id="gremove" type="checkbox"> Remover capa personalizada</label>':''}</div></div></div>
      <div class="modal-actions">${game?'<button class="secondary" type="button" id="deleteEntry">Excluir</button>':''}<button class="secondary" type="button" id="cancelEdit">Cancelar</button><button class="primary" type="submit">Salvar jogo</button></div>`;
  }else{
    const existing=existingConsole;
    const existingImage=existing?.coverImage||'';
    const brands=['Sony','Nintendo','Xbox','Sega','Computador','Outro'];
    const types=['Console de mesa','Portátil','Híbrido','Computador','Outro'];
    const colors=[['#a855f7','Roxo'],['#ff5269','Coral'],['#28d9e8','Ciano'],['#c7f464','Lima'],['#5b7cfa','Azul'],['#ff805c','Laranja']];
    form=`
      <div class="field"><label for="cname">Nome da plataforma</label><input id="cname" name="name" required maxlength="50" value="${esc(existing?.name||'')}" placeholder="Ex.: Dreamcast" /></div>${existing?.wishlistAcquisition?renderWishlistAcquisition(existing.wishlistAcquisition):''}
      <div class="form-row"><div class="field"><label for="cbrand">Fabricante</label><select id="cbrand" name="brand">${brands.map(b=>`<option ${b===(existing?.brand||'Sony')?'selected':''}>${b}</option>`).join('')}</select></div><div class="field"><label for="ctype">Tipo</label><select id="ctype" name="type">${types.map(t=>`<option ${t===(existing?.type||'Console de mesa')?'selected':''}>${t}</option>`).join('')}</select></div></div>
      <div class="form-row"><div class="field"><label for="cyear">Ano (opcional)</label><input id="cyear" name="year" type="number" min="1970" max="2100" value="${existing?.year||''}" placeholder="2001" /></div><div class="field"><label for="ccolor">Cor da plataforma</label><select id="ccolor" name="color">${colors.map(([value,label])=>`<option value="${value}" ${value===(existing?.color||'#a855f7')?'selected':''}>${label}</option>`).join('')}</select></div></div>
      <div class="field"><label for="ccover">Imagem do console (opcional)</label><div class="sgdb-actions" style="margin-bottom:8px"><button class="secondary" type="button" id="sgdbFindConsole">Buscar arte relacionada na SteamGridDB</button></div><div class="sgdb-help">A SteamGridDB é focada em artes de jogos, não em fotos de hardware. Você pode buscar artes relacionadas pelo nome do console ou enviar uma imagem PNG transparente.</div><div id="sgdbConsoleStatus" class="sgdb-status"></div><div id="sgdbConsoleResults"></div><div class="cover-upload"><div class="cover-preview console-preview" id="ccoverPreview">${existingImage?`<img src="${esc(existingImage)}" alt="Prévia da imagem">`:`<span>${esc(existing?.short||'CONSOLE')}</span>`}</div><div class="cover-upload-controls"><input class="image-file-input" id="ccover" name="coverFile" type="file" accept="image/*"><small>Use uma foto do console, uma renderização ou qualquer imagem. Sem imagem personalizada, a ilustração original continua aparecendo.</small>${existingImage?'<label class="cover-remove"><input id="cremove" type="checkbox"> Remover imagem personalizada</label>':''}</div></div></div>
      <div class="modal-actions">${existing?'<button class="secondary" type="button" id="deleteEntry">Excluir</button>':''}<button class="secondary" type="button" id="cancelEdit">Cancelar</button><button class="primary" type="submit">Salvar console</button></div>`;
  }
  $('#editorForm').innerHTML=form;
  $('#modalBackdrop').classList.add('open');
  if(isGame){wireImagePreview('gcover','gcoverPreview',game?.coverImage||'',game?.glyph||'CAPA','gremove');wireSgdbGamePicker(game);if(activeSgdbGame)loadSgdbCovers(activeSgdbGame.id);}
  else {wireImagePreview('ccover','ccoverPreview',existingConsole?.coverImage||'',existingConsole?.short||'CONSOLE','cremove');wireSgdbConsolePicker(existingConsole);}
  $('#editorForm').onsubmit=async e=>{
    e.preventDefault();
    const fd=new FormData(e.target);
    const fileInput=e.target.querySelector('input[type="file"]');
    const removeInput=e.target.querySelector('input[id$="remove"]');
    const removeImage=!!removeInput?.checked;
    const submitButton=e.submitter;
    let savedGameForDetail=null;
    if(submitButton)submitButton.disabled=true;
    let uploadedImage='';
    try{
      if(fileInput?.files?.[0])uploadedImage=await optimizeImageFile(fileInput.files[0],!isGame);
    }catch(err){
      console.error(err);toast('Não consegui abrir essa imagem. Tente outro arquivo.');if(submitButton)submitButton.disabled=false;return;
    }
    if(isGame){
      const targetId=String(fd.get('consoleId'));
      const target=consoles.find(c=>c.id===targetId);
      if(!target){if(submitButton)submitButton.disabled=false;return;}
      const pricePaid=optionalMoney(fd.get('pricePaid'));const marketValue=optionalMoney(fd.get('marketValue'));
      const history=Array.isArray(game?.priceHistory)?game.priceHistory.slice():[];
      const titleValue=String(fd.get('title')).trim();
      const addHistory=(kind,value,source,date)=>{if(value!==null&&value!==undefined&&Number.isFinite(Number(value)))history.push({date:date||todayISO(),kind,value:Number(value),source:source||'Editado na ficha'});};
      if(game){if(!sameOptionalNumber(game.pricePaid,pricePaid))addHistory('paid',pricePaid,'Preço de compra editado');if(!sameOptionalNumber(game.marketValue,marketValue))addHistory('market',marketValue,String(fd.get('marketValueSource')||'Valor de mercado editado'),String(fd.get('marketValueDate')||todayISO()));}
      else {if(pricePaid!==null)addHistory('paid',pricePaid,'Preço inicial cadastrado');if(marketValue!==null)addHistory('market',marketValue,String(fd.get('marketValueSource')||'Estimativa inicial'),String(fd.get('marketValueDate')||todayISO()));}
      const obj={title:titleValue,year:Number(fd.get('year'))||0,genre:String(fd.get('genre')).trim()||'Jogo',status:normalizeGameStatus(fd.get('status')),pricePaid,marketValue,marketValueSource:String(fd.get('marketValueSource')||'').trim(),marketValueDate:marketValue!==null?String(fd.get('marketValueDate')||todayISO()):'',condition:String(fd.get('condition')||'Não informado'),completeness:String(fd.get('completeness')||'Não informado'),authenticity:String(fd.get('authenticity')||'Não verificado'),region:String(fd.get('region')||'Não informada'),edition:String(fd.get('edition')||'').trim(),language:String(fd.get('language')||'').trim(),mediaCount:fd.get('mediaCount')===''||fd.get('mediaCount')===null?null:(Number(fd.get('mediaCount'))||null),hasManual:String(fd.get('hasManual')||'Não informado'),boxCondition:String(fd.get('boxCondition')||'Não informado'),discCondition:String(fd.get('discCondition')||'Não informado'),manualCondition:String(fd.get('manualCondition')||'Não informado'),completionDate:String(fd.get('completionDate')||''),rating:fd.get('rating')===''||fd.get('rating')===null?null:(Number(fd.get('rating'))||null),playtimeHours:fd.get('playtimeHours')===''||fd.get('playtimeHours')===null?null:(Number(fd.get('playtimeHours'))||0),notes:String(fd.get('notes')||'').trim(),priceHistory:history,marketEstimate:game?.marketEstimate||null,wishlistAcquisition:game?.wishlistAcquisition||null,glyph:(titleValue.match(/[A-ZÀ-Ý0-9]/g)||['G']).slice(0,4).join(''),cover:game?.cover||`linear-gradient(145deg,${target.color},#171725)`,coverImage:uploadedImage||(removeImage?'':(sgdbChosenCoverUrl||game?.coverImage||'')),sgdbGameId:activeSgdbGame?.id||(game&&titleValue===game.title?(game.sgdbGameId||null):null)};
      if(game){obj.priceHistory=history;const oldId=consoleId;const old=consoles.find(c=>c.id===oldId);const idx=old?.games.indexOf(game)??-1;if(old&&idx>=0){if(oldId===targetId)old.games[idx]=obj;else{old.games.splice(idx,1);target.games.push(obj);}}}
      else target.games.push(obj);
      savedGameForDetail=obj;
      obj.consoleId=target.id;
      currentConsole=target.id;currentView=returnToProfile?'profile':'console';toast(game?'Jogo atualizado':'Jogo adicionado à coleção');
    }else{
      const name=String(fd.get('name')).trim();
      const existing=existingConsole;
      const brand=String(fd.get('brand')); 
      const obj={id:existing?.id||'custom-'+Date.now(),name,short:name.toUpperCase().slice(0,10),brand,type:String(fd.get('type')),year:Number(fd.get('year'))||0,color:String(fd.get('color')),coverImage:uploadedImage||(removeImage?'':(String(fd.get('coverRemoteUrl')||'').trim()||existing?.coverImage||'')),games:existing?.games||[],wishlistAcquisition:existing?.wishlistAcquisition||null};
      if(existing)Object.assign(existing,obj);else consoles.push(obj);
      currentView=returnToProfile?'profile':'platforms';currentConsole=null;toast(existing?'Console atualizado':'Console adicionado');
    }
    persist();
    $('#modalBackdrop').classList.remove('open');
    render();
    if(returnToGameDetail&&savedGameForDetail){const savedOwner=consoles.find(c=>c.games.includes(savedGameForDetail));if(savedOwner)openGameDetail(savedOwner,savedGameForDetail);}
  };
  $('#cancelEdit').onclick=()=>$('#modalBackdrop').classList.remove('open');
  const del=$('#deleteEntry');
  if(del)del.onclick=()=>{if(isGame){const c=consoles.find(c=>c.id===consoleId);const idx=c?.games.indexOf(game)??-1;if(!c||idx<0)return;if(!confirm(`Mover “${game.title}” para a lixeira? Você poderá restaurá-lo depois.`))return;$('#modalBackdrop').classList.remove('open');void estanteMoveGameToTrash(c,idx,true);}else if(existingConsole){void estanteMovePlatformToTrash(existingConsole);}};
  $('#modalClose').onclick=()=>$('#modalBackdrop').classList.remove('open');
}
function applyTheme(theme,save=true){
 const allowed=['default','red','gamez','ocean','amber','mono','forest','vaporwave','gameboy'];
 const value=allowed.includes(theme)?theme:'default';
 document.body.dataset.theme=value;
 if(save){try{localStorage.setItem('estanteTheme',value)}catch(e){}}
}
function openThemeSettings(){
 const current=(()=>{try{return localStorage.getItem('estanteTheme')||'default'}catch(e){return 'default'}})();
 const themes=[
  {id:'default',name:'Retrô roxo',desc:'A identidade atual da Estante',colors:['#a855f7','#ff3fa4','#28d9e8']},
  {id:'red',name:'Vermelho cereja',desc:'#e83b5d · #ad152f',colors:['#e83b5d','#ad152f','#f7a0af']},
  {id:'gamez',name:'Arcade colorido',desc:'Coral, amarelo e ciano',colors:['#ff5c7a','#ffb84d','#49c7e8']},
  {id:'ocean',name:'Azul oceano',desc:'Azul elétrico e ciano',colors:['#4778ff','#35c5d9','#172e50']},
  {id:'amber',name:'CRT âmbar',desc:'Âmbar quente e laranja',colors:['#f4b942','#ed7846','#332819']},
  {id:'mono',name:'Monocromático',desc:'Cinza e prata discreta',colors:['#d5d5df','#858595','#292932']},
  {id:'forest',name:'Floresta',desc:'Verde folha e menta',colors:['#5dcc8b','#b2e86b','#193428']},
  {id:'vaporwave',name:'Vaporwave',desc:'Magenta e violeta neon',colors:['#ff5bd6','#7a5cff','#30203e']},
  {id:'gameboy',name:'Game Boy',desc:'Verde clássico portátil',colors:['#a3c644','#708238','#232e21']}
 ];
 $('#modalTitle').textContent='Tema da Estante';
 $('#editorForm').innerHTML=`<p class="theme-note">Escolha uma identidade visual para toda a interface: fundo, painéis, navegação, botões, filtros, formulários e seleções. As capas e artes originais dos jogos permanecem intactas. A preferência fica salva neste navegador.</p><div class="theme-choice-grid">${themes.map(t=>`<button type="button" class="theme-choice" data-theme-choice="${t.id}" aria-pressed="${t.id===current?'true':'false'}"><span class="theme-swatches">${t.colors.map(c=>`<i style="background:${c}"></i>`).join('')}</span><span><strong>${t.name}</strong><small>${t.desc}</small></span></button>`).join('')}</div><div class="modal-actions"><button type="button" class="secondary" id="themeCancel">Fechar</button></div>`;
 $('#modalBackdrop').classList.add('open');
 $('#editorForm').querySelectorAll('[data-theme-choice]').forEach(btn=>btn.onclick=()=>{applyTheme(btn.dataset.themeChoice);$('#editorForm').querySelectorAll('[data-theme-choice]').forEach(b=>b.setAttribute('aria-pressed',b===btn?'true':'false'));toast('Tema atualizado');});
 $('#themeCancel').onclick=()=>$('#modalBackdrop').classList.remove('open');
 $('#modalClose').onclick=()=>$('#modalBackdrop').classList.remove('open');
}
function openProfileSettings(){
  const initials=profileInitials();
  $('#modalTitle').textContent='Seu perfil';
  $('#editorForm').innerHTML=`
    <div class="profile-form-hero"><div class="profile-avatar-preview" id="profileAvatarPreview">${profile.avatarImage?`<img src="${esc(profile.avatarImage)}" alt="Foto do perfil">`:esc(initials)}</div><div><strong>Este espaço é seu.</strong><p>Personalize como a Estante te recebe e deixe registrados seus gostos e objetivos de coleção.</p></div></div>
    <div class="form-row"><div class="field"><label for="profileDisplayName">Nome do perfil</label><input id="profileDisplayName" name="displayName" maxlength="50" value="${esc(profile.displayName||'')}" placeholder="Ex.: Minha coleção"></div><div class="field"><label for="profileNickname">Como quer ser chamada(o)</label><input id="profileNickname" name="nickname" maxlength="35" value="${esc(profile.nickname||'')}" placeholder="Apelido (opcional)"></div></div>
    <div class="field"><label for="profileAbout">Sobre sua coleção</label><textarea id="profileAbout" name="about" maxlength="500" placeholder="Ex.: coleciono jogos físicos de Nintendo e PlayStation, curto RPGs e terror...">${esc(profile.about||'')}</textarea></div>
    <div class="form-row"><div class="field"><label for="profileFavoritePlatform">Plataforma favorita</label><select id="profileFavoritePlatform" name="favoritePlatform"><option value="">Ainda não escolhi</option>${consoles.map(c=>`<option value="${esc(c.id)}" ${profile.favoritePlatform===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select></div><div class="field"><label for="profileCollectionGoal">Meta de jogos na coleção</label><input id="profileCollectionGoal" name="collectionGoal" type="number" min="0" max="100000" step="1" value="${Number(profile.collectionGoal)||0}" placeholder="100"><small style="color:#85849a;font-size:10px">Só uma meta pessoal — não limita a coleção.</small></div></div>
    <div class="form-row"><div class="field"><label for="profileAccentColor">Cor de destaque</label><select id="profileAccentColor" name="accentColor">${[['#a855f7','Roxo'],['#ff3fa4','Rosa'],['#28d9e8','Ciano'],['#c7f464','Lima'],['#5b7cfa','Azul'],['#ff805c','Laranja']].map(([v,l])=>`<option value="${v}" ${profile.accentColor===v?'selected':''}>${l}</option>`).join('')}</select></div><div class="field"><label for="profileAvatarFile">Foto do perfil (opcional)</label><input id="profileAvatarFile" name="avatarFile" type="file" accept="image/*"><small style="color:#85849a;font-size:10px">A imagem fica salva localmente neste navegador.</small></div></div>
    <div class="profile-actions"><label style="display:flex;align-items:center;gap:8px;color:#a5a3b8;font-size:11px"><input type="checkbox" id="profileRemoveAvatar" style="accent-color:#a855f7"> Usar iniciais no lugar da foto</label><button class="secondary" type="button" id="profileCancel">Cancelar</button><button class="primary" type="submit">Salvar perfil</button></div>
    <p class="profile-inline-note">Seu perfil, sua foto e suas preferências ficam neste navegador e entram na sincronização quando você está conectada(o).</p>`;
  $('#modalBackdrop').classList.add('open');
  const avatarInput=$('#profileAvatarFile');
  avatarInput.onchange=()=>{const file=avatarInput.files?.[0];if(!file)return;if(!file.type.startsWith('image/')){toast('Selecione um arquivo de imagem.');avatarInput.value='';return;}const reader=new FileReader();reader.onload=()=>{$('#profileAvatarPreview').innerHTML=`<img src="${String(reader.result)}" alt="Prévia da foto">`;$('#profileRemoveAvatar').checked=false;};reader.readAsDataURL(file);};
  $('#profileRemoveAvatar').onchange=()=>{if($('#profileRemoveAvatar').checked){avatarInput.value='';$('#profileAvatarPreview').textContent=profileInitialsFor($('#profileNickname').value,$('#profileDisplayName').value);}};
  const updatePreviewInitials=()=>{if(!$('#profileAvatarFile').files?.length&&!$('#profileRemoveAvatar').checked&&!profile.avatarImage){$('#profileAvatarPreview').textContent=profileInitialsFor($('#profileNickname').value,$('#profileDisplayName').value);}};
  $('#profileNickname').addEventListener('input',updatePreviewInitials);$('#profileDisplayName').addEventListener('input',updatePreviewInitials);
  $('#profileCancel').onclick=()=>$('#modalBackdrop').classList.remove('open');
  $('#editorForm').onsubmit=async e=>{
    e.preventDefault();const fd=new FormData(e.target);const save=$('#editorForm button[type="submit"]');save.disabled=true;
    let uploaded='';try{const file=avatarInput.files?.[0];if(file)uploaded=await optimizeImageFile(file);}catch(err){console.error(err);toast('Não consegui processar essa imagem.');save.disabled=false;return;}
    profile={...profile,displayName:String(fd.get('displayName')||'').trim()||'Minha coleção',nickname:String(fd.get('nickname')||'').trim(),about:String(fd.get('about')||'').trim(),favoritePlatform:String(fd.get('favoritePlatform')||''),collectionGoal:Math.max(0,Math.min(100000,Number(fd.get('collectionGoal'))||0)),accentColor:String(fd.get('accentColor')||'#a855f7'),avatarImage:uploaded||(fd.get('removeAvatar')==='on'?'':profile.avatarImage)};
    if($('#profileRemoveAvatar').checked)profile.avatarImage='';
    try{localStorage.setItem(PROFILE_KEY,JSON.stringify(profile));queueCloudSync();if(typeof syncActiveProfileMeta==='function')syncActiveProfileMeta();}catch(err){toast('Não foi possível salvar o perfil. Tente uma imagem menor.');save.disabled=false;return;}
    updateProfileBadge();$('#modalBackdrop').classList.remove('open');render();toast('Perfil salvo');
  };
}
function profileInitialsFor(nickname,displayName){const base=(String(nickname||'').trim()||String(displayName||'').trim()||'Minha coleção');const bits=base.split(/\s+/).filter(Boolean);return bits.length>1?(bits[0][0]+bits[1][0]).toUpperCase():base.slice(0,2).toUpperCase();}

function wireImagePreview(inputId,previewId,existingImage,fallbackText,removeId){
  const input=document.getElementById(inputId),preview=document.getElementById(previewId),remove=document.getElementById(removeId);
  const showFallback=()=>{preview.innerHTML=`<span>${esc(fallbackText)}</span>`;};
  const showImage=src=>{preview.innerHTML=`<img src="${esc(src)}" alt="Prévia da imagem">`;};
  if(input)input.addEventListener('change',()=>{const file=input.files?.[0];if(!file)return; if(!file.type.startsWith('image/')){toast('Selecione um arquivo de imagem.');input.value='';return;}const reader=new FileReader();reader.onload=()=>{showImage(String(reader.result));if(remove)remove.checked=false;};reader.onerror=()=>toast('Não consegui ler essa imagem.');reader.readAsDataURL(file);});
  if(remove)remove.addEventListener('change',()=>{if(remove.checked){if(input)input.value='';showFallback();}else if(existingImage)showImage(existingImage);else showFallback();});
}
function optimizeImageFile(file,preserveAlpha=false){
  return new Promise((resolve,reject)=>{
    if(!file||!file.type.startsWith('image/')){reject(new Error('Arquivo não é uma imagem'));return;}
    const reader=new FileReader();
    reader.onerror=()=>reject(new Error('Falha lendo imagem'));
    reader.onload=()=>{
      const img=new Image();
      img.onerror=()=>reject(new Error('Falha decodificando imagem'));
      img.onload=()=>{
        const maxWidth=700,maxHeight=800,scale=Math.min(1,maxWidth/img.naturalWidth,maxHeight/img.naturalHeight);
        const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
        const ctx=canvas.getContext('2d');if(!ctx){reject(new Error('Canvas indisponível'));return;}
        if(!preserveAlpha){ctx.fillStyle='#15151f';ctx.fillRect(0,0,canvas.width,canvas.height);}
        ctx.drawImage(img,0,0,canvas.width,canvas.height);
        try{resolve(preserveAlpha?canvas.toDataURL('image/png'):canvas.toDataURL('image/jpeg',0.78));}catch(err){reject(err);}
      };
      img.src=String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
function toast(message){const el=$('#toast');el.textContent=message;el.classList.add('show');clearTimeout(window.__toastTimer);window.__toastTimer=setTimeout(()=>el.classList.remove('show'),2400)}
applyTheme((()=>{try{return localStorage.getItem('estanteTheme')||'default'}catch(e){return 'default'}})(),false);$('#sidebarCloudLoginButton').onclick=()=>{closeMobileSidebar();openCloudPanel();};$('#cloudLoginButton').onclick=openCloudPanel;$('#cloudClose').onclick=()=>$('#cloudBackdrop').classList.remove('open');$('#cloudBackdrop').onclick=e=>{if(e.target.id==='cloudBackdrop')$('#cloudBackdrop').classList.remove('open')};updateProfileBadge();updateWishlistBadge();$('#themeSettings').onclick=openThemeSettings;$('#profileButton').onclick=openProfileSettings;$('#mobileLibraryToggle').onclick=openMobileSidebar;$('#mobileSidebarBackdrop').onclick=closeMobileSidebar;document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMobileSidebar();});$('#sidebarToggle').onclick=()=>{if(window.matchMedia('(max-width:740px)').matches){closeMobileSidebar();return;}sidebarCollapsed=!sidebarCollapsed;try{localStorage.setItem('estanteSidebarCollapsed',sidebarCollapsed?'1':'0');}catch(e){}renderSidebarState();};$('#sgdbSettings').onclick=openSgdbSettings;document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{currentView=b.dataset.view;currentConsole=null;gameFilter='all';searchTerm='';$('#searchInput').value='';render();closeMobileSidebar();});$('#addConsoleMini').onclick=()=>openEditor('console');$('#heroAction').onclick=()=>openEditor('console');$('#addGameTop').onclick=()=>consoles.length?openEditor('game'):openEditor('console');$('#modalClose').onclick=()=>$('#modalBackdrop').classList.remove('open');$('#modalBackdrop').onclick=e=>{if(e.target.id==='modalBackdrop')$('#modalBackdrop').classList.remove('open')};document.addEventListener('keydown',e=>{if(e.key==='Escape')$('#modalBackdrop').classList.remove('open')});$('#searchInput').addEventListener('input',e=>{searchTerm=e.target.value.trim().toLowerCase();if(currentView==='platforms')renderPlatformCards(consoles.filter(c=>(c.name+' '+c.brand+' '+c.type).toLowerCase().includes(searchTerm)));else if(currentView==='allgames')renderGameCards(allGames());else if(currentView==='wishlist')renderWishlist();else{const c=consoles.find(c=>c.id===currentConsole);if(c)renderGameCards(c.games.map((g,i)=>({...g,consoleId:c.id,consoleName:c.name,gameIndex:i})));}});
$('#searchInput').addEventListener('input',e=>{e.stopImmediatePropagation();handleGlobalSearch(e.target.value);},true);
render();
// A inicialização da sessão fica no último script, depois que todos os dados auxiliares da Estante foram definidos.
