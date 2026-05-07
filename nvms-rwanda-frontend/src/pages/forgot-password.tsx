import { Link } from "react-router-dom";
import { useState } from "react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import nvmsLogo from "@/assets/nvms-logo.png";
import { Mail, Shield } from "lucide-react";

/** Placeholder until the backend exposes a secure password-reset flow. */
function ForgotPasswordPage() {
  const [email, setEmail] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success("If this email is registered, reset instructions will be sent (backend required).");
  };

  return (
    <div className="flex min-h-screen">
      <div className="relative hidden flex-1 flex-col justify-between overflow-hidden bg-gradient-hero p-10 text-white lg:flex">
        <Logo variant="light" />
        <div className="relative z-10 flex flex-col items-center gap-8 text-center">
          <img
            src={nvmsLogo}
            alt=""
            className="h-32 w-32 object-contain drop-shadow-2xl md:h-40 md:w-40"
            width={160}
            height={160}
          />
          <div>
            <h2 className="font-display text-3xl font-bold leading-tight md:text-4xl">Secure account recovery</h2>
            <p className="mx-auto mt-4 max-w-md text-sm text-white/85">
              NVMS Rwanda uses ministry-grade authentication. Reset links are single-use and expire quickly once the production service is live.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-medium backdrop-blur">
            <Shield className="h-3.5 w-3.5" />
            MINALOC · Republic of Rwanda
          </div>
        </div>
        <p className="text-xs text-white/60">© {new Date().getFullYear()} Ministry of Local Government</p>
      </div>

      <div className="flex flex-1 items-center justify-center bg-muted/20 p-6">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          <Card className="border-border/80 shadow-lg shadow-primary/5">
            <CardHeader className="space-y-1 pb-4">
              <div className="flex items-center gap-2 text-primary">
                <Mail className="h-5 w-5" />
                <span className="text-xs font-semibold uppercase tracking-wider">Account</span>
              </div>
              <CardTitle className="font-display text-2xl">Reset password</CardTitle>
              <CardDescription>
                Enter the email linked to your volunteer or staff account. We will send a time-limited link from the ministry authentication service when the backend is connected.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={submit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email">Email</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className="h-11"
                    placeholder="you@example.rw"
                  />
                </div>
                <Button type="submit" className="h-11 w-full">
                  Send reset link
                </Button>
              </form>
              <p className="mt-6 text-center text-sm text-muted-foreground">
                <Link to="/login" className="font-medium text-primary hover:underline">Back to sign in</Link>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default ForgotPasswordPage;
