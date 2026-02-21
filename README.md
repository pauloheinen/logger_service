# Meu Auditor Logger (Vercel)

Serviço Node.js simples para receber logs de erro de apps e registrar cada request.

## Endpoint disponível
- `POST /api/log`

URL atual em produção:
- `https://logger-service.vercel.app/api/log`

## Método e resposta
- Método aceito: `POST`
- Sucesso: `200 { "ok": true }`
- Método inválido: `405`
- JSON inválido: `400`

## Autenticação no servidor
- O logger suporta token opcional via `LOGGER_TOKEN`.
- Se `LOGGER_TOKEN` estiver definido na Vercel, o servidor exige header:
  - `Authorization: Bearer <token>`

Observação importante do estado atual do app:
- O app `Meu Auditor` está configurado para enviar sem token.
- Portanto, para funcionar no estado atual, deixe `LOGGER_TOKEN` **vazio** na Vercel.

## Payload recebido (campos principais)
- `timestamp`
- `app`
- `platform`
- `platformVersion`
- `error`
- `stackTrace`
- `context`
- `extra`

## Armazenamento de logs
- Tenta gravar em `logs/requests.log` (uso local).
- Em ambiente serverless/read-only, faz fallback para `/tmp/requests.log`.

## Configuração atual no app Flutter
No estado atual do código do app:
- Endpoint está hardcoded em `https://logger-service.vercel.app/api/log`.
- Envio ocorre apenas em release (`kReleaseMode`).
- Falha no envio é silenciosa (não impacta UX).
- Timeout de request: até 2 minutos.
