# Docly — Scanner de Documentos

Aplicação web que transforma uma fotografia de um papel num PDF direito e legível,
ao estilo do CamScanner. **Funciona inteiramente no browser**: não há backend, nem
APIs, nem envio de imagens para servidores.

![sem backend](https://img.shields.io/badge/backend-nenhum-brightgreen) ![PWA](https://img.shields.io/badge/PWA-instal%C3%A1vel-blue)

## Como funciona

1. **Captura** — fotografia tirada com a câmara (`capture="environment"`) ou imagem
   escolhida da galeria/ficheiros (vários ficheiros de uma vez ficam em fila).
2. **Preparação** — orientação EXIF corrigida e imagem redimensionada para um
   máximo de 2000 px de lado, para não bloquear telemóveis mais modestos.
3. **Deteção dos cantos** — OpenCV.js (carregado de CDN só quando é preciso):
   escala de cinzentos → desfoque → contornos de Canny (três limiares) com fecho
   morfológico → `findContours` → `approxPolyDP` → maior quadrilátero convexo
   plausível. Se nada resultar, tenta binarização de Otsu. Se ainda assim falhar,
   mostra os cantos nas margens para ajuste manual.
4. **Ajuste manual** — quatro pontos arrastáveis (dedo, rato ou caneta, via Pointer
   Events), com lupa de ampliação e ajuste fino pelas teclas de setas.
5. **Correção de perspetiva** — homografia resolvida por eliminação de Gauss e
   reamostragem bilinear, em JavaScript puro e por blocos de linhas, para a
   interface continuar a responder. *Não depende do OpenCV.*
6. **Filtros** — Original, Melhorado, Escala de cinzentos e Preto e branco
   (limiar adaptativo). Pré-visualização instantânea; o filtro só é aplicado em
   resolução máxima ao guardar a página.
7. **PDF** — jsPDF, páginas A4 com orientação automática, imagem ajustada à
   página com margens de ~6 mm e três níveis de qualidade.
8. **Partilha** — Web Share API com ficheiros, ou descarregar + `mailto:`.

### Os filtros, em detalhe

| Filtro | O que faz |
|---|---|
| **Original** | Sem alterações, apenas perspetiva corrigida. |
| **Melhorado** | Normaliza a iluminação (estima o fundo com média de janela grande e empurra-o para branco, removendo sombras e vinhetagem), estica os níveis por canal e reforça contraste e saturação. |
| **Escala de cinzentos** | O mesmo, convertido para cinzentos. |
| **Preto e branco** | Limiar adaptativo (média local menos constante, calculada com imagem integral) — texto limpo mesmo com luz irregular. |

## Ficheiros

| Ficheiro | Papel |
|---|---|
| `index.html` | **A aplicação completa** — HTML, CSS e JavaScript num único ficheiro. Funciona sozinho. |
| `manifest.webmanifest` | Metadados da PWA (nome, ícones, cores) para instalação no ecrã inicial. |
| `sw.js` | Service worker: coloca em cache a app e as bibliotecas de CDN para funcionar offline. |
| `icons/` | Ícones PNG 192/512 px (incluindo um *maskable*). |

> O enunciado pedia um único ficheiro HTML. A aplicação **é** um único ficheiro — mas
> uma PWA instalável exige, por norma do browser, um manifest e um service worker
> servidos como ficheiros próprios do mesmo domínio (um service worker não pode ser
> registado a partir de um `blob:` ou de código embutido). Os três ficheiros extra
> são apenas isso: sem eles, `index.html` continua a funcionar na íntegra, só não
> fica instalável nem offline.

## Como alojar

Qualquer servidor de ficheiros estáticos serve. **É preciso HTTPS** (ou
`localhost`) para a câmara, o service worker e a partilha de ficheiros funcionarem.

```bash
# Local, para experimentar
npx http-server -p 8080        # http://localhost:8080

# Ou com Python
python3 -m http.server 8080
```

Para alojar: GitHub Pages, Netlify, Vercel, Cloudflare Pages ou qualquer pasta
pública num servidor com certificado — basta copiar os ficheiros tal como estão.

## Como testar no telemóvel

1. **Coloque os ficheiros num endereço HTTPS.** Em GitHub Pages: ative *Settings →
   Pages* a partir deste repositório. Sem HTTPS, o Android/iOS não dá acesso à
   câmara nem permite instalar a app.
2. **Abra o endereço no telemóvel** (Chrome no Android, Safari no iOS 16.4+).
3. **Toque em “Tirar fotografia”** e aponte ao papel: fundo contrastante com a
   folha (uma mesa escura, por exemplo), papel inteiro no enquadramento, luz o
   mais uniforme possível.
4. **Confirme os cantos.** Na primeira utilização o OpenCV.js (~10 MB) é
   descarregado — com rede fraca pode demorar; a app avisa e deixa ajustar à mão
   enquanto isso.
5. **Escolha o filtro** (“Melhorado” para cor, “Preto e branco” para texto) e
   toque em **Guardar página**.
6. **Adicione mais páginas**, reordene-as arrastando pela alça `⠿` ou com as setas.
7. **Toque em “Partilhar / Enviar por email”.** No Android/iOS abre a folha de
   partilha do sistema com o PDF já anexado (Gmail, Mail, Outlook, WhatsApp…).
8. **Instale no ecrã inicial:** Chrome → menu → *Instalar app*; Safari → *Partilhar*
   → *Adicionar ao ecrã principal*. Depois disso funciona sem rede.

### Testar no computador

Abra o endereço no browser e use **“Galeria”** para escolher uma fotografia. Os
cantos arrastam-se com o rato; as teclas de setas fazem o ajuste fino (com `Shift`,
passos maiores) e `Esc` volta atrás.

## Limitações conhecidas

- **`mailto:` não suporta anexos.** Onde a Web Share API com ficheiros não existe
  (praticamente todos os browsers de desktop, e o Firefox), a app descarrega o PDF,
  abre a mensagem já preenchida e avisa que o ficheiro tem de ser anexado à mão.
  Não há outra forma de o fazer sem servidor.
- **A Web Share API exige HTTPS e um gesto do utilizador.** O PDF começa a ser
  gerado quando a janela de partilha abre, precisamente para que o toque no botão
  chegue à `navigator.share()` sem esperas pelo meio (o iOS é rigoroso nisto).
- **OpenCV.js são ~10 MB.** Só é descarregado na primeira deteção (e pré-carregado
  em segundo plano, exceto em redes 2G ou com economia de dados); depois fica em
  cache no service worker. Sem rede na primeira utilização, a deteção automática
  não está disponível — o ajuste manual dos cantos continua a funcionar, assim como
  todo o resto, porque a correção de perspetiva e os filtros são JavaScript próprio.
- **A deteção automática não é infalível.** Falha quando o papel tem pouco
  contraste com o fundo, está dobrado, aparece cortado, ou quando há outras formas
  retangulares na imagem (tampo de mesa, teclado, outra folha). Verifique sempre os
  cantos antes de continuar.
- **HEIC/HEIF do iPhone** só abre se o browser souber descodificar o formato. O
  Safari no iOS abre; o Chrome no Android, por regra, não. Fotografias tiradas pela
  própria app vêm em JPEG e não têm este problema. Se for preciso, nas definições do
  iPhone escolha *Câmara → Formatos → Mais compatível*.
- **Resolução limitada por desenho:** origem até 2000 px de lado e resultado até
  ~3,3 megapíxeis (≈ A4 a 180 ppp). É suficiente para ler e imprimir texto, e evita
  que telemóveis com pouca memória falhem. Não serve para reproduções de arte.
- **Nada é guardado.** As páginas vivem na memória da página; se recarregar ou
  fechar o separador, perde-as (o browser avisa antes). É uma consequência da
  opção pela privacidade — não há armazenamento nem servidor.
- **A reordenação por arrasto** usa a alça `⠿`; arrastar a miniatura rola a página,
  de propósito, para não atrapalhar o gesto normal de scroll. As setas fazem o mesmo
  trabalho.
- **Sem OCR nem texto pesquisável.** O PDF contém imagens, não texto.

## Privacidade

Não existe servidor. As fotografias são descodificadas, processadas e compostas em
PDF dentro da página, em memória. As únicas ligações à rede são o download das
bibliotecas (jsPDF e OpenCV.js) dos respetivos CDNs — nunca com dados do
utilizador. O service worker guarda em cache apenas a app e essas bibliotecas,
nunca imagens nem PDFs.
