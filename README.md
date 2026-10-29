# Saudinho · rede de saúde do Maranhão

App web (HTML, CSS e JavaScript puros) com back-end em PHP: login, cadastro, painel de administração, mapa da rede de saúde do Maranhão com estabelecimentos e profissionais do CNES.

**Trilha B (API pública), sem chave de API:** API de Dados Abertos do Ministério da Saúde, IBGE (municípios), OpenStreetMap/Leaflet (mapa) e OSRM (rota).

Normas da API seguidas: `limit` ≤ 20, `offset` = número da página, códigos inteiros, `status=1` (ativos).

## Como rodar
1. PHP 8.1+ com cURL.
2. Na pasta do projeto: `php -S localhost:8000`
3. Abra http://localhost:8000. O **primeiro cadastro** vira administrador.

## Erro de certificado SSL
"self-signed certificate in certificate chain" significa que o antivírus/rede inspeciona HTTPS e o PHP não confia nesse certificado. A API continua pública. O `backend/http.php` tenta, em ordem: (1) `backend/cacert.pem` ou o padrão do PHP; (2) o repositório de certificados do Windows (onde o antivírus instala o dele); (3) só em localhost e com `ssl_inseguro_local => true`, sem verificação. A solução definitiva é baixar https://curl.se/ca/cacert.pem para `backend/cacert.pem`, ou apontar `curl.cainfo` no php.ini.

## "Connection was reset" (Recv failure)
O servidor do Ministério às vezes derruba a conexão do cURL (HTTP/2, IPv6 ou TLS). Agora o `backend/http.php` tenta HTTP/1.1 + IPv4, depois TLS 1.2, depois o jeito padrão e por fim o fluxo nativo do PHP, com 2 tentativas cada e User-Agent de navegador. Se o PHP ainda assim não alcançar a API, o **navegador chama a API pública direto** (ela libera CORS) e segue assim nas próximas buscas. Só se tudo falhar aparece o modo DEMONSTRAÇÃO. Para ver o motivo exato, abra (logado) `http://localhost:8000/backend/diagnostico.php`.

## Fonte reserva: OpenStreetMap
Se a API do CNES não responder, a busca usa o OpenStreetMap (Overpass API, gratuita e sem chave; `js/osm.js`) e mostra hospitais, clínicas e consultórios do município no mapa. Esses dados não têm profissionais, leitos nem serviços, que só existem no CNES; o app avisa isso na tela. Só se o OpenStreetMap também falhar aparece a DEMONSTRAÇÃO.

## Estrutura
- `login.html`, `cadastro.html`, `index.html` (mapa), `admin.html`
- `backend/`: `auth.php` (cadastro/login/sair), `admin.php`, `saude.php` (proxy da API, só logado), `municipios.php`
- `js/`, `css/`, `img/`

## Segurança
Senhas com `password_hash`; sessão em cookie HttpOnly; token CSRF em todo POST; proxy só com rotas permitidas; textos inseridos com `textContent`. Os usuários ficam em `backend/data/usuarios.json.php` (arquivo que responde 404 se aberto pelo navegador). Em produção, use um banco de dados e HTTPS.

## Fonte principal: portal do CNES
Estabelecimentos agora vêm primeiro do portal (`/portal/estabelecimentos` → `cnes.datasus.gov.br/services/estabelecimentos`, via `backend/saude.php`); se falhar, cai na API de Dados Abertos e depois no OpenStreetMap. Os nomes dos parâmetros de busca estão em `PARAMS_ESTAB_PORTAL` (`js/api.js`) e podem ser ajustados conforme o que o site do CNES enviar (aba Rede do navegador). O diagnóstico em `backend/diagnostico.php` testa as duas rotas do portal.

## Profissionais (fontes)
Primeiro o portal do CNES (`cnes.datasus.gov.br/services/estabelecimentos-profissionais/{município+CNES}`, lista completa com nome); em paralelo, a API de Dados Abertos. Vale a primeira que devolver dados.
A base pública do CNES descreve ocupação, vínculo e carga horária. O nome só aparece se a API o informar; caso contrário o app mostra a ocupação (CBO) e o estabelecimento de lotação.

## Profissionais da unidade
Ao abrir um estabelecimento, o app mostra foto (Wikimedia Commons), complexidade, horário (turno do CNES), serviços especializados e, **abaixo do mapa**, a tabela com todos os profissionais daquela unidade (ocupação/CBO, vínculo, carga horária, serviço e horário), com busca, filtros e ordenação. Rotas usadas: `/cnes/estabelecimentos`, `/assistencia-a-saude/cnes-profissionais` e `/assistencia-a-saude/cnes-servicos-especializados`.

## Mapa e dados
Seletor de fundo do mapa (Padrão e Satélite). Os dados da unidade aparecem com nomes legíveis (Identificação, Endereço e contato, Funcionamento, Estrutura); os nomes técnicos dos campos do CNES não são exibidos. Se serviços ou profissionais vierem vazios, o app mostra o "Diagnóstico da API" com o que cada chamada respondeu.

## Visual e gráficos
Mapa em fundo **cinza** (padrão), cinza escuro ou **satélite**; marcador é o **pino do Saudinho** na cor da gestão. Painel do município (indicadores + rosca de gestão + barras por tipo) e, em cada unidade, gráficos de ocupação, vínculo e carga horária (`js/graficos.js`, sem biblioteca). Botão **Ver no CNES** abre a ficha oficial da unidade.

## Acessibilidade
VLibras (Libras, do governo federal) em todas as páginas: botão azul no canto da tela (`js/libras.js`).

## Profissionais interativos
Busca por texto, chips de ocupação com contagem, filtro por vínculo, ordenação e carga de até 100 registros de uma vez, no município e em cada unidade.

## Plano B
Se a API não responder, o app avisa e usa `js/demo.js`.

## Aba Rede
![Print da aba Rede](https://github.com/AndreMouraL/Saudinho/blob/main/docs/GET%20200_1.png)

A requisição GET para `backend/saude.php` retornou status 200. Ela é o proxy do back-end, que consulta a API pública do CNES e devolve a lista de estabelecimentos em JSON para o mapa.

## Uso de IA
Ferramenta: Claude (Anthropic). Pedi estrutura, back-end PHP, autenticação e visual. Uso moderado maior parte meu como projeto pessoal. 

## Localização no mapa
A lista do portal do CNES não traz latitude/longitude, mas a ficha da unidade (`/services/estabelecimentos/{município+CNES}`) traz `nuLatitude`/`nuLongitude`: o app lê essas coordenadas oficiais primeiro. Só quando a ficha não as tem, localiza a unidade pelo endereço (rua+número+bairro, depois rua, CEP e bairro) no Nominatim/OpenStreetMap, em segundo plano e a ~1 unidade por segundo, e guarda o resultado no navegador (`localStorage`). Só vale se cair dentro do Maranhão; achados só por CEP/bairro aparecem como "localização aproximada".

## Mapa completo, filtros e Limpar
Ao buscar um município, todas as unidades dele vão para o mapa: primeiro as coordenadas oficiais da ficha do CNES (6 consultas ao mesmo tempo), depois, para quem não tem, o endereço (1 por segundo). Gestão, tipo, a busca (nome, razão social, CNES, CNPJ, endereço) e os chips filtram ao vivo, no mapa e na lista. **Limpar** funciona em dois passos: o 1º tira os filtros e mostra todas as unidades do município; o 2º limpa também o município e volta ao mapa geral do Maranhão. Dica: `php -S` padrão atende uma requisição por vez; com `PHP_CLI_SERVER_WORKERS=4 php -S localhost:8000` (Linux/macOS) o mapa enche bem mais rápido.

## Horário, complexidade, fotos e página Sobre
Cada cartão da lista mostra selos de **complexidade** (baixa, média, média/alta, urgência) e de **horário de funcionamento** ("24 h" quando o CNES marca `tpSempreAberto = S`, como na ficha oficial), mais uma miniatura de foto (Wikimedia Commons, carregada só quando o cartão aparece na tela). `sobre.html` conta a origem do projeto; edite faculdade e equipe em `js/sobre.js`.

## Base geral do Maranhão (JSON e XLSX)
A página `base.html` (menu "Base do Maranhão") coleta município por município todos os estabelecimentos e profissionais e baixa em **JSON** e **XLSX** (abas Estabelecimentos, Profissionais e Leia-me). A coleta roda no navegador, guarda cada município pronto no IndexedDB (dá para pausar, fechar e continuar) e permite baixar o que já está pronto. Colunas em `js/linhas.js`; coleta e exportação em `js/base.js`. O XLSX usa SheetJS (cdnjs). Para acelerar: `PHP_CLI_SERVER_WORKERS=4 php -S localhost:8000`.

## Horário e complexidade: por que vêm da ficha
A lista do portal do CNES traz só ~10 campos (sem tipo, endereço nem "Sempre aberto"). Por isso o app busca a **ficha** de cada unidade (`/portal/estabelecimentos/{município+CNES}`), mescla em `bruto` e então calcula horário (`tpSempreAberto`) e complexidade (tipo `dsTpUnidade`); os selos dos cartões se corrigem sozinhos quando a ficha chega.

## Autoria
Criado por André Moura, Engenheiro de Dados e Cientista de Dados, com mais de 5 anos no mundo dos dados.

## Engenharia de Dados e Ciência Pipeline.
