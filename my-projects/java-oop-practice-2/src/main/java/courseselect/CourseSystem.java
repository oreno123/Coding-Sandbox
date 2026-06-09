package courseselect;

import java.util.HashMap;

public class CourseSystem {
    private HashMap<String, Student> students = new HashMap<>();
    private HashMap<String, Course> courses = new HashMap<>();

    public void addStudent(Student s) {
        if (!students.containsKey(s.getStudentId())) {
            students.put(s.getStudentId(), s);
    }
        // TODO: id 重复忽略
    }

    public void addCourse(Course c) {
        if (!courses.containsKey(c.getCourseId())) {
            courses.put(c.getCourseId(), c);
        }
        // TODO: id 重复忽略
    }

    public boolean enroll(String studentId, String courseId) {
        // TODO: 学生不存在/课程不存在/已选/满员都返回 false
        if (!students.containsKey(studentId) || !courses.containsKey(courseId)) {
            return false;
        }
        Student student = students.get(studentId);
        Course course = courses.get(courseId);
        if (student.enroll(courseId)) {
            course.addStudent();
            return true;
        }
        return false;
    }

    public boolean drop(String studentId, String courseId) {
        // TODO: 学生不存在/课程不存在/未选都返回 false
        // 成功则两边都更新
        return false;
    }

    public void printStudentCourses(String studentId) {
        // TODO: 打印该学生所有已选课程的信息（调用 Course 的 toString）
        // 学生不存在则打印 "学生不存在"
    }
}
