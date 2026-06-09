package filesystem;

import java.util.List;

/**
 * 文件系统组件基类（组合模式）。
 *
 * 考点：抽象类、组合模式、递归树操作、多态集合
 */
public abstract class FSComponent {
    protected String name;

    public FSComponent(String name) {
        this.name = name;
    }

    public String getName() {
        return name;
    }

    // TODO: 返回组件大小（字节）
    // File → 自身大小; Directory → 所有子组件大小之和（递归）
    public abstract long getSize();

    // TODO: 以树形结构打印到标准输出
    // File:   indent + "- " + name + " (" + size + "B)"
    // Dir:    indent + "+ " + name + "/ (" + getSize() + "B)"
    //         然后每个子组件递归调用 printTree(indent + "  ")
    public abstract void printTree(String indent);

    // TODO: 递归查找所有名字包含 keyword 的组件
    // 用 name.contains(keyword) 做模糊匹配
    // Directory 要递归查所有子组件，合并结果
    public abstract List<FSComponent> findAll(String keyword);

    // 便捷入口，根节点从空缩进开始
    public void printTree() {
        printTree("");
    }
}
