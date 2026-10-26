import {describe,expect,it,vi} from "vitest";
import {renderToStaticMarkup} from "react-dom/server";
import {CmsPage} from "../src/react/CmsPage";
import {CmsRegion} from "../src/react/CmsRegion";
import {RenderNode} from "../src/react/RenderNode";
import {Editor} from "../src/editor/Editor";
import {EditablePage} from "../src/editor/EditablePage";
import {emptyDoc,type PageDoc} from "../src/document/types";
import type {ImageAssetResolver} from "../src/render/images";

const asset=()=>({src:"https://cdn.example.test/hero.jpg",width:1536,height:1024,
  variants:[{src:"/hero-960.jpg",width:960,height:640},{src:"/hero-480.jpg",width:480,height:320}],
  sizes:"(max-width: 640px) 100vw, 640px"});
function doc(props:Record<string,unknown>={asset:"brief/hero"}):PageDoc{
  const page=emptyDoc("asset-page");page.nodes.image={id:"image",type:"image",parent:null,order:"a",props,style:{base:{}}} as PageDoc["nodes"][string];return page;
}
const render=(props:Record<string,unknown>,imageResolver?: (handle:string)=>unknown)=>renderToStaticMarkup(<CmsPage doc={doc(props)} imageResolver={imageResolver as ImageAssetResolver} includeStyles={false}/>);

describe("host-resolved image assets",()=>{
  it("keeps a sparse variant list inert without throwing during render",()=>{
    expect(render({asset:"brief/hero"},()=>({...asset(),variants:Array(2)}))).toBe('<div data-cms="image"><img alt="" loading="lazy"/></div>');
  });
  it("emits measured dimensions and sorted declared variants, preserves alt/fit/loading",()=>{
    const html=render({asset:"brief/hero",src:"https://untrusted.invalid/fallback.jpg",width:1,srcSet:"https://untrusted.invalid/override.jpg 1w",alt:"Scene <one> & two",fit:"contain",loading:"eager"},()=>asset());
    expect(html).toBe('<link rel="preload" as="image" imageSrcSet="/hero-480.jpg 480w, /hero-960.jpg 960w" imageSizes="(max-width: 640px) 100vw, 640px"/><div data-cms="image"><img src="https://cdn.example.test/hero.jpg" alt="Scene &lt;one&gt; &amp; two" width="1536" height="1024" srcSet="/hero-480.jpg 480w, /hero-960.jpg 960w" sizes="(max-width: 640px) 100vw, 640px" loading="eager" data-cms-fit="contain"/></div>');
  });
  it.each([null,"missing","",42,{$bind:"asset"}])("keeps unknown or invalid handle %j inert",handle=>{
    expect(render({asset:handle,src:"https://untrusted.invalid/fallback.jpg",alt:"Retain alt"},()=>null)).toBe('<div data-cms="image"><img alt="Retain alt" loading="lazy"/></div>');
  });
  it("requires a resolver for asset handles, with no authored-URL fallback",()=>{
    expect(render({asset:"brief/hero",src:"/legacy.jpg"})).toBe('<div data-cms="image"><img alt="" loading="lazy"/></div>');
    expect(render({src:"/legacy.jpg"})).toBe('<div data-cms="image"><img src="/legacy.jpg" alt="" loading="lazy"/></div>');
  });
  it.each([{width:0},{height:"1024"},{src:"javascript:run()"},{src:"//outside.invalid/image.jpg"},{src:"/bad image.jpg"},
    {variants:[{src:"/a.jpg",width:480,height:320},{src:"/b.jpg",width:480,height:320}]},
    {variants:[{src:"data:image/png;base64,aA==",width:480,height:320}]},{variants:[{src:"/a.jpg",width:480}]},{sizes:""},{variants:"not-a-list"}])("drops invalid metadata %j without partial sources",patch=>{
    expect(render({asset:"brief/hero"},()=>({...asset(),...patch}))).toBe('<div data-cms="image"><img alt="" loading="lazy"/></div>');
  });
  it("renders a single declared source without inventing srcset or sizes",()=>{
    expect(render({asset:"one"},()=>({src:"/single.jpg",width:20,height:10}))).toBe('<div data-cms="image"><img src="/single.jpg" alt="" width="20" height="10" loading="lazy"/></div>');
  });
  it("never invokes a resolver on a bound or malformed handle",()=>{
    const resolve=vi.fn(()=>asset());render({asset:{$bind:"asset"}},resolve);expect(resolve).not.toHaveBeenCalled();
  });
  it("does not mutate a host manifest or cache it across pages",()=>{
    const image=asset();Object.freeze(image.variants);Object.freeze(image);
    expect(render({asset:"same"},()=>image)).toContain('srcSet="/hero-480.jpg 480w, /hero-960.jpg 960w"');
    expect(image.variants[0]!.width).toBe(960);
    expect(render({asset:"same"},()=>({src:"/other.jpg",width:40,height:20}))).toContain('src="/other.jpg"');
  });
  it.each(["page","region","node","editor","editable"])("passes the host resolver through the %s surface",surface=>{
    const page=doc(),imageResolver=()=>asset();
    const node=surface==="page"?<CmsPage doc={page} imageResolver={imageResolver}/>:surface==="region"?<CmsRegion doc={page} root="image" imageResolver={imageResolver}/>:surface==="node"?<RenderNode doc={page} id="image" imageResolver={imageResolver}/>:surface==="editor"?<Editor value={page} imageResolver={imageResolver}/>:<EditablePage doc={page} imageResolver={imageResolver}/>;
    expect(renderToStaticMarkup(node)).toContain('src="https://cdn.example.test/hero.jpg"');
  });
});
