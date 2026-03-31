const db = require("./db");
const aiService = require("./services/aiService");

db.query(`SELECT kb.id, kb.content, s.provider, s.api_key FROM ai_knowledge_base kb JOIN widget_ai_settings s ON kb.widget_id = s.widget_id WHERE kb.embedding IS NULL AND s.api_key IS NOT NULL`, async (err, results) => {
  if (err) {
    console.error("DB error:", err);
    process.exit(1);
  }

  if (results.length === 0) {
    console.log("No null embeddings found to fix.");
    process.exit(0);
  }

  console.log(`Found ${results.length} rows missing embeddings (likely from the 404 crash window). Processing...`);

  for (let row of results) {
    try {
      if (!row.content) continue;
      const vector = await aiService.embedText(row.provider, row.api_key, row.content);
      const strVector = JSON.stringify(vector);

      await new Promise((resolve) => {
        db.query(`UPDATE ai_knowledge_base SET embedding = ? WHERE id = ?`, [strVector, row.id], (uerr) => {
          if (uerr) console.error(`Failed to update ID ${row.id}:`, uerr.message);
          else console.log(`Successfully healed matrix for ID ${row.id}`);
          resolve();
        });
      });
    } catch (e) {
      console.error(`Failed embedding ID ${row.id}: ${e.message}`);
    }
  }

  console.log("Done.");
  process.exit(0);
});
