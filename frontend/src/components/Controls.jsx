function Controls({ layers, opacity, stats, onLayerToggle, onOpacityChange }) {
  return (
    <aside className="w-80 flex-none border-l border-slate-200 dark:border-slate-800 bg-background-light dark:bg-background-dark z-20 flex flex-col h-full shadow-xl">
      {/* Header */}
      <div className="p-5 pb-2">
        <h3 className="text-slate-900 dark:text-white text-base font-bold leading-normal mb-1">
          Inspection Controls
        </h3>
        <p className="text-slate-500 dark:text-slate-400 text-sm font-normal">
          Filter difference types
        </p>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-5 py-2 space-y-6">
        {/* Layer Toggles */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Layers
            </label>
            <button 
              onClick={() => {
                onLayerToggle('red', true);
                onLayerToggle('green', true);
                onLayerToggle('blue', true);
              }}
              className="text-primary text-xs font-medium hover:underline"
            >
              Reset
            </button>
          </div>

          {/* A Only (Red) */}
          <LayerToggle
            label="A Only"
            description="Deleted in target"
            color="diff-a"
            checked={layers.red}
            count={stats?.missing_regions || 0}
            onChange={(checked) => onLayerToggle('red', checked)}
          />

          {/* B Only (Green) */}
          <LayerToggle
            label="B Only"
            description="Added in target"
            color="diff-b"
            checked={layers.green}
            count={stats?.added_regions || 0}
            onChange={(checked) => onLayerToggle('green', checked)}
          />

          {/* Different (Blue) */}
          <LayerToggle
            label="Different"
            description="Modified geometry"
            color="diff-mod"
            checked={layers.blue}
            count={stats?.modified_regions || 0}
            onChange={(checked) => onLayerToggle('blue', checked)}
          />
        </div>

        {/* Display Settings */}
        <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Display Settings
          </label>
          
          {/* Opacity Slider */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-slate-700 dark:text-slate-300">
              <span>Overlay Opacity</span>
              <span className="font-mono">{opacity}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={opacity}
              onChange={(e) => onOpacityChange(parseInt(e.target.value))}
              className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary"
            />
          </div>
        </div>

        {/* Statistics */}
        <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Alignment Statistics
          </label>
          
          <div className="grid grid-cols-2 gap-2">
            <StatCard label="Matches" value={stats?.total_matches || '-'} />
            <StatCard label="Inliers" value={stats?.inliers || '-'} />
            <StatCard label="Method" value={stats?.method || 'SIFT'} />
            <StatCard 
              label="Inlier %" 
              value={stats?.inlier_ratio ? `${(stats.inlier_ratio * 100).toFixed(1)}%` : '-'} 
            />
          </div>
        </div>

        {/* Pixel Counts */}
        <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Difference Metrics
          </label>
          
          <div className="space-y-2">
            <MetricRow 
              label="Missing pixels" 
              value={formatNumber(stats?.missing_pixels)} 
              color="diff-a" 
            />
            <MetricRow 
              label="Added pixels" 
              value={formatNumber(stats?.added_pixels)} 
              color="diff-b" 
            />
            <MetricRow 
              label="Modified pixels" 
              value={formatNumber(stats?.modified_pixels)} 
              color="diff-mod" 
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="material-symbols-outlined text-sm">help</span>
          <span>Scroll to zoom, drag to pan</span>
        </div>
      </div>
    </aside>
  );
}

function LayerToggle({ label, description, color, checked, count, onChange }) {
  const colorClasses = {
    'diff-a': {
      checkbox: 'text-diff-a focus:ring-diff-a',
      badge: 'bg-diff-a/10 text-diff-a',
      dot: 'bg-diff-a',
      hover: 'hover:border-diff-a/50'
    },
    'diff-b': {
      checkbox: 'text-diff-b focus:ring-diff-b',
      badge: 'bg-diff-b/10 text-diff-b',
      dot: 'bg-diff-b',
      hover: 'hover:border-diff-b/50'
    },
    'diff-mod': {
      checkbox: 'text-diff-mod focus:ring-diff-mod',
      badge: 'bg-diff-mod/10 text-diff-mod',
      dot: 'bg-diff-mod',
      hover: 'hover:border-diff-mod/50'
    }
  };

  const classes = colorClasses[color] || colorClasses['diff-a'];

  return (
    <label className={`flex items-center p-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm cursor-pointer group ${classes.hover} transition-colors`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className={`form-checkbox rounded ${classes.checkbox} border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 h-5 w-5 mr-3 transition duration-150 ease-in-out`}
      />
      <div className="flex-1">
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{label}</span>
          <span className={`${classes.badge} text-[10px] font-bold px-1.5 py-0.5 rounded`}>
            {count}
          </span>
        </div>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
      <div className={`w-3 h-3 rounded-full ${classes.dot} ml-2 shadow-sm ring-2 ring-white dark:ring-slate-800`}></div>
    </label>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="bg-slate-50 dark:bg-slate-800 p-2 rounded-lg border border-slate-100 dark:border-slate-700">
      <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-sm font-bold text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}

function MetricRow({ label, value, color }) {
  const dotColors = {
    'diff-a': 'bg-diff-a',
    'diff-b': 'bg-diff-b',
    'diff-mod': 'bg-diff-mod'
  };

  return (
    <div className="flex items-center justify-between py-1">
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${dotColors[color]}`}></div>
        <span className="text-xs text-slate-600 dark:text-slate-400">{label}</span>
      </div>
      <span className="text-xs font-mono font-medium text-slate-900 dark:text-white">{value}</span>
    </div>
  );
}

function formatNumber(num) {
  if (num === undefined || num === null) return '-';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

export default Controls;
