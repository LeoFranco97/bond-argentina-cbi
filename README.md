# Landing page: Argentina CBI, Bond and Partners

Página única em inglês. HTML, CSS e JavaScript próprios, sem framework e sem build. Para publicar, basta subir a pasta `site/` inteira.

## Arquivos

```
site/
  index.html                  a página inteira, com CSS e JS embutidos
  assets/logo-bond-white.png  logotipo oficial para fundo escuro
  assets/logo-bond-navy.png   logotipo para fundo claro, não usado nesta página
  assets/logo-bond-white-opt.png  versão reduzida, reserva
```

As duas fotografias vêm do Unsplash por URL direta, então não há arquivo de imagem para subir. Se preferir hospedar as fotos no próprio domínio, baixe as duas URLs que aparecem no HTML e troque o `src`.

## Ligar o formulário, a única coisa que falta

Abra `index.html`, procure por `FORM_ENDPOINT` perto do fim do arquivo e coloque o endereço entre as aspas:

```js
const FORM_ENDPOINT = "https://formspree.io/f/SEUCODIGO";
```

Enquanto estiver vazio, o formulário valida, mostra a confirmação e não envia nada para lugar nenhum, o que é útil para demonstrar sem gerar lead falso.

O envio é um POST com JSON contendo: `name`, `email`, `phone`, `citizenship`, `who`, `route`, `timing`, `notes`, mais `page` e `submitted_at`. Funciona com Formspree, Basin, Getform, Make, Zapier ou qualquer webhook.

## Onde hospedar

Qualquer hospedagem estática serve: Netlify, Vercel, Cloudflare Pages, GitHub Pages. Arraste a pasta `site/` e pronto. Se usar Netlify Forms, troque o JavaScript do envio pelo atributo `netlify` no formulário.

## Como testar localmente

O Python do sistema não consegue ler o iCloud nesta máquina, então copie a pasta para fora antes:

```bash
cp -R site /tmp/bond-site && cd /tmp/bond-site && python3 -m http.server 8731
```

Depois abra `http://localhost:8731`. Abrir o `index.html` direto com dois cliques também funciona, mas o logotipo não carrega, porque o navegador bloqueia arquivo local referenciado por caminho relativo.

## Decisões técnicas que vale conhecer

- **Funciona sem JavaScript.** O conteúdo todo aparece, o FAQ abre e fecha pelo elemento nativo `details`, e o formulário continua submetendo. O JavaScript melhora a experiência, não a habilita.
- **Animações respeitam `prefers-reduced-motion`.** Quem pede menos movimento no sistema recebe a página estática.
- **A classe que esconde elementos antes da animação só é aplicada se o JavaScript rodar**, para nunca sobrar conteúdo invisível esperando uma animação que não vai acontecer.
- **A barra fixa** aparece depois da seção de valores e some quando o formulário entra em tela, para não cobrir o próprio formulário.
- **Tipografia** Outfit nos títulos e Inter no texto, ambas do Google Fonts. Outfit foi escolhida por ser geométrica de O circular, que é a construção do logotipo da Bond.
- **Cores** ficam todas em variáveis CSS no topo do arquivo, no bloco `:root`. Para mudar o dourado ou o navy da página inteira, troque ali.

## Antes de colocar no ar

1. Ligar o `FORM_ENDPOINT`.
2. Confirmar com a Bond se os números do programa podem ser publicados como estão. Eles vêm do anúncio de 02/10/2026 e estão documentados em `../pesquisa/dossie-fatos.md`.
3. Decidir se entram telefone, endereço e redes sociais no rodapé.
4. Revisar a data "Last reviewed 3 October 2026" no rodapé e a data na tarja de status do hero. As duas precisam ser atualizadas sempre que o status do programa mudar.
5. Conferir se a licença das fotos do Unsplash atende ao uso comercial pretendido.
