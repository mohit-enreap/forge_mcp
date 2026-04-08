import React, { useState } from 'react';

export default function InputBar({ onSend, isLoading }) {
  const [text, setText] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!text.trim() || isLoading) return;
    onSend(text.trim());
    setText('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div style={{
      padding: '12px 20px 16px',
      backgroundColor: 'white',
      borderTop: '2px solid #DFE1E6',
      flexShrink: 0,
    }}>
      <form
        onSubmit={handleSubmit}
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: '10px',
          backgroundColor: '#F4F5F7',
          border: '2px solid #DFE1E6',
          borderRadius: '8px',
          padding: '8px 12px',
        }}
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything... (Enter to send)"
          rows={1}
          disabled={isLoading}
          style={{
            flex: 1,
            backgroundColor: 'transparent',
            border: 'none',
            outline: 'none',
            fontSize: '14px',
            color: '#172B4D',
            resize: 'none',
            fontFamily: 'inherit',
            lineHeight: '1.5',
            minHeight: '24px',
            maxHeight: '120px',
            overflowY: 'auto',
          }}
        />
        <button
          type="submit"
          disabled={!text.trim() || isLoading}
          style={{
            backgroundColor: text.trim() && !isLoading
              ? '#0052CC' : '#F4F5F7',
            color: text.trim() && !isLoading
              ? 'white' : '#A5ADBA',
            border: '1px solid',
            borderColor: text.trim() && !isLoading
              ? '#0052CC' : '#DFE1E6',
            borderRadius: '4px',
            padding: '6px 16px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: text.trim() && !isLoading
              ? 'pointer' : 'not-allowed',
            fontFamily: 'inherit',
            flexShrink: 0,
            transition: 'all 0.15s',
          }}
        >
          {isLoading ? 'Sending...' : 'Send'}
        </button>
      </form>

      <p style={{
        fontSize: '11px',
        color: '#A5ADBA',
        margin: '6px 0 0',
        textAlign: 'center',
      }}>
        Press Enter to send · Shift+Enter for new line
      </p>
    </div>
  );
}