package filesystem;

import java.util.ArrayList;
import java.util.List;

/**
 * 文件 — 叶子节点。
 */
public class File extends FSComponent {
    private long size;

    public File(String name, long size) {
        super(name);
        this.size = size;
    }

    // TODO 1: 返回 size
    @Override
    public long getSize() {
        return this.size;
    }

    // TODO 2: 打印格式: indent + "- " + name + " (" + size + "B)"
    //         使用 System.out.println()
    @Override
    public void printTree(String indent) {
        System.out.println(indent + "- " + getName() + " (" + getSize() + "B)");
    }

    // TODO 3: 如果 name.contains(keyword) → 返回包含 this 的列表
    //         否则返回空列表
    @Override
    public List<FSComponent> findAll(String keyword) {
        List<FSComponent> result = new ArrayList<>();
        if (getName().contains(keyword)) {
            result.add(this);
            return result;
        }
        return new ArrayList<>();
    }
}
