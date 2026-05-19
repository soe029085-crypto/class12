/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import Login from "./components/Login";
import Game from "./components/Game";

type View = "login" | "game";

export default function App() {
  const [view, setView] = useState<View>("login");
  const [user, setUser] = useState<{ id: string } | null>(null);

  const handleLogin = (id: string) => {
    setUser({ id });
    setView("game");
  };

  const handleLogout = () => {
    setUser(null);
    setView("login");
  };

  return (
    <div className="min-h-screen bg-neutral-900 text-white font-sans selection:bg-blue-500/30">
      {view === "login" ? (
        <Login onLogin={handleLogin} />
      ) : (
        <Game user={user!} onBack={handleLogout} />
      )}
    </div>
  );
}
