import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface AudioVisual3DProps {
  inputNode?: GainNode;
  outputNode?: GainNode;
  className?: string;
}

export default function AudioVisual3D({ inputNode, outputNode, className }: AudioVisual3DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const inputAnalyserRef = useRef<AnalyserNode>();
  const outputAnalyserRef = useRef<AnalyserNode>();

  useEffect(() => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Create analysers
    if (inputNode) {
      const inputAnalyser = inputNode.context.createAnalyser();
      inputAnalyser.fftSize = 256;
      inputNode.connect(inputAnalyser);
      inputAnalyserRef.current = inputAnalyser;
    }

    if (outputNode) {
      const outputAnalyser = outputNode.context.createAnalyser();
      outputAnalyser.fftSize = 256;
      outputNode.connect(outputAnalyser);
      outputAnalyserRef.current = outputAnalyser;
    }

    // Animation loop
    const animate = () => {
      if (!ctx || !canvas) return;
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw input waveform (red)
      if (inputAnalyserRef.current) {
        drawWaveform(ctx, inputAnalyserRef.current, '#ff0000', canvas.height * 0.3);
      }

      // Draw output waveform (blue)
      if (outputAnalyserRef.current) {
        drawWaveform(ctx, outputAnalyserRef.current, '#0088ff', canvas.height * 0.7);
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [inputNode, outputNode]);

  const drawWaveform = (
    ctx: CanvasRenderingContext2D,
    analyser: AnalyserNode,
    color: string,
    yOffset: number
  ) => {
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteTimeDomainData(dataArray);

    ctx.lineWidth = 2;
    ctx.strokeStyle = color;
    ctx.beginPath();

    const sliceWidth = ctx.canvas.width / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0;
      const y = (v * ctx.canvas.height) / 4 + yOffset;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }

      x += sliceWidth;
    }

    ctx.stroke();

    // Draw frequency bars
    const freqData = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(freqData);

    const barWidth = (ctx.canvas.width / bufferLength) * 2.5;
    let barX = 0;

    ctx.globalAlpha = 0.5;
    for (let i = 0; i < bufferLength; i++) {
      const barHeight = (freqData[i] / 255) * ctx.canvas.height / 4;
      
      const gradient = ctx.createLinearGradient(0, yOffset, 0, yOffset - barHeight);
      gradient.addColorStop(0, color);
      gradient.addColorStop(1, 'transparent');
      
      ctx.fillStyle = gradient;
      ctx.fillRect(barX, yOffset - barHeight / 2, barWidth, barHeight);
      
      barX += barWidth + 1;
    }
    ctx.globalAlpha = 1;
  };

  return (
    <canvas
      ref={canvasRef}
      className={cn(
        "absolute inset-0 w-full h-full",
        className
      )}
      style={{ 
        background: 'radial-gradient(ellipse at center, #0a0a0a 0%, #000000 100%)'
      }}
    />
  );
} 