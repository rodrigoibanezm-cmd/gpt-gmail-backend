function keyFor(userId) {
  return `gmail:setup:${userId}`;
}

async function kvSet(key, value) {
  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  if (!kvUrl || !kvToken) return false;

  const r = await fetch(`${kvUrl}/set/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${kvToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(value)
  });

  return r.ok;
}

async function kvGet(key) {
  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  if (!kvUrl || !kvToken) return null;

  const r = await fetch(`${kvUrl}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${kvToken}` }
  });
  if (!r.ok) return null;

  const body = await r.json().catch(() => ({}));
  return body?.result ? JSON.parse(body.result) : null;
}

function cleanArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

export async function saveSetupProfile(userId, params = {}) {
  if (!userId) return { ok: false, message: "Falta userId" };

  const current = await kvGet(keyFor(userId));
  const payload = {
    ...(current || {}),
    identity: params.identity || current?.identity || null,
    role: params.role || current?.role || null,
    pressure_areas: cleanArray(params.pressure_areas || current?.pressure_areas),
    labels: cleanArray(params.labels || current?.labels),
    rules: cleanArray(params.rules || current?.rules),
    notes: params.notes || current?.notes || null,
    updated_at: new Date().toISOString()
  };

  const ok = await kvSet(keyFor(userId), payload);
  if (!ok) return { ok: false, message: "No se pudo guardar setup" };

  return { ok: true, setup: payload };
}

export async function getSetupProfile(userId) {
  if (!userId) return { ok: false, message: "Falta userId" };
  const setup = await kvGet(keyFor(userId));
  return { ok: true, setup: setup || null };
}
