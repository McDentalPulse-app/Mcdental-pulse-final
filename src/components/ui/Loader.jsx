import React from 'react';

const Loader = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: 'linear-gradient(135deg, #f4fbf9 0%, #f8fafc 42%, #ffffff 100%)' }}>
      <div style={{ width: 40, height: 40, border: '4px solid rgba(0, 168, 143, 0.2)', borderTopColor: '#00A88F', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
      <p style={{ marginTop: 16, color: '#64748b', fontWeight: 600, fontSize: 14 }}>Cargando módulo...</p>
    </div>
  );
};

export default Loader;
