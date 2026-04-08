export async function invokeBackend(functionName, payload) {
  try {
    const isForge = window.self !== window.top;

    if (isForge) {
      const { invoke } = await import('@forge/bridge');
      return await invoke(functionName, payload);
    } else {
      // Localhost mock
      await new Promise((r) => setTimeout(r, 1000));
      return {
        error: false,
        text: `[localhost mock] You asked: "${payload.message}". Deploy to Confluence for real Gemini responses.`,
      };
    }
  } catch (err) {
    console.error('Bridge error:', err);
    return {
      error: true,
      text: 'Connection error. Please try again.',
    };
  }
}