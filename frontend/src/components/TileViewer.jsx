import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import OpenSeadragon from 'openseadragon';
import { getImageUrl } from '../api/client';
import Controls from './Controls';
import CoordinateDisplay from './CoordinateDisplay';

/**
 * TileViewer - High-performance tile-based viewer using OpenSeadragon
 * 
 * Provides 60fps pan/zoom even for complex CAD PDFs by loading only
 * visible tiles (Google Maps-style rendering).
 */
function TileViewer({ data, onPageChange }) {
  const viewerRef = useRef(null);
  const osdRef = useRef(null);
  const overlayImagesRef = useRef({});
  
  const [layers, setLayers] = useState({
    red: true,
    green: true,
    blue: true
  });
  const [opacity, setOpacity] = useState(60);
  const [grayscaleMode, setGrayscaleMode] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [clickPos, setClickPos] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Memoize overlay URLs
  const overlayUrls = useMemo(() => {
    if (!data?.overlays) return null;
    return {
      red: getImageUrl(data.overlays.mask_red),
      green: getImageUrl(data.overlays.mask_green),
      blue: getImageUrl(data.overlays.mask_blue),
    };
  }, [data?.overlays]);

  // Initialize OpenSeadragon
  useEffect(() => {
    if (!viewerRef.current || !data?.tiles?.dzi_url) return;

    const dziUrl = getImageUrl(data.tiles.dzi_url);
    
    // Destroy existing viewer
    if (osdRef.current) {
      osdRef.current.destroy();
    }

    // Create new viewer
    osdRef.current = OpenSeadragon({
      element: viewerRef.current,
      tileSources: dziUrl,
      
      // Performance settings
      prefixUrl: 'https://cdn.jsdelivr.net/npm/openseadragon@4.1/build/openseadragon/images/',
      animationTime: 0.3,
      springStiffness: 15,
      immediateRender: false,
      imageLoaderLimit: 5,
      maxImageCacheCount: 200,
      
      // UI controls
      showNavigator: true,
      navigatorPosition: 'BOTTOM_RIGHT',
      navigatorAutoFade: false,
      showNavigationControl: false, // We use custom controls
      showFullPageControl: false,
      
      // Interaction
      gestureSettingsMouse: {
        clickToZoom: false,
        dblClickToZoom: true,
        pinchToZoom: true,
        flickEnabled: true
      },
      gestureSettingsTouch: {
        clickToZoom: false,
        dblClickToZoom: true,
        pinchToZoom: true,
        flickEnabled: true
      },
      
      // Zoom constraints
      minZoomLevel: 0.5,
      maxZoomLevel: 10,
      visibilityRatio: 0.5,
      constrainDuringPan: true,
      
      // Debug
      debugMode: false
    });

    const viewer = osdRef.current;

    // Event handlers
    viewer.addHandler('open', () => {
      setIsLoading(false);
      console.log('[TileViewer] Tiles loaded successfully');
      
      // Add overlay images for heatmap
      if (overlayUrls) {
        addOverlayImages(viewer, overlayUrls, data.tiles.width, data.tiles.height);
      }
    });

    viewer.addHandler('open-failed', (event) => {
      console.error('[TileViewer] Failed to load tiles:', event);
      setIsLoading(false);
    });

    viewer.addHandler('zoom', (event) => {
      const zoom = event.zoom;
      setZoomLevel(Math.round(zoom * 100));
    });

    viewer.addHandler('canvas-click', (event) => {
      if (!event.quick) return; // Ignore drag-clicks
      
      const viewportPoint = viewer.viewport.pointFromPixel(event.position);
      const imagePoint = viewer.viewport.viewportToImageCoordinates(viewportPoint);
      
      setClickPos({
        screen: { 
          x: Math.round(event.position.x), 
          y: Math.round(event.position.y) 
        },
        original: { 
          x: Math.round(imagePoint.x / data.scaling_factor),
          y: Math.round(imagePoint.y / data.scaling_factor)
        }
      });
    });

    return () => {
      viewer.destroy();
      osdRef.current = null;
    };
  }, [data?.tiles?.dzi_url]);

  // Add overlay images for heatmap masks
  const addOverlayImages = useCallback((viewer, urls, width, height) => {
    const bounds = new OpenSeadragon.Rect(0, 0, 1, height / width);
    
    // Add each mask as an overlay
    ['red', 'green', 'blue'].forEach((color, index) => {
      if (!urls[color]) return;
      
      viewer.addSimpleImage({
        url: urls[color],
        opacity: opacity / 100,
        success: (event) => {
          overlayImagesRef.current[color] = event.item;
          console.log(`[TileViewer] ${color} overlay loaded`);
        },
        error: (event) => {
          console.error(`[TileViewer] Failed to load ${color} overlay:`, event);
        }
      });
    });
  }, [opacity]);

  // Update overlay visibility when layers toggle
  useEffect(() => {
    const viewer = osdRef.current;
    if (!viewer?.world) return;

    // Get overlay items (indices 1, 2, 3 - base image is 0)
    const world = viewer.world;
    if (world.getItemCount() < 2) return;

    // Update visibility for each overlay
    ['red', 'green', 'blue'].forEach((color, index) => {
      const item = overlayImagesRef.current[color];
      if (item) {
        const shouldShow = layers[color];
        item.setOpacity(shouldShow ? opacity / 100 : 0);
      }
    });
  }, [layers, opacity]);

  // Handlers
  const handleLayerToggle = useCallback((layer, value) => {
    setLayers(prev => ({ ...prev, [layer]: value }));
  }, []);

  const handleOpacityChange = useCallback((value) => {
    setOpacity(value);
    
    // Update all overlays
    Object.values(overlayImagesRef.current).forEach(item => {
      if (item) {
        item.setOpacity(value / 100);
      }
    });
  }, []);

  const handleZoomIn = useCallback(() => {
    osdRef.current?.viewport.zoomBy(1.5);
  }, []);

  const handleZoomOut = useCallback(() => {
    osdRef.current?.viewport.zoomBy(0.67);
  }, []);

  const handleResetView = useCallback(() => {
    osdRef.current?.viewport.goHome();
  }, []);

  // Safety check
  if (!data || !data.tiles) {
    return (
      <div className="flex h-[calc(100vh-57px)] items-center justify-center">
        <div className="text-center">
          <span className="material-symbols-outlined text-4xl text-slate-400 mb-2">hourglass_empty</span>
          <p className="text-slate-500">Loading tile data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-57px)] overflow-hidden">
      {/* Main Canvas Area */}
      <section className="flex-1 relative bg-slate-50 dark:bg-slate-900 overflow-hidden">
        {/* Viewer Header */}
        <div className="absolute top-0 left-0 right-0 z-10 bg-white/80 dark:bg-slate-800/80 backdrop-blur border-b border-slate-200 dark:border-slate-700 px-6 py-3 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-slate-500 dark:text-slate-400 text-xs uppercase font-bold tracking-wider">Tile Viewer</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                60fps
              </span>
            </div>
            <p className="text-slate-900 dark:text-white tracking-tight text-lg font-bold leading-tight">
              {data.files?.reference || 'Reference'} 
              <span className="text-slate-400 mx-2 font-light">vs</span> 
              {data.files?.target || 'Target'}
            </p>
          </div>

          {/* Page Navigation */}
          {data.total_pages > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => onPageChange(data.current_page - 1)}
                disabled={data.current_page === 0}
                className="page-nav-btn p-2 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600"
              >
                <span className="material-symbols-outlined">chevron_left</span>
              </button>
              <span className="text-sm font-medium px-3">
                Page {data.current_page + 1} of {data.total_pages}
              </span>
              <button
                onClick={() => onPageChange(data.current_page + 1)}
                disabled={data.current_page >= data.total_pages - 1}
                className="page-nav-btn p-2 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600"
              >
                <span className="material-symbols-outlined">chevron_right</span>
              </button>
            </div>
          )}
        </div>

        {/* OpenSeadragon Container */}
        <div 
          ref={viewerRef} 
          className="absolute inset-0 pt-[60px]"
          style={{ background: '#f8fafc' }}
        />

        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-slate-900/80 z-20">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-slate-600 dark:text-slate-400">Generating tiles...</p>
            </div>
          </div>
        )}

        {/* Zoom Controls (Bottom Center) */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20">
          <div className="flex items-center gap-1 bg-white dark:bg-slate-800 rounded-full shadow-xl border border-slate-200 dark:border-slate-700 px-2 py-1.5">
            <button 
              onClick={handleZoomOut}
              className="p-2 text-slate-600 dark:text-slate-300 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"
              title="Zoom Out"
            >
              <span className="material-symbols-outlined">remove</span>
            </button>
            <span className="text-sm font-bold w-14 text-center text-slate-900 dark:text-white">
              {zoomLevel}%
            </span>
            <button 
              onClick={handleZoomIn}
              className="p-2 text-slate-600 dark:text-slate-300 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"
              title="Zoom In"
            >
              <span className="material-symbols-outlined">add</span>
            </button>
            <div className="w-px h-6 bg-slate-200 dark:bg-slate-600 mx-1"></div>
            <button 
              onClick={handleResetView}
              className="p-2 text-slate-600 dark:text-slate-300 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"
              title="Fit to Screen"
            >
              <span className="material-symbols-outlined">fit_screen</span>
            </button>
          </div>
        </div>

        {/* Coordinate Display */}
        <CoordinateDisplay 
          clickPos={clickPos} 
          scalingFactor={data.scaling_factor}
        />
      </section>

      {/* Right Sidebar: Controls */}
      <Controls
        layers={layers}
        opacity={opacity}
        stats={data.stats}
        grayscaleMode={grayscaleMode}
        onLayerToggle={handleLayerToggle}
        onOpacityChange={handleOpacityChange}
        onGrayscaleToggle={setGrayscaleMode}
      />
    </div>
  );
}

export default TileViewer;
