import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as PIXI from 'pixi.js';
import { getImageUrl } from '../api/client';
import Controls from './Controls';
import CoordinateDisplay from './CoordinateDisplay';

/**
 * PixiViewer - WebGL-accelerated viewer using PixiJS
 * Uses GPU rendering for smooth 60fps performance
 */
function PixiViewer({ data, onPageChange }) {
  const containerRef = useRef(null);
  const appRef = useRef(null);
  const baseImageRef = useRef(null);
  const overlaysRef = useRef({ red: null, green: null, blue: null });
  
  const [layers, setLayers] = useState({ red: true, green: true, blue: true });
  const [opacity, setOpacity] = useState(60);
  const [grayscaleMode, setGrayscaleMode] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [clickPos, setClickPos] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

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

  // Initialize PixiJS
  useEffect(() => {
    if (!containerRef.current || !imageUrls) return;

    // Cleanup existing
    if (appRef.current) {
      appRef.current.destroy(true, { children: true, texture: true });
    }

    const app = new PIXI.Application();
    
    const initPixi = async () => {
      await app.init({
        background: '#f8fafc',
        resizeTo: containerRef.current,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });

      containerRef.current.appendChild(app.canvas);
      appRef.current = app;

      // Main container for zoom/pan
      const mainContainer = new PIXI.Container();
      mainContainer.sortableChildren = true;
      app.stage.addChild(mainContainer);

      // Load base image
      const baseUrl = grayscaleMode ? imageUrls.baseGrayscale : imageUrls.base;
      const baseTexture = await PIXI.Assets.load(baseUrl);
      const baseSprite = new PIXI.Sprite(baseTexture);
      baseSprite.zIndex = 0;
      mainContainer.addChild(baseSprite);
      baseImageRef.current = baseSprite;

      // Load overlays
      for (const [key, url] of [['red', imageUrls.red], ['green', imageUrls.green], ['blue', imageUrls.blue]]) {
        try {
          const texture = await PIXI.Assets.load(url);
          const sprite = new PIXI.Sprite(texture);
          sprite.zIndex = key === 'red' ? 1 : key === 'green' ? 2 : 3;
          sprite.alpha = opacity / 100;
          sprite.visible = layers[key];
          mainContainer.addChild(sprite);
          overlaysRef.current[key] = sprite;
        } catch (e) { console.warn(`Failed to load ${key}:`, e); }
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
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newScale = Math.max(0.1, Math.min(10, mainContainer.scale.x * delta));
        const mouse = { x: e.offsetX, y: e.offsetY };
        const world = {
          x: (mouse.x - mainContainer.x) / mainContainer.scale.x,
          y: (mouse.y - mainContainer.y) / mainContainer.scale.y
        };
        mainContainer.scale.set(newScale);
        mainContainer.x = mouse.x - world.x * newScale;
        mainContainer.y = mouse.y - world.y * newScale;
        setZoomLevel(Math.round(newScale * 100));
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
        mainContainer.x = containerStart.x + (e.global.x - dragStart.x);
        mainContainer.y = containerStart.y + (e.global.y - dragStart.y);
      });

      const endDrag = () => { isDragging = false; app.canvas.style.cursor = 'grab'; };
      app.stage.on('pointerup', endDrag);
      app.stage.on('pointerupoutside', endDrag);

      // Click for coords
      app.stage.on('click', (e) => {
        if (Math.abs(e.global.x - dragStart.x) > 5) return;
        const world = {
          x: (e.global.x - mainContainer.x) / mainContainer.scale.x,
          y: (e.global.y - mainContainer.y) / mainContainer.scale.y
        };
        setClickPos({
          screen: { x: Math.round(e.global.x), y: Math.round(e.global.y) },
          original: { x: Math.round(world.x / data.scaling_factor), y: Math.round(world.y / data.scaling_factor) }
        });
      });

      app.canvas.style.cursor = 'grab';
      setIsLoading(false);
      setZoomLevel(Math.round(scale * 100));
    };

    initPixi();
    return () => { appRef.current?.destroy(true, { children: true, texture: true }); appRef.current = null; };
  }, [imageUrls?.base, grayscaleMode]);

  // Update overlay visibility
  useEffect(() => {
    Object.entries(overlaysRef.current).forEach(([key, sprite]) => {
      if (sprite) { sprite.visible = layers[key]; sprite.alpha = opacity / 100; }
    });
  }, [layers, opacity]);

  const handleLayerToggle = useCallback((layer, value) => setLayers(prev => ({ ...prev, [layer]: value })), []);
  const handleOpacityChange = useCallback((value) => setOpacity(value), []);

  const handleZoomIn = useCallback(() => {
    if (!appRef.current) return;
    const mc = appRef.current.stage.children[0];
    const ns = Math.min(10, mc.scale.x * 1.3);
    mc.scale.set(ns);
    setZoomLevel(Math.round(ns * 100));
  }, []);

  const handleZoomOut = useCallback(() => {
    if (!appRef.current) return;
    const mc = appRef.current.stage.children[0];
    const ns = Math.max(0.1, mc.scale.x * 0.7);
    mc.scale.set(ns);
    setZoomLevel(Math.round(ns * 100));
  }, []);

  const handleResetView = useCallback(() => {
    if (!appRef.current || !baseImageRef.current) return;
    const app = appRef.current, mc = app.stage.children[0], bs = baseImageRef.current;
    const scale = Math.min(app.screen.width / bs.width, (app.screen.height - 60) / bs.height) * 0.9;
    mc.scale.set(scale);
    mc.x = (app.screen.width - bs.width * scale) / 2;
    mc.y = 60 + (app.screen.height - 60 - bs.height * scale) / 2;
    setZoomLevel(Math.round(scale * 100));
  }, []);

  if (!data || !data.images) {
    return <div className="flex h-[calc(100vh-57px)] items-center justify-center"><p className="text-slate-500">Loading...</p></div>;
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
              {data.files?.reference || 'Reference'} <span className="text-slate-400 mx-2">vs</span> {data.files?.target || 'Target'}
            </p>
          </div>
          {data.total_pages > 1 && (
            <div className="flex items-center gap-2">
              <button onClick={() => onPageChange(data.current_page - 1)} disabled={data.current_page === 0} className="p-2 rounded-lg bg-slate-100 disabled:opacity-50"><span className="material-symbols-outlined">chevron_left</span></button>
              <span className="text-sm px-3">Page {data.current_page + 1} / {data.total_pages}</span>
              <button onClick={() => onPageChange(data.current_page + 1)} disabled={data.current_page >= data.total_pages - 1} className="p-2 rounded-lg bg-slate-100 disabled:opacity-50"><span className="material-symbols-outlined">chevron_right</span></button>
            </div>
          )}
        </div>

        <div ref={containerRef} className="absolute inset-0" style={{ paddingTop: '60px' }} />

        {isLoading && <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-20"><div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div></div>}

        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20">
          <div className="flex items-center gap-1 bg-white rounded-full shadow-xl border px-2 py-1.5">
            <button onClick={handleZoomOut} className="p-2 hover:bg-slate-100 rounded-full"><span className="material-symbols-outlined">remove</span></button>
            <span className="text-sm font-bold w-14 text-center">{zoomLevel}%</span>
            <button onClick={handleZoomIn} className="p-2 hover:bg-slate-100 rounded-full"><span className="material-symbols-outlined">add</span></button>
            <div className="w-px h-6 bg-slate-200 mx-1"></div>
            <button onClick={handleResetView} className="p-2 hover:bg-slate-100 rounded-full"><span className="material-symbols-outlined">fit_screen</span></button>
          </div>
        </div>

        <CoordinateDisplay clickPos={clickPos} scalingFactor={data.scaling_factor} />
      </section>

      <Controls layers={layers} opacity={opacity} stats={data.stats} grayscaleMode={grayscaleMode}
        onLayerToggle={handleLayerToggle} onOpacityChange={handleOpacityChange} onGrayscaleToggle={setGrayscaleMode} />
    </div>
  );
}

export default PixiViewer;
