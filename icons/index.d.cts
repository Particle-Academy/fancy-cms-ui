type Glyph = readonly (readonly [string, Readonly<Record<string, string | number>>])[];
export declare function loadIcons(names: Iterable<string>): Promise<Record<string, Glyph>>;
