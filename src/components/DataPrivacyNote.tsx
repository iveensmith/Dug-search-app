import { IconAlertCircle } from '@/components/ui/icons'

/** Distinct from PrescriptionDisclaimer (that's about the medical-advice
 *  boundary) — this is specifically about where the photo goes and who can
 *  see it, since it's sensitive health data. Copy is descriptive of the
 *  actual implementation (src/lib/storage.ts), not a legal compliance
 *  certification. */
export default function DataPrivacyNote() {
  return (
    <div className="flex items-start gap-3 rounded-control border border-line bg-canvas p-3 text-xs leading-relaxed text-muted">
      <IconAlertCircle width={16} height={16} className="mt-0.5 shrink-0 text-faint" />
      <p>
        Your prescription photo is health data. It&apos;s stored privately — never a public link
        — and only the pharmacist who claims your question can view it, in line with
        Nigeria&apos;s Data Protection Act, 2023.
      </p>
    </div>
  )
}
