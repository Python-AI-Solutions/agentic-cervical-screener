type EnvConfig = {
  API_BASE?: string | null;
};

export type ClassificationBox = {
  x: number;
  y: number;
  w: number;
  h: number;
  label?: string;
  score?: number;
  [key: string]: unknown;
};

export type ClassificationResponse = {
  slide_id: string;
  boxes: ClassificationBox[];
};

const ENV: EnvConfig =
  (window as unknown as { __ENV__?: EnvConfig }).__ENV__ ?? {};
const API_BASE = ENV.API_BASE ?? '';
const useMock = ENV.API_BASE === null || ENV.API_BASE === undefined;

export async function classify(
  slideId = 'SLIDE-001',
  imageUri: string | null = null,
  imageData: File | Blob | null = null
): Promise<ClassificationResponse> {
  if (useMock) {
    const response = await fetch(`${API_BASE}/mock/classify.json`, {
      cache: 'no-store',
    });
    if (!response.ok) {
      throw new Error('mock classify failed');
    }
    return response.json();
  }

  if (imageData) {
    const formData = new FormData();
    formData.append('file', imageData);
    formData.append('conf_threshold', '0.25');

    const response = await fetch(`${API_BASE}/v1/classify-upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(
        `classify upload failed ${response.status} ${errorText}`.trim()
      );
    }
    const result = (await response.json()) as ClassificationResponse;
    return {
      slide_id: slideId,
      boxes: result.boxes ?? [],
    };
  }

  const payload: Record<string, unknown> = { slide_id: slideId };
  if (imageUri) {
    payload.image_uri = imageUri;
  }
  const response = await fetch(`${API_BASE}/v1/classify`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(
      `classify failed ${response.status} ${errorText}`.trim()
    );
  }
  return response.json();
}
