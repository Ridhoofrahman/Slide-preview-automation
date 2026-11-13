import re, os
HERE=os.path.dirname(os.path.abspath(__file__))
P=open(os.path.join(HERE,'..','..','slide-qa-marker','panel.html')).read()
MARK=re.search(r'<svg class="og-mark".*?</svg>',P,re.S).group(0).replace('class="og-mark"','class="mark" width="28" height="28"')
BAND=open(os.path.join(HERE,'band.svg')).read().strip().replace('class="og-band-svg"','class="band"').replace('preserveAspectRatio="xMidYMin slice"','preserveAspectRatio="xMidYMid slice"').replace('preserveAspectRatio="xMidYMax slice"','preserveAspectRatio="xMidYMid slice"')
SWAP=re.search(r'id="mapSwap"[^>]*>(<svg.*?</svg>)',P,re.S).group(1)
EDIT=re.search(r'id="editNoteBtn"[^>]*>(<svg.*?</svg>)',P,re.S).group(1)
BOOK=re.search(r'<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M5\.00006.*?</svg>',P,re.S).group(0)

def T(en,idn): return f'<span class="l-en">{en}</span><span class="l-id">{idn}</span>'
def cell(c): return T(*c) if isinstance(c,tuple) else c
def p(en,idn,cls=''): return f'<p{" class=%s"%cls if cls else ""}>{T(en,idn)}</p>'
def h3(en,idn,a=''): return f'<h3{" id=%s"%a if a else ""}>{T(en,idn)}</h3>'
def ul(items): return '<ul>'+''.join(f'<li>{cell(i)}</li>' for i in items)+'</ul>'
def ol(items): return '<ol>'+''.join(f'<li>{cell(i)}</li>' for i in items)+'</ol>'
def callout(kind,en,idn,title=None):
    t=f'<strong>{T(*title)}</strong>' if title else ''
    return f'<aside class="callout {kind}">{t}<div>{T(en,idn)}</div></aside>'
def table(head,rows,cls=''):
    h=''.join(f'<th scope="col">{cell(x)}</th>' for x in head)
    r=''.join('<tr>'+''.join(f'<td>{cell(x)}</td>' for x in row)+'</tr>' for row in rows)
    return f'<div class="tw"><table class="{cls}"><thead><tr>{h}</tr></thead><tbody>{r}</tbody></table></div>'
def details(q,a): return f'<details><summary>{T(*q)}</summary><div class="ans">{T(*a)}</div></details>'
def chip(k,t): return f'<span class="chip {k}">{t}</span>'
YES='<span class="yes" role="img" aria-label="Yes">✓</span>'
NO='<span class="no" role="img" aria-label="No">–</span>'
def section(i,en,idn,body): return f'<section id="{i}"><h2>{T(en,idn)}</h2>{body}</section>'

NAV=[('overview','Overview','Ringkasan'),('roles','Who uses what','Siapa memakai apa'),('start','Getting started','Memulai'),
('designers','For designers','Untuk designer'),('dms','For Design Managers','Untuk Design Manager'),('tagteam','Teams and tag team','Tim dan tag team'),
('reference','Tags and statuses','Tag dan status'),('admin','Admin and setup','Admin dan setup'),('faq','FAQ','FAQ'),('trouble','Troubleshooting','Pemecahan masalah'),
('limits','Limits and what’s next','Batasan dan rencana'),('releases','Release notes','Catatan rilis'),('glossary','Glossary','Glosarium')]

# ---------- figures ----------
ANAT=f'''<figure class="anat">
<div class="panel" role="img" aria-label="Slideshot add-in panel with numbered parts">
<div class="ph-head"><div class="ph-order"><span class="s">Order ID</span><span class="big">#45236</span><i class="pin l">1</i></div>
<div class="ph-slide"><span class="s">Slide 9 → Slide 4</span>{chip('grey','Not sent yet')}<i class="pin r">2</i></div></div>
<div class="ph-body"><div class="ph-row"><span class="assigned">{BOOK}Assigned to you</span><span class="ph-btns"><span class="ic">{SWAP}</span><span class="ic">{EDIT}</span></span><i class="pin l">3</i><i class="pin r">4</i></div>
<div class="ph-thumb"><span>Annual Summit</span><i class="pin l">5</i></div>
<div class="ph-btn">Mark slide 9 ready for review<i class="pin l">6</i></div></div>
<div class="ph-foot"><span>Bela - Cascade</span><span>v2.26 • Sign out</span><i class="pin r">7</i></div></div>
<figcaption><ol class="legend">
<li>{T('<b>Order ID.</b> The order this deck belongs to. Type digits and the # is added for you.','<b>Order ID.</b> Order tempat deck ini berada. Ketik angka, tanda # ditambahkan otomatis.')}</li>
<li>{T('<b>Slide and status.</b> Your slide number, plus where it will sit in the order when you moved it (“Slide 9 → Slide 4”), and its status tag.','<b>Slide dan status.</b> Nomor slide di file-mu, plus posisinya di order jika kamu memindahkannya (“Slide 9 → Slide 4”), dan tag statusnya.')}</li>
<li>{T('<b>Assignment.</b> Who your DM gave this slide to.','<b>Assignment.</b> Siapa yang diberi slide ini oleh DM-mu.')}</li>
<li>{T('<b>Two buttons.</b> Left: change slide position. Right: add a note for your DM.','<b>Dua tombol.</b> Kiri: ubah posisi slide. Kanan: tambah catatan untuk DM.')}</li>
<li>{T('<b>Preview.</b> The slide you selected. After sending, a badge shows the version and how long ago.','<b>Preview.</b> Slide yang kamu pilih. Setelah dikirim, lencana menampilkan versi dan kapan dikirim.')}</li>
<li>{T('<b>Main action.</b> Send the slide, or upload the latest version once it has been sent.','<b>Aksi utama.</b> Kirim slide, atau unggah versi terbaru setelah slide pernah dikirim.')}</li>
<li>{T('<b>Footer.</b> Your name and team, the version, and Sign out. DMs also get a Dashboard link here.','<b>Footer.</b> Nama dan timmu, versi add-in, dan Sign out. DM juga mendapat link Dashboard di sini.')}</li></ol></figcaption></figure>'''

FLOW=f'''<ol class="flow">
<li><b>{T('DM distributes','DM membagi')}</b><span>{T('Gives each designer their slides, for example 1–5.','Memberi tiap designer slide-nya, misalnya 1–5.')}</span></li>
<li><b>{T('Designer opens the deck','Designer membuka deck')}</b><span>{T('Types the Order ID in the add-in.','Mengetik Order ID di add-in.')}</span></li>
<li><b>{T('Designer sends','Designer mengirim')}</b><span>{T('Marks each finished slide ready for review.','Menandai tiap slide yang selesai siap direview.')}</span></li>
<li><b>{T('DM reviews','DM mereview')}</b><span>{T('Comments, then approves or requests changes.','Berkomentar, lalu approve atau minta perubahan.')}</span></li>
<li><b>{T('Designer updates','Designer memperbarui')}</b><span>{T('Uploads the latest version if changes were needed.','Mengunggah versi terbaru jika ada perubahan.')}</span></li>
<li><b>{T('DM closes the order','DM menutup order')}</b><span>{T('Everything approved, so the DM marks it sent to customer.','Semua approved, lalu DM menandainya terkirim ke customer.')}</span></li></ol>'''

# Board order card, same build as review-app.html orderCard() (Figma 156:8747: Amount =1 / >1 / Not sent yet)
import math
CLOCK='<svg viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M10.2 5.99995C10.2 3.67495 8.32495 1.79995 5.99995 1.79995C3.67495 1.79995 1.79995 3.67495 1.79995 5.99995C1.79995 8.32495 3.67495 10.2 5.99995 10.2C8.32495 10.2 10.2 8.32495 10.2 5.99995ZM1.19995 5.99995C1.19995 3.3562 3.3562 1.19995 5.99995 1.19995C8.6437 1.19995 10.8 3.3562 10.8 5.99995C10.8 8.6437 8.6437 10.8 5.99995 10.8C3.3562 10.8 1.19995 8.6437 1.19995 5.99995ZM5.69995 3.29995C5.69995 3.1312 5.8312 2.99995 5.99995 2.99995C6.1687 2.99995 6.29995 3.1312 6.29995 3.29995V5.8312L7.9687 6.9562C8.09995 7.04995 8.13745 7.23745 8.0437 7.3687C7.94995 7.49995 7.7812 7.53745 7.6312 7.4437L5.8312 6.2437C5.7562 6.18745 5.69995 6.0937 5.69995 5.99995V3.29995Z" fill="currentColor"/></svg>'
SENT_RING='<svg viewBox="0 0 30 30" fill="none" aria-hidden="true"><path d="M0 15C0 6.71573 6.71573 0 15 0C23.2843 0 30 6.71573 30 15C30 23.2843 23.2843 30 15 30C6.71573 30 0 23.2843 0 15Z" fill="#0C7F49"/><path d="M20.5994 10.3525C20.9792 10.6125 21.0642 11.1125 20.788 11.47L13.988 20.27C13.8419 20.46 13.6161 20.5775 13.3664 20.5975C13.1167 20.6175 12.875 20.53 12.6997 20.365L9.29968 17.165C8.96765 16.8525 8.96765 16.345 9.29968 16.0325C9.63171 15.72 10.1709 15.72 10.503 16.0325L13.1991 18.57L19.4147 10.5275C19.6909 10.17 20.2222 10.09 20.602 10.35L20.5994 10.3525Z" fill="white"/></svg>'
NSY='<svg class="nsy-svg" viewBox="0 0 60 34" fill="none" aria-hidden="true"><rect x="0.5" y="0.5" width="59" height="33" rx="5.5" fill="#F7F9FC" stroke="#DDE4EE" stroke-dasharray="2 2"/><g transform="translate(22 9)"><path d="M1.60001 6.29322H14.4M3.30667 2.87988H12.6933C13.6359 2.87988 14.4 3.64398 14.4 4.58655V11.4132C14.4 12.3558 13.6359 13.1199 12.6933 13.1199H3.30667C2.36411 13.1199 1.60001 12.3558 1.60001 11.4132V4.58655C1.60001 3.64398 2.36411 2.87988 3.30667 2.87988Z" stroke="#DDE4EE"/></g></svg>'
def ringsvg(n,total,sent=False):
    if sent: return f'<span class="bc-ring">{SENT_RING}</span>'
    C=2*math.pi*13.5; f=min(1,n/total)
    arc=('<circle cx="15" cy="15" r="13.5" fill="none" stroke="#7ED9A8" stroke-width="3"/>' if f>=1 else
         f'<circle cx="15" cy="15" r="13.5" fill="none" stroke="#7ED9A8" stroke-width="3" stroke-linecap="round" stroke-dasharray="{C*f:.2f} {C:.2f}" transform="rotate(-90 15 15)"/>' if f>0 else '')
    return f'<span class="bc-ring"><svg viewBox="0 0 30 30" fill="none" aria-hidden="true"><rect x="1" y="1" width="28" height="28" rx="14" fill="white"/><rect x="1" y="1" width="28" height="28" rx="14" stroke="#DDE4EE" stroke-width="2"/>{arc}</svg><span class="n">{n}</span></span>'
def bcard(name,who,when,thumbs,ring,tt=False):
    th={'one':'<span class="front"></span>','stack':'<span class="back"></span><span class="front"></span>','none':f'<span class="front nsy">{NSY}</span>'}[thumbs]
    w=f'<span>Last update</span><span class="bc-ago">{CLOCK}{when}</span>' if when else '<span>No slides sent yet</span>'
    return (f'<div class="bc"><div class="bc-row"><div class="bc-thumbs">{th}{ring}</div>'+('<span class="bc-tt">Tag team</span>' if tt else '')+
            f'</div><div class="bc-info"><b>{name}</b><span class="bc-who">{who}</span><span class="bc-when">{w}</span></div></div>')
BCARD=('<div class="bcards" role="img" aria-label="Three example order cards">'+
 bcard('Order #351164','Bela, Kevin','2 min ago','stack',ringsvg(3,5),tt=True)+
 bcard('Order #123','Assigned: Ridho',None,'none',ringsvg(0,1))+
 bcard('Order #45236','Rama','1 day ago','one',ringsvg(4,4,sent=True))+'</div>')

# ---------- sections ----------
S=[]
S.append(section('overview','Overview','Ringkasan',
p('Slideshot connects designers and Design Managers (DMs) while an order is being made. Designers send finished slides for review from inside PowerPoint. DMs hand out the work, review every slide, and see when an order is ready for the customer.','Slideshot menghubungkan designer dan Design Manager (DM) selama sebuah order dikerjakan. Designer mengirim slide yang selesai untuk direview langsung dari PowerPoint. DM membagi pekerjaan, mereview setiap slide, dan melihat kapan order siap untuk customer.')+
table([('Part','Bagian'),('Who uses it','Siapa pemakainya'),('What it does','Fungsinya')],[
[('<b>Add-in</b> (side panel in PowerPoint)','<b>Add-in</b> (panel samping di PowerPoint)'),('Designers','Designer'),('Send slides, add notes, upload new versions, change a slide’s position.','Mengirim slide, menambah catatan, mengunggah versi baru, mengubah posisi slide.')],
[('<b>Dashboard</b> (web page)','<b>Dashboard</b> (halaman web)'),('Design Managers','Design Manager'),('Board of orders, assigning slides, reviewing, approving, sending to customer.','Board order, membagi slide, mereview, approve, mengirim ke customer.')]])+
h3('How an order moves','Perjalanan sebuah order')+FLOW+
callout('note','The product is in English, so button and tag names are quoted in English on both language versions of this page.','Produknya berbahasa Inggris, jadi nama tombol dan tag tetap ditulis dalam bahasa Inggris di kedua versi bahasa halaman ini.')))

S.append(section('roles','Who uses what','Siapa memakai apa',
p('There are three kinds of users. Everyone belongs to one team.','Ada tiga jenis pengguna. Setiap orang masuk ke satu tim.')+
table([('What you can do','Yang bisa dilakukan'),('Designer','Designer'),('DM','DM'),('Admin','Admin')],[
[('Sign in to the add-in','Masuk ke add-in'),YES,YES,YES],
[('Send slides assigned to you, add notes, upload versions','Mengirim slide yang ditugaskan, menambah catatan, mengunggah versi'),YES,YES+'<small>'+T('if assigned','jika ditugaskan')+'</small>',NO],
[('Change a slide’s position in the order','Mengubah posisi slide di order'),YES,YES,NO],
[('Open the Dashboard','Membuka Dashboard'),NO,YES,NO],
[('Assign slides and adjust the distribution','Membagi slide dan mengatur pembagian'),NO,YES,NO],
[('Comment, approve, request changes','Berkomentar, approve, minta perubahan'),NO,YES+'<small>'+T('own team’s slides','slide timnya sendiri')+'</small>',NO],
[('Delete slides or orders','Menghapus slide atau order'),NO,YES,NO],
[('Mark an order as sent to customer','Menandai order terkirim ke customer'),NO,YES,NO],
[('Add or remove DMs','Menambah atau menghapus DM'),NO,NO,YES]],'matrix')+
p('<b>Designer</b> works on slides in PowerPoint. <b>DM</b> manages a team’s orders and reviews. <b>Admin</b> is whoever looks after the setup (see Admin and setup).','<b>Designer</b> mengerjakan slide di PowerPoint. <b>DM</b> mengelola order dan review timnya. <b>Admin</b> adalah orang yang mengurus setup (lihat Admin dan setup).')+
callout('tip','The Dashboard is DM-only for now. A view for designers (workload, team, who is working on what) is planned.','Dashboard saat ini hanya untuk DM. Tampilan untuk designer (beban kerja, tim, siapa mengerjakan apa) sudah direncanakan.')))

S.append(section('start','Getting started','Memulai',
h3('Install the add-in','Memasang add-in')+
ul([('<b>Mac:</b> put <code>manifest.xml</code> in <code>~/Library/Containers/com.microsoft.Powerpoint/Data/Documents/wef</code>, restart PowerPoint, then open <i>Insert → Add-ins → My Add-ins</i> and pick Slideshot.','<b>Mac:</b> taruh <code>manifest.xml</code> di <code>~/Library/Containers/com.microsoft.Powerpoint/Data/Documents/wef</code>, restart PowerPoint, lalu buka <i>Insert → Add-ins → My Add-ins</i> dan pilih Slideshot.'),
('<b>Windows:</b> add the shared folder that holds <code>manifest.xml</code> as an add-in catalog, then open <i>Insert → Add-ins → My Add-ins → Shared Folder</i>.','<b>Windows:</b> tambahkan shared folder yang berisi <code>manifest.xml</code> sebagai katalog add-in, lalu buka <i>Insert → Add-ins → My Add-ins → Shared Folder</i>.'),
('Ask your admin for the current manifest file.','Minta file manifest terbaru ke admin.')])+
callout('note','Slideshot needs a recent Microsoft 365 PowerPoint that can capture slide images. On older versions the panel says “This PowerPoint version can’t capture slide images.”','Slideshot butuh PowerPoint Microsoft 365 versi terbaru yang bisa mengambil gambar slide. Di versi lama, panel menampilkan “This PowerPoint version can’t capture slide images.”')+
h3('Sign in the first time','Masuk pertama kali')+
ol([('Enter your email and password.','Masukkan email dan password.'),('Choose <b>Your team</b>: Avvenger, Cascade, Clementine, Trident or Magnetic.','Pilih <b>Your team</b>: Avvenger, Cascade, Clementine, Trident, atau Magnetic.'),('Type your name the way you want your DM or designers to see it.','Ketik namamu seperti yang ingin dilihat DM atau designer.')])+
p('Your team and name are saved to your account, so you only enter them once. The same sign-in works on the Dashboard.','Tim dan namamu tersimpan di akun, jadi cukup diisi sekali. Sign-in yang sama berlaku di Dashboard.')))

S.append(section('designers','For designers','Untuk designer',
callout('warn','Slides can only be sent once your DM has distributed the order. If you haven’t been given slides yet, everything in the panel shows “Not to work”. Ask your DM first.','Slide hanya bisa dikirim setelah DM membagi order. Jika kamu belum diberi slide, semua slide di panel menampilkan “Not to work”. Tanyakan ke DM terlebih dahulu.')+
h3('1. Tell Slideshot which order this is','1. Beri tahu Slideshot ini order yang mana','d-order')+
ol([('Open the deck and open Slideshot. The first screen asks <b>Which order is this?</b>','Buka deck dan buka Slideshot. Layar pertama menanyakan <b>Which order is this?</b>'),
('Type the Order ID exactly as shown on the order page in the Inner Platform. Digits are enough; the # is added automatically.','Ketik Order ID persis seperti di halaman order di Inner Platform. Cukup angka; tanda # ditambahkan otomatis.'),
('Click <b>Continue</b>.','Klik <b>Continue</b>.')])+
ul([('If the order hasn’t been distributed, you’ll see “We can’t find this order…”. Ask your DM to assign slides first.','Jika order belum dibagi, muncul “We can’t find this order…”. Minta DM membagi slide terlebih dahulu.'),
('This is asked once per deck and saved inside the file. You can still change the Order ID from the header later.','Ini ditanyakan sekali per deck dan tersimpan di dalam file. Order ID tetap bisa diubah dari header nanti.')])+
h3('2. Know your panel','2. Kenali panelnya')+ANAT+
h3('3. Send a slide for review','3. Kirim slide untuk review')+
ol([('Select the slide in PowerPoint. The panel shows its tag and assignment.','Pilih slide di PowerPoint. Panel menampilkan tag dan assignment-nya.'),
('Optional: click the pen button to add a note for your DM, for example “Used the client’s new icon set”.','Opsional: klik tombol pena untuk menambah catatan untuk DM, misalnya “Used the client’s new icon set”.'),
('Click <b>Mark slide N ready for review</b>.','Klik <b>Mark slide N ready for review</b>.')])+
p('The DM receives a picture of the slide, its fonts, size and speaker notes, your note, and your name and team. The tag changes to <b>Waiting for review</b> and a badge such as “v1 sent, 5 min ago” appears on the preview.','DM menerima gambar slide, font, ukuran dan speaker notes-nya, catatanmu, serta nama dan timmu. Tag berubah menjadi <b>Waiting for review</b> dan lencana seperti “v1 sent, 5 min ago” muncul di preview.')+
h3('4. Upload a newer version','4. Unggah versi terbaru')+
ol([('After the DM asks for changes (or you improved the slide), edit it in PowerPoint.','Setelah DM meminta perubahan (atau kamu memperbaiki slide), edit di PowerPoint.'),
('Select the slide and click <b>Upload the latest version</b>.','Pilih slide lalu klik <b>Upload the latest version</b>.'),
('Click <b>Send v2 for review</b> (the number goes up each time).','Klik <b>Send v2 for review</b> (angkanya naik setiap kali).')])+
p('Older versions stay on the Dashboard, read-only, so your DM can compare.','Versi lama tetap ada di Dashboard, hanya-baca, sehingga DM bisa membandingkan.')+
h3('5. Change a slide’s position','5. Ubah posisi slide','d-position')+
p('Use this when the slide in your file should appear at a different place in the order. For example, your file’s slide 9 should be shown to the DM as slide 4.','Pakai ini jika slide di fileku seharusnya muncul di tempat lain di order. Misalnya slide 9 di filemu harus dilihat DM sebagai slide 4.')+
ol([('Select the slide, then click the left button (<b>Change slide position</b>).','Pilih slide, lalu klik tombol kiri (<b>Change slide position</b>).'),
('<b>Current position</b> shows where the slide is in your file. Under <b>Sent as</b>, choose the position it should have in the order.','<b>Current position</b> menunjukkan posisi slide di filemu. Di <b>Sent as</b>, pilih posisinya di order.'),
('Click <b>Save</b>. The header now reads “Slide 9 → Slide 4”, which is exactly what your DM will see.','Klik <b>Save</b>. Header kini menampilkan “Slide 9 → Slide 4”, persis seperti yang akan dilihat DM.')])+
ul([('Positions already taken by another slide that was sent are greyed out (“Slide 4 · sent”), so two slides can never end up at the same number.','Posisi yang sudah dipakai slide lain yang terkirim berwarna abu-abu (“Slide 4 · sent”), jadi dua slide tidak akan pernah memiliki nomor yang sama.'),
('If the position you pick is held by another slide in your file that hasn’t been sent, the two slides swap places.','Jika posisi yang kamu pilih dipegang slide lain di filemu yang belum dikirim, kedua slide bertukar tempat.'),
('Already-sent slides can move too. The new position applies from the next version you send.','Slide yang sudah dikirim juga bisa dipindah. Posisi baru berlaku mulai versi berikutnya yang kamu kirim.'),
('If your DM gave you specific slides, you can only choose among those positions.','Jika DM memberimu slide tertentu, kamu hanya bisa memilih di antara posisi itu.')])+
h3('6. Working in a new file','6. Mengerjakan di file baru','d-working')+
p('Many designers build their slides in a fresh presentation instead of the original deck. That works. When you type the Order ID, Slideshot notices that this file’s slides don’t match the order’s deck and shows a purple note: <b>Is this your working file for #12345?</b> Click <b>Continue</b> again to proceed.','Banyak designer membuat slide di presentasi baru, bukan di deck aslinya. Itu boleh. Saat kamu mengetik Order ID, Slideshot mengenali bahwa slide di file ini tidak sama dengan deck order dan menampilkan catatan ungu: <b>Is this your working file for #12345?</b> Klik <b>Continue</b> sekali lagi untuk lanjut.')+
ul([('Your slides are placed, in order, into the positions your DM assigned you. If your DM gave you slides 6–10, your file’s slides 1–5 go to 6–10.','Slide-mu ditempatkan, berurutan, ke posisi yang ditugaskan DM. Jika DM memberimu slide 6–10, slide 1–5 di filemu masuk ke 6–10.'),
('Use <b>Change slide position</b> to correct any of them.','Pakai <b>Change slide position</b> untuk mengoreksinya.')])+
h3('7. When a slide says “Not to work”','7. Ketika slide bertuliskan “Not to work”')+
p('The slide wasn’t assigned to anyone, or the order hasn’t been distributed. The panel hides all buttons for these slides so nothing is sent by mistake. Slides assigned to someone else show “Assigned to Name-Team” and are also read-only for you.','Slide itu tidak ditugaskan ke siapa pun, atau order belum dibagi. Panel menyembunyikan semua tombol di slide ini agar tidak ada yang terkirim secara tidak sengaja. Slide yang ditugaskan ke orang lain menampilkan “Assigned to Name-Team” dan juga hanya-baca untukmu.')+
h3('8. “Order ID has already been used”','8. “Order ID has already been used”')+
p('Shown when a different deck already uses this Order ID and you aren’t assigned slides in it. Check the number, or type a different one in the header. Copies of the same deck, and working files for orders you’re assigned to, don’t trigger this.','Muncul jika deck lain sudah memakai Order ID ini dan kamu tidak ditugaskan slide di dalamnya. Periksa nomornya, atau ketik nomor lain di header. Salinan deck yang sama, dan working file untuk order yang ditugaskan kepadamu, tidak memicu pesan ini.')))

S.append(section('dms','For Design Managers','Untuk Design Manager',
p('Open the Dashboard from the <b>Dashboard</b> link in the add-in footer, or from the address your admin shared. Only accounts on the DM list can enter; designers who try see “This page is for design managers.”','Buka Dashboard dari link <b>Dashboard</b> di footer add-in, atau dari alamat yang dibagikan admin. Hanya akun di daftar DM yang bisa masuk; designer yang mencoba akan melihat “This page is for design managers.”')+
h3('The board','Board')+
p('After signing in you land on the board: a greeting, how many slides wait for your review, and one card per order.','Setelah masuk kamu tiba di board: sapaan, berapa slide yang menunggu review, dan satu kartu per order.')+BCARD+
ul([('<b>Ring number</b> = approved slides. Grey for none, partly green while in progress, a full circle when everything sent is approved, and solid green with a check once sent to customer.','<b>Angka di ring</b> = slide yang sudah approved. Abu-abu jika belum ada, hijau sebagian saat berjalan, lingkaran penuh jika semua yang terkirim sudah approved, dan hijau solid dengan centang setelah terkirim ke customer.'),
('<b>Thumbnail</b> = the order’s slides. One slide shows a single thumbnail; with more than one, two thumbnails are stacked, and the one in front is a slide waiting for your review when there is one. An order with nothing sent yet shows a dashed “Not sent yet” box.','<b>Thumbnail</b> = slide di order itu. Satu slide tampil sebagai satu thumbnail; jika lebih dari satu, dua thumbnail ditumpuk, dan yang di depan adalah slide yang menunggu reviewmu bila ada. Order yang belum punya slide terkirim menampilkan kotak putus-putus “Not sent yet”.'),
('<b>Last update</b> under the names shows how long ago the order last changed.','<b>Last update</b> di bawah nama menunjukkan kapan order terakhir berubah.'),
('<b>Sort</b> by Longest waiting (default), Most waiting, Recently updated, or Name.','<b>Urutkan</b> berdasarkan Longest waiting (default), Most waiting, Recently updated, atau Name.'),
('<b>Tag team</b> appears on orders that involve more than one team.','<b>Tag team</b> muncul di order yang melibatkan lebih dari satu tim.'),
('The <b>⋯ menu</b> on a card offers Assign slides, Mark as sent to customer (or Undo), and Delete order.','<b>Menu ⋯</b> di kartu berisi Assign slides, Mark as sent to customer (atau Undo), dan Delete order.'),
('The <b>activity feed</b> lists recent sends and decisions for orders on your board.','<b>Activity feed</b> menampilkan pengiriman dan keputusan terbaru untuk order di boardmu.'),
('Your board shows orders that include your team’s slides, or distributions that involve you or your team. Orders disappear 30 days after their last activity.','Boardmu menampilkan order yang berisi slide timmu, atau pembagian yang melibatkan kamu atau timmu. Order hilang 30 hari setelah aktivitas terakhirnya.'),
('Click your name in the header to change how designers see it. It applies to new actions only.','Klik namamu di header untuk mengubah nama yang dilihat designer. Berlaku untuk aksi baru saja.')])+
h3('Assign slides to designers','Membagi slide ke designer','d-assign')+
ol([('Click <b>Assign slides</b> in the board header, in a card’s ⋯ menu, or <b>Distribute project</b> on an empty board.','Klik <b>Assign slides</b> di header board, di menu ⋯ kartu, atau <b>Distribute project</b> di board kosong.'),
('Enter the <b>order number</b>.','Masukkan <b>nomor order</b>.'),
('Pick a designer. The list is grouped into <b>Your team</b> and <b>Other teams</b>. You can assign slides to yourself too.','Pilih designer. Daftarnya dikelompokkan menjadi <b>Your team</b> dan <b>Other teams</b>. Kamu juga bisa menugaskan slide ke dirimu sendiri.'),
('Type their slides, such as <code>1-5</code> or <code>1-3, 7</code>.','Ketik slide-nya, misalnya <code>1-5</code> atau <code>1-3, 7</code>.'),
('Add a row for each extra person, then save.','Tambah baris untuk tiap orang lain, lalu simpan.')])+
ul([('A slide can’t go to two people. Overlaps and wrong formats are flagged before you can save.','Satu slide tidak bisa diberikan ke dua orang. Tumpang tindih dan format yang salah ditandai sebelum bisa disimpan.'),
('Designers see “Assigned to you” straight away, and the order appears on your board even before any slide is sent.','Designer langsung melihat “Assigned to you”, dan order muncul di boardmu bahkan sebelum ada slide terkirim.'),
('Assigning someone from another team makes the order a <b>tag team</b> order automatically.','Menugaskan orang dari tim lain otomatis menjadikan order itu order <b>tag team</b>.'),
('Assignments follow slide numbers of the original deck. If the deck’s order changes, update the distribution.','Pembagian mengikuti nomor slide di deck asli. Jika urutan deck berubah, perbarui pembagiannya.')])+
callout('tip','Open an order and click <b>Adjust distribution</b> in the header to change who has which slides later.','Buka sebuah order dan klik <b>Adjust distribution</b> di header untuk mengubah siapa memegang slide mana nanti.')+
h3('Review slides','Mereview slide','d-review')+
p('Click an order card to open its review page.','Klik kartu order untuk membuka halaman review-nya.')+
ul([('<b>Header:</b> the order name and progress, for example “2/3 slides approved”, plus Adjust distribution, Send to customer, zoom, and the slide list toggle.','<b>Header:</b> nama order dan progresnya, misalnya “2/3 slides approved”, plus Adjust distribution, Send to customer, zoom, dan tombol daftar slide.'),
('<b>Slide strip:</b> thumbnails with their positions. Slides assigned but not sent yet appear as dashed “Not sent yet” placeholders. When two or more designers work on the order, chips let you filter by person (“Name-Team 2/5 sent”).','<b>Strip slide:</b> thumbnail beserta posisinya. Slide yang sudah ditugaskan tapi belum dikirim muncul sebagai placeholder putus-putus “Not sent yet”. Jika dua designer atau lebih mengerjakan order, chip memungkinkan filter per orang (“Name-Team 2/5 sent”).'),
('<b>Zoom:</b> Fit, or 25% to 400%.','<b>Zoom:</b> Fit, atau 25% sampai 400%.'),
('<b>Details panel:</b> who sent it and when, who it’s assigned to, the designer’s note, and the fonts, slide size and speaker notes read from the file.','<b>Panel detail:</b> siapa yang mengirim dan kapan, ditugaskan ke siapa, catatan designer, serta font, ukuran slide, dan speaker notes yang dibaca dari file.'),
('<b>Comments:</b> click on the slide to drop a pin, write a comment or record a voice note, and mark it resolved when handled.','<b>Komentar:</b> klik di slide untuk menaruh pin, tulis komentar atau rekam voice note, lalu tandai resolved jika sudah ditangani.'),
('<b>Decision:</b> approve the slide or request changes. A banner confirms what you chose.','<b>Keputusan:</b> approve slide atau minta perubahan. Banner mengonfirmasi pilihanmu.'),
('<b>Older versions</b> open read-only with a notice. Only the latest version can be decided.','<b>Versi lama</b> terbuka hanya-baca dengan pemberitahuan. Hanya versi terbaru yang bisa diputuskan.'),
('If nothing has been sent yet, you’ll see “The designers are busy putting together slides right now…”.','Jika belum ada yang dikirim, kamu akan melihat “The designers are busy putting together slides right now…”.')])+
h3('Send to customer','Send to customer')+
p('When every sent slide is approved, a <b>Send to customer</b> button appears in the header. Click it to mark the order as sent; the ring turns solid green. You can also use Mark as sent to customer, and Undo, from the card menu. Progress counts sent slides only, so a slide that hasn’t been sent yet doesn’t hold the order back.','Jika semua slide yang terkirim sudah approved, tombol <b>Send to customer</b> muncul di header. Klik untuk menandai order terkirim; ring menjadi hijau solid. Kamu juga bisa memakai Mark as sent to customer, dan Undo, dari menu kartu. Progres hanya menghitung slide yang terkirim, jadi slide yang belum dikirim tidak menahan order.')+
callout('warn','This marks the order’s status in Slideshot. It doesn’t email or deliver anything to the customer yet.','Ini menandai status order di Slideshot. Belum mengirim email atau mengirimkan apa pun ke customer.')+
h3('Delete and clean up','Menghapus dan merapikan')+
ul([('<b>Delete a slide:</b> the trash button on the review page removes that slide, with its versions and comments.','<b>Hapus slide:</b> tombol tempat sampah di halaman review menghapus slide itu beserta versi dan komentarnya.'),
('<b>Delete an order:</b> use the card’s ⋯ menu. It also removes the distribution, and works for orders that only have a distribution and no sent slides. After confirming, it can’t be undone.','<b>Hapus order:</b> pakai menu ⋯ di kartu. Pembagiannya ikut terhapus, dan bisa dipakai untuk order yang hanya punya pembagian tanpa slide terkirim. Setelah dikonfirmasi, tidak bisa dibatalkan.'),
('On a tag team order you only delete your own team’s slides.','Di order tag team kamu hanya menghapus slide timmu sendiri.')])))

S.append(section('tagteam','Teams and tag team','Tim dan tag team',
p('The teams are Avvenger, Cascade, Clementine, Trident and Magnetic. Each person belongs to exactly one.','Tim yang ada: Avvenger, Cascade, Clementine, Trident, dan Magnetic. Setiap orang masuk ke tepat satu tim.')+
p('An order becomes a <b>tag team</b> order when a DM assigns slides to someone from another team. Nobody has to set this by hand.','Sebuah order menjadi order <b>tag team</b> ketika DM menugaskan slide ke orang dari tim lain. Tidak ada yang perlu mengaturnya manual.')+
table([('','') ,('What happens','Yang terjadi')],[
[('Who sees the order','Siapa melihat order'),('Both teams’ DMs see it on their boards and can view the whole deck.','DM kedua tim melihatnya di board masing-masing dan bisa melihat seluruh deck.')],
[('Who reviews what','Siapa mereview apa'),('Each DM approves or requests changes only on their own team’s slides. Other slides are view-only.','Tiap DM hanya meng-approve atau meminta perubahan di slide timnya. Slide lain hanya bisa dilihat.')],
[('Designer chips','Chip designer'),('The review page shows one chip per designer with “n/m sent”.','Halaman review menampilkan satu chip per designer dengan “n/m sent”.')],
[('Deleting','Menghapus'),('A DM deleting the order removes only their team’s slides.','DM yang menghapus order hanya menghapus slide timnya.')]],'two')))

S.append(section('reference','Tags and statuses','Tag dan status',
p('Add-in header tags and the matching meaning.','Tag di header add-in beserta artinya.')+
table([('Tag','Tag'),('Meaning','Arti'),('Your next step','Langkahmu berikutnya')],[
[chip('grey','Not sent yet'),('A slide that’s assigned and not sent.','Slide yang ditugaskan dan belum dikirim.'),('Finish it and click Mark slide N ready for review.','Selesaikan lalu klik Mark slide N ready for review.')],
[chip('yellow','Waiting for review'),('Sent. The DM hasn’t decided.','Sudah dikirim. DM belum memutuskan.'),('Wait, or upload a newer version.','Tunggu, atau unggah versi terbaru.')],
[chip('green','Approved'),('The DM approved this version.','DM meng-approve versi ini.'),('Nothing more to do.','Tidak ada yang perlu dilakukan.')],
[chip('red','Change needed'),('The DM asked for changes.','DM meminta perubahan.'),('Edit, then Upload the latest version.','Edit, lalu Upload the latest version.')],
[chip('grey','Not to work'),('Not assigned to anyone, or the order isn’t distributed.','Tidak ditugaskan ke siapa pun, atau order belum dibagi.'),('Ask your DM if you expected to work on it.','Tanya DM jika kamu seharusnya mengerjakannya.')]])+
h3('Other labels','Label lain')+
table([('Label','Label'),('Meaning','Arti')],[
['<span class="assigned">'+BOOK+'Assigned to you</span>',('The slide is yours.','Slide ini milikmu.')],
['<span class="plain">Assigned to Kevin-Cascade</span>',('Someone else’s slide. Read-only for you.','Slide milik orang lain. Hanya-baca untukmu.')],
['<span class="plain">Slide 9 → Slide 4</span>',('Your file’s slide 9 is shown to the DM as slide 4.','Slide 9 di filemu dilihat DM sebagai slide 4.')],
['<span class="badge">v2 sent, 5 min ago</span>',('Version and time of the last send, on the preview.','Versi dan waktu pengiriman terakhir, di preview.')],
['<span class="plain">Tag team</span>',('More than one team works on this order.','Lebih dari satu tim mengerjakan order ini.')]])))

S.append(section('admin','Admin and setup','Admin dan setup',
p('Slideshot has three pieces: the add-in and the Dashboard (static pages served from GitHub Pages) and a Supabase project that holds accounts, the database, private slide-image storage and live updates.','Slideshot punya tiga bagian: add-in dan Dashboard (halaman statis dari GitHub Pages) serta proyek Supabase yang menyimpan akun, database, penyimpanan gambar slide yang privat, dan pembaruan langsung.')+
h3('Add or remove a DM','Menambah atau menghapus DM')+
p('DMs are listed in the <code>design_managers</code> table. Run this in the Supabase SQL Editor, with the person’s sign-in email:','DM tercatat di tabel <code>design_managers</code>. Jalankan ini di Supabase SQL Editor, dengan email sign-in orangnya:')+
'<pre><code>insert into public.design_managers (user_id)\nselect id from auth.users where email = \'dm@24slides.com\';\n\n-- remove a DM\ndelete from public.design_managers\nwhere user_id = (select id from auth.users where email = \'dm@24slides.com\');</code></pre>'+
ul([('The person must have signed in at least once so their account exists.','Orangnya harus sudah pernah sign in agar akunnya ada.'),
('Approving, commenting, deleting and distributing are enforced in the database for DMs only, so they can’t be bypassed from the browser.','Approve, komentar, hapus, dan membagi slide dibatasi hanya untuk DM di database, jadi tidak bisa dilewati dari browser.')])+
h3('Release an update','Merilis pembaruan')+
ul([('Update the files in the repository folder <code>slide-qa-marker/</code>. GitHub Pages publishes within about a minute.','Perbarui file di folder repository <code>slide-qa-marker/</code>. GitHub Pages mempublikasikannya dalam sekitar satu menit.'),
('Designers see the new version after they close and reopen the panel. The version appears in the panel footer.','Designer melihat versi baru setelah menutup dan membuka lagi panel. Versi tampil di footer panel.'),
('When the manifest changes (name or icon), replace <code>manifest.xml</code> in the shared folder, close PowerPoint and, on Windows, delete <code>%LOCALAPPDATA%\\Microsoft\\Office\\16.0\\Wef</code> before reinstalling.','Jika manifest berubah (nama atau ikon), ganti <code>manifest.xml</code> di shared folder, tutup PowerPoint dan, di Windows, hapus <code>%LOCALAPPDATA%\\Microsoft\\Office\\16.0\\Wef</code> sebelum memasang ulang.'),
('The setup script <code>supabase-setup.sql</code> in the repository creates the tables and rules.','Skrip setup <code>supabase-setup.sql</code> di repository membuat tabel dan aturannya.')])+
callout('note','The Dashboard address is <code>ridhoofrahman.github.io/Slide-preview-automation/slide-qa-marker/review.html</code>.','Alamat Dashboard: <code>ridhoofrahman.github.io/Slide-preview-automation/slide-qa-marker/review.html</code>.')))

FAQ=[
(('Why do all my slides say “Not to work”?','Kenapa semua slide-ku bertuliskan “Not to work”?'),('Your DM hasn’t distributed this order, or it was distributed under a different number. Check the Order ID in the header and ask your DM to assign you slides.','DM belum membagi order ini, atau dibagi dengan nomor yang berbeda. Periksa Order ID di header dan minta DM menugaskan slide kepadamu.')),
(('Can I use a new file instead of the original deck?','Bolehkah memakai file baru, bukan deck asli?'),('Yes. Slideshot shows the “working file” note and places your slides into the positions assigned to you. See “Working in a new file”.','Boleh. Slideshot menampilkan catatan “working file” dan menempatkan slide-mu ke posisi yang ditugaskan. Lihat “Mengerjakan di file baru”.')),
(('Why is a position greyed out in the dropdown?','Kenapa ada posisi yang abu-abu di dropdown?'),('Another slide already sent to that position. Choose a free one, or ask the other designer to move theirs.','Slide lain sudah dikirim ke posisi itu. Pilih posisi yang kosong, atau minta designer lain memindahkan miliknya.')),
(('Can I move a slide that was already sent?','Bisakah memindahkan slide yang sudah dikirim?'),('Yes. Pick a new position and send the next version; the DM sees it at the new position from then on.','Bisa. Pilih posisi baru dan kirim versi berikutnya; DM melihatnya di posisi baru sejak saat itu.')),
(('What if I delete a slide and build it again?','Bagaimana jika slide dihapus lalu dibuat ulang?'),('Slideshot tracks slides by PowerPoint’s internal ID, so a rebuilt slide counts as a new slide. The assignment follows the position number, but the review history and versions stay with the old slide. Edit the original when you can.','Slideshot melacak slide lewat ID internal PowerPoint, jadi slide yang dibuat ulang dianggap slide baru. Assignment mengikuti nomor posisi, tapi riwayat review dan versi tetap di slide lama. Sebisa mungkin edit slide aslinya.')),
(('Can designers open the Dashboard?','Bisakah designer membuka Dashboard?'),('Not yet. It is DM-only today. A designer view is planned.','Belum. Saat ini hanya untuk DM. Tampilan untuk designer sudah direncanakan.')),
(('Does Send to customer email the customer?','Apakah Send to customer mengirim email ke customer?'),('No. It marks the order as sent inside Slideshot.','Tidak. Itu hanya menandai order sebagai terkirim di dalam Slideshot.')),
(('How long are orders kept?','Berapa lama order disimpan?'),('Orders are removed automatically 30 days after their last activity. DMs can delete them earlier.','Order dihapus otomatis 30 hari setelah aktivitas terakhirnya. DM bisa menghapusnya lebih awal.')),
(('How do I change my team or name?','Bagaimana mengganti tim atau namaku?'),('DMs can change their name by clicking it in the Dashboard header. The team is set at first sign-in; ask the admin to change it. Old actions keep the name they were made with.','DM bisa mengganti nama dengan mengkliknya di header Dashboard. Tim ditetapkan saat sign-in pertama; minta admin untuk mengubahnya. Aksi lama tetap memakai nama saat aksi itu dibuat.')),
(('What does my DM see of my slide?','Apa yang dilihat DM dari slide-ku?'),('A picture of the slide, its fonts, slide size, speaker notes, your note, the version and who sent it.','Gambar slide, font, ukuran slide, speaker notes, catatanmu, versi, dan siapa pengirimnya.'))]
S.append(section('faq','FAQ','FAQ',''.join(details(q,a) for q,a in FAQ)))

S.append(section('trouble','Troubleshooting','Pemecahan masalah',
table([('You see','Yang kamu lihat'),('Likely cause','Kemungkinan penyebab'),('Try this','Coba ini')],[
[('The panel still shows an old name, icon or version','Panel masih menampilkan nama, ikon, atau versi lama'),('PowerPoint cached the old add-in.','PowerPoint menyimpan add-in lama di cache.'),('Close PowerPoint, clear the add-in cache, reinstall the latest manifest. See Admin and setup.','Tutup PowerPoint, bersihkan cache add-in, pasang ulang manifest terbaru. Lihat Admin dan setup.')],
[('“This PowerPoint version can’t capture slide images”','“This PowerPoint version can’t capture slide images”'),('PowerPoint is too old for image capture.','PowerPoint terlalu lama untuk mengambil gambar.'),('Update Microsoft 365.','Perbarui Microsoft 365.')],
[('“We can’t find this order…”','“We can’t find this order…”'),('Nothing has been distributed under that number.','Belum ada pembagian dengan nomor itu.'),('Check the digits, then ask your DM to assign slides.','Periksa angkanya, lalu minta DM membagi slide.')],
[('A slide you were assigned says “Not to work”','Slide yang ditugaskan kepadamu bertuliskan “Not to work”'),('The Order ID in your panel differs from the DM’s.','Order ID di panelmu berbeda dengan milik DM.'),('Retype the Order ID in the header, or reopen the panel.','Ketik ulang Order ID di header, atau buka ulang panel.')],
[('“Order ID has already been used”','“Order ID has already been used”'),('A different deck already uses this number.','Deck lain sudah memakai nomor ini.'),('Check the number you typed. Working files for orders assigned to you are fine.','Periksa nomor yang kamu ketik. Working file untuk order yang ditugaskan kepadamu tidak masalah.')],
[('Two slides at the same number on the review page','Dua slide di nomor yang sama di halaman review'),('They were sent to the same position before positions were locked.','Keduanya dikirim ke posisi yang sama sebelum posisi dikunci.'),('Delete one on the review page, then have the designer resend it at a free position.','Hapus satu di halaman review, lalu minta designer mengirim ulang di posisi yang kosong.')],
[('“This page is for design managers”','“This page is for design managers”'),('Your account isn’t on the DM list.','Akunmu belum ada di daftar DM.'),('Ask the admin to add you.','Minta admin menambahkanmu.')],
[('“Couldn’t load review status”','“Couldn’t load review status”'),('A connection problem.','Masalah koneksi.'),('Check your internet, then reopen the panel.','Periksa internet, lalu buka ulang panel.')]],'trbl')))

S.append(section('limits','Limits and what’s next','Batasan dan rencana',
h3('Today’s limits','Batasan saat ini')+
ul([('Assignments follow slide numbers. If the original deck’s order changes, update the distribution.','Pembagian mengikuti nomor slide. Jika urutan deck asli berubah, perbarui pembagiannya.'),
('A rebuilt slide is a new slide: its history doesn’t follow.','Slide yang dibuat ulang adalah slide baru: riwayatnya tidak ikut.'),
('Send to customer only marks status.','Send to customer hanya menandai status.'),
('The Dashboard is DM-only.','Dashboard hanya untuk DM.'),
('Slide images need a recent Microsoft 365 PowerPoint.','Gambar slide membutuhkan PowerPoint Microsoft 365 versi terbaru.')])+
h3('Planned','Direncanakan')+
ul([('A Dashboard for everyone: designers see their workload, their team and who is working on what.','Dashboard untuk semua orang: designer melihat beban kerja, timnya, dan siapa mengerjakan apa.'),
('Connecting Send to customer to the Inner Platform (idea).','Menghubungkan Send to customer ke Inner Platform (ide).'),
('Recognising a replacement slide as the next version of the one it replaced (parked).','Mengenali slide pengganti sebagai versi berikutnya dari slide yang digantikan (ditunda).')])))

S.append(section('releases','Release notes','Catatan rilis',
table([('Version','Versi'),('What changed','Yang berubah')],[
['Dashboard',('Board cards: slide thumbnail (stacked when an order has more than one slide, dashed “Not sent yet” box when nothing is sent), purple Tag team chip, “Last update”; the ⋯ button moved to the bottom-right.','Kartu board: thumbnail slide (bertumpuk jika order punya lebih dari satu slide, kotak putus-putus “Not sent yet” jika belum ada yang terkirim), chip Tag team ungu, “Last update”; tombol ⋯ pindah ke kanan bawah.')],
['v2.26',('New colours from the Builder DS design system in the add-in and the Dashboard: brand blue, greys, status colours and the progress ring. Nothing changes in how it works.','Warna baru dari design system Builder DS di add-in dan Dashboard: biru brand, abu-abu, warna status dan ring progress. Cara kerjanya tidak berubah.')],
['v2.25',('Sent slides can move to a new position with their next version.','Slide yang sudah dikirim bisa pindah posisi bersama versi berikutnya.')],
['v2.24',('Positions held by another slide are disabled; header shows “Slide 9 → Slide 4”.','Posisi yang dipegang slide lain dinonaktifkan; header menampilkan “Slide 9 → Slide 4”.')],
['v2.23',('“Not to work” tag for unassigned slides.','Tag “Not to work” untuk slide yang tidak ditugaskan.')],
['v2.22',('Dashboard link in the footer for DMs.','Link Dashboard di footer untuk DM.')],
['v2.21',('Change slide position popup.','Popup Change slide position.')],
['v2.20',('Upload the latest version button.','Tombol Upload the latest version.')],
['v2.19',('New order step with logo, new footer.','Langkah order baru dengan logo, footer baru.')],
['v2.18',('New full-width header with slide status.','Header baru selebar penuh dengan status slide.')],
['v2.16',('Order numbers of any length are recognised.','Nomor order dengan panjang berapa pun dikenali.')],
['v2.14',('Order ID asked the first time a deck is opened.','Order ID ditanyakan saat deck pertama kali dibuka.')]],'rel')))

S.append(section('glossary','Glossary','Glosarium',
table([('Term','Istilah'),('Meaning','Arti')],[
[('Order ID','Order ID'),('The order number from the Inner Platform, written as #12345.','Nomor order dari Inner Platform, ditulis #12345.')],
[('Distribution','Distribusi'),('Which designer has which slides in an order, set by a DM.','Siapa memegang slide mana di sebuah order, diatur DM.')],
[('Position','Posisi'),('A slide’s number in the order, as the DM sees it.','Nomor slide di order, seperti yang dilihat DM.')],
[('Working file','Working file'),('A new presentation where a designer builds assigned slides.','Presentasi baru tempat designer membuat slide yang ditugaskan.')],
[('Version','Versi'),('Each time a slide is sent again it becomes v2, v3 and so on.','Setiap slide dikirim lagi menjadi v2, v3, dan seterusnya.')],
[('Tag team','Tag team'),('An order worked on by more than one team.','Order yang dikerjakan lebih dari satu tim.')],
[('DM','DM'),('Design Manager. Reviews and distributes work.','Design Manager. Mereview dan membagi pekerjaan.')]],'two')))

navhtml=''.join(f'<a href="#{i}">{T(en,idn)}</a>' for i,en,idn in NAV)

CSS=open(os.path.join(HERE,'style.css')).read()
JS=open(os.path.join(HERE,'app.js')).read()
page=f'''<!DOCTYPE html>
<html lang="en" data-lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Slideshot documentation</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&display=swap" rel="stylesheet">
<style>{CSS}</style>
</head>
<body>
<header class="top"><a class="brand" href="#top" aria-label="Slideshot">{MARK}<span>Slideshot</span><em>{T('Docs','Dokumentasi')}</em></a>
<div class="lang" role="group" aria-label="Language / Bahasa"><button type="button" data-l="en" aria-pressed="true">EN</button><button type="button" data-l="id" aria-pressed="false">ID</button></div></header>
<div class="hero" id="top"><div class="hero-in"><h1>{T('Slideshot documentation','Dokumentasi Slideshot')}</h1>
<p class="lead">{T('Everything about the PowerPoint add-in for designers and the web Dashboard for Design Managers: who uses it, what it does, and how to use it.','Semua tentang add-in PowerPoint untuk designer dan Dashboard web untuk Design Manager: siapa pemakainya, fungsinya, dan cara memakainya.')}</p>
<div class="metas"><span class="meta">{T('Add-in v2.26','Add-in v2.26')}</span><span class="meta">{T('Updated 13 Nov 2026','Diperbarui 13 Nov 2026')}</span></div>
<div class="paths"><a href="#designers"><b>{T('I’m a designer','Saya designer')}</b><span>{T('Send slides from PowerPoint','Kirim slide dari PowerPoint')}</span></a><a href="#dms"><b>{T('I’m a Design Manager','Saya Design Manager')}</b><span>{T('Assign, review, approve','Bagi, review, approve')}</span></a><a href="#admin"><b>{T('I set things up','Saya mengurus setup')}</b><span>{T('Add DMs, release updates','Tambah DM, rilis pembaruan')}</span></a></div></div>
<div class="band-wrap" aria-hidden="true">{BAND}</div></div>
<div class="layout"><nav class="toc" aria-label="Contents / Daftar isi">{navhtml}</nav>
<main>{''.join(S)}<footer class="foot">{T('Slideshot for 24Slides. Add-in v2.26.','Slideshot untuk 24Slides. Add-in v2.26.')}</footer></main></div>
<script>{JS}</script>
</body></html>'''
open(os.path.join(HERE,'..','slideshot-docs.html'),'w').write(page)
print(len(page))
