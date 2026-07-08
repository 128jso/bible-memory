const ESV_API_URL = 'https://api.esv.org/v3/passage/text/';
const ESV_API_KEY = import.meta.env.VITE_ESV_API_KEY;

export async function fetchVerse(reference: string): Promise<string | null> {
  if (!ESV_API_KEY) {
    console.error('Missing VITE_ESV_API_KEY in .env.local');
    return null;
  }

  try {
    const params = new URLSearchParams({
      q: reference,
      'include-headings': 'false',
      'include-footnotes': 'false',
      'include-verse-numbers': 'false',
      'include-short-copyright': 'false',
      'include-passage-references': 'false',
    });

    const res = await fetch(`${ESV_API_URL}?${params}`, {
      headers: {
        Authorization: `Token ${ESV_API_KEY}`,
      },
    });

    if (!res.ok) return null;

    const data = await res.json();
    const text = data.passages?.[0]
      ?.trim()
      ?.replace(/^[‘’“”"']+/, '')
      ?.replace(/[‘’“”"']+$/, '');
    return text || null;
  } catch {
    return null;
  }
}

export function getAudioUrl(reference: string): string | null {
  if (!ESV_API_KEY) return null;
  const params = new URLSearchParams({ q: reference });
  return `https://api.esv.org/v3/passage/audio/?${params}`;
}

export function getAudioHeaders(): Record<string, string> {
  return { Authorization: `Token ${ESV_API_KEY}` };
}
