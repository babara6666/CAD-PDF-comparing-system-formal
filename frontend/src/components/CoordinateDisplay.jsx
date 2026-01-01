function CoordinateDisplay({ clickPos, scalingFactor }) {
  if (!clickPos) {
    return (
      <div className="absolute top-20 left-6 z-20">
        <div className="coord-tooltip text-white text-xs p-3 rounded-lg shadow-xl min-w-[160px]">
          <div className="flex items-center gap-2 mb-2 text-slate-400">
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>touch_app</span>
            <span>Click to measure</span>
          </div>
          <p className="text-[10px] text-slate-500">
            Click anywhere on the drawing to display coordinates
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute top-20 left-6 z-20">
      <div className="coord-tooltip text-white text-xs p-3 rounded-lg shadow-xl min-w-[180px]">
        <div className="flex items-center gap-2 mb-2 border-b border-slate-600 pb-2">
          <span className="material-symbols-outlined text-primary" style={{ fontSize: '16px' }}>location_on</span>
          <span className="font-bold">Position</span>
        </div>
        
        {/* Screen Coordinates */}
        <div className="mb-2">
          <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Screen</p>
          <div className="grid grid-cols-2 gap-x-3 font-mono">
            <span>X: <span className="text-slate-300">{clickPos.screen.x}</span></span>
            <span>Y: <span className="text-slate-300">{clickPos.screen.y}</span></span>
          </div>
        </div>
        
        {/* Original PDF Coordinates */}
        <div>
          <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Original PDF</p>
          <div className="grid grid-cols-2 gap-x-3 font-mono text-primary">
            <span>X: <span className="font-bold">{clickPos.original.x}</span></span>
            <span>Y: <span className="font-bold">{clickPos.original.y}</span></span>
          </div>
        </div>

        {/* Scale Info */}
        <div className="mt-2 pt-2 border-t border-slate-600">
          <p className="text-[10px] text-slate-500">
            Scale factor: {scalingFactor?.toFixed(3) || '—'}
          </p>
        </div>
      </div>
    </div>
  );
}

export default CoordinateDisplay;
