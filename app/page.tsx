import Link from "next/link";
import {
  ArrowRight,
  ShieldCheck,
  Database,
  KeyRound,
  Download,
  Blocks,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
const steps = [
  {
    icon: Blocks,
    title: "Create Campaign",
    text: "Define capacity, chain, requirements and tasks in one dashboard.",
  },
  {
    icon: ShieldCheck,
    title: "Verify Participants",
    text: "Require signed wallet ownership and server-side task checks.",
  },
  {
    icon: Database,
    title: "Store Eligibility",
    text: "Applications and evidence are persisted, searchable and auditable.",
  },
  {
    icon: KeyRound,
    title: "Integrate via API",
    text: "Use scoped credentials, hosted pages or the typed SDK.",
  },
  {
    icon: Download,
    title: "Export Snapshot",
    text: "Generate a timestamped, checksummed eligibility CSV.",
  },
];
export default function Home() {
  return (
    <>
      <header className="container nav">
        <Link href="/" className="brand">
          <span className="brand-mark">Q</span>QuestKernel
        </Link>
        <nav className="nav-links">
          <Link href="/docs">Docs</Link>
          <Link href="/c/demo-builder-registration">Demo campaign</Link>
          <Button asChild size="sm">
            <Link href="/login">
              Open dashboard <ArrowRight size={15} />
            </Link>
          </Button>
        </nav>
      </header>
      <main className="container">
        <div className="hero">
          <div className="eyebrow">Infrastructure for credible campaigns</div>
          <h1>Airdrop registration, built on evidence.</h1>
          <p>
            Launch a hosted registration page, verify wallets and tasks, enforce
            a real capacity limit, and give your team a persistent source of
            truth.
          </p>
          <div className="hero-actions">
            <Button asChild>
              <Link href="/register">
                Create an organization <ArrowRight size={17} />
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/c/demo-builder-registration">
                Explore demo environment
              </Link>
            </Button>
          </div>
          <p className="small">
            Demo environment uses real database writes. No token distribution or
            payout is included.
          </p>
        </div>
        <section className="section">
          <div className="section-head">
            <div>
              <div className="eyebrow">How it works</div>
              <h2>One kernel for the full flow</h2>
            </div>
            <span className="muted">
              Built for project teams and their developers.
            </span>
          </div>
          <div className="grid grid-3">
            {steps.map(({ icon: Icon, title, text }, i) => (
              <Card key={title}>
                <CardContent>
                  <div className="row muted">
                    <Icon size={20} />
                    <span className="small">0{i + 1}</span>
                  </div>
                  <h3>{title}</h3>
                  <p className="muted">{text}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
        <section className="section grid grid-2">
          <Card>
            <CardContent>
              <div className="eyebrow">Capacity you can trust</div>
              <h2>Last slot means last slot.</h2>
              <p className="muted">
                The database reserves a place and commits the application
                together. Duplicate wallets cannot consume another place.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <div className="eyebrow">Honest verification</div>
              <h2>Evidence before eligibility.</h2>
              <p className="muted">
                Unavailable RPC or social integrations show an explicit pending
                or unsupported state. A link click never becomes proof.
              </p>
            </CardContent>
          </Card>
        </section>
      </main>
      <footer className="footer">
        <div className="container row between">
          <span>© QuestKernel</span>
          <span>
            Registration infrastructure only. Distribution is a future module.
          </span>
        </div>
      </footer>
    </>
  );
}
