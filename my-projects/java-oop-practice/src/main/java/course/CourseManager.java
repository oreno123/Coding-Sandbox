package course;
import java.util.HashMap;
import java.util.Map;

public class CourseManager {
    private Map<String, Course> courses = new HashMap<>();

    public void createCourse(String name, int capacity) {
        Course c = new Course(name, capacity);
        courses.put(name, c);
        // TODO: 创建 Course 对象，put 进 Map（key = name）
    }

    public boolean enroll(String courseName, Student s) {
        // TODO: 从 Map 中取 Course，取不到返回 false；能取到就调用 addStudent
        if(!courses.containsKey(courseName)){
            return false;
        }else{
            return courses.get(courseName).addStudent(s);
        }
    }

    public void findCourse(String name) {
        // TODO: Map 中查找，找到调用 printRoster()，找不到打印 "Course [name] not found."
        if(courses.containsKey(name)){
            courses.get(name).printRoster();
        }else{
            System.out.println("Course " + name + " not found.");
        }
    }
}
