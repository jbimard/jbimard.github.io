// server.js
import express from "express";
import cors from "cors";
import { NotionAPI } from "notion-client";

const app = express();
app.use(cors());

app.get("/api/notion/:id", async (req, res) => {
  try {
    const notion = new NotionAPI();
    const recordMap = await notion.getPage(req.params.id);
    res.json(recordMap);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

const port = process.env.PORT || 5175;
app.listen(port, () => console.log(`Notion API on http://localhost:${port}`));