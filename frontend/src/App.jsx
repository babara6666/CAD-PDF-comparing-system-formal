import { useState, useCallback, Component } from 'react';
import UploadPage from './components/UploadPage';
import ComparisonViewer from './components/ComparisonViewer';
import ProcessingSpinner from './components/ProcessingSpinner';
import { uploadPdfs, processPage } from './api/client';

// Error Boundary to catch React crashes
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('React Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background-light flex items-center justify-center p-8">
          <div className="bg-white dark:bg-slate-800 p-8 rounded-xl shadow-xl max-w-md text-center">
            <span className="material-symbols-outlined text-red-500 text-5xl mb-4">error</span>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Something went wrong</h2>
            <p className="text-slate-500 mb-4">{this.state.error?.message || 'An unexpected error occurred'}</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-primary text-white rounded-lg font-medium"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  const [step, setStep] = useState('upload'); // 'upload' | 'processing' | 'results'
  const [sessionData, setSessionData] = useState(null);
  const [error, setError] = useState(null);

  const handleUpload = useCallback(async (refFile, targetFile) => {
    setError(null);
    setStep('processing');

    try {
      // Upload files
      const uploadResult = await uploadPdfs(refFile, targetFile);
      
      // Process first page
      const processResult = await processPage(uploadResult.session_id, 0);

      setSessionData({
        sessionId: uploadResult.session_id,
        files: uploadResult.files,
        pageCount: uploadResult.page_count,
        ...processResult
      });

      setStep('results');
    } catch (err) {
      setError(err.message);
      setStep('upload');
    }
  }, []);

  const handlePageChange = useCallback(async (page) => {
    if (!sessionData) return;

    try {
      const result = await processPage(sessionData.sessionId, page);
      setSessionData(prev => ({
        ...prev,
        ...result
      }));
    } catch (err) {
      setError(err.message);
    }
  }, [sessionData]);

  const handleReset = useCallback(() => {
    setSessionData(null);
    setStep('upload');
    setError(null);
  }, []);

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark text-slate-900 dark:text-white font-display">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full bg-white dark:bg-surface-dark border-b border-slate-200 dark:border-slate-800">
        <div className="px-6 md:px-10 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-8 text-primary flex items-center justify-center bg-primary/10 rounded-lg">
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>difference</span>
            </div>
            <h1 className="text-xl font-bold tracking-tight">SchematicDiff</h1>
          </div>

          {/* Stepper */}
          <div className="hidden md:flex items-center gap-2">
            <StepIndicator number={1} label="Upload" active={step === 'upload'} completed={step !== 'upload'} />
            <div className="w-10 h-[1px] bg-slate-200 dark:bg-slate-700"></div>
            <StepIndicator number={2} label="Processing" active={step === 'processing'} completed={step === 'results'} />
            <div className="w-10 h-[1px] bg-slate-200 dark:bg-slate-700"></div>
            <StepIndicator number={3} label="Results" active={step === 'results'} completed={false} />
          </div>

          <div className="flex items-center gap-4">
            {step === 'results' && (
              <button 
                onClick={handleReset}
                className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-primary transition-colors"
              >
                New Comparison
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800 px-6 py-3">
          <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
            <span className="material-symbols-outlined">error</span>
            <span>{error}</span>
            <button 
              onClick={() => setError(null)}
              className="ml-auto text-red-600 hover:text-red-800"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1">
        {step === 'upload' && (
          <UploadPage onUpload={handleUpload} />
        )}
        
        {step === 'processing' && (
          <ProcessingSpinner />
        )}
        
        {step === 'results' && sessionData && (
          <ComparisonViewer 
            data={sessionData} 
            onPageChange={handlePageChange}
          />
        )}
      </main>
    </div>
  );
}

function AppWithErrorBoundary() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}

function StepIndicator({ number, label, active, completed }) {
  const bgClass = active || completed 
    ? 'bg-primary text-white' 
    : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400';
  const labelClass = active || completed
    ? 'text-slate-900 dark:text-white'
    : 'text-slate-500 dark:text-slate-400';
  const opacity = active || completed ? '' : 'opacity-50';

  return (
    <div className={`flex items-center gap-2 ${opacity}`}>
      <div className={`size-6 rounded-full flex items-center justify-center text-xs font-bold ${bgClass}`}>
        {completed && !active ? (
          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>check</span>
        ) : number}
      </div>
      <span className={`text-sm font-medium ${labelClass}`}>{label}</span>
    </div>
  );
}

export default AppWithErrorBoundary;
