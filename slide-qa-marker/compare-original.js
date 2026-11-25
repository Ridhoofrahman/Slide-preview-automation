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
    // Raw bytes of one entry (e.g. embedded fonts, ppt/fonts/*.fntdata): only that entry is read from the file
    const bytes = async (name) => {
        const e = entries.get(name); if (!e) return null;
        if (e.flags & 1) throw codeErr("encrypted", "Encrypted entry");
        const lh = await u8(blob, e.off, e.off + 30);
        const start = e.off + 30 + le16(lh, 26) + le16(lh, 28);
        const data = await u8(blob, start, start + e.comp);
        if (e.method === 0) return data;
        if (e.method !== 8) throw codeErr("method", "Unsupported compression " + e.method);
        return inflateRaw(data);
    };
    return {
      names: () => [...entries.keys()],
      has: (n) => entries.has(n),
      bytes,
      async text(name) { const b = await bytes(name); return b ? td.decode(b) : null; }
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
  // Same paragraph with its formatting: fm has one character per text character, code 64 + flags
  // (1 bold, 2 italic, 4 underline, 8 strikethrough, 16 superscript, 32 subscript). Only formatting written on the run
  // itself counts (not what a run inherits from the shape, layout or master). Unicode characters stay as they are:
  // "m²" in the original and "m2" in superscript on the slide are different text (reported as a word change).
  function runFlags(r) {
    const pr = kids(r, "rPr")[0]; if (!pr) return 0;
    const on = (a) => /^(1|true|on)$/i.test(pr.getAttribute(a) || "");
    const u = pr.getAttribute("u"), st = pr.getAttribute("strike"), bl = +(pr.getAttribute("baseline") || 0);
    return (on("b") ? 1 : 0) | (on("i") ? 2 : 0) | (u && u !== "none" ? 4 : 0) | (st && st !== "noStrike" ? 8 : 0) | (bl > 0 ? 16 : 0) | (bl < 0 ? 32 : 0);
  }
  function paraRich(p) {
    let text = "", fm = "";
    const add = (str, f) => {
      for (const ch of str) { text += ch; fm += String.fromCharCode(64 + f); }
    };
    for (const n of p.children) {
      if (n.localName === "r" || n.localName === "fld") add(all(n, "t").map((t) => t.textContent).join(""), runFlags(n));
      else if (n.localName === "br") add(" ", 0);
    }
    return { text, fm };
  }
  function richParas(txBody) { return kids(txBody, "p").map(paraRich).filter((x) => x.text.trim()); }

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
    if (tree) await walk(tree, blocks, zip, srels, null);
    // Reading order on the slide (top to bottom, then left to right), not the order of the shapes in the file,
    // so "After …" for missing text names the text that is really above it. Paragraphs of one shape keep their order.
    // Placeholders that inherit their position from the layout have none: then the file order stays.
    if (blocks.every((b) => b.y != null)) { blocks.forEach((b, i) => { b.i = i; }); blocks.sort((a, b) => a.y - b.y || a.x - b.x || a.i - b.i); }
    blocks.forEach((b) => { delete b.i; delete b.x; delete b.y; });
    // Speaker notes: the body placeholder of the notes slide only (not the slide number or the slide image)
    const notesRel = Object.values(srels).find((r) => /\/notesSlide$/.test(r.type));
    if (notesRel && zip.has(notesRel.target)) {
      const nd = xml(await zip.text(notesRel.target));
      all(nd, "sp").forEach((sp) => {
        const ph = all(sp, "ph")[0]; if (!ph || (ph.getAttribute("type") || "body") !== "body") return;
        const tb = kids(sp, "txBody")[0]; if (tb) richParas(tb).forEach((x) => blocks.push({ loc: "notes", text: x.text, fm: x.fm, shape: null }));
      });
    }
    return { blocks };
  }
  // Top-left of a shape in slide coordinates (map = the enclosing groups' child-to-slide transform)
  function xfrmOf(el) {
    const pr = kids(el, "spPr")[0] || kids(el, "grpSpPr")[0];
    const xf = pr ? kids(pr, "xfrm")[0] : kids(el, "xfrm")[0];
    if (!xf) return null;
    const v = (name, a, b) => { const n = kids(xf, name)[0]; return n ? [+n.getAttribute(a) || 0, +n.getAttribute(b) || 0] : null; };
    return { off: v("off", "x", "y"), ext: v("ext", "cx", "cy"), chOff: v("chOff", "x", "y"), chExt: v("chExt", "cx", "cy") };
  }
  const place = (map, x, y) => (map ? map(x, y) : [x, y]);
  async function walk(container, blocks, zip, srels, map) {
    for (const el of container.children) {
      const ln = el.localName;
      if (ln === "grpSp") {
        const g = xfrmOf(el); let inner = map;
        if (g && g.off && g.chOff) {
          const sx = g.ext && g.chExt && g.chExt[0] ? g.ext[0] / g.chExt[0] : 1, sy = g.ext && g.chExt && g.chExt[1] ? g.ext[1] / g.chExt[1] : 1;
          inner = (x, y) => place(map, g.off[0] + (x - g.chOff[0]) * sx, g.off[1] + (y - g.chOff[1]) * sy);
        }
        await walk(el, blocks, zip, srels, inner); continue;
      }
      if (ln === "AlternateContent") { const alt = kids(el, "Choice")[0] || kids(el, "Fallback")[0]; if (alt) await walk(alt, blocks, zip, srels, map); continue; }
      const nv = all(el, "cNvPr")[0]; const shape = nv ? { id: nv.getAttribute("id"), name: nv.getAttribute("name") } : null;
      const xf = xfrmOf(el), at = xf && xf.off ? place(map, xf.off[0], xf.off[1]) : null;
      const from = blocks.length;
      await shapeBlocks(el, ln, shape, blocks, zip, srels);
      if (at) for (let i = from; i < blocks.length; i++) { blocks[i].x = at[0]; blocks[i].y = at[1]; }
    }
  }
  async function shapeBlocks(el, ln, shape, blocks, zip, srels) {
    {
      if (ln === "sp") { const tb = kids(el, "txBody")[0]; if (tb) richParas(tb).forEach((x) => blocks.push({ loc: "text", text: x.text, fm: x.fm, shape })); return; }
      if (ln === "graphicFrame") {
        const tbl = all(el, "tbl")[0];
        if (tbl) { all(tbl, "tr").forEach((tr, r) => kids(tr, "tc").forEach((tc, c) => { const tb = kids(tc, "txBody")[0]; if (tb) richParas(tb).forEach((x) => blocks.push({ loc: "table", text: x.text, fm: x.fm, shape, cell: [r, c] })); })); return; }
        const dm = all(el, "relIds")[0];   // SmartArt: the text lives in the diagram data part
        if (dm) { const rel = srels[dm.getAttributeNS(RNS, "dm") || dm.getAttribute("r:dm")]; if (rel && zip.has(rel.target)) { const dd = xml(await zip.text(rel.target)); all(dd, "pt").forEach((pt) => { const t = kids(pt, "t")[0]; if (t) all(t, "p").map(paraText).filter((x) => x.trim()).forEach((x) => blocks.push({ loc: "text", text: x, shape })); }); } return; }
        const ch = all(el, "chart")[0];
        if (ch) { const rid = ch.getAttributeNS(RNS, "id") || ch.getAttribute("r:id"); const rel = srels[rid]; if (rel && zip.has(rel.target)) (await chartTexts(zip, rel.target)).forEach((t) => blocks.push({ loc: "chart", text: t, shape })); return; }
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
  // segments() with the formatting kept: for each sentence, one flag string per word (same order as words())
  function richSegments(text, fm) {
    let cs = [...text].map((c, i) => ({ c: /[\u00a0\u2007\u202f\t]/.test(c) ? " " : c, f: fm[i] || "@" }));
    const out = [];
    const lines = []; let cur = [];
    cs.forEach((x) => { if (x.c === "\n") { lines.push(cur); cur = []; } else cur.push(x); }); lines.push(cur);
    for (let line of lines) {
      const sq = []; line.forEach((x) => { const ws = /\s/.test(x.c); if (ws && (!sq.length || sq[sq.length - 1].c === " ")) return; sq.push(ws ? { c: " ", f: "@" } : x); });
      while (sq.length && sq[sq.length - 1].c === " ") sq.pop();
      const str = sq.map((x) => x.c).join(""), bm = str.match(BULLET); const body = bm ? sq.slice(bm[0].length) : sq;
      if (!body.length) continue;
      const bs = body.map((x) => x.c).join(""), cuts = [0]; const re = /(?<=[.!?…])\s+(?=[A-Z0-9"“(])/g; let m;
      while ((m = re.exec(bs))) { cuts.push(m.index, m.index + m[0].length); }
      cuts.push(bs.length);
      for (let k = 0; k < cuts.length; k += 2) {
        let piece = body.slice(cuts[k], cuts[k + 1]);
        while (piece.length && piece[0].c === " ") piece.shift(); while (piece.length && piece[piece.length - 1].c === " ") piece.pop();
        if (!piece.length) continue;
        const t = piece.map((x) => x.c).join(""), wf = []; let w = "";
        piece.forEach((x) => { if (x.c === " ") { if (w) wf.push(w); w = ""; } else w += x.f; }); if (w) wf.push(w);
        out.push({ t, wf });
      }
    }
    return out;
  }
  // Formatting differences between two paired sentences (same words, other formatting). Bold, italic, underline and
  // strikethrough count only as emphasis: some words of the original sentence have it, others not (a sentence that is
  // all bold is a design choice). Superscript and subscript always count. Only formatting the slide lost is reported.
  const FMT = [[1, "b", "bold"], [2, "i", "italic"], [4, "u", "underline"], [8, "s", "strikethrough"]];
  function lcsPairs(a, b) {
    const n = a.length, m = b.length, dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    const out = []; let i = 0, j = 0;
    while (i < n && j < m) { if (a[i] === b[j]) { out.push([i, j]); i++; j++; } else if (dp[i + 1][j] >= dp[i][j + 1]) i++; else j++; }
    return out;
  }
  const fl = (ch) => ch.charCodeAt(0) - 64;
  const wordHas = (f, bit) => { let c = 0; for (const ch of f) if (fl(ch) & bit) c++; return c * 2 > f.length; };
  function formatDiffs(o, s, enabled) {
    const a = words(o.t), b = words(s.t), out = [];
    if (!o.wf || !s.wf || o.wf.length !== a.length || s.wf.length !== b.length) return out;
    const pairs = lcsPairs(a, b), found = [];
    for (const [bit, key, name] of FMT) {
      if (enabled && enabled[key] === false) continue;
      const n = o.wf.filter((f) => wordHas(f, bit)).length;
      if (!n || n === a.length) continue;   // none, or the whole sentence: not emphasis
      pairs.forEach(([i, j]) => { if (wordHas(o.wf[i], bit) && !wordHas(s.wf[j], bit)) found.push({ i, j, name }); });
    }
    for (const [bit, name] of [[16, "superscript"], [32, "subscript"]]) {
      pairs.forEach(([i, j]) => {
        const fo = o.wf[i], fs = s.wf[j];
        for (let k = 0; k < fo.length; k++) if ((fl(fo[k]) & bit) && !(fl(fs[k] || "@") & bit)) { found.push({ i, j, name }); break; }
      });
    }
    // neighbouring words with the same lost formatting become one row
    found.sort((x, y) => x.name.localeCompare(y.name) || x.i - y.i);
    for (const f of found) {
      const last = out[out.length - 1];
      if (last && last.name === f.name && last.i1 === f.i - 1 && last.j1 === f.j - 1) { last.i1 = f.i; last.j1 = f.j; }
      else out.push({ name: f.name, i0: f.i, i1: f.i, j0: f.j, j1: f.j });
    }
    return out.map((g) => ({ fmt: g.name, orig: windowed(a, g.i0, g.i1 + 1), slide: windowed(b, g.j0, g.j1 + 1), ofm: o.wf.slice(g.i0, g.i1 + 1).join("@") }));
  }
  const loose = (w) => w.toLowerCase().replace(/[^\p{L}\p{N}%]+/gu, "");
  // Similarity for pairing (loose: case and punctuation ignored); the diff itself is exact
  function similarity(a, b) {
    const A = words(a).map(loose).filter(Boolean), B = words(b).map(loose).filter(Boolean);
    if (!A.length || !B.length) return 0;
    const m = new Map(); A.forEach((w) => m.set(w, (m.get(w) || 0) + 1));
    let inter = 0; B.forEach((w) => { const c = m.get(w); if (c) { inter++; m.set(w, c - 1); } });
    return Math.max((2 * inter) / (A.length + B.length), joined(A.join(""), B.join("")));
  }
  // Letters only (spaces ignored), character pairs: catches a lost or added space ("EVOLVE monthly sharing" →
  // "EVOLVEsharing"), where whole words no longer match. Short lines are left to the word measure.
  function joined(a, b) {
    if (a.length < 8 || b.length < 8) return 0;
    const pairs = (s) => { const m = new Map(); for (let i = 0; i < s.length - 1; i++) { const k = s.slice(i, i + 2); m.set(k, (m.get(k) || 0) + 1); } return m; };
    const A = pairs(a), B = pairs(b); let inter = 0;
    B.forEach((c, k) => { inter += Math.min(c, A.get(k) || 0); });
    return (2 * inter) / (a.length - 1 + b.length - 1);
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
    const seg = (blocks) => blocks.flatMap((b) => {
      const plain = segments(b.text), rich = b.fm ? richSegments(b.text, b.fm) : null;
      const ok = rich && rich.length === plain.length && rich.every((r, k) => r.t === plain[k]);
      return plain.map((t, k) => ({ t, b, loc: b.loc, wf: ok ? rich[k].wf : null }));
    });
    const allO = seg(origBlocks), allS = seg(slideBlocks), takenO = new Set(), takenS = new Set(), partner = new Map();
    // Pass 1 per location (slide text, table, chart, notes); pass 2 across locations for what is left, because a
    // redesign often turns a table into text boxes (or the other way round): the text is still there, just elsewhere.
    for (const loc of ["text", "table", "chart", "notes", "*"]) {
      const O = allO.filter((o) => !takenO.has(o) && (loc === "*" || o.loc === loc));
      const S = allS.filter((x) => !takenS.has(x) && (loc === "*" || x.loc === loc) && (loc !== "*" || x.loc !== "notes"));
      const usedO = new Set(), usedS = new Set(), pairs = [];
      // exact matches first, then the most similar pairs above the threshold
      O.forEach((o, i) => { const j = S.findIndex((s, k) => !usedS.has(k) && s.t === o.t); if (j >= 0) { usedO.add(i); usedS.add(j); partner.set(o, S[j]); } });
      const cand = [];
      O.forEach((o, i) => { if (usedO.has(i)) return; S.forEach((s, j) => { if (usedS.has(j)) return; const sim = similarity(o.t, s.t); if (sim >= threshold) cand.push([sim, i, j]); }); });
      cand.sort((x, y) => y[0] - x[0]).forEach(([sim, i, j]) => { if (usedO.has(i) || usedS.has(j)) return; usedO.add(i); usedS.add(j); partner.set(O[i], S[j]); pairs.push([O[i], S[j], sim]); });
      O.forEach((o, i) => { if (usedO.has(i)) takenO.add(o); }); S.forEach((x, j) => { if (usedS.has(j)) takenS.add(x); });
      for (const [o, s] of pairs) {
        const a = words(o.t), b = words(s.t);
        lcsDiff(a, b).forEach((h) => {
          const tokens = a.slice(h.ai, h.aj).concat(b.slice(h.bi, h.bj));
          items.push({ cat: tokens.some((t) => /\d/.test(t)) ? "numbers" : "words", loc: o.loc, orig: windowed(a, h.ai, h.aj), slide: windowed(b, h.bi, h.bj), slideSentence: s.t, slideLoc: s.loc, shape: s.b.shape, cell: s.b.cell || null });
        });
      }
    }
    // Formatting the slide lost, in every paired sentence (exact pairs too)
    partner.forEach((s, o) => formatDiffs(o, s, opts && opts.formats).forEach((d) =>
      items.push(Object.assign({ cat: "format", loc: o.loc, slideSentence: s.t, slideLoc: s.loc, shape: s.b.shape, cell: s.b.cell || null }, d))));
    // Still unpaired: missing, unless the text sits inside a longer slide sentence (two sentences merged into one)
    const slideAll = allS.map((x) => x.t).join(" \u0000 ");
    // Anchor for missing text: the slide text that matches the original text right before it (or right after it),
    // so the designer knows where to paste it
    const anchorFor = (k, loc) => {
      for (let i = k - 1; i >= 0; i--) { const p = partner.get(allO[i]); if (p && allO[i].loc === loc) return { dir: "after", text: p.t, loc: p.loc, shape: p.b.shape }; }
      for (let i = k + 1; i < allO.length; i++) { const p = partner.get(allO[i]); if (p && allO[i].loc === loc) return { dir: "before", text: p.t, loc: p.loc, shape: p.b.shape }; }
      return null;
    };
    allO.forEach((o, k) => { if (!takenO.has(o) && !slideAll.includes(o.t)) items.push({ cat: "missing", loc: o.loc, orig: { pre: "", mid: o.t, post: "" }, anchor: anchorFor(k, o.loc) }); });
    // Added: slide text with no pair in the original, unless it is a part (3+ words) of a longer original sentence
    // (one sentence split in two). Short text ("by.", "0000") is always shown: it would match inside almost anything.
    const origAll = allO.map((x) => x.t).join(" \u0000 ");
    allS.forEach((x) => { if (!takenS.has(x) && !(words(x.t).length >= 3 && origAll.includes(x.t))) items.push({ cat: "added", loc: x.loc, orig: { pre: "", mid: "", post: "" }, slide: { pre: "", mid: "", post: "" }, text: x.t, slideSentence: x.t, slideLoc: x.loc, shape: x.b.shape, cell: x.b.cell || null }); });
    return items;
  }

  function now() { return (root.performance && performance.now()) || Date.now(); }
  root.CompareOriginal = { openZip, readDeck, readSlide, compare, segments, richSegments, similarity, norm };
})(typeof window !== "undefined" ? window : globalThis);
