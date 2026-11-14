# LançaNota

Aplicativo para transformar notas de compra em linhas de produtos no Google Sheets. Entrada por XML de NF-e/NFC-e, QR Code ou fotos; revisão obrigatória antes do lançamento.

**Login com qualquer conta Google:** a autenticação é obrigatória por padrão. Não há lista de e-mails pré-autorizados: qualquer identidade Google com e-mail verificado pode usar o app e a planilha compartilhada de destino. O controle registra o e-mail de quem lançou cada nota. As credenciais da conta de serviço do Sheets e da OpenAI ficam apenas no servidor.

Configure `AUTH_REQUIRED=true` (ou omita a variável). Remova `AUTH_REQUIRED=false` de instalações antigas e mantenha `AUTH_SECRET` estável entre reinicializações e deploys. `ALLOWED_EMAILS` não é mais utilizado. O modo sem login só fica ativo se `AUTH_REQUIRED=false` for escolhido explicitamente para desenvolvimento local.

A sessão é mantida por cookie persistente, criptografado e HttpOnly, com duração de até **90 dias**, renovada pelo Auth.js nos acessos que atualizam a sessão. Fechar e reabrir o navegador não exige novo login enquanto o cookie for válido. Sair da conta no app, limpar cookies, usar janela anônima/outro navegador, expirar a sessão ou trocar `AUTH_SECRET` exige nova entrada. A tela de login redireciona para a página inicial quando a sessão ainda é válida.

No Google Auth Platform, configure o público do cliente como **Externo**, com os escopos básicos `openid`, `email` e `profile`. O login não solicita acesso às planilhas pessoais do usuário: a gravação usa a conta de serviço configurada no servidor. A senha da conta Google não é usada no código nem no arquivo de configuração.

## Fluxo

1. Entre com sua conta Google; nas próximas visitas, a sessão salva permite abrir diretamente.
2. Capture um QR, selecione XMLs ou adicione até seis fotos **da mesma nota**.
3. Adicione à fila e continue capturando. Uma extração é executada por vez; uma falha não bloqueia as seguintes.
4. Abra **Fila → Revisar nota**, confira os valores e corrija o que for necessário.
5. Lance na planilha. Notas possivelmente duplicadas exigem confirmação explícita.

A fila e as correções ficam no IndexedDB deste navegador, separadas por conta. Mantenha o aplicativo aberto para processar; ao reabrir ele retoma trabalhos interrompidos. O navegador pode suspender abas em segundo plano. Não é uma fila em servidor e não continua trabalhando com o navegador fechado. Apenas uma aba por conta controla a fila; as demais aguardam a primeira ser fechada. Limite de 50 notas pendentes. Limpar os dados do navegador remove a fila local.

Se a conexão cair durante o lançamento, a revisão fica protegida contra alterações até confirmar o envio anterior. A nova tentativa reutiliza o mesmo identificador e os mesmos dados para evitar duplicar uma operação já concluída.

## Planilha e configuração

Use duas abas **distintas**, com cabeçalhos na primeira linha:

**Produtos** — `SHEET_NAME=lancaNota`

```text
Mês | Dia | Nf | Fornecedor | Produto | Quant | U.M | Preço Unit | Total
```

**Controle** — `CONTROL_SHEET_NAME=_controle`

```text
Chave | Nf | Fornecedor | CNPJ | Data Emissão | Itens | Valor Total | Origem | Lançado por | Lançado em | Série | ID envio
```

Não copie os cabeçalhos de produtos para `_controle`: seus registros têm outro significado. Ao migrar da versão antiga, corrija o cabeçalho e acrescente `Série` e `ID envio` em K1 e L1, preservando as linhas existentes. Os registros antigos podem manter essas duas colunas vazias.

O aplicativo localiza as abas pelo nome configurado e cada coluna pelo cabeçalho real, tolerando maiúsculas, acentos e pontuação (`Mes`/`Mês`, `NF`/`Nf`). As colunas podem ser reordenadas dentro de A:Z. Cabeçalhos ausentes ou repetidos bloqueiam a gravação; o aplicativo não cria outra aba silenciosamente. Não use títulos ou totais acima/abaixo da tabela, nem misture outras tabelas na mesma aba: novas linhas são acrescentadas após os dados da aba.

Textos são escritos como texto literal, incluindo zeros iniciais e descrições começando por `=`. Quantidades e preços são números reais, sem dependência da configuração de vírgula/ponto da planilha.

### Valores e descontos

- `Preço Unit`: preço unitário original do produto.
- `Total`: valor do item líquido do desconto **daquele item**. No XML, `vProd - vDesc`.
- `Valor Total` no controle: total final da nota (`vNF` no XML), incluindo seus descontos e acréscimos; se não for conhecido, usa a soma dos itens.
- Frete, impostos e desconto geral não são distribuídos automaticamente pelos produtos. Divergências são mostradas na revisão; confira com a nota.
- O mês e o dia são gravados como texto com dois dígitos. O ano fica na data completa do controle.

### Gravação e repetição

Produtos, controle e marcadores do envio são gravados no mesmo `spreadsheets.batchUpdate`. Se uma operação do lote falhar, o lote não é aplicado parcialmente. IDs de intervalos nomeados (`ln_req_*` e `ln_note_*`) são criados no mesmo lote para rejeitar reenvios e colisões de identidade. **Não exclua esses intervalos nomeados**: eles fazem parte do registro de idempotência, embora apontem apenas para a célula A1 do controle.

A chave de acesso é a identificação preferencial. Sem chave, são usados fornecedor/CNPJ, número e série; identificação incompleta depende de revisão humana. A verificação também consulta os registros antigos do controle. Notas com chaves diferentes não são confundidas apenas por terem o mesmo número.

Referências: [lotes atômicos](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets/batchUpdate) e [IDs de intervalos nomeados](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets/request#AddNamedRangeRequest).

## Rodar localmente

Requer Node.js 24.

```bash
npm ci
```

Copie `.env.example` para `.env.local`, preencha as variáveis e execute:

```bash
npm run dev
npm test
npm run typecheck
npm run build
```

1. No Google Cloud, ative a **Google Sheets API**.
2. Configure um cliente OAuth Google para aplicativo Web com público Externo e callback `http://localhost:3000/api/auth/callback/google`, além do equivalente HTTPS do endereço publicado.
3. Preencha `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` e `AUTH_SECRET`. Use `AUTH_REQUIRED=true`; não existe mais lista de e-mails autorizados.
4. Crie/configure uma conta de serviço e compartilhe **apenas a planilha de destino** com seu e-mail como Editor. Preencha `GOOGLE_SERVICE_ACCOUNT_EMAIL` e `GOOGLE_PRIVATE_KEY`.
5. Preencha `SPREADSHEET_ID`, `SHEET_NAME` e `CONTROL_SHEET_NAME`. Crie as duas abas com os cabeçalhos acima.
6. Configure `OPENAI_API_KEY` e, opcionalmente, `OPENAI_MODEL` para leitura por foto e fallback de QR. A leitura de XML não depende da IA.

As credenciais ficam no servidor. Não envie `.env.local` ou JSON de conta de serviço ao GitHub.

## Publicar

Importe este repositório na Vercel como projeto Next.js, configure Node.js 24 e cadastre as variáveis de `.env.example` no ambiente de produção. Atualize o callback OAuth com o endereço HTTPS definitivo. Publicar o código no GitHub não configura automaticamente o ambiente de hospedagem.

O manifesto permite abrir o app pela tela inicial em navegadores compatíveis; câmera e Web Locks precisam de contexto seguro (HTTPS ou localhost). Não há leitura offline: a fila persiste localmente, mas as extrações dependem da conexão.

## Limitações e verificação

- A leitura por foto exige revisão, especialmente em cupons longos, descontos e texto ilegível.
- Algumas SEFAZ exigem captcha ou bloqueiam acesso automático. Use foto/XML nesses casos.
- O QR é limitado a domínios `.gov.br`, inclusive em cada redirecionamento; consultas têm limite de tempo, tamanho e redirecionamentos.
- Fotos são comprimidas e o conjunto enviado tem limite de 3,5 MB; XMLs têm limite de 2 MB.
- Os testes cobrem parsers, valores, cabeçalhos reordenados, entradas literais, fila serial, recuperação, persistência, envios concorrentes e repetição após perda de resposta. A integração com Sheets nos testes é simulada; valide uma nota conhecida no ambiente de destino antes de uso intensivo.
- O workflow do GitHub executa testes, TypeScript e build sem credenciais reais.

## Estrutura

```text
app/fila/                 Acompanhamento da fila
app/lancar/               Captura e revisão
app/api/extract/          Extração XML, QR e imagens
app/api/sheets/            Lançamento e histórico
components/QueueProvider  Fila compartilhada entre telas e bloqueio entre abas
lib/queue.ts              Processamento serial, IndexedDB e recuperação
lib/sheet-layout.ts       Mapeamento pelos cabeçalhos e células tipadas
lib/sheets.ts             Gravação atômica e idempotência
lib/extractors/           Parsers e leitura com IA
tests/                    Testes de regressão
```
