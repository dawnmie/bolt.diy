import https from 'node:https';

let httpsAgent: https.Agent | null = null;
let nodeFetchModule: any = null;

/**
 * Creates an HTTPS agent that doesn't verify certificates
 * This is needed for Appwrite connections with custom certificates
 */
function createHttpsAgent(): https.Agent {
  if (httpsAgent) {
    return httpsAgent;
  }

  // Create agent that doesn't verify certificates
  httpsAgent = new https.Agent({
    rejectUnauthorized: false,
  });

  return httpsAgent;
}

/**
 * Custom fetch function for Appwrite that uses a non-verifying HTTPS agent
 */
export async function appwriteFetch(url: string | URL, init?: RequestInit | any): Promise<Response> {
  // Only use custom agent in Node.js environment for HTTPS URLs
  if (typeof process !== 'undefined' && process.versions?.node) {
    const urlString = typeof url === 'string' ? url : url.toString();

    if (urlString.startsWith('https://')) {
      // Dynamically import node-fetch (ESM module)
      if (!nodeFetchModule) {
        nodeFetchModule = await import('node-fetch');
      }

      const agent = createHttpsAgent();

      /*
       * Use node-fetch with the custom HTTPS agent
       * node-fetch v3 uses default export
       */
      return nodeFetchModule.default(url, {
        ...init,
        agent,
      }) as Promise<Response>;
    }
  }

  // For non-HTTPS URLs or if we're in a browser environment, use default fetch
  if (typeof fetch !== 'undefined') {
    return fetch(url, init);
  }

  // Fallback: try to use node-fetch if available
  if (typeof process !== 'undefined' && process.versions?.node) {
    if (!nodeFetchModule) {
      nodeFetchModule = await import('node-fetch');
    }

    return nodeFetchModule.default(url, init) as Promise<Response>;
  }

  throw new Error('No fetch implementation available');
}
