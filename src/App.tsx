import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SaasProvider } from "@/contexts/SaasContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { AdminProtectedRoute, ProtectedRoute } from "@/components/ProtectedRoute";
import LandingPage from "./pages/LandingPage";
import Onboarding from "./pages/Onboarding";
import AdminDashboard from "./pages/AdminDashboard";
import PublicBooking from "./pages/PublicBooking";
import LoginPage from "./pages/LoginPage";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import PlansPage from "./pages/PlansPage";
import DemoBar from "./components/DemoBar";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <SaasProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              {/* SaaS Home / Landing Page */}
              <Route path="/" element={<LandingPage />} />

              {/* Autenticação */}
              <Route path="/login" element={<LoginPage />} />
              <Route
                path="/planos"
                element={
                  <ProtectedRoute>
                    <PlansPage />
                  </ProtectedRoute>
                }
              />

              {/* 3-Step Self-service Onboarding */}
              <Route path="/onboarding" element={<Onboarding />} />

              {/* Dynamic Multi-tenant Admin Dashboard — PROTEGIDO */}
              <Route
                path="/admin"
                element={
                  <AdminProtectedRoute>
                    <AdminDashboard />
                  </AdminProtectedRoute>
                }
              />

              {/* Legacy Single-Tenant reference */}
              <Route path="/legacy-nails" element={<Index />} />

              {/* Public Dynamic Booking per Tenant — sem autenticação (clientes) */}
              <Route path="/agendar/:slug" element={<PublicBooking />} />
              <Route path="/:slug" element={<PublicBooking />} />

              {/* 404 Catch-All */}
              <Route path="*" element={<NotFound />} />
            </Routes>

            {/* Demo switcher — apenas páginas públicas de booking */}
            <DemoBar />
          </BrowserRouter>
        </TooltipProvider>
      </SaasProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
