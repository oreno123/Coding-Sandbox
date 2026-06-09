package library;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class LibraryTest {

    @Test
    public void testBookBorrow() {
        Book book = new Book("Java Programming");
        assertEquals("Borrowed: Java Programming", book.borrow());
        assertFalse(book.isAvailable());
        assertEquals("Not available!", book.borrow()); // already borrowed
    }

    @Test
    public void testBookReturn() {
        Book book = new Book("Java Programming");
        book.borrow();
        assertEquals("Returned: Java Programming", book.returnItem());
        assertTrue(book.isAvailable());
    }

    @Test
    public void testReferenceBookNotBorrowable() {
        ReferenceBook ref = new ReferenceBook("Dictionary");
        assertEquals("Dictionary", ref.getTitle());
        assertTrue(ref.isAvailable());
        // ref.borrow(); // compile error - no borrow method
    }

    @Test
    public void testEBookDownloadCount() {
        EBook ebook = new EBook("Effective Java");
        assertEquals(0, ebook.getDownloadCount());
        ebook.borrow();
        assertEquals(1, ebook.getDownloadCount());
        ebook.returnItem();
        ebook.borrow();
        assertEquals(2, ebook.getDownloadCount());
    }

    @Test
    public void testEBookNotAvailable() {
        EBook ebook = new EBook("Clean Code");
        ebook.borrow();
        assertEquals("Not available!", ebook.borrow());
    }
}
