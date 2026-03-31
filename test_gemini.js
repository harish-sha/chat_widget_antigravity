const { GoogleGenerativeAI } = require("@google/generative-ai");
const db = require("./db");

db.query("SELECT api_key FROM widget_ai_settings WHERE provider='gemini' AND api_key IS NOT NULL LIMIT 1", async (err, result) => {
  if (err || result.length === 0) {
     console.log("No Gemini key found in DB.");
     process.exit(0);
  }
  const apiKey = result[0].api_key;
  const genAI = new GoogleGenerativeAI(apiKey);
  
  try {
     console.log("Fetching models list...");
     const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
     const data = await response.json();
     const embeddingModels = data.models ? data.models.filter(m => m.name.includes("embed")) : [];
     console.log("Allowed Embedding Models for this API Key:");
     embeddingModels.forEach(m => console.log(m.name, m.supportedGenerationMethods));
     
  } catch(e) { 
     console.error("List fail:", e.message) 
  }
  process.exit(0);
});
