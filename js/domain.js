// Regras e conversões de dados compartilhadas pela coleção, wishlist e sincronização.
const GAME_STATUSES=['Backlog','Jogando','Pausado','Concluído','100%','Abandonado'];
function hasMoneyValue(value){return value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value));}
function todayISO(){const date=new Date();return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
function normalizeGameStatus(status){const value=String(status||'Backlog').trim();if(['Quero jogar','Na fila'].includes(value))return 'Backlog';if(['Zerado','Finalizado'].includes(value))return 'Concluído';return GAME_STATUSES.includes(value)?value:'Backlog';}
function normalizeGameRecord(game={}){
 const normalized={...game,status:normalizeGameStatus(game.status)};
 if(game.status&&normalized.status==='Backlog'&&!['Backlog','Quero jogar','Na fila'].includes(String(game.status).trim()))normalized.legacyStatus=normalized.legacyStatus||String(game.status).trim();
 if(normalized.marketValueSource==='Estimativa pessoal da wishlist'&&!normalized.wishlistAcquisition){
  const targetPrice=hasMoneyValue(normalized.marketValue)?Number(normalized.marketValue):null;
  normalized.wishlistAcquisition={targetPrice,targetPriceHistory:[],offers:[],acquiredAt:''};
  normalized.marketValue=null;normalized.marketValueSource='';normalized.marketValueDate='';
  if(Array.isArray(normalized.priceHistory))normalized.priceHistory=normalized.priceHistory.filter(entry=>!(entry.kind==='market'&&entry.source==='Estimativa pessoal da wishlist'));
 }
 return normalized;
}
function wishlistTargetPrice(item){return hasMoneyValue(item?.targetPrice)?Number(item.targetPrice):hasMoneyValue(item?.estimatedPrice)?Number(item.estimatedPrice):null;}
function normalizeWishlistRecord(item={}){const normalized={...item,targetPrice:wishlistTargetPrice(item)};delete normalized.estimatedPrice;return normalized;}
function wishlistAcquisitionData(item){return {wishlistItemId:item.id||'',acquiredAt:todayISO(),targetPrice:wishlistTargetPrice(item),targetPriceHistory:Array.isArray(item.targetPriceHistory)?item.targetPriceHistory.map(entry=>({...entry})):[],offers:Array.isArray(item.offers)?item.offers.map(offer=>({...offer})):[]};}
