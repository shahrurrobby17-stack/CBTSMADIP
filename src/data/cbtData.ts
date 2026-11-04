import { ExamPackage, Question, StudentAnswer } from '../types/cbt';

export const DEFAULT_EXAM_TOKEN = 'XKPTZW';

export const INITIAL_EXAM_PACKAGES: ExamPackage[] = [
  {
    id: 'tka-sma-litnum',
    code: 'BIN-SAS-01',
    title: 'Bahasa Indonesia & Literasi Membaca',
    level: 'SMA / MA / SMK / Sederajat',
    subtest: 'Literasi Membaca & Teks Informasi',
    durationMinutes: 90,
    questions: [
      {
        id: 'q1',
        number: 1,
        type: 'pilihan_ganda',
        category: 'Literasi Membaca - Teks Informasi',
        stimulusTitle: 'Transisi Energi Bersih dan Potensi Panas Bumi Nusantara',
        stimulusText:
          'Indonesia terletak di jalur Cincin Api Pasifik (Ring of Fire) yang memberikan anugerah sumber daya panas bumi (geotermal) sekitar 23,7 gigawatt (GW) atau hampir 40% dari total cadangan panas bumi dunia. Berbeda dengan energi surya dan angin yang bersifat intermiten (bergantung pada cuaca dan waktu), pembangkit listrik tenaga panas bumi (PLTP) mampu beroperasi secara terus-menerus selama 24 jam sebagai beban dasar (baseload) dengan faktor kapasitas mencapai 85% hingga 95%.\n\nMeskipun potensinya sangat besar, kapasitas terpasang PLTP nasional hingga akhir tahun 2025 baru mencapai sekitar 2,6 GW atau sekitar 11% dari total potensi yang tersedia. Tantangan utama pengembangan geotermal meliputi tingginya risiko eksplorasi pada tahap pengeboran awal, kebutuhan investasi modal yang besar di muka, serta lokasi sumber panas bumi yang kerap berada di kawasan hutan konservasi atau pegunungan terpencil.',
        stimulusSource: 'Diadaptasi dari Laporan Kajian Transisi Energi Nasional, Kementerian ESDM (2025)',
        questionText:
          'Berdasarkan wacana di atas, mengapa energi panas bumi dinilai memiliki keunggulan strategis dibandingkan energi surya dan angin dalam menjaga keandalan jaringan listrik nasional?',
        instructionText: 'Pilih satu jawaban yang paling tepat!',
        options: [
          {
            id: 'A',
            text: 'Biaya pengeboran awal energi panas bumi jauh lebih murah dibandingkan pemasangan panel surya skala besar.',
          },
          {
            id: 'B',
            text: 'Pembangkit panas bumi dapat menyuplai listrik secara stabil sepanjang hari tanpa bergantung pada kondisi cuaca.',
          },
          {
            id: 'C',
            text: 'Kapasitas terpasang panas bumi Indonesia sudah melampaui 50% dari total cadangan nasional yang ada.',
          },
          {
            id: 'D',
            text: 'Lokasi sumber panas bumi selalu berada di pusat kawasan industri perkotaan sehingga bebas biaya transmisi.',
          },
          {
            id: 'E',
            text: 'Pembangkit panas bumi sama sekali tidak memerlukan kegiatan eksplorasi geologi sebelum pembangunan konstruksi.',
          },
        ],
        correctOptionId: 'B',
        points: 10,
        explanation:
          'Dalam paragraf pertama disebutkan bahwa berbeda dengan energi surya dan angin yang bersifat intermiten (bergantung cuaca dan waktu), PLTP mampu beroperasi terus-menerus selama 24 jam sebagai beban dasar (baseload) dengan faktor kapasitas 85%–95%.',
      },
      {
        id: 'q2',
        number: 2,
        type: 'pilihan_ganda_kompleks',
        category: 'Literasi Membaca - Analisis Kebijakan',
        stimulusTitle: 'Transisi Energi Bersih dan Potensi Panas Bumi Nusantara',
        stimulusText:
          'Pemerintah tengah menyusun skema insentif pembiayaan eksplorasi (geothermal de-risking facility) untuk membantu menyerap risiko kegagalan pengeboran awal bersama badan usaha. Selain itu, pemanfaatan teknologi binary cycle memungkinkan uap bersuhu menengah tetap dapat dikonversi menjadi energi listrik secara efisien tanpa membuka lahan baru yang luas di sekitar kawasan hutan.',
        stimulusTable: {
          title: 'Tabel Perbandingan Karakteristik Pembangkit Energi Terbarukan',
          headers: ['Jenis Pembangkit', 'Faktor Kapasitas (%)', 'Risiko Eksplorasi Awal', 'Ketersediaan 24 Jam'],
          rows: [
            ['PLTP (Panas Bumi)', '85% - 95%', 'Tinggi', 'Ya (Baseload)'],
            ['PLTS (Surya Fotovoltaik)', '18% - 24%', 'Rendah', 'Tidak (Siang Hari)'],
            ['PLTB (Bayu / Angin)', '28% - 40%', 'Sedang', 'Tidak (Fluktuatif)'],
            ['PLTA (Air Waduk)', '45% - 65%', 'Sedang', 'Ya (Tergantung Musim)'],
          ],
          caption: 'Sumber: Pusat Data Energi Terbarukan (2025)',
        },
        questionText:
          'Manakah pernyataan yang TEPAT mengenai strategi percepatan dan karakteristik pengembangan energi terbarukan berdasarkan informasi tersebut?',
        instructionText: 'Pilih lebih dari satu jawaban yang benar! (Pilihan Ganda Kompleks)',
        options: [
          {
            id: 'A',
            text: 'Fasilitas pembagian risiko eksplorasi (de-risking) bertujuan mengatasi hambatan tingginya risiko pada tahap pengeboran awal PLTP.',
          },
          {
            id: 'B',
            text: 'PLTS memiliki faktor kapasitas tahunan yang lebih tinggi dibandingkan PLTA Air Waduk maupun PLTB.',
          },
          {
            id: 'C',
            text: 'Teknologi binary cycle membantu pemanfaatan sumber panas bersuhu menengah sekaligus menekan kebutuhan pembukaan lahan baru.',
          },
          {
            id: 'D',
            text: 'Sekitar 89% potensi panas bumi Indonesia saat ini masih belum dimanfaatkan menjadi kapasitas pembangkit terpasang.',
          },
        ],
        correctOptionIds: ['A', 'C', 'D'],
        points: 10,
        explanation:
          'Pernyataan A, C, dan D benar. Kapasitas terpasang baru ~11%, sehingga ~89% belum termanfaatkan. Pernyataan B salah karena faktor kapasitas PLTS (18%–24%) lebih rendah daripada PLTB (28%–40%) dan PLTA (45%–65%).',
      },
      {
        id: 'q3',
        number: 3,
        type: 'benar_salah',
        category: 'Numerasi - Statistika & Data',
        stimulusTitle: 'Produktivitas Panen Padi dengan Sistem Irigasi Presisi',
        stimulusText:
          'Balai Penyuluhan Pertanian Kabupaten Subang melakukan uji coba penggunaan sensor kelembapan tanah otomatis (IoT Irigasi Presisi) pada 4 kelompok tani selama dua musim tanam. Berikut adalah data rata-rata hasil panen gabah kering giling (ton/hektare) dan konsumsi air irigasi:',
        stimulusTable: {
          title: 'Data Hasil Panen dan Efisiensi Air Kelompok Tani (2025)',
          headers: ['Kelompok Tani', 'Luas Lahan (Ha)', 'Panen Sebelum IoT (Ton/Ha)', 'Panen Sesudah IoT (Ton/Ha)', 'Penghematan Air (%)'],
          rows: [
            ['Mekar Jaya', '15', '5,2', '6,4', '28%'],
            ['Tani Makmur', '20', '5,5', '6,5', '25%'],
            ['Subur Lestari', '10', '4,8', '6,0', '32%'],
            ['Harapan Baru', '25', '5,0', '5,8', '22%'],
          ],
        },
        questionText:
          'Tentukan apakah setiap pernyataan analisis numerasi berikut Benar atau Salah berdasarkan tabel data hasil uji coba di atas!',
        instructionText: 'Klik pilihan "Benar" atau "Salah" pada setiap baris pernyataan!',
        trueLabel: 'Benar',
        falseLabel: 'Salah',
        statements: [
          {
            id: 's1',
            statement: 'Kelompok Tani Mekar Jaya dan Subur Lestari mengalami kenaikan hasil panen per hektare yang sama besar, yaitu 1,2 ton/Ha.',
            correctValue: 'Benar',
          },
          {
            id: 's2',
            statement: 'Total seluruh gabah yang dihasilkan Kelompok Tani Makmur setelah menggunakan IoT pada seluruh lahannya adalah 110 ton.',
            correctValue: 'Salah',
          },
          {
            id: 's3',
            statement: 'Persentase kenaikan hasil panen per hektare tertinggi dicapai oleh Kelompok Tani Subur Lestari, yaitu sebesar 25%.',
            correctValue: 'Benar',
          },
        ],
        points: 10,
        explanation:
          '1) Mekar Jaya: 6,4 - 5,2 = 1,2 ton/Ha; Subur Lestari: 6,0 - 4,8 = 1,2 ton/Ha (Benar). 2) Tani Makmur memiliki 20 Ha x 6,5 ton/Ha = 130 ton, bukan 110 ton (Salah). 3) Kenaikan Subur Lestari = (1,2 / 4,8) x 100% = 25%, tertinggi di antara kelompok lain (Benar).',
      },
      {
        id: 'q4',
        number: 4,
        type: 'menjodohkan',
        category: 'Literasi Sains & Lingkungan',
        stimulusTitle: 'Mekanisme Adaptasi Tumbuhan pada Ekosistem Ekstrem',
        stimulusText:
          'Setiap bioma memiliki tekanan lingkungan yang khas, mulai dari gurun pasir yang sangat kering, rawa pasang surut yang miskin oksigen terlarut di dalam lumpur, hingga perairan tenang. Tumbuhan mengembangkan modifikasi organ vegetatif (akar, batang, dan daun) untuk mempertahankan kelangsungan hidup dan keseimbangan fisiologisnya.',
        questionText:
          'Pasangkan jenis tumbuhan atau kelompok ekologi di sebelah kiri (Premis) dengan bentuk adaptasi fisiologis/morfologis yang paling tepat di sebelah kanan (Respon)!',
        instructionText: 'Klik salah satu kotak pada kolom Premis lalu klik pasangan yang sesuai pada kolom Respon!',
        premises: [
          { id: 'p1', text: 'Tumbuhan Xerofit (contoh: Kaktus Gurun)' },
          { id: 'p2', text: 'Tumbuhan Mangrove (contoh: Avicennia / Bakau)' },
          { id: 'p3', text: 'Tumbuhan Hidrofit (contoh: Teratai / Nymphaea)' },
        ],
        responses: [
          { id: 'r1', text: 'Memiliki daun lebar dan tipis dengan stomata yang banyak tersebar di permukaan atas epidermis untuk mempercepat transpirasi.' },
          { id: 'r2', text: 'Memiliki akar napas (pneumatofora) dan kelenjar ekskresi garam untuk bertahan di substrat berlumpur anaerob.' },
          { id: 'r3', text: 'Daun termodifikasi menjadi duri, berlapis kutikula tebal, serta batang sukulen penyimpan cadangan air.' },
          { id: 'r4', text: 'Menggugurkan seluruh akarnya saat musim hujan untuk menghentikan penyerapan unsur hara mikro.' },
        ],
        correctPairs: {
          p1: 'r3',
          p2: 'r2',
          p3: 'r1',
        },
        points: 10,
        explanation:
          'Xerofit (Kaktus) memiliki daun berbentuk duri dan batang sukulen (r3). Mangrove memiliki akar napas pneumatofora (r2). Hidrofit (Teratai) memiliki daun lebar tipis dengan stomata di permukaan atas (r1).',
      },
      {
        id: 'q5',
        number: 5,
        type: 'isian_singkat',
        category: 'Numerasi - Aljabar & Aritmetika Sosial',
        stimulusTitle: 'Program Subsidi Kendaraan Listrik Koperasi Sekolah',
        stimulusText:
          'Koperasi Guru dan Karyawan SMA Negeri 1 Nusantara membeli sejumlah unit sepeda motor listrik untuk operasional kurir perpustakaan keliling. Harga awal satu unit motor listrik sebelum subsidi adalah Rp22.000.000,00.\n\nPemerintah memberikan subsidi potongan langsung sebesar Rp7.000.000,00 per unit. Selain itu, dealer memberikan diskon tambahan sebesar 10% yang dihitung dari harga setelah dikurangi subsidi pemerintah.',
        stimulusHighlightBox: 'Rumus Harga Akhir = (Harga Awal − Subsidi Pemerintah) × (100% − % Diskon Dealer)',
        questionText:
          'Berapa juta rupiah biaya yang harus dibayarkan koperasi untuk membeli 2 unit sepeda motor listrik tersebut setelah mendapatkan subsidi dan diskon dealer? (Tuliskan angkanya saja dalam satuan juta, contoh: 25)',
        instructionText: 'Ketikkan jawaban berupa angka bulat pada kotak yang tersedia!',
        correctShortAnswers: ['27', '27 juta', '27.000.000', '27000000'],
        placeholder: 'Ketik jawaban angka (misal: 27)',
        points: 10,
        explanation:
          'Harga setelah subsidi = Rp22.000.000 - Rp7.000.000 = Rp15.000.000 per unit. Diskon dealer 10% dari Rp15.000.000 = Rp1.500.000. Maka harga bersih 1 unit = Rp13.500.000. Untuk 2 unit: 2 x Rp13.500.000 = Rp27.000.000 (27 juta rupiah).',
      },
      {
        id: 'q6',
        number: 6,
        type: 'pilihan_ganda',
        category: 'Literasi Membaca - Teks Sastra',
        stimulusTitle: 'Senja di Pelabuhan Kayu',
        stimulusText:
          '"Lihatlah perahu-perahu tua yang ditambatkan di dermaga itu, Damar," ujar Kakek Sulaiman sambil menunjuk ke arah garis cakrawala yang memerah. "Kayu jatinya penuh goresan karang dan catnya telah mengelupas dihantam gelombang musim barat. Namun, tak satu pun nelayan di kampung ini berani menyebutnya rongsokan. Setiap bilah papan di lambung perahu itu menyimpan ingatan tentang badai yang berhasil dilewati demi sepiring nasi hangat di meja makan keluarga."\n\nDamar menatap buku sketsa di pangkuannya. Selama ini ia selalu malu memperlihatkan lukisan tangannya yang belum sempurna kepada teman-temannya di kota. Angin laut sore itu seolah membisikkan sesuatu yang baru ke dalam hatinya.',
        stimulusSource: 'Kutipan Cerpen "Dermaga Angin Barat" karya R. Pramudya (2024)',
        questionText:
          'Makna simbolis dari "perahu tua yang penuh goresan karang" dalam kutipan cerpen tersebut adalah...',
        instructionText: 'Pilih satu jawaban yang paling tepat!',
        options: [
          {
            id: 'A',
            text: 'Ketidakpedulian masyarakat pesisir terhadap pemeliharaan sarana transportasi laut tradisional.',
          },
          {
            id: 'B',
            text: 'Ketangguhan dan nilai perjuangan hidup yang ditempa melalui berbagai ujian serta ketidaksempurnaan.',
          },
          {
            id: 'C',
            text: 'Kemunduran ekonomi nelayan tradisional akibat kalah bersaing dengan kapal mesin modern.',
          },
          {
            id: 'D',
            text: 'Keinginan generasi muda untuk meninggalkan kampung halaman demi mengejar pendidikan seni di kota.',
          },
          {
            id: 'E',
            text: 'Bahaya melaut pada musim angin barat yang selalu merusak seluruh kapal di dermaga.',
          },
        ],
        correctOptionId: 'B',
        points: 10,
        explanation:
          'Perahu tua penuh goresan karang melambangkan ketangguhan, pengorbanan, dan nilai berharga dari proses perjuangan meskipun tampak tidak sempurna dari luar—yang menginspirasi Damar agar tidak malu terhadap proses belajarnya.',
      },
      {
        id: 'q7',
        number: 7,
        type: 'pilihan_ganda',
        category: 'Numerasi - Geometri & Pengukuran',
        stimulusTitle: 'Desain Taman Baca Berbentuk Trapesium',
        stimulusText:
          'OSIS SMA Harapan Bangsa merancang taman baca terbuka di halaman tengah sekolah. Lahan taman tersebut berbentuk trapesium siku-siku dengan panjang sisi sejajar masing-masing 12 meter dan 18 meter, serta jarak tegak lurus (tinggi) antara kedua sisi sejajar adalah 8 meter.\n\nDi bagian tengah taman akan dibangun kolam ikan berbentuk lingkaran dengan jari-jari 3,5 meter (gunakan π = 22/7), sedangkan sisa luas lahan taman akan ditanami rumput gajah mini.',
        questionText:
          'Berapakah luas lahan taman baca yang akan ditanami rumput gajah mini di luar area kolam ikan?',
        instructionText: 'Pilih satu jawaban yang paling tepat!',
        options: [
          { id: 'A', text: '74,5 m²' },
          { id: 'B', text: '81,5 m²' },
          { id: 'C', text: '88,5 m²' },
          { id: 'D', text: '96,0 m²' },
          { id: 'E', text: '120,0 m²' },
        ],
        correctOptionId: 'B',
        points: 10,
        explanation:
          'Luas trapesium = ½ × (12 + 18) × 8 = ½ × 30 × 8 = 120 m². Luas kolam lingkaran = π × r² = (22/7) × 3,5 × 3,5 = 38,5 m². Luas rumput = 120 − 38,5 = 81,5 m².',
      },
      {
        id: 'q8',
        number: 8,
        type: 'benar_salah',
        category: 'Literasi Membaca - Evaluasi Informasi Digital',
        stimulusTitle: 'Indeks Literasi Digital dan Keamanan Siber Pelajar',
        stimulusText:
          'Survei Nasional Literasi Digital 2025 terhadap 2.400 siswa tingkat menengah menunjukkan bahwa 88% responden telah terbiasa menggunakan autentikasi dua faktor (2FA) pada akun surat elektronik mereka. Namun, hanya 42% siswa yang melakukan verifikasi silang terhadap sumber berita sebelum membagikan ulang informasi kesehatan di grup pesan instan.\n\nLaporan tersebut juga mencatat bahwa siswa yang mengikuti ekstrakurikuler jurnalistik atau klub debat memiliki tingkat ketahanan terhadap berita bohong (hoaks) 2,3 kali lebih tinggi dibandingkan siswa yang tidak pernah mendapatkan pelatihan verifikasi fakta.',
        questionText:
          'Berdasarkan hasil survei di atas, tentukan apakah simpulan berikut Sesuai atau Tidak Sesuai dengan isi teks!',
        instructionText: 'Klik pilihan pada setiap pernyataan di bawah ini!',
        trueLabel: 'Sesuai',
        falseLabel: 'Tidak Sesuai',
        statements: [
          {
            id: 's8_1',
            statement: 'Mayoritas siswa sudah memiliki kesadaran keamanan akun melalui penggunaan autentikasi dua faktor (2FA), tetapi lebih dari separuh siswa masih belum terbiasa memverifikasi sumber berita sebelum membagikannya.',
            correctValue: 'Benar',
          },
          {
            id: 's8_2',
            statement: 'Sebanyak 88% siswa tingkat menengah selalu memeriksa kebenaran berita kesehatan sebelum meneruskannya di grup pesan instan.',
            correctValue: 'Salah',
          },
          {
            id: 's8_3',
            statement: 'Keterlibatan aktif siswa dalam kegiatan jurnalistik atau debat berkorelasi positif dengan kemampuan menangkal berita bohong.',
            correctValue: 'Benar',
          },
        ],
        points: 10,
        explanation:
          'Pernyataan 1 Sesuai (88% pakai 2FA, hanya 42% verifikasi berita sehingga 58% belum). Pernyataan 2 Tidak Sesuai (88% adalah pengguna 2FA, bukan pemeriksa berita). Pernyataan 3 Sesuai (ketahanan 2,3 kali lebih tinggi).',
      },
      {
        id: 'q9',
        number: 9,
        type: 'pilihan_ganda_kompleks',
        category: 'Numerasi - Peluang & Kombinatorika',
        stimulusTitle: 'Pengundian Delegasi Lomba Karya Ilmiah Remaja',
        stimulusText:
          'Tim Olimpiade Sains SMA Bina Cendekia terdiri atas 5 siswa kelas XI (3 putra dan 2 putri) serta 5 siswa kelas XII (2 putra dan 3 putri). Kepala sekolah akan memilih 1 orang ketua delegasi secara acak dari keseluruhan 10 anggota tim tersebut.',
        questionText:
          'Manakah di antara pernyataan peluang berikut yang bernilai BENAR?',
        instructionText: 'Pilih lebih dari satu jawaban yang benar!',
        options: [
          {
            id: 'A',
            text: 'Peluang terpilihnya siswa putra dan peluang terpilihnya siswa putri dari seluruh anggota tim adalah sama besar, yaitu 1/2.',
          },
          {
            id: 'B',
            text: 'Peluang terpilihnya siswa kelas XI putra adalah 3/10.',
          },
          {
            id: 'C',
            text: 'Peluang terpilihnya siswa kelas XII putri lebih kecil daripada peluang terpilihnya siswa kelas XII putra.',
          },
          {
            id: 'D',
            text: 'Jika ketua delegasi harus dipilih dari kelas XII saja, maka peluang terpilihnya siswa putri adalah 3/5.',
          },
        ],
        correctOptionIds: ['A', 'B', 'D'],
        points: 10,
        explanation:
          'Total putra = 3 + 2 = 5 orang (5/10 = 1/2), total putri = 2 + 3 = 5 orang (5/10 = 1/2) -> A benar. Kelas XI putra = 3 dari 10 -> B benar. Kelas XII putri (3) lebih besar dari kelas XII putra (2) -> C salah. Dari 5 siswa kelas XII, 3 adalah putri sehingga peluangnya 3/5 -> D benar.',
      },
      {
        id: 'q10',
        number: 10,
        type: 'isian_singkat',
        category: 'Numerasi - Rasio & Kecepatan',
        stimulusTitle: 'Kereta Cepat Jakarta–Bandung (Whoosh)',
        stimulusText:
          'Kereta cepat menempuh jarak lintasan stasiun Halim menuju stasiun Tegalluar sejauh 140 km. Pada segmen perjalanan pertama sejauh 50 km, kereta melaju dengan kecepatan rata-rata 200 km/jam. Pada segmen perjalanan sisanya (90 km), kereta meningkatkan kecepatan rata-ratanya menjadi 300 km/jam.',
        stimulusHighlightBox: 'Waktu Tempuh (t) = Jarak (s) / Kecepatan (v) | 1 Jam = 60 Menit',
        questionText:
          'Berapa menit total waktu perjalanan kereta cepat tersebut dari Halim hingga Tegalluar tanpa menghitung waktu berhenti di stasiun antara? (Tuliskan angkanya saja dalam satuan menit)',
        instructionText: 'Ketikkan angka jawaban dalam satuan menit!',
        correctShortAnswers: ['33', '33 menit'],
        placeholder: 'Ketik angka dalam menit (misal: 33)',
        points: 10,
        explanation:
          'Segmen 1: t₁ = 50 / 200 = 0,25 jam = 15 menit. Segmen 2: t₂ = 90 / 300 = 0,30 jam = 18 menit. Total waktu perjalanan = 15 + 18 = 33 menit.',
      },
    ],
  },
  {
    id: 'tka-sains-kuantitatif',
    code: 'TKA-SAINS-02',
    title: 'Simulasi TKA - Matematika Lanjut & Penalaran Sains',
    level: 'SMA / MA / SMK / Sederajat',
    subtest: 'Penalaran Kuantitatif & Sains Terpadu',
    durationMinutes: 45,
    questions: [
      {
        id: 'sq1',
        number: 1,
        type: 'pilihan_ganda',
        category: 'Fisika Terapan - Energi & Daya Listrik',
        stimulusTitle: 'Efisiensi Panel Surya Atap Sekolah',
        stimulusText:
          'Laboratorium Fisika memasang 8 modul panel surya identik di atap gedung sekolah. Setiap modul memiliki luas permukaan efektif 2 m² dan efisiensi konversi energi sebesar 20%. Pada siang hari yang cerah, intensitas radiasi matahari rata-rata yang jatuh tegak lurus pada permukaan panel adalah 1.000 Watt/m² selama 5 jam efektif.',
        questionText:
          'Berapa kilowatt-jam (kWh) total energi listrik yang dihasilkan oleh ke-8 modul panel surya tersebut dalam satu hari?',
        instructionText: 'Pilih satu jawaban yang paling tepat!',
        options: [
          { id: 'A', text: '8,0 kWh' },
          { id: 'B', text: '12,0 kWh' },
          { id: 'C', text: '16,0 kWh' },
          { id: 'D', text: '20,0 kWh' },
          { id: 'E', text: '32,0 kWh' },
        ],
        correctOptionId: 'C',
        points: 20,
        explanation:
          'Total luas 8 panel = 8 × 2 m² = 16 m². Daya keluar (output) = 16 m² × 1.000 W/m² × 20% = 3.200 Watt = 3,2 kW. Energi selama 5 jam = 3,2 kW × 5 jam = 16,0 kWh.',
      },
      {
        id: 'sq2',
        number: 2,
        type: 'benar_salah',
        category: 'Biologi & Kimia Lingkungan',
        stimulusTitle: 'Kadar Oksigen Terlarut (DO) dan Kualitas Air Sungai',
        stimulusText:
          'Tim peneliti siswa mengukur parameter kualitas air di tiga titik aliran Sungai Citarum: Hulu (Titik A), Kawasan Pemukiman Padat (Titik B), dan Hilir setelah Instalasi Pengolahan Air Limbah/IPAL (Titik C).',
        stimulusTable: {
          title: 'Hasil Pengukuran Parameter Kualitas Air Sungai',
          headers: ['Titik Pantau', 'Suhu (°C)', 'pH Air', 'DO / Oksigen Terlarut (mg/L)', 'BOD (mg/L)'],
          rows: [
            ['Titik A (Hulu Pegunungan)', '21', '7,2', '8,4', '1,5'],
            ['Titik B (Pemukiman Padat)', '28', '5,8', '3,1', '14,2'],
            ['Titik C (Hilir Pasca-IPAL)', '25', '6,9', '6,5', '3,4'],
          ],
        },
        questionText:
          'Tentukan apakah setiap pernyataan analisis ilmiah berikut Benar atau Salah!',
        instructionText: 'Klik pilihan Benar atau Salah pada setiap baris!',
        trueLabel: 'Benar',
        falseLabel: 'Salah',
        statements: [
          {
            id: 'ss1',
            statement: 'Tingginya nilai BOD (Biological Oxygen Demand) di Titik B menunjukkan tingginya kandungan bahan organik yang diuraikan mikroorganisme sehingga menurunkan oksigen terlarut (DO).',
            correctValue: 'Benar',
          },
          {
            id: 'ss2',
            statement: 'Air sungai pada Titik B bersifat lebih basa dibandingkan air sungai pada Titik A.',
            correctValue: 'Salah',
          },
          {
            id: 'ss3',
            statement: 'Instalasi Pengolahan Air Limbah (IPAL) berhasil memulihkan kualitas air di Titik C yang ditandai dengan kenaikan DO dan penurunan BOD.',
            correctValue: 'Benar',
          },
        ],
        points: 20,
        explanation:
          'BOD tinggi di Titik B (14,2 mg/L) berbanding terbalik dengan DO (3,1 mg/L). pH 5,8 di Titik B bersifat asam (bukan basa). Di Titik C kualitas air membaik setelah melewati IPAL.',
      },
      {
        id: 'sq3',
        number: 3,
        type: 'pilihan_ganda_kompleks',
        category: 'Penalaran Kuantitatif - Fungsi & Pertumbuhan',
        stimulusTitle: 'Kultur Bakteri Pengurai Plastik (Ideonella sakaiensis)',
        stimulusText:
          'Di dalam bioreaktor tertutup, populasi bakteri pengurai plastik PET berkembang biak menjadi 2 kali lipat setiap 3 jam pada fase logaritmik. Pada pukul 06.00 WIB, peneliti memasukkan populasi awal sebanyak 500 koloni unit pembentuk (CFU/mL).',
        questionText:
          'Manakah pernyataan perhitungan berikut yang BENAR mengenai jumlah populasi bakteri di dalam bioreaktor?',
        instructionText: 'Pilih lebih dari satu jawaban yang benar!',
        options: [
          {
            id: 'A',
            text: 'Pada pukul 12.00 WIB di hari yang sama, populasi bakteri mencapai 2.000 CFU/mL.',
          },
          {
            id: 'B',
            text: 'Rumus pertumbuhan populasi setelah t jam adalah N(t) = 500 × 2^(t/3).',
          },
          {
            id: 'C',
            text: 'Pada pukul 18.00 WIB di hari yang sama, populasi bakteri telah mencapai 16.000 CFU/mL.',
          },
          {
            id: 'D',
            text: 'Dalam waktu 9 jam pertama, populasi bakteri bertambah sebanyak 3.500 CFU/mL dari jumlah awalnya.',
          },
        ],
        correctOptionIds: ['A', 'B', 'D'],
        points: 20,
        explanation:
          'Pukul 12.00 (6 jam = 2 periode): 500 × 2² = 2.000 (A benar). Rumus N(t) = 500 × 2^(t/3) (B benar). Pukul 18.00 (12 jam = 4 periode): 500 × 2⁴ = 8.000, bukan 16.000 (C salah). Setelah 9 jam (3 periode): N(9) = 500 × 8 = 4.000, sehingga pertambahannya = 4.000 − 500 = 3.500 CFU/mL (D benar).',
      },
      {
        id: 'sq4',
        number: 4,
        type: 'menjodohkan',
        category: 'Kimia & Fisika Zat',
        stimulusTitle: 'Penerapan Sifat Koligatif dan Gelombang Elektromagnetik',
        stimulusText:
          'Konsep sains terapan digunakan secara luas dalam teknologi medis, transportasi, dan pengawetan bahan pangan.',
        questionText:
          'Pasangkan fenomena atau aplikasi teknologi di kolom kiri (Premis) dengan prinsip ilmiah yang mendasarinya di kolom kanan (Respon)!',
        instructionText: 'Klik item pada kolom Premis lalu klik pasangan yang sesuai di kolom Respon!',
        premises: [
          { id: 'sp1', text: 'Penaburan garam dapur (NaCl) untuk mencairkan salju di jalan raya' },
          { id: 'sp2', text: 'Proses desalinasi air laut menjadi air tawar melalui membran semipermeabel bertekanan tinggi' },
          { id: 'sp3', text: 'Sterilisasi alat bedah medis dan deteksi keaslian uang kertas' },
        ],
        responses: [
          { id: 'sr1', text: 'Pemanfaatan radiasi Sinar Ultraviolet (UV) berenergi foton tinggi' },
          { id: 'sr2', text: 'Prinsip penurunan titik beku larutan (ΔTf) akibat penambahan zat terlarut non-volatil' },
          { id: 'sr3', text: 'Prinsip Osmosis Balik (Reverse Osmosis) yang melawan tekanan osmotik alami' },
          { id: 'sr4', text: 'Efek Doppler pada gelombang ultrasonik frekuensi rendah' },
        ],
        correctPairs: {
          sp1: 'sr2',
          sp2: 'sr3',
          sp3: 'sr1',
        },
        points: 20,
        explanation:
          'Penaburan garam menurunkan titik beku air (sr2). Desalinasi membran bertekanan tinggi adalah Reverse Osmosis (sr3). Sterilisasi dan deteksi uang menggunakan Sinar UV (sr1).',
      },
      {
        id: 'sq5',
        number: 5,
        type: 'isian_singkat',
        category: 'Fisika - Kinematika Gerak Lurus',
        stimulusTitle: 'Uji Pengereman Otomatis Kendaraan Otonom',
        stimulusText:
          'Sebuah mobil listrik otonom sedang melaju dengan kecepatan tetap 20 m/s di lintasan uji. Ketika sensor LiDAR mendeteksi rintangan statis, sistem pengereman darurat langsung bekerja memberikan perlambatan konstan sebesar 4 m/s² hingga mobil berhenti sempurna.',
        stimulusHighlightBox: 'Rumus GLBB: v_t² = v_0² − 2 · a · s',
        questionText:
          'Berapa meter jarak pengereman yang ditempuh mobil sejak rem bekerja hingga berhenti tepat di tempat? (Tuliskan angkanya saja)',
        instructionText: 'Ketikkan angka jawaban dalam satuan meter!',
        correctShortAnswers: ['50', '50 m', '50 meter'],
        placeholder: 'Ketik angka dalam meter (misal: 50)',
        points: 20,
        explanation:
          'Saat berhenti v_t = 0. Maka 0² = 20² − 2(4)s → 8s = 400 → s = 50 meter.',
      },
    ],
  },
  {
    id: 'mat-sas-01',
    code: 'MAT-SAS-01',
    title: 'Matematika Wajib & Numerasi',
    level: 'SMA / MA / SMK / Sederajat',
    subtest: 'Aljabar, Geometri & Statistika Terapan',
    durationMinutes: 90,
    questions: [
      {
        id: 'qm1',
        number: 1,
        type: 'pilihan_ganda',
        category: 'Matematika - Aljabar & Fungsi',
        stimulusTitle: 'Model Pertumbuhan Nilai Investasi Saham dan Bunga Majemuk',
        stimulusText:
          'Seorang investor pemula menanamkan modal sebesar Rp 10.000.000 pada instrumen reksa dana pendapatan tetap dengan imbal hasil majemuk tahunan sebesar 8% per tahun.',
        questionText:
          'Manakah ekspresi matematika yang benar untuk menghitung total saldo investasi setelah n tahun?',
        options: [
          { id: 'A', text: 'M_n = 10.000.000 · (1 + 0,08 · n)' },
          { id: 'B', text: 'M_n = 10.000.000 · (1 + 0,08)^n' },
          { id: 'C', text: 'M_n = 10.000.000 · (0,08)^n' },
          { id: 'D', text: 'M_n = 10.000.000 + 0,08^n' },
          { id: 'E', text: 'M_n = 10.000.000 / (1 + 0,08)^n' },
        ],
        correctOptionId: 'B',
        points: 25,
        explanation: 'Rumus bunga majemuk adalah M_n = M_0 · (1 + i)^n.',
      },
      {
        id: 'qm2',
        number: 2,
        type: 'pilihan_ganda',
        category: 'Matematika - Geometri Ruang',
        stimulusTitle: 'Konstruksi Kerangka Kubus Ruang Ujian',
        stimulusText:
          'Sebuah kubus ABCD.EFGH memiliki panjang rusuk 12 cm. Titik P terletak tepat di tengah rusuk CG.',
        questionText:
          'Berapakah jarak antara titik A ke titik P?',
        options: [
          { id: 'A', text: '18 cm' },
          { id: 'B', text: '15 cm' },
          { id: 'C', text: '6√5 cm' },
          { id: 'D', text: '12√2 cm' },
          { id: 'E', text: '14 cm' },
        ],
        correctOptionId: 'A',
        points: 25,
        explanation: 'AP = √(AC² + CP²) = √((12√2)² + 6²) = √(288 + 36) = √324 = 18 cm.',
      },
    ],
  },
  {
    id: 'big-sas-01',
    code: 'BIG-SAS-01',
    title: 'Bahasa Inggris & Literasi Digital',
    level: 'SMA / MA / SMK / Sederajat',
    subtest: 'Reading Comprehension & Critical Analysis',
    durationMinutes: 90,
    questions: [
      {
        id: 'qb1',
        number: 1,
        type: 'pilihan_ganda',
        category: 'English - Analytical Exposition',
        stimulusTitle: 'The Crucial Role of Artificial Intelligence in Contemporary Education',
        stimulusText:
          'Artificial Intelligence (AI) is transforming learning environments across the globe. By analyzing students learning habits and individual milestones, adaptive platforms provide targeted feedback and customized study trajectories.',
        questionText:
          'According to the passage, how does adaptive AI enhance individual student performance?',
        options: [
          { id: 'A', text: 'By replacing school teachers completely in curriculum design' },
          { id: 'B', text: 'By analyzing learning habits and providing tailored study trajectories' },
          { id: 'C', text: 'By standardizing identical test scores for all participants' },
          { id: 'D', text: 'By eliminating all computational examinations' },
          { id: 'E', text: 'By discouraging autonomous exploration of course materials' },
        ],
        correctOptionId: 'B',
        points: 25,
        explanation: 'The text states that AI platforms analyze learning habits and provide targeted feedback and customized study trajectories.',
      },
    ],
  },
];

export function isQuestionAnswered(question: Question, answer?: StudentAnswer): boolean {
  if (!answer) return false;
  switch (question.type) {
    case 'pilihan_ganda':
      return Boolean(answer.selectedOptionId);
    case 'pilihan_ganda_kompleks':
      return Boolean(answer.selectedOptionIds && answer.selectedOptionIds.length > 0);
    case 'benar_salah': {
      const totalStatements = question.statements?.length || 0;
      if (totalStatements === 0 || !answer.statementAnswers) return false;
      return Object.keys(answer.statementAnswers).length >= totalStatements;
    }
    case 'menjodohkan': {
      const totalPremises = question.premises?.length || 0;
      if (totalPremises === 0 || !answer.matchingPairs) return false;
      return Object.keys(answer.matchingPairs).length >= totalPremises;
    }
    case 'isian_singkat':
      return Boolean(answer.shortAnswer && answer.shortAnswer.trim().length > 0);
    default:
      return false;
  }
}

export function evaluateQuestionScore(
  question: Question,
  answer?: StudentAnswer
): { isCorrect: boolean; earnedPoints: number } {
  if (!answer) return { isCorrect: false, earnedPoints: 0 };

  switch (question.type) {
    case 'pilihan_ganda': {
      const isCorrect = answer.selectedOptionId === question.correctOptionId;
      return { isCorrect, earnedPoints: isCorrect ? question.points : 0 };
    }
    case 'pilihan_ganda_kompleks': {
      const selected = [...(answer.selectedOptionIds || [])].sort();
      const correct = [...(question.correctOptionIds || [])].sort();
      const isCorrect =
        selected.length === correct.length &&
        selected.every((val, idx) => val === correct[idx]);
      return { isCorrect, earnedPoints: isCorrect ? question.points : 0 };
    }
    case 'benar_salah': {
      const statements = question.statements || [];
      if (statements.length === 0) return { isCorrect: false, earnedPoints: 0 };
      const allCorrect = statements.every(
        (st) => answer.statementAnswers?.[st.id] === st.correctValue
      );
      return { isCorrect: allCorrect, earnedPoints: allCorrect ? question.points : 0 };
    }
    case 'menjodohkan': {
      const correctPairs = question.correctPairs || {};
      const keys = Object.keys(correctPairs);
      if (keys.length === 0) return { isCorrect: false, earnedPoints: 0 };
      const allMatched = keys.every(
        (pId) => answer.matchingPairs?.[pId] === correctPairs[pId]
      );
      return { isCorrect: allMatched, earnedPoints: allMatched ? question.points : 0 };
    }
    case 'isian_singkat': {
      const raw = (answer.shortAnswer || '').trim().toLowerCase();
      if (!raw) return { isCorrect: false, earnedPoints: 0 };
      const normalized = raw.replace(/,/g, '.');
      const accepted = (question.correctShortAnswers || []).map((a) =>
        a.trim().toLowerCase()
      );
      const isCorrect = accepted.includes(raw) || accepted.includes(normalized);
      return { isCorrect, earnedPoints: isCorrect ? question.points : 0 };
    }
    default:
      return { isCorrect: false, earnedPoints: 0 };
  }
}

export function getQuestionTypeLabel(type: Question['type']): string {
  switch (type) {
    case 'pilihan_ganda':
      return 'Pilihan Ganda';
    case 'pilihan_ganda_kompleks':
      return 'Pilihan Ganda Kompleks (MCMA)';
    case 'benar_salah':
      return 'Benar / Salah (Kategori)';
    case 'menjodohkan':
      return 'Menjodohkan';
    case 'isian_singkat':
      return 'Isian Singkat';
  }
}
