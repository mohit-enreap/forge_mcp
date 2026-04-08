import React from 'react';

export default function TypingIndicator() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: '8px',
      marginBottom: '16px',
    }}>
      {/* Avatar */}
      <div style={{
        width: '32px',
        height: '32px',
        borderRadius: '50%',
        backgroundColor: '#6554C0',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '12px',
        fontWeight: '700',
        flexShrink: 0,
      }}>
        AI
      </div>

      {/* Dots bubble */}
      <div style={{
        padding: '12px 16px',
        borderRadius: '2px 12px 12px 12px',
        backgroundColor: '#FFFFFF',
        border: '1px solid #DFE1E6',
        boxShadow: '0 1px 2px rgba(9,30,66,0.12)',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
      }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              backgroundColor: '#A5ADBA',
              animation: 'bounce 1.2s ease-in-out infinite',
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
}