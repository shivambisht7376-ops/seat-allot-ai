/**
 * API fetch proxy configuration.
 * When deployed to Vercel, the frontend doesn't have a local backend,
 * so we proxy all /api/ calls to the Render backend defined in VITE_API_URL.
 */

const API_BASE = (import.meta as any).env?.VITE_API_URL ?? '';

export function setupFetchProxy() {
  if (!API_BASE) return;

  const originalFetch = window.fetch;

  window.fetch = async (...args) => {
    let [resource, config] = args;
    
    // If the resource is a string path that starts with /api/, prefix it
    if (typeof resource === 'string' && resource.startsWith('/api/')) {
      resource = API_BASE + resource;
    }
    
    return originalFetch(resource, config);
  };
}
