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
  return 'Rp ' + Number(number).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

const getLogoBytes = async (logoUrl, targetWidth = 200) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // Width must be multiple of 8
      const width = Math.floor(targetWidth / 8) * 8; 
      const height = Math.floor(img.height * (width / img.width));
      
      canvas.width = width;
      canvas.height = height;
      
      // Draw with white background (transparent becomes white)
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      
      const imgData = ctx.getImageData(0, 0, width, height);
      const pixels = imgData.data;
      
      const bytesWidth = width / 8;
      const data = new Uint8Array(bytesWidth * height);
      
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = (y * width + x) * 4;
          const r = pixels[i];
          const g = pixels[i+1];
          const b = pixels[i+2];
          // Grayscale (tingkat keabuan)
          const gray = 0.299 * r + 0.587 * g + 0.114 * b;
          
          // Threshold diperbesar menjadi 220:
          // Warna apa pun yang lebih gelap dari abu-abu sangat terang akan dijadikan titik hitam
          const isBlack = gray < 220 ? 1 : 0;
          
          if (isBlack) {
            data[y * bytesWidth + Math.floor(x / 8)] |= (1 << (7 - (x % 8)));
          }
        }
      }
      
      // Generate ESC/POS command: GS v 0
      // 0x1D 0x76 0x30 0x00
      const header = new Uint8Array([
        0x1D, 0x76, 0x30, 0x00,
        bytesWidth & 0xFF,
        (bytesWidth >> 8) & 0xFF,
        height & 0xFF,
        (height >> 8) & 0xFF
      ]);
      
      // Add alignment header (center)
      const alignCenter = new Uint8Array([0x1B, 0x61, 0x01]);
      
      const result = new Uint8Array(alignCenter.length + header.length + data.length);
      let offset = 0;
      
      result.set(alignCenter, offset);
      offset += alignCenter.length;
      
      result.set(header, offset);
      offset += header.length;
      
      result.set(data, offset);
      
      resolve(result);
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = logoUrl;
  });
};

export const printStrukBluetooth = async (writeCharacteristic, trx, printerSize = '58mm', logoUrl = null) => {
  if (!writeCharacteristic) throw new Error("Printer tidak terhubung.");

  const encoder = new TextEncoder();
  const width = printerSize === '80mm' ? 48 : 32;

  // Print Logo if available
  let logoBytes = null;
  if (logoUrl) {
    try {
      logoBytes = await getLogoBytes(logoUrl, 352); // 352px wide for 58mm (max is 384, we use 352 for slight margin)
    } catch (e) {
      console.error("Gagal meload logo:", e);
    }
  }

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

  const textBytes = encoder.encode(content);
  
  // Gabungkan byte logo (jika ada) dan byte teks
  let finalBytes;
  if (logoBytes) {
     finalBytes = new Uint8Array(logoBytes.length + textBytes.length);
     finalBytes.set(logoBytes, 0);
     finalBytes.set(textBytes, logoBytes.length);
  } else {
     finalBytes = textBytes;
  }

  // Web Bluetooth limits chunk sizes (typically 512 or 20 bytes depending on GATT)
  // We chunk into 64 bytes to be safe
  const CHUNK_SIZE = 64;
  
  for (let i = 0; i < finalBytes.length; i += CHUNK_SIZE) {
    const chunk = finalBytes.slice(i, i + CHUNK_SIZE);
    await writeCharacteristic.writeValue(chunk);
    // Add a small delay between chunks to prevent buffer overflow on cheap printers
    await new Promise(r => setTimeout(r, 20)); 
  }
  
  return true;
};
