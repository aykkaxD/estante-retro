# Estante Retro

Aplicação web de arquivo de jogos e consoles, baseada no HTML oficial fornecido. A coleção local, perfis, wishlist, fichas, progresso, acessórios, backups e importação/exportação permanecem no site. As conexões externas são opcionais.

## Abrir e usar

- Abra `index.html` em um navegador moderno para usar a coleção local. Os dados permanecem no armazenamento desse navegador.
- O botão **＋ Adicionar jogo** no topo e a ação principal da página continuam disponíveis conforme a seção selecionada. Se ainda não houver console, o fluxo pede para cadastrar uma plataforma primeiro.
- O menu do avatar reúne **Meu perfil**, **Trocar ou gerenciar perfis** e **Nuvem e sincronização**.
- O botão **⚙ Configurações gerais** abre os temas e a área de APIs. A escolha de tema é salva no navegador.
- Na **Wishlist**, cada jogo aceita uma capa própria por upload (a imagem é otimizada antes de salvar) ou uma arte escolhida na SteamGridDB. Use **Editar → Capa do jogo** para trocar/remover a imagem; a capa também acompanha o jogo ao movê-lo para a coleção.

## SteamGridDB no computador

1. Instale Node.js 18.17 ou superior: <https://nodejs.org/>.
2. Dê dois cliques em `INICIAR_STEAMGRIDDB.bat` e mantenha a janela aberta enquanto busca nomes ou capas.
3. No site, abra **Configurações gerais → APIs e integrações**, insira sua chave em SteamGridDB e salve. O teste de conexão está no mesmo painel.
4. A chave fica no armazenamento local do navegador, não no HTML nem nos dados exportados.

O auxiliar escuta apenas em `127.0.0.1:3210`, não possui dependências npm e só encaminha duas rotas permitidas da SteamGridDB: busca por autocomplete e artes de jogos. Não registra a chave em logs.

## Hospedar com Netlify

O pacote inclui `netlify.toml` e `netlify/functions/steamgriddb.js`. Publique a pasta inteira como projeto Netlify (por repositório ou CLI); não envie apenas `index.html`, pois a função é necessária para chamadas SteamGridDB a partir do site hospedado. A função usa a chave da SteamGridDB enviada pelo navegador e restringe os caminhos consultáveis.

O HTML carrega o SDK do Supabase por CDN, portanto o login exige internet. A configuração pública do projeto Supabase é mantida pelo site; visitantes não precisam criar um projeto nem copiar chaves.

## Nuvem entre computador e celular

Abra o avatar → **Nuvem e sincronização** para criar uma conta com e-mail e senha ou entrar com a mesma conta em cada dispositivo. Não é preciso obter chaves, criar um projeto Supabase ou configurar integrações. Sem login, a coleção continua salva localmente no navegador.

Na primeira comparação, se os dados locais e da nuvem forem diferentes, a Estante pergunta qual versão manter. Alterações simultâneas entre dispositivos também são detectadas por revisão; nenhuma versão é substituída sem uma escolha explícita. O script `corrigir_estante_cloud.sql` descreve a tabela protegida por RLS e a função de gravação condicional usada pelo site.

## Conteúdo do pacote

- `index.html` — estrutura da página e carregamento dos módulos do site.
- `styles.css` — estilos da interface.
- `js/domain.js` — status, valores, conversão de dados antigos e regras de aquisição.
- `js/state.js` — estado compartilhado, carregamento/salvamento local e chaves por perfil.
- `js/wishlist.js` — lista de desejos, ofertas e editor da wishlist.
- `js/cloud.js` — login, sincronização, resolução de conflitos e dados em nuvem.
- `js/app.js` — biblioteca principal, fichas, SteamGridDB e temas.
- `js/tools.js`, `js/profiles.js`, `js/plus.js` e `js/settings-controller.js` — acessórios e backups, perfis, recursos adicionais e controles de configurações.
- `api-server.js` e `INICIAR_STEAMGRIDDB.bat` — auxiliar local SteamGridDB.
- `netlify/functions/steamgriddb.js` e `netlify.toml` — função para hospedagem Netlify.
- `corrigir_estante_cloud.sql` — estrutura RLS para sincronização Supabase.
- `package.json` — script e requisito de Node.js (sem dependências extras).
