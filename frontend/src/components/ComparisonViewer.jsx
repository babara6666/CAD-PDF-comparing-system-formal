import { useState, useRef, useCallback, useEffect } from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { getImageUrl } from '../api/client';
import Controls from './Controls';
import MiniMap from './MiniMap';
import CoordinateDisplay from './CoordinateDisplay';

function ComparisonViewer({ data, onPageChange }) {
  const [layers, setLayers] = useState({
    red: true,
    green: true,
    blue: true
  });
  const [opacity, setOpacity] = useState(60);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [clickPos, setClickPos] = useState(null);
  const [viewportBounds, setViewportBounds] = useState({ x: 0, y: 0, width: 100, height: 100 });
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(null);
  
  const containerRef = useRef(null);
  const transformRef = useRef(null);

  // Reset loading state when data changes
  useEffect(() => {
    setImageLoaded(false);
    setImageError(null);
  }, [data?.images?.base]);

  const handleLayerToggle = useCallback((layer, value) => {
    setLayers(prev => ({ ...prev, [layer]: value }));
  }, []);

  const handleOpacityChange = useCallback((value) => {
    setOpacity(value);
  }, []);

  const handleMouseMove = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setMousePos({ x, y });
  }, []);

  const handleClick = useCallback((e) => {
    if (!data?.scaling_factor) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Convert to original PDF coordinates
    const originalX = Math.round(x / data.scaling_factor);
    const originalY = Math.round(y / data.scaling_factor);
    
    setClickPos({
      screen: { x: Math.round(x), y: Math.round(y) },
      original: { x: originalX, y: originalY }
    });
  }, [data?.scaling_factor]);

  const handleTransform = useCallback((ref) => {
    if (containerRef.current && ref) {
      const container = containerRef.current.getBoundingClientRect();
      const scale = ref.state.scale;
      const x = -ref.state.positionX / scale;
      const y = -ref.state.positionY / scale;
      const width = container.width / scale;
      const height = container.height / scale;
      
      setViewportBounds({ x, y, width, height });
    }
  }, []);

  const handleMiniMapClick = useCallback((percentX, percentY) => {
    if (transformRef.current) {
      transformRef.current.centerView();
    }
  }, []);

  const handleImageLoad = useCallback(() => {
    setImageLoaded(true);
    setImageError(null);
  }, []);

  const handleImageError = useCallback((e) => {
    console.error('Image load error:', e);
    setImageError('Failed to load image');
  }, []);

  // Safety check for required data
  if (!data || !data.images) {
    return (
      <div className="flex h-[calc(100vh-57px)] items-center justify-center">
        <div className="text-center">
          <span className="material-symbols-outlined text-4xl text-slate-400 mb-2">hourglass_empty</span>
          <p className="text-slate-500">Loading comparison data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-57px)] overflow-hidden">
      {/* Main Canvas Area */}
      <section className="flex-1 relative bg-slate-50 dark:bg-slate-900 bg-grid-pattern overflow-hidden" ref={containerRef}>
        {/* Viewer Header */}
        <div className="absolute top-0 left-0 right-0 z-10 bg-white/80 dark:bg-slate-800/80 backdrop-blur border-b border-slate-200 dark:border-slate-700 px-6 py-3 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-slate-500 dark:text-slate-400 text-xs uppercase font-bold tracking-wider">Comparison</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                Ready
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

        {/* Zoomable/Pannable Image Container */}
        <TransformWrapper
          ref={transformRef}
          initialScale={1}
          minScale={0.1}
          maxScale={10}
          wheel={{ step: 0.1 }}
          onTransformed={handleTransform}
        >
          {({ zoomIn, zoomOut, resetTransform, state }) => (
            <>
              <TransformComponent
                wrapperStyle={{ width: '100%', height: '100%' }}
                contentStyle={{ width: '100%', height: '100%' }}
              >
                <div 
                  className="relative inline-block viewer-canvas"
                  onMouseMove={handleMouseMove}
                  onClick={handleClick}
                  style={{ marginTop: '60px' }}
                >
                  {/* Base Image (Reference) */}
                  <img
                    src={getImageUrl(data.images.base)}
                    alt="Reference Drawing"
                    className="max-w-none"
                    draggable={false}
                    onLoad={handleImageLoad}
                    onError={handleImageError}
                  />

                  {/* Red Mask Overlay (Missing) */}
                  {layers.red && (
                    <img
                      src={getImageUrl(data.images.mask_red)}
                      alt="Missing elements"
                      className="mask-overlay"
                      style={{ opacity: opacity / 100 }}
                      draggable={false}
                    />
                  )}

                  {/* Green Mask Overlay (Added) */}
                  {layers.green && (
                    <img
                      src={getImageUrl(data.images.mask_green)}
                      alt="Added elements"
                      className="mask-overlay"
                      style={{ opacity: opacity / 100 }}
                      draggable={false}
                    />
                  )}

                  {/* Blue Mask Overlay (Modified) */}
                  {layers.blue && (
                    <img
                      src={getImageUrl(data.images.mask_blue)}
                      alt="Modified elements"
                      className="mask-overlay"
                      style={{ opacity: opacity / 100 }}
                      draggable={false}
                    />
                  )}
                </div>
              </TransformComponent>

              {/* Zoom Controls (Bottom Center) */}
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20">
                <div className="flex items-center gap-1 bg-white dark:bg-slate-800 rounded-full shadow-xl border border-slate-200 dark:border-slate-700 px-2 py-1.5">
                  <button 
                    onClick={() => zoomOut()}
                    className="p-2 text-slate-600 dark:text-slate-300 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"
                    title="Zoom Out"
                  >
                    <span className="material-symbols-outlined">remove</span>
                  </button>
                  <span className="text-sm font-bold w-14 text-center text-slate-900 dark:text-white">
                    {Math.round((state?.scale || 1) * 100)}%
                  </span>
                  <button 
                    onClick={() => zoomIn()}
                    className="p-2 text-slate-600 dark:text-slate-300 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"
                    title="Zoom In"
                  >
                    <span className="material-symbols-outlined">add</span>
                  </button>
                  <div className="w-px h-6 bg-slate-200 dark:bg-slate-600 mx-1"></div>
                  <button 
                    onClick={() => resetTransform()}
                    className="p-2 text-slate-600 dark:text-slate-300 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"
                    title="Fit to Screen"
                  >
                    <span className="material-symbols-outlined">fit_screen</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </TransformWrapper>

        {/* Coordinate Display */}
        <CoordinateDisplay 
          clickPos={clickPos} 
          scalingFactor={data.scaling_factor}
        />

        {/* MiniMap */}
        <MiniMap 
          baseImage={getImageUrl(data.images.base)}
          viewportBounds={viewportBounds}
          onNavigate={handleMiniMapClick}
        />
      </section>

      {/* Right Sidebar: Controls */}
      <Controls
        layers={layers}
        opacity={opacity}
        stats={data.stats}
        onLayerToggle={handleLayerToggle}
        onOpacityChange={handleOpacityChange}
      />
    </div>
  );
}

export default ComparisonViewer;
