import { IconShieldCheck } from '@/components/ui/icons'

/** Every pharmacy a patient can ever see already passed PCN review — see the
 *  verificationStatus = 'APPROVED' filter in src/lib/geo.ts. This badge just
 *  surfaces that fact so patients don't have to take it on faith. */
export default function VerifiedBadge({ className = '' }: { className?: string }) {
  return (
    <span
      title="This pharmacy's PCN license has been reviewed and approved"
      className={`inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400 ${className}`}
    >
      <IconShieldCheck width={11} height={11} />
      Verified
    </span>
  )
}
