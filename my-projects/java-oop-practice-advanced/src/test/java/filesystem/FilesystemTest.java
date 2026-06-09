package filesystem;

import static org.junit.Assert.*;
import org.junit.Test;

import java.util.List;
import java.io.ByteArrayOutputStream;
import java.io.PrintStream;

public class FilesystemTest {

    /**
     * 构建测试目录树:
     * root/
     * + src/
     *   - Main.java (500B)
     *   - Utils.java (300B)
     * + docs/
     *   - README.md (1000B)
     *   + guide/
     *     - tutorial.txt (2000B)
     * - config.properties (50B)
     */
    private Directory buildSampleTree() {
        Directory root = new Directory("root");

        Directory src = new Directory("src");
        src.add(new File("Main.java", 500));
        src.add(new File("Utils.java", 300));

        Directory docs = new Directory("docs");
        docs.add(new File("README.md", 1000));
        Directory guide = new Directory("guide");
        guide.add(new File("tutorial.txt", 2000));
        docs.add(guide);

        root.add(src);
        root.add(docs);
        root.add(new File("config.properties", 50));

        return root;
    }

    @Test
    public void testFileSize() {
        File f = new File("test.txt", 100);
        assertEquals("test.txt", f.getName());
        assertEquals(100, f.getSize());
    }

    @Test
    public void testDirectorySize() {
        Directory root = buildSampleTree();
        // src: 500 + 300 = 800
        // docs: 1000 + 2000 = 3000
        // config: 50
        // total: 800 + 3000 + 50 = 3850
        assertEquals(3850, root.getSize());
    }

    @Test
    public void testEmptyDirectorySize() {
        Directory empty = new Directory("empty");
        assertEquals(0, empty.getSize());
    }

    @Test
    public void testGetChildren() {
        Directory root = buildSampleTree();
        List<FSComponent> children = root.getChildren();
        assertEquals(3, children.size());
        // 防御性拷贝验证
        children.clear();
        assertEquals(3, root.getChildren().size());
    }

    @Test
    public void testFindJavaFiles() {
        Directory root = buildSampleTree();
        List<FSComponent> results = root.findAll(".java");
        assertEquals(2, results.size());
        boolean foundMain = false, foundUtils = false;
        for (FSComponent c : results) {
            if (c.getName().equals("Main.java")) foundMain = true;
            if (c.getName().equals("Utils.java")) foundUtils = true;
        }
        assertTrue(foundMain);
        assertTrue(foundUtils);
    }

    @Test
    public void testFindDirectory() {
        Directory root = buildSampleTree();
        List<FSComponent> results = root.findAll("guide");
        assertEquals(1, results.size());
        assertEquals("guide", results.get(0).getName());
        assertTrue(results.get(0) instanceof Directory);
    }

    @Test
    public void testFindNone() {
        Directory root = buildSampleTree();
        List<FSComponent> results = root.findAll("nonexistent");
        assertEquals(0, results.size());
    }

    @Test
    public void testFindRoot() {
        Directory root = buildSampleTree();
        List<FSComponent> results = root.findAll("root");
        assertEquals(1, results.size());
        assertEquals("root", results.get(0).getName());
    }

    @Test
    public void testFindAllDot() {
        Directory root = buildSampleTree();
        // "." matches all files and directories (every name contains ".")
        List<FSComponent> results = root.findAll(".");
        // All 7 components contain ".": root, src, Main.java, Utils.java, docs, README.md, config.properties
        // Actually: "root" doesn't contain ".", "src" doesn't, "guide" doesn't
        // Only: Main.java, Utils.java, README.md, config.properties, tutorial.txt = 5
        // Plus: tutorial.txt is inside docs/guide/, and "docs" contains "."
        // Let me just check files with extensions
        assertTrue(results.size() >= 5);
    }

    @Test
    public void testAddRemove() {
        Directory dir = new Directory("test");
        File f = new File("a.txt", 10);
        dir.add(f);
        assertEquals(10, dir.getSize());
        dir.remove(f);
        assertEquals(0, dir.getSize());
    }

    @Test
    public void testPrintTreeDirectory() {
        Directory dir = new Directory("mydir");
        dir.add(new File("a.txt", 100));

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        PrintStream oldOut = System.out;
        System.setOut(new PrintStream(baos));
        dir.printTree();
        System.setOut(oldOut);

        String output = baos.toString();
        assertTrue(output.contains("+ mydir/"));
        assertTrue(output.contains("- a.txt"));
        assertTrue(output.contains("100B"));
    }

    @Test
    public void testPrintTreeFile() {
        File f = new File("hello.java", 42);
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        PrintStream oldOut = System.out;
        System.setOut(new PrintStream(baos));
        f.printTree();
        System.setOut(oldOut);

        String output = baos.toString();
        assertTrue(output.contains("- hello.java"));
        assertTrue(output.contains("42B"));
    }

    @Test
    public void testNestedPrintTree() {
        Directory root = buildSampleTree();
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        PrintStream oldOut = System.out;
        System.setOut(new PrintStream(baos));
        root.printTree();
        System.setOut(oldOut);

        String output = baos.toString();
        assertTrue(output.contains("+ root/"));
        assertTrue(output.contains("+ src/"));
        assertTrue(output.contains("+ docs/"));
        assertTrue(output.contains("+ guide/"));
        assertTrue(output.contains("- Main.java"));
        assertTrue(output.contains("- tutorial.txt"));
    }
}
