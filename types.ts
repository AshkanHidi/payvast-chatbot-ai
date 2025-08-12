export enum MessageAuthor {
  USER = 'user',
  BOT = 'bot',
}

export enum KnowledgeEntryType {
  SUPPORT = 'پشتیبانی',
  SALES = 'فروش',
  GENERAL = 'عمومی',
}

export interface KnowledgeEntry {
  id: string;
  question: string;
  answer: string;
  type: KnowledgeEntryType;
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


export interface ChatMessage {
  id: string;
  author: MessageAuthor;
  text: string;
  sources?: KnowledgeEntry[]; // To track which KB entries were used for the answer
}