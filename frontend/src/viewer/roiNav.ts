type Roi = {
  xmin: number;
  xmax: number;
  ymin: number;
  ymax: number;
  properties?: Record<string, unknown>;
};

type Feature = {
  geometry?: {
    type?: string;
    coordinates?: any;
  };
  properties?: Record<string, unknown>;
};

type FeatureCollection = {
  features?: Feature[];
};

export function collectRois(fc: FeatureCollection): Roi[] {
  const rois: Roi[] = [];
  for (const f of fc.features || []) {
    if (f.geometry?.type === 'Polygon') {
      const ring = f.geometry.coordinates?.[0];
      if (Array.isArray(ring) && ring.length >= 4) {
        const xs = ring.map((p: [number, number]) => p[0]);
        const ys = ring.map((p: [number, number]) => p[1]);
        rois.push({
          xmin: Math.min(...xs),
          xmax: Math.max(...xs),
          ymin: Math.min(...ys),
          ymax: Math.max(...ys),
          properties: f.properties || {},
        });
      }
    }
  }
  return rois;
}

export function roiCenter(roi: Roi): { cx: number; cy: number } {
  return { cx: (roi.xmin + roi.xmax) / 2, cy: (roi.ymin + roi.ymax) / 2 };
}
