import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { ArrowLeft, RefreshCcw, Timer, Trophy } from "lucide-react";
import { soundEngine } from "../lib/sounds";

interface GameProps {
  user: { id: string };
  onBack: () => void;
}

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    color: string;
}

export default function Game({ user, onBack }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [gameState, setGameState] = useState<any>(null);
  const [isConnected, setIsConnected] = useState(false);
  const particlesRef = useRef<Particle[]>([]);
  const inputRef = useRef({ left: false, right: false, jump: false });

  useEffect(() => {
    // Determine WS protocol based on window.location
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      ws.send(JSON.stringify({ type: "join" }));
      soundEngine.startBGM();
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "state") {
        setGameState(data.state);
      } else if (data.type === "effect") {
        handleEffect(data);
      }
    };

    ws.onclose = () => setIsConnected(false);

    // Keyboard handlers
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "a") inputRef.current.left = true;
      if (e.key === "ArrowRight" || e.key === "d") inputRef.current.right = true;
      if (e.key === "ArrowUp" || e.key === "w" || e.key === " ") inputRef.current.jump = true;
      sendInput();
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "a") inputRef.current.left = false;
      if (e.key === "ArrowRight" || e.key === "d") inputRef.current.right = false;
      if (e.key === "ArrowUp" || e.key === "w" || e.key === " ") inputRef.current.jump = false;
      sendInput();
    };

    const sendInput = () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "input", input: inputRef.current }));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      ws.close();
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      soundEngine.stopBGM();
    };
  }, []);

  const handleEffect = (data: any) => {
    if (data.itemType === "bomb") {
      soundEngine.playExplode();
      spawnExplosion(data.x, data.y);
    } else {
      soundEngine.playEat();
      spawnBubbles(data.x, data.y, data.itemType === "green" ? "#4ade80" : data.itemType === "yellow" ? "#facc15" : "#f87171");
    }
  };

  const spawnExplosion = (x: number, y: number) => {
    for (let i = 0; i < 20; i++) {
        particlesRef.current.push({
            x, y,
            vx: (Math.random() - 0.5) * 10,
            vy: (Math.random() - 0.5) * 10,
            life: 1.0,
            color: "#ef4444"
        });
    }
  };

  const spawnBubbles = (x: number, y: number, color: string) => {
    for (let i = 0; i < 10; i++) {
        particlesRef.current.push({
            x, y,
            vx: (Math.random() - 0.5) * 4,
            vy: (Math.random() - 1) * 4,
            life: 1.0,
            color
        });
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;

    const render = () => {
      // Clear
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw Grid / Background detail
      ctx.strokeStyle = "rgba(255,255,255,0.05)";
      ctx.lineWidth = 1;
      for (let i = 0; i < canvas.width; i += 40) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke();
      }
      for (let i = 0; i < canvas.height; i += 40) {
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(canvas.width, i); ctx.stroke();
      }

      // Draw Platforms
      ctx.fillStyle = "#334155";
      const PLATFORMS = [
        { x: 0, y: 550, w: 800, h: 50 },
        { x: 100, y: 450, w: 200, h: 20 }, { x: 500, y: 450, w: 200, h: 20 },
        { x: 300, y: 350, w: 200, h: 20 },
        { x: 100, y: 250, w: 200, h: 20 }, { x: 500, y: 250, w: 200, h: 20 },
        { x: 300, y: 150, w: 200, h: 20 },
      ];
      PLATFORMS.forEach(p => {
        ctx.beginPath();
        ctx.roundRect(p.x, p.y, p.w, p.h, 4);
        ctx.fill();
        // Top edge highlight
        ctx.strokeStyle = "#475569";
        ctx.stroke();
      });

      // Update & Draw Particles
      particlesRef.current = particlesRef.current.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.02;
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fill();
        return p.life > 0;
      });
      ctx.globalAlpha = 1.0;

      if (gameState) {
        // Draw Items
        gameState.items.forEach((item: any) => {
          ctx.beginPath();
          const colors = { red: "#ef4444", yellow: "#facc15", green: "#4ade80", bomb: "#000" };
          ctx.fillStyle = colors[item.type as keyof typeof colors];
          
          if (item.type === "green") {
            // Diamond shape
            ctx.moveTo(item.x, item.y - 12);
            ctx.lineTo(item.x + 12, item.y);
            ctx.lineTo(item.x, item.y + 12);
            ctx.lineTo(item.x - 12, item.y);
            ctx.fill();
          } else if (item.type === "bomb") {
            ctx.arc(item.x, item.y, 12, 0, Math.PI * 2);
            ctx.fill();
            // Fuse
            ctx.strokeStyle = "#fb923c";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(item.x, item.y - 10);
            ctx.lineTo(item.x + 5, item.y - 15);
            ctx.stroke();
          } else {
            ctx.arc(item.x, item.y, 10, 0, Math.PI * 2);
            ctx.fill();
          }
        });

        // Draw Players
        Object.values(gameState.players).forEach((p: any) => {
          ctx.save();
          ctx.translate(p.x, p.y);
          
          if (p.isNpc || Object.keys(gameState.players).indexOf(p.id) === 1) {
            // Yellow Alien (Round)
            ctx.fillStyle = "#facc15";
            ctx.beginPath();
            ctx.arc(0, 0, 20, 0, Math.PI * 2);
            ctx.fill();
            // Eyes
            ctx.fillStyle = "black";
            const eyeX = p.facing === "right" ? 8 : -8;
            ctx.beginPath(); ctx.arc(eyeX, -5, 3, 0, Math.PI * 2); ctx.fill();
          } else {
            // Blue Robot (Square)
            ctx.fillStyle = "#3b82f6";
            ctx.beginPath();
            ctx.roundRect(-20, -20, 40, 40, 4);
            ctx.fill();
            // Visor
            ctx.fillStyle = "#93c5fd";
            const visorX = p.facing === "right" ? 5 : -25;
            ctx.fillRect(visorX, -10, 20, 10);
          }
          ctx.restore();

          // Name Tag
          ctx.fillStyle = "white";
          ctx.font = "bold 12px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(p.id === "NPC_COM" ? "NPC_COM" : p.id.substring(0, 6), p.x, p.y - 30);
        });
      }

      animationId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationId);
  }, [gameState]);

  const formatTime = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}:${sec.toString().padStart(2, "0")}`;
  };

  const handleRestart = () => {
    wsRef.current?.send(JSON.stringify({ type: "restart" }));
  };

  return (
    <div className="flex flex-col items-center min-h-screen p-4 overflow-hidden bg-slate-950">
      {/* Header UI */}
      <div className="w-full max-w-[800px] flex items-center justify-between mb-4 bg-slate-900/50 p-4 rounded-2xl border border-white/5 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-white/10 rounded-xl transition-colors group"
          >
            <ArrowLeft className="w-6 h-6 text-slate-400 group-hover:text-white" />
          </button>
          <div>
            <h2 className="text-lg font-bold text-white leading-tight">Snow Bros Arena</h2>
            <p className="text-sm text-slate-500 flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              {isConnected ? 'Server Live' : 'Disconnected'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-8">
            <div className="flex flex-col items-center">
                <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Time Left</span>
                <div className="flex items-center gap-2 text-2xl font-mono text-cyan-400">
                    <Timer className="w-5 h-5" />
                    {formatTime(gameState?.timeLeft || 300000)}
                </div>
            </div>
            
            <button 
                onClick={handleRestart}
                className="p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors"
                title="Restart Game"
            >
                <RefreshCcw className="w-5 h-5 text-slate-400" />
            </button>
        </div>
      </div>

      {/* Game Area */}
      <div className="relative group">
        <canvas
          id="GameCanvas"
          ref={canvasRef}
          width={800}
          height={600}
          className="rounded-3xl shadow-2xl border-4 border-slate-800 bg-slate-900 cursor-none"
        />

        {/* Global Scores Overlay */}
        <div className="absolute top-6 left-6 right-6 flex justify-between pointer-events-none">
            {gameState && Object.values(gameState.players).map((p: any, i: number) => (
                <motion.div 
                    key={p.id}
                    initial={{ opacity: 0, x: i === 0 ? -20 : 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`flex items-center gap-4 bg-black/40 backdrop-blur-md p-3 px-6 rounded-2xl border border-white/10 shadow-xl`}
                >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${p.isNpc || i === 1 ? 'bg-yellow-500' : 'bg-blue-500'}`}>
                        <Trophy className="w-6 h-6 text-black" />
                    </div>
                    <div>
                        <p className="text-[10px] uppercase text-slate-400 font-bold tracking-tighter">PLAYER {i+1} {p.id === "NPC_COM" && "(CPU)"}</p>
                        <p className="text-xl font-black text-white">{p.score}</p>
                    </div>
                </motion.div>
            ))}
        </div>

        {/* Game Over Overlay */}
        {gameState?.status === "ended" && (
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center rounded-3xl z-50">
                <motion.h2 
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-6xl font-black text-white mb-8 tracking-tighter"
                >
                    GAME OVER
                </motion.h2>
                <div className="flex gap-8 mb-12">
                     {Object.values(gameState.players).map((p: any, i: number) => (
                        <div key={p.id} className="text-center">
                            <p className="text-slate-400 font-bold mb-2">P{i+1} SCORE</p>
                            <p className="text-4xl font-black text-white">{p.score}</p>
                        </div>
                     ))}
                </div>
                <button 
                  onClick={handleRestart}
                  className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-2xl shadow-xl transition-all active:scale-95"
                >
                    PLAY AGAIN
                </button>
            </div>
        )}
      </div>

      <div className="mt-6 flex gap-8 text-slate-500 font-medium">
        <div className="flex items-center gap-2">
            <kbd className="px-2 py-1 bg-slate-800 rounded border border-white/5 text-[10px]">WASD</kbd>
            <span className="text-sm">Move & Jump</span>
        </div>
        <div className="flex items-center gap-2">
            <kbd className="px-2 py-1 bg-slate-800 rounded border border-white/5 text-[10px]">Space</kbd>
            <span className="text-sm">Jump</span>
        </div>
      </div>
    </div>
  );
}
