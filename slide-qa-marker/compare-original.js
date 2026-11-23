// Compare with original (spec: docs/specs/compare-with-original.md). Runs in the browser only: no server, no upload.
// Spike build: the zip reader, the text reader and the comparison engine. The panel will lazy-load this file.
//
// ZIP: reads only the central directory and the XML parts it needs, straight from the File with Blob.slice(),
// so a 100 MB+ deck is never loaded into memory and media are never decompressed.
(function (root) {
  "use strict";
  const td = new TextDecoder("utf-8");

  // ---------- range-based zip reader ----------
  async function u8(blob, start, end) { return new Uint8Array(await blob.slice(start, end).arrayBuffer()); }
  const le16 = (b, o) => b[o] | (b[o + 1] << 8);
  const le32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16)) + b[o + 3] * 16777216;

  async function openZip(blob) {
    const size = blob.size, tailLen = Math.min(size, 65557), tail = await u8(blob, size - tailLen, size);
    let eocd = -1;
    for (let i = tail.length - 22; i >= 0; i--) if (tail[i] === 0x50 && tail[i + 1] === 0x4b && tail[i + 2] === 0x05 && tail[i + 3] === 0x06) { eocd = i; break; }
    if (eocd < 0) throw codeErr("not-zip", "Not a zip file");
    let cdSize = le32(tail, eocd + 12), cdOff = le32(tail, eocd + 16), count = le16(tail, eocd + 10);
    if (cdOff === 0xffffffff || cdSize === 0xffffffff) {   // ZIP64 (files over 4 GB): read the zip64 end record
      const loc = eocd - 20;
      if (loc < 0 || le32(tail, loc) !== 0x07064b50) throw codeErr("zip64", "Unsupported zip");
      const z64 = await u8(blob, Number(le32(tail, loc + 8)), Number(le32(tail, loc + 8)) + 56);
      count = le32(z64, 32); cdSize = le32(z64, 40); cdOff = le32(z64, 48);
    }
    const cd = await u8(blob, cdOff, cdOff + cdSize), entries = new Map();
    for (let p = 0, k = 0; k < count && p + 46 <= cd.length; k++) {
      if (le32(cd, p) !== 0x02014b50) break;
      const method = le16(cd, p + 10), flags = le16(cd, p + 8), comp = le32(cd, p + 20), unc = le32(cd, p + 24);
      const nl = le16(cd, p + 28), xl = le16(cd, p + 30), cl = le16(cd, p + 32), off = le32(cd, p + 42);
      const name = td.decode(cd.subarray(p + 46, p + 46 + nl));
      entries.set(name, { name, method, flags, comp, unc, off });
      p += 46 + nl + xl + cl;
    }
    return {
      names: () => [...entries.keys()],
      has: (n) => entries.has(n),
      async text(name) {
        const e = entries.get(name); if (!e) return null;
        if (e.flags & 1) throw codeErr("encrypted", "Encrypted entry");
        const lh = await u8(blob, e.off, e.off + 30);
        const start = e.off + 30 + le16(lh, 26) + le16(lh, 28);
        const data = await u8(blob, start, start + e.comp);
        if (e.method === 0) return td.decode(data);
        if (e.method !== 8) throw codeErr("method", "Unsupported compression " + e.method);
        return td.decode(await inflateRaw(data));
      }
    };
  }
  async function inflateRaw(data) {
    if (typeof DecompressionStream === "function") {
      const ds = new DecompressionStream("deflate-raw");
      const buf = await new Response(new Blob([data]).stream().pipeThrough(ds)).arrayBuffer();
      return new Uint8Array(buf);
    }
    throw codeErr("no-inflate", "This PowerPoint version can't read the file");   // no DecompressionStream (very old WebView)
  }
  function codeErr(code, msg) { const e = new Error(msg); e.code = code; return e; }

  // ---------- OOXML helpers ----------
  const xml = (s) => new DOMParser().parseFromString(s, "application/xml");
  const kids = (el, local) => [...el.children].filter((c) => c.localName === local);
  const all = (el, local) => [...el.getElementsByTagNameNS("*", local)];
  const RNS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
  function rels(text, base) {
    const out = {}; if (!text) return out;
    all(xml(text), "Relationship").forEach((r) => { out[r.getAttribute("Id")] = { type: r.getAttribute("Type") || "", target: resolve(base, r.getAttribute("Target") || ""), external: r.getAttribute("TargetMode") === "External" }; });
    return out;
  }
  function resolve(base, target) {
    if (target.startsWith("/")) return target.slice(1);
    const parts = base.split("/"); parts.pop();
    target.split("/").forEach((s) => { if (s === "..") parts.pop(); else if (s !== ".") parts.push(s); });
    return parts.join("/");
  }
  const relsPath = (part) => { const i = part.lastIndexOf("/"); return part.slice(0, i) + "/_rels/" + part.slice(i + 1) + ".rels"; };
  // One paragraph's text: runs, fields, line breaks
  function paraText(p) {
    let s = "";
    for (const n of p.children) {
      if (n.localName === "r" || n.localName === "fld") s += all(n, "t").map((t) => t.textContent).join("");
      else if (n.localName === "br") s += " ";   // soft line break (Shift+Enter): layout only
    }
    return s;
  }
  function bodyParas(txBody) { return kids(txBody, "p").map(paraText).filter((t) => t.trim()); }

  // ---------- read one presentation ----------
  // Returns { slides: [ { index, part, blocks: [ {loc, text, shape} ] } ] } in presentation order (sldIdLst), plus timings.
  async function readDeck(blob, opts) {
    opts = opts || {};
    const t0 = now(); const zip = await openZip(blob);
    if (zip.has("EncryptedPackage") || (!zip.has("ppt/presentation.xml") && zip.has("EncryptionInfo"))) throw codeErr("password", "Password-protected");
    if (!zip.has("ppt/presentation.xml")) throw codeErr("not-pptx", "Not a PowerPoint file");
    const pres = xml(await zip.text("ppt/presentation.xml"));
    const prels = rels(await zip.text("ppt/_rels/presentation.xml.rels"), "ppt/presentation.xml");
    const order = all(pres, "sldId").map((s) => prels[s.getAttributeNS(RNS, "id") || s.getAttribute("r:id")]).filter(Boolean).map((r) => r.target);
    const slides = [];
    const only = opts.only ? new Set(opts.only) : null;
    for (let i = 0; i < order.length; i++) {
      if (only && !only.has(i + 1)) { slides.push({ index: i + 1, part: order[i], blocks: null }); continue; }
      slides.push(Object.assign({ index: i + 1, part: order[i] }, await readSlide(zip, order[i])));
    }
    return { slides, partsByName: slidePartsByFileName(zip), ms: Math.round(now() - t0) };
  }
  function slidePartsByFileName(zip) {
    return zip.names().filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a, b) => +a.match(/(\d+)\.xml$/)[1] - +b.match(/(\d+)\.xml$/)[1]);
  }
  async function readSlide(zip, part) {
    const doc = xml(await zip.text(part));
    const srels = rels(await zip.text(relsPath(part)), part);
    const blocks = [];
    const tree = all(doc, "spTree")[0];
    if (tree) await walk(tree, blocks, zip, srels);
    // Speaker notes: the body placeholder of the notes slide only (not the slide number or the slide image)
    const notesRel = Object.values(srels).find((r) => /\/notesSlide$/.test(r.type));
    if (notesRel && zip.has(notesRel.target)) {
      const nd = xml(await zip.text(notesRel.target));
      all(nd, "sp").forEach((sp) => {
        const ph = all(sp, "ph")[0]; if (!ph || (ph.getAttribute("type") || "body") !== "body") return;
        const tb = kids(sp, "txBody")[0]; if (tb) bodyParas(tb).forEach((t) => blocks.push({ loc: "notes", text: t, shape: null }));
      });
    }
    return { blocks };
  }
  async function walk(container, blocks, zip, srels) {
    for (const el of container.children) {
      const ln = el.localName;
      if (ln === "grpSp") { await walk(el, blocks, zip, srels); continue; }
      if (ln === "AlternateContent") { const alt = kids(el, "Choice")[0] || kids(el, "Fallback")[0]; if (alt) await walk(alt, blocks, zip, srels); continue; }
      const nv = all(el, "cNvPr")[0]; const shape = nv ? { id: nv.getAttribute("id"), name: nv.getAttribute("name") } : null;
      if (ln === "sp") { const tb = kids(el, "txBody")[0]; if (tb) bodyParas(tb).forEach((t) => blocks.push({ loc: "text", text: t, shape })); continue; }
      if (ln === "graphicFrame") {
        const tbl = all(el, "tbl")[0];
        if (tbl) { all(tbl, "tr").forEach((tr, r) => kids(tr, "tc").forEach((tc, c) => { const tb = kids(tc, "txBody")[0]; if (tb) bodyParas(tb).forEach((t) => blocks.push({ loc: "table", text: t, shape, cell: [r, c] })); })); continue; }
        const dm = all(el, "relIds")[0];   // SmartArt: the text lives in the diagram data part
        if (dm) { const rel = srels[dm.getAttributeNS(RNS, "dm") || dm.getAttribute("r:dm")]; if (rel && zip.has(rel.target)) { const dd = xml(await zip.text(rel.target)); all(dd, "pt").forEach((pt) => { const t = kids(pt, "t")[0]; if (t) all(t, "p").map(paraText).filter((x) => x.trim()).forEach((x) => blocks.push({ loc: "text", text: x, shape })); }); } continue; }
        const ch = all(el, "chart")[0];
        if (ch) { const rid = ch.getAttributeNS(RNS, "id") || ch.getAttribute("r:id"); const rel = srels[rid]; if (rel && zip.has(rel.target)) (await chartTexts(zip, rel.target)).forEach((t) => blocks.push({ loc: "chart", text: t, shape })); continue; }
      }
    }
  }
  // Chart: titles, axis titles, series names, category labels (from the cached values in the chart XML)
  async function chartTexts(zip, part) {
    const d = xml(await zip.text(part)), out = [];
    all(d, "title").forEach((t) => { const rich = all(t, "p").map(paraText).filter((x) => x.trim()); if (rich.length) out.push(...rich); else all(t, "v").forEach((v) => out.push(v.textContent)); });
    all(d, "ser").forEach((s) => { const tx = kids(s, "tx")[0]; if (tx) all(tx, "v").forEach((v) => out.push(v.textContent)); });
    const seen = new Set();
    all(d, "cat").forEach((c) => all(c, "pt").forEach((pt) => { const v = kids(pt, "v")[0]; if (v && !seen.has(v.textContent)) { seen.add(v.textContent); out.push(v.textContent); } }));
    return out.filter((x) => x && x.trim());
  }

  // ---------- comparison ----------
  const BULLET = /^[•▪◦‣⁃●○■–—\-\*·]\s+/;
  const norm = (s) => s.replace(/[   \t]/g, " ").replace(/\s+/g, " ").trim().replace(BULLET, "");
  function segments(text) {
    return text.split(/\n+/).map(norm).filter(Boolean).flatMap((line) => line.split(/(?<=[.!?…])\s+(?=[A-Z0-9"“(])/)).map((s) => s.trim()).filter(Boolean);
  }
  const words = (s) => s.split(" ").filter(Boolean);
  const loose = (w) => w.toLowerCase().replace(/[^\p{L}\p{N}%]+/gu, "");
  // Similarity for pairing (loose: case and punctuation ignored); the diff itself is exact
  function similarity(a, b) {
    const A = words(a).map(loose).filter(Boolean), B = words(b).map(loose).filter(Boolean);
    if (!A.length || !B.length) return 0;
    const m = new Map(); A.forEach((w) => m.set(w, (m.get(w) || 0) + 1));
    let inter = 0; B.forEach((w) => { const c = m.get(w); if (c) { inter++; m.set(w, c - 1); } });
    return (2 * inter) / (A.length + B.length);
  }
  function lcsDiff(a, b) {   // token diff → list of hunks {ai, aj, bi, bj}
    const n = a.length, m = b.length, dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    const hunks = []; let i = 0, j = 0, h = null;
    const flush = () => { if (h) { h.aj = i; h.bj = j; hunks.push(h); h = null; } };
    while (i < n || j < m) {
      if (i < n && j < m && a[i] === b[j]) { flush(); i++; j++; continue; }
      if (!h) h = { ai: i, bi: j };
      if (j < m && (i >= n || dp[i][j + 1] >= dp[i + 1][j])) j++; else i++;
    }
    flush(); return hunks;
  }
  const WIN = 6;
  function windowed(tokens, from, to) {
    const s = Math.max(0, from - WIN), e = Math.min(tokens.length, to + WIN);
    const pre = (s > 0 ? "… " : "") + tokens.slice(s, from).join(" "), mid = tokens.slice(from, to).join(" "), post = tokens.slice(to, e).join(" ") + (e < tokens.length ? " …" : "");
    return { pre: pre.trim(), mid, post: post.trim() };
  }
  // Compare one original slide with the current slide. Returns { items, pairs }
  function compare(origBlocks, slideBlocks, opts) {
    const threshold = (opts && opts.threshold) || 0.5, items = [];
    const seg = (blocks) => blocks.flatMap((b) => segments(b.text).map((t) => ({ t, b, loc: b.loc })));
    const allO = seg(origBlocks), allS = seg(slideBlocks), takenO = new Set(), takenS = new Set();
    // Pass 1 per location (slide text, table, chart, notes); pass 2 across locations for what is left, because a
    // redesign often turns a table into text boxes (or the other way round): the text is still there, just elsewhere.
    for (const loc of ["text", "table", "chart", "notes", "*"]) {
      const O = allO.filter((o) => !takenO.has(o) && (loc === "*" || o.loc === loc));
      const S = allS.filter((x) => !takenS.has(x) && (loc === "*" || x.loc === loc) && (loc !== "*" || x.loc !== "notes"));
      const usedO = new Set(), usedS = new Set(), pairs = [];
      // exact matches first, then the most similar pairs above the threshold
      O.forEach((o, i) => { const j = S.findIndex((s, k) => !usedS.has(k) && s.t === o.t); if (j >= 0) { usedO.add(i); usedS.add(j); } });
      const cand = [];
      O.forEach((o, i) => { if (usedO.has(i)) return; S.forEach((s, j) => { if (usedS.has(j)) return; const sim = similarity(o.t, s.t); if (sim >= threshold) cand.push([sim, i, j]); }); });
      cand.sort((x, y) => y[0] - x[0]).forEach(([sim, i, j]) => { if (usedO.has(i) || usedS.has(j)) return; usedO.add(i); usedS.add(j); pairs.push([O[i], S[j], sim]); });
      O.forEach((o, i) => { if (usedO.has(i)) takenO.add(o); }); S.forEach((x, j) => { if (usedS.has(j)) takenS.add(x); });
      for (const [o, s] of pairs) {
        const a = words(o.t), b = words(s.t);
        lcsDiff(a, b).forEach((h) => {
          const tokens = a.slice(h.ai, h.aj).concat(b.slice(h.bi, h.bj));
          items.push({ cat: tokens.some((t) => /\d/.test(t)) ? "numbers" : "words", loc: o.loc, orig: windowed(a, h.ai, h.aj), slide: windowed(b, h.bi, h.bj), slideSentence: s.t, slideLoc: s.loc, shape: s.b.shape, cell: s.b.cell || null });
        });
      }
    }
    // Still unpaired: missing, unless the text sits inside a longer slide sentence (two sentences merged into one)
    const slideAll = allS.map((x) => x.t).join(" \u0000 ");
    allO.forEach((o) => { if (!takenO.has(o) && !slideAll.includes(o.t)) items.push({ cat: "missing", loc: o.loc, orig: { pre: "", mid: o.t, post: "" } }); });
    return items;
  }

  function now() { return (root.performance && performance.now()) || Date.now(); }
  root.CompareOriginal = { openZip, readDeck, readSlide, compare, segments, similarity, norm };
})(typeof window !== "undefined" ? window : globalThis);
