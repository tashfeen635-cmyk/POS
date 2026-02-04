import { useEffect, useCallback, useRef, useState } from 'react';

interface BarcodeScannerOptions {
  onScan: (barcode: string) => void;
  onError?: (error: string) => void;
  minLength?: number;
  maxGapMs?: number;
  terminator?: 'Enter' | 'Tab';
  enabled?: boolean;
  playSound?: boolean;
}

interface ScanState {
  buffer: string;
  lastKeyTime: number;
}

// Audio feedback for scans
const audioContext = typeof window !== 'undefined' ? new (window.AudioContext || (window as any).webkitAudioContext)() : null;

function playBeep(frequency: number, duration: number, type: OscillatorType = 'sine') {
  if (!audioContext) return;

  try {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = type;

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration / 1000);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration / 1000);
  } catch {
    // Ignore audio errors
  }
}

export function playSuccessBeep() {
  playBeep(880, 100); // High pitch, short
}

export function playErrorBeep() {
  playBeep(220, 200, 'square'); // Low pitch, longer, square wave
}

export function useBarcodeScanner({
  onScan,
  onError,
  minLength = 4,
  maxGapMs = 50,
  terminator = 'Enter',
  enabled = true,
  playSound = true,
}: BarcodeScannerOptions) {
  const scanState = useRef<ScanState>({ buffer: '', lastKeyTime: 0 });
  const [isScanning, setIsScanning] = useState(false);

  const clearBuffer = useCallback(() => {
    scanState.current.buffer = '';
    scanState.current.lastKeyTime = 0;
    setIsScanning(false);
  }, []);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      const now = Date.now();
      const timeSinceLastKey = now - scanState.current.lastKeyTime;

      // Check if this might be from a barcode scanner (rapid input)
      const isRapidInput = timeSinceLastKey < maxGapMs || scanState.current.buffer === '';

      // Check for terminator key
      const isTerminator =
        (terminator === 'Enter' && event.key === 'Enter') ||
        (terminator === 'Tab' && event.key === 'Tab');

      if (isTerminator && scanState.current.buffer.length >= minLength) {
        // We have a complete barcode
        event.preventDefault();
        event.stopPropagation();

        const barcode = scanState.current.buffer.trim();

        if (barcode.length >= minLength) {
          if (playSound) playSuccessBeep();
          onScan(barcode);
        } else if (onError) {
          if (playSound) playErrorBeep();
          onError(`Barcode too short: ${barcode}`);
        }

        clearBuffer();
        return;
      }

      // If there's a long gap, reset the buffer (not a scanner)
      if (!isRapidInput && scanState.current.buffer.length > 0) {
        clearBuffer();
      }

      // Only capture printable characters
      if (event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) {
        scanState.current.buffer += event.key;
        scanState.current.lastKeyTime = now;

        // Set scanning state for visual feedback
        if (scanState.current.buffer.length >= 3) {
          setIsScanning(true);
        }
      }
    },
    [enabled, maxGapMs, minLength, terminator, onScan, onError, clearBuffer, playSound]
  );

  // Clear buffer if no input for a while
  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const timeSinceLastKey = now - scanState.current.lastKeyTime;

      // Clear buffer if no input for 500ms
      if (timeSinceLastKey > 500 && scanState.current.buffer.length > 0) {
        clearBuffer();
      }
    }, 200);

    return () => clearInterval(interval);
  }, [enabled, clearBuffer]);

  useEffect(() => {
    if (!enabled) return;

    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [handleKeyDown, enabled]);

  return {
    isScanning,
    clearBuffer,
  };
}

// Hook to detect if current input is from a barcode scanner
export function useBarcodeScannerDetection(inputRef: React.RefObject<HTMLInputElement>) {
  const [isBarcodeScan, setIsBarcodeScan] = useState(false);
  const lastInputTime = useRef(0);
  const inputCount = useRef(0);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;

    const handleInput = () => {
      const now = Date.now();
      const timeSinceLastInput = now - lastInputTime.current;

      if (timeSinceLastInput < 50) {
        inputCount.current++;
        if (inputCount.current >= 3) {
          setIsBarcodeScan(true);
        }
      } else {
        inputCount.current = 1;
        setIsBarcodeScan(false);
      }

      lastInputTime.current = now;
    };

    const handleBlur = () => {
      setIsBarcodeScan(false);
      inputCount.current = 0;
    };

    input.addEventListener('input', handleInput);
    input.addEventListener('blur', handleBlur);

    return () => {
      input.removeEventListener('input', handleInput);
      input.removeEventListener('blur', handleBlur);
    };
  }, [inputRef]);

  return isBarcodeScan;
}
