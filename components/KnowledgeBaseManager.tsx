
import React, { useState, useEffect } from 'react';
import { KnowledgeEntry, KnowledgeEntryType } from '../types';
import { 
    PlusIcon, EditIcon, TrashIcon, XIcon, ThumbsUpIcon, ThumbsDownIcon, EyeIcon, 
    VideoPlayIcon, DocumentIcon, ImageIcon 
} from './icons';

// --- Helper Components & Data ---

const typeColors: { [key in KnowledgeEntryType]: string } = {
    [KnowledgeEntryType.SUPPORT]: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    [KnowledgeEntryType.SALES]: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    [KnowledgeEntryType.GENERAL]: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
};

const Stat: React.FC<{ icon: React.ReactNode; value: number, label: string }> = ({ icon, value, label }) => (
    <div className="flex items-center gap-1.5 text-xs text-slate-400" title={label}>
        {icon}
        <span>{value}</span>
    </div>
);

// --- Form Modal Component (moved outside) ---

interface FormModalProps {
    isEditing: boolean;
    currentEntry: Partial<KnowledgeEntry>;
    setCurrentEntry: React.Dispatch<React.SetStateAction<Partial<KnowledgeEntry>>>;
    handleClose: () => void;
    handleSave: (e: React.FormEvent) => void;
}

const FormModal: React.FC<FormModalProps> = ({ isEditing, currentEntry, setCurrentEntry, handleClose, handleSave }) => (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 p-4">
        <div className="bg-slate-800 rounded-lg p-6 w-full max-w-3xl border border-slate-700 relative" dir="rtl">
            <h3 className="text-xl font-bold mb-4">{isEditing ? 'ویرایش پرسش و پاسخ' : 'افزودن پرسش و پاسخ جدید'}</h3>
            <button onClick={handleClose} className="absolute top-4 left-4 text-slate-400 hover:text-white transition-colors" aria-label="بستن فرم">
                <XIcon className="w-6 h-6" />
            </button>
            <form onSubmit={handleSave} className="space-y-4">
                {/* Question and Answer Textareas */}
                <div>
                    <label htmlFor="question" className="block text-sm font-medium text-slate-300 mb-1">سوال</label>
                    <textarea id="question" rows={2}
                        className="w-full bg-slate-900 border border-slate-700 rounded-md py-2 px-3 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={currentEntry.question || ''} onChange={e => setCurrentEntry({ ...currentEntry, question: e.target.value })} required />
                </div>
                <div>
                    <label htmlFor="answer" className="block text-sm font-medium text-slate-300 mb-1">پاسخ</label>
                    <textarea id="answer" rows={5}
                        className="w-full bg-slate-900 border border-slate-700 rounded-md py-2 px-3 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={currentEntry.answer || ''} onChange={e => setCurrentEntry({ ...currentEntry, answer: e.target.value })} required />
                </div>

                {/* Type and System Inputs */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="type" className="block text-sm font-medium text-slate-300 mb-1">نوع</label>
                        <select id="type" value={currentEntry.type} onChange={e => setCurrentEntry({ ...currentEntry, type: e.target.value as KnowledgeEntryType })}
                            className="w-full bg-slate-900 border border-slate-700 rounded-md py-2 px-3 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500">
                            {Object.values(KnowledgeEntryType).map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="system" className="block text-sm font-medium text-slate-300 mb-1">سیستم</label>
                        <input type="text" id="system" value={currentEntry.system || ''} onChange={e => setCurrentEntry({ ...currentEntry, system: e.target.value })}
                            className="w-full bg-slate-900 border border-slate-700 rounded-md py-2 px-3 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                    </div>
                </div>

                {/* Attachments Section */}
                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">ضمائم</label>
                    <div className="flex items-center gap-6 mb-3">
                        {/* Checkboxes */}
                        <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                            <input type="checkbox" checked={currentEntry.hasVideo || false} onChange={e => setCurrentEntry({ ...currentEntry, hasVideo: e.target.checked })}
                                className="w-4 h-4 rounded bg-slate-700 border-slate-600 text-blue-500 focus:ring-blue-500" />
                            شامل ویدئو
                        </label>
                        <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                            <input type="checkbox" checked={currentEntry.hasDocument || false} onChange={e => setCurrentEntry({ ...currentEntry, hasDocument: e.target.checked })}
                                className="w-4 h-4 rounded bg-slate-700 border-slate-600 text-blue-500 focus:ring-blue-500" />
                            شامل مستند
                        </label>
                        <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                            <input type="checkbox" checked={currentEntry.hasImage || false} onChange={e => setCurrentEntry({ ...currentEntry, hasImage: e.target.checked })}
                                className="w-4 h-4 rounded bg-slate-700 border-slate-600 text-blue-500 focus:ring-blue-500" />
                            شامل تصویر
                        </label>
                    </div>
                    
                    {/* Conditional URL Inputs */}
                    <div className="space-y-3">
                        {currentEntry.hasVideo && (
                            <div>
                                <label htmlFor="videoUrl" className="block text-xs font-medium text-slate-400 mb-1">لینک ویدئو</label>
                                <input type="url" id="videoUrl" placeholder="https://aparat.com/v/..." value={currentEntry.videoUrl || ''} onChange={e => setCurrentEntry({ ...currentEntry, videoUrl: e.target.value })}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-md py-2 px-3 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                        )}
                        {currentEntry.hasDocument && (
                            <div>
                                <label htmlFor="documentUrl" className="block text-xs font-medium text-slate-400 mb-1">لینک مستند</label>
                                <input type="url" id="documentUrl" placeholder="https://example.com/doc.pdf" value={currentEntry.documentUrl || ''} onChange={e => setCurrentEntry({ ...currentEntry, documentUrl: e.target.value })}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-md py-2 px-3 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                        )}
                        {currentEntry.hasImage && (
                             <div>
                                <label htmlFor="imageUrl" className="block text-xs font-medium text-slate-400 mb-1">لینک تصویر</label>
                                <input type="url" id="imageUrl" placeholder="https://example.com/image.png" value={currentEntry.imageUrl || ''} onChange={e => setCurrentEntry({ ...currentEntry, imageUrl: e.target.value })}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-md py-2 px-3 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                        )}
                    </div>
                </div>

                {/* Submit Button */}
                <div className="flex justify-end pt-2">
                    <button type="submit" className="bg-blue-600 text-white rounded-md py-2 px-5 hover:bg-blue-700 transition-colors">
                        {isEditing ? 'ذخیره تغییرات' : 'افزودن مورد'}
                    </button>
                </div>
            </form>
        </div>
    </div>
);

// --- Main Manager Component ---

export const KnowledgeBaseManager: React.FC = () => {
    const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [isFormVisible, setIsFormVisible] = useState<boolean>(false);
    const [currentEntry, setCurrentEntry] = useState<Partial<KnowledgeEntry>>({});
    const [isEditing, setIsEditing] = useState<boolean>(false);

    const fetchEntries = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/knowledge-base');
            if (!res.ok) throw new Error('Failed to fetch knowledge base.');
            const data: KnowledgeEntry[] = await res.json();
            setEntries(data.sort((a, b) => (b.hits || 0) - (a.hits || 0)));
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchEntries();
    }, []);

    const handleOpenForm = (entry?: KnowledgeEntry) => {
        if (entry) {
            setCurrentEntry(entry);
            setIsEditing(true);
        } else {
            setCurrentEntry({
                question: '',
                answer: '',
                type: KnowledgeEntryType.GENERAL,
                system: '',
                hasVideo: false, hasDocument: false, hasImage: false,
                videoUrl: '', documentUrl: '', imageUrl: '',
            });
            setIsEditing(false);
        }
        setIsFormVisible(true);
    };

    const handleCloseForm = () => {
        setIsFormVisible(false);
        setCurrentEntry({});
        setIsEditing(false);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        const { id, ...entryData } = currentEntry;
        if (!entryData.question?.trim() || !entryData.answer?.trim() || !entryData.type || !entryData.system?.trim()) return;

        const url = isEditing ? `/api/knowledge-base/${id}` : '/api/knowledge-base';
        const method = isEditing ? 'PUT' : 'POST';
        
        try {
            const res = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(entryData),
            });
            if (!res.ok) {
                throw new Error(isEditing ? 'Failed to update entry.' : 'Failed to add entry.');
            }
            await fetchEntries();
            handleCloseForm();
        } catch (err: any) {
            setError(err.message);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('آیا از حذف این مورد اطمینان دارید؟')) return;

        try {
            const res = await fetch(`/api/knowledge-base/${id}`, { method: 'DELETE' });
            if (!res.ok) {
                 throw new Error('Failed to delete entry.');
            }
            setEntries(prev => prev.filter(entry => entry.id !== id));
        } catch (err: any) {
            setError(err.message);
        }
    };

    if (isLoading) return <div className="text-center p-10">در حال بارگذاری پایگاه دانش...</div>;
    if (error) return <div className="text-center p-10 text-red-400">خطا: {error}</div>;

    return (
        <div className="bg-slate-800 h-full p-4 rounded-xl border border-slate-700 flex flex-col">
            {isFormVisible && 
                <FormModal 
                    isEditing={isEditing}
                    currentEntry={currentEntry}
                    setCurrentEntry={setCurrentEntry}
                    handleClose={handleCloseForm}
                    handleSave={handleSave}
                />
            }
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-white">مدیریت پایگاه دانش</h2>
                <button onClick={() => handleOpenForm()} className="bg-blue-500 text-white rounded-md py-2 px-4 hover:bg-blue-600 transition-colors flex items-center gap-2">
                    <PlusIcon className="w-5 h-5" />
                    <span>افزودن</span>
                </button>
            </div>
            <div className="flex-grow overflow-y-auto -mx-2 px-2">
                {entries.length === 0 ? (
                    <p className="text-slate-400 text-center mt-8">هیچ موردی در پایگاه دانش وجود ندارد.</p>
                ) : (
                    <div className="space-y-3">
                        {entries.map(entry => (
                            <div key={entry.id} className="bg-slate-900/50 p-4 rounded-lg border border-slate-700 space-y-3 flex flex-col">
                                <div>
                                    <p className="font-semibold text-slate-100">{entry.question}</p>
                                    <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed mt-2">{entry.answer}</p>
                                </div>
                                
                                <div className="flex justify-between items-center gap-4 pt-3 border-t border-slate-700/50 flex-wrap">
                                    <div className="flex items-center gap-4 flex-wrap">
                                        <div className={`text-xs font-medium px-2 py-0.5 rounded-full border ${typeColors[entry.type]}`}>{entry.type}</div>
                                        <div className="text-xs font-semibold bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">{entry.system}</div>
                                        <div className="flex items-center gap-3 text-slate-400">
                                            {entry.hasVideo && <VideoPlayIcon className="w-4 h-4 text-red-400" aria-label="شامل ویدئو" role="img" />}
                                            {entry.hasDocument && <DocumentIcon className="w-4 h-4 text-blue-400" aria-label="شامل مستند" role="img"/>}
                                            {entry.hasImage && <ImageIcon className="w-4 h-4 text-green-400" aria-label="شامل تصویر" role="img"/>}
                                        </div>
                                    </div>
                                     <div className="flex items-center gap-4">
                                        <Stat icon={<ThumbsUpIcon className="w-4 h-4 text-green-500"/>} value={entry.likes} label="مفید"/>
                                        <Stat icon={<ThumbsDownIcon className="w-4 h-4 text-red-500"/>} value={entry.dislikes} label="غیرمفید"/>
                                        <Stat icon={<EyeIcon className="w-4 h-4 text-sky-400"/>} value={entry.hits} label="بازدید"/>
                                    </div>
                                </div>
                                
                                <div className="flex justify-between items-end mt-2">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        {entry.videoUrl && <a href={entry.videoUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-medium bg-red-500 hover:bg-red-600 text-white py-1 px-2.5 rounded-md transition-colors flex items-center gap-1.5"><VideoPlayIcon className="w-4 h-4"/>نمایش ویدئو</a>}
                                        {entry.documentUrl && <a href={entry.documentUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-medium bg-blue-500 hover:bg-blue-600 text-white py-1 px-2.5 rounded-md transition-colors flex items-center gap-1.5"><DocumentIcon className="w-4 h-4"/>نمایش مستند</a>}
                                        {entry.imageUrl && <a href={entry.imageUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-medium bg-green-500 hover:bg-green-600 text-white py-1 px-2.5 rounded-md transition-colors flex items-center gap-1.5"><ImageIcon className="w-4 h-4"/>نمایش تصویر</a>}
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button onClick={() => handleOpenForm(entry)} className="p-2 text-slate-400 hover:text-blue-400 transition-colors" aria-label="ویرایش">
                                            <EditIcon className="w-5 h-5" />
                                        </button>
                                        <button onClick={() => handleDelete(entry.id)} className="p-2 text-slate-400 hover:text-red-400 transition-colors" aria-label="حذف">
                                            <TrashIcon className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};