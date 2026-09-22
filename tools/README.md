# Prévia e validação do site institucional

O site continua sendo HTML/CSS/JavaScript estático. Node e Playwright são usados somente para desenvolvimento e testes; não fazem parte do deploy.

## Prévia

Com Node instalado:

```powershell
node tools/preview.cjs
```

Abra `http://127.0.0.1:4173/escalare-site/`. O prefixo reproduz os caminhos do GitHub Pages. Não abra o HTML diretamente por `file://`, pois a experiência usa módulos JavaScript.

## Testes

Os scripts usam `playwright-core` e um navegador Edge local. O pacote pode estar instalado fora do projeto: defina `PLAYWRIGHT_PATH` com o caminho absoluto da pasta do pacote. Opcionalmente, `BROWSER_PATH` permite escolher outro executável Chromium.

```powershell
node tools/verify-experience.cjs
node tools/measure-experience.cjs
node tools/review-site.cjs
node tools/audit-accessibility.cjs
node tools/verify-resilience.cjs
```

Os testes registram estados, capturas e resultados em `output/poc-review/`, ignorado pelo Git. O cenário de biblioteca ausente provoca intencionalmente um HTTP 404 em uma página isolada para testar a recuperação.

Nesta evolução, Playwright e axe-core estão isolados em `output/poc-tools/node_modules/`, sem dependência de produção. Para repetir nesta máquina:

```powershell
$env:PLAYWRIGHT_PATH = (Resolve-Path 'output/poc-tools/node_modules/playwright-core').Path
node tools/verify-experience.cjs
node tools/review-site.cjs
node tools/verify-resilience.cjs
node tools/audit-accessibility.cjs
node tools/measure-experience.cjs
```

`review-site.cjs` cobre as nove páginas, links e âncoras, larguras de 360 a 1920, preparação de mensagem sem envio, foco do menu, histórico e 404. Também rasteriza o SVG autoral de Open Graph para PNG.
`audit-accessibility.cjs` verifica WCAG A/AA com axe-core; resultados incompletos exigem avaliação humana, especialmente textos sobre SVG/fundos gráficos.
`verify-resilience.cjs` cobre níveis de qualidade, orientação, viewport baixa, economia de dados, memória limitada, retorno pelo histórico, diagrama interativo e eventos controlados de visibilidade.

Cobertura da suíte original: cinco estados e reversão desktop, reversão mobile, pausa fora da viewport, larguras de 320 a 1440 px, viewport baixa, mudança de breakpoint, preferência de movimento inicial e alterada em execução, contexto WebGL2 compatível, ausência/perda de WebGL, dependência indisponível, JavaScript desativado, menu por teclado e smoke tests das oito páginas internas.

## Limites da medição

As medições são locais, sem simulação de conexão lenta, em Edge headless. LCP/CLS locais não equivalem a métricas de campo, Lighthouse ou testes em iPhone/Android físicos. A abertura do contexto WebGL ainda pode causar trabalho perceptível no thread principal em alguns dispositivos.

A cena mantém uma só superfície WebGL. Salas e profissionais são instâncias de geometria compartilhada. Há 12 salas no desktop e 8 no mobile, exclusivamente como representação conceitual, sem corresponder a clientes, profissionais ou escalas reais. O pixel ratio fica limitado a 1,6 no desktop, 1,35 no tablet, 1,25 no mobile e 1 no modo simplificado. A cena só desenha quando há mudança e está visível. Tablet, mobile e modo simplificado não usam sombras dinâmicas; mobile não usa seção presa.

O fallback SVG é a apresentação inicial e definitiva em movimento reduzido ou indisponibilidade gráfica real. Economia de dados, memória reportada inferior a 4 GB e um contexto recusado com `failIfMajorPerformanceCaveat` selecionam uma experiência WebGL2 simplificada, com pixel ratio menor e sem sombras dinâmicas. Viewports baixas adaptam a composição sem desligar a experiência. A cena também reduz qualidade após renderizações persistentemente lentas e retorna ao SVG se necessário.

A Home mantém todo o conteúdo essencial em HTML; não há telemetria. O método `getOperationDiagnostics()` do elemento `[data-operation-story]` expõe apenas estado e contadores gráficos para inspeção local.
