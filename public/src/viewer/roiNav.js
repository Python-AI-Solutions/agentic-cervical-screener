export function collectRois(fc){
  const rois=[]; for(const f of fc.features||[]){
    if (f.geometry?.type==='Polygon'){
      const ring=f.geometry.coordinates?.[0]; if(Array.isArray(ring)&&ring.length>=4){
        const xs=ring.map(p=>p[0]), ys=ring.map(p=>p[1]);
        rois.push({ xmin:Math.min(...xs), xmax:Math.max(...xs), ymin:Math.min(...ys), ymax:Math.max(...ys), properties:f.properties||{} });
      }
    }
  } return rois;
}
export function roiCenter(roi){ return { cx:(roi.xmin+roi.xmax)/2, cy:(roi.ymin+roi.ymax)/2 }; }
