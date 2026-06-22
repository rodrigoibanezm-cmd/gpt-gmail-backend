# Legacy API endpoints

Estos endpoints fueron retirados de `/api` para no superar el límite de 12 Serverless Functions del plan Hobby de Vercel.

La fuente queda preservada en el historial Git antes de este cambio.

Commit base de referencia:

```txt
1ce790611dc90e83196e8f541ee810229c4167ac
```

Endpoints retirados:

- `api/ping.js`
- `api/drive.js`
- `api/pipedrive.js`
- `api/get-thread.js`
- `api/send-email.js`
- `api/auth-drive.js`
- `api/list-latest.js`
- `api/auth-drive-callback.js`
- `api/search-email.js`
- `api/process-attachment.js`

Endpoints activos esperados en `/api`:

- `api/auth-google.js`
- `api/auth-google-callback.js`
- `api/router.js`
