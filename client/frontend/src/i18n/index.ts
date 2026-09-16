import { en } from './en';
import { ru, type Translations } from './ru';

export type Locale = 'ru' | 'en';

const translations: Record<Locale, Translations> = { ru, en };

export function t(locale: Locale): Translations {
  return translations[locale];
}

export { ru, en };
export type { Translations };
