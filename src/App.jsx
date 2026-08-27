import { useState, useEffect, useRef } from 'react';
import { PlusCircle, List, Trash2, Calendar, User, FileText, CheckCircle, Printer, Flag, Settings, Edit2, Loader2 } from 'lucide-react';
import { calculateAdminAndLaba, formatRupiah } from './utils/calculator';
import { collection, onSnapshot, setDoc, deleteDoc, doc, writeBatch } from 'firebase/firestore';
import { db } from './firebase';
import './App.css';

const JENIS_TRANSAKSI = [
  'Tarik Tunai Bank',
  'Tarik BPNT/PKH',
  'Transfer Bank',
  'Transfer Antar Bank',
  'E-Wallet',
  'Virtual Account / BRIVA',
  'Pulsa',
  'Paket Data',
  'Token Listrik',
  'BPJS',
  'Multifinance',
  'Pinjaman BRI',
  'Admin'
];

const PROVIDERS = {
  'Transfer Bank': ['BRI', 'BNI', 'BCA', 'Mandiri', 'Seabank'],
  'E-Wallet': ['Dana', 'Gopay', 'Shopeepay', 'OVO', 'LinkAja'],
  'Virtual Account / BRIVA': ['BRIVA', 'BCA VA', 'BNI VA', 'Mandiri VA']
};

const getFormattedProduct = (trx) => {
  const nom = formatRupiah(trx.nominal).replace(/IDR|Rp/g, '').trim();
  let base = '';
  
  if (trx.jenis === 'Tarik BPNT/PKH') {
    base = `PKH ${nom}`;
  } else if (trx.jenis === 'E-Wallet') {
    base = `Top up ${trx.provider} ${nom}`;
  } else if (trx.jenis === 'Transfer Bank') {
    base = `TF ${trx.provider} ${nom}`;
  } else if (trx.jenis === 'Transfer Antar Bank') {
    base = `TF Antar Bank ${nom}`;
  } else if (trx.jenis === 'Tarik Tunai Bank') {
    base = `Tarik ${trx.provider || 'Tunai'} ${nom}`;
  } else if (trx.jenis === 'Pulsa') {
    base = `Pulsa ${nom}`;
  } else if (trx.jenis === 'Paket Data') {
    base = `Paket Data ${nom}`;
  } else if (trx.jenis === 'Token Listrik') {
    base = `Token Listrik ${nom}`;
  } else if (trx.jenis === 'Virtual Account / BRIVA') {
    base = `Pembayaran ${trx.provider} ${nom}`;
  } else if (trx.jenis === 'Admin') {
    base = `Admin`;
  } else {
    base = `${trx.jenis} ${trx.provider ? trx.provider : ''} ${nom}`;
  }

  return (
    <>
      {base}
      {trx.keterangan && (
        <span style={{ fontStyle: 'italic', fontSize: '0.85em', color: '#6b7280', marginLeft: '6px' }}>
          ({trx.keterangan})
        </span>
      )}
    </>
  );
};

function App() {
  const CustomSelect = ({ options, value, onChange, name, placeholder }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
      const handleClickOutside = (event) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
          setIsOpen(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
      <div className="custom-select-container" ref={dropdownRef}>
        <div 
          className="input-field custom-select-header" 
          onClick={() => setIsOpen(!isOpen)}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
        >
          <span style={{ color: value ? 'inherit' : '#9ca3af' }}>{value || placeholder}</span>
          <span style={{ fontSize: '10px' }}>▼</span>
        </div>
        {isOpen && (
          <ul className="custom-select-list">
            <li className="custom-select-item placeholder" onClick={() => { onChange({ target: { name, value: '', type: 'select-one' } }); setIsOpen(false); }}>
              {placeholder}
            </li>
            {options.map(opt => (
              <li 
                key={opt}
                className={`custom-select-item ${value === opt ? 'selected' : ''}`}
                onClick={() => {
                  onChange({ target: { name, value: opt, type: 'select-one' } });
                  setIsOpen(false);
                }}
              >
                {opt}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };

  const [activeTab, setActiveTab] = useState('input'); // 'input', 'report', or 'accounts'
  const [transactions, setTransactions] = useState([]);
  const [users, setUsers] = useState([]);
  
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('currentUser');
    return saved ? JSON.parse(saved) : null;
  });
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [accountForm, setAccountForm] = useState({ username: '', password: '', role: 'admin' });
  const [printDate, setPrintDate] = useState(new Date().toLocaleDateString('id-ID'));
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [editingTxId, setEditingTxId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState(null);

  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      if (usersData.length === 0) {
        const defaultMaster = { id: 'default-master', username: 'master', password: '123', role: 'master' };
        setUsers([defaultMaster]); // Set state langsung agar bisa login
        setDoc(doc(db, 'users', 'default-master'), { username: 'master', password: '123', role: 'master' })
          .catch(err => console.error('Error creating default user:', err));
      } else {
        setUsers(usersData);
      }
    }, (error) => {
      console.error("Firebase users error:", error);
      alert("Error membaca database: " + error.message + ". Pastikan Rules Firestore sudah 'test mode' (allow read, write: if true).");
    });

    const unsubTx = onSnapshot(collection(db, 'transactions'), (snapshot) => {
      const txData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      txData.sort((a, b) => a.id.localeCompare(b.id)); 
      setTransactions(txData);
    }, (error) => {
      console.error("Firebase tx error:", error);
    });

    return () => {
      unsubUsers();
      unsubTx();
    };
  }, []);

  const [formData, setFormData] = useState({
    waktu: new Date().toISOString().slice(0, 16),
    pelanggan: '',
    keterangan: '',
    jenis: '',
    provider: '',
    nominal: '',
    adminBank: '',
    ditandai: false
  });

  const [calculation, setCalculation] = useState({ admin: 0, laba: 0, totalBayar: 0 });

  useEffect(() => {
    if (formData.jenis && formData.nominal) {
      const calc = calculateAdminAndLaba(formData.jenis, formData.provider, formData.nominal, formData.adminBank);
      setCalculation(calc);
    } else {
      setCalculation({ admin: 0, laba: 0, totalBayar: 0 });
    }
  }, [formData.jenis, formData.provider, formData.nominal, formData.adminBank]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    let finalValue = type === 'checkbox' ? checked : value;

    // Batasi input angka maksimal 12 digit (di bawah 1 Triliun)
    if (name === 'nominal') {
      if (finalValue && finalValue.length > 12) {
        finalValue = finalValue.slice(0, 12);
      }
    }

    setFormData(prev => ({
      ...prev,
      [name]: finalValue,
      ...(name === 'jenis' ? { provider: '', adminBank: '' } : {})
    }));
  };

  const handleLogin = (e) => {
    e.preventDefault();
    const user = users.find(u => u.username === loginForm.username && u.password === loginForm.password);
    if (user) {
      setCurrentUser(user);
      localStorage.setItem('currentUser', JSON.stringify(user));
      setLoginForm({ username: '', password: '' });
      setActiveTab('input');
    } else {
      alert('Username atau Password salah!');
    }
  };

  const handleLogout = () => {
    if (confirm('Yakin ingin keluar (logout)?')) {
      setCurrentUser(null);
      localStorage.removeItem('currentUser');
    }
  };

  const handleAddAccount = async (e) => {
    e.preventDefault();
    if (editingAccountId) {
      const existing = users.find(u => u.username === accountForm.username && u.id !== editingAccountId);
      if (existing) {
        alert('Username sudah dipakai oleh pengguna lain!');
        return;
      }
      await setDoc(doc(db, 'users', editingAccountId), accountForm, { merge: true });
      setEditingAccountId(null);
      setAccountForm({ username: '', password: '', role: 'admin' });
      alert('Akun berhasil diupdate!');
    } else {
      if(users.find(u => u.username === accountForm.username)) {
        alert('Username sudah ada!');
        return;
      }
      const newId = Date.now().toString();
      await setDoc(doc(db, 'users', newId), accountForm);
      setAccountForm({ username: '', password: '', role: 'admin' });
      alert('Akun berhasil ditambahkan!');
    }
  };

  const handleEditAccountClick = (user) => {
    setAccountForm({ username: user.username, password: user.password, role: user.role });
    setEditingAccountId(user.id);
  };

  const handleCancelEditAccount = () => {
    setAccountForm({ username: '', password: '', role: 'admin' });
    setEditingAccountId(null);
  };

  const handleDeleteAccount = async (id) => {
    if (id === currentUser.id) {
      alert('Anda tidak bisa menghapus akun Anda sendiri! Jika ingin mengubah password, gunakan fitur Edit.');
      return;
    }
    const acc = users.find(u => u.id === id);
    if (acc && acc.role === 'master' && users.filter(u => u.role === 'master').length <= 1) {
      alert('Tidak bisa menghapus satu-satunya Master Admin!');
      return;
    }
    if (confirm('Yakin ingin menghapus akun ini?')) {
      await deleteDoc(doc(db, 'users', id));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.jenis || !formData.nominal) return;
    if (isSubmitting) return; // Mencegah double click / spam
    
    setIsSubmitting(true);
    
    try {
      const finalWaktu = currentUser.role === 'admin' ? new Date().toISOString().slice(0, 16) : formData.waktu;
      
      const newTx = {
        ...formData,
        waktu: finalWaktu,
        inputBy: currentUser.username,
        admin: calculation.admin,
        laba: calculation.laba,
        totalBayar: calculation.totalBayar
      };

      if (editingTxId) {
        await setDoc(doc(db, 'transactions', editingTxId), newTx, { merge: true });
        setEditingTxId(null);
        setFormData({
          waktu: new Date().toISOString().slice(0, 16),
          pelanggan: '',
          jenis: '',
          provider: '',
          nominal: '',
          adminBank: '',
          keterangan: '',
          ditandai: false
        });
        alert('Transaksi Berhasil Diupdate!');
      } else {
        const newTxId = Date.now().toString();
        await setDoc(doc(db, 'transactions', newTxId), newTx);
        setFormData({
          waktu: new Date().toISOString().slice(0, 16),
          pelanggan: '',
          keterangan: '',
          jenis: '',
          provider: '',
          nominal: '',
          adminBank: '',
          ditandai: false
        });
        alert('Transaksi Berhasil Disimpan!');
      }
    } catch (error) {
      alert('Terjadi kesalahan: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditTransaction = (t) => {
    setFormData({
      waktu: t.waktu,
      pelanggan: t.pelanggan || '',
      jenis: t.jenis,
      provider: t.provider || '',
      nominal: t.nominal,
      adminBank: t.adminBank || '',
      keterangan: t.keterangan || '',
      ditandai: t.ditandai || false
    });
    setEditingTxId(t.id);
    setActiveTab('input');
  };

  const handleCancelEdit = () => {
    setFormData({
      waktu: new Date().toISOString().slice(0, 16),
      pelanggan: '',
      jenis: '',
      provider: '',
      nominal: '',
      adminBank: '',
      keterangan: '',
      ditandai: false
    });
    setEditingTxId(null);
  };

  const deleteTransaction = async (id) => {
    if (confirm('Hapus transaksi ini?')) {
      await deleteDoc(doc(db, 'transactions', id));
    }
  };

  const toggleMark = async (id) => {
    const targetTx = transactions.find(t => t.id === id);
    if (targetTx) {
      await setDoc(doc(db, 'transactions', id), { ...targetTx, ditandai: !targetTx.ditandai });
    }
  };

  const totalPendapatan = transactions.reduce((acc, curr) => acc + curr.totalBayar, 0);
  const totalLabaBersih = transactions.reduce((acc, curr) => acc + curr.laba, 0);

  const clearAll = () => {
    setShowResetModal(true);
  };

  const handleConfirmReset = async () => {
    setShowResetModal(false);
    setTimeout(async () => {
      window.print();
      const batch = writeBatch(db);
      transactions.forEach(t => {
        batch.delete(doc(db, 'transactions', t.id));
      });
      await batch.commit();
      alert("Laporan berhasil dicetak dan data transaksi telah direset!");
    }, 300);
  };

  const handlePrint = () => {
    if (!isAdmin) {
      setShowPrintModal(true);
    } else {
      setPrintDate(new Date().toLocaleDateString('id-ID'));
      setTimeout(() => window.print(), 300);
    }
  };

  if (!currentUser) {
    return (
      <div className="app-container login-container">
        <div className="glass-container login-card animate-slide-up">
          <h2>Login Akoontan</h2>
          <form onSubmit={handleLogin}>
            <div className="form-group" style={{ textAlign: 'left' }}>
              <label>Username</label>
              <input type="text" className="input-field" value={loginForm.username} onChange={e => setLoginForm({...loginForm, username: e.target.value})} required />
            </div>
            <div className="form-group" style={{ textAlign: 'left' }}>
              <label>Password</label>
              <input type="password" className="input-field" value={loginForm.password} onChange={e => setLoginForm({...loginForm, password: e.target.value})} required />
            </div>
            <button type="submit" className="btn-primary login-btn">Masuk</button>
          </form>
        </div>
      </div>
    );
  }

  const isAdmin = currentUser.role === 'admin';

  return (
    <div className="app-container">
      <div className="header no-print" style={{ position: 'relative' }}>
        <h1>Akoontan Store</h1>
        <p>Aplikasi Pencatatan Transaksi Harian</p>
        <button onClick={handleLogout} className="logout-btn" style={{ position: 'absolute', top: '10px', right: 0 }}>Logout</button>
      </div>

      <div className="tabs animate-slide-up no-print">
        <div 
          className={`tab ${activeTab === 'input' ? 'active' : ''}`}
          onClick={() => setActiveTab('input')}
        >
          <PlusCircle size={20} style={{marginBottom: 4, display: 'block', margin: '0 auto'}}/>
          Input Data
        </div>
        <div 
          className={`tab ${activeTab === 'report' ? 'active' : ''}`}
          onClick={() => setActiveTab('report')}
        >
          <List size={20} style={{marginBottom: 4, display: 'block', margin: '0 auto'}}/>
          Laporan Harian
        </div>
        {!isAdmin && (
          <div 
            className={`tab ${activeTab === 'accounts' ? 'active' : ''}`}
            onClick={() => setActiveTab('accounts')}
          >
            <Settings size={20} style={{marginBottom: 4, display: 'block', margin: '0 auto'}}/>
            Kelola Akun
          </div>
        )}
      </div>

      {activeTab === 'input' && (
        <div className="glass-container form-card animate-slide-up no-print">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label><Calendar size={14} style={{display:'inline', marginRight:6}}/>Waktu Transaksi</label>
              <input 
                type={isAdmin ? "text" : "datetime-local"} 
                className="input-field" 
                name="waktu" 
                value={isAdmin ? "Otomatis (Saat ini)" : formData.waktu} 
                onChange={handleChange} 
                readOnly={isAdmin} 
                required={!isAdmin} 
                style={isAdmin ? { backgroundColor: '#f3f4f6', color: '#6b7280', cursor: 'not-allowed' } : {}}
              />
            </div>

            <div className="form-group">
              <label><User size={14} style={{display:'inline', marginRight:6}}/>Nama Pelanggan (Margin Kiri)</label>
              <input type="text" className="input-field" name="pelanggan" placeholder="Cth: Mak, Fendra" value={formData.pelanggan} onChange={handleChange} maxLength={15} />
            </div>

            <div className="form-group">
              <label><FileText size={14} style={{display:'inline', marginRight:6}}/>Keterangan Tambahan / Kode Kartu</label>
              <input type="text" className="input-field" name="keterangan" placeholder="Cth: 0125, Pengguna APK" value={formData.keterangan} onChange={handleChange} maxLength={25} />
            </div>

            <div className="form-group">
              <label>Jenis Transaksi</label>
              <CustomSelect 
                name="jenis"
                value={formData.jenis}
                onChange={handleChange}
                options={JENIS_TRANSAKSI}
                placeholder="-- Pilih Jenis Transaksi --"
              />
            </div>

            {PROVIDERS[formData.jenis] && (
              <div className="form-group">
                <label>Provider / Bank</label>
                <CustomSelect 
                  name="provider"
                  value={formData.provider}
                  onChange={handleChange}
                  options={PROVIDERS[formData.jenis]}
                  placeholder="-- Pilih Provider --"
                />
              </div>
            )}

            <div className="form-group">
              <label>Nominal Transaksi (Rp)</label>
              <input type="number" className="input-field" name="nominal" placeholder="0" value={formData.nominal} onChange={handleChange} required min="0" max="999999999" />
            </div>

            {formData.jenis === 'Transfer Antar Bank' && Number(formData.nominal) > 2000000 && (
              <div className="form-group animate-slide-up">
                <label>Biaya Admin dari Bank (Rp)</label>
                <input type="number" className="input-field" name="adminBank" placeholder="Cth: 2500" value={formData.adminBank} onChange={handleChange} required min="0" max="999999" />
              </div>
            )}

            <div className="form-group">
              <label className="laba-override-box" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', background: formData.ditandai ? '#fffae6' : '#f9fafb', border: formData.ditandai ? '1px solid #fde047' : '1px solid #e5e7eb', borderRadius: '6px' }}>
                <input type="checkbox" name="ditandai" checked={formData.ditandai} onChange={handleChange} />
                <Flag size={16} fill={formData.ditandai ? '#eab308' : 'none'} color={formData.ditandai ? '#eab308' : '#9ca3af'} /> 
                <span style={{ fontWeight: formData.ditandai ? '600' : 'normal', color: formData.ditandai ? '#ca8a04' : '#4b5563' }}>Tandai Transaksi Ini (Warna Kuning)</span>
              </label>
            </div>

            {formData.jenis && formData.nominal && (
              <div className="summary-box">
                <div className="summary-row">
                  <span>Biaya Admin:</span>
                  <span>{formatRupiah(calculation.admin)}</span>
                </div>
                {!isAdmin && (
                  <div className="summary-row">
                    <span>Laba Toko:</span>
                    <span style={{color: 'var(--success)', fontWeight:'bold'}}>{calculation.laba === 0 && (formData.jenis === 'BPJS' || formData.jenis === 'Multifinance') ? 'Tanpa Laba' : formatRupiah(calculation.laba)}</span>
                  </div>
                )}
                <div className="summary-row total">
                  <span>Total Bayar:</span>
                  <span>{formatRupiah(calculation.totalBayar)}</span>
                </div>
              </div>
            )}

            <button type="submit" className="btn-primary" style={{width: '100%', padding: '14px', fontSize: 16}} disabled={isSubmitting}>
              {isSubmitting ? (
                <><Loader2 size={20} className="animate-spin" /> Sedang Memproses...</>
              ) : (
                <><CheckCircle size={20} /> {editingTxId ? 'Update Transaksi' : 'Simpan Transaksi'}</>
              )}
            </button>
            {editingTxId && (
              <button type="button" onClick={handleCancelEdit} className="btn-secondary" style={{width: '100%', padding: '14px', fontSize: 16, marginTop: '10px'}}>
                Batal Edit
              </button>
            )}
          </form>
        </div>
      )}

      {(activeTab === 'report' || activeTab === 'input') && (
        <div className={`glass-container report-card animate-slide-up ${activeTab === 'input' ? 'print-only' : ''}`}>
          <div className="report-header">
            <h2 className="print-title">LAPORAN HARIAN</h2>
            <div className="no-print" style={{display:'flex', gap: '12px', alignItems: 'center'}}>
              {transactions.length > 0 && (
                <>
                  <button onClick={handlePrint} className="btn-primary" style={{padding: '8px 16px', fontSize: 14, width:'auto'}}><Printer size={16}/> Cetak PDF</button>
                  {!isAdmin && (
                    <button onClick={clearAll} className="btn-danger">Reset Data</button>
                  )}
                </>
              )}
            </div>
          </div>
          
          <div className="print-header">
             <div>
               <h2 style={{margin: 0, fontSize: '18px', textTransform: 'uppercase'}}>Laporan Harian - Akoontan Store</h2>
               <div style={{marginTop: '4px', fontWeight: 'normal'}}>Tanggal: {printDate}</div>
             </div>
             <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
               <div>Total Pendapatan: {formatRupiah(totalPendapatan)}</div>
               {!isAdmin && (
                 <div>Total Laba Bersih: {formatRupiah(totalLabaBersih)}</div>
               )}
             </div>
          </div>
          
          {transactions.length > 0 ? (
            <>
              <div className="table-responsive">
                <table className="print-table">
                  <thead>
                    <tr>
                      <th style={{width: 40, textAlign: 'center'}}>No</th>
                      <th style={{width: 130}}>Nama</th>
                      <th className="no-print">Admin</th>
                      <th>Produk</th>
                      <th style={{width: 80, textAlign: 'center'}}>Total Unit</th>
                      <th className="text-right">Total Penjualan</th>
                      {!isAdmin && <th className="text-right print-laba">Laba</th>}
                      {!isAdmin && <th className="no-print">Aksi</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((t, i) => (
                      <tr key={t.id} className={t.ditandai ? 'row-marked' : ''}>
                        <td style={{textAlign: 'center'}}>{i + 1}</td>
                        <td style={{ fontSize: '12px', fontStyle: 'italic', color: '#555', maxWidth: '130px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {t.pelanggan || ''}
                        </td>
                        <td className="no-print" style={{ fontSize: '12px', color: '#6b7280' }}>
                          {t.inputBy || 'master'}
                        </td>
                        <td>
                          <span>{getFormattedProduct(t)}</span>
                        </td>
                        <td></td>
                        <td className="text-right font-bold">{formatRupiah(t.totalBayar)}</td>
                        {!isAdmin && (
                          <td className="text-right print-laba" style={{color: 'var(--success)'}}>
                            {t.laba === 0 && (t.jenis === 'BPJS' || t.jenis === 'Multifinance') ? '-' : formatRupiah(t.laba)}
                          </td>
                        )}
                        {!isAdmin && (
                          <td className="no-print" style={{textAlign: 'center', minWidth: '100px'}}>
                            <button onClick={() => toggleMark(t.id)} className={`action-btn ${t.ditandai ? 'marked-btn' : 'mark-btn'}`} title="Tandai Transaksi">
                              <Flag size={16} />
                            </button>
                            <button onClick={() => handleEditTransaction(t)} className="action-btn" style={{color: '#3b82f6', marginLeft: '8px'}} title="Edit">
                              <Edit2 size={16} />
                            </button>
                            <button onClick={() => deleteTransaction(t.id)} className="action-btn delete-btn" title="Hapus" style={{marginLeft: '8px'}}>
                              <Trash2 size={16} />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="summary-box no-print" style={{marginTop: 20}}>
                <div className="summary-row">
                  <span>Total Transaksi:</span>
                  <span>{transactions.length} Trx</span>
                </div>
                {!isAdmin && (
                  <div className="summary-row">
                    <span>Total Laba Bersih:</span>
                    <span style={{color: 'var(--success)', fontWeight:'bold'}}>{formatRupiah(totalLabaBersih)}</span>
                  </div>
                )}
                <div className="summary-row total">
                  <span>Total Pendapatan:</span>
                  <span>{formatRupiah(totalPendapatan)}</span>
                </div>
              </div>
            </>
          ) : (
            <div className="empty-state no-print">
              <FileText size={48} style={{margin:'0 auto'}}/>
              <p>Belum ada transaksi hari ini.</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'accounts' && !isAdmin && (
        <div className="glass-container report-card animate-slide-up no-print">
          <div className="report-header">
            <h2>Kelola Akun Pengguna</h2>
          </div>
          
          <form className="account-form" onSubmit={handleAddAccount}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '150px' }}>
                <label style={{ display: 'block', fontSize: 13, marginBottom: 4, fontWeight: 600 }}>Username</label>
                <input type="text" className="input-field" value={accountForm.username} onChange={e => setAccountForm({...accountForm, username: e.target.value})} required />
              </div>
              <div style={{ flex: 1, minWidth: '150px' }}>
                <label style={{ display: 'block', fontSize: 13, marginBottom: 4, fontWeight: 600 }}>Password</label>
                <input type="password" className="input-field" value={accountForm.password} onChange={e => setAccountForm({...accountForm, password: e.target.value})} required />
              </div>
              <div style={{ flex: 1, minWidth: '120px' }}>
                <label style={{ display: 'block', fontSize: 13, marginBottom: 4, fontWeight: 600 }}>Role</label>
                <select className="input-field" value={accountForm.role} onChange={e => setAccountForm({...accountForm, role: e.target.value})}>
                  <option value="admin">Admin Biasa</option>
                  <option value="master">Master Admin</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="submit" className="btn-primary" style={{ padding: '10px 16px', width: 'auto' }}>
                  {editingAccountId ? 'Update Akun' : 'Tambah Akun'}
                </button>
                {editingAccountId && (
                  <button type="button" onClick={handleCancelEditAccount} className="btn-secondary" style={{ padding: '10px 16px', width: 'auto' }}>
                    Batal
                  </button>
                )}
              </div>
            </div>
          </form>

          <div className="table-responsive">
            <table className="print-table">
              <thead>
                <tr>
                  <th style={{ width: 40, textAlign: 'center' }}>No</th>
                  <th>Username</th>
                  <th>Password</th>
                  <th style={{ textAlign: 'center' }}>Role</th>
                  <th style={{ width: 80, textAlign: 'center' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u, i) => (
                  <tr key={u.id}>
                    <td style={{ textAlign: 'center' }}>{i + 1}</td>
                    <td style={{ fontWeight: 600 }}>{u.username}</td>
                    <td style={{ color: '#6b7280' }}>{u.password}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={u.role === 'master' ? 'badge-master' : 'badge-admin'}>
                        {u.role === 'master' ? 'Master Admin' : 'Admin Biasa'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center', minWidth: '80px' }}>
                      <button onClick={() => handleEditAccountClick(u)} className="action-btn" style={{color: '#3b82f6'}} title="Edit">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => handleDeleteAccount(u.id)} className="action-btn delete-btn" title="Hapus" style={{marginLeft: '8px', opacity: u.id === currentUser?.id ? 0.3 : 1, cursor: u.id === currentUser?.id ? 'not-allowed' : 'pointer'}}>
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}



      {showPrintModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} className="no-print">
          <div className="glass-container animate-slide-up" style={{ width: '90%', maxWidth: '400px', background: 'white', padding: '24px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '18px', color: '#1f2937' }}>Pilih Tanggal Cetak PDF</h3>
            <div className="form-group" style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '8px' }}>Tanggal Laporan</label>
              <input 
                type="date" 
                className="input-field" 
                onChange={(e) => {
                  if(e.target.value) {
                    setPrintDate(new Date(e.target.value).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }));
                  }
                }} 
              />
              <p style={{fontSize: '12px', color: '#6b7280', marginTop: '8px', lineHeight: '1.4'}}>Tanggal ini hanya digunakan untuk judul di dalam file PDF laporan.</p>
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button className="btn-secondary" onClick={() => setShowPrintModal(false)} style={{ padding: '8px 16px', width: 'auto' }}>Batal</button>
              <button className="btn-primary" onClick={() => { setShowPrintModal(false); setTimeout(() => window.print(), 300); }} style={{ padding: '8px 16px', width: 'auto' }}>
                <Printer size={16} style={{display:'inline', marginRight: '6px', verticalAlign: '-3px'}}/> Cetak PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {showResetModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} className="no-print">
          <div className="glass-container animate-slide-up" style={{ width: '90%', maxWidth: '400px', background: '#fef2f2', padding: '24px', border: '1px solid #fca5a5' }}>
            <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '18px', color: '#b91c1c' }}>Verifikasi Reset Data</h3>
            <p style={{fontSize: '14px', color: '#7f1d1d', marginBottom: '16px', lineHeight: '1.5'}}>
              Anda akan menghapus <strong>seluruh data transaksi hari ini</strong>. 
              Sistem akan secara otomatis <strong>mencetak Laporan Harian</strong> sebelum data dihapus permanen.
            </p>
            <div className="form-group" style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', color: '#991b1b' }}>Pilih Tanggal Untuk Laporan PDF</label>
              <input 
                type="date" 
                className="input-field" 
                style={{borderColor: '#fca5a5'}}
                onChange={(e) => {
                  if(e.target.value) {
                    setPrintDate(new Date(e.target.value).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }));
                  }
                }} 
              />
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button className="btn-secondary" onClick={() => setShowResetModal(false)} style={{ padding: '8px 16px', width: 'auto' }}>Batal</button>
              <button className="btn-danger" onClick={handleConfirmReset} style={{ padding: '8px 16px', width: 'auto' }}>
                <Printer size={16} style={{display:'inline', marginRight: '6px', verticalAlign: '-3px'}}/> Cetak & Reset Data
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
