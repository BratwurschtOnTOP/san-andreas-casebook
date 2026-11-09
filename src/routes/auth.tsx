import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Scale } from "lucide-react";
import { toast } from "sonner";
import "@lovable.dev/cloud-auth-js/styles.css";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Anmelden – Kanzleiakte" },
      { name: "description", content: "Melde dich bei deiner Kanzleiakte an oder registriere dich als Anwalt." },
      { property: "og:title", content: "Anmelden – Kanzleiakte" },
      { property: "og:description", content: "Melde dich bei deiner Kanzleiakte an oder registriere dich als Anwalt." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function GoogleLogo() {
  return (
    <svg aria-hidden="true" width="18" height="18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.730-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.160-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z" />
      <path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z" />
      <path fill="#EA4335" d="M12 4.75c1.770 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z" />
    </svg>
  );
}

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmSent, setConfirmSent] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return toast.error(error.message === "Invalid login credentials" ? "E-Mail oder Passwort falsch" : error.message);
    navigate({ to: "/dashboard", replace: true });
  }

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin + "/dashboard", data: { full_name: fullName } },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    if (data.session) navigate({ to: "/dashboard", replace: true });
    else setConfirmSent(true);
  }

  async function forgot() {
    if (!email) return toast.error("Bitte zuerst deine E-Mail eingeben");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) return toast.error(error.message);
    toast.success("Link zum Zurücksetzen wurde gesendet");
  }

  async function oauth(provider: "google" | "lovable") {
    const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin });
    if (result.error) return toast.error(result.error.message);
    if (result.redirected) return;
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-gold text-gold">
            <Scale className="h-6 w-6" />
          </div>
          <div className="font-display text-3xl font-semibold">Kanzleiakte</div>
          <div className="eyebrow">Rechtsanwaltskammer San Andreas</div>
        </Link>

        <div className="paper-sheet rounded-lg p-6 md:p-8">
          {confirmSent ? (
            <div className="text-center space-y-3">
              <h2 className="text-2xl font-semibold">Bitte E-Mail bestätigen</h2>
              <p className="text-sm text-muted-foreground">
                Wir haben einen Bestätigungslink an <strong>{email}</strong> gesendet. Danach kannst du dich anmelden.
              </p>
              <Button variant="outline" onClick={() => setConfirmSent(false)}>
                Zurück zur Anmeldung
              </Button>
            </div>
          ) : (
            <>
              <div className="grid gap-2">
                <Button type="button" className="google-btn h-10 w-full" onClick={() => oauth("google")}>
                  <GoogleLogo />
                  Continue with Google
                </Button>
                <button type="button" className="lovable-auth-button w-full" onClick={() => oauth("lovable")}>
                  Continue with Lovable
                </button>
              </div>
              <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-widest text-muted-foreground">
                <div className="h-px flex-1 bg-border" /> oder <div className="h-px flex-1 bg-border" />
              </div>

              <Tabs defaultValue="login">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="login">Anmelden</TabsTrigger>
                  <TabsTrigger value="signup">Registrieren</TabsTrigger>
                </TabsList>
                <TabsContent value="login">
                  <form onSubmit={signIn} className="mt-4 space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="email">E-Mail</Label>
                      <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="password">Passwort</Label>
                      <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                    </div>
                    <Button type="submit" className="w-full" disabled={busy}>
                      {busy ? "Bitte warten…" : "Anmelden"}
                    </Button>
                    <button type="button" onClick={forgot} className="block w-full text-center text-xs text-muted-foreground underline-offset-4 hover:underline">
                      Passwort vergessen?
                    </button>
                  </form>
                </TabsContent>
                <TabsContent value="signup">
                  <form onSubmit={signUp} className="mt-4 space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="full_name">Name (im Spiel)</Label>
                      <Input id="full_name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="z. B. Saul Goodman" required />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="email2">E-Mail</Label>
                      <Input id="email2" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="password2">Passwort</Label>
                      <Input id="password2" type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required />
                    </div>
                    <Button type="submit" className="w-full" disabled={busy}>
                      {busy ? "Bitte warten…" : "Konto erstellen"}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </>
          )}
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Hinweis: Alle Angaben unterliegen dem Anwaltsgeheimnis (§5 RAVO). Jeder Anwalt sieht nur seine eigenen Einträge.
        </p>
      </div>
    </div>
  );
}
