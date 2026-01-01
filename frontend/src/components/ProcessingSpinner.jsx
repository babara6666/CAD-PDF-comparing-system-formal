function ProcessingSpinner() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-10 min-h-[60vh]">
      <div className="relative">
        {/* Outer ring */}
        <div className="w-24 h-24 border-4 border-slate-200 dark:border-slate-700 rounded-full"></div>
        
        {/* Spinning ring */}
        <div className="absolute top-0 left-0 w-24 h-24 border-4 border-transparent border-t-primary rounded-full animate-spin"></div>
        
        {/* Center icon */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <span className="material-symbols-outlined text-primary text-3xl">
            compare_arrows
          </span>
        </div>
      </div>

      <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-8 mb-2">
        Processing Your Drawings
      </h3>
      
      <p className="text-slate-500 dark:text-slate-400 text-center max-w-md">
        Analyzing features, aligning images, and detecting differences...
      </p>

      {/* Progress steps */}
      <div className="mt-8 flex flex-col gap-3">
        <ProcessStep label="Loading PDFs" status="completed" />
        <ProcessStep label="Extracting Features" status="active" />
        <ProcessStep label="Aligning Images" status="pending" />
        <ProcessStep label="Generating Heatmap" status="pending" />
      </div>
    </div>
  );
}

function ProcessStep({ label, status }) {
  let icon, textClass;
  
  switch (status) {
    case 'completed':
      icon = <span className="material-symbols-outlined text-green-500" style={{ fontSize: '18px' }}>check_circle</span>;
      textClass = 'text-green-600 dark:text-green-400';
      break;
    case 'active':
      icon = (
        <div className="w-[18px] h-[18px] border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
      );
      textClass = 'text-primary font-medium';
      break;
    default:
      icon = <span className="material-symbols-outlined text-slate-300 dark:text-slate-600" style={{ fontSize: '18px' }}>radio_button_unchecked</span>;
      textClass = 'text-slate-400 dark:text-slate-500';
  }

  return (
    <div className="flex items-center gap-3">
      {icon}
      <span className={`text-sm ${textClass}`}>{label}</span>
    </div>
  );
}

export default ProcessingSpinner;
