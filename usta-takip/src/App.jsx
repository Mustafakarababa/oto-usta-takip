import { useState, useEffect } from 'react';
import { db } from './db';

const HIZLI_ISLEMLER = [
  "Yağ Değişimi", "Periyodik Bakım", "Balata Değişimi", 
  "Triger Seti", "Filtreler", "Buji Değişimi"
];

const CLIENT_ID = '77349793674-1e9o7d3n73gias3eo3qv35q2r5foisp2.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/drive.appdata';

function App() {
  // Dükkan adı hafızada var mı kontrol ediyoruz
  const [dukkanAdi, setDukkanAdi] = useState(() => localStorage.getItem('usta_dukkan_adi') || '');
  const [ilkKurulum, setIlkKurulum] = useState(!localStorage.getItem('usta_dukkan_adi'));
  const [geciciDukkanAdi, setGeciciDukkanAdi] = useState('');

  const [plaka, setPlaka] = useState('');
  const [seciliArac, setSeciliArac] = useState(null);
  const [kilometre, setKilometre] = useState('');
  const [secilenButonlar, setSecilenButonlar] = useState([]); 
  const [notlar, setNotlar] = useState('');
  const [gecmisIslemler, setGecmisIslemler] = useState([]);
  const [dinliyor, setDinliyor] = useState(false);
  
  const [bildirim, setBildirim] = useState(null);
  const [tokenClient, setTokenClient] = useState(null);
  const [girisYapildi, setGirisYapildi] = useState(false);
  const [accessToken, setAccessToken] = useState(null);

  const gosterBildirim = (mesajMetni) => {
    setBildirim(mesajMetni);
    setTimeout(() => {
      setBildirim(null);
    }, 3000);
  };

  // İlk açılışta dükkan adını bir kereye mahsus kaydetme
  const ilkKurulumuTamamla = () => {
    if (!geciciDukkanAdi.trim()) {
      gosterBildirim("⚠️ Lütfen dükkan veya usta adı yazın!");
      return;
    }
    localStorage.setItem('usta_dukkan_adi', geciciDukkanAdi);
    setDukkanAdi(geciciDukkanAdi);
    setIlkKurulum(false);
    gosterBildirim("✅ Dükkan ayarlandı, iyi çalışmalar!");
  };

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.google) {
        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: SCOPES,
          callback: (response) => {
            if (response.access_token) {
              setAccessToken(response.access_token);
              setGirisYapildi(true);
            }
          },
        });
        setTokenClient(client);
      }
    };
    document.body.appendChild(script);
  }, []);

  useEffect(() => {
    if (girisYapildi && accessToken) {
      otomatikYedekKontrolu(accessToken);
    }
  }, [girisYapildi, accessToken]);

  const otomatikYedekKontrolu = async (token) => {
    const bugunTarihi = new Date().toLocaleDateString();
    const sonYedekTarihi = localStorage.getItem('son_otomatik_yedek');

    if (sonYedekTarihi !== bugunTarihi) {
      await driveYedekleSessiz(token);
      localStorage.setItem('son_otomatik_yedek', bugunTarihi);
    }
  };

  const driveYedekleSessiz = async (token) => {
    try {
      const araclarData = await db.araclar.toArray();
      const islemlerData = await db.islemler.toArray();
      const yedekPaketi = JSON.stringify({ araclar: araclarData, islemler: islemlerData });
      const file = new Blob([yedekPaketi], { type: 'application/json' });

      const metadata = {
        name: 'usta_takip_yedek.json',
        mimeType: 'application/json',
        parents: ['appDataFolder']
      };

      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', file);

      await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: new Headers({ 'Authorization': 'Bearer ' + token }),
        body: form,
      });
    } catch (error) {
      console.error("Otomatik yedekleme hatası:", error);
    }
  };

  const googleGirisYap = () => {
    if (tokenClient) {
      tokenClient.requestAccessToken();
    } else {
      gosterBildirim("Google servisleri yükleniyor, lütfen bekleyin.");
    }
  };

  const manuelYedekle = async () => {
    if (!girisYapildi || !accessToken) {
      gosterBildirim("⚠️ Önce Google hesabınızla giriş yapmalısınız!");
      return;
    }
    await driveYedekleSessiz(accessToken);
    gosterBildirim("☁️ Veriler başarıyla Google Drive'a yedeklendi!");
    localStorage.setItem('son_otomatik_yedek', new Date().toLocaleDateString());
  };

  const islemYap = async () => {
    if (!plaka) {
      gosterBildirim("⚠️ Lütfen plaka girin!");
      return; 
    }
    const kayitliArac = await db.araclar.where('plaka').equals(plaka).first();
    if (kayitliArac) {
      setSeciliArac(kayitliArac);
      const gecmis = await db.islemler.where('plaka').equals(plaka).reverse().toArray();
      setGecmisIslemler(gecmis);
    } else {
      const yeniId = await db.araclar.add({
        plaka: plaka,
        sonGelisTarihi: new Date().toLocaleDateString()
      });
      setSeciliArac({ id: yeniId, plaka: plaka });
      setGecmisIslemler([]); 
    }
  };

  const butonSec = (islemAdi) => {
    if (secilenButonlar.includes(islemAdi)) {
      setSecilenButonlar(secilenButonlar.filter(i => i !== islemAdi));
    } else {
      setSecilenButonlar([...secilenButonlar, islemAdi]);
    }
  };

  const kaydiTamamla = async () => {
    if (!kilometre) {
      gosterBildirim("⚠️ Lütfen aracın kilometresini girin!");
      return;
    }
    if (secilenButonlar.length === 0 && !notlar) {
      gosterBildirim("⚠️ Lütfen işlem seçin veya not yazın!");
      return;
    }

    await db.islemler.add({
      plaka: seciliArac.plaka,
      tarih: new Date().toLocaleDateString(),
      kilometre: kilometre,
      yapilanIslemler: secilenButonlar.join(', '), 
      notlar: notlar
    });

    await db.araclar.update(seciliArac.id, {
      sonGelisTarihi: new Date().toLocaleDateString()
    });

    if (accessToken) {
      driveYedekleSessiz(accessToken);
      localStorage.setItem('son_otomatik_yedek', new Date().toLocaleDateString());
    }

    gosterBildirim("✅ Kayıt eklendi ve buluta yedeklendi!");
    anaEkranaDon(); 
  };

  const anaEkranaDon = () => {
    setSeciliArac(null);
    setPlaka('');
    setKilometre('');
    setSecilenButonlar([]);
    setNotlar('');
    setGecmisIslemler([]); 
    setDinliyor(false);
  };

  const sesleYaz = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      gosterBildirim("⚠️ Tarayıcınız sesle yazmayı desteklemiyor.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'tr-TR';
    recognition.onstart = () => setDinliyor(true);
    recognition.onresult = (event) => {
      const soylenenMetin = event.results[0][0].transcript;
      setNotlar((eskiNot) => eskiNot ? eskiNot + " " + soylenenMetin : soylenenMetin);
    };
    recognition.onerror = () => setDinliyor(false);
    recognition.onend = () => setDinliyor(false);
    recognition.start();
  };

  // 0. EKRAN: İLK AÇILIŞ / DÜKKAN KURULUM EKRANI (Sadece bir kere görünür)
  if (ilkKurulum) {
    return (
      <div style={{ padding: '40px 20px', fontFamily: 'sans-serif', textAlign: 'center', maxWidth: '400px', margin: '50px auto', backgroundColor: '#f8f9fa', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
        <h2>🛠️ Hoş Geldiniz!</h2>
        <p style={{ color: '#6c757d', fontSize: '15px' }}>Uygulamayı ilk kez kuruyorsunuz. Lütfen dükkanınızın veya ustanın adını girin:</p>
        <input
          type="text"
          value={geciciDukkanAdi}
          onChange={(e) => setGeciciDukkanAdi(e.target.value)}
          placeholder="Örn: Oto Yılmaz / Ahmet Usta"
          style={{ fontSize: '18px', padding: '12px', width: '100%', boxSizing: 'border-box', borderRadius: '8px', border: '2px solid #ccc', marginBottom: '20px', textAlign: 'center' }}
        />
        <button
          onClick={ilkKurulumuTamamla}
          style={{ width: '100%', fontSize: '18px', padding: '12px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          Kurulumu Tamamla 🚀
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '500px', margin: '0 auto', position: 'relative' }}>
      
      {bildirim && (
        <div style={{
          position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)',
          backgroundColor: '#333', color: 'white', padding: '12px 24px', borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)', zIndex: 1000, fontWeight: 'bold', fontSize: '16px',
          textAlign: 'center', borderLeft: '5px solid #28a745'
        }}>
          {bildirim}
        </div>
      )}

      {seciliArac ? (
        // 1. EKRAN: DETAY EKRANI
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#343a40', color: 'white', padding: '10px 15px', borderRadius: '8px' }}>
            <h2 style={{ margin: 0 }}>{seciliArac.plaka}</h2>
            <button onClick={anaEkranaDon} style={{ padding: '8px 15px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>
              Kapat ✖
            </button>
          </div>

          {gecmisIslemler.length > 0 ? (
            <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #dee2e6' }}>
              <h3 style={{ marginTop: 0, color: '#495057' }}>📜 Geçmiş Kayıtlar</h3>
              {gecmisIslemler.map((islem) => (
                <div key={islem.id} style={{ backgroundColor: 'white', padding: '10px', marginBottom: '10px', borderRadius: '5px', borderLeft: '4px solid #007BFF', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <span style={{ fontWeight: 'bold', color: '#007BFF' }}>📅 {islem.tarih}</span>
                    <span style={{ fontWeight: 'bold', color: '#6c757d' }}>🛣️ {islem.kilometre} KM</span>
                  </div>
                  <p style={{ margin: '5px 0', fontWeight: '500' }}>🛠️ {islem.yapilanIslemler}</p>
                  {islem.notlar && <p style={{ margin: '5px 0', color: '#6c757d', fontStyle: 'italic' }}>📝 Not: {islem.notlar}</p>}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#e2e3e5', borderRadius: '8px', textAlign: 'center', color: '#383d41' }}>
              <p style={{ margin: 0, fontWeight: 'bold' }}>Geçmiş kayıt bulunamadı.</p>
            </div>
          )}

          <hr style={{ margin: '20px 0', border: '1px solid #ccc' }} />

          <h3 style={{ color: '#28a745' }}>➕ Yeni İşlem Ekle</h3>
          <input
            type="number"
            value={kilometre}
            onChange={(e) => setKilometre(e.target.value)}
            placeholder="Kilometre Girin"
            style={{ fontSize: '20px', padding: '10px', width: '100%', boxSizing: 'border-box', borderRadius: '8px', border: '2px solid #ccc', marginBottom: '15px' }}
          />

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '15px' }}>
            {HIZLI_ISLEMLER.map((islem) => {
              const seciliMi = secilenButonlar.includes(islem);
              return (
                <button
                  key={islem}
                  onClick={() => butonSec(islem)}
                  style={{
                    padding: '10px 12px', fontSize: '15px', borderRadius: '8px', cursor: 'pointer', border: 'none', fontWeight: 'bold',
                    backgroundColor: seciliMi ? '#28a745' : '#e9ecef', color: seciliMi ? 'white' : 'black'
                  }}
                >
                  {seciliMi ? '✓ ' : '+ '} {islem}
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
            <textarea
              value={notlar}
              onChange={(e) => setNotlar(e.target.value)}
              placeholder="Ekstra notlar..."
              rows="3"
              style={{ fontSize: '16px', padding: '10px', width: '100%', boxSizing: 'border-box', borderRadius: '8px', border: '2px solid #ccc' }}
            />
            <button
              onClick={sesleYaz}
              style={{
                padding: '10px', width: '60px', borderRadius: '8px', cursor: 'pointer', border: 'none',
                backgroundColor: dinliyor ? '#dc3545' : '#17a2b8', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
            >
              <span style={{ fontSize: '24px' }}>🎤</span>
            </button>
          </div>
          
          {dinliyor && <p style={{ color: 'red', marginTop: '-10px', marginBottom: '15px', fontWeight: 'bold', textAlign: 'right' }}>Dinleniyor...</p>}

          <button
            onClick={kaydiTamamla}
            style={{ width: '100%', fontSize: '20px', padding: '15px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            💾 Kaydet ve Bitir
          </button>
        </div>
      ) : (
        // 2. EKRAN: ANA EKRAN (Sabit Dükkan İsmi ile)
        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          
          <h1 style={{ margin: '15px 0', color: '#212529' }}>🛠️ {dukkanAdi}</h1>
          
          <div style={{ marginBottom: '30px', padding: '15px', backgroundColor: '#f1f3f5', borderRadius: '8px', display: 'inline-block' }}>
            {!girisYapildi ? (
              <button onClick={googleGirisYap} style={{ padding: '10px 20px', backgroundColor: '#4285F4', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
                Google Hesabı ile Bağlan 🔐
              </button>
            ) : (
              <div>
                <span style={{ color: 'green', fontWeight: 'bold', marginRight: '10px' }}>✔ Google Drive Bağlı</span>
                <button onClick={manuelYedekle} style={{ padding: '10px 20px', backgroundColor: '#ffc107', color: 'black', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
                  ☁️ Manuel Yedekle
                </button>
              </div>
            )}
          </div>

          <br />

          <input
            type="text"
            value={plaka}
            onChange={(e) => setPlaka(e.target.value.toUpperCase())}
            placeholder="PLAKA GİRİNİZ"
            style={{ fontSize: '28px', padding: '15px', width: '90%', maxWidth: '400px', textAlign: 'center', borderRadius: '8px', border: '2px solid #000', fontWeight: 'bold' }}
          />
          <br /><br />
          <button onClick={islemYap} style={{ fontSize: '22px', padding: '15px 40px', backgroundColor: '#000', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
            SORGULA
          </button>
        </div>
      )}
    </div>
  );
}

export default App;