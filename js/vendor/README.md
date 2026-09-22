# Dependências da experiência da Home

Arquivos oficiais, com versões fixadas, servidos pelo próprio site. Não há dependência de CDN em tempo de execução.

| Pacote | Versão | Arquivos | Licença |
| --- | --- | --- | --- |
| Three.js | 0.180.0 | `three.module.min.js`, `three.core.min.js` | MIT; texto em `THREE-LICENSE.txt` |
| GSAP | 3.13.0 | `gsap.min.js`, `ScrollTrigger.min.js` | [Standard License](https://gsap.com/standard-license/); aviso original preservado nos arquivos |

Origem: pacotes oficiais `three@0.180.0` e `gsap@3.13.0` distribuídos por jsDelivr/npm. Não editar os bundles manualmente. Ao atualizar, repetir os testes da experiência, sobretudo o fallback e a transformação reversível.

Three.js e GSAP carregam apenas após a primeira composição HTML e somente quando a experiência é elegível. Nenhuma outra página importa estes arquivos.
