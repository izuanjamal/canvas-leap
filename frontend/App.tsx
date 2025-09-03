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
import { SharedBoardPage } from "./pages/SharedBoardPage";
import { DashboardPage } from "./pages/Dashboard";

// App is the root component for CanvasLeap's frontend.
export default function App() {
  const init = useAuthStore((s) => s.initFromStorage);
  const checkSession = useAuthStore((s) => s.checkSession);

  useEffect(() => {
    init();
    // Try to hydrate user from session cookie if present
    checkSession().catch(() => {});
  }, [init, checkSession]);

  return (
    <div className="h-dvh w-dvw bg-background text-foreground overflow-hidden">
      <BrowserRouter>
        <BoardSocketProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/auth/callback/google" element={<OAuthCallback />} />
            <Route path="/dashboard" element={<Protected><DashboardPage /></Protected>} />
            <Route path="/boards" element={<Protected><BoardsPage /></Protected>} />
            <Route path="/boards/:id" element={<Protected><BoardPage /></Protected>} />
            <Route path="/board/:id" element={<Protected><BoardPage /></Protected>} />
            <Route path="/s/:token" element={<SharedBoardPage />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BoardSocketProvider>
      </BrowserRouter>
      <Toaster />
    </div>
  );
}

function Protected({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  if (!token && !user) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}
