# Page operation parity

From fancy-cms-ui with the sibling fancy-cms checkout and its Composer
dependencies installed:

    npm run build
    node parity/run-ops.mjs

The runner sends the same documents and operations to the built JavaScript
reducer and fancy-cms/bin/page-ops.php. It compares every intermediate
document, invalid-operation reason, root ordering, serialized inverse, inverse
replay, and reduceAll result. Fractional ordering keys and invalid bounds are
also compared. Only object key order is canonicalized; objects and arrays,
null, missing fields, list order and string values remain distinct.

edges.json holds hand-written cases. generate.mjs commits the xorshift seed
0x5eedc0de and generates sixteen sequences of sixty-four operations plus
ordering-key cases independently of either reducer. Cases cover all thirteen
canonical operations, missing/duplicate ids, cycle moves, subtree inverses,
breakpoint maps, shallow null patches, action indices, animations, numeric map
keys, Unicode ordering and ids/breakpoints named like Object.prototype fields.
numbers.mjs adds every finite power of two and seeded IEEE-754 bit patterns
to compare JavaScript String(number) with PHP's formatter, including asymmetric
rounding intervals, subnormals and exponent/decimal thresholds.

Inverses use the JSON wire contract: JavaScript undefined fields disappear
before replay on both sides. This preserves the existing limitation that
merge inverses cannot remove a newly introduced field over JSON. Constraints,
animation and action operations have no inverse in the JavaScript reducer and
must return an empty inverse list in PHP too.

Use PageJson in PHP to preserve record/object identity when decoding and
encoding. A PHP array in a schema-defined record position is a map; arbitrary
JSON object values remain stdClass. The codec rejects wire arrays used where
an object record is required.

The development-only FANCY_CMS_PHP and FANCY_CMS_PHP_DRIVER environment
variables select an alternate PHP executable or driver. They let release
checks prove that isolated sabotaged copies fail without changing production
source. Arguments are passed directly to the executable; input travels on
stdin.
