import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { useAuthStore } from "./state/authStore";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { OAuthCallback } from "./pages/OAuthCallback";
import { BoardPage } from "./pages/BoardPage";
import { BoardSocketProvider } from "./contexts/BoardSocketProvider";
import { BoardsPage } from "./pages/BoardsPage";

// App is the root component for CanvasLeap's frontend.
export default function App() {
  const init = useAuthStore((s) => s.initFromStorage);

  useEffect(() => {
    init();
  }, [init]);

  return (
    <div className="h-dvh w-dvw bg-background text-foreground overflow-hidden">
      <BrowserRouter>
        <BoardSocketProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/oauth/callback" element={<OAuthCallback />} />
            <Route path="/boards" element={<Protected><BoardsPage /></Protected>} />
            <Route path="/boards/:id" element={<Protected><BoardPage /></Protected>} />
            <Route path="/" element={<Navigate to="/boards" replace />} />
            <Route path="*" element={<Navigate to="/boards" replace />} />
          </Routes>
        </BoardSocketProvider>
      </BrowserRouter>
      <Toaster />
    </div>
  );
}

function Protected({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}
