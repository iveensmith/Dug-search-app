import type { Metadata } from 'next'
import Link from 'next/link'
import LegalPage, { Section, Row } from '@/components/ui/LegalPage'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    'The agreement between you and MediQuest: what the service does, what it does not do, and the rules for patients, pharmacies and pharmacists.',
}

const CONTACT = 'hello@mediquest.ng'

const CONTENTS = [
  { id: 'medical', label: 'This is not medical advice' },
  { id: 'what', label: 'What MediQuest does' },
  { id: 'stock', label: 'About stock information' },
  { id: 'accounts', label: 'Your account' },
  { id: 'patients', label: 'Rules for patients' },
  { id: 'pharmacies', label: 'Rules for pharmacies' },
  { id: 'pharmacists', label: 'Rules for pharmacists' },
  { id: 'reservations', label: 'Reservations' },
  { id: 'ratings', label: 'Ratings and reviews' },
  { id: 'liability', label: 'Liability' },
  { id: 'ending', label: 'Ending this agreement' },
  { id: 'law', label: 'Governing law' },
]

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of"
      accent="Service"
      lede="The agreement between you and MediQuest. It matters most in one place, so that place comes first: this app helps you find medicine, and it is not a doctor."
      updated="2026-08-23"
      contents={CONTENTS}
    >
      <Section id="medical" title="This is not medical advice">
        <p className="rounded-card border border-urgent bg-urgent-soft p-4 text-urgent-ink">
          <span className="font-semibold">Read this part even if you skip the rest.</span> MediQuest
          tells you which pharmacies say they have a medicine. It does not tell you whether you
          should take it. Nothing here replaces a consultation with a doctor or an in-person
          pharmacist.
        </p>
        <p>
          A pharmacist answering a question on MediQuest is explaining what is written on your
          prescription. They cannot change your dose, issue a new prescription, or diagnose you — and
          they are answering from a photo, without examining you.
        </p>
        <p>
          <span className="font-medium text-ink">If you feel seriously unwell, seek medical care
          immediately.</span> Do not wait for an answer here.
        </p>
      </Section>

      <Section id="what" title="What MediQuest does">
        <p>
          MediQuest is a directory. Pharmacies list what they stock; you search that list; we show
          you who is nearby and how to get there. We are not a pharmacy, we do not hold or sell
          medicine, and we are not party to whatever you buy when you arrive.
        </p>
        <p>
          The service is free to use, for patients and pharmacies alike. If that ever changes, it
          will not change retroactively and you will be told before it applies to you.
        </p>
      </Section>

      <Section id="stock" title="About stock information">
        <p>
          Every stock listing on MediQuest is self-reported by the pharmacy. We show when it was last
          confirmed precisely because that matters: a listing confirmed an hour ago is worth a trip,
          one from last week is worth a phone call first.
        </p>
        <p>
          We do not guarantee that a medicine is in stock, that the price is what you expect, or that
          the pharmacy is open when you arrive. Call ahead when the listing is not fresh. We show you
          the number for that reason.
        </p>
      </Section>

      <Section id="accounts" title="Your account">
        <p>
          Keep your password to yourself, and use a real address you can receive mail at — it is how
          you recover the account. You are responsible for what happens under your login. Tell us at{' '}
          <a
            href={`mailto:${CONTACT}`}
            className="font-medium text-brand-ink underline underline-offset-2"
          >
            {CONTACT}
          </a>{' '}
          if you think someone else has it.
        </p>
        <p>
          One account is one role. A pharmacy owner account is separate from a patient account, on
          purpose, because they see very different things.
        </p>
      </Section>

      <Section id="patients" title="Rules for patients">
        <ul className="ml-5 list-disc space-y-2 marker:text-brand">
          <li>Send only your own prescription, or one you are authorised to ask about.</li>
          <li>
            Do not upload anything that is not a prescription or a medicine question. Pharmacists are
            real people doing real work.
          </li>
          <li>
            Do not scrape, bulk-download, or automate against the site. There is a documented API for
            pharmacies that need programmatic access.
          </li>
          <li>Do not attempt to reach another patient’s data. It is a criminal matter, not a game.</li>
        </ul>
      </Section>

      <Section id="pharmacies" title="Rules for pharmacies">
        <p>
          Listing an outlet means asserting that it is real, that it is licensed by the Pharmacy
          Council of Nigeria, and that the PCN number you provide belongs to it. We verify before
          approving, and we remove listings we cannot verify.
        </p>
        <dl className="mt-2">
          <Row term="Keep stock honest">
            Marking a medicine in stock when it is not sends a patient on a wasted journey — often a
            sick one, often paying for transport. Repeatedly doing so is grounds for removal.
          </Row>
          <Row term="Confirm regularly">
            A listing you never confirm decays in usefulness and is shown to patients as stale.
          </Row>
          <Row term="Honour reservations">
            If you accept a reservation, hold the item for the agreed window or decline it promptly.
          </Row>
          <Row term="Dispense lawfully">
            Prescription-only medicines require a prescription. MediQuest does not change that, and
            listing a medicine here is not permission to sell it otherwise.
          </Row>
        </dl>
      </Section>

      <Section id="pharmacists" title="Rules for pharmacists">
        <p>
          Pharmacist accounts are created by us after checking a licence — there is no public sign-up
          — and they carry access to patients’ prescription photos. That access comes with limits.
        </p>
        <ul className="ml-5 list-disc space-y-2 marker:text-brand">
          <li>Claim a question only if you intend to answer it.</li>
          <li>
            Explain what is written. Do not prescribe, do not adjust a dose, and do not tell someone
            to stop taking something their doctor prescribed.
          </li>
          <li>
            What you see in a thread is confidential. Do not copy it, share it, or discuss it outside
            the thread.
          </li>
          <li>Refer anyone describing an emergency to urgent care, immediately.</li>
        </ul>
      </Section>

      <Section id="reservations" title="Reservations">
        <p>
          A reservation is a request to a pharmacy to hold an item. It is not a purchase, not a
          payment, and not a binding contract with us. The pharmacy may decline it, and may release
          the item if you do not arrive within the agreed window. Any money changes hands at the
          counter, between you and them.
        </p>
      </Section>

      <Section id="ratings" title="Ratings and reviews">
        <p>
          Rate a pharmacy you actually dealt with, and describe what happened. Reviews are published
          with the display name on your account, and pharmacies can reply to them.
        </p>
        <p>
          We remove reviews that are abusive, that identify a private individual, that contain health
          information about somebody else, or that are plainly fake — in either direction. We do not
          remove a review simply because a pharmacy dislikes it.
        </p>
      </Section>

      <Section id="liability" title="Liability">
        <p>
          MediQuest is provided as it is. We work hard on accuracy and we do not promise it: stock
          data comes from pharmacies, map data from OpenStreetMap, and neither is under our control.
        </p>
        <p>
          To the extent Nigerian law allows, we are not liable for a wasted journey, a medicine that
          turned out to be unavailable, a pharmacy’s conduct, or a decision you made about your health
          based on what you read here. Nothing in these terms limits liability that cannot lawfully be
          limited — including for death or personal injury caused by our negligence, or for fraud.
        </p>
      </Section>

      <Section id="ending" title="Ending this agreement">
        <p>
          You can stop using MediQuest at any time, and ask us to delete your account — see the{' '}
          <Link href="/privacy" className="font-medium text-brand-ink underline underline-offset-2">
            Privacy Policy
          </Link>{' '}
          for how.
        </p>
        <p>
          We may suspend or close an account that breaks these terms, that endangers patients through
          dishonest stock data, or that we are required to act against by law. Where it is safe and
          lawful to explain why, we will.
        </p>
      </Section>

      <Section id="law" title="Governing law">
        <p>
          These terms are governed by the laws of the Federal Republic of Nigeria, and the Nigerian
          courts have jurisdiction over any dispute arising from them. Where we handle personal data,
          the Nigeria Data Protection Act, 2023 applies.
        </p>
        <p>
          If a court finds part of these terms unenforceable, the rest continues to apply. When we
          change them, the date at the top changes, and material changes are sent to account holders
          by email.
        </p>
      </Section>
    </LegalPage>
  )
}
