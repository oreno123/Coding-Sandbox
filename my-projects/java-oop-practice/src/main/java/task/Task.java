package task;

class Task implements Comparable<Task> {
    private String title;
    private TaskPriority priority;
    private TaskStatus status;
    private String assignee;

    public Task(String title, TaskPriority priority, String assignee) {
        this.title = title;
        this.priority = priority;
        this.assignee = assignee;
        this.status = TaskStatus.TODO;
    }

    // TODO: 将状态改为 IN_PROGRESS
    public void start() {
        this.status = TaskStatus.IN_PROGRESS;

    }

    // TODO: 将状态改为 DONE
    public void complete() {

        this.status = TaskStatus.DONE;
    }

    // TODO: 将状态改为 CANCELLED
    public void cancel() {

        this.status = TaskStatus.CANCELLED;
    }

    // TODO: 按 priority.level 降序排列（level 大的排前面，即 compareTo 返回负数）
    //       level 相同时按 title 字母序升序
    //       提示: int cmp = Integer.compare(other.priority.level, this.priority.level);
    //             if (cmp != 0) return cmp;
    //             return this.title.compareTo(other.title);
    @Override
    public int compareTo(Task other) {
        int cmp = Integer.compare(other.priority.getLevel(), this.priority.getLevel());
        if (cmp != 0) return cmp;
        return this.title.compareTo(other.title);
    }

    public String getTitle() { return title; }
    public TaskPriority getPriority() { return priority; }
    public TaskStatus getStatus() { return status; }
    public String getAssignee() { return assignee; }

    // TODO: 返回 "[title] ([priority]) - [status] @ [assignee]"
    //       如 "Fix bug (HIGH) - TODO @ Alice"
    @Override
    public String toString() {
        return String.format("%s (%s) - %s @ %s", title, priority, status, assignee);
    }
}
