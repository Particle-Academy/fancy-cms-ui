import {describe,it,expect} from "vitest";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
const root=new URL("../fonts/inter-4.1/",import.meta.url);
const hash=bytes=>createHash("sha256").update(bytes).digest("hex");
describe("opt-in unmodified Inter 4.1 bundle",()=>{
  it("records archive provenance, licence and every supplied normal/italic WOFF2 byte",()=>{
    const manifest=JSON.parse(readFileSync(new URL("manifest.json",root),"utf8"));
    expect(manifest).toMatchObject({family:"Inter",source:"bundled",version:"4.1",archive:{url:"https://github.com/rsms/inter/releases/download/v4.1/Inter-4.1.zip"},licence:{file:"OFL.txt",spdx:"OFL-1.1"}});
    expect(manifest.archive.sha256).toMatch(/^[a-f0-9]{64}$/);
    const licence=readFileSync(new URL(manifest.licence.file,root));
    expect(hash(licence)).toBe(manifest.licence.sha256);expect(licence.toString()).toContain("SIL OPEN FONT LICENSE Version 1.1");
    expect(readFileSync(new URL("NOTICE",root),"utf8")).toContain("Unmodified");
    expect(manifest.faces).toHaveLength(2);expect(manifest.faces.map(f=>f.style).sort()).toEqual(["italic","normal"]);
    for(const face of manifest.faces){
      expect(face.file).toMatch(/^[A-Za-z0-9.-]+\.woff2$/);
      const bytes=readFileSync(new URL(face.file,root));
      expect(bytes.subarray(0,4).toString()).toBe("wOF2");expect(bytes.readUInt32BE(8)).toBe(bytes.length);
      expect(bytes.length).toBe(face.bytes);expect(hash(bytes)).toBe(face.sha256);expect(face.weight).toEqual([100,900]);
    }
  });
  it("publishes assets only through an explicit opt-in subpath",()=>{
    const pkg=JSON.parse(readFileSync(new URL("../package.json",import.meta.url),"utf8"));
    expect(pkg.files).toContain("fonts");expect(pkg.exports["./fonts/inter/*"]).toBe("./fonts/inter-4.1/*");
  });
});
