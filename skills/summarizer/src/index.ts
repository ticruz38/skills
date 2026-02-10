#!/usr/bin/env node

import * as sqlite3 from 'sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export type SummaryLength = 'short' | 'medium' | 'long';
export type SummaryFormat = 'paragraph' | 'bullet' | 'numbered';
export type DocumentType = 'article' | 'document' | 'email' | 'meeting' | 'research';

export interface SummarizeOptions {
  text: string;
  title?: string;
  length?: SummaryLength;
  format?: SummaryFormat;
  documentType?: DocumentType;
  extractKeyPoints?: boolean;
  maxKeyPoints?: number;
  focus?: string[];
  language?: string;
}

export interface SummaryResult {
  id?: number;
  summary: string;
  keyPoints: string[];
  originalLength: number;
  summaryLength: number;
  compressionRatio: number;
  documentType: DocumentType;
  length: SummaryLength;
  format: SummaryFormat;
  title?: string;
  createdAt: Date;
}

export interface SummaryRecord {
  id?: number;
  title?: string;
  original_text: string;
  summary: string;
  key_points: string;
  original_length: number;
  summary_length: number;
  compression_ratio: number;
  document_type: DocumentType;
  length: SummaryLength;
  format: SummaryFormat;
  focus_areas?: string;
  created_at: string;
}

function runWithResult(db: sqlite3.Database, sql: string, params: any[] = []): Promise<{ lastID: number; changes: number }> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(this: sqlite3.RunResult, err: Error | null) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

export class SummarizerSkill {
  private db: sqlite3.Database | null = null;
  private dbPath: string;
  private initPromise: Promise<void> | null = null;

  constructor() {
    const skillDir = path.join(os.homedir(), '.openclaw', 'skills', 'summarizer');
    this.dbPath = path.join(skillDir, 'summaries.db');
    
    if (!fs.existsSync(skillDir)) {
      fs.mkdirSync(skillDir, { recursive: true });
    }
  }

  private async initDatabase(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    if (this.db) return;

    this.initPromise = new Promise((resolve, reject) => {
      this.db = new (sqlite3 as any).Database(this.dbPath, (err: Error | null) => {
        if (err) {
          reject(err);
          return;
        }
        this.createTables().then(() => resolve()).catch(reject);
      });
    });

    return this.initPromise;
  }

  private async createTables(): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      this.db!.serialize(() => {
        this.db!.run(`
          CREATE TABLE IF NOT EXISTS summaries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT,
            original_text TEXT NOT NULL,
            summary TEXT NOT NULL,
            key_points TEXT NOT NULL,
            original_length INTEGER NOT NULL,
            summary_length INTEGER NOT NULL,
            compression_ratio REAL NOT NULL,
            document_type TEXT NOT NULL,
            length TEXT NOT NULL,
            format TEXT NOT NULL,
            focus_areas TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        this.db!.run(`
          CREATE INDEX IF NOT EXISTS idx_summaries_type ON summaries(document_type)
        `);

        this.db!.run(`
          CREATE INDEX IF NOT EXISTS idx_summaries_created ON summaries(created_at)
        `, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });
  }

  private getLengthMultiplier(length: SummaryLength): number {
    switch (length) {
      case 'short': return 0.1;
      case 'medium': return 0.2;
      case 'long': return 0.35;
      default: return 0.2;
    }
  }

  private extractSentences(text: string): string[] {
    const sentences = text
      .replace(/([.!?])\s+/g, "$1|")
      .split("|")
      .map(s => s.trim())
      .filter(s => s.length > 10);
    return sentences;
  }

  private scoreSentence(sentence: string, documentType: DocumentType, focus: string[]): number {
    let score = 0;
    const lower = sentence.toLowerCase();
    
    const documentTypeBoosts: Record<DocumentType, string[]> = {
      article: ['study', 'research', 'found', 'discovered', 'according', 'reported', 'said', 'announced'],
      document: ['conclusion', 'result', 'therefore', 'thus', 'important', 'key', 'significant'],
      email: ['action', 'please', 'need', 'request', 'deadline', 'meeting', 'follow'],
      meeting: ['decided', 'agreed', 'discussed', 'conclusion', 'next steps', 'action items'],
      research: ['method', 'finding', 'analysis', 'data', 'conclusion', 'hypothesis', 'significant']
    };

    const boosts = documentTypeBoosts[documentType] || documentTypeBoosts.document;
    boosts.forEach(keyword => {
      if (lower.includes(keyword)) score += 2;
    });

    focus.forEach(keyword => {
      if (lower.includes(keyword.toLowerCase())) score += 5;
    });

    if (/\d+%|\d+ percent/i.test(sentence)) score += 3;
    if (/\$\d+|\d+ dollars/i.test(sentence)) score += 2;
    if (/first|second|third|finally|in summary|conclusion/i.test(sentence)) score += 2;

    const words = sentence.split(/\s+/).length;
    if (words > 5 && words < 30) score += 1;

    return score;
  }

  private generateSummaryFromSentences(sentences: string[], targetLength: number, format: SummaryFormat): string {
    const targetSentences = Math.max(1, Math.ceil(targetLength / 100));
    
    let selected = sentences.slice(0, targetSentences);
    
    if (selected.length === 0) {
      return sentences.slice(0, 2).join(' ');
    }

    switch (format) {
      case 'bullet':
        return selected.map(s => `• ${s}`).join('\n');
      case 'numbered':
        return selected.map((s, i) => `${i + 1}. ${s}`).join('\n');
      case 'paragraph':
      default:
        return selected.join(' ');
    }
  }

  private extractKeyPoints(sentences: string[], maxPoints: number, documentType: DocumentType): string[] {
    const scored = sentences.map(sentence => ({
      sentence,
      score: this.scoreSentence(sentence, documentType, [])
    }));

    scored.sort((a, b) => b.score - a.score);
    
    return scored
      .slice(0, maxPoints)
      .map(item => item.sentence)
      .filter((v, i, a) => a.indexOf(v) === i);
  }

  async summarize(options: SummarizeOptions): Promise<SummaryResult> {
    await this.initDatabase();

    const {
      text,
      title,
      length = 'medium',
      format = 'paragraph',
      documentType = 'document',
      extractKeyPoints = true,
      maxKeyPoints = 5,
      focus = [],
      language = 'en'
    } = options;

    if (!text || text.trim().length === 0) {
      throw new Error('Text is required for summarization');
    }

    const originalLength = text.length;
    const sentences = this.extractSentences(text);
    
    if (sentences.length === 0) {
      throw new Error('Could not extract sentences from text');
    }

    const multiplier = this.getLengthMultiplier(length);
    const targetLength = Math.max(100, Math.floor(originalLength * multiplier));

    const scoredSentences = sentences
      .map(sentence => ({
        sentence,
        score: this.scoreSentence(sentence, documentType, focus),
        position: sentences.indexOf(sentence)
      }))
      .sort((a, b) => b.score - a.score || a.position - b.position);

    const summarySentences = scoredSentences
      .slice(0, Math.max(3, Math.ceil(sentences.length * multiplier)))
      .sort((a, b) => a.position - b.position)
      .map(item => item.sentence);

    const summary = this.generateSummaryFromSentences(summarySentences, targetLength, format);
    
    const keyPoints = extractKeyPoints 
      ? this.extractKeyPoints(sentences, maxKeyPoints, documentType)
      : [];

    const summaryLength = summary.length;
    const compressionRatio = originalLength > 0 ? summaryLength / originalLength : 0;

    const result: SummaryResult = {
      summary,
      keyPoints,
      originalLength,
      summaryLength,
      compressionRatio: parseFloat(compressionRatio.toFixed(2)),
      documentType,
      length,
      format,
      title,
      createdAt: new Date()
    };

    await this.saveSummary(result, text, focus);

    return result;
  }

  private async saveSummary(result: SummaryResult, originalText: string, focus: string[]): Promise<void> {
    await this.initDatabase();
    if (!this.db) return;

    const record = await runWithResult(this.db, `
      INSERT INTO summaries 
      (title, original_text, summary, key_points, original_length, summary_length, 
       compression_ratio, document_type, length, format, focus_areas)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      result.title || null,
      originalText,
      result.summary,
      JSON.stringify(result.keyPoints),
      result.originalLength,
      result.summaryLength,
      result.compressionRatio,
      result.documentType,
      result.length,
      result.format,
      JSON.stringify(focus)
    ]);

    result.id = record.lastID;
  }

  async summarizeFile(filePath: string, options: Omit<SummarizeOptions, 'text'>): Promise<SummaryResult> {
    const resolvedPath = path.resolve(filePath);
    
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const text = fs.readFileSync(resolvedPath, 'utf-8');
    const title = options.title || path.basename(filePath, path.extname(filePath));
    
    return this.summarize({
      ...options,
      text,
      title
    });
  }

  async getHistory(documentType?: DocumentType, limit: number = 20): Promise<SummaryResult[]> {
    await this.initDatabase();
    if (!this.db) return [];

    let sql = 'SELECT * FROM summaries ORDER BY created_at DESC LIMIT ?';
    const params: any[] = [limit];

    if (documentType) {
      sql = 'SELECT * FROM summaries WHERE document_type = ? ORDER BY created_at DESC LIMIT ?';
      params.unshift(documentType);
    }

    return new Promise((resolve, reject) => {
      this.db!.all(sql, params, (err, rows: SummaryRecord[]) => {
        if (err) {
          reject(err);
          return;
        }

        const results = rows.map(row => ({
          id: row.id,
          title: row.title || undefined,
          summary: row.summary,
          keyPoints: JSON.parse(row.key_points),
          originalLength: row.original_length,
          summaryLength: row.summary_length,
          compressionRatio: row.compression_ratio,
          documentType: row.document_type,
          length: row.length,
          format: row.format,
          createdAt: new Date(row.created_at)
        }));

        resolve(results);
      });
    });
  }

  async getSummary(id: number): Promise<SummaryResult | null> {
    await this.initDatabase();
    if (!this.db) return null;

    return new Promise((resolve, reject) => {
      this.db!.get('SELECT * FROM summaries WHERE id = ?', [id], (err, row: SummaryRecord) => {
        if (err) {
          reject(err);
          return;
        }

        if (!row) {
          resolve(null);
          return;
        }

        resolve({
          id: row.id,
          title: row.title || undefined,
          summary: row.summary,
          keyPoints: JSON.parse(row.key_points),
          originalLength: row.original_length,
          summaryLength: row.summary_length,
          compressionRatio: row.compression_ratio,
          documentType: row.document_type,
          length: row.length,
          format: row.format,
          createdAt: new Date(row.created_at)
        });
      });
    });
  }

  async getStats(): Promise<{
    totalSummaries: number;
    byDocumentType: Record<DocumentType, number>;
    byLength: Record<SummaryLength, number>;
    avgCompressionRatio: number;
  }> {
    await this.initDatabase();
    if (!this.db) {
      return {
        totalSummaries: 0,
        byDocumentType: { article: 0, document: 0, email: 0, meeting: 0, research: 0 },
        byLength: { short: 0, medium: 0, long: 0 },
        avgCompressionRatio: 0
      };
    }

    return new Promise((resolve, reject) => {
      this.db!.get('SELECT COUNT(*) as count FROM summaries', [], (err, row: { count: number }) => {
        if (err) {
          reject(err);
          return;
        }

        const total = row.count;

        this.db!.all('SELECT document_type, COUNT(*) as count FROM summaries GROUP BY document_type', [], 
          (err, rows: { document_type: DocumentType; count: number }[]) => {
            if (err) {
              reject(err);
              return;
            }

            const byDocumentType: Record<DocumentType, number> = { 
              article: 0, document: 0, email: 0, meeting: 0, research: 0 
            };
            rows.forEach(r => byDocumentType[r.document_type] = r.count);

            this.db!.all('SELECT length, COUNT(*) as count FROM summaries GROUP BY length', [],
              (err, rows: { length: SummaryLength; count: number }[]) => {
                if (err) {
                  reject(err);
                  return;
                }

                const byLength: Record<SummaryLength, number> = { short: 0, medium: 0, long: 0 };
                rows.forEach(r => byLength[r.length] = r.count);

                this.db!.get('SELECT AVG(compression_ratio) as avg FROM summaries', [],
                  (err, row: { avg: number }) => {
                    if (err) {
                      reject(err);
                      return;
                    }

                    resolve({
                      totalSummaries: total,
                      byDocumentType,
                      byLength,
                      avgCompressionRatio: row.avg ? parseFloat(row.avg.toFixed(2)) : 0
                    });
                  });
              });
          });
      });
    });
  }

  async deleteSummary(id: number): Promise<boolean> {
    await this.initDatabase();
    if (!this.db) return false;

    return new Promise((resolve, reject) => {
      this.db!.run('DELETE FROM summaries WHERE id = ?', [id], function(this: sqlite3.RunResult, err: Error | null) {
        if (err) {
          reject(err);
          return;
        }
        resolve(this.changes > 0);
      });
    });
  }

  async clearHistory(olderThanDays?: number): Promise<number> {
    await this.initDatabase();
    if (!this.db) return 0;

    return new Promise((resolve, reject) => {
      let sql = 'DELETE FROM summaries';
      const params: any[] = [];

      if (olderThanDays) {
        sql = 'DELETE FROM summaries WHERE created_at < datetime("now", "-' + olderThanDays + ' days")';
      }

      this.db!.run(sql, params, function(this: sqlite3.RunResult, err: Error | null) {
        if (err) {
          reject(err);
          return;
        }
        resolve(this.changes);
      });
    });
  }

  async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    try {
      await this.initDatabase();
      return { healthy: true, message: 'Summarizer skill is operational' };
    } catch (error) {
      return { healthy: false, message: `Database error: ${error}` };
    }
  }

  async close(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
    }

    if (this.db) {
      return new Promise((resolve, reject) => {
        this.db!.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
  }
}

export default SummarizerSkill;
