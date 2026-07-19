// Deliberately narrow scope: header nav, homepage hero/feature-cards, and
// the core search controls — the highest-traffic surface. Everything else
// (admin, pharmacy dashboard, prescription chat, legal/medical notices)
// stays English-only regardless of the toggle: a mistranslation in
// medical-advice-adjacent copy is a real risk, not just a UX nitpick.
//
// Pidgin strings are AI-translated by Claude and have NOT been reviewed by
// a native speaker — treat as a rough draft, not a verified translation.

export const dictionary = {
  en: {
    'nav.findMedicine': 'Find medicine',
    'nav.askPharmacist': 'Ask a pharmacist',
    'nav.addPharmacy': 'Add your pharmacy outlet',
    'nav.login': 'Log in',
    'nav.logout': 'Log out',

    'hero.eyebrow': 'Nationwide Pharmacy Network',
    'hero.title': 'Find Medicine In Stock Near You',
    'hero.description':
      "Say goodbye to calling pharmacy after pharmacy. Search a drug, see who has it in stock nearby, and get directions or call — free, across Nigeria.",

    'feature.findMedicine.title': 'Find Your Medicine',
    'feature.findMedicine.cta': 'Search now',
    'feature.askPharmacist.title': 'Ask a Pharmacist',
    'feature.askPharmacist.cta': 'Chat now',
    'feature.addPharmacy.title': 'Add Your Pharmacy Outlet',
    'feature.addPharmacy.cta': 'Register now',

    'search.stateLabel': 'Searching in',
    'search.placeholder': 'Search a drug, e.g. Paracetamol or Panadol',
    'search.button': 'Search',
    'search.pickStateHint': 'Pick your state above to search pharmacies there',

    'results.directions': 'Directions',
    'results.call': 'Call',
  },
  pcm: {
    'nav.findMedicine': 'Find medicine',
    'nav.askPharmacist': 'Ask pharmacist',
    'nav.addPharmacy': 'Add your pharmacy shop',
    'nav.login': 'Log in',
    'nav.logout': 'Log out',

    'hero.eyebrow': 'Pharmacy Network for Naija',
    'hero.title': 'Find Medicine Wey Dey Near You',
    'hero.description':
      "No need to dey call pharmacy after pharmacy again. Search for drug, see who get am near you, then get direction or call — e free, anywhere for Nigeria.",

    'feature.findMedicine.title': 'Find Your Medicine',
    'feature.findMedicine.cta': 'Search now',
    'feature.askPharmacist.title': 'Ask Pharmacist',
    'feature.askPharmacist.cta': 'Chat now',
    'feature.addPharmacy.title': 'Add Your Pharmacy Shop',
    'feature.addPharmacy.cta': 'Register now',

    'search.stateLabel': 'You dey search for',
    'search.placeholder': 'Search for drug, e.g. Paracetamol or Panadol',
    'search.button': 'Search',
    'search.pickStateHint': 'Pick your state for up so you fit search pharmacy for there',

    'results.directions': 'Direction',
    'results.call': 'Call',
  },
} as const

export type Locale = keyof typeof dictionary
export type DictKey = keyof typeof dictionary.en
