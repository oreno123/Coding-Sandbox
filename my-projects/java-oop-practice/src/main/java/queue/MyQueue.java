package queue;
public class MyQueue {
    private int[] data;
    private int front = 0;
    private int rear = 0;
    private int count = 0;

    public MyQueue(int capacity) {
        data = new int[capacity];
    }

    public void enqueue(int value) {
        if (count == data.length) return;
        data[rear] = value;
        rear = (rear + 1) % data.length;
        count++;
    }

    public int dequeue() {
        if (count == 0) return -1;
        int temp = data[front];
        front = (front + 1) % data.length;
        count--;
        return temp;
    }

    public int peek() {
        // TODO: 空则返回 -1，否则返回 front 位置的值
        if(count == 0){
            return -1;
        }else{
            return data[front];
        }
    }

    public boolean isEmpty() {
        // TODO
        if(count == 0){
            return true;
        }
        return false;
    }

    public boolean isFull() {
        // TODO
        return count == data.length;
    }

    public int size() {
        // TODO
        return count;
    }
}
