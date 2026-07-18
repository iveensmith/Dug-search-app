import { IconShieldCheck } from '@/components/ui/icons'

export default function PrescriptionDisclaimer() {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs leading-relaxed text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-200">
      <IconShieldCheck width={18} height={18} className="mt-0.5 shrink-0 text-blue-500 dark:text-blue-400" />
      <div>
        <p className="font-semibold">This chat helps you understand your prescription — nothing more.</p>
        <p className="mt-1">
          The pharmacist explains what is written on it. They cannot change your prescription, adjust
          your dose, or issue a new one, and this chat does not replace your doctor or an in-person
          pharmacist consultation. For dosing decisions, always follow your prescriber. If you feel
          seriously unwell, seek medical care immediately.
        </p>
      </div>
    </div>
  )
}
