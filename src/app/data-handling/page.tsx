import type { Metadata } from 'next'
import Link from 'next/link'
import LegalPage, { Section, Row } from '@/components/ui/LegalPage'

export const metadata: Metadata = {
  title: 'Data Handling',
  description:
    'Where MediQuest stores data, who can reach it, how prescription photos are protected, and what happens when something goes wrong.',
}

const CONTACT = 'hello@mediquest.ng'

const CONTENTS = [
  { id: 'why', label: 'Why this page exists' },
  { id: 'where', label: 'Where your data lives' },
  { id: 'access', label: 'Who can reach it' },
  { id: 'photos', label: 'The prescription pipeline, step by step' },
  { id: 'minimise', label: 'What we deliberately do not collect' },
  { id: 'pharmacies', label: 'What pharmacies can and cannot see' },
  { id: 'breach', label: 'If something goes wrong' },
  { id: 'ask', label: 'Asking us anything' },
]

export default function DataHandlingPage() {
  return (
    <LegalPage
      title="Data"
      accent="Handling"
      lede="The Privacy Policy says what we collect. This one says where it physically sits, who can reach it, and what we have deliberately chosen not to know about you."
      updated="2026-08-23"
      contents={CONTENTS}
    >
      <Section id="why" title="Why this page exists">
        <p>
          A privacy policy tells you the rules. It rarely tells you how the thing is actually built,
          which is the part that decides whether the rules hold. Since MediQuest handles prescription
          photos, we would rather show the plumbing than ask you to take the policy on faith.
        </p>
        <p>
          Nothing here replaces the{' '}
          <Link href="/privacy" className="font-medium text-brand-ink underline underline-offset-2">
            Privacy Policy
          </Link>
          . That is the document with legal effect; this one explains it.
        </p>
      </Section>

      <Section id="where" title="Where your data lives">
        <dl className="mt-2">
          <Row term="The database">
            A managed PostgreSQL instance at Supabase. It holds accounts, pharmacies, stock records,
            searches, reservations, ratings, and the text of prescription conversations.
          </Row>
          <Row term="Prescription photos and voice notes">
            A private storage bucket, separate from the database. The database stores only a key — a
            filename — not the image itself, and not a public URL.
          </Row>
          <Row term="The application">
            Runs on Vercel. It keeps nothing of its own between requests: every piece of state lives
            in the database, which is why nothing is lost or leaked when a server restarts.
          </Row>
          <Row term="Backups">
            Handled by Supabase as part of the managed database. A backup contains the same data as
            the live database and is protected the same way.
          </Row>
        </dl>
        <p>
          Both providers operate outside Nigeria, so your data is processed abroad. The NDPA permits
          this where the data is adequately protected; we rely on the contractual and security terms
          these providers publish.
        </p>
      </Section>

      <Section id="access" title="Who can reach it">
        <p>
          Access is decided per request, in the application, by asking who is signed in — never by
          whether someone happens to know a URL.
        </p>
        <ul className="ml-5 list-disc space-y-2 marker:text-brand">
          <li>
            <span className="font-medium text-ink">Patients</span> see their own account, their own
            searches, their own reservations, and their own prescription threads.
          </li>
          <li>
            <span className="font-medium text-ink">Pharmacists</span> see prescription questions
            waiting to be claimed, and the full contents of the ones they have claimed. They see
            nothing of a thread claimed by another pharmacist.
          </li>
          <li>
            <span className="font-medium text-ink">Pharmacy owners and staff</span> see their own
            outlet: its stock list, its reservations, its ratings. They never see prescription
            photos, and they never see who searched for what.
          </li>
          <li>
            <span className="font-medium text-ink">Administrators</span> see pharmacies awaiting
            approval and aggregate search statistics. Administration exists to verify that a pharmacy
            is real, not to read patient conversations.
          </li>
        </ul>
        <p>
          Every table in the database also has row-level security enabled, so the public API key that
          the database platform exposes by default cannot read any of it. The application connects
          separately, as the owner of those tables.
        </p>
      </Section>

      <Section id="photos" title="The prescription pipeline, step by step">
        <p>What actually happens between tapping send and a pharmacist answering:</p>
        <ol className="ml-5 list-decimal space-y-3 marker:font-semibold marker:text-brand-ink">
          <li>
            Your browser shrinks the photo before it leaves your phone. A 4000-pixel camera image
            becomes about 1600 pixels — enough to read a prescription, and far less of your data
            bundle.
          </li>
          <li>
            It is uploaded over HTTPS to our server, which re-encodes it to a modern format, strips
            the orientation tag after applying it, and writes it to private storage under a random
            key.
          </li>
          <li>
            The database records that a thread exists, who opened it, and the storage key. It does
            not record a URL that would work on its own.
          </li>
          <li>
            A pharmacist sees that a question is waiting. Until one claims it, the photo is
            unreadable to every pharmacist.
          </li>
          <li>
            When you or the claiming pharmacist opens the image, the request goes to an endpoint that
            checks your session, confirms you are one of those two people, and only then reads the
            bytes out of storage and streams them back.
          </li>
        </ol>
        <p>
          The consequence worth stating plainly: there is no address you could paste into a group
          chat that would show someone your prescription.
        </p>
      </Section>

      <Section id="minimise" title="What we deliberately do not collect">
        <p>
          The safest data is the data that was never recorded. These are choices, not omissions:
        </p>
        <ul className="ml-5 list-disc space-y-2 marker:text-brand">
          <li>
            <span className="font-medium text-ink">No advertising or analytics trackers.</span> No
            third-party script watches you use the site.
          </li>
          <li>
            <span className="font-medium text-ink">No background location.</span> Your position is
            read once, when you ask for it, and never while the app is closed.
          </li>
          <li>
            <span className="font-medium text-ink">No browsing profile.</span> We record the searches
            you make; we do not build a picture of you from them or use them to target anything at
            you.
          </li>
          <li>
            <span className="font-medium text-ink">No date of birth, address, or ID number.</span> The
            app has never needed them, so it has never asked.
          </li>
          <li>
            <span className="font-medium text-ink">No payment details.</span> MediQuest does not take
            payments. You pay the pharmacy, in the pharmacy.
          </li>
        </ul>
      </Section>

      <Section id="pharmacies" title="What pharmacies can and cannot see">
        <p>
          Pharmacies are customers of this app too, and the boundary between them and patients
          matters more than any other.
        </p>
        <dl className="mt-2">
          <Row term="A pharmacy can see">
            Its own stock list and who edited it, reservations placed at that outlet — including the
            reserving patient’s display name and the medicine — and ratings left about it.
          </Row>
          <Row term="A pharmacy cannot see">
            Prescription photos, prescription conversations, what anyone searched for, whether
            somebody searched and chose a different pharmacy, or anything at all about a patient who
            has not interacted with it.
          </Row>
        </dl>
        <p>
          Searching for a medicine tells no pharmacy that you looked. Only reserving does, because
          that is a request to hold something for you.
        </p>
      </Section>

      <Section id="breach" title="If something goes wrong">
        <p>
          If we discover a breach affecting your personal data, we will notify the Nigeria Data
          Protection Commission within 72 hours of becoming aware of it, as the NDPA requires, and we
          will tell affected users directly where the risk to them is significant.
        </p>
        <p>
          We will say what happened, what was exposed, and what we have done — without waiting until
          we have a comfortable version of the story.
        </p>
      </Section>

      <Section id="ask" title="Asking us anything">
        <p>
          If something here is unclear, or you want to know whether we hold a particular thing about
          you, email{' '}
          <a
            href={`mailto:${CONTACT}`}
            className="font-medium text-brand-ink underline underline-offset-2"
          >
            {CONTACT}
          </a>
          . A question about your own data is not a nuisance; it is the point of publishing this.
        </p>
      </Section>
    </LegalPage>
  )
}
