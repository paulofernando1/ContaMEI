import React, { useContext, useState, useMemo } from 'react';
import { AppContext } from '../App';
import { v4 as uuidv4 } from 'uuid';
import { Plus, Search, Trash2, Edit2, X, Phone, Mail, User, Building2 } from 'lucide-react';

const EMPTY_FORM = { name: '', cpfCnpj: '', email: '', phone: '', type: 'client', notes: '' };

export default function Clients() {
  const { dbData, saveDb } = useContext(AppContext);
  const clients = Array.isArray(dbData?.clients) ? dbData.clients : [];

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');

  const handleChange = e => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const openNew = () => { setForm(EMPTY_FORM); setEditingId(null); setShowForm(true); };
  const openEdit = (c) => { setForm({ name: c.name, cpfCnpj: c.cpfCnpj || '', email: c.email || '', phone: c.phone || '', type: c.type || 'client', notes: c.notes || '' }); setEditingId(c.id); setShowForm(true); };

  const handleSubmit = e => {
    e.preventDefault();
    if (!form.name.trim()) return;
    let newClients;
    if (editingId) {
      newClients = clients.map(c => c.id === editingId ? { ...c, ...form } : c);
    } else {
      newClients = [...clients, { id: uuidv4(), ...form, createdAt: new Date().toISOString() }];
    }
    saveDb({ ...dbData, clients: newClients });
    setShowForm(false);
    setForm(EMPTY_FORM);
    setEditingId(null);
  };

  const handleDelete = id => {
    if (!confirm('Excluir este contato?')) return;
    saveDb({ ...dbData, clients: clients.filter(c => c.id !== id) });
  };

  const filtered = useMemo(() =>
    clients
      .filter(c => filterType === 'all' || c.type === filterType)
      .filter(c => !search || c.name?.toLowerCase().includes(search.toLowerCase()) || c.cpfCnpj?.includes(search) || c.email?.toLowerCase().includes(search.toLowerCase())),
    [clients, search, filterType]
  );

  // Transactions linked to clients
  const getClientRevenue = (clientId) => {
    return (dbData?.transactions || [])
      .filter(t => t?.type === 'income' && t?.clientId === clientId)
      .reduce((a, c) => a + (Number(c?.amount) || 0), 0);
  };

  return (
    <div className="animate-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Clientes e Fornecedores</h1>
          <p className="page-subtitle">{clients.length} contato{clients.length !== 1 ? 's' : ''} cadastrado{clients.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn-primary" onClick={openNew}><Plus size={16} /> Novo Contato</button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="glass-panel animate-in" style={{ padding: '24px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '1.05rem' }}>{editingId ? 'Editar Contato' : 'Novo Contato'}</h2>
            <button className="btn-icon" onClick={() => setShowForm(false)}><X size={17} /></button>
          </div>

          <div className="type-switcher" style={{ marginBottom: '20px', maxWidth: '300px' }}>
            <button type="button" className={form.type === 'client' ? 'active' : ''} onClick={() => setForm(p => ({ ...p, type: 'client' }))}>
              👤 Cliente
            </button>
            <button type="button" className={form.type === 'supplier' ? 'active' : ''} onClick={() => setForm(p => ({ ...p, type: 'supplier' }))}>
              🏭 Fornecedor
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '14px', marginBottom: '14px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Nome / Razão Social *</label>
                <input required name="name" value={form.name} onChange={handleChange} placeholder="Nome completo ou empresa" />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">CPF / CNPJ</label>
                <input name="cpfCnpj" value={form.cpfCnpj} onChange={handleChange} placeholder="000.000.000-00" />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">E-mail</label>
                <input type="email" name="email" value={form.email} onChange={handleChange} placeholder="email@exemplo.com" />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Telefone / WhatsApp</label>
                <input name="phone" value={form.phone} onChange={handleChange} placeholder="(11) 99999-9999" />
              </div>
            </div>
            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label className="form-label">Observações</label>
              <input name="notes" value={form.notes} onChange={handleChange} placeholder="Anotações sobre este contato..." />
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
              <button type="submit" className="btn-primary">{editingId ? 'Salvar Alterações' : 'Adicionar Contato'}</button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="filter-bar">
        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
          <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome, CPF/CNPJ ou e-mail..." style={{ paddingLeft: '34px' }} />
        </div>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ width: 'auto' }}>
          <option value="all">Todos</option>
          <option value="client">Clientes</option>
          <option value="supplier">Fornecedores</option>
        </select>
      </div>

      {/* Cards grid */}
      {filtered.length === 0 ? (
        <div className="glass-panel">
          <div className="empty-state">
            <div className="empty-state-icon">👥</div>
            <p>{clients.length === 0 ? 'Nenhum contato cadastrado ainda' : 'Nenhum contato encontrado'}</p>
            <small>{clients.length === 0 ? 'Clique em "Novo Contato" para começar' : 'Tente ajustar os filtros de busca'}</small>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
          {filtered.map(c => {
            const revenue = getClientRevenue(c.id);
            return (
              <div key={c.id} className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', transition: 'var(--transition)' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--glass-border-hover)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--glass-border)'}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <div style={{ width: 38, height: 38, borderRadius: '10px', background: c.type === 'client' ? 'rgba(99,102,241,0.15)' : 'rgba(245,158,11,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0 }}>
                      {c.type === 'client' ? '👤' : '🏭'}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>{c.name}</div>
                      <span className={`badge ${c.type === 'client' ? 'badge-neutral' : 'badge-warning'}`} style={{ fontSize: '0.68rem', marginTop: '2px' }}>
                        {c.type === 'client' ? 'Cliente' : 'Fornecedor'}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button className="btn-icon" onClick={() => openEdit(c)} title="Editar"><Edit2 size={14} /></button>
                    <button className="btn-icon danger" onClick={() => handleDelete(c.id)} title="Excluir"><Trash2 size={14} /></button>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {c.cpfCnpj && (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                      <User size={13} /> {c.cpfCnpj}
                    </div>
                  )}
                  {c.phone && (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                      <Phone size={13} /> {c.phone}
                    </div>
                  )}
                  {c.email && (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '0.82rem', color: 'var(--text-secondary)', overflow: 'hidden' }}>
                      <Mail size={13} style={{ flexShrink: 0 }} /> <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.email}</span>
                    </div>
                  )}
                  {c.notes && (
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '2px' }}>
                      {c.notes}
                    </div>
                  )}
                </div>

                {c.type === 'client' && revenue > 0 && (
                  <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Receita total</span>
                    <span style={{ color: 'var(--success)', fontWeight: 700 }}>
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(revenue)}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
