# Logger Service (Vercel)

Endpoint receptor de erros do app Flutter.

## Endpoints
- `GET /` (home)
- `POST /api/log`
- `GET /status` (alias para `GET /api/status`)

## Variáveis de ambiente (Vercel)
- `LOGGER_TOKEN` (opcional, recomendado)
- `BLOB_READ_WRITE_TOKEN` (necessário para gravar logs no Vercel Blob)
- `LOGGER_BLOB_PREFIX` (opcional, padrão: `logs`)

## Armazenamento de logs
- Cada requisição é gravada como um blob privado (`access: private`) no Vercel Blob.
- O endpoint cria um arquivo `.json` por evento (request válida ou payload inválido).
- Estrutura padrão de caminho: `logs/YYYY-MM-DD/...`.

## Payload
O app envia JSON com campos como `timestamp`, `error`, `stackTrace`, `context`, etc.

## Integração com o app
- O app Flutter deve usar endpoint/token hardcoded (sem `--dart-define` no `flutter run`).
- Endpoint de envio: `POST /api/log`
