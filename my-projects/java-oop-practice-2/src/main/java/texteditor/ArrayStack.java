package texteditor;

import java.util.EmptyStackException;

public class ArrayStack<T> {
    private Object[] data;
    private int size;
    private int capacity;

    public ArrayStack() {
        // TODO: 初始容量 4
        capacity = 4;
        data = new Object[capacity];
        size = 0;
    }

    public void push(T item) {

        // TODO: 数组满时扩容为原来的2倍（不要用 Arrays.copyOf，自己手写扩容）
        if (size == capacity) {
            Object[] newData = new Object[capacity * 2];
            for (int i = 0; i < size; i++) {
                newData[i] = data[i];
            }
            data = newData;
            capacity *= 2;
        }
        data[size] = item;
        size++;

    }

    @SuppressWarnings("unchecked")
    public T pop() {
        try {
            // TODO: 栈空抛 EmptyStackException
            T item = (T) data[size - 1];
            size--;
            return item;
        } catch (ArrayIndexOutOfBoundsException e) {
            throw new EmptyStackException();
        }
        // TODO: 栈空抛 EmptyStackException
    }

    @SuppressWarnings("unchecked")
    public T peek() {
        try {
            // TODO: 栈空抛 EmptyStackException
            return (T) data[size - 1];
        } catch (ArrayIndexOutOfBoundsException e) {
            throw new EmptyStackException();
        }
        // TODO: 栈空抛 EmptyStackException
    }

    public boolean isEmpty() {
        // TODO

        return size == 0;
    }

    public int size() {
        // TODO
        return size;
    }

    public int capacity() {
        // TODO: 返回当前数组容量（方便观察扩容）
        return capacity;
    }

    public void clear() {
        // TODO: 清空栈，size 归零
        for (int i = 0; i < size; i++) {
            data[i] = null;
        }
        size = 0;
    }
}
