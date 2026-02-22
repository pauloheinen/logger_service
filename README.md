# Meu Auditor Logger (Vercel)

API simples para receber erros do app Flutter e persistir cada evento no Vercel Blob.

## Endpoint
- `GET /` (home)
- `POST /api/log`
- `POST /api/status`

URL de produção atual:
- `https://logger-service.vercel.app/api/log`

## Fluxo
1. O app Flutter envia `POST` para `/api/log`
2. A API valida/parseia o JSON
3. A API grava o evento no Vercel Blob (store privado)
4. A API responde `200 {"ok": true}`

## Variáveis de ambiente (Vercel)
- `BLOB_READ_WRITE_TOKEN` (obrigatória para persistência no Blob)
- `LOGGER_BLOB_PREFIX` (opcional, padrão: `logs`)


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
- `400` -> JSON inválido
- `401` -> não autorizado (somente se `LOGGER_TOKEN` estiver configurado)
- `405` -> método inválido
- `500` -> falha ao persistir no Blob

## Observabilidade
- A API faz `console.log`/`console.error` no runtime da Vercel
- Use `Functions Logs` na Vercel para depuração
- Em sucesso, procure por: `[logger] blob persisted`

## Integração com o app (estado atual)
- O app envia para `https://logger-service.vercel.app/api/log`
- Envio ocorre apenas em `release` (`kReleaseMode`)
- Falha de envio é silenciosa (não trava a UI)
