import { useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Passwort zurücksetzen – Kanzleiakte" },
      { name: "description", content: "Lege ein neues Passwort für deine Kanzleiakte fest." },
      { property: "og:title", content: "Passwort zurücksetzen – Kanzleiakte" },
      { property: "og:description", content: "Lege ein neues Passwort für deine Kanzleiakte fest." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Passwort geändert");
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <form onSubmit={submit} className="paper-sheet w-full max-w-sm space-y-4 rounded-lg p-8">
        <h1 className="gold-rule text-3xl font-semibold">Neues Passwort</h1>
        <div className="space-y-1.5">
          <Label htmlFor="pw">Neues Passwort</Label>
          <Input id="pw" type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <Button type="submit" className="w-full" disabled={busy}>
          Speichern
        </Button>
      </form>
    </div>
  );
}
