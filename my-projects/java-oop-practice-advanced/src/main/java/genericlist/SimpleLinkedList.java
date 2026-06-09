package genericlist;

import java.util.Iterator;
import java.util.NoSuchElementException;

import org.w3c.dom.Node;

/**
 * 泛型单链表，实现 Iterable<T> 接口，支持 for-each 遍历。
 *
 * 考点：泛型类、静态嵌套类、匿名内部类 / 内部类实现 Iterator、Iterable 接口
 */
public class SimpleLinkedList<T> implements Iterable<T> {

    // TODO 1: 定义私有静态嵌套类 Node<T>
    // 字段: T data, Node<T> next
    // 构造函数: Node(T data) — this.data = data; this.next = null;
    private static class Node<T> {
        T data;
        Node<T> next;

        public Node(T data) {
            this.data = data;
            this.next = null;
        }
    }


    private Node<T> head;
    private int size;

    public SimpleLinkedList() {
        head = null;
        size = 0;
    }

    // TODO 2: 在链表末尾添加元素
    // head == null → head = new Node<>(element)
    // 否则遍历到最后一个节点，末尾追加
    // 别忘了 size++
    public void add(T element) {
        if (head == null) {
            head = new Node<>(element);
        } else {
            Node<T> current = head;
            while (current.next != null) {
                current = current.next;
            }
            current.next = new Node<>(element);
        }
        size++;
    }

    // TODO 3: 返回指定索引的元素，越界抛 IndexOutOfBoundsException
    public T get(int index) {
            if (index < 0 || index >= size) {
                throw new IndexOutOfBoundsException("Index: " + index + ", Size: " + size);
            }
        Node<T> current = head;
        for (int i = 0; i < index; i++) {
            current = current.next;
        }
        return current.data;
    }

    // TODO 4: 移除指定索引的元素并返回
    // index == 0: head = head.next
    // 否则找到 index-1 节点，跳过 index 节点
    // 别忘了 size--
    public T remove(int index) {
        if (index < 0 || index >= size) {
            throw new IndexOutOfBoundsException("Index: " + index + ", Size: " + size);
        }
        if(index == 0){
            size--;
            Node<T> oldHead = head;
            head = head.next;
            return oldHead.data;
        }else{
            Node<T> prev = head;
            size--;
            for (int i = 0; i < index - 1; i++) {
                prev = prev.next;
            }
            Node<T> oldNode = prev.next;
            prev.next = prev.next.next;
            return oldNode.data;
        }
        
    }

    // TODO 5: 返回元素数量
    public int size() {
        return size;
    }

    // TODO 6: 判断链表是否为空
    public boolean isEmpty() {
        return size == 0;
    }

    // TODO 7: 判断是否包含指定元素
    // 注意 null 处理：如果 o == null，用 == 比较；否则用 o.equals(node.data)
    public boolean contains(Object o) {
        Node<T> current = head;
        while (current != null) {
            if (o == null) {
                if (current.data == null) {
                    return true;
                }
            } else {
                if (o.equals(current.data)) {
                    return true;
                }
            }
            current = current.next;
        }
        return false;
    }

    // TODO 8: 实现 iterator() — 返回 Iterator<T>
    // 方式一（推荐）：写一个私有内部类 ListIterator implements Iterator<T>
    //   字段: Node<T> current = head;
    //   hasNext(): current != null
    //   next(): 如果 !hasNext() 抛 NoSuchElementException;
    //           T data = current.data; current = current.next; return data;
    //
    // 方式二：用匿名内部类 new Iterator<T>() { ... }
    @Override
    public Iterator<T> iterator() {
        return new Iterator<T>() {
            Node<T> current = head;

            @Override
            public boolean hasNext() {
                return current != null;
            }

            @Override
            public T next() {
                if (!hasNext()) throw new NoSuchElementException();
                T data = current.data;
                current = current.next;
                return data;
            }
        };
    }

    // TODO 9: 返回 "[elem1, elem2, elem3]" 格式
    // 空链表 → "[]"
    // 提示: 用 StringBuilder，遍历 node，逗号分隔
    @Override
    public String toString() {
        StringBuilder sb = new StringBuilder("[");
        Node<T> current = head;
        while (current != null) {
            sb.append(current.data);
            if (current.next != null) {
                sb.append(", ");
            }
            current = current.next;
        }
        sb.append("]");
        return sb.toString();
    }
}
