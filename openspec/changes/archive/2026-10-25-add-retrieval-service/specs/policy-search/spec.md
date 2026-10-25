# Spec Delta

## Purpose

Permite encontrar os trechos das políticas que respondem a uma pergunta, mesmo quando a pergunta usa
palavras diferentes das do documento, indicando de onde cada trecho veio.

## ADDED Requirements

### Requirement: Buscar trechos relevantes
O serviço SHALL responder `POST /search` com `query` (1 a 500 caracteres) e `topK` (1 a 20, padrão 5),
devolvendo até `topK` trechos do mais para o menos relevante, cada um com `chunkId`, `source`,
`documentTitle`, `section`, `text` e `score`.

#### Scenario: Pergunta sobre cancelamento
- **WHEN** a busca é "posso cancelar um pedido que está atrasado?"
- **THEN** o primeiro resultado é um trecho da política de cancelamento ou de atrasos

#### Scenario: Consulta vazia
- **WHEN** a busca tem `query` vazia
- **THEN** a resposta é 400 com `code` igual a `validation_error`

### Requirement: Busca híbrida
A relevância SHALL combinar a similaridade semântica (embeddings) com a busca por palavras (full-text
em português), unindo as duas listas por Reciprocal Rank Fusion. Um trecho encontrado por só uma das
buscas MUST continuar podendo aparecer no resultado.

#### Scenario: Termo exato
- **WHEN** a busca contém um termo exato do documento, como "Pix"
- **THEN** trechos que contêm "Pix" aparecem entre os resultados, mesmo com similaridade semântica menor

#### Scenario: Sinônimo
- **WHEN** a busca é "devolver o dinheiro" e o documento fala em "estorno"
- **THEN** o trecho sobre estorno aparece entre os resultados

### Requirement: Mesmo modelo para indexar e buscar
A busca MUST usar o mesmo modelo de embeddings usado na ingestão. Cada trecho SHALL guardar o modelo
que gerou o seu embedding, e trechos de outro modelo MUST NOT ser comparados.

#### Scenario: Troca de modelo
- **WHEN** os trechos foram gerados com `bge-m3` e o serviço passa a usar outro modelo
- **THEN** a busca semântica ignora os trechos do modelo anterior até a reingestão
