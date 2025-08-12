import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { KnowledgeEntry } from './types.js';
import { sql } from '@vercel/postgres';
import { setGlobalDispatcher, ProxyAgent } from 'undici';
import dns from 'dns';

// --- DNS Configuration ---
dns.setDefaultResultOrder('ipv4first');

// Load environment variables from .env file
dotenv.config();

// --- Proxy Configuration ---
const proxy = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy;
if (proxy) {
    console.log(`System proxy detected at ${proxy}. Configuring for all outgoing requests.`);
    const dispatcher = new ProxyAgent(proxy);
    setGlobalDispatcher(dispatcher);
}

const app = express();
const port = process.env.PORT || 3001;

// Middlewares
app.use(cors());
app.use(express.json());

// --- Globals ---
let ai: GoogleGenAI;


// --- Knowledge Base Logic with PostgreSQL ---

const findRelevantContext = async (userQuestion: string, maxResults = 3): Promise<KnowledgeEntry[]> => {
    // Sanitize user question for full-text search query
    const queryText = userQuestion.trim().split(/\s+/).join(' | ');

    if (!queryText) return [];

    try {
        const { rows } = await sql`
            SELECT *, ts_rank(document_vector, to_tsquery('simple', ${queryText})) as relevance
            FROM knowledge_base
            WHERE document_vector @@ to_tsquery('simple', ${queryText})
            ORDER BY relevance DESC
            LIMIT ${maxResults};
        `;
        return rows as KnowledgeEntry[];
    } catch (error) {
        console.error('Error finding relevant context from DB:', error);
        return [];
    }
};

// --- API Endpoints ---

app.post('/api/chat', async (req, res) => {
    const { question } = req.body;

    if (!question || typeof question !== 'string') {
        return res.status(400).json({ error: 'Question is required and must be a string.' });
    }

    try {
        const contextEntries = await findRelevantContext(question);
        
        // Increment hits for the used entries
        if (contextEntries.length > 0) {
            const entryIds = contextEntries.map(e => e.id);
            await sql`
                UPDATE knowledge_base
                SET hits = hits + 1
                WHERE id = ANY(${entryIds});
            `;
        }

        const contextText = contextEntries.length > 0
            ? contextEntries.map(e => `Q: ${e.question}\nA: ${e.answer}`).join('\n---\n')
            : "No relevant context found.";

        const systemInstruction = `You are a helpful and friendly assistant for "Payvast Software Group". Your name is "Peyvastyar".
Answer the user's question based *only* on the provided context.
If the context does not contain the answer, state that you don't have enough information and suggest they ask in a different way or contact support.
Always answer in Persian. Be concise and clear.`;

        const prompt = `Context:\n${contextText}\n\nUser Question: ${question}`;
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                systemInstruction: systemInstruction,
                thinkingConfig: { thinkingBudget: 0 }
            }
        });

        res.json({ answer: response.text, sources: contextEntries });

    } catch (error: any) {
        console.error('Error with Gemini API:', error.message);
        if (error.cause) {
            console.error('Underlying cause:', error.cause);
        }
        res.status(500).json({ error: 'Failed to get a response from the AI assistant.' });
    }
});

// --- CRUD Endpoints for Knowledge Base ---

// READ all entries
app.get('/api/knowledge-base', async (req, res) => {
    try {
        const { rows } = await sql<KnowledgeEntry>`SELECT * FROM knowledge_base ORDER BY hits DESC;`;
        res.json(rows);
    } catch (error) {
        console.error('Failed to fetch knowledge base:', error);
        res.status(500).json({ error: 'Failed to fetch knowledge base.' });
    }
});

// CREATE a new entry
app.post('/api/knowledge-base', async (req, res) => {
    const { question, answer, type, system, hasVideo, hasDocument, hasImage, videoUrl, documentUrl, imageUrl } = req.body;
    if (!question || !answer || !type || !system) {
        return res.status(400).json({ error: 'Required fields are missing.' });
    }
    try {
        const result = await sql`
            INSERT INTO knowledge_base (question, answer, type, system, "hasVideo", "hasDocument", "hasImage", "videoUrl", "documentUrl", "imageUrl", likes, dislikes, hits)
            VALUES (${question}, ${answer}, ${type}, ${system}, ${!!hasVideo}, ${!!hasDocument}, ${!!hasImage}, ${videoUrl}, ${documentUrl}, ${imageUrl}, 0, 0, 0)
            RETURNING *;
        `;
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Failed to create entry:', error);
        res.status(500).json({ error: 'Failed to create new entry.' });
    }
});

// UPDATE an existing entry
app.put('/api/knowledge-base/:id', async (req, res) => {
    const { id } = req.params;
    const { question, answer, type, system, hasVideo, hasDocument, hasImage, videoUrl, documentUrl, imageUrl } = req.body;
    
    if (!question || !answer || !type || !system) {
        return res.status(400).json({ error: 'Required fields are missing.' });
    }

    try {
        const result = await sql`
            UPDATE knowledge_base
            SET 
                question = ${question}, 
                answer = ${answer}, 
                type = ${type}, 
                system = ${system}, 
                "hasVideo" = ${!!hasVideo}, 
                "hasDocument" = ${!!hasDocument}, 
                "hasImage" = ${!!hasImage}, 
                "videoUrl" = ${videoUrl}, 
                "documentUrl" = ${documentUrl}, 
                "imageUrl" = ${imageUrl}
            WHERE id = ${id}
            RETURNING *;
        `;
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Entry not found.' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Failed to update entry:', error);
        res.status(500).json({ error: 'Failed to update entry.' });
    }
});

// DELETE an entry
app.delete('/api/knowledge-base/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await sql`DELETE FROM knowledge_base WHERE id = ${id};`;
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Entry not found.' });
        }
        res.status(204).send(); // No Content
    } catch (error) {
        console.error('Failed to delete entry:', error);
        res.status(500).json({ error: 'Failed to delete entry.' });
    }
});

// FEEDBACK Endpoints
app.post('/api/knowledge-base/:id/like', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await sql`
            UPDATE knowledge_base 
            SET likes = likes + 1 
            WHERE id = ${id}
            RETURNING *;
        `;
        if (result.rowCount === 0) return res.status(404).json({ error: 'Entry not found.' });
        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error('Failed to like entry:', error);
        res.status(500).json({ error: 'Failed to process like.' });
    }
});

app.post('/api/knowledge-base/:id/dislike', async (req, res) => {
    const { id } = req.params;
     try {
        const result = await sql`
            UPDATE knowledge_base 
            SET dislikes = dislikes + 1 
            WHERE id = ${id}
            RETURNING *;
        `;
        if (result.rowCount === 0) return res.status(404).json({ error: 'Entry not found.' });
        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error('Failed to dislike entry:', error);
        res.status(500).json({ error: 'Failed to process dislike.' });
    }
});


// --- Start Server ---
const startServer = async () => {
    // 1. Validate API Key
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        console.error('API Key Loaded: No, it is undefined!');
        console.error('FATAL ERROR: API_KEY is not defined. It must be set as an environment variable.');
        // In a real server environment, we might exit, but for local dev we continue
        // to allow frontend work. For Vercel, this will cause the function to fail.
        if (process.env.VERCEL) {
             (process as any).exit(1);
        }
    } else {
        console.log(`API Key Loaded: Yes, starting with ${apiKey.slice(0, 7)}...`);
    }
    
    // 2. Initialize Gemini AI
    ai = new GoogleGenAI({ apiKey: apiKey || "INVALID_KEY" });

    // 3. Start listening
    app.listen(port, () => {
        console.log(`Server is running on http://localhost:${port}`);
    });
};

startServer();

// This export is required for Vercel to treat this file as a serverless function
export default app;