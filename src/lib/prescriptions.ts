import type { Session } from './auth'

type UploadAccess = {
  patientUserId: string
  pharmacistUserId: string | null
  status: string
}

/** Who may view a prescription upload (image, thread):
 *  the patient who owns it, the pharmacist who claimed it,
 *  any pharmacist while it is still unclaimed, and admins. */
export function canViewUpload(session: Session, upload: UploadAccess): boolean {
  if (session.role === 'ADMIN') return true
  if (upload.patientUserId === session.userId) return true
  if (session.role === 'PHARMACIST') {
    return upload.pharmacistUserId === session.userId || upload.status === 'PENDING'
  }
  return false
}

/** Who may post messages: the two participants, while the thread is open. */
export function canMessageUpload(session: Session, upload: UploadAccess): boolean {
  if (upload.status === 'CLOSED') return false
  return (
    upload.patientUserId === session.userId ||
    (session.role === 'PHARMACIST' && upload.pharmacistUserId === session.userId)
  )
}
