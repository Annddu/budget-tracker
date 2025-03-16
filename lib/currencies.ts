export const Currencies = [
    { value: 'USD', label: '$ Dollar', locale: 'en-US' },
    { value: 'EUR', label: '€ Euro', locale: 'de-DE' },
    { value: 'GBP', label: '£ Pound', locale: 'en-GB' },
    { value: 'RON', label: 'RON Leu', locale: 'ro-RO' },
];

export type Curency = (typeof Currencies)[0];