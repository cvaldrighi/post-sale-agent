# policy-ingestion Specification

## Purpose
Define como as políticas da loja entram na base de conhecimento: divididas em trechos com o contexto
da seção, transformadas em vetores e mantidas atualizadas quando o documento muda.

## Requirements

### Requirement: Ingerir um documento
O serviço SHALL aceitar `POST /documents` com `source` (identificador estável, ex.: `trocas`),
`title` e `content` em Markdown, dividir o conteúdo em trechos, gerar o embedding de cada trecho e
gravá-los, respondendo com o documento, a quantidade de trechos e se houve mudança.

#### Scenario: Documento novo
- **WHEN** a requisição envia um documento com `source` ainda não cadastrado
- **THEN** a resposta é 201 com `chunkCount` maior que zero e `changed` igual a `true`

### Requirement: Trechos pelas seções do documento
Cada trecho SHALL pertencer a uma única seção do Markdown e guardar o título do documento e o caminho
da seção (ex.: `Política de Trocas > Prazo para troca`). Seções longas são divididas em mais de um
trecho. O embedding de cada trecho MUST ser gerado com esse contexto antes do texto, para que um
trecho continue identificável quando lido sozinho.

#### Scenario: Seções separadas
- **WHEN** um documento tem as seções "Prazo para troca" e "Como solicitar"
- **THEN** nenhum trecho mistura texto das duas seções
- **AND** cada trecho informa a sua seção

### Requirement: Atualizar sem duplicar
Reingerir um `source` já cadastrado com conteúdo diferente SHALL substituir todos os trechos antigos
pelos novos, numa única operação. Reingerir com o mesmo conteúdo MUST NOT gerar novos embeddings e
responde com `changed` igual a `false`.

#### Scenario: Documento alterado
- **WHEN** um documento cadastrado é reenviado com uma seção a mais
- **THEN** a busca passa a encontrar a seção nova e não há trechos duplicados

#### Scenario: Documento igual
- **WHEN** um documento é reenviado sem alterações
- **THEN** a resposta é 200 com `changed` igual a `false` e nenhum embedding é gerado

### Requirement: Carga das políticas da loja
O serviço SHALL oferecer um comando que ingere todos os arquivos Markdown de uma pasta, usando o nome
do arquivo como `source` e o primeiro título como `title`.

#### Scenario: Carga inicial
- **WHEN** o comando é executado na pasta de políticas
- **THEN** cada arquivo vira um documento com os seus trechos
