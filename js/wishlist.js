function wishlistMoneyTotal(items){return items.reduce((sum,item)=>sum+(hasMoneyValue(wishlistTargetPrice(item))?wishlistTargetPrice(item):0),0)}
function wishlistAccent(priority){return priority==='Alta'?'#ff6377':priority==='Baixa'?'#61cb8c':'#ffad56'}
function wishlistOfferSafeUrl(value){try{const u=new URL(String(value||''));return ['https:','http:'].includes(u.protocol)?u.href:'';}catch(e){return '';}}
function wishlistCreatedDate(value){const d=new Date(value);return Number.isNaN(d.getTime())?todayISO():d.toISOString().slice(0,10);}
function renderWishlist(){
  const content=$('#mainContent');
  let items=[...wishlist];
  if(searchTerm)items=items.filter(item=>`${item.title||''} ${item.kind||'game'} ${item.platformName||''} ${consoles.find(c=>c.id===item.platformId)?.name||''} ${item.genre||''} ${item.brand||''} ${item.consoleType||''} ${item.accessoryType||''} ${item.notes||''} ${wishlistTargetPrice(item)??''} ${(Array.isArray(item.offers)?item.offers:[]).map(offer=>`${offer.store||''} ${offer.price||''}`).join(' ')}`.toLowerCase().includes(searchTerm));
  if(wishlistFilters.kind!=='all')items=items.filter(item=>(item.kind||'game')===wishlistFilters.kind);
  if(wishlistFilters.priority!=='all')items=items.filter(item=>(item.priority||'Média')===wishlistFilters.priority);
  if(wishlistFilters.platform!=='all')items=items.filter(item=>(item.platformId||`name:${item.platformName||''}`)===wishlistFilters.platform);
  if(wishlistFilters.price==='none')items=items.filter(item=>!hasMoneyValue(wishlistTargetPrice(item)));
  else if(wishlistFilters.price==='target')items=items.filter(item=>hasMoneyValue(wishlistTargetPrice(item)));
  else if(wishlistFilters.price==='under100')items=items.filter(item=>hasMoneyValue(wishlistTargetPrice(item))&&wishlistTargetPrice(item)<100);
  else if(wishlistFilters.price==='100to500')items=items.filter(item=>hasMoneyValue(wishlistTargetPrice(item))&&wishlistTargetPrice(item)>=100&&wishlistTargetPrice(item)<=500);
  else if(wishlistFilters.price==='over500')items=items.filter(item=>hasMoneyValue(wishlistTargetPrice(item))&&wishlistTargetPrice(item)>500);
  if(wishlistSort==='priority'){const rank={'Alta':0,'Média':1,'Baixa':2};items.sort((a,b)=>(rank[a.priority]??1)-(rank[b.priority]??1)||String(a.title).localeCompare(String(b.title),'pt-BR'));}
  else if(wishlistSort==='price')items.sort((a,b)=>(wishlistTargetPrice(b)||0)-(wishlistTargetPrice(a)||0));
  else items.sort((a,b)=>(Number(b.createdAt)||0)-(Number(a.createdAt)||0));
  const estimate=wishlistMoneyTotal(wishlist);
  const high=wishlist.filter(i=>i.priority==='Alta').length;
  const wishlistPlatforms=[...new Map([...consoles.map(c=>[c.id,{id:c.id,name:c.name}]),...wishlist.filter(i=>i.platformName&&!i.platformId).map(i=>[`name:${i.platformName}`,{id:`name:${i.platformName}`,name:i.platformName}])]).values()].sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
  const hasWishlistFilters=wishlistFilters.kind!=='all'||wishlistFilters.priority!=='all'||wishlistFilters.platform!=='all'||wishlistFilters.price!=='all';
  content.innerHTML=`
    <div class="wishlist-summary">
      <article class="wishlist-stat" style="--wish-glow:#ff8848"><div><small>Na sua lista</small><p>Itens que quer encontrar</p></div><strong>${wishlist.length}</strong></article>
      <article class="wishlist-stat" style="--wish-glow:#4c8dff"><div><small>Orçamento estimado</small><p>Soma dos valores que você definiu</p></div><strong>${money(estimate)}</strong></article>
      <article class="wishlist-stat" style="--wish-glow:#ff5ca8"><div><small>Prioridade alta</small><p>Os que estão no topo da lista</p></div><strong>${high}</strong></article>
    </div>
    <div class="section-head"><div><h2>Próximos alvos</h2><p>${items.length} de ${wishlist.length} itens · salve ofertas e compare com seu preço-alvo.</p></div><select id="wishlistSort" class="wishlist-sort" aria-label="Ordenar wishlist"><option value="date" ${wishlistSort==='date'?'selected':''}>Adicionados recentemente</option><option value="priority" ${wishlistSort==='priority'?'selected':''}>Prioridade</option><option value="price" ${wishlistSort==='price'?'selected':''}>Maior orçamento</option></select></div>
    <div class="library-toolbar wishlist-filter-toolbar" aria-label="Filtros da wishlist">
      <label class="library-filter"><span>Tipo</span><select id="wishlistKindFilter"><option value="all" ${wishlistFilters.kind==='all'?'selected':''}>Todos</option><option value="game" ${wishlistFilters.kind==='game'?'selected':''}>Jogos</option><option value="console" ${wishlistFilters.kind==='console'?'selected':''}>Consoles</option><option value="accessory" ${wishlistFilters.kind==='accessory'?'selected':''}>Acessórios</option></select></label>
      <label class="library-filter"><span>Prioridade</span><select id="wishlistPriorityFilter"><option value="all" ${wishlistFilters.priority==='all'?'selected':''}>Todas</option><option value="Alta" ${wishlistFilters.priority==='Alta'?'selected':''}>Alta</option><option value="Média" ${wishlistFilters.priority==='Média'?'selected':''}>Média</option><option value="Baixa" ${wishlistFilters.priority==='Baixa'?'selected':''}>Baixa</option></select></label>
      <label class="library-filter"><span>Plataforma</span><select id="wishlistPlatformFilter"><option value="all">Todas</option>${wishlistPlatforms.map(p=>`<option value="${esc(p.id)}" ${wishlistFilters.platform===p.id?'selected':''}>${esc(p.name)}</option>`).join('')}</select></label>
      <label class="library-filter"><span>Preço-alvo</span><select id="wishlistPriceFilter"><option value="all" ${wishlistFilters.price==='all'?'selected':''}>Qualquer preço</option><option value="target" ${wishlistFilters.price==='target'?'selected':''}>Com preço-alvo</option><option value="none" ${wishlistFilters.price==='none'?'selected':''}>Sem preço-alvo</option><option value="under100" ${wishlistFilters.price==='under100'?'selected':''}>Até R$ 100</option><option value="100to500" ${wishlistFilters.price==='100to500'?'selected':''}>R$ 100 a R$ 500</option><option value="over500" ${wishlistFilters.price==='over500'?'selected':''}>Acima de R$ 500</option></select></label>
      ${hasWishlistFilters?'<button class="filter-reset" id="resetWishlistFilters" type="button">Limpar filtros</button>':''}
    </div>
    <div class="wishlist-grid">${items.length?items.map(item=>{const kind=item.kind||'game';const kindLabel=kind==='console'?'Console':kind==='accessory'?'Acessório':'Jogo';const platform=consoles.find(c=>c.id===item.platformId);const metadata=kind==='console'?[item.brand,item.consoleType,item.year].filter(Boolean).join(' · ')||'Console':kind==='accessory'?[item.accessoryType,platform?.name||item.platformName].filter(Boolean).join(' · ')||'Acessório':[platform?.name||item.platformName||'Plataforma não definida',item.genre].filter(Boolean).join(' · ');const accent=wishlistAccent(item.priority);const glyph=(String(item.title||'?').match(/[A-ZÀ-Ý0-9]/g)||String(item.title||'?').slice(0,3).toUpperCase().split('')).slice(0,3).join('');const offers=(Array.isArray(item.offers)?item.offers:[]).filter(o=>hasMoneyValue(o.price)).sort((a,b)=>Number(a.price)-Number(b.price));const bestOffer=offers[0];const targetHistory=Array.isArray(item.targetPriceHistory)?item.targetPriceHistory:[];const targetPrice=wishlistTargetPrice(item);return `<article class="wishlist-card" style="--wish-accent:${accent}">
      <div class="wishlist-cover ${item.coverImage?'has-image':''}" aria-hidden="true">${item.coverImage?`<img loading="lazy" src="${esc(item.coverImage)}" alt="">`:`<b>${esc(glyph||'???')}</b>`}</div>
      <div class="wishlist-body"><div class="wishlist-topline"><span class="wishlist-priority ${item.priority==='Alta'?'high':item.priority==='Baixa'?'low':'medium'}">${kindLabel} · ${esc(item.priority||'Média')} prioridade</span><button class="wishlist-remove" type="button" data-wish-remove="${esc(item.id)}" title="Remover da wishlist" aria-label="Remover ${esc(item.title)}">×</button></div>
        <h3 class="wishlist-title">${esc(item.title)}</h3><div class="wishlist-meta">${esc(metadata)}</div>
        <div class="wishlist-price">${hasMoneyValue(targetPrice)?money(targetPrice):'Sem preço-alvo'}<small>${hasMoneyValue(targetPrice)?'Seu preço-alvo':'Adicione um preço-alvo para acompanhar'}</small></div>
        ${bestOffer?`<div class="wishlist-best-offer"><strong>Melhor oferta: ${money(bestOffer.price)}</strong><small>${esc(bestOffer.store||'Loja não informada')}${bestOffer.date?' · '+esc(displayDate(bestOffer.date)):''}</small></div>`:''}
        ${offers.length?`<details class="wishlist-offer-details"><summary>Comparar ${offers.length} oferta(s)</summary><div>${offers.map(o=>`<p><strong>${money(o.price)}</strong> · ${esc(o.store||'Loja não informada')}${o.date?' · '+esc(displayDate(o.date)):''}${wishlistOfferSafeUrl(o.url)?` · <a href="${esc(wishlistOfferSafeUrl(o.url))}" target="_blank" rel="noopener noreferrer">Abrir oferta ↗</a>`:''}</p>`).join('')}</div></details>`:''}
        ${targetHistory.length>1?`<details class="wishlist-offer-details target-history-details"><summary>Histórico do preço-alvo (${targetHistory.length})</summary><div>${[...targetHistory].reverse().map(h=>`<p>${esc(displayDate(h.date))} · ${hasMoneyValue(h.value)?money(h.value):'Sem preço-alvo'}</p>`).join('')}</div></details>`:''}
        ${item.notes?`<p class="wishlist-notes">${esc(item.notes.length>130?item.notes.slice(0,130)+'…':item.notes)}</p>`:''}
        <div class="wishlist-actions"><button class="wish-edit" type="button" data-wish-edit="${esc(item.id)}">Editar</button><button class="wish-owned" type="button" data-wish-owned="${esc(item.id)}">＋ ${kind==='console'?'Adicionar à coleção':kind==='accessory'?'Adicionar ao inventário':'Adicionar à coleção'}</button></div>
      </div></article>`;}).join(''):`<div class="wishlist-empty"><div class="wish-icon">♡</div><h3>${searchTerm||hasWishlistFilters?'Nenhum item encontrado':'Sua wishlist começa aqui'}</h3><p>${searchTerm||hasWishlistFilters?'Ajuste ou limpe os filtros para ver outros itens da sua lista.':'Anote jogos, consoles e acessórios que você quer encontrar. Defina prioridade e preço-alvo para organizar sua busca.'}</p>${searchTerm||hasWishlistFilters?'':'<button class="primary" type="button" id="emptyWishlistAdd">＋ Adicionar primeiro item</button>'}</div>`}</div>
    <div class="retro-note"><span>✦</span><div>Uma pequena lista de caça ao tesouro: anote a edição que procura e um preço-alvo realista. O orçamento é uma referência sua, não uma cotação automática.</div></div>`;
  const sort=$('#wishlistSort');if(sort)sort.onchange=()=>{wishlistSort=sort.value;renderWishlist();};
  $('#wishlistKindFilter').onchange=e=>{wishlistFilters.kind=e.target.value;renderWishlist();};$('#wishlistPriorityFilter').onchange=e=>{wishlistFilters.priority=e.target.value;renderWishlist();};$('#wishlistPlatformFilter').onchange=e=>{wishlistFilters.platform=e.target.value;renderWishlist();};$('#wishlistPriceFilter').onchange=e=>{wishlistFilters.price=e.target.value;renderWishlist();};
  const resetWishFilters=$('#resetWishlistFilters');if(resetWishFilters)resetWishFilters.onclick=()=>{wishlistFilters={kind:'all',priority:'all',platform:'all',price:'all'};renderWishlist();};
  const add=$('#emptyWishlistAdd');if(add)add.onclick=()=>openWishlistEditor();
  content.querySelectorAll('[data-wish-edit]').forEach(btn=>btn.onclick=()=>{const item=wishlist.find(i=>i.id===btn.dataset.wishEdit);if(item)openWishlistEditor(item);});
  content.querySelectorAll('[data-wish-remove]').forEach(btn=>btn.onclick=()=>{const item=wishlist.find(i=>i.id===btn.dataset.wishRemove);if(!item)return;if(!confirm(`Remover “${item.title}” da wishlist?`))return;wishlist=wishlist.filter(i=>i.id!==item.id);persistWishlist();renderWishlist();toast('Jogo removido da wishlist');});
  content.querySelectorAll('[data-wish-owned]').forEach(btn=>btn.onclick=()=>{
    const item=wishlist.find(i=>i.id===btn.dataset.wishOwned);if(!item)return;
    const kind=item.kind||'game';
    if(kind==='console'){
      if(consoles.some(c=>String(c.name||'').trim().toLowerCase()===String(item.title||'').trim().toLowerCase())){toast('Esse console já aparece na sua coleção.');return;}
      const colors={Sony:'#5b7cfa',Nintendo:'#ff5269',Xbox:'#c7f464',Sega:'#28d9e8',Computador:'#a855f7',Outro:'#ff805c'};
      const id='wish-console-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,6);
      consoles.push({id,short:String(item.title||'').slice(0,8),name:item.title,brand:item.brand||'Outro',type:item.consoleType||'Console de mesa',year:Number(item.year)||0,color:colors[item.brand]||colors.Outro,coverImage:item.coverImage||'',games:[],targetPrice:wishlistTargetPrice(item),wishlistAcquisition:wishlistAcquisitionData(item)});
      if(!persist())return;wishlist=wishlist.filter(i=>i.id!==item.id);persistWishlist();currentView='platforms';currentConsole=null;render();toast('Console adicionado à coleção');return;
    }
    if(kind==='accessory'){
      accessories.push({id:'accessory-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,6),name:item.title,type:item.accessoryType||'Outro',platformId:item.platformId||'',platformName:item.platformName||'',condition:'Não informada',pricePaid:null,targetPrice:wishlistTargetPrice(item),wishlistAcquisition:wishlistAcquisitionData(item),notes:item.notes||'',coverImage:item.coverImage||'',createdAt:Date.now(),updatedAt:Date.now()});
      if(!persistAccessories())return;wishlist=wishlist.filter(i=>i.id!==item.id);persistWishlist();currentView='accessories';currentConsole=null;render();toast('Acessório adicionado ao inventário');return;
    }
    const target=consoles.find(c=>c.id===item.platformId)||consoles[0];
    if(!target){toast('Adicione uma plataforma antes de mover jogos para a coleção.');return;}
    const duplicate=target.games.some(g=>String(g.title||'').trim().toLowerCase()===String(item.title||'').trim().toLowerCase());
    if(duplicate&&!confirm(`“${item.title}” já aparece em ${target.name}. Adicionar outra cópia?`))return;
    target.games.push({title:item.title,year:Number(item.year)||0,genre:item.genre||'Jogo',status:'Backlog',pricePaid:null,marketValue:null,marketValueSource:'',marketValueDate:'',wishlistAcquisition:wishlistAcquisitionData(item),condition:'Não informado',completeness:'Não informado',authenticity:'Não verificado',notes:item.notes?`Anotado na wishlist: ${item.notes}`:'Adicionado a partir da wishlist.',glyph:(String(item.title).match(/[A-ZÀ-Ý0-9]/g)||['G']).slice(0,4).join(''),cover:`linear-gradient(145deg,${target.color},#171725)`,coverImage:item.coverImage||''});
    wishlist=wishlist.filter(i=>i.id!==item.id);persist();persistWishlist();currentView='console';currentConsole=target.id;searchTerm='';$('#searchInput').value='';render();toast('Jogo adicionado à coleção');
  });
}
function wireWishlistTitleSuggestions(){
 const input=$('#wishTitle'),wrap=$('#wishSuggestions');if(!input||!wrap)return;let timer=null,generation=0;
 input.addEventListener('input',()=>{clearTimeout(timer);const current=++generation;wrap.innerHTML='';if($('#wishKind')?.value!=='game')return;const q=input.value.trim();if(q.length<2)return;timer=setTimeout(async()=>{if(!steamGridDbKey){wrap.innerHTML='<div class="sgdb-status">Configure a chave SteamGridDB para sugestões automáticas. Você também pode digitar o nome manualmente.</div>';return;}wrap.innerHTML='<div class="sgdb-status">Buscando títulos…</div>';const results=await searchSgdbTitles(q,false);if(current!==generation||$('#wishTitle')!==input)return;if(!results.length){wrap.innerHTML='<div class="sgdb-status">Nenhuma sugestão encontrada; você pode manter o nome digitado.</div>';return;}wrap.innerHTML=results.slice(0,6).map(g=>`<button type="button" class="sgdb-suggestion" data-wish-title="${esc(g.name)}"><span>${esc(g.name)}<small>${esc((g.types||[]).join(' · ')||'Jogo')}</small></span><span>Usar</span></button>`).join('');wrap.querySelectorAll('[data-wish-title]').forEach(b=>b.onclick=()=>{input.value=b.dataset.wishTitle;wrap.innerHTML='';input.focus();});},350);
 });
 $('#wishKind')?.addEventListener('change',()=>{clearTimeout(timer);generation++;wrap.innerHTML='';});
}
async function optimizeWishlistImage(file){
  if(!file||!String(file.type||'').startsWith('image/'))throw new Error('Escolha um arquivo de imagem válido.');
  if(file.size>15*1024*1024)throw new Error('A imagem precisa ter menos de 15 MB antes da otimização.');
  const objectUrl=URL.createObjectURL(file);
  try{
    const image=await new Promise((resolve,reject)=>{
      const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('Não consegui abrir essa imagem.'));img.src=objectUrl;
    });
    let scale=Math.min(1,900/Math.max(image.naturalWidth,image.naturalHeight));
    let result='';
    for(let i=0;i<7;i++){
      const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
      const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Seu navegador não conseguiu processar a imagem.');
      ctx.drawImage(image,0,0,canvas.width,canvas.height);
      result=canvas.toDataURL('image/webp',Math.max(.55,.84-i*.045));
      if(result.length<=480*1024)break;
      scale*=.82;
    }
    if(result.length>820*1024)throw new Error('Essa imagem continua muito grande. Tente uma imagem menor.');
    return result;
  }finally{URL.revokeObjectURL(objectUrl);}
}
function wireWishlistCoverTools(){
  const file=$('#wishCoverFile'),hidden=$('#wishCoverImage'),preview=$('#wishCoverPreview'),clear=$('#wishCoverClear');
  const search=$('#wishSgdbSearch'),status=$('#wishSgdbStatus'),results=$('#wishSgdbResults');
  if(!file||!hidden||!preview||!clear||!search||!status||!results)return;
  const showPreview=value=>{preview.innerHTML=value?`<img src="${esc(value)}" alt="Prévia da capa">`:'<span>CAPA</span>';};
  clear.onclick=()=>{hidden.value='';file.value='';showPreview('');results.innerHTML='';status.className='sgdb-status';status.textContent='Imagem removida. Salve o item para aplicar a alteração.';};
  file.onchange=async()=>{
    const selected=file.files&&file.files[0];if(!selected)return;
    status.className='sgdb-status';status.textContent='Otimizando a imagem…';file.disabled=true;
    try{
      const imageData=await optimizeWishlistImage(selected);hidden.value=imageData;showPreview(imageData);results.innerHTML='';
      status.className='sgdb-status success';status.textContent='Imagem pronta. Salve o item da wishlist para guardar a capa.';
    }catch(e){status.className='sgdb-status error';status.textContent=e.message||'Não foi possível usar essa imagem.';file.value='';}
    finally{file.disabled=false;}
  };
  search.onclick=async()=>{
    const query=$('#wishTitle')?.value.trim()||'';
    if(query.length<2){status.className='sgdb-status error';status.textContent='Digite primeiro o nome do jogo (pelo menos 2 caracteres).';return;}
    if(!steamGridDbKey){status.className='sgdb-status error';status.textContent='Configure sua chave SteamGridDB em Configurações gerais → APIs e tente novamente.';return;}
    search.disabled=true;results.innerHTML='';status.className='sgdb-status';status.textContent='Buscando o jogo e suas artes na SteamGridDB…';
    try{
      const matches=await searchSgdbTitles(query,false);
      if(!matches.length){status.className='sgdb-status error';status.textContent='Nenhum jogo encontrado. Confira o título ou use uma imagem do dispositivo.';return;}
      const artSets=[];
      for(const match of matches.slice(0,4)){
        let arts=[];
        try{arts=await sgdbRequest('/grids/game/'+encodeURIComponent(match.id)+'?dimensions=600x900&limit=16');}catch(e){}
        if(!arts.length){try{arts=await sgdbRequest('/grids/game/'+encodeURIComponent(match.id)+'?limit=16');}catch(e){}}
        for(const art of arts.slice(0,10))artSets.push({...art,matchName:match.name,matchId:match.id});
      }
      if(!artSets.length){status.className='sgdb-status';status.textContent='Encontramos o título, mas não há artes disponíveis na SteamGridDB. Tente outro resultado ou envie uma imagem própria.';return;}
      status.className='sgdb-status success';status.textContent=`${artSets.length} artes encontradas. Clique na capa que deseja usar.`;
      results.innerHTML='<div class="sgdb-cover-grid wishlist-sgdb-cover-grid">'+artSets.slice(0,32).map((art,index)=>`<button type="button" class="sgdb-cover-option ${hidden.value===art.url?'selected':''}" data-wish-sgdb-cover="${esc(art.url)}" title="Usar arte de ${esc(art.matchName)}"><img loading="lazy" src="${esc(art.thumb||art.url)}" alt="Capa ${index+1}" data-full="${esc(art.url)}" onerror="if(this.dataset.fallback!==\'1\'){this.dataset.fallback=\'1\';this.src=this.dataset.full;}"><span>${esc(art.matchName)} · ${esc(art.style||art.author?.name||('Arte '+(index+1)))}</span></button>`).join('')+'</div>';
      results.querySelectorAll('[data-wish-sgdb-cover]').forEach(button=>button.onclick=()=>{
        hidden.value=button.dataset.wishSgdbCover||'';file.value='';showPreview(hidden.value);
        results.querySelectorAll('.sgdb-cover-option').forEach(option=>option.classList.toggle('selected',option===button));
        status.className='sgdb-status success';status.textContent='Capa SteamGridDB selecionada. Salve o item para aplicar a imagem.';
      });
    }catch(e){status.className='sgdb-status error';status.textContent=e.message||'Falha ao buscar artes na SteamGridDB.';}
    finally{search.disabled=false;}
  };
}
function openWishlistEditor(item=null){
  const editing=!!item;const returnView=currentView;const defaultPlatform=consoles.some(c=>c.id===item?.platformId)?item.platformId:(currentConsole||consoles[0]?.id||'');
  let offerDrafts=Array.isArray(item?.offers)?item.offers.map(offer=>({...offer})):[];
  $('#modalTitle').textContent=editing?`Editar ${item.kind==='console'?'console':item.kind==='accessory'?'acessório':'jogo'} da wishlist`:'Adicionar à wishlist';
  $('#editorForm').innerHTML=`
    <div class="form-hint" style="margin-bottom:14px;color:#9ba9c3;font-size:12px;line-height:1.6">Guarde jogos, consoles e acessórios que você quer encontrar. Defina a prioridade, o preço-alvo e os detalhes importantes.</div>
    <div class="field"><label for="wishKind">Tipo de item</label><select id="wishKind" name="kind"><option value="game" ${(item?.kind||'game')==='game'?'selected':''}>Jogo</option><option value="console" ${item?.kind==='console'?'selected':''}>Console</option><option value="accessory" ${item?.kind==='accessory'?'selected':''}>Acessório</option></select></div>
    <div class="field"><label id="wishTitleLabel" for="wishTitle">Nome do jogo</label><input id="wishTitle" name="title" maxlength="100" required value="${esc(item?.title||'')}" placeholder="Ex.: Rule of Rose" autocomplete="off"><div class="sgdb-suggestions" id="wishSuggestions"></div><div class="sgdb-help" id="wishGameHints">As sugestões de títulos e as capas da SteamGridDB usam a chave configurada nas configurações gerais.</div></div>
    <div class="form-row" data-wish-kind="console" ${item?.kind==='console'?'':'hidden'}><div class="field"><label for="wishConsoleBrand">Fabricante</label><select id="wishConsoleBrand" name="brand">${['Sony','Nintendo','Xbox','Sega','Computador','Outro'].map(v=>`<option ${v===(item?.brand||'Sony')?'selected':''}>${v}</option>`).join('')}</select></div><div class="field"><label for="wishConsoleType">Tipo de console</label><select id="wishConsoleType" name="consoleType">${['Console de mesa','Portátil','Híbrido','Computador','Outro'].map(v=>`<option ${v===(item?.consoleType||'Console de mesa')?'selected':''}>${v}</option>`).join('')}</select></div><div class="field"><label for="wishConsoleYear">Ano (opcional)</label><input id="wishConsoleYear" name="year" type="number" min="1970" max="2100" value="${item?.kind==='console'?esc(item?.year||''):''}" placeholder="2001"></div></div>
    <div class="form-row" data-wish-kind="accessory" ${item?.kind==='accessory'?'':'hidden'}><div class="field"><label for="wishAccessoryType">Categoria</label><select id="wishAccessoryType" name="accessoryType">${['Controle','Memory card','Cabo/adaptador','Cartão de memória','Periférico','Console','Caixa/estojo','Outro'].map(v=>`<option ${v===(item?.accessoryType||'Controle')?'selected':''}>${v}</option>`).join('')}</select></div><div class="field"><label for="wishAccessoryPlatform">Plataforma relacionada</label><select id="wishAccessoryPlatform" name="accessoryPlatformId"><option value="">Sem plataforma específica</option>${consoles.map(c=>`<option value="${esc(c.id)}" ${c.id===defaultPlatform?'selected':''}>${esc(c.name)}</option>`).join('')}</select></div></div>
    <div class="editor-section"><strong>Imagem do item</strong><small>Envie sua imagem${(item?.kind||'game')==='game'?' ou encontre uma arte na SteamGridDB':''}</small></div>
    <div class="cover-upload wishlist-cover-upload"><div class="cover-preview" id="wishCoverPreview">${item?.coverImage?`<img src="${esc(item.coverImage)}" alt="Prévia da capa">`:'<span>CAPA</span>'}</div><div class="cover-upload-controls"><label for="wishCoverFile">Enviar imagem do dispositivo</label><input class="image-file-input" type="file" id="wishCoverFile" accept="image/*"><small>A imagem será otimizada para ocupar menos espaço no navegador. Você também pode selecionar uma capa da SteamGridDB abaixo.</small><button type="button" class="secondary wishlist-cover-clear" id="wishCoverClear">Remover imagem</button></div></div>
    <input type="hidden" id="wishCoverImage" name="coverImage" value="${esc(item?.coverImage||'')}">
    <div id="wishSgdbTools" ${item?.kind&&item.kind!=='game'?'hidden':''}><div class="sgdb-actions wishlist-sgdb-actions"><button type="button" class="secondary" id="wishSgdbSearch">▧ Buscar capas na SteamGridDB</button></div><div class="sgdb-status" id="wishSgdbStatus" role="status" aria-live="polite">Digite o nome do jogo e busque artes. É necessário configurar a chave SteamGridDB nas configurações gerais.</div><div id="wishSgdbResults"></div></div>
    <div class="form-row" data-wish-kind="game" ${item?.kind&&item.kind!=='game'?'hidden':''}><div class="field"><label for="wishPlatform">Plataforma</label><select id="wishPlatform" name="platformId"><option value="">${consoles.length?"Selecione a plataforma":"Cadastre um console depois (opcional)"}</option>${consoles.map(c=>`<option value="${esc(c.id)}" ${c.id===defaultPlatform?'selected':''}>${esc(c.name)}</option>`).join('')}</select></div><div class="field"><label for="wishGenre">Gênero (opcional)</label><input id="wishGenre" name="genre" maxlength="60" value="${esc(item?.genre||'')}" placeholder="RPG, luta, terror..."></div></div>
      <div class="form-row"><div class="field"><label for="wishPrice">Preço que pretende pagar (R$)</label><input id="wishPrice" name="targetPrice" type="number" min="0" step="0.01" value="${hasMoneyValue(wishlistTargetPrice(item))?wishlistTargetPrice(item):''}" placeholder="Ex.: 120,00"><small style="color:#8795ae;font-size:10px">É seu preço-alvo, não uma cotação automática.</small></div><div class="field"><label for="wishPriority">Prioridade</label><select id="wishPriority" name="priority"><option ${!item||item.priority==='Média'?'selected':''}>Média</option><option ${item?.priority==='Alta'?'selected':''}>Alta</option><option ${item?.priority==='Baixa'?'selected':''}>Baixa</option></select></div></div>
    <section class="wishlist-offer-editor"><div class="wishlist-offer-editor-head"><div><strong>Ofertas encontradas</strong><small>Registre loja, preço, data e link para comparar manualmente.</small></div><button class="secondary" type="button" id="wishAddOffer">＋ Registrar oferta</button></div><div id="wishOfferRows"></div></section>
    <div class="field"><label for="wishNotes">Observações (opcional)</label><textarea id="wishNotes" name="notes" maxlength="700" placeholder="Edição específica, região, itens que precisam vir junto, preço máximo...">${esc(item?.notes||'')}</textarea></div>
    <div class="modal-actions">${editing?'<button class="secondary" type="button" id="wishDeleteFromForm">Remover</button>':''}<button class="secondary" type="button" id="cancelEdit">Cancelar</button><button class="primary" type="submit">${editing?'Salvar alterações':'Salvar na wishlist'}</button></div>`;
  $('#modalBackdrop').classList.add('open');
  const wishKind=$('#wishKind');
  const updateWishKind=()=>{const kind=wishKind.value;$('#wishTitleLabel').textContent=kind==='console'?'Nome do console':kind==='accessory'?'Nome do acessório':'Nome do jogo';$('#wishTitle').placeholder=kind==='console'?'Ex.: Sega Dreamcast':kind==='accessory'?'Ex.: Controle DualShock 2':'Ex.: Rule of Rose';$('#wishGameHints').hidden=kind!=='game';$('#wishSuggestions').hidden=kind!=='game';$('#wishSgdbTools').hidden=kind!=='game';document.querySelectorAll('[data-wish-kind]').forEach(el=>{el.hidden=el.dataset.wishKind!==kind;});};
  wishKind.onchange=updateWishKind;updateWishKind();
  const offerRows=$('#wishOfferRows');
  const readOfferRows=()=>[...offerRows.querySelectorAll('[data-wish-offer-row]')].map(row=>({store:row.querySelector('[data-offer-store]').value.trim(),price:row.querySelector('[data-offer-price]').value.trim(),url:row.querySelector('[data-offer-url]').value.trim(),date:row.querySelector('[data-offer-date]').value||todayISO()}));
  const drawOfferRows=()=>{offerRows.innerHTML=offerDrafts.map((offer,index)=>`<div class="wishlist-offer-row" data-wish-offer-row><label><span>Loja</span><input data-offer-store maxlength="80" value="${esc(offer.store||'')}" placeholder="Ex.: Loja ou marketplace"></label><label><span>Preço (R$)</span><input data-offer-price type="number" min="0" step="0.01" value="${hasMoneyValue(offer.price)?Number(offer.price):''}" placeholder="0,00"></label><label class="wishlist-offer-url"><span>Link da oferta</span><input data-offer-url type="url" value="${esc(offer.url||'')}" placeholder="https://..."></label><label><span>Data</span><input data-offer-date type="date" value="${esc(offer.date||todayISO())}"></label><button class="wishlist-offer-remove" type="button" data-remove-offer="${index}" aria-label="Remover oferta">×</button></div>`).join('');offerRows.querySelectorAll('[data-remove-offer]').forEach(button=>button.onclick=()=>{const current=readOfferRows();current.splice(Number(button.dataset.removeOffer),1);offerDrafts=current;drawOfferRows();});};
  drawOfferRows();
  $('#wishAddOffer').onclick=()=>{offerDrafts=readOfferRows();offerDrafts.push({price:'',date:todayISO()});drawOfferRows();offerRows.lastElementChild?.querySelector('[data-offer-store]')?.focus();};
  wireWishlistTitleSuggestions();
  wireWishlistCoverTools();
  $('#cancelEdit').onclick=()=>$('#modalBackdrop').classList.remove('open');
  const del=$('#wishDeleteFromForm');if(del)del.onclick=()=>{if(!confirm(`Remover “${item.title}” da wishlist?`))return;wishlist=wishlist.filter(i=>i.id!==item.id);persistWishlist();$('#modalBackdrop').classList.remove('open');if(returnView==='profile')renderProfileOverviewView();else renderWishlist();toast('Item removido da wishlist');};
  $('#modalClose').onclick=()=>$('#modalBackdrop').classList.remove('open');
  $('#editorForm').onsubmit=e=>{e.preventDefault();const fd=new FormData(e.target);const kind=String(fd.get('kind')||'game');const platformId=kind==='accessory'?String(fd.get('accessoryPlatformId')||''):String(fd.get('platformId')||'');const platform=consoles.find(c=>c.id===platformId);const priceRaw=String(fd.get('targetPrice')||'').trim();const price=priceRaw===''?null:Number(priceRaw);if(price!==null&&(!Number.isFinite(price)||price<0)){toast('Confira o preço informado.');return;}
    const offers=readOfferRows().filter(offer=>offer.price!=='').map(offer=>({...offer,price:Number(offer.price)}));if(offers.some(offer=>!Number.isFinite(offer.price)||offer.price<0)){toast('Confira os preços das ofertas.');return;}
    const targetPriceHistory=Array.isArray(item?.targetPriceHistory)?item.targetPriceHistory.slice():[];const oldTarget=wishlistTargetPrice(item);const targetChanged=item?(price===null?oldTarget!==null:oldTarget===null||oldTarget!==price):price!==null;if(item&&oldTarget!==null&&!targetPriceHistory.length)targetPriceHistory.push({date:wishlistCreatedDate(item.createdAt),value:oldTarget});if(targetChanged)targetPriceHistory.push({date:todayISO(),value:price});
    const updated={id:item?.id||`wish-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,kind,title:String(fd.get('title')||'').trim(),platformId:platform?.id||'',platformName:platform?.name||'',genre:kind==='game'?String(fd.get('genre')||'').trim():'',brand:kind==='console'?String(fd.get('brand')||'Outro'):'',consoleType:kind==='console'?String(fd.get('consoleType')||'Console de mesa'):'',accessoryType:kind==='accessory'?String(fd.get('accessoryType')||'Outro'):'',year:kind==='console'?(Number(fd.get('year'))||''):0,targetPrice:price,targetPriceHistory,offers,priority:String(fd.get('priority')||'Média'),notes:String(fd.get('notes')||'').trim(),coverImage:String(fd.get('coverImage')||''),createdAt:item?.createdAt||Date.now(),updatedAt:Date.now()};
    if(!updated.title){toast('Digite o nome do item.');return;}if(item){const idx=wishlist.findIndex(i=>i.id===item.id);if(idx>=0)wishlist[idx]=updated;else wishlist.push(updated);}else wishlist.push(updated);
    if(!persistWishlist())return;$('#modalBackdrop').classList.remove('open');searchTerm='';$('#searchInput').value='';if(returnView==='profile')renderProfileOverviewView();else renderWishlist();toast(item?'Wishlist atualizada':'Item adicionado à wishlist');
  };
}

