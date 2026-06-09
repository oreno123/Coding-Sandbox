package task;

import static org.junit.Assert.*;
import org.junit.Test;
import java.util.List;

public class TaskTest {

    @Test
    public void testTaskStatusTransition() {
        Task t = new Task("Fix bug", TaskPriority.HIGH, "Alice");
        assertEquals(TaskStatus.TODO, t.getStatus());
        t.start();
        assertEquals(TaskStatus.IN_PROGRESS, t.getStatus());
        t.complete();
        assertEquals(TaskStatus.DONE, t.getStatus());
    }

    @Test
    public void testTaskCancel() {
        Task t = new Task("Fix bug", TaskPriority.HIGH, "Alice");
        t.cancel();
        assertEquals(TaskStatus.CANCELLED, t.getStatus());
    }

    @Test
    public void testTaskToString() {
        Task t = new Task("Fix bug", TaskPriority.HIGH, "Alice");
        assertEquals("Fix bug (HIGH) - TODO @ Alice", t.toString());
    }

    @Test
    public void testCompareTo() {
        Task urgent = new Task("Emergency", TaskPriority.URGENT, "Bob");
        Task high = new Task("Feature", TaskPriority.HIGH, "Alice");
        Task low = new Task("Cleanup", TaskPriority.LOW, "Charlie");
        // 降序：URGENT(level=4) 排前面，所以 urgent.compareTo(high) < 0
        assertTrue(urgent.compareTo(high) < 0);
        assertTrue(low.compareTo(high) > 0);
    }

    @Test
    public void testCompareToSamePriority() {
        Task a = new Task("Alpha", TaskPriority.HIGH, "Bob");
        Task b = new Task("Beta", TaskPriority.HIGH, "Bob");
        assertTrue(a.compareTo(b) < 0);
        assertTrue(b.compareTo(a) > 0);
    }

    @Test
    public void testTaskManagerFilterByStatus() {
        TaskManager manager = new TaskManager();
        Task t1 = new Task("Task1", TaskPriority.HIGH, "Alice");
        Task t2 = new Task("Task2", TaskPriority.LOW, "Bob");
        t1.complete();
        manager.addTask(t1);
        manager.addTask(t2);

        List<Task> done = manager.filterByStatus(TaskStatus.DONE);
        assertEquals(1, done.size());
        assertEquals("Task1", done.get(0).getTitle());
    }

    @Test
    public void testTaskManagerFilterByAssignee() {
        TaskManager manager = new TaskManager();
        manager.addTask(new Task("T1", TaskPriority.HIGH, "Alice"));
        manager.addTask(new Task("T2", TaskPriority.LOW, "Bob"));
        manager.addTask(new Task("T3", TaskPriority.MEDIUM, "Alice"));

        List<Task> aliceTasks = manager.filterByAssignee("Alice");
        assertEquals(2, aliceTasks.size());
    }

    @Test
    public void testTaskManagerSortByPriority() {
        TaskManager manager = new TaskManager();
        manager.addTask(new Task("Low", TaskPriority.LOW, "A"));
        manager.addTask(new Task("Urgent", TaskPriority.URGENT, "B"));
        manager.addTask(new Task("High", TaskPriority.HIGH, "C"));

        List<Task> sorted = manager.getSortedByPriority();
        assertEquals(TaskPriority.URGENT, sorted.get(0).getPriority());
        assertEquals(TaskPriority.HIGH, sorted.get(1).getPriority());
        assertEquals(TaskPriority.LOW, sorted.get(2).getPriority());
    }

    @Test
    public void testAddNullTask() {
        TaskManager manager = new TaskManager();
        manager.addTask(null);
        assertEquals(0, manager.getTaskCount());
    }

    @Test
    public void testFilterEmpty() {
        TaskManager manager = new TaskManager();
        List<Task> result = manager.filterByStatus(TaskStatus.TODO);
        assertNotNull(result);
        assertEquals(0, result.size());
    }
}
