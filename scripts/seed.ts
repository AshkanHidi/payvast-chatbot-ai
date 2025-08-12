
import { sql } from '@vercel/postgres';
import { config } from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from .env file
config();

interface KnowledgeEntrySeed {
  id: string;
  question: string;
  answer: string;
  type: string;
  system: string;
  hasVideo: boolean;
  hasDocument: boolean;
  hasImage: boolean;
  likes: number;
  dislikes: number;
  hits: number;
  videoUrl?: string;
  documentUrl?: string;
  imageUrl?: string;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KB_FILE_PATH = path.join(__dirname, '..', 'knowledge-base.json');

async function seedDatabase() {
  console.log('Starting database seeding process for similarity search...');

  try {
    // 1. Check for database connection string
    if (!process.env.POSTGRES_URL) {
      throw new Error('POSTGRES_URL environment variable is not set. Please check your .env file.');
    }
    const client = await sql.connect();
    console.log('Database connection successful.');

    // 2. Enable the pg_trgm extension for similarity search
    await client.query('CREATE EXTENSION IF NOT EXISTS pg_trgm;');
    console.log('PostgreSQL extension "pg_trgm" is enabled.');

    // 3. Create the knowledge_base table (dropping the old one if it exists to ensure a clean slate)
    await client.query('DROP TABLE IF EXISTS knowledge_base;');
    await client.query(`
      CREATE TABLE knowledge_base (
        id TEXT PRIMARY KEY,
        question TEXT NOT NULL,
        answer TEXT NOT NULL,
        type TEXT NOT NULL,
        system TEXT NOT NULL,
        "hasVideo" BOOLEAN DEFAULT FALSE,
        "hasDocument" BOOLEAN DEFAULT FALSE,
        "hasImage" BOOLEAN DEFAULT FALSE,
        likes INT DEFAULT 0,
        dislikes INT DEFAULT 0,
        hits INT DEFAULT 0,
        "videoUrl" TEXT,
        "documentUrl" TEXT,
        "imageUrl" TEXT
      );
    `);
    console.log('Table "knowledge_base" created successfully.');
    
    // 4. Create a GIN index for fast trigram-based similarity search
    await client.query('CREATE INDEX trgm_idx ON knowledge_base USING gin (question gin_trgm_ops);');
    console.log('GIN index on "question" for trigram search created.');


    // 5. Read the local JSON file
    const jsonData = await fs.readFile(KB_FILE_PATH, 'utf-8');
    const entries: KnowledgeEntrySeed[] = JSON.parse(jsonData);
    console.log(`Found ${entries.length} entries in knowledge-base.json.`);

    // 6. Insert data into the database
    console.log('Inserting entries into the database...');
    for (const entry of entries) {
      await client.query(
        `
        INSERT INTO knowledge_base (id, question, answer, type, system, "hasVideo", "hasDocument", "hasImage", likes, dislikes, hits, "videoUrl", "documentUrl", "imageUrl")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        ON CONFLICT (id) DO NOTHING;
        `,
        [
          entry.id,
          entry.question,
          entry.answer,
          entry.type,
          entry.system,
          entry.hasVideo || false,
          entry.hasDocument || false,
          entry.hasImage || false,
          entry.likes || 0,
          entry.dislikes || 0,
          entry.hits || 0,
          entry.videoUrl || null,
          entry.documentUrl || null,
          entry.imageUrl || null
        ]
      );
    }

    await client.release();
    console.log(`✅ Seeding complete. Successfully processed ${entries.length} entries.`);

  } catch (error) {
    console.error('❌ An error occurred during database seeding:', error);
    (process as any).exit(1);
  }
}

seedDatabase();
