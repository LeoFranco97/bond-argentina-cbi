# Onde os leads ficam guardados

## Por que não dá para guardar no próprio site

O GitHub Pages só entrega arquivos. Ele não recebe nem grava nada. E se os leads fossem escritos em um arquivo dentro do repositório, estariam públicos, porque o repositório é público: nome, e-mail, telefone e nacionalidade de cada pessoa ficariam abertos para qualquer um na internet. Para um público que procura segundo passaporte, isso é um vazamento sério, não um detalhe.

A regra geral: tudo que a página estática consegue ler, o mundo também consegue. Senha, chave de API ou banco embutidos no HTML são públicos por definição.

## A solução

Um Cloudflare Worker, de graça, que faz duas coisas:

1. **Recebe o formulário** e grava o lead num banco de chave e valor da Cloudflare, que não tem endereço público.
2. **Serve um painel privado** em `/admin`, protegido por usuário e senha, onde só você vê os leads e baixa tudo em CSV.

A senha vive como secret do Worker, no servidor. Ela nunca aparece no site, nunca chega ao navegador do visitante e não está neste repositório.

## O que o Worker faz

| Rota | O que é |
|---|---|
| `POST /lead` | Recebe o formulário da landing page. Aceita apenas as origens listadas no topo do arquivo |
| `GET /admin` | Painel privado com a lista de leads. Pede usuário e senha |
| `GET /admin.csv` | Baixa tudo em CSV, mesma senha |

Proteções já incluídas: armadilha de robô num campo invisível, limite de cinco envios por hora por IP, validação de nome e e-mail, corte de campos muito longos, comparação de senha em tempo constante, e `noindex` no painel.

## Como subir, cerca de dez minutos

Tudo pelo painel da Cloudflare, sem instalar nada.

1. Entre em `dash.cloudflare.com`, crie a conta se ainda não tiver, e vá em **Workers & Pages**.
2. Em **KV**, crie um namespace chamado `LEADS`.
3. Crie um Worker novo (**Create** e depois **Worker**). Dê o nome `bond-leads`. Substitua todo o código de exemplo pelo conteúdo de `worker.js` e clique em **Deploy**.
4. No Worker, vá em **Settings** e depois **Bindings**. Adicione um binding de KV com o nome de variável **`LEADS`** apontando para o namespace que você criou. O nome da variável precisa ser exatamente `LEADS`.
5. Ainda em **Settings**, em **Variables and Secrets**, adicione dois secrets, do tipo Secret e não Text:
   - `ADMIN_USER`, o usuário que você quiser
   - `ADMIN_PASS`, uma senha longa e única, que não seja usada em nenhum outro lugar
6. Copie o endereço do Worker, algo como `https://bond-leads.SEU-SUBDOMINIO.workers.dev`.
7. Abra `site/index.html`, procure por `FORM_ENDPOINT` perto do fim do arquivo e coloque o endereço com `/lead` no fim:

```js
const FORM_ENDPOINT = "https://bond-leads.SEU-SUBDOMINIO.workers.dev/lead";
```

8. No mesmo arquivo, apague a linha `<meta name="robots" content="noindex,nofollow">`, que está marcada com um comentário no topo. Ela existe só para a página não ser indexada enquanto o formulário não funciona.
9. Publique: copie `site/` para `~/bond-argentina-cbi`, commite e dê push.

Seu painel passa a ser `https://bond-leads.SEU-SUBDOMINIO.workers.dev/admin`.

## Teste antes de divulgar

1. Abra a página publicada, preencha o formulário com dados de teste e envie.
2. Abra o `/admin`, confirme que o usuário e a senha são pedidos e que o lead apareceu.
3. Tente abrir o `/admin` numa janela anônima sem a senha e confirme que é barrado.

## Limites e custo

O plano grátis da Cloudflare dá 100 mil requisições por dia no Worker e 1.000 escritas por dia no KV. Para captação de leads isso é muito mais do que suficiente. Não há cartão de crédito envolvido.

## Se um dia quiser mudar

O endereço do Worker é a única coisa que a página conhece. Trocar o backend depois, por um CRM, pela Supabase ou por uma planilha, é mudar uma linha no `index.html`.

## Alternativa mais simples, se preferir não usar Cloudflare

Um Google Apps Script publicado como aplicativo web, gravando numa planilha sua. É grátis e sem limite prático, e a planilha pode ser compartilhada direto com a Bond. Perde o painel com a marca e o controle de origem, mas resolve. Me peça que eu escrevo.
