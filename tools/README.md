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
`verify-resilience.cjs` cobre qualidade orientada a capacidade, orientação, viewport baixa, economia de dados, memória reportada, retorno pelo histórico, diagramas interativos e eventos controlados de visibilidade.

Cobertura da suíte original: cinco estados e reversão desktop, reversão mobile, pausa fora da viewport, larguras de 320 a 1440 px, viewport baixa, mudança de breakpoint, preferência de movimento inicial e alterada em execução, contexto WebGL2 compatível, ausência/perda de WebGL, dependência indisponível, JavaScript desativado, menu por teclado e smoke tests das oito páginas internas.

## Limites da medição

As medições são locais, sem simulação de conexão lenta, em Edge headless. LCP/CLS locais não equivalem a métricas de campo, Lighthouse ou testes em iPhone/Android físicos. A abertura do contexto WebGL ainda pode causar trabalho perceptível no thread principal em alguns dispositivos.

A cena principal mantém uma só superfície WebGL. As mesmas 12 salas e os mesmos profissionais, instanciados com geometria compartilhada, permanecem em composições amplas e compactas; são uma representação conceitual, sem corresponder a clientes, profissionais ou escalas reais. A experiência completa limita o pixel ratio a 1,6 em qualquer formato de tela e preserva sombras; o modo de compatibilidade usa pixel ratio 1 e dispensa sombras. As cenas só desenham quando há mudança e estão visíveis.

A progressão é `full → compatibility → semantic fallback`. A configuração WebGL2 completa é tentada primeiro em desktop, tablet e mobile. Apenas uma falha real de contexto, uma ressalva efetiva do driver ou custo de renderização persistentemente medido aciona uma nova tentativa compatível; o fallback semântico só entra se essa tentativa também falhar. `deviceMemory`, `saveData`, touch, user-agent, largura, altura e orientação não selecionam qualidade. Viewports menores alteram enquadramento, câmera, composição e pinning, preservando narrativa e transformações. `prefers-reduced-motion` apresenta o estado semântico final sem movimento por acessibilidade explícita.

A Home mantém todo o conteúdo essencial em HTML; não há telemetria. O método `getOperationDiagnostics()` do elemento `[data-operation-story]` expõe apenas estado e contadores gráficos para inspeção local.
