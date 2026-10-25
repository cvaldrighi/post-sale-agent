# Spec Delta

## Purpose

Ferramentas que permitem ao assistente consultar os pedidos e pagamentos do cliente autenticado,
com autorização garantida pelo código e expondo só os dados necessários para responder.

## ADDED Requirements

### Requirement: Listar os pedidos do cliente
A ferramenta `list_my_orders`, sem parâmetros, SHALL devolver os pedidos do cliente autenticado, do
mais recente para o mais antigo, com `orderId`, `status`, total e data do pedido.

#### Scenario: Cliente com pedidos
- **WHEN** a LLM pede `list_my_orders` numa conversa de `cust_001`
- **THEN** o resultado contém os pedidos de `cust_001` e nenhum de outro cliente

### Requirement: Consultar um pedido
A ferramenta `get_order`, com `orderId`, SHALL devolver status, itens, total, data do pedido,
previsão de entrega e data de entrega do pedido, se ele pertencer ao cliente autenticado.

#### Scenario: Pedido do cliente
- **WHEN** a LLM pede `get_order` com `ord_1001` numa conversa de `cust_001`
- **THEN** o resultado contém o status `delayed` e a previsão de entrega

### Requirement: Consultar o pagamento de um pedido
A ferramenta `get_payment`, com `orderId`, SHALL devolver método, status, valor pago e valor já
estornado do pagamento, se o pedido pertencer ao cliente autenticado.

#### Scenario: Pagamento do cliente
- **WHEN** a LLM pede `get_payment` com `ord_1002` numa conversa de `cust_001`
- **THEN** o resultado contém o método `credit_card` e o status `confirmed`

### Requirement: Autorização por cliente
O cliente consultado MUST ser sempre o do token, nunca um valor vindo da LLM. Um pedido de outro
cliente MUST ter o mesmo resultado de um pedido inexistente (`order_not_found`), sem revelar que existe,
e a execução é registrada com o resultado `denied`.

#### Scenario: Pedido de outro cliente
- **WHEN** a LLM pede `get_order` com `ord_2001` (de `cust_002`) numa conversa de `cust_001`
- **THEN** o resultado é o erro `order_not_found`, igual ao de um pedido inexistente
- **AND** o registro da ferramenta tem o resultado `denied`

### Requirement: Valores legíveis
Os resultados SHALL trazer os valores monetários também formatados em reais (ex.: `R$ 189,90`), além
dos centavos, para a LLM não precisar converter.

#### Scenario: Total formatado
- **WHEN** `get_order` devolve um pedido de 18990 centavos
- **THEN** o resultado contém o total `R$ 189,90`

### Requirement: Minimização de dados
Os resultados das ferramentas MUST NOT conter dados pessoais que não são necessários para responder,
como o documento (CPF) do cliente.

#### Scenario: Sem CPF
- **WHEN** `get_order` devolve um pedido
- **THEN** o resultado não contém o documento do cliente
