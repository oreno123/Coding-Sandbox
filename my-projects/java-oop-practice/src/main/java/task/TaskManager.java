package task;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

class TaskManager {
    private List<Task> tasks = new ArrayList<>();

    // TODO: 添加任务，task 为 null 则忽略
    public void addTask(Task task) {
        if (task != null) {
            tasks.add(task);
        }

    }

    // TODO: 按状态过滤，返回新 List
    public List<Task> filterByStatus(TaskStatus status) {
        List<Task> filteredTasks = new ArrayList<>();
        for (Task task : tasks) {
            if (task.getStatus() == status) {
                filteredTasks.add(task);
            }
        }
        return filteredTasks;
    }   

    // TODO: 按指派人过滤，返回新 List
    public List<Task> filterByAssignee(String assignee) {
        List<Task> filteredTasks = new ArrayList<>();
        for (Task task : tasks) {
            if (task.getAssignee().equals(assignee)) {
                filteredTasks.add(task);
            }
        }
        return filteredTasks;
    }

    // TODO: 返回按优先级排序的副本（利用 Task.compareTo）
    //       提示: List<Task> sorted = new ArrayList<>(tasks);
    //             Collections.sort(sorted);
    //             return sorted;
    public List<Task> getSortedByPriority() {
        List<Task> sorted = new ArrayList<>(tasks);
        Collections.sort(sorted);
        return sorted;
    }

    public List<Task> getAllTasks() {
        return new ArrayList<>(tasks);
    }

    public int getTaskCount() {
        return tasks.size();
    }
}
