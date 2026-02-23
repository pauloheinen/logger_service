# Meu Auditor Logger (Vercel)

API simples para receber erros do app Flutter e persistir cada evento no Vercel Blob.

## Endpoints
- `GET /` (home)
- `POST /api/log`
- `GET /api/status`

URL de produção atual:
- `https://logger-service.vercel.app/api/log`

## Status remoto por app (feature flag)
O endpoint de status aceita uma chave por query string:
- `GET /api/status?key=KEY`

A API valida a chave em allowlist no backend e retorna:
```json
{
  "ok": true,
  "enabled": true,
  "envVar": "KEY"
}
```

## Fluxo
1. O app Flutter envia `POST` para `/api/log`
2. A API valida/parseia o JSON
3. A API grava o evento no Vercel Blob (store privado)
4. A API responde `200 {"ok": true}`

## Variáveis de ambiente (Vercel)
- `BLOB_READ_WRITE_TOKEN` (obrigatória para persistência no Blob)
- `LOGGER_BLOB_PREFIX` (opcional, padrão: `logs`)
- `LOGGER_TOKEN` (opcional; se definido, exige `Authorization: Bearer <token>` no `/api/log`)
- `AUDITOR_ENABLED` (`true` ou `false`, usado pelo app Meu Auditor)

## Vercel Blob (store privado)
- A API grava usando `@vercel/blob` com `access: 'private'`
- O store pode estar configurado como `Private` (recomendado)
- O token do Blob fica apenas no servidor (`BLOB_READ_WRITE_TOKEN`), nunca no app

## Estrutura dos arquivos no Blob
Padrão atual:
- `logs/nomedoprojeto/data/context/uuid-curto.json`

Exemplo:
- `logs/meu-auditor/2026-02-22/auditoriascontroller-salvarnova/96a63b8e.json`

Origem dos segmentos:
- `nomedoprojeto` <- `payload.app`
- `context` <- `payload.context`
- ambos são sanitizados (slug) e truncados

## Payload esperado (campos principais)
O app Flutter envia JSON com campos como:
- `timestamp`
- `app`
- `platform`
- `platformVersion`
- `error`
- `stackTrace`
- `context`
- `extra`

## Respostas da API
- `200` -> log recebido e persistido
- `400` -> JSON inválido ou status key não permitida
- `401` -> não autorizado (somente se `LOGGER_TOKEN` estiver configurado em `/api/log`)
- `405` -> método inválido
- `500` -> falha ao persistir no Blob

## Observabilidade
- A API faz `console.log`/`console.error` no runtime da Vercel
- Use `Functions Logs` na Vercel para depuração
- Em sucesso, procure por: `[logger] blob persisted`

## Integração com o app (estado atual)
- O app envia erros para `https://logger-service.vercel.app/api/log`
- O app consulta status em `https://logger-service.vercel.app/api/status?key=KEY`
- Envio de erros ocorre apenas em `release` (`kReleaseMode`)
- Falha de envio é silenciosa (não trava a UI)
