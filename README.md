# Logger Service (Vercel)

Endpoint receptor de erros do app Flutter.

## Endpoint
- `POST /api/log`

## Variáveis de ambiente (Vercel)
- `LOGGER_TOKEN` (opcional, recomendado)

## Payload
O app envia JSON com campos como `timestamp`, `error`, `stackTrace`, `context`, etc.

## Observação de filesystem na Vercel
- O arquivo `logs/requests.log` existe no repositório para desenvolvimento local.
- Em runtime serverless, o filesystem do projeto costuma ser somente leitura.
- Nessa situação, o endpoint tenta gravar em `/tmp/requests.log`.

## Como apontar o app
Exemplo:
```bash
flutter run \
  --dart-define=ERROR_LOG_ENDPOINT=https://SEU-PROJETO.vercel.app/api/log \
  --dart-define=ERROR_LOG_TOKEN=SEU_TOKEN
```
