import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpenText, Calculator, FileSignature, Scale, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import heroImg from "@/assets/kanzlei-hero.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Kanzleiakte – Leistungsdokumentation nach RAVO" },
      {
        name: "description",
        content: "Dokumentiere Mandate, berechne Gebühren nach §4 RAVO und erstelle Familienlizenz-Anträge für San Andreas.",
      },
      { property: "og:title", content: "Kanzleiakte – Leistungsdokumentation nach RAVO" },
      {
        property: "og:description",
        content: "Dokumentiere Mandate, berechne Gebühren nach §4 RAVO und erstelle Familienlizenz-Anträge für San Andreas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const FEATURES = [
  { icon: BookOpenText, title: "Leistungsdokumentation", text: "Mandant, Telefon, Leistung, Datum und Gebühr – vollständig nach §3 Abs. 5." },
  { icon: Calculator, title: "Gebührenrechner", text: "Höchstbeträge nach §4 automatisch berechnet. Überschreitungen werden blockiert." },
  { icon: FileSignature, title: "Familienlizenz-Antrag", text: "Antrag mit allen Pflichtangaben a)–i) nach §7 – druckfertig." },
  { icon: ShieldCheck, title: "14-Tage-Einsicht", text: "Bericht der letzten 14 Tage für Justiz, Kammer oder Gouverneursbüro." },
];

function Index() {
  return (
    <div className="min-h-screen grid lg:grid-cols-[1.1fr_1fr]">
      <section className="flex flex-col justify-between px-8 py-10 md:px-16 md:py-14">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full border border-gold text-gold">
            <Scale className="h-5 w-5" />
          </div>
          <div>
            <div className="font-display text-2xl font-semibold leading-none">Kanzleiakte</div>
            <div className="eyebrow mt-1">Rechtsanwaltskammer San Andreas</div>
          </div>
        </div>

        <div className="my-14 max-w-xl">
          <div className="eyebrow mb-4">Gemäß RAVO §3 · §4 · §7</div>
          <h1 className="text-5xl md:text-6xl font-semibold leading-[1.05] text-foreground">
            Jedes Mandat. <span className="italic text-bordeaux">Lückenlos</span> dokumentiert.
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-md">
            Die Akte für Rechts- und Organisationsanwälte in Los Santos – nachvollziehbar, gebührenkonform und jederzeit einsichtsbereit.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" variant="gold">
              <Link to="/auth">Zur Kanzlei anmelden</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/dashboard">Meine Akte öffnen</Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex gap-3">
              <Icon className="mt-1 h-5 w-5 shrink-0 text-gold" />
              <div>
                <div className="font-display text-lg font-semibold">{title}</div>
                <p className="text-sm text-muted-foreground">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="relative hidden lg:block">
        <img src={heroImg} alt="Waage der Justiz auf einem Kanzleischreibtisch" width={1280} height={1600} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/90 to-transparent p-10">
          <blockquote className="font-display text-2xl italic text-paper max-w-md">
            „Vertreten Sie Ihre Mandanten nach bestem Wissen und Gewissen.“
          </blockquote>
          <div className="eyebrow mt-3">RAVO §1 Gebote</div>
        </div>
      </section>
    </div>
  );
}
