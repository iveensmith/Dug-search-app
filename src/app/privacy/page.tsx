import type { Metadata } from 'next'
import Link from 'next/link'
import LegalPage, { Section, Row } from '@/components/ui/LegalPage'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'What MediQuest collects, why, who can see it, and how to get it deleted. Written for Nigeria’s Data Protection Act, 2023.',
}

const CONTACT = 'hello@mediquest.ng'

const CONTENTS = [
  { id: 'short', label: 'The short version' },
  { id: 'collect', label: 'What we collect, and why' },
  { id: 'prescriptions', label: 'Prescription photos and voice notes' },
  { id: 'sharing', label: 'Who else sees your data' },
  { id: 'keep', label: 'How long we keep it' },
  { id: 'rights', label: 'Your rights under the NDPA' },
  { id: 'security', label: 'How it is protected' },
  { id: 'children', label: 'Children' },
  { id: 'changes', label: 'Changes to this policy' },
]

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy"
      accent="Policy"
      lede="MediQuest handles health information. This page says exactly what we hold, who can see it, and how to get it removed — in plain terms, not legal ones."
      updated="2026-08-23"
      contents={CONTENTS}
    >
      <Section id="short" title="The short version">
        <p>
          We collect the least we can get away with. To find medicine near you we need to know
          roughly where you are and what you are looking for. To let a pharmacist explain a
          prescription, we need the photo you send them.
        </p>
        <p>
          We do not sell your data, we do not advertise to you, and we do not share what you search
          for with the pharmacies you search through. Nobody at a pharmacy can see your prescription
          photo unless you send it to a pharmacist and that pharmacist claims it.
        </p>
      </Section>

      <Section id="collect" title="What we collect, and why">
        <p>
          Everything below is either something you typed, something you uploaded, or something the
          app needs to work. There is no tracking pixel, no advertising network, and no analytics
          product watching you move around the site.
        </p>
        <dl className="mt-6">
          <Row term="Account details">
            Your email address or phone number, the name you choose to display, and your state. The
            email or phone is how you sign in and how we send you a password reset. Your password is
            never stored — only a bcrypt hash of it, which cannot be turned back into the password.
          </Row>
          <Row term="What you search for">
            The medicine and the area, so we can answer. We keep a record of searches — including
            the ones that found nothing — because a medicine nobody stocks in your LGA is the single
            most useful thing this app can learn. If you are signed in, that record is linked to your
            account; if you are not, it is not.
          </Row>
          <Row term="Your location">
            Only if you tap <span className="font-medium text-ink">Use my location</span>. Your
            browser asks first, and refusing is a supported answer — the app falls back to the centre
            of the state you picked. When you do share it, the coordinates are stored with that
            search so distances stay accurate.
          </Row>
          <Row term="Prescription photos and notes">
            The photo, any note you type, and any voice note you record. See the next section — this
            is the most sensitive thing we hold and it has its own rules.
          </Row>
          <Row term="Reservations and ratings">
            Which pharmacy you reserved a medicine at, and any rating or review you leave. A review
            you write is shown publicly with the display name on your account.
          </Row>
          <Row term="Technical records">
            Your IP address is used to rate-limit sign-in attempts and searches, so one script cannot
            lock everyone else out. It is held for that purpose only and cleared once the window
            passes. We also count, in aggregate, how many visits arrive on a browser too old to run
            the app — a number per day, with nothing attached to it.
          </Row>
        </dl>
      </Section>

      <Section id="prescriptions" title="Prescription photos and voice notes">
        <p>
          A prescription photo is health data. Under the Nigeria Data Protection Act, 2023 that makes
          it sensitive personal data, and we treat it that way.
        </p>
        <ul className="ml-5 list-disc space-y-2 marker:text-brand">
          <li>
            <span className="font-medium text-ink">It is never a public link.</span> The photo is
            stored in private storage and served only through an endpoint that checks who is asking.
            Having the address of an image is not enough to open it.
          </li>
          <li>
            <span className="font-medium text-ink">Two people can see it:</span> you, and the
            licensed pharmacist who claims your question. No other pharmacist, no pharmacy owner, and
            no other patient can open it.
          </li>
          <li>
            <span className="font-medium text-ink">It is resized, not analysed.</span> The photo is
            converted to a smaller image on upload so it costs you less data to send and to view.
            Nothing reads it, and no machine-learning model is trained on it.
          </li>
          <li>
            <span className="font-medium text-ink">A pharmacist explains, and cannot prescribe.</span>{' '}
            They can tell you what is written on the paper. They cannot change your dose, issue a new
            prescription, or replace seeing your doctor.
          </li>
        </ul>
      </Section>

      <Section id="sharing" title="Who else sees your data">
        <p>
          We use a small number of services to run MediQuest. They process data on our instructions
          and for no purpose of their own. We do not sell data to anyone, ever.
        </p>
        <dl className="mt-6">
          <Row term="Supabase">
            Hosts the database and the private storage holding prescription photos.
          </Row>
          <Row term="Vercel">Hosts and serves the application itself.</Row>
          <Row term="Resend">
            Sends transactional email — verification, password resets, stock alerts. Nothing
            promotional.
          </Row>
          <Row term="OpenStreetMap">
            Supplies the map tiles your browser loads when you open a map, which means OpenStreetMap
            can see your IP address at that moment, and turns an address you type into coordinates.
          </Row>
          <Row term="OSRM">
            Calculates driving directions between you and a pharmacy. The request comes from our
            server, not your browser.
          </Row>
        </dl>
        <p>
          We will disclose data if a Nigerian court or a competent regulator lawfully requires it. We
          will tell you when we are permitted to.
        </p>
      </Section>

      <Section id="keep" title="How long we keep it">
        <p>
          Your account and its contents stay until you ask us to remove them. Rate-limiting records
          tied to your IP are cleared automatically once their window passes. Aggregate counts, which
          identify nobody, are kept indefinitely.
        </p>
        <p>
          If you want a prescription thread deleted without closing your account, ask — that is a
          normal request and does not need a reason.
        </p>
      </Section>

      <Section id="rights" title="Your rights under the NDPA">
        <p>
          The Nigeria Data Protection Act, 2023 gives you the right to see what we hold about you, to
          correct it, to have it deleted, to get a copy in a portable form, and to object to how we
          use it.
        </p>
        <p>
          You can change your display name and password yourself on your{' '}
          <Link href="/account" className="font-medium text-brand-ink underline underline-offset-2">
            account page
          </Link>
          . For anything else — a copy of your data, deletion of your account, or removal of a single
          prescription thread — email{' '}
          <a
            href={`mailto:${CONTACT}`}
            className="font-medium text-brand-ink underline underline-offset-2"
          >
            {CONTACT}
          </a>{' '}
          from the address on your account and we will act within 30 days.
        </p>
        <p className="rounded-card border border-line-brand bg-brand-soft p-4 text-brand-ink">
          <span className="font-semibold">Being straight with you:</span> there is no button that
          deletes your account today. The request is handled by a person, by email. We would rather
          say that than imply a self-service control that does not exist yet.
        </p>
        <p>
          If you think we have mishandled your data, you can complain to the Nigeria Data Protection
          Commission. We would appreciate the chance to fix it first.
        </p>
      </Section>

      <Section id="security" title="How it is protected">
        <p>
          Passwords are stored as bcrypt hashes. Traffic is HTTPS only. Prescription photos sit in
          private storage behind an endpoint that checks the requester every time. Sign-in attempts
          are rate-limited per account and per address, and repeated failures lock an account rather
          than let a guess continue.
        </p>
        <p>
          No system is perfect, and we will not claim otherwise. What we can promise is that we do
          not hold what we do not need, which is the only protection that never fails.
        </p>
      </Section>

      <Section id="children" title="Children">
        <p>
          MediQuest is for adults. If you are under 18, ask a parent or guardian to use it for you.
          We do not knowingly hold accounts for children, and will delete one if we learn of it.
        </p>
      </Section>

      <Section id="changes" title="Changes to this policy">
        <p>
          When this changes, the date at the top changes with it. If a change materially affects what
          we do with your data, we will tell account holders by email rather than quietly editing the
          page.
        </p>
      </Section>
    </LegalPage>
  )
}
