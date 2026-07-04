import React, { useContext, useState, useMemo } from 'react';
import { AppContext } from '../App';
import { Printer, FileText, Info } from 'lucide-react';

const fmt = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val ?? 0);

export default function Taxes() {
  const { dbData } = useContext(AppContext);
  const transactions = Array.isArray(dbData?.transactions) ? dbData.transactions : [];
  
  const today = new Date();
  const currentYear = today.getFullYear();
  const [selectedYear, setSelectedYear] = useState(String(currentYear - 1)); // Default to previous year

  const companyType = dbData?.company?.activityType || 'services';
  
  const exemptionRate = {
    'services': 0.32,
    'commerce': 0.08,
    'passenger': 0.16
  }[companyType] || 0.32;

  const taxData = useMemo(() => {
    const yearTrans = transactions.filter(t => t.date && t.date.startsWith(selectedYear));
    const grossRevenue = yearTrans.filter(t => t.type === 'income').reduce((a, c) => a + Number(c.amount), 0);
    const provenExpenses = yearTrans.filter(t => t.type === 'expense').reduce((a, c) => a + Number(c.amount), 0);
    
    // For DASN: categorize income
    const commerceRevenue = yearTrans.filter(t => t.type === 'income' && t.category && (t.category.toLowerCase().includes('venda') || t.category.toLowerCase().includes('comércio') || t.category.toLowerCase().includes('produto'))).reduce((a, c) => a + Number(c.amount), 0);
    const serviceRevenue = grossRevenue - commerceRevenue; // Assuming the rest is services/others

    const evidencedProfit = Math.max(grossRevenue - provenExpenses, 0); // Lucro Evidenciado
    const exemptPortion = grossRevenue * exemptionRate; // Parcela Isenta
    const taxablePortion = Math.max(evidencedProfit - exemptPortion, 0); // Rendimento Tributável
    
    return { grossRevenue, provenExpenses, evidencedProfit, exemptPortion, taxablePortion, commerceRevenue, serviceRevenue };
  }, [transactions, selectedYear, exemptionRate]);

  const availableYears = useMemo(() => {
    const years = new Set([currentYear]);
    transactions.forEach(t => {
      if (t.date) years.add(parseInt(String(t.date).substring(0, 4)));
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [transactions, currentYear]);

  return (
    <div className="animate-in print-container">
      <div className="page-header no-print">
        <div>
          <h1 className="page-title">Impostos e Declarações</h1>
          <p className="page-subtitle">DASN-SIMEI e IRPF</p>
        </div>
        <button className="btn-primary" onClick={() => window.print()}>
          <Printer size={16}/> Imprimir Resumo
        </button>
      </div>

      <div className="glass-panel no-print" style={{ padding: '20px', marginBottom: '24px', display: 'flex', gap: '20px', alignItems: 'center' }}>
        <div>
          <label className="form-label" style={{ marginBottom: '4px' }}>Ano-calendário</label>
          <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)} style={{ width: '200px' }}>
            {availableYears.map(y => (
              <option key={y} value={y}>{y} (Declarado em {y+1})</option>
            ))}
          </select>
        </div>
        
        <div style={{ flex: 1 }}>
          <div className="alert alert-info" style={{ marginBottom: 0, padding: '12px' }}>
            <Info size={16} style={{ flexShrink: 0 }} />
            <div style={{ fontSize: '0.82rem' }}>
              Com base no seu cadastro, a empresa é classificada como <strong>
                {companyType === 'services' ? 'Prestação de Serviços' : companyType === 'commerce' ? 'Comércio, Indústria e Transporte de Cargas' : 'Transporte de Passageiros'}
              </strong>. 
              Isso garante uma presunção de isenção de <strong>{(exemptionRate * 100)}%</strong> sobre a receita bruta.
            </div>
          </div>
        </div>
      </div>

      <div className="print-content" style={{ background: 'white', color: 'black', padding: '40px', borderRadius: '8px' }}>
        
        {/* DASN-SIMEI Section */}
        <h1 style={{ fontSize: '1.6rem', borderBottom: '2px solid #ccc', paddingBottom: '10px', marginBottom: '20px', color: '#1e293b' }}>
          Declaração Anual (DASN-SIMEI) — Ano {selectedYear}
        </h1>
        <p style={{ marginBottom: '20px', fontSize: '1.05rem', color: '#444' }}>
          Valores consolidados para o preenchimento da declaração anual do MEI no portal do Simples Nacional.
        </p>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '1.1rem', marginBottom: '40px' }}>
          <tbody>
            <tr style={{ background: '#f8fafc', borderTop: '2px solid #cbd5e1' }}>
              <td style={{ padding: '16px', width: '70%' }}>
                <strong>Receita de Comércio e Indústria</strong>
                <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 'normal', marginTop: '4px' }}>
                  Vendas de produtos e mercadorias.
                </div>
              </td>
              <td style={{ padding: '16px', textAlign: 'right', fontWeight: 'bold' }}>{fmt(taxData.commerceRevenue)}</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
              <td style={{ padding: '16px' }}>
                <strong>Receita de Prestação de Serviços</strong>
                <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 'normal', marginTop: '4px' }}>
                  Serviços prestados.
                </div>
              </td>
              <td style={{ padding: '16px', textAlign: 'right', fontWeight: 'bold' }}>{fmt(taxData.serviceRevenue)}</td>
            </tr>
            <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #94a3b8' }}>
              <td style={{ padding: '16px' }}>
                <strong>Receita Bruta Total</strong>
              </td>
              <td style={{ padding: '16px', textAlign: 'right', fontWeight: 'bold' }}>{fmt(taxData.grossRevenue)}</td>
            </tr>
          </tbody>
        </table>

        {/* IRPF Section */}
        <h1 style={{ fontSize: '1.6rem', borderBottom: '2px solid #ccc', paddingBottom: '10px', marginBottom: '20px', color: '#1e293b' }}>
          Resumo para a Declaração de IRPF — Ano {selectedYear}
        </h1>
        
        <p style={{ marginBottom: '20px', fontSize: '1.05rem', color: '#444' }}>
          Utilize os valores calculados abaixo para preencher a sua Declaração de Imposto de Renda da Pessoa Física (DIRPF), caso seja obrigado a declarar.
        </p>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '1.1rem', marginBottom: '30px' }}>
          <tbody>
            <tr style={{ background: '#f8fafc', borderTop: '2px solid #cbd5e1' }}>
              <td style={{ padding: '16px', width: '70%' }}>
                <strong>1. Receita Bruta Total</strong>
                <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 'normal', marginTop: '4px' }}>
                  Soma de todas as entradas do ano.
                </div>
              </td>
              <td style={{ padding: '16px', textAlign: 'right', fontWeight: 'bold' }}>{fmt(taxData.grossRevenue)}</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
              <td style={{ padding: '16px' }}>
                <strong>2. Despesas Comprovadas</strong>
                <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 'normal', marginTop: '4px' }}>
                  Soma das despesas (água, luz, telefone, aluguel, compras, DAS, etc).
                </div>
              </td>
              <td style={{ padding: '16px', textAlign: 'right', color: '#ef4444' }}>- {fmt(taxData.provenExpenses)}</td>
            </tr>
            <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
              <td style={{ padding: '16px' }}>
                <strong>3. Lucro Evidenciado</strong>
                <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 'normal', marginTop: '4px' }}>
                  (Receita Bruta - Despesas Comprovadas). É o seu lucro real.
                </div>
              </td>
              <td style={{ padding: '16px', textAlign: 'right', fontWeight: 'bold' }}>{fmt(taxData.evidencedProfit)}</td>
            </tr>
          </tbody>
        </table>

        <h3 style={{ fontSize: '1.2rem', marginBottom: '16px', color: '#333' }}>Onde lançar no programa do IRPF:</h3>
        
        <div style={{ display: 'grid', gap: '20px' }}>
          <div style={{ border: '2px solid #10b981', borderRadius: '8px', overflow: 'hidden' }}>
            <div style={{ background: '#ecfdf5', padding: '12px 16px', borderBottom: '1px solid #a7f3d0' }}>
              <strong style={{ color: '#047857' }}>Ficha: Rendimentos Isentos e Não Tributáveis</strong>
              <div style={{ fontSize: '0.85rem', color: '#059669', marginTop: '2px' }}>Linha 13 – Rendimento de sócio ou titular de microempresa...</div>
            </div>
            <div style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong>Parcela Isenta do MEI</strong>
                <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '4px' }}>
                  Calculado como {exemptionRate * 100}% da Receita Bruta Total.
                </div>
              </div>
              <span style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#10b981' }}>{fmt(taxData.exemptPortion)}</span>
            </div>
          </div>

          <div style={{ border: '2px solid #ef4444', borderRadius: '8px', overflow: 'hidden' }}>
            <div style={{ background: '#fef2f2', padding: '12px 16px', borderBottom: '1px solid #fecaca' }}>
              <strong style={{ color: '#b91c1c' }}>Ficha: Rendimentos Tributáveis Recebidos de PJ</strong>
              <div style={{ fontSize: '0.85rem', color: '#dc2626', marginTop: '2px' }}>Fonte Pagadora: O seu próprio CNPJ.</div>
            </div>
            <div style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong>Rendimento Tributável</strong>
                <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '4px' }}>
                  Calculado como (Lucro Evidenciado - Parcela Isenta).
                </div>
              </div>
              <span style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#ef4444' }}>{fmt(taxData.taxablePortion)}</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
