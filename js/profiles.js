
/* Perfis independentes da Estante: cada um tem coleção, wishlist, acessórios e preferências próprios. */
let estanteProfiles=[];
function saveProfileManager(){
 try{localStorage.setItem(PROFILE_META_KEY,JSON.stringify({activeId:currentProfileId,profiles:estanteProfiles}));localStorage.setItem(PROFILE_ACTIVE_KEY,currentProfileId);return true;}
 catch(e){toast('Não foi possível salvar os perfis. Verifique o espaço do navegador.');return false;}
}
function profileMetaName(){return String(profile?.displayName||profile?.nickname||'Minha coleção').trim()||'Minha coleção';}
function syncActiveProfileMeta(){
 let active=estanteProfiles.find(p=>p.id===currentProfileId);
 if(!active){active={id:currentProfileId,name:profileMetaName(),createdAt:Date.now()};estanteProfiles.push(active);}
 active.name=profileMetaName();
 saveProfileManager();
}
function loadProfileManager(){
 try{
  const raw=localStorage.getItem(PROFILE_META_KEY);const data=raw?JSON.parse(raw):null;
  if(data&&Array.isArray(data.profiles))estanteProfiles=data.profiles.filter(p=>p&&typeof p.id==='string').map(p=>({id:p.id,name:String(p.name||'Perfil'),createdAt:Number(p.createdAt)||Date.now()}));
 }catch(e){estanteProfiles=[];}
 if(!estanteProfiles.length)estanteProfiles=[{id:'default',name:profileMetaName(),createdAt:Date.now()}];
 if(!estanteProfiles.some(p=>p.id===currentProfileId))estanteProfiles.push({id:currentProfileId,name:profileMetaName(),createdAt:Date.now()});
 syncActiveProfileMeta();
}
function managerInitials(name){const parts=String(name||'Perfil').trim().split(/\s+/).filter(Boolean);return (parts.length>1?parts[0][0]+parts[1][0]:String(name||'P').slice(0,2)).toUpperCase();}
function openProfileManager(){
 syncActiveProfileMeta();
 $('#modalTitle').textContent='Perfis da Estante';
 const rows=estanteProfiles.map(item=>{
  const active=item.id===currentProfileId;
  const raw=localStorage.getItem(profileDataKey('estanteCollectionV1',item.id));let count=0;
  try{const data=raw?JSON.parse(raw):[];if(Array.isArray(data))count=data.reduce((n,c)=>n+(Array.isArray(c.games)?c.games.length:0),0);}catch(e){}
  const initials=managerInitials(item.name);
  return `<div class="profile-manager-row"><div class="profile-manager-avatar">${esc(initials)}</div><div class="profile-manager-copy"><strong>${esc(item.name)}</strong><small>${count} ${count===1?'jogo na coleção':'jogos na coleção'}${active?' · perfil em uso':''}</small></div>${active?'<span class="profile-manager-current">Em uso</span>':`<button class="profile-manager-switch" type="button" data-use-profile="${esc(item.id)}">Usar perfil</button>`}</div>`;
 }).join('');
 $('#editorForm').innerHTML=`<p class="profile-manager-note">Cada perfil mantém uma coleção, wishlist, progresso, inventário e preferências separados. Use isso para organizar coleções diferentes ou compartilhar o navegador sem misturar os registros.</p><div class="profile-manager-list">${rows}</div><div class="profile-manager-bottom"><span style="color:#77768d;font-size:10px">${estanteProfiles.length} ${estanteProfiles.length===1?'perfil':'perfis'} neste navegador</span><button class="primary" type="button" id="newProfileOpen">＋ Adicionar perfil</button></div>`;
 $('#modalBackdrop').classList.add('open');
 document.querySelectorAll('[data-use-profile]').forEach(btn=>btn.onclick=()=>switchEstanteProfile(btn.dataset.useProfile));
 $('#newProfileOpen').onclick=openNewProfileForm;
 $('#editorForm').onsubmit=e=>e.preventDefault();
}
function openNewProfileForm(){
 $('#modalTitle').textContent='Adicionar perfil';
 $('#editorForm').innerHTML=`<p class="profile-manager-note">O novo perfil começa com as plataformas retrô disponíveis, mas sem jogos cadastrados. Sua coleção atual não será alterada.</p><div class="field"><label for="newProfileName">Nome do perfil</label><input id="newProfileName" maxlength="50" required placeholder="Ex.: Minha coleção, Coleção da família"></div><div class="profile-manager-bottom" style="margin-top:17px"><button class="secondary" type="button" id="cancelNewProfile">Voltar aos perfis</button><button class="primary" type="submit">Criar perfil</button></div>`;
 $('#newProfileName').focus();
 $('#cancelNewProfile').onclick=openProfileManager;
 $('#editorForm').onsubmit=e=>{e.preventDefault();createEstanteProfile($('#newProfileName').value);};
}
function createEstanteProfile(rawName){
 const name=String(rawName||'').trim();if(!name){toast('Digite um nome para o perfil.');return;}
 if(estanteProfiles.some(p=>p.name.toLocaleLowerCase('pt-BR')===name.toLocaleLowerCase('pt-BR'))&&!confirm('Já existe um perfil com esse nome. Criar outro mesmo assim?'))return;
 const id='profile-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7);
 const blankConsoles=baseConsoles.map(c=>({...c,games:[]}));
 const values={
  'estanteCollectionV1':JSON.stringify(blankConsoles),
  'estanteWishlistV1':'[]',
  'estanteProfileV1':JSON.stringify({...defaultProfile,displayName:name,nickname:''}),
  'estanteAccessoriesV1':'[]'
 };
 const written=[];
 try{for(const [key,value] of Object.entries(values)){const target=profileDataKey(key,id);localStorage.setItem(target,value);written.push(target);}}
 catch(e){written.forEach(key=>{try{localStorage.removeItem(key);}catch(_){}});toast('Não foi possível criar o perfil: o armazenamento pode estar cheio.');return;}
 estanteProfiles.push({id,name,createdAt:Date.now()});
 if(!saveProfileManager()){estanteProfiles=estanteProfiles.filter(p=>p.id!==id);written.forEach(key=>{try{localStorage.removeItem(key);}catch(_){}});return;}
 switchEstanteProfile(id,true);
}
function switchEstanteProfile(id,alreadySaved=false){
 const next=estanteProfiles.find(p=>p.id===id);if(!next)return;
 syncActiveProfileMeta();
 const previousId=currentProfileId;currentProfileId=id;
 if(!saveProfileManager()){currentProfileId=previousId;return;}
 try{localStorage.setItem(PROFILE_ACTIVE_KEY,id);}catch(e){toast('Não foi possível trocar o perfil neste navegador.');return;}
 // The next load reads this profile's namespaced records; the global SteamGridDB key remains shared.
 location.reload();
}
loadProfileManager();
const profileAddButton=document.getElementById('profileAddTop');if(profileAddButton)profileAddButton.onclick=openProfileManager;
