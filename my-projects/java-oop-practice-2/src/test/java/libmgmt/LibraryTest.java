package libmgmt;

import org.junit.Test;
import static org.junit.Assert.*;

public class LibraryTest {

    @Test
    public void testAddBook() {
        Library lib = new Library();
        Book b1 = new Book("Java入门", "张三", "001");
        lib.addBook(b1);
        assertNotNull(lib.findBook("001"));
    }

    @Test
    public void testAddDuplicateIsbn() {
        Library lib = new Library();
        lib.addBook(new Book("Java入门", "张三", "001"));
        lib.addBook(new Book("Java进阶", "李四", "001")); // 同 isbn，忽略
        Book found = lib.findBook("001");
        assertEquals("Java入门", found.toString().split(" by ")[0].replace("[001] ", ""));
    }

    @Test
    public void testRemoveBook() {
        Library lib = new Library();
        lib.addBook(new Book("Java入门", "张三", "001"));
        assertTrue(lib.removeBook("001"));
        assertFalse(lib.removeBook("001")); // 已移除
        assertNull(lib.findBook("001"));
    }

    @Test
    public void testListByAuthor() {
        Library lib = new Library();
        lib.addBook(new Book("Java入门", "张三", "001"));
        lib.addBook(new Book("Java进阶", "张三", "002"));
        lib.addBook(new Book("Python入门", "李四", "003"));
        assertEquals(2, lib.listByAuthor("张三").size());
        assertEquals(1, lib.listByAuthor("李四").size());
    }

    @Test
    public void testListAvailable() {
        Library lib = new Library();
        lib.addBook(new Book("Java入门", "张三", "001"));
        lib.addBook(new Book("Python入门", "李四", "003"));
        assertEquals(2, lib.listAvailable().size());
        lib.borrowBook("001");
        assertEquals(1, lib.listAvailable().size());
    }

    @Test
    public void testBorrowReturn() {
        Library lib = new Library();
        lib.addBook(new Book("Java入门", "张三", "001"));
        assertTrue(lib.borrowBook("001"));
        assertTrue(lib.findBook("001").isBorrowed());
        assertFalse(lib.borrowBook("001")); // 已借出
        assertTrue(lib.returnBook("001"));
        assertFalse(lib.findBook("001").isBorrowed());
    }

    @Test
    public void testBorrowReturnNotExist() {
        Library lib = new Library();
        assertFalse(lib.borrowBook("999"));
        assertFalse(lib.returnBook("999"));
    }

    @Test
    public void testBookToString() {
        Book b = new Book("Java入门", "张三", "001");
        assertEquals("[001] Java入门 by 张三 (在馆)", b.toString());
        b.borrow();
        assertEquals("[001] Java入门 by 张三 (借出)", b.toString());
    }

    @Test(expected = IllegalStateException.class)
    public void testBorrowTwiceThrows() {
        Book b = new Book("Java入门", "张三", "001");
        b.borrow();
        b.borrow(); // 应抛异常
    }

    @Test(expected = IllegalStateException.class)
    public void testReturnNotBorrowedThrows() {
        Book b = new Book("Java入门", "张三", "001");
        b.returnBook(); // 应抛异常
    }
}
