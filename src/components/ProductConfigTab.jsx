import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { collection, onSnapshot, setDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { PlusCircle, Edit2, Trash2, X, Check, Save } from 'lucide-react';

export default function ProductConfigTab() {
  const [configs, setConfigs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Default empty form
  const defaultForm = {
    jenisTransaksi: '',
    providers: [],
    adminType: 'flat',
    adminFlat: 0,
    adminRanges: [],
    adminOverflow: { active: false, limit: 10000000, perIncrement: 1000000, addFee: 1000 },
    labaType: 'equals_admin',
    labaFlat: 0,
    labaMinusFlat: 0,
    labaProviderPotongan: {},
    labaRanges: []
  };

  const [form, setForm] = useState(defaultForm);
  const [newProvider, setNewProvider] = useState('');

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'product_configs'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setConfigs(data);
      setIsLoading(false);
    });
    return () => unsub();
  }, []);

  const handleOpenAdd = () => {
    setForm(defaultForm);
    setIsEditing(false);
    setShowModal(true);
  };

  const handleOpenEdit = (config) => {
    setForm({ ...defaultForm, ...config });
    setIsEditing(true);
    setShowModal(true);
  };

  const handleDelete = async (id, namaTransaksi) => {
    if (window.confirm(`Yakin ingin menghapus jenis transaksi "${namaTransaksi}"?`)) {
      const userInput = window.prompt(`PERINGATAN: Menghapus data ini bisa berdampak pada sistem jika sedang digunakan.\n\nKetik "HAPUS" (tanpa tanda kutip) untuk mengonfirmasi penghapusan "${namaTransaksi}":`);
      if (userInput === 'HAPUS') {
        try {
          await deleteDoc(doc(db, 'product_configs', id));
        } catch (err) {
          alert('Gagal menghapus: ' + err.message);
        }
      } else if (userInput !== null) {
        alert('Penghapusan dibatalkan. Kata yang diketik tidak cocok.');
      }
    }
  };

  const handleCloseModal = () => {
    if (window.confirm('Yakin ingin membatalkan/keluar? Perubahan yang belum disimpan akan hilang.')) {
      setShowModal(false);
    }
  };

  const handleAddProvider = () => {
    if (!newProvider.trim()) return;
    if (form.providers.includes(newProvider.trim())) return;
    setForm({ ...form, providers: [...form.providers, newProvider.trim()] });
    setNewProvider('');
  };

  const handleRemoveProvider = (prov) => {
    if (!window.confirm(`Yakin ingin menghapus provider "${prov}"?`)) return;
    setForm({ ...form, providers: form.providers.filter(p => p !== prov) });
  };

  const addAdminRange = () => {
    setForm({ ...form, adminRanges: [...form.adminRanges, { max: 0, fee: 0 }] });
  };

  const updateAdminRange = (index, field, value) => {
    const newRanges = [...form.adminRanges];
    newRanges[index][field] = Number(value);
    setForm({ ...form, adminRanges: newRanges });
  };

  const removeAdminRange = (index) => {
    if (!window.confirm('Yakin ingin menghapus range admin ini?')) return;
    const newRanges = [...form.adminRanges];
    newRanges.splice(index, 1);
    setForm({ ...form, adminRanges: newRanges });
  };

  const addLabaRange = () => {
    setForm({ ...form, labaRanges: [...form.labaRanges, { max: 0, laba: 0 }] });
  };

  const updateLabaRange = (index, field, value) => {
    const newRanges = [...form.labaRanges];
    newRanges[index][field] = Number(value);
    setForm({ ...form, labaRanges: newRanges });
  };

  const removeLabaRange = (index) => {
    if (!window.confirm('Yakin ingin menghapus range laba ini?')) return;
    const newRanges = [...form.labaRanges];
    newRanges.splice(index, 1);
    setForm({ ...form, labaRanges: newRanges });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.jenisTransaksi) return alert('Nama Jenis Transaksi wajib diisi!');
    
    const id = isEditing ? form.id : Date.now().toString();
    try {
      await setDoc(doc(db, 'product_configs', id), form);
      setShowModal(false);
    } catch (err) {
      alert('Gagal menyimpan: ' + err.message);
    }
  };



  return (
    <div className="glass-container report-card animate-slide-up">
      <div className="report-header">
        <h2>Pengaturan Produk</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={handleOpenAdd} className="btn-primary" style={{ width: 'auto', padding: '8px 16px' }}>
            <PlusCircle size={16} /> Tambah Jenis Transaksi
          </button>
        </div>
      </div>

      {isLoading ? (
        <p>Memuat konfigurasi...</p>
      ) : (
        <div className="table-responsive">
          <table className="print-table">
            <thead>
              <tr>
                <th>Jenis Transaksi</th>
                <th>Provider</th>
                <th>Tipe Admin</th>
                <th>Tipe Laba</th>
                <th style={{ textAlign: 'center', width: '100px' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {configs.map((c) => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 'bold' }}>{c.jenisTransaksi}</td>
                  <td style={{ fontSize: '12px', color: '#555' }}>
                    {c.providers.length > 0 ? c.providers.join(', ') : '-'}
                  </td>
                  <td style={{ fontSize: '13px' }}>
                    <span className="badge-admin" style={{ background: '#e0e7ff', color: '#4f46e5' }}>{c.adminType}</span>
                  </td>
                  <td style={{ fontSize: '13px' }}>
                    <span className="badge-admin" style={{ background: '#dcfce7', color: '#16a34a' }}>{c.labaType}</span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button onClick={() => handleOpenEdit(c)} className="action-btn" style={{ color: '#3b82f6' }}><Edit2 size={16}/></button>
                    <button onClick={() => handleDelete(c.id, c.jenisTransaksi)} className="action-btn delete-btn" style={{ marginLeft: '8px' }}><Trash2 size={16}/></button>
                  </td>
                </tr>
              ))}
              {configs.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center' }}>Belum ada konfigurasi produk.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showModal && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, overflowY: 'auto', padding: '40px 20px' }}>
          <div className="glass-container animate-slide-up" style={{ background: 'white', maxWidth: '700px', margin: '0 auto', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #e5e7eb', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '18px' }}>{isEditing ? 'Edit Konfigurasi Transaksi' : 'Tambah Konfigurasi Baru'}</h3>
              <button onClick={handleCloseModal} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#6b7280' }}><X size={24}/></button>
            </div>

            <form onSubmit={handleSave}>
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>Nama Jenis Transaksi</label>
                <input type="text" className="input-field" value={form.jenisTransaksi} onChange={e => setForm({...form, jenisTransaksi: e.target.value})} placeholder="Contoh: E-Wallet" required />
              </div>

              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>Provider Terkait (Opsional)</label>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <input type="text" className="input-field" value={newProvider} onChange={e => setNewProvider(e.target.value)} placeholder="Contoh: Dana" />
                  <button type="button" onClick={handleAddProvider} className="btn-secondary" style={{ width: 'auto', padding: '8px 16px' }}>Tambah</button>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {form.providers.map(p => (
                    <div key={p} style={{ background: '#f3f4f6', padding: '4px 12px', borderRadius: '16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {p} <button type="button" onClick={() => handleRemoveProvider(p)} style={{ border:'none', background:'none', color:'#ef4444', cursor:'pointer', padding:0 }}><X size={14}/></button>
                    </div>
                  ))}
                </div>
              </div>

              {/* RUMUS ADMIN */}
              <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
                <h4 style={{ marginTop: 0, color: '#4f46e5', marginBottom: '12px' }}>A. Rumus Biaya Admin</h4>
                <select className="input-field" value={form.adminType} onChange={e => setForm({...form, adminType: e.target.value})} style={{ marginBottom: '12px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', paddingRight: '24px', maxWidth: '100%' }}>
                  <option value="zero">1. Tanpa Admin (Rp 0)</option>
                  <option value="flat">2. Flat / Tetap (Rp)</option>
                  <option value="range">3. Bertingkat / Range Nominal</option>
                </select>

                {form.adminType === 'flat' && (
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Nominal Admin Tetap (Rp)</label>
                    <input type="number" className="input-field" value={form.adminFlat} onChange={e => setForm({...form, adminFlat: Number(e.target.value)})} />
                  </div>
                )}

                {form.adminType === 'range' && (
                  <div>
                    <div style={{ marginBottom: '12px' }}>
                      {form.adminRanges.map((r, i) => (
                        <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap' }}>
                          <div style={{ display: 'flex', flex: '1 1 120px', gap: '4px', alignItems: 'center' }}>
                            <span style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>Max Rp</span>
                            <input type="number" className="input-field" style={{ width: '100%', minWidth: '80px' }} value={r.max} onChange={e => updateAdminRange(i, 'max', e.target.value)} />
                          </div>
                          <div style={{ display: 'flex', flex: '1 1 120px', gap: '4px', alignItems: 'center' }}>
                            <span style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>Admin Rp</span>
                            <input type="number" className="input-field" style={{ width: '100%', minWidth: '80px' }} value={r.fee} onChange={e => updateAdminRange(i, 'fee', e.target.value)} />
                          </div>
                          <button type="button" onClick={() => removeAdminRange(i)} style={{ background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '4px', padding: '10px' }}><Trash2 size={16}/></button>
                        </div>
                      ))}
                      <button type="button" onClick={addAdminRange} className="btn-secondary" style={{ width: 'auto', padding: '6px 12px', fontSize: '12px' }}>+ Tambah Range</button>
                    </div>
                    
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 'bold' }}>
                      <input type="checkbox" checked={form.adminOverflow.active} onChange={e => setForm({...form, adminOverflow: {...form.adminOverflow, active: e.target.checked}})} />
                      Aktifkan Rumus Kelipatan (Overflow)
                    </label>
                    {form.adminOverflow.active && (
                      <div style={{ marginTop: '8px', background: '#f9fafb', padding: '12px', borderRadius: '6px', fontSize: '12px', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                        <span style={{ whiteSpace: 'nowrap' }}>Jika nominal lebih besar dari</span>
                        <input type="number" value={form.adminOverflow.limit} onChange={e => setForm({...form, adminOverflow: {...form.adminOverflow, limit: Number(e.target.value)}})} style={{ width: '100px', padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: '4px' }} />
                        <span style={{ whiteSpace: 'nowrap' }}>, tambahkan admin Rp</span>
                        <input type="number" value={form.adminOverflow.addFee} onChange={e => setForm({...form, adminOverflow: {...form.adminOverflow, addFee: Number(e.target.value)}})} style={{ width: '80px', padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: '4px' }} />
                        <span style={{ whiteSpace: 'nowrap' }}>per kelipatan Rp</span>
                        <input type="number" value={form.adminOverflow.perIncrement} onChange={e => setForm({...form, adminOverflow: {...form.adminOverflow, perIncrement: Number(e.target.value)}})} style={{ width: '100px', padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: '4px' }} />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* RUMUS LABA */}
              <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px', marginBottom: '24px' }}>
                <h4 style={{ marginTop: 0, color: '#16a34a', marginBottom: '12px' }}>B. Rumus Laba Toko</h4>
                <select className="input-field" value={form.labaType} onChange={e => setForm({...form, labaType: e.target.value})} style={{ marginBottom: '12px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', paddingRight: '24px', maxWidth: '100%' }}>
                  <option value="zero">1. Tanpa Laba (Rp 0)</option>
                  <option value="equals_admin">2. Sama dengan Biaya Admin</option>
                  <option value="flat">3. Flat / Tetap (Rp)</option>
                  <option value="admin_minus_flat">4. Admin dikurangi Potongan Flat</option>
                  <option value="admin_minus_provider">5. Admin dikurangi Potongan Provider</option>
                  <option value="range">6. Rentang Bertingkat Sendiri</option>
                  <option value="input_nominal">7. Bebas (Input Nominal Manual)</option>
                </select>

                {form.labaType === 'flat' && (
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Nominal Laba Tetap (Rp)</label>
                    <input type="number" className="input-field" value={form.labaFlat} onChange={e => setForm({...form, labaFlat: Number(e.target.value)})} />
                  </div>
                )}
                {form.labaType === 'admin_minus_flat' && (
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Potongan Tetap (Rp)</label>
                    <input type="number" className="input-field" value={form.labaMinusFlat} onChange={e => setForm({...form, labaMinusFlat: Number(e.target.value)})} />
                  </div>
                )}
                {form.labaType === 'admin_minus_provider' && (
                  <div style={{ background: '#f9fafb', padding: '12px', borderRadius: '6px' }}>
                    <p style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: 'bold' }}>Tentukan Modal/Potongan untuk setiap Provider:</p>
                    {form.providers.length === 0 ? (
                      <span style={{ fontSize: '12px', color: '#ef4444' }}>Silakan tambah Provider terlebih dahulu di atas.</span>
                    ) : (
                      form.providers.map(p => (
                        <div key={p} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'center' }}>
                          <span style={{ fontSize: '13px' }}>{p}</span>
                          <div>
                            <span style={{ fontSize: '13px', marginRight: '8px' }}>Potongan Rp</span>
                            <input type="number" className="input-field" style={{ width: '120px' }} value={form.labaProviderPotongan[p] || 0} onChange={e => setForm({...form, labaProviderPotongan: {...form.labaProviderPotongan, [p]: Number(e.target.value)}})} />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
                {form.labaType === 'range' && (
                  <div>
                    <div style={{ marginBottom: '12px' }}>
                      {form.labaRanges.map((r, i) => (
                        <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap' }}>
                          <div style={{ display: 'flex', flex: '1 1 120px', gap: '4px', alignItems: 'center' }}>
                            <span style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>Max Rp</span>
                            <input type="number" className="input-field" style={{ width: '100%', minWidth: '80px' }} value={r.max} onChange={e => updateLabaRange(i, 'max', e.target.value)} />
                          </div>
                          <div style={{ display: 'flex', flex: '1 1 120px', gap: '4px', alignItems: 'center' }}>
                            <span style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>Laba Rp</span>
                            <input type="number" className="input-field" style={{ width: '100%', minWidth: '80px' }} value={r.laba} onChange={e => updateLabaRange(i, 'laba', e.target.value)} />
                          </div>
                          <button type="button" onClick={() => removeLabaRange(i)} style={{ background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '4px', padding: '10px' }}><Trash2 size={16}/></button>
                        </div>
                      ))}
                      <button type="button" onClick={addLabaRange} className="btn-secondary" style={{ width: 'auto', padding: '6px 12px', fontSize: '12px' }}>+ Tambah Range Laba</button>
                    </div>
                  </div>
                )}
              </div>

              <button type="submit" className="btn-primary" style={{ width: '100%', padding: '14px', fontSize: '16px' }}>
                <Save size={20} /> {isEditing ? 'Simpan Perubahan' : 'Simpan Konfigurasi Baru'}
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
