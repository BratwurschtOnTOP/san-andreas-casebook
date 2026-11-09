import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft, Copy, Printer, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { FamilyDocument, familyDocumentText } from "@/components/FamilyDocument";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { STATUS_LABELS, applicationQuery, errorMessage, type ApplicationStatus } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/familienlizenz/$id")({
  head: () => ({
    meta: [
      { title: "Antrag auf Familienlizenz – Kanzleiakte" },
      { name: "description", content: "Antrag auf eine Familienlizenz ansehen, drucken und Status verwalten." },
      { property: "og:title", content: "Antrag auf Familienlizenz – Kanzleiakte" },
      { property: "og:description", content: "Antrag auf eine Familienlizenz ansehen, drucken und Status verwalten." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: async ({ context, params }) => {
    const app = await context.queryClient.ensureQueryData(applicationQuery(params.id));
    if (!app) throw notFound();
  },
  notFoundComponent: () => (
    <div className="p-10 text-center">
      Antrag nicht gefunden. <Link to="/familienlizenz" className="underline">Zurück</Link>
    </div>
  ),
  component: ApplicationDetail,
});

function ApplicationDetail() {
  const { id } = Route.useParams();
  const { data } = useSuspenseQuery(applicationQuery(id));
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const setStatus = useMutation({
    mutationFn: async (status: ApplicationStatus) => {
      const { error } = await supabase.from("family_applications").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status aktualisiert");
      queryClient.invalidateQueries({ queryKey: ["family_applications"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("family_applications").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Antrag gelöscht");
      queryClient.invalidateQueries({ queryKey: ["family_applications"] });
      navigate({ to: "/familienlizenz" });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (!data) return null;

  async function copy() {
    await navigator.clipboard.writeText(familyDocumentText(data!));
    toast.success("Antragstext kopiert");
  }

  return (
    <AppShell
      eyebrow="§7 RAVO"
      title={`Familie ${data.family_name}`}
      actions={
        <>
          <Button variant="outline" asChild>
            <Link to="/familienlizenz">
              <ArrowLeft /> Zurück
            </Link>
          </Button>
          <Button variant="outline" onClick={copy}>
            <Copy /> Text kopieren
          </Button>
          <Button onClick={() => window.print()}>
            <Printer /> Drucken / PDF
          </Button>
        </>
      }
    >
      <div className="no-print mb-6 flex flex-wrap items-center gap-3">
        <span className="text-sm text-muted-foreground">Status:</span>
        <Select value={data.status} onValueChange={(v) => setStatus.mutate(v as ApplicationStatus)}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(STATUS_LABELS) as ApplicationStatus[]).map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="ghost"
          className="ml-auto text-destructive"
          onClick={() => {
            if (confirm("Antrag wirklich löschen?")) remove.mutate();
          }}
        >
          <Trash2 /> Löschen
        </Button>
      </div>
      <FamilyDocument data={data} />
    </AppShell>
  );
}
