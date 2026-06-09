package courseselect;

public class Course {
    private String courseId;
    private String courseName;
    private int capacity;
    private int enrolled;

    public Course(String courseId, String courseName, int capacity) {
        // TODO
        this.courseId = courseId;
        this.courseId = courseId;
        this.courseName = courseName;
        this.capacity = capacity;
        this.enrolled = 0;
    }

    public boolean addStudent() {
        // TODO: 满员返回 false，否则 enrolled++
        if (isFull()) {
            return false;
        }
        enrolled++;
        return true;
    }

    public boolean removeStudent() {
        // TODO: 无人返回 false，否则 enrolled--
        if (enrolled == 0) {
            return false;
        }
        enrolled--;
        return true;
    }

    public boolean isFull() {
        // TODO
        return enrolled >= capacity;
    }

    public int getAvailable() {
        // TODO
        return 0;
    }

    public String getCourseId() {
        return courseId;
    }

    public String getCourseName() {
        return courseName;
    }

    public int getCapacity() {
        return capacity;
    }

    public int getEnrolled() {
        return enrolled;
    }

    @Override
    public String toString() {
        // 格式: courseId courseName (enrolled/capacity)
        // TODO
        return null;
    }
}
