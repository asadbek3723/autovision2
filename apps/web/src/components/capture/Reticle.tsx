import { cn } from '../../lib/format';

interface ReticleProps {
  box: { left: number; top: number; width: number; height: number };
  ready: boolean;
}

export function Reticle({ box, ready }: ReticleProps) {
  const color = ready ? 'border-success' : 'border-danger animate-pulse';

  return (
    <div
      className="pointer-events-none absolute"
      style={{
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height,
        boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.45)',
      }}
    >
      {/* 4 ta L-shaklidagi burchaklar */}
      {/* Top-Left */}
      <div
        className={cn(
          'absolute top-0 left-0 h-8 w-8 border-t-4 border-l-4 rounded-tl-xl transition-all duration-200',
          color
        )}
      />
      {/* Top-Right */}
      <div
        className={cn(
          'absolute top-0 right-0 h-8 w-8 border-t-4 border-r-4 rounded-tr-xl transition-all duration-200',
          color
        )}
      />
      {/* Bottom-Left */}
      <div
        className={cn(
          'absolute bottom-0 left-0 h-8 w-8 border-b-4 border-l-4 rounded-bl-xl transition-all duration-200',
          color
        )}
      />
      {/* Bottom-Right */}
      <div
        className={cn(
          'absolute bottom-0 right-0 h-8 w-8 border-b-4 border-r-4 rounded-br-xl transition-all duration-200',
          color
        )}
      />
    </div>
  );
}
