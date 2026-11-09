import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Service = Database["public"]["Tables"]["services"]["Row"];
export type FamilyApplication = Database["public"]["Tables"]["family_applications"]["Row"];
export type ApplicationStatus = Database["public"]["Enums"]["application_status"];

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  entwurf: "Entwurf",
  eingereicht: "Eingereicht",
  genehmigt: "Genehmigt",
  abgelehnt: "Abgelehnt",
};

async function currentUserId() {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error("Nicht angemeldet");
  return id;
}

export const profileQuery = () =>
  queryOptions({
    queryKey: ["profile"],
    queryFn: async (): Promise<Profile | null> => {
      const id = await currentUserId();
      const { data, error } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

export const servicesQuery = () =>
  queryOptions({
    queryKey: ["services"],
    queryFn: async (): Promise<Service[]> => {
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .order("service_date", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data ?? [];
    },
  });

export const applicationsQuery = () =>
  queryOptions({
    queryKey: ["family_applications"],
    queryFn: async (): Promise<FamilyApplication[]> => {
      const { data, error } = await supabase
        .from("family_applications")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

export const applicationQuery = (id: string) =>
  queryOptions({
    queryKey: ["family_applications", id],
    queryFn: async (): Promise<FamilyApplication | null> => {
      const { data, error } = await supabase
        .from("family_applications")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

export function profileComplete(p: Profile | null | undefined): p is Profile {
  return !!p && !!p.full_name.trim() && !!p.passport_number.trim() && !!p.phone.trim();
}

/** Turns database errors into readable German messages. */
export function errorMessage(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return "Unbekannter Fehler";
}
