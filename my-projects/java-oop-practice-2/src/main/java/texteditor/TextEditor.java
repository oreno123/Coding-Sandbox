package texteditor;

import java.lang.reflect.Array;

public class TextEditor {
    private ArrayStack<Character> left;
    private ArrayStack<Character> right;

    public TextEditor() {
        // TODO: 初始化两个栈
        left = new ArrayStack<>();
        right = new ArrayStack<>();
    }

    public void insert(char ch) {
        // TODO: 在光标处插入一个字符（push 到 left）
        left.push(ch);
    }

    public void insert(String text) {
        // TODO: 在光标处插入一段文本（逐字符 push 到 left）
        for (char ch : text.toCharArray()) {
            left.push(ch);
        }
    }

    public char delete() {
        // TODO: 删除光标前一个字符（从 left 弹出），空则返回 '\0'
        if(left.isEmpty()) {
            return '\0';
        }
        return left.pop();
    }

    public char deleteRight() {
        // TODO: 删除光标后一个字符（从 right 弹出），空则返回 '\0'
        if(right.isEmpty()) {
            return '\0';
        }
        return right.pop();
    }

    public void moveLeft() {
        // TODO: 光标左移（从 left 弹出压入 right）
        if(!left.isEmpty()) {
            right.push(left.pop());
        }
    }

    public void moveRight() {
        // TODO: 光标右移（从 right 弹出压入 left）
        if(!right.isEmpty()) {
            left.push(right.pop());
        }
    }

    public void moveStart() {
        // TODO: 光标移到开头（把 left 全部倒入 right）
        while(!left.isEmpty()) {
            right.push(left.pop());
        }

    }

    public void moveEnd() {
        // TODO: 光标移到末尾（把 right 全部倒入 left）
        while(!right.isEmpty()) {
            left.push(right.pop());
        }
    }

    public String getText() {
        // TODO: 返回完整文本 = left 从底到顶 + right 从顶到底
        char[] lchars = new char[left.size()];
        for (int i = lchars.length - 1; i >= 0; i--) {
            lchars[i] = left.pop();
        }
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < lchars.length; i++) {
            sb.append(lchars[i]);
            left.push(lchars[i]);
        }
        char[] rchars = new char[right.size()];
        for (int i = 0; i < rchars.length; i++) {
            rchars[i] = right.pop();
        }
        for(int i = 0; i < rchars.length; i++) {
            sb.append(rchars[i]);
            right.push(rchars[i]);
        }
        return sb.toString();
    }

    public int getCursorPosition() {
        // TODO: 返回光标位置 = left.size()
        return left.size();
    }

    public void printState() {
        // TODO: 打印当前文本，用 | 表示光标位置
        // 例: 文本 "Hello"，光标在位置2 → "He|llo"
        char[] lchars = new char[left.size()];
        for (int i = lchars.length - 1; i >= 0; i--) {
            lchars[i] = left.pop();
        }
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < lchars.length; i++) {
            sb.append(lchars[i]);
            left.push(lchars[i]);
        }
        char[] rchars = new char[right.size()];
        for (int i = 0; i < rchars.length; i++) {
            rchars[i] = right.pop();
        }
        for(int i = 0; i < rchars.length; i++) {
            sb.append(rchars[i]);
            right.push(rchars[i]);
        }
        sb.insert(left.size(), '|');
        System.out.println(sb.toString());
    }
}
