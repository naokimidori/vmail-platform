import { useEffect, useRef, useState } from "react";

type RoutePoint = { x: number; y: number; delay: number };

const ROUTES: { start: RoutePoint; end: RoutePoint }[] = [
  { start: { x: 100, y: 150, delay: 0 }, end: { x: 200, y: 80, delay: 2 } },
  { start: { x: 200, y: 80, delay: 2 }, end: { x: 260, y: 120, delay: 4 } },
  { start: { x: 50, y: 50, delay: 1 }, end: { x: 150, y: 180, delay: 3 } },
  { start: { x: 280, y: 60, delay: 0.5 }, end: { x: 180, y: 180, delay: 2.5 } },
];

const DOT_COLOR = "rgba(74, 88, 116, 0.35)";
const ROUTE_COLOR = "rgba(76, 156, 217, 0.55)";
const POINT_COLOR = "#3B92D9";
const POINT_HALO = "rgba(76, 156, 217, 0.25)";

function generateDots(width: number, height: number) {
  const dots: { x: number; y: number; radius: number; opacity: number }[] = [];
  const gap = 12;
  const dotRadius = 1;

  for (let x = 0; x < width; x += gap) {
    for (let y = 0; y < height; y += gap) {
      const isInMapShape =
        // North America
        ((x < width * 0.25 && x > width * 0.05) && (y < height * 0.4 && y > height * 0.1)) ||
        // South America
        ((x < width * 0.25 && x > width * 0.15) && (y < height * 0.8 && y > height * 0.4)) ||
        // Europe
        ((x < width * 0.45 && x > width * 0.3) && (y < height * 0.35 && y > height * 0.15)) ||
        // Africa
        ((x < width * 0.5 && x > width * 0.35) && (y < height * 0.65 && y > height * 0.35)) ||
        // Asia
        ((x < width * 0.7 && x > width * 0.45) && (y < height * 0.5 && y > height * 0.1)) ||
        // Australia
        ((x < width * 0.8 && x > width * 0.65) && (y < height * 0.8 && y > height * 0.6));

      if (isInMapShape && Math.random() > 0.3) {
        dots.push({
          x,
          y,
          radius: dotRadius,
          opacity: Math.random() * 0.5 + 0.2,
        });
      }
    }
  }
  return dots;
}

export function DotMap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeObserver = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDimensions({ width, height });
      canvas.width = width;
      canvas.height = height;
    });

    resizeObserver.observe(canvas.parentElement as Element);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    if (!dimensions.width || !dimensions.height) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dots = generateDots(dimensions.width, dimensions.height);
    let animationFrameId = 0;
    let startTime = Date.now();

    const drawDots = () => {
      ctx.clearRect(0, 0, dimensions.width, dimensions.height);
      for (const dot of dots) {
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, dot.radius, 0, Math.PI * 2);
        ctx.fillStyle = DOT_COLOR.replace(/[\d.]+\)$/, `${(dot.opacity * 0.7).toFixed(2)})`);
        ctx.fill();
      }
    };

    const drawRoutes = () => {
      const currentTime = (Date.now() - startTime) / 1000;

      for (const route of ROUTES) {
        const elapsed = currentTime - route.start.delay;
        if (elapsed <= 0) continue;

        const duration = 3;
        const progress = Math.min(elapsed / duration, 1);

        const x = route.start.x + (route.end.x - route.start.x) * progress;
        const y = route.start.y + (route.end.y - route.start.y) * progress;

        ctx.beginPath();
        ctx.moveTo(route.start.x, route.start.y);
        ctx.lineTo(x, y);
        ctx.strokeStyle = ROUTE_COLOR;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(route.start.x, route.start.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = ROUTE_COLOR;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fillStyle = POINT_HALO;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fillStyle = POINT_COLOR;
        ctx.fill();

        if (progress === 1) {
          ctx.beginPath();
          ctx.arc(route.end.x, route.end.y, 3, 0, Math.PI * 2);
          ctx.fillStyle = ROUTE_COLOR;
          ctx.fill();
        }
      }
    };

    const animate = () => {
      drawDots();
      drawRoutes();
      if ((Date.now() - startTime) / 1000 > 7) startTime = Date.now();
      animationFrameId = requestAnimationFrame(animate);
    };

    animate();
    return () => cancelAnimationFrame(animationFrameId);
  }, [dimensions]);

  return (
    <div className="relative w-full h-full overflow-hidden" aria-hidden="true">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
    </div>
  );
}
