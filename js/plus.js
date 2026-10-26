
/* Recursos Plus: estatísticas compactas, backups automáticos, lixeira restaurável e importação CSV. */
const ESTANTE_PLUS_DB_NAME='EstanteRetroPlusDB';
const ESTANTE_PLUS_DB_VERSION=1;
let estantePlusBackupTimer=null;
let estantePlusLastBackupError='';
function estantePlusOpenDB(){
 return new Promise((resolve,reject)=>{
  if(!('indexedDB' in window)){reject(new Error('Este navegador não oferece IndexedDB.'));return;}
  let req;try{req=indexedDB.open(ESTANTE_PLUS_DB_NAME,ESTANTE_PLUS_DB_VERSION);}catch(e){reject(e);return;}
  req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains('snapshots'))db.createObjectStore('snapshots',{keyPath:'id'});if(!db.objectStoreNames.contains('trash'))db.createObjectStore('trash',{keyPath:'id'});};
  req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||new Error('Falha ao abrir o armazenamento de backups.'));
 });
}
function estantePlusDBRequest(store,mode,action,value){
 return estantePlusOpenDB().then(db=>new Promise((resolve,reject)=>{
  let tx;try{tx=db.transaction(store,mode);const os=tx.objectStore(store);let req;
   if(action==='getAll')req=os.getAll();else if(action==='put')req=os.put(value);else if(action==='delete')req=os.delete(value);else if(action==='clear')req=os.clear();
   if(req){req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||tx.error||new Error('Falha de armazenamento.'));}else resolve();
   tx.oncomplete=()=>db.close();tx.onerror=()=>{db.close();reject(tx.error||new Error('Falha na transação.'));};tx.onabort=()=>{db.close();reject(tx.error||new Error('Transação cancelada.'));};
  }catch(e){try{db.close()}catch(_){}reject(e);}
 }));
}
function estantePlusScheduleBackup(){
 if(estantePlusBackupTimer)clearTimeout(estantePlusBackupTimer);
 estantePlusBackupTimer=setTimeout(()=>{estantePlusBackupTimer=null;void estantePlusCreateAutoBackup();},1800);
}
async function estantePlusCreateAutoBackup(){
 try{
  const payload={app:'Estante Retro',schemaVersion:2,exportedAt:new Date().toISOString(),profileId:currentProfileId,consoles,wishlist,profile,accessories};
  const serial=JSON.stringify(payload);
  if(serial.length>25*1024*1024){estantePlusLastBackupError='Esta cópia tem mais de 25 MB; reduza imagens incorporadas ou exporte um backup manual.';return;}
  const rows=await estantePlusDBRequest('snapshots','readonly','getAll');
  if(rows.some(r=>r.profileId===currentProfileId&&r.signature===estantePlusHash(serial)))return;
  const record={id:'auto-'+currentProfileId+'-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),createdAt:new Date().toISOString(),profileId:currentProfileId,profileName:String(profile.nickname||profile.displayName||'Minha coleção'),signature:estantePlusHash(serial),payload:JSON.parse(serial)};
  await estantePlusDBRequest('snapshots','readwrite','put',record);
  const all=(await estantePlusDBRequest('snapshots','readonly','getAll')).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
  const perProfile=all.filter(r=>r.profileId===currentProfileId);for(const extra of perProfile.slice(2))await estantePlusDBRequest('snapshots','readwrite','delete',extra.id);
  estantePlusLastBackupError='';
  if($('#autoBackupStatus'))void estantePlusRenderStoragePanels();
 }catch(e){estantePlusLastBackupError=e?.message||'Backup automático indisponível neste navegador.';}
}
function estantePlusHash(text){let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(16)+'-'+text.length;}
function estantePlusConfirmRestore(){return confirm('Restaurar esta cópia vai substituir a coleção, wishlist, perfil e acessórios atuais deste perfil. Faça um backup manual antes se quiser guardar o estado atual. Continuar?');}
async function estantePlusRestoreSnapshot(id){
 let rec;try{rec=(await estantePlusDBRequest('snapshots','readonly','getAll')).find(r=>r.id===id);}catch(e){toast('Não consegui abrir o backup automático.');return;}
 if(!rec||!rec.payload){toast('Esse backup não está disponível.');return;}
 if(rec.profileId!==currentProfileId){toast('Este backup pertence a outro perfil. Troque para esse perfil antes de restaurá-lo.');return;}
 if(!estantePlusConfirmRestore())return;
 const p=rec.payload,validated=validateEstanteBackup(p);if(!validated.ok){toast('Backup automático inválido: '+validated.error);return;}
 const c=validated.consoles;const nextWish=validated.wishlist;const nextProfile={...defaultProfile,...validated.profile};const nextAcc=validated.accessories;
 const keys=[profileDataKey('estanteCollectionV1'),profileDataKey('estanteWishlistV1'),PROFILE_KEY,profileDataKey('estanteAccessoriesV1')];const before=Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)]));
 try{localStorage.setItem(keys[0],JSON.stringify(c));localStorage.setItem(keys[1],JSON.stringify(nextWish));localStorage.setItem(keys[2],JSON.stringify(nextProfile));localStorage.setItem(keys[3],JSON.stringify(nextAcc));}
 catch(e){for(const k of keys){try{if(before[k]===null)localStorage.removeItem(k);else localStorage.setItem(k,before[k]);}catch(_){}}toast('Não há espaço suficiente para restaurar esta cópia.');return;}
 consoles=c;wishlist=nextWish;profile=nextProfile;accessories=nextAcc;syncActiveProfileMeta?.();queueCloudSync();currentView='allgames';currentConsole=null;searchTerm='';$('#searchInput').value='';updateProfileBadge();updateWishlistBadge();render();estantePlusScheduleBackup();toast('Backup automático restaurado.');
}
async function estanteMoveGameToTrash(owner,index,skipConfirm=false){
 const game=owner?.games?.[index];if(!game)return;
 if(!skipConfirm&&!confirm(`Mover “${game.title}” para a lixeira? Você poderá restaurá-lo depois.`))return;
 const id='trash-'+Date.now()+'-'+Math.random().toString(36).slice(2,8);
 const entry={id,deletedAt:new Date().toISOString(),profileId:currentProfileId,consoleId:owner.id,consoleSnapshot:{id:owner.id,name:owner.name,short:owner.short,brand:owner.brand,color:owner.color,type:owner.type,year:owner.year,coverImage:owner.coverImage},gameIndex:index,game:JSON.parse(JSON.stringify(game))};
 try{await estantePlusDBRequest('trash','readwrite','put',entry);}catch(e){toast('Não consegui guardar o jogo na lixeira; nada foi excluído. Confira o armazenamento do navegador.');return;}
 const [removed]=owner.games.splice(index,1);
 if(!persist()){owner.games.splice(index,0,removed);try{await estantePlusDBRequest('trash','readwrite','delete',id)}catch(_){}return;}
 renderStats();render();estantePlusShowUndoToast(`“${game.title}” foi movido para a lixeira.`,async()=>{
   try{await estantePlusRestoreTrashEntry(id,true);}catch(e){toast('Não consegui restaurar o jogo. Veja a lixeira na seção Dados e backup.');}
 });
}
async function estanteMovePlatformToTrash(platform){
 const index=consoles.indexOf(platform);if(index<0)return false;const gameCount=Array.isArray(platform.games)?platform.games.length:0;
 const prompt=`Mover “${platform.name}” para a lixeira? A plataforma e seus ${gameCount} ${gameCount===1?'jogo serão':'jogos serão'} guardados juntos e poderão ser restaurados.`;
 if(!confirm(prompt))return false;
 const id='trash-console-'+Date.now()+'-'+Math.random().toString(36).slice(2,8);
 const entry={id,entryType:'platform',deletedAt:new Date().toISOString(),profileId:currentProfileId,consoleId:platform.id,consoleSnapshot:JSON.parse(JSON.stringify(platform))};
 try{await estantePlusDBRequest('trash','readwrite','put',entry);}catch(e){toast('Não consegui guardar a plataforma na lixeira; nada foi removido. Confira o armazenamento do navegador.');return false;}
 consoles.splice(index,1);
 if(!persist()){consoles.splice(index,0,platform);try{await estantePlusDBRequest('trash','readwrite','delete',id)}catch(_){}return false;}
 currentView='platforms';currentConsole=null;$('#modalBackdrop').classList.remove('open');renderStats();render();
 estantePlusShowUndoToast(`“${platform.name}” e seus jogos foram movidos para a lixeira.`,async()=>{await estantePlusRestoreTrashEntry(id,true);});return true;
}
function estantePlusShowUndoToast(message,action){
 const el=$('#toast');if(!el)return;
 el.innerHTML=`<span>${esc(message)}</span><button type="button" id="estanteUndoButton">Desfazer</button>`;el.classList.add('show','actionable');clearTimeout(window.__toastTimer);window.__toastTimer=setTimeout(()=>{el.classList.remove('show','actionable');},7000);
 const b=$('#estanteUndoButton');b.onclick=async()=>{clearTimeout(window.__toastTimer);el.classList.remove('show','actionable');await action();};
}
const estantePlusOriginalToast=toast;
toast=function(message){const el=$('#toast');if(el)el.classList.remove('actionable');estantePlusOriginalToast(message);};
async function estantePlusRestoreTrashEntry(id,quiet=false){
 let item;try{item=(await estantePlusDBRequest('trash','readonly','getAll')).find(x=>x.id===id);}catch(e){if(!quiet)toast('Não consegui abrir a lixeira.');return false;}
 if(!item||item.profileId!==currentProfileId){if(!quiet)toast('Este item não foi encontrado na lixeira deste perfil.');return false;}
 if(item.entryType==='platform'){
  const platform=item.consoleSnapshot;if(!platform||typeof platform!=='object'||!Array.isArray(platform.games)){if(!quiet)toast('A cópia da plataforma está inválida.');return false;}
  if(consoles.some(c=>c.id===platform.id)){if(!quiet)toast('Esta plataforma já existe na coleção.');return false;}
  consoles.push(JSON.parse(JSON.stringify(platform)));if(!persist()){consoles.pop();return false;}
  try{await estantePlusDBRequest('trash','readwrite','delete',item.id);}catch(e){if(!quiet)toast('A plataforma foi restaurada, mas sua cópia ainda aparece na lixeira.');}
  currentView='platforms';currentConsole=null;renderStats();render();if(!quiet)toast('Plataforma e jogos restaurados.');return true;
 }
 let owner=consoles.find(c=>c.id===item.consoleId);
 if(!owner){owner={...(item.consoleSnapshot||{}),id:item.consoleId||('restored-'+Date.now()),games:[]};owner.name=owner.name||'Plataforma restaurada';owner.short=owner.short||owner.name.slice(0,10).toUpperCase();owner.brand=owner.brand||'Outro';owner.type=owner.type||'Outro';owner.color=owner.color||'#a777ff';consoles.push(owner);}
 const duplicate=owner.games.some(g=>String(g.title||'').trim().toLocaleLowerCase('pt-BR')===String(item.game?.title||'').trim().toLocaleLowerCase('pt-BR'));
 if(duplicate&&!confirm('Já existe um jogo com esse nome nesta plataforma. Restaurar outra cópia mesmo assim?'))return false;
 const pos=Math.max(0,Math.min(Number(item.gameIndex)||0,owner.games.length));owner.games.splice(pos,0,JSON.parse(JSON.stringify(item.game)));
 if(!persist()){owner.games.splice(pos,1);return false;}
 try{await estantePlusDBRequest('trash','readwrite','delete',item.id);}catch(e){/* A cópia continua na lixeira, mas a duplicação é evitada acima. */}
 renderStats();render();if(!quiet)toast('Jogo restaurado para a coleção.');return true;
}
async function estantePlusRenderStoragePanels(){
 const backupsEl=$('#autoBackupList');const trashEl=$('#trashList');
 let allSnapshots=[],trashItems=[];let error='';
 try{allSnapshots=await estantePlusDBRequest('snapshots','readonly','getAll');trashItems=await estantePlusDBRequest('trash','readonly','getAll');}catch(e){error=e?.message||'Armazenamento local avançado indisponível.';}
 if(backupsEl){const items=allSnapshots.filter(r=>r.profileId===currentProfileId).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
  backupsEl.innerHTML=items.length?items.map(r=>`<div class="enhancement-row"><div class="row-copy"><strong>${esc(new Date(r.createdAt).toLocaleString('pt-BR'))}</strong><small>${esc(r.profileName||'Minha coleção')} · ${Array.isArray(r.payload?.consoles)?r.payload.consoles.reduce((n,c)=>n+(c.games?.length||0),0):0} jogos</small></div><button type="button" class="secondary" data-restore-autobackup="${esc(r.id)}">Restaurar</button></div>`).join(''):'<p>Nenhum backup automático ainda. A Estante criará uma cópia depois que você fizer alterações na coleção.</p>';
  backupsEl.querySelectorAll('[data-restore-autobackup]').forEach(b=>b.onclick=()=>void estantePlusRestoreSnapshot(b.dataset.restoreAutobackup));
 }
 if(trashEl){const items=trashItems.filter(r=>r.profileId===currentProfileId).sort((a,b)=>String(b.deletedAt).localeCompare(String(a.deletedAt)));
  trashEl.innerHTML=items.length?items.map(r=>`<div class="enhancement-row"><div class="row-copy"><strong>${r.entryType==='platform'?'Plataforma: '+esc(r.consoleSnapshot?.name||'sem nome'):esc(r.game?.title||'Jogo sem título')}</strong><small>${r.entryType==='platform'?`${Array.isArray(r.consoleSnapshot?.games)?r.consoleSnapshot.games.length:0} jogo(s) junto(s)`:esc(r.consoleSnapshot?.name||'Plataforma')} · removido em ${esc(new Date(r.deletedAt).toLocaleDateString('pt-BR'))}</small></div><div class="backup-actions"><button type="button" class="secondary" data-restore-trash="${esc(r.id)}">Restaurar</button><button type="button" class="secondary" data-delete-trash="${esc(r.id)}">Excluir de vez</button></div></div>`).join(''):'<p>A lixeira está vazia. Plataformas e jogos removidos ficam aqui até serem restaurados ou excluídos permanentemente.</p>';
  trashEl.querySelectorAll('[data-restore-trash]').forEach(b=>b.onclick=()=>void estantePlusRestoreTrashEntry(b.dataset.restoreTrash));
  trashEl.querySelectorAll('[data-delete-trash]').forEach(b=>b.onclick=async()=>{const item=items.find(x=>x.id===b.dataset.deleteTrash);const name=item?.entryType==='platform'?item.consoleSnapshot?.name:item?.game?.title;if(!item||!confirm(`Excluir “${name||'este item'}” permanentemente?`))return;try{await estantePlusDBRequest('trash','readwrite','delete',item.id);await estantePlusRenderStoragePanels();toast('Item removido permanentemente da lixeira.');}catch(e){toast('Não consegui esvaziar este item.');}});
 }
 const status=$('#autoBackupStatus');if(status){status.textContent=error||estantePlusLastBackupError||(allSnapshots.some(r=>r.profileId===currentProfileId)?'Backup automático ativo · mantém até 2 versões recentes deste perfil.':'Backup automático pronto · a primeira cópia é criada após alterações.');}
}
const estantePlusOriginalRenderBackup=renderBackupView;
renderBackupView=function(){
 estantePlusOriginalRenderBackup();
 const target=$('#mainContent');if(!target)return;
 target.insertAdjacentHTML('beforeend',`<section class="enhancement-panel" aria-labelledby="estanteAutoBackupHeading"><h3 id="estanteAutoBackupHeading">Backup automático</h3><p>A Estante guarda até duas versões recentes neste navegador. Os arquivos ficam no armazenamento do navegador e não são enviados para a internet; continue exportando um JSON manual de tempos em tempos.</p><div id="autoBackupStatus" class="enhancement-status" role="status" aria-live="polite">Verificando armazenamento…</div><div id="autoBackupList" class="enhancement-list"></div></section><section class="enhancement-panel" aria-labelledby="estanteTrashHeading"><h3 id="estanteTrashHeading">Lixeira de jogos e plataformas</h3><p>Jogos e plataformas removidos ficam aqui até serem restaurados ou excluídos permanentemente. A lixeira é separada por perfil; plataformas levam seus jogos junto.</p><div id="trashList" class="enhancement-list"></div></section><section class="enhancement-panel" aria-labelledby="estanteCSVHeading"><h3 id="estanteCSVHeading">Importar jogos em lote</h3><p>Importe a planilha CSV exportada pela Estante (ou uma planilha com colunas de jogo e plataforma). Títulos duplicados na mesma plataforma serão ignorados.</p><label class="secondary import-csv-label" for="estanteCSVImport">Selecionar CSV</label><input type="file" id="estanteCSVImport" accept=".csv,text/csv" hidden><div class="enhancement-status" id="estanteCSVStatus" role="status" aria-live="polite">Importação aceita arquivos CSV em UTF-8, com vírgula ou ponto e vírgula como separador.</div></section>`);
 void estantePlusRenderStoragePanels();
 $('#estanteCSVImport').onchange=async e=>{const file=e.target.files?.[0];e.target.value='';if(file)await estantePlusImportCSV(file);};
};
function estantePlusParseCSV(text){
 const first=(String(text).replace(/^\uFEFF/,'').split(/\r?\n/,1)[0]||'');const delim=(first.match(/;/g)||[]).length>(first.match(/,/g)||[]).length?';':',';
 const rows=[];let row=[],field='',quoted=false;const input=String(text).replace(/^\uFEFF/,'');
 for(let i=0;i<input.length;i++){const ch=input[i];if(quoted){if(ch==='"'&&input[i+1]==='"'){field+='"';i++;}else if(ch==='"')quoted=false;else field+=ch;}else if(ch==='"'){quoted=true;}else if(ch===delim){row.push(field);field='';}else if(ch==='\n'){row.push(field.replace(/\r$/,''));if(row.some(v=>String(v).trim()!==''))rows.push(row);row=[];field='';}else field+=ch;}
 row.push(field.replace(/\r$/,''));if(row.some(v=>String(v).trim()!==''))rows.push(row);return rows;
}
function estantePlusNorm(s){return String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();}
function estantePlusParseNumber(value){let s=String(value??'').trim().replace(/R\$/ig,'').replace(/\s/g,'');if(!s)return null;if(s.includes(','))s=s.replace(/\./g,'').replace(',','.');const n=Number(s);return Number.isFinite(n)?n:null;}
async function estantePlusImportCSV(file){
 let text;try{text=await file.text();}catch(e){toast('Não consegui ler esse arquivo CSV.');return;}
 const table=estantePlusParseCSV(text);if(table.length<2){toast('A planilha está vazia ou não tem linhas de jogos.');return;}
 const headers=table[0].map(estantePlusNorm);const col=(...names)=>headers.findIndex(h=>names.some(n=>h===estantePlusNorm(n)));
 const indexes={title:col('Jogo','Nome','Título','Title','Game'),platform:col('Plataforma','Console','Sistema','Platform','Console name'),year:col('Ano','Year'),genre:col('Gênero','Genero','Genre'),status:col('Situação','Status','Progresso'),pricePaid:col('Preço pago','Preco pago','Valor pago','Price paid'),marketValue:col('Valor de mercado','Valor estimado','Market value'),condition:col('Condição','Condicao','Condition'),completeness:col('Completude','Completeness'),authenticity:col('Autenticidade','Authenticity'),region:col('Região','Regiao','Region'),edition:col('Edição','Edicao','Edition'),language:col('Idioma','Language'),hasManual:col('Manual','Has manual'),mediaCount:col('Discos/cartuchos','Mídias','Midias','Media count'),rating:col('Nota pessoal','Nota','Rating'),completionDate:col('Data de conclusão','Data de conclusao','Completion date'),playtimeHours:col('Horas jogadas','Playtime hours'),notes:col('Observações','Observacoes','Notas','Notes')};
 if(indexes.title<0||indexes.platform<0){toast('CSV precisa ter pelo menos as colunas Jogo e Plataforma.');return;}
 const val=(row,key)=>indexes[key]>=0?String(row[indexes[key]]??'').trim():'';
 const rows=table.slice(1).filter(r=>val(r,'title')&&val(r,'platform'));
 if(!rows.length){toast('Não encontrei linhas com nome do jogo e plataforma.');return;}
 const newPlatformNames=[...new Set(rows.map(r=>val(r,'platform')).filter(p=>!consoles.some(c=>estantePlusNorm(c.name)===estantePlusNorm(p))))];
 let adds=0,duplicates=0,skipped=0;const planned=[];
 const virtualPlatforms=new Map();
 for(const row of rows){const title=val(row,'title').slice(0,160),platformName=val(row,'platform').slice(0,90);let owner=consoles.find(c=>estantePlusNorm(c.name)===estantePlusNorm(platformName))||virtualPlatforms.get(estantePlusNorm(platformName));
  if(!owner){owner={id:'csv-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8),name:platformName,short:platformName.toUpperCase().slice(0,10),brand:'Importado',type:'Outro',year:0,color:'#a777ff',games:[]};virtualPlatforms.set(estantePlusNorm(platformName),owner);}
  const already=(owner.games||[]).some(g=>estantePlusNorm(g.title)===estantePlusNorm(title))||planned.some(x=>x.owner===owner&&estantePlusNorm(x.game.title)===estantePlusNorm(title));if(already){duplicates++;continue;}
  const game={title,year:Math.max(0,Number(val(row,'year'))||0),genre:val(row,'genre')||'Jogo',status:normalizeGameStatus(val(row,'status')),pricePaid:estantePlusParseNumber(val(row,'pricePaid')),marketValue:estantePlusParseNumber(val(row,'marketValue')),condition:val(row,'condition')||'Não informado',completeness:val(row,'completeness')||'Não informado',authenticity:val(row,'authenticity')||'Não verificado',region:val(row,'region')||'Não informada',edition:val(row,'edition'),language:val(row,'language'),hasManual:val(row,'hasManual')||'Não informado',mediaCount:estantePlusParseNumber(val(row,'mediaCount')),rating:estantePlusParseNumber(val(row,'rating')),completionDate:val(row,'completionDate'),playtimeHours:estantePlusParseNumber(val(row,'playtimeHours')),notes:val(row,'notes'),priceHistory:[],marketEstimate:null,glyph:(title.match(/[A-ZÀ-Ý0-9]/gi)||[title.slice(0,3)]).slice(0,4).join('').toUpperCase(),cover:`linear-gradient(145deg,${owner.color||'#a777ff'},#171725)`,coverImage:''};planned.push({owner,game});adds++;
 }
 if(!planned.length){toast(`Nenhum jogo novo para importar. ${duplicates} duplicado(s) ignorado(s).`);return;}
 const newNames=[...virtualPlatforms.values()];const preview=`Importar ${adds} jogo(s)?\n${duplicates} duplicado(s) serão ignorados.\n${newNames.length} plataforma(s) nova(s): ${newNames.map(c=>c.name).join(', ')||'nenhuma'}.\n\nA coleção atual será mantida.`;
 if(!confirm(preview))return;
 const originalConsoles=consoles.slice();const created=[];
 newNames.forEach(c=>{if(!consoles.some(existing=>existing.id===c.id)){consoles.push(c);created.push(c);}});
 for(const item of planned){let owner=consoles.find(c=>c.id===item.owner.id)||item.owner;if(!consoles.includes(owner)&&!owner.games){owner.games=[];consoles.push(owner);created.push(owner);}owner.games.push(item.game);}
 if(!persist()){consoles=originalConsoles;return;}
 renderStats();currentView='allgames';currentConsole=null;searchTerm='';$('#searchInput').value='';render();toast(`Importação concluída: ${adds} jogo(s), ${duplicates} duplicado(s) ignorado(s).`);
}
/* Extende as métricas existentes sem redesenhar o painel principal. */
const estantePlusOriginalRenderStats=renderStats;
renderStats=function(){
 estantePlusOriginalRenderStats();const games=allGames();const valued=games.map(g=>hasMoneyValue(g.marketValue)?Number(g.marketValue):(hasMoneyValue(g.marketEstimate?.estimate)?Number(g.marketEstimate.estimate):null)).filter(v=>v!==null);const marketTotal=valued.reduce((a,b)=>a+b,0);const marketDisplay=valued.length?money(marketTotal):'—';const completed=games.filter(g=>['Concluído','100%'].includes(normalizeGameStatus(g.status))).length;const pct=games.length?Math.round(completed/games.length*100):0;
 $('#stats').insertAdjacentHTML('beforeend',`<div class="stat" style="--glow:#4c8dff;--accent:#4c8dff;--icbg:#4c8dff1b"><div class="stat-head"><span>Valor estimado da coleção</span><span class="stat-ic">◇</span></div><div class="stat-number" style="font-size:clamp(16px,1.8vw,23px)">${esc(marketDisplay)}</div><div class="stat-note">${valued.length} de ${games.length} jogos com valor informado</div></div><div class="stat" style="--glow:#d4f36a;--accent:#d4f36a;--icbg:#d4f36a1b"><div class="stat-head"><span>Conclusão da coleção</span><span class="stat-ic">✓</span></div><div class="stat-number">${pct}%</div><div class="stat-note">${completed} de ${games.length} jogos concluídos</div></div>`);
};
/* Agenda a cópia automática quando houver persistência confirmada dos dados. */
const estantePlusOriginalImportBackup=importEstanteBackup;
importEstanteBackup=async function(file){await estantePlusOriginalImportBackup(file);estantePlusScheduleBackup();};
const estantePlusOriginalPersist=persist;
persist=function(...args){const ok=estantePlusOriginalPersist(...args);if(ok)estantePlusScheduleBackup();return ok;};
const estantePlusOriginalPersistWishlist=persistWishlist;
persistWishlist=function(...args){const ok=estantePlusOriginalPersistWishlist(...args);if(ok)estantePlusScheduleBackup();return ok;};
if(typeof persistAccessories==='function'){const estantePlusOriginalPersistAccessories=persistAccessories;persistAccessories=function(...args){const ok=estantePlusOriginalPersistAccessories(...args);if(ok)estantePlusScheduleBackup();return ok;};}
/* Uma cópia rápida é feita depois de mudanças e antes de sair da página; nunca salva chave SteamGridDB. */
document.addEventListener('submit',()=>estantePlusScheduleBackup(),true);
window.addEventListener('pagehide',()=>{if(estantePlusBackupTimer){clearTimeout(estantePlusBackupTimer);estantePlusBackupTimer=null;}void estantePlusCreateAutoBackup();});
renderStats();
void initCloudAuth();
