/**
 * Safe JSON parsing utilities to prevent syntax errors like:
 * "Unexpected token 'T', "The page c"... is not valid JSON"
 * when a server, proxy, or Cloud Run returns HTML error pages.
 */

export async function safeJsonParse<T = any>(res: Response): Promise<T> {
  let text = '';
  try {
    text = await res.text();
  } catch (err: any) {
    if (!res.ok) {
      throw new Error(`Server returned HTTP ${res.status}: ${res.statusText || 'Unable to read response'}`);
    }
    return {} as T;
  }

  if (!text || text.trim().length === 0) {
    if (!res.ok) {
      throw new Error(`Server returned HTTP ${res.status}: ${res.statusText || 'Empty error response'}`);
    }
    return {} as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    // Clean up HTML if server returned an HTML error page (e.g. "The page could not be found...")
    const clean = text
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const preview = clean.slice(0, 160);

    if (!res.ok) {
      throw new Error(
        preview
          ? `Server error (${res.status}): ${preview}`
          : `Server returned HTTP ${res.status} (${res.statusText})`
      );
    }

    throw new Error(
      preview
        ? `Unexpected non-JSON response: "${preview}"`
        : `Server returned non-JSON response (HTTP ${res.status})`
    );
  }
}

export async function safeFetchJson<T = any>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  return safeJsonParse<T>(res);
}
