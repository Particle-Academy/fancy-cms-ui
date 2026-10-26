import {describe,expect,it,vi} from "vitest";
import {renderToStaticMarkup} from "react-dom/server";
import {emitDocCss,BASE_CSS} from "../src/render/css";
import {emptyDoc,type PageDoc,type Json} from "../src/document/types";
import {CmsPage} from "../src/react/CmsPage";
import {CmsRegion} from "../src/react/CmsRegion";
import {RenderNode} from "../src/react/RenderNode";
import {Editor} from "../src/editor/Editor";
import {Canvas} from "../src/editor/Canvas";
import {EditablePage} from "../src/editor/EditablePage";
import type {FontRef,FontAsset,FontRenderOptions} from "../src/render/fonts";

const manifest="a".repeat(64),digest="b".repeat(64),alias=`cms-font-${manifest}`;
const reference=():FontRef=>({family:"Inter",source:"bundled",weights:[700,400,600]});
const asset=():FontAsset=>({family:"Inter",source:"bundled",manifestSha256:manifest,faces:[
  {src:`/site-fonts/${digest}.woff2`,sha256:digest,weight:[100,900],style:"normal",unicodeRange:"U+0000-00FF, U+0131"},
]});
function page(ref:Json=reference()):PageDoc{
  const doc=emptyDoc("fonts");doc.theme={font:{body:ref}};
  doc.nodes.hero={id:"hero",type:"heading",parent:null,order:"a",props:{content:"A real font"},style:{base:{fontFamily:"var(--cms-font-body)",fontWeight:700}}};return doc;
}
// The extended call deliberately exercises the existing public emitter on RED.
const emit=emitDocCss as (doc:PageDoc,options?:{fontResolver?:(ref:unknown)=>unknown;fontDisplay?:string})=>string;
function refusal(run:()=>unknown,reason:string):void{
  let error:unknown;try{run();}catch(e){error=e;}
  expect(error).toMatchObject({name:"FontResolutionException",reason,message:`CMS font resolution failed: ${reason}`});
}

describe("host-resolved same-origin font assets",()=>{
  it("normalizes once, emits the pinned alias and preserves a manifest's shard order",()=>{
    const resolve=vi.fn(()=>asset()),doc=page();
    (doc.theme!.font as Record<string,Json>).heading=reference();
    const css=emit(doc,{fontResolver:resolve,fontDisplay:"block"});
    expect(resolve).toHaveBeenCalledTimes(1);
    expect(resolve).toHaveBeenCalledWith({family:"Inter",source:"bundled",weights:[400,600,700],styles:["normal"]});
    expect(css).toContain(`@font-face {\n  font-display: block;\n  font-family: "${alias}";\n  font-style: normal;\n  font-weight: 100 900;\n  src: url("/site-fonts/${digest}.woff2") format("woff2");\n  unicode-range: U+0000-00FF, U+0131;\n}`);
    expect(css.match(/@font-face/g)).toHaveLength(1);
    expect(css).toContain(`--cms-font-body: "${alias}";`);
    expect(css).toContain(`--cms-font-heading: "${alias}";`);
    expect(css).not.toContain("--cms-font-body-family");
    expect(css).toContain("font-optical-sizing: none;\n  font-synthesis: none;");
    expect(css).not.toContain("local(");expect(css.startsWith(BASE_CSS+"\n\n")).toBe(true);
  });
  it("supports static italic faces, defaults swap and keeps unicode shards in supplied order",()=>{
    const ref={family:"Source Serif 4",source:"google",weights:[400],styles:["italic"]};
    const faces=[{src:"/fonts/latin-ext.woff2",sha256:digest,weight:400,style:"italic",unicodeRange:"U+0100-024F"},{src:"/fonts/latin.woff2",sha256:digest,weight:400,style:"italic",unicodeRange:"U+0000-00FF"}];
    const css=emit(page(ref),{fontResolver:()=>({...ref,manifestSha256:manifest,faces})});
    expect(css).toContain("font-display: swap;");expect(css).toContain("font-weight: 400;");expect(css).toContain("font-style: italic;");
    expect(css.indexOf("latin-ext.woff2")).toBeLessThan(css.indexOf('latin.woff2'));
  });
  it("retains exact legacy string CSS and never calls the font resolver",()=>{
    const doc=emptyDoc("legacy");doc.theme={font:{body:"Inter, system-ui",heading:"Georgia, serif"}};
    const resolve=vi.fn(()=>asset());
    expect(emit(doc,{fontResolver:resolve})).toBe(BASE_CSS+'\n\n:root {\n  --cms-font-body: Inter, system-ui;\n  --cms-font-heading: Georgia, serif;\n}\n');
    expect(resolve).not.toHaveBeenCalled();
  });
  it("does not mutate document/manifest data or cache resolution across renders",()=>{
    const doc=page(),before=JSON.stringify(doc),value=asset();Object.freeze(value.faces[0]!.weight);Object.freeze(value.faces[0]);Object.freeze(value.faces);Object.freeze(value);
    expect(emit(doc,{fontResolver:()=>value})).toContain(alias);expect(JSON.stringify(doc)).toBe(before);
    refusal(()=>emit(doc,{fontResolver:()=>null}),"missing-font");
  });
  it.each([undefined,()=>null])("refuses a missing font/resolver %j",resolver=>refusal(()=>emit(page(),{fontResolver:resolver}),resolver?"missing-font":"missing-resolver"));
  it("converts resolver exceptions to a constant typed refusal without leaking host details",()=>refusal(()=>emit(page(),{fontResolver:()=>{throw new Error("secret endpoint");}}),"resolver-failed"));
  it.each([{},[],{...reference(),family:"https://evil.test/font"},{...reference(),family:" Bad"},{...reference(),family:"Bad\nFamily"},{...reference(),source:"remote"},{...reference(),weights:[]},{...reference(),weights:[400,400]},{...reference(),weights:[0]},{...reference(),weights:[1001]},{...reference(),weights:[400.5]},{...reference(),weights:["400"]},{...reference(),styles:["oblique"]},{...reference(),styles:["normal","normal"]},{...reference(),url:"/authored.woff2"}])("refuses malformed reference %j",ref=>refusal(()=>emit(page(ref),{fontResolver:()=>asset()}),"invalid-reference"));
  it.each(["https://fonts.gstatic.com/a.woff2","//evil.test/a.woff2","data:font/woff2;base64,AAAA","blob:fake","file:///a.woff2","/\\evil/a.woff2","/fonts/a.woff2?x=1","/fonts/a.woff2#x","/fonts/%2f%2fevil.woff2","/fonts/../a.woff2","/fonts//a.woff2","/fonts/a b.woff2","/fonts/a\n.woff2","/fonts/a\".woff2","/fonts/a</style>.woff2"]) ('refuses noncanonical or external URL %j',src=>refusal(()=>emit(page(),{fontResolver:()=>({...asset(),faces:[{...asset().faces[0],src}]})}),"invalid-asset"));
  it.each([{manifestSha256:"short"},{family:"Other"},{source:"google"},{faces:[]},{faces:[{...asset().faces[0],sha256:"bad"}]},{faces:[{...asset().faces[0],weight:[900,100]}]},{faces:[{...asset().faces[0],style:"oblique"}]},{faces:[{...asset().faces[0],unicodeRange:"U+110000"}]},{faces:[{...asset().faces[0],unicodeRange:"U+0100-0000"}]},{faces:[{...asset().faces[0],unicodeRange:"U+0000; color:red"}]}])("refuses malformed host metadata %j",patch=>refusal(()=>emit(page(),{fontResolver:()=>({...asset(),...patch})}),"invalid-asset"));
  it("refuses absent requested weight/style",()=>{
    refusal(()=>emit(page(),{fontResolver:()=>({...asset(),faces:[{...asset().faces[0],weight:400}]})}),"missing-face");
    refusal(()=>emit(page({...reference(),styles:["italic"]}),{fontResolver:()=>asset()}),"missing-face");
  });
  it("bounds reference and manifest sizes",()=>{
    refusal(()=>emit(page({...reference(),weights:Array.from({length:17},(_,i)=>i+1)}),{fontResolver:()=>asset()}),"invalid-reference");
    refusal(()=>emit(page(),{fontResolver:()=>({...asset(),faces:Array.from({length:257},()=>asset().faces[0])})}),"invalid-asset");
    const doc=page();doc.theme={font:Object.fromEntries(Array.from({length:9},(_,i)=>[`font${i}`,{family:`Family ${i}`,source:"google",weights:[400]}]))};
    refusal(()=>emit(doc,{fontResolver:()=>asset()}),"too-many-fonts");
  });
  it("refuses unsupported display policy",()=>refusal(()=>emit(page(),{fontResolver:()=>asset(),fontDisplay:"optional"}),"invalid-display"));
  it.each(["/fonts/a.woff2\n","/fonts/a.woff2\r\n"])("refuses trailing controls in an otherwise valid path %j",src=>refusal(()=>emit(page(),{fontResolver:()=>({...asset(),faces:[{...asset().faces[0],src}]})}),"invalid-asset"));
  it("refuses a trailing control in a digest",()=>refusal(()=>emit(page(),{fontResolver:()=>({...asset(),manifestSha256:manifest+"\n"})}),"invalid-asset"));
  it("refuses a unicode ligature that expands into valid hex during JS uppercasing",()=>refusal(()=>emit(page(),{fontResolver:()=>({...asset(),faces:[{...asset().faces[0],unicodeRange:"U+\ufb00"}]})}),"invalid-asset"));
  it.each(["\u0000U+0000-00FF","\u00a0U+0000-00FF"])("refuses non-CSS whitespace around unicode ranges %j",unicodeRange=>refusal(()=>emit(page(),{fontResolver:()=>({...asset(),faces:[{...asset().faces[0],unicodeRange}]})}),"invalid-asset"));
  it("refuses sparse requested weights and sparse face lists",()=>{
    refusal(()=>emit(page({...reference(),weights:Array(1)}),{fontResolver:()=>asset()}),"invalid-reference");
    refusal(()=>emit(page(),{fontResolver:()=>({...asset(),faces:Array(1)})}),"invalid-asset");
  });
  it.each(["page","page-no-css","region","region-no-css","node","editor","canvas","editable"])("validates and forwards font policy through %s",surface=>{
    const doc=page(),resolve=vi.fn(()=>asset()),extra={fontResolver:resolve,fontDisplay:"block" as const};
    const render=(props:FontRenderOptions)=>renderToStaticMarkup(surface.startsWith("page")?<CmsPage doc={doc} includeStyles={surface!=="page-no-css"} {...props}/>:surface.startsWith("region")?<CmsRegion doc={doc} root="hero" includeStyles={surface!=="region-no-css"} {...props}/>:surface==="node"?<RenderNode doc={doc} id="hero" {...props}/>:surface==="editor"?<Editor value={doc} {...props}/>:surface==="canvas"?<Canvas doc={doc} selection={null} onSelect={()=>{}} apply={()=>{}} {...props}/>:<EditablePage doc={doc} {...props}/>);
    const html=render(extra);expect(resolve).toHaveBeenCalledTimes(1);
    if(!surface.endsWith("no-css")&&surface!=="node")expect(html).toContain("font-display: block;");
    refusal(()=>render({...extra,fontResolver:()=>null}),"missing-font");
  });
});
