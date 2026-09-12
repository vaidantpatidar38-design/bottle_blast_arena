import { useEffect, useRef, useState } from "react";
import Box from "@cloudscape-design/components/box";
import Badge from "@cloudscape-design/components/badge";
import { PitchPopGame } from "./GameEngine";
import { playLaunch, playImpact, playCheer } from "./audio";

interface GameCanvasProps {
  onGameOver: (score: number) => void;
  onReset: () => void;
  gameKey: number;
}

export default function GameCanvas({ onGameOver, gameKey }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<PitchPopGame | null>(null);
  const [score, setScore] = useState(0);
  const [shotsLeft, setShotsLeft] = useState(5);
  const [scorePop, setScorePop] = useState(false);
  const [hint, setHint] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const w = Math.min(parent.clientWidth, 900);
      const h = Math.round(w * 0.56);
      canvas.width = w;
      canvas.height = h;
    };
    resize();

    gameRef.current = new PitchPopGame(canvas, {
      onScoreChange: (s) => {
        setScore(s);
        setScorePop(true);
        setTimeout(() => setScorePop(false), 300);
      },
      onShotsChange: setShotsLeft,
      onGameOver: onGameOver,
      onImpact: () => {
        playImpact();
        setHint(false);
      },
      onAllDown: playCheer,
    });

    const handleStart = () => playLaunch();
    canvas.addEventListener("mousedown", handleStart);
    canvas.addEventListener("touchstart", handleStart);

    return () => {
      gameRef.current?.destroy();
      canvas.removeEventListener("mousedown", handleStart);
      canvas.removeEventListener("touchstart", handleStart);
    };
  }, [gameKey]);

  return (
    <div style={{ position: "relative" }}>
      {/* HUD overlay */}
      <div
        style={{
          position: "absolute",
          top: 8,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "0 16px",
          zIndex: 10,
          pointerEvents: "none",
        }}
      >
        {/* Score */}
        <div
          style={{
            background: "rgba(0,0,0,0.55)",
            borderRadius: 12,
            padding: "6px 16px",
            backdropFilter: "blur(4px)",
            border: "1px solid rgba(255,255,255,0.15)",
          }}
        >
          <span style={{ color: "#ffcc00", fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", display: "block" }}>
            Score
          </span>
          <span
            style={{
              color: "#fff",
              fontSize: 28,
              fontWeight: 800,
              lineHeight: 1,
              display: "block",
              transform: scorePop ? "scale(1.25)" : "scale(1)",
              transition: "transform 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
            }}
          >
            {score}
          </span>
        </div>

        {/* Title */}
        <div style={{
          color: "#fff",
          fontSize: 22,
          fontWeight: 900,
          textShadow: "0 2px 8px rgba(0,0,0,0.6)",
          letterSpacing: 2,
        }}>
          PITCHPOP
        </div>

        {/* Shots */}
        <div
          style={{
            background: "rgba(0,0,0,0.55)",
            borderRadius: 12,
            padding: "6px 16px",
            backdropFilter: "blur(4px)",
            border: "1px solid rgba(255,255,255,0.15)",
            textAlign: "right",
          }}
        >
          <span style={{ color: "#ff9944", fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", display: "block" }}>
            Shots
          </span>
          <div style={{ display: "flex", gap: 4, justifyContent: "flex-end", marginTop: 2 }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  background: i < shotsLeft ? "#e74c3c" : "rgba(255,255,255,0.2)",
                  border: "1px solid rgba(255,255,255,0.4)",
                  transition: "background 0.2s",
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Hint */}
      {hint && (
        <div
          style={{
            position: "absolute",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(0,0,0,0.6)",
            color: "#fff",
            fontSize: 13,
            padding: "6px 16px",
            borderRadius: 20,
            pointerEvents: "none",
            whiteSpace: "nowrap",
            zIndex: 10,
            backdropFilter: "blur(4px)",
          }}
        >
          Drag back on the catapult to aim and fire!
        </div>
      )}

      <canvas
        ref={canvasRef}
        style={{
          display: "block",
          width: "100%",
          borderRadius: 16,
          cursor: "crosshair",
          touchAction: "none",
          boxShadow: "0 8px 32px rgba(0,0,0,0.35)",
        }}
      />
    </div>
  );
}
