# ESCALARE — entrega local para avaliação

Prévia: http://127.0.0.1:4173/escalare-site/

Se necessário, iniciar com `node tools/preview.cjs`. Não abrir por file://, pois a Home carrega módulos JavaScript.

## O que foi preservado

Arquitetura estática multipage, marca existente, css/style.css, bibliotecas locais e licenças, fundação Three.js/GSAP, fallback SVG, carregamento progressivo, renderização sob demanda, descarte e preferência por movimento reduzido. As imagens anteriores permanecem no repositório, mas não são usadas como documentação de uma equipe real.

O texto da Política de Privacidade foi mantido; sua apresentação e navegação foram atualizadas. As alterações locais que precediam esta execução não foram revertidas. Nenhum commit, push, merge ou deploy foi realizado.

## O que foi refinado

Navegação, header, footer, tipografia, grade, contrastes, hierarquia, CTAs, jornadas, copy institucional, composição do 3D, câmera, corredores/divisores e experiência mobile. Claims não confirmados saíram da Home. O formulário prepara uma mensagem e explica que o usuário concluirá o envio no WhatsApp.

## Arquivos criados nesta execução

- Páginas: solucoes.html, gestao-de-escalas-medicas.html, para-instituicoes.html, para-profissionais.html, sobre.html, conteudos.html, contato.html e 404.html.
- Estilos: css/institutional.css.
- Comportamentos: js/forms.js, js/motion.js, js/process-experience.js e js/page-transitions.js.
- Assets: assets/favicon.svg, assets/og-escalare.svg e assets/og-escalare.png.
- SEO: sitemap.xml e robots.txt.
- QA: tools/review-site.cjs, tools/audit-accessibility.cjs e tools/verify-resilience.cjs.
- Documentação: AVALIACAO.md.

## Arquivos alterados nesta execução

index.html, privacidade.html, js/main.js, js/home-experience.js, js/operation-scene.js, css/home-experience.css, assets/operation-unit.svg, tools/preview.cjs, tools/verify-experience.cjs, tools/README.md e .gitignore.

css/style.css já estava modificado antes desta execução e foi preservado.

## Páginas criadas

Sete páginas institucionais novas completam Home e Privacidade: Soluções, Gestão de Escalas Médicas, Instituições, Profissionais, Sobre, Conteúdos e Contato. Há também uma página 404 independente, capaz de recuperar navegação em subdiretório do GitHub Pages.

## Home

Experiência inicial seguida de ponte gráfica, contexto operacional, processo, solução, jornadas para os dois públicos, explicação da gestão, apresentação institucional, conteúdo editorial e conversão.

## Three.js

Mantém a arquitetura procedural e uma única superfície WebGL na cena principal. A experiência completa é o padrão em desktop, tablet e mobile, com pixel ratio limitado a 1,6 e sombras preservadas. Apenas falha real tenta o modo de compatibilidade, com pixel ratio 1 e sem sombras; o fallback semântico entra se essa tentativa também falhar ou se a preferência de movimento reduzido exigir a composição estática. Corredores permanecem na transformação e os detalhes das salas viram marcas da escala.

## GSAP / ScrollTrigger

Bibliotecas existentes mantidas. Uma timeline principal controla o progresso da cena, com atualização reversível. O offset considera a altura real do header. Carregamento exclusivo da Home.

## Scrollytelling

Cinco capítulos legíveis: unidade, setores, profissionais, plantões e escala. A aproximação da câmera ocorre dentro dessa transformação contínua. Desktop usa sticky; mobile preserva scroll nativo sem distância artificial adicional.

## Morphing

As mesmas instâncias se reorganizam: pisos viram células, paredes reduzem a altura, corredores se tornam divisores e profissionais se achatam em alocações. Nenhuma troca hospital/calendário por slides.

## Motion design

Revelações pontuais, entrada tipográfica, traçado SVG, estados do diagrama de gestão e transições nativas entre documentos. A navegação continua sendo multipage. O cancelamento normal de uma transição visual não interrompe a navegação.

## Microinteractions

Links direcionais, setas, botões, foco, menu, FAQ nativo, formulário com resultado honesto e exploração de demanda/pessoas/organização na página de escalas.

## Design system

Camada css/institutional.css estende os tokens existentes. Azul profundo, papel claro, branco, verde controlado, tipografia Inter/Plus Jakarta e itálico editorial. Header/footer presentes em HTML em todas as páginas. Diagramas e visualizações são identificados como conceitos.

## Desktop

Conteúdo revisado em capturas de navegador; testes de larguras 1024, 1440 e 1920 px, além dos estados intermediários do 3D. A Home mantém leitura institucional com texto e CTAs em HTML.

## Mobile

Verificado em 360, 375, 390, 412, 430 e 768 px. Menu amplo com gerenciamento de foco e Escape. Formulários em uma coluna e jornadas próprias. Testado também landscape 844 × 390 e retorno a portrait.

## Fallback

SVG e HTML existentes permanecem como base semântica. `deviceMemory`, `saveData`, touch, user-agent, largura, altura e orientação não reduzem qualidade. A ordem de recuperação é experiência completa, contexto WebGL2 compatível e fallback semântico; `prefers-reduced-motion` usa diretamente o estado estático acessível. A falha de dependência preserva o conteúdo e CTA.

## Reduced motion

Sem câmera animada ou sequência longa. Narrativa semântica permanece disponível. Motion e transições são removidos/reduzidos, e os controles do diagrama continuam funcionais.

## Performance

Renderização sob demanda, pausa fora da viewport e em documento oculto, recuperação progressiva baseada em falha real, geometrias compartilhadas e descarte. Dependências da experiência: aproximadamente 227 KB em estimativa gzip, carregadas somente quando elegíveis.

Medições locais não equivalem a dados de campo. Relatório mais recente: output/poc-review/performance.json. A inicialização WebGL ainda pode gerar uma tarefa longa em algumas máquinas; não foi alegado resultado Lighthouse ou INP de campo.

## Acessibilidade

Skip link, landmarks, H1 único, labels, foco visível, menu com foco contido e fundo inert, FAQ nativo, estados aria-pressed e mensagens de status. Conteúdo principal acessível sem canvas e navegação disponível sem JavaScript.

Auditoria axe-core WCAG 2 A/AA e 2.1 AA sem violações detectadas. Há verificações de contraste incompletas sobre fundos gráficos/SVG, que não equivalem a aprovação automática; a avaliação visual complementou a auditoria. Não foi feita certificação de acessibilidade nem teste completo com leitor de tela.

## SEO

Titles/descriptions individuais, canonical e Open Graph, imagem social própria, Organization JSON-LD, breadcrumbs visíveis, sitemap e robots. Sem métricas, avaliações ou schemas de vagas inventados. URLs e domínio seguem o canonical já existente no projeto. Assets e navegação utilizam caminhos relativos.

## Testes realizados

- tools/verify-experience.cjs: cinco estados e reversão, resize, pausas, perda/ausência de contexto, falha de biblioteca, preferência reduzida dinâmica, menu e páginas internas.
- tools/review-site.cjs: nove páginas, links e âncoras locais, 360–1920 px, H1, canonical/JSON-LD, formulário sem envio, foco, Escape, histórico, 404 e navegação sem JS.
- tools/audit-accessibility.cjs: nove páginas e menu mobile.
- tools/verify-resilience.cjs: mudanças de qualidade, portrait/landscape, visibilidade simulada, histórico, memória/economia de dados, diagrama e reduced motion.
- tools/measure-experience.cjs: LCP, CLS, tarefas longas e diagnóstico gráfico local.
- Sintaxe JavaScript, git diff --check e revisão visual de capturas em output/poc-review/.

O evento de documento oculto foi simulado para testar a lógica; não equivale a alternância de aplicativo em aparelho físico.

## Conteúdos não publicados por falta de confirmação

Clientes, hospitais atendidos, equipe/fundadores, história/datas, resultados, percentuais, certificações, SLA, operação 24/7, banco de substitutos, auditoria de CRM/RQE, repasses, plataforma própria, indicadores próprios, cobertura geográfica e vagas.

Conteúdos tem estado editorial honesto, sem artigos fictícios. Não foram criadas ofertas de Auditoria, Indicadores, Recrutamento ou Tecnologia Proprietária.

## Limitações restantes

- Testes realizados em Edge/Chromium headless, não em Safari/Firefox ou aparelhos físicos.
- Fontes externas continuam sendo servidas pelo Google Fonts, com fallback de sistema.
- Formulário encaminha para WhatsApp; não há backend, CRM, upload de documentos ou banco de talentos.
- A política jurídica preservada menciona práticas de cookies e tratamento que precisam ser reconciliadas com os fluxos efetivamente adotados antes da publicação.
- Conteúdo editorial ainda não tem artigos reais.
- Arquivos de marca vetoriais oficiais e fotografia institucional real não estão disponíveis.
- Header e footer são HTML estático repetido; mudanças futuras devem ser replicadas nas nove páginas e verificadas pelo QA.

## Itens que precisam da decisão do responsável

1. Avaliação visual local.
2. Confirmar domínio/canonical de publicação e contato definitivo. Foi usado o e-mail existente no histórico e na política.
3. Revisar a política jurídica antes de publicar.
4. Fornecer conteúdo real para artigos, história, pessoas ou serviços adicionais.
5. Autorizar separadamente qualquer commit, push ou deploy.

## Referências de arquitetura e implementação

- MediCare: https://medicaregestao.com.br/ — leitura de navegação e separação das jornadas, sem copiar portfólio, texto ou interface.
- Transições nativas multipage: https://developer.chrome.com/docs/web-platform/view-transitions/cross-document — melhoria progressiva e tratamento de transição ignorada.
