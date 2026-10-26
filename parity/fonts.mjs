import {execFileSync} from "node:child_process";
import {createHash} from "node:crypto";
import {emitDocCss,emptyDoc} from "../dist/index.js";

/** Independent negative controls as well as equality: two accepting emitters cannot pass. */
export function fontParity(phpBin){
  const sha="a".repeat(64),digest="b".repeat(64);
  const face={src:`/fonts/${digest}.woff2`,sha256:digest,weight:[100,900],style:"normal",unicodeRange:"U+0000-00ff, U+0131"};
  const asset={family:"Inter",source:"bundled",manifestSha256:sha,faces:[face]};
  const ref={family:"Inter",source:"bundled",weights:[700,400,600]};
  function check(name,reference,manifest,expected,fontDisplay="swap",extra={}){
    const doc=emptyDoc("parity-fonts");doc.theme={font:{body:reference,...extra}};
    const assets={"bundled:Inter":manifest};
    let js,php,jsReason,phpReason;
    try{js=emitDocCss(doc,{fontResolver:r=>assets[`${r.source}:${r.family}`]??null,fontDisplay});}catch(e){jsReason=e.reason;}
    try{php=execFileSync(process.env.FANCY_CMS_PHP||"php",[phpBin,"--fonts-stdin"],{encoding:"utf8",input:JSON.stringify({doc,assets,fontDisplay}),stdio:["pipe","pipe","pipe"]});}catch(e){if(e.status!==3)throw e;phpReason=e.stderr.trim();}
    if(expected){if(jsReason!==expected||phpReason!==expected)throw new Error(`${name}: expected ${expected}, JS=${jsReason}, PHP=${phpReason}`);}
    else if(jsReason||phpReason||js!==php)throw new Error(`${name}: font CSS differs or unexpectedly refused (JS=${jsReason}, PHP=${phpReason})`);
    else if(typeof reference==="object"&&!js.includes(`--cms-font-body: "cms-font-${sha}";`))throw new Error(`${name}: missing pinned token`);
    console.log(`FONT PARITY PASS ${name}: ${expected??createHash("sha256").update(js).digest("hex")}`);
  }
  check("variable-normal",ref,asset,null);
  check("capture-block-and-dedup",ref,asset,null,"block",{heading:{...ref,weights:[400,600,700],styles:["normal"]}});
  check("legacy-string","Inter, system-ui",null,null);
  check("static-italic-shards",{...ref,weights:[400.0],styles:["italic"]},{...asset,faces:[{...face,src:"/fonts/ext.woff2",weight:400.0,style:"italic",unicodeRange:"u+0100-024f"},{...face,src:"/fonts/latin.woff2",weight:400,style:"italic",unicodeRange:"U+0??"}]},null);
  check("missing",ref,null,"missing-font");
  check("missing-weight",ref,{...asset,faces:[{...face,weight:400}]},"missing-face");
  check("wrong-family",ref,{...asset,family:"Other"},"invalid-asset");
  check("bad-display",ref,asset,"invalid-display","optional");
  for(const weights of [[],[400,400],[400.5],[0],[1001],["400"],Array.from({length:17},(_,i)=>i+1)])check(`bad-weights-${JSON.stringify(weights)}`,{...ref,weights},asset,"invalid-reference");
  for(const src of ["https://fonts.gstatic.com/a.woff2","//evil/a.woff2","data:font/woff2;base64,aA==","/fonts/../a.woff2","/fonts/%2f%2fevil.woff2","/fonts/a.woff2\n","/fonts/a.woff2?x=1","/fonts/\\a.woff2","/fonts/a</style>.woff2"])check(`bad-path-${JSON.stringify(src)}`,ref,{...asset,faces:[{...face,src}]},"invalid-asset");
  for(const unicodeRange of ["U+110000","U+0100-0000","U+0000; color:red","\u0000U+0000-00FF","\u00a0U+0000-00FF","U+\ufb00"])check(`bad-unicode-${JSON.stringify(unicodeRange)}`,ref,{...asset,faces:[{...face,unicodeRange}]},"invalid-asset");
}
