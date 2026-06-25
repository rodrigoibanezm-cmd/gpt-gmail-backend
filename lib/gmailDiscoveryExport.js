import { discoveryBatch } from "./gmailDiscoveryBatch.js";

export async function exportGmailDiscovery(userId, params = {}) {
  return discoveryBatch(userId, {
    ...params,
    mode: params.mode || "thread_compact"
  });
}
