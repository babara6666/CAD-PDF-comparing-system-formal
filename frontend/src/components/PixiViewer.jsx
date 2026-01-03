import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as PIXI from 'pixi.js';
import { getImageUrl } from '../api/client';
import Controls from './Controls';
import CoordinateDisplay from './CoordinateDisplay';
import MiniMap from './MiniMap';

/**
 * PixiViewer - WebGL-accelerated viewer using PixiJS
 * Uses GPU rendering for smooth 60fps performance
 */
function PixiViewer({ data, onPageChange }) {
  const containerRef = useRef(null);
  const pixiRef = useRef({
    app: null,
    mainContainer: null,
    baseSprite: null,
    overlays: { red: null, green: null, blue: null }
  });
  
  const [layers, setLayers] = useState({ red: true, green: true, blue: true });
  const [opacity, setOpacity] = useState(60);
  const [grayscaleMode, setGrayscaleMode] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [clickPos, setClickPos] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [viewportBounds, setViewportBounds] = useState({ x: 0, y: 0, width: 100, height: 100 });

  // Get image URLs
  const imageUrls = useMemo(() => {
    if (!data?.images) return null;
    return {
      base: getImageUrl(data.images.base),
      baseGrayscale: data.images.base_grayscale 
        ? getImageUrl(data.images.base_grayscale) 
        : getImageUrl(data.images.base),
      red: getImageUrl(data.images.mask_red),
      green: getImageUrl(data.images.mask_green),
      blue: getImageUrl(data.images.mask_blue),
    };
  }, [data?.images]);

  // Update viewport bounds for MiniMap
  const updateViewportBounds = useCallback(() => {
    const { app, mainContainer, baseSprite } = pixiRef.current;
    if (!app || !mainContainer || !baseSprite) return;
    
    const vx = -mainContainer.x / (baseSprite.width * mainContainer.scale.x);
    const vy = -(mainContainer.y - 60) / (baseSprite.height * mainContainer.scale.y);
    const vw = app.screen.width / (baseSprite.width * mainContainer.scale.x);
    const vh = (app.screen.height - 60) / (baseSprite.height * mainContainer.scale.y);
    setViewportBounds({ 
      x: Math.max(0, vx * 100), 
      y: Math.max(0, vy * 100), 
      width: Math.min(100, vw * 100), 
      height: Math.min(100, vh * 100) 
    });
  }, []);

  // Initialize PixiJS (only once per data change, not on grayscale/layer changes)
  useEffect(() => {
    if (!containerRef.current || !imageUrls) return;

    const initPixi = async () => {
      // Cleanup existing
      if (pixiRef.current.app) {
        pixiRef.current.app.destroy(true, { children: true, texture: true });
        pixiRef.current = {
          app: null, mainContainer: null, baseSprite: null,
          overlays: { red: null, green: null, blue: null }
        };
      }

      setIsLoading(true);

      const app = new PIXI.Application();
      
      try {
        await app.init({
          background: '#f8fafc',
          resizeTo: containerRef.current,
          antialias: true,
          resolution: window.devicePixelRatio || 1,
          autoDensity: true,
        });

        if (!containerRef.current) return;
        containerRef.current.appendChild(app.canvas);

        // Main container for zoom/pan
        const mainContainer = new PIXI.Container();
        mainContainer.sortableChildren = true;
        app.stage.addChild(mainContainer);

        // Load base image (color version initially)
        const baseTexture = await PIXI.Assets.load(imageUrls.base);
        const baseSprite = new PIXI.Sprite(baseTexture);
        baseSprite.zIndex = 0;
        mainContainer.addChild(baseSprite);

        // Store refs
        pixiRef.current.app = app;
        pixiRef.current.mainContainer = mainContainer;
        pixiRef.current.baseSprite = baseSprite;

        // Load overlays
        const overlayConfigs = [
          { key: 'red', url: imageUrls.red, zIndex: 1 },
          { key: 'green', url: imageUrls.green, zIndex: 2 },
          { key: 'blue', url: imageUrls.blue, zIndex: 3 },
        ];

        for (const config of overlayConfigs) {
          try {
            const texture = await PIXI.Assets.load(config.url);
            const sprite = new PIXI.Sprite(texture);
            sprite.zIndex = config.zIndex;
            sprite.alpha = 0.6; // default 60%
            sprite.visible = true; // default all visible
            mainContainer.addChild(sprite);
            pixiRef.current.overlays[config.key] = sprite;
          } catch (e) { 
            console.warn(`Failed to load ${config.key}:`, e);
          }
        }

        // Center view
        const scale = Math.min(
          app.screen.width / baseSprite.width,
          (app.screen.height - 60) / baseSprite.height
        ) * 0.9;
        
        mainContainer.scale.set(scale);
        mainContainer.x = (app.screen.width - baseSprite.width * scale) / 2;
        mainContainer.y = 60 + (app.screen.height - 60 - baseSprite.height * scale) / 2;

        // Interactions
        app.stage.eventMode = 'static';
        app.stage.hitArea = app.screen;

        let isDragging = false;
        let dragStart = { x: 0, y: 0 };
        let containerStart = { x: 0, y: 0 };

        // Wheel zoom
        app.canvas.addEventListener('wheel', (e) => {
          e.preventDefault();
          const mc = pixiRef.current.mainContainer;
          if (!mc) return;
          
          const delta = e.deltaY > 0 ? 0.9 : 1.1;
          const newScale = Math.max(0.1, Math.min(10, mc.scale.x * delta));
          const mouse = { x: e.offsetX, y: e.offsetY };
          const world = {
            x: (mouse.x - mc.x) / mc.scale.x,
            y: (mouse.y - mc.y) / mc.scale.y
          };
          mc.scale.set(newScale);
          mc.x = mouse.x - world.x * newScale;
          mc.y = mouse.y - world.y * newScale;
          setZoomLevel(Math.round(newScale * 100));
          updateViewportBounds();
        }, { passive: false });

        // Drag pan
        app.stage.on('pointerdown', (e) => {
          isDragging = true;
          dragStart = { x: e.global.x, y: e.global.y };
          containerStart = { x: mainContainer.x, y: mainContainer.y };
          app.canvas.style.cursor = 'grabbing';
        });

        app.stage.on('pointermove', (e) => {
          if (!isDragging) return;
          const mc = pixiRef.current.mainContainer;
          if (!mc) return;
          mc.x = containerStart.x + (e.global.x - dragStart.x);
          mc.y = containerStart.y + (e.global.y - dragStart.y);
          updateViewportBounds();
        });

        const endDrag = () => { 
          isDragging = false; 
          if (app.canvas) app.canvas.style.cursor = 'grab'; 
        };
        app.stage.on('pointerup', endDrag);
        app.stage.on('pointerupoutside', endDrag);

        // Click for coords
        app.stage.on('click', (e) => {
          if (Math.abs(e.global.x - dragStart.x) > 5) return;
          const mc = pixiRef.current.mainContainer;
          if (!mc) return;
          const world = {
            x: (e.global.x - mc.x) / mc.scale.x,
            y: (e.global.y - mc.y) / mc.scale.y
          };
          setClickPos({
            screen: { x: Math.round(e.global.x), y: Math.round(e.global.y) },
            original: { 
              x: Math.round(world.x / data.scaling_factor), 
              y: Math.round(world.y / data.scaling_factor) 
            }
          });
        });

        app.canvas.style.cursor = 'grab';
        setIsLoading(false);
        setZoomLevel(Math.round(scale * 100));
        updateViewportBounds();
      } catch (err) {
        console.error('PixiJS init error:', err);
        setIsLoading(false);
      }
    };

    initPixi();
    
    return () => { 
      if (pixiRef.current.app) {
        pixiRef.current.app.destroy(true, { children: true, texture: true }); 
        pixiRef.current = {
          app: null, mainContainer: null, baseSprite: null,
          overlays: { red: null, green: null, blue: null }
        };
      }
    };
  }, [imageUrls?.base, data?.scaling_factor]); // Only reinit on new images, not on grayscale

  // Update overlay visibility when layers/opacity change (separate from init)
  useEffect(() => {
    const { overlays } = pixiRef.current;
    Object.entries(overlays).forEach(([key, sprite]) => {
      if (sprite) { 
        sprite.visible = layers[key]; 
        sprite.alpha = opacity / 100; 
      }
    });
  }, [layers, opacity]);

  // Handle grayscale mode change - swap base sprite texture
  useEffect(() => {
    const { baseSprite } = pixiRef.current;
    if (!baseSprite || !imageUrls) return;

    const newUrl = grayscaleMode ? imageUrls.baseGrayscale : imageUrls.base;
    
    PIXI.Assets.load(newUrl).then((texture) => {
      baseSprite.texture = texture;
    }).catch((err) => {
      console.warn('Failed to load grayscale texture:', err);
    });
  }, [grayscaleMode, imageUrls]);

  // Handlers
  const handleLayerToggle = useCallback((layer, value) => {
    setLayers(prev => ({ ...prev, [layer]: value }));
  }, []);

  const handleOpacityChange = useCallback((value) => {
    setOpacity(value);
  }, []);

  const handleZoomIn = useCallback(() => {
    const mc = pixiRef.current.mainContainer;
    if (!mc) return;
    const ns = Math.min(10, mc.scale.x * 1.3);
    mc.scale.set(ns);
    setZoomLevel(Math.round(ns * 100));
    updateViewportBounds();
  }, [updateViewportBounds]);

  const handleZoomOut = useCallback(() => {
    const mc = pixiRef.current.mainContainer;
    if (!mc) return;
    const ns = Math.max(0.1, mc.scale.x * 0.7);
    mc.scale.set(ns);
    setZoomLevel(Math.round(ns * 100));
    updateViewportBounds();
  }, [updateViewportBounds]);

  const handleResetView = useCallback(() => {
    const { app, mainContainer, baseSprite } = pixiRef.current;
    if (!app || !mainContainer || !baseSprite) return;
    
    const scale = Math.min(
      app.screen.width / baseSprite.width, 
      (app.screen.height - 60) / baseSprite.height
    ) * 0.9;
    mainContainer.scale.set(scale);
    mainContainer.x = (app.screen.width - baseSprite.width * scale) / 2;
    mainContainer.y = 60 + (app.screen.height - 60 - baseSprite.height * scale) / 2;
    setZoomLevel(Math.round(scale * 100));
    updateViewportBounds();
  }, [updateViewportBounds]);

  const handleMiniMapNavigate = useCallback((x, y) => {
    const { mainContainer, baseSprite, app } = pixiRef.current;
    if (!mainContainer || !baseSprite || !app) return;
    
    mainContainer.x = app.screen.width / 2 - x * baseSprite.width * mainContainer.scale.x;
    mainContainer.y = (app.screen.height - 60) / 2 + 60 - y * baseSprite.height * mainContainer.scale.y;
    updateViewportBounds();
  }, [updateViewportBounds]);

  if (!data || !data.images) {
    return (
      <div className="flex h-[calc(100vh-57px)] items-center justify-center">
        <p className="text-slate-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-57px)] overflow-hidden">
      <section className="flex-1 relative bg-slate-50 dark:bg-slate-900 overflow-hidden">
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-10 bg-white/80 dark:bg-slate-800/80 backdrop-blur border-b border-slate-200 dark:border-slate-700 px-6 py-3 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-slate-500 text-xs uppercase font-bold">WebGL Viewer</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700">GPU</span>
            </div>
            <p className="text-slate-900 dark:text-white text-lg font-bold">
              {data.files?.reference || 'Reference'} 
              <span className="text-slate-400 mx-2">vs</span> 
              {data.files?.target || 'Target'}
            </p>
          </div>
          {data.total_pages > 1 && (
            <div className="flex items-center gap-2">
              <button 
                onClick={() => onPageChange(data.current_page - 1)} 
                disabled={data.current_page === 0} 
                className="p-2 rounded-lg bg-slate-100 dark:bg-slate-700 disabled:opacity-50"
              >
                <span className="material-symbols-outlined">chevron_left</span>
              </button>
              <span className="text-sm px-3">
                Page {data.current_page + 1} / {data.total_pages}
              </span>
              <button 
                onClick={() => onPageChange(data.current_page + 1)} 
                disabled={data.current_page >= data.total_pages - 1} 
                className="p-2 rounded-lg bg-slate-100 dark:bg-slate-700 disabled:opacity-50"
              >
                <span className="material-symbols-outlined">chevron_right</span>
              </button>
            </div>
          )}
        </div>

        {/* PixiJS Container */}
        <div ref={containerRef} className="absolute inset-0" style={{ paddingTop: '60px' }} />

        {/* Loading */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-20">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}

        {/* Zoom Controls */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20">
          <div className="flex items-center gap-1 bg-white dark:bg-slate-800 rounded-full shadow-xl border border-slate-200 dark:border-slate-700 px-2 py-1.5">
            <button onClick={handleZoomOut} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full">
              <span className="material-symbols-outlined">remove</span>
            </button>
            <span className="text-sm font-bold w-14 text-center">{zoomLevel}%</span>
            <button onClick={handleZoomIn} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full">
              <span className="material-symbols-outlined">add</span>
            </button>
            <div className="w-px h-6 bg-slate-200 dark:bg-slate-600 mx-1"></div>
            <button onClick={handleResetView} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full">
              <span className="material-symbols-outlined">fit_screen</span>
            </button>
          </div>
        </div>

        {/* Coordinate Display */}
        <CoordinateDisplay clickPos={clickPos} scalingFactor={data.scaling_factor} />

        {/* MiniMap */}
        <MiniMap 
          baseImage={imageUrls.base}
          viewportBounds={viewportBounds}
          onNavigate={handleMiniMapNavigate}
        />
      </section>

      {/* Controls Sidebar */}
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

export default PixiViewer;
