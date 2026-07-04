import React, { useContext, useState, useEffect } from 'react';
import { AppContext } from '../App';
import { format, subMonths, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Search, Save, ExternalLink, Printer, RefreshCw } from 'lucide-react';

export default function Company() {
  const { dbData, saveDb } = useContext(AppContext);
  const [form, setForm] = useState({ ...dbData.company });
  const [loading, setLoading] = useState(false);
  const [cnpjInfo, setCnpjInfo] = useState(null);
  const [saved, setSaved] = useState(false);

  const handleChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const buscarCNPJ = async () => {
    const cnpjNumerico = form.cnpj.replace(/\D/g, '');
    if (cnpjNumerico.length !== 14) { alert('Digite um CNPJ válido com 14 dígitos.'); return; }
    setLoading(true);
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjNumerico}`);
      if (!res.ok) throw new Error('CNPJ não encontrado na Receita Federal.');
      const data = await res.json();
      setCnpjInfo(data);
      setForm(prev => ({
        ...prev,
        cnpj: data.cnpj,
        name: data.razao_social || data.nome_fantasia || prev.name,
        email: data.email || prev.email || '',
        phone: data.ddd_telefone_1 ? `(${data.ddd_telefone_1})` : prev.phone || '',
        address: data.logradouro ? `${data.logradouro}, ${data.numero} — ${data.bairro}, ${data.municipio}/${data.uf}` : prev.address || '',
        cnaes: data.cnaes_secundarios?.map(c => c.descricao) || prev.cnaes || [],
      }));
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = (e) => {
    e.preventDefault();
    saveDb({ ...dbData, company: form });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleOpenPgmeiBrowser = () => {
    if (form.cnpj) {
      const numericCnpj = form.cnpj.replace(/\D/g, '');
      navigator.clipboard.writeText(numericCnpj).then(() => {
        alert(`CNPJ ${numericCnpj} copiado para a área de transferência! Redirecionando para o PGMEI...`);
      }).catch(() => {});
    }
    if (window.api && window.api.openExternal) {
      window.api.openExternal('https://www8.receita.fazenda.gov.br/SimplesNacional/Aplicacoes/ATSPO/pgmei.app/Identificacao');
    } else {
      window.open('https://www8.receita.fazenda.gov.br/SimplesNacional/Aplicacoes/ATSPO/pgmei.app/Identificacao', '_blank');
    }
  };

  return (
    <div className="animate-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Empresa</h1>
          <p className="page-subtitle">Dados cadastrais e controle do DAS</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px', marginBottom: '24px' }}>
        <div className="glass-panel" style={{ padding: '28px' }}>
          <h2 style={{ fontSize: '1.05rem', marginBottom: '22px' }}>Dados Cadastrais</h2>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
            <div style={{ flex: 1 }}>
              <label className="form-label">CNPJ</label>
              <input name="cnpj" value={form.cnpj} onChange={handleChange} placeholder="00.000.000/0001-00" />
            </div>
            <div style={{ alignSelf: 'flex-end', paddingBottom: '0px' }}>
              <button type="button" className="btn-secondary" onClick={buscarCNPJ} disabled={loading} style={{ height: '40px' }}>
                <Search size={16} /> {loading ? 'Buscando...' : 'Buscar'}
              </button>
            </div>
          </div>

          <form onSubmit={handleSave}>
            <div className="form-group">
              <label className="form-label">Razão Social / Nome *</label>
              <input required name="name" value={form.name} onChange={handleChange} placeholder="Nome da sua empresa" />
            </div>
            <div className="form-group">
              <label className="form-label">Tipo de Atividade Principal</label>
              <select name="activityType" value={form.activityType || 'services'} onChange={handleChange}>
                <option value="services">Prestação de Serviços (Isenção de 32%)</option>
                <option value="commerce">Comércio, Indústria e Transporte de Cargas (Isenção de 8%)</option>
                <option value="passenger">Transporte de Passageiros (Isenção de 16%)</option>
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">E-mail</label>
                <input type="email" name="email" value={form.email || ''} onChange={handleChange} placeholder="contato@empresa.com" />
              </div>
              <div className="form-group">
                <label className="form-label">Telefone</label>
                <input name="phone" value={form.phone || ''} onChange={handleChange} placeholder="(11) 99999-9999" />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Mês de Abertura (Pró-rata)</label>
                <input type="month" name="startMonth" value={form.startMonth || ''} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label className="form-label">Endereço</label>
                <input name="address" value={form.address || ''} onChange={handleChange} placeholder="Rua, número..." />
              </div>
            </div>

            {cnpjInfo && (
              <div className="alert alert-info" style={{ marginTop: '4px', marginBottom: '16px' }}>
                <ExternalLink size={16} />
                <div>
                  <strong>Dados preenchidos automaticamente da Receita Federal.</strong>
                  {cnpjInfo.cnae_fiscal_descricao && (
                    <div style={{ marginTop: '4px', fontSize: '0.82rem' }}>
                      Atividade Principal: {cnpjInfo.cnae_fiscal_descricao}
                    </div>
                  )}
                  <div style={{ fontSize: '0.82rem' }}>
                    Situação: <strong>{cnpjInfo.descricao_situacao_cadastral}</strong>
                  </div>
                </div>
              </div>
            )}

            <button type="submit" className="btn-primary" style={{ width: '100%' }}>
              <Save size={16} /> {saved ? '✓ Salvo!' : 'Salvar Informações'}
            </button>
          </form>
        </div>

        {/* DAS Portal Access */}
        <div className="glass-panel" style={{ padding: '28px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: '1.05rem', marginBottom: '12px' }}>Guia de Pagamento DAS</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '16px', lineHeight: '1.4' }}>
              Para emitir, consultar ou pagar suas guias mensais de DAS, acesse o portal oficial do PGMEI da Receita Federal.
            </p>
            <div className="alert alert-info" style={{ fontSize: '0.8rem', padding: '12px', marginBottom: '20px' }}>
              Ao clicar no botão abaixo, o número do seu CNPJ será copiado automaticamente para facilitar a colagem na página de identificação do governo.
            </div>
          </div>

          <button
            type="button"
            className="btn-primary"
            onClick={handleOpenPgmeiBrowser}
            style={{ width: '100%', height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            <ExternalLink size={16} /> Acessar Portal PGMEI
          </button>
        </div>
      </div>
    </div>
  );
}
