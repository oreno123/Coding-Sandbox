package filesystem;

import java.util.ArrayList;
import java.util.List;

/**
 * 目录 — 容器节点，可包含 File 和子 Directory。
 */
public class Directory extends FSComponent {
    private List<FSComponent> children;
    

    public Directory(String name) {
        super(name);
        this.children = new ArrayList<>();
    }

    // TODO 1: 添加子组件
    public void add(FSComponent component) {
        this.children.add(component);
    }

    // TODO 2: 移除子组件
    public void remove(FSComponent component) {

        this.children.remove(component);
    }

    // TODO 3: 返回子组件列表的副本（防御性拷贝）
    //         return new ArrayList<>(children);
    public List<FSComponent> getChildren() {
        return new ArrayList<>(children);
    }

    // TODO 4: 递归求和所有 children 的 getSize()
    @Override
    public long getSize() {
        long totalSize = 0;
        for (FSComponent child : children) {
            totalSize += child.getSize();
        }
        return totalSize;
    }

    // TODO 5: 打印自己: indent + "+ " + name + "/ (" + getSize() + "B)"
    //         然后遍历 children，每个调用 child.printTree(indent + "  ")
    @Override
    public void printTree(String indent) {
        System.out.println(indent + "+ " + getName() + "/ (" + getSize() + "B)");
        for (FSComponent child : children) {
            child.printTree(indent + "  ");
        }
    }

    // TODO 6: 先检查自身 name.contains(keyword)
    //         再遍历 children，把每个 child.findAll(keyword) 的结果全部加入
    @Override
    public List<FSComponent> findAll(String keyword) {
        List<FSComponent> childResults = new ArrayList<>();
        if (getName().contains(keyword)) {
            childResults.add(this);
        }
        for(FSComponent child : children) {
            childResults.addAll(child.findAll(keyword));
        }
        return childResults;
    }
}
