
import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, MessageAuthor, KnowledgeEntry } from '../types';
import { BotIcon, SendIcon, UserIcon, VideoPlayIcon, TelegramIcon, DocumentIcon, ImageIcon } from './icons';

const playResponseSound = () => {
  const audio = new Audio('/bot-response.mp3');
  audio.play().catch(error => console.error("Error playing sound:", error));
};


interface ChatBubbleProps {
  message: ChatMessage;
}

const ChatBubble: React.FC<ChatBubbleProps> = ({ message }) => {
  const isUser = message.author === MessageAuthor.USER;
  
  const hasSources = message.sources && message.sources.length > 0;
  
  // Collect all unique links from all sources
  const attachmentLinks = hasSources ? message.sources!.reduce((acc, source) => {
    if (source.videoUrl) acc.videos.add(source.videoUrl);
    if (source.documentUrl) acc.documents.add(source.documentUrl);
    if (source.imageUrl) acc.images.add(source.imageUrl);
    return acc;
  }, { videos: new Set<string>(), documents: new Set<string>(), images: new Set<string>() }) : null;
  
  const hasAttachments = attachmentLinks && (attachmentLinks.videos.size > 0 || attachmentLinks.documents.size > 0 || attachmentLinks.images.size > 0);
  const hasFooter = !isUser;

  return (
    <div className={`flex items-start gap-2 my-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${isUser ? 'bg-blue-500' : 'bg-slate-700'}`}>
        {isUser ? <UserIcon className="w-5 h-5 text-white" /> : <BotIcon className="w-5 h-5 text-slate-300" />}
      </div>
      <div className={`w-full max-w-3xl rounded-xl flex flex-col ${
          isUser 
            ? 'bg-blue-500 text-white rounded-br-none' 
            : 'bg-slate-700 text-slate-200 rounded-bl-none'
        }`}>
        <p className="whitespace-pre-wrap text-justify text-sm p-2.5">{message.text}</p>
        
        {hasFooter && <div className="border-t border-slate-600/50 mt-2"></div>}
        
        <div className="px-2.5 py-2 space-y-2">
            {hasFooter && (
                <div className="flex justify-end items-center gap-2 flex-wrap">
                    {hasAttachments && [...attachmentLinks.videos].map(url => (
                        <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="text-xs font-medium bg-red-500 hover:bg-red-600 text-white py-1.5 px-3 rounded-md transition-colors flex items-center gap-1.5"><VideoPlayIcon className="w-4 h-4" /><span>ویدئو</span></a>
                    ))}
                    {hasAttachments && [...attachmentLinks.documents].map(url => (
                        <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="text-xs font-medium bg-blue-500 hover:bg-blue-600 text-white py-1.5 px-3 rounded-md transition-colors flex items-center gap-1.5"><DocumentIcon className="w-4 h-4" /><span>مستند</span></a>
                    ))}
                    {hasAttachments && [...attachmentLinks.images].map(url => (
                        <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="text-xs font-medium bg-green-500 hover:bg-green-600 text-white py-1.5 px-3 rounded-md transition-colors flex items-center gap-1.5"><ImageIcon className="w-4 h-4" /><span>تصویر</span></a>
                    ))}
                   <a
                    href="https://t.me/payvastsoftware"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium bg-sky-500 hover:bg-sky-600 text-white py-1.5 px-3 rounded-md transition-colors flex items-center gap-1.5"
                    aria-label="عضویت در کانال تلگرام"
                  >
                    <TelegramIcon className="w-4 h-4" />
                    <span>عضویت در کانال</span>
                  </a>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

interface ChatInterfaceProps {
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  isReady: boolean;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ messages, setMessages, isReady }) => {
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedInput = userInput.trim();
    if (!trimmedInput || isLoading || !isReady) return;

    const newUserMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      author: MessageAuthor.USER,
      text: trimmedInput,
    };
    
    setMessages(prev => [...prev, newUserMessage]);
    setUserInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: trimmedInput }),
      });

      if (!res.ok) {
        throw new Error('Server responded with an error.');
      }

      const data: { answer: string; sources: KnowledgeEntry[] } = await res.json();

      const botMessage: ChatMessage = {
        id: `bot-${Date.now()}`,
        author: MessageAuthor.BOT,
        text: data.answer || "متاسفانه پاسخی دریافت نشد.",
        sources: data.sources, // Store the full source objects
      };
      setMessages(prev => [...prev, botMessage]);
      playResponseSound();

    } catch (error) {
      console.error("Error fetching response:", error);
      const errorMessage: ChatMessage = {
        id: `err-${Date.now()}`,
        author: MessageAuthor.BOT,
        text: 'خطا در ارتباط با سرور. لطفاً اتصال خود را بررسی کرده و مجدداً تلاش کنید.',
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-slate-800 flex flex-col h-full p-3 md:p-4 rounded-xl border border-slate-700 overflow-hidden">
      <div className="flex-grow overflow-y-auto mb-3 -mx-3 px-3">
        {messages.map((msg) => 
            <ChatBubble key={msg.id} message={msg} />
        )}
        {isLoading && (
            <div className="flex items-start gap-2 my-3">
                 <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-slate-700">
                    <BotIcon className="w-5 h-5 text-slate-300"/>
                 </div>
                 <div className="w-full max-w-lg p-3 rounded-xl bg-slate-700 text-slate-200 rounded-bl-none">
                    <div className="flex items-center space-x-2" dir="ltr">
                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse"></div>
                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></div>
                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse" style={{animationDelay: '0.4s'}}></div>
                    </div>
                 </div>
            </div>
        )}
        <div ref={chatEndRef} />
      </div>
      <form onSubmit={handleSendMessage} className="flex items-center gap-2 mt-auto">
        <input
          type="text"
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          placeholder={isReady ? "سوال خود را اینجا بنویسید..." : "دستیار هوشمند در حال آماده‌سازی است..."}
          className="flex-grow bg-slate-800 border border-slate-700 rounded-md py-2 px-3 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all disabled:opacity-50"
          disabled={isLoading || !isReady}
        />
        <button
          type="submit"
          disabled={isLoading || !isReady || !userInput.trim()}
          className="bg-blue-500 text-white rounded-md p-2.5 disabled:bg-slate-600 disabled:cursor-not-allowed hover:bg-blue-600 transition-colors flex-shrink-0"
          aria-label="ارسال پیام"
        >
          <SendIcon className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
};