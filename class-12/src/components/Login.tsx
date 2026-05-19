import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AlertCircle, Lock, User, Info } from "lucide-react";

interface LoginProps {
  onLogin: (id: string) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, password }),
      });

      const data = await res.json();

      if (data.success) {
        onLogin(id);
      } else {
        setError(data.message || "Invalid ID or password");
      }
    } catch (err) {
      setError("Connection error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-br from-indigo-950 via-slate-900 to-black">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white/10 backdrop-blur-xl p-8 rounded-3xl border border-white/10 shadow-2xl"
      >
        <div className="text-center mb-8">
          <motion.h1 
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent mb-2"
          >
            SNOW BROS ARENA
          </motion.h1>
          <p className="text-slate-400">Enter the battlefield</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300 ml-1">Login ID</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                type="text"
                value={id}
                onChange={(e) => setId(e.target.value)}
                placeholder="a1234"
                className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-11 pr-4 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all placeholder:text-slate-600"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300 ml-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••"
                className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-11 pr-4 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all placeholder:text-slate-600"
                required
              />
            </div>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-xl flex items-center gap-3"
              >
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span className="text-sm">{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-500/25 disabled:opacity-50 transition-all transform active:scale-[0.98]"
          >
            {isLoading ? "Authenticating..." : "START GAME"}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-white/5 flex items-start gap-3 bg-blue-500/5 p-4 rounded-2xl">
          <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
          <p className="text-xs text-slate-400 leading-relaxed">
            <span className="text-blue-400 font-semibold">Important:</span> Please contact the administrator to create your ID or password if you don't have one.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
