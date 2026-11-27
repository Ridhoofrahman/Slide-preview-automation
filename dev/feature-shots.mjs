// Screenshots for the docs Features section (docs/img/feat-NN.jpg). Needs npm run dev. Run: npm run docs:shots
import { chromium } from 'playwright';
const OUT='docs/img/', B='http://localhost:5173';
const b = await chromium.launch();
const page = async (u, w, h) => { const p = await b.newPage({ viewport:{width:w,height:h}, deviceScaleFactor:2 }); await p.goto(B+u); await p.waitForTimeout(2500); await p.evaluate(()=>document.documentElement.style.scrollBehavior='auto'); return p; };
const SLIDE = async (p) => { await p.evaluate(()=>{const c=document.createElement('canvas');c.width=1280;c.height=720;const x=c.getContext('2d');x.fillStyle='#1F2A55';x.fillRect(0,0,1280,720);x.fillStyle='#fff';x.font='bold 72px Georgia';x.fillText('Annual Summit 2026',90,170);x.fillStyle='rgba(255,255,255,.55)';x.font='34px Arial';x.fillText('Revenue grew 42% year over year',90,250);x.fillStyle='#5B6BA8';x.fillRect(90,330,300,300);x.fillStyle='#8FA3E8';x.fillRect(430,430,300,200);x.fillStyle='#F2B880';x.fillRect(770,380,300,250);window.__imgB64=c.toDataURL('image/png').split(',')[1];S.thumbKey=null;renderThumb();}); await p.waitForTimeout(500); };
const save = async (p, name, clip) => { await p.screenshot({ path: OUT+name+'.jpg', type:'jpeg', quality:82, clip }); };
let p;
// 01 send from PowerPoint
p = await page('/panel?n=1&st=notsent',320,694); await SLIDE(p); await save(p,'feat-01',{x:0,y:0,width:320,height:370}); await p.close();
// 02 feedback in PowerPoint
p = await page('/panel?n=1&st=changes',320,694); await save(p,'feat-02',{x:0,y:0,width:320,height:500}); await p.close();
// 03 board
p = await page('/review?dist=1',1280,800); { const g = await p.locator('.bd-main').boundingBox(); await save(p,'feat-03',{x:g.x-16,y:g.y-16,width:g.width+32,height:Math.min(480,g.height+32)}); } await p.close();
// 04 compare (real engine, sample texts)
p = await page('/panel?n=1&st=notsent',320,694); await SLIDE(p);
await p.evaluate(async () => {
  const E = await loadEngine();
  const blk = (t) => ({ loc:'text', text:t, shape:null });
  const orig = [blk('Annual Summit 2026'), blk('Revenue grew 24% year over year'), blk('Three markets drove the growth: Jakarta, Lima and Manila'), blk('Next steps for the leadership team')];
  const mine = [blk('Annual Summit 2026'), blk('Revenue grew 42% year over year'), blk('Three markets drove the growth: Jakarta and Manila'), blk('Questions?')];
  CMP.meta = { name: 'Northwind Pitch - original.pptx' }; CMP.slides = [orig]; CMP.first = 1;
  CMP.items = E.compare(orig, mine, { threshold: 0.5 }); CMP.base = 1; CMP.local = 1; CMP.open = true; CMP.state = 'result'; CMP.slideId = currentSlide().id;
  renderCmp(true);
});
await p.waitForTimeout(600); await save(p,'feat-04',{x:0,y:290,width:320,height:404}); await p.close();
// 05 compile + Drive
p = await page('/panel?delivery=1&dm=1',320,694); await save(p,'feat-05',{x:0,y:0,width:320,height:340}); await p.close();
// 07 tag team: review page of the tag team order
p = await page('/review',1280,800); { const c = await p.locator('.bd-card').first().boundingBox(); await save(p,'feat-07',{x:c.x-16,y:c.y-16,width:c.width+32,height:c.height+32}); } await p.close();
// 08 alternative
p = await page('/panel?n=10&alt=sent',320,694); await save(p,'feat-08',{x:0,y:0,width:320,height:420}); await p.close();
// 09 details
p = await page('/review?fonts=1',1280,900); await p.locator('.bd-card').first().click(); await p.waitForTimeout(1500);
{ const d = p.locator('.rv-details, .rv-ftable').first(); await d.scrollIntoViewIfNeeded().catch(()=>{}); await p.waitForTimeout(300); { const t = await p.locator('.rv-ftable').boundingBox(); const y0 = t.y-56; await save(p,'feat-09',{x:0,y:y0,width:910,height:t.height+80}); } } await p.close();
// 10 position popup
p = await page('/panel?n=1&st=notsent',320,694); await SLIDE(p); await p.click('#mapSwap'); await p.waitForTimeout(400); await save(p,'feat-10',{x:0,y:0,width:320,height:420}); await p.close();
// 11 sign in
p = await page('/panel?out=1',320,694); await save(p,'feat-11',{x:0,y:120,width:320,height:320}); await p.close();
await b.close();
