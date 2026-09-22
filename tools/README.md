# Prévia e validação da prova de conceito

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
```

Nesta implementação, Node 22.16.0 e playwright-core 1.55.0 foram baixados para a pasta temporária `escalare-poc-tools`, sem instalação global. Para repetir na mesma máquina enquanto esses arquivos existirem:

```powershell
$pocTools = Join-Path $env:TEMP 'escalare-poc-tools'
$env:PLAYWRIGHT_PATH = Join-Path $pocTools 'package'
& (Join-Path $pocTools 'node.exe') tools/verify-experience.cjs
```

Os testes registram estados, capturas e resultados em `output/poc-review/`, ignorado pelo Git. O cenário de biblioteca ausente provoca intencionalmente um HTTP 404 em uma página isolada para testar a recuperação.

Cobertura: cinco estados e reversão desktop, reversão mobile, pausa fora da viewport, larguras de 320 a 1440 px, mudança de breakpoint, preferência de movimento inicial e alterada em execução, ausência/perda de WebGL, dependência indisponível, JavaScript desativado, menu por teclado e smoke tests das seis páginas internas.

## Limites da medição

As medições são locais, sem simulação de conexão lenta, em Edge headless. LCP/CLS locais não equivalem a métricas de campo, Lighthouse ou testes em iPhone/Android físicos. A abertura do contexto WebGL ainda pode causar trabalho perceptível no thread principal em alguns dispositivos.

A cena mantém uma só superfície WebGL. Salas e profissionais são instâncias de geometria compartilhada. Há 12 salas no desktop e 8 no mobile, exclusivamente como representação conceitual, sem corresponder a clientes, profissionais ou escalas reais. O pixel ratio fica limitado a 1,6/1,25, e a cena só desenha quando há mudança e está visível. O mobile não usa sombras dinâmicas nem seção presa.

O fallback SVG é a apresentação inicial e definitiva em movimento reduzido, economia de dados, memória reportada inferior a 4 GB, telas muito baixas ou indisponibilidade gráfica. Esses sinais são critérios conservadores, não uma medição completa da capacidade do aparelho. A cena também reduz qualidade após renderizações persistentemente lentas e retorna ao SVG se necessário.

A Home mantém todo o conteúdo essencial em HTML; não há telemetria. O método `getOperationDiagnostics()` do elemento `[data-operation-story]` expõe apenas estado e contadores gráficos para inspeção local.
