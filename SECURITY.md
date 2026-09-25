# Segurança do site estático

## Arquitetura auditada

O site é composto por HTML, CSS e JavaScript estáticos. Não há backend, autenticação, banco de dados, upload ou armazenamento de dados do formulário. O formulário de contato monta no navegador uma URL `https://wa.me/` e o envio somente acontece após uma ação explícita da pessoa no WhatsApp.

As dependências de produção estão versionadas localmente em `js/vendor/`. As únicas origens externas carregadas pelas páginas são Google Fonts; WhatsApp, telefone e e-mail são destinos acionados por links.

## Separação entre repositório e site público

O GitHub Pages continua usando a raiz do repositório como fonte Jekyll. O arquivo `_config.yml` exclui Markdown, `tools/`, `output/` e logs do artifact gerado. Assim, `AVALIACAO.md`, `SECURITY.md`, documentação de dependências e scripts de QA permanecem no repositório sem serem publicados como páginas ou arquivos públicos.

Essa correção só aparece no endereço público depois de um novo build autorizado do GitHub Pages. Até esse build, o artifact anterior pode continuar acessível; não foi feito deploy durante a implementação.

## Limite do deploy atual

O repositório está preparado para GitHub Pages. Nesse serviço, o projeto não controla headers HTTP de resposta arbitrários. Arquivos como `_headers` ou `.htaccess` não configuram CSP, `X-Content-Type-Options`, `Permissions-Policy` ou proteção de framing. A limitação é registrada pela própria comunidade do GitHub: <https://github.com/orgs/community/discussions/54257>.

Por isso, este repositório não afirma que esses headers estejam ativos. O HTML define `referrer` como `strict-origin-when-cross-origin`, que é uma proteção compatível no nível do documento. Uma meta CSP não foi adicionada: além de exigir validação cuidadosa dos scripts inline existentes, `frame-ancestors` não funciona em `<meta>` e precisa ser entregue como header HTTP: <https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/frame-ancestors>.

## Baseline para um host ou proxy com controle de headers

Se o domínio passar por um host ou proxy que permita configurar respostas, validar em ambiente de teste e então aplicar:

```text
Content-Security-Policy: default-src 'self'; script-src 'self' <hashes-dos-scripts-inline>; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
X-Frame-Options: DENY
```

Antes de ativar a CSP, os scripts inline de inicialização, JSON-LD e a lógica inline da página 404 precisam ser externalizados ou receber hashes exatos. Não substituir os hashes por `unsafe-inline` em `script-src`. O carregamento de Google Fonts, módulos ES locais, Three.js, GSAP, imagens e a navegação voluntária para WhatsApp devem ser testados após a configuração.

O GitHub Pages permite exigir HTTPS nas configurações do site. Essa opção pertence à configuração externa do repositório e deve ser confirmada pelo responsável pelo deploy: <https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https>.
