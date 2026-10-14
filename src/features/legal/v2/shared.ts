import type { LegalContext } from '../types';

/** "Name (company no. …)" for the operator, or the generic description when the name isn't set. */
export function operatorLine(c: LegalContext): string {
  const o = c.operator;
  if (c.locale === 'en')
    return o.name ? `${o.name}${o.id ? ` (company no. ${o.id})` : ''}` : `the operator of ${c.brand}`;
  return o.name ? `${o.name}${o.id ? ` (ח״פ ${o.id})` : ''}` : `מפעילת השירות ${c.brand}`;
}

/** The operator's contact details, one line (blank details are left out, never invented). */
export function contactLine(c: LegalContext, email: string = c.operator.email): string {
  const o = c.operator;
  const he = c.locale === 'he';
  return (
    [
      o.name || c.brand,
      o.address ? `${he ? 'כתובת' : 'address'}: ${o.address}` : null,
      email ? `${he ? 'מייל' : 'email'}: ${email}` : null,
      o.phone ? `${he ? 'טלפון' : 'phone'}: ${o.phone}` : null,
    ]
      .filter(Boolean)
      .join(' · ') + (he ? '. או בטופס יצירת הקשר.' : '. Or through the contact form.')
  );
}

export const money = (v: number) => `₪${v}`;
