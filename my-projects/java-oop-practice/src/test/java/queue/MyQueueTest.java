package queue;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.assertFalse;

import org.junit.Test;

public class MyQueueTest {

    @Test
    public void testEnqueueAndPeek() {
        MyQueue queue = new MyQueue(3);
        queue.enqueue(10);
        assertEquals(10, queue.peek());
    }

    @Test
    public void testDequeue() {
        MyQueue queue = new MyQueue(3);
        queue.enqueue(1);
        queue.enqueue(2);
        assertEquals(1, queue.dequeue());
        assertEquals(2, queue.peek());
        assertEquals(1, queue.size());
    }

    @Test
    public void testEmptyQueue() {
        MyQueue queue = new MyQueue(3);
        assertTrue(queue.isEmpty());
        assertEquals(-1, queue.dequeue());
        assertEquals(-1, queue.peek());
    }

    @Test
    public void testFullQueue() {
        MyQueue queue = new MyQueue(3);
        queue.enqueue(1);
        queue.enqueue(2);
        queue.enqueue(3);
        assertTrue(queue.isFull());
        queue.enqueue(4); // should be ignored
        assertEquals(3, queue.size());
    }

    @Test
    public void testCircularBehavior() {
        MyQueue queue = new MyQueue(3);
        queue.enqueue(1);
        queue.enqueue(2);
        queue.dequeue();   // front moves to 1
        queue.enqueue(3);
        queue.enqueue(4);  // wraps around
        assertEquals(3, queue.size());
        assertEquals(2, queue.peek());
    }
}
