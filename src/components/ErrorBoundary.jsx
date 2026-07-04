import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    this.setState({ info });
    console.error('[ErrorBoundary]', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '32px', background: 'rgba(239,68,68,0.08)',
          border: '1px solid rgba(239,68,68,0.3)', borderRadius: '12px',
          margin: '24px'
        }}>
          <h2 style={{ color: '#ef4444', marginBottom: '12px', fontSize: '1.1rem' }}>
            ⚠️ Erro ao renderizar esta página
          </h2>
          <pre style={{
            color: '#f87171', fontSize: '0.78rem', whiteSpace: 'pre-wrap',
            wordBreak: 'break-all', background: 'rgba(0,0,0,0.3)',
            padding: '12px', borderRadius: '8px', marginBottom: '12px',
            maxHeight: '200px', overflowY: 'auto'
          }}>
            {this.state.error?.toString()}
            {'\n\n'}
            {this.state.info?.componentStack}
          </pre>
          <button
            onClick={() => this.setState({ hasError: false, error: null, info: null })}
            style={{
              background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)',
              color: '#ef4444', padding: '8px 16px', borderRadius: '8px',
              cursor: 'pointer', fontSize: '0.85rem'
            }}
          >
            Tentar novamente
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
