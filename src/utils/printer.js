export const connectBluetoothPrinter = async () => {
  try {
    const device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [
        '000018f0-0000-1000-8000-00805f9b34fb',
        'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
        '0000af30-0000-1000-8000-00805f9b34fb',
        '0000ae30-0000-1000-8000-00805f9b34fb'
      ]
    });

    const server = await device.gatt.connect();
    
    // Attempt to find the write characteristic
    const services = await server.getPrimaryServices();
    let writeCharacteristic = null;

    for (const service of services) {
      const characteristics = await service.getCharacteristics();
      for (const char of characteristics) {
        if (char.properties.write || char.properties.writeWithoutResponse) {
          writeCharacteristic = char;
          break;
        }
      }
      if (writeCharacteristic) break;
    }

    if (!writeCharacteristic) {
      throw new Error("Tidak menemukan port penulisan di printer ini.");
    }

    return { device, writeCharacteristic };
  } catch (error) {
    console.error("Bluetooth connection error:", error);
    throw error;
  }
};

const formatRupiahStr = (number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(number);
};

export const printStrukBluetooth = async (writeCharacteristic, trx, printerSize = '58mm') => {
  if (!writeCharacteristic) throw new Error("Printer tidak terhubung.");

  const encoder = new TextEncoder();
  const width = printerSize === '80mm' ? 48 : 32;

  // ESC/POS Commands
  const ESC = '\x1B';
  const GS = '\x1D';
  const INIT = ESC + '@';
  const ALIGN_LEFT = ESC + 'a0';
  const ALIGN_CENTER = ESC + 'a1';
  const ALIGN_RIGHT = ESC + 'a2';
  const BOLD_ON = ESC + 'E1';
  const BOLD_OFF = ESC + 'E0';
  const FEED = '\n';
  
  // Custom format text based on width
  const padRight = (str, len) => str.padEnd(len, ' ').substring(0, len);
  const padLeft = (str, len) => str.padStart(len, ' ').substring(0, len);
  const padBetween = (str1, str2) => {
    const spaceLen = width - str1.length - str2.length;
    if (spaceLen > 0) return str1 + ' '.repeat(spaceLen) + str2;
    return (str1 + ' ' + str2).substring(0, width);
  };
  const divider = '-'.repeat(width) + FEED;
  const dividerSolid = '='.repeat(width) + FEED;

  let baseProd = trx.jenis + (trx.provider ? ' ' + trx.provider : '') + ' ' + formatRupiahStr(trx.nominal).replace(/IDR|Rp/g, '').trim();
  if (trx.jenis === 'Tarik BPNT/PKH') baseProd = `PKH ` + formatRupiahStr(trx.nominal).replace(/IDR|Rp/g, '').trim();
  else if (trx.jenis === 'Admin') baseProd = `Admin`;

  let content = INIT;
  content += ALIGN_CENTER + BOLD_ON + "DIHE MART" + FEED;
  content += BOLD_OFF + "Toko Kelontong & Agen BRI Link" + FEED;
  content += "Simpan struk ini sebagai" + FEED + "bukti pembayaran" + FEED;
  content += ALIGN_LEFT + divider;
  
  const dateStr = trx.tanggal.split('-').reverse().join('/');
  const timeStr = trx.jamManual || (trx.waktu && trx.waktu.length >= 16 ? trx.waktu.substring(11, 16) : '-');
  
  content += padBetween(`Tgl: ${dateStr}`, `Jam: ${timeStr}`) + FEED;
  content += `Kasir: ${trx.inputBy || 'Kasir'}` + FEED;
  if (trx.pelanggan) content += `Plg  : ${trx.pelanggan}` + FEED;
  
  content += divider;
  
  content += BOLD_ON + baseProd + BOLD_OFF + FEED;
  if (trx.keterangan) content += `Ket  : ${trx.keterangan}` + FEED;
  
  content += dividerSolid;
  
  content += padBetween("Nominal", formatRupiahStr(trx.nominal)) + FEED;
  content += padBetween("Biaya Admin", formatRupiahStr(trx.admin)) + FEED;
  
  content += dividerSolid;
  
  content += BOLD_ON + padBetween("TOTAL", formatRupiahStr(trx.totalBayar)) + BOLD_OFF + FEED;
  
  content += divider;
  
  content += ALIGN_CENTER + BOLD_ON + "TERIMA KASIH" + FEED;
  content += BOLD_OFF + "Selamat Belanja Kembali" + FEED;
  
  content += FEED.repeat(4); // Feed paper out

  // Web Bluetooth limits chunk sizes (typically 512 or 20 bytes depending on GATT)
  // We chunk into 64 bytes to be safe
  const uint8array = encoder.encode(content);
  const CHUNK_SIZE = 64;
  
  for (let i = 0; i < uint8array.length; i += CHUNK_SIZE) {
    const chunk = uint8array.slice(i, i + CHUNK_SIZE);
    await writeCharacteristic.writeValue(chunk);
    // Add a small delay between chunks to prevent buffer overflow on cheap printers
    await new Promise(r => setTimeout(r, 20)); 
  }
  
  return true;
};
