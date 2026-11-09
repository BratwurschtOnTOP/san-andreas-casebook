import type { ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpenText, Calculator, FileSignature, Gavel, LayoutDashboard, LogOut, Scale, ShieldCheck, UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { profileQuery } from "@/lib/queries";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/dashboard", label: "Übersicht", icon: LayoutDashboard },
  { to: "/bussgeldkatalog", label: "Bußgeldkatalog", icon: Gavel },
  { to: "/leistungen", label: "Leistungen", icon: BookOpenText },
  { to: "/gebuehren", label: "Gebührenrechner", icon: Calculator },
  { to: "/familienlizenz", label: "Familienlizenz", icon: FileSignature },
  { to: "/einsicht", label: "14-Tage-Einsicht", icon: ShieldCheck },
  { to: "/profil", label: "Anwaltsprofil", icon: UserRound },
] as const;

export function AppShell({
  title,
  eyebrow,
  actions,
  children,
}: {
  title: string;
  eyebrow?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: profile } = useQuery(profileQuery());

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen md:flex">
      <aside className="no-print bg-sidebar text-sidebar-foreground md:sticky md:top-0 md:h-screen md:w-64 md:shrink-0 flex flex-col">
        <div className="flex items-center gap-3 px-5 py-5 border-b border-sidebar-border">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-gold/60 text-gold">
            <Scale className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <div className="font-display text-xl font-semibold">Kanzleiakte</div>
            <div className="text-[0.65rem] uppercase tracking-[0.2em] text-sidebar-foreground/60">
              San Andreas · RAVO
            </div>
          </div>
        </div>
        <nav className="flex md:flex-col gap-1 overflow-x-auto px-3 py-3 md:py-5">
          {NAV.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="flex shrink-0 items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground border-l-2 border-gold" }}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto hidden md:block border-t border-sidebar-border px-5 py-4">
          <div className="text-sm font-medium truncate">{profile?.full_name || "Profil unvollständig"}</div>
          <div className="text-xs text-sidebar-foreground/60">
            {profile?.lawyer_type === "orgaanwalt" ? "Organisationsanwalt" : "Rechtsanwalt"}
          </div>
          <Button variant="ghostLight" size="sm" className="mt-3 w-full" onClick={signOut}>
            <LogOut /> Abmelden
          </Button>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <header className="no-print flex flex-wrap items-end justify-between gap-4 border-b border-border px-6 py-6 md:px-10">
          <div>
            {eyebrow && <div className="eyebrow mb-1">{eyebrow}</div>}
            <h1 className="gold-rule text-3xl md:text-4xl font-semibold text-foreground">{title}</h1>
          </div>
          <div className="flex items-center gap-2">
            {actions}
            <Button variant="outline" size="sm" className="md:hidden" onClick={signOut}>
              <LogOut /> Abmelden
            </Button>
          </div>
        </header>
        <div className="px-6 py-8 md:px-10">{children}</div>
      </main>
    </div>
  );
}
