# Próxima etapa: integração oficial com WhatsApp Business Platform

## Escopo atual do piloto

Este piloto mantém as conversas dentro do **simulador do CRM**. Ele não envia mensagens a números reais, não conecta QR Code, não automatiza um WhatsApp Messenger pessoal e não usa bibliotecas não oficiais. Essa escolha preserva o ambiente de teste enquanto a equipe valida a base de conhecimento, a classificação e as regras de handoff.

## Pré-requisitos para o go-live

A clínica deve ser proprietária do número empresarial, da conta do Meta Business, da conta de cobrança e das credenciais usadas pela integração. Antes do envio em produção, a equipe precisará concluir a configuração de uma conta do WhatsApp Business, registrar um número, escolher Cloud API direta ou um provedor oficial, configurar o endpoint HTTPS de webhook e guardar as chaves exclusivamente no servidor.

| Etapa | Responsável | Resultado esperado |
|---|---|---|
| Confirmar o número empresarial | Clínica | Número dedicado ou Business App elegível para a estratégia oficial definida. |
| Configurar Business Portfolio e WABA | Clínica com apoio técnico | Conta empresarial, nome de exibição e cobrança sob propriedade da clínica. |
| Configurar Cloud API ou BSP | Equipe técnica | Credenciais no servidor e URL pública de webhook validada. |
| Submeter templates | Clínica e equipe técnica | Templates de utility, marketing ou autenticação aprovados conforme o caso de uso. |
| Publicar avisos de privacidade e consentimento | Clínica e consultoria responsável | Informações claras sobre a assistente, coleta e tratamento de dados. |
| Fazer teste controlado | Equipe IGM | Grupo pequeno de contatos autorizados, monitoramento e revisão dos logs. |

## Regras que permanecerão obrigatórias

A mensagem inicial continuará apresentando a **“Assistente Virtual da IGM”**. Ao detectar pedido de falar com a doutora, informação relacionada a menor, decisão clínica ou risco, o sistema deverá registrar o motivo, criar tarefa para a equipe e manter `autoReplyBlocked = true`. Nenhuma automação posterior poderá sobrescrever esse estado; somente uma pessoa autorizada poderá assumir o atendimento por canal humano.

Os artigos da base de conhecimento devem ser revisados por uma pessoa responsável antes de receberem o status aprovado. O webhook deve registrar eventos de entrada, saída e falha, mas não deve ser usado para criar resposta clínica automática. Em produção, chaves de API, tokens de verificação e segredos devem ser configurados como variáveis de ambiente, nunca no código do cliente.

## Materiais de referência

[1]: https://developers.facebook.com/documentation/business-messaging/whatsapp/about-the-platform — **Meta, WhatsApp Business Platform: visão geral da Cloud API e dos webhooks.**

[2]: https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users — **Meta, onboarding de usuários do WhatsApp Business App e coexistência.**

[3]: https://whatsappbusiness.com/policy/ — **WhatsApp Business Messaging Policy.**

