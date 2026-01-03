import { useRef, useCallback } from 'react';

function MiniMap({ baseImage, viewportBounds, onNavigate }) {
  const containerRef = useRef(null);

  const handleClick = useCallback((e) => {
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    
    onNavigate(x * 100, y * 100);
  }, [onNavigate]);

  // Calculate viewport box position and size (viewportBounds is already in %)
  const viewportStyle = {
    left: `${Math.max(0, Math.min(100 - viewportBounds.width, viewportBounds.x))}%`,
    top: `${Math.max(0, Math.min(100 - viewportBounds.height, viewportBounds.y))}%`,
    width: `${Math.max(5, Math.min(100, viewportBounds.width))}%`,
    height: `${Math.max(5, Math.min(100, viewportBounds.height))}%`,
  };

  return (
    <div className="absolute bottom-6 right-6 z-20 hidden md:block">
      <div 
        ref={containerRef}
        onClick={handleClick}
        className="relative w-48 h-36 bg-white dark:bg-slate-800 rounded-lg shadow-xl border-2 border-slate-200 dark:border-slate-600 overflow-hidden transition-all hover:scale-105 cursor-crosshair"
      >
        {/* Mini Image */}
        <img
          src={baseImage}
          alt="Minimap"
          className="w-full h-full object-contain opacity-50"
          draggable={false}
        />

        {/* Viewport Rectangle */}
        <div 
          className="minimap-viewport absolute rounded-sm"
          style={viewportStyle}
        ></div>

        {/* Label */}
        <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded backdrop-blur-sm pointer-events-none">
          Overview
        </div>
      </div>
    </div>
  );
}

export default MiniMap;
