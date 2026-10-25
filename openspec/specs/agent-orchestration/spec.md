# agent-orchestration Specification

## Purpose
Define como o assistente decide e executa ações para responder ao cliente: a LLM escolhe
ferramentas, a `api` as executa sob suas próprias regras, e o ciclo termina com uma resposta
dentro de limites previsíveis.

## Requirements

### Requirement: Ciclo de ferramentas
Ao gerar a resposta de uma mensagem, a `api` SHALL oferecer à LLM as ferramentas disponíveis. Quando
a LLM pedir uma ou mais ferramentas, a `api` executa cada uma, devolve os resultados à LLM e repete,
até a LLM responder com texto. Só a resposta final é guardada como mensagem do assistente.

#### Scenario: Resposta com uma ferramenta
- **WHEN** o cliente pergunta "cadê meu pedido ord_1001?" e a LLM pede `get_order` com `ord_1001`
- **THEN** a `api` executa `get_order`, devolve o resultado à LLM e guarda a resposta final da LLM

#### Scenario: Várias ferramentas em sequência
- **WHEN** a LLM pede `get_order` e, depois de receber o resultado, pede `get_payment`
- **THEN** a `api` executa as duas, na ordem, antes de guardar a resposta final

#### Scenario: Sem ferramentas
- **WHEN** a LLM responde direto com texto
- **THEN** nenhuma ferramenta é executada e o texto é guardado como resposta

### Requirement: Pedidos repetidos no mesmo passo
Quando a LLM pedir, numa mesma resposta, a mesma ferramenta com os mesmos parâmetros mais de uma vez,
a `api` SHALL executá-la uma única vez e devolver o mesmo resultado para cada pedido.

#### Scenario: Ferramenta pedida em duplicidade
- **WHEN** uma resposta da LLM pede `get_order` com `ord_1001` três vezes
- **THEN** `get_order` é executada uma vez e a LLM recebe três resultados iguais, um para cada pedido
- **AND** existe um único registro dessa execução

### Requirement: Limite de passos
O ciclo MUST parar depois de um número máximo configurável de chamadas à LLM (padrão 5). Ao
atingir o limite sem resposta final, a `api` SHALL guardar e devolver uma mensagem fixa pedindo
que o cliente reformule ou tente mais tarde.

#### Scenario: Limite atingido
- **WHEN** a LLM pede ferramentas em todas as 5 chamadas
- **THEN** a resposta é 201 com a mensagem fixa de limite e nenhuma sexta chamada é feita

### Requirement: Pedidos de ferramenta inválidos
Quando a LLM pedir uma ferramenta que não existe ou mandar parâmetros fora do schema da
ferramenta, a `api` MUST NOT executar nada e SHALL devolver à LLM um resultado de erro
explicando o problema, para que ela possa corrigir.

#### Scenario: Ferramenta inexistente
- **WHEN** a LLM pede a ferramenta `delete_order`
- **THEN** nada é executado e a LLM recebe um erro dizendo que a ferramenta não existe

#### Scenario: Parâmetro inválido
- **WHEN** a LLM pede `get_order` sem `orderId`
- **THEN** a ferramenta não é executada e a LLM recebe um erro de validação

### Requirement: Falha de ferramenta não derruba a conversa
Quando uma ferramenta falhar (por exemplo, o serviço de pedidos indisponível), a `api` SHALL devolver
à LLM um resultado de erro com uma mensagem curta, sem detalhes internos, e continuar o ciclo para
que a LLM explique a situação ao cliente.

#### Scenario: Serviço de pedidos indisponível
- **WHEN** a LLM pede `get_order` e o serviço de pedidos não responde
- **THEN** a LLM recebe um erro dizendo que o sistema de pedidos está indisponível
- **AND** a resposta da `api` é 201 com a resposta final da LLM

### Requirement: Registro das ferramentas
Cada execução de ferramenta SHALL ser registrada com conversa, nome da ferramenta, parâmetros,
resultado (`success`, `error` ou `denied`), código do erro quando houver e duração, e gerar uma linha
de log com o correlation ID. Cada chamada à LLM do ciclo continua registrada em `llm_calls`.

#### Scenario: Ferramenta executada
- **WHEN** `get_order` é executada com sucesso
- **THEN** existe um registro com a ferramenta `get_order`, os parâmetros e o resultado `success`
