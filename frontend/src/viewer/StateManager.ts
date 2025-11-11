/**
 * StateManager - Centralized state management for the viewer
 * Manages all global state variables and provides getters/setters
gs * 
 * Note: Coordinate transformations are handled by CoordinateTransformManager
 * (see CoordinateTransformManager.ts), which manages browser zoom detection
 * and coordinate space conversions. The transform state here is updated by
 * CoordinateTransformManager.recalculateTransform().
 */

export interface ViewerState {
  // Niivue instance
  nv: any | null;
  
  // Current case/slide info
  currentSlideId: string | null;
  currentSlideUri: string | null;
  lastLoadedCase: any | null;
  
  // ROIs and layers
  rois: any[];
  layerCache: Map<string, any>;
  visibleLayers: Set<string>;
  lastBoxes: any[];
  
  // Drawing state
  isDrawing: boolean;
  drawingStart: { x: number; y: number } | null;
  drawingRect: { x: number; y: number; width: number; height: number } | null;
  userDrawnRois: any[];
  showUserDrawnRois: boolean;
  hoveredRoiIndex: number;
  
  // Image state
  currentImageFile: File | null;
  currentImageDimensions: { width: number; height: number };
  currentImageObject: HTMLImageElement | null;
  // Note: fixedCanvasPixelSize is now dynamically updated based on container size and DPR
  // It's no longer "frozen" but still used for DPR calculations during rendering
  fixedCanvasPixelSize: { width: number; height: number; logicalWidth: number; logicalHeight: number } | null;
  
  // Transform (managed by CoordinateTransformManager, which accounts for browser zoom)
  transform: { scale: number; tx: number; ty: number };
  
  // Zoom/pan
  currentZoomLevel: number;
  panX: number;
  panY: number;
  lastTouchDistance: number;
  
  // Visibility toggles
  showAIDetections: boolean;
  
  // Cache
  caseCache: Map<string, any>;
}

class StateManager {
  private state: ViewerState = {
    nv: null,
    currentSlideId: null,
    currentSlideUri: null,
    lastLoadedCase: null,
    rois: [],
    layerCache: new Map(),
    visibleLayers: new Set(),
    lastBoxes: [],
    isDrawing: false,
    drawingStart: null,
    drawingRect: null,
    userDrawnRois: [],
    showUserDrawnRois: true,
    hoveredRoiIndex: -1,
    currentImageFile: null,
    currentImageDimensions: { width: 1024, height: 1024 },
    currentImageObject: null,
    fixedCanvasPixelSize: null,
    transform: { scale: 1, tx: 0, ty: 0 },
    currentZoomLevel: 1.0,
    panX: 0,
    panY: 0,
    lastTouchDistance: 0,
    showAIDetections: true,
    caseCache: new Map(),
  };

  // Getters
  get nv() { return this.state.nv; }
  get currentSlideId() { return this.state.currentSlideId; }
  get currentSlideUri() { return this.state.currentSlideUri; }
  get lastLoadedCase() { return this.state.lastLoadedCase; }
  get rois() { return this.state.rois; }
  get layerCache() { return this.state.layerCache; }
  get visibleLayers() { return this.state.visibleLayers; }
  get lastBoxes() { return this.state.lastBoxes; }
  get isDrawing() { return this.state.isDrawing; }
  get drawingStart() { return this.state.drawingStart; }
  get drawingRect() { return this.state.drawingRect; }
  get userDrawnRois() { return this.state.userDrawnRois; }
  get showUserDrawnRois() { return this.state.showUserDrawnRois; }
  get hoveredRoiIndex() { return this.state.hoveredRoiIndex; }
  get currentImageFile() { return this.state.currentImageFile; }
  get currentImageDimensions() { return this.state.currentImageDimensions; }
  get currentImageObject() { return this.state.currentImageObject; }
  get fixedCanvasPixelSize() { return this.state.fixedCanvasPixelSize; }
  get transform() { return this.state.transform; }
  get currentZoomLevel() { return this.state.currentZoomLevel; }
  get panX() { return this.state.panX; }
  get panY() { return this.state.panY; }
  get lastTouchDistance() { return this.state.lastTouchDistance; }
  get showAIDetections() { return this.state.showAIDetections; }
  get caseCache() { return this.state.caseCache; }

  // Setters
  set nv(value) { this.state.nv = value; }
  set currentSlideId(value) { this.state.currentSlideId = value; }
  set currentSlideUri(value) { this.state.currentSlideUri = value; }
  set lastLoadedCase(value) { this.state.lastLoadedCase = value; }
  set rois(value) { this.state.rois = value; }
  set lastBoxes(value) { this.state.lastBoxes = value; }
  set isDrawing(value) { this.state.isDrawing = value; }
  set drawingStart(value) { this.state.drawingStart = value; }
  set drawingRect(value) { this.state.drawingRect = value; }
  set userDrawnRois(value) { this.state.userDrawnRois = value; }
  set showUserDrawnRois(value) { this.state.showUserDrawnRois = value; }
  set hoveredRoiIndex(value) { this.state.hoveredRoiIndex = value; }
  set currentImageFile(value) { this.state.currentImageFile = value; }
  set currentImageDimensions(value) { this.state.currentImageDimensions = value; }
  set currentImageObject(value) { this.state.currentImageObject = value; }
  set fixedCanvasPixelSize(value) { this.state.fixedCanvasPixelSize = value; }
  set currentZoomLevel(value) { this.state.currentZoomLevel = value; }
  set panX(value) { this.state.panX = value; }
  set panY(value) { this.state.panY = value; }
  set lastTouchDistance(value) { this.state.lastTouchDistance = value; }
  set showAIDetections(value) { this.state.showAIDetections = value; }

  // Reset state (for new case loading)
  reset() {
    this.state.rois = [];
    this.state.layerCache.clear();
    this.state.visibleLayers.clear();
    this.state.lastBoxes = [];
    this.state.userDrawnRois = [];
    this.state.currentImageFile = null;
    this.state.currentImageDimensions = { width: 1024, height: 1024 };
    this.state.currentImageObject = null;
    this.state.fixedCanvasPixelSize = null;
    this.state.showAIDetections = true;
    this.state.currentZoomLevel = 1.0;
    this.state.panX = 0;
    this.state.panY = 0;
    this.state.lastTouchDistance = 0;
    this.state.hoveredRoiIndex = -1;
    this.state.isDrawing = false;
    this.state.drawingStart = null;
    this.state.drawingRect = null;
    this.state.currentSlideId = null;
    this.state.currentSlideUri = null;
    this.state.transform.scale = 1;
    this.state.transform.tx = 0;
    this.state.transform.ty = 0;
  }
}

export const state = new StateManager();

