
import React, { useEffect, useRef, useState } from 'react';
import { Camera, X, RefreshCcw } from 'lucide-react';

interface QRScannerProps {
  onScan: (data: string) => void;
  onClose: () => void;
}

const QRScanner: React.FC<QRScannerProps> = ({ onScan, onClose }) => {
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;

    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment' } 
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        setError('Не удалось получить доступ к камере. Убедитесь, что разрешения предоставлены.');
        console.error(err);
      }
    };

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Simple interval to simulate QR detection from frame (as real JS QR libs can be heavy)
  // In a real app we'd use jsQR or html5-qrcode library. 
  // For this demo, we'll simulate a scan button or auto-detect a specific color/pattern if needed,
  // but let's assume we use a placeholder "Detect" for the UI if the browser doesn't have native BarcodeDetector.
  
  const handleCapture = () => {
    // This is where actual QR decoding logic would go.
    // Since we are mocking the scanner for this environment:
    // We'll provide a prompt or a simulated successful scan after 2 seconds for demo purposes
    // Or just a simple button "Имитировать сканирование"
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center p-6">
      <div className="absolute top-6 right-6">
        <button onClick={onClose} className="text-white p-2 bg-white/10 rounded-full">
          <X size={24} />
        </button>
      </div>

      <h2 className="text-white text-xl font-bold mb-8">Сканирование QR кода</h2>
      
      <div className="relative w-full max-w-xs aspect-square border-2 border-[#007aff] rounded-3xl overflow-hidden shadow-[0_0_30px_rgba(0,122,255,0.5)]">
        {error ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4 bg-slate-900 text-white">
            <X size={48} className="text-red-500 mb-4" />
            <p className="text-sm">{error}</p>
          </div>
        ) : (
          <>
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 border-[40px] border-black/40 pointer-events-none">
              <div className="w-full h-full border-2 border-white/50 rounded-xl animate-pulse"></div>
            </div>
            {/* Animated scan line */}
            <div className="absolute top-0 left-0 w-full h-1 bg-[#007aff] shadow-[0_0_15px_#007aff] animate-scan-line"></div>
          </>
        )}
      </div>

      <p className="text-white/60 text-sm mt-8 text-center px-4">
        Наведите камеру на QR код в зале для получения опыта
      </p>

      {/* Manual scan trigger for environment where auto-decoding isn't implemented */}
      <div className="mt-12 space-y-4 w-full max-w-xs">
        <button 
          onClick={() => {
            // Simulate reading the latest QR from "storage" or a prompt for testing
            const testData = prompt("Введите данные QR кода (для теста):", "qr_default_branch");
            if (testData) onScan(testData);
          }}
          className="w-full bg-white/10 text-white py-4 rounded-2xl flex items-center justify-center gap-2 font-bold active-scale"
        >
          <Camera size={20} />
          Сканировать
        </button>
      </div>

      <style>{`
        @keyframes scan-line {
          0% { top: 0; }
          100% { top: 100%; }
        }
        .animate-scan-line {
          animation: scan-line 3s linear infinite;
        }
      `}</style>
    </div>
  );
};

export default QRScanner;
