const AsyncStorage = require('@react-native-async-storage/async-storage');

async function checkNotes() {
  try {
    const data = await AsyncStorage.getItem('savemymind_notes');
    if (data) {
      const notes = JSON.parse(data);
      console.log('Found', notes.length, 'notes:');
      notes.forEach((note, i) => {
        console.log(`Thought ${i+1}:`, {
          id: note.id,
          title: note.title,
          content: note.content ? note.content.substring(0, 50) + '...' : 'No content',
          createdAt: note.createdAt
        });
      });
    } else {
      console.log('No thoughts found in storage');
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

checkNotes();