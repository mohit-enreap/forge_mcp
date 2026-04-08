import React from 'react';

export default function MessageBubble({ message }) {
  const isUser = message.role === 'user';

  const renderContent = (content) => {
    return content.split('\n').map((line, i) => (
      <span key={i}>
        {line
          .replace(/\*\*(.*?)\*\*/g, '$1')
          .replace(/^\*\s/, '• ')
        }
        <br />
      </span>
    ));
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: isUser ? 'row-reverse' : 'row',
      alignItems: 'flex-start',
      gap: '8px',
      marginBottom: '16px',
    }}>

      {/* Avatar */}
      <div style={{
        width: '32px',
        height: '32px',
        borderRadius: '50%',
        backgroundColor: isUser ? '#0052CC' : '#6554C0',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '12px',
        fontWeight: '700',
        flexShrink: 0,
      }}>
        {isUser ? 'U' : 'AI'}
      </div>

      {/* Bubble */}
      <div style={{
        maxWidth: '70%',
        padding: '10px 14px',
        borderRadius: isUser
          ? '12px 2px 12px 12px'
          : '2px 12px 12px 12px',
        backgroundColor: isUser ? '#0052CC' : '#FFFFFF',
        color: isUser ? '#FFFFFF' : '#172B4D',
        fontSize: '14px',
        lineHeight: '1.6',
        boxShadow: '0 1px 2px rgba(9,30,66,0.12)',
        border: isUser ? 'none' : '1px solid #DFE1E6',
        wordBreak: 'break-word',
      }}>
        {renderContent(message.content)}
      </div>
    </div>
  );
}