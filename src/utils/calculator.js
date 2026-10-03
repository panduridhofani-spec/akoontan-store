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

export const calculateAdminAndLaba = (jenis, provider, nominal, adminBank = 0, dynamicConfig = null) => {
  let admin = 0;
  let laba = 0;
  let totalBayar = Number(nominal) || 0;
  const numNominal = Number(nominal) || 0;

  if (dynamicConfig) {
    // 1. Hitung Admin dari Config Dinamis
    if (dynamicConfig.adminType === 'flat') {
      admin = Number(dynamicConfig.adminFlat) || 0;
    } else if (dynamicConfig.adminType === 'range') {
      let foundFee = 0;
      // Pastikan ranges di-sort ascending by max
      const sortedRanges = [...(dynamicConfig.adminRanges || [])].sort((a, b) => a.max - b.max);
      let rangeMatched = false;
      for (const r of sortedRanges) {
        if (numNominal <= r.max) {
          foundFee = r.fee;
          rangeMatched = true;
          break;
        }
      }
      
      // Jika tidak ketemu di range (lebih besar dari max range tertinggi)
      if (!rangeMatched && sortedRanges.length > 0) {
        foundFee = sortedRanges[sortedRanges.length - 1].fee;
      }

      admin = foundFee;

      // Handle overflow kelipatan
      if (dynamicConfig.adminOverflow && dynamicConfig.adminOverflow.active) {
        const overflowLimit = Number(dynamicConfig.adminOverflow.limit) || 0;
        if (numNominal > overflowLimit) {
          const sisa = numNominal - overflowLimit;
          const perInc = Number(dynamicConfig.adminOverflow.perIncrement) || 1;
          const kelipatan = Math.floor(sisa / perInc);
          const addFee = Number(dynamicConfig.adminOverflow.addFee) || 0;
          admin += (kelipatan * addFee);
        }
      }
    } else {
      admin = 0; // zero type
    }

    // 2. Hitung Laba dari Config Dinamis
    if (dynamicConfig.labaType === 'equals_admin') {
      laba = admin;
    } else if (dynamicConfig.labaType === 'flat') {
      laba = Number(dynamicConfig.labaFlat) || 0;
    } else if (dynamicConfig.labaType === 'admin_minus_flat') {
      laba = admin - (Number(dynamicConfig.labaMinusFlat) || 0);
    } else if (dynamicConfig.labaType === 'admin_minus_provider') {
      const potongan = (dynamicConfig.labaProviderPotongan && dynamicConfig.labaProviderPotongan[provider]) 
        ? Number(dynamicConfig.labaProviderPotongan[provider]) 
        : 0;
      laba = admin - potongan;
    } else if (dynamicConfig.labaType === 'range') {
      let foundLaba = 0;
      const sortedLabaRanges = [...(dynamicConfig.labaRanges || [])].sort((a, b) => a.max - b.max);
      for (const r of sortedLabaRanges) {
        if (numNominal <= r.max) {
          foundLaba = r.laba;
          break;
        }
      }
      // If exceeds max range, use the max range's laba
      if (foundLaba === 0 && sortedLabaRanges.length > 0 && numNominal > sortedLabaRanges[sortedLabaRanges.length - 1].max) {
        foundLaba = sortedLabaRanges[sortedLabaRanges.length - 1].laba;
      }
      laba = foundLaba;
    } else if (dynamicConfig.labaType === 'input_nominal') {
      laba = numNominal;
    } else {
      laba = 0;
    }

    // Biaya Tambahan Logic (Dynamic)
    let biayaTambahan = admin > 0 ? admin : laba;
    
    // Khusus transaksi di mana Laba = Admin (misal Tarik PKH), biaya yang dibebankan ke user hanya Admin saja.
    // Jika tipe laba adalah input nominal (khusus transaksi jenis "Admin"), maka total bayar = nominal murni, biaya tambahan 0.
    if (dynamicConfig.labaType === 'input_nominal') {
      biayaTambahan = 0;
    } else if (dynamicConfig.labaType === 'equals_admin') {
      biayaTambahan = admin; 
    }

    totalBayar = numNominal + biayaTambahan;
    
    return { admin, laba, totalBayar };
  }

  // --- FALLBACK KE LOGIKA LAMA JIKA BELUM ADA CONFIG DINAMIS ---
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
    if (provider === 'BRI' || provider === 'BNI' || provider === 'BCA' || provider === 'Mandiri' || provider === 'Seabank') { 
      potongan = 4000;
    }
    laba = admin - potongan;
  }
  else if (jenis === 'Transfer Antar Bank') {
    if (nominal <= 2000000) {
      admin = 10000;
    } else if (nominal <= 3999000) {
      admin = 12000;
    } else if (nominal <= 6999000) {
      admin = 15000;
    } else if (nominal <= 9999999) {
      admin = 17000;
    } else {
      let kelipatan = Math.floor(nominal / 1000000);
      admin = 10000 + (kelipatan * 1000);
    }
    laba = admin - 10000;
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
  else if (jenis === 'Listrik Meteran') { admin = 0; laba = 0; }
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
