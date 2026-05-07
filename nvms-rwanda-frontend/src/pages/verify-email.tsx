import { Link, useSearchParams } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import nvmsLogo from "@/assets/nvms-logo.png";
import { CheckCircle2, Link2 } from "lucide-react";

/** Placeholder for email verification callback (token in query string once API exists). */
function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get("token");

  return (
    <div className="flex min-h-screen">
      <div className="relative hidden flex-1 flex-col justify-between overflow-hidden bg-gradient-hero p-10 text-white lg:flex">
        <Logo variant="light" />
        <div className="relative z-10 flex flex-col items-center gap-8 text-center">
          <img src={nvmsLogo} alt="" className="h-32 w-32 object-contain drop-shadow-2xl md:h-40 md:w-40" width={160} height={160} />
          <div>
            <h2 className="font-display text-3xl font-bold leading-tight md:text-4xl">Confirm your email</h2>
            <p className="mx-auto mt-4 max-w-md text-sm text-white/85">
              Email verification helps protect volunteer accounts and keeps district coordinators informed.
            </p>
          </div>
        </div>
        <p className="text-xs text-white/60">NVMS Rwanda · MINALOC</p>
      </div>

      <div className="flex flex-1 items-center justify-center bg-muted/20 p-6">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center lg:hidden">
            <Logo className="mx-auto" />
          </div>
          <Card className="border-border/80 shadow-lg shadow-primary/5">
            <CardHeader>
              <div className="flex items-center gap-2 text-primary">
                {token ? <CheckCircle2 className="h-5 w-5" /> : <Link2 className="h-5 w-5" />}
                <span className="text-xs font-semibold uppercase tracking-wider">Verification</span>
              </div>
              <CardTitle className="font-display text-2xl">Verify email</CardTitle>
              <CardDescription>
                {token
                  ? "This screen will confirm your token with the server and activate your account when the API is connected."
                  : "Open the verification link from your email. No token was provided in this URL."}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {token && (
                <div className="rounded-md border border-border bg-muted/40 px-3 py-2 font-mono text-xs text-muted-foreground break-all">
                  token=…{token.slice(0, 12)}…
                </div>
              )}
              <Button asChild className="h-11 w-full">
                <Link to="/login">Go to sign in</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default VerifyEmailPage;
