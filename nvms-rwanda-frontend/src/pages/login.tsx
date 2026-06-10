import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth, dashboardPathFor } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";
import { AlertCircle } from "lucide-react";
import nvmsLogo from "@/assets/nvms-logo.png";


function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const res = await login(email, password);
    if (!res.ok) {
      setError(res.error || "Invalid credentials");
      return;
    }
    if (res.mustChangePassword) {
      toast.message("Password update required", {
        description: "Change your temporary password before continuing.",
      });
      navigate("/change-password");
      return;
    }
    toast.success(`Welcome back, ${res.user!.name.split(" ")[0]}`);
    navigate(dashboardPathFor(res.user!.role));
  };

  return (
    <div className="flex min-h-screen">
      <div className="relative hidden flex-1 flex-col justify-between overflow-hidden bg-gradient-hero p-10 text-white lg:flex">
        <Logo variant="light" />
        <div className="relative z-10 flex flex-col items-center gap-6 text-center">
          <img
            src={nvmsLogo}
            alt="NVMS Rwanda logo"
            className="h-36 w-36 object-contain drop-shadow-2xl md:h-44 md:w-44"
            width={176}
            height={176}
          />
          <div>
            <h2 className="font-display text-4xl font-bold leading-tight">Welcome to Rwanda's national volunteer platform</h2>
            <p className="mx-auto mt-4 max-w-md text-white/80">Sign in to access your dashboard — whether you're a volunteer, program coordinator, or ministry administrator.</p>
          </div>
        </div>
        <p className="text-xs text-white/60">© {new Date().getFullYear()} Ministry of Local Government · Republic of Rwanda</p>
      </div>

      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden"><Logo /></div>
          <h1 className="font-display text-3xl font-bold">Sign in</h1>
          <p className="mt-2 text-sm text-muted-foreground">Use the email and password you registered with.</p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            {error && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.rw" required />
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link to="/forgot-password" className="text-xs font-medium text-primary hover:underline">
                  Forgot password?
                </Link>
              </div>
              <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full">Sign in</Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            Don't have an account? <Link to="/register" className="font-medium text-primary hover:underline">Register</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
