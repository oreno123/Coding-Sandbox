package genericlist;

import static org.junit.Assert.*;
import org.junit.Test;

import java.util.Iterator;
import java.util.NoSuchElementException;

public class SimpleLinkedListTest {

    @Test
    public void testAddAndSize() {
        SimpleLinkedList<String> list = new SimpleLinkedList<>();
        list.add("A");
        list.add("B");
        list.add("C");
        assertEquals(3, list.size());
    }

    @Test
    public void testGet() {
        SimpleLinkedList<Integer> list = new SimpleLinkedList<>();
        list.add(10);
        list.add(20);
        list.add(30);
        assertEquals(Integer.valueOf(10), list.get(0));
        assertEquals(Integer.valueOf(20), list.get(1));
        assertEquals(Integer.valueOf(30), list.get(2));
    }

    @Test(expected = IndexOutOfBoundsException.class)
    public void testGetOutOfBounds() {
        SimpleLinkedList<String> list = new SimpleLinkedList<>();
        list.add("A");
        list.get(5);
    }

    @Test
    public void testRemoveMiddle() {
        SimpleLinkedList<String> list = new SimpleLinkedList<>();
        list.add("A");
        list.add("B");
        list.add("C");
        assertEquals("B", list.remove(1));
        assertEquals(2, list.size());
        assertEquals("C", list.get(1));
    }

    @Test
    public void testRemoveFirst() {
        SimpleLinkedList<Integer> list = new SimpleLinkedList<>();
        list.add(1);
        list.add(2);
        list.add(3);
        assertEquals(Integer.valueOf(1), list.remove(0));
        assertEquals(2, list.size());
        assertEquals(Integer.valueOf(2), list.get(0));
    }

    @Test
    public void testRemoveLast() {
        SimpleLinkedList<String> list = new SimpleLinkedList<>();
        list.add("X");
        list.add("Y");
        list.add("Z");
        assertEquals("Z", list.remove(2));
        assertEquals(2, list.size());
    }

    @Test(expected = IndexOutOfBoundsException.class)
    public void testRemoveOutOfBounds() {
        SimpleLinkedList<String> list = new SimpleLinkedList<>();
        list.remove(0);
    }

    @Test
    public void testIsEmpty() {
        SimpleLinkedList<String> list = new SimpleLinkedList<>();
        assertTrue(list.isEmpty());
        list.add("X");
        assertFalse(list.isEmpty());
        list.remove(0);
        assertTrue(list.isEmpty());
    }

    @Test
    public void testContains() {
        SimpleLinkedList<String> list = new SimpleLinkedList<>();
        list.add("hello");
        list.add("world");
        assertTrue(list.contains("hello"));
        assertTrue(list.contains("world"));
        assertFalse(list.contains("java"));
    }

    @Test
    public void testContainsNull() {
        SimpleLinkedList<String> list = new SimpleLinkedList<>();
        assertFalse(list.contains(null));
        list.add(null);
        assertTrue(list.contains(null));
    }

    @Test
    public void testIterator() {
        SimpleLinkedList<Integer> list = new SimpleLinkedList<>();
        list.add(1);
        list.add(2);
        list.add(3);
        Iterator<Integer> it = list.iterator();
        assertTrue(it.hasNext());
        assertEquals(Integer.valueOf(1), it.next());
        assertEquals(Integer.valueOf(2), it.next());
        assertEquals(Integer.valueOf(3), it.next());
        assertFalse(it.hasNext());
    }

    @Test(expected = NoSuchElementException.class)
    public void testIteratorNoSuchElement() {
        SimpleLinkedList<String> list = new SimpleLinkedList<>();
        list.add("A");
        Iterator<String> it = list.iterator();
        it.next(); // "A"
        it.next(); // should throw
    }

    @Test
    public void testForEach() {
        SimpleLinkedList<String> list = new SimpleLinkedList<>();
        list.add("X");
        list.add("Y");
        list.add("Z");
        StringBuilder sb = new StringBuilder();
        for (String s : list) {
            sb.append(s);
        }
        assertEquals("XYZ", sb.toString());
    }

    @Test
    public void testToString() {
        SimpleLinkedList<String> list = new SimpleLinkedList<>();
        assertEquals("[]", list.toString());
        list.add("A");
        list.add("B");
        assertEquals("[A, B]", list.toString());
    }

    @Test
    public void testToStringSingle() {
        SimpleLinkedList<Integer> list = new SimpleLinkedList<>();
        list.add(42);
        assertEquals("[42]", list.toString());
    }

    @Test
    public void testGenericTypes() {
        SimpleLinkedList<Double> doubles = new SimpleLinkedList<>();
        doubles.add(3.14);
        doubles.add(2.71);
        assertEquals(Double.valueOf(3.14), doubles.get(0));

        SimpleLinkedList<String> strings = new SimpleLinkedList<>();
        strings.add("hello");
        assertEquals("hello", strings.get(0));
    }
}
