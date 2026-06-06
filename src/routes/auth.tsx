import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { supabase } from "@/integrations/supabase/client";
import { registerWithActivationCode, loginWithActivationCode } from "@/lib/auth.functions";
import { useLang } from "@/lib/i18n";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({
    mode: (s.mode === "register" ? "register" : "login") as "login" | "register",
  }),
  head: () => ({
    meta: [
      { title: "Sign in — ASTRA STUDIO" },
      { name: "description", content: "Sign in or register with an activation code." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { t } = useLang();
  const { mode } = Route.useSearch();
  const [tab, setTab] = useState<"login" | "register">(mode);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginCode, setLoginCode] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);

  const [regEmail, setRegEmail] = useState("");
  const [regCode, setRegCode] = useState("");
  const [regName, setRegName] = useState("");
  const [regBusy, setRegBusy] = useState(false);

  const registerFn = useServerFn(registerWithActivationCode);
  const loginFn = useServerFn(loginWithActivationCode);

  const exchangeToken = async (tokenHash: string) => {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
    if (error) throw error;
  };

  const onLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginBusy(true);
    try {
      const res = await loginFn({
        data: { email: loginEmail.trim(), activationCode: loginCode.trim() },
      });
      if (!res.ok) {
        setLoginBusy(false);
        toast.error(res.error);
        return;
      }
      await exchangeToken(res.tokenHash);
      setLoginBusy(false);
      toast.success(t("Welcome back"));
      navigate({ to: "/dashboard" });
    } catch (err) {
      setLoginBusy(false);
      toast.error(err instanceof Error ? err.message : "Sign in failed");
    }
  };

  const onRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegBusy(true);
    try {
      const res = await registerFn({
        data: {
          email: regEmail.trim(),
          activationCode: regCode.trim(),
          displayName: regName.trim() || undefined,
        },
      });
      if (!res.ok) {
        toast.error(res.error);
        setRegBusy(false);
        return;
      }
      await exchangeToken(res.tokenHash);
      setRegBusy(false);
      toast.success(t("Account created"));
      navigate({ to: "/dashboard" });
    } catch (err) {
      setRegBusy(false);
      toast.error(err instanceof Error ? err.message : t("Registration failed"));
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-10">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="grid size-9 place-items-center rounded-md bg-primary text-primary-foreground font-bold">
              A
            </div>
            <div className="leading-tight">
              <div className="font-bold tracking-tight">ASTRA STUDIO</div>
              <div className="text-xs text-muted-foreground">{t("by GX Team")}</div>
            </div>
          </Link>
          <LanguageToggle /><ThemeToggle />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("Welcome")}</CardTitle>
            <CardDescription>
              {t("Owner-controlled access. New accounts require an activation code.")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={tab} onValueChange={(v) => setTab(v as "login" | "register")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">{t("Sign in")}</TabsTrigger>
                <TabsTrigger value="register">{t("Register")}</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={onLogin} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="li-email">{t("Email")}</Label>
                    <Input id="li-email" type="email" required autoComplete="email"
                      value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="li-code">{t("Activation code")}</Label>
                    <Input id="li-code" type="text" required autoComplete="off"
                      value={loginCode}
                      onChange={(e) => setLoginCode(e.target.value.toUpperCase())}
                      placeholder="ASTRA-XXXX-XXXX" />
                  </div>
                  <Button type="submit" className="w-full" disabled={loginBusy}>
                    {loginBusy ? t("Signing in…") : t("Sign in")}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    {t("Lost your code? Contact the admin: 01095777037")}
                  </p>
                </form>
              </TabsContent>

              <TabsContent value="register">
                <form onSubmit={onRegister} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="rg-name">{t("Display name (optional)")}</Label>
                    <Input id="rg-name" value={regName} onChange={(e) => setRegName(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="rg-email">{t("Email")}</Label>
                    <Input id="rg-email" type="email" required autoComplete="email"
                      value={regEmail} onChange={(e) => setRegEmail(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="rg-code">{t("Activation code")}</Label>
                    <Input id="rg-code" required type="text" autoComplete="off" value={regCode}
                      onChange={(e) => setRegCode(e.target.value.toUpperCase())}
                      placeholder="ASTRA-XXXX-XXXX" />
                  </div>
                  <Button type="submit" className="w-full" disabled={regBusy}>
                    {regBusy ? t("Creating account…") : t("Create account")}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
