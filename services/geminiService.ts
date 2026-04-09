let apiKeys: string[] = [];
let currentIndex = 0;

// load keys từ file public/keys.txt
export async function loadKeys() {
  if (apiKeys.length > 0) return;

  const res = await fetch("/keys.txt");
  const text = await res.text();

  apiKeys = text
    .split("\n")
    .map(k => k.trim())
    .filter(Boolean);

  console.log("Loaded keys:", apiKeys.length);
}

function getNextKey() {
  const key = apiKeys[currentIndex];
  currentIndex = (currentIndex + 1) % apiKeys.length;
  return key;
}

export async function callGeminiTTS(
  text: string,
  voice: string
): Promise<ArrayBuffer> {
  await loadKeys();

  let attempts = 0;

  while (attempts < apiKeys.length) {
    const apiKey = getNextKey();

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: `[voice:${voice}] ${text}` }]
              }
            ]
          })
        }
      );

      if (!res.ok) throw new Error("API error");

      const data = await res.json();

      // ⚠️ DEMO: giả lập audio
      const fake = new TextEncoder().encode(
        data.candidates?.[0]?.content?.parts?.[0]?.text || "audio"
      );

      return fake.buffer;

    } catch (err) {
      console.warn("Key failed:", apiKey);
      attempts++;
    }
  }

  throw new Error("All API keys failed");
}