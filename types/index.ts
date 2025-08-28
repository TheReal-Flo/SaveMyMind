export interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface NoteInput {
  title: string;
  content: string;
}

export type DateCategory = 'Today' | 'Yesterday' | 'This week' | 'This month' | 'Older';

export interface CategorizedNotes {
  [key: string]: Note[];
}

export interface NotesState {
  notes: Note[];
  loading: boolean;
  error: string | null;
}

export type RootStackParamList = {
  NotesList: undefined;
  NoteEditor: { noteId?: string };
};