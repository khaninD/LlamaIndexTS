import cors from "cors";
import dotenv from "dotenv";
import express, { NextFunction, Request, Response } from "express";
import { runAgent } from "./agent";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Main agent endpoint
app.post("/api/chat", async (req: Request, res: Response) => {
  try {
    const { query, systemPrompt, apiKey, streaming = false } = req.body;

    if (!query) {
      return res.status(400).json({ error: "Query is required" });
    }

    // Use API key from request or fall back to env variable
    const openaiApiKey = apiKey || process.env.OPENAI_API_KEY;

    if (!openaiApiKey) {
      return res.status(400).json({ error: "OPENAI_API_KEY is required" });
    }

    console.log(`[${new Date().toISOString()}] Processing query:`, query);

    // Run agent with provided API key
    const result = await runAgent(query, systemPrompt, openaiApiKey);

    console.log(`[${new Date().toISOString()}] Query completed`);

    // Return result
    res.json({
      success: true,
      result: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Internal server error";
    console.error("Error processing request:", error);
    res.status(500).json({
      success: false,
      error: errorMessage,
      timestamp: new Date().toISOString(),
    });
  }
});

// Streaming endpoint (for future implementation)
app.post("/api/chat/stream", async (req: Request, res: Response) => {
  try {
    const { query, systemPrompt } = req.body;

    if (!query) {
      return res.status(400).json({ error: "Query is required" });
    }

    // Set up SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    // TODO: Implement streaming with agent workflow
    // For now, just return the result as a single event
    const result = await runAgent(query, systemPrompt);

    res.write(`data: ${JSON.stringify({ type: "result", data: result })}\n\n`);
    res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
    res.end();
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Error in streaming:", error);
    res.write(
      `data: ${JSON.stringify({ type: "error", error: errorMessage })}\n\n`,
    );
    res.end();
  }
});

// Error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    success: false,
    error: "Internal server error",
    timestamp: new Date().toISOString(),
  });
  next();
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 LlamaIndex Agent Server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🤖 Agent endpoint: POST http://localhost:${PORT}/api/chat`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM signal received: closing HTTP server");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("SIGINT signal received: closing HTTP server");
  process.exit(0);
});
