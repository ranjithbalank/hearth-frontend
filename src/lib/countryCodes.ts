/** The one list of phone country codes in the product — India first, since
 *  every other India-specific default here (statutory payroll, GST) already
 *  assumes it. Curated rather than the full ITU list; add more as properties
 *  need them.
 *
 *  This used to be two lists: this one (used by HR's country_code column) and a
 *  separate DIAL_CODES inside design/PhoneInput, which offered a different set —
 *  so which countries you could pick depended on which screen you were on. */
export const COUNTRY_CODES = [
  { code: "+91", label: "+91 India" },
  { code: "+1", label: "+1 US/Canada" },
  { code: "+44", label: "+44 UK" },
  { code: "+61", label: "+61 Australia" },
  { code: "+49", label: "+49 Germany" },
  { code: "+33", label: "+33 France" },
  { code: "+971", label: "+971 UAE" },
  { code: "+966", label: "+966 Saudi Arabia" },
  { code: "+65", label: "+65 Singapore" },
  { code: "+60", label: "+60 Malaysia" },
  { code: "+66", label: "+66 Thailand" },
  { code: "+94", label: "+94 Sri Lanka" },
  { code: "+977", label: "+977 Nepal" },
  { code: "+880", label: "+880 Bangladesh" },
];

/** Longest first, so "+91" never claims a number that belongs to a longer code. */
export const DIAL_CODES_BY_LENGTH = [...COUNTRY_CODES]
  .map((c) => c.code)
  .sort((a, b) => b.length - a.length);
