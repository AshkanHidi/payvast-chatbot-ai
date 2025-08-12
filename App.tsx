import React, { useState } from 'react';
import { ChatInterface } from './components/ChatInterface';
import { KnowledgeBaseManager } from './components/KnowledgeBaseManager';
import { ChatMessage, MessageAuthor } from './types';
import { DatabaseIcon, ChatIcon } from './components/icons';

function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'init',
      author: MessageAuthor.BOT,
      text: 'سلام! من دستیار هوشمند گروه نرم‌افزاری پیوست هستم. سوال خود را بپرسید تا با کمک هوش مصنوعی پاسخ دهم.',
    }
  ]);
  const [statusMessage] = useState<string>('دستیار هوشمند پیوست‌یار، آماده پاسخگویی است.');
  const [isReady] = useState<boolean>(true);
  const [view, setView] = useState<'chat' | 'kb'>('chat');

  const ViewToggleButton = () => (
    <button
      onClick={() => setView(v => v === 'chat' ? 'kb' : 'chat')}
      className="absolute top-3 left-3 bg-slate-700/50 text-slate-300 rounded-full p-2 hover:bg-slate-700 hover:text-white transition-all focus:outline-none focus:ring-2 focus:ring-blue-500"
      aria-label={view === 'chat' ? "مدیریت پایگاه دانش" : "بازگشت به چت"}
    >
      {view === 'chat' ? <DatabaseIcon className="w-6 h-6" /> : <ChatIcon className="w-6 h-6" />}
    </button>
  );

  return (
    <main 
      className="app-container bg-slate-900 text-slate-200 h-screen flex flex-col p-3 lg:p-4" 
      dir="rtl"
    >
        <header className="text-center mb-4 flex-shrink-0 relative">
          <h1 className="text-2xl md:text-3xl font-bold text-white">
             {view === 'chat' ? <>چت‌بات <span className="text-blue-400">گروه نرم‌افزاری پیوست</span></> : "مدیریت پایگاه دانش"}
          </h1>
          <p className="text-xs text-slate-500 mt-2 transition-colors duration-300">
            {view === 'chat' ? statusMessage : 'افزودن، ویرایش و حذف پرسش و پاسخ‌ها'}
          </p>
          <ViewToggleButton />
        </header>

        <div className="w-full max-w-screen-lg mx-auto flex-grow min-h-0">
            {view === 'chat' ? (
                <ChatInterface 
                    messages={messages} 
                    setMessages={setMessages}
                    isReady={isReady}
                />
            ) : (
                <KnowledgeBaseManager />
            )}
        </div>
    </main>
  );
}

export default App;
