import { useState } from 'react'
import { SectionTitle } from '../components/bits'
import { Icon } from '../components/Icon'
import { normLat } from '../lib/arabic'
import { useStore } from '../lib/data'

interface Term {
  id: string
  term: string
  ar: string
  group: 'Nasab & Nama' | 'Struktur Kabilah' | 'Ikatan Keluarga' | 'Ikatan Sosial' | 'Kelompok Sahabat'
  def: string
  example?: string
  ref?: string
}

const TERMS: Term[] = [
  { id: 'nasab', term: 'Nasab', ar: 'النَّسَب', group: 'Nasab & Nama', def: 'Garis keturunan seseorang yang disandarkan kepada ayah, kakek, dan seterusnya ke atas. Ilmu nasab (‘ilm al-ansab) mencatat rantai “fulan bin fulan” hingga leluhur kabilah.', example: 'عمر بن الخطاب بن نفيل بن عبد العزى … بن عدي بن كعب', ref: 'Ibnu Hazm, Jamharat Ansab al-‘Arab (muqaddimah)' },
  { id: 'ism', term: 'Ism', ar: 'الاسم', group: 'Nasab & Nama', def: 'Nama diri seseorang, misalnya Umar, Ali, atau Aisyah, sebelum disambung dengan nasab.' },
  { id: 'kunyah', term: 'Kunyah', ar: 'الكُنْيَة', group: 'Nasab & Nama', def: 'Panggilan kehormatan yang diawali “Abu” (bapaknya si fulan) atau “Ummu” (ibunya si fulan). Sering lebih masyhur daripada nama asli.', example: 'Abu Bakar (‘Abdullah bin ‘Utsman), Abu Hafsh (Umar), Ummu Salamah (Hindun)' },
  { id: 'laqab', term: 'Laqab', ar: 'اللَّقَب', group: 'Nasab & Nama', def: 'Julukan yang menunjukkan sifat, keutamaan, atau peristiwa.', example: 'ash-Shiddiq (Abu Bakar), al-Faruq (Umar), Dzun Nurain (Utsman), Asadullah (Hamzah), Saifullah (Khalid)' },
  { id: 'nisbah', term: 'Nisbah', ar: 'النِّسْبَة', group: 'Nasab & Nama', def: 'Kata sifat penisbatan berakhiran “-i/-iyyah” kepada kabilah, klan, negeri, atau profesi. NasabNet memakai nisbah dari data rawi Turath untuk mengelompokkan sahabat ke kabilah.', example: 'al-Qurasyi al-‘Adawi (Umar), al-Anshari al-Khazraji an-Najjari (Abu Ayyub)', ref: 'as-Sam‘ani, al-Ansab' },
  { id: 'ashabah', term: '‘Ashabah', ar: 'العَصَبَة', group: 'Ikatan Keluarga', def: 'Kerabat laki-laki dari jalur ayah (anak, ayah, saudara seayah, paman, sepupu dari paman) yang menjadi poros perwalian, pembelaan kabilah, dan penerima sisa warisan. Dalam ilmu nasab, ‘ashabah menentukan ke mana seseorang “dihitung” dalam kabilah.', ref: 'Kitab-kitab faraidh; Ibnu Qudamah, al-Mughni (bab ‘ashabah)' },
  { id: 'arham', term: 'Dzawil Arham', ar: 'ذوو الأرحام', group: 'Ikatan Keluarga', def: 'Kerabat melalui jalur perempuan (misalnya paman dari pihak ibu/khal, cucu dari anak perempuan) yang bukan ‘ashabah.' },
  { id: 'mushaharah', term: 'Mushaharah (ipar & mertua)', ar: 'المُصاهَرة', group: 'Ikatan Keluarga', def: 'Ikatan kekerabatan yang lahir dari pernikahan: mertua (ahmā’), menantu (ashhār), ipar. Nabi ﷺ menjalin mushaharah dengan Abu Bakar dan Umar (menikahi putri mereka) serta Utsman dan Ali (menikahkan putri beliau).', example: 'Utsman disebut Dzun Nurain karena menikahi Ruqayyah lalu Ummu Kultsum binti Rasulillah ﷺ.' },
  { id: 'besan', term: 'Besan', ar: 'الأَحْماء المتقابلة', group: 'Ikatan Keluarga', def: 'Dua pasang orang tua yang anak-anaknya saling menikah. Di NasabNet dihitung otomatis dari pola “anak → pasangan → orang tua”.' },
  { id: 'radhaah', term: 'Radha‘ah (sepersusuan)', ar: 'الرَّضاعة', group: 'Ikatan Keluarga', def: 'Hubungan mahram karena disusui oleh perempuan yang sama. Hamzah bin ‘Abdil Muththalib adalah saudara sepersusuan Nabi ﷺ melalui Tsuwaibah.' },
  { id: 'ummuwalad', term: 'Ummu Walad', ar: 'أم ولد', group: 'Ikatan Keluarga', def: 'Budak perempuan yang melahirkan anak dari tuannya; Ibnu Sa‘d sering menyebut “wa ummuhu umm walad” untuk anak dari ibu semacam ini.' },
  { id: 'aqib', term: '‘Aqib / ‘Aqb', ar: 'العَقِب', group: 'Ikatan Keluarga', def: 'Keturunan yang melanjutkan nasab. Ungkapan “lā ‘aqiba lahu” berarti garis keturunannya terputus.' },
  { id: 'muakhah', term: 'Mu’akhah', ar: 'المُؤاخاة', group: 'Ikatan Sosial', def: 'Persaudaraan yang ditetapkan Nabi ﷺ antara Muhajirin dan Anshar setelah hijrah, misalnya Abdurrahman bin ‘Auf dengan Sa‘d bin ar-Rabi‘ dan Salman al-Farisi dengan Abu ad-Darda’. Pada awalnya bahkan berlaku saling mewarisi hingga dinasakh (QS. al-Anfal: 75).', ref: 'Ibnu Sa‘d, ath-Thabaqat; Ibnu Habib, al-Muhabbar (daftar al-mu’akhah)' },
  { id: 'wala', term: 'Wala’ & Maula', ar: 'الوَلاء والمَوْلى', group: 'Ikatan Sosial', def: 'Ikatan antara pembebas budak (atau pihak yang mengikat sumpah) dengan orang yang dibebaskan. Maula dinisbatkan kepada kabilah tuannya (“maulāhum”), seperti Zaid bin Haritsah maula Rasulillah ﷺ.' },
  { id: 'halif', term: 'Halif (sekutu)', ar: 'الحَلِيف', group: 'Ikatan Sosial', def: 'Orang atau kelompok yang bersumpah setia kepada sebuah kabilah sehingga dihitung bersama mereka, tanpa menjadi keturunannya. Banyak sahabat tercatat “halif Bani Zuhrah”, “halif Bani ‘Abdil Asyhal”, dsb.' },
  { id: 'qabilah', term: 'Tingkatan kabilah', ar: 'الشعب، القبيلة، العمارة، البطن، الفخذ، الفصيلة', group: 'Struktur Kabilah', def: 'Para nassabah membagi kelompok keturunan bertingkat: sya‘b (rumpun besar, mis. Mudhar), qabilah (Kinanah), ‘imarah (Quraisy), bathn (Qushay), fakhidz (Hasyim), fashilah (keluarga ‘Abbas).', ref: 'al-Qalqasyandi, Nihayat al-Arab; Ibnu Hazm, Jamharah' },
  { id: 'quraisy', term: 'Quraisy', ar: 'قريش', group: 'Struktur Kabilah', def: 'Keturunan Fihr (Quraisy) bin Malik bin an-Nadhr bin Kinanah. Terbagi menjadi klan-klan seperti Hasyim, Umayyah, Makhzum, Taim, ‘Adi, Zuhrah, dan Asad.', ref: 'Mush‘ab az-Zubairi, Nasab Quraisy' },
  { id: 'anshar', term: 'Anshar', ar: 'الأنصار', group: 'Kelompok Sahabat', def: 'Penduduk Madinah (Aus dan Khazraj, keturunan Haritsah bin Tsa‘labah dari al-Azd) yang menolong dan menampung Nabi ﷺ serta para Muhajirin.' },
  { id: 'muhajirin', term: 'Muhajirin', ar: 'المهاجرون', group: 'Kelompok Sahabat', def: 'Sahabat yang berhijrah dari Makkah (dan negeri lain) ke Madinah sebelum Fathu Makkah. Di NasabNet, status ini diambil dari keterangan hijrah (ke Habasyah/Madinah) pada sumber, atau ditandai bagi sahabat Quraisy yang tercatat ikut perang Badar; yang masuk Islam saat Fathu Makkah tidak dihitung.' },
  { id: 'ahlulbait', term: 'Ahlulbait', ar: 'أهل البيت', group: 'Kelompok Sahabat', def: 'Keluarga rumah tangga Nabi ﷺ: para istri beliau (QS. al-Ahzab: 33) serta Ali, Fathimah, al-Hasan, dan al-Husain (hadits al-Kisa’). NasabNet juga menandai putra-putri dan cucu-cucu beliau. Dalam makna lebih luas mencakup Bani Hasyim yang diharamkan menerima zakat (lihat “Kerabat Nabi”).' },
  { id: 'kerabat', term: 'Kerabat Nabi (Dzawil Qurba)', ar: 'ذوو القربى', group: 'Kelompok Sahabat', def: 'Bani Hasyim dan Bani al-Muththalib yang berhak atas bagian khumus (QS. al-Anfal: 41). NasabNet menandai seluruh tokoh dari dua klan ini.' },
  { id: 'ummahat', term: 'Ummahatul Mukminin', ar: 'أمهات المؤمنين', group: 'Kelompok Sahabat', def: 'Para istri Nabi ﷺ yang digelari “ibu orang-orang beriman” (QS. al-Ahzab: 6): Khadijah, Saudah, Aisyah, Hafshah, Zainab binti Khuzaimah, Ummu Salamah, Zainab binti Jahsy, Juwairiyah, Ummu Habibah, Shafiyyah, dan Maimunah.' },
  { id: 'asyarah', term: 'Al-‘Asyarah al-Mubasysyarah', ar: 'العشرة المبشرون بالجنة', group: 'Kelompok Sahabat', def: 'Sepuluh sahabat yang disebut namanya dijamin surga dalam satu hadits: Abu Bakar, Umar, Utsman, Ali, Thalhah, az-Zubair, Abdurrahman bin ‘Auf, Sa‘d bin Abi Waqqash, Sa‘id bin Zaid, dan Abu ‘Ubaidah.' },
  { id: 'badar', term: 'Ahlu Badar', ar: 'أهل بدر', group: 'Kelompok Sahabat', def: 'Sahabat yang ikut perang Badar (2 H), sekitar 313 orang. Ibnu Sa‘d menyusun jilid ketiga Thabaqat-nya berdasarkan mereka.' },
  { id: 'thulaqa', term: 'Ath-Thulaqa’', ar: 'الطُّلَقاء', group: 'Kelompok Sahabat', def: 'Penduduk Makkah yang dibebaskan Nabi ﷺ pada Fathu Makkah dan masuk Islam saat itu, seperti Abu Sufyan dan Suhail bin ‘Amr.' },
  { id: 'shahabi', term: 'Shahabi', ar: 'الصحابي', group: 'Kelompok Sahabat', def: 'Definisi Ibnu Hajar: orang yang berjumpa Nabi ﷺ dalam keadaan beriman dan wafat di atas Islam.', ref: 'Ibnu Hajar, al-Ishabah fi Tamyiz ash-Shahabah (muqaddimah)' },
]

const BOOKS: { id: number; title: string; ar: string; author: string; use: string }[] = [
  { id: 9767, title: 'al-Ishabah fi Tamyiz ash-Shahabah', ar: 'الإصابة في تمييز الصحابة', author: 'Ibnu Hajar al-‘Asqalani (w. 852 H)', use: 'Ensiklopedia sahabat terlengkap (±12.000 entri); acuan status kesahabatan dan rujukan yang dikutip basis data rawi Turath.' },
  { id: 9351, title: 'ath-Thabaqat al-Kubra', ar: 'الطبقات الكبرى', author: 'Ibnu Sa‘d (w. 230 H)', use: 'Sumber utama NasabNet untuk istri, anak, dan mu’akhah: setiap biografi dibuka dengan nasab, ibu, dan daftar anak beserta ibu mereka.' },
  { id: 1110, title: 'Usd al-Ghabah fi Ma‘rifat ash-Shahabah', ar: 'أسد الغابة في معرفة الصحابة', author: 'Ibnul Atsir (w. 630 H)', use: 'Kompilasi biografi sahabat dari Ibnu Mandah, Abu Nu‘aim, dan Ibnu ‘Abdil Barr.' },
  { id: 1499, title: 'al-Isti‘ab fi Ma‘rifat al-Ashhab', ar: 'الاستيعاب في معرفة الأصحاب', author: 'Ibnu ‘Abdil Barr (w. 463 H)', use: 'Biografi sahabat dengan perhatian pada nasab dan kunyah.' },
  { id: 2922, title: 'Nasab Quraisy', ar: 'نسب قريش', author: 'Mush‘ab az-Zubairi (w. 236 H)', use: 'Rujukan klasik silsilah dan pernikahan klan-klan Quraisy.' },
  { id: 9793, title: 'Jamharat Ansab al-‘Arab', ar: 'جمهرة أنساب العرب', author: 'Ibnu Hazm (w. 456 H)', use: 'Peta nasab seluruh kabilah Arab; dasar rangkaian baku leluhur kabilah.' },
  { id: 12205, title: 'al-Muhabbar', ar: 'المحبر', author: 'Muhammad bin Habib (w. 245 H)', use: 'Memuat daftar istri Nabi ﷺ, daftar mu’akhah, dan banyak catatan pernikahan Quraisy.' },
  { id: 919, title: 'Jamharat an-Nasab', ar: 'جمهرة النسب', author: 'Hisyam Ibnul Kalbi (w. 204 H)', use: 'Karya induk ilmu nasab Arab.' },
  { id: 1379, title: 'Ansab al-Asyraf', ar: 'أنساب الأشراف', author: 'al-Baladzuri (w. 279 H)', use: 'Sejarah tokoh-tokoh Quraisy disusun menurut nasab.' },
]

export function GlossaryView() {
  const { g } = useStore()
  const [q, setQ] = useState('')
  const nq = normLat(q)
  const list = TERMS.filter((t) => !nq || normLat(`${t.term} ${t.def}`).includes(nq) || t.ar.includes(q))
  const groups = [...new Set(TERMS.map((t) => t.group))]
  const m = g.data.meta
  return (
    <div>
      <SectionTitle kicker="Glossary & References" title="Kamus Istilah & Biografi Klasik">
        Istilah-istilah ilmu nasab dan sejarah sahabat yang dipakai di aplikasi ini, beserta kitab-kitab rujukan aslinya yang dapat dibaca langsung di Turath.io.
      </SectionTitle>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari istilah: ashobah, nisbah, laqab, muakhah…"
            className="mb-4 w-full rounded-xl border border-krem-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-hijau-600"
          />
          {groups.map((grp) => {
            const items = list.filter((t) => t.group === grp)
            if (!items.length) return null
            return (
              <section key={grp} className="mb-6">
                <h2 className="mb-2 font-display text-2xl font-semibold text-hijau-900">{grp}</h2>
                <div className="space-y-3">
                  {items.map((t) => (
                    <article key={t.id} id={t.id} className="card p-4">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <h3 className="text-lg font-semibold text-hijau-800">{t.term}</h3>
                        <span className="ar text-xl text-emas-700">{t.ar}</span>
                      </div>
                      <p className="mt-1 text-sm leading-relaxed text-tinta">{t.def}</p>
                      {t.example && <p className="mt-2 rounded-lg bg-krem-100 px-3 py-2 text-sm text-tinta-soft">Contoh: {t.example}</p>}
                      {t.ref && <p className="mt-2 text-xs text-emas-700">Rujukan: {t.ref}</p>}
                    </article>
                  ))}
                </div>
              </section>
            )
          })}
        </div>
        <aside className="space-y-4">
          <div className="card p-4">
            <h2 className="font-display text-2xl font-semibold text-hijau-900">Kitab rujukan</h2>
            <p className="mb-3 text-xs text-tinta-soft">Tautan membuka teks kitab di app.turath.io.</p>
            <ul className="space-y-3">
              {BOOKS.map((b) => (
                <li key={b.id} className="rounded-xl border border-krem-200 bg-white/70 p-3">
                  <a href={`https://app.turath.io/book/${b.id}`} target="_blank" rel="noreferrer" className="group block">
                    <span className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-hijau-800 group-hover:underline">{b.title}</span>
                      <Icon name="external" className="mt-1 h-3.5 w-3.5 shrink-0 text-tinta-soft" />
                    </span>
                    <span className="ar block text-lg text-emas-700">{b.ar}</span>
                    <span className="block text-xs text-tinta-soft">{b.author}</span>
                  </a>
                  <p className="mt-1 text-xs leading-relaxed text-tinta">{b.use}</p>
                </li>
              ))}
            </ul>
          </div>
          <div className="card p-4">
            <h2 className="font-display text-2xl font-semibold text-hijau-900">Tentang data</h2>
            <p className="mt-1 text-sm leading-relaxed text-tinta">{m.source}</p>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
              {Object.entries(m.counts).map(([k, v]) => (
                <div key={k} className="rounded-lg bg-krem-100 px-3 py-2">
                  <dt className="text-[11px] tracking-wide text-tinta-soft uppercase">{k}</dt>
                  <dd className="text-lg font-semibold text-hijau-800">{v.toLocaleString('id-ID')}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-xs text-tinta-soft">Diperbarui: {m.generated}</p>
          </div>
        </aside>
      </div>
    </div>
  )
}
