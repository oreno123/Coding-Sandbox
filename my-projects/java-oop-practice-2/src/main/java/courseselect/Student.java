package courseselect;

import java.util.ArrayList;

public class Student {
    private String studentId;
    private String name;
    private ArrayList<String> enrolledCourseIds = new ArrayList<>();

    public Student(String studentId, String name) {
        // TODO
        this.studentId = studentId;
        this.name = name;
    }

    public boolean enroll(String courseId) {
        // TODO: 已选返回 false
        if (!enrolledCourseIds.contains(courseId)) {
            enrolledCourseIds.add(courseId);
            return true;
        }
        return false;
    }

    public boolean drop(String courseId) {
        // TODO: 未选返回 false
        if (enrolledCourseIds.contains(courseId)) {
            enrolledCourseIds.remove(courseId);
            return true;
        }
        return false;
    }

    public ArrayList<String> getEnrolledCourseIds() {
        return enrolledCourseIds;
    }

    public String getStudentId() {
        return studentId;
    }

    public String getName() {
        return name;
    }

    @Override
    public String toString() {
        // 格式: studentId name (已选N门)
        // TODO
        return studentId + " " + name + " (已选" + enrolledCourseIds.size() + "门)";
    }
}
