
function openGeneralSettings(initialTab='appearance'){
  const modal=document.querySelector('#modalBackdrop');
  const form=document.querySelector('#editorForm');
  if(!modal||!form)return;
  modal.querySelector('.modal')?.classList.add('settings-modal');
  const themes=[
    {id:'default',name:'Retrô roxo',desc:'A identidade original da Estante',colors:['#a855f7','#ff3fa4','#28d9e8']},
    {id:'red',name:'Vermelho cereja',desc:'Vermelho e vinho',colors:['#e83b5d','#ad152f','#f7a0af']},
    {id:'gamez',name:'Arcade colorido',desc:'Coral, amarelo e ciano',colors:['#ff5c7a','#ffb84d','#49c7e8']},
    {id:'ocean',name:'Azul oceano',desc:'Azul elétrico e ciano',colors:['#4778ff','#35c5d9','#172e50']},
    {id:'amber',name:'CRT âmbar',desc:'Âmbar quente e laranja',colors:['#f4b942','#ed7846','#332819']},
    {id:'mono',name:'Monocromático',desc:'Cinza e prata discreta',colors:['#d5d5df','#858595','#292932']},
    {id:'forest',name:'Floresta',desc:'Verde folha e menta',colors:['#5dcc8b','#b2e86b','#193428']},
    {id:'vaporwave',name:'Vaporwave',desc:'Magenta e violeta neon',colors:['#ff5bd6','#7a5cff','#30203e']},
    {id:'gameboy',name:'Game Boy',desc:'Verde clássico portátil',colors:['#a3c644','#708238','#232e21']}
  ];
  let currentTheme='default';try{currentTheme=localStorage.getItem('estanteTheme')||'default'}catch(e){}
  form.onsubmit=e=>e.preventDefault();
  document.querySelector('#modalTitle').textContent='Configurações gerais';
  form.innerHTML=`
    <p class="general-settings-intro">Ajuste a aparência e as integrações disponíveis nesta instalação da Estante.</p>
    <div class="general-settings-tabs" role="tablist" aria-label="Seções das configurações"><button type="button" data-settings-tab="appearance" role="tab" aria-pressed="true">Interface e temas</button><button type="button" data-settings-tab="apis" role="tab" aria-pressed="false">APIs e integrações</button></div>
    <div class="settings-panel" data-settings-panel="appearance" role="tabpanel">
      <section class="settings-section"><h3>Aparência</h3><p>Escolha um tema para atualizar os painéis, a navegação, os botões e os formulários. As capas dos jogos permanecem iguais.</p><div class="theme-choice-grid">${themes.map(t=>`<button type="button" class="theme-choice" data-theme-choice="${t.id}" aria-pressed="${t.id===currentTheme?'true':'false'}"><span class="theme-swatches">${t.colors.map(c=>`<i style="background:${c}"></i>`).join('')}</span><span><strong>${t.name}</strong><small>${t.desc}</small></span></button>`).join('')}</div><div class="settings-status" id="generalThemeStatus" role="status">O tema selecionado é salvo automaticamente neste navegador.</div></section>
    </div>
    <div class="settings-panel" data-settings-panel="apis" role="tabpanel" hidden>
      <section class="settings-section" id="generalSgdbSection"><h3>SteamGridDB</h3><p>Use a chave para buscar jogos e escolher capas. Ela fica salva neste navegador e só é enviada nas chamadas à SteamGridDB.</p><div class="field"><label for="generalSgdbApiKey">Chave da API</label><input id="generalSgdbApiKey" type="password" autocomplete="off" spellcheck="false" placeholder="Cole sua chave pública da SteamGridDB" value="${esc(steamGridDbKey||'')}"></div><p><a href="https://www.steamgriddb.com/profile/preferences" target="_blank" rel="noopener noreferrer">Abrir preferências do SteamGridDB ↗</a></p><div class="settings-inline-actions"><button class="secondary" type="button" id="generalSgdbTest">Testar conexão</button><button class="secondary" type="button" id="generalSgdbRemove">Remover chave</button><button class="primary" type="button" id="generalSgdbSave">Salvar chave</button><span class="settings-status" id="generalSgdbStatus" role="status"></span></div></section>
      <section class="settings-section" id="generalSupabaseSection"><h3>Login e sincronização</h3><p>Use <strong>Nuvem e sincronização</strong> no menu do perfil para criar sua conta ou entrar. Este site já está conectado; não é necessário copiar chaves nem configurar um projeto.</p><div class="settings-inline-actions"><button class="primary" type="button" id="generalCloudOpen">Abrir login e sincronização</button><span class="settings-status">A coleção local continua disponível sem login.</span></div></section>
    </div>
    <div class="modal-actions"><button type="button" class="secondary" id="generalSettingsClose">Fechar</button></div>`;
  modal.classList.add('open');
  const chooseTab=tab=>{
    form.querySelectorAll('[data-settings-tab]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.settingsTab===tab?'true':'false'));
    form.querySelectorAll('[data-settings-panel]').forEach(p=>{p.hidden=p.dataset.settingsPanel!==tab});
  };
  form.querySelectorAll('[data-settings-tab]').forEach(b=>b.onclick=()=>chooseTab(b.dataset.settingsTab));
  form.querySelectorAll('[data-theme-choice]').forEach(btn=>btn.onclick=()=>{
    applyTheme(btn.dataset.themeChoice);
    form.querySelectorAll('[data-theme-choice]').forEach(b=>b.setAttribute('aria-pressed',b===btn?'true':'false'));
    const status=document.querySelector('#generalThemeStatus');if(status)status.textContent='Tema aplicado e salvo neste navegador.';
  });
  const sgdbInput=document.querySelector('#generalSgdbApiKey');
  const sgdbStatus=document.querySelector('#generalSgdbStatus');
  const saveSgdbKey=()=>{
    steamGridDbKey=String(sgdbInput?.value||'').trim();
    try{if(steamGridDbKey)localStorage.setItem('estanteSteamGridDBKey',steamGridDbKey);else localStorage.removeItem('estanteSteamGridDBKey');}
    catch(e){if(sgdbStatus){sgdbStatus.className='settings-status error';sgdbStatus.textContent='O navegador não permitiu salvar a chave.';}return false;}
    if(sgdbStatus){sgdbStatus.className='settings-status success';sgdbStatus.textContent=steamGridDbKey?'Chave salva neste navegador.':'Chave removida.';}
    return true;
  };
  document.querySelector('#generalSgdbSave').onclick=()=>{if(saveSgdbKey())toast(steamGridDbKey?'SteamGridDB configurado':'Chave SteamGridDB removida');};
  document.querySelector('#generalSgdbRemove').onclick=()=>{if(sgdbInput)sgdbInput.value='';if(saveSgdbKey())toast('Chave SteamGridDB removida');};
  document.querySelector('#generalSgdbTest').onclick=async()=>{
    const btn=document.querySelector('#generalSgdbTest');const key=String(sgdbInput?.value||'').trim();
    if(!key){sgdbStatus.className='settings-status error';sgdbStatus.textContent='Cole uma chave antes de testar.';return;}
    btn.disabled=true;sgdbStatus.className='settings-status';sgdbStatus.textContent='Testando conexão…';
    try{const result=await sgdbRequest('/search/autocomplete/Portal',key);sgdbStatus.className='settings-status success';sgdbStatus.textContent=`Conexão funcionando (${result.length} resultado(s) de teste).`;}
    catch(e){sgdbStatus.className='settings-status error';sgdbStatus.textContent=e?.message||'Falha ao conectar. Confira a chave e o auxiliar de API.';}
    finally{btn.disabled=false;}
  };
  document.querySelector('#generalCloudOpen').onclick=()=>{modal.classList.remove('open');openCloudPanel();};
  document.querySelector('#generalSettingsClose').onclick=()=>{modal.classList.remove('open');modal.querySelector('.modal')?.classList.remove('settings-modal');};
  chooseTab(initialTab==='apis'?'apis':'appearance');
}
function openThemeSettings(){openGeneralSettings('appearance')}
function openSgdbSettings(){openGeneralSettings('apis')}
function updateProfileMenuSummary(){
  organizeProfileMenu();
  const accountAction=document.querySelector('#sidebarCloudLoginButton');
  if(accountAction){const title=accountAction.querySelector('strong'),detail=accountAction.querySelector('small');if(title)title.textContent=cloudSyncState==='conflict'?'Resolver conflito':cloudSyncState==='error'?'Sincronização com falha':cloudReady()?'Conta e sincronização':'Entrar / criar conta';if(detail)detail.textContent=cloudSyncState==='conflict'?'Há versões para revisar':cloudSyncState==='error'?'Tocar para tentar novamente':cloudReady()?'Acessar em outros dispositivos':'Sincronizar entre dispositivos';accountAction.title=cloudSyncState==='conflict'?'Resolver conflito de sincronização':cloudSyncState==='error'?'Ver erro de sincronização':'Entrar ou gerenciar sua conta';accountAction.setAttribute('aria-label',accountAction.title);}
  const avatar=document.querySelector('#profileMenuAvatar');
  if(avatar){
    avatar.replaceChildren();
    if(profile?.avatarImage){const image=document.createElement('img');image.src=profile.avatarImage;image.alt='';avatar.append(image);}
    else avatar.textContent=profileInitials();
  }
  const name=document.querySelector('#profileMenuName');
  if(name)name.textContent=String(profile?.nickname||profile?.displayName||'Minha coleção').trim()||'Minha coleção';
  const status=document.querySelector('#profileMenuCloudStatus');
  if(status){
    if(cloudSyncState==='conflict')status.textContent='Conflito: escolha uma versão';
    else if(cloudSyncState==='error')status.textContent='Falha na sincronização · veja o aviso';
    else if(cloudReady())status.textContent='Conectado: '+String(cloudSession?.user?.email||'conta ativa');
    else status.textContent='Coleção salva neste dispositivo';
  }
}
function organizeProfileMenu(){
  const menu=document.querySelector('#profileMenu');
  if(!menu||menu.dataset.organized==='true')return;
  const heading=menu.querySelector('.profile-menu-heading');
  if(heading&&!heading.querySelector('.profile-menu-avatar')){
    const avatar=document.createElement('span');avatar.id='profileMenuAvatar';avatar.className='profile-menu-avatar';avatar.setAttribute('aria-hidden','true');
    heading.prepend(avatar);
  }
  const profileAction=document.querySelector('#profileMenuOpen');
  if(profileAction){const detail=profileAction.querySelector('small');if(detail)detail.textContent='Ver coleção, wishlist e dados pessoais';}
  const groups=[
    {label:'Perfil',ids:['profileMenuOpen','profileMenuManage']},
    {label:'Dados e sincronização',ids:['cloudLoginButton']},
    {label:'Preferências',ids:['profileMenuSettings']}
  ];
  groups.forEach(({label,ids})=>{
    const items=ids.map(id=>document.getElementById(id)).filter(Boolean);
    if(!items.length)return;
    const group=document.createElement('div');group.className='profile-menu-group';
    const title=document.createElement('div');title.className='profile-menu-group-label';title.textContent=label;group.append(title);
    items.forEach(item=>group.append(item));menu.append(group);
  });
  menu.dataset.organized='true';
}
function closeProfileMenu(){const menu=document.querySelector('#profileMenu');const trigger=document.querySelector('#profileButton');if(menu)menu.hidden=true;if(trigger)trigger.setAttribute('aria-expanded','false');}
function toggleProfileMenu(){
  const menu=document.querySelector('#profileMenu');const trigger=document.querySelector('#profileButton');if(!menu||!trigger)return;
  const opening=menu.hidden;updateProfileMenuSummary();menu.hidden=!opening;trigger.setAttribute('aria-expanded',String(opening));
}
function openProfileMenuAction(action){closeProfileMenu();if(typeof action==='function')action();}
(function wireEstanteGeneralSettings(){
  const settingsModal=document.querySelector('#modalBackdrop');
  const settingsDialog=settingsModal?.querySelector('.modal');
  document.querySelector('#modalClose')?.addEventListener('click',()=>settingsDialog?.classList.remove('settings-modal'));
  settingsModal?.addEventListener('click',event=>{if(event.target===settingsModal)settingsDialog?.classList.remove('settings-modal');});
  document.addEventListener('keydown',event=>{if(event.key==='Escape')settingsDialog?.classList.remove('settings-modal');});
  const gear=document.querySelector('#generalSettings');if(gear)gear.addEventListener('click',()=>{closeProfileMenu();openGeneralSettings('appearance')});
  const profileButton=document.querySelector('#profileButton');if(profileButton)profileButton.onclick=toggleProfileMenu;
  const profileOpen=document.querySelector('#profileMenuOpen');if(profileOpen)profileOpen.onclick=()=>openProfileMenuAction(()=>{currentView='profile';currentConsole=null;searchTerm='';$('#searchInput').value='';render();window.scrollTo({top:0,behavior:'smooth'});});
  const profileManage=document.querySelector('#profileMenuManage');if(profileManage)profileManage.onclick=()=>openProfileMenuAction(()=>{if(typeof openProfileManager==='function')openProfileManager();else toast('O gerenciador de perfis ainda não está disponível.');});
  const cloudButton=document.querySelector('#cloudLoginButton');if(cloudButton){cloudButton.onclick=()=>openProfileMenuAction(openCloudPanel);}
  const settingsButton=document.querySelector('#profileMenuSettings');if(settingsButton)settingsButton.onclick=()=>openProfileMenuAction(()=>openGeneralSettings('appearance'));
  document.addEventListener('click',event=>{if(!event.target.closest('#profileMenu')&&!event.target.closest('#profileButton'))closeProfileMenu()});
  document.addEventListener('keydown',event=>{if(event.key==='Escape')closeProfileMenu()});
  updateProfileMenuSummary();
})();
