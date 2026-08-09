/**
 * Spoken notes on a prescription query.
 *
 * Typing a symptom in English is a real barrier: the words for what is
 * wrong often come first in Pidgin, Ibibio, Hausa or Yoruba, and a patient
 * who can describe it in thirty seconds of speech will write two flat
 * lines instead — or give up. Recording is also simply faster on a phone,
 * with one hand, while holding the prescription.
 *
 * Nothing here transcribes anything, on purpose. A general speech model
 * on Nigerian English and Pidgin produces fluent, confident, wrong text,
 * and a pharmacist reading "no pain" where the patient said "know pain"
 * is a worse outcome than no transcript at all. The pharmacist listens.
 */

/**
 * What browsers actually produce from MediaRecorder: WebM/Opus on
 * Chrome and Android, MP4/AAC on iOS Safari, Ogg on Firefox. Recorded
 * audio arrives with codec parameters attached ("audio/webm;codecs=opus"),
 * so every check here goes through normaliseAudioType first.
 */
export const ALLOWED_AUDIO_TYPES = ['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/mpeg'] as const

export type AudioType = (typeof ALLOWED_AUDIO_TYPES)[number]

/** Long enough to explain a symptom, short enough not to cost a data bundle. */
export const MAX_AUDIO_SECONDS = 120

/**
 * A generous ceiling on bytes, not a target. Opus at speech bitrates puts
 * two minutes near 400 KB; iOS AAC is fatter. This exists to stop
 * something absurd being pushed at storage, and it is the only limit the
 * server can actually enforce — duration is whatever the client claims.
 */
export const MAX_AUDIO_BYTES = 8 * 1024 * 1024

/** "audio/webm;codecs=opus" → "audio/webm". Returns null if unsupported. */
export function normaliseAudioType(raw: string | null | undefined): AudioType | null {
  if (!raw) return null
  const base = raw.split(';')[0].trim().toLowerCase()
  return (ALLOWED_AUDIO_TYPES as readonly string[]).includes(base) ? (base as AudioType) : null
}

/** "0:07", "1:42" — the shape of every voice note anyone has ever seen. */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/**
 * Clamps the duration a client reports.
 *
 * It is only ever a label on a play button, never a limit or a bill, so
 * it does not need verifying — but it does need bounding, or a crafted
 * upload puts "9999:99" on a pharmacist's screen.
 */
export function clampReportedDuration(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value) : typeof value === 'number' ? value : NaN
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.min(Math.round(n), MAX_AUDIO_SECONDS)
}
