
export async function toggleOfflineBook(book, buttonElement) {
    try {
        // Use the global window object database reference
        const existingBook = await window.db.books.get(book.id);

        if (existingBook) {
            await window.db.books.delete(book.id);
            console.log(`"${book.title}" removed from offline shelf.`);
            updateDownloadIcon(buttonElement, false);
        } else {
            await window.db.books.add({
                id: book.id,
                title: book.title,
                author: book.author || 'Unknown Author',
                content: book.content || book.description || 'No summary available.',
                mood: book.mood || 'general',
                coverUrl: book.coverUrl || ''
            });
            console.log(`"${book.title}" downloaded for offline reading!`);
            updateDownloadIcon(buttonElement, true);
        }
    } catch (error) {
        console.error("Failed to alter local shelf cache:", error);
    }
}
