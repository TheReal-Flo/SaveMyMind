import AsyncStorage from '@react-native-async-storage/async-storage';
import { Note, NoteInput, DateCategory, CategorizedNotes } from '../types';

const NOTES_STORAGE_KEY = 'savemymind_notes';

// Generate unique ID for notes
export const generateId = (): string => {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
};

// Date categorization functions
export const getDateCategory = (date: Date): DateCategory => {
  const now = new Date();
  const noteDate = new Date(date);
  
  // Reset time to compare only dates
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const noteDateOnly = new Date(noteDate.getFullYear(), noteDate.getMonth(), noteDate.getDate());
  
  const diffTime = today.getTime() - noteDateOnly.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays <= 7) return 'This week';
  if (diffDays <= 30) return 'This month';
  return 'Older';
};

// Categorize notes by date
export const categorizeNotes = (notes: Note[]): CategorizedNotes => {
  const categories: CategorizedNotes = {
    'Today': [],
    'Yesterday': [],
    'This week': [],
    'This month': [],
    'Older': []
  };
  
  notes.forEach(note => {
    const category = getDateCategory(note.updatedAt);
    categories[category].push(note);
  });
  
  // Sort notes within each category by date (newest first)
  Object.keys(categories).forEach(category => {
    categories[category].sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  });
  
  return categories;
};

// Filter notes by search term
export const filterNotes = (notes: Note[], searchTerm: string): Note[] => {
  if (!searchTerm.trim()) return notes;
  
  const lowercaseSearch = searchTerm.toLowerCase();
  return notes.filter(note => 
    note.title.toLowerCase().includes(lowercaseSearch) ||
    note.content.toLowerCase().includes(lowercaseSearch)
  );
};

// AsyncStorage operations
export const saveNotesToStorage = async (notes: Note[]): Promise<void> => {
  try {
    const notesJson = JSON.stringify(notes);
    await AsyncStorage.setItem(NOTES_STORAGE_KEY, notesJson);
  } catch (error) {
    console.error('Error saving notes to storage:', error);
    throw error;
  }
};

export const loadNotesFromStorage = async (): Promise<Note[]> => {
  try {
    const notesJson = await AsyncStorage.getItem(NOTES_STORAGE_KEY);
    if (!notesJson) return [];
    
    const notes = JSON.parse(notesJson);
    // Convert date strings back to Date objects
    return notes.map((note: any) => ({
      ...note,
      createdAt: new Date(note.createdAt),
      updatedAt: new Date(note.updatedAt)
    }));
  } catch (error) {
    console.error('Error loading notes from storage:', error);
    return [];
  }
};

// Generate title from content if no title provided
export const generateTitleFromContent = (content: string): string => {
  if (!content || !content.trim()) {
    return 'New note';
  }
  
  // Get first line of content, remove extra whitespace
  const firstLine = content.trim().split('\n')[0].trim();
  
  // If first line is empty, try to find first non-empty line
  if (!firstLine) {
    const lines = content.trim().split('\n');
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine) {
        return trimmedLine.length > 50 ? trimmedLine.substring(0, 50) + '...' : trimmedLine;
      }
    }
    return 'New note';
  }
  
  // Limit title length to 50 characters
  return firstLine.length > 50 ? firstLine.substring(0, 50) + '...' : firstLine;
};

// Note CRUD operations
export const createNote = (noteInput: NoteInput): Note => {
  const now = new Date();
  const title = noteInput.title?.trim() || generateTitleFromContent(noteInput.content || '');
  
  return {
    id: generateId(),
    title,
    content: noteInput.content || '',
    createdAt: now,
    updatedAt: now
  };
};

export const updateNote = (existingNote: Note, updates: Partial<NoteInput>): Note => {
  // If title is being updated and is empty, generate from content
  let title = updates.title !== undefined ? updates.title : existingNote.title;
  const content = updates.content !== undefined ? updates.content : existingNote.content;
  
  // If title is empty or just whitespace, generate from content
  if (!title || !title.trim()) {
    title = generateTitleFromContent(content || '');
  }
  
  return {
    ...existingNote,
    ...updates,
    title,
    updatedAt: new Date()
  };
};

// Format date for display
export const formatDate = (date: Date): string => {
  const now = new Date();
  const noteDate = new Date(date);
  
  if (noteDate.toDateString() === now.toDateString()) {
    return noteDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  
  return noteDate.toLocaleDateString([], { 
    month: 'short', 
    day: 'numeric',
    year: noteDate.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  });
};