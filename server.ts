
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

/**
 * Normalizes Persian text for consistent searching and storage.
 * - Converts Arabic 'ي' and 'ك' to their Persian equivalents.
 * - Handles special characters like ZWNJ.
 * - Applies NFC Unicode normalization.
 * - Trims and collapses whitespace.
 */
const normalizePersian = (text: string | null | undefined): string => {
    if (!text) return '';
    return text
        .normalize('NFC')
        .replace(/ي/g, 'ی') // Arabic Yeh to Persian Yeh
        .replace(/ك/g, 'ک') // Arabic Kaf to Persian Kaf
        .replace(/‌/g, ' ') // Replace Zero-width non-joiner with a space
        .replace(/\s+/g, ' ') // Collapse multiple whitespace chars into a single space
        .trim();
};


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
 * Finds relevant knowledge base entries using trigram similarity.
 * It filters entries below a certain similarity threshold to ensure relevance
 * and then orders them by distance (most similar first).
 */
const findRelevantContext = async (userQuestion: string, maxResults = 3, similarityThreshold = 0.25): Promise<KnowledgeEntry[]> => {
    if (!userQuestion || !userQuestion.trim()) return [];

    try {
        const { rows } = await sql<KnowledgeEntry>`
            SELECT *
            FROM knowledge_base
            WHERE similarity(question, ${userQuestion}) > ${similarityThreshold}
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
        const normalizedQuestion = normalizePersian(question);
        const contextEntries = await findRelevantContext(normalizedQuestion);

        if (contextEntries.length > 0) {
            // DEBUG: Bypass Gemini and return direct DB results.
            const combinedAnswer = contextEntries
                .map(e => e.answer)
                .join('\n\n---\n\n');

            // Update hits count for found entries.
            const entryIds = contextEntries.map(e => e.id);
            sql`
                UPDATE knowledge_base
                SET hits = hits + 1
                WHERE id = ANY(${entryIds as any});
            `.catch(err => console.error("Failed to update hits count:", err));

            res.json({ answer: combinedAnswer, sources: contextEntries });
        
        } else {
            // DEBUG: If no context found, return a message indicating direct search failed.
            res.json({ 
                answer: "موردی در پایگاه دانش برای این سوال یافت نشد. (جستجوی مستقیم بدون دخالت هوش مصنوعی)",
                sources: [] 
            });
        }

    } catch (error: any) {
        console.error('Error during direct database search:', error.message);
        res.status(500).json({ error: 'Failed to search the knowledge base.' });
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
    
    // Normalize text data for consistency
    const normalizedQuestion = normalizePersian(question);
    const normalizedAnswer = normalizePersian(answer);
    const normalizedSystem = normalizePersian(system);

    if (!normalizedQuestion || !normalizedAnswer || !type || !normalizedSystem) {
        return res.status(400).json({ error: 'Required fields are missing.' });
    }
    try {
        const newId = `kb-${Date.now()}`;
        const result = await sql`
            INSERT INTO knowledge_base (id, question, answer, type, system, "hasVideo", "hasDocument", "hasImage", "videoUrl", "documentUrl", "imageUrl")
            VALUES (${newId}, ${normalizedQuestion}, ${normalizedAnswer}, ${type}, ${normalizedSystem}, ${!!hasVideo}, ${!!hasDocument}, ${!!hasImage}, ${videoUrl || null}, ${documentUrl || null}, ${imageUrl || null})
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
    
    // Normalize text data for consistency
    const normalizedQuestion = normalizePersian(question);
    const normalizedAnswer = normalizePersian(answer);
    const normalizedSystem = normalizePersian(system);

    if (!normalizedQuestion || !normalizedAnswer || !type || !normalizedSystem) {
        return res.status(400).json({ error: 'Required fields are missing.' });
    }

    try {
        const result = await sql`
            UPDATE knowledge_base
            SET 
                question = ${normalizedQuestion}, 
                answer = ${normalizedAnswer}, 
                type = ${type}, 
                system = ${normalizedSystem}, 
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