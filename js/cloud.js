// Login e sincronização usam o projeto Supabase configurado pelo site.
const CLOUD_SESSION_KEY='estanteSupabaseSessionV1';
const CLOUD_BASELINE_PREFIX='estanteSupabaseSyncBaselineV1__';
const cloudConfig=window.ESTANTE_CLOUD_CONFIG||{url:'',anonKey:''};
let cloudSession=null,cloudSyncTimer=null,cloudApplying=false,cloudSyncBusy=false,cloudSyncPending=false;
let cloudAuthClient=null,cloudAuthSubscription=null,cloudPanelMessage='',cloudPanelMessageType='info';
let cloudSyncState='offline',cloudSyncStateMessage='A coleção continua salva neste navegador.',cloudConflict=null,cloudAuthMode='login';
try{cloudSession=JSON.parse(localStorage.getItem(CLOUD_SESSION_KEY)||'null');}catch(e){}
function cloudHasConfig(){return !!(String(cloudConfig.url||'').trim()&&String(cloudConfig.anonKey||'').trim())}
function cloudReady(){return !!(cloudHasConfig()&&cloudSession?.access_token&&cloudSession?.user?.id)}
function cloudFriendlyError(error){
 const raw=String(error?.message||error||'Erro desconhecido');const msg=raw.toLowerCase();
 if(msg.includes('estante_cloud_data')&&(msg.includes('schema cache')||msg.includes('could not find the table')||msg.includes('does not exist')||msg.includes('revision')))
  return 'A sincronização ainda não está pronta neste site. Recarregue a página; se o problema continuar, avise quem mantém a Estante.';
 if(msg.includes('invalid login credentials'))return 'E-mail ou senha incorretos. Confira os dados e tente novamente.';
 if(msg.includes('email not confirmed'))return 'Confirme seu e-mail pelo link enviado antes de entrar.';
 if(msg.includes('user already registered'))return 'Já existe uma conta com esse e-mail. Use “Entrar”.';
 if(msg.includes('failed to fetch')||msg.includes('networkerror')||msg.includes('load failed'))return 'Não foi possível conectar. Confira sua internet e tente novamente.';
 if(msg.includes('supabase-js')||msg.includes('createclient'))return 'O serviço de login não carregou. Confira sua internet e recarregue a Estante.';
 return raw;
}
function cloudClient(){
 if(!cloudHasConfig())throw new Error('O login ainda não foi configurado para este site.');
 if(!window.supabase||typeof window.supabase.createClient!=='function')throw new Error('supabase-js não carregou. Confira sua internet e recarregue a Estante.');
 if(cloudAuthClient)return cloudAuthClient;
 cloudAuthClient=window.supabase.createClient(String(cloudConfig.url).trim().replace(/\/+$/,''),String(cloudConfig.anonKey).trim(),{auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:true,flowType:'implicit'}});
 const subscription=cloudAuthClient.auth.onAuthStateChange((event,session)=>{
  if(session){cloudSession=session;try{localStorage.setItem(CLOUD_SESSION_KEY,JSON.stringify(session))}catch(e){}}
  else if(event==='SIGNED_OUT'){cloudSession=null;try{localStorage.removeItem(CLOUD_SESSION_KEY)}catch(e){}}
  if(typeof updateProfileMenuSummary==='function')updateProfileMenuSummary();
 });
 cloudAuthSubscription=subscription?.data?.subscription||null;
 return cloudAuthClient;
}
function cloudHeaders(extra={}){return {'apikey':cloudConfig.anonKey,'Authorization':'Bearer '+(cloudSession?.access_token||cloudConfig.anonKey),'Content-Type':'application/json',...extra}}
async function cloudFetch(path,options={}){
 const base=String(cloudConfig.url||'').replace(/\/+$/,'');if(!base||!cloudConfig.anonKey)throw new Error('Login não configurado neste site.');
 const res=await fetch(base+path,{...options,headers:cloudHeaders(options.headers||{})});let data=null;try{data=await res.json()}catch(e){}
 if(!res.ok)throw new Error(data?.msg||data?.message||data?.error_description||data?.error||('Erro Supabase '+res.status));return data;
}
function cloudContent(data={}){
 return {schemaVersion:2,profileId:String(data.profileId||'default'),consoles:Array.isArray(data.consoles)?data.consoles.map(c=>({...c,games:(Array.isArray(c.games)?c.games:[]).map(normalizeGameRecord)})):[],wishlist:Array.isArray(data.wishlist)?data.wishlist.map(normalizeWishlistRecord):[],profile:{...defaultProfile,...(data.profile&&typeof data.profile==='object'?data.profile:{})},accessories:Array.isArray(data.accessories)?data.accessories:[]};
}
function cloudSnapshot(){return {...cloudContent({profileId:currentProfileId,consoles,wishlist,profile,accessories}),updatedAt:new Date().toISOString()}}
function cloudStableValue(value){if(Array.isArray(value))return value.map(cloudStableValue);if(value&&typeof value==='object'){const out={};Object.keys(value).sort().forEach(key=>{out[key]=cloudStableValue(value[key]);});return out;}return value;}
async function cloudFingerprint(value){
 const serialized=JSON.stringify(cloudStableValue(cloudContent(value)));
 if(window.crypto?.subtle&&window.TextEncoder){const digest=await window.crypto.subtle.digest('SHA-256',new TextEncoder().encode(serialized));return [...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join('');}
 let a=2166136261,b=0x9e3779b9;for(let i=0;i<serialized.length;i++){a=Math.imul(a^serialized.charCodeAt(i),16777619);b=Math.imul(b^serialized.charCodeAt(i),2246822519);}return `${(a>>>0).toString(16)}-${(b>>>0).toString(16)}-${serialized.length}`;
}
function cloudBaselineKey(userId){return CLOUD_BASELINE_PREFIX+String(userId||'')}
function cloudReadBaseline(userId){try{const value=JSON.parse(localStorage.getItem(cloudBaselineKey(userId))||'null');return value&&typeof value.hash==='string'?value:null;}catch(e){return null;}}
async function cloudSaveBaseline(userId,revision,data){const baseline={revision:Number(revision)||0,profileId:String(data.profileId||'default'),hash:await cloudFingerprint(data),savedAt:new Date().toISOString()};try{localStorage.setItem(cloudBaselineKey(userId),JSON.stringify(baseline));}catch(e){console.warn('Não foi possível guardar a referência local de sincronização.',e);}return baseline;}
async function cloudReadRecord(){const rows=await cloudFetch('/rest/v1/estante_cloud_data?user_id=eq.'+encodeURIComponent(cloudSession.user.id)+'&select=data,updated_at,revision',{method:'GET'});return rows?.length?{data:cloudContent(rows[0].data),revision:Number(rows[0].revision)||0,updatedAt:rows[0].updated_at||''}:null;}
async function cloudWriteSnapshot(data,expectedRevision){
 let result=await cloudFetch('/rest/v1/rpc/estante_save_cloud_snapshot',{method:'POST',body:JSON.stringify({p_expected_revision:Number(expectedRevision)||0,p_data:cloudContent(data)})});
 if(Array.isArray(result))result=result[0];
 if(!result||typeof result.saved!=='boolean')throw new Error('O Supabase retornou uma resposta inválida ao salvar a coleção.');
 return {saved:result.saved,revision:Number(result.revision)||0,data:result.data?cloudContent(result.data):null,updatedAt:result.updated_at||''};
}
function cloudHasMeaningfulLocalData(data){return !!(data.consoles.length||data.wishlist.length||data.accessories.length||JSON.stringify(cloudStableValue(data.profile))!==JSON.stringify(cloudStableValue(defaultProfile)));}
function cloudSetSyncState(state,message){cloudSyncState=state;cloudSyncStateMessage=message||'';cloudUpdateIndicators();if($('#cloudBackdrop')?.classList.contains('open'))renderCloudPanel();}
function cloudUpdateIndicators(){
 const banner=$('#cloudSyncBanner'),message=$('#cloudSyncBannerMessage'),button=$('#cloudSyncBannerAction');
 const show=['conflict','error'].includes(cloudSyncState);if(banner){banner.hidden=!show;banner.classList.toggle('is-error',cloudSyncState==='error');banner.setAttribute('role',cloudSyncState==='error'?'alert':'status');}if(message)message.textContent=cloudSyncStateMessage||'Há alterações diferentes neste dispositivo e na nuvem.';
 if(button){button.textContent=cloudSyncState==='error'?'Tentar novamente':'Resolver conflito';button.onclick=cloudSyncState==='error'?()=>void cloudReconcile(true):openCloudPanel;}
 if(typeof updateProfileMenuSummary==='function')updateProfileMenuSummary();
}
function cloudProfileName(id){
 if(!id)return 'perfil desconhecido';
 if(id===currentProfileId&&typeof profileMetaName==='function')return profileMetaName();
 try{const raw=JSON.parse(localStorage.getItem(PROFILE_META_KEY)||'{}');const found=Array.isArray(raw.profiles)?raw.profiles.find(item=>item?.id===id):null;if(found?.name)return String(found.name);}catch(e){}
 return id==='default'?'Minha coleção':'outro dispositivo';
}
function cloudMarkConflict(remote,localData){
 const empty=cloudContent({profileId:currentProfileId,consoles:[],wishlist:[],profile:defaultProfile,accessories:[]});
 const local=cloudContent(localData||cloudSnapshot()),remoteData=remote?.data?cloudContent(remote.data):empty;
 cloudConflict={remoteRevision:Number(remote?.revision)||0,remoteData,localData:local,remoteUpdatedAt:remote?.updatedAt||'',profileMismatch:remoteData.profileId!==local.profileId,localProfileName:cloudProfileName(local.profileId),remoteProfileName:remote?.data?cloudProfileName(remoteData.profileId):'sem cópia na nuvem'};
 cloudPanelMessage='';const message=cloudConflict.profileMismatch?`Esta cópia local pertence ao perfil “${cloudConflict.localProfileName}”, enquanto a nuvem está associada a “${cloudConflict.remoteProfileName}”. Escolha qual conteúdo usar neste perfil.`:`Há alterações diferentes no perfil “${cloudConflict.localProfileName}”. Escolha qual coleção manter.`;cloudSetSyncState('conflict',message);
}
function cloudApplySnapshot(data){
 if(!data||typeof data!=='object')return false;
 const next=cloudContent(data),keys=[profileDataKey('estanteCollectionV1'),profileDataKey('estanteWishlistV1'),PROFILE_KEY,profileDataKey('estanteAccessoriesV1')];
 const values=[JSON.stringify(next.consoles),JSON.stringify(next.wishlist),JSON.stringify(next.profile),JSON.stringify(next.accessories)];
 const previous=Object.fromEntries(keys.map(key=>[key,localStorage.getItem(key)]));cloudApplying=true;
 try{keys.forEach((key,index)=>localStorage.setItem(key,values[index]));consoles=next.consoles;wishlist=next.wishlist;profile=next.profile;accessories=next.accessories;if(typeof syncActiveProfileMeta==='function')syncActiveProfileMeta();}
 catch(error){keys.forEach(key=>{try{if(previous[key]===null)localStorage.removeItem(key);else localStorage.setItem(key,previous[key]);}catch(_){}});toast('Não há espaço suficiente para aplicar a cópia da nuvem. Seus dados locais foram preservados.');return false;}
 finally{cloudApplying=false;}
 updateProfileBadge();updateWishlistBadge();render();return true;
}
async function cloudReconcile(showToast=false){
 if(!cloudReady()||cloudApplying||cloudSyncBusy)return false;cloudSyncBusy=true;cloudSetSyncState('syncing','Comparando esta coleção com a nuvem…');
 try{
  const userId=cloudSession.user.id,localData=cloudContent(cloudSnapshot()),localHash=await cloudFingerprint(localData),baseline=cloudReadBaseline(userId),remote=await cloudReadRecord();
  if(!remote){
   if(baseline){cloudMarkConflict(null,localData);return false;}
   const written=await cloudWriteSnapshot(localData,0);if(!written.saved){cloudMarkConflict(written,localData);return false;}
   await cloudSaveBaseline(userId,written.revision,written.data);cloudConflict=null;cloudSetSyncState('synced','Coleção sincronizada.');if(showToast)toast('Coleção sincronizada na nuvem.');return true;
  }
  const remoteHash=await cloudFingerprint(remote.data);
  if(localHash===remoteHash){await cloudSaveBaseline(userId,remote.revision,localData);cloudConflict=null;cloudSetSyncState('synced','Coleção sincronizada.');if(showToast)toast('Coleção sincronizada na nuvem.');return true;}
  if(!baseline){
   if(!cloudHasMeaningfulLocalData(localData)&&remote.data.profileId===localData.profileId){
    if(!cloudApplySnapshot(remote.data)){cloudSetSyncState('error','A cópia da nuvem não coube no armazenamento deste dispositivo.');return false;}
    await cloudSaveBaseline(userId,remote.revision,remote.data);cloudSetSyncState('synced','Coleção carregada da nuvem.');if(showToast)toast('Coleção carregada da nuvem.');return true;
   }
   cloudMarkConflict(remote,localData);return false;
  }
  const profileMatches=baseline.profileId===localData.profileId&&baseline.profileId===remote.data.profileId;
  if(!profileMatches){cloudMarkConflict(remote,localData);return false;}
  const localChanged=localHash!==baseline.hash,remoteChanged=remoteHash!==baseline.hash;
  if(!localChanged&&!remoteChanged){await cloudSaveBaseline(userId,remote.revision,localData);cloudConflict=null;cloudSetSyncState('synced','Coleção sincronizada.');return true;}
  if(!localChanged&&remoteChanged){
   if(!cloudApplySnapshot(remote.data)){cloudSetSyncState('error','A cópia da nuvem não coube no armazenamento deste dispositivo.');return false;}
   await cloudSaveBaseline(userId,remote.revision,remote.data);cloudConflict=null;cloudSetSyncState('synced','Alterações da nuvem carregadas.');if(showToast)toast('Alterações da nuvem carregadas.');return true;
  }
  if(localChanged&&!remoteChanged){
   const written=await cloudWriteSnapshot(localData,remote.revision);if(!written.saved){cloudMarkConflict(written,localData);return false;}
   await cloudSaveBaseline(userId,written.revision,written.data);cloudConflict=null;cloudSetSyncState('synced','Coleção sincronizada.');if(showToast)toast('Coleção sincronizada na nuvem.');return true;
  }
  cloudMarkConflict(remote,localData);return false;
 }catch(error){const friendly=cloudFriendlyError(error);console.warn('Falha na sincronização',error);cloudPanelMessage=friendly;cloudPanelMessageType='error';cloudSetSyncState('error',friendly);if(showToast)toast(friendly);return false;}
 finally{cloudSyncBusy=false;if(cloudSyncPending){cloudSyncPending=false;queueCloudSync();}}
}
async function cloudResolveConflict(choice){
 if(!cloudConflict||!cloudReady()||cloudSyncBusy)return;cloudSyncBusy=true;const expected=cloudConflict.remoteRevision;const localData=cloudContent(cloudSnapshot());cloudSetSyncState('syncing','Conferindo a versão mais recente antes de aplicar sua escolha…');
 try{
  const latest=await cloudReadRecord(),latestRevision=Number(latest?.revision)||0;
  if(latestRevision!==expected){cloudMarkConflict(latest,localData);cloudPanelMessage='A nuvem mudou enquanto esta decisão estava aberta. Confira as versões atualizadas.';renderCloudPanel();return;}
  if(choice==='cloud'){
   if(await cloudFingerprint(localData)!==await cloudFingerprint(cloudConflict.localData)){cloudMarkConflict(latest,localData);cloudPanelMessage='A coleção local mudou enquanto esta decisão estava aberta. Confira as versões atualizadas.';renderCloudPanel();return;}
   const chosen=cloudContent(latest?.data||cloudConflict.remoteData);chosen.profileId=currentProfileId;
   const written=await cloudWriteSnapshot(chosen,latestRevision);if(!written.saved){cloudMarkConflict(written,localData);return;}
   if(!cloudApplySnapshot(chosen)){cloudSetSyncState('error','A coleção local não coube no armazenamento. A cópia da nuvem continua preservada.');return;}
   await cloudSaveBaseline(cloudSession.user.id,written.revision,written.data);
  }else{
   const written=await cloudWriteSnapshot(localData,latestRevision);if(!written.saved){cloudMarkConflict(written,localData);return;}
   await cloudSaveBaseline(cloudSession.user.id,written.revision,written.data);
  }
  cloudConflict=null;cloudPanelMessage=choice==='cloud'?'A cópia da nuvem foi aplicada neste dispositivo.':'A coleção deste dispositivo foi mantida e sincronizada.';cloudPanelMessageType='success';cloudSetSyncState('synced',cloudPanelMessage);renderCloudPanel();
 }catch(error){const friendly=cloudFriendlyError(error);cloudPanelMessage=friendly;cloudPanelMessageType='error';cloudSetSyncState('error',friendly);renderCloudPanel();}
 finally{cloudSyncBusy=false;if(cloudSyncPending){cloudSyncPending=false;queueCloudSync();}}
}
function queueCloudSync(){if(!cloudReady()||cloudApplying)return;if(cloudSyncBusy){cloudSyncPending=true;return;}clearTimeout(cloudSyncTimer);cloudSyncTimer=setTimeout(()=>void cloudReconcile(false),900)}
async function cloudLoad(){if(!cloudReady())return;await cloudReconcile(false)}
function cloudLogout(){const client=cloudAuthClient;cloudSession=null;cloudConflict=null;cloudAuthMode='login';try{localStorage.removeItem(CLOUD_SESSION_KEY)}catch(e){}if(client)client.auth.signOut({scope:'local'}).catch(e=>console.warn('Falha ao encerrar a sessão',e));cloudPanelMessage='Você saiu da conta. A coleção continua salva neste dispositivo.';cloudPanelMessageType='success';cloudSetSyncState('offline',cloudPanelMessage);renderCloudPanel();}
async function cloudAuth(mode,email,password){
 const client=cloudClient();let result;
 if(mode==='signup'){
  const redirectTo=new URL(window.location.href);redirectTo.hash='';redirectTo.search='';result=await client.auth.signUp({email,password,options:{emailRedirectTo:redirectTo.toString()}});if(result.error)throw result.error;
  if(result.data?.session){cloudSession=result.data.session;try{localStorage.setItem(CLOUD_SESSION_KEY,JSON.stringify(cloudSession))}catch(e){}await cloudLoad();cloudPanelMessage='Conta criada. A coleção deste dispositivo está pronta para sincronizar.';cloudPanelMessageType='success';renderCloudPanel();}
  else{cloudAuthMode='login';cloudPanelMessage='Conta criada. Enviamos um link para confirmar seu e-mail. Depois, volte aqui para entrar.';cloudPanelMessageType='success';renderCloudPanel();}
 }else{
  result=await client.auth.signInWithPassword({email,password});if(result.error)throw result.error;
  cloudSession=result.data.session;try{localStorage.setItem(CLOUD_SESSION_KEY,JSON.stringify(cloudSession))}catch(e){}await cloudLoad();cloudPanelMessage=cloudConflict?'Escolha qual versão manter para concluir a sincronização.':'Login concluído. Sua coleção está sincronizada.';cloudPanelMessageType=cloudConflict?'info':'success';renderCloudPanel();
 }
}
function renderCloudPanel(message='',messageType='info',formValues={}){
 const panel=$('#cloudPanel');if(!panel)return;if(message){cloudPanelMessage=message;cloudPanelMessageType=messageType;}
 const shownMessage=cloudPanelMessage,shownType=cloudPanelMessageType,ready=cloudReady();
 const authMode=cloudAuthMode;
 const messageMarkup=shownMessage?`<div class="cloud-message ${shownType==='success'?'success':shownType==='error'?'error':''}" role="status">${esc(shownMessage)}</div>`:'';
 const conflictMarkup=cloudConflict?`<section class="cloud-conflict" aria-labelledby="cloudConflictTitle"><h3 id="cloudConflictTitle">Qual coleção você quer manter?</h3><p>${esc(cloudSyncStateMessage)} Nenhuma versão foi substituída. A nuvem foi atualizada em ${esc(cloudConflict.remoteUpdatedAt?displayDate(cloudConflict.remoteUpdatedAt.slice(0,10)):'uma data não informada')}.</p><div><button class="secondary" type="button" id="cloudUseThisDevice">Manter este dispositivo</button><button class="primary" type="button" id="cloudUseCloud">${cloudConflict.profileMismatch?'Usar nuvem neste perfil':'Usar versão da nuvem'}</button></div></section>`:'';
 panel.innerHTML=`${ready?'':`<div class="cloud-auth-modes" role="tablist" aria-label="Acesso à conta"><button class="${authMode==='login'?'active':''}" id="cloudModeLogin" type="button" role="tab" aria-selected="${authMode==='login'}">Entrar</button><button class="${authMode==='signup'?'active':''}" id="cloudModeSignup" type="button" role="tab" aria-selected="${authMode==='signup'}">Criar conta</button></div><h3 class="cloud-auth-title">${authMode==='login'?'Entre na sua conta':'Crie sua conta'}</h3><p class="cloud-auth-intro">${authMode==='login'?'Entre com seu e-mail e senha para acessar sua coleção sincronizada.':'Use seu e-mail e crie uma senha para sincronizar sua coleção entre dispositivos.'}</p>`}
  <div class="cloud-auth-current"><span class="cloud-auth-dot" style="background:${ready?'#c7f464':'#77768c'};box-shadow:none"></span><span>${ready?'Conectado como <strong>'+esc(cloudSession.user.email||'sua conta')+'</strong>':'A coleção local continua disponível mesmo sem login.'}</span></div>
  ${ready?'':`<div class="field"><label for="cloudEmail">E-mail</label><input id="cloudEmail" type="email" autocomplete="email" placeholder="voce@exemplo.com" value="${esc(formValues.email||'')}" required></div><div class="field"><label for="cloudPassword">Senha</label><input id="cloudPassword" type="password" autocomplete="${authMode==='signup'?'new-password':'current-password'}" minlength="6" placeholder="Mínimo de 6 caracteres" value="${esc(formValues.password||'')}" required></div><div class="cloud-auth-actions"><button class="primary" type="button" id="cloudSubmit">${authMode==='signup'?'Criar minha conta':'Entrar'}</button></div>`}
  ${ready?`<div class="cloud-session-actions"><button class="secondary" type="button" id="cloudSyncNow">Verificar sincronização</button><button class="secondary" type="button" id="cloudLogout">Sair da conta</button></div>`:''}
  ${conflictMarkup}${messageMarkup}<p class="cloud-local-note">Sem login, seus dados continuam neste navegador. A configuração do login é feita pelo site.</p>`;
 const run=async mode=>{const email=$('#cloudEmail')?.value.trim()||'',password=$('#cloudPassword')?.value||'';if(!email||!password){renderCloudPanel('Preencha o e-mail e a senha.','error',{email,password});return;}try{panel.querySelectorAll('button').forEach(button=>button.disabled=true);await cloudAuth(mode,email,password);}catch(error){renderCloudPanel(cloudFriendlyError(error),'error',{email,password});}};
 const chooseMode=mode=>{const email=$('#cloudEmail')?.value||'',password=$('#cloudPassword')?.value||'';cloudAuthMode=mode;cloudPanelMessage='';renderCloudPanel('', 'info',{email,password});};
 const modeLogin=$('#cloudModeLogin');if(modeLogin)modeLogin.onclick=()=>chooseMode('login');const modeSignup=$('#cloudModeSignup');if(modeSignup)modeSignup.onclick=()=>chooseMode('signup');
 const submit=$('#cloudSubmit');if(submit)submit.onclick=()=>void run(authMode==='signup'?'signup':'login');
 for(const id of ['cloudEmail','cloudPassword']){const input=$('#'+id);if(input)input.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();void run(authMode==='signup'?'signup':'login');}});}
 const useDevice=$('#cloudUseThisDevice');if(useDevice)useDevice.onclick=()=>void cloudResolveConflict('local');const useCloud=$('#cloudUseCloud');if(useCloud)useCloud.onclick=()=>void cloudResolveConflict('cloud');
 const sync=$('#cloudSyncNow');if(sync)sync.onclick=async()=>{sync.disabled=true;await cloudReconcile(true);renderCloudPanel();};
 const logout=$('#cloudLogout');if(logout)logout.onclick=cloudLogout;
}
function openCloudPanel(){renderCloudPanel();$('#cloudBackdrop').classList.add('open')}
async function initCloudAuth(){
 if(!cloudHasConfig()){cloudSetSyncState('offline','Login ainda não configurado neste site.');return;}
 try{
  const client=cloudClient();let {data,error}=await client.auth.getSession();if(error)throw error;let session=data?.session||null;
  if(!session&&cloudSession?.access_token&&cloudSession?.refresh_token){const restored=await client.auth.setSession({access_token:cloudSession.access_token,refresh_token:cloudSession.refresh_token});if(!restored.error)session=restored.data?.session||null;else{try{localStorage.removeItem(CLOUD_SESSION_KEY)}catch(e){}cloudSession=null;}}
  if(session){cloudSession=session;try{localStorage.setItem(CLOUD_SESSION_KEY,JSON.stringify(session))}catch(e){}await cloudLoad();}
  else cloudSetSyncState('offline','A coleção está salva neste navegador. Entre para sincronizá-la.');
 }catch(error){const friendly=cloudFriendlyError(error);console.warn('Não foi possível restaurar a sessão da Estante:',error);cloudPanelMessage=friendly;cloudPanelMessageType='error';cloudSetSyncState('error',friendly);}
}

