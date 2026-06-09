package texteditor;

import org.junit.Test;
import static org.junit.Assert.*;

public class TextEditorTest {

    @Test
    public void testInsertChar() {
        TextEditor editor = new TextEditor();
        editor.insert('H');
        editor.insert('i');
        assertEquals("Hi", editor.getText());
        assertEquals(2, editor.getCursorPosition());
    }

    @Test
    public void testInsertString() {
        TextEditor editor = new TextEditor();
        editor.insert("Hello");
        assertEquals("Hello", editor.getText());
        assertEquals(5, editor.getCursorPosition());
    }

    @Test
    public void testDelete() {
        TextEditor editor = new TextEditor();
        editor.insert("Hello");
        assertEquals('o', editor.delete());
        assertEquals("Hell", editor.getText());
    }

    @Test
    public void testDeleteEmpty() {
        TextEditor editor = new TextEditor();
        assertEquals('\0', editor.delete());
    }

    @Test
    public void testDeleteRight() {
        TextEditor editor = new TextEditor();
        editor.insert("Hello");
        editor.moveLeft(); // 光标在 'o' 和 'l' 之间
        assertEquals('o', editor.deleteRight());
        assertEquals("Hell", editor.getText());
    }

    @Test
    public void testDeleteRightEmpty() {
        TextEditor editor = new TextEditor();
        assertEquals('\0', editor.deleteRight());
    }

    @Test
    public void testMoveLeftRight() {
        TextEditor editor = new TextEditor();
        editor.insert("ABC");
        assertEquals(3, editor.getCursorPosition());

        editor.moveLeft(); // 光标在 B|C
        assertEquals(2, editor.getCursorPosition());

        editor.moveLeft(); // 光标在 A|B
        assertEquals(1, editor.getCursorPosition());

        editor.moveRight(); // 光标在 AB|
        assertEquals(2, editor.getCursorPosition());
    }

    @Test
    public void testMoveStartEnd() {
        TextEditor editor = new TextEditor();
        editor.insert("Hello");
        assertEquals(5, editor.getCursorPosition());

        editor.moveStart();
        assertEquals(0, editor.getCursorPosition());

        editor.moveEnd();
        assertEquals(5, editor.getCursorPosition());
    }

    @Test
    public void testInsertAtMiddle() {
        TextEditor editor = new TextEditor();
        editor.insert("Hllo");
        editor.moveStart();
        editor.moveRight(); // H|llo
        editor.insert('e'); // He|llo
        assertEquals("Hello", editor.getText());
    }

    @Test
    public void testComplexEdit() {
        TextEditor editor = new TextEditor();
        editor.insert("Hello World");
        // 删除 "World"
        for (int i = 0; i < 5; i++) editor.delete();
        assertEquals("Hello ", editor.getText());
        editor.delete(); // 删空格
        assertEquals("Hello", editor.getText());
        editor.moveStart();
        editor.moveRight();
        editor.moveRight();
        editor.delete(); // 删 'l'
        assertEquals("Hllo", editor.getText());
    }

    // ========== ArrayStack 测试 ==========

    @Test
    public void testStackPushPop() {
        ArrayStack<Integer> stack = new ArrayStack<>();
        stack.push(1);
        stack.push(2);
        stack.push(3);
        assertEquals(3, stack.size());
        assertEquals(Integer.valueOf(3), stack.peek());
        assertEquals(Integer.valueOf(3), stack.pop());
        assertEquals(Integer.valueOf(2), stack.pop());
        assertEquals(1, stack.size());
    }

    @Test
    public void testStackIsEmpty() {
        ArrayStack<String> stack = new ArrayStack<>();
        assertTrue(stack.isEmpty());
        stack.push("a");
        assertFalse(stack.isEmpty());
    }

    @Test
    public void testStackCapacityExpand() {
        ArrayStack<Integer> stack = new ArrayStack<>();
        assertEquals(4, stack.capacity());
        stack.push(1);
        stack.push(2);
        stack.push(3);
        stack.push(4);
        assertEquals(4, stack.capacity()); // 刚好满
        stack.push(5); // 触发扩容
        assertEquals(8, stack.capacity());
        assertEquals(5, stack.size());
    }

    @Test
    public void testStackClear() {
        ArrayStack<Integer> stack = new ArrayStack<>();
        stack.push(1);
        stack.push(2);
        stack.clear();
        assertTrue(stack.isEmpty());
        assertEquals(0, stack.size());
    }

    @Test(expected = java.util.EmptyStackException.class)
    public void testStackPopEmpty() {
        ArrayStack<Integer> stack = new ArrayStack<>();
        stack.pop();
    }

    @Test(expected = java.util.EmptyStackException.class)
    public void testStackPeekEmpty() {
        ArrayStack<Integer> stack = new ArrayStack<>();
        stack.peek();
    }

    @Test
    public void testStackDoubleExpand() {
        ArrayStack<Integer> stack = new ArrayStack<>();
        assertEquals(4, stack.capacity());
        for (int i = 0; i < 9; i++) stack.push(i);
        // 4→8→16
        assertEquals(16, stack.capacity());
        assertEquals(9, stack.size());
        // 验证顺序没乱
        assertEquals(Integer.valueOf(8), stack.pop());
        assertEquals(Integer.valueOf(7), stack.pop());
    }
}
