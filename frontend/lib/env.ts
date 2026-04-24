// Public API URL — reached by the browser for both POST/GET/DELETE and SSE.
// Must be set on Railway to the backend's public URL, e.g.:
//   NEXT_PUBLIC_API_URL=https://backend-production-XXXX.up.railway.app
export const PUBLIC_API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
