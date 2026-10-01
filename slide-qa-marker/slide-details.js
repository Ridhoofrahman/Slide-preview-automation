/* QA Checkpoint — slide inspector
   Reads one exported slide (.pptx as base64) and returns the fonts, sizes and speaker notes
   it really uses, following PowerPoint's inheritance: run → shape → layout → master → theme.
   Needs JSZip (loaded before this file). */
window.SlideDetails = (function () {
  const A = "http://schemas.openxmlformats.org/drawingml/2006/main";
  const P = "http://schemas.openxmlformats.org/presentationml/2006/main";
  const PR = "http://schemas.openxmlformats.org/package/2006/relationships";
  const DEFAULT_SZ = 1800; // PowerPoint's built-in default, 18pt

  const parse = (s) => new DOMParser().parseFromString(s, "application/xml");
  const kids = (el, ns, name) => (el ? Array.from(el.children).filter((c) => c.namespaceURI === ns && c.localName === name) : []);
  const kid = (el, ns, name) => kids(el, ns, name)[0] || null;
  const all = (el, ns, name) => (el ? Array.from(el.getElementsByTagNameNS(ns, name)) : []);

  function resolvePath(base, target) {
    if (target.startsWith("/")) return target.slice(1);
    const parts = base.split("/"); parts.pop();
    target.split("/").forEach((seg) => { if (seg === "..") parts.pop(); else if (seg && seg !== ".") parts.push(seg); });
    return parts.join("/");
  }
  async function load(zip, path) { const f = path && zip.file(path); return f ? parse(await f.async("string")) : null; }
  async function relsOf(zip, partPath) {
    const segs = partPath.split("/"); const file = segs.pop();
    const doc = await load(zip, segs.join("/") + "/_rels/" + file + ".rels");
    if (!doc) return [];
    return Array.from(doc.getElementsByTagNameNS(PR, "Relationship"))
      .filter((r) => r.getAttribute("TargetMode") !== "External")
      .map((r) => ({ type: r.getAttribute("Type") || "", target: resolvePath(partPath, r.getAttribute("Target")) }));
  }
  const relTarget = (rels, kind) => { const r = rels.find((x) => x.type.endsWith("/" + kind)); return r ? r.target : null; };

  // ---- placeholders
  function phOf(sp) {
    const nv = kid(sp, P, "nvSpPr"); const nvPr = nv && kid(nv, P, "nvPr"); const ph = nvPr && kid(nvPr, P, "ph");
    return ph ? { type: ph.getAttribute("type") || "body", idx: ph.getAttribute("idx") } : null;
  }
  function role(ph) {
    if (!ph) return "Text box";
    if (ph.type === "title" || ph.type === "ctrTitle") return "Title";
    if (ph.type === "subTitle") return "Subtitle";
    if (["dt", "ftr", "sldNum", "hdr"].includes(ph.type)) return "Footer";
    return "Body";
  }
  const masterStyleFor = (ph) => (!ph ? null : (ph.type === "title" || ph.type === "ctrTitle") ? "titleStyle" : ["dt", "ftr", "sldNum", "hdr"].includes(ph.type) ? "otherStyle" : "bodyStyle");
  function findPh(doc, ph) {
    if (!doc || !ph) return null;
    const sps = all(doc, P, "sp");
    const by = (fn) => sps.find((s) => { const p = phOf(s); return p && fn(p); });
    return (ph.idx && by((p) => p.idx === ph.idx)) || by((p) => p.type === ph.type) ||
      (ph.type === "ctrTitle" && by((p) => p.type === "title")) || (ph.type === "subTitle" && by((p) => p.type === "body")) || null;
  }
  const lstStyle = (sp) => { const tx = sp && kid(sp, P, "txBody"); return tx ? kid(tx, A, "lstStyle") : null; };
  const lvlDef = (list, lvl) => { const l = list && kid(list, A, "lvl" + (lvl + 1) + "pPr"); return l ? kid(l, A, "defRPr") : null; };

  // ---- main
  async function fromBase64(b64) {
    const zip = await JSZip.loadAsync(b64, { base64: true });
    const slidePath = Object.keys(zip.files).filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p)).sort()[0];
    if (!slidePath) throw new Error("No slide found in export");
    const slide = await load(zip, slidePath);
    const sRels = await relsOf(zip, slidePath);
    const layoutPath = relTarget(sRels, "slideLayout");
    const layout = await load(zip, layoutPath);
    const masterPath = layoutPath ? relTarget(await relsOf(zip, layoutPath), "slideMaster") : null;
    const master = await load(zip, masterPath);
    const themePath = masterPath ? relTarget(await relsOf(zip, masterPath), "theme") : null;
    const theme = await load(zip, themePath);
    const pres = await load(zip, "ppt/presentation.xml");

    const themeFont = (ref) => {
      if (!ref || ref[0] !== "+" || !theme) return ref;
      const which = ref.startsWith("+mj") ? "majorFont" : "minorFont";
      const f = all(theme, A, which)[0]; const latin = f && kid(f, A, "latin");
      return (latin && latin.getAttribute("typeface")) || ref;
    };
    const masterTx = master && all(master, P, "txStyles")[0];
    const presDefault = pres && all(pres, P, "defaultTextStyle")[0];

    const groups = new Map(); let smallest = null; const shrunk = [];
    const note = (font, sizePt, who, text, inherited) => {
      const key = font + "|" + sizePt;
      const g = groups.get(key) || { font, size: sizePt, count: 0, roles: new Set(), sample: "", inherited: true };
      g.count++; g.roles.add(who); if (!g.sample && text.trim()) g.sample = text.trim().slice(0, 48);
      g.inherited = g.inherited && inherited; groups.set(key, g);
      if (smallest === null || sizePt < smallest) smallest = sizePt;
    };

    function readTextBody(txBody, chainFor, who) {
      const bodyPr = kid(txBody, A, "bodyPr"); const fit = bodyPr && kid(bodyPr, A, "normAutofit");
      const scale = fit && fit.getAttribute("fontScale") ? parseInt(fit.getAttribute("fontScale"), 10) / 100000 : 1;
      kids(txBody, A, "p").forEach((p) => {
        const pPr = kid(p, A, "pPr"); const lvl = pPr && pPr.getAttribute("lvl") ? parseInt(pPr.getAttribute("lvl"), 10) : 0;
        const chain = chainFor(lvl);
        Array.from(p.children).filter((c) => c.namespaceURI === A && (c.localName === "r" || c.localName === "fld")).forEach((r) => {
          const t = kid(r, A, "t"); const text = t ? t.textContent : "";
          if (!text.trim()) return;
          const rPr = kid(r, A, "rPr");
          const links = [rPr].concat(chain).filter(Boolean);
          let sz = null, face = null, fromRun = !!(rPr && rPr.getAttribute("sz"));
          for (const el of links) { if (sz === null && el.getAttribute("sz")) sz = parseInt(el.getAttribute("sz"), 10); const l = kid(el, A, "latin"); if (face === null && l && l.getAttribute("typeface")) face = l.getAttribute("typeface"); }
          if (sz === null) sz = DEFAULT_SZ;
          const font = themeFont(face || "+mn-lt");
          const pt = Math.round((sz / 100) * scale * 2) / 2;
          if (scale < 1 && !shrunk.includes(who)) shrunk.push(who);
          note(font, pt, who, text, !fromRun);
        });
      });
    }

    all(slide, P, "sp").forEach((sp) => {
      const tx = kid(sp, P, "txBody"); if (!tx) return;
      const ph = phOf(sp); const who = role(ph);
      const lPh = findPh(layout, ph), mPh = findPh(master, ph);
      const style = masterTx && masterStyleFor(ph) ? kid(masterTx, P, masterStyleFor(ph)) : null;
      readTextBody(tx, (lvl) => ph
        ? [lvlDef(lstStyle(sp), lvl), lvlDef(lstStyle(lPh), lvl), lvlDef(lstStyle(mPh), lvl), lvlDef(style, lvl)]
        : [lvlDef(lstStyle(sp), lvl), lvlDef(presDefault, lvl)], who);
    });
    all(slide, A, "tc").forEach((tc) => { const tx = kid(tc, A, "txBody"); if (tx) readTextBody(tx, (lvl) => [lvlDef(presDefault, lvl)], "Table"); });

    // speaker notes
    let notes = { present: false, text: "" };
    const notesPath = relTarget(sRels, "notesSlide");
    if (notesPath) {
      const nd = await load(zip, notesPath);
      const body = all(nd, P, "sp").find((sp) => { const p = phOf(sp); return p && p.type === "body"; });
      if (body) {
        const text = kids(kid(body, P, "txBody"), A, "p").map((p) => all(p, A, "t").map((t) => t.textContent).join("")).join("\n").trim();
        notes = { present: !!text, text };
      }
    }

    const fonts = Array.from(groups.values())
      .map((g) => ({ font: g.font, size: g.size, count: g.count, roles: Array.from(g.roles), sample: g.sample, inherited: g.inherited }))
      .sort((a, b) => b.size - a.size || a.font.localeCompare(b.font));
    return { version: 1, fonts, smallest, shrunk, notes, notesPartFound: !!notesPath };
  }

  return { fromBase64 };
})();
