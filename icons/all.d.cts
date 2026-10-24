type Glyph = readonly (readonly [string, Readonly<Record<string, string | number>>])[];
declare const icons: Readonly<Record<string, Glyph>>;
export = icons;
