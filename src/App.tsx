import React, { useState } from 'react';
import { useCamera } from './camera/useCamera';
import { CameraPreview } from './camera/CameraPreview';

export const App: React.FC = () => {
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const camera = useCamera({ autoStart: false });

  const handleStartScanning = async () => {
    setIsScanning(true);
    await camera.start();
  };

  const handleCloseCamera = () => {
    camera.stop();
    setIsScanning(false);
  };

  if (isScanning) {
    return (
      <CameraPreview
        status={camera.status}
        stream={camera.stream}
        error={camera.error}
        dimensions={camera.dimensions}
        onRetry={camera.retry}
        onClose={handleCloseCamera}
        onDimensionsUpdate={camera.updateDimensions}
      />
    );
  }

  return (
    <main className="min-h-screen bg-bg text-text flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md w-full bg-surface border border-surface/80 rounded-card p-6 shadow-xl flex flex-col items-center space-y-4">
        {/* Header / Brand */}
        <div className="inline-flex items-center space-x-2">
          <span className="h-3 w-3 rounded-chip bg-accent animate-pulse" aria-hidden="true" />
          <h1 className="text-2xl font-bold tracking-tight text-text">LabLens</h1>
        </div>

        {/* Pitch */}
        <p className="text-sm font-medium text-muted">
          A lab instructor in your pocket that sees your circuit, explains it, and catches your mistakes before you burn an LED.
        </p>

        {/* Supported Today Badge */}
        <div className="inline-flex items-center px-3 py-1 rounded-chip bg-surface border border-muted/30 text-xs font-mono text-accent">
          Supported today: LED circuit lab
        </div>

        {/* Privacy Note */}
        <p className="text-xs text-muted/80">
          Your camera stays on your phone. Nothing is uploaded.
        </p>

        {/* Start Scanning Primary Action */}
        <button
          type="button"
          onClick={handleStartScanning}
          aria-label="Start scanning"
          className="w-full py-3 px-4 rounded-chip bg-accent text-bg font-semibold text-sm hover:opacity-90 active:scale-[0.99] transition-all shadow-md"
        >
          Start scanning
        </button>
      </div>
    </main>
  );
};

export default App;
