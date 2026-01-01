import { useState, useRef, useCallback } from 'react';

function UploadPage({ onUpload }) {
  const [refFile, setRefFile] = useState(null);
  const [targetFile, setTargetFile] = useState(null);
  const [dragOver, setDragOver] = useState({ ref: false, target: false });
  
  const refInputRef = useRef(null);
  const targetInputRef = useRef(null);

  const handleDrop = useCallback((e, type) => {
    e.preventDefault();
    setDragOver(prev => ({ ...prev, [type]: false }));
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        if (type === 'ref') {
          setRefFile(file);
        } else {
          setTargetFile(file);
        }
      }
    }
  }, []);

  const handleDragOver = useCallback((e, type) => {
    e.preventDefault();
    setDragOver(prev => ({ ...prev, [type]: true }));
  }, []);

  const handleDragLeave = useCallback((e, type) => {
    e.preventDefault();
    setDragOver(prev => ({ ...prev, [type]: false }));
  }, []);

  const handleFileSelect = useCallback((e, type) => {
    const file = e.target.files?.[0];
    if (file) {
      if (type === 'ref') {
        setRefFile(file);
      } else {
        setTargetFile(file);
      }
    }
  }, []);

  const handleSubmit = useCallback(() => {
    if (refFile && targetFile) {
      onUpload(refFile, targetFile);
    }
  }, [refFile, targetFile, onUpload]);

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-10 w-full max-w-[1400px] mx-auto">
      {/* Hero Section */}
      <div className="w-full max-w-4xl text-center mb-10">
        <h2 className="text-3xl md:text-5xl font-black tracking-tight text-slate-900 dark:text-white mb-4">
          Compare Engineering Schematics
        </h2>
        <p className="text-lg text-slate-500 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
          Upload two PDF files to detect geometric changes, dimension shifts, and text modifications automatically.
        </p>
      </div>

      {/* Upload Cards */}
      <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12 relative">
        {/* VS Badge */}
        <div className="hidden lg:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 size-12 bg-white dark:bg-surface-dark rounded-full border border-slate-200 dark:border-slate-700 items-center justify-center shadow-sm">
          <span className="text-sm font-bold text-slate-400">VS</span>
        </div>

        {/* Reference (A) */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="bg-primary/10 text-primary p-1.5 rounded text-xs font-bold uppercase tracking-wider">Reference</span>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Drawing A</h3>
            </div>
            {refFile && (
              <button 
                onClick={() => setRefFile(null)}
                className="text-xs font-medium text-red-500 hover:text-red-600 transition-colors flex items-center gap-1"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>delete</span>
                Remove
              </button>
            )}
          </div>

          {refFile ? (
            <FilePreview file={refFile} type="reference" />
          ) : (
            <DropZone
              dragOver={dragOver.ref}
              onDrop={(e) => handleDrop(e, 'ref')}
              onDragOver={(e) => handleDragOver(e, 'ref')}
              onDragLeave={(e) => handleDragLeave(e, 'ref')}
              onClick={() => refInputRef.current?.click()}
              label="Upload Reference PDF"
            />
          )}
          <input
            ref={refInputRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={(e) => handleFileSelect(e, 'ref')}
          />
        </div>

        {/* Target (B) */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="bg-green-500/10 text-green-600 dark:text-green-400 p-1.5 rounded text-xs font-bold uppercase tracking-wider">Revised</span>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Drawing B</h3>
            </div>
            {targetFile && (
              <button 
                onClick={() => setTargetFile(null)}
                className="text-xs font-medium text-red-500 hover:text-red-600 transition-colors flex items-center gap-1"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>delete</span>
                Remove
              </button>
            )}
          </div>

          {targetFile ? (
            <FilePreview file={targetFile} type="target" />
          ) : (
            <DropZone
              dragOver={dragOver.target}
              onDrop={(e) => handleDrop(e, 'target')}
              onDragOver={(e) => handleDragOver(e, 'target')}
              onDragLeave={(e) => handleDragLeave(e, 'target')}
              onClick={() => targetInputRef.current?.click()}
              label="Upload Target PDF"
            />
          )}
          <input
            ref={targetInputRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={(e) => handleFileSelect(e, 'target')}
          />
        </div>
      </div>

      {/* Action Bar */}
      <div className="w-full max-w-4xl bg-white dark:bg-surface-dark rounded-2xl p-6 shadow-xl shadow-slate-200/50 dark:shadow-black/20 border border-slate-100 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex flex-wrap items-center gap-6 justify-center md:justify-start w-full md:w-auto">
          <ToggleOption label="Enable Heatmap" defaultChecked />
          <ToggleOption label="Strict Text Matching" />
        </div>

        <button
          onClick={handleSubmit}
          disabled={!refFile || !targetFile}
          className="w-full md:w-auto px-8 py-3.5 bg-primary hover:bg-blue-600 active:bg-blue-700 text-white rounded-lg font-bold text-base shadow-lg shadow-blue-500/20 transition-all transform hover:-translate-y-0.5 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
        >
          <span className="material-symbols-outlined">compare_arrows</span>
          Generate Comparison
        </button>
      </div>
    </div>
  );
}

function DropZone({ dragOver, onDrop, onDragOver, onDragLeave, onClick, label }) {
  return (
    <div
      onClick={onClick}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      className={`flex-1 min-h-[320px] bg-white dark:bg-surface-dark border-2 border-dashed rounded-xl transition-all cursor-pointer flex flex-col items-center justify-center p-8 text-center relative overflow-hidden ${
        dragOver 
          ? 'border-primary bg-primary/5' 
          : 'border-slate-300 dark:border-slate-700 hover:border-primary/50 dark:hover:border-primary/50 hover:bg-slate-50 dark:hover:bg-slate-800/50'
      }`}
    >
      <span className="material-symbols-outlined absolute text-[200px] text-slate-50 dark:text-slate-800/50 -rotate-12 pointer-events-none select-none">
        description
      </span>
      <div className="relative z-10 flex flex-col items-center gap-4">
        <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-2 shadow-sm">
          <span className="material-symbols-outlined" style={{ fontSize: '32px' }}>upload_file</span>
        </div>
        <div>
          <p className="text-lg font-bold text-slate-900 dark:text-white mb-1">{label}</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">Drag & drop or click to browse</p>
        </div>
        <button className="mt-4 px-5 py-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-sm font-semibold text-slate-700 dark:text-slate-200 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
          Select File
        </button>
      </div>
    </div>
  );
}

function FilePreview({ file, type }) {
  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const borderColor = type === 'reference' ? 'border-primary/30' : 'border-green-500/30';
  const headerBg = type === 'reference' ? 'bg-blue-50/30 dark:bg-blue-900/10' : 'bg-green-50/30 dark:bg-green-900/10';

  return (
    <div className={`flex-1 min-h-[320px] bg-white dark:bg-surface-dark border-2 border-solid ${borderColor} rounded-xl relative overflow-hidden flex flex-col`}>
      <div className={`p-6 border-b border-slate-100 dark:border-slate-800 ${headerBg} flex items-start gap-4`}>
        <div className="size-12 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined">picture_as_pdf</span>
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-bold text-slate-900 dark:text-white truncate" title={file.name}>
            {file.name}
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {formatFileSize(file.size)} • Ready to compare
          </p>
        </div>
        <div className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 p-1 rounded-full">
          <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>check</span>
        </div>
      </div>
      <div className="flex-1 p-6 flex flex-col justify-center items-center">
        <div className="text-4xl text-slate-300 dark:text-slate-600">
          <span className="material-symbols-outlined" style={{ fontSize: '64px' }}>description</span>
        </div>
        <p className="text-sm text-slate-400 mt-2">PDF loaded successfully</p>
      </div>
    </div>
  );
}

function ToggleOption({ label, defaultChecked = false }) {
  const [checked, setChecked] = useState(defaultChecked);

  return (
    <label className="flex items-center gap-3 cursor-pointer group">
      <div className="relative inline-flex items-center">
        <input 
          type="checkbox" 
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          className="peer sr-only" 
        />
        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
      </div>
      <span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-primary transition-colors">
        {label}
      </span>
    </label>
  );
}

export default UploadPage;
