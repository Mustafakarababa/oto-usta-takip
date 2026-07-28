import Dexie from 'dexie';

// 1. Veritabanımızı oluşturuyoruz (Tarayıcı hafızasında bu isimle tutulacak)
export const db = new Dexie('UstaTakipDB');

// 2. Tablolarımızı (Stores) ve sütunlarımızı tanımlıyoruz
db.version(1).stores({
  // Araçlar tablosu: Hızlı arama yapmak için 'plaka' sütununu özellikle belirttik.
  araclar: '++id, plaka, sonGelisTarihi, musteriTelefon',

  // İşlemler tablosu: Hangi araca, hangi tarihte ne yapıldığını ve kilometreyi tutar.
  islemler: '++id, plaka, tarih, kilometre, yapilanIslemler, notlar'
});