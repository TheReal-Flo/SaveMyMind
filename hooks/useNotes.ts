import { useState, useEffect, useCallback } from 'react';
import { Note, NoteInput, NotesState } from '../types';
import {
  loadNotesFromStorage,
  saveNotesToStorage,
  createNote,
  updateNote,
  filterNotes,
  categorizeNotes
} from '../utils/noteUtils';

export const useNotes = () => {
  const [state, setState] = useState<NotesState>({
    notes: [],
    loading: true,
    error: null
  });

  const [searchTerm, setSearchTerm] = useState('');

  // Load notes from storage on mount
  useEffect(() => {
    loadNotes();
  }, []);

  const loadNotes = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      const notes = await loadNotesFromStorage();
      setState(prev => ({ ...prev, notes, loading: false }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: 'Failed to load notes'
      }));
    }
  }, []);

  const saveNotes = useCallback(async (notes: Note[]) => {
    try {
      await saveNotesToStorage(notes);
      setState(prev => ({ ...prev, notes, error: null }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: 'Failed to save notes'
      }));
    }
  }, []);

  const addNote = useCallback(async (noteInput: NoteInput) => {
    try {
      // Validate input
      if (!noteInput || typeof noteInput !== 'object') {
        throw new Error('Invalid note input');
      }
      
      const newNote = createNote(noteInput);
      
      // Validate created note
      if (!newNote || !newNote.id || !newNote.createdAt || !newNote.updatedAt) {
        throw new Error('Failed to create valid note structure');
      }
      
      const updatedNotes = [newNote, ...state.notes];
      await saveNotes(updatedNotes);
      return newNote;
    } catch (error) {
      console.error('Error creating note:', error);
      setState(prev => ({
        ...prev,
        error: `Failed to create note: ${error instanceof Error ? error.message : 'Unknown error'}`
      }));
      throw error;
    }
  }, [state.notes, saveNotes]);

  const updateNoteById = useCallback(async (noteId: string, updates: Partial<NoteInput>) => {
    try {
      // Validate input
      if (!noteId || typeof noteId !== 'string') {
        throw new Error('Invalid note ID');
      }
      
      const noteIndex = state.notes.findIndex(note => note.id === noteId);
      if (noteIndex === -1) {
        throw new Error('Note not found');
      }

      const existingNote = state.notes[noteIndex];
      
      // Validate existing note structure
      if (!existingNote || !existingNote.id) {
        throw new Error('Invalid existing note structure');
      }
      
      const updatedNote = updateNote(existingNote, updates);
      
      // Validate updated note before saving
      if (!updatedNote || !updatedNote.id || updatedNote.id !== noteId) {
        throw new Error('Note update resulted in invalid data');
      }
      
      const updatedNotes = [...state.notes];
      updatedNotes[noteIndex] = updatedNote;

      await saveNotes(updatedNotes);
      return updatedNote;
    } catch (error) {
      console.error('Error updating note:', error);
      setState(prev => ({
        ...prev,
        error: `Failed to update note: ${error instanceof Error ? error.message : 'Unknown error'}`
      }));
      throw error;
    }
  }, [state.notes, saveNotes]);

  const deleteNote = useCallback(async (noteId: string) => {
    try {
      const updatedNotes = state.notes.filter(note => note.id !== noteId);
      await saveNotes(updatedNotes);
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: 'Failed to delete note'
      }));
      throw error;
    }
  }, [state.notes, saveNotes]);

  const deleteAllNotes = useCallback(async () => {
    try {
      await saveNotes([]);
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: 'Failed to delete all notes'
      }));
      throw error;
    }
  }, [saveNotes]);

  const getNoteById = useCallback((noteId: string): Note | undefined => {
    return state.notes.find(note => note.id === noteId);
  }, [state.notes]);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // Get filtered and categorized notes
  const filteredNotes = filterNotes(state.notes, searchTerm);
  const categorizedNotes = categorizeNotes(filteredNotes);

  return {
    // State
    notes: state.notes,
    loading: state.loading,
    error: state.error,
    searchTerm,
    filteredNotes,
    categorizedNotes,

    // Actions
    setSearchTerm,
    addNote,
    updateNoteById,
    deleteNote,
    deleteAllNotes,
    getNoteById,
    clearError,
    refreshNotes: loadNotes
  };
};