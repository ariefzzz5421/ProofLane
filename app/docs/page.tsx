import Link from "next/link";
const endpoints = [
  ["GET", "/api/v1/campaigns/:id", "Public if published"],
  ["GET", "/api/v1/campaigns/:id/tasks", "Public if published"],
  ["POST", "/api/v1/auth/challenge", "Participant"],
  ["POST", "/api/v1/auth/verify", "Participant"],
  ["POST", "/api/v1/campaigns/:id/verify-task", "Wallet session"],
  ["POST", "/api/v1/campaigns/:id/applications", "Wallet session"],
  ["GET", "/api/v1/campaigns/:id/applications/me", "Wallet session"],
  ["GET", "/api/v1/campaigns/:id/stats", "Admin or stats:read key"],
  ["GET", "/api/v1/campaigns/:id/applicants", "Admin or applicants:read key"],
  ["POST", "/api/v1/campaigns/:id/custom-verify", "verifications:write key"],
];
export default function Docs() {
  return (
    <>
      <header className="container nav">
        <Link href="/" className="brand">
          <span className="brand-mark">Q</span>QuestKernel
        </Link>
        <Link href="/dashboard">Dashboard →</Link>
      </header>
      <main className="container" style={{ maxWidth: 950 }}>
        <div className="hero" style={{ paddingBottom: "2rem" }}>
          <div className="eyebrow">Developer documentation</div>
          <h1>Integrate a campaign</h1>
          <p>
            Use a hosted page, an iframe entry widget, or the versioned REST
            API. Participant requests use an authenticated SIWE wallet session.
            Project backends use scoped API keys.
          </p>
        </div>
        <section className="section">
          <h2>Start locally</h2>
          <pre className="notice code">
            {
              "cp .env.example .env\nnpm install\nnpm run db:migrate\nnpm run db:seed\nnpm run dev"
            }
          </pre>
          <p className="muted">
            The demo page is at{" "}
            <Link href="/c/demo-builder-registration">
              /c/demo-builder-registration
            </Link>
            . It writes to local SQLite. Admin access requires your own account
            or optional seed credentials.
          </p>
        </section>
        <section className="section">
          <h2>Hosted or embedded</h2>
          <p>
            Open <code>/c/YOUR_SLUG</code> for the participant flow. Add this
            entry card to your site:
          </p>
          <pre className="notice code">
            {
              '<iframe src="https://YOUR_DOMAIN/embed/YOUR_SLUG" title="Campaign registration" width="360" height="190" style="border:0;max-width:100%"></iframe>'
            }
          </pre>
          <p className="small muted">
            The card opens the hosted page. Wallet signing happens on
            QuestKernel&apos;s own origin.
          </p>
        </section>
        <section className="section">
          <h2>REST API v1</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Method</th>
                  <th>Path</th>
                  <th>Access</th>
                </tr>
              </thead>
              <tbody>
                {endpoints.map(([method, path, access]) => (
                  <tr key={path + method}>
                    <td>{method}</td>
                    <td className="code">{path}</td>
                    <td>{access}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            JSON errors use{" "}
            <code>{'{ "error": { "code": "FULL", "message": "…" } }'}</code>.
            Application POST accepts optional <code>idempotencyKey</code> (8–128
            characters). Duplicate wallet retries return the existing receipt
            without consuming a slot.
          </p>
        </section>
        <section className="section">
          <h2>Server SDK</h2>
          <pre className="notice code">
            {
              'import { QuestKernelClient } from "./sdk";\nconst qk = new QuestKernelClient(process.env.QUESTKERNEL_URL!, process.env.QUESTKERNEL_API_KEY!);\nconst stats = await qk.stats(campaignId);'
            }
          </pre>
          <p className="muted">
            Create a replacement API key and revoke the old one to rotate. Never
            put the key in frontend code. Browser CORS for cross-origin key use
            is intentionally disabled.
          </p>
        </section>
        <section className="section">
          <h2>Webhooks</h2>
          <p>
            Deliveries include <code>x-qk-timestamp</code>,{" "}
            <code>x-qk-signature</code> and <code>x-qk-delivery-id</code>.
            Verify HMAC-SHA256 over timestamp, a period, and the raw body with
            the one-time signing secret. Compare in constant time, reject stale
            timestamps and deduplicate IDs. Invoke{" "}
            <code>POST /api/v1/webhooks/deliver</code> with{" "}
            <code>Authorization: Bearer CRON_SECRET</code> from a scheduler to
            deliver and retry queued events.
          </p>
        </section>
        <section className="section">
          <h2>Verification boundaries</h2>
          <p>
            Wallet signatures, ERC-20/NFT balances and EVM transactions use
            server checks. Manual evidence awaits administrator review. Discord
            guild membership uses OAuth plus a configured bot and guild ID;
            missing credentials report Unsupported. X reports Unsupported until
            official API permissions are available. Custom tasks can be decided
            only by a scoped backend key. Missing RPC credentials show
            Unsupported; RPC errors show Pending.
          </p>
          <p>
            QuestKernel records eligibility. It does not create tokens, custody
            funds, perform payouts, or guarantee an airdrop.
          </p>
        </section>
      </main>
    </>
  );
}
