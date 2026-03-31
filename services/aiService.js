const OpenAI = require("openai");
const { GoogleGenerativeAI } = require("@google/generative-ai");

exports.generate = async (options) => {
  const { provider, apiKey, model, temperature, maxTokens, systemPrompt, messages } = options;

  if (!apiKey) throw new Error("API Key is missing for the configured provider.");

  const start_time = Date.now();
  let resultObj = {
    answer: "",
    metrics: {
      latency: 0,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0
    }
  };

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

    resultObj.answer = result.response.text();
    resultObj.metrics.latency = Date.now() - start_time;

    if (result.response.usageMetadata) {
      resultObj.metrics.promptTokens = result.response.usageMetadata.promptTokenCount || 0;
      resultObj.metrics.completionTokens = result.response.usageMetadata.candidatesTokenCount || 0;
      resultObj.metrics.totalTokens = result.response.usageMetadata.totalTokenCount || 0;
    }

    return resultObj;

  } else {
    // Default to OpenAI
    const openai = new OpenAI({ apiKey });

    const openAIMessages = [
      { role: "system", content: systemPrompt || "You are a helpful assistant" }
    ];

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

    resultObj.answer = completion.choices[0].message.content;
    resultObj.metrics.latency = Date.now() - start_time;

    if (completion.usage) {
      resultObj.metrics.promptTokens = completion.usage.prompt_tokens || 0;
      resultObj.metrics.completionTokens = completion.usage.completion_tokens || 0;
      resultObj.metrics.totalTokens = completion.usage.total_tokens || 0;
    }

    return resultObj;
  }
};

exports.embedText = async (provider, apiKey, text) => {
  if (!apiKey) throw new Error("API Key missing for Embeddings");
  const cleanText = text.replace(/\n/g, " ").trim();
  if (!cleanText || cleanText.length === 0) throw new Error("Text is empty; skipping embedding injection.");

  if (provider === "gemini") {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
    const result = await model.embedContent(cleanText);
    return result.embedding.values;
  } else {
    // Default to OpenAI
    const openai = new OpenAI({ apiKey });
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: cleanText,
    });
    return response.data[0].embedding;
  }
};
