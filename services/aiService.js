const OpenAI = require("openai");
const { GoogleGenerativeAI } = require("@google/generative-ai");

exports.generate = async (options) => {
  const { provider, apiKey, model, temperature, maxTokens, systemPrompt, messages } = options;

  if (!apiKey) throw new Error("API Key is missing for the configured provider.");

  if (provider === "gemini") {
    const genAI = new GoogleGenerativeAI(apiKey);
    
    const geminiModel = genAI.getGenerativeModel({
      model: model || "gemini-1.5-flash",
      systemInstruction: systemPrompt || "You are a helpful assistant"
    });

    const generationConfig = {
      temperature: temperature !== undefined ? parseFloat(temperature) : 0.7,
      maxOutputTokens: maxTokens ? parseInt(maxTokens) : 500,
    };

    // Format Messages to Gemini's expected contents array {role, parts}
    // Ensures alternating structure and avoids consecutive roles.
    const contents = [];
    for (let m of messages) {
      const role = m.role === 'assistant' ? 'model' : 'user';
      if (contents.length > 0 && contents[contents.length - 1].role === role) {
        contents[contents.length - 1].parts[0].text += "\n" + m.content;
      } else {
        contents.push({ role, parts: [{ text: m.content }] });
      }
    }

    const result = await geminiModel.generateContent({ contents, generationConfig });
    if (!result.response || !result.response.text) {
        throw new Error("Invalid response received from Gemini SDK");
    }
    return result.response.text();

  } else {
    // Default to OpenAI
    const openai = new OpenAI({ apiKey });
    
    // Inject system prompt natively into the history array
    const openAIMessages = [
      { role: "system", content: systemPrompt || "You are a helpful assistant" }
    ];

    // Combine consecutive identical roles just in case some OpenAI models are strict
    for (let m of messages) {
      const role = m.role;
      if (openAIMessages.length > 0 && openAIMessages[openAIMessages.length - 1].role === role) {
        openAIMessages[openAIMessages.length - 1].content += "\n" + m.content;
      } else {
        openAIMessages.push({ role, content: m.content });
      }
    }

    const completion = await openai.chat.completions.create({
      model: model || "gpt-3.5-turbo",
      messages: openAIMessages,
      temperature: temperature !== undefined ? parseFloat(temperature) : 0.7,
      max_tokens: maxTokens ? parseInt(maxTokens) : 500
    });

    return completion.choices[0].message.content;
  }
};
