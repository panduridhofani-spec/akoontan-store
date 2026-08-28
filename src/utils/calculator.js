const hitungAdminTarikTunai = (nom) => {
  if (nom <= 99000) return 2000;
  if (nom <= 300000) return 3000;
  if (nom <= 2000000) return 5000;
  if (nom <= 3999000) return 7000;
  if (nom <= 6999000) return 10000;
  if (nom <= 10000000) return 12000;
  
  let sisa = nom - 10000000;
  let kelipatan = Math.floor(sisa / 1000000);
  return 12000 + (kelipatan * 1000);
};

export const calculateAdminAndLaba = (jenis, provider, nominal, adminBank = 0) => {
  let admin = 0;
  let laba = 0;
  let totalBayar = Number(nominal) || 0;

  const hitungAdminEwallet = (nom) => {
    if (nom <= 100000) return 2000;
    if (nom <= 999000) return 3000;
    if (nom <= 3000000) return 5000;
    if (nom <= 7000000) return 7000;
    if (nom <= 10000000) return 10000;
    let kelipatan = Math.floor(nom / 1000000);
    return kelipatan * 1000;
  };

  const hitungAdminVA = (nom) => {
    if (nom <= 999000) return 3000;
    if (nom <= 3000000) return 5000;
    if (nom <= 7000000) return 7000;
    if (nom <= 10000000) return 10000;
    let kelipatan = Math.floor(nom / 1000000);
    return kelipatan * 1000;
  }

  const hitungAdminTransfer = (nom) => {
    if (nom <= 99000) return 3000;
    if (nom <= 2000000) return 5000;
    if (nom <= 3999000) return 7000;
    if (nom <= 6999000) return 10000;
    if (nom <= 9000000) return 12000;
    if (nom <= 10999999) return 15000;
    // > 10.999.999 (Kelipatan 1jt + 1.000 dari admin utama 10jt)
    let sisa = nom - 10000000;
    let kelipatan = Math.floor(sisa / 1000000);
    return 15000 + (kelipatan * 1000);
  };

  if (jenis === 'Tarik Tunai Bank') {
    admin = hitungAdminTarikTunai(nominal);
    laba = admin; 
  }
  else if (jenis === 'Tarik BPNT/PKH') {
    if (nominal <= 100000) { admin = 3000; laba = 3000; }
    else if (nominal <= 800000) { admin = 5000; laba = 5000; }
    else { admin = 10000; laba = 10000; }
  }
  else if (jenis === 'E-Wallet') {
    admin = hitungAdminEwallet(nominal);
    let potongan = 0;
    if (provider === 'Dana' || provider === 'OVO' || provider === 'Shopeepay') {
      potongan = 1500;
    } else if (provider === 'Gopay' || provider === 'LinkAja') {
      potongan = 2500;
    }
    laba = admin - potongan;
  }
  else if (jenis === 'Virtual Account / BRIVA') {
    admin = hitungAdminVA(nominal);
    laba = admin - 1500;
  }
  else if (jenis === 'Transfer Bank') {
    admin = hitungAdminTransfer(nominal);
    let potongan = 0;
    if (provider === 'BRI' || provider === 'BNI') { 
      potongan = 4000;
    }
    else if (provider === 'BCA' || provider === 'Mandiri' || provider === 'Seabank') { 
      potongan = 2000;
    }
    laba = admin - potongan;
  }
  else if (jenis === 'Transfer Antar Bank') {
    if (nominal <= 2000000) {
      admin = 10000;
      laba = admin - 10000;
    } else {
      admin = Number(adminBank) + 5000;
      laba = admin - 10000;
    }
  }
  else if (jenis === 'Pulsa') {
    const numNominal = Number(nominal) || 0;
    admin = 2000; // Admin konsisten 2.000
    
    // Laba murni, langsung masuk toko
    if (numNominal === 5000) laba = 1000;
    else if (numNominal === 10000 || numNominal === 15000) laba = 1250;
    else if (numNominal === 20000) laba = 1350;
    else if (numNominal === 25000 || numNominal === 30000 || numNominal === 35000) laba = 1750;
    else if (numNominal >= 40000) laba = 2000;
  }
  else if (jenis === 'Paket Data') { laba = 2000; }
  else if (jenis === 'Token Listrik') { admin = 3000; laba = 0; }
  else if (jenis === 'BPJS' || jenis === 'Multifinance' || jenis === 'Bayar QRIS') { laba = 0; admin = 0; }
  else if (jenis === 'Pinjaman BRI') {
    if (nominal <= 99000) admin = 2000;
    else if (nominal <= 1000000) admin = 3000;
    else if (nominal <= 3000000) admin = 5000;
    else if (nominal <= 7000000) admin = 7000;
    else if (nominal <= 10000000) admin = 10000;
    else {
      let sisa = nominal - 10000000;
      let kelipatan = Math.floor(sisa / 1000000);
      admin = 10000 + (kelipatan * 1000);
    }
    laba = admin - 1500;
  }
  else if (jenis === 'Admin') {
    admin = 0;
    laba = Number(nominal) || 0;
  }

  let biayaTambahan = admin > 0 ? admin : laba;
  
  if (jenis === 'Tarik BPNT/PKH') biayaTambahan = admin; 
  if (jenis === 'Admin') biayaTambahan = 0;

  totalBayar = Number(nominal) + biayaTambahan;
  return { admin, laba, totalBayar };
}

export const formatRupiah = (number) => {
  return new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 0
  }).format(number); // Removed currency symbol, we can add it manually or keep it clean for A4 printing
};
