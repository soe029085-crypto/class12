import express from "express";
import path from "path";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";
import Papa from "papaparse";
import dotenv from "dotenv";

dotenv.config();

const PORT = 3000;
const REFRESH_RATE = 60; //Hz
const TICK_INTERVAL = 1000 / REFRESH_RATE;
const GAME_DURATION = 5 * 60 * 1000; // 5 minutes

// Game State Types
interface Player {
  id: string;
  isNpc: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  score: number;
  facing: "left" | "right";
  isJumping: boolean;
}

interface Item {
  id: string;
  type: "red" | "yellow" | "green" | "bomb";
  x: number;
  y: number;
}

interface GameState {
  players: Record<string, Player>;
  items: Item[];
  timeLeft: number; // ms
  status: "lobby" | "playing" | "ended";
}

let gameState: GameState = {
  players: {},
  items: [],
  timeLeft: GAME_DURATION,
  status: "lobby",
};

// Map Data (Simple platforms for "Snow Bros" style)
const PLATFORMS = [
  { x: 0, y: 550, w: 800, h: 50 }, // Ground
  { x: 100, y: 450, w: 200, h: 20 },
  { x: 500, y: 450, w: 200, h: 20 },
  { x: 300, y: 350, w: 200, h: 20 },
  { x: 100, y: 250, w: 200, h: 20 },
  { x: 500, y: 250, w: 200, h: 20 },
  { x: 300, y: 150, w: 200, h: 20 },
];

const ITEM_TYPES = ["red", "yellow", "green", "bomb"] as const;
const ITEM_SCORES = {
  red: 10,
  yellow: 20,
  green: 50,
  bomb: -50,
};

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const wss = new WebSocketServer({ server: httpServer });

  app.use(express.json());

  // 1. Login API Logic
  app.post("/api/login", async (req, res) => {
    const { id, password } = req.body;
    const sheetId = "1FM6pUWt414vao1ePQps_D5KeXOFeg5UcZJFU2y5ox1o";
    const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch sheet data");
      const csvText = await response.text();
      const { data } = Papa.parse(csvText, { header: false });

      // CSV structure: col 0 is NO, col 1 is ID, col 2 is PW
      const users = (data as string[][]).slice(1);
      const validUser = users.find(row => row[1]?.trim() === id && row[2]?.trim() === password);

      if (validUser) {
        res.json({ success: true });
      } else {
        res.status(401).json({ success: false, message: "Invalid ID or password" });
      }
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ success: false, message: "Server error during validation" });
    }
  });

  // 2. WebSocket Game Logic
  const clients = new Map<string, WebSocket>();

  wss.on("connection", (ws) => {
    const clientId = Math.random().toString(36).substring(7);
    clients.set(clientId, ws);

    ws.on("message", (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        if (data.type === "join") {
          handleJoin(clientId);
        } else if (data.type === "input") {
          handleInput(clientId, data.input);
        } else if (data.type === "restart") {
            resetGame();
        }
      } catch (e) {
        console.error("WS Message Error:", e);
      }
    });

    ws.on("close", () => {
      clients.delete(clientId);
      delete gameState.players[clientId];
      checkPlayers();
    });
  });

  function handleJoin(id: string) {
    if (Object.keys(gameState.players).length >= 2) {
      // Game Full
      return;
    }

    gameState.players[id] = {
      id,
      isNpc: false,
      x: Object.keys(gameState.players).length === 0 ? 100 : 700,
      y: 500,
      vx: 0,
      vy: 0,
      score: 0,
      facing: "right",
      isJumping: false,
    };

    checkPlayers();
  }

  function checkPlayers() {
    const realPlayers = Object.values(gameState.players).filter(p => !p.isNpc);
    
    if (realPlayers.length === 1) {
      // Add NPC if only one player
      if (!Object.values(gameState.players).some(p => p.isNpc)) {
        const npcId = "NPC_COM";
        gameState.players[npcId] = {
          id: npcId,
          isNpc: true,
          x: 700,
          y: 500,
          vx: 0,
          vy: 0,
          score: 0,
          facing: "left",
          isJumping: false,
        };
      }
    } else if (realPlayers.length === 2) {
      // Remove NPC if two real players
      const npcId = "NPC_COM";
      if (gameState.players[npcId]) {
        delete gameState.players[npcId];
      }
      // Reset game when 2nd player joins as requested
      resetGame();
      gameState.status = "playing";
    }

    if (realPlayers.length > 0 && gameState.status === "lobby") {
        gameState.status = "playing";
        gameState.timeLeft = GAME_DURATION;
    }
  }

  function resetGame() {
    gameState.timeLeft = GAME_DURATION;
    gameState.items = [];
    Object.values(gameState.players).forEach((p, idx) => {
        p.score = 0;
        p.x = idx === 0 ? 100 : 700;
        p.y = 500;
        p.vx = 0;
        p.vy = 0;
    });
    gameState.status = "playing";
  }

  function handleInput(id: string, input: any) {
    const p = gameState.players[id];
    if (!p || p.isNpc) return;

    if (input.left) {
      p.vx = -5;
      p.facing = "left";
    } else if (input.right) {
      p.vx = 5;
      p.facing = "right";
    } else {
      p.vx = 0;
    }

    if (input.jump && !p.isJumping) {
      p.vy = -12;
      p.isJumping = true;
    }
  }

  // Physics & NPC Loop
  setInterval(() => {
    if (gameState.status !== "playing") return;

    // Timer
    gameState.timeLeft -= TICK_INTERVAL;
    if (gameState.timeLeft <= 0) {
      gameState.status = "ended";
    }

    // Spawn Items
    if (gameState.items.length < 5 && Math.random() < 0.05) {
      let spawnX = 0, spawnY = 0, isValid = false;
      let attempts = 0;
      while (!isValid && attempts < 10) {
        spawnX = Math.random() * 760 + 20;
        spawnY = Math.random() * 400 + 100;
        isValid = !PLATFORMS.some(plat => (
          spawnX > plat.x - 15 && spawnX < plat.x + plat.w + 15 &&
          spawnY > plat.y - 15 && spawnY < plat.y + plat.h + 15
        ));
        attempts++;
      }
      
      if (isValid) {
        gameState.items.push({
          id: Math.random().toString(36).substring(7),
          type: ITEM_TYPES[Math.floor(Math.random() * ITEM_TYPES.length)],
          x: spawnX,
          y: spawnY,
        });
      }
    }

    // Update Players
    Object.values(gameState.players).forEach(p => {
      // Simple Gravity & Physics
      p.vy += 0.5; // Gravity
      p.x += p.vx;
      p.y += p.vy;

      // Platform Collision
      let onPlatform = false;
      PLATFORMS.forEach(plat => {
        if (p.x + 20 > plat.x && p.x - 20 < plat.x + plat.w) {
          if (p.y > plat.y - 20 && p.y < plat.y + plat.h && p.vy > 0) {
            p.y = plat.y - 20;
            p.vy = 0;
            p.isJumping = false;
            onPlatform = true;
          }
        }
      });

      // Bound checks
      if (p.x < 20) p.x = 20;
      if (p.x > 780) p.x = 780;

      // Item Collision
      gameState.items = gameState.items.filter(item => {
        const dx = p.x - item.x;
        const dy = p.y - item.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 30) {
          p.score += ITEM_SCORES[item.type];
          // Broadcast effect will be handled by client receiving score change
          // But we could add an event type as well
          clients.forEach(c => c.send(JSON.stringify({ type: "effect", itemType: item.type, x: item.x, y: item.y })));
          return false;
        }
        return true;
      });

      // NPC Logic
      if (p.isNpc) {
        const target = gameState.items.find(i => i.type !== "bomb");
        if (target) {
            if (p.x < target.x) p.vx = 1.5;
            else if (p.x > target.x) p.vx = -1.5;
            else p.vx = 0;

            if (target.y < p.y - 50 && !p.isJumping) {
                p.vy = -12;
                p.isJumping = true;
            }
        } else {
            p.vx = 0;
        }
      }
    });

    // Broadcast State
    const payload = JSON.stringify({ type: "state", state: gameState });
    clients.forEach(c => c.send(payload));
  }, TICK_INTERVAL);

  // 3. Vite Middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
