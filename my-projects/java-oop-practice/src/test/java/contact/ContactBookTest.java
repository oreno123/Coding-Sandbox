package contact;
import static org.junit.Assert.*;
import org.junit.Test;

public class ContactBookTest {

    @Test
    public void testAddContact() {
        ContactBook book = new ContactBook();
        assertTrue(book.addContact(new Contact("Alice", "13800001111")));
        assertEquals(1, book.getSize());
    }

    @Test
    public void testAddDuplicate() {
        ContactBook book = new ContactBook();
        book.addContact(new Contact("Alice", "13800001111"));
        // 手机号相同，判重，添加失败
        assertFalse(book.addContact(new Contact("Bob", "13800001111")));
        assertEquals(1, book.getSize());
    }

    @Test
    public void testAddNull() {
        ContactBook book = new ContactBook();
        assertFalse(book.addContact(null));
        assertEquals(0, book.getSize());
    }

    @Test
    public void testSearchByName() {
        ContactBook book = new ContactBook();
        book.addContact(new Contact("Zhang San", "13800001111"));
        book.addContact(new Contact("Li Si", "13800002222"));
        Contact found = book.searchByName("zhang");
        assertNotNull(found);
        assertEquals("13800001111", found.getPhone());
    }

    @Test
    public void testSearchByNameNotFound() {
        ContactBook book = new ContactBook();
        assertNull(book.searchByName("nobody"));
    }

    @Test
    public void testRemoveByPhone() {
        ContactBook book = new ContactBook();
        book.addContact(new Contact("Alice", "13800001111"));
        assertTrue(book.removeByPhone("13800001111"));
        assertEquals(0, book.getSize());
    }

    @Test
    public void testRemoveByPhoneNotFound() {
        ContactBook book = new ContactBook();
        assertFalse(book.removeByPhone("99999999999"));
    }

    @Test
    public void testContactEquals() {
        Contact c1 = new Contact("Alice", "13800001111");
        Contact c2 = new Contact("Bob", "13800001111");
        Contact c3 = new Contact("Alice", "13800002222");
        assertEquals(c1, c2);   // 手机号相同
        assertNotEquals(c1, c3); // 手机号不同
    }

    @Test
    public void testContactToString() {
        Contact c = new Contact("Alice", "13800001111");
        assertEquals("Alice (13800001111)", c.toString());
    }
}
