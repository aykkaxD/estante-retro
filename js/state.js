// Estado persistente da aplicação. Os accessors preservam os nomes usados pelas telas atuais.
const PROFILE_META_KEY='estanteProfilesMetaV1';
const PROFILE_ACTIVE_KEY='estanteActiveProfileIdV1';
const baseConsoles=[];
const defaultProfile={displayName:'Minha coleção',nickname:'',about:'',favoritePlatform:'',collectionGoal:100,accentColor:'#a855f7',avatarImage:''};
const EstanteState=(()=>{
 const values={currentProfileId:'default',consoles:[],wishlist:[],profile:{...defaultProfile},accessories:[]};
 try{values.currentProfileId=localStorage.getItem(PROFILE_ACTIVE_KEY)||'default';}catch(error){}
 const key=(name,profileId=values.currentProfileId)=>profileId==='default'?name:`${name}__${profileId}`;
 try{const saved=localStorage.getItem(key('estanteCollectionV1'));const loaded=saved?JSON.parse(saved):baseConsoles.map(consoleRecord=>({...consoleRecord,games:(consoleRecord.games||[]).map(game=>({...game}))}));values.consoles=(Array.isArray(loaded)?loaded:[]).map(consoleRecord=>({...consoleRecord,games:(Array.isArray(consoleRecord.games)?consoleRecord.games:[]).map(normalizeGameRecord)}));}catch(error){values.consoles=baseConsoles.map(consoleRecord=>({...consoleRecord,games:(consoleRecord.games||[]).map(normalizeGameRecord)}));}
 try{localStorage.setItem(key('estanteCollectionV1'),JSON.stringify(values.consoles));}catch(error){}
 try{const saved=localStorage.getItem(key('estanteWishlistV1'));const loaded=saved?JSON.parse(saved):[];values.wishlist=(Array.isArray(loaded)?loaded:[]).map(normalizeWishlistRecord);}catch(error){values.wishlist=[];}
 try{localStorage.setItem(key('estanteWishlistV1'),JSON.stringify(values.wishlist));}catch(error){}
 try{const saved=localStorage.getItem(key('estanteProfileV1'));if(saved)values.profile={...defaultProfile,...JSON.parse(saved)};}catch(error){}
 try{const saved=localStorage.getItem(key('estanteAccessoriesV1'));const loaded=saved?JSON.parse(saved):[];values.accessories=Array.isArray(loaded)?loaded:[];}catch(error){values.accessories=[];}
 return {get(name){return values[name];},set(name,value){values[name]=value;},key};
})();
for(const name of ['currentProfileId','consoles','wishlist','profile','accessories'])Object.defineProperty(window,name,{configurable:true,enumerable:true,get(){return EstanteState.get(name);},set(value){EstanteState.set(name,value);}});
function profileDataKey(name,profileId=currentProfileId){return EstanteState.key(name,profileId);}
function persist(){try{localStorage.setItem(profileDataKey('estanteCollectionV1'),JSON.stringify(consoles));queueCloudSync();return true;}catch(error){console.warn('Não foi possível salvar a coleção no navegador.',error);toast('Armazenamento cheio: tente imagens menores ou remova algumas capas.');return false;}}
function persistWishlist(){try{localStorage.setItem(profileDataKey('estanteWishlistV1'),JSON.stringify(wishlist));updateWishlistBadge();queueCloudSync();return true;}catch(error){toast('Não foi possível salvar a wishlist. Remova algumas imagens ou notas muito longas.');return false;}}
function persistAccessories(){try{localStorage.setItem(profileDataKey('estanteAccessoriesV1'),JSON.stringify(accessories));queueCloudSync();return true;}catch(error){toast('Não foi possível salvar os acessórios. Confira o espaço disponível no navegador.');return false;}}
