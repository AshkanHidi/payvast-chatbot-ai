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
  console.log('Starting database seeding process...');

  try {
    // 1. Check for database connection string
    if (!process.env.POSTGRES_URL) {
      throw new Error('POSTGRES_URL environment variable is not set. Please check your .env file.');
    }
    console.log('Database connection string found.');

    // 2. Create the knowledge_base table with a tsvector column for FTS
    // Using IF NOT EXISTS to prevent errors on re-running the script
    await sql`
      CREATE TABLE IF NOT EXISTS knowledge_base (
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
        "imageUrl" TEXT,
        document_vector TSVECTOR
      );
    `;
    console.log('Table "knowledge_base" is ready.');

    // 3. Create a trigger to automatically update the tsvector column
    await sql`
      CREATE OR REPLACE FUNCTION update_document_vector()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.document_vector := to_tsvector('simple', NEW.question || ' ' || NEW.answer);
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `;

    await sql`
      DROP TRIGGER IF EXISTS tsvector_update ON knowledge_base;
      CREATE TRIGGER tsvector_update
      BEFORE INSERT OR UPDATE ON knowledge_base
      FOR EACH ROW EXECUTE FUNCTION update_document_vector();
    `;
    console.log('Full-text search trigger configured.');

    // 4. Read the local JSON file
    const jsonData = await fs.readFile(KB_FILE_PATH, 'utf-8');
    const entries: KnowledgeEntrySeed[] = JSON.parse(jsonData);
    console.log(`Found ${entries.length} entries in knowledge-base.json.`);

    // 5. Insert data into the database
    console.log('Inserting entries into the database...');
    for (const entry of entries) {
      await sql`
        INSERT INTO knowledge_base (id, question, answer, type, system, "hasVideo", "hasDocument", "hasImage", likes, dislikes, hits, "videoUrl", "documentUrl", "imageUrl")
        VALUES (
          ${entry.id},
          ${entry.question},
          ${entry.answer},
          ${entry.type},
          ${entry.system},
          ${entry.hasVideo || false},
          ${entry.hasDocument || false},
          ${entry.hasImage || false},
          ${entry.likes || 0},
          ${entry.dislikes || 0},
          ${entry.hits || 0},
          ${entry.videoUrl || null},
          ${entry.documentUrl || null},
          ${entry.imageUrl || null}
        )
        ON CONFLICT (id) DO UPDATE SET
            question = EXCLUDED.question,
            answer = EXCLUDED.answer,
            type = EXCLUDED.type,
            system = EXCLUDED.system,
            "hasVideo" = EXCLUDED."hasVideo",
            "hasDocument" = EXCLUDED."hasDocument",
            "hasImage" = EXCLUDED."hasImage",
            likes = EXCLUDED.likes,
            dislikes = EXCLUDED.dislikes,
            hits = EXCLUDED.hits,
            "videoUrl" = EXCLUDED."videoUrl",
            "documentUrl" = EXCLUDED."documentUrl",
            "imageUrl" = EXCLUDED."imageUrl";
      `;
    }

    console.log(`✅ Seeding complete. Successfully processed ${entries.length} entries.`);

  } catch (error) {
    console.error('❌ An error occurred during database seeding:', error);
    (process as any).exit(1);
  }
}

seedDatabase();