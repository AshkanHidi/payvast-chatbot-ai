
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

// Middlewares
app.use(cors() as any);
app.use(express.json() as any);

// --- Globals & Initialization ---
const apiKey = process.env.API_KEY;
if (!apiKey) {
    console.error('FATAL ERROR: API_KEY is not defined in environment variables.');
}
const ai = new GoogleGenAI({ apiKey: apiKey || 'INVALID_KEY' });


// --- Knowledge Base Logic with PostgreSQL ---

/**
 * Finds the most relevant knowledge base entries using the trigram distance operator (<->).
 * This method is highly efficient with a GIN index and accurately finds the "nearest neighbors"
 * to the user's question, effectively solving the issue of not finding exact or very similar matches.
 */
const findRelevantContext = async (userQuestion: string, maxResults = 3): Promise<KnowledgeEntry[]> => {
    if (!userQuestion || !userQuestion.trim()) return [];

    try {
        // Using the <-> operator for distance is more efficient with GIN/GiST indexes
        // for finding the "nearest neighbors" (most similar strings).
        const { rows } = await sql<KnowledgeEntry>`
            SELECT 
                *
            FROM knowledge_base
            ORDER BY question <-> ${userQuestion}
            LIMIT ${maxResults};
        `;
        return rows;
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
    
    if (!apiKey) {
        return res.status(500).json({ error: 'Server is not configured with an API key.' });
    }

    try {
        const contextEntries = await findRelevantContext(question);
        
        if (contextEntries.length > 0) {
            const entryIds = contextEntries.map(e => e.id);
            // Non-blocking update, no need to await
            sql`
                UPDATE knowledge_base
                SET hits = hits + 1
                WHERE id = ANY(${entryIds as any});
            `.catch(err => console.error("Failed to update hits count:", err));
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

app.get('/api/knowledge-base', async (req, res) => {
    try {
        const { rows } = await sql<KnowledgeEntry>`SELECT * FROM knowledge_base ORDER BY hits DESC;`;
        res.json(rows);
    } catch (error) {
        console.error('Failed to fetch knowledge base:', error);
        res.status(500).json({ error: 'Failed to fetch knowledge base.' });
    }
});

app.post('/api/knowledge-base', async (req, res) => {
    const { question, answer, type, system, hasVideo, hasDocument, hasImage, videoUrl, documentUrl, imageUrl } = req.body;
    
    // Trim input data for consistency
    const trimmedQuestion = question?.trim();
    const trimmedAnswer = answer?.trim();
    const trimmedSystem = system?.trim();

    if (!trimmedQuestion || !trimmedAnswer || !type || !trimmedSystem) {
        return res.status(400).json({ error: 'Required fields are missing.' });
    }
    try {
        const newId = `kb-${Date.now()}`;
        const result = await sql`
            INSERT INTO knowledge_base (id, question, answer, type, system, "hasVideo", "hasDocument", "hasImage", "videoUrl", "documentUrl", "imageUrl")
            VALUES (${newId}, ${trimmedQuestion}, ${trimmedAnswer}, ${type}, ${trimmedSystem}, ${!!hasVideo}, ${!!hasDocument}, ${!!hasImage}, ${videoUrl || null}, ${documentUrl || null}, ${imageUrl || null})
            RETURNING *;
        `;
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Failed to create entry:', error);
        res.status(500).json({ error: 'Failed to create new entry.' });
    }
});

app.put('/api/knowledge-base/:id', async (req, res) => {
    const { id } = req.params;
    const { question, answer, type, system, hasVideo, hasDocument, hasImage, videoUrl, documentUrl, imageUrl } = req.body;
    
    // Trim input data for consistency
    const trimmedQuestion = question?.trim();
    const trimmedAnswer = answer?.trim();
    const trimmedSystem = system?.trim();

    if (!trimmedQuestion || !trimmedAnswer || !type || !trimmedSystem) {
        return res.status(400).json({ error: 'Required fields are missing.' });
    }

    try {
        const result = await sql`
            UPDATE knowledge_base
            SET 
                question = ${trimmedQuestion}, 
                answer = ${trimmedAnswer}, 
                type = ${type}, 
                system = ${trimmedSystem}, 
                "hasVideo" = ${!!hasVideo}, 
                "hasDocument" = ${!!hasDocument}, 
                "hasImage" = ${!!hasImage}, 
                "videoUrl" = ${videoUrl || null}, 
                "documentUrl" = ${documentUrl || null}, 
                "imageUrl" = ${imageUrl || null}
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

app.delete('/api/knowledge-base/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await sql`DELETE FROM knowledge_base WHERE id = ${id};`;
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Entry not found.' });
        }
        res.status(204).send();
    } catch (error) {
        console.error('Failed to delete entry:', error);
        res.status(500).json({ error: 'Failed to delete entry.' });
    }
});

// This export is required for Vercel to treat this file as a serverless function
export default app;