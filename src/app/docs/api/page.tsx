import type { Metadata } from 'next'
import SiteHeader from '@/components/ui/SiteHeader'
import SiteFooter from '@/components/ui/SiteFooter'

export const metadata: Metadata = {
  title: 'Stock API',
  description: 'How a pharmacy’s own software sends its stock to MediQuest.',
}

/**
 * Written for the person who will actually do this: whoever maintains a
 * shop's POS or wrote its spreadsheet macro. Concrete requests they can
 * paste, the two mistakes that will bite them, and no marketing.
 */
function Code({ children }: { children: string }) {
  return (
    <pre className="mt-3 overflow-x-auto rounded-xl bg-gray-900 p-4 text-xs leading-relaxed text-gray-100 dark:bg-black/60">
      <code>{children}</code>
    </pre>
  )
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-10 text-xl font-bold text-gray-900 dark:text-gray-50">{children}</h2>
}

export default function ApiDocsPage() {
  return (
    <div className="flex min-h-dvh w-full flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-50">Stock API</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Send a pharmacy&apos;s stock straight from the software that already tracks it. Everything
          below is one pharmacy&apos;s data — the key decides which, and there is no field to name
          another.
        </p>

        <H2>Getting a key</H2>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          The pharmacy owner creates one under <strong>Pharmacy → Connect your own software</strong>.
          It is shown once, at creation, and never again: only a scrambled copy is stored. Treat it
          like a password — anyone holding it can change what patients are told is on that shelf.
          If it leaks, revoke it on the same screen and make a new one.
        </p>
        <Code>{`Authorization: Bearer mq_live_xxxxxxxxxxxxxxxxxxxxxxxx`}</Code>

        <H2>1. Find our ids for your products — once</H2>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Your system has its own product codes. Map them to ours once and store the result; do not
          re-guess on every sync.
        </p>
        <Code>{`curl -H "Authorization: Bearer $KEY" \\
  "https://your-domain/api/v1/drugs?q=amoxicillin"

{
  "drugs": [
    { "id": "clx123…", "genericName": "Amoxicillin/Clavulanate",
      "strength": "625 mg", "form": "TABLET", "brandNames": [] }
  ]
}`}</Code>

        <H2>2. Send your stock</H2>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Up to 500 items per request. Name each medicine by our <code>drugId</code>, or by an exact{' '}
          <code>genericName</code> + <code>strength</code> + <code>form</code>.
        </p>
        <Code>{`curl -X POST -H "Authorization: Bearer $KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "items": [
      { "drugId": "clx123…", "inStock": true, "quantity": 20,
        "brand": "Aquaclav", "expiryDate": "2027-03-31T00:00:00Z", "ref": "SKU-8841" },
      { "genericName": "Paracetamol", "strength": "500 mg", "form": "TABLET",
        "inStock": false, "ref": "SKU-0102" }
    ]
  }' \\
  "https://your-domain/api/v1/inventory"

{ "applied": 1, "rejected": [ { "index": 1, "ref": "SKU-0102", "reason": "…" } ] }`}</Code>
        <p className="mt-3 text-gray-600 dark:text-gray-400">
          A bad item does not fail the batch — a nightly sync should not lose 499 good lines to one
          discontinued product. <strong>Read the <code>rejected</code> list</strong>; it is the only
          place you will learn something needs fixing. Pass <code>ref</code> and it comes back
          untouched, so you can line results up with your own rows.
        </p>

        <H2>3. Read back what we list</H2>
        <Code>{`curl -H "Authorization: Bearer $KEY" "https://your-domain/api/v1/inventory"`}</Code>

        <H2>Two things that will bite you</H2>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          <strong>Strength and form are exact.</strong> If you send a strength we do not carry, the
          item is rejected rather than matched to a near one. That is deliberate: nobody is watching
          an unattended sync, and a helpful guess here puts the wrong box in a patient&apos;s hands.
          The <code>rejected</code> reason tells you what happened.
        </p>
        <p className="mt-3 text-gray-600 dark:text-gray-400">
          <strong>Omitted fields keep their current value.</strong> Sending only{' '}
          <code>quantity</code> will not erase a brand or expiry you set earlier. To clear one,
          send it explicitly as <code>null</code>.
        </p>

        <H2>Limits and errors</H2>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-gray-600 dark:text-gray-400">
          <li>60 requests per minute per key. Over that: <code>429</code>, with <code>retryAfterSeconds</code>.</li>
          <li>500 items per request.</li>
          <li><code>401</code> — key missing, unknown or revoked. <code>403</code> — pharmacy not approved yet.</li>
          <li><code>422</code> — every item was rejected; nothing was written.</li>
          <li>
            Re-sending the same request is harmless. Each item sets that medicine&apos;s state
            outright, so a retry after a timeout cannot double-apply anything.
          </li>
        </ul>

        <H2>Webhooks: being told about reservations</H2>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          The owner sets a URL under <strong>Pharmacy → Connect your own software</strong>. We POST
          JSON to it when a patient asks for a hold, and again whenever that reservation changes.
          The events are <code>reservation.created</code>, <code>reservation.updated</code> and{' '}
          <code>ping</code>.
        </p>
        <Code>{`POST https://your-system.example/mediquest
X-MediQuest-Event: reservation.created
X-MediQuest-Delivery: clx987…            # stable across retries — dedupe on it
X-MediQuest-Signature: t=1786370000,v1=9f86d0…

{
  "event": "reservation.created",
  "createdAt": "2026-08-10T14:21:07.114Z",
  "data": {
    "reservation": { "id": "clx…", "status": "PENDING", "quantity": 2,
                     "note": null, "readyAt": null, "collectedAt": null,
                     "createdAt": "2026-08-10T14:21:07.098Z" },
    "patient":     { "name": "Ada Obi", "phone": "+2348012345678" },
    "drug":        { "id": "clx…", "genericName": "Amoxicillin/Clavulanate",
                     "strength": "625 mg", "form": "TABLET", "brandNames": [] }
  }
}`}</Code>

        <H2>Checking the signature</H2>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Anyone can POST to your URL. The signature is how you know we sent it. Sign the raw body
          — not a re-encoded copy of the parsed JSON, which will not match.
        </p>
        <Code>{`const [t, v1] = req.headers['x-mediquest-signature']
  .split(',').map(p => p.split('=')[1])

const expected = crypto.createHmac('sha256', SECRET)
  .update(t + '.' + rawBody)          // the bytes as received
  .digest('hex')

const ok = crypto.timingSafeEqual(Buffer.from(v1), Buffer.from(expected))
// Reject anything older than five minutes, or a captured request can be
// replayed at leisure.
const fresh = Math.abs(Date.now() / 1000 - Number(t)) < 300`}</Code>

        <H2>Delivery, honestly</H2>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-gray-600 dark:text-gray-400">
          <li>Answer <code>2xx</code> quickly. Anything else counts as a failure.</li>
          <li>
            Failures retry six times over about eight hours, then stop. The owner can see which
            events were lost.
          </li>
          <li>
            <strong>Expect repeats.</strong> If your server is slow to answer we may retry something
            you already handled — <code>X-MediQuest-Delivery</code> is stable across retries, so
            store it and ignore ids you have seen.
          </li>
          <li>
            <strong>No delivery-time guarantee.</strong> The first attempt is immediate; retries
            depend on a scheduler being configured, so treat this as a fast nudge rather than the
            authoritative record. <code>GET /api/v1/inventory</code> and your own reconciliation
            remain the source of truth.
          </li>
          <li>HTTPS only, and the address must be reachable from the public internet.</li>
          <li>Redirects are not followed.</li>
        </ul>
        <p className="mt-3 text-gray-600 dark:text-gray-400">
          These payloads carry a patient&apos;s name and phone number. Terminate them somewhere you
          would be comfortable holding that.
        </p>
      </main>
      <SiteFooter />
    </div>
  )
}
